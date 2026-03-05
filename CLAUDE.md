# CLAUDE.md - Poker Tracker

Live poker hand tracker and exploit engine for 9-handed games. Records actions, builds Bayesian player models, and surfaces maximally exploitative plays — compensating for human limitations in memory and pattern recognition at the table.

React + Vite + Tailwind, mobile-optimized (1600x720).

## Commands
```bash
npm run dev                          # Dev server (localhost:5173)
npm run build                        # Production build
bash scripts/smart-test-runner.sh    # Tests (token-optimized, use before commits)
npm test                             # Tests (verbose, for debugging)
```

## Context Files (Read Before Source)
Prefer `.claude/context/*.md` over raw source — they're compact summaries:
- `CONTEXT_SUMMARY.md` — project overview
- `STATE_SCHEMA.md` — all reducer shapes
- `HOTSPOTS.md` — critical/fragile files

Also: `PERSISTENCE_OVERVIEW.md` for IndexedDB API summary.

## Architecture
- `src/PokerTracker.jsx` (~93 lines) — AppRoot (state + providers) + ViewRouter (pure routing)
- `src/contexts/` — 7 providers + ToastContext (zero prop drilling, persistence hooks inside providers)
- `src/reducers/` — 7 reducers (game, ui, card, session, player, settings, auth)
- `src/hooks/` — 20 custom hooks (useGameHandlers, useScale, useRangeProfile, etc.)
- `src/components/views/` — 9 view screens + 2 overlays (all receive only `scale` prop)
- `src/components/ui/` — 30 UI components (incl. RangeGrid, RangeDetailPanel, ExploitBadges)
- `src/utils/rangeEngine/` — Bayesian range estimation (6 modules)
- `src/utils/exploitEngine/` — exploit suggestions + range matrix
- `src/utils/persistence/` — IndexedDB v9 (hands, sessions, players, settings, rangeProfiles)

## Working Principles
- **Plan first, code second** — outline your approach before writing code. For non-trivial changes, present the plan and wait for approval
- **Root cause, not symptoms** — diagnose *why* something broke before writing a fix. Never patch around a bug
- **Minimal scope** — do exactly what was asked. Do not refactor nearby code, add features, or "improve" things unprompted
- **Follow existing patterns** — study how the codebase already solves similar problems before inventing a new approach
- **Verify visually** — launch dev server and confirm UI changes render correctly. Don't assume correctness from code alone
- **State verification criteria** — after any change, explain exactly how to confirm it works (which view, what interaction, what to look for)
- **Read before writing** — understand existing code fully before modifying. Never edit a file you haven't read this session
- **Don't be surprise-proactive** — take follow-up actions only when asked. Ask before adding anything beyond the immediate request

## Rules
- ALL action recordings use `ACTIONS.*` constants (from `src/constants/gameConstants.js`)
- Use `SEAT_ARRAY` for seat iteration, `CONSTANTS.NUM_SEATS` for limits — never hardcode
- State updates via reducer dispatch only, never direct setters
- `useCallback` for props-passed functions; define helpers BEFORE dependent callbacks
- Import UI components from `src/components/ui/`
- Utils use dependency injection (constants passed as parameters)

## Common Tasks

### Adding a New Action
1. Add to `ACTIONS` in `src/constants/gameConstants.js`
2. Add to `getActionDisplayName()` in `src/utils/actionUtils.js`
3. Add to `getActionColor()` and `getSeatActionStyle()` in `src/utils/actionUtils.js`

### Debug Mode
`DEBUG = false` at line 8 of `PokerTracker.jsx`

## Starting New Work
1. Check `.claude/BACKLOG.md` first
2. `/project start <name>` for multi-file tasks
3. Read affected files before editing (use context files first)
4. 4+ files changed → `EnterPlanMode`

## Responsive Design
- Target: 1600x720 (Samsung Galaxy A22 landscape)
- Scale: `min(viewportWidth * 0.95 / 1600, viewportHeight * 0.95 / 720, 1.0)`

## Testing
Verify across all 7 views: Table, Card Selector, Showdown, Stats, Sessions, Players, Settings

## Analytics Pipeline
The app builds player models through three layers:
1. **Session Stats** (`useSessionStats`) — VPIP, PFR, AF, C-Bet from action counts
2. **Player Tendencies** (`usePlayerTendencies`) — cross-session style classification (TAG, LAG, Fish, etc.)
3. **Bayesian Range Engine** (`src/utils/rangeEngine/`) — per-position hand distribution estimates

Range Engine key concepts:
- Two independent decision trees: **no raise faced** (fold/limp/open) and **facing a raise** (fold/coldCall/threeBet)
- Population priors (typical 1/2 player) as Bayesian starting point, updated with observed frequencies
- 169-cell hand grids (Float64Array) per action per position
- Showdown anchors: confirmed hands set to weight 1.0 with semantic boosting
- Profiles cached in IndexedDB `rangeProfiles` store

## Docs
- `docs/SPEC.md` — full specification
- `docs/QUICK_REF.md` — constants, hooks, utils
- `docs/DEBUGGING.md` — error codes
- `docs/CHANGELOG.md` — version history
- `docs/RANGE_ENGINE_DESIGN.md` — range engine design spec
