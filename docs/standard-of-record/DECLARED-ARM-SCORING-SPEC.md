# Scoring an externally-published strategy — specification

> **Status:** SPEC + working prototype — established 2026-08-05 (WS-425)
> **Governing decision:** [ADR-009](../adr/ADR-009-standard-of-record.md)
> **Program:** `strategy-of-record` (`scripts/backtest/**` is its first scope pattern)
> **Instrument:** `scripts/backtest/strategyArm.mjs` · `scripts/backtest/run-strategy-arms.mjs`
> **Result Card:** none. The prototype run makes no comparative claim; see §8.
> **Verified against:** working tree at HEAD `fe716f59`. Every file:line below was read, not
> recalled. Where the working tree differs from HEAD the HEAD line is given in parentheses.

---

## 0. The question

> *"We might glean from each absorbed strategy ran against our standard."*

Take a published poker strategy — a preflop chart, a c-bet frequency table, a sizing rule, a
solver baseline — run it against the same decision set through the same estimator as the engine,
and read the number in the repo's own currency. Not adopted. **Encoded, scored, compared.** Where
a published rule beats the engine on the engine's own metric, that is a measured gap in the engine
rather than an argument about whose theory is better.

This document answers: which harness, scored on what, what interface a strategy must satisfy, what
happens where it says nothing, what it costs, and whether a solver baseline gives us the
equilibrium frame.

---

## 1. The finding that reorganises the answer

**The encoding format already exists and has never been scored.**

A Strategy Card (`src/utils/standardOfRecord/strategyCard.js`) is ADR-009's `Declared` surface:
a rule list matching only on `MATCHABLE_AXES` (`:76`), action distributions with a bare action as
sugar for a point mass (`desugarAction`, `:99`), a **required** residual clause so the card
accounts for every state inside its declared domain (`:227-231`), a warrant per rule, and a
content hash. `evaluateCard(card, situation)` (`:358`) executes it and returns
`{action, ruleId, warrant, residual, abstained, reason}`.

That is exactly the object an externally-published strategy needs. It is validated on load — the
loader throws rather than warns — and it is already the object a Result Card's `Match` is defined
over (`VOCABULARY.md:50`: *Strategy Card × Deal Book × Field → Result Card*).

**And `evaluateCard` had no caller anywhere in `scripts/backtest/`.** A grep across the harness
finds none. The Declared surface could be authored, validated and hashed — but never scored. This
is the shipped-but-inert pattern named in the standing memory entry: a capability behind an
interface no measurement site calls. The gap between "a published strategy" and "a number in bb"
was never a missing format. It was one missing bridge function.

Consequently this spec does **not** define a new encoding. It defines the bridge, and the
accounting the bridge has to carry.

---

## 2. Which harness, scored on what, available when

Two harnesses were assessed. They are not substitutes.

### 2.1 The teachable-arms probe — a dead end for this purpose

`scripts/backtest/teachableArmsProbe.mjs`. Verified:

- Its metric is `deltaLogVsUniform` (`:301`) — `(sumLogP - sumLogU) / n`, mean log P(true holding)
  minus mean log uniform. **Nats, not bb.** POKER_THEORY §11.9 (`:1870-1894`) reports A4, a
  15-number rule, at 57.3% / 55.7% of the engine's narrowing edge on two sites. That figure is
  real and it replicates. It is not EV.
- More fundamentally, **its arms are the wrong kind of object.** Every arm (`scoreArms`, `:341`)
  is a *range-narrowing rule* — a function `(range, villainAction, board) → narrowed range` — and
  it is scored on how much probability the narrowed range assigns to the villain's **true
  holding**. That is villain-model quality. A published *hero* strategy is a map from decision to
  action. There is no way to score one here that is not a category error.
- It is showdown-selected. `forEachVillainDecision` requires `hand.gameState.showdownCards[seat]`
  and returns otherwise (`:167-170`). Only decisions where the acting player's cards were revealed
  enter the sample.

**Verdict: dead end for scoring a published hero strategy.** What *would* open it — and is a real
and cheap second use — is that published *range assertions* ("villains open these hands from EP")
are directly encodable as a replacement for `buildBaselineRange(null, null, vPos)` at `:180`, and
would score in nats as a villain-prior arm. That is a different question with a different
deliverable and should not be confused with this one.

### 2.2 The hero-EV harness — the answer, available today

`scripts/backtest/heroEvRunner.mjs` → `ipsEstimator.mjs` → `depthAblationReport.pairedDelta`.

The seam that makes this work is narrow and already load-bearing. `ipsEstimator.weightFor`
(`:76`) reads exactly four fields off a scored decision — `piOurs`, `piPool`, `observedAction`,
`netBB`. `depthAblationReport.pairedDelta` (`:204`) reads `piOursByArm[id]` (`:216-217`), and
`buildDepthAblationReport` scores each arm by remapping `piOurs = piOursByArm[armId]` and calling
the same `estimateEdge` (`:422-423`). **None of them knows or cares where the distribution came
from.** It can be `evaluateGameTree`, a coach's chart, or a constant.

Scored on `edgeBB` — expected hand value in bb relative to population-typical play,
outcome-anchored on realized chips, with the `populationControl` arm that must be exactly 0.000
or the run voids. This is the founder's stated currency.

**Available: today.** The prototype in §7 runs end to end. It required ~60 lines of new module plus
an additive change to the runner, and it is **not blocked by WS-404**.

### 2.3 The critical scope limit nobody should discover later

**The hero-EV decision set is postflop-only, at both ends.**

- `heroPolicyAt` returns `EMPTY_RANGE` when `board.length < 3` (`heroPolicy.mjs:171`, HEAD `:170`),
  so preflop decisions never produce an engine policy and are dropped by the pairing rule.
- The mined behaviour policy contains **no preflop cells at all**. Inspecting
  `out/behavior-policy.json` (400 players, 12,191 observations, `pool-train`) the only streets
  present are `flop`, `turn`, `river`. π_pool — the denominator of every importance weight — does
  not exist preflop.

**A preflop chart therefore cannot be scored on this harness at any price short of widening the
decision set and re-mining the field.** This is the single most consequential cost finding in this
document and it is easy to miss, because a preflop chart is the most obvious thing to want to
encode and a Strategy Card expresses one perfectly well. See §6, Path C.

---

## 3. The strategy-arm interface

A strategy arm is a **sibling of `heroPolicyAt`, not a configuration of it.** WS-404 threads
`engineOverrides` *into* the engine so an arm can vary the engine's *search*. That is a different
axis. A published strategy is a different *function*, and the only thing downstream needs is its
distribution.

```
policyAt({ ctx, hand, geo, responses })
  -> { covered: true, actions: {action: p}, residualMass?, ruleFires? }
  |  { covered: false }
```

Contract, each clause enforced in `strategyArm.mjs`:

1. **`actions` is keyed on `RESPONSES_BY_FACING[ctx.facingAction]`** — `none: [check, bet]`,
   `bet`/`raise`: `[fold, call, raise]` (`behaviorPolicy.mjs:39-43`). Mass on an action outside
   that set is **dropped and reported** as `meanOutOfSetMass`, never folded in: a strategy
   recommending a bet where the vocabulary is `{fold, call, raise}` has said something the
   decision cannot express, and reassigning that mass would invent a recommendation on its behalf.
2. **No smoothing.** A zero is the real statement "this strategy never takes this action here",
   and it correctly yields weight 0. Same posture as `heroPolicy.mjs:374-376`.
3. **Pure.** No engine call, no RNG, no clock. This is what makes a strategy arm usable as a
   determinism control (§5.2).
4. **A strategy arm may never be `primaryArmId`.** The primary arm supplies `perCombo` (which the
   PBR ceiling consumes, `heroEvRunner.mjs:277-279`) and `evStats` (the optimizer's-curse
   figures). A strategy arm computes neither. Naming one primary would silently null the ceiling
   and the curse for the whole run while every other figure kept working. The runner now throws.
5. **Engine arms are evaluated first, unconditionally**, so a strategy arm falling back to the
   engine always has its fallback source in hand. A run with no strategy arms is reordered onto
   itself, so every existing caller is unchanged.

### 3.1 The Strategy Card adapter, and the one axis the corpus cannot supply

`fromStrategyCard(card, {sourceRef, encoding})` is the bridge. Of the axes a card may match on,
every one is available on a scored decision — `street`, `texture`, `posCategory`, `isAgg`, `isIP`,
`facingAction`, `contextAction` off `ctx`; `sprBand`, `closesAction`, `sBucket` off the geometry —
**except `handClass`** (`situationKey.js:101`). The corpus masks hole cards pre-showdown. A
decision does not have a hand; it has a **range**.

So a card matching on `handClass` is evaluated **once per sampled combo and mixed by range
weight** — the identical construction `heroPolicy` uses for engine advice:

> π_card(a | s) = Σ over combos h of P(h | s) · card(a | s, handClass(h))

using the same `sampleCombos` (systematic, weight-proportional, exactly reproducible), so the card
arm and the engine arm marginalize over the **same** holdings. The comparison isolates the decision
rule rather than quietly comparing two different range samples. The card path costs no engine call
— it is 169-class lookups against a rule list.

Two supporting mechanics were needed and are in place:

- The full `geometry` block moved **above** the arm loop in `heroEvRunner` (it was built after the
  arms, which was fine while only the engine consumed it). A card matches on `sprBand` and
  `closesAction`, so it needs them before it is asked. The block was **moved, not copied** — a
  second derivation would be a second notion of the same coordinate, which that block's own
  comment forbids. Pure move; the 98 harness tests pass unchanged.
- The situation carries `gameType`, `seats` and `stackDepthBB` alongside the axes. `inDomain`
  returns `DOMAIN_UNKNOWN` — an abstention — for any constrained field the situation does not
  carry (`strategyCard.js:316-320`), so a card declaring `stackDepthBB: [80,200]` would otherwise
  abstain on 100% of decisions and report "out of domain" when the truth is the harness failed to
  say.

### 3.2 A card arm must be hash-identified

`loadStrategyCardSync` does **not** compute a content hash; only the async `loadStrategyCard`
does (`:197-198`). The prototype's first run reported `strategyVersion: "schema1+nohash"` — a
Result Card that cannot say *which version of the strategy* was scored. Fixed to the async loader.
**This is an accept criterion, not a detail**: rule order is semantic (first match wins), so a
reordered card is a different card, and the hash is the only thing that says so.

---

## 4. The frequency-vs-decision problem

A chart gives π(a|s) directly. "C-bet 65% on dry boards" gives a **marginal over a class**, not a
distribution at a decision.

### 4.1 The part that dissolves

**For any publication that names hands, the problem does not arise.** The chart says which
holdings do what; the range marginalization of §3.1 mixes them into a per-decision distribution
and no ordering has to be supplied by us. The problem is real only for publications that state a
frequency **without saying which hands carry it** — and that is a property of the publication, not
of this harness.

### 4.2 The part that does not, and the three honest options

For a bare frequency, three encodings recover a per-decision distribution. They are different
objects and `strategyArm.mjs` records `encoding` on every arm so a reader cannot lose track.

| encoding | construction | assumes | may be called "the publication"? |
|---|---|---|---|
| `MARGINAL` | π(bet\|s) = 0.65 at every decision in the class | the strategy randomises **independently of the holding** | **yes** — it adds nothing the publication did not say |
| `ORDERED` | bet the top 65% of hero's range by a strength ordering; π(bet\|s) = mass above the threshold | **an ordering the publication did not supply** | no — HYBRID |
| `TILT` | tilt the engine's own π until the class marginal hits 65% | the engine's hand-**selection** is right and only its **frequency** is wrong | no — HYBRID |

**Ruling.** `MARGINAL` is the only encoding that is *only* the publication, and it is the one that
may be reported as the published strategy's score. It will look weak. That weakness is a
measurement of the publication's information content, not a defect of the encoding.

`ORDERED` and `TILT` are worth running **beside** it, not instead of it:

- the gap `ORDERED − MARGINAL` is **the value of the ordering** — a number about us, not about the
  publication;
- `TILT` varies exactly one dimension and is therefore the most informative arm for *improving the
  engine*, which is the founder's stated purpose. It answers "is the published frequency a better
  frequency than ours, holding hand-selection fixed?" — a question neither of the other two asks.

This is the standing "ship both, state the limit of each" doctrine: do not descope to one arm; run
all three, encode each limit as **data** (`encoding`), and treat the gap between them as the
finding. Only `MARGINAL` and `TILT` are built-shaped today; `ORDERED` needs a declared ordering
and is deliberately not built (§6).

### 4.3 The realised marginal is verified, never assumed

`summarizeCoverage` accumulates the **realised** action marginal over the decisions actually
scored. A publication that says 65% and realises 41% here has not been mis-encoded — the decision
set is not the population its author had in mind — and that gap must be visible as data.

**The prototype forced a correction here.** Pooled across facing classes, a uniform arm reported
`{check: 0.35, bet: 0.35, fold: 0.1, call: 0.1, raise: 0.1}` — an average across two *different*
response sets in which no cell is a frequency anything could be checked against. The accumulator is
now keyed by `facingAction`. A "c-bet 65%" claim lives in the `none` row and must be read against
that row alone.

That it works is visible in §7: the fixture card **declares** `check 0.7 / bet 0.3` for unopened
spots and **realises** `check 0.65 / bet 0.35`, the five points being the measured contribution of
its hand-class rule firing on ~7% of range mass.

---

## 5. Abstention — what each ruling measures

Every published strategy is partial. **What happens at the decisions it does not cover is not a
detail; it is what the number means.** A reader will assume whichever option flatters the result,
so the choice is recorded per arm in `config.strategyArms[].fallback`.

The default in the runner today is the dangerous one: `heroEvRunner` keeps a decision only if
**every** arm produced a policy (`:262-270`), so an abstaining arm would silently shrink the shared
decision set for the engine arm, the population control and the PBR ceiling alike.

| ruling | π at uncovered decisions | measures | status |
|---|---|---|---|
| **`FALLBACK.ENGINE`** | the engine's own advice | **the marginal contribution of the published rule dropped into our engine.** Diluted by coverage by construction, so `coveredShare` must be read with it | **default** |
| `FALLBACK.POOL` | π_pool, so w = 1 exactly | **the published rule alone, playing population poker elsewhere.** Edge ≈ coverage × (covered-decision edge). The right arm for ranking two publications; the wrong one for asking what a publication adds to our engine | opt-in |
| `FALLBACK.REFUSE` | the decision is dropped for **every** arm | the rule on its own turf — **and silently changes the decision set every other figure is averaged over.** Two publications with different coverage become incomparable while looking comparable | **refused** unless `allowSetChange: true`, and never a headline |

### 5.1 Why the default costs nothing

The covered-only figure that `REFUSE` is wanted for is **already available from the paired delta
without changing the set.** Under `FALLBACK.ENGINE`, an uncovered decision produces an identical
weight in both arms, so it carries no information about the difference. `pairedDelta` already
counts exactly this: `discordantN` / `discordantShare` (`depthAblationReport.mjs:252-253`) is the
number of decisions where the weights actually differ. That is the honest denominator for the
delta, and it is a different number from either arm's own ESS.

Precisely: identical weights do not *algebraically cancel* from a difference of two
self-normalized ratios — they shift both values' common denominator equally. They do not bias the
delta and they carry no information about it. `discordantN` is the honest n; `n` is not.

Live in §7: `always-fold` covers 30% (9/30) yet `discordantN` is 7, not 9 — on two covered
decisions the engine also folded, so those two carry no information either. That distinction is
invisible from coverage alone.

### 5.2 A strategy arm is a determinism control, and this holds

Two irreproducibility sources were identified. Unseeded depth-2/3 sampling is addressed in the
working tree (`gameTreeSampling.js` now exports `boardDerivedRng`, `:113`, xorshift32 seeded from
the cards). Wall-clock refinement gating is **still open as WS-411** — `gameTreeEvaluator.js`
gates refinement on `Date.now()` (`:954`, `:961`, `:985`; the working-tree lines, not `:814,822`),
so identical inputs can give different advice under machine load.

A strategy arm is deterministic by construction, so it is a useful control — **with one honest
caveat.** Its own distribution is bit-reproducible, but its *edge* depends on which decisions
survived, and survival depends on the engine arms. To measure the engine's run-to-run floor
cleanly the strategy arm must be run **as the only arm** (`fallback: 'pool'`, which the runner
permits and which needs no engine at all). That run's decision set is fully deterministic and any
movement in it indicts the pipeline rather than the engine. Run alongside engine arms, a strategy
arm controls the *estimator and decision set*, not the engine's nondeterminism.

---

## 6. Cost per path

**Path A — strategy arm on the hero-EV harness. Cost: S–M. Not blocked. Prototype exists.**
`strategyArm.mjs` (new), an additive change to `normalizeDepthArms` + the arm loop + the snapshot
in `heroEvRunner.mjs`, the geometry move, and a CLI. Done and passing. Remaining to productionise:
a report module with admissibility (reuse `assessDepthAdmissibility`), and the manifest fields in
§8.

**Path B — engine-config arms (WS-404). Cost: M. Already filed. Complementary, not a prerequisite.**
WS-404's premises re-verify at HEAD: `normalizeDepthArms` strips to `{id, refinementBudgetMs}`
(HEAD `:66`, working tree `:73`), `heroPolicyAt` exposes only `rakeConfig`/`comboSamples`/`trials`/
`refinementBudgetMs`/`captureComboDetail` (HEAD `:145-157`), and the `evaluateGameTree` call is a
fixed object literal (HEAD `:225`). **This is genuinely needed — for a different question.** It is
what lets a publication be absorbed as a *parameter change to our engine* ("what if we used their
sizing constant") rather than as a rival policy. Neither path substitutes for the other, and the
answer to the task's question 4 is: **WS-404 is neither necessary nor sufficient for a strategy
arm.**

**Path C — preflop coverage. Cost: L. This is the real bill.** Required to score preflop charts,
which is most of the published material worth having:
1. widen `heroPolicyAt` past its `board.length < 3` gate and give `decisionGeometry` a preflop
   notion of the pot;
2. **re-mine the behaviour policy with preflop cells** — π_pool does not exist there, and without a
   denominator there is no importance weight and therefore no number;
3. re-derive the leakage split and walk-forward guard over the widened set.
Do not start Path C as part of Path A. It is a separate ticket with its own accept criteria, and
conflating them would put a large re-mining job on the critical path of a small bridge.

**Path D — the `ORDERED` encoding. Cost: S, deliberately unbuilt.** It needs a *declared* ordering,
and the declaration is the substantive act. Build it when a specific publication needs it, and name
the ordering in the arm's `sourceRef`.

---

## 7. The prototype and its actual output

`node scripts/backtest/run-strategy-arms.mjs --reference none --behavior-policy
out/behavior-policy.json --stakes 50NLH --sites PS --max-files 2 --max-players 8
--max-decisions 40 --refinement-ms 0`

Sampled: 2 of 1,231 matched PS files, 888 hands, 8 EVAL players, 30 scored decisions across 4
players, engine at depth-1. Runtime 155s.

```
  ARM EDGES vs the field (bb per hand-at-decision)
    engine        edge +5.7916  [+1.5771, +7.5216]  n=30 ESS=12   (40.0%)
    always-fold   edge +4.0834  [+0.4469, +5.0850]  n=30 ESS=15.4 (51.2%)
    uniform       edge +1.4659  [-0.0280, +1.9072]  n=30 ESS=23.9 (79.7%)
    card          edge -1.0355  [-2.2809, +0.5362]  n=30 ESS=26.8 (89.3%)

  PAIRED DELTA vs the engine arm (the well-determined figure)
    always-fold   delta -1.7082  [-3.0743, -0.3788]  n=30 discordant=7  (23.3%)
    uniform       delta -4.3257  [-5.7416, -1.4231]  n=30 discordant=30 (100.0%)
    card          delta -6.8271  [-9.7274, -1.5257]  n=30 discordant=30 (100.0%)

  COVERAGE
    always-fold   covered 30.0% (9/30)  fellBackToEngine=21
                  realisedMarginal={"bet":{"n":9,"fold":1,"call":0,"raise":0}}
    uniform       covered 100.0%        realisedMarginal={"none":{"n":21,"check":0.5,"bet":0.5},
                                                          "bet":{"n":9,"fold":.333,"call":.333,"raise":.333}}
    card          covered 100.0%        realisedMarginal={"none":{"n":21,"check":0.65,"bet":0.35},
                                                          "bet":{"n":9,"fold":.5933,"call":.3956,"raise":.0111}}
    card ruleFires (range mass): unopened-default 19.5 · facing-bet-default 8.9 ·
                                 oop-premium-bet 1.5 · facing-bet-premium-raise 0.1
```

**What this demonstrates, and only this:**

1. A policy that is not the engine scores end to end on `edgeBB`, through the same estimator, on
   an identical decision set, with a cluster-bootstrapped CI.
2. The **range-marginalization path works**. The fixture card declares `check 0.7 / bet 0.3` and
   realises `check 0.65 / bet 0.35`; the five points are its `handClass` rule firing on ~7% of
   range mass. A card matching on hands is scoreable against a corpus that masks hands.
3. **Abstention and fallback work and are separable.** `always-fold` covers 30% and falls back to
   the engine 21 times; `discordantN = 7 < 9` because the engine folded too on two covered
   decisions.
4. Both fallback rulings run in one pass (`engine` for the controls, `pool` for the card).
5. The arm ordering is sign-correct: the deliberately-bad arms lose to the engine, monotonically.

**What it does not demonstrate, stated plainly:**

- **Nothing about poker.** All three arms are controls; the card is a fixture explicitly labelled
  not-a-strategy. No published content has been encoded.
- **No figure here is quotable.** n=30, 4 players, engine ESS 40%. Both admissibility bars in
  `heroEvReport.assessAdmissibility` — 30 clusters, ESS ≥ 20% — fail on clusters. The absolute
  edges are enormous (+5.79 bb) precisely because the sample is tiny.
- The residual clause **never fired** (`residualMassShare: 0`) because no `facingAction: 'raise'`
  decision appeared in this slice. The residual accounting is therefore built but unexercised — a
  known gap, and exactly the sort a bigger slice closes.

---

## 8. The equilibrium frame — verdict

`equilibriumPost.mjs` verified: `EQUILIBRIUM_POST = null` (`:54`), and `refuseChartsAsEquilibrium`
(`:100`) **throws** on any source matching `PREFLOP_CHARTS`, `rangeMatrix`, `populationPriors`,
`POPULATION_PRIORS`, `archetypeRanges`, `SRC-009`. So frame 1 of the three-frame readout does not
exist, and substitution is refused in code rather than by convention.

**Would encoding a solver baseline as an arm give the system its equilibrium reference? No.** The
verdict has to be split, because the two halves point opposite ways.

- **As a strategy arm: yes, and it is valuable.** A genuine solver artifact — a named solver, a
  stated stack depth, a rake model, a declared bet-size tree, a convergence/exploitability bound —
  encodes as a Strategy Card and scores like any other arm, on the subset of decisions its tree
  covers, with `coveredShare` stamped. That is a real number and worth having.
- **As the Equilibrium post: no.** The premium `EV(PBR) − EV(Equilibrium)` requires the lower post
  to be defined over the *same* decision set as the upper post. A published solver output is
  defined over a **small, non-random, tree-specific** subset — particular stack depths, particular
  bet sizes, usually two players. Computing a premium over that subset and reporting it as *the*
  premium is FSA Finding F3's substitution exactly, differing from the `PREFLOP_CHARTS` case only
  in being more plausible and therefore more dangerous. **Conflating them would be worse than
  having neither**, because the resulting number reads as "money the pool's mistakes are worth"
  while measuring "money that exists because the pool differs from one solver's tree".

**Consequences, both of which are accept criteria:**

1. `refuseChartsAsEquilibrium` must also refuse a **strategy-arm-derived value** being passed as
   `equilibrium`. Today its guard is a substring match on source identifiers, and a solver card's
   id would sail through — the guard was written before a strategy arm could produce a number at
   all.
2. Nothing in this work advances SRC-013. **What would open it:** a solver artifact whose tree
   covers the decision set's actual geometry distribution, with an exploitability bound recorded —
   i.e. SRC-013 as already specified. That is a data-acquisition problem, and no amount of arm
   plumbing substitutes for it.

---

## 9. What a productionised run must stamp

Beyond the existing replication manifest:

| field | why |
|---|---|
| `strategyId` + card `contentHash` | rule order is semantic; a reorder is a different strategy (§3.2) |
| `encoding` | `MARGINAL` vs `ORDERED`/`TILT` is the difference between the publication and a hybrid (§4.2) |
| `sourceRef` | an unattributed number defeats the purpose of the axis |
| `fallback` + `coveredShare` | the abstention ruling is what the number means (§5) |
| `residualMassShare` + `ruleFires` | how much of the answer came from the part nobody designed |
| `realisedMarginal` (per facing class) | the declared-vs-realised frequency check (§4.3) |
| `discordantN` | the honest denominator of the paired delta (§5.1) |

And the standing rule from `CLAUDE.md`: every Result Card stamps
`manifest.disclaimerRegisterVersion`. The top-ranked register entry applies with full force here —
the corpus is **online 2009** and the founder's game is **live 9-handed 1/2–1/3**, so a published
strategy scored well or badly on this corpus is scored on a *transferred* population, and any live
claim built on it must say so.
