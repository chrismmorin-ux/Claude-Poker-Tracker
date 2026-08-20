# Inferring a villain's strategy, and writing it in words a villain would use

**Date:** 2026-08-17 · **Program:** `prog-domain-correctness` / `prog-strategy-of-record`
**Source:** founder conversation, 2026-08-17 (four turns) · **Status:** design record, nothing built yet
**Queue:** WS-526 … WS-533

> **BINDING CAVEAT.** Every measured figure below comes from HandHQ **online cash, July 2009,
> 50NL** (SRC-011). The founder's game is **live 9-handed 1/2–1/3**. Per the top-ranked
> Suspected-Fault Register entry, any live claim anchored on these numbers is **transferred,
> not measured**. Games match by metric vector, never by stake level.

---

## §1 The ask

Founder, across four turns:

> *"What, with extremely high confidence, is the villain's model expressed in terms a villain
> could understand."*
>
> *"I want their thoughts which form their implicit rules in their head… derive a 98% accurate
> set of rules the villain follows for various situations."*
>
> *"If we nail this, we can simulate individuals much more easily, and I think forcing it into
> these words will yield more commonalities in the dataset when many villains are compared to
> each other in this way."*
>
> *"The greater the hero can know the villain… that's a measurable drillable thing."*

Four distinct deliverables, and they are not the same object:

| # | Deliverable | Surface kind |
|---|---|---|
| D1 | A fitted per-villain policy π(a \| s, h) | `Read` |
| D2 | That policy written as an enclosed warranted rule set | `Declared` — a **Strategy Card** |
| D3 | A generative simulator of that villain | sampling from D1/D2 |
| D4 | A drill score for how well hero knows a villain | new surface, Gate 1 required |

> **WHAT EXISTS TODAY IS D2 FOR THE *FIELD*, NOT FOR A VILLAIN.**
> [FIELD-STRATEGY-CARD-50NL-ONLINE-2009.md](../standard-of-record/FIELD-STRATEGY-CARD-50NL-ONLINE-2009.md)
> is 350 players summed into twelve cells — `counts4[vAction][cls]++`, no player key anywhere —
> at **10.7 (PS) / 16.4 (FTP) showdown decisions per player**, and blended across both strata.
> No player in the corpus is described by it. **A per-villain card cannot be authored today**;
> that is what WS-527 exists to make possible. Any document claiming to describe one villain
> right now would be the Field card wearing a name.

**The vocabulary already exists.** A "set of rules the villain follows" is a **Strategy Card**
in this repo's register — *a declared, enclosed, warranted rule set*. Its rules carry
**Warrants** (`equity` \| `structure` \| `read` \| `fear`) and it needs a **Residual clause**
for states its named rules do not reach. The group level is a **Stratum**, never a named
archetype. None of these are being coined here.

---

## §2 What already exists

Verified by direct read, 2026-08-17.

| Piece | File | Gives |
|---|---|---|
| Pool policy π(a\|s) | `scripts/backtest/behaviorPolicy.mjs` | Field behaviour at a node given public state. Shrinkage hierarchy, leakage-guarded, **includes folds**. |
| Hand-conditional table | `scripts/backtest/teachableArmsProbe.mjs:193` | P(action \| hand class) — 12 numbers. The D2 *shape*, but **pooled over 350 players**. |
| Range calibration | `scripts/backtest/rangeCalibrationProbe.mjs` | Coverage / lift of an inferred range against the revealed holding. |
| Separability + power | `scripts/backtest/separability.mjs` | χ²/df vs a same-run control, split-half reliability, attenuation, power stated. |
| Hole Map | `scripts/backtest/holeMap.mjs` | Price of branches the field leaves untaken. |
| Pool Best Response | `scripts/backtest/poolBestResponse.mjs` | The upper pier post — how much was available at all. |
| Synthetic villains | `src/utils/anchorLibrary/__sim__/syntheticVillains.js` | 4 hand-authored known-ground-truth policies + `anchorScenarioRunner.js`. |
| Corpus | `src/utils/exploitEngine/handhqReferencePool.js` | 12,927,164 hands, 7 stake bands, reproduction verified (WS-492). |

This is not a greenfield project. The instrument mostly exists and has run.

---

## §3 Three measured facts. One supports the plan; two contradict it.

### 3.1 Villains are stationary — the premise holds

`docs/research/player-archetypes-empirical-2026-07-26.md`, Finding 7: **95% of players are
stationary over 23 days.** Non-stationary 6.1% / 5.1% by site; among changers, gradual drift
beats step-change ~3:1.

"A stable set of implicit rules in the villain's head" is therefore a well-posed object, not a
metaphor. If players churned, D1–D4 would all be ill-posed.

### 3.2 Per-villain personalisation has been tried twice and made predictions WORSE

| Attempt | Card | Result |
|---|---|---|
| Per-player range width | `per-player-width-2026-08-05.result-card.json` | **−0.025 nats/decision**, CI [−0.042, −0.008]. Chosen shrinkage `k = Infinity` — i.e. *ignore the player*. `heldoutPlayersMovedOffPopulation: 0`. |
| Per-villain style seed | `ws436-style-collapse-2026-08-12.result-card.json` | **−0.0069 nats, t = −5.64**, recorded `REFUTED`. |

Both lost. This is relayed first, not last, because it is the strongest evidence against the
naive form of the ask.

### 3.3 Forcing villains into shared words has been tried once, and the words destroyed commonality

`player-archetypes-empirical-2026-07-26.md`, k-means over six canonical stats, 1,390 players:

- **Silhouette 0.3428 at k=2**, twice as good as any other k; inertia falls with no elbow. A
  continuum with one dominant axis (looseness + stickiness), not discrete types.
- Cross-tabbed against the six authored `classifyStyle` archetypes: **cluster purity 0.63 and
  0.44**. TAG is 54% of the pool and spans *both* clusters. **21% fall through all six buckets
  as `Unknown`.** The natural loose group is **shattered across four labels** (Fish 44%, TAG
  22%, Unknown 20%, LAG 14%) — four different `STYLE_PRIORS` applied to players the data says
  behave alike.
- `Fish = vpip > 40` cuts through the densest part of the group it means to isolate; the loose
  centroid is **40.5%**.
- **c-bet frequency carries almost no type information**: 57.0% vs 56.7% across the two poles.

So the last attempt to express villains in a shared vocabulary made them *less* comparable.

---

## §4 The diagnosis: all three failures share one cause

From the per-player-width card's own metrics:

```
medianRevealedPerPlayer: 13
foldRevealRate:           0
playersUnderpoweredCannotTell: 62  of 91  (68.1%)
```

And its own admissibility warning: *"A null over this population is a **weak-power null**, not
proof that width is not a property of a player."*

**Median thirteen revealed decisions per villain. Folds reveal at exactly 0.0%.** Two thirds of
players carried evidence too thin to resolve even a population-sized effect.

`teachableArmsProbe.mjs:161` requires `hand.gameState.showdownCards[vSeat]`, and its action set
is `ACTIONS4 = ['raise','call','check','bet']` — **there is no fold**. So the existing
hand-conditional table is:

> P(action | class, **the hand reached showdown**)

Reaching showdown is downstream of the action taken. It is a collider. Conditioning on it
deletes exactly the cases where the action worked — a bluff that takes the pot is never shown.
The repo already knows the mechanism (`mine-rare-act-inference.py`: *"a bluff that works is
never shown"*) but files it as a caveat rather than the defect.

**More corpus does not fix this.** 12.9M hands makes the biased number tighter, not truer.

§3.3 has a second cause on top of the first, and it is the one that rescues the founder's
intuition: the six archetype thresholds were **authored, never derived** — the document says so
in those words, and its first design constraint for follow-on work is *"Do not use the six
authored archetypes as the group level."* The founder proposes to **derive** the vocabulary from
per-hand behaviour. That is the opposite procedure, and it is untested rather than refuted.

---

## §5 Architecture

### 5.1 The rules must parameterise the generative fit, not describe it

A discriminative rule set — induce candidate rules, compile to predicates, score them — predicts
actions but does not compose into a coherent policy across a whole hand. **You cannot simulate
from it** (D3), and two separately-fitted objects drift apart.

The EM formulation is a likelihood over whole hand histories and is therefore generative by
construction. So: **fit the EM directly in the rule basis.** One object then serves D1, D2 and
D3 — the text you read, the predictor you score, and the villain you simulate.

*(This corrects the discriminative architecture proposed earlier in the same conversation. The
correction was forced by the founder raising simulation.)*

### 5.2 Identifiability — why the fold branch is recoverable

- **P(h) at the root is exactly known** — combinatorics, not estimated.
- **Folded hands are not missing action data.** The full action sequence and board are observed
  for every hand. Only the holding is hidden.
- **Range conservation.** At each node the branch ranges partition the parent range. The parent
  is exact at the root; showdown observes the composition of the *continuing* branches;
  the folding branch is identified by subtraction, forward through the tree.
- **The constraint is already measured.** `behaviorPolicy.mjs` supplies unbiased P(fold | s) from
  all hands. That is a hard equality constraint on the latent fit and the anchor against drift.

Estimator: EM over hand histories. E-step — posterior over each seat's holding given the observed
sequence under the current policy. M-step — re-estimate π from posterior-weighted counts.
Showdowns enter as observed h and anchor the fixed point.

**This argument is unchecked reasoning and is the project's central risk.** WS-526 exists to
settle it before WS-527 is funded.

### 5.3 Legibility cost is a Divergence, and it is already partly measured

The fit is a `Read` surface. The rule-set expression of it is a `Declared` surface. **The cost of
forcing the model into words is the divergence `d` between them** — computed through
`src/utils/standardOfRecord/divergence.js`, the one comparison path ADR-009 permits, with a
pre-registration naming `kl` or `ev-difference` as primary before the run.

This is the measurable form of the founder's *"it could be that villain's decision model takes a
different shape than what we build, that would be a legitimate learning."* A large `d` is not a
failure; it is the finding that the rule vocabulary is the wrong shape.

**A first rung already exists.** From `docs/standard-of-record/data/teachable-arms-{ps,ftp}.json`,
Δlog P(true holding) vs uniform, one narrowing step, showdown-revealed decisions:

| Arm | PS (n=3,703) | FTP (n=5,403) |
|---|---|---|
| A0 no narrowing | 0.5445 | 0.6976 |
| A2 legacy 20-number table | 0.5975 | 0.7500 |
| A3 measured 12-number table | 0.6147 | 0.7596 |
| A4 A3 + check position (15 numbers) | 0.6179 | 0.7624 |
| **A1 engine, as shipped** | **0.6762** | **0.8105** |

The 12-number human-memorable table recovers **53.3%** (PS) and **54.9%** (FTP) of the engine's
gain over no narrowing. **So the measured legibility cost today is ≈46% of the narrowing
signal**, and A4's extra three numbers buy ~0.003 nats — nearly nothing.

That is the number the rule-basis work has to beat, and it is the first rung of the legibility
ladder proposed in WS-529.

### 5.4 On "98%"

98% action prediction is attainable exactly to the extent the villain plays **purely**. A villain
genuinely mixing 60/40 in a spot caps any rule set at 60% there. That is an entropy ceiling, not
a modelling failure.

So the instrument reports **two numbers per villain per situation class: achieved accuracy and
the estimated ceiling.** Where achieved ≈ ceiling the rule set is complete; where it is far below,
there is more rule to find.

And the ceiling is the product: **a villain you can predict at 98% is a villain you can counter
almost perfectly.** 98% becomes a per-villain readout identifying which seat is worth attention,
not a pass/fail target.

**Current scoreboard.** Shipped villain-action prediction is measured at **log-loss 0.757**
(`shippedLogLoss`, WS-436, n = 10,147). A calibrated model right 98% of the time over a 3–4
action set scores ≈0.12. *(That conversion is arithmetic on the definition of cross-entropy, not
a measured figure.)*

### 5.5 The rule basis reconciles with dials-not-switches

`latent-class-behaviors.py` tested discrete-vs-continuous properly (mixture models on counts,
BIC) and found **8 of 9 behaviours are dials, not switches** (only `triple_barrel` picked the
switch model, by a BIC margin of 2 — a tie).

A rule splits into two parts living in different bases:

- **Predicate** — *"folds to a turn barrel on a paired board after calling the flop."* Discrete,
  shared across villains. **This is where commonality can live.**
- **Threshold / frequency** — how often, at what price. Continuous, per-villain. **This is the
  dial.**

The dial finding constrains the *parameter*, not the *predicate*. So villains are compared on
**which predicates are load-bearing for them**, not on their rates — a basis nothing here has
tried, consistent with everything measured.

---

## §6 Pre-registered falsifiers

> **F1 RESOLVED 2026-08-17 — PASS.** Max fold-branch error **0.00309** at N = 2,000,000 against a
> pre-registered tolerance of 0.02, and **1.6 × 10⁻¹⁰** at zero sampling noise, with 74.09% of
> hands never revealing a holding. §5.2's identifiability argument survived every control.
> **A boundary was found that §5.2 did not anticipate: identification requires hand-class
> MIGRATION across streets.** With no migration the fold branch is not identified at any sample
> size. WS-527 is therefore bound to measure the corpus transition matrix and compute the
> smallest Hessian eigenvalue BEFORE fitting.
> Full record: [ws526-fold-branch-identifiability-2026-08-17.md](ws526-fold-branch-identifiability-2026-08-17.md).


Declared before any run. Recording an unhedged failure is the point.

| ID | Claim under test | Falsifier | Kills |
|---|---|---|---|
| **F1** | The latent-holding EM recovers a policy including its fold branch | Self-play a known rule-based villain, fit EM on the synthetic histories. If the fold branch is not recovered within stated tolerance, it is **not identified** from action data alone. | WS-527 as designed; forces a showdown-independent channel (sizing, timing). |
| **F2** | Per-villain modelling failed from starvation, not from villains being unmodellable | Re-run both §3.2 refutations on EM-recovered holdings at hundreds of decisions/villain. If they still lose, per-villain modelling is **dead** and the population is the answer. | The whole per-villain program. Record unhedged. |
| **F3** | Cross-villain commonality in the rule basis is real, not an artifact of the vocabulary | **Permutation control** — shuffle hands among fake villains, run the identical induction. If fake villains show the same commonality, it is a projection artifact. | WS-530's premise. |
| **F4** | A rule basis beats the rate basis at surfacing structure | Derived-stratum partition must beat both the 6 authored archetypes and the k=2 rate clustering on held-out villain-action log-loss. | WS-531. |
| **F5** | Legibility is affordable | Rule-basis Δlog must exceed **A3's 53–55% recovery** of the engine's narrowing gain (§5.3). | WS-529's reason to exist. |

**F3 is the one most likely to be skipped and most likely to produce a false success.** A fixed
vocabulary guarantees commonality by construction — the same circularity `separability.mjs` was
built to prevent. It must be declared before the first induction run, not after a promising one.

---

## §7 The payoff already counted

**1,716 of 10,147 scored decisions — 17% — currently fall all the way back to the global pool
prior**, the worst predictor in the ladder at **log-loss 0.909**. A derived Stratum level is
exactly the rung that catches them. That is not a projected benefit; it is a hole someone already
counted.

Second payoff: **the simulator answers the sample-size question without live data.** Simulate a
known villain, feed the inference N hands, watch convergence. That yields the
hands-to-identify curve per situation class — previously flagged as unanswerable from this repo
because it appeared to depend on live data the founder holds and this analysis cannot see.

---

## §8 What is NOT resolved

1. **How many hands exist on any single real live villain.** Decides whether this ships at the
   table or stays a corpus instrument. Not answerable from the repo — the data is in IndexedDB on
   device. WS-533 measures it.
2. **`teachable-arms-{ps,ftp}.json` has no committed Result Card.** The files carry `arms`,
   tables and counts but no card, so §5.3's figures have no replication manifest. WS-532.
3. **The live/online transfer** is unmeasured throughout. Closing it needs a metric-vector match
   between a corpus slice and observed live-table stats, using the app's own recorded hands.
4. **D4 (the drill surface)** has had no Gate 1. It is a new surface targeting a
   possibly-underserved persona, so `docs/design/LIFECYCLE.md` Gates 1 and 4 bind before any
   production code.

---

## §9 Provenance of this document

Written by Claude, 2026-08-17, from direct reads of the cited files in a single session. The file
paths, line references and metric values above were read, not recalled.

**Named contamination:** §5.2's identifiability argument is the author's own reasoning and was
**not independently checked**. It is plausible partly because it explains three separate failures
with one cause — which is the shape of a story that fits too well. F1 settles it cheaply, and
nothing downstream should be funded before it does.
