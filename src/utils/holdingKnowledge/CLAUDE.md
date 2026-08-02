# holdingKnowledge/ — Domain Rules

**MANDATORY**: Before editing anything here, read `.claude/context/POKER_THEORY.md` and
`src/utils/exploitEngine/CLAUDE.md`. This module is the join between the range engine's
output and showdown ground truth; getting it wrong corrupts every calibration number the
project has.

The villain-side counterpart of the Hero State Primitive (`src/utils/heroState/`). HSP named
hero's state rather than passing loose fields around; this names what we know about a
**villain seat's holding at a decision point** — belief, ground truth, and provenance as one
value.

## Why it exists

Showdown reveals what a seat held. The engine carries an inferred range for that seat at
every decision. Before WS-292 nothing joined them: `decisionAccumulator` read
`playerShowdown` and used it for sizing-tell samples and a `handShown` field, never
reconciling it against the range it was carrying two hundred lines away in the same
function. That absence is why WS-291 — a falsified range model on the live recommendation
path — survived unmeasured for the life of the project.

## The two binding rules

### 1. Never within the decision being scored. Always as accumulated evidence.

Rewriting a hand's own earlier ranges from what was later revealed is circular: the range
contains the answer and every calibration number flatters itself. Feeding revealed hands
forward as evidence that widens a player's model on **subsequent** decisions is ordinary
Bayesian updating and is the point of the module.

Enforced structurally: `revealHolding` writes provenance only, and a test asserts
`holdingBelief(h).range` is the **same reference** before and after truth is attached.

### 2. `basis` is required, and `holdingTruth` refuses hypothesized ranges.

| basis | Who narrows this way | Scoreable against a revealed hand? |
|---|---|---|
| `observed` | `decisionAccumulator`, `gameTreeContext`, `replayAnalysis`, `liveAdvisor` | Yes |
| `hypothesized` | `gameTreeEvaluator` refinement, all of `gameTreeDepth2` | **No** — refused |

Scoring a counterfactual branch ("suppose villain calls") against the hand villain turned up
measures a road not travelled. That is a category error, not a miscalibration, so the
primitive refuses rather than returning a number someone will average.

`narrowHolding` throws on a missing or unknown `basis`. Defaulting it would reintroduce
exactly the ambiguity the axis exists to remove.

## Anti-patterns

### DO NOT read `covered` as the live signal

`covered` (does the range give the true hand ANY weight) is the metric that is not
arguable — a model assigning zero to an event that occurred is falsified, not
miscalibrated. But **on the engine as it ships it is always true**, so it discriminates
nothing. Coverage comes from the WS-302 preflop priors seeding every cell
(`PRIOR_SUPPORT_LAMBDA = 0.8`); WS-291's floor (`MIN_CONTINUATION_WEIGHT = 0.05`) then keeps
surviving cells positive.

Note the order — **narrowing preserves a zero the seed already had.** It reweights support,
it does not create it. Hand `narrowByBoard` a hard-edged range and hands outside it stay at
zero (asserted in `__tests__`). Coverage is a property of the seed first, the narrowing
second.

The signal to build on is `logLift` = log(p/u), which degrades smoothly: a player who
continues below the equity threshold the model assumes has their revealed hands sitting near
the floor, producing low or negative lift **without ever producing a coverage miss**.

### DO NOT fit a per-player width off the report without a sweep

`actingByPlayer` in the calibration probe is INPUT to that fit, not the fit. n per player is
small (showdowns are rare) and the values are noisy. Choosing a softness by reading the table
is precisely what WS-291 (floor) and WS-303 (`ACTION_TAU_FRACTION`) had to undo — a constant
picked by taste where a measurement belonged. Sweep it, score every arm on the SAME
decisions, and rank by discrimination.

### DO NOT turn a calibration miss into a hero recommendation here

A player whose range we read badly is a **villain-side observation**. The counter-strategy —
bluffcatch wider because their river range holds more no-showdown-value hands, bluff wider
because more of it folds — is the game tree's to compute from the corrected range. That
separation is `exploitEngine/CLAUDE.md`'s "DO NOT derive hero action recommendations from
weakness identification", and it applies here unchanged. Fix the width; the counter-strategy
falls out.

### DO NOT let `narrowHolding` become anything but a pass-through

It forwards `options` to `narrowByBoard` verbatim and stores the returned array by
reference. That is what makes a wired call site bit-identical to the bare call it replaced,
and what let WS-292 migrate six narrowing sites — including the depth-2/3 chain — with the
engine's output verified unchanged. Any logic added here silently changes every consumer at
once.

## Files

| File | Does | Does NOT |
|------|------|----------|
| `index.js` | `openHolding` / `narrowHolding` / `revealHolding` / `holdingBelief` / `holdingTruth` | Fit parameters, recommend actions, mutate handles |
| `provenance.js` | Immutable narrowing audit trail; `basis` validation; `narrowingCount` vs `streetsNarrowed` | Touch ranges |
| `coverage.js` | Score a believed range against a revealed hand (`scoreCoverage`) | Know about actions, players or the game tree |

## Consumers

`exploitEngine/decisionAccumulator.js` · `exploitEngine/gameTreeContext.js` ·
`exploitEngine/gameTreeEvaluator.js` · `exploitEngine/gameTreeDepth2.js` ·
`handAnalysis/replayAnalysis.js` (by DI) · `liveAdvisor/computeHelpers.js` ·
`scripts/backtest/rangeCalibrationProbe.mjs`

`heroRangeBuilder.js` is deliberately NOT a consumer: hero's represented/perceived range
(WS-276/307) is a different question from what a villain seat holds.
