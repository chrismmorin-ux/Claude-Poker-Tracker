# Situational Sub-Persona — Sidebar Fluency-Acquiring

**Type:** Situational (cross-persona)
**Applies to:** [Multi-Tabler](../core/multi-tabler.md) (primary) + [Apprentice](../core/apprentice-student.md) (secondary). Any persona that uses the extension sidebar during the **first ~20–50 hours of sidebar exposure**, before spatial memory and visual-language fluency are established.
**Evidence status:** PROTO — authored Gate 3 of Sidebar Holistic Coherence project (2026-04-27); not yet observed in practice
**Last reviewed:** 2026-04-27
**Owner review:** Pending

---

## Snapshot

The user is learning to *glance* at the sidebar while live play continues. They have not yet built the spatial memory the existing Multi-Tabler persona assumes; they are building it. Each new indicator must be **decoded**, not recognized — and decoding happens under the same time pressure that fluent users glance under, because the tables don't pause to teach.

The characteristic moment: a recommendation badge appears in Z3 with a confidence treatment the user has seen *somewhere else* in the sidebar (Z2 header, or Z4 tier list). They cannot tell whether it is the same concept rendered differently or a different concept entirely. They re-read both. The decision clock is still ticking.

This persona is the **survivorship-bias defense** for the sidebar audit cast. Multi-Tabler is fluent-expert; Newcomer is *defined out* of the sidebar; no situational covered the acquisition phase before this file. Violations that hurt only first-50-hour users were invisible to every audit prior to SHC Gate 1 (2026-04-27).

---

## Situation trigger

- Any user with `< ~50 hours` of cumulative sidebar session time (or `< ~2,000 hands observed via sidebar`, whichever is reached first). Threshold is approximate; see proto caveat [SFA1].
- Equivalently, any session where the user's interaction patterns indicate they are **decoding-then-acting** rather than **glancing-then-acting** — e.g., observable hover/dwell on indicators, repeated sub-second focus shifts back to the same element, drill-down opens that close without action.
- Exits when: spatial memory and visual-language fluency are sufficient that decoding latency drops below the glance budget (≤1s per element per R-1.2). At that point the user transitions to the steady-state Multi-Tabler / Apprentice mode.
- **Note:** Exit is not binary. A user may be fluent on Z0/Z2 and still acquiring on Z4; this persona applies per-zone, not globally. The shell spec authored in Gate 4 should reduce per-zone acquisition cost by making fluency in one zone **transferable** to others.

---

## Context

- **Venue:** Online (Ignition primary; ACR/GG via inherited Multi-Tabler context). Apprentice variant: any online stake; lower table count (1–4 tables).
- **Format:** Cash or tournament; sidebar is the constraint, not the format.
- **Device:** Desktop (sidebar is desktop-only). Phone usage: not applicable.
- **Time pressure:** **High and unforgiving.** Same as Multi-Tabler steady-state — 3–8 seconds per decision across 1–8 tables. The teaching moment and the decision moment are the same moment; the sidebar does not get a tutorial pass.
- **Attention:** Divided — table action + sidebar decoding + (for Multi-Tabler variant) other tables' action queues all compete.
- **Cognitive load:** **High.** Decoding visual language + applying it + acting on it, concurrently. Distinct from Apprentice's core profile, which has growing visibility tolerance off-table; here the off-table runway does not exist because the sidebar only exists during play.
- **Emotional framing:** Frustration-prone if first impressions reveal incoherence (yellow-means-three-things, two-zones-show-staleness-differently). Frustration is silent — the user does not file a bug report; they re-decode, lose tempo, and may attribute the cost to themselves ("I'm slow at this") rather than to the surface.

---

## Goals

- **Build durable visual-language fluency as quickly as possible** — ideally inside the first 20 hours, ceiling at 50.
- **Each newly-encountered element teaches them something transferable** — learning what a yellow dot means in Z0 should also tell them what a yellow dot means in Z2 / Z3 / Z4.
- **Predict drill-down behavior before tapping** — chevron-vs-underline-vs-badge each map to one consistent interaction outcome.
- **Recover from misreads cheaply** — a misread should cost a re-glance, not a full re-orientation of the zone.
- **Reach steady-state Multi-Tabler / Apprentice operation** with the lowest possible cumulative training cost.

## Frustrations

- **Same concept rendered differently across zones.** Confidence as colored dot in one place, opacity-modulated value in another, sample-size badge in a third. Forces the user to learn three patterns for one concept. Cited in **D-1** (`render-orchestrator.js:150–151,169`, `:442–444,450`, `render-tiers.js:70–74`).
- **One color encoding many concepts.** `#fbbf24` (yellow) means trust-marginal, action-call, priority-medium, M-zone-2, and warning across `shared/design-tokens.js` (lines 31, 47, 61, 77, 94). The user cannot rely on yellow-as-signal because yellow is not a signal — it is whatever the local panel decided. Cited in **D-2**.
- **Same concept rendered with different shape-class.** Staleness as colored dot in Z0 vs aging text-badge ("Stale 23s") in Z2. The user who learns one cannot recognize the other as the same concept-class. Cited in **D-3**.
- **Affordance ambiguity.** Chevron vs underline vs badge vs dot each appear in multiple zones with different click outcomes (drill-down vs navigation vs no-op vs ambient). User must memorize per-element behavior rather than a vocabulary.
- **No in-product affordance to reduce decoding cost.** Sidebar has no help layer (overview §3 acknowledges "no direct rule — sidebar is not documented in-product"); decoding is on the user.
- **The cost is silent.** Re-reads do not produce errors that the framework's existing telemetry catches; they produce slower decisions and lower-quality plays. The fluency-acquiring user is the cost-center the existing audit cohort can't see.

## Non-goals

- **In-product tutorial / product tour.** Onboarding domain (ON-82..88) covers tour patterns; this persona is *post-tour*. They have decided to use the sidebar; they need it to teach via consistency, not via guided walkthrough.
- **Documentation reading.** They will not pause live play to consult docs. Fluency must come from the surface itself.
- **A simpler sidebar.** They want the full sidebar; they want it to be coherent.
- **Coaching content.** Apprentice variant has coach-mediated drill flow off-table; that flow is unrelated to sidebar-fluency acquisition.

---

## Constraints specific to this persona

- **Time pressure:** Same as Multi-Tabler steady-state (3–8 seconds per decision). The acquisition tax must come out of *that* budget; no extra time is granted.
- **Error tolerance:** **Lower than fluent steady-state.** A misread for a fluent user costs a quick re-glance; a misread for an acquiring user can cost a full re-decode of the zone, plus re-validation of which concept the indicator was supposed to signal. Per-error cost is multiplied by ~3–10× for the same surface violation.
- **Visibility tolerance:** **Low for novel patterns; high for repeated patterns.** A fifth distinct visual treatment for "freshness" is unreadable; the second occurrence of an already-learned pattern is free. The fluency-acquiring user is the strongest argument for **vocabulary minimalism** in the shell spec.
- **Recovery expectation:** Re-glance, not re-orient. A misread should not cost the user their place in the zone or their tempo on the table.
- **Fluency-transfer expectation:** Learning one zone's vocabulary should reduce the cost of learning the next. **This is the load-bearing design constraint.** A shell spec that does not deliver fluency-transfer fails this persona regardless of how internally consistent each individual zone is.

---

## What a surface must offer

1. **Single canonical visual treatment per concept-class across zones** — per **R-1.6** (treatment-type consistency, doctrine v3 §1). Confidence is *one* of {dot, badge, opacity-modulated value, text label, icon} sidebar-wide; never a mix. This is the doctrine entry point that protects this persona.
2. **Single canonical shape-class per freshness signal across zones** — per **R-1.7** (staleness shape-class consistency). Dot or badge or strip; never a mix.
3. **Bounded affordance vocabulary** — chevron / underline / badge / dot / pill / divider, each with a documented click outcome. The vocabulary is small (≤6 shapes per spec per **R-1.5**), and each shape's outcome is the same wherever it appears.
4. **Color-semantic isolation** — every color-as-signal maps to exactly one concept-class within the sidebar. (D-2 forensics; deferred from doctrine v3 to shell spec under Option II — see SHC Gate 2 Stage E6.) For this persona, the absence of this property is the single most expensive cost driver.
5. **Cross-zone vocabulary doc accessible to the auditor** (not the user) — the shell spec serves as the canonical reference. The persona's runtime surface is the sidebar itself, made teachable by coherence.
6. **Predictable drill-down expansion location** — per **R-1.5**: in-place by default; non-in-place expansions justified explicitly in spec. Surprise modal/navigation triggers from the sidebar are misreads-by-design for this persona.

## What a surface must NOT do

- **Introduce a new visual treatment for an existing concept-class** without amending the shell spec first. Each ad-hoc treatment doubles this persona's training cost for the affected concept.
- **Re-use a color token for a new semantic role** without the cross-zone audit required by R-1.6. Yellow-means-five-things (D-2) is the worst-case violation pattern.
- **Treat the sidebar as a teaching surface.** No tooltips on first hover (that pattern belongs to ON-83 main-app onboarding); no popovers; no walkthroughs. Coherence is the teaching mechanism, not annotations.
- **Optimize for already-fluent users only.** Multi-Tabler steady-state can absorb incoherence amortized over 1000+ hours; this persona pays the full cost up-front. A spec change that improves fluent-user glance cost by 5% but adds a new visual treatment may be net-negative when training cost is included.
- **Surface staleness, confidence, or status using a *new* shape-class** (R-1.7 enumeration: dot / badge / strip). Adding a fourth shape-class requires a doctrine amendment, not a panel decision.
- **Assume the user will read documentation.** This persona never sees `surfaces/`, `jtbd/`, `personas/`, or `SIDEBAR_DESIGN_PRINCIPLES.md`. They see the rendered sidebar at `localhost:3333` (in dev) or in their Chrome side panel (in prod).

---

## Related JTBD

- **CC-90** — system-recognition / cross-element fluency (primary; this JTBD is the operational definition of what this persona is trying to achieve)
- **CC-91** — predictable affordance vocabulary (primary; covers the drill-down-affordance leg of fluency)
- **CC-92** — panel-blame / data-provenance (secondary; arises during recovery from misreads — "which zone produced that wrong read?")
- **CC-93** — trust-the-stack / cross-product consistency (secondary; affects Apprentice variant who also uses the main-app OnlineView)
- `JTBD-MH-*` — mid-hand decision (the underlying execution JTBDs the user is trying to perform; this persona is the *pre-condition* that makes those JTBDs work)

## Related core personas

- [Multi-Tabler](../core/multi-tabler.md) — **primary parent.** First 20–50 hours of the Multi-Tabler journey. Steady-state Multi-Tabler is the exit condition for this persona.
- [Apprentice](../core/apprentice-student.md) — **secondary parent.** Apprentices who play online inherit this persona during their first sidebar exposure; their off-table runway helps off-table fluency-build (review of past sessions, etc.) but does not change the in-session constraint profile.
- [Online MTT Shark](../core/online-mtt-shark.md) — **tertiary parent.** Same constraint profile during sidebar acquisition; smaller cohort (single-table tournament focus) but same training-cost pattern.
- [Hybrid Semi-Pro](../core/hybrid-semi-pro.md) — **tertiary parent.** Hybrids acquiring sidebar fluency carry an extra cost: the sidebar's vocabulary must be reconciled against the main-app OnlineView's vocabulary. CC-93 is acute for this variant. The deferred sister situational `sidebar-online-view-context-switch` (SHC Gate 2 Stage A2) addresses this overlap if scoped.

## Related forensics (sidebar holistic coherence audit)

- **D-1** — confidence rendered three incompatible ways. Cited by **R-1.6** (doctrine v3). Code: `render-orchestrator.js:150-151, 169`, `:442-444, 450`, `render-tiers.js:70-74`.
- **D-2** — `#fbbf24` (yellow) serves 5 semantic roles in `shared/design-tokens.js` (lines 31, 47, 61, 77, 94). No R-rule cites D-2; substantive concern flows to Gate 4 shell spec as positive vocabulary.
- **D-3** — staleness rendered with two incompatible patterns + disjoint mechanisms. Cited by **R-1.7** (doctrine v3). Code: `render-orchestrator.js:1324-1342` vs `side-panel.js:1068-1087, 1093-1094`.

---

## Distinct from adjacent personas

- **Multi-Tabler (steady-state).** Multi-Tabler's 3–8s decision budget assumes recognition without decoding. This persona is the **decoding phase**. Same time budget, multiplied cognitive load. Multi-Tabler is the exit condition; this persona is the journey.
- **Newcomer.** Newcomer's persona file explicitly says *"Main app. No sidebar needed."* This persona is the user the framework had previously *defined out* of sidebar audits — it does not represent first-time-app users; it represents first-time-*sidebar* users, who may be experienced poker players already using the main app.
- **Returning-after-break (situational).** Returning-after-break addresses **re-acquisition** of skills that were once fluent (≥28 day gap). This persona is **first acquisition.** Different starting point: returning user has memory of prior conventions; this persona has none. Both benefit from coherent vocabulary, but the cost-benefit shape differs.
- **Trial-first-session (situational, M&PMF).** Trial-first-session is the **purchasing-window** Evaluator persona — 5–15 minute first impression that produces a buy/bounce decision. This persona is the **training-cost** Multi-Tabler persona — 20–50 hour learning window after the user has already committed. Routing decision logged in SHC Gate 2 (Scope A) and MPMF Decisions Log (2026-04-27): trial-first-session-sidebar belongs to MPMF, not SHC.

---

## Proto caveats

- **[SFA1]** The 20–50 hour acquisition window is a starting estimate. Basis: HUD-acquisition norms reported in Multi-Tabler-cohort poker forums + general motor-skill / pattern-recognition literature suggesting 50 hours of focused practice for novel visual-language fluency. **How to verify:** session-time telemetry post-launch, cross-referenced with sidebar-interaction patterns (hover/dwell, repeated focus shifts, drill-down close-without-action). Likely lower bound 10 hours, upper bound 100 hours; per-user variance high.
- **[SFA2]** Per-zone acquisition (not global) is the right granularity. Basis: sidebar zones encode independently-authored concepts (Z0 chrome, Z2 table-read, Z3 decision, Z4 deep-analysis); fluency in one is not load-bearing on the next under current design. **How to verify:** if shell spec succeeds, fluency-transfer should be observable — users who have used the sidebar for 20 hours but never opened Z4 should be faster on first Z4 exposure than users at hour zero. Without the spec, fluency-transfer is approximately zero.
- **[SFA3]** The cost is silent (no error telemetry catches re-decode latency). Basis: existing telemetry tracks decisions, not decoding time. **How to verify:** instrument sidebar element interaction with dwell/focus-shift telemetry post-shell-spec; compare acquisition curves before/after a coherence improvement.
- **[SFA4]** Multi-Tabler steady-state can amortize incoherence; this persona cannot. Basis: 1000+ hour amortization vs 20–50 hour acquisition is a 20–50× cost-rate difference. **How to verify:** post-launch acquisition-cohort analysis comparing first-50-hour decision-quality variance vs steady-state. (Decision quality is a proxy; misread frequency would be the direct measure.)

---

## Change log

- 2026-04-27 — Created. Gate 3 deliverable #1 of Sidebar Holistic Coherence project. Authored under Scope A (fluent-user / training-cost only). Pairs with CC-90, CC-91, CC-92, CC-93 in `docs/design/jtbd/domains/cross-cutting.md`. Defends survivorship-bias gap identified in SHC Gate 1 §2.3 finding 1 + SHC Gate 2 Stage A finding A3.
