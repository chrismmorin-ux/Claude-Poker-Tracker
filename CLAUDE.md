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

## Session Start Protocol (MANDATORY)

### Always (every session)
1. Read `.claude/STATUS.md` — understand project state, active sessions, alerts
2. Read ALL files in `.claude/handoffs/` — know what other sessions own, avoid file conflicts
3. Before editing any file: verify no other ACTIVE session owns it (check handoff "Files I Own" sections)

### If multi-file or structural work
4. Read `.claude/context/SYSTEM_MODEL.md` — architecture, invariants, failure surfaces
5. Create or update your handoff file in `.claude/handoffs/` when you claim work

### If touching engine code (exploitEngine/, rangeEngine/, pokerCore/)
6. Read `.claude/context/POKER_THEORY.md`
7. Read the sub-directory `CLAUDE.md` in the engine you're editing

### If resuming a project
8. Read the project file referenced in STATUS.md

Do NOT start coding until applicable steps are complete.

## Context Loading Guide

| Task Type | Read | Skip |
|-----------|------|------|
| One-file UI fix | STATUS, handoffs/ | SYSTEM_MODEL, POKER_THEORY |
| Multi-file feature | STATUS, handoffs/, SYSTEM_MODEL §1-§3 | POKER_THEORY (unless engine) |
| Engine work | STATUS, handoffs/, SYSTEM_MODEL, POKER_THEORY, engine CLAUDE.md | STATE_SCHEMA |
| Reducer/state change | STATUS, handoffs/, SYSTEM_MODEL §3, STATE_SCHEMA | POKER_THEORY |
| Persistence/IndexedDB | STATUS, handoffs/, SYSTEM_MODEL §2, PERSISTENCE_OVERVIEW | POKER_THEORY |
| Extension work | STATUS, handoffs/, ignition CLAUDE.md | Main SYSTEM_MODEL |
| Architecture review | Everything | — |
| Bug fix (unknown scope) | STATUS, handoffs/, SYSTEM_MODEL §5-§6, failures/ | Expand as needed |

## System Model (Read Before Any Multi-File Change)
`.claude/context/SYSTEM_MODEL.md` is the single source of truth for architecture, invariants, failure surfaces, coupling, and system understanding. Read it before any structural change. Update it after any architectural shift.

Supporting references (unique detail not in System Model):
- `STATE_SCHEMA.md` — reducer shapes
- `PERSISTENCE_OVERVIEW.md` — IndexedDB API summary
- `INVARIANTS.md` — standalone invariant catalog with verification dates
- `POKER_THEORY.md` — **MANDATORY before editing `rangeEngine/` or `exploitEngine/`**

## Poker Analysis Guardrail
**Before editing ANY file in `src/utils/exploitEngine/` or `src/utils/rangeEngine/`:**
1. Read `.claude/context/POKER_THEORY.md` (poker theory reference)
2. Read the sub-directory `CLAUDE.md` in the engine you're editing (domain rules + anti-patterns)
3. Read `docs/RANGE_ENGINE_DESIGN.md` if touching range estimation logic
4. Verify your changes don't regress any poker concept listed in the anti-patterns section

Generic statistical reasoning (uniform priors, z-tests, linear assumptions) is almost always WRONG for poker. The codebase uses Bayesian methods, population priors, consequence-weighted confidence, and range-based thinking for specific theoretical reasons. Do not simplify.

**First-principles decision modeling (CRITICAL):** Villain decisions derive from equity, pot odds, SPR, and players remaining — NEVER from position labels, bucket labels, or style categories directly. Labels are outputs of the decision process, not inputs. Do not add `if (position === 'EP') foldRate *= 1.05` — compute from game state. Do not use `POP_CALLING_RATES[bucket]` when per-combo equity is available — use the logistic. Do not stack style adjustments on top of the stats that define the style — that's double-counting. See POKER_THEORY.md §7 and exploitEngine/CLAUDE.md anti-patterns.

## Architecture (v122)
See `SYSTEM_MODEL.md` §1 for full component map, dependency graph, and extension boundary.
Quick ref: React + Vite + Tailwind, 8 reducers, 12 contexts, 33 hooks, 13 views, 4 engines, IndexedDB v13.

## Working Principles
- **Plan first, code second** — outline your approach before writing code. For non-trivial changes, present the plan and wait for approval
- **Root cause, not symptoms** — diagnose *why* something broke before writing a fix. Never patch around a bug
- **Minimal scope** — do exactly what was asked. Do not refactor nearby code, add features, or "improve" things unprompted
- **Follow existing patterns** — study how the codebase already solves similar problems before inventing a new approach
- **Verify visually** — launch dev server and confirm UI changes render correctly. Don't assume correctness from code alone
- **State verification criteria** — after any change, explain exactly how to confirm it works (which view, what interaction, what to look for)
- **Read before writing** — understand existing code fully before modifying. Never edit a file you haven't read this session
- **Don't be surprise-proactive** — take follow-up actions only when asked. Ask before adding anything beyond the immediate request
- **Update the System Model** — after any architectural change, update `SYSTEM_MODEL.md` in the same session. Stale models cause wrong reasoning.
- **Check failure library** — after fixing a non-trivial bug, check `.claude/failures/` for known failure modes. If it's new, create a failure file.

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
1. Follow Session Start Protocol above (STATUS.md + handoffs)
2. Check `.claude/BACKLOG.md` — claim item with `/backlog claim <id>`
3. `/project start <name>` for multi-file tasks
4. Read `.claude/context/SYSTEM_MODEL.md` for architectural context, then read affected files
5. Write `/handoff` before ending your session
6. 4+ files changed → `EnterPlanMode`

### Handoff Proportionality
- **Single-file fix, no multi-session risk:** No handoff needed. Update STATUS.md if state changed.
- **Multi-file change, single session:** Create handoff, list owned files, close before session ends.
- **Multi-session project:** Full ceremony — `/project start`, claim in BACKLOG, `/handoff` at end.

## Work Discovery (When Backlog Is Empty)
1. Run `/health-check` — scan for staleness, regressions, drift
2. Run `/eng-engine` — roundtable audit producing prioritized findings
3. Check SYSTEM_MODEL.md tech debt register (§11) for items with resolution paths
4. Ask the user — they may have requests not captured in governance
Do not invent work. If all checks pass and user has no requests, the project is healthy.

## Responsive Design
- Target: 1600x720 (Samsung Galaxy A22 landscape)
- Scale: `min(viewportWidth * 0.95 / 1600, viewportHeight * 0.95 / 720, 1.0)`

## Testing
- ~5,400+ tests across ~184 test files (Vitest + fake-indexeddb)
- Verify across views: Table, Showdown, Stats, Sessions, Players, Settings, Analysis, HandReplay, Tournament, Online

## Analytics Pipeline
See `SYSTEM_MODEL.md` §2.2 for the 3-layer analysis pipeline (Session Stats → Player Tendencies → Exploit Generation) and §2.3-2.4 for game tree and range profile flows.

## Ignition Extension (`ignition-poker-tracker/`)
Chrome MV3 extension — WebSocket capture, side panel HUD, app sync. Has its own `CLAUDE.md` with architecture, anti-patterns, and troubleshooting.

**Visual verification is mandatory for sidebar changes:**
```bash
cd ignition-poker-tracker
npm test                   # 824+ tests (logic regressions)
npm run harness            # Serve visual harness on localhost:3333
# Then use Playwright MCP tools to screenshot all 16 scenarios
```

Key modules: `render-orchestrator.js` (extracted pure render functions), `render-street-card.js` (street-adaptive), `side-panel.js` (orchestration IIFE). See `ignition-poker-tracker/CLAUDE.md` for full details.

## Docs
- `docs/QUICK_REF.md` — constants, hooks, utils
- `docs/DEBUGGING.md` — error codes
- `docs/CHANGELOG.md` — version history
- `docs/RANGE_ENGINE_DESIGN.md` — range engine design spec
