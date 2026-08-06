# Measurement Oversights — the checklist for any task that computes a number

**What this is.** Ten recurring ways this repo's numbers have gone wrong. Each is stated as a
question you can answer about the code in front of you, with a live instance at file:line and a
falsifier. This is the payload of the `math-measurement` context bundle
(`.claude/context/bundles/math-measurement.yaml`); read it before touching an estimator, a
confidence, a detector, or a Result Card.

**Every entry below was re-verified against HEAD (`fe716f59`, 2026-08-05) by reading the code.**
Where the claim as originally put to me was wrong, the correction is recorded in the entry rather
than quietly fixed — four of the ten were overstated on first telling, and the pattern of *how*
they were overstated is itself one of the oversights (MO-11).

**Status vocabulary.** `LIVE` — the defect is in shipping code now. `GUARDED` — the defect
occurred, and a test or register entry now catches recurrences. `DOCTRINE-ONLY` — the rule exists
in prose with no mechanical enforcement.

---

## MO-1 · Labels used as decision inputs when they are outputs — `DOCTRINE-ONLY`

**Ask:** does this code branch on a position label, a bucket label, or a style category, where
equity / pot odds / SPR / players-remaining were available?

Doctrine is `POKER_THEORY.md:808` (§7.1, "Every Decision Derives from Game State, Not Labels") and
`POKER_THEORY.md:880` (§7.6, AP-RL-01). Restated in `src/utils/rangeEngine/CLAUDE.md` and
`src/utils/exploitEngine/CLAUDE.md`.

**Enforcement is prose only.** `POKER_THEORY.md:927-931` lists four "enforcement mechanisms"; all
four are documentation cross-references, and mechanism #2 (a CI lint) is explicitly marked
deferred and was never built. There is no ESLint config, no invariant script, and no general test.
Two per-site regression tests pin two past bugs (`unexploitableFloor.test.js:160`,
`populationPriors.test.js:396`) and cannot detect a new violation anywhere else.

**The live proof that prose failed:** `comboMultiplier` / `adaptMultipliers` at
`src/utils/exploitEngine/postflopNarrower.js:643` and `:667` — ~140 lines of exactly the
bucket-keyed machinery AP-RL-01 forbids, with 19 passing assertions and zero callers in `src/`,
`scripts/`, or `ignition-poker-tracker/`. Open as FIND-042.

**Falsifier:** a lint or test that fails on a new bucket-keyed branch introduced anywhere in
`rangeEngine/` or `exploitEngine/`. None exists today.

---

## MO-2 · Confidence computed on a different denominator than the quantity — `LIVE`

**Ask:** the number and its confidence — are they functions of the *same* n?

`src/utils/exploitEngine/decisionAccumulator.js` (note: **not** `src/utils/decisionAccumulator.js`,
which does not exist) computes, inside one loop ~16 lines apart:

- `:611-615` — `avgRangeEquity` and `avgSegmentation` divided by `wn = bucket.weightedOccurrences`,
  a sum of **decayed** weights (`recencyWeight = 0.5 ^ (handAge / 50)`, `:404`, `:30`).
- `:628` — `bucket.confidence = bayesianSampleConfidence(bucket.occurrences)`, the **raw** count.
  Sparsity gating at `:622` also keys on the raw count.

40 hands each decayed to 0.25 give `wn = 10` but a confidence describing n=40 — the badge asserts
a sample four times the effective one that produced the number.

**The mirror image, same family:** `villainDecisionModel.js:535` passes `evidenceN` — a sum of
*decayed* weights (`:276`) — into `bayesianSampleConfidence`, whose own docblock at
`src/utils/pokerCore/betaMath.js:166-167` states "`n` is the RAW observed count at every call
site." The repo runs the estimator on both scales and documents only one.

**Falsifier:** a test asserting that `confidence` and the quantity it annotates are computed from
the same denominator, for every bucket in the accumulator.

---

## MO-3 · A hand-set constant standing in for a quantity since measured — `LIVE` (weaker than first claimed)

**Ask:** does this constant have a measured counterpart in the repo, and where does it sit
relative to it?

**`blindDefendMax: 25`** — `src/utils/exploitEngine/villainObservations.js:72`, consumed at `:239`
and `:243`. Its own trailing comment names ~40%. The constant contradicts its comment.

**Correction to the claim as put to me.** There is no repo-derived 0.40. At
`src/utils/exploitEngine/__tests__/unexploitableFloor.test.js:254-255`, `0.40` is the **asserted**
side of the comparison — the number lifted from the comment. The *derived* value is
`perDefenderMDF({potSize: 1.5, betSize: 2.5, n: 1})` = **0.375** (`unexploitableFloor.js:194-196`).
The test asserts only that a gap object has a label and a numeric delta; it never pins the derived
number. So the shipped 25 sits 12.5pp below a derived 37.5, not 15pp below a derived 40.
`unexploitableFloor.js` has **no production consumer** — every reference is a test (see MO-9).

**`POPULATION_FOLD_RATE = 0.45`** — `src/utils/exploitEngine/foldEquityCalculator.js:660-663`, now
firing only in the bucket-approximation fallback (WS-307 removed it from the composition path,
`:637-654`). Live siblings: `foldEquityCalculator.js:543`, `gameTreeEquity.js:1115`,
`decisionTreeBuilder.js:60`, and two display defaults.

**"Outside the measured support" is an overstatement, and the weaker true claim is the useful
one.** The repo's measured field (`villainModelData.js:339-345`, HandHQ, hold-out n=45,293) gives
marginal fold facing a **bet** 0.5616 and facing a **raise** 0.4242. Per-player fold rates span
0.01–0.82. So 0.45 is comfortably *inside* the support; it is ~11pp off the **central value** for
the bet population it substitutes for, and ~1pp off for raises. A constant off-centre for one
population and on-centre for another is a *conditioning* defect, not a support violation — and
saying so precisely is what lets someone fix the right thing.

**Falsifier:** for each constant, a test that names its measured counterpart and asserts the gap,
failing when the gap exceeds a declared tolerance.

---

## MO-4 · Selection effects in showdown-gated samples — `GUARDED` (sign claim overstated)

**Ask:** is this rate conditioned on reaching showdown, and does the artefact say so?

Registered as `FAULT-showdown-selection`, `src/utils/standardOfRecord/faultRegister.js:1142-1165`:
"the selection runs hardest against exactly the strong and weak tails a range model cares about."
`probability: 0.85`, ranked #12 in the disclaimer register, status `untested`.

This one is comparatively well handled. `scripts/backtest/rangeCalibrationProbe.mjs:110-125`
refuses to correct the bias and instead **factors** the conditional so selection becomes an
explicit estimable term (POKER_THEORY §14.1); `:784-790` emits a `selection` block
unconditionally; `rangeCalibrationReport.mjs:417-427` writes eight reveal-rate and coverage-bound
fields onto the Result Card as **data**, and `:306` warns when the bound is too wide.

**Correction: "the sign itself is unidentified" overstates it.** `ADR-010:95-104` gives a
one-sided-informative bracket — coverage over all scoreable decisions is `[0.270, 1.000]`, bounded
below and not above. The **magnitude** is unidentified; the direction is partly pinned. What *is*
categorical is that folds reveal at 0.0% — an entire action class is absent from the measured set,
which is a stronger and more actionable statement than an unidentified sign.

**Note the register entry's own weakness:** its matcher is prose-based (`/showdown|revealed|holding/`
over the card's text), so it can be escaped by deleting a sentence. That is WS-385's subject.

---

## MO-5 · Multiplicity — `LIVE`

**Ask:** how many candidate hypotheses does this rank, and is anything correcting for the count?

`src/utils/exploitEngine/weaknessDetector.js` runs **16** detectors per villain (11 situational at
`:141`–`:446`, 5 preflop at `:492`–`:608`), dispatched by `detectWeaknesses` (`:85-108`) from
`analysisPipeline.js:118`.

**No correction exists anywhere.** A case-insensitive search for
`fdr|bonferroni|holm|benjamini|hochberg|familywise|multiple compar|sidak|false discovery` across
`src/` and `ignition-poker-tracker/` returns zero hits. The only repo-wide matches are prose in
`docs/projects/predictive-model-calibration/` and tickets discussing the absence, plus two false
positives (combo multiplicity, eigenvalue multiplicity).

The absence is **partly deliberate** — PMC chose pre-registration discipline over correction
(`.claude/projects/predictive-model-calibration.md:146`) — but that decision is recorded nowhere
in the detector code, so a reader of `weaknessDetector.js` cannot tell a considered choice from an
oversight. At 16 tests, a per-test α of 0.05 gives ~56% chance of at least one false flag per
villain under the null.

**Falsifier:** run all 16 detectors against simulated villains drawn from a single population and
count how many fire.

---

## MO-6 · Importance weights on rare events — `GUARDED`

**Ask:** does the estimator reweight by `1/π_pool`, and is the quantity of interest rare *by
construction*?

`scripts/backtest/ipsEstimator.mjs:13-15` computes `w = π_ours/π_pool` with self-normalized WIS,
`DEFAULT_WEIGHT_CAP = 20` (`:58`), reporting `clippedShare` (`:247`). Its docblock at `:41-46`:
"ESS = (Σw)²/Σ(w²) is the honest denominator: 10,000 decisions at ESS 40 is a 40-decision result
wearing a large n."

The repo states the structural problem almost verbatim at `scripts/backtest/holeMap.mjs:71-76`: a
line that is a HOLE has π_pool near zero **by definition**, so the weight explodes or clips, payoff
magnitude is large so variance goes as magnitude², and the count is tiny — "THE LINES HE MOST WANTS
PRICED ARE PRECISELY WHERE IMPORTANCE-WEIGHTED ESTIMATION IS STRUCTURALLY WEAKEST." `holeMap.mjs`
exists to route around it, pricing holes from pot geometry and a measured fold curve instead.

Backed by `FAULT-precision-overstatement` (`faultRegister.js:1113-1140`) with a **structural**
matcher that flags any card reporting `n` without `ess`. This is the model the other entries should
copy.

---

## MO-7 · Degenerate signals — a metric that cannot fail — `LIVE`

**Ask:** can this indicator take more than one value given the inputs its producer can actually
emit?

`ConfidenceBadge`, `src/components/views/TableView/LiveAdviceBar.jsx:68-87`, rendered at `:256`,
has three branches and reaches **one**:

- `DATA` (`:72`) requires `source.includes('model')`. The only producer,
  `queryActionDistribution`, emits exactly `'prior'` (`villainDecisionModel.js:508`, `:524`,
  `:558`), `` `shrinkage-L${n}` `` (`:537`), `` `level-${n}` `` (`:550`). None contains "model".
  The only string in the repo that would satisfy it is a **test fixture**,
  `LiveAdviceBar.test.jsx:30` — a value the producer cannot emit.
- `EST` (`:77`) requires `effectiveN < 5`, but `effectiveN` is floored at `PSEUDOCOUNT = 10` at
  every construction (`villainDecisionModel.js:325`, `:445`, `:739`, `:746`).

So a villain with 0 observations and one with 500 both render `PARTIAL`. The same two dead branches
sit in the prose path at `actionClassifier.js:297-303`, where `:302` prints "11 obs" for a single
observation.

**Note the test passed.** The fixture supplied a source the production graph cannot produce, so the
`DATA` branch was verified against an input that does not exist. That is MO-9 wearing a green tick.

**Falsifier:** enumerate the producer's output domain and assert every consumer branch is reachable
from it.

---

## MO-8 · Two numbers never forced onto one axis — `GUARDED`

**Ask:** is there anything in this repo that would make this number meet a different number
measuring the same thing?

This is WS-291's mechanism — nothing forced two estimates onto a shared axis, so a wrong one never
had to meet a right one, and it survived the life of the project. ADR-009 and the Result Card exist
for this. Read `docs/standard-of-record/VOCABULARY.md` before naming anything here; the terms
already exist.

**Falsifier:** for any comparative claim, name the Result Card it resolves to. If none exists, the
claim is not yet a claim.

---

## MO-9 · Correctness verified without reachability — `GUARDED`, pattern still `LIVE`

**Ask:** is there a production call path that reaches this code, or only a test?

The repo names this as a three-time recurrence in its own source —
`faultRegister.js:57-58`: "`predictionAudit` captured and never read, `perceivedHeroRange` shipped
behind a parameter no call site passed, WS-284"; `schemas.js:134`, `:390`.

**Both named examples need updating at HEAD, and the update matters.**
- `perceivedHeroRange`: still **zero** production callers pass it (nine `evaluateGameTree` call
  sites, none passing; the only `src/` mentions are two comments). But it is no longer inert —
  `gameTreeContext.js:290` added a `?? buildRepresentedHeroRange(...)` fallback in WS-307, so the
  non-omniscient path *is* reached. Unreachable *parameter*, reachable *capability*.
- `predictionAudit`: now **written** in production (`usePersistence.js:196`) and read back only by
  an offline script (`scripts/backtest/run-atoms.mjs:73-75`). No view, hook, or engine consumes it.

**The cleanest live instance is neither** — it is `comboMultiplier`/`adaptMultipliers`
(`postflopNarrower.js:643`, `:667`): 19 passing assertions, zero callers anywhere. See MO-1.

Guarded by `src/utils/exploitEngine/__tests__/depthReachability.test.js:237`, whose comment states
the rule: shipped-correct-and-unreachable, "and nothing asserted that passing it changed anything."

**Falsifier:** for each exported function, a caller trace from a production entry point.

---

## MO-10 · Estimating a contrast costs more than estimating a rate — `DOCTRINE-ONLY`

**Ask:** is this quantity a *difference between two rates*? If so, is its sample requirement
larger than a single rate's, and does anything say so?

**Correction to the claim as put to me, on two counts.** The comment is at
`src/utils/rangeEngine/traitDetector.js:16-26` — **rangeEngine**, not `exploitEngine` (no such file
exists there) — and lines 16-26, not 20-27. And it says something weaker than "costs several
times":

> detecting a *difference* between two rates needs more regularization than estimating one rate,
> and concluding a player "adjusts by position" warrants a meaningful per-position sample.

The constant is `OPEN_RATE_PRIOR = {alpha: 6, beta: 24}` (`:27`) — pseudocount 30 against
`rangeEngine`'s `PRIOR_WEIGHT = 10` convention, i.e. **3×**, framed as a regularization choice, not
derived from a variance argument. No "4× variance of a difference" or equivalent arithmetic appears
anywhere in the repo.

**The absence-from-doctrine half is verified.** `POKER_THEORY.md`, `SYSTEM_MODEL.md`,
`POKER_AXIOMS.md`, `docs/standard-of-record/*`, `.claude/rules/*`, and both engine `CLAUDE.md`
files contain no statement of the idea. Near-misses are unrelated: `POKER_THEORY.md:259` (a `~4×`
about `n_parent` vs `N` denominators) and `:2034` (measured correction cost). Every `contrast` hit
in `docs/standard-of-record/` is the paired-contrast study design, a different concept.

So a load-bearing sample-size principle lives in one code comment, in one engine, expressed as a
magnitude nobody derived — and every other detector that compares two rates is free to ignore it.

---

## MO-11 · The oversight about the oversights

Four of the ten entries above were **overstated** when first put to me, and the overstatements share
a shape: each made a true observation *stronger and rounder* than the evidence supported — a derived
0.375 became "0.40", a 3× regularization became "several times", a bracketed magnitude became an
"unidentified sign", an 11pp offset from a central value became "outside the measured support".
Two carried the wrong file path, and one the wrong engine directory.

None of these was fabricated. Every one pointed at a real defect. That is exactly what makes the
pattern dangerous: a claim that is 80% right and 20% rounded-up passes casual review, and the
rounded 20% is what a downstream reader quotes.

**The rule this yields:** when an entry here is cited, cite the file:line, not the summary. When an
entry is *added*, record the verdict you reached — `VERIFIED`, `OVERSTATED`, `FALSE` — and if
overstated, keep the correction visible in the text rather than silently writing the fixed version.
The correction is the part that teaches.
