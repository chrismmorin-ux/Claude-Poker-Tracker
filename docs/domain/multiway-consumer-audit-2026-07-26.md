# Heads-up assumption audit — every consumer, fixed or documented

Date: 2026-07-26 · Ticket: WS-277 · Accept criterion #5
Scope: the money-consequence slice (founder-approved ceiling). Bluff-catching
with players behind and card-removal were deferred — WS-282 / WS-281.

Every site below either now derives from the N-player spine, or is documented
HU-only **with the reason**. Nothing is silently left heads-up.

## FIXED — now N-player

| Site | Was | Now |
|---|---|---|
| `foldEquityCalculator.calcFoldEquity` | pot hardcoded `potSize + betSize*2` — exactly one caller | `potSize + betSize*(k+1)`, `k = numCallers` (default 1) |
| `foldEquityCalculator.calcBluffEV` | same | same; a PURE bluff is provably indifferent to `k` (it never wins the called pot) |
| `foldEquityCalculator.calcValueBetEV` | same | threads `numCallers` |
| `gameTreeEvaluator` main EV (`potAfterCall`) | `betSize*2` | `betSize*(1 + expectedCallers(pFold, numOpponents))` — `pFold` here is already the multiway fold-through |
| `gameTreeEvaluator` refinement pass | `betSize*2` | same treatment |
| `gameTreeEvaluator` depth-2 entry | `betSize*2` | same treatment |
| `gameTreeEvaluator` depth-3 entry | `betSize*2` | same treatment |
| `actionClassifier.classifyAction` ladder | bare `heroEquity > 0.50/0.55/0.45/0.30/0.65` | `multiwayEquityThreshold(target, numCallers)` — `target^(1/k)`, identity at k=1 |
| `actionClassifier.buildTreeReasoning` ladder | duplicate bare ladder | same scaling, fed `numCallers` via `contextHints` |

**Regression proof:** every threshold and every pot expression is an exact
identity at k=1. `__tests__/multiwayDecisionMath.test.js` asserts this rung by
rung; the full exploitEngine suite (2,571 tests, 54 files) passes unchanged.

## ALREADY CORRECT — no change needed

**`gameTreeEquity.multiwayFoldPct`** — this was NOT a gap, contrary to the
ticket's framing. It computes fold-through as the product of per-opponent fold
rates, and carries a sound argument for why that product is *exact* rather than
an approximation: in the all-fold line every opponent faces the same bet into the
same pot, so conditional on the shared board their decisions depend only on
independently-dealt hole cards. Board texture enters through each opponent's
individual fold rate. A separate correlation term was **deliberately removed
under FIND-030** as double-counting texture (§7.4).

WS-277's decision flag asked whether to build a correlation model. The answer is
no — the existing derivation is better than what the ticket proposed. What was
actually missing is that this primitive was **not shared**; the EV math had no
way to consume it. That is what `expectedCallers` fixes.

## DOCUMENTED HU-ONLY — with reasons

| Site | Why it stays heads-up |
|---|---|
| `gameTreeDepth2.js:314` (`comboEquity * (pot + betSize*2)`) | Per-combo depth-2 EV. The *entry* pot is now multiway-correct (fixed above); this inner term is a per-combo continuation against the modelled responder. Making it N-player requires the exact-subset machinery deferred to **WS-281** — doing it half-way here would mix an expected-caller pot with a pairwise combo equity and double-count. |
| `gameTreeDepth2.js:1230` (`calledPot`) | Same, in the raise-response branch. |
| `decisionTreeBuilder.js` (4 × `calcBluffEV`) | Builds an *illustrative* decision tree from `DEFAULT_POT` constants with no live game state — it has no opponent count to pass. Defaulting to `numCallers = 1` is correct here, not a fallback. |
| `briefingBuilder.js` (`calcBluffEV`) | Narrative briefing text, same reason: no opponent count in scope. |
| `buildTreeReasoning` descriptive thresholds (0.25 / 0.35 for "equity too low", "weak holding", donk-bluff phrasing) | Copy selection only. They change wording, never a classification or an EV. Scaling them would churn strings for no decision impact. |

## SHIPPED BUT UNCONSUMED — stated plainly

**`perDefenderMDF`** is implemented and tested (it reproduces `pot/(pot+bet)` at
N=1 and holds `(1-d)^N = breakeven` for all N), satisfying the accept criterion.
**It has no production consumer yet.** MDF currently appears in the engine only
as commentary and as hand-tuned threshold constants in `villainObservations.js`
(`foldTo3BetMin: 60`, `foldToCbetMin: 55`, `blindDefendMax: 25`) — those are
static numbers that were *derived from* heads-up MDF by hand, not computed.

Routing them through `perDefenderMDF` would change live over-fold detection
thresholds and is a behavior change beyond this slice's ceiling. Flagged here
rather than done quietly.

## Dead code found in passing

`classifyAction` is **imported but never called** in production
(`gameTreeEvaluator.js:69` — import only; the live path is `buildTreeReasoning`).
It is exercised only by tests. Both were fixed anyway, because the ladders must
not diverge, but the value/bluff *classification* the founder sees today comes
from the reasoning builder's prose, not from `classifyAction`. Worth a cleanup
ticket; not filed, to avoid inventing scope.
