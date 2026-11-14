import { createHash, randomUUID } from 'node:crypto'
import { generateRecap, generateWeekCopy } from './generateRecap.js'

const LEAGUE_ID = '1389752419247747072'
const CONTENT_TABLE = 'weekly_content'
// Cover the claim request, the 60-second model call, and the save request.
const CLAIM_LEASE_MS = 2 * 60 * 1000
const AUTO_COOLDOWN_MS = 60 * 60 * 1000
const RECAP_PROGRESS_VERSION = 1

function requiredEnv(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be configured on the server.')
  }
  let projectUrl
  try {
    projectUrl = new URL(env.SUPABASE_URL)
  } catch {
    throw new Error('SUPABASE_URL must be the Supabase project URL, such as https://your-project.supabase.co.')
  }
  // PostgREST paths are added below. Use only the project origin so a stale
  // `/rest/v1` suffix or other copied dashboard path cannot be duplicated.
  return { url: projectUrl.origin, key: env.SUPABASE_SECRET_KEY }
}

async function dbRequest(env, path, { method = 'GET', body, prefer } = {}) {
  const { url, key } = requiredEnv(env)
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    signal: AbortSignal.timeout(15_000),
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  const result = text ? JSON.parse(text) : null
  if (!response.ok) throw new Error(result?.message || result?.hint || `Supabase request failed (${response.status}).`)
  return result
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function fingerprint(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex')
}

function easternClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]))
}

function isGameWindow(date = new Date()) {
  const { weekday, hour } = easternClock(date)
  const h = Number(hour)
  return (weekday === 'Thu' && h >= 20) || (weekday === 'Sun' && h >= 13) || (weekday === 'Mon' && h >= 20)
}

function isAfterFinalCutoff(date = new Date()) {
  const { weekday, hour } = easternClock(date)
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayIndex = weekdays.indexOf(weekday)
  // Thursday starts the next NFL slate, so only Tuesday after 1 a.m. through
  // Wednesday should finalize the current week's shared copy.
  return dayIndex === 3 || (dayIndex === 2 && Number(hour) >= 1)
}

function rowFilters(key) {
  return new URLSearchParams({
    league_id: `eq.${key.league_id}`, season: `eq.${key.season}`, week: `eq.${key.week}`,
    content_type: `eq.${key.content_type}`, item_key: `eq.${key.item_key}`,
  })
}

async function readContent(env, key) {
  const filters = rowFilters(key)
  filters.set('select', '*')
  const rows = await dbRequest(env, `${CONTENT_TABLE}?${filters}`)
  return rows?.[0] || null
}

async function claimContent(env, key, existing) {
  const token = randomUUID()
  const now = new Date()
  const claim = { generation_token: token, generation_started_at: now.toISOString() }
  if (!existing) {
    try {
      const rows = await dbRequest(env, `${CONTENT_TABLE}?on_conflict=league_id,season,week,content_type,item_key`, {
        method: 'POST',
        body: [{ ...key, payload: {}, ...claim }],
        prefer: 'resolution=ignore-duplicates,return=representation',
      })
      if (rows?.length) return { token, row: rows[0] }
    } catch (error) {
      // A concurrent insert can win the unique key. Re-read and claim it below.
      if (!/duplicate|unique/i.test(error.message)) throw error
    }
    existing = await readContent(env, key)
  }
  if (!existing) throw new Error('The shared content row could not be read after creation. Please try again.')

  const filters = rowFilters(key)
  if (existing.generation_token) {
    const startedAt = Date.parse(existing.generation_started_at || '')
    if (Number.isFinite(startedAt) && Date.now() - startedAt <= CLAIM_LEASE_MS) return null
    filters.set('generation_token', `eq.${existing.generation_token}`)
  } else {
    filters.set('generation_token', 'is.null')
  }
  const rows = await dbRequest(env, `${CONTENT_TABLE}?${filters}`, {
    method: 'PATCH', body: claim, prefer: 'return=representation',
  })
  return rows?.length ? { token, row: rows[0] } : null
}

async function finishClaim(env, key, token, patch) {
  const filters = rowFilters(key)
  filters.set('generation_token', `eq.${token}`)
  const rows = await dbRequest(env, `${CONTENT_TABLE}?${filters}`, {
    method: 'PATCH',
    body: { ...patch, generation_token: null, generation_started_at: null },
    prefer: 'return=representation',
  })
  if (!rows?.length) throw new Error('This content generation claim expired before it could be saved. Please try again.')
  return rows[0]
}

async function abandonClaim(env, key, token) {
  const filters = rowFilters(key)
  filters.set('generation_token', `eq.${token}`)
  await dbRequest(env, `${CONTENT_TABLE}?${filters}`, {
    method: 'PATCH', body: { generation_token: null, generation_started_at: null },
    prefer: 'return=minimal',
  }).catch(() => {})
}

function claimIsActive(row) {
  return Boolean(row?.generation_token && row.generation_started_at &&
    Date.now() - new Date(row.generation_started_at).getTime() <= CLAIM_LEASE_MS)
}

function claimIsStale(row) {
  return Boolean(row?.generation_token && !claimIsActive(row))
}

function finalForRequest(body, now) {
  if (body.isFinal === false) return false
  if (body.isFinal === true || body.isCurrentWeek === false) return true
  return body.isCurrentWeek === true && isAfterFinalCutoff(now)
}

function canAutoGenerate(row, sourceHash, isFinal, now) {
  if (!row?.generated_at) return true
  // A current week can be incorrectly marked final by upstream league
  // settings. Allow the next live request to replace that premature copy.
  if (row.is_final && !isFinal) return true
  if (isFinal && !row.is_final) return true
  if (row.is_final) return false
  if (!isGameWindow(now) || row.source_hash === sourceHash) return false
  return now.getTime() - new Date(row.generated_at).getTime() >= AUTO_COOLDOWN_MS
}

function mergeRecaps(existing, generated, matchupKeys) {
  const byKey = new Map((existing || []).map((recap) => [recap.matchupKey, recap]))
  generated.forEach((recap, index) => byKey.set(matchupKeys[index] || recap.matchupKey, {
    ...recap, matchupKey: matchupKeys[index] || recap.matchupKey,
  }))
  return [...byKey.values()]
}

export async function generateSharedRecaps(body, env) {
  const season = Number(body.season)
  const week = Number(body.week)
  const matchups = body.matchups
  if (!Number.isInteger(season) || !Number.isInteger(week) || !Array.isArray(matchups) || !matchups.length) {
    throw new Error('Season, week, and at least one matchup are required.')
  }
  const key = { league_id: String(body.leagueId || LEAGUE_ID), season, week, content_type: 'recap', item_key: 'all' }
  const source = body.sourceMatchups || matchups
  const sourceHash = fingerprint(source)
  const now = new Date()
  let row = await readContent(env, key)
  const isFinal = source.some((matchup) => matchup.status && matchup.status !== 'final') ? false : finalForRequest(body, now)
  const manual = body.manual === true
  if (claimIsActive(row)) {
    return { recaps: row.payload?.recaps || [], generatedAt: row.generated_at || null, isFinal: Boolean(row.is_final), cached: true, generating: true }
  }
  // Refresh live copy written before game-progress context was introduced,
  // even outside a game window. Keep historical recaps intact.
  const needsProgressContext = !isFinal && row?.payload?.recaps?.some((recap) => recap.progressVersion !== RECAP_PROGRESS_VERSION)
  const shouldGenerate = manual || needsProgressContext || claimIsStale(row) || canAutoGenerate(row, sourceHash, isFinal, now)
  if (!shouldGenerate) return { recaps: row?.payload?.recaps || [], generatedAt: row?.generated_at || null, isFinal: Boolean(row?.is_final), cached: true }

  const claim = await claimContent(env, key, row)
  if (!claim) {
    row = await readContent(env, key)
    return { recaps: row?.payload?.recaps || [], generatedAt: row?.generated_at || null, isFinal: Boolean(row?.is_final), cached: true, generating: true }
  }
  try {
    const generated = await generateRecap({ season, week, matchups, isFinal }, { apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL })
    const matchupKeys = body.matchupKeys || []
    const recaps = mergeRecaps(claim.row.payload?.recaps, generated.map((recap) => ({ ...recap, progressVersion: RECAP_PROGRESS_VERSION })), matchupKeys)
    const updated = await finishClaim(env, key, claim.token, {
      payload: { recaps }, source_hash: sourceHash, generated_at: new Date().toISOString(), is_final: isFinal,
    })
    return { recaps, generatedAt: updated.generated_at, isFinal: Boolean(updated.is_final), cached: false }
  } catch (error) {
    await abandonClaim(env, key, claim.token)
    throw error
  }
}

export async function generateSharedBanner(body, env) {
  const season = Number(body.season)
  const week = Number(body.week)
  if (!Number.isInteger(season) || !Number.isInteger(week) || !body.highScore) throw new Error('Season, week, and a weekly high score are required.')
  const key = { league_id: String(body.leagueId || LEAGUE_ID), season, week, content_type: 'banner', item_key: 'banner' }
  const sourceHash = fingerprint({ bannerCopyVersion: 2, highScore: body.highScore, closest: body.closest || null })
  const now = new Date()
  let row = await readContent(env, key)
  const isFinal = finalForRequest(body, now)
  const manual = body.manual === true
  if (claimIsActive(row)) {
    return {
      copy: row.payload?.headline && row.payload?.subtitle ? row.payload : null,
      generatedAt: row.generated_at || null,
      isFinal: Boolean(row.is_final),
      cached: true,
      generating: true,
    }
  }
  if (!manual && !claimIsStale(row) && !canAutoGenerate(row, sourceHash, isFinal, now)) {
    return { copy: row?.payload || null, generatedAt: row?.generated_at || null, isFinal: Boolean(row?.is_final), cached: true }
  }
  const claim = await claimContent(env, key, row)
  if (!claim) {
    row = await readContent(env, key)
    return { copy: row?.payload || null, generatedAt: row?.generated_at || null, isFinal: Boolean(row?.is_final), cached: true, generating: true }
  }
  try {
    const copy = await generateWeekCopy({ season, week, highScore: body.highScore, closest: body.closest, isLive: !isFinal }, {
      apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL,
    })
    const updated = await finishClaim(env, key, claim.token, {
      payload: copy, source_hash: sourceHash, generated_at: new Date().toISOString(), is_final: isFinal,
    })
    return { copy, generatedAt: updated.generated_at, isFinal: Boolean(updated.is_final), cached: false }
  } catch (error) {
    await abandonClaim(env, key, claim.token)
    throw error
  }
}
