# The villain rule ladder — one rule at a time, from nothing to a model

**Date:** 2026-08-17 · **Ticket:** WS-536 · **Program:** `prog-strategy-of-record`
**Status:** ladder RUN at n=2,126 (§3ter). **Two rungs resolve; the SPR rung is a null.**
Throughput fixed (WS-540, 12.7x). Levels still unresolved — ~410k decisions would close them.

> **BINDING CAVEAT.** Corpus is HandHQ online cash, July 2009, 50NL. Founder's game is live
> 9-handed 1/2–1/3. Every figure here is **transferred, not measured**, for that game.

---

## §1 What the ladder is, and what "EV" means on it

> ### FOUNDER RULING, 2026-08-18 — THE TARGET IS MATCH, NOT MAXIMISE
>
> *"right now you're right, the goal is to play like a villain and document and learn and how
> losing of a player are they and study the surface of our most common villain and how it makes
> decisions."*
>
> Maximising EV against the field — the optimally exploitative strategy — is explicitly LATER.
>
> **This inverts the scoreboard.** `edgeBB` is already the right instrument, read the other way:
> `edgeBB = wisValue(ours) − poolValue(field)`, and a rule set behaving exactly like the field
> carries weight 1 at every decision, so `wisValue = poolValue` and **the edge is exactly zero**.
> That is arithmetic from `ipsEstimator.mjs:248-315`, not an estimate.
>
> So the headline becomes **`matchErrorBB = |ruleSetEdgeBB − targetEdgeBB|`, MINIMISED**.
> A rung that beats the field is a WORSE villain model, not a better one.
> Registered as `metrics.villain-model-card.evFidelity` (schema v2, 2026-08-18).
>
> Two things follow and are filed: the target has to be measured (**WS-541** — how losing IS the
> pool, in bb/100 hands over hands DEALT, raked and unraked), and it has to be measured for the
> right population (**WS-542** — the 76.7% tight/foldy pole, not the blend that describes nobody).


The rungs below are a **villain model** — a rule set intended to reproduce how a player in this
pool actually behaves. It is scored two ways, and both are required:

1. **Behavioural coverage** — does the rule set predict what the villain *does*?
2. **EV coverage** — does an agent playing these rules in this pool *earn what the villain earns*?

**The second is the stopping criterion the first cannot give you.** A rule set can hit 70%
action accuracy and still be a wildly different player, because the 30% it misses is where the
money is. When the model both predicts his actions and earns his winrate, it describes him.

Founder, 2026-08-17: *"The rules can be as complex or nuanced as they need to be to cover the
villain's behaviour and behave like they actually would, but simpler is likely going to be the
winner in most cases."* The frontier (`metrics.villain-model-card.frontier`) is what shows
whether that holds — best coverage achieved at each rule count.

---

## §2 The evidence hierarchy the rules must respect

Founder, 2026-08-17, corrected on one point (see the note):

| Tier | Evidence | Strength |
|---|---|---|
| **1 — Hard constraint** | Villain **showed down** hand H having taken action sequence A | A rule set assigning **zero** probability to this is **falsified**, not miscalibrated |
| **2 — Mixing evidence** | Same (situation, hand class) produced different actions | The rule must mix too; a pure rule here is refuted |
| **3 — Shape** | Aggregate frequencies over a class of spots | Constrains the shape without pinning any cell |

> **THE CORRECTION, recorded because the founder's version inverts it.** The founder wrote:
> *"Any given hand 'Villain folded XYZ hand in this situation' is a 100% stake in the ground."*
> **Folds reveal at exactly 0.0%.** If he folded, we never learn what he folded. The hard
> constraints run the other way — they are **showdowns**. The reasoning is right and the
> attachment point moves. `rangeCalibrationProbe.mjs` already states the tier-1 rule in these
> words: *"A model that assigns zero to an event that occurred is not miscalibrated, it is
> falsified. Everything else here is a matter of degree; that is a matter of kind."*

Induction is therefore **constraint satisfaction, then compression**: satisfy every tier-1
constraint, match tier-2 mixing, fit tier-3 frequencies — and among rule sets that do, take the
shortest.

---

## §3 Rung 0's floor, measured 2026-08-17

`run-strategy-arms.mjs`, 6 files / 14 players / 45 decisions, behaviour policy
`out/behavior-policy.json` (pool-train, poolPct 50, 12,191 observations, 400 players):

| Arm | edge (bb per hand-at-decision) | 95% interval | ESS |
|---|---|---|---|
| `always-fold` | **−1.9942** | [−7.1535, +2.2798] | 19.5 (43.3%) |
| `uniform` | +1.8880 | [−1.4410, +6.0459] | 12.4 (27.5%) |
| engine | +0.0622 | [−8.3279, +5.3362] | 6.6 (14.6%) |

**The sign is as predicted and the n cannot carry it.** Every interval spans zero.

**The n that resolves it**, scaling the half-width from this run:

| Target half-width | Decisions needed |
|---|---|
| ±0.25 bb | ≈ 16,000 |
| ±0.10 bb | ≈ 100,000 |

> ### ⚠ THE PARAGRAPH BELOW IS REFUTED. See §3bis.
> It is kept, not deleted, because it is the reasoning WS-536 and `run-rule-ladder.mjs` were
> built on, and a reader who found only the corrected version would re-derive it.

~~**The blocker is not the corpus, it is the engine arm.**~~ This run took 220 s for 45
decisions — ≈4.9 s/decision — and `run-strategy-arms.mjs`'s own header states strategy arms are
*"free — pure functions of the decision, no engine call. The whole cost of a run is the ENGINE
arm."* Under `FALLBACK_POOL` an uncovered decision falls back to the behaviour policy at weight
exactly 1 and needs no engine call. ~~**An engine-free ladder runner is the unlock.**~~

**What actually happened:** the engine-free runner was built, and measured **4.9 s/decision —
identical**. The engine was never the cost. The n figures in the table above are also
superseded: they were scaled from a CI half-width rather than from `mdeDetectBB`, and §3bis
gives the corrected range. Throughput is WS-540.

---

## §3bis FIRST LADDER RUN — built, run, and every rung UNRESOLVED

Five rungs authored (`scripts/backtest/ladder/rungs.card.js`), all validating through the real
Strategy Card loader with distinct content hashes. Engine-free runner
(`scripts/backtest/run-rule-ladder.mjs`). Two prototype runs, 2026-08-17.

Run 2 — 6 files / 12 players / 47 decisions:

| Rung | rules | edge (bb) | 95% CI | MDE | verdict |
|---|---|---|---|---|---|
| R0 entry-only | 1 | +4.99 | [−2.11, +9.83] | 7.03 | **UNRESOLVED** |
| R1 flat-continue | 2 | +4.73 | [−2.17, +8.01] | 5.87 | **UNRESOLVED** |
| R2 price-the-continue | 7 | +4.91 | [−2.05, +8.18] | 5.87 | **UNRESOLVED** |
| R3 respect-aggression | 8 | +5.53 | [−2.43, +8.99] | 6.71 | **UNRESOLVED** |
| R4 spr-gate | 11 | +5.27 | [−2.41, +8.49] | 6.35 | **UNRESOLVED** |

**Every rung's edge is smaller than the smallest effect the run could have detected.** These
are not small effects; they are unmeasured ones. The runner now prints the flag itself so the
misread is not available to a future reader. Coverage 86–94%, weights healthy (mean ≈ 1.0,
zero clipped) — this is sample starvation, not an estimator defect.

Paired deltas — what one rule bought — are better determined but still span zero:
R1→R0 −0.26 [−2.82, +0.84]; R2→R1 +0.17 [−0.10, +0.34]; R3→R2 +0.62 [−0.65, +1.10];
R4→R3 −0.26 [−0.67, +0.14].

### Two things that went wrong and were caught

**1. A vocabulary bug that would have produced a false finding.** R2 and R3 were first written
with `sBucket: 'small'` / `'large'`. `sizeBucketFor` emits `0-33 | 33-66 | 66-100 | 100-150 |
150+ | unknown`. Both rules would have **never fired**, R2 would have been identical to R1, and
the ladder would have reported *"pricing buys nothing"* — a direct answer to a founder
question, produced by a typo. The Strategy Card loader cannot catch this: it validates that an
axis is matchable, not that a value is one the axis takes. Now guarded by
`scripts/__tests__/ladderRungs.test.js`, which builds the enum **by calling** `sizeBucketFor`
rather than transcribing it.

**2. The engine-free premise was refuted by its own measurement.** §3 predicted that dropping
the engine arm would take the ladder from ~22 hours to minutes. Measured engine-free:
**420 s for 85 decisions — 4.9 s/decision, unchanged.** The cost is the per-player corpus walk
(≈4 scored decisions per player against ~200 hands read), not the engine call. The prediction
is left standing in the runner's header, corrected in place, so it is not silently re-derived.
Throughput is now WS-540 and it is the real blocker.

### The n, and why it cannot yet be stated precisely

Scaling each run's own `mdeDetectBB`: run 1 (n=85, MDE 20.12) implies ~550,000 decisions for
±0.25 bb; run 2 (n=47, MDE 5.87) implies ~26,000. **A 20× spread between two slices is itself
the finding** — at n < 100 the variance estimate is too unstable to size the real run from.

---

## §3ter LADDER v1 — n=2,126, first signal (and two corrections)

> **WHAT THIS INSTRUMENT ACTUALLY DOES, since it is easy to picture wrongly.** It is **not a
> simulation**: there are no simulated players and no table. `ipsEstimator.mjs:6` states the
> contract — *"Take our advice at THIS ONE decision, then the hand plays on as it actually
> did."* Real 2009 hands are walked; at each decision a real player made, the rung's action is
> compared to the observed one and the hand is weighted by
> `pi_ours(a_obs) / pi_pool(a_obs)`. **The opponents are the actual historical opponents in that
> actual hand.** If a rung would never take the observed action, the weight is 0 and the hand
> drops out.
>
> Three consequences, all from the same header: the **horizon is one decision** (*"It does NOT
> measure the value of playing our whole strategy"*); the estimate is **decision-weighted, not
> hand-weighted** (measured: reweighting by 1/k moved an edge 3.6878 → 1.1626, a factor of
> 3.17, because long hands are big-pot hands); and the **scored population is selected** — it
> requires the seat to have voluntarily reached postflop, which is why `valuePoolBB` is positive
> rather than ~0.

2026-08-18. 200 files / 500 players / **2,126 decisions**, 16 workers, 819 s
(**0.385 s/decision** — 12.7x the pre-WS-540 rate). ESS 794-851 (37-40%), coverage 98.3%.
`out/rule-ladder-v1.json`.

### What one rule bought — the paired deltas

| Rung | vs | delta (bb) | 95% CI | verdict |
|---|---|---|---|---|
| R1 flat-continue | R0 | +0.3968 | [−0.2109, +1.0357] | unresolved |
| **R2 price-the-continue** | R1 | **+0.1173** | **[+0.0048, +0.2394]** | **RESOLVED** |
| **R3 respect-aggression** | R2 | **+0.2317** | **[+0.0690, +0.4250]** | **RESOLVED** |
| R4 spr-gate | R3 | +0.0075 | [−0.0958, +0.1372] | **NULL** |

**Three findings, and the third was pre-registered as a finding rather than a tuning target.**

1. **The pool prices by bet size.** R2's split of a flat continue rate across five size buckets
   buys +0.117 bb, interval excluding zero. The founder's *"it might be that they do factor in
   SPR, or pot odds"* is **supported for price**.

2. **Respecting aggression is the largest resolved gain** (+0.232 bb). Consistent with the
   sharpest measured fact in the pool — a raise is 79.7% strong, 2.3% weak at showdown.

3. **The SPR gate, as encoded, buys nothing.** +0.0075 bb, CI [−0.096, +0.137], centred on
   zero. `sprBand` has been mined since WS-333 and this is the first time it has been asked to
   earn its place.

> ### RETRACTION, 2026-08-18 — the stronger version of finding 3 was wrong
>
> This section first read *"on this evidence this pool does not read stack-to-pot."*
> **That is withdrawn.** It is not supported by what was measured, and it is a much stronger
> claim than the run can carry.
>
> What was measured: ONE encoding (three bands on a single size bucket), in AGGREGATE, at
> n=2,126, on the BLENDED field, with an interval now known to be too narrow (see the caveat
> below). **An aggregate null over a mixture is the weakest possible evidence about a subset
> effect** — an axis mattering in 5% of situations, with opposite signs elsewhere, sums to
> zero and looks absent.
>
> Founder, 2026-08-18: *"There may be some small subset of actions where the villain considers
> SPR... The alternative is that villain NEVER, FOR ANY DECISION, EVER FACTORS IN SPR into his
> decision. That's a strong statement, especially when I observe villains looking at stack sizes
> and asking about it at the table."*
>
> The proxy possibility is sharper still: the villain may not compute SPR but may BIN stacks
> coarsely, in which case the axis is real and the parameterisation was wrong — which an
> aggregate test cannot distinguish from absence. Locating the axis is **WS-544**.

### The levels, read against the MATCH target

| Rung | edge (bb) | \|edge\| | MDE |
|---|---|---|---|
| R0 entry-only | −0.3126 | 0.3126 | 1.413 |
| **R1 flat-continue** | **+0.0842** | **0.0842** | 1.328 |
| R2 price-the-continue | +0.2014 | 0.2014 | 1.340 |
| R3 respect-aggression | +0.4331 | 0.4331 | 1.366 |
| R4 spr-gate | +0.4406 | 0.4406 | 1.389 |

Closest-to-field ordering: **R1 < R2 < R0 < R3 < R4**.

> **UNDER THE MATCH-NOT-MAXIMISE RULING, THE LADDER IS DRIFTING AWAY FROM THE VILLAIN.**
> Every added rule makes the model EARN MORE, and past R1 that means climbing above field
> level. As a hero strategy R3/R4 are the best rungs; **as a villain model they are the worst.**
> R1 — the crudest postflop rule in the ladder — sits nearest the field.

> ### THE INTERVALS ARE TOO NARROW — "RESOLVED" IS OVERSTATED
>
> `ipsEstimator.mjs`'s own header records a broken assumption:
> *"a hand belongs to exactly one scored player. That is false by construction — measured at
> **2.91 EVAL players per hand** — and the cluster bootstrap's independence assumption does not
> hold."*
>
> Every CI this harness has ever produced is too narrow by an unknown factor. **R2's lower bound
> is +0.0048 — essentially touching zero — so R2 is NOT safely resolved.** R3 (lower bound
> +0.0690) is more robust but affected by the same defect. The DIRECTION of both remains
> suggestive; the resolution claim does not stand until WS-543 quantifies how much wider the
> intervals get under a hand-level or session-level cluster.

**Two caveats that bound that reading, both binding.** First, every LEVEL is still unresolved
(\|edge\| < MDE ≈ 1.35), so the ordering above is within noise; what is resolved is the
*differences*, which chain — R3 is reliably ≈0.35 bb above R1 because both deltas between them
exclude zero. Second, the target here is the **blended field**, and the founder's target is the
76.7% pole (WS-542). Matching the blend is matching nobody.

**Also superseded: the ~+5 bb levels reported at n=47-85 were noise.** At n=2,126 every rung
sits within ±0.45 bb of the field. Nothing about the rungs changed between those runs.

### The n that resolves the levels

From this run's own `mdeDetectBB` (1.39 at n=2,126): **≈410,000 decisions for ±0.10 bb.** At the
post-WS-540 rate of 0.385 s/decision that is ~44 hours on this machine — a node1 job, and no
longer the impossibility it was at 4.9 s/decision.

---

## §4 The ladder

Each rung adds or splits exactly ONE rule. Every rung is scored on an identical decision set.
Rules key only on legal Strategy Card axes plus `handClass`.

### R0 — Entry only
> Play a declared preflop range. No postflop rules; the residual folds to any action.

Grounded in the measured tight pole: VPIP 19.9%, PFR 12.3%.
**Expect:** strongly negative EV, near-zero postflop behavioural coverage. This is the floor
§3 measured, and it is the reference every later rung is differenced against.

### R1 — Continue with made hands
> Facing a bet postflop, continue with `strong` or `medium`; fold `weak`.

**Expect:** EV rises, and the model **calls too often** — the founder's own prediction. Watch
`evCoverage` rise while `behavioralCoverage` on the fold branch stays poor.

### R2 — Price the fold *(first first-principles rule)*
> Replace R1's flat continue with a threshold: continue when equity ≥ the pot odds offered.

This is the repo's own doctrine applied to the model — *derive from equity, pot odds, SPR and
players remaining, never from a label*. **This rung tests whether the pool prices at all.** If
R2 does not beat R1, the pool is not pricing, and that is a finding about the pool.

### R3 — Value bet
> Bet `strong` for value; check otherwise.

Grounded: P(bet | strong) = 31.8% vs base rate 25.2% (PS, showdown-conditioned).

### R4 — Respect aggression
> Fold to a raise unless `strong`.

Grounded, and this is the sharpest measured number in the pool: a raise is **79.7% strong,
2.3% weak** — six bluff-raises in 3,762 decisions. This pool barely raises without it.

### R5 — SPR gate *(tests the founder's SPR hypothesis)*
> Continue threshold moves with SPR: wider at low SPR, tighter at high.

Founder, 2026-08-17: *"It might be that they do factor in SPR, or pot odds, and that is part of
their ruleset."* `behaviorPolicy.mjs` already mines `sprBand` as a geometry coordinate, so the
axis exists and has never been used in a rule. **If R5 buys nothing, the pool does not read SPR
and that is a real finding** — do not tune it until it does.

### R6 — Sizing response
> Fold frequency responds to bet-to-pot ratio.

Grounded: the fold-curve **shape** is fitted and hold-out validated (WS-283, n = 318,347); its
**level** is not (`POPULATION_FOLD_RATE = 0.45`, unfitted). So R6 may only claim shape.

### R7 — Split by stratum
> Tight pole and loose pole take different thresholds.

Grounded: fold-to-3bet 85.4% vs 66.4%, fold-to-c-bet 57.6% vs 49.2% across the two measured
poles (silhouette 0.343 at k=2). **The first rung that stops describing one average player.**

---

## §5 What each rung must report

Per `metrics.villain-model-card` (registered 2026-08-17):

- `ruleCount`, and the `frontier` row it contributes
- `behavioralCoverage` **with its `entropyCeiling`** — accuracy is unreadable without it
- `evCoverage.capturedShare`
- `residualShare` — a 3-rule card with a 90% residual is not a 3-rule model
- `coveredShare` — an arm covering 30% has a diluted edge by construction
- **Change ledger NET *and* GROSS** (WS-537, not yet built) — without GROSS, a rule that helps
  the flop and hurts the river by the same amount is indistinguishable from a rule that did
  nothing, which is precisely the ladder's method failing silently
- **Exemplar hands.** Founder, 2026-08-17: *"I should be able to see... examples of the real EV
  sources."* Aggregates are views over Decision Atoms, never the record, so every rung's EV
  must drill to the individual hands that produced it.

---

## §6 What the ladder cannot do yet

1. **Run at resolving n** — needs the engine-free runner (§3). Filed on WS-536.
2. **Price novel lines.** `holeMap.mjs` documents it: a line the pool rarely takes has
   π_pool ≈ 0, so the IPS weight explodes or caps at 20. Rules with no pool support must be
   priced through pot geometry, not IPS, and which path priced each rule must be stamped.
3. **Model an individual.** Every rung above is the FIELD or a stratum. Individuals need
   WS-527.
4. **Claim anything about the founder's live game.**

---

## §7 Provenance

Rung-0 figures produced 2026-08-17 by `run-strategy-arms.mjs` on a 6-file slice and written to
`out/ladder-rung0-smoke.json`. **No Result Card** — the runner refuses one for a truncated
prototype slice, correctly, and none of §3 is a comparative claim under ADR-009.

Pool figures cited in §4 come from `docs/standard-of-record/data/teachable-arms-ps.json` and
`docs/research/player-archetypes-empirical-2026-07-26.md`.
