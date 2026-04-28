# Sidebar Design Principles Doctrine

**Program:** Sidebar Rebuild (SR-0 → SR-7) — Stage 2 artifact
**Master plan:** `C:\Users\chris\.claude\plans\composed-fluttering-snowflake.md`
**Forensics:** `.claude/projects/sidebar-rebuild/00-forensics.md` (symptoms S1–S5, mechanisms M1–M8)
**Status:** APPROVED by owner 2026-04-12 (all 5 sign-off decisions approved; amendments to R-7.3 and R-7.1 applied per owner recommendation acceptance). **Second amendment round approved 2026-04-12** — UX-model reframe: R-1.2 revised, R-1.5 added, R-1.3 rationale reinforced. **Third amendment round approved 2026-04-27** — Cross-zone consistency invariants: R-1.6 (treatment-type consistency) added, R-1.7 (staleness shape-class consistency) added; token-semantic-isolation proposal deferred to shell spec (see §11 amendment log).
**Date:** 2026-04-27
**Doctrine version:** 3 (v1 = initial approval; v2 = UX-model reframe, 2026-04-12; v3 = cross-zone consistency invariants, 2026-04-27)

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
  3. **Drill-down affordance** — if deeper detail is available, the visual pattern that invites the click (chevron, underlined text, tap target). Affordances are drawn from a small, consistent vocabulary declared in the SR-4 spec index; the same visual pattern means the same interaction everywhere in the sidebar.
  4. **Drill-down expansion location** — where the expanded content renders. Default is **in place** (same zone, expanding the element's own footprint within the fixed slot height per R-1.3). Non-in-place expansions (e.g. modal, navigation) must justify the deviation.
  - *Prevents:* ad-hoc affordances that break the pathway (e.g. a chevron that looks like expansion but actually navigates; an underline that looks navigable but has no click handler); drill-downs landing in unexpected locations, disorienting the user.
  - *Derived from:* owner's use-pattern clarification (2026-04-12, v2). Under targeted-glance, the pathway from "I need X" to "I see X" must be stable and predictable; ambiguous affordances force the user to abandon spatial memory and re-scan, which breaks the model.
  - *Added (2026-04-12, owner-approved, v2).*

- **R-1.6** Within the sidebar, any data concept that is rendered in two or more zones (or two or more elements within a single zone) MUST use the **same visual treatment type** — exactly one of: colored dot, colored badge, opacity-modulated value, text label, icon. A concept rendered as `dot` in one location and `opacity-class` in another is a spec violation.
  - *Prevents:* D-1 — confidence rendered three incompatible ways (Z2 unified header `render-orchestrator.js:150–151, 169` uses `confidence-dot green/yellow/red`; Z2 context strip `render-orchestrator.js:442–444, 450` uses opacity classes `conf-player`/`conf-mixed`/`conf-population` modulating data-value brightness; Z4 glance tier `render-tiers.js:70–74` uses `confidence-dot` with inline `n=` sample label). Divergence exists *within Z2*, not just across zones — the opacity-class form is invisible to anyone scanning for "confidence" because it modulates the value's brightness with no legend.
  - *Constrains:* Stage 4 specs must declare the treatment type for each cross-zone concept. Cross-zone re-occurrences of the concept must re-use the declared type. New treatment-types added by a panel without prior cross-zone audit fail the Stage 6 PR gate.
  - *Does NOT prescribe:* which colors, fonts, or sizes are used. Per §10, those remain per-element-spec / shell-spec scope. R-1.6 governs only the *category* of treatment.
  - *Added (2026-04-27, owner-approved, v3).*

- **R-1.7** Every staleness or freshness signal across all zones MUST use a consistent shape-class — drawn from the doctrine's affordance vocabulary index (R-1.5 references; SR-4 / shell-spec authoritative). Until the vocabulary index is authored, the canonical shape-classes are: **dot** (state-derived freshness), **badge** (timer-driven aging), **strip** (zone-level health). A panel that introduces a fourth pattern is a spec violation.
  - *Prevents:* D-3 — staleness rendered with two incompatible patterns and no shared parent. Z0 pipeline-health (`render-orchestrator.js:1324–1342`) uses colored dot (`status-dot yellow/green/red`) + status text, no aging counter, state derived from `pipeline.tableCount` + `handCount`. Z2 stale advice (`side-panel.js:1068–1087`) uses `.stale-badge` text element appended to `action-bar` with aging counter ("Stale 23s") or recomputing label, threshold-driven (10s + street-mismatch), refreshed per-second via `coordinator.scheduleTimer('adviceAgeBadge', …)` (`side-panel.js:1093–1094`). A user who learns "yellow dot = stale data" from Z0 will not recognize "Stale 23s" text badge in Z2 as the same concept-class.
  - *Constrains:* Stage 4 specs must select one of the canonical shape-classes for any freshness signal. New shape-classes require a doctrine amendment (i.e., extension of the canonical enumeration via §11).
  - *Does NOT prescribe:* the colors of the dot, the typography of the badge, the position within the zone, or the timer/triggering mechanism. R-1.7 governs the *shape-class*; mechanism consistency is a shell-spec concern (see deferred SHC item).
  - *Caveat:* R-1.7 is shape-class-consistency only. Two zones can comply with R-1.7 (both using `dot`) and still diverge architecturally — Z0 dot is state-derived, Z2 stale signal could be timer-driven — producing different *behavior* under the same shape. The Sidebar Holistic Coherence audit (`docs/design/audits/2026-04-27-blindspot-sidebar-holistic-coherence.md` Stage E6) flags mechanism coherence as a Gate 3 / shell-spec concern; R-1.7 alone does not close that gap.
  - *Added (2026-04-27, owner-approved, v3). Originally proposed as R-1.8 in `.claude/projects/sidebar-rebuild/08-doctrine-amendment-proposal-r16-r17-r18.md`; renumbered to R-1.7 for sequential rule ordering after the proposed R-1.7 (token-semantic isolation) was deferred to the shell spec under Option II.*

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
