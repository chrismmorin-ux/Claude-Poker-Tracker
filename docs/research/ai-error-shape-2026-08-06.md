# The shape of wrong: a diagnosis of AI error in this repo

**Date:** 2026-08-06. **Status:** research record — measured where marked, cited where external.
**Provenance:** five independent dispatched agents (two web-research, three repo-mining), joined by
the session of 2026-08-06. Corpus classifications are single-coded by AI; treat marginal cells ±2.
Working datasets: git corpus (116 defect rows, 803 commits scanned), curated corpus (80 records),
model/instrument timelines. Scratchpad copies under the session scratchpad; the durable tables are
in this file.

## 1. The question

Founder, 2026-08-06: confident, load-bearing, wrong AI claims kept shipping — and seemed to
"explode" when heavy rigor arrived. Is it the model? The domain? The context length? The edge of
capability? What does the repo's own history say, and what does the external evidence say?

## 2. Who built what, when (recovered, not inferred)

Model attribution is per-commit for ~93% of history via `Co-Authored-By` trailers:

| Era | Model | Commits |
|---|---|---|
| 2025-12-01 → 12-14 | Sonnet 4.5 + Opus 4.5 (overlapping) | ~141 |
| 12-15 → 03-03 | — dead gap — | 0 |
| 2026-03-04 → 04-15 | Opus 4.6, then 4.6 (1M) | ~105 |
| 2026-04-16 → 05-22 | Opus 4.7 (1M) | 227 |
| 2026-06-06 → 06-20 | Opus 4.8 + Fable 5 interleaved | 74 |
| 06-21 → 07-21 | — second gap — | ~0 |
| 2026-07-22 → 07-25 | Fable 5 | 16 |
| 2026-07-26 → 08-06 | Opus 5 | 192 |

Instrument arrivals (detection capacity is NON-monotonic): first hook era 2025-12-07..09; **hook
purge 2026-03-04** (~25 hooks deleted); failure library 04-06; CWOS 04-30; corpus mining 07-25;
backtest harness 07-26; Standard of Record 08-02/03; fault register 08-04; ground-truth harness +
hard-restriction rules 08-05; dispatch doctrine + hooks 08-06. Test files: 96 (Dec) → 713 (Aug-06).
**The entire modern measurement stack arrived Jul-25 → Aug-06 — the same twelve days as the Opus 5
era.** At era granularity, "exploded under the newest model" and "exploded when instruments arrived"
are one observation; the confound is broken only by authored dates (below).

## 3. The central join: defects AUTHORED per era

58 of 116 git-corpus defects have recoverable authored dates (git blame of the defective lines /
provenance in fix-commit bodies). Density per 100 commits of that month:

| Authored | Model | Commits | Defects | Per 100 | What was being built |
|---|---|---|---|---|---|
| 2025-12 | Sonnet 4.5 / Opus 4.5 | 171 | 1 | **0.6** | tracker UI, app shell |
| 2026-03 | Opus 4.6 | 52 | 9 | **17.3** | **engine begins** |
| 2026-04 | Opus 4.6-1M → 4.7-1M | 218 | 21 | **9.6** | game-tree build-out |
| 2026-05 | Opus 4.7-1M | 73 | 6 | 8.2 | engine + governance |
| 2026-06 | Opus 4.8 / Fable 5 | 74 | 3 | 4.1 | extension, sidebar |
| 2026-07 | Fable 5 → Opus 5 | 89 | 12 | **13.5** | **mining + backtest begin** |
| 2026-08 | Opus 5 | 127 | 6 | 4.7¹ | measurement infra |

¹ Right-censored — August-authored defects have had days, not months, to be discovered. Floor, not
estimate. Additional biases, stated: unknown-authored-date rows (58) skew toward early UI/plumbing
defects, so early eras are undercounted; and each month's work differs in kind.

**Reading.** The two density spikes are the two NEW-TERRITORY months (engine start, harness start),
not model boundaries. The control cell: December, under the oldest models, has the LOWEST density —
because the work was UI, which is training-dense, well-trodden territory. If model tier drove error
rate, December should be worst; it is best. **Defect density tracks the domain novelty of the work,
not the model doing it.**

## 4. The explosion, decomposed

- August caught **44** defect rows in six days; only **6** were authored in August. ~86% of the
  explosion was old defects being drained by new instruments.
- Lag (authored → caught), n=58: <7d 28% · 7–30d 17% · 30–90d 12% · **>90d 43%**. Bimodal: a defect
  either meets an instrument in its first week or survives a quarter-plus.
- Of the 25 long-lag defects, **20 were authored 2026-03-05 → 04-21 and caught 07-25 → 08-05.**
- Extremes: 241 days (live hands had no positive identity), 127 (dead PWA update listener), 122
  (rake never wired to live EV), 122 (**the depth-2/3 subsystem never ran on the live path** — the
  budget was spent before the first gate).

Verdict on "rigor made it explode": **~confirmed detection effect + claim-densification, small
incidence contribution.** This matches the external evidence (below) exactly.

## 5. What catches things, and what does not

Combined corpora (n=116 git + 80 curated; overlapping but independently classified):

| Catcher | git corpus | curated |
|---|---|---|
| audit/review (AI-executed) | 50 | 26 |
| measurement/experiment | 34 | 37 |
| founder (at the table / on screen) | 24 | 6 |
| agent dispatch (blind-spot runs) | — | 9 |
| **tests** | **8 (7%)** | **2 (2.5%)** |

- Tests appear as the DEFECT (wrong assertion, inverted fixture, hand-fed impossible input) 6 times
  in the git corpus — nearly as often as they appear as the catcher.
- **8 explicit "green while wrong" cases**: 59 green tests feeding `eqVsCallRange: 0.28` (a value
  the engine cannot produce); a feature dead behind 45+14 green tests; fixtures encoding inverted
  ranges where correcting them moved equity 0.58 and ONE assertion noticed. Mechanism: fixtures are
  drawn from the same prior as the code, so they agree with the bug.
- Five tickets/analyses whose own PREMISE was wrong: zero caught by re-reading, all by measurement
  or the founder.

## 6. The mechanism taxonomy (engine/measurement subset, ~61 rows)

**UNTRACED-STORY + CLAIMED-UNWIRED = 62%.** The dominant shape of wrong here is not bad arithmetic
— it is (a) a plausible story about the code never traced or executed, and (b) a capability built
and never connected. "Computed-then-discarded" appears SIX separate times (reference tier, prior
meta, runout weights, stated EV, range-conditioned fold estimate, reference.meta) plus
`perceivedHeroRange` in the curated corpus. Then: ARITHMETIC (double counts, formula substitution),
STALENESS, NEAR-MISS (true statement corrupted — e.g. a variance fact rewritten as a bias fact,
which then propagated verbatim into four files), INHERITANCE (claims copied between docs/tickets —
6 documented propagation chains), NAME-AS-CAPABILITY (`foldTo3Bet` counting folds to any raise).

## 7. The training-data hypothesis (founder's), sharpened and supported

Three regimes of training coverage, three different failure surfaces:

1. **Dense + correct** (UI, standard code): reliable. December's 0.6/100.
2. **Dense + WRONG** (folk poker): public poker writing is dominated by forum folklore; real
   exploit knowledge is unpublished. The model's prior is a confident copy of the popular
   misconceptions — fold equity = fold% × pot, position labels as causes, big-bet-means-polar.
   `exploitEngine/CLAUDE.md`'s anti-pattern list is, in retrospect, a catalog of folk-poker
   corrections. Folk-shaped defects were authored at module origin in Mar–Apr and caught by the
   Jul–Aug instruments.
3. **Absent** (this project's actual research: IS-scored EV, walk-forward ranges, decision atoms):
   fluent interpolation with no grounding. The estimand/denominator/units errors live here.

**Correction recorded against our own narrative:** POKER_THEORY.md (created 2026-03-09, three days
after the engine started) did NOT prevent regime-2 errors — several folk-shaped defects were
authored after it existed. It enabled *recognizing* them later. A document one is supposed to have
read is not a control (the repo already knew this). And regime-3 errors cannot be fixed by any
document, because the correct document does not exist yet — the project is generating it. The only
oracle in regime 3 is execution and measurement, which is why progress stalled until the
measurement stack existed.

Corollary: fresh-context agents share the same training prior — in regime 2, ten agents can agree
on the folklore. Dispatch diversifies the CONTEXT, not the PRIOR; only execution has no prior.

## 8. External evidence (two web-research agents; full citations in session record)

- Confident confabulation is structurally predicted by the training objective (Kalai et al. 2025)
  — irreducible at the model level; every strong mitigation is architectural.
- Intrinsic self-correction degrades reasoning (Huang et al., ICLR 2024; TACL 2024 survey).
  **Self-Correction Bench (NeurIPS 2025): 64.5% blind spot** — models fix external errors they
  cannot fix in their own output. Fresh-context verification removes the whole blind spot class.
- Neutral LLM judges: TPR >96%, TNR <25% — they approve almost everything. "Default to refuted"
  is bias correction. Symmetric multi-agent debate ≈ no benefit; asymmetric assigned-role
  adversarialism with an external adjudicator works.
- Context rot: 30–50% accuracy degradation with long context (Chroma, 18 models); 39% multi-turn
  drop with measured self-anchoring (Microsoft/Salesforce).
- Model tier: fewer subtle errors per claim on expert-graded benchmarks (USAMO 25%→~85% in a
  year), but error DETECTORS run below random on subtle natural errors, LLM graders inflate proof
  scores up to 20×, and higher claim volume offsets per-claim gains (o3: 2× o1's hallucination
  rate). Reasoning-tier models partially regressed.
- Quantitative/statistical claims are the worst-measured domain; hallucinated code fails loudly,
  wrong claims about estimators have no compiler.
- Metamorphic/known-answer testing: 75% error detection at 8.6% FPR in the one quantified LLM
  study; FrontierMath audit found 42% of an elite benchmark flawed — every stronger instrument
  pointed at LLM output has raised the measured error rate.
- Non-expert oversight: lay judgment of AI arguments ≈ worthless (a controlled study found no
  advantage over deferring, and self-research made evaluators MORE confident in wrong answers).
  Longer explanations raise human confidence without raising accuracy.

## 9. What works, ranked by combined internal + external evidence

1. **Execute, don't adjudicate.** Every load-bearing claim gets a runnable falsifier. Internally:
   measurement caught more defects than everything else combined. Externally: the only verifier
   class with no shared failure distribution with the generator.
2. **Known-answer anchors.** Quantities whose correct value is known independently (field winrate
   ≈ −rake; duplication invariance). One anchor exposed a sign-level error instantly that months of
   review missed. Build one into every new measurement surface.
3. **Fresh-context dispatch, adversarially framed, externally adjudicated.** Verify in a context
   that does not contain the generation; tell the verifier to refute; let execution decide.
4. **When a comment states a fact the code could assert, assert it.** The claim layer is where 62%
   of engine wrongness lived and where tests don't reach. Convert prose to assertions
   relentlessly; the anti-pattern list already mandates this.
5. **Wire-or-delete.** CLAIMED-UNWIRED and computed-then-discarded are the top named mechanisms.
   Any capability shipped behind an unpassed parameter, any value computed and dropped, is a
   defect NOW, not later. A production caller in the same change, plus a divergence assertion.
6. **Distrust green.** 8 documented cases of green suites concealing defects. A test whose fixture
   was authored from the same reasoning as the code is not independent evidence. Behavioural tests
   through the real path; fixtures built from named hands / real artifacts; tolerances set by
   reintroducing the defect.
7. **Treat model upgrades as claim-volume increases, not error eliminators.** Expect fewer subtle
   errors per claim and MORE claims. Keep instruments constant across upgrades so the difference
   is measurable (the Ladder exists for exactly this).
8. **Keep claims stamped to evidence** (Result Cards, register versions) so a falsification can
   find its dependents — the anti-propagation mechanism; 6 propagation chains are documented.

## 10. Limits of this study

Single-coded classifications; 58/116 authored dates unknown (skewing early eras low); right-
censoring of Jul–Aug incidence; catch-rate confounded with instrument arrivals by construction
(that confound is the finding); curated corpus records selectively what tests missed; December's
low density partly reflects that pre-git v103 defects are invisible. The model-attribution join is
clean (trailers), but model and month's-work-domain are inseparable within this repo — the
December control cell is the strongest available separation and it favours domain over model.

## 11. Cross-validation against the independent parallel session

The founder ran a SECOND session (Fable 5) on the identical question, independently — neither
session read the other's work (artifact `e7ded558`, "Diagnosing the Error Pattern"). Comparison:

**Convergent, via different methods (high confidence):**
- Detection effect dominant. This study: ~86% of August catches were pre-August defects (authored-
  date join). Their study: H5 top-ranked, ~27 of 49 tagged errors ("the errors were always there;
  August is when the lights came on"). Same verdict, disjoint methods.
- Identical model-era reconstruction from `Co-Authored-By` trailers, down to the same 227-commit
  Opus 4.7 count. `system/failures.md` empty — found independently by both. Flagship defects
  (WS-291, dead depth-2 clock, unwired rake, fold-curve midpoint) authored Mar–Apr under Opus
  4.5–4.7, caught under Opus 5 instruments — both. Tests/fixtures encoding the bug — both.
- External literature: self-correction negative results, context rot, execution-over-recall as the
  #1 mitigation, LLM-as-judge weakness, o3 regression — found by both research passes
  independently. Model tier shifts error CHARACTER (visible → convincing), does not remove the
  class; process dominates model choice — both.

**Their findings this study lacked (adopted):**
- **MO-11 "motivated rounding"** — the record's own sixth category: "true observation, rounded in
  the direction of the argument. Nothing fabricated." Exhibited by the rigor-era sessions AND by
  their fresh-context auditors (the second audit refuted parts of the first). Consequence:
  contamination is A mechanism, not THE mechanism — fresh context does not remove directional
  rounding.
- **The doctrine's flagship evidence is weaker than the doctrine states.** The
  "greenfield measured perfect" claim rests on 1 refuted vs 11 held, Fisher p=0.3125, by the
  accuracy handoff's own admission: "the direction is real; the precision was invented." The
  dispatch doctrine remains right — but on EXTERNAL evidence (64.5% blind spot, agreeableness
  bias) more than on its internal artifact. `dispatch-dont-assert.md` should be restated at true
  strength (founder call — it is a ruling file).
- **The only per-claim denominators in existence:** 45.9%/50.6% and ~53% claim-refutation rates
  from the two August audit sessions — two adjacent days, one model; comparable to nothing
  earlier. Also: WS-355 (draw equity zeroed by a destructuring miss) was AUTHORED BY OPUS 5 inside
  the rigor era — the newest model produced a serious engine bug live for 5 days.
- External additions: Zhou et al., **Nature 2024** (larger models decline less, produce
  plausible-wrong more — errors "human supervisors frequently overlook"); **METR RCT** (devs 19%
  slower with AI while believing 20% faster); **PokerBench** (AAAI 2025 — all SOTA models
  underperform at poker out of the box) and **GTBench** — direct external confirmation of the
  domain-weakness hypothesis.

**This study's findings their run lacked:**
- The authored-date × commit-denominator join (defects per 100 commits per era), incl. the
  December control cell (0.6/100 under the OLDEST models, building UI) — the strongest available
  model-vs-domain separation; their record explicitly noted no denominator existed.
- The lag distribution (bimodal; 43% >90 days; 20 of 25 long-lag defects authored 03-05→04-21).
- The finer mechanism taxonomy (UNTRACED-STORY + CLAIMED-UNWIRED = 62% of the engine subset;
  computed-then-discarded ×6). The March hook purge (detection capacity non-monotonic).
- The three-regime training-data analysis (dense-correct / dense-WRONG folk poker / absent), the
  catcher distribution (tests 2–7%), and the quantified verification results (Self-Correction
  Bench 64.5%; judge TPR>96%/TNR<25%; metamorphic 75%@8.6% FPR).

**Merged build list (theirs + this study's §9, deduplicated):** persistent claim ledger with
verdicts/model/date (the missing denominator); a model field on every error/session record;
standing calibration probes as CI rather than one-off studies; populate the failure library on
every non-trivial fix; restate the dispatch doctrine at its true evidential strength; plus §9's
known-answer anchors, wire-or-delete, and assert-what-comments-claim.

## 12. Registered predictions that FAILED, recorded unhedged

- "POKER_THEORY thinned folk-poker defects after 03-09" — weakened: folk defects were authored
  after it existed. The doc enabled recognition, not prevention.
- (From the session's earlier work, same discipline:) the WS-410 ticket's own premises — three
  false at HEAD; the "exact cancellation, no assumptions" framing — refuted; the docblock units
  sentence — falsified by experiment and corrected at source with a pinning test.
