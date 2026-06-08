# SCF Hero-Leak Catalog

**Status:** v1 authored 2026-05-03 (SPR-030 / WS-145).
**Companion docs:** `skill-assessment-module.md` (architecture), `anti-patterns.md` (AP-SCF-04 sample-size floor), `copy-discipline.md` (CD-5 4-field claim discipline).

---

## Purpose

This catalog enumerates the full gamut of hero-side poker leaks that the SCF (Self-Coach Foundation) program intends to detect over time. Each entry captures intent + scope + complexity + status so future authoring is purely sequential single-file additions, not architectural decisions.

**Founder direction (2026-05-03 SPR-030 plan-mode):** "Build it right to support the gamut of potential leaks, then fill them in as we author them. We can start with basic leaks, but we need a mechanism to make sure more complicated leaks are queued up and supported for future development, eventually exhausting possible leaks of various types."

This catalog **is** that mechanism.

## Coverage progress

| Category | Total entries | Shipped | Spec'd | Planned | Future-research | Deferred |
|---|---:|---:|---:|---:|---:|---:|
| Preflop fold-equity | 4 | **3** ★★★ | 0 | 0 | 0 | 1 |
| Preflop sizing | 3 | 0 | 0 | 3 | 0 | 0 |
| Flop continuation | 3 | **3** ★★★ | 0 | 0 | 0 | 0 |
| Flop sizing | 2 | 0 | 0 | 2 | 0 | 0 |
| Turn barrel | 3 | 0 | 0 | 1 | 2 | 0 |
| River bluff-catch | 2 | 0 | 0 | 0 | 2 | 0 |
| Multiway adjustment | 2 | **1** ★ | 0 | 0 | 1 | 0 |
| Capped-range misread | 2 | 0 | 0 | 1 | 1 | 0 |
| Position discipline | 2 | 0 | 0 | 2 | 0 | 0 |
| Sample-size discipline | 2 | 0 | 0 | 2 | 0 | 0 |
| **Total** | **25** | **7** | 0 | 11 | 6 | 1 |

**v1 milestone:** 7/25 shipped (★ IP cbet defense overfold (SPR-030); ★ BB defense width (SPR-031); ★ OOP cbet defense overfold (SPR-040); ★ Flop vs donk misresponse (SPR-040); ★ PF 3bet overfold (SPR-046); ★ OOP 3bet underfold (SPR-046); ★ Multiway cbet frequency (SPR-108) — **first decision-bucket/aggression-frequency rule**, opening the frequency-of-aggression substrate that was the blocker class deferred since SPR-046). Flop-continuation category **closed 3/3**; preflop fold-equity **3/4 shipped** (1 deferred — `hero-pf-open-overfold` blocked on accumulator design). Shipped rules bind to **cluster umbrella concepts** (SPR-033 / WS-148 + SPR-040 + SPR-046): `cbet-defense-cluster` + `bb-defense-cluster` + `oop-cbet-defense-cluster` + `flop-vs-donk-defense-cluster` + `pf-3bet-defense-cluster` + `oop-3bet-defense-cluster`. SPR-046 also shipped the **first UNDER-fold direction** in the catalog (`hero-oop-3bet-underfold`) — establishes the mirror detection pattern for future under-fold rules. Per the granularity floor (`feedback_scf_high_granularity.md`), 29 fine-grained sub-concepts under those umbrellas are registered in `src/utils/skillAssessment/tierConceptMap.js`; sub-concept lesson files land in WS-149 ongoing.

**SPR-040 architectural note:** Situation key extended from 7 to 8 axes (added `preflopAggressor` — `pfa`/`pfc`/`na`). This was necessary for the donk rule to distinguish "hero raised preflop, faces villain donk" from "hero called preflop, faces villain cbet" — both situations had collapsed to the same bucket under the 7-axis key. The IP cbet rule narrowed to `pfc` post-migration (donk-response cases now route to the new donk rule). All existing baselines + tests + sub-concept resolution migrated.

**Status legend:**
- **SHIPPED** — Rule live in `src/utils/skillAssessment/leakRules/`; IDB writes happening; badge can render.
- **SPEC'D** — Detector logic + solver baseline source + situation keys all decided; ready to author. ~30 min/rule.
- **PLANNED** — Intent + scope captured; needs detector spec + baseline source decision before authoring. ~2-3 hr/rule.
- **FUTURE-RESEARCH** — Open question on either solver-baseline source (no clean reference exists) or situation-key fragmentation (rule splits into too many keys to be actionable). Needs research sprint before spec'ing.

---

## Entries

### Preflop fold-equity leaks

#### `hero-pf-open-overfold`
- **Label:** Preflop open-fold rate (RFI)
- **Category:** preflop-fold-equity
- **Complexity tier:** Medium
- **Status:** PLANNED
- **Situation keys:** `preflop:none:{EARLY|MIDDLE|LATE|BUTTON}:agg:none:none:open` (one per position)
- **Solver baseline source:** Hardcoded (well-known by position: EP ~14%, MP ~17%, HJ ~21%, CO ~26%, BTN ~40% — open-raise frequencies)
- **Intent:** Detect when hero opens too tight from a position, leaving open EV on the table by missing playable hands.
- **Scope notes:** Inverse leak (folding too much when should open) is detectable; overopening (raising too wide) is its own rule (`hero-pf-open-too-wide`, also planned). Rules diverge in remediation (tighten range vs widen).
- **Expansion notes:** v2 split by table dynamic (passive vs active table — open ranges shift); v3 split by stack depth (short-stack vs deep).

#### `hero-pf-3bet-overfold` ★ v1 (SPR-046)
- **Label:** Folding to 3bets too often (post-open)
- **Category:** preflop-fold-equity
- **Complexity tier:** Medium
- **Status:** **SHIPPED v1 (SPR-046 / WS-146 third claim)** — Drill-this opens `pf-3bet-defense-cluster.md`
- **Situation keys:** `preflop:none:{EARLY|MIDDLE|LATE|BUTTON}:agg:{ip|oop}:raise:vs3bet:na` (8 bucket configurations matched; 4 distinct baselines via isIP normalization in `solverBaselineKey`)
- **Solver baseline source:** Hardcoded per opener position (~50% EARLY → ~55% LATE/BUTTON)
- **Ship sprint:** SPR-046
- **Related concept:** `pf-3bet-defense-cluster` (umbrella) — lesson at `lessons/pf-3bet-defense-cluster.md`. Sub-concepts: `pf-3bet-defense-{EARLY|MIDDLE|LATE|BUTTON}` registered in `tierConceptMap.js` (lessons WS-149).
- **Intent:** Hero opens then over-folds to 3bets, allowing 3bettor to print money against the open.
- **Scope notes:** Opposite of `hero-oop-3bet-underfold` (which is about the 3bet caller). This rule is about the original raiser. v1 normalizes isIP axis to a single per-position baseline (per-isIP and per-3bettor-position splits are v2 expansions).
- **Expansion notes:** v2 split by 3bettor stack-off propensity (TAGs underbluff 3bets, fish overbluff); v3 split by 3bet sizing.

#### `hero-pf-open-overfold` (DEFERRED)
- **Label:** Preflop open-fold rate (RFI)
- **Category:** preflop-fold-equity
- **Complexity tier:** Medium
- **Status:** **DEFERRED 2026-05-07 (SPR-046 mid-sprint discovery)** — structurally blocked by current accumulator design.
- **Discovery:** `deriveSituationKey:DERIVE_CONTEXT_ACTION` buckets RFI fold (`limp` contextAction; verb='fold' falls through the open/limp branch) and RFI open (`open` contextAction; verb='raise') under different keys. The accumulator can't compute fold-rate over the RFI decision space from a single bucket. Other shipped rules avoid this because vs-bet defense buckets all actions (fold/call/raise) under the same `contextAction`.
- **Resolution path:** either (a) refactor `DERIVE_CONTEXT_ACTION` so RFI fold + RFI open share `contextAction='rfi'` (breaking change to existing situation keys; requires migration of all shipped rules + tests), or (b) add an additive "decision-class bucket" path to the accumulator that aggregates across action-taken (preserves existing keys, adds a parallel bucket type).
- **Re-targeted situation keys (post-resolution):** `preflop:none:{EARLY|MIDDLE|LATE|BUTTON}:agg:none:none:rfi:na` (using `:rfi:` if option a) OR a new accumulator output with shared bucket key per (street × position × pre-action-state) regardless of action verb.
- **Sprint pivot:** SPR-046 swapped this rule for `hero-pf-3bet-overfold` after the discovery (founder-ratified 2026-05-07). The pivot keeps the same sprint goal (close preflop fold-equity gap +2 → 3/4) without dragging an accumulator refactor into a leak-rule sprint.

#### `hero-oop-3bet-underfold` ★ v1 (SPR-046) — first UNDER-fold rule in catalog
- **Label:** OOP 3bet defense width (calling too wide post-flat)
- **Category:** preflop-fold-equity
- **Complexity tier:** Medium
- **Status:** **SHIPPED v1 (SPR-046 / WS-146 third claim)** — Drill-this opens `oop-3bet-defense-cluster.md`
- **Situation keys:** `preflop:none:SMALL_BLIND:def:oop:raise:vs3bet:na`, `preflop:none:BIG_BLIND:def:oop:raise:vs3bet:na` (2 keys; SB + BB only for v1)
- **Solver baseline source:** Hardcoded (~72% SB / ~75% BB target fold rate post-flat)
- **Ship sprint:** SPR-046
- **Related concept:** `oop-3bet-defense-cluster` (umbrella) — lesson at `lessons/oop-3bet-defense-cluster.md`. Sub-concepts: `oop-3bet-defense-{SB|BB}` registered in `tierConceptMap.js` (lessons WS-149).
- **Intent:** Hero called an open from SB/BB, then faces a 3bet (squeeze or re-isolation). Calling too wide bleeds chips post-flop OOP without initiative at high SPR. First UNDER-fold rule in the catalog — mirror direction of all over-fold rules.
- **Scope notes:** v1 covers SB + BB only. CO defending OOP after flat-call is a documented catalog scenario but the position categorizer emits 'MIDDLE' (9max) or 'LATE' (6max) for CO seats, not 'CO' literal — adding requires either a position-categorizer change or matching MIDDLE/LATE here (which broadens scope beyond squeeze-defense). Deferred to v2.
- **Expansion notes:** v2 add CO post-flat (with position-categorizer extension); v3 split by 3bet sizing (smaller 3bets justify wider defense); v4 add squeezer-style adjustment (passive squeeze → wider continue; aggressive squeeze → tighter).

#### `hero-bb-defense-width` ★ v2 (SPR-031)
- **Label:** BB defense width — fold rate vs single open
- **Category:** preflop-fold-equity
- **Complexity tier:** Simple
- **Status:** **SHIPPED v1 (SPR-031 / WS-146 first claim)** + **lesson bound (SPR-032 / WS-147)** + **umbrella restructure (SPR-033 / WS-148)** — Drill-this opens `bb-defense-cluster.md`
- **Situation keys:** `preflop:none:BIG_BLIND:def:oop:raise:vsopen` (single key — opener-position split deferred to v2)
- **Solver baseline source:** Hardcoded (~45% across opener positions in v1; per-opener-position split is v2 expansion)
- **Ship sprint:** SPR-031
- **Related concept:** `bb-defense-cluster` (umbrella) — lesson at `lessons/bb-defense-cluster.md`. Sub-concepts: `bb-defense-vs-EARLY/MIDDLE/LATE/BUTTON/SMALL_BLIND` registered in `tierConceptMap.js` (lessons WS-149).
- **Intent:** BB closes the action with pot-odds discount; under-defending (overfolding) leaks chips.
- **Scope notes:** v1 ships single situation key + single baseline. Per-opener-position split (vs BTN should justify ~55% defend; vs EP only ~22% defend) is v2 expansion candidate.
- **Expansion notes:** v2 split by opener position (situation key gains opener-position axis). v3 split by opener sizing (smaller opens justify wider BB defense).

### Preflop sizing leaks

#### `hero-pf-open-undersizing`
- **Label:** Open-raise sizing too small from late position
- **Category:** preflop-sizing
- **Complexity tier:** Medium
- **Status:** PLANNED
- **Situation keys:** `preflop:none:{LATE|BUTTON}:agg:none:none:open` with sizing axis
- **Solver baseline source:** Hardcoded population baselines (BTN ~2-2.5bb live, ~2.2-2.5bb online)
- **Intent:** Min-raising from late position bloats the SB/BB defense width and gives blinds correct odds to flat, removing fold equity.
- **Scope notes:** Sizing leaks need a sizing axis added to situation keys (not just action). Detector pattern shifts from frequency-based to amount-based.
- **Expansion notes:** v2 split by table speed + by stack depth.

#### `hero-3bet-undersizing-oop`
- **Label:** 3bet sizing too small OOP
- **Category:** preflop-sizing
- **Complexity tier:** Medium
- **Status:** PLANNED
- **Situation keys:** `preflop:none:{SB|BB}:agg:oop:raise:3bet` with sizing axis
- **Solver baseline source:** Hardcoded (OOP 3bets should be 3.5-4x the open size; IP 3bets can go 3-3.5x)
- **Intent:** Small 3bet OOP encourages calling, then hero plays 3bp OOP at high SPR — worst possible postflop spot.
- **Scope notes:** Same sizing-axis pattern as above.
- **Expansion notes:** v2 split by 3bet polarization (value-heavy vs polarized 3bets have different sizing optima).

#### `hero-squeeze-undersizing`
- **Label:** Squeeze sizing too small for table dynamic
- **Category:** preflop-sizing
- **Complexity tier:** Medium
- **Status:** PLANNED
- **Situation keys:** `preflop:none:*:agg:*:raise:squeeze` with sizing axis + caller-count axis
- **Solver baseline source:** Hardcoded (squeezes should be larger than 3bets; +1bb per caller above 1)
- **Intent:** Small squeeze fails to fold the caller(s), creating 3bp multiway OOP — disastrous structural spot.
- **Scope notes:** Caller-count axis adds complexity; situation keys multiply.
- **Expansion notes:** v2 incorporates caller-count semantics.

### Flop continuation leaks

#### `hero-ip-cbet-overfold` ★ v1
- **Label:** IP cbet defense — fold-to-cbet rate
- **Category:** flop-continuation
- **Complexity tier:** Simple
- **Status:** **SHIPPED v1 (SPR-030 / WS-145)** + **lesson bound (SPR-032 / WS-147)** + **umbrella restructure (SPR-033 / WS-148)** — Drill-this opens `cbet-defense-cluster.md`
- **Situation keys:** `flop:{dry|medium|wet}:{LATE|BUTTON}:def:ip:bet:cbet` (~6 keys)
- **Solver baseline source:** Hardcoded (~38% across textures; texture-aware refinement deferred to v2)
- **Ship sprint:** SPR-030
- **Related concept:** `cbet-defense-cluster` (umbrella) — lesson at `lessons/cbet-defense-cluster.md`. Sub-concepts: `ip-cbet-defense-{dry,medium,wet}-{LATE,BUTTON}` (6 leaves) registered in `tierConceptMap.js` (lessons WS-149).
- **Intent:** Detect when hero folds too often to flop cbets IP, giving auto-profit on villain's bluff frequency.
- **Scope notes:** v1 covers BTN/CO defending IP. Excludes blind defense (different dynamic — see `hero-bb-cbet-defense`). Single solver baseline (38%) per situation key; texture-precision deferred.
- **Expansion notes:** v2 split by villain style (Fish overfold less; TAG overfold more); v3 incorporate board-class precision (dry boards justify wider defense than wet).

#### `hero-oop-cbet-overfold` ★ v1 (SPR-040)
- **Label:** OOP cbet defense — fold-to-cbet rate (blind defense)
- **Category:** flop-continuation
- **Complexity tier:** Medium
- **Status:** **SHIPPED v1 (SPR-040 / WS-146 second claim)** — Drill-this opens `oop-cbet-defense-cluster.md` umbrella; per-cell sub-concept resolution via `tierConceptMap.SITUATION_KEY_TO_CONCEPT` (6 sub-concepts: `oop-cbet-defense-{dry,medium,wet}-{SB,BB}`)
- **Situation keys:** `flop:{dry|medium|wet}:{SMALL_BLIND|BIG_BLIND}:def:oop:bet:vsBet:pfc` (8-axis post-SPR-040; `:pfc` filter excludes donk-response cases)
- **Solver baseline source:** Hardcoded ~45-55% fold OOP per (texture, position) — 6 baseline keys in `solverBaselines.js`. Confidence 0.80. BB baselines slightly looser than SB (BB caps wider preflop → folds more on dry).
- **Intent:** Mirror of `hero-ip-cbet-overfold` for blind defense. OOP fold rate ~10pp higher than IP because of equity-realization penalty; over-folding beyond that still gives villain auto-profit on bluffs.
- **Scope notes:** v1 single baseline per (texture, position); no SRP-vs-3BP split (deferred). Distinguished from `hero-ip-cbet-overfold` by `isIP=oop` + position axis.
- **Expansion notes:** v2 split by SRP vs 3BP (3BP OOP cbet defense is even tighter); v3 villain-style precision.

#### `hero-flop-vs-donk-misresponse` ★ v1 (SPR-040)
- **Label:** Flop vs donk lead — fold-to-donk rate
- **Category:** flop-continuation
- **Complexity tier:** Medium
- **Status:** **SHIPPED v1 (SPR-040 / WS-146 second claim)** — Drill-this opens `flop-vs-donk-defense-cluster.md` umbrella; per-cell sub-concept resolution via `tierConceptMap.SITUATION_KEY_TO_CONCEPT` (6 sub-concepts: `flop-vs-donk-defense-{dry,medium,wet}-{LATE,BUTTON}`)
- **Situation keys:** `flop:{dry|medium|wet}:{LATE|BUTTON}:def:ip:bet:vsBet:pfa` (8-axis post-SPR-040; `:pfa` filter requires hero was preflop aggressor — disjoint from cbet-defense `:pfc`)
- **Solver baseline source:** Hardcoded ~43-50% fold per (texture, position) — 6 baseline keys in `solverBaselines.js`. Confidence 0.75 (lower than cbet baselines because the donker-style mixture is unobserved at the bucket level in v1).
- **Architectural note:** This rule motivated the SPR-040 situation-key extension from 7 to 8 axes. Pre-SPR-040, donk-response cases collapsed into the `hero-ip-cbet-overfold` bucket because the 7-axis key couldn't distinguish hero-as-preflop-aggressor from hero-as-preflop-caller on postflop streets. The 8th `preflopAggressor` axis (`pfa`/`pfc`/`na`) makes the rules disjoint.
- **Intent:** Donks signal a polarized villain range; hero's fold rate should track villain's bluff frequency, not default-fold the way many recreationals do.
- **Scope notes:** v1 covers IP positions only (LATE + BUTTON); single baseline averaged across donker styles. Soft-degrade not needed because v1 doesn't require villainProfile data — averaged baseline absorbs the style mixture.
- **Expansion notes:** v2 split by `villainProfile.donkStyle` (passive vs aggressive) once that classification is wired into the bucket. v3 extend to OOP positions (donk leads from BTN-vs-SB or CO-vs-BB-3bp scenarios).

### Flop sizing leaks

#### `hero-cbet-undersizing-wet-board`
- **Label:** Cbet sizing too small on wet/dynamic boards
- **Category:** flop-sizing
- **Complexity tier:** Medium
- **Status:** PLANNED
- **Situation keys:** `flop:wet:*:agg:*:bet:cbet` with sizing axis
- **Solver baseline source:** Hardcoded (wet boards justify 60-75% pot; small cbets give draws correct odds)
- **Intent:** Small cbet on wet boards gives draws automatic equity capture.
- **Scope notes:** Sizing axis pattern.
- **Expansion notes:** v2 splits by SPR — micro SPR demands smaller bets even on wet boards.

#### `hero-flop-raise-sizing-by-spr`
- **Label:** Flop raise sizing inappropriate for SPR
- **Category:** flop-sizing
- **Complexity tier:** Complex
- **Status:** PLANNED
- **Situation keys:** Many — across SPR zones × position × pot type
- **Solver baseline source:** Computed (depends on stack-off math by SPR)
- **Intent:** Raise sizes that commit at high SPR or under-commit at low SPR are EV mistakes.
- **Scope notes:** Computed baseline needed; defer until baseline framework supports computation.
- **Expansion notes:** Couples to gameTreeEvaluator integration.

### Turn barrel leaks

#### `hero-turn-barrel-frequency`
- **Label:** Turn double-barrel frequency
- **Category:** turn-barrel
- **Complexity tier:** Medium
- **Status:** PLANNED
- **Situation keys:** `turn:*:*:agg:*:bet:barrel`
- **Solver baseline source:** Hardcoded baseline range (40-60% barrel frequency depending on board run-out class); split by equity-shifter card
- **Intent:** Hero either over-barrels (bluffing too much on bad runouts) or under-barrels (giving up on good runouts).
- **Scope notes:** Equity-shifter axis adds complexity.
- **Expansion notes:** v2 split by equity-shifter card class (overcards / connectors / paired).

#### `hero-turn-checkraise-frequency`
- **Label:** Turn check-raise frequency
- **Category:** turn-barrel
- **Complexity tier:** Complex
- **Status:** FUTURE-RESEARCH
- **Situation keys:** `turn:*:*:def:oop:bet:check-raise`
- **Solver baseline source:** Research-gap — turn x/r solver baselines fragment heavily by board + range; no clean source.
- **Intent:** Hero's turn x/r frequency vs solver — both under (missing leverage) and over (face-up bluffs).
- **Scope notes:** Defer pending research sprint or computed baseline framework.
- **Expansion notes:** Likely needs custom computation per situation key.

#### `hero-turn-equity-shifter-response`
- **Label:** Hero response to turn equity-shifter cards
- **Category:** turn-barrel
- **Complexity tier:** Complex
- **Status:** FUTURE-RESEARCH
- **Situation keys:** `turn:*:*:def:*:bet:bet` filtered by equity-shifter
- **Intent:** Hero misreads turn cards that shift range advantage (third flush card, board-pair, overcard).
- **Scope notes:** Requires turn-card classification ahead of detection. New axis.
- **Expansion notes:** Couples to new equity-shifter classifier — substantial new code.

### River bluff-catch leaks

#### `hero-river-bluffcatch-frequency`
- **Label:** River bluff-catch frequency by villain type
- **Category:** river-bluff-catch
- **Complexity tier:** Complex
- **Status:** FUTURE-RESEARCH
- **Situation keys:** `river:*:*:def:*:bet:bet` × villain-type axis
- **Solver baseline source:** Research-gap — river bluff-frequencies vary enormously by villain; needs villain-conditioned baselines.
- **Intent:** Hero calls too much vs nits or folds too much vs bluffers; either bleeds.
- **Scope notes:** Villain conditioning required; couples to villainProfile maturity.
- **Expansion notes:** v2 candidate after villain-style integration matures.

#### `hero-river-thin-value-frequency`
- **Label:** River thin value-bet frequency
- **Category:** river-bluff-catch
- **Complexity tier:** Complex
- **Status:** FUTURE-RESEARCH
- **Situation keys:** `river:*:*:agg:*:none:bet` filtered by hand strength
- **Intent:** Hero either over-bets thin value (turning made hands into bluffs) or under-bets (missing value).
- **Scope notes:** Requires hand-strength axis on hero side.
- **Expansion notes:** Needs hero hand-strength classifier integration.

### Multiway adjustment leaks

#### `hero-multiway-bluff-frequency` ★ v1 (SPR-108)
- **Label:** Multiway flop cbet frequency
- **Category:** multiway-adjustment
- **Complexity tier:** Medium
- **Status:** **SHIPPED v1 (SPR-108 / WS-146 fifth claim)** — Drill-this opens `multiway-cbet-discipline-cluster.md`. **FIRST decision-bucket (aggression-frequency) rule in the catalog.**
- **Decision key:** `flop:cbet-decision:mw` (NOT an 8-axis action key — a parallel decision-bucket key). Emitted by `deriveCbetDecision()` when hero was preflop aggressor, first-in on the flop, with ≥2 villains remaining (3+ way). Aggregates aggress (cbet) vs pass (check) so a FREQUENCY is computable.
- **Solver baseline source:** Hardcoded ~25% (conservative high-end; multiway cbet frequency drops from ~70% HU because fold equity = ∏ fold rates, §7.4). Confidence 0.70. Fires on OVER-betting (>30% with 5pp delta).
- **Ship sprint:** SPR-108
- **Related concept:** `multiway-cbet-discipline-cluster` (umbrella; tier 5). Children `multiway-cbet-discipline-{3way,4way-plus}` registered ahead per v2 split (no SITUATION_KEY_TO_CONCEPT entries yet — umbrella absorbs fire-state, same as bb-defense v1).
- **Substrate added (SPR-108):** The catalog's frequency-of-aggression blocker (named in the deferred `hero-pf-open-overfold` entry — cbet + check route to different `contextAction` buckets) is resolved here via catalog option (b): an additive parallel **decision-bucket** type in `heroDecisionAccumulator` + `deriveCbetDecision` + detector `bucketType: 'decision'` routing. The `playersRemaining` (`hu`/`mw`) dimension lives ONLY in the decision-bucket key, so the 6 shipped 8-axis fold-rate rules and their calibrations are untouched. This substrate also unblocks future frequency rules (turn barrel-frequency, RFI open-fold, HU cbet-frequency).
- **Intent:** Multiway HU-style cbet frequency bleeds because fold equity drops multiplicatively.
- **Scope notes:** Per design doc §7.4, multiway breaks HU range-vs-range — this rule operationalizes that. v1 coarse single baseline (no texture/position split); flop only; over-betting direction only.
- **Expansion notes:** v2 split decision key by playersRemaining (3-way vs 4-way+) + texture/position; v3 add turn barrel-frequency (same decision-bucket substrate) + HU under-cbet mirror.

#### `hero-multiway-thin-value`
- **Label:** Thin-value betting in multiway
- **Category:** multiway-adjustment
- **Complexity tier:** Complex
- **Status:** FUTURE-RESEARCH
- **Situation keys:** `flop:*:*:agg:*:bet:cbet` filtered by playersRemaining ≥ 3 + hand-strength
- **Intent:** Multiway requires tighter value range; thin value loses to "somebody has it."
- **Scope notes:** Hand-strength axis required.

### Capped-range misread leaks

#### `hero-capped-overestimate`
- **Label:** Treating capped opponents as uncapped
- **Category:** capped-range-misread
- **Complexity tier:** Medium
- **Status:** PLANNED
- **Situation keys:** Decision points where villain's range is capped (no premium combos) but hero plays as if uncapped
- **Solver baseline source:** Hardcoded by capped-range detection from villain's preflop action
- **Intent:** Hero misreads capped ranges (e.g., villain limped or flatted from late) and folds top pair to small bets that should be value bets from the capped villain.
- **Scope notes:** Capped detection logic needed; reuses villainProfile rangeShape.capped flag.
- **Expansion notes:** v2 split by capping signal (limp vs flat vs cold-call).

#### `hero-uncapped-underestimate`
- **Label:** Missing uncapping signals
- **Category:** capped-range-misread
- **Complexity tier:** Complex
- **Status:** FUTURE-RESEARCH
- **Situation keys:** Decision points where villain's range becomes uncapped via slowplay signal
- **Intent:** Opposite of above — villain shows up with the nuts in a passive line; hero pays off because they assumed capped.
- **Scope notes:** Slowplay signal detection requires showdown-data integration.

### Position discipline leaks

#### `hero-oop-overplay`
- **Label:** Playing too wide OOP postflop
- **Category:** position-discipline
- **Complexity tier:** Medium
- **Status:** PLANNED
- **Situation keys:** `flop:*:{SB|BB}:def:oop:bet:cbet` filtered by hand strength
- **Intent:** OOP equity realization is worse; playing wide marginal hands OOP bleeds.
- **Scope notes:** Couples with `hero-bb-defense-width` preflop rule but is postflop-side.

#### `hero-ip-underplay`
- **Label:** Folding too tight IP postflop
- **Category:** position-discipline
- **Complexity tier:** Medium
- **Status:** PLANNED
- **Situation keys:** `flop:*:{LATE|BUTTON}:def:ip:bet:cbet` filtered by hand strength
- **Intent:** IP equity realization is better; folding marginal hands IP leaves EV on the table.
- **Scope notes:** Inverse-side of v1 rule; v1 is fold rate macro; this is hand-strength micro.

### Sample-size discipline leaks

#### `hero-low-sample-action`
- **Label:** Acting on n<30 villain reads
- **Category:** sample-size-discipline
- **Complexity tier:** Medium
- **Status:** PLANNED
- **Situation keys:** Hero deviation from population baseline correlated with low-sample villain stats
- **Intent:** Hero adjusts based on premature reads; AP-SCF-04 floor at the user-decision level.
- **Scope notes:** Requires correlating hero action with sample size of underlying read; meta-leak.

#### `hero-ignoring-credible-interval`
- **Label:** Ignoring credible intervals (point-estimate bias)
- **Category:** sample-size-discipline
- **Complexity tier:** Complex
- **Status:** PLANNED
- **Situation keys:** Hero acting on point-estimate stat when CI overlaps population baseline
- **Intent:** Hero treats `52% fold rate` as `52%` instead of `52% [38%, 66%]`; the CI overlap means villain might be at population — no exploit warranted.
- **Scope notes:** Meta-leak; couples to UI confidence-display surfaces.
- **Expansion notes:** This rule is what `WS-116` (credible intervals computed) enables.

---

## Authoring workflow (for future sprints)

When picking the next leak rule to ship:

1. **Pick by coverage gap.** Look at the Coverage Progress table. Categories with 0/N shipped are highest priority for diversity.
2. **Pick by complexity tier.** Within the gap-filling pick, prefer Simple > Medium > Complex > Future-research.
3. **Verify solver baseline source.** If `hardcoded`, look up the values from poker theory references. If `computed`, ensure the gameTreeEvaluator integration is in scope. If `research-gap`, defer.
4. **Author the rule:**
   - Copy `src/utils/skillAssessment/leakRules/_template.js`
   - Define `id`, `label`, `matchesBucket`, `detect`, `solverBaselineKey`, `relatedConceptId`, `threshold`
   - Add solver baseline entries to `src/utils/skillAssessment/solverBaselines.js`
   - Add tests
   - Update this catalog: status `PLANNED` → `SHIPPED`, add `ship_sprint`
5. **Verify.** Run `npx vitest run src/utils/skillAssessment/`; verify the rule fires on synthetic data.

The catalog is the spec; the framework is the runtime; lessons are the remediation. Together they're the SCF Gate 5 deliverable.
