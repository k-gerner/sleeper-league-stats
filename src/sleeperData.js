export const LEAGUE_ID = '1389752419247747072'
const API_ROOT = 'https://api.sleeper.app/v1'
const PLAYER_CACHE_DB = 'sleeper-league-stats-cache'
const PLAYER_CACHE_STORE = 'api-data'
const PLAYER_CACHE_KEY = 'nfl-players'
const PLAYER_CACHE_TTL = 24 * 60 * 60 * 1000

function openPlayerCache() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('IndexedDB is unavailable'))
    const request = indexedDB.open(PLAYER_CACHE_DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(PLAYER_CACHE_STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readPlayerCache() {
  const db = await openPlayerCache()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(PLAYER_CACHE_STORE, 'readonly').objectStore(PLAYER_CACHE_STORE).get(PLAYER_CACHE_KEY)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

async function writePlayerCache(record) {
  const db = await openPlayerCache()
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(PLAYER_CACHE_STORE, 'readwrite')
      transaction.objectStore(PLAYER_CACHE_STORE).put(record, PLAYER_CACHE_KEY)
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

async function getPlayerDirectory(signal) {
  const cached = await readPlayerCache().catch(() => null)
  if (cached && Date.now() - cached.fetchedAt < PLAYER_CACHE_TTL) return cached.players
  try {
    const response = await fetch(`${API_ROOT}/players/nfl`, { signal })
    if (!response.ok) throw new Error(`Sleeper returned ${response.status} for /players/nfl`)
    const players = await response.json()
    if (players && typeof players === 'object') {
      await writePlayerCache({ players, fetchedAt: Date.now() }).catch(() => {})
      return players
    }
    throw new Error('Sleeper returned an invalid NFL player directory')
  } catch {
    return cached?.players || {}
  }
}

async function getJson(path, signal) {
  const response = await fetch(`${API_ROOT}${path}`, { signal })
  if (!response.ok) throw new Error(`Sleeper returned ${response.status} for ${path}`)
  return response.json()
}

function points(total, decimal = 0) {
  return Number(total || 0) + Number(decimal || 0) / 100
}

function playerName(id, players) {
  if (players[id]?.full_name) return players[id].full_name
  if (players[id]?.first_name || players[id]?.last_name) return [players[id].first_name, players[id].last_name].filter(Boolean).join(' ')
  if (/^[A-Z]{2,4}$/.test(id)) return `${id} D/ST`
  return `Player ${id}`
}

function makeTeam(roster, user) {
  const manager = user?.username || user?.display_name || `Roster ${roster.roster_id}`
  const customTeamName = user?.metadata?.team_name?.trim()
  const hasCustomTeamName = customTeamName && !/^team\s+\d+$/i.test(customTeamName)
  const name = hasCustomTeamName ? customTeamName : manager
  return {
    id: Number(roster.roster_id),
    name,
    managerId: user?.user_id || String(roster.roster_id),
    manager,
    avatar: user?.metadata?.avatar?.startsWith('https://') ? user.metadata.avatar : null,
    avatarFallback: user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : null,
    initials: name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
    record: roster.settings || {},
    reserve: roster.reserve || [],
  }
}

function pointsLeftOnBench(row, team, week, currentWeek, players) {
  if (!row.players_points) return { total: 0, topPlayer: null, players: [] }
  const starters = new Set(row.starters || [])
  const reserve = new Set(week === currentWeek ? team.reserve || [] : [])
  const bench = Object.entries(row.players_points)
    .filter(([id]) => !starters.has(id) && !reserve.has(id))
    .map(([id, score]) => ({
      id,
      name: playerName(id, players),
      position: players[id]?.fantasy_positions?.[0] || players[id]?.position || (/^[A-Z]{2,4}$/.test(id) ? 'DEF' : ''),
      points: Number(score) || 0,
    }))
    .filter((player) => player.points > 0)
    .sort((a, b) => b.points - a.points)
  return {
    total: bench.reduce((total, player) => total + player.points, 0),
    topPlayer: bench[0] || null,
    players: bench,
  }
}

function slotCanAcceptPlayer(position, slot) {
  if (!position || !slot) return false
  if (position === slot) return true
  if (slot === 'FLEX') return ['RB', 'WR', 'TE'].includes(position)
  if (slot === 'REC_FLEX') return ['WR', 'TE'].includes(position)
  if (slot === 'SUPER_FLEX') return ['QB', 'RB', 'WR', 'TE'].includes(position)
  if (slot === 'IDP_FLEX') return ['DL', 'LB', 'DB', 'IDP'].includes(position)
  return false
}

function findBenchUpgrades(benchPlayers, starters, rosterPositions = []) {
  const starterSlots = rosterPositions.filter((slot) => !['BN', 'IR', 'TAXI'].includes(slot))
  return benchPlayers.flatMap((benchPlayer) => starters
      .map((starter, index) => ({ starter, slot: starterSlots[index] || starter.position }))
      .filter(({ starter, slot }) => starter.id && !starter.name.startsWith('Player ') && slotCanAcceptPlayer(benchPlayer.position, slot))
      .filter(({ starter }) => benchPlayer.points > starter.points)
      .map(({ starter, slot }) => ({
        benchPlayer: { name: benchPlayer.name, position: benchPlayer.position, points: benchPlayer.points },
        starter: { name: starter.name, position: starter.position, points: starter.points },
        slot,
        pointDifference: benchPlayer.points - starter.points,
      })))
    .sort((left, right) => right.pointDifference - left.pointDifference)
}

function makeWeek(rows, teamsById, week, currentWeek, lastCompletedWeek, players) {
  const rosterRows = rows.map((row) => {
    const team = teamsById.get(Number(row.roster_id))
    const bench = pointsLeftOnBench(row, team || {}, week, currentWeek, players)
    const starters = (row.starters || []).map((id, index) => ({
      id,
      name: playerName(id, players),
      points: Number(row.starters_points?.[index] ?? row.players_points?.[id]) || 0,
      position: players[id]?.fantasy_positions?.[0] || players[id]?.position || (/^[A-Z]{2,4}$/.test(id) ? 'DEF' : ''),
      team: players[id]?.team || (/^[A-Z]{2,4}$/.test(id) ? id : null),
    }))
    const eligibleBenchUpgrades = findBenchUpgrades(bench.players, starters, team?.rosterPositions || [])
    const flexIndex = team?.rosterPositions?.indexOf('FLEX') ?? -1
    return {
      rosterId: Number(row.roster_id),
      matchupId: row.matchup_id,
      team,
      points: Number(row.points) || 0,
      playersPoints: row.players_points || {},
      rosteredPlayers: Object.entries(row.players_points || {}).map(([id, score]) => ({
        id,
        name: playerName(id, players),
        points: Number(score) || 0,
      })),
      benchPoints: bench.total,
      topBenchPlayer: bench.topPlayer,
      benchPlayers: bench.players,
      eligibleBenchUpgrades,
      starters,
      topStarter: [...starters].sort((a, b) => b.points - a.points)[0] || null,
      startersOverTwenty: starters.filter((player) => player.points >= 20).length,
      flexPlayer: flexIndex >= 0 ? starters[flexIndex] || null : null,
      kicker: starters.filter((player) => player.position === 'K').sort((a, b) => b.points - a.points)[0] || null,
    }
  }).filter((row) => row.team)

  const grouped = new Map()
  for (const row of rosterRows) {
    const key = String(row.matchupId ?? row.rosterId)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(row)
  }

  const matchups = [...grouped.values()]
    .filter((teams) => teams.length === 2)
    .map(([first, second]) => {
      const winner = first.points >= second.points ? first : second
      const loser = winner === first ? second : first
      return {
        home: first,
        away: second,
        winner,
        loser,
        margin: Math.abs(first.points - second.points),
      }
    })

  const highScore = [...rosterRows].sort((a, b) => b.points - a.points)[0] || null
  const highestScoringPlayer = rosterRows.flatMap((team) => team.starters.map((starter) => ({
    id: starter.id,
    name: starter.name,
    points: starter.points,
    team: team.team,
  }))).filter((player) => player.points > 0).sort((a, b) => b.points - a.points)[0] || null
  const closest = [...matchups].sort((a, b) => a.margin - b.margin)[0] || null
  const blowout = [...matchups].sort((a, b) => b.margin - a.margin)[0] || null
  const heartbreak = matchups.map((matchup) => matchup.loser).sort((a, b) => b.points - a.points)[0] || null
  const benchLeader = [...rosterRows].sort((a, b) => b.benchPoints - a.benchPoints)[0] || null
  const bestBenchUpgrade = rosterRows.flatMap((team) => team.eligibleBenchUpgrades.map((upgrade) => ({ team, upgrade })))
    .sort((a, b) => b.upgrade.pointDifference - a.upgrade.pointDifference)[0] || null
  const benchPlayerLeader = [...rosterRows].filter((team) => team.topBenchPlayer).sort((a, b) => b.topBenchPlayer.points - a.topBenchPlayer.points)[0] || null
  const benchUpgradeLeader = bestBenchUpgrade ? { ...bestBenchUpgrade.team, topBenchUpgrade: bestBenchUpgrade.upgrade } : null
  const oneManShow = [...rosterRows].filter((team) => team.topStarter && team.points > 0).sort((a, b) => (b.topStarter.points / b.points) - (a.topStarter.points / a.points))[0] || null
  const doubleTrouble = [...rosterRows].sort((a, b) => b.startersOverTwenty - a.startersOverTwenty || b.points - a.points)[0] || null
  const flexLeader = [...rosterRows].filter((team) => team.flexPlayer).sort((a, b) => b.flexPlayer.points - a.flexPlayer.points)[0] || null
  const kickerLeader = [...rosterRows].filter((team) => team.kicker).sort((a, b) => b.kicker.points - a.kicker.points)[0] || null
  const highestCombined = [...matchups].sort((a, b) => (b.home.points + b.away.points) - (a.home.points + a.away.points))[0] || null
  const totalPoints = rosterRows.reduce((total, team) => total + team.points, 0)

  return {
    week,
    isLive: week > lastCompletedWeek,
    teams: rosterRows,
    // Keep matchup order stable as live scores change. Recaps are saved per
    // matchup, so sorting by margin here would shift their displayed index.
    matchups: matchups.sort((a, b) => String(a.home.matchupId ?? a.home.rosterId).localeCompare(String(b.home.matchupId ?? b.home.rosterId), undefined, { numeric: true })),
    highScore,
    highestScoringPlayer,
    closest,
    blowout,
    heartbreak,
    benchLeader,
    benchPlayerLeader,
    benchUpgradeLeader,
    oneManShow,
    doubleTrouble: doubleTrouble?.startersOverTwenty > 0 ? doubleTrouble : null,
    flexLeader,
    kickerLeader,
    highestCombined,
    average: rosterRows.length ? totalPoints / rosterRows.length : 0,
    benchTotal: rosterRows.reduce((total, team) => total + team.benchPoints, 0),
  }
}

export async function fetchLeagueDashboard(signal) {
  const [league, users, rosters, nflState, players] = await Promise.all([
    getJson(`/league/${LEAGUE_ID}`, signal),
    getJson(`/league/${LEAGUE_ID}/users`, signal),
    getJson(`/league/${LEAGUE_ID}/rosters`, signal),
    getJson('/state/nfl', signal),
    getPlayerDirectory(signal),
  ])

  const currentWeek = Math.max(1, Number(nflState.display_week || nflState.week || league.settings?.leg || 1))
  const lastCompletedWeek = Number(league.settings?.last_scored_leg || Math.max(0, currentWeek - 1))
  const teamUsers = new Map(users.map((user) => [String(user.user_id), user]))
  const rosterPositions = league.roster_positions || []
  const teams = rosters.map((roster) => ({ ...makeTeam(roster, teamUsers.get(String(roster.owner_id))), rosterPositions }))
  const teamsById = new Map(teams.map((team) => [team.id, team]))
  const weeks = await Promise.all(Array.from({ length: currentWeek }, async (_, index) => {
    const week = index + 1
    const rows = await getJson(`/league/${LEAGUE_ID}/matchups/${week}`, signal)
    return [week, makeWeek(rows, teamsById, week, currentWeek, lastCompletedWeek, players)]
  }))

  const standings = teams.map((team) => ({
    ...team,
    wins: Number(team.record.wins) || 0,
    losses: Number(team.record.losses) || 0,
    ties: Number(team.record.ties) || 0,
    pointsFor: points(team.record.fpts, team.record.fpts_decimal),
    pointsAgainst: points(team.record.fpts_against, team.record.fpts_against_decimal),
  })).sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.pointsFor - a.pointsFor)

  return {
    league: { id: LEAGUE_ID, name: league.name, season: league.season, teamCount: league.total_rosters, status: league.status },
    currentWeek,
    lastCompletedWeek,
    standings,
    weeks: Object.fromEntries(weeks),
    trend: weeks.map(([week, data]) => ({ week: `W${week}`, points: Number(data.highScore?.points || 0), average: data.average })),
  }
}

export function formatPoints(value) {
  return (Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export async function fetchNflWeekStatuses(season, week, signal) {
  const seasonType = Number(week) > 18 ? 3 : 2
  const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}&week=${week}&seasontype=${seasonType}`, { signal })
  if (!response.ok) throw new Error(`NFL schedule returned ${response.status}`)
  const scoreboard = await response.json()
  const statuses = {}
  for (const event of scoreboard.events || []) {
    const status = event.status?.type?.state
    for (const competitor of event.competitions?.[0]?.competitors || []) {
      const team = competitor.team?.abbreviation
      if (team && status) statuses[team] = status
    }
  }
  return statuses
}

