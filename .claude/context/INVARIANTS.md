---
last-verified-against-code: 2026-04-16
verified-by: PEO-1
staleness-threshold-days: 30
---

# Invariants Catalog

**Version**: 1.1.0 | **Last verified**: 2026-04-16

Standalone catalog of all system invariants. Checked by `/review`, `/cto-review`, and `/eng-engine`.
SYSTEM_MODEL.md §4 references this file.

---

## MUST Always Be True

| ID | Invariant | Enforced By | Test Coverage | Last Verified |
|----|-----------|-------------|---------------|---------------|
| INV-01 | `actionSequence` entries have monotonically increasing `order` values | `getNextOrder()` in `sequenceUtils.js` | Full | 2026-04-06 |
| INV-02 | Every seat in `actionSequence` is in range [1, `CONSTANTS.NUM_SEATS`] | Reducer validation | Full | 2026-04-06 |
| INV-03 | A folded seat never appears in subsequent street actions | `hasSeatFolded()` guard in `useGameHandlers` | Full | 2026-04-06 |
| INV-04 | `communityCards` has exactly 5 slots; cards added only at street transitions | `cardReducer` street guards | Full | 2026-04-06 |
| INV-05 | Range profile weights are in [0.0, 1.0] per combo | `bayesianUpdater` normalization | Full | 2026-04-06 |
| INV-06 | Fold equity formula always includes equity-when-called term | `calcBluffEV()` in `foldEquityCalculator.js` | Full | 2026-04-06 |
| INV-07 | Style labels are OUTPUTS of stat classification, never INPUTS to decision models | Villain model hierarchy: model > stats > style priors > population | Partial (manual review) | 2026-04-06 |
| INV-08 | No circular imports between engine layers | `pokerCore` <- `rangeEngine` <- `exploitEngine` (strict) | None (structural) | 2026-04-06 |
| INV-09 | All IndexedDB access is user-scoped via `userId` parameter | Every persistence function signature | Full | 2026-04-06 |
| INV-10 | Exploit recommendations come from game tree EV, never from weakness labels directly | `gameTreeEvaluator.js` is sole recommendation source | Partial | 2026-04-06 |
| INV-11 | Bayesian priors, never frequentist tests, for poker frequency analysis | `bayesianConfidence.js` Beta-Binomial intervals | Full | 2026-04-06 |
| INV-12 | `ACTIONS.*` constants used for all action recording | `gameConstants.js` is single source | Full | 2026-04-06 |
| INV-13 | All `Math.exp` calls use numerically stable patterns (subtract max before exponentiation) | `stableSoftmax()` in `mathUtils.js` | Full | 2026-04-06 |
| I-PEO-1 | At most one player-draft record per `userId`; commit is atomic (player `put` + draft `delete` in one IDB transaction) | `commitDraft()` in `draftsStorage.js` | Full | 2026-04-16 |
| I-PEO-2 | Retroactive seat-player linking is session-scoped: only hands with matching `sessionId` are modified | `linkPlayerToPriorSeatHands()` in `handLinking.js` | Full | 2026-04-16 |
| I-PEO-3 | Retroactive linking is idempotent: re-applying `(handId, seat, playerId)` is a no-op; skipped hands counted separately | `linkPlayerToPriorSeatHands()` + `updateSeatPlayerForHand()` | Full | 2026-04-16 |
| I-PEO-4 | Undo tokens carry the exact `handIds` captured at link time; revert touches only those hands (and only if still mapped to the linked player) | `buildUnlinkPlan()` in `handLinking.js` | Full | 2026-04-16 |
| INV-14 | Components under `src/components/views/<ViewName>/` must not be imported from outside their own view folder. Cross-view helpers live in `src/components/_shared/`. | Manual code review + future ESLint rule (RT-103) | None (structural) — currently violated by drill views | Proposed 2026-04-20 — VIOLATED |
| INV-15 | SCREEN constants may only be removed after a two-step deprecation: (1) mark deprecated in `uiConstants.js`, (2) sweep all `prevScreen`/history refs, (3) delete. Bulk deletion without sweep is forbidden. `PokerTracker.jsx` routing switch must have a `default:` fallback to `SCREEN.TABLE`. | Code review; no mechanical enforcement yet | None | Proposed 2026-04-20 |

---

## MUST Never Happen

| ID | Anti-Invariant | Risk If Violated | Detection Method | Last Verified |
|----|---------------|-----------------|-----------------|---------------|
| NEV-01 | Direct state mutation outside reducers | Silent corruption, render desyncs | Code review | 2026-04-06 |
| NEV-02 | IndexedDB migration that drops data without backup | Permanent user data loss | Migration tests | 2026-04-06 |
| NEV-03 | Position labels used as decision model inputs (e.g., `if (pos === 'EP') fold *= 1.05`) | Double-counting, theoretically wrong exploits | Code review + grep | 2026-04-06 |
| NEV-04 | Bucket labels used when per-combo equity is available | Precision loss in EV calculations | Code review | 2026-04-06 |
| NEV-05 | Style adjustments stacked on stats that define the style | Triple-counting behavioral signal | Code review + grep | 2026-04-06 |
| NEV-06 | Weakness IDs carrying hero action labels | Conflation of analysis and recommendation layers | Code review | 2026-04-06 |
| NEV-07 | z-tests or frequentist hypothesis testing on poker frequencies | Wrong confidence intervals with small samples | Code review + grep | 2026-04-06 |
| NEV-08 | Hardcoded seat numbers (use `SEAT_ARRAY`, `CONSTANTS.NUM_SEATS`) | Breaks if seat count ever changes | Grep for `[1-9]` literals in seat contexts | 2026-04-06 |
| NEV-09 | `foldPct * potSize` without equity-when-called term | Overestimates bluffs, underestimates value bets | Test assertions on calcBluffEV | 2026-04-06 |
| NEV-10 | Synchronous IndexedDB access on main thread | UI freezes on large datasets | Code review | 2026-04-06 |
| NEV-11 | Unescaped dynamic data in `innerHTML` assignments | XSS in extension context (popup, sidebar) | Grep for innerHTML | 2026-04-06 |

---

*Update this file when: new invariant discovered, existing invariant violated, or after any `/eng-engine` roundtable.*

---

## Recent Audit Findings

**2026-04-20 — Drills Consolidation Roundtable.** INV-14 (sibling-import discipline) proposed and found to be *currently violated* by drill views — `RangeFlopBreakdown`, `MatchupBreakdown`, `HandPicker`, `LessonCalculators`, `FRAMEWORK_COLOR` are imported across tab boundaries via `./` relative paths in 10+ files. Separately, the pre-existing INV-08 violation at `src/utils/drillContent/__tests__/lessons.test.js` (utils-layer test importing from views/) is tracked as RT-95. INV-15 (SCREEN enum lifecycle) proposed preemptively before drills-consolidation Phase 7 would otherwise violate it.
