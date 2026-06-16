# Blind-Spot Roundtable — 2026-06-15 — Drills Surface (Preflop + Postflop)

**Work item:** WS-229 (Gate 2 blind-spot roundtable for the drills surface)
**Program:** design
**Descends from:** WS-083 / `audits/2026-06-13-dcomp-w3-drills-audit.md` (DCOMP Wave 3 — the only open clause of which was "Gate 2 for drills, never run")
**Method:** `docs/design/ROUNDTABLES.md` — five stages, three independent voices (product-UX lead · external/market lens · architecture/pedagogy), synthesized.
**Gate:** 2 (Blind-Spot). Per `LIFECYCLE.md`, this is a pre-Gate-4 audit; findings route to Gate 3 (research/authoring) or to a parallel corrective track.

---

## Feature summary

The drills surface is two separately-routed views presenting **14 labeled tabs**:

- **PostflopDrillsView** (6 tabs): Line · Explorer · Estimate Drill · Framework Drill · Library · Lessons.
- **PreflopDrillsView** (8 tabs): Shape · Recipe Drill · Explorer · Estimate Drill · Framework Drill · Library · Lessons · Math.
- A third surface, **PresessionDrillView (PSD)**, exists in code but is feature-flagged off (`ENABLE_PRESESSION_DRILL = false`).

The 2026-06-13 audit confirmed all 14 tabs are functional with real content (no stubs remain — the "WIP tab fate" premise of WS-083 was moot). This roundtable therefore is **not** about unfinished tabs; it is the structural question the framework could never ask itself: **is the parallel-but-divergent 14-tab structure a coherent mental model for the drilling persona, or does it fragment the job?** The three voices answer, with independent evidence, that it fragments — and the fragmentation has specific, fixable sources.

---

## Stage A — Persona sufficiency

**Output: ❌ Structural gap**

Two voices independently reached ❌. The drills surface lists Scholar (primary), Apprentice, Newcomer (core) + Study-block / first-principles-learner / presession-preparer (situational) + Coach (homework). That cast is internally rich, but it omits archetypes the surface's own context makes directly relevant.

**A-1 — The category's dominant archetype is unmodeled (the "scored trainer-grinder").** *(market)* Every serious training product (GTO Wizard Trainer, DTO, Pokertrainer, scored PokerCoaching) is built around a high-volume, solver-scored, EV-loss-quantified loop. This app refuses that loop *by deliberate doctrine* (no streaks / mastery scores / scored-accuracy curves — the autonomy red lines). That is a legitimate strategic choice — **but it is invisible.** No persona names the player being declined, so every future drill ticket silently re-litigates a strategy decision nobody wrote down. The blind spot is the *omitted* persona.

**A-2 — Missing situational persona: the between-hands table-adjacent driller.** *(UX)* The app's core context is live play, yet no persona covers the user who, in 3–4 minutes between hands, pulls out their phone for one drill. Scholar is study-only; Study-block is off-table; presession-preparer is pre-session. This persona has hard constraints (≤30 s cold-entry-to-answer, one-handed, clean mid-drill exit) that **no modeled persona carries** — and Stage C shows every current tab fails them.

**A-3 — `returning-after-break` is claimed applicable but omitted from the surface and unserved.** *(UX)* The situational persona declares itself applicable to Scholar + Apprentice (both primary here), but `postflop-drills.md` omits it from Personas-Served entirely, and neither view has any gap-detection or welcome-back hook.

**A-4 — Coach presence is aspirational and asymmetric.** *(UX)* Coach appears in postflop personas (CO-51) but not preflop, with no surface commitment. Keep scoped to CO-51 tracking; not a current design constraint.

**A-5 — The data-driven "drill my own leaks" studier is stretched onto Apprentice.** *(market)* The modern category center is import-history → find-leak → drill-that-spot. The app is a *tracker* (it owns the user's real hands — the rarest asset in the study market) yet no persona claims hand-history-as-curriculum as a primary loop.

---

## Stage B — JTBD coverage

**Output: ⚠️ Expansion needed**

**B-1 — The "show me I'm improving, on evidence" outcome is orphaned by doctrine.** *(market + UX — highest-value, lowest-risk finding)* All three modeled personas literally request objective improvement-visibility: Scholar ("know they're improving objectively"), Apprentice ("track personal skill improvement objectively over time"), Newcomer ("simple progress markers"). The doctrine refuses the *gamified* form (DS-47 skill-map/mastery, streaks). But the **non-gamified** form of the outcome was never separately authored — the anti-gamification red line took the outcome down with the anti-pattern. The skill-state attribute shape (`level` / `confidence` / `trendDirection` / `lastValidatedAt`) is already modeled in the persona files; no JTBD says "let the user *see* that trend without a rank/score identity label." → **Author DS-68: evidence-based, non-gamified competence-trend visibility.** Distinct from DS-47 (gamified grid, refused) and DS-52 (decay maintenance).

**B-2 — Declarative spaced repetition (DS-46) is unserved on the surface whose whole job is charts.** *(market)* Anki-style SR on preflop charts is the defining feature of Pokertrainer and a baseline expectation. DS-46 is catalogued but ships nothing; DS-52 (Active) *explicitly excludes* declarative chart-SR (it is procedural-memory-targeted). Result: PreflopDrillsView ships zero spaced repetition. Decide serve-or-formally-decline.

**B-3 — Own-history drill (DS-45) unserved on both views.** *(market + architecture)* The "drill THIS spot I just played" loop is the category's modern center and the Scholar/Study-block primary need. Infrastructure gated behind WS-198 (hands ↔ node-ID cross-reference). See D-1 — this is the cross-surface half of the same gap.

**B-4 — Cross-tab continuity has no owning JTBD.** *(architecture)* The preflop artifact flags "a Math drill finding a leak doesn't seed an Explorer hand" as missing; the atlas has no JTBD for "the drill I just finished informs which scenario the next one opens on." `DRILL_VIEWS.md §2` (hook-hoisting rule) documents *why* it is structurally hard today: no shared state crosses tabs.

**B-5 — DS-43 flattens divergent success criteria across 14 tabs.** *(architecture)* "10-minute quick drill on today's weak concept" hides qualitatively different learning episodes (Explorer equity-lookup vs Line 5-node walkthrough vs Math fold-equity calc). One JTBD doing this much lifting makes per-tab fitness un-assessable.

**B-6 — No JTBD for "configure/parameterize a drill session."** *(market)* Every competitor answers drill variety with one configurator (position / stack / street / difficulty). This app answered the same outcome with *14 pre-shaped tabs* — and never wrote the underlying "shape my drill" outcome down, so it never had to confront that surface-proliferation was the answer.

---

## Stage C — Situational stress test

**Output: ❌ Fundamental mismatch (two scenarios) + ⚠️ adjustments (two more)**

**C-1 — Pre-Session: surface artifact describes a shipped mode; code has none.** *(UX + architecture — both severity 1)* `postflop-drills.md` presents a 7-tab layout with `[Pre-Session]` leftmost, full anatomy, state machine, and adjacent-surface coupling. The orchestrator defines **6 tabs, no Pre-Session entry**; there is no `PreSessionMode.jsx`. A presession-preparer who opens the view today gets none of it. This is design-code drift that will mislead any engineer wiring the adjacent surfaces against the published artifact.

**C-2 — No entry path to "the right drill today."** *(UX + architecture)* Scholar-in-Study-Block has a stated primary need: "quick entry into a drill targeted at weakness." Both views land on a hardcoded default (preflop `'shape'`, postflop `'explorer'`) with **no cross-tab history, no recommendation, no "where I left off."** Under a 10-minute block, choosing among 6–8 tabs of unknown relevance burns 20–30% of the budget before the first question renders.

**C-3 — Newcomer's correct entry (Lessons) is buried at tab 7 of 8.** *(UX)* Preflop defaults to Shape, which immediately asks a newcomer to classify a range — violating their "complexity tolerance: very low initially" constraint — while Lessons sits at position 7. First-time default should be Lessons, or an onboarding redirect.

**C-4 — Between-hands driller: every tab fails the 30-second ceiling.** *(UX)* No tab gets from cold entry → question → answer → reveal inside the attention window between live hands. Either the persona (A-2) is explicitly excluded from scope, or a fast-entry one-tap drill mode is designed.

**C-5 — Returning-after-break: zero surface hooks despite claimed applicability.** *(UX)* Lands on default tab after a 5-week gap with no decay acknowledgment, no "start here," no recalibration path — ~0% of the persona's documented requirements.

---

## Stage D — Cross-product / cross-surface

**Output: ⚠️ Partner surfaces need updates**

**D-1 — The analysis-view → drill loop has no implementation path. This is the single most important missing element.** *(architecture + market + UX)* Both surface artifacts document "analysis-view — source of weaknesses the drills *could* target if F-P13 ships" (DS-45, Proposed). The analysis view knows the leaks; the drills can address them; **nothing connects them.** The drill views are a standalone study tool disconnected from what the user is actually losing money on — which is precisely the Scholar/Study-block primary JTBD. DS-62 (recency-weighted selection) partially addresses it but depends on WS-198, and ships a frequency-only fallback in the interim.

**D-2 — Four cross-surface deep-link contracts are promised in the artifact, zero exist in code.** *(architecture)* The postflop artifact's adjacent-surface table marks "Updated this gate" for: sessions-view inline `Pre-Session Drill` button; HandReplay `Queue for tomorrow's PSD` overflow item; LSW node `Inspect in Range Lab`; HandReplay decision `Inspect in Range Lab`. Grep confirms **none** are implemented (no `restoreContext`, no queue affordance). Phase-5 deferral is reasonable for the Range-Lab pair; the PSD entry affordances are described as present but are not — any sessions-view/HandReplay work would wire to a missing destination.

**D-3 — Sidebar (Ignition) drill parity correctly absent, but the scope is undocumented.** *(architecture)* Drilling is off-table and main-app-only by design — sound. But neither artifact states "Product line: main-app only — sidebar not applicable," so the question is reopenable on every drill ticket (and ROUNDTABLES explicitly flags "built without sidebar parity" as an anti-pattern needing in-doc rationale).

---

## Stage E — Heuristic pre-check

**Output: ⚠️ Specific adjustments needed (one severity-1)**

**E-1 — Tab switch destroys in-progress drill state — no warning, no recovery (H-N03 + H-PLT08).** *(UX — severity 1)* Both orchestrators conditionally render (`{activeTab === 'line' && <LineMode/>}`); switching tabs unmounts the mode and discards state ("tabs are not cross-pinned"). A fat-finger on the dense tab bar — 5 nodes into a Line walkthrough — loses the whole session silently. Add tab-switch protection (warn on unsaved progress) or keyed per-tab state preservation.

**E-2 — Five shared tab labels are false friends (H-N04). Code-proven.** *(architecture + UX)* The architecture voice traced each:
- **Explorer — FALSE FRIEND (sev 1):** preflop = two HandPickers → `computeHandVsHand` → MatchupBreakdown (pure lookup, no board/range/grading). Postflop = ContextPicker → BoardPicker → RangeFlopBreakdown **plus** the full Range Lab 13×13 paint grid, undo stacks, compare mode, save/load. Two-to-three orders of magnitude more complex under one label. The shared name *actively misteaches*.
- **Library — FALSE FRIEND (sev 2):** preflop = hand-matchup browser with a Framework/Shape `groupBy`; postflop = board-scenario browser, framework-only grouping. Different domain object, different organization.
- **Estimate Drill — structural analog, divergent depth (sev 2):** same slider→submit→reveal skeleton, but preflop renders TrendSparkline + per-framework CalibrationRow + FrameworkInsightHint; postflop renders stars + delta only — *less* scaffolding for a *harder* question. Rooted in the `DRILL_VIEWS.md §4` aggregate-shape mismatch (postflop lacks `avgDelta`/`deltaSamples`).
- **Framework Drill — genuine analog, but a grading bug (sev 2):** preflop defines `NON_GRADABLE_FRAMEWORKS` and filters always-true frameworks (decomposition / straight_coverage / flush_contention) out of the selectable set; postflop exposes **all** of `FRAMEWORK_ORDER`. A user who learned not to select "decomposition" on preflop is graded **wrong** on postflop. Code-correctness, not taste.
- **Lessons — genuine analog, one silent gap (sev 2):** preflop LessonsMode supports `section.kind === 'compute'` (interactive Calculator); postflop has no `compute` branch and **silently returns null** — a content-authoring trap.

**E-3 — Adjacent drill-mode labels require recall, not recognition (H-N06).** *(UX)* Explorer / Estimate Drill / Framework Drill (and postflop Line) are indistinguishable from the label alone; users must tap each to learn the contract.

**E-4 — 8-tab preflop bar near the legibility edge at real scale (H-PLT03).** *(UX)* No horizontal scroll (ScaledContainer transforms, not reflows), so not an H-ML05 violation — but at ~0.45 scale on a 720px phone, "Estimate Drill"/"Framework Drill" render ~52–58px visual, marginally legible in dim light. Verify.

**E-5 — 14 tabs reflect feature accretion, not a unified taxonomy (H-N08).** *(UX + architecture + market)* The tabs are ~4 underlying learning activities (active-recall drill · exploration lookup · curated browse · narrative lesson) expressed per-street, plus street-specific modes (Shape/Math/Recipe; Line) — authored incrementally, never from a top-down taxonomy. The shared names imply a cross-view architecture the implementations do not deliver.

---

## The central coherence question — answered

**Fragmented, and fixably so. The tab *count* is not the core problem; two independent problems are.**

1. **Label incoherence.** Five labels claim a shared taxonomy the code does not honor (E-2). Fix cheaply by *diverging* the labels where behavior diverges (e.g. preflop Explorer → "Equity Lookup"; postflop Explorer → "Range Lab", matching its own artifact section) — or expensively by converging the implementations. Divergence is a label-and-doc change that clears the H-N04 violation at low cost.

2. **Stateless navigation.** 14 tabs with no memory of what the user has done, no signal of what fits today, no exhaustion indicator. The Study-block persona's primary need is unmet not because the drills are weak — they are functional and well-authored — but because there is **no navigation layer connecting the user's state to the right drill** (the same gap as D-1, from the inside).

**Market lens on structure:** the category converges on *few modes + a configurator* (GTO Wizard, DTO, Flopzilla all parameterize within a surface rather than proliferate named tabs). 8 of 14 tab-slots historically read as half-furnished rooms to a comparison-shopper. The vote is to resolve the **HELD "Drills Consolidation Proposal" (6 items, deferred 2026-04-21)** toward consolidation along a **learning-mode axis** (one Explorer, one Estimate, one Framework, one Library, one Lessons; street-specific modes as non-overlapping specializations) — **without flattening the two genuine differentiators**: Line Study (DS-50) + per-street range evolution (DS-66), and range-first decomposition (DS-48/49). Note: this is *not* a directive to scaffold `StudyView` (that hold stands); it is a re-opening of the **tab-taxonomy** question, which the StudyView hold does not necessarily close. Founder decision required before any further Gate-4 work on individual tabs.

---

## Overall verdict: **YELLOW (high) — Gate 3 required, with substantial scope**

Two stages returned ❌ (A: persona omission; C: situational mismatch). Per `LIFECYCLE.md`, YELLOW → Gate 3 with scope = patch the identified gaps; the ❌s push toward the RED boundary because the remedy includes a *new situational persona*, a *new JTBD*, and a *strategic consolidation decision* — which is RED-scale effort. **If the founder elects the consolidation path, treat the follow-on as RED (substantial expansion).** If the founder declines consolidation and the unmodeled personas, this stays YELLOW and resolves via doc-corrections + the corrective code track.

This was not a boilerplate pass: 1 code-proven false-friend at severity 1, three concrete code-correctness bugs, two severity-1 situational mismatches, and a direct, evidence-backed challenge to the 14-tab architecture. The drill *content/engine* is genuinely strong (in spots ahead of the market); the blind spots live in *navigation, persona-completeness, market-positioning, and cross-surface wiring* — exactly what the doctrine-outward framework cannot see from inside.

---

## Required follow-ups

### Track 1 — Corrective (no Gate 3 needed; low-risk, mostly doc + bug fixes)
- [ ] **F-DRILL-01 (sev 1):** Correct `postflop-drills.md` — flag the Pre-Session section as gate-pending / feature-flagged-off, not shipped. Add `returning-after-break` omission + a "main-app only — sidebar N/A" scope line (D-3). *(C-1, A-3, D-3)*
- [ ] **F-DRILL-05 (sev 2, code bug):** Fix postflop FrameworkMode to filter `NON_GRADABLE_FRAMEWORKS` to parity with preflop — it currently mis-grades. *(E-2)*
- [ ] **F-DRILL-07 (sev 2, code bug):** Add the `compute` section branch to postflop LessonsMode (or assert at authoring time) — currently silently drops interactive calculators. *(E-2)*
- [ ] **F-DRILL-02 (sev 1):** Tab-switch protection — warn on unsaved drill progress, or preserve per-tab state across switches. *(E-1)*

### Track 2 — Gate 3 (research / authoring) — RESOLVED 2026-06-15 (WS-230 / SPR-136)
- [x] **F-DRILL-08 (founder decision):** Tab-taxonomy/consolidation — founder chose **keep the by-street split, defer consolidation, invest in leak-targeted nav**; revisit with usage evidence. Recorded in `surfaces/postflop-drills.md` Known issues (Consolidation hold → RESOLVED). *(E-5)*
- [x] **F-DRILL-04 (founder decision):** Leak→drill bridge — DS-45 **committed, staged**. Bridge = **WS-233** (blocked on WS-198). Cross-tab continuity folded into the bridge (not a separate JTBD). `jtbd/domains/drills-and-study.md` DS-45 updated. *(D-1)*
- [x] **F-DRILL-09:** **DS-68** authored in `jtbd/domains/drills-and-study.md` (non-gamified competence trend). *(B-1)*
- [x] **F-DRILL-10:** `personas/situational/between-hands-driller.md` authored; scored-trainer-grinder documented as an explicit non-goal in `surfaces/postflop-drills.md`. *(A-1, A-2)*
- [x] **F-DRILL-03:** Shipped in WS-231 — preflop "Equity Lookup" / postflop "Range Explorer" (the audit's "Range Lab" name was rejected as misleading; Range Lab is a sub-mode). *(E-2)*

### Track 3 — Lower priority / triage
- [ ] **F-DRILL-06 (sev 2):** Postflop EstimateMode feedback parity (sparkline + per-framework calibration) — blocked on the aggregate-shape schema mismatch (`DRILL_VIEWS.md §4`). *(E-2)*
- [ ] **F-DRILL-11 (sev 2):** Decide serve-or-decline on DS-46 (declarative spaced repetition) — PreflopDrills ships none. *(B-2)*
- [ ] **F-DRILL-12 (sev 2):** Newcomer first-time default → Lessons (or onboarding redirect). *(C-3)*
- [ ] **F-DRILL-13 (sev 3):** DS-43 split into per-mode success criteria. *(B-5)*
- [ ] **F-DRILL-14 (sev 3):** Verify 8-tab preflop legibility at 0.45 scale, dim light. *(E-4)*
- [ ] **F-DRILL-15 (sev 3):** Wire D-2 deep-link contracts or downgrade the artifact's "Updated this gate" claims to "planned." *(D-2)*

---

## Provenance

- Method: `docs/design/ROUNDTABLES.md`; lifecycle gate per `docs/design/LIFECYCLE.md`.
- Voices: product-UX lead (situational + heuristic), external/market lens (persona-omission + JTBD-coverage + category structure), architecture/pedagogy (code-grounded false-friend audit + cross-surface wiring). Independently run, then synthesized; convergence noted per finding.
- Code traced: `PostflopDrillsView/` + `PreflopDrillsView/` orchestrators and mode components; surface artifacts `postflop-drills.md` / `preflop-drills.md`; atlas `jtbd/domains/drills-and-study.md`; persona cast in `personas/core` + `personas/situational`.
- Companion doctrine: `feedback_scf_learning_state_not_tier_rank.md`, `feedback_owner_volunteered_grading.md` (autonomy red lines — bound DS-68's non-gamified framing).
