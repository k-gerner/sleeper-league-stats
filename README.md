# Sunday Club — Sleeper League Dashboard

A React + Tailwind frontend for the Sleeper league **All Roads Lead to Odunze** (`1389752419247747072`). The dashboard loads real league data from Sleeper's public API. Recap text is currently assembled from live stats; OpenAI generation and saved recaps are not connected yet.

The sidebar's styled **Your Team Colors** picker lets you search all 32 NFL teams and previews their palettes with color swatches. The chosen team is stored as `sunday-club-favorite-team` in browser `localStorage`, so the preference stays on that device/browser without an account or backend. The header's light/dark toggle is also saved in browser storage, and the chosen team accents carry through both themes.

## Run locally

### Requirements

- Node.js (use a current LTS release)
- npm, which is included with Node.js

### Start the development server

From the project directory, install the dependencies once, then start Vite:

```sh
npm install
npm run dev
```

Open the local URL printed in the terminal (usually `http://localhost:5173`). Keep the terminal process running while you use the site. Vite refreshes the browser when you save a source file. Press `Ctrl+C` in the terminal to stop the server.

No API keys, `.env` file, or Supabase account are needed. The league data comes from Sleeper; the favorite-team color choice and dark-mode preference are saved in the current browser.

### Production build and local preview

Create an optimized static build in `dist/`:

```sh
npm run build
```

To serve that build locally before deployment:

```sh
npm run preview
```

Vite prints the preview URL in the terminal. The preview command expects a build to exist first.

### Deploy to Vercel

Import this project in Vercel and use the Vite defaults:

- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

The current frontend does not require environment variables. Add server-side configuration only if you later add private OpenAI keys, database-backed recap persistence, or scheduled recap generation.

The first pass is intentionally frontend-only; secrets and scheduled recap generation belong in server-side functions once the data model is agreed.

## Sleeper API notes

The public Sleeper API is read-only and does not require an API token. League data is exposed through JSON endpoints under `https://api.sleeper.app/v1`. The frontend fetches the league, members, rosters, NFL state, and weekly matchups directly from the browser. Sleeper's API allows cross-origin browser requests.

- `GET /league/{league_id}` — league name, season/status, roster positions, settings and scoring settings.
- `GET /league/{league_id}/users` — manager IDs, display names, avatars and optional team-name metadata.
- `GET /league/{league_id}/rosters` — roster IDs, player IDs, starters, reserve players and season-to-date roster settings such as wins and points for/against.
- `GET /league/{league_id}/matchups/{week}` — one row per roster with `matchup_id`, starter/player IDs and team points. Rows sharing a matchup ID are opponents. Bench IDs can be inferred from `players` minus `starters`.
- `GET /league/{league_id}/transactions/{week}` — adds/drops, waiver/free-agent activity, trades and FAAB details for that week.
- `GET /league/{league_id}/winners_bracket` and `/losers_bracket` — playoff bracket progress.
- `GET /league/{league_id}/drafts`, `/draft/{draft_id}`, and `/draft/{draft_id}/picks` — draft settings and pick history.
- `GET /players/nfl` — large player dictionary for resolving player IDs to names, positions and team metadata; cache this rather than fetching it on every page load.
- `GET /state/nfl` — current NFL season/week state, useful as a starting point for choosing the displayed week.

Weekly matchup responses provide team totals, starter IDs, roster player IDs, and per-player scoring (`players_points` and `starters_points` in the live response). The app uses these to compute weekly averages, the high score, closest matchup, and points left on the bench. Current roster reserve players are excluded from current-week bench totals; Sleeper's public rosters endpoint returns current rosters rather than historical reserve status, so older weeks cannot apply that exclusion with full historical accuracy. A small player lookup file resolves names for players on this league's rosters through Week 8; an unrecognized new player falls back to a player ID until the lookup is refreshed.

The dashboard refreshes live league data on load and every five minutes. Standings use Sleeper's current roster records and points for, sorted by wins, losses, then points for. Team rows use the league member's custom uploaded avatar when provided, with Sleeper's thumbnail avatar as a fallback. Historical matchup data is loaded for each week through the current NFL week.

**Awards & records** opens the season award archive. It includes weekly winners, all-time counts by league member and award category, season records, and ten score-derived awards: Point Press, Heartbreaker, Benchwarmer's Regret, Nail-Biter, The Blowout, One-Man Show, Double Trouble, Flex Appeal, Kicker Therapy, and Sunday Shootout. Double Trouble is only given when a lineup has at least two starters with 20 or more points. Current-week awards remain provisional until Sleeper finalizes scoring.

Official reference: [Sleeper API docs](https://docs.sleeper.com/).
