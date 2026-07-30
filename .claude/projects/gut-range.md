# GUT Range — Charter

**Working name:** the **Grand Unified Theory range** (GUT). A single canonical, *derived* preflop strategy for the whole 9-handed tree, incrementally tuned against a scoring function.
**Started:** 2026-07-29. **Status:** charter draft — no tickets filed, no code moved.
**Nests under:** [Exploit Model — Architecture Charter](exploit-model-architecture.md). GUT is the **Model frame's** preflop producer. It does not replace the Reference or Field frames; it becomes the third leg that was previously missing at preflop.

**Owner intent (2026-07-29), verbatim:**
> *"These in reality are actual rates of the % of hands in that range performing that action, so the constants should be a derived number from the range… The early position fold rate should be high, maybe even .82 as recorded, but this number should not be a magic number. It comes from our preflop fold range combos, a calculatable number."*
>
> *"Sometimes a hand's equity determines if it's in a falling range (MDF says continue with top X% of range, fold bottom y%). Sometimes it is range specific, implying the number of combos of each hand that would fold or continue or raise or bluff."*
>
> *"Some hands preflop want to protect their equity, others want to realize it right away, others realize well on certain flops, others on different ones. And dominated options poke through when mandatory… A value-heavy 3-bet range should naturally see bluffs added… we usually don't want our good showdown value as a bluff because we risk getting raised off our equity. We have the tools to create our own preflop charts… call it our canonical Grand Unified Theory range, and incrementally tune it."*

---

## 0. One-paragraph thesis

An action frequency and the range that takes it are **the same fact stated twice**. Today `populationPriors.js` authors both, independently, and they disagree — by up to 12× in the places that cost the most. The fix is not to pick which side to author; it is to author **neither**. A hand's action is an EV comparison over fold equity, realized showdown equity, and domination cost, priced against the seats still to act. The frequency is then the combo-weighted measure of the hands that clear the line — an output. Run that comparison across all nine seats to a fixed point and every preflop constant in the engine falls out: the action frequencies, the faced-raise rates, the subclass splits, and the bluff selection. What remains authored is a handful of **pool-behaviour parameters**, fitted to measured data rather than asserted. Roughly forty hand-picked constants collapse to about four fitted ones — and four can be estimated from a few thousand observed hands, which is why this is worth building.

---

## 1. The defect this replaces — measured, not argued

Under the propensity reading of a grid (`grid[h] = P(action | h)` — POKER_THEORY §2.5.2, `bayesianUpdater.js:270`), the action frequency is forced by the law of total probability over a uniform deal:

```
P(action | position) = Σ_hands  P(action | hand) × combos(hand) / 1326
```

That is `comboWeightedMean` — a function `populationPriors.js:194` already contains, uses for the WS-302 support blend, and never compares against the declared constants.

Measured 2026-07-29 against the shipped module (λ = 0.8 and λ = 0, identical — the WS-302 blend is genuinely width-preserving):

| | fold | limp / coldCall | open / threeBet | **scenario sum** |
|---|---|---|---|---|
| **EARLY** no-raise | 0.83 → **0.516** | 0.05 → **0.318** (6.4×) | 0.12 → 0.164 | 0.998 |
| **MIDDLE** no-raise | 0.76 → **0.516** | 0.08 → **0.318** (4.0×) | 0.16 → 0.205 | 1.040 |
| **LATE** no-raise | 0.62 → **0.516** | 0.06 → **0.318** (5.3×) | 0.32 → 0.320 | **1.154** |
| **EARLY** vs raise | 0.82 → **0.516** | 0.12 → 0.250 | 0.06 → **0.010** (0.17×) | **0.777** |
| **LATE** vs raise | 0.62 → **0.516** | 0.26 → 0.351 | 0.12 → **0.015** (0.13×) | **0.883** |
| **SB** vs raise | 0.60 → 0.516 | 0.28 → 0.286 | 0.12 → **0.010** (0.09×) | **0.812** |

Three structural findings:

1. **The fold grid is 0.516 at every position — identical.** `case 'fold'` is `max(0, 1 − strength × 1.2)` with no position term. The entire positional fold story (0.83 early → 0.62 late) lives *only* in the scalar. The range says early and late players fold the same hands.
2. **The 3-bet grid holds 1.0–1.5% of combos while the scalar claims 6–12%.** Largest gap, most expensive spot.
3. **The scenario sums are not 1.0.** Facing a raise, 12–22% of the hand-mass takes no action at all; the no-raise tree at LATE *over*-counts by 15%. Nothing enforces a partition, because the three grids are built independently.

**How it costs EV.** `updateScenarioRanges` uses the scalar only as a denominator: `ratio = effectiveFreq / populationFreq`, then `grid × ratio`. At zero observations `ratio` is exactly 1, so the scalars are inert and the grid rules. The damage begins the moment a villain is observed — the ratio is measured against the wrong baseline. A villain 3-betting at exactly the declared population rate produces `ratio ≈ 1`, leaving the model believing their 3-bet range is the 1%-wide QQ+/AK grid. Hero treats a 6%-of-hands 3-bet as QQ+ and **over-folds**. That is the same failure mode WS-291 fixed one street later, and the reason this charter exists.

**Secondary:** `min(1.0, prior[i] × ratio)` is a hard clip. Driven to the declared frequency it eats 9–16% of the 3-bet width and 10–14% of the early-position fold width — a hard cut where WS-291's ratified lesson was a width-preserving logistic.

---

## 2. Both of the owner's mechanisms are the same equation, read from opposite ends

**Price-driven (the MDF case).** A bet size sets an indifference point; a combo continues if its equity beats the price offered. The size is known, so the threshold is *calculated*.

**Composition-driven (the combo-count case).** Each hand class carries an action distribution; the aggregate rate is `Σ combos(h) × P(action | h)`.

These are not alternatives. The threshold says **where the line is**; the composition says **how many combos fall on each side**. The frequency is the measure of the set of combos whose EV clears zero at the offered price — authored by neither. MDF ceases to be an input and becomes a consistency check on the *bettor's* side.

**Mixing falls out for free.** A hand is pure when its EV gap between two actions is large and mixes when it sits near indifference. "30% of KQs raises" is not a number anyone writes down; it is what a bounded-rationality choice rule does to a hand sitting on the line.

---

## 3. Preflop hand value is a 3-vector, not a scalar

| term | what it is | dominates for |
|---|---|---|
| **Fold equity** | what you win when they fold | protect-now hands — raise to deny |
| **Realized showdown equity** | equity × the fraction actually captured, flop-conditional | realize-cheaply hands — limp/call, multiway, dead money |
| **Domination cost** | equity lost *because you made a hand and it was second-best* | the hands that look fine on paper and bleed |

The owner's protect-vs-realize distinction is not two rules. It is one EV comparison in which different terms happen to dominate: AA raises because the deny term is huge; 76s wants in cheap and multiway because its realization term peaks with more callers and dead money. This falls out of the solve **provided the terms stay separate** — and today they do not. `EQUITY_VS_OPEN` collapses all three into a single number per cell.

---

## 4. Domination — why mean equity is the wrong ranking scalar

KJo carries respectable average equity against a tight range, and that average conceals a bimodal structure: crushed by AJ/KQ/AK, comfortable against 22–99. Realization is worst precisely in the branch where the hand *does* connect — top pair, money in, drawing to three outs. A mean cannot see this.

This is the strongest available argument that a correct ranking function is worth real money, and it sharpens WS-302's uncomfortable finding: the measurement there (hand-built chart shape worth ~0.01 nats) ranked support by **raw all-in equity**, which is blind to domination by construction. That result bounds what an *equity ramp* is worth. It does not bound what a *domination-aware* ranking is worth, and the two should not be conflated.

**The machinery already exists and is one step short.** `pokerCore/equityDecomposition.js` computes, per made-hand bucket, `hitRate` and `conditionalWin` — *"given I make top pair, how often does it win?"* That quantity **is** the domination measure. It is currently hand-vs-hand only. Extending it to hand-vs-range is the same build as the hand-vs-range equity gap in §8, one piece of work with two payoffs.

---

## 5. Bluffs are a residual — and against this pool, a larger one than balance implies

The count and the identity separate cleanly, and neither is authored.

**How many.** Given V value combos and a 3-bet size, each additional bluff requires villain to fold more often than `s / (s + pot)`. MDF sets that floor.

**But MDF is the balanced answer, and this is an exploit tool.** Where the pool over-folds facing a raise — and at 3-bet sizings it does — the profitable bluff count sits **above** the balanced one. A value-heavy range does not merely tolerate bluffs; it under-bluffs by default, and the measured fold rate says by how much. This is the single clearest place where the Field frame should overrule the Equilibrium frame, and it is exactly the Exploit-Model edge definition applied preflop.

**Which bluffs — an EV selection with an opportunity cost.** A candidate's bluff EV is fold equity + blocker value − (cost when called × how badly it realizes). A hand with genuine showdown value carries a high opportunity cost: it forfeits a profitable call *and* risks being raised off live equity. A5s wins that objective on all three terms — blocks AA/AK, holds little standalone call value, realizes acceptably when called. It emerges from the arithmetic; nobody puts it in a chart.

**The gap this exposes.** Blockers appear in `gameTreeEvaluator`, `foldEquityCalculator`, and `combinatorics` — all postflop. They are absent from `preflopFlopEV`, `preflopAdvisor`, `preflopFoldResolver`, and `populationPriors`. Without a preflop blocker term the selector cannot distinguish A5s from 65s, which is the one comparison bluff selection exists to make.

---

## 6. The solve

Per hand `h`, per seat, per state:

```
EV(fold)  = 0
EV(limp)  = realized equity vs the limpers' ranges, multiway, minus raise-behind risk
EV(open)  = P(all behind fold) × pot  +  Σ_j P(seat j continues) × called-branch EV
EV(3bet)  = P(raiser folds) × pot     +  called / 4-bet branch
P(a | h)  = softmax( (EV_a + b_a) / τ )
```

Every right-hand quantity is equity, pot odds, SPR, rake, and **how many seats are still to act** — the §7.1 inputs. Position never appears as a lookup key; it appears as *"five seats behind me"* and *"I have one blind posted."* Position labels become outputs, satisfying §7.2 by construction rather than by discipline.

Then **iterate all nine seats to a fixed point**, because each seat's opening range depends on the defending ranges behind it and those depend back on it.

**What falls out, unauthored:**

- `NO_RAISE_FREQUENCIES` / `FACED_RAISE_FREQUENCIES` — combo-weighted widths, **summing to 1.0 by construction** because the softmax normalises per hand. The 0.777 and 1.154 sums become structurally impossible.
- `FACED_RAISE_RATE` — how often a raise appears in front, read off the tree, with correlation handled structurally instead of by multiplying independent probabilities.
- `SUBCLASS_SPLIT` — cold3Bet / squeeze / limpReraise is simply how often each state arises × what the hand does there. All 25 numbers vanish.
- Bluff counts and bluff identities, per §5.

**What stays authored — and why it must.** A pure best-response fixed point converges toward equilibrium, and these priors are explicitly **not** GTO; they model a specific pool. The deviation is parameterised: `τ` (how sharply this pool selects the best action) plus a small per-action bias vector (`b_limp > 0`, 3-bet aversion). These are **fitted, not asserted** — `handhqReferencePool.js` holds measured `vpip / pfr / threeBet / foldTo3Bet` with real k/n counts over 12,927,164 hands.

**The compression is the point:** ~40 authored constants → ~4 fitted parameters. Four are estimable from a few thousand observed live hands. Forty never will be.

### 6.1 Not every parameter transfers between pools — and the split is knowable in advance

v1 fits online (§10.1); live is the destination. The transfer is expected to be short, and **which parameters carry across is exactly what determines whether that expectation holds.** Sorting them now turns a hope into a testable claim:

| parameter | what it measures | transfers online → live? |
|---|---|---|
| **`τ`** — selection sharpness | how reliably the pool picks the highest-EV action | **Likely.** A rationality/noise parameter, not a strategy level. 12.9M hands pin it tightly. |
| **fold-side biases** | reluctance to continue without a made hand | **Partly.** Directionally similar, magnitude drifts. |
| **`b_limp`** — passivity bias | preference for entering cheap over raising | **No.** This *is* the live/online divide. 2009 online 6-max barely limped; live 1/2 limps constantly. |

The structure is one solve; only the parameter vector is segment-specific. That keeps the WS-263 rule intact **in substance**: HandHQ never supplies a live *strategy level* — it supplies structural parameters that observed live data overrides, in exactly the self-weighting pattern `poolBaseline.js` already implements. Note that `resolveReferenceCounts` today gives live segments **no** imported reference at all; nothing here changes that choke point.

**A convergence worth noting.** `b_limp` is the least transferable parameter, and `limp` is also the worst-calibrated constant in the shipped module today — 0.05 declared against a 0.318 grid width, 6.4× at EARLY (§1). The place where the online fit will help least is the place the current constants are already most wrong. That is an argument for building the structure, not against: a wrong parameter with a right structure is one number away from correct; forty wrong constants are not.

---

## 7. Placement in the three frames

| Frame | Preflop source today | After GUT |
|---|---|---|
| **Equilibrium (Reference)** | `PREFLOP_CHARTS` — *secondhand* solver output (PokerCoaching / TightPoker / RangeConverter), **RFI only** | unchanged; the RFI-only coverage gap becomes explicit |
| **Field (Reference)** | `handhqReferencePool.js` — 12.9M hands, measured, online 2009 | unchanged; additionally becomes the **fit target** for `τ` and biases |
| **Read / Model** | `populationPriors.js` — 40 founder estimates | **GUT** — derived, scored, incrementally tuned |

**A coverage fact worth stating plainly:** the imported GTO reference covers **opening ranges only**. There is no equilibrium anchor for 3-betting, cold-calling, squeezing, or blind defense. "Considered alongside GTO" therefore means *alongside GTO for opens, and against nothing for every other preflop decision* until a solve is ingested for those spots. Per the Exploit Model's GTO-coverage degradation rule, those spots fall back to Field-only at reduced confidence, flagged "no equilibrium anchor" — never silently guessed.

---

## 8. Inventory — verified 2026-07-29, not assumed

**Exists and is usable:**

- `pokerCore/preflopEquity.js` — exact hand-vs-hand all-in equity by C(48,5) enumeration, cached
- `pokerCore/equityDecomposition.js` — per-bucket `hitRate` / `conditionalWin` (the domination measure)
- `pokerCore/preflopEquityTable.js` — frozen 5 × 169 equity-vs-open lookup, plus its generator
- `exploitEngine/preflopFlopEV.js` — flop-conditional realization, 7 archetypes, rake-aware
- `exploitEngine/preflopFoldResolver.js` — per-seat, per-combo fold pricing via logistic (WS-274, done)
- `exploitEngine/handhqReferencePool.js` — measured pool aggregates with k/n
- `pokerCore/softWeights.js` — width-preserving logistic (WS-291), the primitive for turning a score into a range at a target width
- `scripts/backtest/rangeCalibrationProbe.mjs` — the scoring function (WS-293)

**Missing — the real build:**

1. **Hand-vs-range preflop equity.** `computeEquity`'s range branch throws `NotImplementedError` (`preflopEquity.js:508`). Only the frozen 5 × 169 table and the Monte Carlo inside its generator exist — ~8 minutes per pass at 20k trials, against *fixed* charts. A fixed point needs 10–30 passes against *changing* ranges, and needs the decomposed form (§4), not just a mean. **Everything else blocks on this.**
2. **Preflop blocker term.** Absent from the entire preflop path (§5).
3. **A tree terminal.** WS-270 (4-bet tree) is `backlog`, effort L. `EV(3bet)` needs a 4-bet branch or an explicit, documented truncation.
4. **Multiway called-branch EV.** `preflopFlopEV` models multiway as `villainFoldToBet *= 0.85^(n−1)` — a single scalar. Live 1/2 limped pots run 4–5 handed, and the limp branch is where it matters most. This is very likely why `limp` is the worst-calibrated constant today (0.05 declared vs 0.318 grid).

---

## 9. Falsification and the tuning discipline

**"Incrementally tune" degrades into taste within a month unless every step gets a number.**

The scoring function is the WS-293 calibration probe: identical revealed showdown hands, identical discrimination metric (mean log P of the hand actually held), three arms — GUT vs today's constants vs the imported charts. Re-run the sweep; do not re-reason it.

**Binding rules for this project:**

- GUT ships as a **generated, committed artifact** (`preflopSolvedPriors.js`), in the same pattern as `preflopEquityTable.js` and `handhqReferencePool.js`: inspectable, diffable, zero runtime solve cost.
- It **sits beside** `buildActionPrior` behind a flag until it beats it on the probe. If a derivation cannot beat forty hand-picked constants, that is a real result and we want to know it before removing anything.
- No tuning step without a probe delta. A change that does not move the metric did not happen.
- Every emitted number carries provenance per Exploit Model §1.5 — which parameters, which fit corpus, which solve revision.

**Named falsification test.** If GUT scores at or below today's constants on both sites after the fit converges, the hypothesis "preflop strategy is derivable at usable fidelity from the primitives in this repo" is refuted at this sample, and the honest outcome is to keep the constants and record why — the WS-285 / WS-291 / WS-302 precedent, applied to our own idea.

### 9.1 Tripwires on the online→live transfer

Owner direction (2026-07-29): the provenance risk is a **watch item, not a blocker** — *"keep this in mind in case our analysis dead ends or starts to produce bad results or restricts us."* Named triggers, so "dead end" is recognised rather than argued about:

1. **The structure fails on its own corpus.** GUT scores at or below today's constants on FTP *and* PS. → Refutation of the whole approach (§9), not a transfer problem. Stop; do not port to live.
2. **The structure holds online but the fit will not converge on live hands.** → Suspect §6.1: a parameter assumed transferable is not. Re-fit the full vector on live before concluding anything about the structure.
3. **`b_limp` fitted on live lands far outside the online estimate *and* the solve still scores well.** → Expected and healthy. This is the split working as designed, not a failure.
4. **GUT scores well online and poorly on live at any parameter setting.** → The most serious outcome: the *structure* is population-specific, not just the parameters. Live 9-handed multiway limped pots are the prime suspect (§8 gap 4), and that would promote multiway called-branch EV from a gap to a blocker.
5. **The approach starts restricting rather than enabling** — e.g. the solve cannot express a read the founder can see at the table. → Escalate; a derived range that cannot represent an observed truth is worse than the constants it replaced.

---

## 10. Open decisions — owner ratification required

1. ✅ **RESOLVED 2026-07-29 — v1 fits ONLINE (HandHQ).** Owner: *"online is the best source of data we have."* It is the only measured anchor at scale (12.9M hands), and it validates the machinery where a modelling bug can be distinguished from sampling noise. **Live is the destination, not the v1 target** — the same solve, re-fitted per §6.1, as founder-observed live hands accumulate.
2. ✅ **RESOLVED 2026-07-29 — the WS-263 provenance question is a logged watch item, not a gate.** Owner: *"keep this in mind in case our analysis dead ends or starts to produce bad results or restricts us. But for now it's the best data source we have. If we can model on it and get it right, then it's likely not a long jump to the correct answer."* Recorded reading: the **structure** is population-independent, the **parameters** are population-specific (§6.1). HandHQ never supplies a live strategy level; `resolveReferenceCounts` stays the choke point it is today. Tripwires in §9.1 define what "dead end" means before we are in one.
3. **How deep does the tree go in v1?** Recommendation: solve fold / limp / open / call / 3-bet; truncate at the 4-bet with a documented fixed continuation; let WS-270 replace it later. Solving the full 4-bet tree first turns an L into an XL.
4. **Does GUT eventually replace `buildActionPrior`, or stand permanently beside it as the Model frame?** Recommendation: defer. Decide on probe evidence, not now.
5. **Is a GTO solve for 3-bet / defense / squeeze spots worth ingesting** to close the §7 coverage gap, or does Field-only with a disclosed "no equilibrium anchor" suffice for v1? Recommendation: Field-only for v1; revisit once GUT has a score.

---

## 11. Build order

Sequenced by what blocks what, not by value.

| Phase | Work | Why here |
|---|---|---|
| **P0** | Hand-vs-range preflop equity, **decomposed** — `computeEquity` range branch returning the `equityDecomposition` bucket structure against an arbitrary 169-grid | Unlocks the ranking function, the domination cost, and the fixed-point iteration simultaneously. Nothing else can start. |
| **P1** | Preflop blocker term | Small, self-contained, gates bluff selection |
| **P2** | Single-seat EV comparison — the 3-vector of §3 against a *fixed* set of opposing ranges | Testable in isolation; produces a scoreable range before any fixed point exists |
| **P3** | The nine-seat fixed point + `τ`/bias fit to HandHQ | The solve proper |
| **P4** | Emit `preflopSolvedPriors.js`; score against the probe; flag-gated adoption | Falsification gate |
| **P5** | Retire `FACED_RAISE_RATE`, `NO_RAISE_FREQUENCIES`, `FACED_RAISE_FREQUENCIES`, `SUBCLASS_SPLIT` — *only if P4 passes* | The payoff |

P0 is the honest starting point and is a contained piece of work.

---

## Links

- [Exploit Model — Architecture Charter](exploit-model-architecture.md) — the spine GUT nests under
- `.claude/context/POKER_THEORY.md` §2 (preflop ranges), §2.5 (derived subclasses), §6.5a (fidelity hierarchy), §7.1–§7.4 (first-principles derivation, no labels as inputs)
- `src/utils/rangeEngine/populationPriors.js` — the module this replaces
- `docs/domain/theory-gaps.draft.md` — Tier E; GUT makes §2.1, §2.3, §2.5 doc edits mandatory
- Related queue: **WS-270** (4-bet tree, blocks P3 depth), **WS-279** (equity realization, feeds P2), **WS-254/255** (foldTo3Bet definition, affects the fit target), **WS-235 Step 2** (empirical grounding of the priors — GUT is the structural version of it)

## Change log

| Date | Change |
|---|---|
| 2026-07-29 | Charter drafted. Measured the frequency-vs-width incoherence in the shipped module; inventoried existing primitives and the four missing pieces; recorded five open decisions. No tickets filed, no code changed. |
| 2026-07-29 | Decisions 1 and 2 resolved by owner: **v1 fits online (HandHQ)**, live is the destination; the WS-263 provenance question is a watch item with named tripwires, not a gate. Added §6.1 (parameter transferability — `τ` transfers, `b_limp` does not) and §9.1 (five tripwires on the online→live transfer). Decisions 3–5 remain open and do not block P0. |
