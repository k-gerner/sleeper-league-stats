import { fetchNflWeekStatuses } from './sleeperData.js'

function playerForRecap(player, gameStatuses) {
  const empty = !player.id || String(player.id) === '0'
  // Game status describes the NFL game, not whether a player took a snap.
  // A zero score alone tells us nothing about participation.
  const gameStatus = empty ? 'empty' : player.team && gameStatuses
    ? gameStatuses[player.team] || 'bye'
    : 'unknown'
  return { name: player.name, position: player.position, points: player.points, gameStatus }
}

function lineupProgress(starters) {
  const counts = { total: starters.length, finished: 0, inProgress: 0, yetToStart: 0, bye: 0, empty: 0, unknown: 0 }
  const fields = { post: 'finished', in: 'inProgress', pre: 'yetToStart', bye: 'bye', empty: 'empty', unknown: 'unknown' }
  for (const player of starters) counts[fields[player.gameStatus] || 'unknown'] += 1
  return counts
}

function matchupStage(home, away, isLive) {
  const counts = Object.fromEntries(Object.keys(home).map((key) => [key, home[key] + away[key]]))
  const started = counts.finished + counts.inProgress
  // Explicit schedule evidence of games remaining takes precedence over a
  // league/calendar flag that may have marked the week final prematurely.
  if (!isLive && !counts.yetToStart && !counts.inProgress) return 'final'
  if (counts.unknown) return 'status_unknown'
  const scheduled = counts.total - counts.bye - counts.empty
  if (!started) return 'not_started'
  if (counts.finished === scheduled) return 'lineups_complete'
  if (counts.finished / scheduled >= 2 / 3) return 'mostly_complete'
  if (started / scheduled <= 1 / 3) return 'early'
  return 'in_progress'
}

export function buildRecapMatchups(weekData, gameStatuses) {
  const buildTeam = (team) => {
    const starters = [...team.starters].sort((a, b) => b.points - a.points).map((player) => playerForRecap(player, gameStatuses))
    const eligibleBenchUpgrades = (team.eligibleBenchUpgrades || []).filter(({ benchPlayer, starter }) => {
      // Do not call a bench decision a mistake while either game's score is
      // incomplete, or when their game status cannot be verified.
      const bench = team.benchPlayers?.find((player) => player.name === benchPlayer.name)
      const active = team.starters.find((player) => player.name === starter.name)
      return bench && active && playerForRecap(bench, gameStatuses).gameStatus === 'post' && playerForRecap(active, gameStatuses).gameStatus === 'post'
    })
    return {
      name: team.team.name, manager: team.team.manager, score: team.points,
      starters, progress: lineupProgress(starters),
      bench: (team.benchPlayers || []).slice(0, 4).map((player) => playerForRecap(player, gameStatuses)),
      eligibleBenchUpgrades,
    }
  }
  return weekData.matchups.map(({ home, away, margin }) => {
    const homeTeam = buildTeam(home)
    const awayTeam = buildTeam(away)
    return { home: homeTeam, away: awayTeam, margin, status: matchupStage(homeTeam.progress, awayTeam.progress, weekData.isLive) }
  })
}

export async function loadRecapMatchups(weekData, season, week) {
  // Missing schedule data must not block recaps or turn zeros into "duds".
  const statuses = await fetchNflWeekStatuses(season, week, AbortSignal.timeout(6000)).catch(() => null)
  return buildRecapMatchups(weekData, statuses)
}
