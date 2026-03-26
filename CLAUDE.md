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
- `POKER_THEORY.md` — **MANDATORY before editing `rangeEngine/` or `exploitEngine/`**

Also: `PERSISTENCE_OVERVIEW.md` for IndexedDB API summary.

## Poker Analysis Guardrail
**Before editing ANY file in `src/utils/exploitEngine/` or `src/utils/rangeEngine/`:**
1. Read `.claude/context/POKER_THEORY.md` (poker theory reference)
2. Read the sub-directory `CLAUDE.md` in the engine you're editing (domain rules + anti-patterns)
3. Read `docs/RANGE_ENGINE_DESIGN.md` if touching range estimation logic
4. Verify your changes don't regress any poker concept listed in the anti-patterns section

Generic statistical reasoning (uniform priors, z-tests, linear assumptions) is almost always WRONG for poker. The codebase uses Bayesian methods, population priors, consequence-weighted confidence, and range-based thinking for specific theoretical reasons. Do not simplify.

## Architecture (v122)
- `src/PokerTracker.jsx` (~128 lines) — AppRoot (state + providers) + ViewRouter (pure routing)
- `src/contexts/` — 10 providers (incl. ToastContext, TendencyProvider, TournamentContext)
- `src/reducers/` — 8 reducers (game, ui, card, session, player, settings, auth, tournament)
- `src/hooks/` — 33 custom hooks (useGameHandlers, useScale, useOnlineAnalysis, useLiveActionAdvisor, useAbortControl, etc.)
- `src/components/views/` — 13 view screens + Showdown overlay (all receive only `scale` prop)
- `src/components/ui/` — 37 UI components (incl. RangeGrid, RangeDetailPanel, ExploitBadges, IcmBadge)
- `src/utils/pokerCore/` — shared poker infrastructure (4 modules: cardParser, rangeMatrix, handEvaluator, boardTexture)
- `src/utils/rangeEngine/` — Bayesian range estimation (9 modules)
- `src/utils/exploitEngine/` — exploit suggestions, weakness detection, Bayesian confidence (29 modules)
- `src/utils/handAnalysis/` — hand review & replay analysis (7 modules + barrel export)
- `src/utils/tournamentEngine/` — blind levels, blind-out calculator, dropout predictor (4 modules)
- `src/utils/persistence/` — IndexedDB v12 (10 modules: database, migrations, 6 domain stores, validation, index)

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
3. Add to `getActionBadgeStyle()` and `getActionSeatStyle()` in `src/constants/designTokens.js`

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
- 2,784 tests across 132 test files (Vitest + fake-indexeddb)
- Verify across views: Table, Showdown, Stats, Sessions, Players, Settings, Analysis, HandReplay, Tournament, Online

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
- `docs/QUICK_REF.md` — constants, hooks, utils
- `docs/DEBUGGING.md` — error codes
- `docs/CHANGELOG.md` — version history
- `docs/RANGE_ENGINE_DESIGN.md` — range engine design spec
