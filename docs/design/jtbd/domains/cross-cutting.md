# JTBD Domain — Cross-Cutting

Jobs that span multiple surfaces and don't belong to any one domain — undo, recovery, search, accessibility, notifications.

**Primary personas:** All.

**Surfaces:** every surface, via shared primitives (Toast, navigation, state recovery).

---

## CC-01 — Undo a recent destructive action

> When I take a reversible destructive action (clear seat, delete player), I want undo within a reasonable window, so misclicks don't cost data.

- Partial: retro-link undo is gold standard; clear-player lacks undo.

## CC-02 — Recover from app crash without data loss

> When the app crashes or reloads, I want my in-flight data (hand, session, draft) intact, so I continue without reconstruction.

- Partial: drafts covered; in-flight hand state recovery partial.

## CC-03 — Navigate views without losing in-progress input

> When I navigate between views, I want in-progress input (form fields, search queries) preserved, so navigation doesn't cost data.

## CC-76 — Instant undo with no confirmation for hot paths

> When I take a hot-path action (tap an action button), I want instant undo available for a few seconds, so speed wins over safety-rail friction.

## CC-77 — State recovery to exact position after crash

> When the app crashes mid-hand, I want state recovered to exactly where I was (current street, selected seat, pending action), so I don't re-enter.

## CC-78 — Unified search across hands / players / sessions

> When I search for anything, I want one search box that finds hands, players, and sessions, so I don't pick a tab first.

- State: **Proposed**.

## CC-79 — Navigation that returns to prior position

> When I drill from summary to detail and back, I want to return to exactly where I was in the summary, so deep-dives don't cost navigation tax.

## CC-80 — Configurable alerts / notifications

> When the app needs to alert me (tilt warning, session milestone, staker push), I want configurable channels, so I'm not spammed or missed.

- State: **Proposed**.

## CC-81 — Accessibility modes (color-blind, low-light)

> When I have color-vision limits or I'm in a dim card room, I want accessibility modes (color-blind-safe palette, low-light theme), so I can actually read the UI.

- State: **Proposed** (DISC-P01).

## CC-82 — Trust-the-sheet (lineage-stamped reference artifacts)

> When I look at a piece of content the app generated for me — whether a printed laminated card, an on-screen chart, or a range table — I want to know the numbers derive from a specific util + theory citation + assumption bundle, so I can rely on it with the same confidence I rely on live advice, and so I can audit the claim if I ever doubt it.

- State: **Active** (pending Printable Refresher Gate 4 + cross-project adoption for other reference surfaces over time).
- **Primary personas:** All study-inclined personas. Load-bearing for [Chris](../../personas/core/chris-live-player.md) (owner who directs the codebase and wants engine-refresher parity) and [Scholar](../../personas/core/scholar-drills-only.md) (lineage as trust-differentiator vs market competitors).
- **Autonomy constraint:** lineage is **mandatory**, not optional (red line #12 per Printable Refresher Gate 2 audit). No anonymous content. The 7-field lineage footer (card ID + version + generation date + source util path + engine version + theory citation + assumption bundle) is structural — cards that cannot produce a full footer fail CI and do not print.
- **Mechanism:**
  - Build-time static content: manifest snapshot of `sourceUtils[].contentHash` baked into artifact at build.
  - Runtime dynamic content: `paramFingerprint` (rake + stakes + stack snapshot) computed at render.
  - Both flow into unified lineage object; rendered as 2-line 9pt footer on print, as tap-to-expand drill-down in-app.
  - CI test (`contentDrift.test.js`, RT-108 pattern from EAL) recomputes hashes; mismatch without `schemaVersion` bump fails CI.
- **Served by:** `src/utils/printableRefresher/lineage.js` (PRF); analogous lineage pipelines in future projects that adopt the pattern.
- **Distinct from:**
  - **MH-12** (live-cited assumption trust bridge) — MH-12 is in-moment "why should I trust this claim?" for live advice; CC-82 is asset-level "where did this content come from?" for reference artifacts. Both inform trust; different time scales.
  - **DS-58** (validate-confidence-matches-experience) — DS-58 is calibration (predicted-vs-observed); CC-82 is provenance (what source generated this). A card can have correct lineage (CC-82 passes) and uncalibrated claim (DS-58 fails); they are separable dimensions.
- Doctrine basis: Printable Refresher Gate 2 audit §Stage E autonomy red line #12 + Voice 5 §D6 lineage pipeline spec; `docs/projects/printable-refresher.project.md` §Working principle #6 (lineage visible).

## CC-83 — Know-my-reference-is-stale (staleness surfacing for engine-derived artifacts)

> When the rake, range, theory-citation, or heuristic that an engine-derived artifact depends on has changed in the app since I last consumed the artifact (printed a card, screenshot-ted a chart, downloaded an export), I want the app to surface that staleness passively — so I know when to refresh without being nagged.

- State: **Active** (pending Printable Refresher Gate 4).
- **Primary personas:** Primary for [Chris](../../personas/core/chris-live-player.md) (owner accumulating printed artifacts over time); extends to any user who carries app-generated content outside the app.
- **Autonomy constraint:** staleness is **passive** (red line #10 per Printable Refresher Gate 2 audit). No push notifications, no app-icon badge, no "X days since re-print" nag counter, no urgent-banner patterns. Absence of refresh is not a failure state. Owner-controlled cadence — system surfaces, owner decides.
- **Mechanism:**
  - Owner stamps `printedAt` date at print time (per-batch; per-card inherited). Persisted in IDB `printBatches` store.
  - Each artifact in a batch snapshots `engineVersion` + `sourceHash` at consume time.
  - In-app per-artifact view computes diff: current engine output vs consume-time snapshot.
  - Shows: "No changes" / "Math unchanged; exception clause updated DATE" / "Stale: rake assumption changed DATE — refresh recommended."
  - Batch-level informational banner on refresher home (never interrupt, never badge).
- **Anti-nag guarantees:**
  - No push notifications.
  - No app-icon badge counter.
  - Owner can suppress per-artifact staleness flags durably (red line #13 inheritance).
  - "Reprint" / "refresh" is always a button, never a nag.
- **Served by:** `src/utils/printableRefresher/staleness.js` (PRF); analogous staleness-diff pipelines in future projects that adopt the pattern.
- **Distinct from:**
  - **CC-80** (configurable alerts / notifications) — CC-80 is opt-in push for transient events; CC-83 is passive surfacing of persistent-state drift. CC-83 default is no-channels-at-all; CC-80 requires an explicit channel choice.
  - **DS-52** (retention maintenance) — DS-52 is skill-decay over time; CC-83 is content-drift over time. DS-52 measures user state; CC-83 measures content state. Parallel concepts, different subjects.
- Doctrine basis: Printable Refresher Gate 2 audit §Stage E autonomy red line #10 + Voice 4 §Know-stale spec + Voice 5 §D7 content-drift CI; `docs/projects/printable-refresher.project.md` §Working principle #6 (lineage visible) + PRF-NEW-3 charter.

## CC-88 — Have the app observe my usage honestly and transparently

> When the app collects telemetry about my usage — which screens I visit, which features I use, how long I dwell, where I get frustrated — I want to know exactly what is collected and transmitted, to have a visible one-tap off-switch, and to be able to opt out per-event when I want to, so I'm never observed silently and never forced into a data-collection bargain I didn't understand.

- State: **Active** (pending Monetization & PMF Gate 4 + Q8 verdict for default behavior).
- **Primary personas:** All users. Acute for [Evaluator](../../personas/core/evaluator.md) (consent posture is load-bearing in first-run — the evaluator has not yet agreed to anything). Also [Chris](../../personas/core/chris-live-player.md) (owner directing the codebase; knows exactly what's tracked).
- **Autonomy constraint:** load-bearing for **red line #9** (incognito observation mode non-negotiable — inherited from `chris-live-player.md` §Autonomy constraint). Also binds red lines #1 (opt-in enrollment), #2 (full transparency on demand), #4 (reversibility).
- **Mechanism:**
  - First-launch transparency panel (Gate 4 surface `telemetry-consent-panel.md`) shows: what categories are collected (usage events, session replays, error tracking, feature flags), what is NOT collected (no PII, no poker-result dollar amounts, no hand-level content), and a one-tap off-switch per category.
  - Under Q8=B (opt-out with transparency — recommended starting position), default is on with panel always visible; user can turn any category off at any time.
  - Settings → Telemetry panel (always accessible in ≤2 taps) mirrors first-launch panel, allows reversibility at any time.
  - Per-event incognito toggle: any feature that writes a telemetry event can be used in an "incognito" mode that generates no telemetry record (parallel to the EAL Tier 0 observation capture incognito toggle — red line #9 structural pattern).
  - Anonymous ID by default; becomes identified only on account creation. Uninstalling or clearing IDB wipes the anonymous ID.
  - Telemetry transmission fails silently (no error surfacing to user) — missing data is not the user's problem to debug.
- **Anti-nag guarantees:**
  - No push notifications about telemetry state (red line #5).
  - No badge counter on telemetry settings.
  - No "turn telemetry back on" re-prompt after user has opted out.
  - Off-switch is always one tap away, never hidden behind confirmation dialogs ("Are you sure you want less data?" is forbidden copy).
- **Served by:** `surfaces/telemetry-consent-panel.md` (Gate 4); `src/utils/telemetry/` (Gate 5) wraps PostHog with the consent gating pattern.
- **Distinct from:**
  - **CC-80** (configurable alerts / notifications) — CC-80 is opt-in push channels for transient events; CC-88 is passive observation of usage behavior. Different data flow: CC-80 is app → user; CC-88 is user → app (silently, unless disclosed).
  - **CC-82** (trust-the-sheet / lineage) — CC-82 is content provenance (where did this artifact come from?); CC-88 is observation transparency (what data about me is being collected?). Both are trust-primitives; different subjects.
  - **CC-83** (know-my-reference-is-stale) — CC-83 is content-state drift surfacing; CC-88 is data-collection disclosure. Parallel patterns, different domains.
  - **SA-66** (transparent billing + easy pause) — SA-66 is billing transparency; CC-88 is data-collection transparency. Both inherit red line #2.
- Doctrine basis: Monetization & PMF Gate 2 audit §Stage E red line #9 + charter §Q8 telemetry consent default + `chris-live-player.md` §Autonomy constraint red line #9 (incognito observation mode non-negotiable — promoted to persona-level invariant 2026-04-24 by Exploit Anchor Library Gate 3). Inherits directly; applied to commerce-UX telemetry context.

## CC-87 — Tilt detection + break suggestion

> When my session behavior indicates tilt (variance spikes, stop-loss breaches, abnormal sizings), I want a nudge to take a break, so I save money.

- State: **Proposed** (DISC-01).

## CC-89 — Mixed-games framework (PLO / stud)

> When I play non-NLHE formats, I want the same framework support (ranges, exploits, drills), so I'm not locked to Hold'em.

- State: **Proposed** (DISC-17, deferred).

## CC-90 — System-recognition / cross-element fluency

> When I see an indicator anywhere in the sidebar (or, by extension, anywhere in the app), I want its visual treatment to map to a single concept-class I already know — so I don't have to re-decode the same idea per zone or per surface.

- State: **Active** (pending Sidebar Holistic Coherence Gate 4 shell spec).
- **Primary personas:** [Multi-Tabler](../../personas/core/multi-tabler.md), [Online MTT Shark](../../personas/core/online-mtt-shark.md), [Hybrid Semi-Pro](../../personas/core/hybrid-semi-pro.md), [Apprentice](../../personas/core/apprentice-student.md). **Acute** for the [sidebar-fluency-acquiring](../../personas/situational/sidebar-fluency-acquiring.md) situational, where re-decoding cost is paid up-front and not amortized.
- **Pre-condition framing:** This is the JTBD the *other* glance JTBDs depend on. `JTBD-MH-01` (see recommended action), `JTBD-MH-09` (street + pot awareness), and every other mid-hand glance presupposes that the user knows what kind of element they are looking at without reading it. Until CC-90 is served, no glance JTBD can be reliably audited — every "glance failed" finding is ambiguous between *bad glance design* and *unfamiliar visual language*.
- **Mechanism:**
  - Sidebar shell spec (Gate 4 of SHC) declares one canonical visual treatment per cross-zone concept-class. Doctrine v3 **R-1.6** (treatment-type consistency) makes the rule binding on Stage 4 specs and Stage 6 PRs.
  - Each cross-zone concept (confidence, freshness, status, locked, unknown, priority) declares its treatment-type — exactly one of `{dot, badge, opacity-modulated value, text label, icon}` — in the shell spec's element-family map.
  - Cross-zone re-occurrences re-use the declared type. New treatment-types added by a panel without prior cross-zone audit fail the Stage 6 PR gate per R-1.6.
  - Color-as-signal isolation (D-2 forensics) is a shell-spec concern (deferred from doctrine v3 under Option II); each color token maps to exactly one concept-class within the sidebar.
- **Anti-nag / anti-clutter guarantees:**
  - No tooltips on first hover to compensate for incoherence; coherence is the teaching mechanism, not annotations.
  - No legends or keys rendered alongside elements; the vocabulary must be small enough to be remembered, not looked up.
  - Vocabulary minimalism is mandatory — adding a sixth shape-class for an existing concept is a violation, not an enhancement.
- **Served by:** sidebar shell spec (`surfaces/sidebar-shell-spec.md` provisional, Gate 4 of SHC); `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1 R-1.6 (binding rule).
- **Distinct from:**
  - **CC-91** (predictable affordance vocabulary) — CC-91 is about *interaction outcomes* of affordance shapes (chevron-vs-underline-vs-badge); CC-90 is about *concept identity* of indicators (dot-vs-opacity-vs-badge for the same concept). Both cover visual coherence, different sub-spaces. A sidebar can satisfy CC-91 (chevron always navigates) while violating CC-90 (confidence rendered three ways).
  - **ON-83** (first-hover jargon explanations) — ON-83 covers *terminology* fluency (MDF, SPR); CC-90 covers *visual-language* fluency (dot semantics). Disjoint failure modes; both contribute to total decoding cost.
  - **H-N6** (recognition rather than recall, heuristic) — CC-90 is the user-outcome side of the same property H-N6 names from the framework side. Heuristic is the auditor's lens; JTBD is the user's outcome.
- Doctrine basis: SHC Gate 1 audit §3.2 + Gate 2 Stage B finding B2.a + doctrine v3 §1 R-1.6 (`docs/SIDEBAR_DESIGN_PRINCIPLES.md`); cited forensics D-1 (`render-orchestrator.js:150-151,169` + `:442-444,450` + `render-tiers.js:70-74`).

## CC-91 — Predictable affordance vocabulary

> When I see an affordance shape (chevron, underline, badge, dot, pill, divider) anywhere in the sidebar, I want it to mean the same interaction outcome wherever it appears — so I can act on it without re-checking what tapping it will do.

- State: **Active** (pending Sidebar Holistic Coherence Gate 4 shell spec; concretizes existing doctrine **R-1.5**).
- **Primary personas:** [Multi-Tabler](../../personas/core/multi-tabler.md), [Apprentice](../../personas/core/apprentice-student.md), [Hybrid Semi-Pro](../../personas/core/hybrid-semi-pro.md). **Acute** for the [sidebar-fluency-acquiring](../../personas/situational/sidebar-fluency-acquiring.md) situational, where misprediction of a tap outcome costs a re-glance plus reorientation.
- **R-1.5 dangling-reference framing:** Doctrine R-1.5 references an "SR-4 spec index" of affordance vocabulary that has never been authored. CC-91 is the user-outcome that the missing index would serve. The Gate 4 shell spec **becomes** the SR-4 spec index by reference (SHC Gate 1 §5.1; SHC Gate 2 Stage E finding E2). Authoring the spec closes the dangling reference and makes R-1.5 enforceable.
- **Mechanism:**
  - Sidebar shell spec declares the licensed affordance vocabulary — small, bounded set (target ≤6 shapes). Each shape declares its **single** licensed interaction outcome (e.g., chevron → in-place expansion; underline → cross-zone navigation; badge → ambient state, no interaction).
  - R-1.5 binds Stage 4 specs to the vocabulary; ad-hoc affordances (a chevron that navigates instead of expanding; an underline that has no click handler) fail the Stage 6 PR gate.
  - Drill-down expansion location is also bound: in-place by default per R-1.5; non-in-place expansions (modal, navigation away from sidebar) require explicit justification in the element's Stage 4 spec.
- **Anti-nag / anti-clutter guarantees:**
  - No `cursor: pointer` on non-interactive elements; visual interactivity must match real interactivity.
  - No "click here" labels appended to compensate for unclear affordances; the affordance must speak for itself per the vocabulary.
  - No on-hover preview popovers used as a substitute for predictable affordance-to-outcome mapping.
- **Served by:** sidebar shell spec (Gate 4 of SHC); `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1 R-1.5 (binding rule, originally added 2026-04-12 v2; CC-91 is its outcome-side framing).
- **Distinct from:**
  - **CC-90** (system-recognition / cross-element fluency) — see distinction in CC-90 above.
  - **CC-79** (navigation that returns to prior position) — CC-79 covers *navigation outcome predictability* across views; CC-91 covers *affordance-to-outcome predictability* before tapping. CC-91 is about the prediction; CC-79 is about the recovery if the navigation does happen.
  - **R-1.5 directly** — R-1.5 is the binding rule (auditor-facing); CC-91 is the user-outcome (user-facing). Same property, two framings.
- Doctrine basis: SHC Gate 1 audit §3.2 + Gate 2 Stage B finding B2.b + `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1 R-1.5 (originally added 2026-04-12 v2; cited "SR-4 spec index" reference becomes the shell spec under SHC Gate 4).

## CC-92 — Panel-blame / data-provenance (in-the-moment runtime blame routing)

> When the sidebar (or app) gives me an unexpected read or recommendation, I want to identify which zone or data source produced it — so I know whether to trust the next hand's advice and which subsystem to mistrust if I caught a wrong call.

- State: **Active** (pending Sidebar Holistic Coherence Gate 4 shell spec; mechanism pass deferred to Gate 3 architectural inventory).
- **Primary personas:** [Multi-Tabler](../../personas/core/multi-tabler.md), [Online MTT Shark](../../personas/core/online-mtt-shark.md), [Hybrid Semi-Pro](../../personas/core/hybrid-semi-pro.md). **Acute** for [Apprentice](../../personas/core/apprentice-student.md) (their reasoning learning loop depends on attributing wrong reads to the right cause). Secondary for the [sidebar-fluency-acquiring](../../personas/situational/sidebar-fluency-acquiring.md) situational (panel-blame is how they recover from misreads cheaply).
- **Behavioral framing:** When the sidebar's Z3 recommendation says BET 65% but the user calls and shows down a clear value-bet, the user's next action depends on diagnosis: was the recommendation wrong because (a) Z2's player tendency model was stale, (b) Z4's villain-style model overrode it, (c) the underlying engine produced the wrong call, or (d) an architectural disagreement between zones produced the surface output. The user cannot improve their use of the sidebar without being able to **route blame to a zone**.
- **Mechanism:**
  - Sidebar shell spec declares per-recommendation **provenance affordance**: each Z3 recommendation can be drilled down to the zones / data sources it derived from (Z2 player model, Z4 villain style, engine version + game-tree branch).
  - Zone-level health signals (R-1.7 staleness shape-class) communicate freshness state of each zone independently — so the user can read "Z2 stale + Z3 confident" as a coherence violation in the moment.
  - The Gate 3 **architectural observation pass** (SHC Gate 2 Stage E6 + Gate 2 §Required follow-ups) is the prerequisite: until each freshness signal is mapped to its computing code, triggering event, clearing condition, and timer, panel-blame at the user level is not implementable. Mechanism coherence is upstream of provenance affordance.
- **Anti-nag / anti-clutter guarantees:**
  - Provenance is **on-demand, not always-on**. The Z3 recommendation does not bear a permanent "derived from Z2 + Z4" tag; the affordance is drill-down per R-1.5 (chevron → in-place expansion).
  - No blame-language in copy; the affordance reports source, not fault. ("Derived from Z2 player model (live) + Z4 villain style (stale 17s)" — neutral.)
  - No automatic retraction of recommendations that diverge from a stale source; the user decides whether to discount.
- **Served by:** sidebar shell spec (Gate 4 of SHC); SHC Gate 3 architectural observation pass (`docs/design/audits/2026-04-27-blindspot-sidebar-holistic-coherence.md` Required follow-ups Gate 3, item 5).
- **Distinct from:**
  - **CC-82** (trust-the-sheet / lineage-stamped reference artifacts) — CC-82 is **asset-level** provenance (where did this printed card come from?), used at study time. CC-92 is **runtime** blame routing (which zone produced this live read?), used in the heat of decision. Same trust-primitive family; different time scale, different surface (artifact vs ambient indicator), different recovery action (audit later vs discount now).
  - **MH-12** (live-cited assumption trust bridge) — MH-12 is the *outcome* of provenance: the user, having seen the source, trusts or discounts the claim. CC-92 is the **affordance** that lets MH-12 happen. CC-92 must be served before MH-12 can be served for sidebar recommendations.
  - **CC-83** (know-my-reference-is-stale) — CC-83 is staleness surfacing for **artifacts the user takes outside the app** (printed cards, exported PDFs). CC-92 includes staleness as one provenance dimension but is broader (source identity, version, derivation chain) and applies in-app.
- Doctrine basis: SHC Gate 2 audit Stage B finding B5 + Gate 2 §Required follow-ups Gate 3 item 5 (architectural observation pass as prerequisite); `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1 R-1.7 *Caveat* (mechanism coherence is shell-spec concern, not closed by R-1.7 alone).

## CC-93 — Trust-the-stack / cross-product consistency (sidebar↔OnlineView)

> When the sidebar gives me one read and the main-app OnlineView gives me a different read for the same hand and same villain, I want to know which one is more current — so I can pick a side instead of being paralyzed by disagreement.

- State: **Active** (pending Sidebar Holistic Coherence Gate 4 shell spec + cross-product extension stage; partner surface `surfaces/online-view.md` will receive coherence-extension note).
- **Primary personas:** [Hybrid Semi-Pro](../../personas/core/hybrid-semi-pro.md) — canonical user, moves between sidebar and main-app OnlineView within a single session by definition. Secondary for [Apprentice](../../personas/core/apprentice-student.md) (online variant) and the [sidebar-fluency-acquiring](../../personas/situational/sidebar-fluency-acquiring.md) situational (cross-product variants pay extra fluency tax until coherence extends).
- **Sync-degenerate framing:** Two surfaces in one product is a degenerate case of multi-device sync. The framework currently has no JTBD for "two surfaces disagree, which to trust." CC-93 is that JTBD; if the framework later adds true multi-device sync, CC-93 generalizes naturally.
- **Mechanism:**
  - Sidebar shell spec scoped to the sidebar in Gate 4 first; concept inventory (freshness, confidence, status, locked, unknown) authored to be **directly portable** to main-app surfaces (SHC Gate 2 Stage D finding D1).
  - Cross-product extension (later stage) extends the shell spec to `surfaces/online-view.md`, `surfaces/analysis-view.md`, `surfaces/hand-plan-layer.md`, `surfaces/bucket-ev-panel-v2.md`. Each main-app surface receives a "pending cross-product coherence extension" note in Gate 4; the actual extension is staged separately.
  - For runtime disagreement, each surface communicates its own freshness via the shape-class enumeration (R-1.7 dot/badge/strip). The user resolves disagreement by comparing freshness signals — *the more current source wins by default*; the user is not asked to adjudicate.
  - `designTokens.js` is the single source of truth for colors per memory; the shell spec describes **semantic mappings** onto existing tokens (Stage D finding D2), not parallel color systems.
- **Anti-nag / anti-clutter guarantees:**
  - No active "you may be looking at stale data" warnings when freshness differs between surfaces; the freshness signal on each surface is sufficient.
  - No automatic re-sync / refetch triggered by cross-surface disagreement; user controls cadence (consistent with CC-83 anti-nag posture).
  - No forced reconciliation modal ("Sidebar says X, OnlineView says Y, confirm which to keep"); reconciliation is implicit — the live one wins.
- **Served by:** sidebar shell spec (Gate 4 of SHC, cross-product extension stage); `surfaces/online-view.md`, `surfaces/analysis-view.md`, `surfaces/hand-plan-layer.md`, `surfaces/bucket-ev-panel-v2.md` (partner surfaces receiving coherence-extension note in Gate 4 per SHC Gate 2 Stage D finding D3).
- **Distinct from:**
  - **CC-90** (system-recognition / cross-element fluency) — CC-90 is *intra-sidebar* visual coherence; CC-93 is *cross-product* visual + data coherence. CC-90 is the prerequisite (each surface internally coherent); CC-93 extends to between-surface coherence.
  - **CC-92** (panel-blame / data-provenance) — CC-92 is *intra-surface* blame routing (which zone of the sidebar produced this read?); CC-93 is *cross-surface* trust resolution (which of two surfaces is current?). Both are trust-primitives; different scopes (one zone vs many surfaces).
  - **CC-77** (state recovery to exact position after crash) — CC-77 is recovery from crash (state lost); CC-93 is reconciliation of two live, valid-but-divergent states. Distinct mechanisms (recovery vs reconciliation).
  - **CC-80** (configurable alerts / notifications) — CC-80 is opt-in push for transient events; CC-93 is passive display of source-currency. Different data flow (app→user vs surface↔surface).
- Doctrine basis: SHC Gate 2 audit Stage B finding B6 + Stage D findings D1 + D2 + D3; `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1 R-1.6 + R-1.7 (intra-sidebar foundation that cross-product extension builds on).

---

## Domain-wide constraints

- Undo windows vary by action risk — higher risk = longer window, more visible affordance.
- State recovery requires draft-store discipline applied consistently (see PEO-1).
- Accessibility touches every surface and can't be retrofit cheaply — bake into surface templates.

## Change log

- 2026-04-21 — Created Session 1b.
- 2026-04-24 — Added CC-82 (trust-the-sheet / lineage-stamped reference artifacts) + CC-83 (know-my-reference-is-stale / staleness surfacing). Output of Gate 3 for Printable Refresher project. Both JTBDs are cross-project patterns (not PRF-specific) — other projects shipping engine-derived reference artifacts (Range Lab, Study Home, anchor-library cards, line-study sheets) inherit the same doctrine. See `docs/design/audits/2026-04-24-blindspot-printable-refresher.md` (Gate 2) + `docs/projects/printable-refresher.project.md` §Working principles #2 + #6.
- 2026-04-24 — Added CC-88 (have-the-app-observe-my-usage-honestly-and-transparently). Output of Gate 3 for Monetization & PMF project. Cross-project pattern — any future project installing telemetry, session replay, or usage tracking inherits the same consent-gating + incognito-per-event + off-switch-always-visible pattern (mirrors red line #9 from `chris-live-player.md` §Autonomy constraint, promoted to persona-level invariant by EAL Gate 3). Q8 owner verdict determines default behavior (opt-in vs opt-out-with-panel vs tier-dependent). See `docs/design/audits/2026-04-24-blindspot-monetization-and-pmf.md` (Gate 2) + `docs/projects/monetization-and-pmf.project.md` §Q8.
- 2026-04-27 — Added CC-90 (system-recognition / cross-element fluency), CC-91 (predictable affordance vocabulary), CC-92 (panel-blame / data-provenance — in-the-moment runtime blame routing), CC-93 (trust-the-stack / cross-product consistency — sidebar↔OnlineView). Output of Gate 3 deliverable #2 of Sidebar Holistic Coherence project (Scope A, fluent-user / training-cost only). Pairs with new situational persona [sidebar-fluency-acquiring](../../personas/situational/sidebar-fluency-acquiring.md). All four are cross-cutting per Gate 2 Stage B finding B4 (apply to main-app surfaces too); sidebar is the immediate scope, main-app extension follows in Gate 4 cross-product stage. See `docs/design/audits/2026-04-27-entry-sidebar-holistic-coherence.md` + `docs/design/audits/2026-04-27-blindspot-sidebar-holistic-coherence.md` + `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1 R-1.6 + R-1.7 (doctrine v3, 2026-04-27).
