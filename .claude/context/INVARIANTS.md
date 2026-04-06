---
last-verified-against-code: 2026-04-06
verified-by: governance-overhaul
staleness-threshold-days: 30
---

# Invariants Catalog

**Version**: 1.0.0 | **Last verified**: 2026-04-06

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
