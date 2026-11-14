import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateSharedBanner, generateSharedRecaps } from './sharedContent.js'

// All HTTP is intercepted: these tests never use credentials or live services.
const env = { SUPABASE_URL: 'https://database.example/rest/v1/', SUPABASE_SECRET_KEY: 'test-secret', OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'test-model' }
const request = {
  leagueId: 'test-league', season: 2026, week: 10, isFinal: true,
  highScore: { team: { name: 'Home' }, points: 110 },
  matchups: [{ home: { name: 'Home', eligibleBenchUpgrades: [] }, away: { name: 'Away', eligibleBenchUpgrades: [] }, margin: 10 }],
  matchupKeys: ['home-away'],
}
const copy = { headline: 'Home takes the crown', subtitle: 'Home leads the league with a big score this week.' }
const recap = Object.fromEntries(['result', 'homeStory', 'awayStory', 'benchNote', 'punchline'].map((name) => [name, name === 'benchNote' ? [] : [{ type: 'text', text: name }]]))
const flows = [
  { type: 'banner', itemKey: 'banner', generate: generateSharedBanner, payload: copy, field: 'copy' },
  { type: 'recap', itemKey: 'all', generate: generateSharedRecaps, payload: { recaps: [{ ...recap, matchupKey: 'home-away' }] }, field: 'recaps' },
]

function savedRow(flow, overrides = {}) {
  return {
    league_id: request.leagueId, season: request.season, week: request.week,
    content_type: flow.type, item_key: flow.itemKey, payload: flow.payload,
    generated_at: '2026-11-11T12:00:00Z', is_final: true,
    generation_token: null, generation_started_at: null, ...overrides,
  }
}

function mockServices(t, initialRows, { openAIError, beforeGenerate, beforeInsert } = {}) {
  const rows = structuredClone(initialRows)
  const calls = []
  t.mock.method(globalThis, 'fetch', async (input, options = {}) => {
    const url = new URL(input)
    const method = options.method || 'GET'
    calls.push({ url, method, body: options.body ? JSON.parse(options.body) : null })
    if (url.origin === 'https://api.openai.com') {
      await beforeGenerate?.()
      if (openAIError) return Response.json({ error: { message: openAIError } }, { status: 500 })
      const body = JSON.parse(options.body)
      const result = body.response_format.json_schema.name === 'weekly_banner_copy' ? copy : { recaps: JSON.parse(body.messages.find((message) => message.role === 'user').content).matchups.map(() => recap) }
      return Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] })
    }
    assert.equal(url.origin, 'https://database.example')
    assert.equal(url.pathname, '/rest/v1/weekly_content')
    const matches = (row) => [...url.searchParams].every(([key, filter]) => {
      if (['select', 'on_conflict'].includes(key)) return true
      if (filter === 'is.null') return row[key] == null
      assert.ok(filter.startsWith('eq.'), `Unsupported test filter: ${filter}`)
      return String(row[key]) === filter.slice(3)
    })
    if (method === 'GET') return Response.json(rows.filter(matches))
    const body = JSON.parse(options.body)
    if (method === 'POST') {
      await beforeInsert?.(rows)
      const row = body[0]
      if (rows.some((existing) => ['league_id', 'season', 'week', 'content_type', 'item_key'].every((key) => existing[key] === row[key]))) return Response.json([])
      rows.push(row)
      return Response.json([row])
    }
    assert.equal(method, 'PATCH')
    const updated = rows.filter(matches)
    updated.forEach((row) => Object.assign(row, body))
    return options.headers.Prefer === 'return=minimal' ? new Response(null, { status: 204 }) : Response.json(updated)
  })
  return { rows, calls, generations: () => calls.filter(({ url }) => url.origin === 'https://api.openai.com').length }
}

for (const flow of flows) {
  test(`${flow.type}: reads saved content without phantom generation`, async (t) => {
    const services = mockServices(t, [savedRow(flow)])
    const result = await flow.generate(request, env)
    assert.equal(result.cached, true)
    assert.ok(!result.generating)
    assert.deepEqual(result[flow.field], flow.type === 'banner' ? copy : flow.payload.recaps)
    assert.equal(services.generations(), 0)
    assert.deepEqual(services.calls.map(({ method }) => method), ['GET'])
  })

  test(`${flow.type}: manual generation fills an existing empty row and is readable afterward`, async (t) => {
    const services = mockServices(t, [savedRow(flow, { payload: {}, generated_at: null })])
    const result = await flow.generate({ ...request, manual: true }, env)
    assert.equal(result.cached, false)
    assert.ok(!result.generating)
    assert.ok(result[flow.field])
    assert.equal(services.generations(), 1)
    assert.equal(services.rows[0].generation_token, null)
    const cached = await flow.generate(request, env)
    assert.deepEqual(cached[flow.field], result[flow.field])
    assert.equal(cached.cached, true)
    assert.equal(services.generations(), 1)
  })

  test(`${flow.type}: creates missing content, then reads it from cache`, async (t) => {
    const services = mockServices(t, [])
    const result = await flow.generate(request, env)
    assert.equal(result.cached, false)
    const cached = await flow.generate(request, env)
    assert.equal(cached.cached, true)
    assert.ok(!cached.generating)
    assert.equal(services.generations(), 1)
    assert.equal(services.rows.length, 1)
  })

  test(`${flow.type}: manual requests wait for an active claim`, async (t) => {
    const services = mockServices(t, [savedRow(flow, { generation_token: 'in-progress', generation_started_at: new Date(Date.now() - 90_000).toISOString() })])
    const result = await flow.generate({ ...request, manual: true }, env)
    assert.equal(result.generating, true)
    assert.equal(services.generations(), 0)
    assert.equal(services.rows[0].generation_token, 'in-progress')
  })

  test(`${flow.type}: concurrent refreshes share one generation and read its saved result`, async (t) => {
    let release
    let started
    const generationStarted = new Promise((resolve) => { started = resolve })
    const generationFinished = new Promise((resolve) => { release = resolve })
    const services = mockServices(t, [savedRow(flow)], { beforeGenerate: async () => { started(); await generationFinished } })
    const first = flow.generate({ ...request, manual: true }, env)
    await generationStarted
    try {
      const second = await flow.generate({ ...request, manual: true }, env)
      assert.equal(second.generating, true)
      assert.equal(services.generations(), 1)
    } finally {
      release()
    }
    const completed = await first
    const polled = await flow.generate({ ...request, manual: false }, env)
    assert.ok(!polled.generating)
    assert.deepEqual(polled[flow.field], completed[flow.field])
    assert.equal(services.generations(), 1)
  })

  test(`${flow.type}: handles a concurrent insert without claiming it is perpetually busy`, async (t) => {
    const services = mockServices(t, [], { beforeInsert: (rows) => { rows.push(savedRow(flow, { payload: {}, generated_at: null })) } })
    const result = await flow.generate(request, env)
    assert.equal(result.cached, false)
    assert.ok(!result.generating)
    assert.equal(services.generations(), 1)
    assert.equal(services.rows.length, 1)
  })

  test(`${flow.type}: reclaims an abandoned job and clears the claim on upstream failure`, async (t) => {
    const services = mockServices(t, [savedRow(flow, { generation_token: 'abandoned', generation_started_at: '2020-01-01T00:00:00Z' })], { openAIError: 'Upstream unavailable' })
    await assert.rejects(flow.generate(request, env), /Upstream unavailable/)
    assert.equal(services.generations(), 1)
    assert.equal(services.rows[0].generation_token, null)
    assert.deepEqual(services.rows[0].payload, flow.payload)
  })
}

test('recaps receive explicit live status and player progress instead of a final-week assumption', async (t) => {
  const services = mockServices(t, [])
  const matchups = [{ ...request.matchups[0], status: 'early', home: { ...request.matchups[0].home, progress: { finished: 1, inProgress: 0, yetToStart: 8 }, starters: [{ name: 'Yet to start', points: 0, gameStatus: 'pre' }] } }]
  const result = await generateSharedRecaps({ ...request, manual: true, isFinal: false, isCurrentWeek: true, matchups }, env)
  const openAI = services.calls.find(({ url }) => url.origin === 'https://api.openai.com').body
  const input = JSON.parse(openAI.messages.find(({ role }) => role === 'user').content)
  assert.equal(input.status, 'live, scores are provisional')
  assert.deepEqual(input.matchups, matchups)
  assert.equal(result.isFinal, false)
  assert.equal(services.rows[0].is_final, false)
})

test('a live matchup overrides a prematurely final request when saving recaps', async (t) => {
  const services = mockServices(t, [])
  await generateSharedRecaps({ ...request, matchups: [{ ...request.matchups[0], status: 'not_started' }] }, env)
  assert.equal(services.rows[0].is_final, false)
})

test('legacy live copy refreshes with progress context once, then remains cached', async (t) => {
  const services = mockServices(t, [savedRow(flows[1], { is_final: false })])
  const live = { ...request, isFinal: false, isCurrentWeek: true }
  const updated = await generateSharedRecaps(live, env)
  assert.equal(updated.cached, false)
  assert.equal(updated.recaps[0].progressVersion, 1)
  const cached = await generateSharedRecaps(live, env)
  assert.equal(cached.cached, true)
  assert.equal(services.generations(), 1)
})
