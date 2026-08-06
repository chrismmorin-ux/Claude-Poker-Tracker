# The Scored Readout — specification

> **Status:** SPEC, not yet implemented — established 2026-08-05
> **Governing decision:** [ADR-009](../adr/ADR-009-standard-of-record.md) · DEC-033
> **Programs:** `domain-correctness` (the figure) · `strategy-of-record` (the standard it resolves to)
> **Source:** founder directive 2026-08-05, recorded in
> `.claude/workstream/evidence/domain-correctness/run-domain-correctness-blindspot-2026-08-05/blindspot-2026-08-05.yaml`
> (`founder_redirect_2026_08_05`), plus the two binding amendments in §0.
> **Verified against:** HEAD `fe716f59`. Every file:line in this document was read, not recalled.

---

## 0. The directive and its two amendments

The founder asked for a standardized readout emitted by every scored run, carrying three reference
frames and six sections. A seventh view — the Hole Map (§9bis) — was added 2026-08-05 by a second
directive; it is a view over the SAME record, which is the property Rule 2 exists to buy. Two mid-design amendments reorder the whole document.

### Amendment 1 — EV is the universal unit

> *"This is good to see the changes as you displayed them, but everything should be tied closely
> to an EV change, measured by our standardized method."*

He said this about a **real, replicated, carded result** — the WS-378 river-omniscience fix,
`RC-river-flip-replicate-1c560bcc-fe716f59`, whose systematic advice-flip share fell 0.7111 →
0.2222 across 8 seeded replicates with a player-clustered CI. That card is honest and careful and
says of itself *"NOT an EV claim, NOT a winrate"*
(`scripts/backtest/run-river-flip-replicate.mjs:446-449`). It was still called insufficient, and
correctly:

**A flip count treats a marginal check/bet flip and a stack-off flip as the same event.** Only an
EV denomination distinguishes them.

> **RULE 1.** Flip counts, rate changes, χ²/df, log-loss, divergence in nats and per-claim shares
> are **DIAGNOSTICS**. The **claim** is the EV delta. A change reported without its EV delta under
> the standardized method is not a result. **The per-improvement delta outranks the absolute
> level** — this is an optimization loop, and the diff and the level have different requirements
> (§8.2).

This is a standing accept-criterion for every finding, ticket and fix in the repo, not a property
of this document. §8.6 specifies what makes it computable *in advance*, so that a fix whose effect
is indistinguishable from zero at achievable N is known to be so before the work is done.

### Amendment 2 — the record, not the readout, is the product

> *"The shape of the thing we spend hours computing on must be computed such that we can get
> extremely detailed information like this. This is feedback about the product of the standardized
> measuring."*

> **RULE 2.** A run that costs hours must persist a record whose **shape admits questions nobody
> asked when it was designed**. The aggregate is a **view** over that record, never the product of
> it. Re-analysis costs seconds. **If a new decomposition question requires re-running, the record
> was the wrong shape.**

This inverts the document. The six sections are **queries**, not outputs. If the six sections were
the design target, the record would be shaped to serve exactly those six and the seventh question
would cost a night. **§4 — the record — is therefore the centre of this spec**, and §§5-9 are the
six views over it.

---

## 1. The headline finding: most of this already exists

The most useful output of this design pass is that the standardized readout is **mostly an assembly
job over instruments that already run**, plus two genuinely missing schemas.

| Piece the founder asked for | Status at HEAD | Where |
|---|---|---|
| An EV edge of our play over the pool's | **EXISTS, runs, cards** | `ipsEstimator.mjs:189` `estimateEdge` |
| A paired EV delta between two configurations on an identical decision set | **EXISTS, runs, cards** | `depthAblationReport.mjs:203-268` `pairedDelta` |
| The identical-decision-set guarantee | **EXISTS, structural** | `heroEvRunner.mjs:234-251` |
| A decision-level record with "aggregates are views" doctrine | **EXISTS as schema + store** | `schemas.js:100-153`, `atomStore.mjs` |
| Append-only, streaming, gzipped, content-addressed atom storage | **EXISTS** | `atomStore.mjs:40-47` |
| Archetype separability with a control axis | **EXISTS, tested, carded** | `separability.mjs`, `.artifacts/study-ladder.card.json` |
| The pool's actual play as a scoreable surface | **EXISTS** | `behaviorPolicy.mjs` (π_pool) |
| The one-step ceiling (Pool Best Response) | **EXISTS** | `poolBestResponse.mjs:376` |
| Spot-level covariates on every scored decision | **CAPTURED, NEVER READ** | `heroEvRunner.mjs:292-300` |
| Teachable-rule transcription harness | **EXISTS, unwired to the standard** | `teachableArmsProbe.mjs` |
| Determinism under a frozen clock | **EXISTS in one runner** | `run-river-flip-replicate.mjs:83-87` |
| **A declared shape for what a run reports** | **DOES NOT EXIST** | `schemas.js:286` |
| **The hero-EV path emitting atoms at all** | **DOES NOT EXIST** | §4.2 |
| **The Equilibrium frame** | **DOES NOT EXIST, deliberately** | `equilibriumPost.mjs:54` |
| **Stable player identity on a decision row** | **DROPPED** | §4.3 |

**The Scored Readout is, precisely, two missing schemas: a declared `metrics` shape (the view) and
an extended Decision Atom (the record).** `RESULT_CARD_FIELDS` declares `metrics` as
`{ type: 'object', note: 'The figures themselves.' }` (`schemas.js:286`) and `resultCardProblems`
never inspects it (`resultCard.js:119-160`). Every producer therefore invents its own metrics
shape — the *exact* mechanism ADR-009 exists to prevent, reproduced one level down inside the
object built to stop it. Two cards on disk already disagree on the name of the same constant
(`REFINEMENT_BUDGET_MS_DEPTH1/DEPTH2` in `RC-depth-ablation.json` vs `..._FAST/_FULL` in
`RC-layer-divergence.json`).

---

## 2. The three frames — two exist, one does not

The founder's three frames are **not new nouns**. They are three of the four surface kinds already
registered in [VOCABULARY.md](VOCABULARY.md).

| Founder's frame | Surface kind | Status | Evidence |
|---|---|---|---|
| 1. Equilibrium statistical anchor | `Equilibrium` | **DOES NOT EXIST** | `equilibriumPost.mjs:54` — `EQUILIBRIUM_POST = null` |
| 2. Our developed optimal play | `Read` (engine) / `Declared` (a Strategy Card) | exists | `heroPolicy.mjs`, `strategyCard.js` |
| 3. The pool's actual play | `Field` | exists | `behaviorPolicy.mjs` — π_pool, mined POOL-only |

**Frame 1 must be reported as absent; the readout must not silently proceed as if it had three.**
`equilibriumPost.mjs:57-62` states the refusal verbatim: no solver artifact, no store, no schema,
and `PREFLOP_CHARTS` are published chart strings with no solver identity, stack depth, rake model
or spot coverage. Substitution is blocked by a **throw**, not a warning —
`refuseChartsAsEquilibrium` raises `EquilibriumSubstitutionError` (`equilibriumPost.mjs:100-116`,
thrown at `:110`) against a blacklist at `:72-79`.

Consequences the readout carries:

- **Exploitation premium is `null`.** `EV(PBR) − EV(Equilibrium)` is uncomputable
  (`equilibriumPost.mjs:137-145`). *"How much money exists specifically because the pool is bad"*
  is unanswerable today. Report the reason string, never a number.
- **What remains is a one-sided location.** The **upper** pier post — Pool Best Response — exists
  and runs (`poolBestResponse.mjs:376`, called per decision at `heroEvRunner.mjs:258-261`). A
  strategy can be located below the ceiling but not above the floor.
- The edge the founder defined — **frame 2 minus frame 3, priced in EV** — is the one fully
  measurable quantity of the three, and it is already what `estimateEdge` computes.

---

## 3. What the EV unit IS

### 3.1 The estimator that exists

`estimateEdge` (`ipsEstimator.mjs:189`) computes, by self-normalized importance sampling:

```
w_d  = π_ours(a_d | s_d) / π_pool(a_d | s_d)     weight, clipped at 20  (ipsEstimator.mjs:76-95)
V    = Σ(w_d · R_d) / Σ(w_d)                      WIS value             (:160-164)
edge = V(π_ours) − V(π_pool)                      the headline          (:224-227)
```

`R_d` is the hero seat's **realized net for the whole hand, in big blinds**
(`heroEvRunner.mjs:211-216`). Because π_pool *is* the mined behaviour policy, `V(π_pool)` reduces
to the plain sample mean of `R_d` — a free correctness check, asserted by test and enforced as an
admissibility blocker (`CONTROL_DRIFT`, `heroEvReport.mjs:135-141`, tolerance 1e-6 at `:91`).

Three properties must survive into the readout:

- **It is outcome-anchored, not self-graded.** `R_d` is realized chips, not the engine's own EV.
  That materially defuses `FAULT-self-grading-circularity` (register rank 6) *for this instrument*
  — worth stating, because most other numbers in the repo do not have it.
- **Frame-2-minus-frame-3 and the shipped arithmetic are the same object.**
- **Its CI clusters over players** (`ipsEstimator.mjs:134-157`), satisfying POKER_THEORY §14.3's
  binding rule that hands are never the cluster unit.

### 3.2 The unit trap already in the code

`R_d` is a **whole-hand** net attributed at the decision level; a hand with three scored decisions
contributes its net three times (`ipsEstimator.mjs:21-27`). So `edgeBB` is on the scale of hand
outcomes, and reading it as a winrate overstates it by roughly the decisions-per-hand factor.

> **A LANDMINE.** `ipsEstimator.mjs:253` emits `edgeBBPer100 = edge × 100` — a bare rescale with
> **no denominator change**, precisely the misreading the same file warns against forty lines
> earlier, pre-computed and waiting. It has **zero consumers today**. Deprecate it (additive-only:
> keep the field, mark it `deprecated`) before any readout exists that a reader might scan for a
> "per 100" figure. Cheapest item in this spec; worst failure mode.

### 3.3 The definition

**`overallEvBB100` — the additive per-decision edge budget, in big blinds per 100 hands, of our
play over the Field.**

```
overallEvBB100  =  edgeBB  ×  opportunitiesPerHand  ×  100

  edgeBB                estimateEdge(...).edgeBB — mean change in hand value from
                        substituting ONE decision
  opportunitiesPerHand  scorable decisions per hand, taken from the COVERAGE CENSUS over the
                        Deal Book — NOT from n/handsRepresented on the scored subset
```

- *Why not `edgeBB` alone?* Not comparable across runs — change `--max-decisions` or a street
  filter and it moves without the strategy changing. POKER_THEORY §14.1 makes hands-at-the-table
  the binding currency for exactly this reason.
- *Why the census and not the scored subset?* `n / handsRepresented` inherits every sampling limit
  of the harness. The census (`coverageCensus.js`) is the object that already distinguishes
  `observed-zero` from `unexamined` from `dropped` — precisely the distinction this term needs.
- *This is the §14.2 decomposition* — `events per 100 hands = opportunities per 100 hands × rate |
  opportunity`. **Both factors are printed separately and never only as their product**, because
  §14.2's stated purpose is to expose the change that improves the rate while shrinking the
  opportunities.
- A worked reference implementation of the dual denominator already exists in `evCost.mjs:237-260`
  (`bbPer100Decisions` beside `bbPer100Hands`, with `handsRepresented` as a distinct-handId count).
  It is applied to villain fold-prediction regret and has never been connected to hero-EV.

**What it does NOT capture — printed beside the number, every time.**

1. **Horizon is one decision.** `TREATMENT`: *"per-decision IPS · one-decision horizon · pool
   continuation · range-marginalized policy"* (`ipsEstimator.mjs:55`). Summing per-decision edges
   across a hand assumes **additivity** — no interaction between substituted decisions. That is
   `FAULT-horizon-bias` (rank 8) and it is the price of having one number. It is a *budget of value
   available across the decisions faced in 100 hands, priced one at a time*, not the value of
   playing the strategy.
2. **The Field does not adapt** (rank 4) — every figure flatters aggression.
3. **Rake is modelled**, not recorded (rank 3); the live/online gap is ~2x.
4. **Online 2009, transferred not measured** (rank 1, breadth 0.90).
5. **Range-marginalized** (rank 5) — the value of the advice averaged over hands hero could hold.

### 3.4 The companion figure

**Exploitation efficiency** exists (`strategyPosition.mjs:80-91`) and has the property the
optimization loop wants: **it does not move when the engine improves the raw number**, because both
pier posts are defined by the population. It is a **companion, not the headline**, because its
denominator `EV(PBR) − EV(Field)` is re-fit whenever the Field is re-mined — invariant to engine
change, *not* invariant to corpus change, the opposite failure mode from `edgeBB`. Report both;
optimize `overallEvBB100`; use efficiency to tell a better engine from a differently-mined pool.
`strategyPosition.mjs:114-138` **refuses a bare scalar by throwing** — keep that.

---

## 4. THE RECORD — the Decision Atom, and why it is the product

### 4.1 The noun already exists, and so does the doctrine

**`Decision Atom` is the right noun and it must be used rather than paralleled.** Its own docblock
states Rule 2 verbatim, seven weeks before the founder said it:

> `src/utils/standardOfRecord/schemas.js:101` — *"A DECISION ATOM — one row per decision.
> **Aggregates are VIEWS over atoms, never the record.**"*

The v2 block goes further (`schemas.js:131-134`):

> *"over-capture by design. Every field below ships with the **FUTURE QUESTION** it answers,
> because a field that cannot name its question is speculation rather than instrumentation.
> `atomsSelfCheck` enforces that each also ships with a **reader** — the discipline that stops this
> becoming the next predictionAudit (captured, never queried, rotted silently)."*

And the storage tier is built for it: `atomStore.mjs` is append-only, content-addressed, **outside
git**, NDJSON streamed through `createInterface`/`appendFile`, gzipped (`createGzip`), opened `'ax'`
so a second writer fails at open rather than interleaving, with `resolveAtomSet` returning an
explicit reason from a closed enum — `not-found | hash-mismatch | truncated | unreadable` — rather
than an empty array, *"a missing store and an empty run would then be the same value"*
(`atomStore.mjs:23-27`).

**`truncated` is a first-class resolve reason**, which is exactly the interrupted-run recovery
property Rule 2 asks for: a run killed halfway leaves valid individual rows and a store that
*declares itself* a biased subsample rather than silently reporting a confident headline.

### 4.2 The finding: two decision-level shapes that never meet

**The one fully-wired measurement instrument in the repo does not emit atoms.**

`run-hero-ev.mjs` → `heroEvReport.mjs` is the reference implementation — the only entry point with
a replication stamp, a pinned Deal Book, the leakage guard and a Result Card
(`BASELINE-2026-08-04.md`). It builds its **own private row shape**
(`heroEvRunner.mjs:263-301`): `playerId, handId, order, observedAction, netBB, netBBUnraked,
piOurs, evStats, piOursByArm, piPool, poolEvidenceN, piPbr, piPbrBySweep, slices`. That row is rich
in exactly the fields Rule 2 demands — and it is **never persisted**. It lives in memory, is
aggregated, and is discarded.

Meanwhile the Decision Atom — schema'd, versioned, hashed, stored, additive-guarded — has **one
production producer**, `scripts/backtest/layerAblation.mjs`, and carries none of the IPS quantities.

> **This is the WS-291 mechanism at the record level.** Two shapes for the same object, neither
> forced onto the other's axis. The rich one is ephemeral; the durable one is thin. Every hour
> spent on a hero-EV run today produces an aggregate and throws away the record.

**Recommendation: extend the Decision Atom to schema v3 (additive-only) and make `heroEvRunner`
emit atoms.** Not a new row type. The additive rule is already enforced by
`scripts/check-sor-additive.sh` against `schema-baseline.json`.

### 4.3 What the existing Atom is missing

Per Rule 2, each gap is stated with the question it forecloses.

| Missing | Forecloses | Evidence |
|---|---|---|
| **Stable player identity** (hero *and* villain) | all sub-archetype attribution; any archetype defined **after** the run | `actorSeat`/`actorRole` exist (`schemas.js:145,147`); no id. `layerAblation.mjs:383` hashes `{playerId, handId, order}` into a **one-way** `atomId` and discards the parts |
| **`handId`, `order`** | the cross-run join key (§9.4); hand-level clustering; the `handsRepresented` denominator | same one-way hash |
| **The IPS quartet — `piOurs`, `piPool`, `w_d`, `R_d` stored separately** | telling a big weight from a big outcome; re-deriving any arm's edge; re-weighting under a different cap | present only on the ephemeral hero-EV row |
| **Per-action EVs** | near-tie identification — the rows where a future improvement flips the decision | `alternativeScores` exists (`schemas.js:135`) but its only producer fills it with **action probabilities**, not EVs (`predictionAudit/atomize.js:73-84`) |
| **Achieved refinement depth** | diagnosing a run's own irreproducibility after the fact | `evStats.depthReachedMax` computed (`heroPolicy.mjs:368`), captured by one runner's private row (`run-river-flip-replicate.mjs:271`), no atom field |
| **`budgetBound`** — did the wall clock bind? | separating "depth-1 by request" from "depth-1 by machine load" | the gate at `gameTreeEvaluator.js:906-907` is not reported at all |
| **Raw per-player observation counts** | shrinkage against archetypes that do not exist yet | nowhere |
| **Top-level `street`** | the branch ledger's partition | bolted into `carried` as an **undeclared extra key** by `layerAblation.mjs:395`, legal only because `checkAgainstSchema` ignores unknown fields (`schemas.js:444-445`) |
| **`playersRemaining` as WHO** | multiway attribution | documented as *"WHO, not a count — resolve seats, do not tally"* (`situationKey.js:109`) and set **`null`** by every producer (`layerAblation.mjs:392`) |

### 4.4 The write-time rules

1. **Nothing is pre-aggregated at write time.** Raw over derived: derived can be recomputed, raw
   cannot be recovered. `estimateEdge` becomes a *query* over atoms rather than the only path to
   the number.
2. **`piOurs`, `piPool`, `w_d` and `R_d` are stored separately and never pre-multiplied.** A reader
   must be able to tell a large weight from a large outcome; `w_d · R_d` alone cannot. Store the
   **unclipped** weight and the cap as a constant, so a re-analysis can re-cap without a re-run.
3. **The full candidate action set with per-action EVs is retained, not just the argmax.** Near-ties
   are where a future improvement flips the decision, so they are the highest-value rows for any
   per-improvement delta. `alternativeScores`'s own note already says this — *"near-ties are where
   strategies differ and models are fragile"* — and its only producer does not honour it.
4. **Reproducibility forensics ride on the row**: achieved depth, `budgetBound`, `weightConsumed`,
   `wallTimeMs` (already a field, `schemas.js:149`), and `seeds` (already a field, `:143`).
5. **Identity and raw counts ride on the row.** This is the clearest case for Rule 2: **archetypes
   must prove separability before they get a channel, and that proof may not exist when the run
   happens.** A record carrying raw per-player observations lets archetypes be *defined afterwards
   and applied to runs already completed*. Without it, every new archetype hypothesis costs a
   full re-run — which is precisely the failure Rule 2 names.
6. **Every new field names its future question**, and `atomsSelfCheck` enforces that it also has a
   reader — the existing schema-diff mechanism (`atomsSelfCheck.mjs`), not discipline.

### 4.5 Storage cost, stated honestly

`atomStore.mjs:11-13` already sizes it: *"~1-2 KB each, ~4 decisions per hand, so 100k hands"*.
The additions above — per-action EVs, the IPS quartet, identity, forensics — are small scalars and
push the core row toward the top of that range. `beliefState` (a per-opponent range, `schemas.js:139`)
is the one genuinely heavy field and can be orders of magnitude larger.

**Proposed split, and it is already anticipated by the code:**

- **Tier A — the compact aggregate.** The Result Card plus Census: KB, in git, human-readable,
  greppable, diffable. `atomStore.mjs:8-10` is explicit that **the card is the anchor** and *"a card
  whose atoms are gone is still a valid anchor."*
- **Tier B — the streaming decision-level sidecar.** NDJSON + gzip, outside git, referenced by
  `atomSetHash` alone and never by path, so relocating the store cannot invalidate a card. Append-only
  and streamed, so an interrupted run yields valid rows and declares itself `truncated`.
- **Tier C — heavy fields under a sample rate.** `fullSampleRate` is **already an atom-set manifest
  field** (`atomsSelfCheck.mjs:37`), so partial capture of expensive fields is anticipated. Sample
  `beliefState`; never sample the core row, because a sampled core row cannot reconstruct an
  aggregate.

Order-of-magnitude: 100k hands × ~4 decisions × ~1.5 KB ≈ 600 MB raw, materially less gzipped.
That is a **local-first, disk-cheap, re-run-expensive** trade, and it is the right one when the
alternative is paying hours per question.

---

## 5. View 1 — Overall EV

The headline, defined in §3.3. As a query: `estimateEdge` over all atoms in the set, lifted by
`opportunitiesPerHand` from the census, with both factors printed.

**Prerequisites:** census-derived `opportunitiesPerHand`; `edgeBBPer100` deprecated.
**Today:** `edgeBB` + CI + arms table + PBR + admissibility + a Result Card via `run-hero-ev.mjs`.

---

## 6. View 2 — Performance by sub-archetype, and who leaks

This view carries the founder's most valuable hypothesis and the readout's largest honesty risk. It
is where a partition of noise would look most convincing.

### 6.1 A finding that contradicts part of the premise

The founder wrote *"I still think there are sub-archetypes, not every player plays the same."*
**He is right that players differ; the shape of the difference is not what "sub-archetypes"
implies.** Two measured results, both already in the repo:

- **k-means on 1,390 players over six canonical stats finds `bestK = 2`, silhouette 0.343 — twice
  as good as any other k, inertia falling smoothly with no elbow** (`out/player-clusters.json`;
  `docs/research/player-archetypes-empirical-2026-07-26.md:33-58`). That is the signature of a
  **continuum with one dominant axis** (looseness-and-stickiness together), not a set of discrete
  types. The authored six-label partition has cluster purity **0.63 and 0.44**; `TAG` is 54% of the
  pool and spans both poles; **21% of players fall through all six buckets** into `Unknown`.
- **The high-frequency behavioural axes DO separate, decisively** (`.artifacts/study-ladder.card.json`,
  1,070,493 hands, 59,848 player-site rows): limp rate SD **14.5pp**, reliability 0.83; c-bet rate
  SD 12.6pp, reliability 0.62; against a same-run control at SD 11.6pp. And c-betting is not
  aggression re-expressed — against the **disjoint** control r = 0.180.

**Design consequence: the readout reports STRATA on measured axes, not named archetypes.**
Quintiles of `limpRate`, of `cbetRate`, and of the looseness pole — each an interval on a measured
axis carrying its own separability evidence. Naming a stratum "Fish" would re-import the exact
threshold the data says cuts through the densest part of the group it means to isolate
(`classifyStyle`'s `vpip > 40` against a loose-cluster centroid of **40.5%**).

**`threeBetRate` must not get a channel** on this evidence: overdispersed (z = +81.2) but carrying
only **2.1pp** of between-player spread with split-half reliability **0.33** — the same magnitude
§11.8 assigned to the *non-separating* slowplay conditional. Significance is not size.

### 6.2 The separability evidence each stratum must carry

Non-negotiable, per the founder's standing ruling. All already computed by `separability.mjs`,
which is **pure, tested (26 `it()` blocks), and callable on any new axis today** given
`[{playerKey, k, n, bits}]` plus a common rate:

| Evidence | Function | Line |
|---|---|---|
| Overdispersion χ²/df and z | `overdispersion` | `separability.mjs:82` |
| Between-player SD (beta-binomial MoM) | inside `overdispersion` | `:120,:133` |
| Observations per player (median) | inside `overdispersion` | `:122-136` |
| Split-half reliability, Spearman-Brown | `splitHalfReliability` | `:232-254` |
| Cross-axis correlation, disattenuated | `crossAxisCorrelation` | `:265-294` |
| Three-way verdict | `separabilityVerdict` | `:450` |

Two properties are load-bearing:

- **The verdict is three-way.** `separates` requires z ≥ 3 (`:456`); `underpowered` fires when
  median observations per player < 30 (`:469`, `OBS_FOR_MOVEABLE_ESTIMATE` at `:53`);
  `does-not-separate` only otherwise. It **refuses to read a weak-power null as absence**.
- **χ²/df is not comparable across runs** (POKER_THEORY §15.3.1) — it scales with observations per
  player. Every verdict is read against a control from the **same run**; the comparable quantity is
  between-player SD.

**A stratum with no `separates` verdict from the same run gets no row.** Not greyed, not caveated —
no row.

**And this view is DEFERRABLE by construction, which is the strongest argument for Rule 2.** Because
the atom carries raw per-player identity and counts, a new axis can be defined next month, proved
separable next month, and applied to a run completed today — no re-run. Today, with no identity on
the row, every archetype hypothesis costs a full re-run.

### 6.3 "Which players leak the most EV" — is it computable?

The founder calls this the exploitable dataset. **Partly, and the honest version is staged.**

**Blocker, and it is small: the villain's identity is thrown away.** The hero-EV row carries
`playerId`, but that is **hero's** — the EVAL player whose hands are read (`heroEvRunner.mjs:169`).
No villain id, no opponent seat, no site id. The information exists one layer up: `hand.seatPlayers`
is already used at `runner.mjs:437`, and `ctx.opponentSeat` is already emitted by the accumulator
(`decisionAccumulator.js:434`) and consumed only to derive a position category
(`heroPolicy.mjs:181-185`). **Carrying two fields unlocks the entire view.**

**Two definitions; the readout needs both, ranked.**

**(D2) Exploitable edge by stratum — PRIMARY.** Restrict `estimateEdge` to decisions whose villain
falls in stratum *s*. This is the founder's actual question — *where are the primary moneymakers* —
it is realized-chips anchored rather than engine-graded, and it composes with the existing estimator
and cluster bootstrap unchanged.

> **v1 is cheap and honest.** With only the villain-id field, this measures *how much our current
> policy earns against stratum s*. Note what it is **not**: our policy does not yet vary by villain
> — `heroPolicy.mjs:186-190,232` pins the villain at population baseline (`villainModel: null`,
> `vpip/pfr/af/style` all `null`) and `heroEvReport.mjs:471-476` states the posterior width is
> constant by design. So v1 measures the **pool's contribution**, not our exploitation of it. v2 —
> conditioning the policy on the stratum — turns it into an exploitation figure and is a genuine
> change, not a field.

**(D1) Self-leak — DIAGNOSTIC ONLY, labelled.** `EV(best action at the node) − EV(action taken)`,
per player per 100 hands. The acting-seat inversion this needs **already exists**:
`teachableArmsProbe.mjs:110-149` scores every corpus player's own decision via
`ctx.playerSeat`/`ctx.action`/`ctx.isIP`. What is missing is that it scores in Δlog against revealed
hole cards (`:301`), not in EV. Pricing it in EV means the engine grades the pool with the engine's
own arithmetic — `FAULT-self-grading-circularity` in its purest form. Publish beside D2, never as
the headline, and stamp it.

**Identifiability — this decides the reporting granularity.** Median observations per player on the
well-sampled axes are **35–51** (`.artifacts/study-ladder.card.json`). A raw ranking of ~60,000
players by measured leak would be a ranking of *noise*, and reporting its top tail is exactly the
circularity §11.8 dissected: selecting the tail and reporting its mean looks convincing (37.7% vs
17.8%) and is an artifact. The archetype study hit the same wall independently — its Finding 5,
*rare reads are not individually estimable*, is filed **ROBUST / era-independent** because it is
arithmetic about opportunity counts, not strategy.

Therefore:

- **Stratum-level leak is the reportable figure** — thousands of players per stratum, identifiable.
- **Per-player leak exists only as a posterior shrunk toward its stratum**, with its interval, never
  as a bare ranking. `shrinkRates` with a leave-one-out prior already implements this
  (`separability.mjs:156-174`).
- **No "worst leakers" list without intervals** — a list sorted by a noisy estimate is a list of the
  players with the fewest observations.

---

## 7. Views 3 and 4 — moneymakers and spots. The cheapest views in the spec.

> **A reporting change over data already captured on every run.**

Every scored decision already carries `slices` — `street, facingAction, texture, posCategory,
sizeBucket, playersInPot, wentToShowdown` (`heroEvRunner.mjs:292-300`). A grep of `heroEvReport.mjs`
for `slices` returns **zero hits**. The covariates are written and never read. The only
stratification performed today is by `evStats` covariates via equal-count terciles
(`heroEvReport.mjs:274-284`, `:295-325`, `:335-431`) — a shape test, not a decomposition by spot.

**View 3 — Primary moneymakers.** Group atoms by slice key; run the **same** `estimateEdge` within
each group (ADR-009's one-comparison-path rule — `heroEvReport.mjs:286-294` already documents why
the estimator must not be re-implemented per stratum); rank by **contribution**, not mean:

```
contribution_g  =  edgeBB_g × (n_g / n) × opportunitiesPerHand × 100      [bb/100 hands]
Σ_g contribution_g  =  overallEvBB100                                     [exactly, by construction]
```

Ranking by `edgeBB_g` alone would put a 6-decision spot with a huge mean above the spot that
actually earns the money. Contribution answers the founder's question and **sums to the headline**,
which is what makes the view auditable.

**View 4 — Spot decomposition.** The same arithmetic on a finer key. The canonical spot key already
exists: `situationKey` — 7 axes (`street, texture, posCategory, isAgg, isIP, facingAction,
contextAction`, `src/utils/pokerCore/situationKey.js:59-70`) plus `carried` geometry (`sprBand,
playersRemaining, sBucket, closesAction`, `:107-122`). **`heroEvRunner` never reads
`ctx.situationKey`** even though the accumulator emits it (`decisionAccumulator.js:424`) — the flat
`slices` object was substituted. Carrying `situationKey` is one line and puts the hero-EV path onto
the same spot coordinate as `run-atoms.mjs:177-183`, `layerAblation.mjs:196` and
`atomsSelfCheck.mjs:74-77`.

**Power gate for both.** `MIN_CLUSTERS_FOR_CI = 30` (`heroEvReport.mjs:88`) applies **per group**,
not only to the total. A group below it reports its point estimate with no interval and an explicit
`TOO_FEW_CLUSTERS` marker, and is excluded from the ranking. Excluded groups are still counted in
the total and **the residual is printed** — otherwise the rows silently stop summing to the headline.

---

## 8. View 5 — Strategy transcription. The founder is right that it is a separate task.

### 8.1 What exists — verified, and it replicates

POKER_THEORY §11.9's harness **exists at HEAD and its published numbers reproduce exactly from
committed code plus on-disk artifacts.** Both files are tracked. Verified:

- Five arms at `teachableArmsProbe.mjs:341-377`. A2/A3/A4 share one narrowing machine
  (`narrowByLookup`, `:253-280`) differing only in the lookup table passed as a closure; A1 alone
  calls the shipped engine (`narrowByBoard`, `:347`).
- POOL/EVAL split by FNV-1a: hash `partition.mjs:64-72`, predicate
  `(fnv1a32(playerId) % 100) < poolPct` at `:92`, split site `teachableArmsProbe.mjs:90-92`. Mining
  POOL-only (`:393`), scoring EVAL-only (`:415`).
- All-five-or-none pairing: `if (!s0 || !s1 || !s2 || !s3 || !s4) return;` (`:366`) — every arm's
  mean is over one identical decision set, as §11.9 claims.
- Two hard `throw` falsification guards: degenerate check-back/check-OOP split (`:399-413`) and A4
  bit-identical to A3 (`:422-437`).

### 8.2 Four gaps, one now disqualifying

1. **It is not scored in EV.** The metric is Δlog vs uniform against revealed hole cards (`:301`,
   `scoreRange` at `:311-327`). Under Amendment 1 **that makes §11.9 a diagnostic, not a result.**
   *"Recovers ~56% of the engine"* is a statement about likelihood assigned to hole cards; it prices
   nothing.
2. **"Share of the engine's edge" is not code.** A repo-wide grep for
   `share of the engine|shareOfEngine|engineEdge|edgeShare` returns exactly one hit — the prose at
   `POKER_THEORY.md:1753`. The headline percentages are a manual `(A_x − A0)/(A1 − A0)` transform on
   emitted Δlog. They *do* reproduce bit-for-bit from `out/teachable-arms-{ftp,ps}.json`, but nothing
   computes, asserts or guards them.
3. **The 15-number table is not version-controlled as data.** It lives only in `out/*.json`, which is
   gitignored (`.gitignore:91`), and as a markdown table at `POKER_THEORY.md:1760-1766`. The rule a
   human is meant to hold in their head is not a committed artifact.
4. **It emits no Result Card**, unlike its sibling the study ladder (`studyLadderReport.mjs:242`),
   and has no test file.

### 8.3 The interface — one sentence, and both halves exist

> **The transcription produces a `Declared` surface — a Strategy Card. The readout scores it through
> the same arm slot, with the same `estimateEdge`, as every other surface.**

That is ADR-009's guarantee stated operationally. Both halves are built:

- `heroEvReport.mjs:502-532` is an **array of arms**, each an `estimateEdge` call — including
  `passivePolicy` (`:161-168`), the always-fold baseline (`:513-517`), and the pool-against-itself
  control that must return exactly 0 (`:518-523`).
- `loadStrategyCard` / `evaluateCard` already load and evaluate a Card with a rejecting loader, and
  already run from a CLI (`run-entry-card.mjs`).

So transcription's deliverable is a `*.card.js` Strategy Card with a residual clause and warrants;
the readout's obligation is a row for it in the arms table in bb/100 hands, beside the engine and
beside always-fold. **What the founder called "a second surface to hold us accountable" becomes
literally that: the teachable rule and the engine as two rows of one table, one currency, one
decision set.**

**§11.9's Δlog table stays** — it answers a different, legitimate question (how much of the engine's
*narrowing information* a human can carry), and deleting an instrument for reporting the wrong
currency is forbidden by standing rule. It is relabelled a diagnostic.

---

## 9. View 6 — The per-branch change ledger

The view Amendment 1 promotes above all others: design for the diff first, the level second.

### 9.1 The diff instrument exists

`depthAblationReport.pairedDelta` (`depthAblationReport.mjs:203-268`) already does the correct thing,
and its docblock (`:189-201`) explains why the naive version is wrong: *"a delta of two
independently-bootstrapped intervals would throw away the pairing … and would report an interval
several times too wide."* It computes both arms' IPS weights per decision (`:218-219`), differences
them **inside one bootstrap draw** (`:237-241`, `stat = (chunk) => vB - vA`), clusters over players
(`:244`), and emits `discordantN` (`:250-251`) — decisions where the arms' weights actually differ,
the honest denominator.

The identical-decision-set guarantee is **structural**: a decision survives only if **every** arm
produced a policy (`heroEvRunner.mjs:234-251`, break at `:243`, skip at `:246-251`).

### 9.2 Why the diff is more robust than the level — and where it is not

**Cancels exactly.** `pairedDelta`'s statistic is `wisValue(B) − wisValue(A)`; `poolValue` never
enters. **The entire Field-baseline estimate cancels** — every error in mining π_pool, and the whole
realized mean of the pool, is absent from the delta. The level inherits it; the diff does not.

**Cancels substantially.** Rake modelling, population transfer and the static-Field assumption are
common to both arms and cancel *to first order* — but not where the change interacts with them (a
rake-sensitive fix, or one that bites only in spots the 2009 pool reached often).

**Does not cancel.** Realized-outcome variance in `R_d` — the same hands are re-weighted, not
re-dealt, so pairing reduces variance without removing it; weight clipping at 20; and the wall-clock
non-determinism of §9.5, which does not cancel because it is not common to the arms.

### 9.3 The branch unit — defined so a diff cannot net to zero invisibly

A branch must partition the decision set so per-branch deltas **sum to the total**. Two levels:

```
BRANCH  (reporting unit)  =  street × facingAction × isIP
CELL    (audit unit)      =  the full situationKey + carried geometry
```

`street × facingAction × isIP` is the founder's "street × node type × action" in coordinates the repo
already has — three of `situationKey`'s seven axes (`situationKey.js:59-70`) — so the branch is a
**projection of the cell**, not a parallel taxonomy. The cell rides on every atom and is never
reported unless it clears the power gate; the point of two levels is that the audit unit can be
interrogated afterwards without the reporting unit fragmenting into cells of six decisions.

**The row, and the two totals that make it honest:**

```
per branch b:  Δ_b = deltaBB_b × (n_b / n) × opportunitiesPerHand × 100    [bb/100 hands, SIGNED]

NET   = Σ_b Δ_b        — equals the headline delta, by construction
GROSS = Σ_b |Δ_b|      — total movement regardless of sign
```

> **`GROSS / |NET|` is the detector the founder asked for.** Near 1 means the change moved the tree
> one way. A large ratio means it **redistributed** — helped rivers, hurt turns — and a NET near zero
> is a *cancellation*, not an absence of effect. Reporting only NET is exactly the failure he named.

Neither is computed today: `depthAblationReport.mjs` emits a scalar `deltaBB` (`:261-263`, reaching
the card as `metrics.depthDeltaBB`, `:465`) alongside flip counts by street (`adviceDivergence`,
`:140-186`) — **the flip counts are already decomposed by street and the EV delta is not.**
`RC-depth-ablation.json` shows why it matters: `flipShareByStreet {flop 0.0072, turn 0.039, river
0.80}` beside a single aggregate `depthDeltaBB: -0.4711`. The behaviour is known to be almost
entirely a river phenomenon and the EV figure cannot say so.

### 9.4 The join key — the ledger becomes a join, not a re-run

This is Rule 2's first dividend. If both runs persist atoms keyed identically, the ledger is a join.

```
JOIN KEY  =  (dealBookHash, playerId, handId, order)     — identifies the DECISION
ARM KEY   =  (surfaceId | armId, engineCommit)           — identifies the CONFIGURATION
```

`atomId` is already content-addressed over `{playerId, handId, order}` (`layerAblation.mjs:383`) and
is therefore a valid join key **on the same Deal Book** — but it is **one-way**, so the parts cannot
be recovered. Per §4.4's raw-over-derived rule: **keep `atomId` as the key AND store the parts.**
`dealBookHash` must be in the key because the same `(playerId, handId, order)` on a different corpus
slice is a different decision.

A join on this key across two atom sets yields the per-branch ledger **in seconds**, over runs that
each cost hours — including runs completed before the branch partition was designed.

### 9.5 Prerequisite — reproducibility. Named, and smaller than it looks.

**Confirmed at HEAD.** The refinement gate is wall-clock:

```
gameTreeEvaluator.js:899-907
  const timeBudgetMs    = refinementBudgetMs;                 // declared :814, default 2000
  let   refinementStart = Date.now();
  const isTimeBudgetExceeded = () => timeBudgetMs <= 0
    || Date.now() - refinementStart > timeBudgetMs;

gameTreeEvaluator.js:929-936
  const MAX_STAGE_SHARE = 0.4;                                 // module-local const
  const claimStageBudget = () => { ... Math.min(remaining, timeBudgetMs * MAX_STAGE_SHARE) };
```

and it is **not in the manifest**: `REQUIRED_CONSTANTS = ['PRIOR_WEIGHT', 'ACTION_TAU_FRACTION',
'MIN_CONTINUATION_WEIGHT']` (`manifest.js:33-37`); `grep refinementBudgetMs
src/utils/standardOfRecord/` returns zero hits; `replicationStamp.collectConstants`
(`replicationStamp.mjs:59-94`) does not collect it. Each runner bolts it into the free-form
`constants` bag under a **different key name**, so no consumer can find it generically.
`MAX_STAGE_SHARE` cannot be stamped at all and is recorded as a `knownDivergence` with
`agrees: null` (`depthAblationReport.mjs:364-375`).

**But the fix pattern is already written.** `run-river-flip-replicate.mjs:83-87` freezes `Date.now`
at `FROZEN_NOW = 1_700_000_000_000` and seeds `Math.random` with mulberry32, both arms of a replicate
drawing from the same seed (`:255`), and stamps the budgets into `manifest.constants` (`:429-437`).
Its card demonstrates the result: **depth-2 argmax stability 1.000** across 8 replicates. Freezing is
safe because `refinementBudgetMs <= 0` is short-circuited explicitly rather than falling out of the
arithmetic (`:906`), and the comment at `:902-905` says this was done *for* a frozen-clock harness.

**So the prerequisite is a promotion, not an invention.** In order:

1. **Stamp the ACHIEVED depth on the atom, not only the requested budget** (§4.3).
   `evStats.depthReachedMax` is already computed (`heroPolicy.mjs:368`). A requested budget does not
   tell you what ran. **Highest-value single line in §9.**
2. Add `REFINEMENT_BUDGET_MS` and `MAX_STAGE_SHARE` to `REQUIRED_CONSTANTS` under **one** canonical
   key — which forces `MAX_STAGE_SHARE` out of module scope.
3. Promote freeze/seed from `run-river-flip-replicate.mjs` into the shared harness.
4. **Assert monotonicity or disclose its absence.** Refinement is not asserted monotone; WS-378 saw
   depth-2 move 38 of 40 flips toward passivity. A delta between arms at different depths is
   interpretable only if depth is fixed across them — so **the ledger pins depth as a controlled
   variable**, and any change that alters depth is measured at both depths or not at all.

**Also blocking run-over-run:** the hero-EV card does not pass `anchorGeneration`
(`heroEvReport.mjs:202-233`; default `null` at `resultCard.js:78`), and `ladder.mjs:118-123` throws
`LadderRefusal` on a null generation. **Three of the four cards on disk cannot enter a Ladder.**

### 9.6 Pairing across a code change, not just a config change

`depthArms` varies a runtime *parameter*; the founder's loop varies *code*.

- **(A) In-process arms.** Every EV-bearing fix ships behind an arm flag, so both behaviours exist in
  one process and pairing is draw-for-draw. This is how `depthArms` already works
  (`run-depth-ablation.mjs:204-207`) and is the only way to *guarantee* an identical decision set.
  Cost: flag discipline on every fix, and flags must be retired.
- **(B) Cross-run join** on §9.4's key. Cheaper per fix; correct only if both runs are
  bit-reproducible and filter identically (§9.5 first), and it cannot detect a decision set that
  silently changed — which is why the atom set carries a census.

Recommendation in `decision_flags`: **(A) primary, (B) as the retroactive path** for changes already
merged — the only way to price WS-378, which is already in HEAD.

---

## 9bis. View 7 — The Hole Map. The price of the branches nobody takes.

> **Status:** PROTOTYPED AND RUNNING at HEAD `fe716f59`.
> **Generator:** `scripts/backtest/run-hole-map.mjs` · logic `holeMap.mjs` · line matcher
> `holeMapLines.mjs` · renderer `holeMapHtml.mjs`
> **Outputs:** `out/hole-map.json` (machine-readable) · `out/hole-map.html` (self-contained, offline)
> **Regenerate:** `npm run hole-map` · **check freshness without regenerating:** `npm run hole-map:check`
> **Source:** founder directive 2026-08-05, plus two binding amendments (§9bis.2, §9bis.6) and the
> freshness contract (§9bis.11).

### 9bis.0 The directive

> *"I need a visual of the decision tree with numbers at its termination points and decision points.
> That needs to be reproducible from the standardized test. I need to see which boards have which
> preponderance of actions and where the thresholds are. I should be able to see a distribution and
> where the holes are. IE, a check raise isn't present, but if it were, the pot odds would imply what
> fold % and what continue % based on what inelasticity model? THIS is our exploit opportunity."*

**Views 1–6 measure how good our action is on branches the pool TAKES. View 7 is the inverse: what is
the price of the branches nobody takes?** A line the pool almost never faces has no defence
constructed against it, so the hole in the action distribution *is* the exploit.

**This is a seventh view over the same Decision Atom set, not a second instrument.** It reads
`situationKey`, the candidate list, the raw geometry and `pPoolObserved` off the same record §4
specifies. Nothing in it needs a run that §4 does not already justify.

### 9bis.1 The quantity, per (spot, absent-or-rare action)

| Term | Definition | Provenance |
|---|---|---|
| **Required fold %** | Pot geometry. `s/(1+s)` for a bet of `s`×pot; `R/(R+P+B)` for a raise to `R` over a bet `B` into pot `P`. | Exact arithmetic. `actionClassifier.js:135` computes the identical expression in-engine (verified; a byte-identical duplicate sits at `:543`). |
| **Predicted fold %** | The pool's **measured** fold rate at that geometry, EVAL half, with per-bin `k`/`n`. | `out/fold-vs-sizing.json` cells; hold-out table in `out/fold-curve-fit.txt`. |
| **Gap** | predicted − required, in points, then × the EV slope to get bb. | EV is linear in `f` with slope `(won on a fold) + (risked)`, so one multiply and no simulation. |

**The instrument prices holes off the MEASURED curve, not off the engine's model**, because the
measured curve carries shape *and* level from the same data and the engine's does not (§9bis.3).

### 9bis.2 AMENDMENT 1 — denomination. A gap without its rate is unactionable.

The founder anchored the ask on a rate — *"good players make upwards of 20bb per hour consistently"*.
That is a **scale test**. "+0.35 bb when it occurs" cannot be read as either a fifth of a good
player's edge or a rounding error. So every hole row carries **three** quantities:

1. **Gap per occurrence**, in bb at that spot's pot geometry.
2. **Occurrence rate**, per 100 hands — POKER_THEORY §14.1's currency, computed over **seat-hands**,
   never hands. Dividing by hands would report a 9-handed table's total activity as one player's
   frequency and inflate every rate ~9×.
3. **Gap × rate**, in bb/hour at a **stated** hands-per-hour figure, printed inline on every cell.

**Rows sort by (3).** That ordering is the answer to "where is the exploit" and it *disagrees* with a
sort by (1) — a large gap at a rare spot loses to a modest gap at a common one.

> **RULE 7a.** The bb/hour conversion is itself a **transfer**. Online table pace and live pace differ
> by several multiples, so the *rate* travels worse than the per-occurrence gap. The per-100-hands
> figure is printed beside every bb/hour figure and carries no pace assumption.

> **RULE 7b — two n's, never merged.** A row's rate and its gap rest on different evidence. The
> occurrence rate may sit on 230,840 seat-hands while the elasticity behind the gap sits on 289. Both
> ride on the row as `nGap` and `nRate`. There is no combined `n` and there must not be one.

> **RULE 7c — no total without disjointness.** `sumDisjoint` **refuses** to add rows sharing a spot
> node. Nine sizings at one flop node are nine alternatives to one decision. In the prototype this
> refusal **fires**, and the refusal is displayed rather than engineered around. The defensible
> aggregate is a **portfolio** — the best-priced line at each disjoint spot — and it is labelled a
> **ceiling**, not a forecast.

> **RULE 7d — no n-threshold suppression.** A large realized outcome at a tiny count may be exactly
> the low-frequency/high-magnitude structure under investigation. Rows below any n are shown with
> their n visible rather than removed by a hidden editorial cut.

### 9bis.3 Is the inelasticity model FIT or ASSUMED? — the question the view turns on

If elasticity were assumed, every gap and therefore every bb/hour figure would be an assumption
wearing a measurement's clothes. The answer is not one word.

**THE SHAPE IS FIT. THE LEVEL IS NOT.**

| Component | Status | Evidence |
|---|---|---|
| Shape — `maxDelta` 0.95, `midpoint` 0.35, `steepnessUp/Down` 6.5/0.75 | **FIT** | Brier-minimised on POOL days 1–11 (k=98,273/n=178,174); hold-out EVAL days 12–23 (k=178,794/n=318,347). Residual slope +0.1409 → +0.0078, Brier 0.24054 → 0.23530. WS-283, commit `923aef3a`. `villainModelData.js:239-256` |
| Level — `POPULATION_FOLD_RATE = 0.45` | **ASSUMED** | Deliberately unfitted under the live/online separation (WS-259). Pinned at 0.45 the hold-out under-predicts by +9.5/+9.2/+2.9 pp across buckets. `foldEquityCalculator.js:562-565` |
| Per-style multipliers | **ASSUMED** | Founder estimate. The code says so: an earlier "calibrated against live 1/2 showdown data" claim was **withdrawn** in WS-283 because no such calibration exists. `villainModelData.js:264-292` |
| Per-street modifiers | **MEASURED, REFUTED, STILL SHIPPED** | On top of the refit they make hold-out Brier *worse* on all three streets (flop 0.23668→0.23723, turn 0e-5, river 0.22844→0.22885). `villainModelData.js:336-340` |
| `sprMidpointMultiplier` | **ASSUMED** | No fit artifact exists in the repo. `gameTreeConstants.js:84-87` |
| Facing-a-**raise** elasticity | **FIT SEPARATELY, NEVER MERGED** | Hold-out n=45,293, k=19,212, marginal 0.4242; slope 0.1842→0.0522. Measured, reported, not folded into the shipped curve. **This is the arm every check-raise row needs**, and View 7 reads it directly rather than reusing the facing-a-bet curve. |

### 9bis.4 Two caveats that bound every number in the view

> **RULE 7e — the zero-equity assumption.** Every required-fold figure is the breakeven for a hand
> with **zero equity when called** — a pure bluff. A semi-bluff needs fewer folds; a value hand needs
> none. **A negative gap means "does not pay AS A PURE BLUFF", never "does not pay".** This single
> distinction reconciles the model arm and the outcome arm (§9bis.6).

> **RULE 7f — the gap is an upper bound that decays with use.** The measured fold rate is conditioned
> on the bets the pool *actually made*, with the pool's real range behind them. A bluff added to the
> tree is a bet the pool did not make. Against a defender who adapts, the fold rate falls toward the
> required rate. The corpus **cannot** measure the decay: it contains no counterfactual in which hero
> bluffed more.

### 9bis.5 The board dimension, and its measured cost

Texture is `analyzeBoardTexture`'s three-way label — `wet` (wetScore ≥ 65), `medium` (≥ 40), `dry`
(`boardTexture.js:84`) — collapsed from a 12-field analysis. Per-individual-board is far too sparse.

**The cost is measured and it is negative.** `hierarchyVariants.mjs:109` records keying the policy on
texture as **+0.0132 WORSE than pooling texture away**. The dimension appears because it was asked
for; the repo's own ablation says it does not currently earn its place. The other 11 analysis fields
never cross the backtest seam — `decisionAccumulator.js:330-336` takes `.texture` alone — so
monotone-and-paired and two-tone-and-connected are one cell here.

### 9bis.6 AMENDMENT 2 — the revealed-preference prior, and the outcome-anchored arm

> *"triple barrel bluffs, or triple barrel with a river 3bet exist and win huge pots when they do,
> otherwise good players would NEVER do them… Good players track decisions and win rate, so we can
> assume that there is some validity to all these possible lines."*

This is an argument from revealed preference by results-tracking practitioners and it is legitimate
evidence. It is encoded as a rule in code (`PRACTITIONER_REPERTOIRE`, `classifyGap`), not held in
prose, because the default reading of a negative number is the opposite one:

> **RULE 7g.** If the instrument reports that a line winning players demonstrably use is −EV, **the
> leading hypothesis is that the MODEL OF THE LINE is wrong, not that the line is wrong.** Such rows
> are flagged `model-suspect` with the specific defective component **named**, never
> `line-unprofitable`.

**Why IPS cannot price these lines, structurally.** `w = π_ours/π_pool`, and a hole has `π_pool ≈ 0`
*by definition*. The weight explodes or hits `weightCap: 20`; the payoffs are large so variance goes
as magnitude²; the counts are tiny. **The lines most wanted are precisely where importance-weighted
estimation is weakest.** That is why View 7 prices from geometry + a measured curve, and why it
carries a second arm that bypasses the engine entirely.

**The outcome-anchored arm** (`holeMapLines.mjs`) scans a bounded corpus slice for hands where a
named line *actually occurred* and reports realized chips: count, mean bb, SE, the distribution,
showdown share, and — for check-raises — the rate *given the opportunity*
(`checked, then actually faced a bet`), the only correct denominator. Detection is ported from
`decisionAccumulator.js:534-556` and `mine-behavioral-features.py:301-308`;
`rangeEngine/lineTaxonomy.js` is **preflop-only** and cannot see a barrel or a check-raise, so this
is a gap it fills rather than a duplicate.

Four confounds ride on the arm, ranked, the first severe: **the realized mean is not the incremental
EV of adding the line** (holding and decision are confounded and the corpus holds no counterfactual);
`checkraise_fold` is a **losing branch by construction** and its mean is the cost of the exit;
the net is the **whole hand's** result; and it is a selected sample of **players**, though not of
outcomes.

### 9bis.7 What the prototype measured

Against `out/behavior-policy.json` (12,191 pool decisions), the EVAL-half fold curves (497,316
facing-a-bet and 72,570 facing-a-raise decisions), and a 40-file corpus slice (33,754 hands /
230,840 seat-hands):

**The pool over-folds to BETS and under-folds to RAISES** — mean gap **+18.7 pp** vs **−5.4 pp**.
The bet gap does not close as sizing rises (+30.4 pp at 0.33×, +19.6 pp at 1.0×, +11.5 pp at 2.0×,
with per-occurrence bb *rising* throughout), which is the measured form of "increasing value bet
sizing". Of 918 raise rows only 107 are positive, and every one is a **4× raise on the flop**.

**The two arms disagree, and the disagreement is the most informative output.** The model arm prices
pure-bluff check-raises at −13.5 to +2.4 pp; the outcome arm shows realized check-raises at +8.76 bb
(flop, n=677), +10.39 (turn, n=324) and +22.83 (river, n=70). Under RULE 7e this is **not a
contradiction**: the model prices zero equity when called, and the pool's check-raises are value and
semi-bluffs whose EV lives in the called branch the model sets to zero. Read together they say
something sharper than either alone — **check-raising this pool works, but not as a pure bluff.**

### 9bis.8 What this view CANNOT do today, and what would fix it

**The founder's headline example is invisible to the scoring vocabulary.** `heroPolicy.mjs:85` maps
`check-raise → CHECK`, and that is **correct** — the corpus records a check, and recording a raise
would compare our advice against an action the hand history cannot contain. The consequence is total:
a check-raise never changes the argmax, never moves the IPS weight, contributes exactly zero to any
measured delta. `π_ours` at a check node cannot distinguish *check and give up* from *check intending
to raise*, the highest- and lowest-EV plans at one node.

**Two defects compound it.** The engine's check-raise candidate at `heroActionBuilder.js:257` carries
**no EV** — it is a bare `{action, betSize: 0, isCheckRaise, villainCbetPct}` descriptor; the EV is
attached later at `gameTreeEvaluator.js:338-524` (returned `:507-523`). And that EV is under an open
defect report: **WS-314** measured check-raise ranking first for *every* weak hand including 5-high at
12% equity, at 2–3× the best bet EV. **So the engine's candidate list is not a trustworthy price for
this line either** — which is why §9bis.6's arm reads the corpus directly.

**The fix — a plan-vs-primitive vocabulary.** The leak-free form is a **conditional second
instrument**: at check nodes *where villain subsequently bet*, compare hero's actual response
(fold/call/raise) against the engine's, reusing `RESPONSES_BY_FACING.bet` unchanged. The conditioning
event is villain's action, not hero's, so no lookahead enters the label; the denominator it needs
(`checkThenFacedBetCount`) is already computed at `decisionAccumulator.js:534-556`. The alternative —
adding `checkRaise` to the `none` response set with the label assigned by lookahead — breaks the
"what would be RECORDED at this node" invariant and is **not recommended**.

**No queue item owns this.** The vocabulary collapse is recorded only as an out-of-scope note inside
**WS-294** (*"sizing not scored — actions collapse to primitives"*, `:43-45`). The tickets that would
own a fix are **WS-336** (CP-2 — a continuation policy that can barrel and check-raise) and
**WS-314**. This view cross-references them; the conditional instrument above is the piece none of
them currently contains and is the one new item worth opening.

### 9bis.9 The substitution ledger — the prototype's honesty

View 7 is specified as a pure view over the §4 record. That record is not on disk, so:

| Sidecar field | Standing in today | What is lost |
|---|---|---|
| `candidates[].ev` (whole ranked list) | `evStats.statedEvMean` | **The per-action EV.** No row can say what the *untaken* branch was worth — the most load-bearing number in a hole map, currently absent. |
| `candidates[].villainResponse.foldPct` | nothing | The engine's own predicted fold per candidate; its threshold can be compared to the measured one only in aggregate, not per spot. |
| raw geometry (pot/bet/stack/SPR/`closesAction`) | re-derived from a corpus slice, medians only | Per-decision pot geometry; within-row variance is invisible. |
| `situationKey` (7 axes) | `slices` (5 axes) | `isAgg`/`isIP` on scored rows, so decisions cannot join the policy at full key depth. |
| `pPoolObserved`/`wRawByArm` un-pre-multiplied | `piPool`/`piOurs` on ablation rows | The raw uncapped weight, hence `clippedShare` **per row** — which is exactly where a rare-line row needs it. |
| refinement stage ledger, per-combo `depthReached` | `depthReachedMax` | Whether the wall clock rather than the position decided the advice. |

**What §11 gains.** Add one line to the ranked prerequisites: **View 7's arithmetic is free once the
sidecar exists** — it is reporting over captured data, in the same class as Views 3/4. Its only
genuine prerequisite is the per-action EV on the record, without which the central column of a hole
map is permanently empty.

### 9bis.10 What this view refuses

- **Refuse a total across non-disjoint rows.** Enforced by `sumDisjoint`, and it fires today.
- **Refuse a bb/hour figure without its hands-per-hour assumption printed inline**, and without the
  per-100-hands figure beside it.
- **Refuse a single merged `n`.** Rate-n and gap-n are separate fields.
- **Refuse `line-unprofitable` on a practitioner-repertoire line.** It reports `model-suspect` and
  names the component.
- **Refuse to drop a row for small n.** Sparsity is displayed, never editorialised.
- **Refuse to read a realized mean as an incremental EV.** The holding confound is stated at severity
  SEVERE above the table.
- **State the population on every figure.** Online 2009 vs live 9-handed 1/2–1/3: transferred, not
  measured — carried in the page banner, not a footnote.

---

### 9bis.11 Freshness — the artifact must not be readable as current when it is not

A readout is a claim about **one engine commit**. `engineFoldPct` and every `model-suspect` verdict
derived from it describe the code that ran, and nothing about a rendered page announces when that
code stops being HEAD. Left alone, a Hole Map goes wrong silently — the failure ADR-009 exists to
stop.

**The stamp (generation time).** Every run writes `manifest`:

| Field | Meaning |
|---|---|
| `engineCommit` | `gitStamp` — throws rather than substituting `unknown`. An artifact that cannot name its engine is not publishable and must not look publishable. |
| `engineDirty` / `watchedDirty` | Whole-tree vs **watched-path** dirtiness. The verdict turns on the latter; see below. |
| `disclaimerRegisterVersion` | `registerVersion()` — epoch plus a content hash over the register body, so it changes when any entry is edited whether or not anyone bumped it. This is what lets a fault confirmed tomorrow find the results that stood on it yesterday. |
| `regenCommand`, `watchedPaths`, `inputs`, `generator`, `spec` | So the artifact carries its own reproduction instructions. |

**The signal (read time).** Not age in days — *the count of commits touching the engine since the
artifact was generated*. A six-week-old map with zero engine commits behind it is current; a
six-hour-old one with a fold-curve commit behind it is not. `npm run hole-map:check` derives that
from git in under a second, **names the commits**, and rewrites the banner between the
`<!--FRESHNESS:START-->` / `<!--FRESHNESS:END-->` markers in the rendered page, so freshness is a
property of the moment you read it rather than the moment it was made.

**Three deliberate narrownesses, each defending the signal from itself:**

- **`WATCHED_PATHS` is small** (`exploitEngine/`, `rangeEngine/`, and the generator's own logic). A
  commit to a React view cannot move a cell in this table. Counting it would make the banner fire
  constantly, and a banner that always fires is one nobody reads.
- **Dirtiness is measured over the watched paths, not the whole tree.** CWOS rewrites
  `.claude/workstream/**` on every command, so whole-tree `--porcelain` is dirty almost always in
  this repo. Keying the verdict on that would fire on every artifact ever produced.
- **No `SessionStart` hook.** `.claude/hooks/readiness-gate.cjs` records the lesson in its own
  docblock: *a banner shown every session is a banner nobody reads by week three*. During an engine
  sprint this signal would fire most sessions. It belongs where the artifact is read and where a new
  one is produced (`docs/runbooks/baseline-ev-run.md` §11.6–7), not on session start.

**What the verdict refuses.** `null` (git could not be asked) never collapses into `[]` (asked,
answered zero). An unanswerable freshness question reports `unknown`, never `current` — a green
banner derived from an unasked question is worse than no banner. Exit codes: `0` current, `1` stale
or dirty-source, `2` unknown / no artifact, so the check works as a runbook or CI gate unparsed.

---

## 10. The worked example: pricing the river-omniscience fix

The founder's test — *if your spec cannot price a fix that is already complete and already carded, it
is not yet a spec.*

**What must be run.** `run-depth-ablation.mjs` is the correct instrument with the arms redefined from
depth to the WS-378 behaviour:

- **Arm A (reference):** engine at the pre-`d0a03e49` river-omniscience behaviour.
- **Arm B (candidate):** engine at HEAD `fe716f59`.
- **Both at a pinned refinement depth, clock frozen** — the fix is a river-path change and the river
  is exactly where refinement decides the top action (`RC-depth-ablation.json`:
  `flipShareByStreet.river = 0.80`). Not pinning depth confounds the two.
- **Baseline:** the same one every arm uses — the Field, π_pool, via `estimateEdge`. Not always-fold
  (a separate arm); not the equilibrium (does not exist).
- **Output:** `deltaBB` with a player-clustered paired CI, decomposed per §9.3 into
  `street × facingAction × isIP`, with NET and GROSS. The prediction from the flip directions
  (`bet→check 27 → 10`) is that the effect concentrates in river bet/check branches — the ledger
  confirms or refutes it.

**Can the existing harness do it today?** *Almost.* Estimator, pairing, CI and card all exist.
Missing: the two arms are two **commits**, so it needs §9.6(A) — the WS-378 behaviour behind a flag —
or §9.6(B) plus §9.5's determinism. Nothing conceptually new.

**And the honest answer the founder should get first: at the sample size the harness has run at, this
fix is very likely unmeasurable.** `RC-depth-ablation-1c560bcc-67e9e14e` reports
`depthDeltaBB: -0.4711` with CI **[-2.7653, +1.3290]** at n = 260 decisions and **22 players**, and
`DEPTH-ABLATION-2026-08-05.md:162-164` states it plainly: *"At 260 decisions and 22 players the
instrument cannot separate a half-big-blind effect from nothing."* CI half-width ≈ 2.05 bb.

That is a **post-hoc observation, not a pre-run power statement** — the gap §10.1 closes.

### 10.1 Minimum detectable effect — the missing pre-flight

**Nothing in the diff path computes an MDE or a required n.** There is exactly one MDE in the repo
and it is elsewhere: `classifyPlayerSignal` (`rangeCalibrationProbe.mjs:1151-1206`, `mde = zz * se`
at `:1181`), which returns an explicit `underpowered` class and whose docblock states *"THE SEPARATOR
IS POWER, NOT SAMPLE SIZE."* Everything in the diff path is a *gate* (`MIN_CLUSTERS_FOR_CI = 30`,
`heroEvReport.mjs:88`) or a post-hoc CI.

**The readout must emit an MDE before the run.** Since the CI is a cluster bootstrap over players,
half-width scales as `1/√P`:

```
P_required  ≈  P_observed × (h_observed / h_target)²
```

From the one calibration point available — h ≈ 2.05 bb at P = 22 — detecting a 0.20 bb effect needs
on the order of **2,300 contributing players**. The corpus holds **59,848 player-site rows**
(`.artifacts/study-ladder.card.json`), so **the corpus is not the binding constraint — the harness's
decision cap is.** State that as the encouraging finding it is: the path to a usable readout runs
through raising `--max-decisions` and `--max-players`, not through acquiring data.

Compute this properly at implementation time; the figure above is an order-of-magnitude sighting shot
from a single point and is labelled as such.

---

## 11. What can be produced TODAY vs what needs building

"Today" = runnable at HEAD with no code change. The corpus is present locally
(`C:/Users/chris/data/phh-dataset/data/handhq`, FTP + PS, 50NLH, July 2009).

| § | View | Today | Needs building |
|---|---|---|---|
| 4 | **The record** | atom schema, store, census, self-check — all exist | v3 fields (§4.3); `heroEvRunner` emitting atoms |
| 5 | **Overall EV** | `edgeBB` + CI + arms + PBR + admissibility + a card, via `run-hero-ev.mjs` | bb/100-hands lift; deprecate `edgeBBPer100` |
| 6 | **By sub-archetype** | separability verdicts per axis, carded, via `run-study-ladder.mjs` | villain id on the row; stratum grouping; then v2 villain-conditioned policy |
| 7 | **Moneymakers** | — | grouping + contribution arithmetic over `slices`, **already captured** |
| 7 | **Spot decomposition** | — | carry `situationKey` (1 line) + the same grouping |
| 8 | **Transcription** | Δlog arms table via `run-teachable-arms.mjs` | Strategy Card emission; scoring through the arm slot; commit the table as data; a card |
| 9 | **Branch ledger** | aggregate paired `deltaBB` + CI via `run-depth-ablation.mjs` | per-branch decomposition; NET/GROSS; depth stamping; `anchorGeneration`; the join |
| 9bis | **Hole Map** | **RUNS TODAY** — `run-hole-map.mjs` over the policy, the measured fold curves and a bounded corpus slice. Regenerate with `npm run hole-map`; stamped with a provenance manifest and a read-time freshness banner (§9bis.11) | per-action EVs on the record (without them the central column stays empty); per-row `clippedShare`; the plan-vs-primitive vocabulary (§9bis.8); the **in-app study surface**, blocked at Design Gate 2 — `docs/design/audits/2026-08-05-entry-hole-map-study-surface.md` |

**Ranked prerequisites, in dependency order.**

1. **Deprecate `edgeBBPer100`** (`ipsEstimator.mjs:253`). Trivial; a loaded gun aimed at the headline.
2. **Decision Atom v3 + `heroEvRunner` emits atoms** (§4). Everything else is a query over it, and
   every hour of run time spent before this is an hour whose record is discarded. **Do this first of
   the real work.**
3. **Declare the `metrics` schema.** The view half of the same problem. Additive-only, guarded by
   `scripts/check-sor-additive.sh`.
4. **Reproducibility** (§9.5): stamp achieved depth; canonical budget key; promote freeze/seed;
   `MAX_STAGE_SHARE` out of module scope. **Blocks §9 entirely.**
5. **`anchorGeneration` on the hero-EV card.** Blocks the Ladder, blocks run-over-run.
6. **Views 3/4 arithmetic, and View 7's.** Pure reporting over captured data — the cheapest real
   views. View 7 already runs against the substitutes; the sidecar upgrades it rather than enabling it.
7. **MDE pre-flight** (§10.1). Without it a null result is unreadable.
8. **Raise the decision/player caps.** The corpus supports it; the harness caps do not.

---

## 12. What this readout must refuse

Refusals are the load-bearing part; a readout that degrades gracefully into confident nonsense is
worse than none (`ConfidenceDisclosure` is the repo's worked example — an interval excluding every
dominant term, judged *worse-than-none*).

- **Refuse a sub-archetype row without a `separates` verdict from the same run.**
- **Refuse to rank per-player leak without intervals.**
- **Refuse to report an Equilibrium frame.** `EquilibriumSubstitutionError` already throws.
- **Refuse a branch ledger without a stamped achieved depth** for both arms.
- **Refuse NET without GROSS.**
- **Refuse an aggregate whose atom set does not resolve.** `resolveAtomSet`'s reason enum already
  distinguishes `not-found | hash-mismatch | truncated | unreadable`; a view over unresolvable atoms
  must carry the reason, never a confident zero.
- **Refuse any figure without its conditioning set.** The `{k, n, rate, conditional}` shape is
  already in use (`atomsSelfCheck.mjs:107,119,150,172,189,198,212`;
  `.artifacts/atoms/gen2.card.json`) and every count adopts it, including the **inverse** conditional
  where the two readings differ.
- **Refuse to publish without `manifest.disclaimerRegisterVersion`** — `manifestProblems` already
  rejects a card without one.
- **State the population on every figure.** Online 2009 versus live 9-handed 1/2–1/3: transferred,
  not measured. Register rank 1, breadth 0.90, and its falsifier is currently **blocked** — SRC-014
  is browser IndexedDB with no export path, so no harness can read both arms.

---

## 13. Open questions that are the founder's to answer

Carried in the queue item's `decision_flags` with a recommendation each. Summarised:

1. **Which single number is THE optimizable figure** — `overallEvBB100` or exploitation efficiency.
   *Recommend: optimize `overallEvBB100`, report efficiency beside it.*
2. **How much does the record over-capture, and at what storage cost** (§4.5 tiers).
   *Recommend: full core row always; `beliefState` under `fullSampleRate`.*
3. **Arm-flag discipline on every EV-bearing fix** (§9.6 A) versus cross-run join (B).
   *Recommend: A primary, B for already-merged changes.*
4. **Publish the engine-graded self-leak figure at all?** *Recommend: yes, labelled a diagnostic,
   never the headline.*
5. **Does the Result Card `metrics` block get a declared schema?** *Recommend: yes — it is the
   readout.*
6. **Which axes get strata, and how many?** *Recommend: `limpRate`, `cbetRate`, the k=2 looseness
   pole; quintiles; NOT `threeBetRate` (reliability 0.33).*
7. **Spend the run budget on N or on breadth?** *Recommend: N first — an underpowered readout is
   worse than none, and §10.1 says the corpus can carry it.*
