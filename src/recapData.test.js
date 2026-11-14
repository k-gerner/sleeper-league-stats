import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildRecapMatchups, loadRecapMatchups } from './recapData.js'
import { fetchNflWeekStatuses } from './sleeperData.js'

function lineup(states, label = 'Home') {
  return {
    team: { name: label, manager: label }, points: 0,
    starters: states.map((_, index) => ({ id: `${label}-${index}`, name: `${label} player ${index}`, team: `${label}-${index}`, position: 'WR', points: 0 })),
    benchPlayers: [], eligibleBenchUpgrades: [],
  }
}

function matchup(homeStates, awayStates = homeStates, isLive = true) {
  const home = lineup(homeStates)
  const away = lineup(awayStates, 'Away')
  const statuses = Object.fromEntries([...homeStates.map((status, index) => [`Home-${index}`, status]), ...awayStates.map((status, index) => [`Away-${index}`, status])])
  const weekData = { isLive, matchups: [{ home, away, margin: 0 }] }
  return { weekData, statuses, build: () => buildRecapMatchups(weekData, statuses)[0] }
}

test('untouched lineups are not started, not a final 0–0 tie', () => {
  const result = matchup(Array(9).fill('pre')).build()
  assert.equal(result.status, 'not_started')
  assert.deepEqual(result.home.progress, { total: 9, finished: 0, inProgress: 0, yetToStart: 9, bye: 0, empty: 0, unknown: 0 })
})

test('one completed starter is an early sample even if that player scored zero', () => {
  const result = matchup(['post', ...Array(8).fill('pre')]).build()
  assert.equal(result.status, 'early')
  assert.equal(result.home.progress.finished, 1)
  assert.equal(result.home.progress.yetToStart, 8)
})

test('games still playing count separately from games finished', () => {
  const result = matchup([...Array(3).fill('post'), ...Array(4).fill('in'), ...Array(2).fill('pre')]).build()
  assert.equal(result.status, 'in_progress')
  assert.equal(result.home.progress.finished, 3)
  assert.equal(result.home.progress.inProgress, 4)
  assert.equal(result.home.progress.yetToStart, 2)
})

test('mostly completed lineups retain their remaining starters', () => {
  const result = matchup([...Array(7).fill('post'), 'in', 'pre']).build()
  assert.equal(result.status, 'mostly_complete')
  assert.equal(result.home.progress.finished, 7)
  assert.equal(result.home.progress.inProgress, 1)
  assert.equal(result.home.progress.yetToStart, 1)
})

test('uneven progress is preserved separately for each team', () => {
  const result = matchup(Array(9).fill('pre'), Array(9).fill('post')).build()
  assert.equal(result.home.progress.finished, 0)
  assert.equal(result.home.progress.yetToStart, 9)
  assert.equal(result.away.progress.finished, 9)
  assert.notEqual(result.status, 'final')
})

test('finished lineups do not imply that a live NFL week is final', () => {
  assert.equal(matchup(Array(9).fill('post')).build().status, 'lineups_complete')
  assert.equal(matchup(Array(9).fill('post'), undefined, false).build().status, 'final')
})

test('schedule evidence overrides a prematurely final league flag', () => {
  assert.equal(matchup(['post', 'pre'], ['in', 'pre'], false).build().status, 'in_progress')
})

test('missing schedule never treats zero points as an unplayed or finished game', () => {
  const { weekData } = matchup(['pre'])
  weekData.matchups[0].away.starters[0].points = -2
  const [result] = buildRecapMatchups(weekData, null)
  assert.equal(result.status, 'status_unknown')
  assert.equal(result.home.progress.unknown, 1)
  assert.equal(result.home.progress.finished, 0)
  assert.equal(result.home.progress.yetToStart, 0)
  assert.equal(result.away.progress.unknown, 1)
})

test('byes, empty slots, and unknown events remain distinct from games played', () => {
  const { weekData, statuses } = matchup(['pre', 'pre', 'unknown'])
  delete statuses['Home-0']
  weekData.matchups[0].home.starters[1].id = '0'
  const [result] = buildRecapMatchups(weekData, statuses)
  assert.equal(result.home.progress.bye, 1)
  assert.equal(result.home.progress.empty, 1)
  assert.equal(result.home.progress.unknown, 1)
  assert.equal(result.home.progress.finished, 0)
})

test('bench regret is excluded until both comparable games finish', () => {
  const { weekData, statuses } = matchup(['pre'])
  const home = weekData.matchups[0].home
  const bench = { id: 'bench', name: 'Bench player', team: 'BENCH', position: 'WR', points: 20 }
  home.benchPlayers = [bench]
  home.eligibleBenchUpgrades = [{ benchPlayer: bench, starter: home.starters[0], slot: 'WR', pointDifference: 20 }]
  statuses.BENCH = 'post'
  assert.deepEqual(buildRecapMatchups(weekData, statuses)[0].home.eligibleBenchUpgrades, [])
  statuses['Home-0'] = 'post'
  assert.equal(buildRecapMatchups(weekData, statuses)[0].home.eligibleBenchUpgrades.length, 1)
})

test('recap loading continues cautiously when the schedule service fails', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Schedule unavailable') })
  const { weekData } = matchup(['pre'])
  const [result] = await loadRecapMatchups(weekData, 2026, 10)
  assert.equal(result.status, 'status_unknown')
})

test('schedule aliases match Sleeper team codes and incomplete events are not final', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ events: [
    { status: { type: { state: 'post', completed: true } }, competitions: [{ competitors: [{ team: { abbreviation: 'WSH' } }, { team: { abbreviation: 'JAC' } }] }] },
    { status: { type: { state: 'post', completed: false } }, competitions: [{ competitors: [{ team: { abbreviation: 'LA' } }] }] },
  ] }))
  assert.deepEqual(await fetchNflWeekStatuses(2026, 10), { WAS: 'post', JAX: 'post', LAR: 'unknown' })
})

test('an empty schedule is unavailable rather than a league-wide bye', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ events: [] }))
  assert.equal(await fetchNflWeekStatuses(2026, 10), null)
})
