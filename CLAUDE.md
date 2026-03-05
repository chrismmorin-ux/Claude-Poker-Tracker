# CLAUDE.md - Poker Tracker

React-based hand tracker for live 9-handed poker games. Vite + Tailwind, mobile-optimized (1600x720).

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

## Architecture (v117)
- `src/PokerTracker.jsx` (~620 lines) — main component
- `src/contexts/` — 5 providers (Game, UI, Session, Player, Settings)
- `src/reducers/` — 6 reducers (game, ui, card, session, player, settings)
- `src/hooks/` — 12 custom hooks
- `src/components/views/` — 8 view components
- `src/components/ui/` — 16 UI components
- `src/utils/` — utilities + persistence (IndexedDB v8)

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

## Docs
- `docs/SPEC.md` — full specification
- `docs/QUICK_REF.md` — constants, hooks, utils
- `docs/DEBUGGING.md` — error codes
- `docs/CHANGELOG.md` — version history
