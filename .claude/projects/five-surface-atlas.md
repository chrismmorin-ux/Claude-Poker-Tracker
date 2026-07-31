# Project — Five-Surface Atlas (FSA)

**Established** 2026-07-31 · **Programs** domain-correctness + data-provenance
**Nests under** `.claude/projects/exploit-model-architecture.md` (this is that charter's
triangulation, widened from three frames to five surfaces, with the comparison made numeric)
**Related** `model-readiness-and-curriculum.md` (C3), `projection-explorer.md` (Read calibration),
the un-chartered coverage-atlas ideation

---

## The founder's framing, kept

A strategy is a function from game state to action distribution. Over the space of game
states that function is a **surface**. We have several, and they are genuinely different
objects. The question is not "which is right" but **how much volume separates them, where,
and whether our divergence is earning or leaking.**

> *"Create a kind of volume measurement or difference between surface areas… How much did it
> hit it directly. Did the model experience friction and shift or concede or find a better
> arc? Create a driving measurement and optimal EV given expected rate of hand play and
> mostly full but sometimes 5, 6 players."*

---

## The reframe that makes it tractable

The five shapes are **not five frames.** They are **one Equilibrium, three Fields, and one
Read** — and noticing that is what turns a vague comparison into a measurement with a
purpose.

| Founder's shape | What it actually is | Source | Pool |
|---|---|---|---|
| GTO, brute-forced | **Equilibrium** frame | SRC-013 — *does not exist yet* | pool-independent |
| Mass data | **Field** frame | SRC-012 raw / SRC-011 aggregates | HandHQ, online, **2009**, 25NL–1000NL |
| Ignition capture | **Field** frame | SRC-005 | online, **current**, founder's stakes |
| User input | **Field** frame | SRC-014 | **live 1/3, Wind Creek** |
| Ours | **Read** frame | SRC-006/007/008 | whatever it was fitted to |

Three of the five are the *same kind of object measured on different populations*. That is
the whole game:

**Comparing the three Fields to each other IS the live-vs-online transfer question.** That
question is currently an open assumption blocking the interpretation of C3 — flagged on
WS-287 (*"a hero-EV edge is closer to a VALUE than a structure; the separation may genuinely
bind here"*) and again in registry SRC-012. Nobody has measured it because there was no
instrument that put two pools on the same axes.

This charter builds that instrument. **FSA is therefore not adjacent to the readiness gate —
it is how C3's central caveat gets resolved instead of restated.**

---

## The measurement

### 1. Volume, not surface area — frequency weighting is what makes it money

```
Divergence(A, B) = Σ over situations [ P(situation) × d(A, B | situation) ]
```

An expected divergence: literally a volume under a frequency-weighted surface, and — unlike
raw divergence — convertible to EV. The state space is astronomically large and wildly
non-uniform; a spot occurring once per 10,000 hands must not count the same as one that
arrives every orbit.

This is also where **"mostly full but sometimes 5, 6"** enters, cleanly. Table size changes
`P(situation)`, not the divergence function. Integrate under each table-size distribution and
weight by how often the founder sits in each game. The same machinery answers "what if I
played more short-handed?" without re-deriving anything.

**`P(situation)` must come from SRC-014 (live) for a live claim.** Borrowing the corpus's
situation distribution to weight a live claim would smuggle the online pool back in through
the weights after carefully excluding it from the surfaces.

**And `P(situation)` has a name now — it is POKER_THEORY §14's per-hand frequency.** The
founder arrived at the same object from the opposite direction (2026-07-31): make *hands at
the table* the common denominator so every quantity in the engine becomes events per 100
hands. That is exactly this weight. The decomposition §14.2 settles on —

```
events per 100 hands  =  opportunities per 100 hands  ×  rate | opportunity
```

— is structurally identical to this project's *frequency × divergence*, so **one instrument
serves both and it must be built once.** Phase 2 below is that instrument. Two independent
lines of reasoning landing on the same structure is the reason to trust it.

Carried limits, from §14.3, which bind here: the per-hand form gives the right unit for
variance but hands are **not** independent within a session, so cluster over sessions or
players and let hands be the unit inside the cluster. And any frequency inferred through an
unobserved-completion assumption (showdown scarcity being the standing case) is **modelled,
not measured**, and must be labelled so wherever it reaches a surface.

### 2. Friction / concede / better arc — a signed decomposition

Divergence from GTO is **not error**. For an exploitative engine it is the entire point. What
separates the founder's three words is the sign of EV against the measured pool:

| Case | Signature | Meaning |
|---|---|---|
| **Better arc** | ΔEV vs pool **> 0** | exploitation working — deviation is earning |
| **Concession / friction** | ΔEV vs pool **< 0** | real error, and now localized to a situation |
| **Unforced** | ΔEV vs pool ≈ 0 | arbitrary divergence — free exploitability, paid for nothing |

Every divergence carries a triple: **(ΔEV vs pool, ΔEV vs Equilibrium, exploitability cost)**.
The third is not decoration — see below.

### 3. Exploitability — the axis the readiness gate is missing

A maximally exploitative strategy is **maximally exploitable**; that is the trade it makes.
Nothing in the readiness gate's six criteria measures hero's own exposure, so as written the
gate can open on a strategy that prints against the pool and bleeds to the regulars.

Best-response EV against **our own** surface is a well-defined quantity and uses the same
machinery as the Equilibrium frame. The honest output is two numbers — EV against the pool as
measured, and EV against an adapting opponent — and **the gap between them is the risk
premium of playing max-exploit.** Against a 1/3 pool nobody computes a best response; the
exposure is the specific reg subset the founder named. That makes this a real quantity with a
real population attached, not a theoretical worry.

*Proposed as a seventh gate criterion. Adding one makes the gate stricter, so it does not
collide with "thresholds are not editable to open the gate" — but it is still a `/decide`.*

---

## The keystone, and what it costs

Charter §6 already names it: all frames must key off **one shared definition of a spot**, and
*"nothing triangulates until this exists."* Concrete state as of 2026-07-31:

```js
// decisionAccumulator.js:189 — the canonical key today
buildSituationKey = (street, texture, posCategory, isAgg, isIP, facingAction, contextAction)
  => `${street}:${texture}:${posCategory}:${isAgg}:${isIP}:${facingAction}:${contextAction}`
```

**It is a positional string, and it is parsed by ad-hoc `split(':')` in at least four
modules** — `villainDecisionModel.js:126`, `modelAudit.js:130`, `villainProfileBuilder.js:428`,
plus a `startsWith(st + ':')` prefix match at `villainDecisionModel.js:630`. Adding a
dimension silently breaks every positional reader. That is the failure mode this repo has
already recorded three times (WS-285, WS-291, WS-300): *a label asserting something the values
contradict, with nothing checking.*

**Four dimensions the keystone needs and the key does not have:**

| Missing | Why it is not optional |
|---|---|
| **SPR band** | Engine doctrine treats SPR as a first-principles decision input — *"afraid of getting stacked" is SPR, not a label.* A spot definition without it groups together decisions the engine itself says are different. |
| **Players remaining** | Not a count — WS-274's rule is that "who" beats "how many". Multiway already has a known gap (WS-277). |
| **Source / provenance** | The promoted registry's row-grain rule: source id must survive the join, or composition reporting and scope-leak detection are impossible. Charter §6 line 51 says the keystone carries provenance *through* the join. |
| **Pool identity** | Stake AND venue class. Without it the three Field surfaces cannot be told apart, which is the comparison this project exists to make. |

`HIERARCHY_ORDER = ['isAgg','isIP','texture','street','posCategory']` is a **measured** ordering
(WS-285) and must survive the migration as measured, not be re-reasoned during it.

**Precedent for the fix, already in the repo:** `scripts/backtest/decisionGeometry.mjs` —
*"Small on purpose, and shared on purpose… Deriving it three times would be three chances to
disagree about what 'the pot' means at a node."* Same argument, same shape of solution, one
scale up.

---

## Phases

| # | Phase | Exit condition |
|---|---|---|
| **1** | **Situation key unification.** One structured key (object, not positional string), one parser, all readers migrated. Add SPR band, players-remaining, source, pool. `HIERARCHY_ORDER` preserved as measured. | No module parses a key by `split`. A dimension can be added without touching a reader. Source id survives an aggregation. |
| **2** | **Per-hand frequency weights per pool (POKER_THEORY §14).** Build the one instrument that expresses any quantity as `opportunities per 100 hands × rate \| opportunity`. `P(situation)` for live 1/3 (9-handed and short) from SRC-014, and for each Field surface from its own source. | Weights exist per pool with sample sizes stated; live weights never borrowed from the corpus; every emitted rate carries its opportunity count; inferred-completion figures are stamped as modelled; variance claims name their cluster unit. |
| **3** | **The divergence instrument.** Two surfaces + a weight → the volume number, with per-situation decomposition. | Any two registered surfaces can be differenced and the result attributed to situations. |
| **4** | **Verdict + exploitability.** The signed triple per divergence; best-response EV against our own surface. | Friction / concede / better-arc is emitted per situation, not asserted. Hero's own exploitability has a number. |
| **5** | **Equilibrium ingestion (SRC-013).** Solver output as a real Reference source with solver identity, stack depth, rake model, spot coverage. | GTO comparisons stop being made against published chart strings. |

**Phases 1–4 do not need SRC-013.** Three Fields and one Read are four real surfaces, and the
live-vs-online question — the one actually blocking C3 — is answered entirely within them.
Sequencing GTO last is deliberate: it is the only phase gated on an external artifact.

---

## Standing constraints

- **Leakage is structural, not advisory.** SRC-011 and SRC-012 share an origin. Any comparison
  involving the Read surface must state its reference table and partition (WS-259 two-level
  split), or the number is inadmissible. A surface may never be scored against data it was
  fitted to.
- **Volume and relevance are different axes.** SRC-012 is high-volume/low-relevance; SRC-014 is
  low-volume/high-relevance. Collapsing them into one "quality" scalar hides the exact trade
  being made. Report both.
- **Labels are outputs, never inputs.** A situation key is a coordinate system, not a set of
  decision inputs. Adding `posCategory` to the key does not license `if (posCategory === 'EP')`
  anywhere.
- **Conditionals carry their conditioning set.** Showdown-derived surfaces are selected sets
  (SRC-002). `P(x | showdown)` is never a population rate.
- **Numbers, not pictures.** PJX's Gate 2 redirect already settled this: calibration needs
  numbers. 3D visualisation is a *reading* of the atlas, permitted only after the volume
  number exists and never as a substitute for it.

## What must not happen

- A "GTO shape" built on `PREFLOP_CHARTS`. Those are published chart strings with no solver
  version, stack depth, or coverage (Finding F3). That would be a second Field wearing an
  Equilibrium label.
- The keystone widened by adding an eighth `:`-delimited field. The positional string is the
  defect; extending it is the defect compounding.
- A single blended "master surface" averaging the three Fields. Their differences are the
  measurement, not noise to be smoothed away.
- Declaring transfer proved because the volumes look small. Small-and-measured and
  small-because-underpowered are different results — state the effective sample, per the
  hero-EV ESS lesson (35.7 effective from 250 nominal).

## Open questions

1. **Does `P(situation)` need hero's own strategy held fixed?** Hero's actions change which
   situations arise, so the frequency weight is partly endogenous. Probably resolved by
   weighting on *villain-facing* situations only — needs deciding before Phase 2.
2. **What is the divergence function `d`?** KL is natural for distributions but is not in EV
   units and is asymmetric. An EV-difference under the pool's own response model is directly
   meaningful but needs a response model per surface. Decide in Phase 3, measure both.
3. **Is live 1/3 one pool or several?** Day-of-week and time-of-day composition may matter more
   than stake. Cheap to test once Phase 2 exists.

## Log

- **2026-07-31** — Chartered. Follows the provenance promotion (registry + chain map live,
  `prog-data-provenance` installed), which supplied the row-grain rule Phase 1 depends on and
  the source ids this project's surfaces are named by.
