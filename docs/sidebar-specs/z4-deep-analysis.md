# Z4 — Deep analysis (SR-4 batch 5)

**Status:** DRAFT for owner review — 2026-04-13.
**Doctrine:** `docs/SIDEBAR_DESIGN_PRINCIPLES.md` v2.
**Inventory source:** `docs/SIDEBAR_PANEL_INVENTORY.md` §Z4 (rows 4.1, 4.2, 4.3).
**Template:** `docs/sidebar-specs/README.md` (8-field spec).

Z4 is the sidebar's **below-the-fold secondary analysis zone** — three user-toggled collapsibles that expose deeper data without competing with Z2/Z3 for glance attention. Z4 is deliberately `informational` end-to-end (batch invariant 4); it never promotes to `decision-critical`. The primary glance pathways for decision-making live in Z2 (action bar) and Z3 (street card); Z4 is the drill-down surface when the hero wants *more* than the glance read.

---

## Row 4.1 — "PLAN" collapsible chevron

### 1. Inventory row
`#4.1 "PLAN" collapsible chevron (top of street card)` — exposes the hand-plan tree. Absorbs no other rows. Related to (not duplicated with) row 3.5 (hand plan content *inside* the street card) — see batch invariant 2 for the ownership boundary.

### 2. Doctrine citations
R-1.1 (fixed zone), R-1.3 (order declared, no reflow; chevron slot stays when closed), R-1.5 (glance pathway), R-2.1 (FSM), R-2.4 (`hand:new`), R-2.5 (registered timer for RT-61 auto-expand), R-3.1 (`informational` tier), R-3.2 (no preempt of `decision-critical`), R-5.1 (sole toggle owner), R-5.4 (renderKey captures open state).

### 3. Glance pathway (R-1.5)
- **Remembered location** — Z4, row 1 (top of Z4 stack, immediately below Z3). Full sidebar width, fixed collapsed height ~24 px (label + chevron), expands in place to render 3.5's plan content when open.
- **Default summary** — label "PLAN" left-aligned, chevron `▾`/`▴` right-aligned. Chevron orientation is the at-a-glance signal for open/closed.
- **Drill-down affordance** — **Chevron** (per README vocabulary). In-place expand/collapse. Toggle target is the full header row (≥ 40 px tap target) — not just the 8–10 px triangle.
- **Expansion location** — in place (same Z4 slot grows vertically; Z4 below 4.1 — i.e. 4.2, 4.3 — reflows downward only within Z4). Does not push into Z3 (R-1.4).

### 4. Data contract
- **Source:**
  - Toggle state: `coordinator.get('planPanelOpen')` — single owner per R-5.1, shipped under RT-61.
  - Content existence signal: `lastGoodAdvice?.handPlan` (presence gates whether the chevron renders at all).
  - Auto-expand trigger: fresh-advice arrival with a non-empty `handPlan` (the 8 s timer shipped under RT-61).
- **Compute:**
  - Header text is static (`"PLAN"`). Chevron glyph derives directly from `planPanelOpen` boolean.
  - No aggregation; the chevron is a pure reflection of coordinator state.
- **Invalid states:**
  - `lastGoodAdvice == null` OR `lastGoodAdvice.handPlan == null/empty` → **4.1 does not render** (neither header nor chevron). Z4 reflows so 4.2/4.3 sit at the top of Z4 (permitted: Z4 is below-the-fold and does not participate in the Z1–Z3 glance pathway; see batch invariant 3).
  - `planPanelOpen == true` AND `handPlan` becomes null (e.g. table switch) → FSM forces `planPanelOpen → false` on the same tick to prevent an empty expanded panel. Then unmount per above.

### 5. Interruption tier
`informational` (matches inventory). Explicitly NOT promoted to `decision-critical` even when auto-expanded (see batch invariant 4).

### 6. Render lifecycle
- **Mount condition:** first render where `lastGoodAdvice?.handPlan` is non-empty.
- **Update triggers (renderKey fingerprint fields):**
  - `planPanelOpen` (toggle open/closed).
  - `lastGoodAdvice.handPlan` identity (new plan replaces old).
  - `lastGoodAdvice._receivedAt` staleness flag (2.10 cross-zone — plan panel inherits the stale tint; see batch invariant 5 and z2-decision.md batch invariant 8).
  - `isAdviceStale` boolean (the shared staleness signal, same source as 2.10).
- **Unmount condition:** advice cleared OR `handPlan` becomes null-or-empty. The slot is released (does not blank-in-place — unlike Z2 where R-1.3 reserves slots against reflow, Z4 is the below-the-fold secondary zone where reflow *within Z4* is permitted when an entire collapsible has no data to host).
- **`hand:new` behavior (R-2.4):**
  - `planPanelOpen` resets to **closed** on every `hand:new`. Rationale: a user's "this hand is interesting, I want the tree open" decision is scoped to *this* hand; the next hand starts clean.
  - **Exception — RT-61 auto-expand:** if the new hand's first advice arrives with a `handPlan` and the auto-expand predicate fires (see batch invariant 1), the 8 s timer re-opens the panel. This is the same path as any advice arrival, not a special `hand:new` rule.
  - Timer lifecycle per R-2.5: `coordinator.clearTimer('planPanelAutoExpand')` fires on both user toggle (explicit close wins) and `hand:new` (old timer cancelled before new-hand advice path re-arms it).

### 7. Corpus coverage
- Default collapsed (advice + plan present, user has not opened): **S3/01**.
- Expanded (plan tree visible): **S5/01**.
- Auto-expand after fresh advice: **TODO corpus extension** — no current frame captures the post-RT-61 auto-expand moment with a clean before/after pair. SR-6 harness should add.
- No-plan path (advice without `handPlan`, preflop cold-call): **TODO corpus extension** — confirms 4.1 unmount behavior. Flag for SR-6.
- Stale inheritance (plan panel tinted yellow-orange when advice stale): **S7/02** (cross-zone stale frame, plan-panel half).

### 8. Rejected alternatives
- **Persisting `planPanelOpen` across `hand:new`** was considered (matches some IDE "remember my layout" patterns) but rejected: each hand is an independent decision episode; carrying the open state across hands would cause the plan tree to pop into view mid-hand when the user was not looking at Z4 for the previous hand. R-1.5 stability is about *location*, not content visibility.
- **Auto-expanding on every fresh advice** (no 8 s delay) was rejected: the delay lets the glance-first pathway (Z2 headline read) resolve before Z4 grows. If the user has already acted in under 8 s, the panel never opens, which is the correct outcome — they did not need the drill-down.

---

## Row 4.2 — "More Analysis" collapsible

### 1. Inventory row
`#4.2 "More Analysis" collapsible` — exposes secondary analysis panels (alternative sizings / alternative lines).

### 2. Doctrine citations
R-1.1, R-1.3, R-1.5, R-2.1, R-2.4, R-3.1, R-3.2, R-5.1, R-5.4.

### 3. Glance pathway (R-1.5)
- **Remembered location** — Z4, row 2 (immediately below 4.1 when 4.1 is present; top of Z4 when 4.1 is absent). Full sidebar width, fixed collapsed height ~24 px. Expansion grows vertically in place; 4.3 (if present) reflows downward within Z4.
- **Default summary** — label "More Analysis" left-aligned, chevron `▾`/`▴` right-aligned. No content bleed in the collapsed state (no preview text, no badge count) — the point of Z4 is that the default glance-state is silent.
- **Drill-down affordance** — **Chevron** (in-place). Full header row is the tap target.
- **Expansion location** — in place, within Z4.

### 4. Data contract
- **Source:**
  - Toggle state: `coordinator.get('moreAnalysisOpen')` (new coordinator key, parallel ownership contract to `planPanelOpen`). If this key does not yet exist, SR-6 adds it under the RT-60 registered-timer contract.
  - Content: two sub-blocks when present —
    - **Alternative sizings**: `lastGoodAdvice.alternatives?.sizings` (array of `{ sizing, ev, ... }`).
    - **Alternative lines**: `lastGoodAdvice.alternatives?.lines` (array of `{ action, ev, ... }`).
- **Compute:**
  - Header is static. Chevron derives from `moreAnalysisOpen`.
  - Internal layout when open: alt sizings block stacks above alt lines block (fixed order; do not reorder by EV). Each block renders only if its array is non-empty; missing block collapses *within* the 4.2 expanded body (permitted because the block is inside an already-expanded Z4 collapsible — R-1.3 reflow prohibition applies to top-level zone slots, not to the interior of a user-opened drill-down).
- **Invalid states:**
  - `lastGoodAdvice == null` OR `alternatives == null` OR both sub-arrays empty → **4.2 does not render** (unmount; see batch invariant 3 for reflow permission within Z4).
  - Exactly one sub-array non-empty → 4.2 renders; internal block layout shows only the populated half. No "N/A" scaffolding for the missing half (do not tease unavailable features).

### 5. Interruption tier
`informational` (matches inventory). Not promoted.

### 6. Render lifecycle
- **Mount condition:** first render where `lastGoodAdvice.alternatives` contains at least one non-empty sub-array.
- **Update triggers (renderKey fingerprint fields):**
  - `moreAnalysisOpen` (toggle).
  - `lastGoodAdvice.alternatives` identity (new alternatives set replaces old — R-5.4 demands this be captured in the fingerprint; RT-44/RT-54 precedent).
  - `isAdviceStale` (inherits stale tint per batch invariant 5).
- **Unmount condition:** alternatives become null/empty OR advice cleared.
- **`hand:new` behavior (R-2.4):**
  - `moreAnalysisOpen` resets to **closed** on `hand:new`. Same rationale as 4.1.
  - No auto-expand equivalent to RT-61 — 4.2 opens only on explicit user toggle. (RT-61 is specific to 4.1 because the hand plan has a forward-looking decision value the user may want surfaced without a click; alternative lines/sizings are "I want to double-check" drill-downs and do not warrant auto-promotion.)

### 7. Corpus coverage
- Default collapsed (alternatives present): **S3/01**.
- Expanded (alt sizings visible): **S5/01**.
- Expanded with only alt lines populated (no sizings): **TODO corpus extension** — confirms the internal-block reflow rule. Flag for SR-6.
- Unmount path (advice arrives with no alternatives): **TODO corpus extension**.

### 8. Rejected alternatives
- **Pre-rendering a condensed preview inside the collapsed row** (e.g. "3 alt sizings") was rejected: conflicts with "Z4 is silent by default" — the batch's whole point is that below-the-fold collapsibles should not compete with Z2/Z3 for attention. A badge count is a low-grade `informational` signal that still draws the eye. If the user wants to see counts, they can open the panel.
- **Merging 4.2 and 4.3 into a single "Advanced" collapsible** was rejected: 4.3 is debug-flag gated and must be fully absent (not merely hidden inside another panel) when the flag is off — see 4.3 §4 and batch invariant 6.

---

## Row 4.3 — "Model Audit" collapsible (debug-flag gated)

### 1. Inventory row
`#4.3 "Model Audit" collapsible` — exposes model/data provenance. **Conditional render** — gated by `settings.debugDiagnostics` (the debug flag shared with row 0.7, owner-approved 2026-04-12 under Group 2 Option A).

### 2. Doctrine citations
R-1.1, R-1.3, R-1.5, R-2.1, R-2.4, R-3.1 (`informational`), R-3.2, R-5.1, R-5.4, R-7.4 (audit counters are the runtime-monitoring basis), and the Z0 batch's debug-flag contract (see `z0-chrome.md` row 0.7 §4).

### 3. Glance pathway (R-1.5)
- **Remembered location** — Z4, row 3 (bottom of Z4 stack when flag on; slot does not exist at all when flag off). Full sidebar width, fixed collapsed height ~24 px, expands in place.
- **Default summary** — label "Model Audit" left-aligned, chevron `▾`/`▴` right-aligned. When flag is off, no label, no chevron, no empty slot — the element is **absent from the DOM** (batch invariant 6).
- **Drill-down affordance** — **Chevron** (in-place).
- **Expansion location** — in place, within Z4.

### 4. Data contract
- **Source:**
  - Flag gate: `settings.debugDiagnostics` (boolean; same key as 0.7).
  - Toggle state: `coordinator.get('modelAuditOpen')` (new key; same contract as 4.1/4.2).
  - Content: `lastGoodAdvice.audit` (provenance object — model version, confidence bands, input features).
- **Compute:**
  - Header static. Chevron derives from `modelAuditOpen`.
  - Internal layout: one row per audit field in a stable declared order (version → confidence band → feature snapshot). Missing fields blank in place within the expanded body (interior of a drill-down — same permission as 4.2).
- **Invalid states:**
  - `settings.debugDiagnostics !== true` → **element absent from DOM** (not hidden; R-2.3 forbids `display:none` outside FSM transitions, but the strict rule here is *do not construct the DOM node at all* when the flag is off — consistent with "don't tease unavailable features").
  - Flag on but `lastGoodAdvice.audit == null` → header renders, chevron disabled (non-interactive) with a thin "no audit data for this advice" note inside the expanded body if the user opens it. The header stays mounted so Z4's stack order (4.1, 4.2, 4.3) is stable for users in debug mode (R-1.3, applied to the debug-on layout).

### 5. Interruption tier
`informational` (matches inventory). Not promoted.

### 6. Render lifecycle
- **Mount condition:** `settings.debugDiagnostics === true` at sidebar boot, or a live settings change that flips the flag on. A flag flip from off → on must be observed by the coordinator and trigger a `scheduleRender('debug_flag_on')`.
- **Update triggers (renderKey fingerprint fields):**
  - `settings.debugDiagnostics` (flip destroys/creates the DOM node).
  - `modelAuditOpen` (toggle).
  - `lastGoodAdvice.audit` identity (new audit replaces old).
  - `isAdviceStale` (inherits stale tint per batch invariant 5).
- **Unmount condition:** flag flips off → node removed from DOM on the next frame. Flag on but advice cleared → header stays mounted with a no-data note as above (so the debug user can still see "yes, Model Audit exists, currently empty").
- **`hand:new` behavior (R-2.4):**
  - `modelAuditOpen` resets to **closed** on `hand:new`. Same rationale as 4.1/4.2.
  - Flag state is independent of `hand:new` (a settings value, not a hand-scoped state).

### 7. Corpus coverage
- Default collapsed (flag on, audit present): **S3/01** (debug-flag scenarios).
- Expanded: **S5/01**.
- Flag off (4.3 absent from DOM): **TODO corpus extension** — replay harness should include at least one frame per zone with debug off. SR-6 task.
- Flag on + no audit data: **TODO corpus extension**.

### 8. Rejected alternatives
- **Rendering 4.3 always and hiding via CSS when flag off** was rejected: violates "don't tease unavailable features" and leaves a ghost slot that R-1.3 would then require stable — creating a permanent empty-state obligation in normal-user mode. Construct-on-flag is simpler and honest.
- **Separate debug flags for 0.7 and 4.3** was considered but rejected by owner 2026-04-12 (Group 2 Option A): one `settings.debugDiagnostics` key gates both; simpler mental model.

---

## Batch invariants (Z4-wide)

These apply across every Z4 element and bind the zone's layout contract. Stage 6 PR reviews check each as a gate.

1. **Collapsible state ownership (R-5.1).** The three `*Open` keys — `planPanelOpen` (4.1), `moreAnalysisOpen` (4.2), `modelAuditOpen` (4.3) — live on the render coordinator as the single source of truth. No module may mutate `classList` / `aria-expanded` / `hidden` on a Z4 collapsible without routing through the coordinator key and `scheduleRender`. This matches the RT-61 pattern shipped for 4.1 and extends it to 4.2 / 4.3 under SR-6. Direct DOM toggles are a spec violation (R-2.3).

2. **4.1 auto-expand contract (RT-61).** 4.1 is the **only** Z4 collapsible with an auto-expand trigger. The contract:
   - **Predicate:** fresh advice arrival (`push_advice`) with a non-empty `handPlan`.
   - **Delay:** 8 s timer (`coordinator.registerTimer('planPanelAutoExpand', handle, 'timeout')`, per RT-60 registration contract).
   - **Wins against:** nothing — any explicit user toggle (close or open) cancels the pending timer via `coordinator.clearTimer('planPanelAutoExpand')`.
   - **`hand:new` interaction (R-2.4):** `hand:new` resets `planPanelOpen → false` and clears any pending timer; the next advice arrival re-arms the timer if its predicate holds. A user who explicitly collapsed the panel mid-hand does NOT get it re-opened within the same hand even if new advice arrives — user collapse wins within the hand.
   - **Render path:** auto-expand updates coordinator state and calls `scheduleRender('planPanel_autoexpand', PRIORITY.IMMEDIATE)`. `renderPlanPanel` is the sole DOM writer — the timer never touches the DOM directly.
   4.2 and 4.3 have **no auto-expand**. Adding one in the future requires an R-11 amendment — not a silent SR-6 PR.

3. **Z4 reflow permission (scoped exception to R-1.3).** Within Z4, when an entire collapsible's data is absent (e.g. `handPlan == null` for 4.1, `alternatives` empty for 4.2, flag off for 4.3), that row unmounts and Z4's remaining rows reflow upward. This is **permitted** because Z4 is the below-the-fold secondary zone and the user's spatial memory for Z4 is *"collapsibles, top to bottom"* — not specific row indices. The rule set in Z1–Z3 (no reflow, blank slot in place) still applies *between* zones (Z4 does not push into Z3 or Z5) and **within the interior of an expanded collapsible** (4.2 sub-blocks reflow only when 4.2 is user-opened; closed-state layout is stable). Any future promotion of a Z4 row to `decision-critical` would revoke this permission for that row — see invariant 4.

4. **`informational`-only, never promoted (R-3.1 / R-3.2).** All three Z4 rows are `informational`. None may be promoted to `decision-critical` under any data condition — not even "high-EV alt sizing swings hero's decision". Z2 (action bar) and Z3 (street card) own `decision-critical` surfacing; Z4's job is the drill-down, not the headline. Concretely this forbids:
   - Pulsing / glow / auto-scroll on Z4 elements.
   - Color-pops in the collapsed row (the row stays in neutral palette; only the expanded body renders colored content).
   - Toasts or off-zone notifications sourced from Z4.
   - Any renderKey-driven auto-expand other than the 4.1 RT-61 path (which itself is `informational` in tier — the expansion is a comfort, not an interrupt).
   If a future finding demonstrates that a Z4 datum needs `decision-critical` surfacing, the correct fix is to **surface it in Z2/Z3** (route the datum into an existing or new decision-critical slot), not to promote Z4.

5. **Stale-advice inheritance (cross-zone contract with Z2).** The plan-panel half of 2.10 (stale-advice tint + "Stale Ns" badge) renders on 4.1's expanded body. Per `z2-decision.md` batch invariant 8:
   - Single data source: `lastGoodAdvice._receivedAt` + `currentLiveContext`.
   - Single renderKey field: `isAdviceStale`.
   - Single 1 Hz timer: `adviceAgeBadge` — there is not a second timer for the Z4 half.
   - Shared palette tokens (the `.stale` class rules in `side-panel.html`).
   4.2 and 4.3 **also inherit** stale tint when their expanded bodies render advice-derived content (alternatives, audit). Implementation: the Z4 zone container applies the `.stale` class; individual collapsibles do not query the stale state independently.

6. **Debug-flag contract for 4.3 (shared with 0.7).** The `settings.debugDiagnostics` key gates both rows. Rules:
   - Flag off → both 0.7 (footer link) and 4.3 (Model Audit collapsible) are **absent from the DOM**. Not `hidden`, not `display:none` — not constructed.
   - Flag flip (off → on or on → off) is observed by the coordinator and fires `scheduleRender` with a named reason (`'debug_flag_on'` / `'debug_flag_off'`) so both zones rebuild together.
   - No independent flags. A future need to gate 0.7 and 4.3 separately requires an R-11 amendment.
   - The footer link 0.7 and the collapsible 4.3 share the diagnostics co-trigger path (owner-approved 2026-04-12, Z0 batch): clicking either opens the same diagnostics panel; first-in-wins. This does not affect Z4's DOM; it only means 4.3's "Model Audit" content and 0.7's footer link share a destination when drilled into.

7. **Z4 placement and slot-collapse exception acknowledgment.** Z4 sits below Z3 in the main sidebar stack. Z4's three collapsible headers are each ~24 px tall when closed — total Z4 closed height is bounded at ~72 px (plus any decoration). When all three are absent (no plan, no alternatives, debug flag off), Z4 is a 0-px zone; this is a permitted slot-collapse because Z4 contributes nothing to the Z1–Z3 glance pathway and there is no user spatial memory at the Z4 bottom that would be corrupted. This permission is Z4-specific and does not generalize to other zones.

---

## Escalations

**None new from this batch.** The Z4 specs fit within existing doctrine and prior-batch decisions. Specifically:

- **E-2 (Z1 Rule V seat-arc ring)** — not a Z4 concern; pending owner decision is carried forward to SR-4 close or SR-5.
- **E-3 (Z2 S4/02-a + S4/02-b regressions)** — SR-6 follow-up; Z4 unaffected.
- **Z3 corpus gaps (3.6-villain-postflop, 3.11-multiway-selector, 3.12-no-aggressor)** — SR-6 harness additions; Z4 unaffected.
- **New Z4 corpus TODOs** — four frames flagged across §7 of 4.1 / 4.2 / 4.3 (RT-61 auto-expand before/after, no-plan path, 4.2 one-block path, flag-off absence, flag-on no-audit). None block this batch; all feed SR-6 harness extension.

No R-11 amendment is requested by this batch.

---

## Self-check (per README authoring order + handoff deliverables checklist)

- [x] One spec section per kept Z4 row in inventory order (4.1, 4.2, 4.3).
- [x] 8-field template used verbatim on every spec (§8 present on all three).
- [x] §3 glance pathway complete (all 4 sub-fields) on every spec.
- [x] ≥ 1 doctrine rule cited in §2 on every spec.
- [x] ≥ 1 S-frame cited in §7 on every spec; corpus gaps flagged as TODO for SR-6.
- [x] Every spec declares §6 `hand:new` behavior (R-2.4), including collapsible reset semantics (closed on every `hand:new`).
- [x] Collapsible state ownership rule declared — batch invariant 1.
- [x] RT-61 auto-expand contract declared for 4.1 — batch invariant 2 (including "user collapse wins within the hand" and `hand:new` timer clear).
- [x] Debug-flag absence-from-DOM rule declared for 4.3 — batch invariant 6 + 4.3 §4.
- [x] R-3.1 "informational-only, never promoted" rule declared for all Z4 rows — batch invariant 4.
- [x] Stale-advice cross-zone contract with Z2 declared — batch invariant 5 (cross-reference to `z2-decision.md` batch invariant 8).
- [x] No spec re-opens an inventory verdict; no new R-11 escalation.
- [x] Owner review requested.
