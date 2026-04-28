# Surface — Sidebar Shell Spec (Cross-Zone Design Language)

**ID:** `sidebar-shell-spec`
**Surface role:** **Cross-zone reference** — declares the shared visual + interaction vocabulary that single-zone artifacts (Z0, Z2, Z3, Z4) reference for concepts that recur across zones (status, freshness, confidence, affordance vocabulary, color semantics, density rhythm, attention budget). Not a renderable surface; an authoritative reference document.
**Related docs:**
- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1 (binding rules — R-1.5 affordance vocabulary, R-1.6 treatment-type consistency, R-1.7 staleness shape-class consistency)
- `docs/design/audits/2026-04-27-entry-sidebar-holistic-coherence.md` (Gate 1 — establishes the missing-artifact gap)
- `docs/design/audits/2026-04-27-blindspot-sidebar-holistic-coherence.md` (Gate 2 — Scope A locked; outside-lens findings)
- `docs/design/audits/2026-04-27-observation-sidebar-coherence-inventory.md` (Gate 3 — visual catalog + architectural mechanism map)
- `docs/design/evidence/2026-04-27-sidebar-coherence-baseline.md` (Gate 3 closer — three load-bearing findings indexed)
- `docs/design/personas/situational/sidebar-fluency-acquiring.md` (the persona this spec defends)
- `docs/design/jtbd/domains/cross-cutting.md` §CC-90 (system-recognition), §CC-91 (affordance vocabulary), §CC-92 (panel-blame), §CC-93 (trust-the-stack)
- Per-zone surfaces: `sidebar-zone-0.md`, `sidebar-zone-1.md`, `sidebar-zone-2.md`, `sidebar-zone-3.md`, `sidebar-zone-4.md`, `sidebar-zones-overview.md`

**Product line:** Sidebar (Scope A). Cross-product extension to main-app surfaces (`online-view.md`, `analysis-view.md`, `hand-plan-layer.md`, `bucket-ev-panel-v2.md`) staged as a follow-up after this spec ships.
**Tier placement:** All sidebar tiers (Pro, Sidebar-Lite). The shell spec is binding regardless of which features are gated.
**Status:** **SCAFFOLD** — section structure present; vocabulary content pending. Authored as Gate 4 of SHC project, 2026-04-27. **Vocabulary-binding decisions deferred for owner direction** (see §0 below).

---

## §0 Authoring status and how to read this scaffold

This document is the **scaffold** — the section list and structural commitments. The actual vocabulary (which colors mean what, which shape-classes are licensed, which affordances map to which outcomes) is the design-binding work that follows.

The scaffold ships first because:
1. The **section structure** is determined by Gate 3 evidence (six concept-classes from the visual catalog: status, freshness, confidence, affordances, color semantics, density rhythm; plus the attention-budget map identified as missing in Gate 1 §4.2).
2. The **vocabulary content** requires owner direction on three decisions where Gate 3 surfaced multiple defensible options. Those decisions are flagged in this scaffold under §V — Open vocabulary decisions.
3. Per the SHC working note in `memory/project_sidebar_holistic_coherence.md`: **doctrine v3 binds Stage 4 specs authored hereafter** but pre-existing zone artifacts (Z0, Z2, Z3, Z4) are *not* retroactively forced into compliance — remediation timing is a Gate 5 / backlog concern.

When this scaffold is filled in, the §V open-decisions section becomes resolved-decisions (with rationale); each §I–§VI section gains its vocabulary; per-zone artifacts get cross-references to the relevant sections.

---

## §I — Status / connectivity / pipeline-health vocabulary

**Concept-class:** `status` — does the system have what it needs to deliver advice right now?

**Coverage:** Z0 connection-status dot, Z0 app-status badge, Z0 pipeline-health strip, Z0 recovery banner (per `2026-04-27-observation-sidebar-coherence-inventory.md` §CC-A).

**Vocabulary content (pending — see §V open decisions):**
- Canonical visual treatment per status state (live / degraded / disconnected / fatal).
- Single-writer ownership rule for `#status-dot` className (resolves architectural finding A-A — dual-writer race between `buildStatusBar()` and `renderConnectionStatus()`).
- Relationship between connection-state, pipeline-health, and app-bridge state (clarifies CC-A-1 vs CC-A-3 vs CC-A-4 — three independent surfaces communicating connectivity-class state with no shared semantic key).

**Binding rules:** R-1.6 (treatment-type consistency).

---

## §II — Freshness / staleness vocabulary

**Concept-class:** `freshness` — how current is the data the user is looking at?

**Coverage:** Z2 stale-advice badge, Z0 disconnect dot transition, Z3 placeholder text, Z2 cards-strip blanking on hand-end (per inventory §CC-B).

**Vocabulary content (pending — see §V open decisions):**
- Canonical shape-class per mechanism-class. **R-1.7 alone is insufficient** (Gate 3 finding 2): the shell spec must specify mechanism-class (state-event-driven / timer-driven / state-derived / data-clearing-timer) so two zones using the same shape-class don't diverge in clearing behavior.
- Resolution for Finding F-8: stale-but-was-live vs clean-between-hands currently render identically (`betweenHands` and `temporal-staleContextTimeout` screenshots are visually indistinguishable). Decision: surface a distinguishing signal, or accept the conflation?
- Aging-counter discipline: when does a stale signal show a counter (e.g., "Stale 23s")? Always for timer-driven; never for state-event-driven? Or owner-configurable?

**Binding rules:** R-1.7 (staleness shape-class consistency) + R-1.7 *Caveat* on mechanism coherence.

---

## §III — Confidence / sample-size / model-quality vocabulary

**Concept-class:** `confidence` — how much should the user trust the engine output?

**Coverage:** Z2 unified header confidence dot, Z2 context strip opacity classes, Z4 glance-confidence dot+label, Z3 stat-chip sample suffix, Z3 inline stats without confidence treatment (per inventory §CC-C).

**Vocabulary content (pending — see §V open decisions):**
- Canonical visual treatment for `mq.overallSource`. **D-1 forensic** (Gate 3 finding 1): three rendering patterns currently consume the same upstream — pure presentational consolidation. Hand2Note precedent (LEDGER COMP-H2N) suggests two-tier typographic ladder (value font ≠ sample-count font) as discriminator that doesn't compete for any other channel.
- Resolution for lexical inconsistency (Finding F-6): `n=45` vs `45h` — same concept, different text format across zones. Pick one form sidebar-wide.
- Treatment for confidence on stats *not* derived from `mq.overallSource` (e.g., `cachedSeatStats[*].sampleSize` for stat-chip suffix at CC-C-4) — is this the same vocabulary or a parallel one?
- White-as-marginal precedent (GTO Wizard, LEDGER COMP-GTOWIZARD): candidate addition to status-color vocabulary.

**Binding rules:** R-1.6 (treatment-type consistency).

---

## §IV — Affordance vocabulary (drill-down + interaction)

**Concept-class:** `affordance` — how does the user know what's clickable and what tapping it will do?

**Coverage:** Chevron expandable sections, sub-section headers with chevron-right, navigation links with underline, action button colors, tappable seat-arc circles, stat-chip pin affordances, decorative glyphs (star, diamond, bullets) (per inventory §CC-D).

**Vocabulary content (pending — see §V open decisions):**
- **Closes R-1.5 dangling reference** to "SR-4 spec index" — this section *is* the spec index for sidebar affordances.
- Bounded affordance vocabulary: enumerate licensed shapes (target ≤6) — chevron / underline / badge / dot / pill / divider — with one canonical interaction outcome per shape.
- Resolution for Finding F-5 affordance-discipline bimodality: some clickable elements over-signpost (chevron + header), others under-signpost (seat-arc circle, stat-chip pin). Pick a rule: every clickable element bears a visual affordance, OR document the licensed exceptions (pin-by-click on stat chips is a distinct affordance class).
- Resolution for chevron direction inconsistency (CC-D-1 down=collapsed vs CC-D-2 right=collapsed). Pick one convention.
- Decorative-vs-semantic glyph enumeration (Finding F-7): bound the licensed glyph vocabulary to prevent drift.
- GTO Wizard precedent (LEDGER COMP-GTOWIZARD + COMP-CROSS-PATTERNS Vocabulary Divergence E): hover=preview, click=filter, hotkey-mirroring as model for affordance discipline.

**Binding rules:** R-1.5 (glance pathway + affordance vocabulary).

---

## §V — Color semantic isolation

**Concept-class:** `color-semantics` — every color-as-signal maps to exactly one concept-class.

**Coverage:** Yellow `#fbbf24` × 7 design-token roles + 2 status-dot uses + M-token-bundle reused for fold% gradient (per inventory §CC-C, §CC-E, §CC-F + Cross-cutting Finding F-3; D-2 forensic).

**Vocabulary content (pending — see §V open decisions):**
- Per-color-token canonical concept-class assignment. Each token name should match its use-site semantic; reuse for unrelated concepts requires a rename or a new token.
- Resolution path for `#fbbf24` semantic overload: candidate is to **introduce additional named tokens** (e.g., `connectivity-warning` distinct from `confidence-marginal` distinct from `priority-medium`) so that each use-site reads from a token whose name matches its meaning, even if the underlying hex collides for now.
- Resolution path for M-token-bundle reuse: `render-street-card.js:908` should consume a new fold-percentage token bundle rather than reaching for `m-green/m-yellow/m-red`.
- GTO Wizard precedent: strictly semantic color discipline (red=bet/raise, green=check/call, white=marginal, black=not-in-range — same hue, same meaning across every panel). Aspirational; sidebar may not converge to this strictness in v1.

**Binding rules:** None at doctrine level (Option II deferral, doctrine v3 §11 amendment log) — the substantive concern lives here as positive vocabulary.

---

## §VI — Density rhythm + attention budget

**Concept-class:** `density-rhythm` — how tightly information packs; which zone wins the eye in which state.

**Coverage:** Per inventory §CC-F + Gate 1 §4.2 missing artifact "Attention budget" — currently no documented hierarchy of zone-by-zone eye-priority under different states.

**Vocabulary content (pending — see §V open decisions):**
- Row-height + padding + gap conventions per zone-tier (Z0 chrome, Z2 advice header, Z3 decision content, Z4 deep analysis).
- Typography ladder enumeration (font-sizes 24px / 14px / 11px per `design-tokens.js:104`; weight tiers; color tiers).
- Attention-budget map: which zone owns the user's eye in {active hand, between hands, error, tournament context} — explicit ranking.
- DriveHUD precedent (LEDGER COMP-DRIVEHUD): profile-segmented density. **Likely deferred** to a future iteration; v1 ships a single density rhythm.
- GTO Wizard precedent (LEDGER COMP-GTOWIZARD): product-level density ladder (compact/medium/large + 4 layouts) as user-controlled setting. **Likely deferred** to v2; v1 ships a single setting.

**Binding rules:** Doctrine §10 retained un-amended (visual design / colours / fonts / exact sizes are per-element-spec scope). The attention-budget map is structural, not visual.

---

## §V (open decisions) — Vocabulary decisions deferred for owner direction

The following decisions are **flagged for owner direction** before content authoring proceeds. Each has a default-recommended option but is open for owner override:

### V-1 — Color overhaul scope
**Question:** Does §V (color semantic isolation) ship as (a) **rename-only** (new tokens that resolve naming collisions, hex unchanged for v1; rename allows future hex change without breaking semantics), (b) **rename + selective hex change** (e.g., split confidence-marginal hex from m-yellow hex even if both stay yellow-ish), or (c) **full GTO-Wizard-style discipline** (every color is strictly one semantic; some hex changes mandatory)?
**Recommended default:** (a) rename-only for v1. Lowest risk, addresses the *naming-vs-semantic* concern, leaves room for v2 hex revisions when downstream impact is measured.
**Why this is owner-blocking:** (b) and (c) impose code+CSS changes on every zone; (a) is doctrine-additive only.

### V-2 — Confidence treatment unification
**Question:** Pick one canonical pattern for `mq.overallSource`. Options: (a) **dot-only** (matches CC-C-1 + CC-C-3; remove opacity treatment), (b) **opacity-only** (matches CC-C-2; remove dots), (c) **dot+typographic-ladder** (Hand2Note-style: dot + value-font / sample-count-font two-tier).
**Recommended default:** (c) dot+typographic-ladder. Dot is recognizable from existing usage; typographic ladder adds a channel that doesn't compete with color-semantic isolation work in §V.
**Why this is owner-blocking:** (a) requires removing CSS classes used in Z2 context strip; (b) requires removing dot DOM in Z2 + Z4; (c) requires CSS authoring for the typographic ladder. Each touches a different code surface.

### V-3 — Stale-but-was-live vs clean-between-hands disambiguation
**Question:** Finding F-8: `betweenHands` and `staleContextTimeout` render identically despite different mechanisms. Options: (a) **accept conflation** (stale-context-timeout is a degenerate between-hands; user diagnosis via diagnostics if needed), (b) **distinguishing badge** ("session timed out — last data N minutes ago" small ambient label), (c) **distinct color treatment** (slightly amber-tinted "Waiting…" text after timeout).
**Recommended default:** (a) accept conflation for v1. Diagnostic affordance already exists ("show diagnostics" link); building a new visual signal for an edge state introduces risk.
**Why this is owner-blocking:** Touches whether v1 introduces a new visible state at all.

### V-4 — Attention budget formality
**Question:** §VI attention-budget map — is this v1 content or v2 content? Options: (a) **v1 — explicit ranked list** (zone priority per state documented), (b) **v1 — descriptive only** (note the missing artifact, defer formal ranking), (c) **v2 — defer entirely**.
**Recommended default:** (b) descriptive-only for v1. Per Gate 1 §4.2 the attention budget is a known gap; ranking it formally requires evidence not yet gathered (telemetry on actual eye-flow patterns).
**Why this is owner-blocking:** (a) commits the spec to ranked priorities that may be wrong; (c) leaves a Gate 1 gap unaddressed.

### V-5 — Cross-product extension timing
**Question:** Per Gate 2 Stage D finding D1, the shell spec is **scoped to the sidebar first**, with concept inventory authored to be **directly portable** to main-app surfaces. When does the cross-product extension happen? Options: (a) **same Gate 4 session** (extend now), (b) **follow-up Gate 4 session within same project** (Gate 4 splits into 4a-sidebar + 4b-main-app), (c) **separate project** (file a new audit; main-app extension is its own SHC-style scope).
**Recommended default:** (c) separate project. Main-app surfaces have their own per-surface specs that didn't go through SHC Gate 1 / Gate 2 — extending sidebar vocabulary to them is a scope-defined system-coherence audit on its own (newly registered scope class per `LIFECYCLE.md` 2026-04-27 update).
**Why this is owner-blocking:** (a) and (b) commit Gate 4 to substantially more work; (c) ships sidebar shell spec cleanly and lets main-app extension be re-scoped on its own merits.

---

## What this spec does NOT cover

- **Per-element exact pixel sizes / fonts / hex values for new tokens.** Doctrine §10 retains visual-design as per-element-spec scope; this shell spec carries *concept-class vocabulary*, not pixel-level visual design.
- **FSM behavior of individual panels.** Doctrine §2 (FSM rules R-2.*) governs lifecycles; shell spec governs vocabulary used by those FSMs to communicate state.
- **Rendering pipeline architecture.** Doctrine §5 (FSM-exclusive ownership R-5.6, etc.) and §10 (R-10.* payload invariants) govern that layer.
- **First-impression / E-IGNITION / purchasing-window concerns.** Routed to Monetization & PMF program per SHC Scope A lock (2026-04-27).
- **Implementation rollout plan.** Gate 5 work; staged across multiple PRs each citing the shell spec section they bring into compliance.

---

## Cross-references that follow when this scaffold is filled

When §I–§VI carry vocabulary content, the following updates land in tandem:

- **`docs/SIDEBAR_DESIGN_PRINCIPLES.md` R-1.5** — update "small, consistent vocabulary declared in the SR-4 spec index" reference to cite this shell spec as the canonical SR-4 spec index.
- **`docs/design/surfaces/sidebar-zone-0.md`** — cross-reference §I (status vocabulary) + §II (freshness vocabulary) for Z0 elements 0.3 (connection state), 0.9 (pipeline health).
- **`docs/design/surfaces/sidebar-zone-1.md`** — cross-reference §IV (affordance vocabulary) for seat-arc click semantics.
- **`docs/design/surfaces/sidebar-zone-2.md`** — cross-reference §I + §II + §III + §V for unified header dot, stale-advice badge, context-strip opacity, action-badge colors.
- **`docs/design/surfaces/sidebar-zone-3.md`** — cross-reference §III + §IV + §V + §VI for stat chips, hand-plan affordances, fold-curve color gradient, weakness annotation.
- **`docs/design/surfaces/sidebar-zone-4.md`** — cross-reference §III + §IV for glance-tier confidence, expandable section affordances.
- **`docs/design/surfaces/sidebar-zones-overview.md`** — cross-map heuristic table updated with `sidebar-shell-spec` link as the canonical cross-zone reference.

## Change log

- 2026-04-27 — Created as **SCAFFOLD**. Gate 4 deliverable of Sidebar Holistic Coherence project. Section structure (§I–§VI) determined by Gate 3 evidence (six concept-classes from visual catalog + attention-budget gap from Gate 1). Vocabulary content deferred — five owner-blocking decisions flagged in §V open-decisions. **Status remains SCAFFOLD until §V resolved and §I–§VI filled.** Per-zone surface cross-references staged in companion comment but not yet applied (depend on resolved vocabulary).
