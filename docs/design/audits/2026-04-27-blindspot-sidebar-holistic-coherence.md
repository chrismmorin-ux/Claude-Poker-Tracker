# Blind-Spot Roundtable — 2026-04-27 — Sidebar Holistic Coherence Pass

**Gate:** 2 (Blind-Spot Roundtable — triggered by RED Gate 1 verdict per `2026-04-27-entry-sidebar-holistic-coherence.md`)
**Auditor:** Claude (main)
**Working project name:** Sidebar Holistic Coherence (SHC)
**Status:** DRAFT — pending owner review + outside-lens pass

---

## Feature summary

A holistic design pass on the extension sidebar that treats its 5 zones (Z0 chrome, Z2 table-read, Z3 decision, Z4 deep-analysis) and their constituent elements as **one system** rather than a collection of independently-authored panels. Owner observation: "These have accumulated incrementally, without any thought given to their interconnectivity or relatedness."

Gate 1 found that the existing artifacts (33-rule **structural** doctrine + 5 per-zone surface artifacts) cover the structural layer (FSMs, freshness, hierarchy, interruption tiers) but **not the design-language layer** (cross-zone visual + interaction vocabulary). Provisional Gate 4 deliverable: a new artifact type, a "sidebar shell spec," that single zone surfaces reference for shared concepts.

---

## Stage A — Persona sufficiency

**Output:** ⚠️ **Patch needed.**

### Apparent user archetypes for this pass

1. **Multi-Tabler in steady state** — fluent expert glancing across 4–12 tables, half-second budget. *Mapped to existing core persona.*
2. **Multi-Tabler / Apprentice during the fluency-acquisition phase** — learning what each indicator means while the sidebar is also being used live. *No persona/situational maps.*
3. **Returning user re-acquiring spatial memory after a layoff** — partial fit to `personas/situational/returning-after-break.md`, but that situational is main-app focused and doesn't address sidebar-specific re-fluency.
4. **Hybrid Semi-Pro context-switching mid-session between sidebar and main-app OnlineView** — partial fit to existing core persona, but no situational covers the *cognitive cost of switching visual languages*.

### Persona-cast pressure test

| Question | Answer |
|---|---|
| Does Multi-Tabler cover archetype 2? | No — Multi-Tabler is explicitly modeled around *established* spatial memory. The 3-8s decision budget assumes recognition without decoding. |
| Does Newcomer cover archetype 2? | No — Newcomer is *defined out* of the sidebar by its own persona file (*"Main app. No sidebar needed."*). |
| Does Apprentice cover archetype 2? | Partial — persona file says *"Both main app and sidebar if they play online"* but no situational covers Apprentice in the act of learning the sidebar. |
| Does any situational cover the *moment* of decoding an unfamiliar element? | No. The framework treats glance as the only sidebar interaction model. Pre-fluency interaction is unmodeled. |

### Findings

**A1. New situational required: `sidebar-fluency-acquiring` (parent: Multi-Tabler or Apprentice).** The user who is learning to glance — first 20–50 hours with the sidebar. Time pressure: real (live play continues). Cognitive load: high (decoding + decision). Coherence violations cost real ms because the user can't fall back on spatial memory; they re-read.

**A2. Possibly-needed second situational: `sidebar-online-view-context-switch` (parent: Hybrid Semi-Pro).** The user moving between sidebar and main-app OnlineView within a single session. Cognitive cost of two visual languages is non-zero. Defer to Stage D — if cross-product coherence is in scope, this situational becomes load-bearing.

**A3. Survivorship bias in current cast.** Audits have only stress-tested against fluent users. Violations that hurt only first-50-hour users are invisible. This is a *systematic* gap, not a one-off.

**A4. No new core persona needed.** Gaps are situational, not archetypal. The roster is correct; the framing is too narrow.

**A5. (Outside-lens finding) E-IGNITION evaluator first-impression gap.** `personas/core/evaluator.md` lines 100–106: E-IGNITION is *"Plays online on Ignition. Expects the extension to install and capture hands during a session. WTP cluster: $50–100/mo if sidebar quality exceeds Hand2Note."* This persona's *first coherence impression* IS the sidebar — it is the surface they evaluate during a 15–30 minute trial. Coherence-incoherence in that window is a **conversion-signal failure**, not a training-cost failure. The original A1 framing treats coherence as multi-session amortization (Multi-Tabler over 50 hours). For E-IGNITION there is no second chance. **Distinct situational required:** `trial-first-session-sidebar` (parent: Evaluator E-IGNITION). The existing `trial-first-session.md` situational is scoped main-app only and does not transfer. This gap was not caught by the initial Stage A walk because the audit cast was inherited from the SR program (post-fluency users only); the Evaluator persona was never wired into sidebar audits.

---

## Stage B — JTBD coverage

**Output:** ⚠️ **Expansion needed.**

### Outcomes the coherence pass serves

For each persona / situational identified in Stage A, what outcomes are they pursuing that the JTBD atlas should capture?

| User | Outcome |
|---|---|
| Multi-Tabler (fluent) | "Recognize what kind of indicator I'm looking at without reading it" |
| `sidebar-fluency-acquiring` (new) | "Encounter a new indicator and identify its concept-family from visual language alone (without referring to docs)" |
| Apprentice + Hybrid | "When I see an affordance, know what tapping it will do without re-checking" |
| Hybrid (cross-product) | "Carry visual fluency learned in one product line into the other without re-decoding" |

### Atlas coverage scan

| Domain | Coverage |
|---|---|
| Mid-hand decision (MH-*) | All execution JTBDs — *"see the recommended action," "see sizing tied to calling range,"* etc. None are about **decoding the visual language** the recommendation is rendered in. |
| Onboarding (ON-82..88) | Product tour, jargon tooltips, expert bypass. ON-83 (first-hover jargon) is closest but covers terminology, not visual semantics. |
| Cross-cutting (CC-01..89) | Undo, recovery, search, accessibility (CC-81 color-blind), lineage, telemetry. **Nothing on system-recognition / pattern fluency.** |

### Findings

**B1. Missing JTBD class: cross-element pattern recognition.** The pre-condition that makes every glance JTBD work has no atlas entry. Without it, audits cannot register "this status indicator looks different in Z0 than in Z2" as a JTBD-impacting violation — the framework can only register it as an H-N4 heuristic violation, which is weaker.

**B2. Four candidate JTBDs to author** (Gate 3 / Gate 4 will refine wording; B5 + B6 added by outside-lens pass):

- **`JTBD-CC-?` — system-recognition / cross-element fluency.** *"When I see an indicator anywhere in the sidebar, I want its visual treatment to map to a single concept I already know, so I don't re-decode it per zone."* Likely cross-cutting (extends to main-app surfaces too).
- **`JTBD-CC-?` — predictable affordance vocabulary.** *"When I see an affordance shape, I want it to mean the same action wherever it appears, so I can act without re-checking."* Concretizes R-1.5's intent into an outcome that audits can register findings against.

**B3. No new domain needed.** All proposed JTBDs land in cross-cutting. The atlas structure is correct.

**B4. Tension to resolve:** the proposed JTBDs are *cross-cutting* but the immediate scope is sidebar. Gate 2 Stage D will determine whether the JTBDs are authored as cross-product or sidebar-scoped initially with cross-product extension as follow-up. Recommendation: author as cross-cutting from the start, since the design-language tension applies to main-app surfaces too (e.g., AnalysisView staleness signals, OnlineView freshness).

**B5. (Outside-lens finding) Panel-blame / data-provenance JTBD.** *"When the sidebar gives me an unexpected read, I want to identify which zone or data source produced it, so I know whether to trust the next hand's advice."* This is **not** about coherence per se — it is about **legibility of data provenance**. Z2 shows staleness on advice; Z4 has a freshness ledger; if a recommendation is wrong, the user cannot trace which zone's data was the culprit. No JTBD captures this. It is adjacent to coherence (a coherent vocabulary makes blame-routing easier) but the underlying outcome is data-attribution, not pattern-recognition. **Cross-cutting candidate, related to but distinct from CC-82 (lineage) which is about asset-level provenance, not in-the-moment runtime blame-routing.**

**B6. (Outside-lens finding) Trust-the-stack / cross-product consistency JTBD.** *"When the sidebar recommendation conflicts with what I believe from the main-app OnlineView, I want to know which one is more current."* Distinct from the design-language cross-product question in Stage D — this is **data-consistency** focused, not visual-language. Hybrid Semi-Pro is the canonical user. The framework currently has no JTBD covering "two surfaces disagree, which one to trust." **Likely cross-cutting; possibly should be a multi-device-sync extension since the two-surface case is a degenerate sync case.**

---

## Stage C — Situational stress test

**Output:** ⚠️ **Adjust** — specific failure modes identified.

### Walkthrough method

For each persona × applicable situational, walk a representative sidebar session and ask: *where does inconsistent design language cost time, cause misreads, or break the glance pathway?*

### Multi-Tabler (steady state) × `mid-table-glance`

- **Z0 pipeline health** (informational, dot indicator) and **Z2 stale-advice signal** (decision-critical, different treatment) both encode "is the data fresh?" but with different visual languages. Multi-Tabler has learned both; the cost is a one-time training cost amortized over thousands of glances. Survivorship bias: this audit cohort can't see the cost.
- **Verdict:** ⚠️ acceptable for fluent users; cost was paid at acquisition.

### `sidebar-fluency-acquiring` (new) × early-table sessions

- Same scenario: encounters Z0 freshness dot and Z2 stale signal. Has to learn two separate visual conventions for one underlying concept. Doubles the learning burden.
- Encounters Z3 multiway selector affordance (BET/RAISE clear state) and Z4 per-seat villain detail drill-down — affordance shapes likely diverge per element-author. Has to learn each affordance individually rather than learning a vocabulary.
- **Verdict:** ❌ **Fundamental cost.** Each design-language inconsistency multiplies fluency-acquisition time. With a coherent vocabulary, learning Z0's freshness teaches Z2's freshness for free. Without it, every zone is re-learned.

### Mid-hand Chris (live-player situational) × OnlineView↔sidebar context switch

- Mid-hand Chris is technically a main-app situational — but Hybrid Semi-Pro who uses both surfaces in a session experiences mid-hand cognition.
- Switching from main-app's OnlineView freshness treatment to sidebar's freshness treatment (assuming they differ) imposes a context-switch cost during a live decision.
- **Verdict:** ⚠️ depends on actual divergence. Gate 3 research / Gate 4 inventory should measure this.

### Returning-after-break × first session back

- Re-acquires spatial memory from R-1.2 / R-1.5 declarations.
- **If** the sidebar uses a consistent vocabulary, re-acquisition leverages remembered semantics: "I don't remember exactly where the freshness dot is, but I recognize its visual treatment." **If not,** every zone must be re-acquired separately.
- **Verdict:** ⚠️ depends on actual coherence level.

### Findings

**C1. The fluency-acquiring situation is the highest-value stress test.** It is also the situation the current persona cast can't see. Authoring `sidebar-fluency-acquiring` is the load-bearing Gate 3 deliverable.

**C2. Mid-hand cognition spans surfaces for Hybrid users.** Mid-hand Chris currently bounded to main-app; sidebar analogue is implicit in Multi-Tabler decision constraints. If this audit produces cross-product spec, formalize the analogue.

**C3. Re-acquisition (returning-after-break) is a situation that current sidebar artifacts don't address but should.** Coherent design language is the mechanism that makes re-acquisition cheap. Current artifacts don't model this gain.

**C4. No situation-level fundamental mismatch.** All identified situations are *served-but-suboptimally* by the current sidebar; none is structurally incompatible.

---

## Stage D — Cross-product / cross-surface

**Output:** ⚠️ **Partner surfaces need updates.**

### Surfaces directly touched

- All 5 sidebar zone surfaces: `sidebar-zone-0.md`, `sidebar-zone-2.md`, `sidebar-zone-3.md`, `sidebar-zone-4.md`, `sidebar-zones-overview.md`.
- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — R-1.5's "SR-4 spec index" reference becomes the new shell spec.

### Surfaces indirectly affected

- **`online-view.md`** — main-app companion. Hybrid Semi-Pro persona moves between sidebar and OnlineView; design-language coherence between them is a cross-product question.
- **`hand-plan-layer.md`** — surfaces depth-2/3 game-tree branching across both products. Shares concept of "confidence" with sidebar Z3/Z4.
- **`bucket-ev-panel-v2.md`** — main-app EV panel; shares status semantics (live/stale/error/unknown) with sidebar Z2.
- **`analysis-view.md`** — main-app; shares "freshness" concept with sidebar Z0/Z2/Z4.

### Cross-product coherence question

Does the design-language layer apply only to the sidebar (5 zones), or does it scope to the whole app (sidebar + main-app)?

| Argument for sidebar-only | Argument for cross-product |
|---|---|
| Sidebar is one product line; faster to spec, ship, validate. | The same concepts (freshness, confidence, status, locked/gated, unknown) appear on main-app surfaces with their own ad-hoc treatments. |
| SR program scoped to sidebar; piggybacking is clean. | Hybrid Semi-Pro persona explicitly switches; cross-product divergence imposes a real cost on this user. |
| Main-app has its own design tokens (`designTokens.js` per memory); risk of tooling mismatch. | A shared status/affordance vocabulary leverages existing `designTokens.js` rather than competing with it. |

### Findings

**D1. Recommended scope:** **Cross-product**, but staged. Author the shell spec for the sidebar first (immediate concern, owner-flagged); structure it so its concept inventory (freshness, confidence, status, locked, unknown, affordance vocabulary) is **directly portable** to main-app surfaces. Mark each section "sidebar-canonical, main-app-extension-pending." Then a second pass extends to main-app surfaces.

**D2. Conflict to flag for owner:** `designTokens.js` is the single source of truth for colors per memory. The shell spec must NOT introduce a parallel color system. It should describe **semantic meanings** of token usage (e.g., "freshness-stale-warning maps to `designTokens.amber.500`") rather than introduce raw colors.

**D3. Partner surfaces requiring update at Gate 4:**
- All 5 sidebar zone artifacts (cross-reference shell spec).
- `online-view.md` (note pending cross-product extension).
- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` R-1.5 (cite shell spec as canonical affordance index).

**D4. Sidebar↔TournamentContext cross-coupling already flagged.** `sidebar-tournament-parity` discovery is open. Coherence pass should not re-open that issue but should ensure the future tournament-parity panel uses the same status/affordance vocabulary as Z0's existing tournament log — i.e., shell spec should anticipate this addition.

---

## Stage E — Heuristic pre-check

**Output:** ⚠️ **Specific adjustments needed.**

### Heuristic violations the coherence pass would address

| Heuristic | Likely current state | Coherence-pass addresses |
|---|---|---|
| **H-N4 consistency + standards** | Doctrine R-1.1 / R-1.3 / R-1.5 cover *zone* and *element-position* consistency; no rule covers *visual-treatment* consistency across zones. | Yes — this is the core target. |
| **H-N6 recognition rather than recall** | R-1.2 + R-1.5 establish spatial-memory model. Visual-language coherence is the second leg of recognition; without it, recognition collapses to recall (the user has to recall what dot-color means in Z0 vs Z2). | Yes. |
| **H-PLT-01 glance-readable** | R-1.2 enforces per-element glance-test. Doesn't cover whether one element's glance-treatment teaches the user to glance another. | Yes — coherence reduces aggregate glance cost. |
| **H-N5 error prevention** | R-2.* and R-3.* prevent state errors. Don't prevent *misreading* errors caused by similar-looking but differently-meaning indicators. | Partial — coherent vocabulary reduces misreading. |
| **H-N10 help + documentation** | Existing gap noted in `surfaces/sidebar-zones-overview.md` §3 ("no direct rule — sidebar is not documented in-product"). Coherence pass *plus* potential in-product affordance hint surface could address. | Tangential — out of scope for this pass. |

### Concrete questions Gate 4 must answer

These come from the heuristic walk and inform shell-spec content:

- **E1.** What is the canonical visual treatment for `live | stale | unknown | error | locked` data states across all zones?
- **E2.** What is the canonical visual treatment for confidence levels (high / medium / low) on data the engine emits?
- **E3.** What affordance shapes are licensed (chevron, underline, badge, dot, pill, divider) and what does each one mean?
- **E4.** What is the canonical typography ladder (size + weight + color)?
- **E5.** What density rhythm applies (row height, padding, gap units)?
- **E6.** What motion budget applies (per R-6.* doctrine — already partial; coherence pass extends to motion-as-affordance)?
- **E7.** What is the attention budget (which zone wins the eye in which state)?

### Findings

**E1. No structural heuristic-incompatibility.** Coherence pass aligns with H-N4, H-N6, H-PLT-01, H-N5; doesn't conflict with any.

**E2. Doctrine rule R-1.5's dangling reference is the cleanest entry point.** R-1.5 says affordances "are drawn from a small, consistent vocabulary declared in the SR-4 spec index." That index is unauthored. The shell spec **becomes** the SR-4 spec index by reference.

**E3. Don't speculatively add new doctrine rules.** Per R-§0, rules require sealed-forensics citation. The shell spec is *spec content* (descriptive vocabulary), not *new rules* (prescriptive constraints with forensics basis). If a new rule emerges from the spec authoring (e.g., "no zone may invent a new status color outside the shell spec inventory"), it must cite forensics — likely the cumulative drift this audit identifies. Defer rule-authoring to a separate doctrine amendment proposal.

**E4. `designTokens.js` integration is mandatory.** Per Stage D-2, the shell spec describes semantic mappings *onto* existing tokens, not parallel colors.

**E5. (Outside-lens finding) Concrete divergences confirmed in code — three cross-zone violations cited:**

- **Confidence rendered three incompatible ways:**
  - `ignition-poker-tracker/side-panel/render-orchestrator.js` lines 442–465 — Z2 context strip uses CSS opacity classes (`conf-player`, `conf-mixed`, `conf-population`) that modulate the data value's appearance with no legend.
  - `ignition-poker-tracker/side-panel/render-orchestrator.js` lines 150–169 — Z2 unified header uses a colored dot (class `green`/`yellow`/`red`) plus tooltip.
  - `ignition-poker-tracker/side-panel/render-tiers.js` lines 68–74 — Z4 / glance tier uses a colored dot plus inline `n=` sample label.
  - **Implication:** divergence exists *within Z2* (header vs context strip), not just across zones. The opacity-class form is invisible to anyone scanning for "confidence" — it just makes numbers dimmer. A user who learns the dot in Z2 header cannot transfer that to Z2 context strip, let alone Z4.

- **Yellow encodes three unrelated meanings on the same hex `#fbbf24`:**
  - `ignition-poker-tracker/shared/design-tokens.js` line 31 — `trust-marginal` = marginal-EV / mixed confidence.
  - `ignition-poker-tracker/shared/design-tokens.js` line 78 — `m-yellow` = M-ratio zone 2 / moderate tournament danger.
  - `ignition-poker-tracker/side-panel/side-panel.js` lines 206–214 — Z0 connection-status dot uses `status-dot yellow` for `cause === 'disconnect'` (connectivity health).
  - **Implication:** trust-confidence, tournament-pressure, and connectivity-health all share the same yellow with no semantic disambiguation in token names. The shell spec must resolve this token-semantics collision before any zone can rely on yellow as a signal.

- **Staleness rendered with two incompatible patterns and no shared parent:**
  - `ignition-poker-tracker/side-panel/side-panel.js` lines 1068–1087 — Z2 staleness = `.stale-badge` text element with aging counter ("Stale 23s"), threshold-driven (10s + street-mismatch).
  - `ignition-poker-tracker/side-panel/render-orchestrator.js` lines 1326–1341 — Z0 pipeline health = `status-dot yellow/red` with status text, no aging counter.
  - **Implication:** A user who learns "yellow dot = stale data" from Z0 will not recognize "Stale 23s" text badge in Z2 as the same concept-class. Confirmed concrete H-N4 violation.

**E6. (Outside-lens finding) Strongest alternative to "shell spec" artifact: extend doctrine with three new rules.** Owner-direction 2026-04-27: proceed with the rule-extension path as a **complement** to (not substitute for) the future shell spec.

**Proposal authored at:** `.claude/projects/sidebar-rebuild/08-doctrine-amendment-proposal-r16-r17-r18.md` — written per `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §11 amendment process. Status: PROPOSED, awaiting owner decision.

**Key findings during proposal authoring (additions to E5):**

- The yellow-encoding violation is **worse than initially reported.** The hex `#fbbf24` serves *five* semantic roles in `shared/design-tokens.js` (not three): `trust-marginal` (line 31), `action-call-text` (line 47), `priority-med-text` (line 61), `m-yellow` (line 77), `color-warning` (line 94). Three are observed actively conflicting in code (Z0 connectivity, Z0 pipeline-health, Z2/Z4 confidence).
- Doctrine **§10 explicitly scopes out visual design** ("Visual design (colours, fonts, exact sizes) — separate concern; handled in per-element specs"). The proposed R-1.7 (token semantic isolation) brushes against this exclusion. The proposal includes a §10 clarification that distinguishes *per-element visual design* (out of scope) from *cross-zone consistency invariants* (in scope) — needed for R-1.7 to land cleanly.
- Forensics renamed **D-1, D-2, D-3** (drift class, parallel to S1–S5 symptoms and M1–M8 mechanisms) — these are post-SR design-language drifts, not bug-class symptoms.

**Three options presented to owner in proposal:**
- **Option I:** All three rules + §10 clarification. Most aggressive. Outside-lens recommendation.
- **Option II:** R-1.6 and R-1.8 only; defer R-1.7 to shell spec. Cleanest doctrine fidelity. ← **Owner approved 2026-04-27.**
- **Option III:** Defer all three rules; let shell spec carry the load. Lowest ceremony.

**Resolution (2026-04-27):** Option II adopted. Doctrine v3 amendment landed in `docs/SIDEBAR_DESIGN_PRINCIPLES.md`:
- **R-1.6** (cross-zone treatment-type consistency) added to §1, citing D-1.
- **R-1.7** (staleness shape-class consistency) added to §1, citing D-3 — renumbered from proposed R-1.8 for sequential rule ordering.
- **Token-semantic isolation rule** (was proposed R-1.7, citing D-2) **deferred to shell spec.** D-2 forensics retained in §11 amendment log without R-rule citation; the substantive concern (yellow #fbbf24 across 5 semantic roles in `design-tokens.js`) flows to Gate 4 shell-spec authorship.
- **§10 not amended.** Doctrine retains its current scope exclusion of visual design; R-1.6 and R-1.7 are structural-only (treatment-type, shape-class enumeration) and slot in without §10 amendment.

The proposal file at `.claude/projects/sidebar-rebuild/08-doctrine-amendment-proposal-r16-r17-r18.md` is updated with Option II as APPROVED. R-1.7 deferral remains the authoritative record of the path-not-taken.

---

## Overall verdict

**YELLOW** — Gate 3 (Research) required; scope: persona authoring + JTBD authoring + competitive design-language review.

### Scope decision (2026-04-27, owner-approved)

**Scope A adopted.** The holistic coherence pass is scoped to the **fluent-user / training-cost** concern. E-IGNITION evaluator first-impression coherence (Stage A finding A5, surfaced by outside-lens) is **routed to the Monetization & PMF program** (`docs/projects/monetization-and-pmf.project.md` + `docs/design/audits/2026-04-24-blindspot-monetization-and-pmf.md`) as a known parallel concern. SHC produces the shell spec for fluent-user audience; M&PMF decides whether the shell spec must also serve as a first-impression-coherence contract when E-IGNITION trial-first-session work is scoped.

### Why Scope A over Scope B

- **Program ownership:** First-impression / purchasing-window concerns are M&PMF's territory by program charter; SHC inherits the SR program's fluent-user audience.
- **Smaller Gate 3:** Drops `trial-first-session-sidebar` situational authoring + first-time-user pass on competitive review. Gate 3 stays narrow and shippable.
- **No information loss:** E-IGNITION concern is preserved in M&PMF's record; if M&PMF decides E-IGNITION first-impression-coherence requires sidebar work, they can re-open SHC scope or commission a follow-up audit. The routing entry in this audit is the linkage.

### Justification (other dimensions)

- **Persona gap is patchable** (Stage A): one new situational (`sidebar-fluency-acquiring`); no new core persona under Scope A. (E-IGNITION `trial-first-session-sidebar` situational deferred to M&PMF program; not authored under SHC.)
- **JTBD gap is patchable** (Stage B): four cross-cutting JTBDs (system-recognition + affordance predictability + panel-blame + trust-the-stack); no new domain.
- **Situational stress test passes structurally** (Stage C): no fundamental incompatibilities; cost of incoherence is concentrated in fluency-acquiring (training-cost). The trial-first-session situation is in the audit record (Stage A5, C-Mid-hand walkthrough) but is not driven by SHC under Scope A.
- **Cross-product scope is decidable** (Stage D): sidebar-first, main-app-extension-staged.
- **No structural heuristic-incompatibility** (Stage E); E5 confirmed three concrete code-evidenced violations. E6 rule-extension landed as v3 amendment (R-1.6 + R-1.7) per Option II.

A **GREEN** verdict was unsupportable: Gate 3 research is genuinely needed (competitive review, internal inventory, persona + JTBD authoring). A **RED** verdict was viable under Scope B (E-IGNITION coherence-as-conversion in scope); not adopted under Scope A.

**Routing note:** The outside-lens recommendation was Scope B. Owner decision (2026-04-27) was Scope A on the program-ownership argument: first-impression / purchasing-window concerns belong to M&PMF by program charter. M&PMF retains optionality to re-open SHC scope or commission a follow-up audit if E-IGNITION first-impression-coherence proves to require sidebar-specific work.

---

## Required follow-ups

### Gate 3 (Research) — required, Scope A scoped

- [ ] **Author new situational persona** `personas/situational/sidebar-fluency-acquiring.md`. Parent: Multi-Tabler (primary) and Apprentice (secondary). Time/attention/cognitive constraints distinct from Multi-Tabler in steady state.
- [ ] **Optionally author** `personas/situational/sidebar-online-view-context-switch.md` (parent: Hybrid Semi-Pro). Decision: defer until cross-product extension is scoped.
- [ ] **Author 3–4 cross-cutting JTBDs** in `jtbd/domains/cross-cutting.md`: system-recognition (B2.a), affordance predictability (B2.b), panel-blame data-provenance (B5), trust-the-stack cross-product consistency (B6). IDs to be assigned.
- [ ] **Competitive design-language review** — evidence ledger entries for: PokerTracker 4 HUD, Hand2Note HUD, NoteCaddy, DriveHUD, GTO Wizard sidebar. Focus: status semantics (how is staleness shown?), affordance vocabulary, density rhythm. (First-time-user / E-IGNITION lens deferred to M&PMF under Scope A.)
- [ ] **Internal observation pass — visual layer** — the auditor walks the actual sidebar at `localhost:3333` (harness) capturing every status indicator, freshness signal, affordance, and confidence treatment in a single inventory document. Use the E5 violations as starting points; expect more.
- [ ] **Internal observation pass — architectural layer** *(outside-lens addition; load-bearing).* For each freshness signal cataloged in the visual pass, document the **mechanism**: what code computes it, what triggers state change, what clears it, what timer it's bound to. The blind spot identified by Stage E6 is that two zones can share canonical visual treatment in spec and **still diverge in behavior** because they run on different timers and clear on different events. Concrete starting points: Z0 pipeline-health is computed by the pipeline status handler; Z2 staleness is computed by `computeAdviceStaleness`. If clearing conditions diverge, no shell spec vocabulary change fixes the user's experience of seeing one zone report "stale" while another reports "live" for the same underlying fact. **This pass is the prerequisite for the shell spec being implementable, not just authorable.**
- [ ] **Evidence ledger entry** — `evidence/2026-04-XX-sidebar-coherence-baseline.md` cataloging both visual and architectural divergence.

### Items resolved in-session

- ✅ **E6 rule-extension path** — owner approved Option II 2026-04-27. Doctrine v3 amendment landed: R-1.6 (treatment-type consistency, citing D-1) + R-1.7 (staleness shape-class consistency, citing D-3). Token-semantic isolation rule (proposed R-1.7, citing D-2) deferred to shell spec. See `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §11 v3 entry + `.claude/projects/sidebar-rebuild/08-doctrine-amendment-proposal-r16-r17-r18.md`.
- ✅ **Scope decision** — Scope A adopted 2026-04-27. E-IGNITION first-impression routed to M&PMF program.

### Gate 4 (Design) — preview

- [ ] Author `surfaces/sidebar-shell-spec.md` (or alternate name; Gate 3 may suggest better).
- [ ] Update all 5 zone artifacts to cross-reference shell spec.
- [ ] Update `docs/SIDEBAR_DESIGN_PRINCIPLES.md` R-1.5 to cite shell spec as canonical affordance index.
- [ ] Update `online-view.md` with "pending cross-product coherence extension" note.
- [ ] Update `docs/design/LIFECYCLE.md` to add `system-coherence audit` as a recognized scope classification (framework-level finding from Gate 1).

### Gate 5 (Implementation) — preview

- Implementation per shell spec is *retroactive* — likely staged across multiple PRs, each citing the shell spec section they bring into compliance. Some violations may be left in place if Gate 4 decides the cost-benefit doesn't merit churn.

---

## Bypass log

None proposed. RED Gate 1 → YELLOW Gate 2 → required Gate 3 is the standard escalation; no shortcut justified.

---

## Change log

- 2026-04-27 — Created. Gate 2 blind-spot output for sidebar holistic coherence pass.
