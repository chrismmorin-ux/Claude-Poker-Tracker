# Surface — BucketEVPanel v2 (villain-first decision surface)

**ID:** `bucket-ev-panel-v2`
**Status:** DRAFT — Gate-4 design artifact.
**Scope:** The study-surface decision-modeling panel rendered inside `LineWalkthrough` when a decision node in Line Study declares a hero view (pinned combo, pinned set of combos, or range-level).
**Supersedes:** `BucketEVPanel` v1 (hero-first, pinned-combo + demoted bucket table + collapsed domination disclosure, post-G5.2).
**Code paths (target after implementation):**
- `src/components/views/PostflopDrillsView/BucketEVPanel.jsx` (v2 composition root)
- `src/components/views/PostflopDrillsView/panels/` (new — primitive components)
- `src/utils/postflopDrillContent/drillModeEngine.js` (`computeBucketEVs` input contract extended)
- `src/utils/postflopDrillContent/lineSchema.js` (decision-node schema extended for v2 axes)

**Route / entry points:**
- Rendered in `LineNodeRenderer` when `node.decision` is present AND (`node.heroView` is present OR `node.villainRangeContext` is present).
- No standalone route — it is a sub-surface of Postflop Drills → Line.

**Last reviewed:** 2026-04-22 (draft author)

---

## Purpose

This surface answers one question for one decision node: **"given villain's range composition (after every action taken in this line so far), what is the correct action, and why is it correct against each structural piece of villain's range?"**

It is explicitly not: a scorecard, a range-vs-range equity viewer (Explorer does that), a live-game advice bar (sidebar `LiveAdviceBar` does that), or a hand solver (we don't run solvers; we teach against solver-informed and population-informed priors).

The v2 restructure exists because the v1 panel (post-G5.2) puts hero-first framing primary and villain-range decomposition tertiary-and-collapsed. First-principles decision modeling (`feedback_first_principles_decisions.md` + POKER_THEORY.md §7) says the decision driver is villain's range, not hero's hand. The v1 ordering is pedagogically inverted for the primary target personas (Apprentice, Scholar, first-principles-learner) and mis-matches the Coach workflow. v2 inverts the primary/secondary positioning without deleting the hero view — it reorganizes the teaching around the thing the student can't see at the table (villain's range).

**Path decision note.** The G4 roundtable verdict was YELLOW with Path 1 (middle path) as the recommended default. Owner explicitly selected **Path 2 (full restructure)** 2026-04-22 with the forward-compatibility directive: "design for the final state so we don't redesign when populating more slices — variation in hero hands, first action being hero's, varied villain first actions. Bluff-catching and thin-value must be first-class." This spec implements Path 2 per owner directive.

---

## Decision-modeling doctrine (foundational)

Three invariants the v2 spec must satisfy. Every variant / primitive / extension seam is checked against these.

**I-DM-1. Villain's range decomposition is the primary teaching block.** It is rendered above the hero view; expanded by default; cannot be hidden behind a disclosure. The student sees villain's range shape as their first cognitive input.

**I-DM-2. Arithmetic traceability is visible, not implicit.** The weighted-total EV per action is shown as `Σ(weight × per-group EV) = total` with the terms visible, not just the sum. A student must be able to read the math, not just the outcome.

**I-DM-3. Hero's view is context, not answer.** The hero's specific holding (or combo set, or full range) is shown as a header-and-result block: "you hold X; against the decomposition above, you make Y bb by action Z." It is the *consequence* of the range-first reasoning, not the *organizing* structure.

**Structural enforcement (not just documentary).** The invariants are encoded in code, not just in this doc. Specifically:

- **I-DM-1 enforcement:** The v2 composition root renders from an ordered constant `VARIANT_RECIPES[variantId]: PrimitiveRef[]` — e.g., `V1: ['P1', 'P2', 'P4', 'P3', 'P6']`. The array position of P1 is the first element; any reordering is visible in code review. Adding a new primitive requires updating `VARIANT_RECIPES` — which makes violations grep-visible. A future contributor who places P3 above P1 must do so by editing the recipe constant, not by reshuffling JSX.
- **I-DM-2 enforcement:** `WeightedTotalTable` (P2) throws in dev (`assert(perGroupContribution.length > 0)`) when rendered without per-group breakdown. Empty-state is a failure, not a silent render. Prod builds log and degrade to a banner that names the violation.
- **I-DM-3 enforcement:** `HeroViewBlock` (P3) interface explicitly does not accept a `bestActionLabel` or `totalEV` prop. The EV answer is physically unreachable from P3's props surface. A future contributor wanting to put EV on P3 must change its interface — breaking every call site in a grep-visible way.

Any future feature that violates these without a documented exception requires the roundtable gate. The enforcement mechanisms above mean the violation is visible in a code review, not discoverable only at design-review time.

---

## Axes of variation (primary 1–5, secondary 6–8)

The v2 surface must handle all of these without a redesign. v1-ship scope covers axes 1–5 with concrete variants; axes 6–8 define extension seams.

| # | Axis | v1-ship scope | Extension direction |
|---|------|---------------|---------------------|
| 1 | **Villain first action** (on the node's street) | `donk`, `cbet`, `check`, `check-raise`, `probe`, `bet` (any size), `check-back` (prior street), `raise-after-hero-bet` | Arbitrary action kinds via schema enum; bet sizes as continuous `pctPot`; mixed strategies as `{ kind, frequency }[]` |
| 2 | **Who acts first at this node** | `hero-first` (villain checked / nothing yet) or `villain-first` (any villain action) | No extension — binary by nature |
| 3 | **Hero view type** | `single-combo` (`J♥T♠`), `combo-set` (class of combos all same bucket), `range-level` (no pin — show hero's range distribution) | Archetype-conditioned hero range; user-selectable combo picker; "scenario variants" (study JT *or* 54s on this node) |
| 4 | **Villain count** | 1 (HU) | 2-way MW (G6), 3-way MW (future); per-villain range + cascading fold probability; per-villain domination OR combined-villain domination (design call per variant) |
| 5 | **Street depth + range narrowing** | flop-root, turn-after-call, turn-after-raise, river-after-double-call, river-bluff-catch, river-thin-value, river-after-checkback | Arbitrary street × action-sequence tuples; villain range narrowed by the action history via a pluggable `narrowRange(villainRange, actionHistory)` function |
| 6 | **Villain range source** | pre-authored `villainRange.base` per node; archetype-weighted via `ARCHETYPE_BUCKET_MULTIPLIERS` | Tendency-profile-driven (from `useTendencies` observations); solver-corrected via plug-in; hand-of-the-user live stats |
| 7 | **Archetype scope** | Reg / Fish / Pro (current 3-archetype toolbar); weightPct on domination map is base-range-only (G5 current) | Archetype-weighted weightPct; style-conditioned bucket composition; per-decision archetype override |
| 8 | **Hero action granularity** | 2–4 fixed hero actions per node; each a terminal or a `nextId` | Variable action sets (continuous sizings); mixed strategy output; depth-2 sub-tree rendering ("if I raise and villain 3-bets...") |

**Bluff-catching and thin-value are not separate axes** — they are specific compositions along axes 1+2+5 (bluff-catch = villain-first-bet + hero-facing-bet on river; thin-value = hero-first-bet on river where hero's range contains marginal made hands). The v2 variants section names them explicitly because they are high-frequency pedagogical spots, but they are not special-cased structurally.

---

## Primitives

The v2 panel composes from small primitives. Each primitive is independent, independently testable, and reusable across future surfaces (sidebar `LiveAdviceBar`, `HandPlan`, `HeroCoachingCard`). Primitives are the extension mechanism: new variants compose primitives differently; new axes add new primitives without touching existing ones.

### P1 — `VillainRangeDecomposition`

**What it is.** The primary teaching block. Renders villain's range grouped by `DOMINATION_GROUPS` (post-G5.1 28-entry taxonomy; post-G5.2 pair+draw composites). Per group: relation badge (crushed/dominated/neutral/favored/dominating vs hero), weight% of villain range, hero equity %, confidence interval (MC variance from trial count — E1 from G4 roundtable).

**Rendering modes.** P1 triggers one of three rendering modes based on `decision.kind` in the node schema:

- **`standard`** (default) — rows sorted heaviest-first. Single list.
- **`bluff-catch`** — two visually separated sub-lists with a divider:
  - `VALUE REGION (villain beats you)` — groups where hero's `relation ∈ {crushed, dominated}`, sub-total weightPct shown.
  - `BLUFF REGION (you beat villain)` — groups where hero's `relation ∈ {favored, dominating}`, sub-total weightPct shown.
  - Neutral-relation groups render below, labeled `CLOSE`.
  - Sub-total comparison between value vs bluff is the primary teaching payload for V5.
- **`thin-value`** — rows grouped into `HANDS THAT BEAT YOU` (relation ∈ {crushed, dominated}) and `HANDS THAT PAY YOU` (relation ∈ {favored, dominating}). The ratio `beatWeight / payWeight` is rendered as `valueBeatRatio` in the output (see contract below) and is the primary teaching payload for V6.

**Visible-row cap (responsive).** Default at ≥1200px viewports: 6 visible rows. At <1200px: still 6. At <900px: cap drops to 4. At <640px: cap drops to 3. Groups beyond the cap collapsed behind a single `"Show all N groups (M% of range)"` disclosure row (Gate-4 F04 — unified with P2's column disclosure pattern). The cap keeps P1 above fold across the viewport range (Gate-4 F02 + H-ML01) and preserves I-DM-1 (villain decomposition primary-positioned).

**Column-header annotation for archetype invariance.** The `weight %` column header carries the small-text note `(base range — unaffected by archetype)` with a `(?)` tap for the why. This is the v1-ship mitigation for axis-7 deferral: students who switch archetypes and notice weightPct unchanged are preempted by the explicit annotation rather than discovering the "inconsistency" via support tickets.

**Inputs:**
- `villainRange: RangeShape` (canonical range representation — 169-cell weight grid OR combo-weighted)
- `hero: HeroContext` — one of:
  - `{ kind: 'combo', cards: [cardInt, cardInt] }` — equity vs range
  - `{ kind: 'comboSet', cards: CombinationSet }` — weighted equity across all pinned combos
  - `{ kind: 'range', range: RangeShape }` — range-vs-range equity distribution (renders bar chart instead of per-group equity)
- `board: Card[]`
- `mcTrials: number` (default 250; exact enumeration path when turn/river + combos ≤ 20)

**Outputs to render:**
- One row per non-empty `DOMINATION_GROUP`, sorted heaviest-first
- "Total weight" footer: sum of weight% (sanity check ≈ 100%)
- "No decomposition possible" empty state if villain range is empty (e.g., line inconsistency)

**Confidence display.** Each equity cell shows `X% ±Y%` where Y is derived from trials count (`±1/sqrt(n)` rule of thumb). When exact enumeration runs (≤20 combos), display `(exact)` instead of `±Y%`.

**Archetype sensitivity.** v1 ships with weightPct invariant across archetype (matches G5 behavior). Extension seam: optional `archetype: Archetype` input that when passed reweights the range per `ARCHETYPE_BUCKET_MULTIPLIERS` before decomposition; axis 7 work.

### P2 — `WeightedTotalTable`

**What it is.** The arithmetic-traceability block. For each candidate hero action, shows the per-group contribution and the sum. Satisfies I-DM-2.

**Inputs:**
- `heroActions: Action[]` (e.g., `[{ label: 'Bet 150%', betFraction: 1.5 }, { label: 'Check', betFraction: 0 }, { label: 'Fold', betFraction: null }]`)
- `decomposition: VillainRangeDecompositionResult` (from P1)
- `foldCurves: FoldCurveMap` (per-bucket, per-sizing — already in `drillModeEngine`)
- `hero: HeroContext` (from P1)

**Outputs to render.** One row per action; columns: per-group EV contribution (`weight% × perGroupEV`); a total column. Best-action EV highlighted. Example layout:

```
Action          Overcards(Ax) | Overpair | Sets | Draws | Total
Bet 150%        45% × +8.2    | 29% × -4.1 | 1% × -30 | 20% × +12 | +17.99bb
Bet 75%         45% × +5.1    | 29% × -2.3 | 1% × -22 | 20% × +9  | +13.44bb
Check           45% × +0.3    | 29% × +0.8 | 1% × -5  | 20% × +2  |  +3.85bb
Fold            —             | —          | —        | —         |   0.00bb
```

Rows read left-to-right as the arithmetic the student needs to see.

**Visible-column cap (responsive, Gate-4 F04 unified pattern).** At ≥1200px viewports: max 5 per-group columns + Total. Groups beyond top-4-by-weight collapse behind a `"Show all N terms"` disclosure (same pattern as P1's row-overflow — Gate-4 F04 unification). At <1200px: downgrade to 3 columns (`Beats you / Pays you / Other` + Total). At <900px: downgrade to vertical layout (actions in rows, per-group contributions in sub-rows, expandable per action). Teaching payload is the arithmetic *structure*; the responsive degradation preserves that across viewport sizes without losing readability.

**Engine dependency (critical).** `P2` requires `actionEVs[].perGroupContribution` from `computeBucketEVsV2`. This is **net-new computation**, not an additive rename of v1's output — the v1 engine has two parallel pipelines (equity via `handVsRange`, EV via coarse `HERO_BUCKET_TYPICAL_EQUITY`) that never cross. P2 requires the join. See the data contract section for `computeDecomposedActionEVs` signature; this is a new function shipped in Commit 2, not a reshape of `computeBucketEVs`.

**I-DM-2 dev-mode assertion.** When `perGroupContribution` is empty or absent, P2 in dev builds throws with a clear message naming the violation. Prod builds degrade to a banner: "Per-group EV breakdown unavailable on this node — falling back to totals-only." This makes I-DM-2 enforceable: a future contributor cannot silently ship a node that renders totals-only without acknowledging the invariant violation.

### P3 — `HeroViewBlock`

**What it is.** The hero's context header. Renders the hero combo / combo-set / range in the minimum form that does not compete with P1 for primary attention.

**Three modes by hero view type (axis 3):**
- `single-combo` — amber mini-card: "You hold J♥T♠ (top pair, backdoor flush)". No EV number here (EV is shown in P2's total column for row that matches hero's best action, or in a condensed "recommendation" strip below P2).
- `combo-set` — text summary: "You hold top-pair-good (8 combos: AT / KT / QT)". Clickable → modal opens the combo picker.
- `range-level` — bar chart: hero's range distribution by bucket (% of range per bucket), rendered horizontally. No EV — the P2 total is the answer.

**The v2 shift:** the hero-combo EV number (current pinned-row primary in v1) is absorbed into P2's total column, removed as a separate primary block.

**I-DM-3 interface enforcement.** `HeroViewBlock` props deliberately exclude `bestActionLabel`, `totalEV`, `recommendedAction`, or any other field that would let the primitive display the decision answer. Its interface is strictly: `{ mode: 'single-combo' | 'combo-set' | 'range-level', ...modeSpecificProps, classLabel?: string }`. A future contributor who wants to put EV on P3 must change its interface — which is visible in every call site's type signature.

**Three-mode coupling risk (product-UX review flag).** The three modes have meaningfully different render surfaces: single-combo is a text card, combo-set is a text+modal, range-level is a bar chart. For v1-ship scope (single-combo only), this is one primitive. When V10 (range-level) ships in v1.1, the three-mode abstraction may need to split — either into `HeroComboBlock` + `HeroRangeBlock` sibling primitives, or P3 keeps one shell but each mode ships its own render body. The v1 ship decision is to keep the three-mode contract in docs but only implement `single-combo`; the split decision defers to V10's implementation session.

### P4 — `ActionRecommendationStrip`

**What it is.** A thin one-line summary that names the correct action + answers "why" in 1 sentence. Read-out for the impatient reader who doesn't want to parse P2.

**Example:** `"Correct: Bet 150% pot (+17.99bb). Targets overcards that fold and overpairs that call — the size polarizes cleanly."`

Displayed between P2 and P3, not above. Student who skips it loses nothing structural.

### P5 — `StreetNarrowingContext`

**What it is.** A header strip on non-root nodes showing how villain's range was narrowed from the prior node. Axis 5 support.

**Position.** Docked **above** P1 on non-root nodes (Q4 resolution). On root nodes (flop_root, pre_root) P5 is absent. This placement is non-negotiable — narrowing is the *premise* of the decomposition P1 shows; it belongs visually above the thing it contextualizes.

**Layout constraint.** Max 2 lines visible by default, ~60px height. Full narrowing trace (multiple streets on river nodes) is rendered via "show full history" tap — expanded form is a modal or inline expansion below the 2-line summary.

**Example on `turn_after_call` (river nodes show a similar 2-line summary):**
```
VILLAIN RANGE NARROWED — flop donk called → turn ranges:
  dropped JJ/QQ that raise · kept overpair 40% · set 5% · top-pair 35% · draws 20%   [show full history]
```

**Multi-street narrowing (critical for axis 5).** For river nodes where narrowing spans 3 streets, the 2-line summary shows the most recent narrowing step; the "full history" expansion shows the ordered trace. The `streetNarrowing` output field is an **ordered array** of narrowing events, one per actor-action step, not a single-step object:

```typescript
streetNarrowing?: Array<{
  street: 'flop' | 'turn' | 'river';
  actor: 'hero' | 'villain';
  action: string;  // canonical action label
  sizing?: number;  // bet fraction when applicable
  narrowingSpec: NarrowingSpec;  // see schema section
  priorWeight: number;  // % of villain's pre-narrow range
  narrowedWeight: number;  // % surviving
}>;
```

P5 renders the array as a horizontal trace ("flop-donk-called → turn-check → river-bet-75%"), colorized by actor. The summary line shows only the last step; the full trace is the expansion.

**Default visibility.** Always visible on non-root nodes — not a disclosure, not collapsed behind a tap. If `streetNarrowing` array is empty or absent (authoring error), P5 logs a dev warning and renders a neutral placeholder ("narrowing context unavailable") rather than omitting silently.

### P6 — `ConfidenceDisclosure`

**What it is.** A bottom-of-panel strip listing the confidence-affecting facts: MC trial count, population-prior source, archetype applied, any caveats ("v1-simplified EV — see `drillModeEngine.js:76`"). Addresses E1 (confidence) and E2 (simplified-EV) findings from the G4 roundtable.

Clickable → modal with detailed methodology. Default: one-line summary.

### P6b — `GlossaryBlock` (promoted from Q1 per Gate-4 F01)

**What it is.** A first-class inline glossary addressing H-N06 (recognition over recall) + H-N10 (help) for the bucket-taxonomy vocabulary. First-principles-learner persona explicitly flags the vocabulary gap.

**Default render.** A 1-line affordance at the bottom of the panel (directly above P6): `"Bucket definitions ▸ (showing N labels on this node)"`.

**Expanded render.** On tap, inline-expands (not modal — preserves scroll context) into a two-column list: left column = `displayName` label, right column = 1-sentence definition pulled from `BUCKET_TAXONOMY[id].definition` (new required field on taxonomy entries). Only labels currently rendered on the node appear — the glossary scopes to what the student is looking at.

**Per-label inline tap (F14 constraint).** Every bucket label rendered in P1 + P2 is itself tappable and shows a tooltip / inline popover with the same 1-sentence definition. **Tap area ≥ 44 DOM-px** — achieved by extending the clickable region to include the surrounding cell padding, not just the text's bounding box. Enforced via a shared `<BucketLabel labelId="topPairGood" />` component used by P1 and P2 so the tap-area rule is centralized.

**Label display rule (H-N02).** All P1 + P2 + P6b bucket-label text renders via `BUCKET_TAXONOMY[id].displayName` (e.g., "Top pair, good kicker"), NOT the code-id (`topPairGood`). Authored content may still reference code-ids; rendering must resolve.

### P7 — `PerVillainDecomposition` (MW extension seam)

**What it is.** For MW variants (axis 4), renders one `VillainRangeDecomposition` block per villain, vertically stacked, with a combined "cascading fold probability" footer that shows the multi-villain math.

Axis 4 is scoped out of v1 for MW lines, but the primitive exists so G6 can fill it in without a spec rewrite.

### P8 — `MixedStrategyDisclosure` (axis 8 extension seam)

**What it is.** When `decision.strategy = 'mixed'`, replaces the single-best-action highlight in P2 with a frequency mix ("Bet 150% 60%, Check 40%") and the expected-value-averaging math. Extension seam.

---

## Canonical variants (composition recipes)

Each variant is a named composition of the primitives above + a specific input shape. A variant is a **high-frequency teaching scenario** that every line is expected to contain at least one of; the spec ships with concrete examples so authors know how to compose.

### V1 — HU villain-first flop (donk / cbet / check-back-then-probe)

**Primitives:** P1 + P2 + P4 + P3(single-combo) + P6 + P6b
**Example line-node:** `btn-vs-bb-3bp-ip-wet-t96 / flop_root` (JT6 donk)
**Hero actions:** typically call / raise / fold (3 branches)
**v1 ship:** ✅ — this is the current JT6 flop_root retrofitted; zero feature additions beyond primitive ordering + P4 strip.

### V2 — HU hero-first flop (villain checked)

**Primitives:** P1 + P2 + P4 + P3(single-combo) + P6 + P6b
**Example line-node:** `btn-vs-bb-srp-ip-dry-q72r / flop_root` (Q72r, BB checked)
**Hero actions:** typically cbet 33% / cbet 75% / check (3 branches)
**What P1 shows:** villain's **continuing range** decomposed (what villain would check-call / check-raise with). Crucially, this is a *narrower* range than "villain's flat-3bet range" — it's the subset that reached this node.
**v1 ship:** ✅

### V3 — HU villain-first turn (barrel on previous-called street)

**Primitives:** P1 + P2 + P4 + P3(single-combo) + P5 (street narrowing) + P6 + P6b
**Example line-node:** `btn-vs-bb-3bp-ip-wet-t96 / turn_brick_v_checkraises`
**Key new primitive:** P5 — shows how villain's range narrowed from flop-donk-range to flop-donk-called-hero-raise-range.
**v1 ship:** ✅

### V4 — HU hero-first turn (villain checked twice)

**Primitives:** P1 + P2 + P4 + P3(single-combo) + P5 + P6 + P6b
**Example line-node:** `btn-vs-bb-3bp-ip-wet-t96 / turn_after_call` (brick turn, BB checked)
**What P1 shows:** villain's **range-that-called-flop-and-checked-turn** — materially condensed.
**Hero actions:** bet-various / check-back / overbet
**v1 ship:** ✅

### V5 — River bluff-catch (hero faces bet, hero hand is bluff-catcher)

**Primitives:** P1(bluff-catch mode) + P2 + P4 + P3(single-combo) + P5 + P6 + P6b
**Trigger:** `node.decision.kind = 'bluff-catch'`
**Example line-node:** `btn-vs-bb-3bp-ip-wet-t96 / river_checkback` (hero checked turn → BB bet 75% river)
**What P1 shows:** villain's **polar range** rendered with the polar-split divider — VALUE REGION above (`relation ∈ {crushed, dominated}`, sub-total shown), BLUFF REGION below (`relation ∈ {favored, dominating}`, sub-total shown). The sub-total comparison *is* the primary teaching payload — not delegated to P4's summary. A student reading P1 with the split sees "value = 55% · bluffs = 38% · close = 7%" and has the call/fold decomposition visible directly.
**Hero actions:** call / fold / raise (jam)
**Teaching payload location:** P1's polar-split sub-totals (primary, required). P4's one-line strip is a summary — not the carrier of the pedagogy.
**Output contract addition:** `recommendation.valueBeatRatio: number` — the ratio of value-region-weight to bluff-region-weight. P4 template strings can render this dynamically (e.g., "BB's range is 55% value / 38% bluffs — your top pair is a bluff-catcher; call-or-fold").
**v1 ship:** ✅ — **first-class in v1 per owner directive**

### V6 — River thin-value (hero has marginal made hand, considers betting)

**Primitives:** P1(thin-value mode) + P2 + P4 + P3(single-combo) + P5 + P6 + P6b
**Trigger:** `node.decision.kind = 'thin-value'`
**Example line-node:** `btn-vs-bb-3bp-ip-wet-t96 / river_brick_v_calls` (checked to hero on river, hero has JT)
**What P1 shows:** villain's **check-call-check range** rendered with the thin-value split — HANDS THAT BEAT YOU above (`relation ∈ {crushed, dominated}`, sub-total), HANDS THAT PAY YOU below (`relation ∈ {favored, dominating}`, sub-total). The `valueBeatRatio` output field surfaces `beatWeight / payWeight` directly.
**Teaching payload location:** P1's thin-value split (primary). Student sees "hands that beat you = 62% · hands that pay = 18% · the math doesn't work — check back."
**Hero actions:** check-back / bet small for thin value / overbet
**Output contract addition:** same `valueBeatRatio` field as V5; P4 renders "villain's check-call-check range beats you 3.4× more than it pays — check back is correct."
**v1 ship:** ✅ — **first-class in v1 per owner directive**

### V7 — River thin-value decision after checkback (hero has strong made hand)

**Primitives:** P1 + P2 + P4 + P3(single-combo) + P5 + P6 + P6b
**Example scenarios:** not authored yet; a candidate for B3 (hero has top pair, villain has checked all three streets, hero can extract value from bluff-catchers).
**v1 ship:** ✅ as a variant spec; authored-content ships in B3.

### V8 — Hero open-bet into capped range (leading river)

**Primitives:** P1 + P2 + P4 + P3(single-combo) + P5 + P6 + P6b
**Example scenarios:** not authored yet; a candidate for future content once LSW-A audits identify the spot.
**v1 ship:** ✅ as spec; deferred authoring.

### V9 — MW HU-extended variants (axis 4)

**Primitives:** P7 replaces P1 (multi-villain decomposition); everything else unchanged.
**v1 ship:** ❌ — blocked on LSW-G6 MW bucket-EV engine. Spec primitive exists; implementation deferred.

### V10 — Range-level teaching (no pinned combo — hero "scenario")

**Primitives:** P1 + P2 + P3(range-level, bar chart) + P4 (modified for range-level) + P6 + P6b
**Example scenarios:** BTN opens range vs BB defend — what's my action distribution across my full range?
**v1 ship:** ❌ — deferred to v1.1. Spec primitive (P3 range-level) exists; P2 in this mode shows per-bucket expected actions rather than per-action expected EV. Implementation meaningfully different from V1-V8; deferred.

### V11 — Preflop decisions (pre_root)

**Out of scope for BucketEVPanel.** Preflop has no bucket semantics. Requires its own surface spec (a sibling `preflop-ev-panel.md`). Route preflop teaching through a different component.

---

## Data contract — `computeBucketEVsV2` (new export, parallel to v1)

**Revised post-review.** The v2 output shape is **structurally incompatible** with v1's (`{ archetype, byBucket, pinnedCombo, rangeError }`). The original spec claimed "additive" migration — that claim was false. The revised plan:

- `computeBucketEVs` (v1) stays **unchanged** with its current output. All 17 existing tests continue to pass unchanged.
- `computeBucketEVsV2` is a **new export** shipped in Commit 2, living alongside v1.
- v2 panel (`BucketEVPanelV2.jsx`) calls v2 function. v1 panel (`BucketEVPanel.jsx`) keeps calling v1.
- Commit 5 deletes both the v1 panel and the v1 function together — grep-verifiable as "delete anything reading `heroHolding` on a node or `byBucket` from an engine call."

**Per-group EV is a new computation, not a rename.** The v1 engine has two independent pipelines — equity (via `handVsRange`) and EV (via coarse `HERO_BUCKET_TYPICAL_EQUITY` scalars). P2's `perGroupContribution` requires joining them per `DOMINATION_GROUP`: `perGroupEV = equity_vs_group × (foldPct_vs_group × pot - (1 - foldPct_vs_group) × bet) + etc`. A new function `computeDecomposedActionEVs(villainRange, heroHand, groups, foldCurves, pot, bet)` ships in Commit 2 alongside `computeBucketEVsV2`.

**File ownership.** `computeBucketEVs` currently lives in `BucketEVPanel.jsx` (unusual). `computeBucketEVsV2` + `computeDecomposedActionEVs` are authored in `src/utils/postflopDrillContent/drillModeEngine.js` — engine concerns belong in the engine file. The v1 function stays where it is until Commit 5 deletes it.

```typescript
interface ComputeBucketEVsV2Input {
  // Identity
  nodeId: string;
  lineId: string;

  // Board / street
  street: 'flop' | 'turn' | 'river';
  board: Card[];
  pot: number;
  effStack: number;

  // Villain(s) — array to support MW axis 4
  villains: VillainSpec[];  // length 1 for HU

  // Hero view
  heroView: HeroViewSpec;   // single-combo | combo-set | range-level

  // Decision kind drives P1 rendering mode + output fields
  decisionKind: 'standard' | 'bluff-catch' | 'thin-value';

  // Action history (for axis 5 street narrowing) — StudyActionEntry, NOT the
  // live-game ActionEntry. Drill-layer isolation per SYSTEM_MODEL §1.2.
  actionHistory: StudyActionEntry[];

  // Candidate hero actions at this node
  heroActions: HeroActionSpec[];
  decisionStrategy?: 'pure' | 'mixed';  // default 'pure'

  // Archetype context
  archetype: 'reg' | 'fish' | 'pro';

  // Engine tuning — unified trial count across primitives (P1 domination + pinned
  // combo equity both use same count) to avoid inconsistent CI widths in one render.
  mcTrials?: number;  // default 500 (up from v1's 250 for consistency with 800 path)
  timeBudgetMs?: number;  // default 400
}

interface StudyActionEntry {
  street: 'flop' | 'turn' | 'river';
  actor: 'hero' | 'villain' | 'villain1' | 'villain2';  // MW-extensible
  action: 'donk' | 'cbet' | 'bet' | 'check' | 'call' | 'raise' | 'check-raise' | 'fold' | 'jam';
  sizing?: number;  // bet fraction when applicable
}

interface VillainSpec {
  position: Position;
  baseRange: RangeShape;
  // Optional — if provided, engine uses as post-archetype narrower.
  tendencyProfile?: TendencyProfile;
}

type HeroViewSpec =
  | { kind: 'single-combo'; combo: [Card, Card] }
  | { kind: 'combo-set'; combos: Array<[Card, Card]>; classLabel: string }
  | { kind: 'range-level'; range: RangeShape };

interface HeroActionSpec {
  label: string;
  kind: 'bet' | 'check' | 'call' | 'fold' | 'raise' | 'jam';
  betFraction?: number;  // for bet/raise; frac of pot
  // v1.1 extension: `frequency` for mixed strategies (axis 8).
}
```

**Output shape (what `computeBucketEVs` returns):**

```typescript
interface ComputeBucketEVsOutput {
  // P1 input
  decomposition: Array<{
    groupId: string;
    groupLabel: string;
    weightPct: number;
    heroEquity: number;
    heroEquityCI: { low: number; high: number; method: 'mc' | 'exact' };
    relation: 'crushed' | 'dominated' | 'neutral' | 'favored' | 'dominating';
    comboCount: number;
  }>;

  // P2 input
  actionEVs: Array<{
    actionLabel: string;
    perGroupContribution: Array<{ groupId: string; ev: number; weightTimesEV: number }>;
    totalEV: number;
    totalEVCI: { low: number; high: number };
    isBest: boolean;
    isMixedComponent?: boolean;  // axis 8
  }>;

  // P4 input. Split into authored + templated fields so the two paths are
  // distinguishable at render time; no silent mixing.
  recommendation: {
    actionLabel: string;
    authoredReason?: string;  // present when line author supplied it
    templatedReason?: string;  // present when engine generated it
    // Renderer prefers authoredReason when both present; logs a warning in dev
    // when neither is present, renders a generic fallback in prod.
  };

  // For V5 (bluff-catch) and V6 (thin-value) — required when decisionKind is
  // either; optional otherwise.
  valueBeatRatio?: {
    valueWeight: number;      // % of villain range that beats hero
    bluffOrPayWeight: number; // % that hero beats (bluffs in V5; "pays" in V6)
    ratio: number;            // valueWeight / bluffOrPayWeight
  };

  // P5 input — ordered array of narrowing events (NOT single-step object)
  streetNarrowing?: Array<{
    street: 'flop' | 'turn' | 'river';
    actor: 'hero' | 'villain' | 'villain1' | 'villain2';
    action: string;
    sizing?: number;
    narrowingSpec: NarrowingSpec;  // see schema section
    priorWeight: number;
    narrowedWeight: number;
  }>;

  // P6 input
  confidence: {
    mcTrials: number;
    populationPriorSource: string;
    archetype: string;
    caveats: string[];  // ['v1-simplified-ev', 'multiway-approximated', ...]
  };

  // MW only (v1 returns null)
  perVillainDecompositions?: Array<{ villainId: string; ...same shape as decomposition }>;
  cascadingFoldProbability?: number;

  // Error discriminant (Gate-4 F03 + H-N09). When populated, all other fields
  // may be absent; panel renders a banner instead of the primitives.
  errorState?: {
    kind: 'range-unavailable' | 'timeout' | 'malformed-hero' | 'engine-internal' | 'taxonomy-mismatch';
    userMessage: string;   // e.g., "Villain range for 'btn_vs_bb_3bp_bb_flat' is not authored yet."
    diagnostic: string;    // e.g., dev-only stack trace or key lookup detail
    recovery?: string;     // e.g., "Retry · Open an issue · Return to line picker"
  };
}
```

The v2 engine contract is additive over v1. Backward-compatible migration:
- v1's `pinnedCombo.evs` + `byBucket` → v2's `actionEVs` (flatten by action, not by bucket-for-hero)
- v1's `dominationMap` → v2's `decomposition` (same shape, renamed)
- v2 adds `streetNarrowing`, `confidence` (replaces scattered caveats), `perVillainDecompositions`, `cascadingFoldProbability`.

---

## Schema extensions for `lines.js`

New optional fields on decision nodes. **Schema version bumps 2 → 3.** `lineSchema.js` `SCHEMA_VERSION` must increment, and a migration guard must reject nodes with *both* `heroHolding` (v1/v2-equiv) and `heroView` (v3) present — dual-authored nodes are a bug, not a feature.

```javascript
{
  id: 'flop_root',
  street: 'flop',
  board: ['T♥', '9♥', '6♠'],
  pot: 20.5,
  villainAction: { kind: 'donk', size: 0.33 },

  // NEW v3 fields below. Presence of `heroView` flags this node as v3;
  // validator rejects if `heroHolding` also present.
  heroView: {
    kind: 'single-combo',  // 'single-combo' | 'combo-set' | 'range-level'
    combos: ['J♥T♠'],
    bucketCandidates: ['topPairGood'],  // G5.1-aligned taxonomy (was 'topPair')
    classLabel: 'top pair good',
  },

  villainRangeContext: {
    // String alias that resolves against the EXISTING archetypeRanges.js
    // keyed lookup — NOT a parallel data store. villainRanges.js is an
    // alias map from string → (position, action, vs) tuple.
    baseRangeId: 'btn_vs_bb_3bp_bb_flat',

    // Axis 5 narrowing. Composable descriptor, not enum.
    narrowingSpec: {
      kind: 'keep-continuing-vs-action',
      actions: ['villain-donk', 'hero-raise'],  // action sequence this narrows against
      filter: 'keep-continue-range',  // semantic: hands that continue vs the raise
    },
    narrowingLabel: 'BB donked flop, hero raised → BB continues only with top-tier',
  },

  decisionStrategy: 'pure',   // or 'mixed' (axis 8)
  decisionKind: 'standard',   // 'standard' | 'bluff-catch' | 'thin-value'

  // decision.branches unchanged structurally; adds optional correctByArchetype.
  decision: { ... },
}
```

**`heroView.kind` gates variant selection.** Single-combo → V1-V8 primitives. Combo-set → V1-V8 with P3(combo-set) mode. Range-level → V10.

**`villainRangeContext.baseRangeId` is an ALIAS, not a parallel range store.** Current codebase has `archetypeRanges.js` (canonical range data keyed by `{position, action, vs}`). v3 adds `villainRanges.js` as a thin alias map:

```javascript
// villainRanges.js — alias layer over archetypeRanges.js
export const VILLAIN_RANGE_ALIASES = Object.freeze({
  'btn_vs_bb_3bp_bb_flat': { position: 'BB', action: 'call', vs: 'BTN' },
  'btn_vs_bb_srp_bb_flat': { position: 'BB', action: 'call', vs: 'BTN' },
  // ... one entry per baseRangeId referenced by lines.js
});

export const villainRangeFor = (baseRangeId) => {
  const tuple = VILLAIN_RANGE_ALIASES[baseRangeId];
  if (!tuple) throw new Error(`Unknown baseRangeId: ${baseRangeId}`);
  return archetypeRangeFor(tuple);  // delegates to existing lookup
};
```

This avoids dual maintenance. Calibration drift updates happen in one place (`archetypeRanges.js`); the alias map only names which tuple a line uses. **Commit 2.5 (new sub-commit) seeds `villainRanges.js` with at least the JT6 line's keys** so the canary migration in Commit 3 has a working range lookup. Senior-engineer review flagged this as a prerequisite.

**`narrowingSpec` is a composable descriptor, not a frozen enum.** The v1-draft spec proposed a 4-value string enum (`kept-continue-range-vs-raise`, etc.) — specialist review flagged this as undersized at the v1 scope (7 depth types). The revised shape:

```typescript
type NarrowingSpec = {
  kind: string;          // handler ID (non-frozen, extensible)
  actions?: string[];    // action-sequence this spec matches against
  filter?: string;       // semantic filter (keep-continue / drop-raises / keep-value / etc.)
  params?: object;       // handler-specific knobs
};
```

Engine ships with a handler map:

```typescript
const NARROWING_HANDLERS = {
  'keep-continuing-vs-action': (range, spec, actionHistory) => { /* ... */ },
  'keep-call-range': (range, spec, actionHistory) => { /* ... */ },
  'drop-raises': (range, spec, actionHistory) => { /* ... */ },
  'keep-check-range': (range, spec, actionHistory) => { /* ... */ },
  'keep-bet-range': (range, spec, actionHistory) => { /* ... */ },
  // Additive — new handlers go here without schema churn.
};
```

Content authors pick a handler by name; engine dispatches. New lines → new handlers in the map when needed, without enum freezing. This is the same dispatch pattern used by `exploitEngine/gameTreeConstants.js` for action-kind routing.

**`decisionKind` is new** (defaulting to `'standard'`) and drives P1 rendering mode — see Primitives section P1. Authors set `decisionKind: 'bluff-catch'` on V5 nodes and `'thin-value'` on V6 nodes.

---

## Persona × JTBD coverage

Every primitive must serve at least one persona × JTBD cell. Empty cells mean that persona doesn't use that primitive, and it's intentional.

**Note on JTBD status.** DS-48/49/50/51 are now **Active** in `docs/design/jtbd/domains/drills-and-study.md` (LSW-J1 shipped 2026-04-22). CO-51 remains `(proposed)` and is not in LSW-J1 scope — Coach-persona coverage via CO-51 is aspirational until CO-51 promotes.

First-principles-learner situational persona shipped at `docs/design/personas/situational/first-principles-learner.md` (LSW-J2, 2026-04-22) and is the primary paradigm-sensitive persona for this surface.

| Primitive | Scholar / Apprentice / First-principles-learner | Chris (live-player) | Coach | Rounder / Hybrid |
|-----------|-------------------------------------------------|---------------------|-------|------------------|
| P1 (villain decomposition) | DS-48 primary (active) | SR-88 (similar-spot recall) | CO-51 (proposed) | DS-44 (why the correct answer) |
| P2 (weighted-total) | DS-49 primary (active) | DS-44 | CO-51 (proposed) | DS-44 |
| P3 (hero view) | DS-44 (anchor to student's hand) | MH-03 (match to my hand) | CO-51 (proposed) | DS-43 (quick drill) |
| P4 (action recommendation) | DS-43 | — | CO-51 (proposed) | DS-43 |
| P5 (street narrowing) | DS-48 sub-outcome (active) | SR-88 | CO-51 (proposed) | DS-44 |
| P6 (confidence) | DS-44 (honest uncertainty) | — | CO-51 (proposed) | — |
| P7 (per-villain MW) | DS-48 + MH-06 (active) | — | CO-51 (proposed) | MH-06 |

**Coverage gaps revealed:**
- **Newcomer persona** is not served by any primitive directly — the vocabulary (bucket labels, equity-vs-range, weighted-total) assumes prior exposure. This is a known limitation; bucket-label glossary (G4-impl P3) partially addresses it but Newcomer is not the v2 target.
- **Coach** is served across every primitive via CO-51 — validates the v2 structure for the teaching use case.
- **DS-50 (line-study walkthrough)** and **DS-51 (range-shape recognition)** are served by the line-walkthrough shell (`LineWalkthrough` + `LineNodeRenderer`), not this panel. No cell.

---

## v1 ship scope

What the first implementation commit ships. Later work widens.

**Ships:**
- V1, V2, V3, V4, V5, V6 variants (HU, axes 1–2–3-single-combo–5).
- Primitives P1, P2, P3(single-combo), P4, P5, P6.
- Schema extensions: `heroView`, `villainRangeContext.baseRangeId`, `narrowingRule` (with enum).
- `computeBucketEVs` v2 contract — additive.
- Migration: JT6 flop_root converted from v1 shape to v2 shape in the same commit (single-line migration for one node) as the canonical proof.
- Confidence display (E1 roundtable finding).
- Bucket-label glossary primitive (P6 sub-block).

**Does not ship in v1:**
- V7, V8 — spec is there, content authoring deferred.
- V9 — MW blocked on LSW-G6.
- V10 — range-level teaching; deferred to v1.1.
- P7 (multi-villain decomp) — stub exists; no fill.
- P8 (mixed strategy) — stub only.
- Archetype-weighted weightPct (axis 7 extension).
- Depth-2 sub-tree rendering (axis 8 extension).

---

## Extension seams

Specifically what v1.1+ work adds without touching v1 code.

**Adding a new villain action kind** (axis 1): add the string to `VILLAIN_ACTION_KINDS` enum; extend `narrowingRule` if a new narrowing pattern applies; no panel changes needed.

**Adding archetype-weighted weightPct** (axis 7): add optional `archetype` param to `P1.VillainRangeDecomposition`; engine already knows how to reweight; panel passes through. ~30 lines of change.

**Adding MW support** (axis 4): fill in `P7.PerVillainDecomposition`; `computeBucketEVs` returns `perVillainDecompositions` array; panel swaps P1 for P7 when `villains.length > 1`. LSW-G6 scope.

**Adding range-level hero view** (axis 3, V10): fill in `P3` range-level mode; `computeBucketEVs` computes per-bucket expected actions vs per-action expected EV; rest of panel unchanged.

**Adding mixed strategy** (axis 8): set `decisionStrategy: 'mixed'` in the line; engine returns `isMixedComponent: true` rows in `actionEVs`; P2 highlights the strategy mix; P8 renders the frequency.

**Adding tendency-profile-driven villain ranges** (axis 6): `VillainSpec.tendencyProfile` optional field; engine prefers tendency over `baseRange` when present; panel unchanged.

These seams are the spec's correctness check: if any future axis-change requires rewriting a primitive, the spec failed and needs a roundtable.

---

## Migration path (non-big-bang)

**Revised post-review.** Original 4-commit plan understated engine work. Revised to 6 commits:

**Commit 1 — Primitive extraction (non-breaking).**
- Extract current `PinnedComboRow`, `BucketEVTable`, `DominationMapDisclosure` into `panels/` as exported-but-unchanged components.
- No behavior change. v1 panel continues to render exactly as before.
- Tests: behavioral tests continue to pass unchanged (no snapshot tests exist; "parity" means behavioral parity, not snapshot parity).

**Commit 2 — Engine v2 (new `computeBucketEVsV2` + new `computeDecomposedActionEVs`).**
- Add `computeBucketEVsV2` in `src/utils/postflopDrillContent/drillModeEngine.js`. v1's `computeBucketEVs` (currently in `BucketEVPanel.jsx`) stays put, unchanged. Parallel functions, no shared shape.
- Add `computeDecomposedActionEVs(villainRange, heroHand, groups, foldCurves, pot, bet)` — the net-new per-group EV join P2 requires.
- New test files: `__tests__/computeBucketEVsV2.test.js`, `__tests__/computeDecomposedActionEVs.test.js`. Existing engine tests untouched.
- Coverage target: every output field in `ComputeBucketEVsV2Output` asserted non-undefined in at least one test case.

**Commit 2.5 — `villainRanges.js` alias map + schema v3 validator.**
- Author `src/utils/postflopDrillContent/villainRanges.js` as alias layer over `archetypeRanges.js`. Seed with at least the JT6 line's range aliases.
- `lineSchema.js`: bump `SCHEMA_VERSION` 2 → 3; add `validateHeroView`; add migration guard rejecting simultaneous `heroHolding` + `heroView` presence; add `validateVillainRangeContext`; add `validateNarrowingSpec`.
- New tests: `__tests__/lineSchema.v3.test.js` + `__tests__/villainRanges.test.js`.
- Preconditions: JT6's `baseRangeId` alias exists + resolves; schema accepts v3 shape + rejects dual-authored nodes.

**Commit 3 — JT6 flop_root migration + `BucketEVPanelV2` ship.**
- Convert JT6 flop_root's `heroHolding` → `heroView` in `lines.js`. (The `heroHolding` field is removed from this one node — not kept alongside.)
- Author `BucketEVPanelV2.jsx` composing primitives per the spec.
- Author `panels/VillainRangeDecomposition.jsx`, `panels/WeightedTotalTable.jsx`, `panels/HeroViewBlock.jsx`, `panels/ActionRecommendationStrip.jsx`, `panels/StreetNarrowingContext.jsx`, `panels/ConfidenceDisclosure.jsx`, `panels/GlossaryBlock.jsx` per the primitives section.
- Author shared `<BucketLabel labelId={...} />` component used by P1 + P2 + P6b for consistent label rendering (`displayName` lookup), inline tap-for-definition, and ≥44 DOM-px tap-area enforcement (Gate-4 F01/F14).
- `BUCKET_TAXONOMY` entries in `bucketTaxonomy.js` gain required `definition: string` field — 1-sentence plain-language glossary text per entry.
- Author `panels/variantRecipes.js` — the `VARIANT_RECIPES` constant mapping variant IDs to ordered primitive arrays. `BucketEVPanelV2` reads from this, does not inline the ordering.
- `LineNodeRenderer.jsx` branches on `heroView` presence: v3 node → `BucketEVPanelV2`, v1 node → `BucketEVPanel` (legacy).
- Tests: `BucketEVPanelV2.test.jsx` (behavioral — P1 rows render, P2 arithmetic present, P5 present on non-root, P3 interface does not accept EV prop); `variantRecipes.test.js` (V1-V6 recipes valid).

**Commit 4 — Remaining HU lines migrated via LSW-B1.**
- LSW-B1 ships 4 HU flop roots' `heroView` per the H3 feasibility checklist. Each migrated node removes its `heroHolding` entry (dual-authoring still rejected by validator).
- Each migrated node renders through v2.
- `LSW-B2` turn + `LSW-B3` river nodes migrate as their audits ship, including V5 bluff-catch + V6 thin-value variants.

**Commit 5 — v1 deletion.**
- Mechanical grep-based deletion: delete anything reading `heroHolding` on a node or `byBucket` from an engine call. Specifically: remove `validateHeroHolding` from `lineSchema.js`; remove `computeBucketEVs` (v1) from `BucketEVPanel.jsx`; delete `BucketEVPanel.jsx` + `PinnedComboRow`, `BucketEVTable` sub-components; update `LineNodeRenderer.jsx` to drop the v1 branch.
- Completion criterion is mechanical: `grep -r "heroHolding\|byBucket\|PinnedComboRow\|BucketEVTable" src/` returns empty (except for the migration-guard reject path in schema history).
- Single PR, ~400 LOC removed net.

MW nodes (J85, Q53) wait on LSW-G6 but the panel already handles them via the P7 slot; G6 fills the engine side.

**Dual-path window.** Between Commit 3 and Commit 5, both v1 and v2 panels exist in the codebase. `LineNodeRenderer` branches on `heroView` presence, so no node renders both. The dual maintenance is bounded — no shared state, no shared hooks, just two parallel render paths. Commit 5's mechanical criterion makes "close the window" unambiguous.

---

## Open questions for Gate 4 heuristic audit

Post-review, Q3 + Q4 are resolved in-spec; Q5 absorbed into the decisionKind rendering. Remaining open questions for the Gate-4 heuristic audit:

**Q1.** Should P1 render bucket-label definitions inline (hover/tap) or link out to a glossary page? (Affects H-N10 — help/documentation.)

**Q2.** When hero has multiple candidate combos in a `combo-set` view, does P1 show a single averaged equity per bucket, or show equity-spread (min/max) to highlight combo-sensitivity? (Affects pedagogy — is "combo-sensitivity is real" a primary teaching payload?)

**~~Q3 RESOLVED.~~** P5 shows a 2-line summary of the most recent narrowing step by default; full ordered history expands via "show full history" tap. `streetNarrowing` output is the ordered array, not single-step.

**~~Q4 RESOLVED.~~** Above-fold layout at 1600×720: P5 docks above P1 (max 2 lines, ~60px); P1 visible-row cap 6; P2 visible-column cap 5; below P2 comes P4 (1 line) + P3 (1-2 lines) + P6 (1 line). Total above-fold ~440-470px on a 480px budget. Overflow beyond caps goes into "show all" taps, not scroll.

**~~Q5 RESOLVED.~~** P4's phrasing is driven by `decisionKind`. For `thin-value` with check-back correct, P4 says "Correct: check back — villain's calling range beats you 3.4× more than it pays." For `bluff-catch`, P4 uses the value/bluff-ratio phrasing. Authored `recommendation.authoredReason` overrides the templated variant when present.

**~~Q1 RESOLVED by Gate-4 F01.~~** Bucket-label glossary is now a first-class primitive (P6b) with inline tap-for-definition on every label. Not deferred to Gate-4; shipped in Commit 3.

**Q6.** For V10 (range-level teaching, v1.1), what's the action-output shape? Per-bucket expected action ("topPairGood → bet 75% 90%, check 10%") vs per-action expected EV across the range? The spec defers the call.

**Q7 (new).** What happens to the "Reveal bucket EVs vs [archetype]" button in v2? Options: (a) remove the gate — primitives visible on node enter, matching I-DM-1's "cannot be hidden" spirit (student sees villain decomposition first); (b) keep but rename to "Expand detailed decomposition" framed as progressive disclosure of detail, not concealment of answer; (c) remove on root nodes, keep on non-root to manage cognitive load. Recommend (a) for v1 ship — I-DM-1 compliance is the point of the restructure. Flag for Gate-4 audit to confirm.

**Q8 (new).** Do `P4.authoredReason` and `P4.templatedReason` ship with the same fallback behavior, or does authored always win? Spec leans "authored wins when present" but a dev-mode log warns if both exist (suggests authoring drift).

---

## Risks + unknowns

- **R1. MC variance at trials=500 may still be too noisy for confidence display.** Default trial count raised from 250 to 500 post-review for CI consistency with the 800-trial pinned path. If the ±Y% is still noisy for narrow-weight groups (<5%), raise selectively or route small groups to exact enumeration.
- **R2. `villainRanges.js` alias map will grow with lines.** Every new authored line adds aliases. Not a redesign risk — additive by design — but tracking aliases vs canonical `archetypeRanges.js` entries is a hygiene concern (unused aliases orphaning).
- **~~R3 CLOSED.~~** `narrowingSpec` composable descriptor replaces the enum. New handlers are additive to the map.
- **R4. Coach persona is served across every primitive, but we have zero confirmed Coach users today.** The pedagogy weighting is based on the persona file + first-principles doctrine. CO-51 (assign drills from library) JTBD is in *proposed* status, not active — so the Coach × every-primitive claim in the coverage table is aspirational. Gate-4 audit should note this.
- **R5. v1-simplified-ev caveat is still present post-v2.** Bucket-row EVs use coarse priors; LSW-D1 (depth-2 injection) is the resolution. v2 makes the caveat more visible via P6 but doesn't fix the underlying math.
- **R6 (new). `computeDecomposedActionEVs` is a net-new function with no prior implementation.** Senior-engineer review flagged that the original "additive" claim was false. Commit 2 scope now explicitly includes building this function. Risk: building the per-group EV join reveals unexpected interactions with `foldCurves` calibration.
- **R7 (new). Archetype toolbar inconsistency mitigation is copy, not computation.** Axis 7 (archetype-weighted `weightPct`) is deferred to v1.1. The v1 mitigation — inline column-header note "(base range — unaffected by archetype)" — relies on students reading the annotation. Product-UX review flagged this as the best available mitigation short of shipping axis 7; accept as known ship-ready state.
- **R8 (new). Proposed-status JTBDs in the coverage table.** DS-48, DS-49, DS-50, DS-51 are *proposed* (ship as part of LSW-J1). CO-51 is *proposed* and not in LSW-J1 scope. Coverage table cells referencing these should be marked "(proposed)" and the v2 ship should not claim to *serve* these JTBDs until they're active in `drills-and-study.md`.
- **R9 (new). Reveal-button removal (Q7 recommendation a) changes first-interaction semantics.** v1 students click Reveal to see bucket EVs; v2 students see them on node-entry. First-visit mental model shifts: the student can't "scan first, compute later." Consider a one-time onboarding tooltip for users who previously clicked Reveal. Light-risk; mention in Gate-4 copy review.

---

## Decision-modeling doctrine cross-check

Final pass — every primitive verified against I-DM-1, I-DM-2, I-DM-3.

| Primitive | I-DM-1 (villain primary) | I-DM-2 (arithmetic visible) | I-DM-3 (hero is context) |
|-----------|--------------------------|-----------------------------|--------------------------|
| P1 | ✅ always above hero view | — | — |
| P2 | — | ✅ per-group contribution visible | — |
| P3 | ✅ rendered below P1 | — | ✅ header role, not answer |
| P4 | — | — | ✅ summary, not driver |
| P5 | ✅ range-first narrative | — | — |
| P6 | — | ✅ honesty about uncertainty | — |
| P7 | ✅ per-villain visibility | — | — |
| P8 | — | ✅ mixed-strategy arithmetic | — |

All three invariants satisfied across the composition.

---

## Change log

- 2026-04-22 — Draft authored. Covers axes 1–5 in v1 ship scope per owner directive on bluff-catch + thin-value; axes 6–8 as extension seams. Launched 3 parallel specialist reviews (systems-architect / product-ux-engineer / senior-engineer).
- 2026-04-22 — **Gate-4 heuristic audit shipped** at `docs/design/audits/2026-04-22-heuristic-bucket-ev-panel-v2.md`. Verdict YELLOW. 4 P1 findings resolved in-spec this revision:
  - **F01 glossary:** new P6b primitive (`GlossaryBlock`) added; inline bucket-label tap-for-definition with ≥44 DOM-px tap area enforced; `displayName` required rendering rule (H-N02).
  - **F02 responsive:** P1 row cap + P2 column cap degrade cleanly across ≥1200/≥900/≥640 viewport thresholds. P5 collapses to 1 line at <1200.
  - **F03 error state:** `errorState` discriminant added to `ComputeBucketEVsV2Output`; P1 renders banner on error.
  - **F04 disclosure consistency:** P1 row overflow + P2 column overflow both use "Show all N" pattern; dropped inconsistent "Other (+N)" as standalone pattern.
  - 8 P2 findings (F05-F12) tracked in audit's open-questions and spec's risks/open-questions sections; do not block Commit 1.
  - 3 P3 findings (F13-F14) either subsumed by F01 (F14) or deferred to Gate-4 v2 pass (F13).
- 2026-04-22 — **Gate-3 J1 + J2 shipped.** DS-48/49/50/51 JTBDs added to atlas (LSW-J1); first-principles-learner situational persona shipped (LSW-J2). JTBD coverage table updated — (proposed) tags removed from DS-48/49/50/51; CO-51 remains proposed.
- 2026-04-22 — Reviews returned, all YELLOW. Revised spec in-place to address P0/P1 findings:
  - **P0 (systems-architect + senior-engineer):** data contract — dropped "additive" claim; introduced `computeBucketEVsV2` as separate new export alongside unchanged v1; `computeDecomposedActionEVs` explicitly named as net-new computation for P2's `perGroupContribution`.
  - **P0 (senior-engineer):** Commit-5 trigger made mechanical (grep `heroHolding|byBucket|PinnedComboRow|BucketEVTable` returns empty); migration guard rejects dual-authored `heroHolding + heroView`.
  - **P1 (systems-architect + senior-engineer):** `narrowingRule` enum → `narrowingSpec` composable descriptor with handler-map dispatch.
  - **P1 (systems-architect + senior-engineer):** `villainRanges.js` redefined as alias layer over `archetypeRanges.js`, not parallel store. Commit 2.5 explicitly added to seed JT6 aliases.
  - **P1 (product-ux):** Q4 resolved in-spec — P5 docks above P1 with 2-line summary cap; P1 visible-row cap 6; P2 visible-column cap 5. Total above-fold fits in 440-470px on 480px budget.
  - **P1 (product-ux):** V5 bluff-catch + V6 thin-value pedagogy moved from P4 summary string to P1 polar-split rendering mode triggered by `decisionKind`. Output adds `valueBeatRatio` field.
  - **P1 (product-ux):** Archetype toolbar inconsistency mitigated with inline column-header note `(base range — unaffected by archetype)` pending axis-7 ship.
  - **P1 (product-ux):** `streetNarrowing` output shape changed from single-step object to ordered array of narrowing events (axis-5 full-history rendering).
  - **P2 (systems-architect):** I-DM-1/2/3 encoded structurally — `VARIANT_RECIPES` ordered constant; P2 dev-assert on empty `perGroupContribution`; P3 interface physically excludes EV props.
  - **P2 (systems-architect):** `SCHEMA_VERSION` bumped 2 → 3. `StudyActionEntry` type defined for drill-layer isolation (NOT reused from live-game `ActionEntry`).
  - **P2 (systems-architect):** Trial count unified — default 500 (up from 250) for CI consistency with pinned-combo 800 path.
  - **P2 (systems-architect + senior-engineer):** `recommendation.oneLineReason` split into `authoredReason` (optional) + `templatedReason` (optional); renderer prefers authored; dev logs when both present.
  - **P2 (senior-engineer):** 4-commit migration path expanded to 6 commits (added Commit 2.5 for villainRanges + validator; split Commit 3 to include `variantRecipes.js` registry).
  - **P2 (product-ux + senior-engineer):** Path-decision note added to preamble explicitly recording owner chose Path 2 over roundtable's default Path 1.
  - **P2 (product-ux):** Proposed-status JTBDs marked in coverage table; R8 added to risks.
  - **P2 (senior-engineer):** Reveal-button fate elevated to Q7; recommended removal for I-DM-1 compliance, to be confirmed at Gate-4.
  - Q3 + Q4 + Q5 resolved in-spec; Q7 + Q8 added.
  - R3 closed (narrowingSpec replaces enum); R6, R7, R8, R9 added.
- Next: commit revised spec + reviews summary; proceed to Gate-4 heuristic audit + Gate-3 JTBD/persona work (LSW-J1, LSW-J2) before Commit 1 implementation.
