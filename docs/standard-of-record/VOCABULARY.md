# The Standard of Record — vocabulary register

> **Status:** LIVE REGISTER — established 2026-08-02 (WS-322)
> **Governing decision:** [ADR-009](../adr/ADR-009-standard-of-record.md) · DEC-033
> **Program:** `prog-strategy-of-record`
> **Code:** `src/utils/standardOfRecord/`
> **Companion:** [NAMING-HISTORY.md](NAMING-HISTORY.md) — the eight states this vocabulary passed
> through, what each name could not hold, and the argument lattice that says which object comes next.

This file exists so the next session does not reinvent these terms. If you are about to coin a
word for one of the things below, use the word below instead. If you need a word for something
not below, add it here in the same change.

---

## Why there is a standard at all

The project kept discovering that deep faults went unmeasured for long periods. WS-291 — a
falsified range model sitting on the live recommendation path — survived for the life of the
project. The mechanism was not carelessness. It was that **nothing forced two numbers onto the
same axis.** Each session invented its own instrument, its own slice, its own horizon and its
own units, so a wrong number never had to meet a right one.

**The rule:** any artefact making a *comparative* claim about strategy, model quality, or EV
must resolve to a **Result Card**.

**Proportionality.** This binds *comparative claims*, not every number. A debug count or an
exploratory check is not a claim. The trigger is **a number someone could act on or cite**.

---

## The terms

| Term | Meaning |
|---|---|
| **Surface** | A function from game state to action distribution. Over the space of game states, that function is a surface. FSA's term, unchanged. |
| **Surface kind** | `Equilibrium` \| `Field` \| `Read` \| `Declared`. See the naming note below — the field is `surface_kind`, **not** `surface_class`. |
| **Stack** | The ordered layers composing a surface: `range → equity → foldProbability → ev → action`. A surface may OMIT layers; it may not REORDER them, because "the first layer at which two stacks separate" is only meaningful against a fixed order. (WS-324) |
| **Layer** | One element of a Stack — itself a function over game states, with its own inputs, its own named assumptions, and its own ways of being wrong. |
| **Layer Probe** | Scores ONE layer against its own ground truth (`range` → revealed holding, `equity` → realized showdown, `foldProbability` → observed fold, `ev` → realized chips), independently of whether the recommendation downstream was any good. `action` has no ground truth and its probe refuses permanently. Probes refuse `hypothesized`-basis input, inheriting the holdingKnowledge rule. (WS-324) |
| **Layer Attribution** | Decomposes a divergence between two surfaces BY LAYER — which step of the reasoning made them differ — orthogonally to FSA's decomposition BY SITUATION. Both sum to the same total. **Takes `d` as a required argument and never chooses one**: a decomposition of a divergence is not a definition of one, so FSA Phase 3 still owns `d`. (WS-324) |
| **Layer Ablation** | Substituting a layer's recorded value to ask "what if this layer had been correct?". Evaluation-free, and therefore able to speak only to the substituted layer — every layer downstream was evaluated at the ORIGINAL input. Propagating requires layer functions **pinned** to the atom set's engine commit and replayed from its seeds, never the live engine. (WS-324) |
| **Divergence** (`d`) | How far apart two surfaces are. **THE one comparison path** ADR-009 permits, in `src/utils/standardOfRecord/divergence.js` and nowhere else — a repo-wide scan in its test file asserts there is no second. **Unsigned**: a divergence says how far apart, never which is better. That second question is an *edge* and `estimateEdge` in the hero-EV arm already owns it; conflating them is how a divergence figure gets read as a winrate. (WS-350) |
| **The two candidate `d`s** | FSA open question #2 said "KL versus EV-difference — decide in Phase 3, **measure both**", and both ship. `kl` = KL(reference ‖ candidate) over the action distribution, in **nats**: how differently do they *behave*. `ev-difference` = \|EV_A − EV_B\| in the atom's EV units: how much *money* separates them. **They are not on the same scale** and `comparableByMagnitude: false` rides in every payload — what is compared is their **ordering** over surfaces. (WS-350) |
| **Pre-registration** | The declaration, made and timestamped *before* a run, of which measure is primary and which weighting is reported. `measureBoth` **refuses to run without one**. The refusal is the mechanism: computing both and then reporting whichever agreed with the prior finding is indistinguishable, in the output, from having chosen honestly. Stamped verbatim into `resultCard.metrics.divergence.preRegistration`. (WS-350) |
| **Divergence volume** | The set of paired decisions a divergence figure is computed over. Enforced to be **identical for both measures**: a decision missing either one is excluded from *both* and counted by reason. Scoring KL on the rows that had actions and EV-difference on the rows that had EVs would put the two numbers on two different sets, and the comparison would then be measuring the sets. (WS-350) |
| **Weighting** | `frequency` (every decision counts once — what a player actually faces) vs `uniform` (every *situation* counts once — surfaces rare-but-severe divergence that frequency weighting buries). Both are computed on every run; they answer different questions, and the card declares which is primary. (WS-350) |
| **`KL_FLOOR`** | The probability floor under KL, `1e-6`. Load-bearing: `heroPolicy` applies no smoothing, so a flipped argmax against a hard zero contributes ≈ `ln(1/floor)` nats — the floor *sets the magnitude* of every KL figure. It is stamped into `manifest.constants` and **swept** into a `fragility` margin. A KL figure published without its floor swept is a setting, not a measurement. EV-difference has no equivalent knob, which is itself a difference between the two candidates. (WS-350) |
| **Strategy Card** | A declared, enclosed, warranted rule set — i.e. a `Declared` surface. |
| **Conduct Card** | What ONE player **did**, as a rule, stated in his own terms — the record form a `Read` surface never had while `Declared` surfaces had the Strategy Card. Founder-named 2026-08-18 to pair with it: *a Strategy Card is what someone SAYS they will do; a Conduct Card is what a player DID.* Carries no baseline and no observer, and that is the defining property rather than a limitation — see **the second-argument rule** below. `src/utils/standardOfRecord/conductCard.js`. |
| **The second-argument rule** | Founder, 2026-08-18: *"My read on a villain is that he'll overfold to me. This villain profile has got zero elements of overfolding, overbetting, or overanything — it's his game in his terms, and that makes it not a read."* **"Over-" is a comparative operator** and needs a second argument. Three objects follow, separated by what that argument is: a **Conduct Card** has NONE ("I fold 89% here"); an **Appraisal** takes a STANDARD ("that fold was -EV", "6% off best response"); a **Read** takes HERO ("he overfolds *to me*"). Only the first makes no comparative claim, so only the first gets its own form — ADR-009 already binds the other two to Result Cards with declared `metrics` variants, and minting card types for them would create the second comparison path the ADR forbids. |
| **Mix** | A rule whose body is the FULL action distribution at a spot, with a Wilson interval on every share — never a majority label with the remainder discarded. Founder, 2026-08-18: *"if we allow for a rule to be to mix … we still [get] precision at lower rule count and less statistical variance by just giving it a mixing %."* Measured on villain 1 the moment it was wired: **34 rules → 15, coverage unchanged at 100%, accuracy 83.0% → 84.4%, rules with an interval wider than 30pp 4 → 1** — half the ruleset, tighter intervals, because the same decisions sit in one estimate instead of three. The residue is his range in that spot and is never rounded away. |
| **Mix verdict** | WHY a mix is not pure, from a closed list, mapped onto the exception verdicts the villain-archetype spec already names so the two registers cannot drift: `always` (empty exception set — the only verdict permitted to say "never"), `mix` (= `resolved-noise`), `hidden-cond` (= `resolved-subrule`; a feature DOES separate it but every cut lands under the sample floor, and the feature is named), `needs-cards` (= `unresolvable-here`; the revealed holdings separate it and nothing observable does, so the range-inference layer resolves it and more corpus never will). |
| **`separatorSearch`** | The declaration, required on every Conduct Card, of **how hard the card looked** before calling anything a mix: arity, correction, alpha. Load-bearing because on 2026-08-18 a rule published as a mix — *"nothing he could see separates this"* — was refuted by an independent search over **113,704 OR-combinations** at corrected `p = 0.024`, while each of the three disjuncts died alone under correction. The test was not wrong; it examined ONE FEATURE AT A TIME and the card did not say so. **A `mix` verdict means "no separator found at the declared arity", never "no separator exists"** — and a card that cannot state its arity lets the second reading pass for the first, which is WS-291's mechanism in miniature. |
| **Conduct occupancy bound** | A Conduct Card is dense where its subject played and silent where he did not, so **a best response computed outside his Occupancy measures the card's holes rather than the subject's weakness**. The bound rides on the card because the consumer most likely to misuse it is the one least likely to ask. Note the consequence for the founder's *"how close to equilibrium do they play"*: `Equilibrium` (SRC-013) does not exist, but **exploitability — what a best response wins against him — needs no equilibrium at all, only an explicit policy**, which is exactly what a Conduct Card is and what no prior object supplied. |
| **Deal Book** | A versioned, seeded, content-hashed hand set: a corpus slice or a generated set. |
| **Field** | Who occupies the other seats. |
| **Match** | Strategy Card × Deal Book × Field → Result Card. |
| **Result Card** | The standardized scorecard plus its replication manifest. |
| **Decision Atom** | One row per decision. **Aggregates are VIEWS over atoms, never the record.** |
| **Census** | The coverage record, *including contexts hit zero times*. **A zero is not one fact but three** (WS-328), and the census refuses to collapse them: `observed-zero` (examined, nothing occurred), `unexamined` (never looked at — carries a reason from a closed enum), `dropped` (reached, then discarded). Examination is **declared, never inferred**: a builder that read the hit map and called everything else a zero could not represent "we never looked" at all, which is how a coverage GAP comes to read as a measured ABSENCE. `src/utils/standardOfRecord/coverageCensus.js`. |
| **Atom set** | A finalized, append-only, content-addressed batch of atoms, living **outside git** and referenced from a Result Card by `atomSetHash` alone — never by path, so relocating the store cannot invalidate a card. `resolveAtomSet` returns an explicit failure reason (`not-found` \| `hash-mismatch` \| `truncated` \| `unreadable`) rather than an empty list: a missing store and a run with no decisions must not produce the same confident zero. `scripts/backtest/atomStore.mjs`. (WS-328) |
| **Atoms self-check** | The standing check that every captured field has at least one **reader**, run after every Match. Enforced by SCHEMA DIFF, not discipline — add a field to `SOR_SCHEMAS.decisionAtom` without registering a reader and the next run fails. Each reader declares a `READER_DEPTHS` value and the check reports the MIX, because proving a field is *queried* does not prove the query was the right one. `scripts/backtest/atomsSelfCheck.mjs`. (WS-328) |
| **Anchor generation** | Which Deal Book a Result Card stands on. The anchor is **Deal Book + Field + metric definitions**; the engine version is an INPUT recorded on the card, never part of the anchor, so an engine upgrade is a re-run whose delta is attributable to the upgrade. A new Deal Book is a new generation, and every prior card is re-run onto it so the Ladder **rebases rather than resets**. `ladder.assertComparable` throws across unrebased generations, because a fragmented ladder is visually indistinguishable from a sound one. (WS-328) |
| **Ladder** | The persistent comparison across all Result Cards. |
| **Warrant** | Why a rule says what it says: `equity` \| `structure` \| `read` \| `fear`. |
| **Residual clause** | A Card's declared fallback for states its named rules do not reach. |
| **Pier post** | One of the two references a strategy is *located between*, and neither is ours: the **upper post** is Pool Best Response, the **lower post** is Equilibrium. The point of defining them by the population and the equilibrium is that a strategy's position survives an engine upgrade — improve the engine and the raw bb figure moves, but the posts do not. (WS-331) |
| **Pool Best Response (PBR)** | The max-EV response to the mined Field — the **upper pier post**, and the answer to "how much was there to win here at all?". A `Declared` surface (`pool-best-response`), because it is an authored rule that consumes a Field, not a description of one. Held out by construction: fit on POOL, evaluated on EVAL, refused otherwise. **Maximally exploitable by construction and never to be played** — being a best response is exactly what makes it counterable for free. (WS-331) |
| **Exploitation efficiency** | A strategy's edge over the Field as a fraction of PBR's edge over the Field — *of the money available beyond playing like the field, how much did we get*. A ratio of **edges**, never of raw values: raw values are dominated by the Field's own baseline and would sit near 1.0 for any two strategies. Not clamped — below 0 (loses to the field) and above 1 (beat the one-step ceiling) are both real readings. A standard Result Card field. (WS-331) |
| **Exploitation premium** | `EV(PBR) − EV(Equilibrium)` — how much money exists *specifically because the pool is bad*, as opposed to because hero plays solid poker. Currently **unavailable** and reported as such: the lower post (SRC-013) does not exist, and chart-derived substitutes are refused by a throw, not a warning. (WS-331) |
| **Position** | What a strategy resolves to instead of a number: exploitation efficiency (x) plus its own exploitability (y). The builder **refuses a bare scalar**. Only the Field's y is measured today — it *is* PBR's edge, by construction; every other surface's needs the WS-326 simulator and ships `null` with that reason. (WS-331) |
| **Disclaimer** | The standing statement of the **estimand** — what was substituted, over what horizon, against which opponents, on which population, in what units, with what cluster unit. Not boilerplate and not modesty: it is what a Result Card MEANS, and `DISCLAIMER_TREATMENT` is it in one reusable line. (WS-330) |
| **Suspected-Fault Register** | The **ranked** list of where the fault most likely is. Each entry carries a mechanism, a site, what it contaminates, a **falsifier**, and a status. Ranked by **expected damage = probability × contamination breadth** (founder, 2026-08-04) with both components shown — not by probability alone, which buries the unlikely-but-total entries. A flat caveat list is read once and ignored; a register with falsifiers is a work queue. (WS-330) |
| **Fault site** | Where a fault lives: a Stack layer, or one of `corpus` \| `instrument` \| `statistics` \| `process`. Not every fault is layer-local — a stale corpus is not a bug in the equity layer — and forcing one into a layer slot means it gets looked for where it is not. (WS-330) |
| **Contamination** | Which results an entry would taint. Carried **twice**: as prose for a human, and as a `matches(card)` predicate over fields a Result Card already carries. The predicate ships WITH the entry so a new card is classified the moment it exists — asking card authors to declare their own exposure is the pattern that rotted three times already. (WS-330) |
| **`suspect-pending-review`** | The flag a Result Card carries once a fault it depended on is **confirmed**. It does **not** mean the card is wrong — it means the conclusion rested on something now shown to be faulty and nobody has re-checked it. The action it asks for is a re-check, not a retraction. This is the retroactive invalidation trail WS-291 did not have. (WS-330) |
| **Register version** | `FR-1+<content hash>`, stamped into every `manifest.disclaimerRegisterVersion`. The hash is what makes it honest: edit any entry and the version changes whether or not anyone remembered to bump anything. Same argument as stamping `contentHash` in the Strategy Card loader. (WS-330) |
| **Equity operator** | The 169x169 all-in preflop equity matrix `M` read as an operator on the range grid, indexed by `rangeIndex` so it and every range grid share one coordinate system. Engine-independent: a property of the deck, not of this repo's model. `src/utils/pokerCore/equityOperator.js`. (WS-337) |
| **Skew part** | `S = M - 1/2`. **Exactly** skew-symmetric, because `E(a,b) + E(b,a) = 1`. Everything below is a theorem about skew operators, so the antisymmetry residual is the premise and is asserted, never assumed. (WS-337) |
| **Rotation plane** (cyclic plane) | One of the canonical 2-D invariant blocks of `S` (Youla / real Schur form), with a magnitude `sigma_k`. A rotation in range space is a cycle, so each plane is one rock-paper-scissors structure with a size attached. 169 is odd, so there are at most 84. **The plane and its magnitude are the invariants; the two axes inside it are an arbitrary basis choice and must never be used to rank hands.** (WS-337) |
| **Strength ladder** (transitive part) | The orthogonal projection of `S` onto `{S_ij = f_i - f_j}` — the matrices a pure ranking can produce. Not a fitted model: the potential is exactly `f = S w` = average equity minus 1/2. A purely transitive game is already **rank 2**, which is why a low-rank finding means nothing without the split. (WS-337) |
| **Intransitive residual** | `R = S - T`, orthogonal to every strength ladder. The part that makes poker a game rather than a ranking. Measured at 25.99% of skew energy, and far *less* compressible than the whole operator. (WS-337) |
| **Intransitivity map** | Per hand class, the RMS cyclic edge it carries against a randomly drawn opponent hand, in percentage points — the equity no strength ladder can express. A committed 169-cell grid, not a number in a ticket. (WS-337) |
| **Compression claim** | A claim that `k` planes suffice. Must carry **energy share AND reconstruction error AND the transitive/intransitive split**, plus boards, seeds, basis and the plane threshold. `buildCompressionClaim` refuses an incomplete one in code — energy share alone flatters every low-rank claim, and "low rank" restates "there is a strength ladder" without the split. **Deliberately NOT a Result Card:** a Match is `Surface x Deal Book x Field`, and this claim has no surface, no strategy and no opponent population — it is a property of the deck. Minting a Card would mean inventing a `fieldId` for a measurement that has no field. Scoring the basis *against* the 169-cell grid on corpus data would be a comparative claim about model quality and **does** need one. (WS-337) |
| **Noise replica** | `(S_A - S_B)/2` from two independently seeded builds: statistically identical noise to the signal matrix `(S_A + S_B)/2`, and therefore a **measured** floor for what counts as a significant plane. A plane count without one is a taste judgement wearing a number. (WS-337) |
| **Scored Readout** | The standardized shape every scored run reports — six **views** over the persisted Decision Atom set, all denominated in EV. Founder directive 2026-08-05. It is not a new artefact: it is the declared shape of a Result Card's `metrics` block. **DECLARED as of WS-434 (2026-08-14):** `metrics` is a discriminated union keyed on `metrics.kind` (one kind per producer, the `RC-<slug>` family slug), each variant registered in `SOR_SCHEMAS` under `metrics.<kind>` (metricsSchemas.js) and validated by `metricsProblems` (metrics.js) on the publish path — pre-WS-434 cards stay legible to audit, invalid to publish, the `disclaimerRegisterVersion` asymmetry. **The record is the product and the readout is a view over it** — if a new decomposition question requires re-running, the record was the wrong shape. Spec: [SCORED-READOUT-SPEC.md](SCORED-READOUT-SPEC.md). |
| **Metrics Kind** | The union discriminator of a Result Card's `metrics` block (WS-434). Twelve registered kinds, one per producer; a new estimand family declares a new variant in `metricsSchemas.js` (own version, every field with a `unit` and a note) BEFORE emitting it — the strict publish check refuses an undeclared top-level key. The canonical conditioned-count shape is `{k, n, rate, conditional}` (`metrics.shared.conditioned-rate`): `rate` null exactly when `n` is 0, `conditional` an English `P(event \| conditioning)` statement, with the INVERSE conditional reported wherever the two readings support opposite reads (fold-curve precedent). |
| **`overallEvBB100`** | The headline optimizable figure: `edgeBB × opportunitiesPerHand × 100`, big blinds per 100 hands, of our play over the Field. An **additive per-decision edge budget, NOT a winrate** — it sums one-decision substitutions and therefore assumes additivity (`FAULT-horizon-bias`). Both factors are always printed separately, per POKER_THEORY §14.2. Not to be confused with `ipsEstimator.edgeBBPer100`, which is a bare `× 100` rescale with no denominator change and is deprecated. |
| **Branch** | The reporting unit of the change ledger: `street × facingAction × isIP` — a **projection of the situation key**, not a parallel taxonomy. Its audit-level refinement is the **cell** (full `situationKey` + carried geometry), which rides on every atom and is reported only when it clears the power gate. |
| **Change ledger** | The per-branch, EV-denominated decomposition of the difference between two runs on an identical decision set. Reports **NET** (`Σ Δ_b`, equal to the headline delta by construction) and **GROSS** (`Σ |Δ_b|`) together; `GROSS/|NET|` near 1 means the change moved the tree one way, and a large ratio means it **redistributed** — helped one street, hurt another — so a NET near zero is a cancellation, not an absence of effect. **NET is never published without GROSS.** |
| **Stratum** | A quantile interval on a *measured, separability-proven* behavioural axis — the replacement for a named archetype. Each stratum carries its own separability evidence from the same run (χ²/df against a same-run control, between-player SD, split-half reliability, disjoint-control cross-correlation), or it gets **no row**. The pool is a continuum with one dominant axis (k-means `bestK = 2`, silhouette 0.343), so discrete type names would re-import thresholds the data cuts through. |
| **Leak** | EV given up by the pool, reported **per stratum**, never as a bare per-player ranking — at 35–51 observations per player a ranking of measured leak is a ranking of noise. Two definitions, ranked: **exploitable edge** (`estimateEdge` restricted to a stratum; realized-chips anchored; PRIMARY) and **self-leak** (`EV(best) − EV(taken)` under our own model; engine-graded, therefore a labelled DIAGNOSTIC). Per-player figures exist only as posteriors shrunk toward their stratum, with intervals. |
| **Hole Map** | The **seventh** view of the Scored Readout: the price of the branches the field leaves untaken. Views 1-6 measure how good our action is on branches the pool *takes*; the Hole Map is the inverse. A line the field almost never faces has no defence constructed against it, so the hole in the action distribution **is** the exploit. Not a second instrument — a view over the same Decision Atom set. Spec: [SCORED-READOUT-SPEC.md](SCORED-READOUT-SPEC.md) §9bis. (WS-411)
| **Hole** | One `(spot, action)` pair the field leaves largely untaken, carrying its **required fold %** (pot geometry), its **predicted fold %** (the measured field curve), the **gap** between them in bb, and **two separate n's**. A hole is identified by SORTING, never by a frequency cutoff — an n-threshold would be a hidden editorial decision about what is worth attention, and low-frequency/high-magnitude structure is exactly what the view exists to surface. (WS-411)
| **Required fold** | The breakeven fold frequency for a hand with **zero equity when called**: `s/(1+s)` for a bet of `s`x pot, `R/(R+P+B)` for a raise to `R` over a bet `B` into pot `P`. Exact arithmetic with no data behind it and none needed. The zero-equity premise is load-bearing and named: **a negative gap means "does not pay AS A PURE BLUFF", never "does not pay"** — a semi-bluff needs fewer folds and a value hand needs none. (WS-411)
| **Predicted fold** | The field's **measured** fold rate at that geometry, with per-bin `k`/`n`, read from the hold-out half. Deliberately NOT the engine's modelled curve: the fold-curve **shape is fit** (WS-283, Brier-minimised, hold-out validated on n=318,347) but its **level is not** (`POPULATION_FOLD_RATE = 0.45`, unfitted under the live/online separation), so the modelled curve cannot price a hole without importing an assumed anchor. The facing-a-**raise** arm was fit separately and **never merged**, and is read directly rather than substituted from the facing-a-bet curve. (WS-411)
| **Fold gap** | `predicted - required`, in points, times the EV slope `(amount won on a fold) + (amount risked)` to reach bb. An **upper bound that decays with use**: the measured fold rate is conditioned on the bets the field *actually made*, so a bluff added to the tree is a bet the field did not face, and against an adapting defender the rate falls toward the required one. The corpus cannot measure the decay — it holds no counterfactual in which hero bluffed more. (WS-411)
| **Denomination** | The rule that a gap ships with its **rate** or it is unactionable. Three quantities, never one: gap per occurrence (bb), occurrence rate (per 100 hands, over **seat-hands** so a 9-handed table's activity is not read as one player's frequency), and their product in bb/hour at a **stated** pace. Rows sort by the third, which disagrees with sorting by the first — a large gap at a rare spot loses to a modest gap at a common one. The bb/hour conversion is itself a **transfer**, since online and live table pace differ by multiples. (WS-411)
| **Disjointness refusal** | A total across hole rows is **refused** when the rows share a spot node, because nine sizings at one node are nine alternatives to one decision, not nine addends. Enforced in `sumDisjoint`, not by discipline. The defensible aggregate is a **portfolio** — the best-priced line at each disjoint spot — and it is a **ceiling**, since it assumes every untaken branch is converted at the fold rate the field showed against the bets it actually faced. (WS-411)
| **Revealed-preference prior** | The standing rule for reading a negative result on a line results-tracking winning players demonstrably use (triple barrel, triple-barrel-then-river-raise, check-raise, check-raise-fold, escalating value sizing). **If the instrument reports such a line is -EV, the leading hypothesis is that the MODEL of the line is wrong, not that the line is wrong.** Encoded as data + a classifier (`PRACTITIONER_REPERTOIRE`, `classifyGap`), never as prose, because the default reading of a negative number is the opposite one. (WS-411)
| **`model-suspect`** | The verdict a negative-gap row receives instead of `line-unprofitable` when the line is practitioner repertoire. It **names the defective component** — a flag that does not name a suspect is a shrug. It is a defect report against the instrument, not advice to drop the line. (WS-411)
| **Outcome-anchored arm** | The engine-free half of the Hole Map: scan a bounded corpus slice for hands where a named line **actually occurred** and report realized chips, with the line's own opportunity denominator. Exists because the model half rests on a component under suspicion, and because a hole has `pi_pool ~ 0` **by definition** — so the weight explodes or clips, variance goes as magnitude², and counts are tiny: **the lines most wanted are precisely where importance-weighted estimation is structurally weakest.** Carries four ranked confounds, the severest being that **a realized mean is not the incremental EV of adding the line** — holding and decision are confounded and the corpus holds no counterfactual. (WS-411)
| **Guide** | A **VIEW**, never a record: a rendering of a Strategy Card + Occupancy + Resolution + Census at one stated conditioning set. Its authority is the replication manifest of the Result Cards it views and it has **no other source**. Its title is its **Disclaimer written longhand** — the slots are the estimand. Form: [GUIDE-STANDARD.md](../guides/GUIDE-STANDARD.md). Program: `prog-guide-authority`. (2026-08-16) |
| **Slot rule** | A word may leave a Guide's title only if the Guide carries **(a)** the set of Guides it marginalizes over and **(b)** the **Weighting** it did so under. "Guide to QQ" is not a shorter "Guide to QQ vs tight-passive" — it is an *average over opponent types weighted by how often each is faced*, which is a substantive empirical claim about the Field. Deleting the word without carrying the weighting is the WS-291 mechanism reached faster than by building a bad instrument, and the output reads **more** authoritative rather than less. **An unnamed slot is worse than an open one** — the reader supplies a default unconsciously and nothing marks the claim as marginalized. (2026-08-16) |
| **Occupancy** | The measure over the situations a subject **actually lives through**, given a Field — not the ones it could meet, the ones it does, weighted by frequency. The section a chart does not have, and its absence is what makes a chart a chart: a policy says what to do at a node, Occupancy says which nodes you will stand at. A property of the subject **and the population it is played into**, so two players with identical strategies have different Occupancy if their tables differ — which is why a Guide can be proprietary where a chart cannot. Always Field-stamped; an Occupancy figure from the 2009 online corpus is **transferred, not measured**. (2026-08-16) |
| **Resolved / unresolved node** | A node is **resolved** when the correct action is forced — alternatives separate by more than the measurement can confuse them — and **unresolved** when the choice is genuinely live and something outside the node must decide. Inherited, not coined: `hand-class-99-TT-JJ.md` §6 already labels a spot `UNRESOLVED` and states that *"that label is a result, not a gap."* Requires an indifference criterion; the neutral-zone machinery is **postflop-only** (POKER_THEORY §15.2) and a preflop criterion does not exist yet. (2026-08-16) |
| **Decision Load** | The **Occupancy-weighted mass of unresolved nodes** — the part of a subject that is a decision rather than an execution. The content of "playing TT" as distinct from "the TT chart". Rests on `AS-730`: load is **not** proportional to Occupancy, i.e. genuinely-chosen decisions concentrate in nodes occupied relatively rarely, while the most-occupied nodes are disproportionately forced. **If AS-730 is false a Guide collapses into a chart with prose around it** and the form has no reason to exist. Status `proposed`, never tested. (2026-08-16) |
| **`unexamined` in a Guide** | Founder ruling 2026-08-16: a Guide cell with **n=0 reports `unexamined`** and does **not** inherit the general Guide's value. Chosen over shrinkage deliberately — Guides become visibly holey and the holes become the work queue (`AS-732`). Note this **inverts** the range engine's subclass direction (child shrinks toward parent, DEC-025 Amd 1); the two coexist because they are different operations — shrinkage answers *estimation under sparse data*, the Guide lattice answers *marginalization of a measured joint*. (2026-08-16) |
| **Lesson** | **NAME COLLISION — AWAITING FOUNDER RULING.** Founder used *"I want this to be a lesson"* on **2026-08-17** for a **villain-facing drill** compiled from a `read` warrant (WS-539: *a drill question and a strategy rule are the same object read from opposite sides*), and again on **2026-08-20** for a **hero-facing session-locked prescription** (WS-587, defined in the next row). Two distinct objects, one word, in the register that exists to stop exactly this. They **compose** — a Lesson's `Activity` resolves to a WS-539 drill item — so the proposed split is **Drill** for the WS-539 object (the word that ticket already uses for its output) and **Lesson** for the WS-587 object. Do not use the bare word in new work until this is ruled. |
| **Lesson** (WS-587 sense) | A **session-locked, pre-registered prescription** whose subject is HERO: one spot, the measured gap at it, the off-table **Activity** that addresses it, its expected EV recovery in bb/100, and its **falsifier** — the measurement that would show it worked. Written at session close and never edited; a revision is a *new* Lesson that supersedes, so the ledger records what was actually believed then. Founder, 2026-08-20. Being a comparative claim (*the most valuable* activity) it is an **Appraisal** and resolves to a Result Card with a declared `metrics` variant — it does **not** mint a card type, per the second-argument rule. Ranks on `gap x Occupancy`, never gap alone (`AS-730`), and **emits nothing rather than a ranking of noise** when n cannot support one. STATUS: defined here, implemented nowhere — WS-587. |
| **Lesson Ledger** | The persistent record of Lessons across sessions with each one's later score — the analogue of the **Ladder**, whose subject is hero rather than a strategy. Answers, over a season, *did our own advice make money* — the hero-EV question pointed at the founder. STATUS: WS-587. |
| **Recovery** | A Lesson's score: realized EV change at its spot, measured as **Divergence** between hero's Conduct Card at lock time and the next one, *restricted to that spot*, direction taken from the time ordering. Carries an **in-hero control** (change at spots the Lesson did **not** name), because hero chose what to work on and attention contaminates the result. Reports `unexamined` until an accumulating window clears a stated minimum — a Ledger mostly reading *not yet scoreable* is the correct early state. STATUS: WS-588. |
| **Activity** | The executable form a Lesson prescribes — a drill, a range-study block, a hand review. Something hero can **do**, never a fact he should know. Scored on the same metric as the engine's own recommendation, per the standing rule that a novel method hero can execute beats a right answer he cannot. STATUS: WS-587. |

### The four surface kinds

Three of the five surfaces FSA registers are the *same kind of object measured on different
populations*, which is why comparing the Fields to each other **is** the live-vs-online transfer
question.

| Kind | Origin | What it is |
|---|---|---|
| `Equilibrium` | imported | What an unexploitable opponent does. SRC-013 — **does not exist yet**, and is left unavailable rather than faked. |
| `Field` | observed | What a population does. SRC-011/012 (HandHQ, 2009, online), SRC-005 (Ignition, current), SRC-014 (live 1/3). |
| `Read` | fitted | What our model believes *this* villain does. **NAME COLLISION, recorded rather than renamed:** this definition is the **Conduct Card**'s object, and the word is wrong — poker reserves "read" for the relational claim ("he overfolds *to me*"), which is an Appraisal/Read Result Card, not a surface. The enum is shipped and frozen, so **code-`Read` means Conduct**. |
| `Declared` | **authored** | What someone said they would do, on purpose, with reasons. **The sixth surface, added by WS-322.** |

The first three are observed, fitted, or imported. None could be *declared* — that absence was
the gap ADR-009 closes.

### The four warrants

| Warrant | Settled by | Note |
|---|---|---|
| `equity` | arithmetic over hand equity vs a range | |
| `structure` | arithmetic over pot odds, SPR, position, who is left to act | |
| `read` | **a falsifiable claim about a population number** | Should state the claim, so it can be scored. |
| `fear` | the author, admitting it | See below. |

**Why `fear` is legal.** The instinct is to disallow it. But **you can only measure what authors
will admit to** — outlaw the warrant and fear does not leave the card, it hides inside an
`equity` rule whose arithmetic does not support it, where nothing can find it. Declared, it
becomes measurable: *how much of this card's EV comes from rules its own author labelled fear?*

**Declared, then audited.** Declaring invites honesty but catches only the honest. The
counterpart is a derived test — an `equity`-warranted rule that deviates toward passive in the
MEDIUM band with no arithmetic justification is behaving like fear regardless of its label.
`warrant.derivedVerdict` is the slot that test writes into. WS-322 ships the slot; **WS-327
ships the detector.** `null` means *not yet audited*, which is a different fact from *audited
and agreed*.

---

## Naming, resolved

- **`surface_kind`, not `surface_class`.** `docs/provenance/data-source-registry.md` already
  uses `surface_class:` on all fifteen SRC entries to mean something else entirely —
  `internal_db | vendor_api | derived | reference_data`, i.e. what kind of *store* a source is.
  That register is promoted and shipped first, so the new axis takes the new name. Founder
  decision, 2026-08-02.
- **`surface`** keeps FSA's meaning in measurement code. The **UX** meaning stays scoped to
  `docs/design/surfaces/`. No third meaning.
- **`MDF`** is **Mass Data Field** (SRC-012 raw / SRC-011 aggregates). `MDA` is retired for the
  pool — it already means Market Dynamics Analysis in the governance layer. Note the separate
  collision: MDF also means *minimum defense frequency* in POKER_THEORY §6.2; context
  disambiguates, and measurement code should prefer "Mass Data Field" spelled out.
- **Geometry cells may be named as vocabulary and never branched on as inputs.** A geometry-cell
  name used as a decision input is `if (position === 'EP')` in new clothes.

---

## Schema versions

All schemas are **ADDITIVE-ONLY**, the same discipline as the IDB migration rule. Fields are
appended, never removed and never retyped; an obsolete field is marked `deprecated` and left in
place so an existing reader gets `null` rather than a crash.

| Object | Version | Defined in |
|---|---|---|
| Strategy Card | 1 | `src/utils/standardOfRecord/schemas.js` |
| Conduct Card | 1 | ″ |
| Decision Atom | 2 | ″ |
| Coverage Census | 2 | ″ |
| Deal Book manifest | 1 | ″ |
| Field manifest | 1 | ″ |
| Result Card | 1 | ″ |
| Fault entry | 1 | ″ (WS-330) |

Enforced by `src/utils/standardOfRecord/__tests__/schemas.test.js`, which pins a baseline of
every shipped field, AND by `scripts/check-sor-additive.sh` (WS-328) — the sibling of
`scripts/check-idb-additive.sh`, diffing the live schemas against
`scripts/standardOfRecord/schema-baseline.json` and failing on any removal or retype. It
delegates to node rather than grepping because, unlike `deleteObjectStore(`, deleting a field
descriptor leaves no token to search for. The repo-wide invariant that scans docs and session
notes for unresolved figures remains **WS-329's**, which is where the standard becomes binding.

---

## The replication manifest

Every Result Card carries one. Each field is here because its absence would make the number
unreplicable.

| Field | Why |
|---|---|
| `engineCommit` | **Nothing in the repo captured this before WS-322.** Every prior published figure names the code that produced it only by implication. |
| `engineDirty` | A dirty tree means the commit does *not* identify the code that ran. |
| `dealBookHash` | A path or a file *count* cannot detect that the corpus changed underneath a rerun. |
| `fieldVersion` | Which opponent model, at which version. |
| `partition` | POOL/EVAL split and the walk-forward prefix. |
| `seeds` | Every seed **actually used**. A default that is never recorded is reproducible-by-luck. |
| `unseededSources` | Randomness the run could **not** seed. An empty array is a *positive claim* of bit-reproducibility. |
| `constants` | Minimum set: `PRIOR_WEIGHT`, `ACTION_TAU_FRACTION`, `MIN_CONTINUATION_WEIGHT`. A floor, not a schema — stamp whatever else a run depends on. |
| `knownDivergences` | Where a stamped value is known to have a shadow copy elsewhere. `agrees: null` means the shadow could not be read, which is not the same as disagreement. |
| `disclaimerRegisterVersion` | Which [suspected-fault register](DISCLAIMER-AND-FAULT-REGISTER.md) the run stood under. **A card without one is invalid** — confirming a fault later could not otherwise tell which prior results it invalidates. One deliberate asymmetry: the schema field stays optional so `checkAgainstSchema` can still *parse* a legacy card, because the flagger has to open an old card in order to flag it. Validation tightens; reading does not. (WS-330) |

### Transfer risk: rake-driven conclusions (WS-333)

Rake enters the derived floor via `estimateRake` with no-flop-no-drop honoured, and the
steal-vs-defend asymmetry is emitted as an explicit quantity. **It does not transfer between
pools.** Measured on the same spot (BB defending 1.5 into 4bb vs a 2.5x BTN open, 100bb):

| Pool | Rake config | Extra equity the defender needs |
|---|---|---|
| Live 1/2 | 10%, $8 cap | **+4.8pp** |
| Online corpus (SRC-012) | 5%, $3 cap | **+2.3pp** |

A rake-driven conclusion measured on the 2009 online corpus therefore understates the live
effect by roughly half. Any claim of this shape must state which pool it was measured on.

**Second limit, larger:** rake is **inert on the live app path** — `liveHandState.rakeConfig`
is read (`useLiveActionAdvisor.js:162`) and never written, and `GAME_TYPES[ONE_TWO].rake` is
never mapped into an engine config, so `estimateRake` returns 0 on every live decision. The
corpus instrument applies rake; the live advisor does not. Filed separately, not fixed in
WS-333.

### AS-711 (geometry pooling) — first measurement, 2026-08-02

`scripts/backtest/run-geometry-ablation.mjs`, 4,132 paired EVAL decisions, 50NLH:

- **Street contribution +0.0164 log-loss, CI [0.0063, 0.0265] — excludes zero.** Adding
  `street` back to a geometry ladder made prediction **worse**. Street helped in **0 of 14**
  well-sampled cells. AS-711 is **not refuted** and is mildly supported.
- **But no arm admissibly beat `ctrl:pooled`** (facing-action only) at this sample —
  geometry-only had the lowest log-loss (0.7507 vs 0.7620 pooled) with a CI touching zero.
  So the dimensions have not yet collectively earned their place, which echoes WS-285's
  finding that street, texture and posCategory were each worse than pooling.
- **One site.** POKER_THEORY's standing rule applies: *a single-site result is a hypothesis;
  two sites agreeing is a finding.* Re-run on FTP before treating this as settled.

**Known limit, stated rather than implied.** The hero-EV instrument is **not bit-reproducible**:
`heroPolicy → evaluateGameTree → handVsRange` reaches `pokerCore/monteCarloEquity`, which calls
`Math.random()`. Two runs over the same Deal Book with identical seeds agree to within Monte
Carlo noise, not exactly. Do not read a small difference between two Result Cards as a change.

---

## What WS-322 deliberately did NOT build

> **CLOSED by WS-350 (2026-08-05).** FSA Phase 3 landed. `src/utils/standardOfRecord/divergence.js`
> is the one comparison path, and open question #2 was answered *by measuring both candidates on
> the same volume* rather than by choosing one. The paragraph below is kept as written because it
> records why the gap existed for three tickets, which is the more useful fact.

**No comparison path.** FSA Phase 3 — the divergence instrument — does not exist in code; Phase 1
(the situation key, `src/utils/pokerCore/situationKey.js`) is the only phase that does. ADR-009's
guarantee is that `Declared` is scored by the *same* instrument as the other four and that no
second path is permitted. From here, the way to honour that is to build **no comparison at all**:
register the surfaces, define the interface Phase 3 will consume, stop. Building one now would
create the second path the ADR forbids, and would do it before FSA's open question #2 — *what is
the divergence function `d`?* KL versus EV-difference, "decide in Phase 3, measure both" — has
been answered.

Also not built here, and owned elsewhere: the Decision Atom **store** and the Census
**computation** (WS-328 — **both now shipped**: `scripts/backtest/atomStore.mjs`,
`src/utils/standardOfRecord/coverageCensus.js`, `scripts/backtest/atomsSelfCheck.mjs` and
`scripts/backtest/ladder.mjs`, exercised end to end by `scripts/backtest/run-atoms.mjs`), the population simulator (WS-326), the 169-cell Entry Map (WS-323),
stack-registration refusal (WS-324), the derived-fear detector (WS-327), and flipping the
invariant from advisory to enforcing (WS-329).

---

## Using it

```js
import { loadStrategyCard, evaluateCard } from '@/utils/standardOfRecord';

const card = await loadStrategyCard(myCardObject);  // throws on anything malformed
const out  = evaluateCard(card, situation);
// { action: {call: 0.7, ...}, ruleId, warrant, residual, abstained, reason }
```

A Card is a **plain JS module exporting a data object** (`*.card.js`) rather than YAML — the repo
has no YAML parser, and a Card must load in the browser as well as the Node harness. Adding a
runtime dependency to parse a format we control was the worse trade. `rationale` is a *required
field* rather than a comment for the same reason: prose that matters should be data, and it is
hashed with the rest of the card.

**The loader rejects; it does not warn.** Missing residual clause, a positional string key, an
axis outside the situation key, a warrant outside the enum, a distribution that does not sum to
1, a duplicate rule id, a schema version from the future. There are no legacy Cards to
grandfather, so a malformed card is a bug at the author, today.

See `src/utils/standardOfRecord/__fixtures__/` for a valid card and a deliberately unenclosed one.

---

## Atom store operations — location, measured sizes, and the beliefState budget (WS-430)

Measured 2026-08-07 on the WS-328 gen-1 set and by `scripts/backtest/run-beliefstate-size.mjs`
(re-runnable; deterministic seeds). This section is the D2 input: what capturing `beliefState`
would cost, against the disk that exists.

### Where the store lives, and how to move it

`DEFAULT_ATOM_STORE_ROOT` (`scripts/backtest/atomStore.mjs:55`) is
`C:/Users/chris/data/sor-atoms`, overridable with the **`SOR_ATOM_STORE`** environment
variable. Atom sets are referenced from Result Cards **by hash, never by path**, so relocating
the store cannot invalidate any card — set the variable, move the directory (including
`index.ndjson`), done.

**Drive inventory (2026-08-07):** the machine has ONE physical disk (512 GB NVMe, WD SN740).
`C:` is 453.7 GB with **48.8 GB free (89% used)**. The only other lettered volume, `G:`, is the
Google Drive virtual mount (cloud-backed, 100 GB quota, 46.4 GB free) — it reports as a fixed
drive but is streaming cloud storage and is **not a suitable home** for an append-only
bulk store that gets rewritten as `.gz` sidecars and hash-verified on read. **There is no
relocation target today.** When a second physical drive is added, set `SOR_ATOM_STORE` to it
(e.g. `setx SOR_ATOM_STORE D:/data/sor-atoms`), move `C:/Users/chris/data/sor-atoms/*` there,
and nothing else changes.

### Measured atom sizes (real store, not estimates)

The WS-328 gen-1 set: 97,454 atoms over 20,800 hands (**4.6853 atoms/hand**), 82,294,703 B
raw = **844.4 B/atom**; gzip sidecar 1,709,596 B = **17.5 B/atom (48x)**. The atomStore
docblock previously claimed "~1-2 KB each" — that figure was a shape argument and is wrong;
the docblock now carries the measured number. Note the store keeps the `.ndjson` AND its `.gz`
sidecar side by side, so on-disk cost is the **sum** of the raw and gz columns below.

### beliefState: measured cost per encoding (WS-430)

**No producer writes `beliefState` today** — 97,454/97,454 atoms carry `beliefState: null`.
The numbers below are from real 169-class `getPopulationPrior` grids with per-atom
deterministic drift, written through the real `openAtomWriter` path into a throwaway store
(`run-beliefstate-size.mjs`, n=256 atoms per cell). Packed encodings:
`scripts/backtest/beliefStatePacking.mjs` (f32 = lossless float32, 676 B/grid binary;
q8 = uint8 quantized against a per-grid scale, 169 B/grid binary, max error scale/510).

Per-atom cost, store-level delta vs a `beliefState: null` control (B/atom):

| players remaining | verbose raw | verbose gz | f32 raw | f32 gz | q8 raw | q8 gz |
|---|---|---|---|---|---|---|
| 1 | 4,337 | 1,733 | 1,015 | 671 | 365 | 182 |
| 3 | 13,063 | 5,282 | 2,865 | 2,007 | 916 | 482 |
| 5 | 21,715 | 8,866 | 4,715 | 3,342 | 1,469 | 842 |
| 8 | 34,835 | 15,159 | 7,490 | 5,340 | 2,296 | 1,264 |

Measured ratios vs verbose: **f32 4.3–4.7x raw / 2.6–2.8x gz; q8 11.9–15.2x raw /
9.5–12.0x gz**. Two shape-argument corrections: verbose JSON measured **~4.3 KB/opponent**,
not the 1.2–2.4 KB previously argued (full-precision doubles under 169 named keys), and the
"676 B/grid" f32 figure is binary payload — embedded in NDJSON it costs ~1,015 B/opponent
(base64 4/3 expansion plus JSON wrapper).

### Full-corpus projection vs headroom (the D2 input)

Projected corpus: 4.6853 atoms/hand x 1,070,493 hands = **~5.02M atoms**. If every atom
carried `beliefState`, added store cost (raw + gz sidecar both on disk):

| avg live opponents | verbose (raw+gz) | f32 (raw+gz) | q8 (raw+gz) |
|---|---|---|---|
| 1 | 28.4 GB | 7.9 GB | 2.6 GB |
| 3 | 85.7 GB | 22.8 GB | 6.5 GB |
| 5 | 142.8 GB | 37.6 GB | 10.8 GB |
| 8 | 233.5 GB | 59.9 GB | 16.6 GB |

Against **48.8 GB free on C:** (the only disk): verbose does not fit beyond ~1 avg opponent
and would fill the drive; **f32 fits up to ~3 avg opponents but consumes half the remaining
headroom; q8 fits at every table size** (worst case 16.6 GB, and a realistic average is 2–4
live opponents per decision, i.e. **4–9 GB**). q8's max quantization error (scale/510 —
under 0.2% of the grid's peak propensity) is far below any claim this system's propensities
can support, per the fault register.

### fullSampleRate is recorded, not enforced

`fullSampleRate` is stamped on every atom-set manifest (`layerAblation.mjs:510` records `1`;
`run-atoms.mjs:134,230` record `0`) but **no producer reads it to decide what to write** —
it is provenance, not a sampler. The deterministic sampling primitive exists
(`samplesFull(atomId, rate)`, `src/utils/standardOfRecord/decisionAtom.js:109`, exported and
tested) but has **zero production callers**. Building a real sampler means wiring
`samplesFull` into a beliefState-writing producer — that is new code, not a flag flip.
Per WS-430's ruling, sampling was NOT implemented here; the measurement above is what makes
the sampling-vs-full decision an economics question rather than a shape argument.
