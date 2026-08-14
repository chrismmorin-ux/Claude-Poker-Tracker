# Engine & Measurement Vocabulary Survey — 2026-08-14

> **Provenance:** WS-434 Phase E, founder-directed 2026-08-14 ("We definitely need a canonical
> vocabulary, and we likely have some narrowed complexity in some of the engine channels. Lets
> take this opportunity to see if there are opportunities to refactor the engine in order to
> simplify into more elegant but still precise solutions.").
> **Method:** two independently-dispatched fresh-context survey agents (dispatch-don't-assert),
> one over `src/utils/exploitEngine/` + `src/utils/rangeEngine/`, one over `scripts/backtest/`
> and its Standard-of-Record seams. Every file:line below was read by the surveying agent at
> HEAD (post WS-434 commits A–D), not recalled.
> **Scope rule:** simplification means one clear channel, never fewer capabilities. Internal
> vocabulary may legitimately differ from card-facing vocabulary (founder ruling, same session);
> external pedagogical vocabulary explicitly deferred by founder.
> **Tickets:** WS-480 … WS-488 carve this report into work. Nothing below was dropped.
> **Already fixed same-session:** backtest finding B13 (river-flip Stage-2 CI aliases fed from
> rounded display values) — commit `89c0a5b8`.

---

## Part 1 — Engine survey (`exploitEngine/` + `rangeEngine/`)

Headline: both engines are unusually consolidated already (WS-403, WS-436, WS-450 each collapsed
a channel and left a tombstone). What remains is mostly **naming/unit seams at module
boundaries**, not duplicated logic. Ranked by advice-correctness impact.

### F1 — `betFraction` carries three incompatible units under one field name; the preflop one renders as "% pot" → **WS-480**
Producers: `heroActionBuilder.js:165,174,185,190,197,205,214,239,282,325` bet = `betSize/potSize`
(pot fraction); `:125,134,145` raise = `increment/(pot+bet)`; `:74,83` all-in variants;
**`preflopAdvisor.js:424,496,596,631,691` `betFraction: multiplier` — a big-blind multiple**
(pinned by `__tests__/preflopAdvisor.test.js:315,347`); re-emitted at
`gameTreeEvaluator.js:582,897` as `recommendation.sizing`.
Consumers assuming pot fraction: `LiveAdviceBar.jsx:262` renders `${Math.round(f*100)}% pot`;
`LiveRecommendations.jsx:219,331`; `AllRecommendationsPanel.jsx:68`; `Tier1_GlanceStrip.jsx:47-48`;
`SizingPresetsPanel.jsx:47`; `PlayerAnalysisPanel.jsx:422`; `replayAnalysis.js:434-435` (EV-vs-
fraction curve mixes both units); `drillModeEngine.js:443,588` (bb multiple silently becomes a
pot fraction). Preflop reaches the same array via `computeHelpers.js:212` →
`useLiveActionAdvisor.js:283,330`.
Consequence: a 5x open renders as "500% pot"; downstream code mixes scales differing ~4x.
Fix direction: split by unit — `potFraction` vs `bbMultiple` — with one resolver that converts.

### F2 — villain response distribution ships in two shapes; the flat one omits `raisePct` → **WS-483**
`gameTreeEvaluator.js:882-885` emits nested `{fold:{pct,ev},call:{},raise:{}}` AND flat
`foldPct/callPct` (no `raisePct`) on one object; `:1365` reads defensively
(`?.foldPct ?? ?.fold?.pct ?? 0`); `:897` third copy at `sizing.foldPct`; call branch `:609`
emits only the flat shape. Consumers split: `actionClassifier.js:111,386,403` (flat);
**`riskAnalysis.js:112` reads `raisePct` that the bet/raise branch never emits → defaults 0, so
raise-branch variance is under-counted on every bet/raise candidate**;
`computeBaselineForAssumption.js:51`, `LiveRecommendations.jsx:251,343`, `LiveAdviceBar.jsx:386`
(nested). Fix: one nested shape on every branch incl. call; flat keys kept as deprecated aliases.

### F3 — fold curve FITTED on final-pot axis, EVALUATED on street-pot axis → **WS-481**
Training: `decisionAccumulator.js:487,496` `facingBetFraction = facingBetAmount / potBefore`
where `potBefore = hand?.gameState?.potSize` = **final total pot** (`phhAdapter.mjs:423-427`);
same at `:579-580` for sizing tells; the `< 5` filter (`:497`) passes understated values.
Consumption: fitted via `villainDecisionModel.js:783` → `villainModelData.js:542`, then read at
`gameTreeEvaluator.js:706-716` on `villainFacingFraction` = bet / street pot
(`foldEquityCalculator.js:450-459`). The personalized curve is fitted on a compressed x-axis and
read at true pot fractions, and it **outranks** the population curve on the bet path
(`gameTreeEvaluator.js:704`). This is the WS-402 defect class on the training side, unguarded.
Fix: compute a running street pot in the timeline walk; one function defines the axis for both.

### F4 — `computeComboEquity` exported twice, two different quantities → **WS-484**
`gameTreeEquity.js:259` (pairwise equity vs one villain combo) vs `postflopNarrower.js:428`
(absolute made-hand + draw strength score). Both docblocks say "[0,1] equity". Fix: rename the
narrower's to `comboStrengthScore`.

### F5 — two "displace fold curve from anchor" implementations, opposite arg order, different saturation → **WS-484**
`villainModelData.js:359-365` `foldCurveDelta(fraction, curve)` unclamped vs
`preflopFoldResolver.js:180-182` `curveDisplacement(curve, f)` saturating at ±0.5; call sites
`gameTreeEvaluator.js:715` / `preflopFoldResolver.js:377`. The saturation's stated justification
(style curves) is stale post-WS-436. Fix: one exported `curveDelta`.

### F6 — `foldPct` is 0–1 on the engine path and 0–100 in observation/profile modules → **WS-484**
Fraction: `foldEquityCalculator.js:168,781`; `gameTreeEvaluator.js:781`;
`preflopFoldResolver.js:305,336`; `gameTreeContext.js:334`; `villainDecisionModel.js:709,767,774`.
Percent under the same name: **`villainProfileBuilder.js:184` (shadows the fraction-valued
`foldPct` at `:160` in the same function)**; `villainObservations.js:516`;
`weaknessDetector.js:222`; `thoughtCatalog.js:270` / `thoughtInference.js:177` use `foldRate` as
fraction. Live seam conversions: `foldEquityCalculator.js:629,637` (`/100`),
`gameTreeEvaluator.js:764`. Fix: `foldPct` = fraction engine-wide; display copies renamed;
convert once at render.

### F7 — prior-strength 10 defined independently in seven modules → **WS-484**
`populationPriors.js:66` (canonical, exported; sole importer `heroRangeBuilder.js:46`),
`populationPriors.js:80`, `foldEquityCalculator.js:664`, `villainDecisionModel.js:36,381`,
`preflopFoldResolver.js:107`, `poolBaseline.js:96`, `bayesianConfidence.js:9` (comment claims
match, no import); deliberate deviant `OBS_PRIOR_WEIGHT = 15` (`foldEquityCalculator.js:613`).
`foldEquityCalculator.js:661` asserts the equality in a comment nothing enforces. Fix: shared
`DEFAULT_PSEUDOCOUNT` as each prior's default + equality test; do NOT merge the priors.

### F8 — population fold 0.45 shadowed in ~10 sites; `tightenRatesForContinuation`'s `foldRate` param dead at all 12 call sites → **WS-482**
Canonical `villainModelData.js:93`; shadows at `villainModelData.js:126`,
`foldEquityCalculator.js:544,596,663`, `gameTreeEquity.js:1115,1119`, `gameTreeDepth2.js:628`,
`villainProfileBuilder.js:190,317,322`, `preflopFlopEV.js:485`, `decisionTreeBuilder.js:60`;
raise twin 0.55 (`villainModelData.js:95` vs `villainProfileBuilder.js:318,323`).
`gameTreeSizingHelpers.js:162` takes `foldRate = 0.45`; call sites passing two args:
`gameTreeDepth2.js:847,848,986,987,1102,1103,1193,1194,1197,1198`,
`gameTreeEvaluator.js:1907,1908`. **Depth-2/3 tightens villain continuation with a hard-coded
population survival rate even at nodes where per-combo pFold was just computed — a total
substitution of the marginal for the conditional.** Fix: default from POPULATION_PRIORS, thread
the node's pFold, measure through the WS-273 harness (moves every depth-2 EV).

### F9 — three SPR→scalar transforms, four inline copies, one named export → **WS-484**
`gameTreeConstants.js:84-87` (named); `clamp(log2(spr)/4, .1, 1)` inline at
`gameTreeEquity.js:982`, `gameTreeDepth2.js:256`, `preflopFlopEV.js:555`; unexplained variant
`/5, .8` at `gameTreeEquity.js:993`. Fix: exported `sprLeverage(spr, {divisor, ceiling})`.

### F10 — `totalCombos` names three quantities; range width ships on two scales → **WS-484**
Count: `rangeSegmenter.js:390`, `gameTreeEquity.js:797`; weight-sum:
`bluffValueConstruction.js:104,112,117`; percent path: `pokerCore/rangeMatrix.js:217-225`
(0–100) vs `populationPriors.js:216-221` (0–1). Zero-guards at
`gameTreeContext.js:304,314,332,333,352`; depth-3 gate `gameTreeEvaluator.js:1957`. Fix:
`comboCount` vs `comboWeight`; one `rangeWidthFraction` + display wrapper.

### F11 — `GRID_SIZE = 169` / 1326 re-declared in eleven modules → **WS-484**
Private copies: `traitDetector.js:14`, `crossRangeConstraints.js:25`, `populationPriors.js:26`,
`rangeProfile.js:8`, `pipCalculator.js:12`, `bayesianUpdater.js:28`, `postflopNarrower.js:27`,
`rangeSegmenter.js:17`, `equityDecomposition.js:408`; `equityOperator.js:52` `OPERATOR_SIZE`;
bare 169: `preflopAdvisor.js:49`, `preflopFlopEV.js:762,771`, `rangeRules.js:212`,
`rangeAccessors.js:49`; 1326: `populationPriors.js:27` vs `equityCache.js:29`. Fix: one
pokerCore export.

### F12 — `estimateModelFoldPct` is a fourth fold channel with zero production callers → **WS-484**
`villainDecisionModel.js:692-712`; callers only in its test (`:552,562`). Production uses
`queryActionDistribution(...).actions.fold` (`foldEquityCalculator.js:540`,
`gameTreeContext.js:145`, `gameTreeEvaluator.js:629`, `gameTreeEquity.js:1119`) or
`villainModel.foldEstimates` (`gameTreeDepth2.js:379,389`, `thoughtSignatureEvaluators.js:34`,
`villainProfileBuilder.js:322`). Inbound-risk: a new caller gets model-only fold with no range
composition. Fix: rename/fold into the model-tier accessor; keep the capability.

### F13 — `rakeAsymmetry` feeds bb to a rake function whose cap/drop are absolute currency (latent) → **WS-484**
`unexploitableFloor.js:292-298` passes `potBB` to `estimateRake`
(`potCalculator.js:446-454`, cap/drop documented `$`; `rakeResolver.js:65-71` caps 1.00–5.00
dollars); other callers pass chips (`foldEquityCalculator.js:322`). Latent — `deriveFloor` has
no production callers; fires the day it is wired. Fix: unit in parameter name + convert once.

### F14 — `exploitEngine/CLAUDE.md` describes a live violation the code has fixed → **WS-484**
The "bluffer's breakeven" section says the bet/raise path "still computes
`heroPotOdds = betSize/(effectivePot+betSize)`"; code now calls `villainRequiredEquity`
(`gameTreeEvaluator.js:790-796`, WS-450/FIND-112 tombstone at `:792`); no `heroPotOdds`
identifier remains. Fix: move to past tense with the WS-450 reference.

### Engine absences (looked for, NOT found — load-bearing negatives)
SPR computed exactly once (`gameTreeContext.js:216`; bands single-sourced from
`pokerCore/sprBands.js`). No second per-combo continue-probability model (WS-403's
`continueProbability` is the one expression, four readers). No competing range-narrowing entry
point (`narrowByBoard` single; tree path via `holdingKnowledge.narrowHolding` with `basis`). No
duplicate preflop fold resolver (two callers, one thin adapter). No duplicated core EV formula;
no `foldPct * potSize` shortcut anywhere. Bluffer-breakeven vs caller-price confusion contained
(every remaining `b/(p+b)` site annotated and genuinely a fold frequency). No hidden second rake
application. Equity is 0–1 across every computation boundary (only display converts). The six
equity computation paths are distinct accuracy/cost points selected by board length
(`gameTreeEquity.js:259-274`), not duplicates. `rangeEngine/` internals clean: one grid
representation, one normalizer, one updater.

---

## Part 2 — Measurement-harness survey (`scripts/backtest/` ↔ standardOfRecord)

Headline: WS-434 governed `metrics`; almost nothing else on the card is governed, and the
findings concentrate exactly there. Ranked by risk to claim accuracy.

### B1 — `admissibility` has two incompatible dialects and both gates silently pass the wrong one → **WS-485**
`{admissible, blockers:[{code,detail}], warnings:[…]}`: `heroEvReport.mjs:161-168`,
`depthAblationReport.mjs:338-349`, `studyLadderReport.mjs:368-373`, `deviationMap.mjs:178-191`,
`run-river-flip-replicate.mjs:489-501`. `{quotable, reasons:[string], caveats:[string]}`:
`foldCurve/emit-result-card.mjs:159-168`, `emit-ws436-result-card.mjs:158-171`,
`teachableArmsProbe.mjs:556-567`, `layerAblation.mjs:630-640`. Hybrid: `run-atoms.mjs:328-339`.
Consumers: `ladder.mjs:143` (`admissible ?? null`), `model-readiness.mjs:331-344` (refuses only
on `=== false`). **A `{quotable:false}` card enters the readiness scorecard silently** — the
failure `heroEvReport.mjs:79-97` was written to close. Four cards hardcode `quotable: true`
literals (not verdicts). Schema: `schemas.js` declares admissibility as bare object.
Fix: declared SOR sub-schema + shared builder; `quotable`/`caveats` kept as declared aliases.

### B2 — `clusterUnit: 'players'` asserted on cards whose intervals are not player-clustered → **WS-486**
`layerAblation.mjs:629` (intervals from `divergence.js:316-317,461-462` → `pairedMeanCI`, a
per-decision normal approx, `layerAttribution.js:104-113`); `deviationMap.mjs:177` (zero player
references; cells keyed `[sizeBucket, sprBand, closesAction]`, `:29`);
`foldCurve/emit-result-card.mjs:77` (no interval at all); `emit-ws436-result-card.mjs:146`
(iid t-interval, `:30-40`). `resultCardProblems` validates membership only
(`resultCard.js:128-133`). Fix: publish-time requirement — clusterUnit ⇒ machine-readable
`clusterCount` + named interval producer, or `clusterUnit: null` with reason; ADD the
player-clustered interval where missing (river-flip models this correctly, `:365-385`).

### B3 — `admissibility.clusters` carries different units per script → **WS-485**
`heroEvReport.mjs:165` players; `depthAblationReport.mjs:342` players;
`rangeCalibrationReport.mjs:342`, `rangeCalibrationProbe.mjs:1918` players (different
selections); `studyLadderReport.mjs:372` the CONTROL axis' players; **`deviationMap.mjs:190`
`clusters: map.wellSampledCells` — geometry cells printed as "contributing players" by
`model-readiness.mjs:335`**, with `(bar: undefined)` on most cards. Fix: shared builder,
clusters denominated in the declared clusterUnit, bar required.

### B4 — 30-cluster bar in three copies; one applied to the wrong unit → **WS-486**
Canonical `heroEvReport.mjs:98` (imported by depthAblation); second
`rangeCalibrationReport.mjs:124`; inline `run-river-flip-replicate.mjs:498`.
**`layerAblation.mjs:633` `quotable: n >= 30` where n = paired DECISIONS (`:438`)** —
quotable on 30 decisions from 2 players; `byPlayer.size` available at `:635`, used only in
prose. Fix: one exported `CLUSTER_BAR = {value, unit, rationale}`; layerAblation gates on
players, decision count kept as a warning.

### B5 — blockers are `{code, detail}` in five scripts, bare strings in two → **WS-485**
Objects: `heroEvReport.mjs:117-151`, `depthAblationReport.mjs:287-336`,
`studyLadderReport.mjs:255-295`, `deviationMap.mjs:180-189`,
`run-river-flip-replicate.mjs:491-500`. Strings: `rangeCalibrationReport.mjs:275-336`,
`rangeCalibrationProbe.mjs:1877-1891`. `model-readiness.mjs:334` prints `undefined: undefined`
on the string dialect — the refusal reason lost at the moment it matters. Fix: object form +
blockerCode enum; prose kept in `detail`.

### B6 — a 4dp-rounded CI bound decides the C3 gate → **WS-487**
`ipsEstimator.mjs:302-303` stores `Number(ci.lo.toFixed(4))`; `heroEvReport.mjs:609`
`corpusArmPasses: edgeCiLowBB > 0` feeds `gate.c3Passes` (`:618`). True `ci.lo` 0.00004 → 0 →
fail; 0.00005 → 0.0001 → pass. The unrounded value exists at `ipsEstimator.mjs:274` and is
discarded. Fix: full precision on the arm; round at render (`heroEvReport.mjs:720`).

### B7 — curse-shape point estimate and its CI computed from different quantities → **WS-487**
`heroEvReport.mjs:413` diff of two 4dp-rounded stratum edges (`:349`); bootstrap statistic
(`:403-410`) uses unrounded values; verdict branch (`:438-451`) mixes them. Fix: `scoreStratum`
returns raw beside display; diff via the bootstrap's own closure.

### B8 — depth-ablation record meta stamps bootstrap constants the run does not use → **WS-487**
`run-depth-ablation.mjs:224-226` stamps `DEFAULT_BOOTSTRAP_RESAMPLES/ALPHA`;
`depthAblationReport.mjs:206-207` hardcodes `resamples = 2000, alpha = 0.05` (imports neither);
same at `run-river-flip-replicate.mjs:384`. The day a constant moves, the CI is no longer
rederivable from the record — WS-431's defect, open one file over. Fix: default from the
imported constants.

### B9 — four paired-difference-CI implementations, three clustering assumptions, three z values → **WS-488**
`depthAblationReport.mjs:203` `pairedDelta` (cluster bootstrap) vs `geometryAblation.mjs:80`
`pairedDelta` (iid, z=1.96) — same name, incompatible signatures; `layerAttribution.js:104`
`pairedMeanCI` (iid); `emit-ws436-result-card.mjs:30` `pairedLL` (iid). More z's:
`rangeCalibrationProbe.mjs:981,1692`, `run-river-flip-replicate.mjs:109`; canonical `Z_95`
(`decisionSystems/accumulator/betaPosterior.js`) used by none, against
`decisionSystems/CLAUDE.md:88`. `divergence.js:433-436` rests the layer-divergence separation
verdict on the unclustered approx while the card promises player clustering (B2). Fix: one
`pairedInterval(values, {clusterBy, z})`; all call sites become thin adapters.

### B10 — three copies of the LCG resampler + seed literal; equity seed shares the same value → **WS-487**
Identical LCG: `ipsEstimator.mjs:148-160`, `evCost.mjs:60-68`, `optimismBias.mjs:244-248` (they
agree). Seed `0x9e3779b9` inlined at `evCost.mjs:56`, `optimismBias.mjs:239` instead of imported;
`seededEquity.mjs:29` `DEFAULT_EQUITY_SEED` same value → `seeds.clusterBootstrap` and
`seeds.equityMc` indistinguishable in a manifest. Fix: export the generator + seed; namespace
the equity seed.

### B11 — `emit-ws436-result-card.mjs` transcribes constants into the manifest `collectConstants` exists to read → **WS-487**
`:185-192` hand-writes `REFINEMENT_BUDGET_MS: 0, PSEUDOCOUNT: 10, AGG_FREQ_PRIOR_MEAN: 0.45,
POP_BET_CENTER: 0.55` against `replicationStamp.mjs:12-17`'s explicit rule. The PRIOR_WEIGHT
shadow reintroduced at the card boundary. Fix: extend `collectConstants`; keep `FEED`
(run-derived) and foldCurve's `'n/a'` sentinel pattern.

### B12 — both one-shot emitters bypass `buildStampInput`; fold-curve hand-maintains parallel dialect + canonical copies → **WS-487**
`foldCurve/emit-result-card.mjs:33,44-46` and `emit-ws436-result-card.mjs:24,120-122`
re-assemble what `replicationStamp.mjs:200-226` builds. Fold-curve stores `marginalFoldRate`
literals beside `conditioned.rate = k/n` — two hand-maintained copies of one quantity that the
validator cannot cross-check (they agree today; verified: bucket k's sum 178794, n's 318347).
Fix: route through `buildStampInput`; derive dialect fields from the canonical block, or add a
publish check that a `…Rate` sibling equals `conditioned.rate` to display precision.

### B13 — river-flip Stage-2 CI aliases fed from rounded display values → **FIXED, commit `89c0a5b8`**
`run-river-flip-replicate.mjs` aliases now carry unrounded `playerCI.lo/hi`.

### B14 — per-player bucketing hand-rolled at four sites; one parses the player id from a string key → **WS-488**
`ipsEstimator.mjs:244-246`, `depthAblationReport.mjs:224-226`, `heroEvReport.mjs:396-397`,
`run-river-flip-replicate.mjs:375-380` (**`d.key.split('|')[0]`** — the only parsed cluster
identity; mis-clusters if a pseudonym ever contains `|`). Four row shapes that never meet.
Fix: `groupByCluster(rows, keyFn)`; playerId carried on the replicate row.

### B15 — four `totalVariation` implementations disagreeing on missing input; two "mean TV" figures are different quantities → **WS-488**
`depthAblationReport.mjs:126-131` (null→0) vs `layerAblation.mjs:148-154` (null→NaN) vs
`diffProbeRuns.mjs:40-45` vs `emit-ws436-result-card.mjs:65-69`; identity epsilon 1e-9
(`depthAblationReport.mjs:140,157`) vs 1e-12 (`diffProbeRuns.mjs:82`,
`emit-ws436-result-card.mjs:74`) — divergent-share denominators differ between figures compared
in close-out prose; `argmax` duplicated (`depthAblationReport.mjs:117`,
`run-river-flip-replicate.mjs:98`). Fix: export `totalVariation`/`argmax`/named epsilon.

### B16 — two shape-verdict vocabularies with mismatched casing and power bars (plus three more verdict enums) → **WS-488**
`heroEvReport.mjs:417-452` (bar 30) vs `optimismBias.mjs:276-318` (bar 5;
`CONFIRMED-UNDERPOWERED` = heroEv's `UNDERPOWERED-DIRECTION-CONSISTENT`, but leads with
CONFIRMED); also `separability.mjs:452-480`, `geometryAblation.mjs:82-89`,
`rangeCalibrationProbe.mjs:1680-1684`. Fix: one `shapeVerdict` enum; per-instrument bars stay,
as named exports with rationale.

### B17 — estimand/treatment half named constants, half inline; partition strings free-text five ways → **WS-488**
Named: `HERO_EV_ESTIMAND` (unexported), `DEPTH_ABLATION_*`, `RANGE_CALIBRATION_*`,
`PER_PLAYER_WIDTH_*`, `LADDER_ESTIMAND`, foldCurve's (unexported), `ipsEstimator.TREATMENT`.
Inline: `layerAblation.mjs:553`, `run-river-flip-replicate.mjs:449,454`, `run-atoms.mjs:304,309`,
`teachableArmsProbe.mjs:519`, `emit-ws436-result-card.mjs:130,136`, `deviationMap.mjs:155,160`.
Manifest `partition` rendered five incompatible ways (`foldCurve:174`, `emit-ws436:178`,
`run-teachable-arms.mjs:163`, `run-atoms.mjs:290`, `run-range-calibration.mjs:145`). AS-710
corroboration is checkable only by string equality. Fix: `estimands.mjs` registry keyed by
`metrics.kind`; structured `partition: {unit, method, poolPct, walkForward, exceptions[]}`.

### B18 — `run-atoms.mjs` re-implements the EVAL filter with a string literal and unthreaded poolPct → **WS-488**
`:205` `partitionOf(playerId) !== 'eval'` (not `GROUPS.EVAL`), default poolPct, beside a guard
using `this.poolPct` (`:206,132`). Other bare `partitionOf` sites: `studyLadderReport.mjs:91-92`,
`teachableArmsProbe.mjs:92`, `foldCurve/mine-fold-vs-sizing.mjs:157`. Diverges the day a
`--pool-pct` flag appears. Fix: `GROUPS.EVAL` + threaded poolPct + `guard.isEvalPlayer`.

### B19 — `assessAdmissibility` computed twice per hero-EV report, two stored copies, two readers → **WS-485**
`heroEvReport.mjs:250` (card) and `:602` (report); `model-readiness.mjs:331` reads the report
copy, `ladder.mjs:143` the card copy. Agree today (pure function, same inputs). Fix: compute
once, pass through.

### B20 — `edgeBB` rounded before it becomes a factor of the §3.3 headline → **WS-487**
`ipsEstimator.mjs:289` 4dp → `heroEvReport.mjs:629` → `overallEv.mjs:60` product rendered to
3dp (`:101`) — unearned precision on the optimizable figure. Fix: unrounded on the arm, round
at fmt.

### Measurement absences (looked for, NOT found)
Exactly one POOL/EVAL hash (`partition.mjs:64-93` + deliberate Python mirror, fixture-pinned by
`partition.test.js:67-79`). One LeakageGuard (satellite validators deliberately separate,
documented, same LeakageError). One harness Wilson interval (app-side pair already tracked as
FIND-078). One cluster-bootstrap-over-players (optimismBias's is a different statistic and says
so). No second IPS estimator (`scoreStratum` is the same path with a filter in front). No
`clusterUnit: 'hands'` anywhere. No undeclared metrics keys or unregistered kinds (WS-434
closed). No card emitting `overallEvBB100` without both factors (enforced twice). No
resultCardId collision risk (nine sites, one idiom, distinct prefixes).

### Shared-module target (WS-488's shape)
`scripts/backtest/measurement/`: `lcg` + `DEFAULT_BOOTSTRAP_{SEED,RESAMPLES,ALPHA}` re-export ·
`clusterBootstrapCI` re-export · `pairedInterval` · `groupByCluster` ·
`totalVariation`/`argmax`/`ADVICE_IDENTITY_EPSILON` · `CLUSTER_BAR` ·
`buildAdmissibility({blockers, warnings, clusters, clusterUnit, bar})` with a declared SOR
sub-schema · `shapeVerdict` · `Z_95` re-export. Nothing in the list is an instrument; every item
is machinery that exists two-to-four times today.
