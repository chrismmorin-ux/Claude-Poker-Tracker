# Blind-Spot Roundtable — 2026-04-22 — BucketEVPanel villain-first paradigm (LSW-G4)

**Type:** Gate-2 governance roundtable — paradigm-level restructure decision before widening.
**Trigger:** Surface audit S5 (`docs/design/audits/line-audits/btn-vs-bb-3bp-ip-wet-t96-surface.md`) — "panel abstracts hero-first when the decision driver is villain's range." Owner requested Gate-2 roundtable per `docs/design/ROUNDTABLES.md` before either (a) restructuring the panel or (b) documenting the decision not to restructure.
**Participants (internal roles):** product-ux-engineer (Stages A/B/C/E), systems-architect + senior-engineer (Stage D), general-purpose market-lens synthesis (cross-stage).
**Artifacts read:** `docs/design/surfaces/postflop-drills.md`, `docs/design/jtbd/domains/drills-and-study.md`, core personas (scholar-drills-only, apprentice-student, coach, chris-live-player, rounder, hybrid-semi-pro, newcomer), situational personas (study-block, coach-review-session), `docs/design/audits/line-audits/btn-vs-bb-3bp-ip-wet-t96-surface.md` (post-G5/G5.1/G5.2 state), `src/components/views/PostflopDrillsView/BucketEVPanel.jsx`, `src/utils/postflopDrillContent/drillModeEngine.js`.
**Status:** OPEN — draft for owner decision.

---

## Feature summary

Subject is `BucketEVPanel` as it exists **today, post-LSW-H1/H2/G3/G5/G5.1/G5.2**. The surface currently renders (collapsed behind a single "Reveal bucket EVs vs [archetype]" button) a three-part stack when a decision node declares `heroHolding`:

1. **Pinned-combo row** (amber typography, primary). Shows the student's specific holding (e.g., `J♥T♠`), equity (MC 800 trials vs villain's base range), best action + EV, runner-up action + EV. First-person framing — "you hold X, you make Y bb."
2. **Demoted bucket table** (80% opacity, secondary). Shows bucket-class rows ("topPair", etc.) for other combos in hero's range that fall into the same bucket. Header reads "Bucket (other combos in your range)." Divider label "RANGE-LEVEL VIEW" separates this from the pinned row.
3. **Domination map disclosure** (tertiary, collapsed by default). When expanded, shows 12–28 villain-range sub-groups (post-G5.1 split: `Overcards (Ax)` / `Overpair` / `Set/Trips` / `Two Pair` / `topPairGood` / `topPairWeak` / `Gutshot` / `OESD` / `Combo Draw` / `Non-nut Flush Draw` / `Nut Flush Draw` / `midLowPair` / `pairPlusFD` (G5.2 composite) / etc.). Per row: relation badge (crushed/dominated/neutral/favored/dominating), weight % of villain range, hero equity %.

**The paradigm question (S5):** The primary teaching payload is first-person ("your hand, your EV"). First-principles doctrine (`feedback_first_principles_decisions.md`) names villain-range-first decomposition as the correct decision-modeling pattern. Does the three-part stack above satisfy villain-first doctrine (because the domination map exists and per-combo EV already integrates villain's range), or does it still violate the doctrine because villain decomposition is tertiary-positioned and collapsed by default?

A secondary question: **if we restructure before widening**, churn is small (one surface, not yet live on 7 other lines). **If we widen first and restructure later**, churn is 7×.

---

## Stage A — Persona sufficiency

**Output: ⚠️ PATCH NEEDED**

### A1 — "Advanced study" persona not distinguished from "teaching / coaching use"

`postflop-drills.md` maps Scholar + Apprentice + Rounder + Hybrid Semi-Pro + Coach to the surface. But the villain-first paradigm matters differently to each:

- **Scholar / Apprentice (learners):** they are *learning* the first-principles decision model. The panel's job is habit-formation — what the student sees first is what they internalize as "how to think about decisions." Hero-first primary row trains hero-first cognition. This is the single most paradigm-sensitive group.
- **Coach / Chris-live-player / Rounder (already-competent users):** they *know* the decision model. They use the panel to verify numbers + spot-check combo-level deltas. Hero-first primary row is fine because they already bring villain-range-first thinking to the screen.
- **Apprentice-student specifically:** the persona file flags dependency on explicit reasoning (`JTBD-DS-44`). For an apprentice, the villain-range layer is not optional — it's the missing piece they're here to learn.

**Gap:** we don't have a persona that captures "the student who comes here specifically to learn first-principles exploit-poker decision modeling." Apprentice is close but generic. The missing distinction: a learner who is past the mechanics of poker and is specifically studying the range-vs-range abstraction — the kind of student who reads Clements's *Play Optimal Poker* and then wants to build muscle memory via drills.

**Recommendation:** either (a) add a sub-situational persona `first-principles-learner.md` under `personas/situational/` that sharpens Apprentice for this use case, or (b) accept that Apprentice covers it and document the expanded scope in the persona file. Gate 3 would author either.

### A2 — "Passive verification" use mode not modeled

The current panel post-G5.2 is useful in two distinct modes that share a surface:

- **Study mode** — user is actively learning; domination map should be expanded; weighted totals should be visible.
- **Verification mode** — user has a hypothesis ("JT on T96 should bet 150% here"), just wants the number. Domination map is noise.

Today the panel flattens both into one disclosed/collapsed state. No persona distinguishes them. Study-block is close but doesn't specify this split.

**Recommendation:** treat as a design-brief input, not a persona gap. Feed into Stage E heuristic findings.

### A3 — Coach use pattern would invert the structure

A Coach walking an Apprentice through JT6 flop_root would almost certainly start with "look at BB's range when they donk — here's what hands are in it" before ever saying "your hand is JT." That's villain-first by pedagogical necessity. The current panel forces the Coach to: (1) ignore the pinned row, (2) scroll down and expand the domination disclosure, (3) teach from there, (4) maybe reference the pinned row at the end. This is workflow-friction evidence that the structure is mis-ordered for at least the Coach persona.

**Recommendation:** weigh as structural evidence for Stage E and the verdict, not a persona add.

---

## Stage B — JTBD coverage

**Output: ⚠️ EXPANSION NEEDED**

### B1 — No JTBD for "understand villain's range composition as the driver of my decision"

`drills-and-study.md` currently lists:
- DS-43 (10-minute quick drill)
- DS-44 (correct-answer reasoning) — Active, the closest match
- DS-45 (custom drill from history) — Proposed
- DS-46 (spaced repetition) — Proposed
- DS-47 (skill map) — Proposed

DS-44 says "I want to see *why* the correct answer is correct, so I learn." But **"why" in first-principles terms is villain-range decomposition.** The JTBD doesn't name that — it's neutral on whether the "why" is hero-first or villain-first. That neutrality is part of why the panel drifted hero-first: no JTBD forces the other framing.

**Recommendation (Gate 3):** add **DS-48 — "Understand villain's range composition as the decision driver"** to `drills-and-study.md`. One-line statement: *"When studying a specific decision, I want to see villain's range decomposed by hand-type groups with per-group weight + my equity vs each, so my decision reasoning is range-vs-range not hand-vs-hand."* This JTBD would be the explicit success criterion the panel's structure should serve.

### B2 — No JTBD for "see weighted-total per action"

Per first-principles doctrine, the decision answer is `Σ(villain-bucket weight × per-bucket EV)` — a single weighted sum per candidate action. The current panel shows *per-bucket equity* in the domination map, but **not** the per-bucket EV × weight breakdown, and **not** the weighted-total row that sums across buckets per action. The pinned-combo row gives the weighted total (implicitly, because MC equity already integrates vs the full range), but it doesn't show the weighting arithmetic — so the student sees a number, not the reasoning that produced it.

**Recommendation (Gate 3):** add **DS-49 — "See weighted-total EV decomposition for a decision"** — the arithmetic-traceability outcome. This JTBD is distinct from DS-48 (range-composition understanding) because you can show villain decomposition without ever rendering the weighted sum; current panel is proof.

### B3 — MH-06 (multiway range-vs-ranges) served but not for study-surface decision modeling

`MH-06` is named in `postflop-drills.md` as covered by the Explorer + Line multiway modes. But it's a breakdown-view JTBD, not a decision-modeling JTBD. MW lines in Line Study (J85, Q53) will — once LSW-G6 lands the MW bucket-EV engine — also need the villain-first framing per-villain. `MH-06` doesn't quite land that; it's about *visualizing* the MW ranges, not *deciding* against them.

**Recommendation:** flag as a note to LSW-G6 design brief. Not a JTBD add — existing MH-06 + new DS-48/DS-49 cover the requirement between them.

### B4 — JTBD-to-surface traceability is incomplete in surface artifact

`postflop-drills.md` lists implicit JTBDs ("line-study JTBD, implicit" / "range-shape recognition, implicit"). The "implicit" marker is a framework smell — the surface document names outcomes that no JTBD entry formalizes. **Fix:** promote both to explicit JTBDs in `drills-and-study.md` during Gate 3. Natural IDs: DS-50 (line-study walkthrough) and DS-51 (range-shape recognition). These already exist in user workflows; they're just not in the atlas.

---

## Stage C — Situational stress test

**Output: ⚠️ ADJUST (no fundamental mismatch, two targeted issues)**

### C1 — Study-block at 20-min budget: the domination map is buried

Per `personas/situational/study-block.md`, a typical study session is 20 minutes on a laptop with calm attention. Today the student:

1. Picks a line (~20 sec).
2. Walks to a decision node (~30 sec).
3. Reads prose + why + adjust (~60 sec).
4. Clicks "Reveal bucket EVs" → pinned row + bucket table render immediately.
5. Must *notice* the "Domination vs villain's range · N groups" disclosure below the bucket table, recognize it's a different category of information, click it open.
6. Only now sees the villain-range decomposition.

Steps 5–6 are invisible work for a student who doesn't know the domination map exists. A student learning the first-principles decision model — the exact student for whom this data is most valuable — is the most likely to miss step 5 because they don't yet know that's the teaching payload they need. **This is the Situation-C version of S5.**

**Recommendation:** when `pinnedCombo` is present, **expand the domination map by default.** Collapsing it to reduce clutter is a v1 default optimized for "panel fits on viewport" — the teaching payload is worth the scroll cost. Test at 1600×720 to confirm the full stack fits or scrolls cleanly.

### C2 — Coach-review-session: the primary row misdirects pedagogy

A Coach walking an Apprentice through JT6 flop_root wants to say: "First, let's look at BB's range when they donk — overcards like AK/AQs are the biggest chunk, 45%. Overpairs are 29%. Now, here's where your JT sits against each of those." That's a **villain-first teaching sequence.** Today the Coach has to scroll the Apprentice past the pinned-combo "+17.99bb" number first, which invites "so we bet 150%, next question" rather than the deeper pedagogy.

**Recommendation:** besides expand-by-default (C1), consider adding a **single weighted-total row** directly under the domination map — `"Bet 150%: 45.2% × 8.2bb + 28.8% × 4.1bb + ... = 17.99bb"` showing the arithmetic the pinned-row number hides. Even if the structure stays hero-first-primary, the arithmetic traceability row teaches villain-first decomposition by demonstration.

### C3 — Newcomer / first-principles learner: the panel works once the vocabulary is earned

A first-contact student hitting the panel without reading POKER_THEORY.md first sees `topPairGood`, `topPairWeak`, `pairPlusFD`, `nonNutFlushDraw`, `Overcards (Ax)` — 12+ specialist labels with no glossary. The pedagogy assumes the vocabulary has been pre-learned elsewhere. **Not a structural defect of the paradigm question; flag here for Gate 4 to consider glossary / tooltip enhancements.**

### C4 — Mid-hand / live play: not applicable

BucketEVPanel is a study-surface, not a live-table surface. Mid-hand-chris / push-fold-short-stack / bubble-decision situational personas are out of scope for this roundtable. Live-surface cousins (sidebar `LiveAdviceBar`, main-app `LiveAdviceBar`, `HandPlan`) are a separate paradigm question tracked under Stage D.

---

## Stage D — Cross-product / cross-surface

**Output: ⚠️ PARTNER SURFACES NEED AWARENESS**

### D1 — Sidebar `LiveAdviceBar` is hero-first too

`ignition-poker-tracker/` sidebar renders live advice via `LiveAdviceBar` (per SYSTEM_MODEL §4.1 post-STP-1). That surface is **live-game**, not study. Hero-first is defensible there: time is short, the hero's hand is the only thing the student controls. But: if LSW-G4 resolves "restructure BucketEVPanel to villain-first," there is a conceptual-consistency question across the two surfaces. Do we want live-advice to stay hero-first while study flips villain-first? Arguably yes — different situations, different primary framings — but this should be a deliberate decision, not an accidental split.

**Recommendation:** document the live-vs-study split as an intentional divergence if LSW-G4 restructures. If not, no action.

### D2 — RangeFlopBreakdown (Explorer mode) is range-first already

`RangeFlopBreakdown.jsx` in the Explorer tab shows hero's range decomposed by bucket on a flop, without a pinned hero combo. It is range-first by default. It **doesn't** show villain's range — that's the gap Explorer doesn't fill. So RangeFlopBreakdown is hero-range-first, BucketEVPanel is hero-combo-first (with villain-range disclosure), and neither surface is villain-range-first as the primary framing. The ecosystem's blind spot is consistent: villain-range-first primary framing doesn't exist anywhere in the product today.

**Recommendation:** weigh as structural evidence in the verdict. If G4 restructures BucketEVPanel, consider whether Explorer's RangeFlopBreakdown should gain a sibling "villain range" breakdown mode — but defer that to its own G-ticket.

### D3 — LSW-G6 (MW bucket-EV engine) design gets influenced by G4 outcome

LSW-G6 (opened by H3) will extend `computeBucketEVs` to accept `villains: [{range, position}]` and compute per-villain equity. **If G4 restructures villain-first**, G6's output shape changes: it now needs to decompose each villain's range independently and render two (or N) villain-specific domination maps, not a collapsed per-combo equity. **If G4 keeps hero-first**, G6 renders multi-villain cascading fold probability feeding the pinned-combo EV, and the domination map shows a combined or per-villain view as a design-call.

**Recommendation:** hold G6 implementation until G4 resolves. Current G6 BLOCKED status covers this implicitly; surface the G4-dependency explicitly in G6's description during closeout.

### D4 — HandReplayView has `HeroCoachingCard` + sidebar `HandPlan` that could consume villain-decomposition

If we produce a reusable "villain-range domination map" primitive, it could be consumed by HandReplayView's HeroCoachingCard (currently hero-first) and the sidebar's HandPlan (currently hero-first). Structural reuse argument.

**Recommendation:** not a G4 blocker, but if G4 restructures, carve `DominationMapDisclosure` into a shareable primitive under `src/components/ui/` so the other two surfaces can adopt without re-implementing.

---

## Stage E — Heuristic pre-check

**Output: ⚠️ SPECIFIC ADJUSTMENTS NEEDED**

Walked against Nielsen 10, Poker-Live-Table, and Mobile-Landscape sets. The panel is a study surface so PLT heuristics (PLT01..PLT07) are mostly not triggered; ML04 (scale interaction) + ML06 (touch targets) are.

### E1 — H-N01 (system status visibility): **⚠️**
Students can see the archetype (Reg/Fish/Pro) selected — good. But they cannot see *which trials count* the MC equity used (800 vs 250 vs exact enumeration), nor the confidence interval on each row's equity. A student seeing "22% DOMINATED" doesn't know if it's ±2% or ±5%. **Recommendation (Gate 4):** add a confidence-band disclosure — "equity 22% ±3% (250 trials)" or similar — at least on hover/tap. Even if the paradigm doesn't restructure, the accuracy-honesty cost of hiding MC variance is real.

### E2 — H-N05 (error prevention) + H-PLT03 (exploit pedagogy): **⚠️**
The bucket-table's demoted "other combos in your range" rows currently use the coarse `HERO_BUCKET_TYPICAL_EQUITY` table + a `v1-simplified-ev` caveat. When a student reads +17.99bb for their pinned J♥T♠ (real MC) sitting visually adjacent to +20.30bb for topPair aggregate (simplified), they see two numbers in the same table with different levels of accuracy, distinguished only by the subtle `v1-simplified-ev` flag in the caveats. **Risk:** student internalizes the simplified +20.30bb as "the EV of top-pair on this board" and generalizes wrong. **Recommendation (LSW-D1 dependency):** once depth-2 replaces the simplified table, the bucket-row EVs become trustworthy; but until then, the demoted-table rows should either (a) show a visible "simplified" marker per row, or (b) be hidden entirely when a pinned combo exists (since the pinned row already gives the accurate answer). This is a P2 finding orthogonal to G4's paradigm question.

### E3 — H-ML04 (scale interaction) — domination map expanded-by-default changes height: **⚠️**
If C1's recommendation (expand domination map by default) ships, the panel's total height on JT6 flop_root grows from ~300 px (collapsed) to ~580 px (expanded, 6 rows post-G5.1). At 1600×720 with a 120 px chrome budget, the walkthrough layout has ~480 px of vertical room for main content before the "advance" button. The expanded panel would force a scroll — not fatal, but a layout consideration. **Recommendation:** measure at 1600×720 post-expand; if scroll-below-fold, consider (a) making the weighted-total row sticky, or (b) capping visible rows at 6 with "show all N" disclosure for ranges with more groups.

### E4 — H-ML06 (touch targets): **✓**
Archetype buttons + reveal button + domination-disclosure toggle are all ≥44×44 at 1600×720 via Playwright spot-check. No regression expected.

### E5 — H-N10 (help / documentation): **⚠️**
12–28 bucket labels with no inline glossary (see C3). **Recommendation (Gate 4):** add tap-for-definition on each bucket label, sourcing from `BUCKET_TAXONOMY` comments or a new `BUCKET_GLOSSARY.md`. Independent of G4 resolution but elevated in priority if the panel becomes more prominent.

---

## Overall verdict

**YELLOW — paradigm restructure is a legitimate question, but the right answer is probably not a full restructure.**

The three-part stack post-G5.2 already contains villain-range decomposition. The defect is not that villain-first doesn't exist — it's that villain decomposition is **tertiary-positioned and collapsed by default**. A restructure would move it to primary position and collapse the hero-first view instead. This is a valid design, but it inverts the entry-context advantage: the student knows their hand and brings it to the panel; the pinned-combo row is the natural entry anchor. Forcing villain-first primary means the student has to mentally reconstruct "where does my hand sit in this decomposition" as the first cognitive step.

**The middle path (recommended for owner):** keep hero-first primary (pinned-combo row), but **(1) expand the domination map by default** when `pinnedCombo` is present, **(2) add a weighted-total arithmetic row** below the domination map that shows `Σ(weight × per-bucket EV) = total EV` as explicit reasoning, **(3) promote the `v1-simplified-ev` caveats per-row** in the demoted bucket table (E2), **(4) add persona gaps + JTBDs** (DS-48, DS-49) to formalize what the panel is teaching.

If the owner wants the full restructure (villain-first primary rows, hero combo as header): the design cost is a 1-session BucketEVPanel rewrite + G6 design revisit + D1 doc-divergence decision. That's not huge churn — but it happens *before* we author `heroHolding` on the 4 HU flop roots, or the 4× churn happens anyway.

---

## Required follow-ups (for owner decision)

Owner picks one of the three paths below. Each has a concrete ticket set.

### Path 1 — Middle path (recommended): keep hero-first, sharpen villain decomposition

- [ ] **Gate 3 — JTBDs:** add DS-48 + DS-49 to `drills-and-study.md`. Promote implicit line-study + range-shape JTBDs to DS-50 / DS-51.
- [ ] **Gate 3 — Persona:** either add `first-principles-learner.md` situational, or expand Apprentice scope; owner's call.
- [ ] **LSW-G4-impl P1:** expand domination map by default when `pinnedCombo` present. Add weighted-total arithmetic row. **M effort, 1 session.**
- [ ] **LSW-G4-impl P2 (orthogonal to paradigm):** per-row simplified-vs-accurate marker in demoted bucket table (E2). **S effort, 1 session or bundled.**
- [ ] **LSW-G4-impl P3:** inline bucket-label glossary (E5). **S effort.**
- [ ] **LSW-G4-impl P4:** MC-variance confidence display on domination-map equities (E1). **S effort.**
- [ ] Audit (`btn-vs-bb-3bp-ip-wet-t96-surface.md` S5) closes as "WAIVED-to-enhancement" with link to LSW-G4-impl batch.
- [ ] LSW-G6 MW engine unblocked; can proceed with hero-first primary in MW rendering.

### Path 2 — Full restructure: villain-first primary

- [ ] **LSW-G4-redesign spec:** draft `docs/design/surfaces/bucket-ev-panel-v2.md` with villain-range groups as primary rows, hero combo as header context only. Gate 4 heuristic audit of spec before code.
- [ ] **LSW-G4-impl-v2:** rewrite `BucketEVPanel.jsx` per spec. **L effort, 2–3 sessions.**
- [ ] LSW-G6 design-revisit: MW engine outputs per-villain range decomposition.
- [ ] Cross-surface doc entry: sidebar `LiveAdviceBar` stays hero-first (live), study surface flips villain-first (study). Intentional divergence documented in POKER_THEORY.md §9.
- [ ] Audit S5 closes as "RESOLVED-by-restructure."

### Path 3 — Accept current structure, document non-restructure

- [ ] Update `docs/design/audits/line-audits/btn-vs-bb-3bp-ip-wet-t96-surface.md` S5 finding to WAIVED with reasoning: "post-G5/G5.1/G5.2 the three-part stack delivers villain-range decomposition at the 'tertiary-but-exposed' position. The entry-context argument (hero brings their hand to the panel) outweighs the habit-formation argument (first-position trains thinking) for the target personas (Chris-live-player, Coach, Rounder, Hybrid Semi-Pro). Learner-persona gap addressed by Gate 3 glossary + tooltip work, not paradigm restructure."
- [ ] Still open: DS-48 / DS-49 JTBDs. Still open: MC confidence display (E1), simplified-EV per-row marker (E2), glossary (E5). Ship these as individual LSW-H4+ tickets.
- [ ] LSW-G6 unblocked; proceeds as currently scoped.

**Recommended default if owner doesn't respond promptly: Path 1.** It captures the most benefit with the least churn and preserves the option to go full-restructure later if learner feedback demands it.

---

## Sign-off

- **Drafted by:** Claude (main, session 2026-04-22)
- **Reviewed by:** owner — pending.
- **Status:** OPEN — closes when owner picks Path 1 / 2 / 3 and the associated follow-up tickets are opened.
- **Blocks:** LSW-B1 widening on 4 HU flop roots (if Path 2 — otherwise unblocked). LSW-G6 MW engine (if Path 2 — otherwise unblocked).

---

## Change log

- 2026-04-22 — Drafted. Five stages walked grounded in post-G5.2 surface state. Verdict YELLOW. Three paths presented for owner decision.
