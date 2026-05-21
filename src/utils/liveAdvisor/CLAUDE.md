# liveAdvisor/ — Domain Rules

**MANDATORY**: Before editing ANY file in this directory:
1. Read `.claude/context/POKER_THEORY.md` — poker theory foundation (shared with engines).
2. Read `src/hooks/useLiveActionAdvisor.js` — the sole consumer of this module today; understand what it expects.
3. Read `src/utils/exploitEngine/CLAUDE.md` + `src/utils/rangeEngine/CLAUDE.md` if touching the helpers that delegate to those engines.

This module is the **pure compute layer for the live-advisor pipeline**. Extracted from `useLiveActionAdvisor.js` in SPR-080 / 2026-05-14 (Refactor Sprint Item 5) to enable PMC Phase 5b's hand-end integration point without bloating a 528-LOC hook.

## Module map

| File | Does | Does NOT |
|------|------|----------|
| `computeHelpers.js` | 6 pure helpers: `computeTrialCount`, `computeAllVillainRanges`, `computeVillainEquities`, `narrowWithLog`, `buildPreflopAdvice`, `buildPostflopAdvice` | React (no hooks), IO (no IDB), side effects |

## Core principles

### 1. Pure module — no React, no IO

Every helper is a stateless function. No `useState`, no `useEffect`, no `useRef`, no IndexedDB writes, no `dispatch`. State lives in the consumer hook (`useLiveActionAdvisor`); side effects live in callers.

### 2. Single consumer today

Only `src/hooks/useLiveActionAdvisor.js` imports from this module. Future consumers (PMC Phase 5b hand-end-capture helpers) may join, but new consumers MUST come with an explicit need — not "this looks useful."

### 3. Helpers are extracted, not redesigned

The 6 helpers are byte-equivalent to their pre-extraction shapes in `useLiveActionAdvisor.js` (other than the `export` keyword on 4 that were previously module-local). Behavior preservation is the load-bearing contract. Any logic change requires an explicit ticket + test coverage.

### 4. Imports come from sibling util modules

This file imports from `../exploitEngine/`, `../pokerCore/`, `../rangeEngine/`, `../positionUtils`. It does NOT import from `../../hooks/`, `../../contexts/`, or `../../components/`. The dependency direction is one-way: hooks → this module.

## Anti-patterns

### DO NOT add React imports

If a helper needs React state, it belongs in `src/hooks/` not here. The extraction's load-bearing benefit is that this module is unit-testable without renderHook ceremony.

### DO NOT widen the public surface without a second consumer

Only `useLiveActionAdvisor` imports today. Don't add `export` to internal helpers "in case someone needs them" — every export is a contract. New exports require a real second consumer.

### DO NOT inline poker math here

The Beta-Binomial, Wilson CI, and other math primitives live at `src/utils/decisionSystems/accumulator/`. The exploit math lives at `src/utils/exploitEngine/`. This module orchestrates calls; it doesn't author math.

## File responsibilities

| Helper | Reads | Writes |
|--------|-------|--------|
| `computeTrialCount` | `{ spr, street, activeOpponents, sampleSize }` | Returns int trial count for MC equity |
| `computeAllVillainRanges` | `liveHandState`, `tendencyMap`, `dealerSeat` | Returns `[{ seat, position, actionKey, range, villainData }]` for non-folded villains |
| `computeVillainEquities` | `heroCards`, `villainRangeEntries`, `board`, `baseTrials`, `equityFn?` | Returns `{ perVillain, multiway }` — parallel equity calc |
| `narrowWithLog` | `range`, `action`, `board`, `deadCards`, `options`, `seat`, `street` | Returns `{ narrowed, logEntry }` for postflop range update |
| `buildPreflopAdvice` | live-hand-state assembly + `detectedSituation` + `villainModel` | Delegates to `preflopAdvisor.computePreflopAdvice` |
| `buildPostflopAdvice` | live-hand-state assembly + `detectedSituation` + `villainModel` + `tendencyMap` | Delegates to `gameTreeEvaluator.evaluateGameTree` |

## Related docs

- `src/hooks/useLiveActionAdvisor.js` — sole consumer
- `src/utils/exploitEngine/CLAUDE.md` — downstream engine
- `src/utils/exploitEngine/preflopAdvisor.js` — buildPreflopAdvice delegates here
- `src/utils/exploitEngine/gameTreeEvaluator.js` — buildPostflopAdvice delegates here
- `.claude/projects/refactor-sprint-2026-05-10.md` Item 5 — extraction rationale
