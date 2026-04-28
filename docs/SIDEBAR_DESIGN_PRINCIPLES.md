# Sidebar Design Principles Doctrine

**Program:** Sidebar Rebuild (SR-0 → SR-7) — Stage 2 artifact
**Master plan:** `C:\Users\chris\.claude\plans\composed-fluttering-snowflake.md`
**Forensics:** `.claude/projects/sidebar-rebuild/00-forensics.md` (symptoms S1–S5, mechanisms M1–M8)
**Status:** APPROVED by owner 2026-04-12 (all 5 sign-off decisions approved; amendments to R-7.3 and R-7.1 applied per owner recommendation acceptance). **Second amendment round approved 2026-04-12** — UX-model reframe: R-1.2 revised, R-1.5 added, R-1.3 rationale reinforced. **Third amendment round approved 2026-04-27** — Cross-zone consistency invariants: R-1.6 (treatment-type consistency) added, R-1.7 (staleness shape-class consistency) added; token-semantic-isolation proposal deferred to shell spec. **Fourth amendment round approved 2026-04-28** — Mechanism coherence: R-1.8 (freshness-mechanism declaration + behavioral invariants INV-FRESH-1..5) added. **Fifth amendment round approved 2026-04-28 (later same day)** — Token-semantic isolation: R-1.9 (color-token concept-class isolation + INV-TOKEN-1..5 behavioral invariants) added; closes the D-2 forensics gap that v3 deferred to shell spec by promoting it to binding doctrine rule. **Sixth amendment round approved 2026-04-28 (third edit same day)** — Affordance vocabulary discipline: R-1.5 text amended to cite shell-spec §IV explicitly (closes the dangling SR-4-spec-index reference); R-1.10 added (affordance vocabulary + INV-AFFORD-1..5 behavioral invariants). **Seventh amendment round approved 2026-04-28 (fourth edit same day)** — Status concept-class discipline: R-1.11 added (status-vocabulary + INV-STATUS-1..5 behavioral invariants — single-writer per Z0 slot, severity monotonicity within render frame, no-lying-status, connected-waiting escalation, app-bridge staleness clearing). See §11 amendment log.
**Date:** 2026-04-28
**Doctrine version:** 7 (v1 = initial approval; v2 = UX-model reframe, 2026-04-12; v3 = cross-zone consistency invariants, 2026-04-27; v4 = mechanism coherence, 2026-04-28; v5 = token-semantic isolation, 2026-04-28; v6 = affordance vocabulary discipline, 2026-04-28; v7 = status concept-class discipline, 2026-04-28)

---

## §0 Purpose and binding force

This document is the rulebook every sidebar panel specification (Stage 4) and every rebuild PR (Stage 6) must obey. A spec or PR that violates a rule here is rejected unless the rule itself is first amended in this document with owner approval.

Rules are stated in the form **R-<section>.<n>**. Every rule cites the sealed forensics symptom(s) or mechanism(s) it exists to prevent. A rule without such a citation is speculative and must not be added.

The doctrine is binding on:
- Stage 3 — Panel Inventory & Purpose Audit (every row evaluated against these rules)
- Stage 4 — Per-element design specs (every spec references which rules it satisfies)
- Stage 5 — Render architecture audit (keep/refactor/replace decisions driven by rule compliance)
- Stage 6 — Rebuild PRs (each gate is a rule from this document)
- Stage 7 — Cutover (runtime monitoring measures rule compliance %)

---

## §1 Hierarchy rules

**Intent:** Fixed visual hierarchy zones; layout never reorganizes on data updates. Research: real-time dashboards that re-rank or re-order content on update become unreadable (Smashing Magazine 2025-09). Domain precedent: PokerTracker 4 and Hand2Note HUDs hold layout constant and vary only value/color.

- **R-1.1** The sidebar is partitioned into named **zones**. Each zone has a fixed vertical extent and a fixed set of elements it may contain. Zones do not move, resize, or re-order on data change.
  - *Prevents:* S5 (aggregate churn). *Constrains:* Stage 3 inventory must assign every element to exactly one zone.

- **R-1.2** Every visible element occupies a **spatially remembered location** declared in its Stage 4 spec. Element count is not capped by this rule. Every element must pass the **glance test**: its top-level summary is readable in under 1 second by a user with established spatial memory of the layout. Elements that fail the glance test at their remembered location are split into a glance-summary plus in-place drill-down, not deleted.
  - *Prevents:* S5 (element reflow under data change); glance-target loss from unstable layout.
  - *Derived from:* owner's clarification of actual use pattern (2026-04-12): "targeted glance with spatial memory," not "simultaneous scan." The Smashing Magazine 5-metric cap applies to displays users *read*; the sidebar is not read, it is *glanced*. Spatial stability and per-element glance-targetability are the dominant constraints.
  - *Amendment (2026-04-12, owner-approved, v2):* Removes the former 5-metric hard cap. Replaces with spatial-stability + glance-test requirements. The original rule's intent (prevent overload) is preserved through the glance test, which is a per-element check rather than a whole-view cap. Prior text:
    > v1: "At most 5 primary metrics are visible in any one view at one time. A 'primary metric' is an element the user must read to make the next decision. Everything else is progressive disclosure (click/hover/expand)."

- **R-1.3** Within a zone, element order is **declared in the spec and does not change at runtime**. If data is absent, the element renders its empty/stale state in place — it does not collapse or allow neighbours to shift up.
  - *Prevents:* S5, S1 (seat churn). *Rejects:* any renderer that conditionally omits an element and reflows neighbours.
  - *Rationale (2026-04-12, v2):* This rule exists because the sidebar's primary use pattern is **targeted glance with spatial memory** (see R-1.2 amendment). Any reflow breaks the glance pathway for every neighbour element, not just the one that changed — a single absent datum that collapses its slot corrupts the user's spatial memory for the entire zone below it.

- **R-1.4** Zone boundaries are visually explicit in the DOM (distinct container elements with fixed CSS contracts). Cross-zone layout leakage (e.g. one zone's content overflowing into another) is a spec violation.

- **R-1.5** Every element declares a **glance pathway** in its Stage 4 spec with four components:
  1. **Remembered location** — which zone + which position in the zone (e.g. "Z3 street-card, action-history row, column 1").
  2. **Default summary rendering** — the content shown at the remembered location in the element's normal state, readable in <1 second.
  3. **Drill-down affordance** — if deeper detail is available, the visual pattern that invites the click (chevron, underlined text, tap target). Affordances are drawn from the closed-vocabulary enumeration declared in `docs/design/surfaces/sidebar-shell-spec.md` §IV (formerly the unauthored "SR-4 spec index" — closed by V-affordance walkthrough 2026-04-28); the same visual pattern means the same interaction everywhere in the sidebar. **R-1.10 binds the behavioral invariants** (vocabulary exclusivity, no-lying-affordances, direction consistency, keyboard reachability, dot-shape concept-class exclusivity).
  4. **Drill-down expansion location** — where the expanded content renders. Default is **in place** (same zone, expanding the element's own footprint within the fixed slot height per R-1.3). Non-in-place expansions (e.g. modal, navigation) must justify the deviation.
  - *Prevents:* ad-hoc affordances that break the pathway (e.g. a chevron that looks like expansion but actually navigates; an underline that looks navigable but has no click handler); drill-downs landing in unexpected locations, disorienting the user.
  - *Derived from:* owner's use-pattern clarification (2026-04-12, v2). Under targeted-glance, the pathway from "I need X" to "I see X" must be stable and predictable; ambiguous affordances force the user to abandon spatial memory and re-scan, which breaks the model.
  - *Added (2026-04-12, owner-approved, v2).*

- **R-1.6** Within the sidebar, any data concept that is rendered in two or more zones (or two or more elements within a single zone) MUST use the **same visual treatment type** — exactly one of: colored dot, colored badge, opacity-modulated value, text label, icon. A concept rendered as `dot` in one location and `opacity-class` in another is a spec violation.
  - *Prevents:* D-1 — confidence rendered three incompatible ways (Z2 unified header `render-orchestrator.js:150–151, 169` uses `confidence-dot green/yellow/red`; Z2 context strip `render-orchestrator.js:442–444, 450` uses opacity classes `conf-player`/`conf-mixed`/`conf-population` modulating data-value brightness; Z4 glance tier `render-tiers.js:70–74` uses `confidence-dot` with inline `n=` sample label). Divergence exists *within Z2*, not just across zones — the opacity-class form is invisible to anyone scanning for "confidence" because it modulates the value's brightness with no legend.
  - *Constrains:* Stage 4 specs must declare the treatment type for each cross-zone concept. Cross-zone re-occurrences of the concept must re-use the declared type. New treatment-types added by a panel without prior cross-zone audit fail the Stage 6 PR gate.
  - *Authoritative declarations:* `docs/design/surfaces/sidebar-shell-spec.md` is the cross-zone treatment-type registry. Resolved as of 2026-04-27: §III (confidence concept-class → dot + typographic ladder treatment, V-2 owner-approved). Other concept-classes register their treatment-type in this spec as their corresponding V-decisions land.
  - *Does NOT prescribe:* which colors, fonts, or sizes are used. Per §10, those remain per-element-spec / shell-spec scope. R-1.6 governs only the *category* of treatment.
  - *Added (2026-04-27, owner-approved, v3); shell-spec citation added 2026-04-27 (later same day) when V-2 §III resolved.*

- **R-1.7** Every staleness or freshness signal across all zones MUST use a consistent shape-class — drawn from the doctrine's affordance vocabulary index (R-1.5 references; SR-4 / shell-spec authoritative). Until the vocabulary index is authored, the canonical shape-classes are: **dot** (state-derived freshness), **badge** (timer-driven aging), **strip** (zone-level health). A panel that introduces a fourth pattern is a spec violation.
  - *Prevents:* D-3 — staleness rendered with two incompatible patterns and no shared parent. Z0 pipeline-health (`render-orchestrator.js:1324–1342`) uses colored dot (`status-dot yellow/green/red`) + status text, no aging counter, state derived from `pipeline.tableCount` + `handCount`. Z2 stale advice (`side-panel.js:1068–1087`) uses `.stale-badge` text element appended to `action-bar` with aging counter ("Stale 23s") or recomputing label, threshold-driven (10s + street-mismatch), refreshed per-second via `coordinator.scheduleTimer('adviceAgeBadge', …)` (`side-panel.js:1093–1094`). A user who learns "yellow dot = stale data" from Z0 will not recognize "Stale 23s" text badge in Z2 as the same concept-class.
  - *Constrains:* Stage 4 specs must select one of the canonical shape-classes for any freshness signal. New shape-classes require a doctrine amendment (i.e., extension of the canonical enumeration via §11).
  - *Does NOT prescribe:* the colors of the dot, the typography of the badge, the position within the zone, or the timer/triggering mechanism. R-1.7 governs the *shape-class*; mechanism consistency is a shell-spec concern (see deferred SHC item).
  - *Caveat:* R-1.7 is shape-class-consistency only. Two zones can comply with R-1.7 (both using `dot`) and still diverge architecturally — Z0 dot is state-derived, Z2 stale signal could be timer-driven — producing different *behavior* under the same shape. The Sidebar Holistic Coherence audit (`docs/design/audits/2026-04-27-blindspot-sidebar-holistic-coherence.md` Stage E6) flagged mechanism coherence as a Gate 3 / shell-spec concern; **R-1.8 (added v4, 2026-04-28) closes this gap at the doctrine level.**
  - *Added (2026-04-27, owner-approved, v3). Originally proposed as R-1.8 in `.claude/projects/sidebar-rebuild/08-doctrine-amendment-proposal-r16-r17-r18.md`; renumbered to R-1.7 for sequential rule ordering after the proposed R-1.7 (token-semantic isolation) was deferred to the shell spec under Option II.*

- **R-1.8** Every freshness/staleness signal MUST register a complete **mechanism declaration** in the shell-spec freshness-signal registry, AND MUST satisfy five behavioral invariants (INV-FRESH-1..5). A signal whose registry entry is missing OR whose runtime behavior violates any INV-FRESH-* clause is a spec violation and fails the Stage 6 PR gate.
  - *Mechanism declaration* — every freshness signal declares, in the shell-spec §II registry table, a tuple `{shape, mechanism, compute, clearedBy, scope, coordinatorTimer?}`:
    - **shape** ∈ {`dot`, `badge`, `strip`} per R-1.7.
    - **mechanism** ∈ {`state-event-driven`, `timer-driven-aging`, `state-derived-per-render`, `data-clearing-timer`}. Enumeration is closed; new mechanism classes require a doctrine amendment.
    - **compute** — the function that classifies the signal (e.g., `classifyFreshness()` in `render-staleness.js`). Single source of truth; no inline re-derivation at call sites.
    - **clearedBy** — the named event(s) that transition the signal out of its non-fresh state(s) (e.g., `hand:new`, `table:switch`, `advice:fresh`, `connection:reestablished`).
    - **scope** ∈ {`perHand`, `perTable`, `session`} — the lifetime of the signal's underlying state. Must match a corresponding entry in `STATE_FIELD_SCOPES.md`.
    - **coordinatorTimer** (when `mechanism` is timer-driven) — the named timer registered via `coordinator.scheduleTimer(name, ...)` per RT-60 contract. Raw `setInterval` / `setTimeout` are forbidden.
  - **INV-FRESH-1 (Scope ownership):** Every freshness signal is tagged with a scope that matches the lifetime of the data it reports. A `perHand` signal must have a corresponding `STATE_FIELD_SCOPES.md` entry with the same scope; mismatch is a spec violation.
  - **INV-FRESH-2 (Single clearing path per scope):** A signal clears on exactly the path that owns its scope — `perHand` signals clear at `hand:new` (R-2.4); `perTable` signals clear in `clearForTableSwitch`; `session` signals clear on connection-state events. No ad-hoc `set(field, null)` outside these paths.
  - **INV-FRESH-3 (Same-frame commit):** When a clearing event fires, all freshness signals in that scope MUST update in the same render frame — no deferred writes, no out-of-band DOM mutations. This prevents the race where one zone shows `live` while another shows `stale` for the same underlying fact.
  - **INV-FRESH-4 (Non-competing writers):** Each freshness signal's DOM slot has exactly one writer — declared in the registry. Multi-writer slots (the architectural finding A-A `#status-dot` dual-writer at `render-orchestrator.js:1324` + `side-panel.js:198-218` is the canonical existing violation) are spec violations and must be resolved before the signal is registered. Lint-enforced via `dom-mutation-discipline.test.js`.
  - **INV-FRESH-5 (Rejection is visible):** When the system rejects incoming data (RT-68 advice rejection, RT-69 pending-buffer clear, SW reanimation replay rejection), the resulting state transition MUST surface a freshness signal that is distinct from "data never arrived." Falling silently to a generic `unknown` after a rejection is non-compliant — a `rejected` variant is required when the upstream-rejection event is observable to the coordinator.
  - *Prevents:* the architectural gap left by R-1.7 *Caveat* — two zones complying with R-1.7 shape-class but diverging in clearing behavior under the same shape, producing user-visible contradictions for the same underlying fact. Also prevents the recurrence pattern documented in `.claude/failures/STATE_CLEAR_ASYMMETRY.md` (11 historical incidents) by mandating scope registration + same-frame commit.
  - *Constrains:* Stage 4 specs must include a §II registry table entry for every freshness signal they introduce. Stage 6 PR gate verifies (a) registry entry exists, (b) `STATE_FIELD_SCOPES.md` entry exists for `scope`, (c) `coordinator.scheduleTimer` registration exists for any `timer-driven-*` mechanism, (d) `dom-mutation-discipline.test.js` passes (single-writer enforcement).
  - *Companion test infrastructure:* `freshness-signal-registry.test.js` (parallel to `state-clear-symmetry.test.js`) parses the §II registry table and asserts each declared signal has matching code-level registrations. Test infrastructure is part of R-1.8's enforcement; ships when R-1.8 lands.
  - *Does NOT prescribe:* the visual appearance of dots/badges/strips (per §10 visual-design exclusion), the threshold values (per-element-spec scope), or which clearing event a signal binds to (per-signal author choice from the closed `clearedBy` event vocabulary).
  - *Forensics origin:* surfaced by SHC Gate 3 architectural pass (`docs/design/audits/2026-04-27-observation-sidebar-coherence-inventory.md` Part 2 §CC-B + Cross-cutting Finding F-2) and ratified by SHC V-3 5-specialist roundtable (2026-04-28). cto-agent specialist explicitly proposed lifting R-1.7 *Caveat* to a binding rule; failure-engineer specialist contributed INV-FRESH-1..5 as the enforceable behavioral surface.
  - *Added (2026-04-28, owner-approved, v4).*

- **R-1.9** Every color hex value rendered by the sidebar MUST be sourced from a single declaration in `ignition-poker-tracker/shared/design-tokens.js` and consumed via either a `var(--{concept-class}-...)` CSS variable reference OR a named JS import from that file. Inline hex literals at any render site (CSS rule body in `.html`/`.css` files; JS template literals; inline style assignments) are spec violations. Every token name MUST be **concept-class-prefixed** (`--qtr-*` quality-tier reserved; `--cat-*` categorical; `--m-zone-*` tournament M-ratio; `--fold-pct-*` fold-percentage; `--fresh-tier-*` freshness; `--conf-tier-*` confidence; `--surface-*`; `--text-*`; etc.). No two distinct concept-class tokens may share an identical hex value at the *resolved-CSS-variable* level — even when they share an underlying primitive hex, they MUST resolve through distinct CSS variable names so that a future hex divergence is a one-line token change.
  - **INV-TOKEN-1 (Single source of truth):** Every hex value rendered by the extension is traceable to exactly one entry in `shared/design-tokens.js`. No hardcoded hex literals are permitted in any other file. Lint-enforced by a grep test that scans all non-token files for `#[0-9a-fA-F]{3,6}` patterns and asserts zero matches outside comments and test fixtures.
  - **INV-TOKEN-2 (Concept-class exclusivity):** Each token key belongs to exactly one concept-class declared in the §V registry (or in `shared/design-tokens.meta.js` companion file). No token key may serve two concept-classes. Lint-enforced by a registry test that asserts the meta file is complete and non-overlapping.
  - **INV-TOKEN-3 (Var-literal audit):** Any `var(--token-name)` string literal in JS code (template literals, inline styles, classNames) must reference a token key that exists in the current TOKENS object. Lint-enforced by a test that extracts all `var(--...)` occurrences from JS files and asserts each resolves to an existing token.
  - **INV-TOKEN-4 (Mirror-lock):** `ignition-poker-tracker/shared/design-tokens.js` and `src/constants/designTokens.js` (main-app token file) MUST agree on the hex value for every token key they share. Lint-enforced by a cross-file test that imports both and diffs their shared keys; non-shared keys are permitted (one file may have tokens the other doesn't).
  - **INV-TOKEN-5 (Style-color single-source):** Categorical style chip colors (Fish/LAG/TAG/Nit/LP/Reg/Unknown) have exactly one hex declaration in `shared/design-tokens.js`. The `STYLE_COLORS` export from `shared/stats-engine.js` is a re-export wrapper around the canonical `STYLE_TOKENS` declaration; it does not hold parallel hex values. Lint-enforced by a test asserting `STYLE_COLORS[style].text === --cat-style-{style}-text` resolved CSS variable value.
  - *Prevents:* D-2 forensics — `#fbbf24` serving 7 design-token roles + 2 status-dot CSS class uses + M-token-bundle reuse for fold-percentage gradient at `render-street-card.js:908`. Plus the pre-existing STYLE_COLORS / STYLE_TOKENS hex divergence (Fish text `#fca5a5` in stats-engine.js:328 vs `#fb923c` in design-tokens.js:138 — same conceptual key, different hex; CSS consumers and JS consumers see different colors today).
  - *Constrains:* Stage 4 specs that introduce new color signals must declare the token in `design-tokens.js` + the meta file + reference via concept-class-prefixed name. Stage 6 PR gate verifies (a) no inline hex outside `design-tokens.js`, (b) every JS `var(--...)` reference resolves to an existing token, (c) cross-file mirror parity, (d) STYLE_COLORS / STYLE_TOKENS single-source.
  - *Companion test infrastructure:* `design-token-registry.test.js` (parallel to `freshness-signal-registry.test.js`) parses `shared/design-tokens.js` + `shared/design-tokens.meta.js` and asserts INV-TOKEN-1..5. `token-concept-class-collision.test.js` asserts no two distinct concept-class tokens share a hex without distinct CSS variable names. Mirror-lock test imports both `shared/design-tokens.js` and `src/constants/designTokens.js` and diffs shared keys. Test infrastructure ships with the rule, not "later."
  - *Does NOT prescribe:* the per-element pixel choice of which color to use for which surface — that remains per-element-spec scope per §10. R-1.9 governs the *token-system structure* (one source of truth, concept-class isolation, no inline hex), not the per-element visual choice.
  - *Forensics origin:* surfaced by SHC Gate 3 architectural pass (D-2 findings) and ratified by SHC V-color-tokens 5-specialist roundtable (2026-04-28). cto-agent specialist proposed R-1.9 candidate; failure-engineer specialist contributed INV-TOKEN-1..5; product-ux-engineer specialist contributed the Q4 perceptual analysis showing STYLE_TOKENS hue-overlap with quality-tier (TAG green / LP yellow / Fish red-pink) is V-1-violating in practice.
  - *Added (2026-04-28, owner-approved, v5).*

- **R-1.10** Every interactive element in the sidebar bears exactly one affordance shape from the closed-vocabulary enumeration declared in `docs/design/surfaces/sidebar-shell-spec.md` §IV. Every shape declares one canonical interaction outcome; the same shape used with a different outcome is a spec violation. Behavioral invariants INV-AFFORD-1..5 are binding.
  - **INV-AFFORD-1 (Vocabulary exclusivity).** Every interactive element bears exactly one §IV affordance shape. Zero-affordance elements (missing-affordance violation) and over-signposted elements (multiple affordance shapes for the same interaction) are spec violations. Lint-enforced via `affordance-registry.test.js`: parses fixture HTML output, identifies elements with click/keydown handlers, asserts each has exactly one `data-affordance` attribute referencing a registered shape.
  - **INV-AFFORD-2 (No lying affordances).** Every element bearing a §IV-vocabulary affordance signal has a registered event handler reachable from that element in the current FSM state. No `cursor: pointer`, no `role="button"`, no underline, no chevron glyph may appear on an element that has no active handler. Lint-enforced via `dom-mutation-discipline.test.js` extension.
  - **INV-AFFORD-3 (Direction consistency).** Chevron affordances are vertical-only: `▾` (`▾`) at collapsed; `▴` (rotated 180°) at expanded via the `.open` CSS class. The codebase already implements this contract uniformly at `side-panel.html:544, 613, 1240, 1266` — R-1.10 declares the existing-correct behavior to make it enforceable. Right-pointing chevrons (`▸`/`▹`/`▻`) outside `render-affordance.js` exception slots are spec violations. Lint-enforced via grep test on render-function output.
  - **INV-AFFORD-4 (Keyboard reachability).** Every element with a mouse click handler also has either (a) `<button>` or `<a>` native semantics, or (b) `role="button"` + `tabindex="0"` + a `keydown(Enter|Space)` companion handler. **Grandfathered exceptions** (current interactive `<div>` elements without keyboard wiring) are listed in an explicit allowlist in the test file with a documented Gate 5 milestone for full compliance — parallel to the freshness-signal-registry-test allowlist pattern.
  - **INV-AFFORD-5 (Dot-shape concept-class exclusivity).** Affordances DO NOT use a filled dot (CSS `border-radius:50%` with solid background) in any hue from the quality-tier pool (`#4ade80`, `#fbbf24`, `#f87171`, `#9ca3af`). Filled dots in those hues are reserved for §II freshness and §III confidence concept-classes per INV-TOKEN-2 (R-1.9). Selection / pin / active-state affordances use outline rings, pill highlights, or contrast-elevation — never a filled quality-tier dot. Lint-enforced via `token-concept-class-collision.test.js` extension.
  - *Affordance vocabulary (per §IV registry):* exactly six shapes, closed enumeration. Class A (visual-affordance-required): `chevron`, `underline`, `pill`. Class B (spatial-convention licensed exception): `circle` (closed list of 2: seat-arc + range-tab). Non-affordance: `divider` (structural separator), `decorative-glyph` (registry-managed semantic tag, closed enumeration of 4: ★ hero, ♦ blocker, ● weakness/severity, → hand-plan branch label). New shapes require doctrine amendment.
  - *Prevents:* CC-D-1..D-10 catalog of click-affordance bimodality (some elements over-signpost, others under-signpost); chevron direction inconsistency (Cross-cutting Finding F-5); decorative-glyph drift (Cross-cutting Finding F-7); accessibility regressions (zero `aria-expanded` outside one site at `side-panel.html:1692`); D-4 chevron CSS-class proliferation (4 parallel definitions for one concept); D-5 click-affordance signposting bimodality.
  - *Constrains:* Stage 4 specs that introduce interactive elements must declare the §IV shape used + ARIA mapping per shape. Stage 6 PR gate verifies (a) `data-affordance` attribute resolves to a registered shape, (b) handler reachability per INV-AFFORD-2, (c) keyboard-reachability per INV-AFFORD-4 (or grandfathered allowlist entry), (d) glyph codepoint scan per INV-AFFORD-3.
  - *Companion test infrastructure:* `affordance-registry.test.js` (parallel to `freshness-signal-registry.test.js` and `design-token-registry.test.js`). Asserts INV-AFFORD-1..5. Plus `dom-mutation-discipline.test.js` extension for INV-AFFORD-2 + INV-AFFORD-4. Test infrastructure ships with the rule, not "later."
  - *Does NOT prescribe:* the per-element pixel size of affordance glyphs, the exact keyboard navigation order, or the per-element ARIA label text. R-1.10 governs the *shape vocabulary + interaction-outcome mapping + behavioral invariants*, not per-element visual choice. ARIA role mappings per shape ARE prescribed (binding); per-element label content is per-element-spec scope.
  - *Forensics origin:* surfaced by SHC Gate 3 architectural pass (CC-D-1..D-10 + Cross-cutting Findings F-5 / F-6 / F-7) and ratified by SHC V-affordance 5-specialist roundtable (2026-04-28). systems-architect specialist contributed the 2D matrix (shape × outcome) framing; cto-agent specialist verified that the existing CSS chevron-rotation contract is uniform (resolving the apparent CC-D-1 vs CC-D-2 inconsistency as observational drift rather than real divergence) + proposed `data-affordance` attribute + single delegated listener pattern; senior-engineer specialist contributed the explicit Class B "spatial-convention licensed exception" framing; failure-engineer specialist contributed INV-AFFORD-1..5 as enforceable behavioral surface; product-ux-engineer specialist contributed the closed glyph registry of 4 + tap-target-full-row rule.
  - *Added (2026-04-28, owner-approved, v6).*

- **R-1.11** Every status indicator in the sidebar (connectivity / app-bridge / pipeline-stage health) is declared in the closed-vocabulary §I status registry in `docs/design/surfaces/sidebar-shell-spec.md` per a 3-axis decomposition (connection-state / app-bridge-state / pipeline-stage-health). Behavioral invariants INV-STATUS-1..5 are binding.
  - **INV-STATUS-1 (Single-writer per Z0 status slot).** Each status DOM slot (`#status-dot`, `#app-status`, pipeline-strip stages) has exactly one declared writer in `shared/render-status.js`. No other module, timer callback, or inline block in `renderAll` may assign that slot's className/textContent. Lint-enforced via `dom-mutation-discipline.test.js` extension that scans all JS files for `#status-dot` / `#app-status` writes outside `render-status.js`. **The current 5 contending writers** (`side-panel.js:198-218` renderConnectionStatus + `:785-794` updateStatusBar + `:1847-1848` staleContext block + `:2590-2593` updateStatusFromDiag + `harness.js:81` test-fixture) are all canonical violations; remediation per Gate 5 cadence with a grandfathered allowlist for the test-fixture-only path.
  - **INV-STATUS-2 (Severity monotonicity within a render frame).** Within a single `renderAll` invocation, status severity may only increase, never decrease. If `connState.cause === 'contextDead'` (fatal) is written to `#status-dot`, no subsequent code path in the same frame may downgrade the slot to a lower-severity tier. Enforced via a pre-render severity lock: `renderStatusDot()` accepts a severity ordinal and takes the maximum of all inputs before writing the DOM exactly once. Closes FM-STATUS-1 (silent severity downgrade — currently `:1847-1848` `staleContext` block can overwrite a `:1828` red dot to yellow in the same frame, lying about a fatal condition).
  - **INV-STATUS-3 (No-lying-status).** Every value in the closed enumeration of `connState.cause` (`connected` / `disconnect` / `contextDead` / `versionMismatch` plus future additions) MUST emit a defined dot class. Unrecognized cause values default to `degraded` tier (yellow) — never to silently retain the prior frame's class. Closes FM-STATUS-2 (`versionMismatch` at `side-panel.js:215-217` currently sets text but NOT className, leaving dot at prior color — fully lying status during version desync). Verified by a test that iterates the cause enum and asserts non-null dotClass for each entry.
  - **INV-STATUS-4 (Connected-waiting escalation).** When `tableCount > 0 && handCount === 0` (the `connected-waiting` state), the system MUST escalate to a distinct `connected-timeout` tier after a declared threshold (default 30 seconds; configurable per shell-spec §I). The timer is registered via `coordinator.scheduleTimer('connectedWaitingTimeout', ..., 30_000)` per RT-60 contract. Closes FM-STATUS-3 (indefinite-waiting trap — silently broken WebSocket produces yellow + "waiting for hands" forever).
  - **INV-STATUS-5 (App-bridge staleness clearing).** `lastGoodExploits` MUST declare a complete clearing event set in `STATE_FIELD_SCOPES.md`: at minimum `clearForTableSwitch` (already present) AND `connection:appDisconnected` (currently absent). Without the second clearing path, the "App synced" badge can persist indefinitely after an app crash mid-session — the only clearing event today is table switch. Closes FM-STATUS-5 (stale "App synced" invisibility).
  - *Closed enumeration of status concept-classes:* exactly 3 axes. **Connection state** (4 values: `live` / `degraded` / `disconnected` / `fatal`) → shape `dot` (`#status-dot`). **App-bridge state** (2 values: `synced` / `absent`) → shape `badge` (`#app-status` pill). **Pipeline stage health** (per-stage binary: `nominal` / `failed` for probe / bridge / filter / port / panel) → shape `strip` (`!hasHands` visibility-gated). New axes require doctrine amendment.
  - *Recovery banner classification:* the recovery banner is `emergency` interruption-tier per R-3.1 (already correctly tiered in current code; banner DOM at `side-panel.html:1660-1667` is outside `#hud-content`). It is NOT a §I shape vocabulary entry — it is an escalation surface that fires on `fatal` connection-state OR `versionMismatch` cause. R-1.11 binds: only `fatal`-tier connection state (or designated future-fatal causes) may trigger the banner; other tiers cannot escalate to banner without a doctrine-amendment-level review.
  - *Prevents:* CC-A-1..A-5 catalog of 5 status surfaces with no formal vocabulary; architectural finding A-A (now confirmed as 5-writer problem at `#status-dot`); architectural finding A-B (CC-A-1 dot vs CC-A-4 strip can disagree silently under partial failure); FM-STATUS-1 through FM-STATUS-6 surfaced by V-status failure-engineer specialist. Plus accessibility gap (only 1 `aria-expanded` site in entire codebase; zero `role="status"` on ambient indicators).
  - *Constrains:* Stage 4 specs that introduce status signals must declare which axis they extend + visual treatment + clearing event + scope. Stage 6 PR gate verifies (a) single-writer per slot per INV-STATUS-1, (b) severity-monotonicity respected per INV-STATUS-2, (c) every cause value emits defined class per INV-STATUS-3, (d) connected-waiting timer registered per INV-STATUS-4, (e) `STATE_FIELD_SCOPES.md` entry includes both clearing paths per INV-STATUS-5.
  - *Companion test infrastructure:* `status-registry.test.js` (parallel to `freshness-signal-registry.test.js`, `design-token-registry.test.js`, `affordance-registry.test.js`) parses §I status registry; asserts INV-STATUS-1..5. `dom-mutation-discipline.test.js` extension catches the existing 5 writer sites. Test infrastructure ships with the rule, not "later."
  - *Does NOT prescribe:* the exact threshold value for INV-STATUS-4 (per-shell-spec configurable; 30s default is recommendation); the per-stage diagnostic text ("PROBE / BRIDGE / FILTER / PORT / PANEL"); the recovery-banner copy. R-1.11 governs the *vocabulary structure + behavioral invariants*, not per-element visual or copy content.
  - *Forensics origin:* surfaced by SHC Gate 3 architectural pass (CC-A-1..A-5 + architectural findings A-A and A-B) and ratified by SHC V-status 5-specialist roundtable (2026-04-28). cto-agent specialist verified the actual writer count is 5, not the dual-writer originally documented in finding A-A; failure-engineer specialist contributed INV-STATUS-1..5 + the FM-STATUS-1 silent-severity-downgrade discovery (a contextDead red dot can be silently overwritten by a yellow staleContext dot in the same frame, currently shipping in production); systems-architect specialist contributed the 3-axis decomposition (connection / app-bridge / pipeline) and identified the `--status-app-disconnected` Layer 1 primitive collision risk requiring new `_P.orange_status` primitive distinct from `_P.orange_deep`; senior-engineer specialist verified `versionMismatch` silent-dot-persistence bug is currently untested + proposed status-registry.test.js parallel to freshness-signal-registry; product-ux-engineer specialist contributed the Z0 chrome density-budget framing + cross-product mirror-lock recommendation.
  - *Added (2026-04-28, owner-approved, v7).*

---

## §2 Lifecycle rules (finite state machines)

**Intent:** Every panel has an explicit statechart. No `classList.toggle` or ad-hoc visibility flips outside declared transitions. Research: XState / statecharts pattern.

- **R-2.1** Every panel's lifecycle is expressed as a **finite state machine** in its Stage 4 spec with:
  1. Enumerated states (e.g. `hidden | loading | live | stale | error`).
  2. Enumerated transitions with named trigger events.
  3. Entry and exit conditions for each state.
  4. A single `initial` state.
  - *Prevents:* S3 (mid-hand disappearance), S4 (between-hands steals slot), S2 (panel appears at wrong time).

- **R-2.2** State transitions occur **only** in response to a named trigger listed in the FSM. Timer-based transitions must name both the timer and the state that owns it.
  - *Prevents:* M6 (stale auto-expand timer), M7 (`modeAExpired` never reset).

- **R-2.3** **No `classList.toggle`, no direct `style.display` writes, no inline `hidden` attribute flips outside an FSM transition handler.** The FSM's transition handler is the single site that may mutate visibility class/attributes for the panel it owns.
  - *Prevents:* M8 (toggle bypasses change-detection), S5. *Binding on:* Stage 5 orchestrator decisions.

- **R-2.4** On every new hand (`push_live_context` with a new `handNumber`), every panel receives a `hand:new` trigger and **must** evaluate whether its current state is still valid for the new hand. A panel that does not define behaviour for `hand:new` is incomplete and the spec is rejected.
  - *Prevents:* M7 (`modeAExpired` not reset across hands), S4.

- **R-2.5** Timers registered by a panel are owned by that panel's FSM and **must** be cleared on exit from the state that started them. Registration goes through the `registerTimer` / `clearTimer` / `clearAllTimers` contract shipped under RT-60 (or its successor).
  - *Prevents:* M6, M7. *Enforcement:* Stage 6 lint — raw `setTimeout` in a panel module fails the PR gate.

---

## §3 Interruption discipline

**Intent:** Reserve interruption for critical state changes only. Classify panels and preempt only upward.

- **R-3.1** Every element carries an **interruption tier** declared in its spec:
  - `ambient` — always-on background (clock, diagnostics dot). Never preempts anything.
  - `informational` — advisory content (table reads, history). Preempts `ambient` only.
  - `decision-critical` — anything the user needs to read to choose an action this hand. Preempts `ambient` and `informational`.
  - `emergency` — invariant violation or data-inconsistent banner. May preempt anything.

- **R-3.2** **Active-hand state is `decision-critical` baseline.** While a hand is in progress (between `hand:new` and `hand:complete`), no `informational` panel may cover, replace, or occlude a `decision-critical` panel.
  - *Prevents:* S4 (between-hands pops over active hand).

- **R-3.3** A panel of tier T **may only take a DOM slot** from an occupant of tier ≤ T − 1. A panel attempting to preempt an equal or higher tier is a spec violation; the FSM must instead route the incoming data to a non-conflicting zone or queue/drop.
  - *Prevents:* S3, S4.

- **R-3.4** Between-hands content is `informational`. It has no right to preempt the active-hand DOM slot. If the Stage 3 audit finds this is the current behaviour, the spec must either (a) move between-hands to a distinct non-active zone, or (b) mark it delete-candidate.
  - *Forensics link:* S4, M3, M7.

---

## §4 Freshness contract

**Intent:** Pair every data point with freshness metadata. Stale or unknown is rendered with a label, never blanked and never silently hidden.

- **R-4.1** Every rendered value is backed by a structured record of the shape:

  ```
  { value, timestamp, source, confidence }
  ```

  where `value` may be the typed data or an explicit `{ kind: 'unknown' }` / `{ kind: 'stale', lastKnown }` sentinel.
  - *Prevents:* S1 (`$0` rendered on missing amount — must render "—" or prior value with stale label instead), S2 (preflop advice shown during flop — must render stale-street label).

- **R-4.2** A renderer **must not substitute `0`, empty string, `null`, or `undefined` for missing data.** If `value` is absent, the renderer emits the element's declared **unknown placeholder** (e.g. "—") and a stale/unknown label; never a numeric default.
  - *Prevents:* M1 (null-bet renders `$0`), S1.

- **R-4.3** When new data partially overlaps a prior payload, the **prior value is retained** for fields the new payload does not cover; only fields explicitly present in the new payload replace prior values. Full-replace-on-push is prohibited.
  - *Prevents:* M2 (`appSeatData` full-replace churns partial payloads), S1, S5.

- **R-4.4** Freshness labels are **always visible when applicable**. There is no "silent stale" — if age exceeds the element's declared freshness threshold, the user sees an age badge (e.g. "Stale 4s"). RT-48 established the pattern; the rebuild codifies it.

- **R-4.5** `confidence` is a first-class field. A rendered value with confidence below the element's declared floor renders with a confidence indicator (or, for `decision-critical` elements, refuses to render per §7).

---

## §5 Render contract (single-owner-per-slot)

**Intent:** Exactly one renderer owns each DOM slot. Research: root-cause of S3/S4/S5 is multi-owner writes.

- **R-5.1** Every DOM slot (named container in the sidebar) has **exactly one declared owner** — one FSM in one module. The owner is named in the slot's spec.
  - *Prevents:* M3 (`renderBetweenHands` and `renderStreetCard` both own main slot), S3, S4, S5.

- **R-5.2** A module that is not the declared owner of a slot **must not** write `innerHTML`, `textContent`, `classList`, `style.display`, `hidden`, or attach/detach child nodes for that slot. Enforced at Stage 6 via module boundaries (non-owner modules do not import the slot's DOM reference).

- **R-5.3** If two pieces of content could each reasonably occupy a slot, the spec must declare which has priority and how the non-winning content is routed (queue, alternate zone, or drop). "Both render and hope" is not a valid design.
  - *Prevents:* S3, S4.

- **R-5.4** The render coordinator's `renderKey` / fingerprint **must** capture every input that can affect the slot's output. A change that alters the rendered DOM without altering the renderKey is a bug; a renderKey change that does not alter DOM is acceptable but should be minimized.
  - *Prevents:* M2 churn masked by coarse key. *Forensics link:* RT-43/44/54 already moved this direction.

- **R-5.5** Change-detection compares the **renderKey** first and the **output HTML** second. No DOM write occurs if both are identical to the prior committed frame. Class toggles on identical content are prohibited.
  - *Prevents:* M8, S5.

- **R-5.6** When a FSM is registered for a slot, the slot's renderer reads `snap.panels.<fsmId>` as its **visibility/phase authority**. Raw coordinator state that the FSM internally derives from (e.g. `modeAExpired`, `currentLiveContext.state`) must NOT be read directly for slot-ownership decisions. The FSM may be supplemented by a content classifier (e.g. `classifyBetweenHandsMode`) for *what* to render once the FSM has decided *whether* to render. Lint-enforced: `zx-overrides.test.js` verifies no raw-state reads in FSM-owned renderer bodies.
  - *Prevents:* M3, M7, S4 (decorative FSM — output authored but never consumed).
  - *Added (2026-04-15, SRT-2 / RT-76):* Codifies the RT-72 fix into a general doctrine rule.

---

## §6 Animation and motion budget

**Intent:** Motion serves reading, never decoration. Research: 200–400ms for value changes; `prefers-reduced-motion` must be honoured.

- **R-6.1** Value-change transitions: **200–400ms**. Outside this band requires spec justification.

- **R-6.2** Reorders and layout motion: **< 300ms**. Reorders inside a zone are rare by R-1.3; where they occur (e.g. seat-activity indicator) the motion budget applies.

- **R-6.3** `@media (prefers-reduced-motion: reduce)` **must** short-circuit all non-essential transitions to 0ms. Essential motion (e.g. an emergency banner flash) is explicitly whitelisted in the spec.

- **R-6.4** No element may animate on every render tick. Animation fires on **state transitions** (per §2) only, never on identical-content re-renders.
  - *Prevents:* M8, S5.

---

## §7 Invariants as render gates

**Intent:** Invariants **enforce**, they do not merely report. A violated invariant prevents a render; it does not allow a bad render and log about it.

- **R-7.1** Every panel's spec declares its **preconditions** (invariants that must hold before render). Each invariant is classified into one of three levels:
  - **`warn`** — violation is logged + counted, render proceeds. Use for soft checks where stale-but-plausible data is preferable to a refusal.
  - **`gate`** — violation blocks that panel's render this frame; panel emits its declared "data-inconsistent" visual (labeled badge or stale state), or its `hidden` state if the spec permits.
  - **`emergency`** — violation blocks render **and** surfaces the `emergency`-tier invariant badge per §3 / R-7.2.

  Each invariant in a spec must carry an explicit level. Defaulting is prohibited — the spec author chooses and justifies.
  - *Prevents:* M4 (`StateInvariantChecker` currently logs but does not gate), S2.
  - *Amendment (2026-04-12, owner-approved):* Two-tier→three-tier classification adopted (warn / gate / emergency). Prevents over-strict gating from blanking the sidebar when a soft-check invariant trips.

- **R-7.2** **Cross-panel invariants** (e.g. "advice street must match live context street") are owned by the render coordinator and evaluated by `StateInvariantChecker.check(snap)` **before** `_renderFn` is invoked. On violation: the violation is stamped into `lastViolationAt` **before** the render, the snapshot is rebuilt with the stamp, and `_renderFn` receives the violation-stamped snapshot — so the "!" badge and any panel-level degraded states paint in the **same frame** as the violation. In `throwOnViolation` mode (tests), the render is blocked and `InvariantViolationError` is thrown. This is pre-dispatch evaluation, not post-render telemetry.
  - *Prevents:* S2 (preflop advice during flop), M4, M5.
  - *Amendment (2026-04-15, SRT-2 / RT-70):* Moved invariant evaluation from post-render to pre-dispatch. Prior implementation (SR-6 through SR-8) evaluated invariants after the DOM was already painted — violations were observable but not gating. RT-70 closes M4: violations are now visible in the same frame they occur, and test mode blocks the render entirely.

- **R-7.3** The street-rank tolerance gate that currently permits a 1-street gap (`render-coordinator.js:429`) is **revoked** by the rebuild. Advice must match context street exactly; if it does not, the advice panel refuses per R-7.1 and displays its **"stale, recomputing" state** — the last-known-good advice rendered with an explicit recomputing label and an age badge, never blanked.
  - *Prevents:* M5, S2.
  - *Amendment (2026-04-12, owner-approved):* Explicit stale-recomputing label required during transitions so the user sees the prior street's advice marked as stale rather than a blank panel. Spec for the advice panel must define this visual state.

- **R-7.4** Invariant violations are **observable**: the `emergency` badge increments a counter surfaced in the diagnostics zone. This is the basis for the Stage 7 runtime monitoring metric.

- **R-7.5** An invariant that cannot be expressed as a pre-render gate (because it depends on post-render DOM state) belongs in the corpus replay assertions, not in the runtime — it is a test invariant, not a render invariant. The spec must label each invariant as `render-gate` or `test-only`.

---

## §8 Acceptance criteria style (BDD)

**Intent:** Every spec's acceptance criteria are written in Given/When/Then form, drawn from actual corpus captures. This binds specs to the sealed replay corpus and prevents "acceptance by vibes".

- **R-8.1** Each Stage 4 spec lists **acceptance scenarios** in the form:

  ```
  Scenario: <short name>
    Given <corpus event or initial state>
    When <trigger event>
    Then <observable outcome on DOM>
  ```

  - Every scenario cites a **corpus file** (`.claude/projects/sidebar-rebuild/corpus/*.jsonl`) or a specific event it requires.
  - Every scenario is **executable** — Stage 6 can run it against the replayer.

- **R-8.2** Each spec also lists **anti-scenarios**: explicit "this display is WRONG if..." cases. Example: "Range grid MUST NOT render if `advice.street ≠ liveContext.street`." Anti-scenarios become property-based test oracles in Stage 6.
  - *Prevents:* drift between spec intent and test coverage. *Forensics link:* S2.

- **R-8.3** A spec without at least one scenario drawn from an existing corpus file is incomplete. If no corpus covers the scenario, a new corpus entry is added first (per validation mechanism #3 in the master plan: corpus-as-regression-suite).

- **R-8.4** Scenarios cite symptom IDs (S1–S5) and mechanism IDs (M1–M8) from forensics where applicable. At Stage 7 closeout, every symptom ID must appear in at least one passing scenario or be explicitly deferred.

---

## §9 Rule compliance at gate time

Summary table of which stage enforces which rule:

| Rule family | Enforced at | How |
|---|---|---|
| §1 Hierarchy | Stage 3 inventory + Stage 4 specs | Zone assignment per row; max-5-primary review |
| §2 Lifecycle FSMs | Stage 4 specs + Stage 6 PR lint | FSM diagram present; no raw `classList.toggle` / `setTimeout` |
| §3 Interruption | Stage 4 specs | Tier declared per element; preemption matrix reviewed |
| §4 Freshness | Stage 4 specs + Stage 6 tests | Unknown-placeholder rendered in corpus runs |
| §5 Render contract | Stage 5 architecture + Stage 6 lint | Module boundary prohibits cross-owner writes |
| §6 Motion | Stage 4 specs + Stage 6 review | Spec lists durations; reduced-motion honored |
| §7 Invariant gates | Stage 4 specs + Stage 6 tests | Preconditions list present; replayer asserts refusal |
| §8 BDD acceptance | Stage 4 specs + Stage 6 tests | Scenarios executable against corpus |

A rebuild PR that fails any cell in this table does not merge.

---

## §10 What this doctrine does NOT prescribe

To preserve scope:

- **Visual design (colours, fonts, exact sizes)** — separate concern; handled in per-element specs and owner review of screen recordings (Stage 6 gate).
- **Specific state names per panel** — FSMs are required by R-2.1, but the state vocabulary is per-spec.
- **Implementation language / framework** — the extension stays vanilla JS; no framework migration is in scope for this program.
- **Non-sidebar parts of the extension** (capture, background worker, service worker) — out of scope unless a root cause traces there.

---

## §11 Amendment process

A rule may be amended, added, or removed only by:

1. A written proposal citing which S or M it addresses (or explicitly deferring one).
2. Owner approval in the session record.
3. An update to this file with the amendment date and rationale.

Rules amended mid-program flow back into any Stage 4 spec that depended on the prior wording; Stage 4 re-review is required for affected specs.

### Amendment log

**v1 — 2026-04-12 (initial approval)**
- R-7.3 — explicit "stale, recomputing" label added during street transitions (no blanking).
- R-7.1 — three-tier invariant classification adopted: warn / gate / emergency.

**v2 — 2026-04-12 (UX-model reframe)**
- **R-1.2 (revised).** Old: ≤5 primary metrics cap. New: spatially remembered location per element + glance test (readable <1s). Rationale: owner's clarification of actual use pattern — targeted glance with spatial memory, not simultaneous scan. The 5-metric cap was derived from dashboard-reading research, which does not match the sidebar's actual use.
- **R-1.3 (rationale reinforced).** Rule text unchanged; added paragraph explaining that reflow breaks glance pathways for every neighbour.
- **R-1.5 (new).** Every element declares a glance pathway (remembered location / default summary / drill-down affordance / expansion location). Drill-down affordances come from a consistent vocabulary; same visual pattern = same interaction everywhere.

Rules added or revised under v2 apply to all Stage 4 specs authored hereafter. Specs already drafted under v1 (none yet — SR-4 has not started) must be re-reviewed under v2.

**v3 — 2026-04-27 (cross-zone consistency invariants — Option II)**

Source: `.claude/projects/sidebar-rebuild/08-doctrine-amendment-proposal-r16-r17-r18.md`. Driven by Sidebar Holistic Coherence Gate 2 audit (`docs/design/audits/2026-04-27-blindspot-sidebar-holistic-coherence.md`) finding E6. Owner approved Option II 2026-04-27.

Forensics class **D** (Drift) introduced — parallel to S1–S5 symptoms and M1–M8 mechanisms. D-class entries document post-SR design-language drifts cataloged by the SHC audit:
- **D-1** — Confidence rendered three incompatible ways across Z2/Z4 (verified at `render-orchestrator.js:150–151, 169` + `:442–444, 450` + `render-tiers.js:70–74`).
- **D-2** — `#fbbf24` serves five semantic roles in `shared/design-tokens.js` (lines 31, 47, 61, 77, 94). **Forensics retained but no R-rule cites it under Option II** — token-semantic isolation deferred to shell spec.
- **D-3** — Staleness rendered with two incompatible patterns and disjoint mechanisms (Z0 `status-dot` state-derived at `render-orchestrator.js:1324–1342` vs Z2 `.stale-badge` timer-driven at `side-panel.js:1068–1087`).

Rules added:
- **R-1.6 (new).** Cross-zone treatment-type consistency. Cites D-1.
- **R-1.7 (new).** Staleness shape-class consistency. Cites D-3. **Renumbered from proposed R-1.8** because the proposed R-1.7 (token-semantic isolation, citing D-2) was not approved at doctrine level.

Rules deferred:
- **R-1.7 as originally proposed** (token-semantic isolation, citing D-2). Owner directive Option II: this rule's substantive concern brushes against §10's exclusion of visual design (colours, fonts, exact sizes). The cross-zone yellow collision will be addressed in the shell spec (Gate 4 deliverable of SHC audit) as positive token-semantic vocabulary, rather than as a prescriptive doctrine rule. The proposal file remains in `.claude/projects/sidebar-rebuild/` as the authoritative record of the deferral, including the proposed §10 clarification text that was *not* adopted.

§10 not amended under Option II. The doctrine retains its current scope exclusion of visual design; cross-zone consistency invariants R-1.6 and R-1.7 are scoped as *structural* (treatment-type and shape-class enumeration), not visual (colors / fonts / sizes), and slot into §1 without §10 amendment.

Rules added under v3 apply to all Stage 4 specs authored hereafter. Pre-existing zone surface artifacts (Z0, Z2, Z3, Z4) are NOT retroactively forced into compliance — remediation timing is a Gate 5 / backlog concern. Per the proposal §"What this proposal is NOT": rules govern new spec authorship and PR review; existing violations may persist until remediation PRs land.

**v4 — 2026-04-28 (mechanism coherence)**

Source: SHC V-3 5-specialist roundtable (2026-04-28; systems-architect, senior-engineer, cto-agent, failure-engineer, product-ux-engineer). Driven by R-1.7 *Caveat* — the explicit gap that R-1.7's shape-class consistency could not close. Owner approved inline-authoring path (option (i)) 2026-04-28; no separate `09-doctrine-amendment-proposal-r18.md` file, given the proposal's substance is captured in the V-3 synthesis recorded in `docs/design/surfaces/sidebar-shell-spec.md` §II + `memory/project_sidebar_holistic_coherence.md`.

Rule added:
- **R-1.8 (new).** Freshness-mechanism declaration + INV-FRESH-1..5 behavioral invariants. Cites R-1.7 *Caveat* and the architectural pass findings F-2 + B-A from the SHC inventory. Closes the mechanism-coherence gap that R-1.7 alone left open.

Companion infrastructure committed by R-1.8:
- **`freshness-signal-registry.test.js`** — new test file parallel to `state-clear-symmetry.test.js`. Parses the shell-spec §II registry table; asserts every declared signal has matching `coordinator.scheduleTimer` registration (when `timer-driven-*`), matching `STATE_FIELD_SCOPES.md` scope entry, and a unique single writer.
- **`dom-mutation-discipline.test.js`** — extended (or created if not present) to enforce INV-FRESH-4 single-writer rule. Existing dual-writer at `#status-dot` is the canonical violation that V-3's required co-shipping resolves.

§10 not amended under v4. R-1.8 is structural (mechanism class enumeration, scope tagging, behavioral invariants), not visual (no colors / fonts / sizes). Slots into §1 without §10 amendment, parallel to v3's R-1.6 / R-1.7 reasoning.

Long-term lens: per `memory/feedback_long_term_over_transition.md` (strengthened 2026-04-28), the doctrine-rule path was preferred over spec-only-registry because spec-only enforcement is a wishlist; doctrine-rule + lint test is what makes the boundary durable across future contributors. The "ship doctrine rule now, even though spec-only would work for v1" decision is the canonical example of the strengthened framing.

Rules added under v4 apply to all Stage 4 specs authored hereafter. Pre-existing zone surface artifacts NOT retroactively forced; remediation per Gate 5 cadence (see `freshness-signal-registry.test.js` test allowlist for grandfathered exceptions).

**v4 required co-shipping:** Two architectural cleanups bundled with R-1.8 because they are direct prerequisites for INV-FRESH-4 enforcement:
- Status-dot dual-writer resolution (assigns sole ownership of `#status-dot` to §I status; freshness gets distinct DOM slots per zone).
- 1Hz `adviceAgeBadge` timer R-2.3 compliance (route through `coordinator.dispatch('adviceAgeBadge', 'tick')` — currently a direct DOM mutation outside the FSM transition handler).

**v5 — 2026-04-28 (token-semantic isolation — closes the v3 deferral)**

Source: SHC V-color-tokens 5-specialist roundtable (2026-04-28; systems-architect, senior-engineer, cto-agent, failure-engineer, product-ux-engineer). Driven by D-2 forensics (yellow `#fbbf24` × 7 design-token roles + 2 status-dot uses + M-token-bundle reuse for fold-percentage gradient). v3's Option II explicitly deferred token-semantic isolation to "shell spec carries it as positive vocabulary" — v5 reverses that deferral under the strengthened long-term lens (per `memory/feedback_long_term_over_transition.md` 2026-04-28 update): doctrine-rule + lint-test enforcement is what makes the invariant durable across future contributors; spec-only enforcement is wishlist.

**Forensics expansion (D-2 widening from inventory pass):**
- Pre-existing STYLE_COLORS / STYLE_TOKENS hex divergence: Fish text `#fca5a5` in `stats-engine.js:328` vs `#fb923c` in `design-tokens.js:138`. CSS consumers and JS consumers see different colors today.
- Three hex-literal populations beyond `design-tokens.js`: ~46 hex literals in `side-panel.html` embedded CSS (lines 391, 431-433, 440-441, 454, 489, 491, 699-700, etc.); `var(--m-green)` string literals in JS template literals (`render-street-card.js:908`); inline hex in render-tiers.js. Token-rename through the file alone does NOT cleanly propagate.
- 51 `--m-*` references across the codebase, 42 in `side-panel.html` alone — M-token bundle has metastasized far beyond M-ratio use.
- STYLE_TOKENS hex perceptually conflicts with quality-tier hex (product-ux-engineer's analysis): TAG `#86efac` (green family) conflicts with `#4ade80` quality-tier positive; LP `#fde68a` (pale yellow) conflicts with `#fbbf24` quality-tier marginal; Fish `#fca5a5` (red-pink) conflicts with `#f87171` quality-tier negative. STYLE_TOKENS is V-1-violating in practice even though hex differs from quality-tier.
- `shared/design-tokens.js:9` claims to mirror `src/constants/designTokens.js` (main-app token file) — no mechanical enforcement; silent cross-product drift possible.

Rule added:
- **R-1.9 (new).** Color-token concept-class isolation + INV-TOKEN-1..5 behavioral invariants. Cites D-2 forensics. Closes the deferral that v3 Option II explicitly recorded.

Companion infrastructure committed by R-1.9:
- **`design-token-registry.test.js`** — parses `design-tokens.js` + `design-tokens.meta.js`; asserts INV-TOKEN-1..5.
- **`token-concept-class-collision.test.js`** — asserts no two distinct concept-class tokens share a hex without distinct CSS variable names.
- **Mirror-lock test** — imports both `shared/design-tokens.js` and `src/constants/designTokens.js`; diffs shared keys; non-shared keys permitted.
- **`shared/design-tokens.meta.js`** — concept-class index for automated D-2 violation detection. Not injected; test-time use only.
- **CLAUDE.md anti-pattern statement update** — current rule "Never duplicate STYLE_COLORS — import from `shared/stats-engine.js` everywhere" updated to canonicalize on `design-tokens.js` (`stats-engine.js:STYLE_COLORS` becomes a re-export wrapper).

§10 not amended under v5. R-1.9 is structural (token-system architecture, hex source-of-truth invariant, concept-class isolation), not visual (no per-element pixel choice). Slots into §1 without §10 amendment, parallel to v3/v4 reasoning.

Long-term lens: per `memory/feedback_long_term_over_transition.md`, the doctrine-rule path was preferred over spec-only-vocabulary because v3's Option II deferral was the canonical "spec-only is wishlist" case; v5 corrects course. The decision is the second canonical example (after v4 R-1.8) of the strengthened framing operationalized.

Rules added under v5 apply to all Stage 4 specs authored hereafter. Pre-existing zone surface artifacts NOT retroactively forced; remediation per Gate 5 cadence (see registry test allowlist for grandfathered exceptions during transition).

**v5 required co-shipping:** Five architectural cleanups bundled with R-1.9 because they are direct prerequisites for INV-TOKEN-1..5 enforcement:
- `side-panel.html` embedded CSS hex sweep (~46 hex literals → `var(--token)` references).
- `--m-*` reference rename across 51 sites (42 in side-panel.html, 9 elsewhere).
- STYLE_COLORS / STYLE_TOKENS divergence resolution (`design-tokens.js` canonical; `stats-engine.js:STYLE_COLORS` becomes re-export wrapper).
- `shared/design-tokens.meta.js` authored alongside the rename.
- `injectTokens()` deprecation alias mechanism (emit both old + new names during transition; harness fixture diff = 0 as parity gate for ordinal-pool tokens; expected diff for categorical hex changes; rebaseline ceremony documented).

**v5 implication for V-2/V-3:** The `fresh-tier-*` and `conf-tier-*` token entries — which V-2 §III and V-3 §II described but did not declare in `design-tokens.js` — are added as part of V-color-tokens scope. Without this, V-2 and V-3 implementations at Gate 5 would either hardcode hex or re-use the deprecated `trust-*` tokens, recreating the violations they were designed to fix.

**v6 — 2026-04-28 (affordance vocabulary discipline — closes the SR-4-spec-index dangling reference)**

Source: SHC V-affordance 5-specialist roundtable (2026-04-28; systems-architect, senior-engineer, cto-agent, failure-engineer, product-ux-engineer). R-1.5 (added at v2) referenced "the SR-4 spec index" — an unauthored document. v6 closes that dangling reference + promotes affordance-vocabulary discipline to binding doctrine + lint enforcement under the strengthened long-term lens (per `memory/feedback_long_term_over_transition.md`). The pattern parallels v5 R-1.9: spec-only enforcement is wishlist; doctrine-rule + lint-test makes the invariant durable.

**Forensics expansion (CC-D class + new D-4 / D-5):**
- CC-D-1..D-10 catalog from Gate 3 inventory: bimodal click-affordance (chevron + header over-signposted; seat-arc click-to-pin under-signposted); chevron direction apparent-inconsistency (resolved at v6 as observational drift, not real CSS divergence — `side-panel.html:544, 613, 1240, 1266` all implement uniform `.open { transform: rotate(180deg) }` contract); decorative glyphs unbounded (Cross-cutting F-7); lexical inconsistency `n=45` vs `45h` (F-6, owned by §VI density not §IV).
- **D-4 (new).** Chevron CSS-class proliferation: 4 parallel definitions for one concept (`.pp-chevron`, `.tourney-bar-chevron`, `.collapsible-chevron`, `.deep-chevron`) at `side-panel.html:539-544, 609-613, 1236-1240, 1265-1266`. Plus 9 chevron emit sites in `render-tiers.js` alone (lines 424, 455, 478, 520, 552, 577, 607, 624, 653) emitting `▾` inline. Module extraction collapses to one `.affordance-chevron` class.
- **D-5 (new).** Click-affordance signposting bimodality: 14+ `cursor: pointer` declarations in `side-panel.html` with zero class-level affordance association (lines 92, 138, 529, 588, 943, 1144, 1231, 1260, 1427, 1519, 1532, 1579 + `.seat-circle:143`); CC-D-5 seat-arc + CC-D-6 stat-chip pin are clickable with no visible signpost (Class B candidates); CC-D-1 over-signposted (chevron + clickable header).
- **Existing accessibility gap.** Only 1 `aria-expanded` site in entire codebase (`side-panel.html:1692` + `side-panel.js:1187`); zero `role="button"` on interactive `<div>` elements. INV-AFFORD-4 grandfathering required.

Rule changes:
- **R-1.5 text amendment.** "drawn from a small, consistent vocabulary declared in the SR-4 spec index" → "drawn from the closed-vocabulary enumeration declared in `docs/design/surfaces/sidebar-shell-spec.md` §IV." One-line edit; closes dangling reference.
- **R-1.10 (new).** Affordance vocabulary discipline + INV-AFFORD-1..5 behavioral invariants. Cites CC-D-1..D-10 + D-4 + D-5 forensics.

Companion infrastructure committed by R-1.10:
- **`affordance-registry.test.js`** — parses §IV vocabulary registry; asserts INV-AFFORD-1..5.
- **`dom-mutation-discipline.test.js`** — extended for INV-AFFORD-2 (no-lying-affordance handler-reachability check) + INV-AFFORD-4 (keyboard-reachability check with grandfathered allowlist).
- **`shared/render-affordance.js`** — pure module owning interactive shape HTML emission (chevron + underline + pill + circle) + decorative-glyph registry lookup. HTML-emission only; click-wiring stays in `side-panel.js` IIFE via `data-affordance` attributes + single delegated listener (consolidates 5 separate `addEventListener` sites + document delegation + `onclick` outlier into one pattern).
- **CLAUDE.md anti-pattern statement update** — add: "Never inline chevron glyphs / underline spans / `cursor: pointer` styles — use `shared/render-affordance.js`." Parallel to "Never duplicate STYLE_COLORS" (resolved at v5).

§10 not amended under v6. R-1.10 is structural (vocabulary enumeration, ARIA contract, click-wiring discipline), not visual (no per-element pixel size or color choice). Slots into §1 without §10 amendment, parallel to v3/v4/v5 reasoning.

Long-term lens: same canonical pattern as v4 R-1.8 + v5 R-1.9. Owner-direction: doctrine-rule + lint enforcement now, not spec-only-vocabulary deferred. Operationalization of `memory/feedback_long_term_over_transition.md` strengthened framing for the third time in three doctrine amendments.

Rules added under v6 apply to all Stage 4 specs authored hereafter. Pre-existing zone surface artifacts NOT retroactively forced; remediation per Gate 5 cadence (see `affordance-registry.test.js` test allowlist + INV-AFFORD-4 grandfathered allowlist for grandfathered exceptions during transition).

**v6 required co-shipping:** Eight architectural cleanups bundled with R-1.10 because they are direct prerequisites for INV-AFFORD-1..5 enforcement:
- `shared/render-affordance.js` module authored.
- 4 parallel chevron CSS classes collapsed to one `.affordance-chevron`.
- 5 separate `addEventListener` sites + document delegation + `bar.onclick` outlier consolidated to single delegated listener via `data-affordance` attributes.
- `affordance-registry.test.js` + `dom-mutation-discipline.test.js` extension authored.
- `INV-AFFORD-4` grandfathered allowlist with explicit Gate 5 milestone.
- `.show-toggle-btn` element-type fix (`<button>` → `<a>` or `role="link"` — currently emits navigate semantics from button element).
- `render-orchestrator.js:147` `||` → `??` fix (pinned-villain sample-size substitution bug surfaced by failure-engineer; already in §III.7 forbidden pattern #6).
- §V cross-cutting amendment (next paragraph).

**v6 implication for V-color-tokens (§V cross-cutting amendment):** §IV's pill shape (action-button) and chevron shape (with optional active/inactive color states) need token entries that V-color-tokens did not declare. Two new concept-classes added to §V:
- `--action-class-{call,bet,raise,fold}-{bg,text,base}` for action-recommendation pill coloring (CALL/BET/RAISE/FOLD). Currently uses `--qtr-marginal` (yellow CALL) and `--qtr-pos` (green BET/RAISE) which violates INV-TOKEN-2 concept-class exclusivity — action class is categorical (action type), not ordinal (quality tier).
- `--affordance-{chevron,underline,pill}-{base,active,muted}` for affordance color states. Resolves to `--text-faint` / `--text-muted` per concept-class isolation.

Without this amendment, Gate 5 V-affordance implementers would reach for `--qtr-*` tokens for action-button pills (recreating cross-concept collision V-color-tokens was designed to fix) or hardcode hex (INV-TOKEN-1 violation).

**Hand-plan branch label disambiguation:** "If CALL" / "If RAISE" branch labels (CC-F-1) classified as `chip` sub-form of decorative-glyph in §IV (not pill — disambiguates the pill double-use surfaced by product-ux-engineer Q-3). Chip is a non-interactive categorical tag.

**Hero seat identification (cross-cutting from V-1 (c)):** ★ glyph is canonical hero indicator (registered in §IV decorative-glyph registry). Colored seat-arc ring style migrates to non-color encoding (distinct ring weight) in Gate 5 — color is reserved for ordinal quality-tier per V-1 (c); hero-vs-villain is categorical, not ordinal.

**v7 — 2026-04-28 (status concept-class discipline)**

Source: SHC V-status 5-specialist roundtable (2026-04-28). §I status was the last unresolved concept-class section in the shell spec; v7 closes it with the binding-doctrine + lint-test pattern established by v4/v5/v6. Strengthened long-term lens (per `memory/feedback_long_term_over_transition.md`) operationalized for the fourth consecutive doctrine amendment.

**Forensics expansion (CC-A class + 6 new FM-STATUS entries):**
- CC-A-1..A-5 catalog from Gate 3 inventory: connection-status dot (`#status-dot`), hand count, app-status badge (`#app-status`), pipeline-health strip (5 stages, visibility-gated), recovery banner.
- **Architectural finding A-A widened from dual-writer to 5-writer** (cto-agent verification): `side-panel.js:198-218` (renderConnectionStatus, declared owner per comment line 136) + `:785-794` (updateStatusBar invoking `buildStatusBar`) + `:1847-1848` (renderAll inline override during staleContext) + `:2590-2593` (updateStatusFromDiag) + `harness.js:81` (test-fixture). Comment at line 136 ("renderConnectionStatus owns all status-dot/status-text DOM writes") is documentary, not enforced.
- **FM-STATUS-1 (silent severity downgrade — currently shipping):** renderAll fires `renderConnectionStatus` at line 1828 then `staleContext` block at line 1846. If `connState.cause === 'contextDead' && snap.staleContext === true`, the staleContext writer overwrites red→yellow in the same frame. Status dot lies as warning when reality is fatal. Untested. No invariant fires today. Closed by INV-STATUS-2 severity-monotonicity.
- **FM-STATUS-2 (versionMismatch silent green-dot persistence):** `side-panel.js:215-217` sets text but NOT `dot.className`. Dot retains prior color. Closed by INV-STATUS-3 no-lying-status.
- **FM-STATUS-3 (connected-waiting indefinite trap):** `tableCount > 0 && handCount === 0` shows yellow + "waiting for hands" forever; no timeout, no escalation. Closed by INV-STATUS-4 connected-waiting escalation.
- **FM-STATUS-4 (SW reanimation status divergence):** stale `lastHandCount` from before SW eviction → buildStatusBar shows green "Tracking" while no live context exists. Mitigated (not fully closed) by INV-STATUS-3 + clean-up of `lastGoodExploits` per INV-STATUS-5.
- **FM-STATUS-5 (app-bridge stale-sync invisibility):** `lastGoodExploits.appConnected` stays true if app crashes mid-session (no clearing event other than `clearForTableSwitch`). Closed by INV-STATUS-5 app-bridge staleness clearing.
- **FM-STATUS-6 (recovery-banner one-frame-late):** banner dispatch doesn't use `PRIORITY.IMMEDIATE`. Mitigation deferred to V-status implementation; not bound by R-1.11 invariants.

Rule added:
- **R-1.11 (new).** Status concept-class discipline + INV-STATUS-1..5 behavioral invariants. 3-axis decomposition (connection-state / app-bridge-state / pipeline-stage-health). Closed enumeration of axes; new axes require doctrine amendment.

Companion infrastructure committed by R-1.11:
- **`status-registry.test.js`** — parses §I status registry; asserts INV-STATUS-1..5 + every cause value emits defined dot class.
- **`dom-mutation-discipline.test.js`** — extended to enumerate the 5 existing `#status-dot` writer sites (and `#app-status` writers) + grandfathered allowlist for harness test-fixture path.
- **`shared/render-status.js`** — pure module owning status classification + HTML emission. API: `classifyStatus({connState, pipeline, handCount, appConnected})` typed-struct returning `{conn, app, pipeline}` axes; `renderStatusDot()`, `renderAppStatusBadge()`, `renderPipelineStrip()` HTML emitters.
- **`STATE_FIELD_SCOPES.md` entry for `lastGoodExploits`** extended to declare `connection:appDisconnected` clearing path alongside existing `clearForTableSwitch`.

§10 not amended under v7. R-1.11 is structural (concept-class enumeration, behavioral invariants), not visual.

Long-term lens: same canonical pattern as v4 R-1.8 + v5 R-1.9 + v6 R-1.10. cto-agent specialist's "no new rule" position rejected for the same reason as in V-3 / V-color-tokens / V-affordance walkthroughs: spec-only enforcement is wishlist; doctrine-rule + lint-test makes invariants durable. Owner-approved 2026-04-28.

Rules added under v7 apply to all Stage 4 specs authored hereafter. Pre-existing zone surface artifacts NOT retroactively forced; remediation per Gate 5 cadence with grandfathered allowlists for the 5 writer sites + INV-AFFORD-4 keyboard-reachability.

**v7 required co-shipping (12 items):** `shared/render-status.js` module authored; 5 writer sites consolidated to 1 (CSS class writes routed through single writer); `staleContext` inline override at `:1847-1848` REMOVED (severity-downgrade fix per INV-STATUS-2); `versionMismatch` dot-class assignment added at `:215-217` (per INV-STATUS-3); `updateStatusFromDiag` at `:2590-2593` migrated to dispatch; `updateAppStatus` orphan migration (route through render snapshot); `--status-conn-*` + `--status-app-*` + `--status-pipeline-*` token entries in `design-tokens.js` + meta file; new `_P.orange_status` Layer 1 primitive (per V-status.3 owner approval — distinct from `_P.orange_deep`); `status-registry.test.js`; `dom-mutation-discipline.test.js` extension; `STATE_FIELD_SCOPES.md` entry for `lastGoodExploits` adds `connection:appDisconnected` clearing path; ARIA contract (`role="status"` + `aria-live="polite"` on status-bar + app-status; `role="alert"` + `aria-live="assertive"` on recovery banner — only `assertive` site in sidebar). Plus INV-STATUS-4 timer registration: `coordinator.scheduleTimer('connectedWaitingTimeout', ..., 30_000)` for `connected-waiting` → `connected-timeout` escalation.

**v7 cross-cutting amendments:**
- §V (V-color-tokens) extended with `--status-conn-*` (4 entries) + `--status-app-*` (2 entries) + `--status-pipeline-*` (2 entries) concept-class entries. New Layer 1 primitive `_P.orange_status` distinct from `_P.orange_deep`.
- §II.3 (V-3 freshness registry) `connection-status` row REMOVED — moves to §I.3 status registry per §II.4 boundary clarification (V-status.4 default).

**v7 implication for V-status closes the doctrine v4-v5-v6-v7 sequence:** Three D-class forensics (D-1 confidence, D-2 color, D-3 staleness, plus D-4/D-5 affordance) and architectural findings A-A/A-B (status) are now all bound by doctrine rules with INV-* behavioral invariants. The shell spec sections §I-§VI are 5 of 6 resolved; only §VI density rhythm + attention budget remains.

**versionMismatch tier resolution (V-status.4 default):** classified as `fatal` connection-state. Treatment matches `contextDead`: red dot + recovery banner. Rationale: version mismatch means advice may be wrong; user-recoverable but requires reload.

**Connected-waiting escalation (V-status.5 default):** 30-second threshold to `connected-timeout` state. Configurable per shell-spec §I; not hardcoded in doctrine.

---

## Review checklist (self-check before owner sign-off)

- [x] Every rule cites a specific symptom (S1–S5) or mechanism (M1–M8), or an explicit research source
- [x] All 8 rule categories from master plan lines 113–122 are covered (§1–§8)
- [x] Forensics mechanisms M1–M8 each appear in ≥1 rule citation
- [x] Symptoms S1–S5 each appear in ≥1 rule citation
- [x] Scope exclusions listed (§10)
- [x] Amendment process defined (§11)
- [x] Gate-enforcement matrix present (§9)

Awaiting owner response: **approved** | **amend rule R-x.y** | **add rule for <concern>**.
