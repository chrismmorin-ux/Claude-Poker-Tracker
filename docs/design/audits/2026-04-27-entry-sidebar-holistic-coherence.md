# Gate 1 Entry Audit — Sidebar Holistic Coherence Pass

**Date:** 2026-04-27
**Auditor:** Claude (main)
**Working project name:** Sidebar Holistic Coherence (SHC)
**Scope at entry:** A holistic design pass on the extension sidebar treating its 5 zones + their elements as **one system** rather than as a collection of independently-authored panels. Owner-flagged: "These have accumulated incrementally, without any thought given to their interconnectivity or relatedness. It might be the case we need to develop something else to achieve this properly."
**Gate:** 1 (Entry — mandatory per `docs/design/LIFECYCLE.md`)
**Status:** DRAFT — pending owner review

---

## Executive summary

The Sidebar Rebuild Program (SR-0..SR-7) and Sidebar Trust Program (STP-1) produced a rigorous **structural** doctrine: 33 rules covering zone hierarchy, FSM lifecycles, freshness contracts, interruption tiers, payload invariants. DCOMP-W5 then produced 5 zone-level surface artifacts. Together these answer *"is each panel structurally sound and well-typed?"* — and the answer is yes.

Neither program produced a **system-level design-language artifact**. There is no spec for:
- Shared visual treatments for cross-zone concepts (freshness, confidence, status, locked, unknown).
- A consistent affordance vocabulary (R-1.5 references an "SR-4 spec index" but no such index has been authored as a cross-zone reference doc).
- An attention-budget map (which zones compete for the eye, in what order, under what conditions).
- An element-family inventory (which elements across zones express the same underlying concept, and how their visual treatments diverge).

The persona/JTBD framework also has gaps for this work: the canonical sidebar persona (Multi-Tabler) is modeled around *established spatial memory*; no persona or situational covers the *acquisition* of that fluency. No JTBD captures cross-element pattern recognition.

**Verdict: RED.** The work targets an outcome class (system design language + cross-element coherence) with **zero artifacts** in the framework. Triggers Gate 2 Blind-Spot Roundtable. Likely Gate 3 research (competitive review of HUD design language: PT4, Hand2Note, NoteCaddy). Gate 4 will need a new artifact type — provisional name **sidebar shell spec** — that single zone surfaces reference.

---

## 1. Scope classification

Per `docs/design/LIFECYCLE.md` Gate 1 options:

| Classification | Applies? | Evidence |
|---|---|---|
| Surface-bound fix | No | Affects every zone simultaneously, not one |
| Surface addition | **Partial** | Likely produces a new artifact *type* (shell spec), not a new UI surface |
| Cross-surface journey change | **Yes** | Touches Z0, Z2, Z3, Z4 + their relationship to main-app `online-view.md` |
| Product-line expansion | No | Sidebar product line only (though sidebar↔main-app coherence is in scope) |

**Primary classification:** Cross-surface coherence audit on an existing surface system. **This category is not in the lifecycle table** — the existing categories are content-focused (new view, new panel, reorder menu); none model "surfaces all exist, they just don't speak the same visual/interaction language." This is itself a framework-level finding: the lifecycle table should be extended to include `system-coherence audit` as a recognized scope.

**Lifecycle gate path:** 1, 2, (3), 4, 5 — same path as cross-product feature. Justified by: (a) RED entry verdict, (b) targets a missing artifact type, (c) likely benefits from external research.

---

## 2. Personas identified

### 2.1 Existing cast evaluation

**Core personas (cited by `surfaces/sidebar-zones-overview.md` §2):**

| Persona | File | Relevance to coherence pass |
|---|---|---|
| Multi-Tabler | `personas/core/multi-tabler.md` | **Primary stress test.** 4–12 tables, half-second glances. Coherence violations cost real ms. Modeled around *established* spatial memory — the fluency *acquisition* phase is unmodeled. |
| Online MTT Shark | `personas/core/online-mtt-shark.md` | Tournament context on Z0; coherence between Z0 tournament log and Z3 decision content matters mid-bubble. |
| Hybrid Semi-Pro | `personas/core/hybrid-semi-pro.md` | Cross-product use: fluency must transfer between sidebar and main-app OnlineView. |

**Situational (cited):**

| Situational | File | Covers coherence pass? |
|---|---|---|
| Between-hands Chris | `personas/situational/between-hands-chris.md` | Cited in overview but is a *main-app* situational, not a sidebar-glance one. |

### 2.2 Plausibly affected but uncited

| Persona / Situational | File | Why relevant to coherence |
|---|---|---|
| **Newcomer** | `personas/core/newcomer.md` | Persona file explicitly says *"Main app. No sidebar needed."* Framework has *defined out* the learnability persona for this surface. If sidebar gets used, somebody must learn its language; the cast assumes that learning happens elsewhere or is unimportant. |
| **Apprentice** | `personas/core/apprentice-student.md` | Persona file says *"Both main app and sidebar if they play online."* No situational sub-persona covers "Apprentice acquiring sidebar fluency." |
| **Returning-after-break** | `personas/situational/returning-after-break.md` | Re-acquires spatial memory after a layoff; depends on coherent vocabulary for fast re-up. |
| **Mid-hand Chris** | `personas/situational/mid-hand-chris.md` | Live-player situational; the *sidebar* analogue (Multi-Tabler in compressed-time) has no equivalent situational artifact. |
| **Evaluator (E-IGNITION sub-shape)** | `personas/core/evaluator.md` lines 100–106 | **Surfaced by Gate 2 outside-lens.** E-IGNITION explicitly: "Plays online on Ignition. Expects the extension to install and capture hands during a session. WTP cluster: $50–100/mo if sidebar quality exceeds Hand2Note." Their *first coherence impression* IS the sidebar. The `trial-first-session.md` situational exists but is scoped main-app only — there is no sidebar-scoped trial-first-impression situational. |

### 2.3 Gap analysis — personas

**Three confirmed gaps:**

1. **No persona/situational covers the fluency-acquisition phase for the sidebar surface.** Multi-Tabler is "fluent expert"; Newcomer is excluded from sidebar by definition. This produces a survivorship bias in audit: violations that *only hurt the user during their first 50 hours* are invisible because the framework's sidebar cast is post-fluency.
2. **No situational covers the cognitive moment "I am decoding what this element means right now."** This is distinct from "I am glancing at a remembered location" (R-1.2 / R-1.5). The framework treats glance as the only interaction model.
3. **No sidebar-scoped first-impression situational for E-IGNITION evaluators.** This is a *purchasing-window* problem distinct from the *training-cost* problem of fluency acquisition: 15–30 minutes, no second chance, coherence as conversion signal. Cannot be patched by a single training-focused situational; needs its own artifact (`trial-first-session-sidebar.md` provisional).

**Recommended Gate 3 work:** author **two** new situational sub-personas — provisional names **`sidebar-fluency-acquiring`** (parent: Multi-Tabler or Apprentice; the training-cost user) and **`trial-first-session-sidebar`** (parent: Evaluator E-IGNITION; the purchasing-window user, distinct from main-app `trial-first-session.md`). Do **not** propose a new core persona; both gaps are situational, not archetypal. The two situationals have distinct constraint profiles: one is multi-session amortization, the other is single-session conversion.

### 2.4 Coverage verdict

**YELLOW.** No new core persona needed. One new situational required. Gate 2 Stage A should pressure-test whether a second situational (e.g., "cross-product context-switching" for Hybrid Semi-Pro moving between sidebar and OnlineView) is also missing.

---

## 3. JTBD identified

### 3.1 Existing atlas evaluation

**JTBDs cited by sidebar zone artifacts (per `surfaces/sidebar-zones-overview.md` §2):**

- `JTBD-MH-01` see recommended action
- `JTBD-MH-03` bluff-catch frequency
- `JTBD-MH-04` sizing suggestion tied to calling range
- `JTBD-MH-08` blockers in fold-equity math
- `JTBD-MH-09` street + pot awareness
- `JTBD-MH-13` seat-activity read
- `JTBD-MH-14` action-history read
- `JTBD-HE-13` auto-capture status

All are **decision-execution** JTBDs. They presuppose the user has already decoded the visual language.

**Adjacent domains scanned:**

| Domain | File | Relevant? |
|---|---|---|
| Onboarding (ON-*) | `jtbd/domains/onboarding.md` | ON-82..ON-88 cover product tour, jargon tooltips, expert bypass. None covers ongoing cross-element pattern recognition once the user is past first-run. |
| Cross-cutting (CC-*) | `jtbd/domains/cross-cutting.md` | CC-01..CC-89 cover undo, recovery, search, accessibility, lineage, telemetry, alerts, mixed-games. Nothing on system-recognition or pattern fluency. |
| Mid-hand decision (MH-*) | `jtbd/domains/mid-hand-decision.md` | All execution JTBDs (see above). No "decode what this widget is showing me." |

### 3.2 Gap analysis — JTBDs

**One confirmed missing outcome class:** *"Recognize what kind of element I'm looking at without reading it."* This is the pre-condition that makes every glance JTBD work.

**Two candidate JTBDs to author** (Gate 3 / Gate 2 Stage B will refine):

- **Provisional `JTBD-CC-?` — system-recognition / cross-element fluency.** *"When I see an indicator anywhere in the sidebar, I want its visual treatment to map to a single concept I already know, so I don't have to re-decode it per zone."* Likely lands in cross-cutting (cross-element pattern recognition spans every surface).
- **Provisional `JTBD-CC-?` — predictable affordance vocabulary.** *"When I see an affordance (chevron, underline, badge, dot), I want it to mean the same thing wherever it appears in the sidebar, so I can act without re-checking."* Concretizes R-1.5's intent into an outcome the framework can audit against.

### 3.3 Coverage verdict

**YELLOW.** No new JTBD domain needed. 1–2 cross-cutting JTBDs to add. Gate 2 Stage B should confirm whether these are truly cross-cutting (apply to main-app surfaces too) or sidebar-specific.

---

## 4. Framework artifact gaps (the structural finding)

This section is non-standard for a Gate 1 audit but is the most load-bearing finding.

### 4.1 What exists

| Artifact | Coverage |
|---|---|
| `docs/SIDEBAR_DESIGN_PRINCIPLES.md` | 33-rule structural doctrine (FSMs, freshness, hierarchy, interruption, invariants) |
| `surfaces/sidebar-zone-0..4.md` + overview | 5 zone-level artifacts + cross-map |
| Heuristic cross-map | Doctrine rules ↔ Nielsen-10 / PLT / ML |
| `.claude/failures/SIDEBAR_REBUILD_PROGRAM.md` + STATE_CLEAR_ASYMMETRY.md + SW_REANIMATION_REPLAY.md | Post-mortems |

### 4.2 What does NOT exist

| Missing artifact | What it would contain | Consequence of absence |
|---|---|---|
| **Sidebar shell spec / design-language doc** | Cross-zone visual + interaction vocabulary: status colors (live/stale/error/unknown/locked), affordance shapes (chevron/underline/badge/dot), confidence treatments, density rhythm, typography ladder, motion budget tokens. | Each zone solves the same problems independently. R-N4 (consistency + standards) has no enforceable referent. |
| **Affordance vocabulary index** | The "SR-4 spec index" referenced by R-1.5. Single source of truth: chevron means X, underline means Y, badge means Z. | Rule R-1.5 is technically unenforceable. New panels invent affordances; old ones drift. |
| **Element-family map** | Inventory of cross-zone *concepts* (e.g., "freshness" appears in Z0 pipeline-health dot, Z2 stale-advice signal, Z4 freshness ledger) and how their visual treatments compare. | No artifact captures that the same idea is being expressed three different ways. |
| **Attention budget** | Documented hierarchy of how zones compete for eye time under different states (active hand, between hands, error, tournament context). | Doctrine has interruption tiers but no spec for *which zone you look at first* in a given state. |
| **Cross-zone coherence audit** | An audit deliberately scanning ACROSS zones for design-language divergence. | DCOMP-W5 audited each zone in isolation; no audit was tasked with finding cross-zone inconsistency. |

### 4.3 Why this gap was invisible

The Sidebar Rebuild was scoped around the *bug class* it was fixing (S1–S5 symptoms — element disappearance, slot stealing, stale data, layout reflow). Those bugs are structural — FSM, payload, render-ownership. The doctrine is correctly scoped to those.

The **design-language layer is one level above** the structural one: even with FSMs perfect and freshness contracts honored, two zones can still solve "show that data is stale" with different visual treatments, and the user pays a re-decoding cost that no rule catches. The DCOMP-W5 integration pass adopted the structural surface artifacts but didn't introduce the design-language layer either — its goal was framework integration, not new spec authoring.

The user's intuition ("It might be the case we need to develop something else to achieve this properly") is correct: the missing artifact type is real.

---

## 5. Verdict

**RED** — feature targets an outcome class with zero artifacts in the framework, two persona/situational gaps, one JTBD class gap, and one missing artifact type.

### 5.1 Required follow-ups before Gate 4

- [ ] **Gate 2 Blind-Spot Roundtable** — required by RED verdict. Specific stage emphasis: A (fluency-acquiring persona), B (system-recognition JTBD), D (sidebar↔OnlineView coherence), E (H-N4 violations).
- [ ] **Gate 3 Research** — likely required. Scope: competitive HUD design language (PokerTracker 4, Hand2Note, NoteCaddy, DriveHUD, GTO Wizard sidebar) + general design-system patterns (status semantics, affordance vocabularies). Goal: validate that "sidebar shell spec" is the right artifact type, not invented.
- [ ] **Persona additions** — one new situational under Scope A: `sidebar-fluency-acquiring` (training-cost). Originally proposed second: `trial-first-session-sidebar` (purchasing-window, E-IGNITION evaluator) — **deferred to M&PMF program 2026-04-27 per Gate 2 Scope A decision.**
- [ ] **JTBD additions** — 3–4 cross-cutting JTBDs (system-recognition + affordance predictability + panel-blame data-provenance + trust-the-stack cross-product consistency); the latter two surfaced by Gate 2 outside-lens.
- [ ] **Framework lifecycle extension** — add `system-coherence audit` as a recognized scope classification in `docs/design/LIFECYCLE.md`.

### 5.2 Gate 4 deliverables (preview, subject to Gate 2/3 refinement)

- New artifact: `docs/design/surfaces/sidebar-shell-spec.md` (or `surfaces/sidebar-design-language.md`) — cross-zone vocabulary, status semantics, affordance index, element-family map, attention budget.
- Updates to all 5 zone artifacts (Z0, Z2, Z3, Z4 + overview) to reference the shell spec for shared concepts.
- Update `docs/SIDEBAR_DESIGN_PRINCIPLES.md` R-1.5 to cite the shell spec as the canonical affordance index (closes the dangling reference).

### 5.3 What this is NOT

- **Not a sidebar re-rebuild.** SR-0..SR-7 + STP-1 work is preserved; this is additive specification, not structural redesign.
- **Not a code refactor mandate.** Code changes flow from Gate 4 spec; some violations may be left in place if Gate 4 decides the cost-benefit doesn't merit churn.
- **Not blocked on completing every zone.** Shell spec can be authored first, with per-zone reconciliation following as separate Gate 4 work items.

---

## Change log

- 2026-04-27 — Created. Gate 1 entry for owner-flagged sidebar holistic coherence pass.
