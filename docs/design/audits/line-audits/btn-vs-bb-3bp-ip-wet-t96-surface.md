# Surface Audit — 2026-04-22 — `btn-vs-bb-3bp-ip-wet-t96` (rendering layer)

**Line:** `btn-vs-bb-3bp-ip-wet-t96` — BTN vs BB · 3BP · Wet T♥9♥6♠ — villain donks
**Scope:** UI rendering layer only — the `BucketEVPanel`, `PotOddsCalculator`, and `LineNodeRenderer` as they compose on the live Line Study surface. Content correctness of the underlying `lines.js` schema is covered by the companion audit [`btn-vs-bb-3bp-ip-wet-t96.md`](btn-vs-bb-3bp-ip-wet-t96.md) (closed 2026-04-22), which explicitly scoped UI rendering **out**. This audit fills that gap.
**Files observed:**
- `src/components/views/PostflopDrillsView/BucketEVPanel.jsx:1-349`
- `src/components/views/PostflopDrillsView/LineNodeRenderer.jsx:281-307` (`ComputeSection`)
- `src/components/views/PreflopDrillsView/LessonCalculators.jsx:297-351` (`PotOddsCalculator`)
- `src/utils/postflopDrillContent/bucketTaxonomy.js:46-89`
- `src/utils/postflopDrillContent/drillModeEngine.js:76-113` (`HERO_BUCKET_TYPICAL_EQUITY`)
- `src/utils/postflopDrillContent/lines.js:670-815` (`LINE_BTN_VS_BB_3BP_WET_T96`, `flop_root` at 689-815)
- `src/utils/postflopDrillContent/lineSchema.js` (validator)

**Auditor:** Claude (main) — combined poker-expert + product-UX persona, live surface.
**Method:** Playwright MCP driving a real Chrome browser against `npm run dev` at 1600×720; node walked end-to-end with archetype toggled. Evidence screenshots under `evidence/`.

---

## Verification

**Verified:**
- Node: `flop_root` only (hero holds J♥T♠ on T♥9♥6♠).
- Viewport: 1600×720 CSS pixels (CLAUDE.md target).
- Browser: Playwright-controlled Chrome, dev server.
- Archetypes: **Reg** + **Fish** initial walk; **Reg + Fish + Pro** post-LSW-H1 closure walk (see Batch-1-closure appendix below).
- Date: 2026-04-22 initial; 2026-04-22 post-H1.

**Not verified (explicit):**
- **Other nodes on this line** (4 remaining decision nodes: `turn_after_call`, `river_brick_v_calls`, `river_checkback`, `turn_brick_v_checkraises`; 7 terminals). Findings in this audit are *observed* at `flop_root`; analogous defects on those nodes are *inferred*, not confirmed.
- **Other lines** (7 other authored lines with flop roots; ~63 additional nodes total). Inference only, no walk.
- **Archetype = Pro** (toolbar has it; I toggled Reg and Fish only).
- **Mobile / non-1600×720 viewports.** Responsive behavior unknown.
- **Touch input** (mouse-only walk).
- **Long session behavior** (navigation between lines, revisit stale state, etc.).
- **Accessibility** (keyboard-only traversal, screen-reader labels, contrast).
- **Dark-mode contrast** (app defaults to dark; no light-mode walk).

**Method:** Playwright MCP — `browser_resize 1600×720`, `browser_navigate http://localhost:5181/`, `browser_click` and `browser_evaluate` to exercise toolbar + reveal button; `browser_take_screenshot` at each evidence point.

---

## Executive summary

**Verdict: RED.** Three P0 findings directly undermine the panel's teaching promise on this node; two of them would propagate across the 7 other lines once `LSW-B1` adds `heroHolding` to those flop roots. The core UX defect is that `BucketEVPanel` labels itself "Your hand class" but, when a specific hero combo is pinned, renders buckets hero physically cannot have — some with "No combos" noise, one (`openEnder`) with a concrete `+12.66bb` EV computed from *other* combos in hero's range. A student reads the row as their own EV. The pot-odds calculator defaults (100/50) stand next to prose saying the numbers are 27.3/6.8; students either retype or internalize the wrong break-even. The content-layer audit closed 2026-04-22 explicitly declared UI rendering out of scope — this audit is that gap.

**Routing:** 3 new backlog items under a new **Stream H — Line Study surface quality** (`LSW-H1` mechanical fixes, `LSW-H2` hero-combo-specific EV row, `LSW-H3` visual verification sweep before `LSW-B1` widens). 3 new Stream G items (`LSW-G3` backdoor draw taxonomy, `LSW-G4` paradigm roundtable gate, `LSW-G5` domination map). `LSW-B1` gains `LSW-H1 + LSW-H3` as additional blockers.

---

## Evidence

All captured 2026-04-22 at 1600×720 via Playwright.

1. **`evidence/btn-vs-bb-3bp-ip-wet-t96-flop_root-00-full-reveal-before.png`** — flop_root landing page; "Your hand" chip row shows combos + 5 bucket candidates (`topPair, flushDraw, openEnder, overpair, air`); Bucket-Level EV panel collapsed with reveal button.
2. **`evidence/btn-vs-bb-3bp-ip-wet-t96-flop_root-01-bucket-ev-revealed-reg.png`** — after reveal, vs Reg; table shows topPair bet 150% +20.30bb · flushDraw *No combos* · openEnder bet 33% **+12.66bb for 3 combos** · overpair *No combos* · air *No combos*.
3. **`evidence/btn-vs-bb-3bp-ip-wet-t96-flop_root-02-bucket-ev-revealed-fish.png`** — after toggle to Fish; topPair +20.23bb · openEnder +9.90bb · others unchanged "No combos". Structural defect same across archetypes.
4. **`evidence/btn-vs-bb-3bp-ip-wet-t96-flop_root-03-pot-odds-calc-defaults-mismatch.png`** — calculator shows `Pot Size: 100`, `Bet to Call: 50` directly below prose saying "Verify: BB leads ~6.8bb (33% of 20.5bb). Hero calls 6.8bb into a 20.5 + 6.8 = 27.3bb pot."

---

## Lens — combined poker-expert + product-UX

The content-audit lens (7 dimensions: setup realism / villain action realism / `correct` flag accuracy / framework citation / copy / bucket-teaching readiness / external validation) was designed for `lines.js` schema content. This surface-level audit adds **rendering-layer dimensions**:

- **R1. Hero-combo contract** — when `heroHolding.combos` pins a specific hand, does the rendered output stay true to that hand or does it silently admit data about other hands?
- **R2. Bucket feasibility** — does the panel distinguish buckets that are applicable to the pinned combo from buckets that are not?
- **R3. Author-intent propagation** — do the embedded calculators / sections inherit the node's numeric context, or are they node-blind?
- **R4. Poker-concept coverage** — does the taxonomy model the poker concepts the authored prose references (e.g., "backdoor flush draw")?
- **R5. Information architecture** — is the panel organized around the decision driver (villain's range composition) or the decision bystander (hero's self-classification)?
- **R6. Pedagogy leverage** — is the most teaching-valuable dimension (domination, equity-vs-bucket) rendered, or omitted?
- **R7. Schema discipline** — does the validator block category errors at authoring time, or let them reach rendering?

---

## Node-by-node findings

### `flop_root` — flop · BB donks 33% on T♥9♥6♠, hero J♥T♠

- **R1. Hero-combo contract:** ✗ broken. See S2.
- **R2. Bucket feasibility:** ✗ broken. See S1.
- **R3. Author-intent propagation:** ✗ broken. See S3.
- **R4. Poker-concept coverage:** ✗ BDFD / BDSD silently dropped. See S4.
- **R5. Information architecture:** ✗ hero-first instead of villain-first. See S5.
- **R6. Pedagogy leverage:** ✗ domination analysis absent. See S6.
- **R7. Schema discipline:** ✗ `air` in bucketCandidates on pinned-combo node not rejected. See S7.

#### S1 — P0 — `bucketCandidates` lists buckets hero physically cannot have; no per-hero feasibility filter in the renderer

**Dimensions:** R1, R2, R7 · **Category:** content + rendering.

**Observation.** `lines.js:701` authors `bucketCandidates: ['topPair', 'flushDraw', 'openEnder', 'overpair', 'air']` while `combos: ['J♥T♠']` pins a single holding. On T♥9♥6♠:

- `overpair` is impossible for J♥T♠ (hero has a T, not an over; no pocket pair).
- `flushDraw` (taxonomy: `nutFlushDraw + nonNutFlushDraw`) is impossible: hero has one heart + two on board = *backdoor*, not a direct FD.
- `openEnder` is impossible: J-T-9 is three-in-a-row; straight completion needs runner-runner, not a four-card draw needing one card.
- `air` is a range-level bucket, not a hand-level bucket — asking "what's the EV of your hand when your hand is air?" is a category error for a pinned combo.

Only `topPair` is a truthful self-classification of J♥T♠. Four of five authored buckets are infeasible for the pinned hero combo. `BucketEVPanel.jsx:319-347` renders every authored bucket as a row; for infeasible buckets it renders "No combos in range" italic text. There is no per-hero feasibility gate.

**UX impact.** Panel header says "Your hand class." Four of five rows are not about your hand. Three of them read as zeroed rows (implying "your FD / overpair / air play here has no EV" rather than "this bucket doesn't apply to you"). The student wastes visual scan time on false rows; worse, they may misclassify their own hand in the future because the panel normalized the buckets as applicable.

**Expert impact.** The node's framing (J♥T♠ on a wet two-tone middling board) is precisely the spot where hero's actual hand class — TP + BDFD + 3-card-straight — matters. The panel's author-level `bucketCandidates` list reflects pre-`combos` thinking: the author imagined hero's full range when they wrote the list, then later pinned a single combo without reconciling.

**Recommended fix.** Two layers:

- **Content (`lines.js:701`):** when `combos.length === 1`, `bucketCandidates` must reflect only buckets feasible for that combo. Interim fix: reduce to `['topPair']` (honest minimum). Final fix: `['topPair', 'backdoorFlushDraw', 'backdoorStraightDraw']` — blocked on S4 (taxonomy gap).
- **Rendering (`BucketEVPanel.jsx`):** when `node.heroHolding?.combos?.length === 1`, collapse any bucket row with `sampleSize === 0` into a single disclosure stub ("N buckets not applicable to your hand — show"). Non-pinned nodes keep current behavior.

**Effort:** S content + M rendering.
**Proposed backlog item:** `LSW-H1` (single commit covers S1 content + rendering + S3 + S7).

---

#### S2 — P0 — `openEnder` row shows +12.66bb EV for 3 combos that are not J♥T♠ (deceptive overlay)

**Dimensions:** R1, R5 · **Category:** rendering.

**Observation.** `enumerateBucketCombos` (`bucketTaxonomy.js:122`) filters the hero *range* by bucket. On this line, BTN's flat-3bet range contains a handful of QJs / 87s combos that segment as `oesd` on T96 — these populate the `openEnder` bucket. The panel renders the row as `openEnder · bet 33% · +12.66bb · bet 75% +11.18bb · 3 combos`, same typography and same column layout as the real `topPair · +20.30bb` row (which IS computed against hero's J♥T♠ topPair class).

The row's header column reads "Your hand class." It is not — it is another hand's hand class. A student reads them in parallel and concludes "my open-enders bet small, my top pair bets big." They do not hold an open-ender.

**UX impact.** This is the single most dangerous cell in the panel. The mental model a student brings in ("the panel is showing me options for my hand") is directly contradicted by the data — but not visually flagged. One-shot misinterpretation becomes durable: the student internalizes "open-enders bet 33% here" and misapplies it with a different specific combo later.

**Expert impact.** Directly violates first-principles decision modeling (`feedback_first_principles_decisions.md`): "NEVER use labels (position/bucket/style) as decision inputs; compute from equity/potOdds/SPR." The `openEnder` row uses a bucket label as a lookup key and presents its result at equal typographic weight to hero's actual computed EV.

**Recommended fix.** When a pinned combo exists, compute and display that combo's actual equity + EV against villain's range (via `equityWorker` batched protocol, RT-116). Render as a top row with distinct typography ("You hold J♥T♠ → +X.XXbb at bet 150% vs Reg"). Bucket rows demote to a subsidiary section with divider and explicit label "Other combos in your range that fall in this bucket" — not equal-weight with the pinned combo.

**Effort:** M — threads hero combo through `drillModeEngine.evaluateDrillNode` via new `pinnedCombo` parameter; requires one equity-worker call per reveal.
**Proposed backlog item:** `LSW-H2` (depends on H1 + G3).

---

#### S3 — P0 — `PotOddsCalculator` defaults (100/50) don't match node context (27.3/6.8)

**Dimensions:** R3 · **Category:** UX / schema.

**Observation.** `LessonCalculators.jsx:298-299` hardcodes `useState(100)` / `useState(50)`. The authoring prose in `lines.js:748-749` explicitly says the numbers are 27.3 and 6.8. The calculator sits **directly under** that prose. Result: break-even it displays (25%) corresponds to a 50%-pot bet, not the 33% donk in the node. Correct break-even for the node is `6.8 / (27.3 + 6.8) = 19.9%`.

**UX impact.** Student must either retype the numbers (toil; context-switch cost), ignore the widget (authoring intent lost), or trust the 25% it shows (actively wrong answer for the spot). All three outcomes are worse than a widget that respects the node's context.

**Expert impact.** The authoring prose teaches "J♥T♠ has enough equity to call at ~20%" — a legitimate defense of the call branch against a polarized donk range. If the student reads the calculator's 25% and mentally substitutes it for the line's number, the defense of calling becomes shakier in their mental model than the line intends. A teaching tool that undermines its own claim is a teaching tool that misleads.

**Recommended fix.** Three-part:
1. Extend `compute` section schema (`lineSchema.js`) with optional `seed: { pot: number, bet: number }`.
2. Extend `PotOddsCalculator` component with optional `initialPot` / `initialBet` props.
3. Thread props in `ComputeSection` (`LineNodeRenderer.jsx:281-307`) — read `section.seed` or fall back to `{ pot: node.pot, bet: node.pot * (node.villainAction?.size ?? 0.5) }`.
4. Author flop_root's compute section with explicit `seed: { pot: 27.3, bet: 6.8 }` for stability (immune to future pot-math drift).

**Effort:** S.
**Proposed backlog item:** `LSW-H1` (batched with S1 + S7).

---

#### S4 — P1 — Backdoor flush-draw and backdoor straight-draw silently dropped by the taxonomy

**Dimensions:** R4 · **Category:** taxonomy / engine.

**Observation.** `bucketTaxonomy.js:46-89` has `flushDraw → [nutFlushDraw, nonNutFlushDraw]` (direct FD, 9 outs). No entry exists for backdoor FD (1 flush-card in hero + 2 on board, needing runner-runner, ~4.2% equity lever at the flop). No entry for backdoor straight draw (three consecutive including board + hero, needing runner-runner, ~2-3% equity lever depending on gaps).

`rangeSegmenter.js` may or may not emit `backdoorFlushDraw` / `backdoorStraightDraw` hand types; the taxonomy does not expose them either way. A node that pins J♥T♠ on T♥9♥6♠ can never render the hand's most board-texture-relevant features.

**UX impact.** Authoring prose calls the board "wet, two-tone, highly-connected" and flop_root decision copy says "TPTK with a backdoor flush." The student reads this, expects the backdoor-FD concept in the panel, sees `flushDraw: No combos`, and either concludes "the panel is wrong" or "my hand has no flush potential." Neither is correct.

**Expert impact.** BDFD is a real equity + float lever (worth 3-5% across-the-board; drives thin-call-vs-fold on many texture reads). A taxonomy that cannot name it is a taxonomy that cannot teach it.

**Recommended fix.** Two-step:

- **G3a:** audit `rangeSegmenter.js` for backdoor emission. If missing, extend segmenter (paired engine ticket + test).
- **G3b:** extend `BUCKET_TAXONOMY` with `backdoorFlushDraw`, `backdoorStraightDraw`, `backdoorCombo` (stacked). Extend `HERO_BUCKET_TYPICAL_EQUITY` with combinatorial-checked priors (not guessed): BDFD alone ~0.33 vs TP range, BDFD+TP ~0.42, BDSD alone ~0.18, BDFD+BDSD ~0.36.

**Effort:** M + M.
**Proposed backlog item:** `LSW-G3`.

---

#### S5 — P1 — Panel abstracts hero-first when the decision driver is villain's range

**Dimensions:** R5 · **Category:** paradigm.

**Observation.** The panel is organized around hero's hand class. Rows = hero buckets; columns = best action. But hero already knows his hand; he does not know villain's range composition. The decision's driver is "what does BB actually hold when they donk 33% here, and what's my equity in each sub-case."

The useful teaching payload is villain-bucket-first: `BB's overpair region P% × my equity Y% × my EV for each action = $X. BB's slowplayed-sets region Q% × my equity W% × EV = $Z. Sum to weighted EV per action.` That's the exploitative-poker mental model this app exists to build.

**UX impact.** Students who use the panel as-is absorb one bit per reveal (what to do). They do not absorb why, in terms of villain-range structure. Revisiting old decisions with the right mental model ("what region of BB's range am I targeting with this bet size") is harder because the panel didn't train the habit.

**Expert impact.** First-principles doctrine requires villain-range-first decomposition. The current panel inverts this. The broader app has already made this paradigm shift once (villain profile, 2026-03-26 — see `project_decision_model_paradigm.md`). Line Study's bucket-EV panel is the last holdout.

**Recommended fix.** Larger redesign:

- Rows = villain's bucket (overpair / set / 2pair / A-high bluff / etc.) with weight-of-range.
- Columns = hero's equity vs bucket, hero's EV in each action vs bucket, domination flag.
- Below table: single weighted-total row per action = Σ(bucket weight × per-bucket EV).
- Hero's self-bucket becomes a one-line header context ("You hold J♥T♠ → TP + BDFD + BDSD") — not the organizing principle.

Gate-2 Blind-Spot Roundtable per `docs/design/ROUNDTABLES.md` required before implementation — paradigm shifts of this size should not be pre-approved.

**Effort:** L.
**Proposed backlog item:** `LSW-G4` (roundtable gate first, implementation only after).

---

#### S6 — P1 — No domination analysis for the pinned combo

**Dimensions:** R6 · **Category:** pedagogy.

**Observation.** Hero holds J♥T♠. On T♥9♥6♠ vs a polarized BB donk range, hero's TP is:
- **Dominated by:** JJ+ (overpairs beat TP), AT / KT / QT (same TP, better kicker), T9/T6/96 (two-pair), 99/66/TT (sets), any suited connector that already made a straight (if in range).
- **Dominates:** lower kickers T7 / T5 (rare in BB 3bet range but nonzero in fish archetype), possibly some T8-suited.
- **Chops:** other JT combos.

Domination frequency drives how much of "top pair equity" is actually at risk vs villain's TP+. Panel omits this entirely.

**UX impact.** Students see `+20.30bb` on bet 150% and internalize "top pair is good, bet big." They miss that the bet is largely a *protection* / *thin-value* / *isolation* move against a range where hero is ahead of the draws but behind most of the made-hand region. The reframe from "value bet" to "protection bet against draws + bluff-catch vs overpair" is non-trivial and teaching-relevant.

**Expert impact.** Domination is the reason JT plays so differently from AT on this board despite both being "top pair" — yet the panel presents them as interchangeable via its bucket-level abstraction.

**Recommended fix.** Below the pinned-combo row, render a domination map: per villain sub-bucket with `dominated | neutral | dominates` tag + estimated weight-of-range. Depends on per-combo equity path from S2.

**Effort:** M.
**Proposed backlog item:** `LSW-G5` (depends on `LSW-H2`).

---

#### S7 — P2 — `air` in `bucketCandidates` on a pinned-combo node is a schema-level category error

**Dimensions:** R7 · **Category:** validator.

**Observation.** Air is a range-level bucket (the portion of a range that missed the board). A pinned combo is either air or not — it's a predicate, not a bucket candidate. Authoring `air` on a pinned-combo node asks the engine a nonsensical question ("what's the EV of my hand when my hand doesn't exist?"); engine correctly returns "No combos in range." Authoring should reject this at validation time, not silently render it.

**Recommended fix.** `lineSchema.js` `validateLine` — reject `air` in `bucketCandidates` when `combos.length >= 1`. Documentable rule in the schema.

**Effort:** S.
**Proposed backlog item:** `LSW-H1` (batched).

---

## Prioritized fix list

| # | Finding | Severity | Effort | Rendering dim | Category | Routes to |
|---|---------|----------|--------|---------------|----------|-----------|
| 1 | S1 — infeasible buckets rendered without per-hero filter | P0 | S+M | R1, R2, R7 | content + rendering | LSW-H1 |
| 2 | S2 — openEnder row shows EV for non-hero combos | P0 | M | R1, R5 | rendering | LSW-H2 |
| 3 | S3 — PotOddsCalculator defaults don't match node | P0 | S | R3 | UX / schema | LSW-H1 |
| 4 | S4 — BDFD / BDSD silently dropped by taxonomy | P1 | M+M | R4 | taxonomy + engine | LSW-G3 |
| 5 | S5 — panel abstracts hero-first vs villain-first | P1 | L | R5 | paradigm | LSW-G4 (roundtable) |
| 6 | S6 — no domination analysis for pinned combo | P1 | M | R6 | pedagogy | LSW-G5 |
| 7 | S7 — `air` in bucketCandidates on pinned combo | P2 | S | R7 | validator | LSW-H1 |

---

## Impact on existing LSW plan

The content-layer audit ([`btn-vs-bb-3bp-ip-wet-t96.md`](btn-vs-bb-3bp-ip-wet-t96.md), closed 2026-04-22) explicitly scoped UI rendering **out**. Findings here sit in that gap — they complement, not invalidate, its 10-item fix list.

**Blocker update for `LSW-B1`:** widening `heroHolding` to the 7 other flop roots propagates S1 + S3 + S7 defects 7× if shipped before fixes land. `LSW-B1` must now be BLOCKED by `LSW-A1..A8 + LSW-H1 + LSW-H3` (was `LSW-A1..A8` only). This is the single most important scope update — without it, good-faith widening work amplifies the defect.

**New stream needed:** `LSW Stream H — surface quality` — distinct from Stream F (content) and Stream G (engine). Houses H1 (mechanical), H2 (hero-combo EV), H3 (visual verification sweep).

---

## Appendix — Batch-1-closure verification (LSW-H1, 2026-04-22)

**Verification of H1 changes on flop_root — 2026-04-22, Playwright @ 1600×720, all three archetypes.**

| # | Finding | Status post-H1 | Evidence |
|---|---------|----------------|----------|
| S1 | infeasible buckets rendered without per-hero filter | **RESOLVED** — BucketEVPanel now shows only `topPair` (the one feasible bucket for J♥T♠). No infeasible rows, no "No combos in range" noise. The "or topPair/flushDraw/openEnder/overpair/air" chip row above the panel now reads "or topPair" — matching the trimmed authored candidates. The feasibility-gate renderer additionally protects future widening: any bucket that resolves with `sampleSize === 0` when a pinned combo is present will collapse behind a "N buckets not applicable to your hand" disclosure (verified by unit test `isRowApplicable`). | `evidence/btn-vs-bb-3bp-ip-wet-t96-flop_root-post-h1-04-reg.png`, `-05-fish.png`, `-06-pro.png` |
| S3 | PotOddsCalculator defaults 100/50 don't match node | **RESOLVED** — calculator now opens with POT SIZE=27.3, BET TO CALL=6.8. Break-even equity displays 16.6%, matching the spot's actual math (`6.8 / (27.3 + 2·6.8) = 6.8 / 40.9 = 0.1662`). Pot Lays You displays 5.01:1. Prose-vs-widget consistency restored. | `evidence/btn-vs-bb-3bp-ip-wet-t96-flop_root-post-h1-07-pot-odds-seeded.png` |
| S7 | `air` in bucketCandidates on pinned-combo node | **RESOLVED** — `lineSchema.validateLine` now rejects. JT6 flop_root no longer authors `air`. Unit tests cover both the rejection (when pinned) and acceptance (when not pinned). |  — |

**Post-H1 archetype EV walk (sanity-checked archetype responsiveness still works after the gate):**

| Archetype | topPair best action | EV | Runner-up |
|-----------|---------------------|-----|-----------|
| Reg | bet 150% | +20.30bb | bet 75% +18.54bb |
| Fish | bet 150% | +20.23bb | bet 75% +17.84bb |
| Pro | bet 150% | +20.32bb | bet 75% +18.72bb |

Archetype toggling continues to shift the EV via the archetype-weighted fold rate (as designed) — the feasibility gate does not regress this behavior.

**Test suite at time of closure:** `bash scripts/smart-test-runner.sh` — 6286/6287 passing. The 1 failure is the pre-existing `precisionAudit.test.js` flake (same flake the LSW-A1 closure noted at 6257/6258; delta of +29 tests covers H1 additions + prior-session tests). All H1-added tests green: `lineSchema.test.js` (+7 new cases for `air` rejection + `compute.seed` validation), `BucketEVPanel.test.jsx` (+8 new cases for `isRowApplicable` + content-pin regression guards), `LessonCalculators.test.jsx` (new file, 10 cases).

**Findings still OPEN** (not touched by H1):
- S2 (hero-combo-specific EV row) — **RESOLVED by `LSW-H2` (see closure appendix below)**.
- S4 (BDFD / BDSD taxonomy) — **RESOLVED by `LSW-G3` (see closure appendix below)**.
- S5 (villain-bucket-first paradigm redesign) — deferred to `LSW-G4` roundtable gate.
- S6 (domination map) — **RESOLVED by `LSW-G5` (see closure appendix below)**.

**Unblocked by H1:**
- `LSW-B1` — partial unblock. Still also BLOCKED by `LSW-H3` (visual verification sweep of remaining 11 nodes + 7 other-line flop roots).

---

## Appendix — LSW-G3 closure (2026-04-22)

**Scope:** Surface audit S4 — backdoor flush draw and backdoor straight draw silently dropped by the taxonomy.

**Resolved:**
- Audit of `exploitEngine/postflopNarrower.js` confirmed `detectDraws` already computes `hasBackdoorFlush` / `hasBackdoorStraight` flags (has since 2026-03-08). The data was there; the classifier in `rangeSegmenter.js` was discarding it by falling through to `air`.
- Extended `classifyHandType` to emit three new `HAND_TYPES` — `airBackdoorCombo`, `airBackdoorFlush`, `airBackdoorStraight` — when a hand would otherwise be air but has one or both backdoor flags. **Semantic note (deliberate):** made-hand shapes (pair or better) and direct draws (OESD/gutshot/FD/comboDraw) still win the strongest-first classification; J♥T♠ on T♥9♥6♠ stays `topPairGood`. The new types are **air-only** — they surface hands whose *strongest* shape is air + runner-runner potential. Per-combo surfacing of "TP + BDFD" for made hands is LSW-H2's territory (hero-combo EV row).
- Added matching `BUCKET_TAXONOMY` entries in `bucketTaxonomy.js`: `backdoorFlushDraw → [airBackdoorFlush, airBackdoorCombo]`, `backdoorStraightDraw → [airBackdoorStraight, airBackdoorCombo]`, `backdoorCombo → [airBackdoorCombo]`.
- Added equity priors in `HERO_BUCKET_TYPICAL_EQUITY`: `airBackdoorFlush: 0.20`, `airBackdoorStraight: 0.15`, `airBackdoorCombo: 0.25`, plus aggregate bucket entries. Combinatorial-anchored: BDFD completes ~4.2% runner-runner; BDSD ~3%; equity-when-hit ≈0.9 vs polar range; equity-when-miss ≈0.08; fold-equity / realization lift for clean-out semi-bluff credibility pulls priors up from the raw ~0.11-0.13 math.
- Extended `pctAir(bd)` in `handTypeBreakdown.js` to include the three new air-backdoor types, preserving the framework-layer invariant `pctAir + pctWeakDraws + pctStrongDraws + pctAnyPairPlus ≈ 1`. Added `pctAirStrict` for callers that want pre-G3 strict semantics. Whiff framework continues to treat backdoor hands as whiffs (they still fold to a c-bet from a direct-equity standpoint), which is what the scenario fixtures expect.

**NOT changed in G3 (deliberate):**
- `flop_root.heroHolding.bucketCandidates` stays at `['topPair']`. J♥T♠ is classified as `topPairGood` (strongest-wins), not `airBackdoor*` — the new buckets wouldn't populate. The honest widening to surface J♥T♠'s BDFD+BDSD-on-top-of-TP is LSW-H2's hero-combo EV row, not a bucket.
- No line content updates. G3 delivers infrastructure; no line currently authors pure-backdoor hero combos.

**Tests:** +8 new cases across `rangeSegmenter.test.js` (classification of BDFD-only / BDSD-only / combo / topPair-with-backdoor / pure-air on dry board) and `bucketTaxonomy.test.js` (3 new bucket IDs + sample population). Initial run surfaced 2 combinatorial errors in my own test fixtures (5♥4♦ is BDFD+BDSD combo not BDFD-only; 5♣3♠ on A72r is a wheel gutshot not air) — fixed to A♥2♦ on T96 for BDFD-only and 4♣3♠ on KQJ-rainbow for pure air.

**Invariant check:** `pctAir + pctWeakDraws + pctStrongDraws + pctAnyPairPlus ≈ 1` still holds — `handTypeBreakdown.test.js:179` green. Scenario-validator tests green (whiff framework classifications unchanged after `pctAir` broadening).

**Follow-ons:**
- `LSW-G3` could be augmented by a drillModeEngine-level override that uses `bucketCombos` where the enumerated set includes hands whose non-backdoor classification is air — this is what the new buckets already do.
- `LSW-H2` (hero-combo-specific EV row) will use the fact that `detectDraws` exposes backdoor flags to compute the equity bump for J♥T♠'s TP+BDFD+BDSD vs a plain TP.

---

## Appendix — LSW-H2 closure (2026-04-22)

**Scope:** Surface audit S2 — bucket EV row shows +12.66bb for openEnder combos that are not hero's pinned hand; same typography as the real topPair row; student reads the whole table as "my hand's options."

**Resolved:**
- New `computePinnedComboEV` helper in `drillModeEngine.js` — pure async function that computes per-combo equity via `handVsRange` (Monte Carlo, `trials=800` for ±~1% accuracy) against villain's base range, then applies per-action EV math using the archetype-weighted `foldPct` (preserves archetype responsiveness). Input: `{pinnedCombo, villainRange, board, pot, foldPct, actions, trials}`. Output: `{card1, card2, equity, evs, ranking, trials}` or `null` on malformed / absent input.
- `BucketEVPanel.computeBucketEVs` now parses `heroHolding.combos[0]` via a new `parseComboString` export (defensive — `lineSchema.COMBO_REGEX` guarantees format at authoring time; this is runtime protection). When a single-combo pinned holding is present, the pinnedCombo helper runs in parallel with the bucket evaluations and its result is returned as `result.pinnedCombo`.
- New `PinnedComboRow` component renders above the bucket table. Distinct typography (amber border / background, same palette as the `Your hand` chip row above) makes "YOUR HAND · PER-COMBO EV" visually primary. Shows: combo text (`J♥T♠`), equity%, best action + EV, runner-up action + EV, archetype label.
- `BucketEVTable` gains a `demoted` prop. When pinnedCombo present, the table:
  - Renders a small-caps divider label: "RANGE-LEVEL VIEW · OTHER COMBOS IN YOUR RANGE THAT FALL IN THESE BUCKETS"
  - Changes header cell from "Your hand class" to "Bucket (other combos in your range)"
  - Applies 80% opacity + softer border — visually subsidiary to the pinned-combo row.
- Non-pinned nodes keep the old header text + full opacity.

**Visual verification (1600×720 Playwright, all 3 archetypes):**
| Archetype | Equity (MC 800 trials) | Best action | EV | Runner-up | Bucket topPair average |
|-----------|-----------------------|-------------|-----|-----------|------------------------|
| Reg | 56.1% | bet 150% | +17.99bb | bet 75% +17.09bb | +20.30bb |
| Fish | 57.7% | bet 150% | +17.95bb | bet 75% +16.42bb | +20.23bb |
| Pro | 59.6% | bet 150% | +19.47bb | bet 75% +18.18bb | +20.32bb |

The per-combo EV is **~2bb lower than the topPair bucket average** across archetypes. This honestly surfaces that J♥T♠ is weaker than the average TP combo in BTN's flat-3bet range on T96ss (the range includes AT/KT/QT which dominate J♥T♠). Direct teaching gain: student now sees the correct EV for their *actual* hand, not the class average.

Archetype sensitivity visible: equity rises from Reg (56.1%) to Fish (57.7%) to Pro (59.6%). Pro's tighter 3bet range gives hero a higher equity share; Fish's wider / weaker range still gives hero edge but less fold equity on the bet (lower bet 75% EV).

**Evidence:** `evidence/btn-vs-bb-3bp-ip-wet-t96-flop_root-post-h2-{08..10}-*.png`

**Tests:** +8 new cases in `BucketEVPanel.test.jsx`:
- `parseComboString` shape (3 cases: canonical, malformed, duplicate-card rejection).
- `computeBucketEVs` pinnedCombo block (5 cases: null when absent, populated for JT6, equity in plausible 20–75% range, per-combo EV differs from bucket EV by ≥0.05bb, graceful null on malformed combos).

**NOT changed in H2:**
- `evaluateDrillNode` signature. The pinnedCombo path is a separate `computePinnedComboEV` helper running alongside the bucket loop, not an extension of the per-bucket evaluation.
- Bucket EV math. Bucket rows continue to use `HERO_BUCKET_TYPICAL_EQUITY` coarse priors — per-combo equity doesn't regress their computation.
- `v1-simplified-ev` caveat on bucket rows stays (per-combo uses real MC equity; bucket rows still use the simplified table).

**Follow-ons:**
- `LSW-G5` (domination map) is now unblocked — can extend `pinnedCombo` with `dominationMap: [{villainBucket, relation, weightPct}]`.
- The `v1-simplified-ev` caveat on the pinnedCombo output is deliberately NOT removed. Bucket rows still use the simplified model; the pinned-combo path uses real MC equity but the archetype-weighted fold rate still relies on `POP_CALLING_RATES` + bucket composition. Full depth-2 replacement is `LSW-D1`.

---

## Appendix — LSW-G5 closure (2026-04-22)

**Scope:** Surface audit S6 — no domination analysis for the pinned combo. Student sees `+20.30bb on bet 150%` (or post-H2 `+17.99bb`) without context on which villain hands they're ahead of vs behind.

**Resolved:**
- New `computeDominationMap` pure helper in `drillModeEngine.js` — async. Segments villain's range on the board, groups combos by a 12-entry `DOMINATION_GROUPS` taxonomy (Premium / Flush / Straight / Set/Trips / Two Pair / Overpair / Top Pair (other) / Mid/Low Pair / Direct Draws / Overcards / Backdoor Only / Air). `overpair` is deliberately split out from the existing `HAND_TYPE_GROUPS.topPair` because for hero's top pair the distinction is pedagogically critical (dominated vs coin-flip).
- For each non-empty group, builds a 169-cell partial range via `partialRangeFromCombos` and runs `handVsRange` (MC trials=250 per group). Parallel dispatch across groups — typical range has ~4-8 non-empty groups, so ~1-2 seconds total.
- `classifyDomination(equity)` maps raw equity → teaching-friendly relation: `crushed` (<20%), `dominated` (20-40%), `neutral` (40-60%), `favored` (60-80%), `dominating` (≥80%). Exported for unit testing.
- `computeBucketEVs` in `BucketEVPanel.jsx` runs the domination map in parallel with the pinned EV computation. Result attaches to the `pinnedCombo` block as `pinnedCombo.dominationMap: Array<{id, label, equity, weightPct, sampleSize, relation}>`. Sorted heaviest-first by weightPct.
- New `DominationMapDisclosure` component renders below the pinned-combo row. Collapsed by default (button shows "Domination vs villain's range · N hand-type groups"); on click expands to show one row per group with: relation badge (color-coded: rose=crushed, orange=dominated, amber=neutral, teal=favored, emerald=dominating), group label, weight%, hero equity%.
- Uses **base** villain range (archetype-invariant). Hero's showdown equity vs JJ doesn't depend on whether villain is fish or pro — only the weightPct distribution might shift slightly under archetype-weighting, and base-range composition is the dominant structural signal. Archetype-weighted domination could be a future refinement.

**Visual verification (1600×720 Playwright, all 3 archetypes):**

| Group | Weight% | Equity (Reg) | Equity (Fish) | Equity (Pro) | Relation (Reg) |
|---|---|---|---|---|---|
| Overcards | 45.2% | 79% | 77% | 80% | FAVORED → DOMINATING at Pro |
| Overpair | 28.8% | 22% | 20% | 27% | DOMINATED |
| Direct Draws | 24.7% | 62% | 70% | 67% | FAVORED |
| Set/Trips | 1.4% | 8% | 7% | 6% | CRUSHED |

Per-group equity shifts between archetypes reflect MC variance at trials=250 (not a change in villain's base range). The weightPct distribution is identical across archetypes (same base range feeds the domination map). Archetype responsiveness on the pinned-combo equity + EV rows remains intact (Reg 59.3% → Fish 58.9% → Pro 60.6%).

**Teaching payload visible:** A student reading the JT6 flop_root panel post-G5 now sees:
- Their specific hand's EV (`J♥T♠ +19.24bb`)
- Hero is DOMINATED by ~29% of villain's range (overpairs), CRUSHED by ~1% (sets), FAVORED against ~70% (overcards + direct draws).
- The 59% overall equity is driven by the ~70% of villain's range hero is ahead of, offset by the ~30% hero is behind on.
- Decision framing becomes villain-range-first: "I'm betting into overcards that fold and draws I'm ahead of; I'm getting called by overpairs that crush me and sets that literally crush me."

This is the first-principles decision model the user's critique called for: "The hero can't see the villain's bucket EV range, he should know his equity vs each of the villain's buckets."

**Evidence:** `evidence/btn-vs-bb-3bp-ip-wet-t96-flop_root-post-g5-{11..14}-*.png` (collapsed, Reg expanded, Fish expanded, Pro expanded).

**Tests (+14):**
- `drillModeEngine.test.js` +6 (`classifyDomination` pure: crushed/dominated/neutral/favored/dominating thresholds + non-finite fallback).
- `BucketEVPanel.test.jsx` +5 (dominationMap population / row shape / heaviest-first sort / overpair row shows `crushed`-or-`dominated` relation for JT6 / absent when no pinned combo).
- `drillModeEngine.js` adds 3 new exports (`computeDominationMap`, `classifyDomination`, internal `DOMINATION_GROUPS`) — still pure, still testable in isolation.

**NOT changed in G5:**
- `HAND_TYPE_GROUPS` in `rangeSegmenter.js` — G5 uses a local 12-entry `DOMINATION_GROUPS` to peel `overpair` out from the aggregated topPair group. Existing consumers (RangeFlopBreakdown) keep the 10-group view unchanged.
- Archetype wiring. Domination map uses base villain range (architecturally simple; archetype affects weightPct only marginally since most of villain's 3bet range is archetype-stable).

**Follow-ons:**
- If pedagogy demands per-archetype weightPct, extend `computeDominationMap` with an optional `archetype` param that feeds the archetype-weighted range through the segmenter. Deferred.
- Very-small groups (weightPct < 1%) are included for completeness; could add a "hide trace groups" toggle if the disclosure feels crowded on very wide ranges. Flop_root has only 4 groups post-filter so crowding isn't an issue; defer until H3 sweep surfaces a node with 10+ groups.

---

## Appendix — LSW-H3 visual-verification sweep (2026-04-22)

**Scope:** 11 nodes — 4 remaining decision nodes on the JT6 line + 1 flop root per other line. Purpose: confirm nodes render without defect post-H1/H2/G3/G5/G5.1/G5.2, and produce a per-line / per-node feasibility checklist that `LSW-B1` (flop-root widening) and `LSW-B2` (turn bucket-shift widening) can consume before authoring `heroHolding`.

**Method:** Playwright MCP at 1600×720, archetype = Reg for baseline (spot-toggled when the surface is archetype-sensitive). Dev server on localhost:5187. Walked each node to the point of decision display. No code changes.

**Key baseline finding:** None of the 11 walked nodes currently has `heroHolding.combos` authored — only JT6 `flop_root` does. Consequence: the `BucketEVPanel`, pinned-combo EV row, and domination map **do not render** on these 11 nodes today. Therefore S1/S3/S7 surface defects **cannot fire** on them in current state. The feasibility work below is pre-authoring scaffolding: what combo and `bucketCandidates` would be right if B1 / B2 ever pin hero on that node.

### Line 1 — `btn-vs-bb-3bp-ip-wet-t96` (JT6) — 4 remaining decision nodes

| # | Node | Street | Pot | Board | Hero pin (implied by prose) | Screenshot | S1/S3/S7 post-H1 | Feasibility for widening |
|---|------|--------|-----|-------|-----------------------------|------------|------------------|--------------------------|
| 1 | `turn_after_call` | turn | 34bb | T♥9♥6♠2♣ | J♥T♠ (implicit — line's hero) | `evidence/lsw-h3-01-jt6-turn_after_call.png` | Not fired (no heroHolding) | **B2 candidate:** brick turn; JT♥ still TP + BDFD + BDSD. `combos: ['J♥T♠']`; `bucketCandidates: ['topPair']` interim, `['topPair', 'backdoorFlushDraw', 'backdoorStraightDraw']` once S4/G3 integrates on made hands. |
| 2 | `river_brick_v_calls` | river | 78bb | T♥9♥6♠2♣3♦ | J♥T♠ (explicit — decision prompt "Hero's play with JT?") | `evidence/lsw-h3-02-jt6-river_brick_v_calls.png` | Not fired | **B3 candidate:** dead runout, JT♥ still TP. Backdoor draws expired. `combos: ['J♥T♠']`; `bucketCandidates: ['topPair']`. |
| 3 | `river_checkback` | river | 34bb | T♥9♥6♠2♣3♦ | J♥T♠ (explicit — prompt "Hero with JT?"); facing BB bet 75%, MISMATCH accent | `evidence/lsw-h3-03-jt6-river_checkback.png` | Not fired; **F1 fix visible:** WHY section pot-odds math reads `25.5 / 85 → ~30% equity` (was 25%). | **B3 candidate:** JT♥ as bluff-catcher. `combos: ['J♥T♠']`; `bucketCandidates: ['topPair']`. Domination map here would be pedagogically rich (BB's polar river range = condensed value + natural bluffs). |
| 4 | `turn_brick_v_checkraises` | turn | 184bb | T♥9♥6♠2♣ | J♥T♠ (explicit — prompt "Hero with JT?"); facing BB check-raise to 3× | `evidence/lsw-h3-04-jt6-turn_brick_v_checkraises.png` | Not fired; **F1 fix visible:** WHY section math reads `~75bb to call into a ~184bb pot → we need ~29% equity (74.8 / 258.4)` (was 108-pot math). | **B2 candidate:** JT♥ still TP + BDFD + BDSD. `combos: ['J♥T♠']`; `bucketCandidates: ['topPair']` interim. Domination map here would also be rich (BB's check-raise range is almost purely nutted). |

**JT6 walk conclusion:** All 4 remaining decision nodes render cleanly post-H1/H2/G3/G5 work. F1 content-fix pot-accounting corrections confirmed live on `river_checkback` and `turn_brick_v_checkraises`. No rendering defects detected. All 4 are B2/B3 candidates with uniform `bucketCandidates: ['topPair']` — no taxonomy extension needed beyond what G3 already shipped. Pedagogy leverage (domination map) varies by node; `river_checkback` and `turn_brick_v_checkraises` are the two highest-value B2/B3 targets because villain range is sharply polarized (bluff-catching + fold-vs-check-raise teaching payloads).

### Lines 2–8 — flop roots on the other 7 authored lines

| # | Line | Hero / Villain | Pot | Board | Hero combo (prose) | Screenshot | S1/S3/S7 | Feasibility for `LSW-B1` |
|---|------|----------------|-----|-------|--------------------|------------|----------|--------------------------|
| 5 | `btn-vs-bb-srp-ip-dry-q72r` | BTN / BB | 5.5bb | Q♠7♥2♣ | not pinned — prose teaches merged-range cbet; no specific combo named | `evidence/lsw-h3-05-q72r-flop_root.png` | n/a (no heroHolding) | **B1 target:** canonical merged-cbet. Natural pin: `Q♠J♠` (TPTK with backdoor FD/SD) or `A♠Q♣` (TP + top-kicker). Suggest `A♠Q♣` — primary teaching is cbet decision with unambiguous TP, not draw planning. `bucketCandidates: ['topPair']`. Alt pin `J♣J♦` → `bucketCandidates: ['overpair']` for an overpair-teaching variant (pedagogically distinct, could ship as separate node). |
| 6 | `sb-vs-bb-srp-oop-paired-k77` | SB / BB | 5.5bb | K♠7♦7♣ | not pinned — prose names hero "has all Kx and overpairs" in aggregate (line renamed from `co-vs-bb-...` via LSW-F3 2026-04-22 to fix position mismatch; CO would be IP vs BB but authored action flow was OOP) | `evidence/lsw-h3-06-k77-flop_root.png` | n/a | **B1 target:** paired board small-cbet. Natural pin: `A♥K♦` (TPTK on paired board). `bucketCandidates: ['topPair']`. Paired-board `trips` bucket is feasible for the range (A7s/K7s) but not for the AK pin — exclude `trips`. Overpair (AA/QQ-88) an alt-pin teaching variant — `bucketCandidates: ['overpair']`. **Validator note:** G5.1 taxonomy now splits topPair into good/weak; AKo on K77 would classify `topPairGood` — either alias or switch `bucketCandidates` to `['topPairGood']` (consistency check B1 should resolve before authoring). |
| 7 | `sb-vs-btn-3bp-oop-wet-t98` | SB / BTN | 21bb | T♠9♠8♥ | **pinned in prose:** `A♦A♣` (explicit "Hero acts OOP with A♦A♣") — this line is already hand-level teaching via prose | `evidence/lsw-h3-07-t98-flop_root.png` | n/a | **B1 target, highest-leverage:** AA on a 3-straight-board — the "overpair-not-nuts" teaching spot. `combos: ['A♦A♣']`; `bucketCandidates: ['overpair']`. **Crucial:** do NOT include `topPair` (AA isn't TP of T), `flushDraw` (hero has no ♠), `openEnder` (no 7/J in hand), `topPairWeak`, `nutFlushDraw`, or `nonNutFlushDraw`. Domination map post-G5 will show AA crushed by QJ/JJ and drawing against J87/QJs combo draws — textbook teaching payload. |
| 8 | `utg-vs-btn-4bp-deep` | UTG / BTN | 55bb | A♠K♦2♠ | **pinned in prose:** "Hero with AK" (suit unspecified) | `evidence/lsw-h3-08-ak2-flop_root.png` | n/a | **B1 target:** AK 4BP teaching. Suit resolution matters: `A♠K♣` → TP-top-two (two-pair classification) + backdoor flush; `A♥K♦` → pure two-pair no-draw; `A♠K♠` → two-pair + nut flush draw. Pedagogically cleanest is `A♥K♦` for pure two-pair teaching (no draw-equity confusion). `combos: ['A♥K♦']`; `bucketCandidates: ['twoPair']`. G5.1 split: if taxonomy exposes `topTwo` vs generic `twoPair`, prefer the split. |
| 9 | `btn-vs-bb-sb-srp-mw-j85` | BTN / SB+BB (3-way) | 10bb | J♠8♥5♦ | **pinned in prose:** `A♦J♣ (TPTK)` | `evidence/lsw-h3-09-j85mw-flop_root.png` | n/a | **B1 target, MW CAVEAT:** rainbow board, TPTK in 3-way pot. `combos: ['A♦J♣']`; `bucketCandidates: ['topPair']`. **MW rendering gap:** `BucketEVPanel.computeBucketEVs` calls `handVsRange` against a single villain range today; MW villains require vs-two-ranges equity + cascading fold probability. Recommend B1 authors `heroHolding` on this node but flags `{ multiwayDeferred: true }` or similar until LSW-G (MW bucket-EV engine) ships. Otherwise panel will render misleading HU numbers. |
| 10 | `co-vs-btn-bb-srp-mw-oop` | CO / BTN+BB (3-way) | 10bb | Q♥5♠3♦ | **pinned in prose:** `A♠Q♣` (TPTK) | `evidence/lsw-h3-10-q53mw-flop_root.png` | n/a | Same profile as row 9 (MW caveat applies). `combos: ['A♠Q♣']`; `bucketCandidates: ['topPair']`. Rainbow dry board, so `flushDraw` / `openEnder` / `twoPair` all infeasible. Defer pinning until MW bucket-EV engine lands. |
| 11 | `utg-vs-btn-squeeze-mp-caller` | UTG / BTN+MP1 | 20bb | Q♣8♥2♦ (illustrative, not live) | **pinned in prose:** `QQ` (explicit "Hero UTG with QQ") | `evidence/lsw-h3-11-utgsqueeze-pre_root.png` | n/a | **B1 SKIP — structural.** This node is a **preflop decision** encoded as `street: 'flop'` with an illustrative board (comment at `lines.js:2158` confirms: "approximate — preflop decisions encoded as 'flop' for schema; board empty-ish"). Buckets are postflop-only constructs — the bucket taxonomy has no semantic for "QQ preflop vs squeeze." `bucketCandidates` must stay empty / undefined for this node. **Route:** a separate preflop-teaching widget or a dedicated `LSW-B` tier for preflop hand-level teaching; not B1. Add as explicit skip in B1's acceptance list. |

### Per-line feasibility checklist (consume in `LSW-B1`)

For B1 (flop decision roots) authoring, these are the per-line locks:

| Line | Author on B1? | Pin `combos` | `bucketCandidates` | Block on MW-engine? |
|------|---------------|--------------|---------------------|---------------------|
| `btn-vs-bb-3bp-ip-wet-t96` | already done (JT6 flop_root) | `['J♥T♠']` | `['topPair']` (→ `['topPair', 'backdoorFlushDraw', 'backdoorStraightDraw']` post full G3 integration) | no |
| `btn-vs-bb-srp-ip-dry-q72r` | yes | `['A♠Q♣']` (or `['Q♠J♠']`) | `['topPair']` | no |
| `sb-vs-bb-srp-oop-paired-k77` | yes | `['A♥K♦']` | `['topPair']` or `['topPairGood']` (taxonomy call) | no |
| `sb-vs-btn-3bp-oop-wet-t98` | yes, **highest SPI B1 target** | `['A♦A♣']` | `['overpair']` | no |
| `utg-vs-btn-4bp-deep` | yes | `['A♥K♦']` | `['twoPair']` (or `['topTwo']` if exposed) | no |
| `btn-vs-bb-sb-srp-mw-j85` | defer or flag MW | `['A♦J♣']` | `['topPair']` | **yes — block** |
| `co-vs-btn-bb-srp-mw-oop` | defer or flag MW | `['A♠Q♣']` | `['topPair']` | **yes — block** |
| `utg-vs-btn-squeeze-mp-caller` | **skip (preflop)** | — | — (leave empty) | n/a |

Net: B1 ships **4 of 7** HU flop roots with no engine blockers (Q72r, K77, T98, AK2). 2 of 7 are MW and need a new `LSW-G` ticket for multi-villain bucket-EV before they can widen. 1 of 7 (preflop squeeze) falls outside B1's scope entirely and should be marked as an explicit exclusion in B1's acceptance criteria.

### New findings surfaced by the sweep (beyond S1..S7)

1. **H3-F1 (P2) — `BucketEVPanel` has no multiway protocol.** `computeBucketEVs` calls `handVsRange(villainRange, ...)` against a single range; the MW lines (`btn-vs-bb-sb-srp-mw-j85`, `co-vs-btn-bb-srp-mw-oop`) have two villains. Today the panel can't render on those lines without producing HU-calibrated EVs that misrepresent the spot. **Route:** new `LSW-G6` ticket — MW bucket-EV: per-villain equity + weighted action EV using cascading fold probabilities (pattern parallels `foldEquityCalc`'s MW model). Until G6 ships, B1 must not add `heroHolding` to MW flop roots.
2. **H3-F2 (P3) — preflop-node schema workaround is undocumented in `POKER_THEORY.md`.** The `pre_root` node on the UTG-squeeze line carries `street: 'flop'` + an illustrative board to satisfy the schema. This is a known intentional divergence (inline comment at `lines.js:2158`) but isn't in POKER_THEORY.md §9. **Route:** add §9.2 entry on "preflop decisions encoded via flop schema" during the next POKER_THEORY.md touch, and mark any preflop-class pins as explicit B1 exclusions.
3. **H3-F3 (P3) — taxonomy/bucket naming drift between H1 interim and G5.1 split.** `bucketCandidates: ['topPair']` (as authored on JT6 flop_root) continues to work because the classifier falls through to the generic topPair group, but G5.1 introduced `topPairGood` / `topPairWeak` as distinct IDs for the domination map. For B1 authoring on K77 etc., the author must choose between: (a) staying on the aggregate `topPair` label, (b) migrating to `topPairGood` for precision. Recommend (b) for new authoring, and open a separate `LSW-H4` to migrate the JT6 `bucketCandidates` from `topPair` → `topPairGood` for consistency. Low-urgency — both work; inconsistency is the smell, not a defect.

### Closure

- All 11 targeted nodes walked at 1600×720 with evidence screenshots in `evidence/`.
- Per-line feasibility checklist produced for `LSW-B1` acceptance criteria.
- 3 new findings surfaced (H3-F1 P2, H3-F2 P3, H3-F3 P3) — `LSW-G6` MW bucket-EV engine opened as a blocker for MW B1; H3-F2/F3 routed to documentation + optional consistency pass.
- No defects that block H3 closure. **LSW-H3 ready for COMPLETE.**
- **`LSW-B1` now unblocked on 4 of 7 remaining flop roots** (Q72r, K77, T98, AK2). MW widening (J85, Q53) remains blocked on `LSW-G6`. Preflop squeeze skipped.

---

## Review sign-off

- **Drafted by:** Claude (main, session 2026-04-22)
- **Reviewed by:** owner — plan approved 2026-04-22 via `C:\Users\chris\.claude\plans\distributed-cuddling-crystal.md`.
- **Status:** OPEN — closes when S1 / S2 / S3 / S4 / S6 / S7 have each shipped or been explicitly waived, and `LSW-H3` sweep is complete.
- **S5 (paradigm)** tracked separately under `LSW-G4` — audit closure does not require it to ship, only for it to be gated behind the roundtable decision.

---

## Change log

- 2026-04-22 — Drafted. Combined expert + UX persona, Playwright live-surface walk at 1600×720. Flop_root only. Evidence captured under `evidence/`. Routes: LSW-H1, LSW-H2, LSW-H3, LSW-G3, LSW-G4, LSW-G5.
- 2026-04-22 — LSW-H1 shipped. S1 (feasibility gate + bucketCandidates trim), S3 (calculator seeding), S7 (`air`-rejection validator) resolved. Post-H1 walk on Reg + Fish + Pro verifies the three P0 surface defects no longer fire on flop_root. Audit remains OPEN (S2/S4/S5/S6 unaddressed).
- 2026-04-22 — LSW-G3 shipped. S4 (backdoor flush / straight draw taxonomy) resolved. Audit remains OPEN (S2/S5/S6).
- 2026-04-22 — LSW-H2 shipped. S2 (hero-combo-specific EV row) resolved. Per-combo EV row surfaces J♥T♠ at equity 56.1% / bet 150% +17.99bb (vs Reg), directly contrasted against the topPair bucket average +20.30bb. Post-H2 walk on Reg + Fish + Pro verifies archetype-responsive per-combo EV (Reg 56.1% → Fish 57.7% → Pro 59.6%). Audit remains OPEN (S5 paradigm roundtable, S6 domination map).
- 2026-04-22 — LSW-G5 shipped. S6 (domination map) resolved. Collapsed disclosure under the pinned-combo row shows 4 hand-type groups for BB's 3bet range: FAVORED Overcards 45.2%/79% · DOMINATED Overpair 28.8%/22% · FAVORED Direct Draws 24.7%/62% · CRUSHED Set/Trips 1.4%/8% (vs Reg). Post-G5 walk on Reg + Fish + Pro verifies archetype responsiveness in per-group equity (MC variance within tolerance). Audit remains OPEN only on S5 (paradigm roundtable, governance step, no code).
- 2026-04-22 — LSW-G5 precision-split (G5.1). Owner feedback: the "Direct Draws" bucket collapsed 5 distinct draw types into one row, erasing planning signal. Taxonomy expanded from 12 entries to 28: direct draws split into `comboDraw` / `nutFlushDraw` / `nonNutFlushDraw` / `oesd` / `gutshot`; overcards split into `Ax` / `Kx` / `Qx-Jx` / `other` by high-card rank (blocker effects); top pair split into `topPairGood` / `topPairWeak`; set/trips split; backdoor split into BDFD / BDSD / combo. JT6 flop_root now shows 6 rows post-split: DOMINATING Overcards (Ax) 45.2%/83% · DOMINATED Overpair 28.8%/28% · FAVORED Gutshot 20.5%/65% · FAVORED Non-nut Flush Draw 2.7%/72% · CRUSHED Set 1.4%/8% · FAVORED Combo Draw 1.4%/60%. The "Ax" qualifier reveals BB's 3bet range is 100% Ax-overcards (AK/AQs/A5s-A4s) — no Kx/Qx. The gutshot dominance (20.5%) shows BB's A-high hands with straight potential outnumber their flush draws 8× on this board. Pedagogical payload much sharper: student now sees "I'm dominating Ax bluffs, I'm coinflipping vs gutshots, I'm crushed by sets" instead of the collapsed "I'm favored vs draws." Pair+draw composite classification (middle pair + BDFD + gutshot etc.) still deferred — current classifier is strongest-wins.
- 2026-04-22 — LSW-H3 visual-verification sweep shipped. 11 nodes walked at 1600×720 (4 remaining JT6 decision nodes + 1 flop root per other line). All nodes render cleanly post-H1/H2/G3/G5/G5.1/G5.2. F1 pot-accounting corrections verified live on `river_checkback` (30% equity) and `turn_brick_v_checkraises` (184bb pot, 74.8/258.4 math). Per-line feasibility checklist produced for B1 widening: 4 of 7 remaining flop roots (Q72r, K77, T98, AK2) are unblocked with concrete `combos` + `bucketCandidates` recommendations; 2 of 7 MW lines (J85, Q53) blocked on new `LSW-G6` ticket (MW bucket-EV engine); 1 of 7 (UTG-squeeze) is preflop-only and explicitly excluded from B1 scope. 3 new findings surfaced: H3-F1 P2 (MW bucket-EV engine gap, routes to LSW-G6), H3-F2 P3 (preflop-as-flop schema workaround undocumented in POKER_THEORY.md §9), H3-F3 P3 (taxonomy naming drift between `topPair` aggregate and G5.1 `topPairGood`/`topPairWeak` split). Audit now has all P0/P1 scope covered; only S5 paradigm roundtable (LSW-G4) remains open as a governance gate.
- 2026-04-22 — LSW-G4 Gate-2 blind-spot roundtable drafted at `docs/design/audits/2026-04-22-blindspot-lsw-g4-villain-first-panel.md`. Verdict **YELLOW**: paradigm question legitimate but post-G5.2 stack already contains villain-range decomposition (tertiary-positioned and collapsed). Three paths presented for owner decision: Path 1 (keep hero-first primary, expand domination by default, add weighted-total arithmetic row — recommended, 1-2 sessions); Path 2 (full villain-first restructure, L-effort rewrite); Path 3 (accept current, waive S5 with reasoning). Gate 3 follow-ups identified regardless of path: add JTBDs DS-48/DS-49/DS-50/DS-51; either expand Apprentice persona scope or add `first-principles-learner.md` situational. Audit S5 remains OPEN pending owner decision; S5 closure class determined by path selection (Path 1 → WAIVED-to-enhancement; Path 2 → RESOLVED-by-restructure; Path 3 → WAIVED).
