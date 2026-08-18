# The Label & Foundation Ledger

> **Prose lives here. Data lives in `src/utils/standardOfRecord/labelLedger.js`.** The ranked
> tables below are checked against `rankLabels()` id-for-id, in exact order, by
> `__tests__/labelLedger.test.js`. There is no generator — per `faultRegister.test.js:466-467`,
> a generator would just move the drift.

---

## 1. What this ledger can honestly say today

A **label-shaped input** is any discrete key standing between raw game data and a numeric engine
parameter: a position label, a style label, a hand-strength bucket, a board-texture category, an
SPR zone, a stack tier, a line tag, a size bucket.

`.claude/context/POKER_THEORY.md` §7.1 and `src/utils/exploitEngine/CLAUDE.md` already forbid
these as decision inputs, in four separately documented forms, with worked examples. **A survey
at HEAD on 2026-08-16 found 49 label families anyway, and an AST harvest found 145 constructs.**
Prose was tried, for months, and it did not work. That is the premise for this ledger being a
mechanism rather than another document.

What it can say today, precisely:

- **145 constructs** over **506 files** are harvested and every one is claimed — by a ledger row
  or by a reasoned exclusion. `node scripts/standardOfRecord/check-label-ledger.mjs` is the
  blocking gate that keeps that true.
- **65 rows are written and the triage backlog is EMPTY.** Zero constructs remain
  `not-yet-triaged`: every one of the 145 is either a ledger row or an exclusion carrying a
  reason from the closed set, assigned after reading the construct at its definition site.
- **2 of 65 rows carry a Result Card, and 62 name an instrument gap.** That ratio is the honest
  state of the engine's label surface, and the blind-spot rule (`ledgerSelfCheck`) would *fail*
  the ledger if it claimed otherwise.
- **Every `readSites` figure is derived, not counted.** `traceLabelReaders.mjs` computes it from
  the AST and `check-label-ledger.sh` re-derives every unmeasured row on each run, so a row whose
  reach has changed fails the build. The counting rule lives in `reachOf`, in code — before it
  did, three hand-authored figures had been counted three different ways and one was wrong.

What it **cannot** say: that the engine's label surface is understood. It says that the surface
is now *enumerated*, that nothing can be added to it silently, and that the gaps are named.

### What the triage found, none of it by measurement

Every item below came from reading 145 constructs and putting them in one index. No new data was
collected and no engine was run.

1. **The engine's most depended-upon table has no provenance.** `POPULATION_PRIORS` — 46 read
   sites, more than any other construct in the harvest — is an eight-cell founder estimate with
   nothing stated about where it came from. It is also the *level* half of the split
   `POPULATION_CURVE` describes, so the quality of the one measured curve is bounded by it.
2. **Two tables in the measurement path price the same buckets differently.** `deviationMap` and
   `holeMap` each hold a size-bucket midpoint table and they **disagree on three of five cells**
   (`0-33`: 0.20 vs 0.25; `150+`: 2.00 vs 1.75). Both feed instruments that report on the same
   system. This is the WS-291 mechanism caught by collision — nothing had ever forced the two
   numbers onto one axis.
3. **A transcription of an engine constant is unpinned, next to one that is pinned.**
   `holeMap.js::POPULATION_CURVE` copies the engine's fold curve with no equality test, while
   `rakeSensitivity.mjs` copies a constant, states the rule — *"a transcription is legal only
   with an executable equality check against the definition site"* — and enforces it byte for
   byte in a test. Re-fit the engine curve and the instrument silently measures the old one.
4. **The style axis survived its own removal.** WS-436 deleted the six style labels as engine
   inputs and POKER_THEORY v2.4 records that the playerStats struct "no longer carries a style
   field at all". `tiltTransform.js::STYLE_MULTIPLIERS` still keys on Fish / Nit / LAG / TAG /
   Unknown, and `archetypeRangeBuilder` keys on fish / reg / pro. Two survivors, two subsystems.
5. **An exported table has zero readers.** `FACED_RAISE_RATE`. Found by the trace, not by
   reading.
6. **Three tables borrow the authority of a solver and none cites one.** `GTO_BASELINES`,
   `GTO_OPEN_WIDTH`, and the 62-cell `solverBaselines.js::BASELINES` — in three subsystems.
   POKER_THEORY treats GTO as an *imported* reference class, never an invented one.
7. **Seven tables key on the same five hand-strength buckets** and must be ablated as a group;
   moving one while the others survive measures a seam, not the axis.

None of these is a measurement result. All of them are consequences of having an index.

---

## 2. The four foundations and the five foundation statuses

Two orthogonal axes. Collapsing them is the mistake this vocabulary exists to prevent.

**Foundation** — what kind of thing produced the number:

| Foundation | Meaning |
|---|---|
| `founder-estimate` | Informed judgment. Not a measured dataset. |
| `mined-corpus` | Aggregated from real hands. |
| `fitted-curve` | A parameter fitted by an optimisation with a stated objective. |
| `structural-computation` | Derived from board/pot geometry; has no sample size. |

**Foundation status** — what we currently know about whether it holds:

| Status | Meaning | Standing instance |
|---|---|---|
| `undeclared` | No provenance stated anywhere. | `REALIZATION_TABLE`, `BUCKET_MIDPOINT` |
| `declared-estimate` | Provenance stated, and it says founder estimate. | `populationPriors.js:8-12` |
| **`measured-refuted`** | **Measured, NOT supported, still shipping.** | `FOLD_CURVE_STREET_MODS` |
| `measured-supported` | A Result Card supports it. | `ACTION_TAU_FRACTION` |
| `generated` | Mechanically produced from a corpus. | `handhqReferencePool.js` |

**`measured-refuted` is the status that earns the whole vocabulary.** A four-value set cannot say
*we looked, it failed, it ships*. Collapsing it into `undeclared` erases the measurement;
collapsing it into `measured-supported` launders it.

Note carefully what that status does **not** allege. `FOLD_CURVE_STREET_MODS` is not an
unnoticed defect — POKER_THEORY v2.3 records the null deliberately, and declining to tune on a
~5e-4 effect an order of magnitude below the population-curve correction is a defensible call.
What the ledger adds is that the decision was discoverable only by reading one docblock in one
file. A row makes it rankable against everything else.

---

## 3. The evidence ladder

The ranking currency is absolute EV. Most rows start unmeasured. WS-445's own `decision_flags`
named the failure mode: *the ledger silently becomes a list of unmeasured guesses wearing EV
units.*

| Tier | Carries | Ranked against |
|---|---|---|
| **MEASURED** | `absEvBB100`, a CI, and a `resultCardId` that resolves | other measured and bounded rows, by magnitude |
| **BOUNDED** | `boundBB100` with a direction glyph, a method from a closed set, prose derivation | same list, rendered `≤`/`≥` so it never reads as an estimate |
| **UNMEASURED** | reach (`readSites`, `cellCount`, `primaryPath`) and a named instrument | **only other unmeasured rows, by reach** |

**An UNMEASURED row carries no EV figure and cannot be given one.** This is not a rule someone
enforces — it is a shape. `buildUnmeasuredReach` mints no EV key at all, so `absEvBB100` is
`undefined` rather than `null`: there is no slot to fill, and nothing for a future relaxation to
unlock. `impactProblems` rejects an *extra* key as well as a missing one, so the field cannot be
bolted on by hand. `rankLabels()` returns two arrays and no exported function concatenates them.

An UNMEASURED row must **name the instrument** that would measure it, with a ticket. An entry
with no instrument is a complaint, not a ledger row — the same bar `falsifier` clears in the
fault register, for the same reason: a surface nobody can settle re-emits at rank 1 forever.

---

## 4. The ranked ledger — measured and bounded

<!-- LABEL-LEDGER:BEGIN -->

| # | Label | Site | Foundation | Foundation status | Tier | Abs-EV (bb/100) | Basis |
|---|---|---|---|---|---|---|---|
| 1 | `LBL-action-tau-fraction` | `ACTION_TAU_FRACTION` | fitted-curve | measured-supported | measured | 0.54 | RC-per-player-width-790a6ffd |
| 2 | `LBL-fold-curve-street-mods` | `FOLD_CURVE_STREET_MODS` | founder-estimate | measured-refuted | bounded | ≤ 0.05 | ablation-delta |
| 3 | `LBL-style-collapse` | `STYLE_PRIORS` | founder-estimate | measured-supported | measured | 0 | RC-STYLE-COLLAPSE-2026-08-12 |

<!-- LABEL-LEDGER:END -->

**Read row 3 as the worked example.** `LBL-style-collapse` is the six style labels WS-436
removed. Its measured impact is **0** — the label channel carried no villain-action information
(ΔLL −0.00076 over 10,147 paired decisions, n.s.) and its removal was advice-parity at exactly
n=0 changed decisions. Its lesson is the one the whole ledger is organised around: **the
foundation column matters more than the label column.** The same-source continuous replacement
tried in its place was *refuted* at ΔLL −0.00691, t=−5.64 — a failure the label taxonomy had no
way to express.

---

## 5. The unmeasured surface, ranked by reach

There is **no EV column in this table, and a test asserts there never will be.** That is the
doc-side mirror of the module-side impossibility in §3.

<!-- LABEL-LEDGER-UNMEASURED:BEGIN -->

| # | Label | Site | Foundation | Foundation status | Read sites | Cells | Primary path | Instrument ticket |
|---|---|---|---|---|---|---|---|---|
| 1 | `LBL-population-priors` | `POPULATION_PRIORS` | founder-estimate | undeclared | 46 | 8 | yes | WS-445 |
| 2 | `LBL-observation-thresholds` | `T` | founder-estimate | undeclared | 41 | 44 | yes | WS-445 |
| 3 | `LBL-equity-ladder` | `EQ` | founder-estimate | declared-estimate | 24 | 5 | yes | WS-445 |
| 4 | `LBL-handhq-reference-pool` | `HANDHQ_OPENER_FACING_3BET` | mined-corpus | generated | 17 | 43 | yes | WS-445 |
| 5 | `LBL-concept-registry` | `CONCEPT_REGISTRY` | founder-estimate | undeclared | 16 | 52 | yes | WS-445 |
| 6 | `LBL-equity-vs-open` | `EQUITY_VS_OPEN` | structural-computation | generated | 6 | 845 | yes | WS-445 |
| 7 | `LBL-population-curve` | `POPULATION_CURVE` | fitted-curve | measured-supported | 13 | 5 | yes | WS-445 |
| 8 | `LBL-game-type-rake-defaults` | `GAME_TYPES` | founder-estimate | undeclared | 12 | 14 | yes | WS-445 |
| 9 | `LBL-fear-greed-factor-weights` | `FEAR_FACTOR_WEIGHTS` | founder-estimate | declared-estimate | 12 | 11 | yes | WS-445 |
| 10 | `LBL-leak-rule-thresholds` | `rule` | founder-estimate | undeclared | 10 | 29 | yes | WS-445 |
| 11 | `LBL-equity-skew-decomposition` | `EQUITY_SKEW_DECOMPOSITION` | structural-computation | generated | 1 | 1032 | yes | WS-445 |
| 12 | `LBL-fold-rate-thresholds` | `FOLD_RATE_THRESHOLDS` | founder-estimate | undeclared | 9 | 5 | yes | WS-445 |
| 13 | `LBL-solver-baselines` | `BASELINES` | founder-estimate | undeclared | 3 | 62 | yes | WS-445 |
| 14 | `LBL-action-multipliers` | `ACTION_MULTIPLIERS` | founder-estimate | undeclared | 7 | 20 | yes | WS-445 |
| 15 | `LBL-preflop-raise-sizes` | `PREFLOP_RAISE_SIZES` | founder-estimate | undeclared | 7 | 20 | yes | WS-445 |
| 16 | `LBL-stat-priors` | `STAT_PRIORS` | founder-estimate | declared-estimate | 7 | 18 | yes | WS-445 |
| 17 | `LBL-assumption-gate-thresholds` | `VILLAIN_SIDE_THRESHOLDS` | founder-estimate | declared-estimate | 7 | 11 | yes | WS-445 |
| 18 | `LBL-bucket-equity-anchors` | `BUCKET_EQUITY_ANCHORS` | founder-estimate | undeclared | 7 | 5 | yes | WS-445 |
| 19 | `LBL-realization-table` | `REALIZATION_TABLE` | founder-estimate | undeclared | 4 | 30 | yes | WS-407 |
| 20 | `LBL-pop-betting-rates` | `POP_BETTING_RATES` | founder-estimate | declared-estimate | 6 | 5 | yes | WS-445 |
| 21 | `LBL-pop-calling-rates` | `POP_CALLING_RATES` | founder-estimate | declared-estimate | 6 | 5 | yes | WS-445 |
| 22 | `LBL-rake-schedules` | `DEFAULT_RAKE_CONFIG` | founder-estimate | declared-estimate | 5 | 12 | yes | WS-445 |
| 23 | `LBL-faced-raise-frequencies` | `FACED_RAISE_FREQUENCIES` | founder-estimate | undeclared | 4 | 15 | yes | WS-445 |
| 24 | `LBL-impact-map` | `IMPACT_MAP` | founder-estimate | declared-estimate | 1 | 44 | yes | WS-445 |
| 25 | `LBL-risk-map` | `RISK_MAP` | founder-estimate | declared-estimate | 1 | 44 | yes | WS-445 |
| 26 | `LBL-action-prior-construction` | `buildActionPrior` | structural-computation | declared-estimate | 3 | 22 | yes | WS-445 |
| 27 | `LBL-outcome-aware-boosts` | `altSuitBoost` | founder-estimate | undeclared | 4 | 9 | yes | WS-445 |
| 28 | `LBL-archetype-bucket-multipliers` | `ARCHETYPE_BUCKET_MULTIPLIERS` | founder-estimate | declared-estimate | 3 | 15 | yes | WS-445 |
| 29 | `LBL-group-call-rates` | `GROUP_CALL_RATES` | founder-estimate | declared-estimate | 1 | 31 | yes | WS-445 |
| 30 | `LBL-dial-and-decay-defaults` | `DIAL_DEFAULTS` | founder-estimate | undeclared | 3 | 5 | yes | WS-445 |
| 31 | `LBL-hero-seat-by-pos` | `HERO_SEAT_BY_POS` | structural-computation | declared-estimate | 3 | 5 | yes | WS-445 |
| 32 | `LBL-subclass-split` | `SUBCLASS_SPLIT` | founder-estimate | undeclared | 1 | 25 | yes | WS-445 |
| 33 | `LBL-texture-realization` | `TEXTURE_REALIZATION` | founder-estimate | undeclared | 3 | 5 | yes | WS-407 |
| 34 | `LBL-tilt-style-multipliers` | `STYLE_MULTIPLIERS` | founder-estimate | undeclared | 3 | 5 | yes | WS-445 |
| 35 | `LBL-default-continuation-rates` | `DEFAULT_CONTINUATION_RATES` | founder-estimate | undeclared | 3 | 4 | yes | WS-445 |
| 36 | `LBL-maturity-thresholds` | `MATURITY_THRESHOLDS` | founder-estimate | undeclared | 3 | 4 | yes | WS-445 |
| 37 | `LBL-ladder-axes` | `AXES` | founder-estimate | declared-estimate | 3 | 3 | yes | WS-320 |
| 38 | `LBL-consequence-weights` | `CONSEQUENCE_WEIGHTS` | founder-estimate | declared-estimate | 1 | 20 | yes | WS-445 |
| 39 | `LBL-positional-fold-to-3bet` | `POSITIONAL_FOLD_TO_3BET` | founder-estimate | undeclared | 2 | 10 | yes | WS-445 |
| 40 | `LBL-weakness-to-delta` | `WEAKNESS_TO_DELTA` | founder-estimate | declared-estimate | 2 | 9 | yes | WS-445 |
| 41 | `LBL-range-boost-switch` | `getRangeBoost` | founder-estimate | undeclared | 1 | 16 | yes | WS-445 |
| 42 | `LBL-four-bet-frequencies` | `FOUR_BET_FREQUENCIES` | mined-corpus | generated | 1 | 15 | yes | WS-521 |
| 43 | `LBL-no-raise-frequencies` | `NO_RAISE_FREQUENCIES` | founder-estimate | undeclared | 1 | 15 | yes | WS-445 |
| 44 | `LBL-deviation-type-switch` | `deriveRecommendedAction` | structural-computation | undeclared | 2 | 3 | yes | WS-445 |
| 45 | `LBL-open-rate-prior` | `OPEN_RATE_PRIOR` | founder-estimate | declared-estimate | 2 | 2 | yes | WS-445 |
| 46 | `LBL-faced-3bet-role-frequencies` | `FACED_3BET_FREQUENCIES_BY_ROLE` | mined-corpus | measured-supported | 1 | 9 | yes | WS-521 |
| 47 | `LBL-per-stat-prior-weight` | `PER_STAT_PRIOR_WEIGHT` | mined-corpus | measured-supported | 1 | 6 | yes | WS-445 |
| 48 | `LBL-bucket-midpoint` | `BUCKET_MIDPOINT` | founder-estimate | undeclared | 1 | 5 | yes | WS-445 |
| 49 | `LBL-holemap-curve-transcription` | `POPULATION_CURVE` | fitted-curve | measured-supported | 1 | 5 | yes | WS-445 |
| 50 | `LBL-population-curve-raise` | `POPULATION_CURVE_RAISE` | fitted-curve | measured-supported | 1 | 5 | yes | WS-445 |
| 51 | `LBL-positional-fold-to-4bet` | `POSITIONAL_FOLD_TO_4BET` | founder-estimate | undeclared | 1 | 5 | yes | WS-445 |
| 52 | `LBL-size-bucket-midpoint-holemap` | `SIZE_BUCKET_MIDPOINT` | founder-estimate | undeclared | 1 | 5 | yes | WS-445 |
| 53 | `LBL-stake-factor` | `stakeFactor` | founder-estimate | declared-estimate | 1 | 5 | yes | WS-445 |
| 54 | `LBL-gto-open-width` | `GTO_OPEN_WIDTH` | founder-estimate | undeclared | 1 | 4 | yes | WS-445 |
| 55 | `LBL-outs-scaling` | `OUTS_SCALING` | founder-estimate | undeclared | 1 | 4 | yes | WS-445 |
| 56 | `LBL-bucket-raise-fraction` | `bucketRaiseFraction` | founder-estimate | undeclared | 1 | 3 | yes | WS-445 |
| 57 | `LBL-study-priority-frequencies` | `POSITION_PAIR_FREQ` | founder-estimate | declared-estimate | 6 | 72 | no | WS-445 |
| 58 | `LBL-calibration-ladder` | `CALIBRATION_LADDER` | founder-estimate | declared-estimate | 9 | 5 | no | WS-445 |
| 59 | `LBL-gto-baselines` | `GTO_BASELINES` | founder-estimate | undeclared | 6 | 6 | no | WS-445 |
| 60 | `LBL-skill-signal-weights` | `DEFAULT_WEIGHTS` | founder-estimate | declared-estimate | 6 | 6 | no | WS-445 |
| 61 | `LBL-m-ratio-zones` | `M_RATIO_ZONES` | founder-estimate | declared-estimate | 4 | 8 | no | WS-445 |
| 62 | `LBL-flush-deltas` | `FLUSH_DELTAS` | structural-computation | declared-estimate | 3 | 6 | no | WS-445 |
| 63 | `LBL-recognizability-map` | `RECOGNIZABILITY_MAP` | founder-estimate | declared-estimate | 1 | 23 | no | WS-445 |
| 64 | `LBL-faced-raise-rate` | `FACED_RAISE_RATE` | founder-estimate | undeclared | 0 | 5 | no | WS-445 |

<!-- LABEL-LEDGER-UNMEASURED:END -->

*Rows are referenced by `LBL-` id below, never by row number — the ranking re-sorts whenever a
reach figure changes, and a prose paragraph pointing at "row 9" would rot silently.*

**`LBL-population-priors` is the finding the ledger was built to produce.** `POPULATION_PRIORS`
has **46 read sites** — the widest reach of any construct in the harvest — and **no stated
provenance**. An eight-cell founder estimate is the engine's single most depended-upon table, and
nothing anywhere said so. It is also the *level* half of the split `POPULATION_CURVE` describes:
the curve was allowed to import an online-mined **shape** precisely because the level stays in
this table. The quality of the measured curve is therefore bounded by the quality of the
unmeasured one.

**Read the bottom of this table as carefully as the top.** The lowest-reach rows have one read
site each and none is unimportant. `LBL-bucket-midpoint` sits inside the **measurement path**,
not the engine: `scripts/backtest/deviationMap.mjs:61` passes it to `deriveFloor`, so it sets the
defensive floor every deviation cell is scored *against*. A low reach rank means "it touches
little code", never "it would not matter".

**`LBL-faced-raise-rate` was found by the instrument, not by reading.** `FACED_RAISE_RATE` is
exported and has **zero** production readers anywhere in `src/` or `scripts/`. It is the only
genuinely vestigial named table in the harvest — and the trace's *first* run also reported the
ten `leakRules/*.js` rules as vestigial, which was false (`heroLeakDetector.js:19` loads them by
`import.meta.glob`). That near-miss is why the row states a deletion **falsifier** rather than a
recommendation: `vestigial` is the one value here that licenses destroying working code.

**The counter-examples fail differently, and that is why both are here.**
`LBL-handhq-reference-pool` has the best foundation in the repo — generated, regeneratable,
hand-edits forbidden by its own contract — and its open question is **transfer, not provenance**:
the corpus is online 2009 and the founder's game is live 9-handed 1/2–1/3, so any live claim
resting on it is *transferred, not measured*. `LBL-per-stat-prior-weight` states its estimator,
its sample (12.9M hands), and the prior belief it refuted (a flat cap of 200, ~20× too confident)
— but only `vpip` was validated and the other five carry the same weight by assumption.
`LBL-equity-skew-decomposition` carries a full replication manifest (engine commit, dirty flag,
deal-book hashes, noise floor) and has **one** reader for 1,032 cells. The ledger has to say all
of that without flattening it.

**`LBL-realization-table` is the case for the ledger existing.** `REALIZATION_TABLE` already had
**three** separately-filed instrument tickets — WS-404 (P=28), WS-407 (24), WS-498 (30) — filed
by different analyses at different times, all in `prog-domain-correctness`, none referencing the
others. One row collapses them. The ledger is a deduplicating index over work the queue is
already doing blind, not merely an inventory.

**The pattern no single row shows.** `LBL-pop-calling-rates`, `LBL-pop-betting-rates`,
`LBL-bucket-equity-anchors`, `LBL-action-multipliers`, `LBL-outs-scaling`,
`LBL-texture-realization` and `LBL-bucket-raise-fraction` are all founder estimates keyed on the
*same five hand-strength buckets*, read on the primary path, and they are the input side of
exactly the decomposition WS-436 measured on the output side. They must be instrumented as a
**group**: ablating `POP_CALLING_RATES` while `BUCKET_EQUITY_ANCHORS` still keys on the same
buckets measures a seam between two survivors, not the bucket axis.

**Three rows need no study at all — they are defects with a fix.**
`LBL-size-bucket-midpoint-holemap` (two measurement-path tables disagreeing on three of five
cells), `LBL-holemap-curve-transcription` (an unpinned copy of an engine constant, beside a
pinned one, under a rule the neighbouring file states explicitly), and `LBL-rake-schedules` (the
live schedule is *modelled* when the founder's room publishes the real one — data entry, and the
cheapest improvement to live-transferred EV in this ledger).

---

## 6. Exclusions

A harvested construct that is not a label-shaped input carries an exclusion reason from the
closed `EXCLUSION_REASONS` set. **The harvest is deliberately over-inclusive**: a false positive
costs one reasoned line here, a false negative costs a row nobody ever writes.

`not-yet-triaged` requires a ticket and expires after 90 days — an exception that never expires
is how an exclusions list quietly becomes the register. `touch-floor.spec.js:80-82` points the
same way with its stale-pin check: *pins may only shrink, never linger.*

Current state: **zero constructs are `not-yet-triaged`.** The seeded backlog was worked to empty
on 2026-08-17 rather than aged out, so the expiry mechanism has not yet had to fire. It remains
the guard for the next construct someone snapshots with `--update` and does not think about.
`node scripts/standardOfRecord/check-label-ledger.mjs --unledgered` lists anything outstanding;
`node scripts/standardOfRecord/traceLabelReaders.mjs` ranks it by how much depends on it.

**54 constructs carry a real reason as of 2026-08-17**, each read at its definition site before
the reason was assigned. Grouped by why they are not label-shaped inputs:

| Reason | n | What they are |
|---|---|---|
| `not-a-label` | 30 | The keys are not labels. Parse maps (`NUMBER_WORDS`, `MONTHS`, `RANK_VALUE`, `VILLAIN_NUMBER_TOKENS`), structural facts of the game (`HAND_CATEGORIES` ordinals, street→board-card-count, `POSTED_BB`, `LIMITS`), enum indices (`BUCKETS` is 0–9 for stacked-bar ordering), sort ordinals (`PRIORITY_ORDER`, `ACTION_CONSERVATISM_RANK`), zero-value structs (`ZERO_RISK`, `EMPTY_INDEX`), determinism plumbing (`RNG_SALT`), disk budgeting (`atomStore`), user config (`PAYOUT_PRESETS`, `DEFAULT_SETTINGS`), and the eight `LINE_*` Line Mode walkthroughs, whose keys are node ids. |
| `outside-engine-path` | 8 | Label-shaped, but no consumer reaches a strategy, range, or EV parameter: `playerMatching` recognition weights and the six `silhouettePrototypes` range-shape descriptors. |
| `display-only` | 6 | `HERO_CONTEXTS` (labels + sortOrder for a panel), `AGE_DECADE_GRAY_SHIFT`, thought/evidence phrasing ternaries, and a street cutoff in a console-printing script. |
| `result-card-artifact` | 5 | Built Result Cards, not lookup tables — the four `buildResultCard(...)` calls in `emit-ws4*.mjs`, plus `WITHIN_CORPUS_DRIFT_2009`, a measurement record (`measuredBy: 'WS-353'`, `sourceId: 'SRC-012'`) embedded in the fault register. |
| `schema-or-version` | 3 | `SCHEMA_RULES`, `METRICS_SCHEMA_VERSIONS`, `SOR_SCHEMA_VERSIONS`. |
| `ui-geometry` | 1 | `LAYOUT` — the 1600×720 design canvas, read by `useCanvasFit` and `ScaledContainer`. |
| `test-fixture` | 1 | `plumbingProofCard`. |

**`outside-engine-path` was added to the closed set during this triage**, because the harvester
*promised* it and it did not exist: `harvestLabelConstructs.mjs:70-74` justifies its broad roots
by saying the cost is "~20 constructs in `shapeLanguage`, `playerMatching`, `claimAdjudication`
and `standardOfRecord` that are not engine-parameter paths; they become exclusions carrying a
stated reason." `not-a-label` would have been a false statement about them — a feature label
keyed to a numeric weight is exactly the harvested shape. Its boundary is deliberately tight:
*no consumer reaches a strategy, range, or EV parameter.* "It is only a fallback", "it is
legacy", and "it is low reach" do **not** qualify — those are properties a **row** records in
`liveness` and `readSites`.

**One exclusion was assigned wrongly and corrected in the same session.** The eight `LINE_*`
constructs were first marked `test-fixture`; they are shipped Line Mode study content ("curated
branching hand walkthroughs"), not fixtures, and are now `not-a-label`. Recorded because a
wrong reason is precisely the failure the reason vocabulary exists to prevent, and because an
exclusions list that never shows a correction is not being checked.

**Two that look excludable and are not, recorded here so the reasoning is not re-litigated.**
`FOLD_RATE_THRESHOLDS` calls itself thresholds "for human-readable language", but its readers
include `villainProfileBuilder.js`, not only renderers — so it holds a row until that is checked.
`M_RATIO_ZONES` is headed "for color coding" and still manufactures a zone from `min` cut points,
which is the same threshold-as-label shape; a cosmetic `label`/`color` field beside a threshold
does not make the threshold cosmetic.

---

## 7. What the gate catches, and what it provably cannot

The exhaustiveness claim is **bounded and re-runnable**, not asserted: *over these globs, these
three syntactic forms, and this leaf classification, the harvest at HEAD produced 145 constructs
in 506 files; the ledger claims all 145; and the following are outside its reach by
construction.*

**Threshold-as-label is the largest known hole, and it is inherited rather than introduced.**
`getSPRZone` (`src/utils/pokerCore/sprBands.js:49`) manufactures `micro`/`low`/`medium`/`high`/
`deep` from `SPR_BAND_EDGES = [2, 4, 8, 13]`, with no string literal at the decision site. The
harvest sees every *consumer* of `micro` and none of its *manufacture*. The same applies to every
other boundary constant. `exploitEngine/CLAUDE.md` already names threshold-as-label as a fourth
anti-pattern — this gate does not close it.

**Labels that never write their tokens down are invisible.** A label assembled from a template
string, or read from IndexedDB, Firestore, or a persisted user setting, has no literal for the
visitors to see. Measured today: zero JSON data imports in scope. A real future hole with no AST
answer.

**An inlined copy of a table value is undetectable in principle.** A number an author read out of
`POP_CALLING_RATES` and typed into another file has no key and no token.

**`vestigial` is a scoped claim.** The consumer trace resolves identifiers only within the scanned
globs, so it means *no reader in scope* — never *no reader*.

**Precision is not uniform, and it was bought deliberately.** Recall against the survey's named
families is **16 of 17**; the single miss is `STYLE_DESCRIPTIONS`, a label→string display map,
rejected by design. Precision is roughly **94%**. Two recall bugs were found and fixed while
building this — `ACTION_TAU_FRACTION` (three of four values are an identifier, not a literal) and
`PREFLOP_RAISE_SIZES` (values are numeric *arrays*) — and a third, `M_RATIO_ZONES`, was rejected
only because it carries cosmetic `label`/`color` fields beside its thresholds. Each was a case of
the detector being too strict, and each was widened rather than documented as a limitation.

**The family count and the construct count are different numbers, and both stay visible.** The
survey counted **49 families**; the harvest counts **145 constructs**. A family spans several
constructs and the harvest includes non-label constructs headed for exclusion. Neither number is
silently replaced by the other, and the reconciliation between them is the triage backlog in §6.

---

## 8. Adding a row

1. Run the gate. `UNLEDGERED CONSTRUCT` names the `file:line` and the key.
2. **Read the source.** A foundation or a bound *invented* rather than read is
   `FAULT-constants-by-taste` wearing a new hat — the exact fault this ledger exists to expose.
   If the source states no provenance, the honest `provenance` value says so.
3. Write the row in `labelLedger.js`. Pick the impact constructor that matches the evidence you
   actually have. If that is `buildUnmeasuredReach`, name the instrument and its ticket.
   **Do not count `readSites` by hand** — `node scripts/standardOfRecord/traceLabelReaders.mjs
   --key '<harvest key>'` derives it, and `--verify` will fail the build if your row disagrees
   with the trace. The three figures that predated the tool had been counted three different
   ways and one of them was wrong; the counting rule now lives in `reachOf`, in code.
4. Point the baseline row's `ledger` field at the new `LBL-` id, and list the harvest key in the
   row's `sites`.
5. Add the row to the table in §4 or §5 in its ranked position. The drift test will tell you if
   the order is wrong.

**`--update` does not do step 3 for you.** It writes new constructs with `ledger: null`, and a
null ledger is itself a violation. It records that a construct exists; it never asserts anyone
thought about it.

---

## 9. The ledger as a work queue

Every UNMEASURED row names an instrument and a ticket, which makes the ledger a ranked build
list rather than a ranked complaint list. The blind-spot rule (`ledgerSelfCheck`) enforces that
reading in the suspicious direction:

- **Zero unmeasured rows fails.** A ledger asserting the engine's entire label surface is
  grounded makes a claim no evidence in this repo supports.
- **Zero open instrument gaps fails.** *A ledger with nothing left to instrument is not a
  finished ledger; it is a ledger that stopped asking.*
- A majority-measured ledger with nothing left to instrument fails — check that "measured" has
  not come to mean "I looked at it".
- Coverage is **reported, never gated**. Forcing a Result Card per row would produce fake cards;
  `registerSelfCheck` makes the same choice for the same reason.

Resolving a row requires recorded evidence **and** a note stating what the resolution does *not*
cover, reusing `clearFalsifierBlocker`'s contract verbatim. Rows are append-only: a deleted
construct moves its row to `resolved` carrying the commit, and never disappears.
