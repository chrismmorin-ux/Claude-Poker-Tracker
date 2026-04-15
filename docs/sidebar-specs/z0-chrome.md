# Z0 — Chrome specs

**Batch 1 of 6 (SR-4).** Per-element specs for every Z0 row with a non-`delete` verdict, authored against doctrine v2 (`docs/SIDEBAR_DESIGN_PRINCIPLES.md`).

**Inventory source:** `docs/SIDEBAR_PANEL_INVENTORY.md` §Z0 (rows 0.1–0.9).

**Omitted rows:**
- **0.3** hand-count pill — deleted per inventory (duplicate of 0.2; spatial ambiguity under R-1.5).
- **0.5** refresh button — merged into 0.1 as a conditional affordance (see §0.1 below).

**Spec count:** 7 elements.

---

## 0.1 Pipeline dot (+ absorbed 0.5 refresh)

```spec-meta
tier: ambient
owner: side-panel.js:renderAll
slot: "#status-dot, #refresh-btn"
```

### 1. Inventory row
`0.1 Pipeline dot (top-left green/amber)`. Absorbs `0.5 Refresh button` — refresh affordance is conditionally exposed by this element when the pipeline is non-green.

### 2. Doctrine citations
R-1.1 (fixed zone position), R-1.2 (spatial stability), R-1.3 (no reflow on state change — dot occupies its slot whether green, amber, or red), R-1.5 (glance pathway), R-3.1 (ambient tier), R-5.1 (single owner of the Z0 pipeline slot).

### 3. Glance pathway
- **Remembered location:** Z0, top-left slot, fixed 12×12 px dot inside a 40×40 px tap-target bounding box.
- **Default summary:** filled circle — **green** (healthy), **amber** (degraded), **red** (broken). Color is the entire glance-readable signal; no text.
- **Drill-down affordance:** **tap target** (per vocabulary). Active only when dot is non-green; tap invokes pipeline refresh. When green, the tap target is inert (glance-only — no affordance exposed, no cursor change).
- **Expansion location:** in-place. Refresh is a fire-and-forget action — no expansion. Resulting health change is re-reflected in the same dot.

### 4. Data contract
- **Source:** `push_pipeline_status` → overall health rollup.
- **Compute:** map rollup → `{green|amber|red}` via the existing pipeline-health reducer in side-panel.js (no new derivation).
- **Invalid states:** none. The dot always renders; absence of data renders the red state with the "stack idle" subtitle owned by 0.9 (not this element). Missing `push_pipeline_status` after mount = red, never blanked.

### 5. Interruption tier
`ambient` (matches inventory). Never preempts; color change is a glance-only signal.

### 6. Render lifecycle
- **Mount condition:** sidebar boot. Element is present for the lifetime of the panel.
- **Update triggers:** `renderKey` fingerprint field for pipeline health rollup. Also the conditional affordance visibility (inert vs. active tap target) flips on the same field.
- **Unmount condition:** never. Persists across `hand:new` and table switches.

### 7. Corpus coverage
- Default green: S1/01, S4/01.
- Non-green (refresh affordance active): S8/01, S9/01 (pipeline health strip paired).
- **TODO corpus extension:** no frame currently captures a user tap on the dot invoking refresh. SR-6 test harness should add a synthetic tap event against S8/01 state.

### 8. Rejected alternatives
Keeping 0.5 as a distinct button was rejected for two reasons: (a) a visible refresh button encourages unneeded resets when the pipeline is healthy, and (b) a separate button adds a second glance target to the same health concern, violating R-1.5's "one affordance per intent" principle. Folding refresh into the dot as a conditional tap target preserves the remembered location for both functions.

---

## 0.2 "N hands captured" label

```spec-meta
tier: ambient
owner: side-panel.js:renderAll
slot: "#hand-count"
```

### 1. Inventory row
`0.2 "N hands captured" label`.

### 2. Doctrine citations
R-1.1, R-1.2, R-1.3 (must render "0 captured" rather than collapse when zero), R-1.5, R-3.1 (ambient), R-4.2 (unknown placeholder, not silent blank).

### 3. Glance pathway
- **Remembered location:** Z0, top strip, immediately right of the pipeline dot. Fixed slot width (sized to the widest expected numeral — "9999 captured" — plus label).
- **Default summary:** `N captured` as a compact numeric label. Examples: `127 captured`, `0 captured`.
- **Drill-down affordance:** none (glance-only).
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `side_panel_hands` store (count of hands for the current session in IndexedDB-mirrored state).
- **Compute:** integer count only.
- **Invalid states:** if the store is unreachable (boot race), render the R-4.2 unknown placeholder `— captured`, not `0 captured`. `0 captured` is a valid data state (zero hands this session) and is distinct from "unknown".

Per handoff guidance (doctrine R-1.3 implication): when pipeline is idle and zero hands exist, this label **does not hide**. It renders `0 captured`. The pipeline idle message lives in 0.9, not here.

### 5. Interruption tier
`ambient`.

### 6. Render lifecycle
- **Mount condition:** sidebar boot.
- **Update triggers:** `renderKey` field tracking hand-count. New hand capture increments; table switch resets per session semantics.
- **Unmount condition:** never.

### 7. Corpus coverage
- Non-zero: S1/01, S5/01.
- Zero state: S8/01 (no table) renders this element alongside the 0.9 idle strip.
- Unknown placeholder: **TODO** — no corpus frame captures boot-race state. SR-6 unit test covers.

---

## 0.4 App-state badge ("App synced" / "App not open")

```spec-meta
tier: ambient
owner: side-panel.js:renderAll
slot: "#app-status"
```

### 1. Inventory row
`0.4 App-state badge`.

### 2. Doctrine citations
R-1.1, R-1.2, R-1.3, R-1.5, R-3.1 (ambient), R-4.1 (value + source present; no silent absence).

### 3. Glance pathway
- **Remembered location:** Z0, top strip, right of 0.2. Fixed slot width sized to the longer label (`App not open`).
- **Default summary:** pill-shaped badge with text `App synced` (subdued green) or `App not open` (subdued red). Color-plus-text; glance-readable in under 1s via color and confirmable via the label.
- **Drill-down affordance:** none (glance-only). Note: the Zx row X.1 "Launch Poker Tracker →" CTA is the user-action path for `App not open`; it renders in the Zx override region, not here, per R-5.1 single-owner.
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `app-bridge` presence signal in side-panel.js.
- **Compute:** boolean → `{synced | not open}`.
- **Invalid states:** during boot before the bridge reports, render `App not open` (the conservative default) rather than a third "unknown" state. Rationale: the bridge's absence *is* the "not open" signal in practice, and introducing a third state would add a glance target without informational content.

### 5. Interruption tier
`ambient`.

### 6. Render lifecycle
- **Mount condition:** sidebar boot.
- **Update triggers:** `renderKey` field tracking `app-bridge` connected/disconnected.
- **Unmount condition:** never.

### 7. Corpus coverage
- Synced: S1/01.
- Not open: S3/01, S4/02.

---

## 0.6 "show tournament log" link

```spec-meta
tier: ambient
owner: side-panel.js:renderAll
slot: "#tourney-log-show"
```

### 1. Inventory row
`0.6 "show tournament log" link (footer)` — **conditional-render** per inventory (hide when `lastGoodTournament == null`).

### 2. Doctrine citations
R-1.1, R-1.3 (must not cause reflow when hidden — see §Batch invariants below), R-1.5, R-3.1 (ambient), R-5.1.

### 3. Glance pathway
- **Remembered location:** Z0 footer, leftmost footer slot. Fixed slot width sized to the longer label. When the element is hidden (cash game), the slot is **present but empty** — it does not collapse or allow 0.7 to shift left. See §Batch invariants.
- **Default summary:** underlined text link `show tournament log`.
- **Drill-down affordance:** **underlined text link** (per vocabulary). Clicking navigates to the tournament-log view (dedicated view pattern).
- **Expansion location:** dedicated view (existing behavior). Justified deviation from the in-place default because the tournament log is a scrolling time-series that would violate Z0's fixed height if expanded in place.

### 4. Data contract
- **Source:** `lastGoodTournament` in side-panel.js.
- **Compute:** visibility = `lastGoodTournament != null`.
- **Invalid states:** when `lastGoodTournament == null` (cash game), the link is not rendered (its slot remains reserved — see §Batch invariants).

### 5. Interruption tier
`ambient`.

### 6. Render lifecycle
- **Mount condition:** first `push_tournament` with non-null payload.
- **Update triggers:** `renderKey` field tracking `lastGoodTournament` presence.
- **Unmount condition:** table switch to a cash context (`lastGoodTournament` cleared). Slot is blanked but not collapsed.

### 7. Corpus coverage
- Rendered (tournament): S1/01 (tournament context), S10/01.
- Hidden (cash): any cash-only frame — S3/01, S5/01 exercise the null state.

---

## 0.7 "show diagnostics" link

```spec-meta
tier: ambient
owner: side-panel.js:renderDiagnosticsGate
slot: "#diag-footer, #diag-show"
```

### 1. Inventory row
`0.7 "show diagnostics" link (footer)` — keep behind debug flag (paired with 4.3 on same setting).

### 2. Doctrine citations
R-1.1, R-1.3, R-1.5, R-3.1 (ambient), R-5.1.

### 3. Glance pathway
- **Remembered location:** Z0 footer, right of 0.6's slot. Fixed slot width. Hidden by default for non-debug users — the slot collapses entirely in the non-debug build (see §Batch invariants note on debug-flag slots).
- **Default summary (debug-on only):** underlined text link `show diagnostics`.
- **Drill-down affordance:** **underlined text link**. Clicks reveal the diagnostics panel (existing `diag-panel` DOM — owned by side-panel.js, expands inline below Z0 / above Z1).
- **Expansion location:** in-place below Z0 (the existing `diag-panel` container). This is an accepted exception: the diagnostics panel grows vertically in its own slot without displacing Z1+ because the whole panel is gated off for non-debug users (no glance-target disruption for normal play).

### 4. Data contract
- **Source:** debug-flag setting. **No existing flag** was found in side-panel.js; the current `diag-show` button is always visible and toggles a session-local `diagVisible` boolean (side-panel.js:1971–1979). The spec proposes a persisted setting key: `settings.debugDiagnostics` (boolean, default `false`), stored in `chrome.storage.local`. The same key gates 4.3 Model Audit. **Flagged for owner confirmation** — this is a new setting key; per R-11 this is not an inventory-verdict re-opening but is a new surface. If the owner prefers a different name, amend this spec.
- **Compute:** visibility = `settings.debugDiagnostics === true`.
- **Invalid states:** missing setting (never written) = treated as `false`. Element not rendered.

### 5. Interruption tier
`ambient`.

### 6. Render lifecycle
- **Mount condition:** sidebar boot if `settings.debugDiagnostics === true`.
- **Update triggers:** setting change (rare; requires extension reload or a settings-update message).
- **Unmount condition:** setting flipped to `false`.

### 7. Corpus coverage
- Debug-on: S1/01 (corpus was captured with the current always-visible button).
- Debug-off: **TODO corpus extension** — no frame yet captures the sidebar with the diagnostics link suppressed behind a flag. SR-6 harness should capture this as a new S-frame once the flag ships.

### 8. Rejected alternatives
A per-element debug flag (one for 0.7, another for 4.3) was rejected in favor of a single shared setting — user intent ("show me the debug stuff") maps to a single decision, and two independent flags add configuration surface without value.

---

## 0.8 Invariant violation "!" badge

```spec-meta
tier: emergency
owner: side-panel.js:renderAll
slot: "#status-text"
```

### 1. Inventory row
`0.8 Invariant violation "!" badge (red, status bar)` — emergency tier, 30s auto-decay (RT-66 pattern).

### 2. Doctrine citations
R-1.1, R-1.3, R-1.5, R-3.1 (**emergency** tier — the only Z0 element with this tier), R-7.1 (`emergency` invariant level), R-7.4 (observable via this badge + diagnostics counter).

### 3. Glance pathway
- **Remembered location:** Z0 status bar, fixed slot at the right edge of the top strip. Slot is **always reserved** (empty when no violation, 16×16 px badge when active). R-1.3 forbids reflow.
- **Default summary:** red circular badge with a white `!` glyph. Title attribute carries the violation count and a "copy diagnostics for details" hint (existing side-panel.js:1615).
- **Drill-down affordance:** **tap target** (40×40 px bounding box). Tap opens the diagnostics panel (same expansion destination as 0.7). Rationale: the natural user intent after seeing "!" is "tell me what broke" — diagnostics is where the violation log lives.
- **Expansion location:** in-place below Z0 (reuses the 0.7 diagnostics panel). Same justified deviation as 0.7.

### 4. Data contract
- **Source:** `StateInvariantChecker` violation events (existing in side-panel.js).
- **Compute:** visible iff `snap.lastViolationCount > 0` within the decay window.
- **Invalid states:** none — a zero count renders the empty reserved slot, not a placeholder.

### 5. Interruption tier
`emergency`. Only Z0 element at this tier. Per R-3.3 it may preempt equal or lower tiers, but because Z0 is a fixed status strip, preemption here means the badge is the most salient visual in Z0 while active — not that it displaces other Z0 elements (which remain at their remembered locations).

### 6. Render lifecycle
- **Mount condition:** first invariant violation; badge appears in its reserved slot.
- **Update triggers:** `renderKey` field tracking `lastViolationCount` and the decay timer's tick (coarse — per doctrine R-6.4 animation fires on state transitions only).
- **Unmount condition:** 30s since last violation elapses (per R-2.5, the decay timer is owned by this element's FSM and cleared on exit from the `active` state). "Unmount" here means the badge blanks; the slot itself remains reserved.

### 7. Corpus coverage
- Active badge: **S6/01** (authoritative for decay timing; corpus captured under fake-clock per handoff gotcha).
- Post-decay (slot reserved, badge blanked): same S6 replay past the 30s mark.

### 8. Rejected alternatives
Placing this badge in Z4 diagnostics was rejected — an emergency-tier signal that lives behind a debug flag is not an emergency signal. It must be visible to all users, hence Z0.

---

## 0.9 Pipeline health strip

```spec-meta
tier: informational
owner: side-panel.js:renderAll
slot: "#pipeline-health"
```

### 1. Inventory row
`0.9 Pipeline health strip` — PROBE → BRIDGE → FILTER → PORT → PANEL with connectivity dots + explanatory subtitle.

### 2. Doctrine citations
R-1.1, R-1.2, R-1.3, R-1.5, R-3.1 (**informational** — see note below), R-4.1.

**Tier note:** the handoff gotcha explicitly reminds authors "0.9 is informational not emergency. It describes *layer* health, not alerts. Do not upgrade tier." This spec honors that: emergency-tier alerts are the sole province of 0.8.

### 3. Glance pathway
- **Remembered location:** Z0, second row (below the 0.1/0.2/0.4 top strip). Fixed-height strip spanning the full sidebar width. Five labeled layer nodes (PROBE, BRIDGE, FILTER, PORT, PANEL) in fixed left-to-right order with a connectivity dot next to each.
- **Default summary:** per-layer dot (green/amber/red), plus a one-line subtitle underneath describing the earliest broken layer — e.g. "Waiting for capture script — is the Ignition page open?". When all green, the strip renders but the subtitle is blank and dots are all green; the strip is never hidden (R-1.3).
- **Drill-down affordance:** none at this layer. (Diagnostics is the user's drill-down path, reached via 0.7 or 0.8.)
- **Expansion location:** n/a.

### 4. Data contract
- **Source:** `push_pipeline_status` layer breakdown + `cachedDiagnosticData` for the subtitle (via `getDiagnosticStatus` in side-panel.js:699).
- **Compute:** map each layer's status to a dot color; subtitle chosen by the first non-healthy layer (existing logic).
- **Invalid states:** if `push_pipeline_status` is entirely absent after boot grace, render all-amber dots with subtitle `Waiting for pipeline status…`. Do not render all-green in the absence of data (that would be a silent stale — violates R-4.4).

### 5. Interruption tier
`informational`.

### 6. Render lifecycle
- **Mount condition:** sidebar boot.
- **Update triggers:** `renderKey` fields for per-layer status + subtitle text.
- **Unmount condition:** never.

### 7. Corpus coverage
- Degraded (waiting for capture script): S8/01.
- Recovery banner concurrent: S9/01 (0.9 renders alongside X.4a/b/c).
- All-green: implicit in S1/01, S5/01 (dots present, subtitle blank — **TODO** confirm corpus frame actually captures the strip in all-green rather than it being hidden in the current build).

---

## Batch invariants (Z0-wide)

These rules apply across every Z0 element and bind the zone's layout contract. Stage 6 PR reviews check each of these as a gate.

1. **Always-visible.** Every Z0 element renders at every tier (active hand, between-hands, observer, tournament, cash, no-table, recovery). Z0 is never displaced by Zx overrides; overrides render *below* Z0, never on top of it.
2. **Fixed row heights.** Z0 occupies exactly two rows: a top **status strip** (containing 0.1, 0.2, 0.4, 0.8) and the **health strip** (0.9). Row heights are declared in CSS and do not change with data. Footer elements 0.6 and 0.7 occupy a third row inside Z0 only if SR-5 confirms the footer is part of Z0's fixed height; otherwise they live in a distinct sub-zone. **Open for SR-5 architecture audit** — spec'd here under Z0 per inventory assignment.
3. **Left-to-right slot order (top strip):** `[0.1 dot] [0.2 hands-captured] [0.4 app-badge] ... [0.8 violation badge]`. Slots are present whether or not their content is active. The violation badge slot is always reserved at the right edge even when empty (R-1.3).
4. **Left-to-right slot order (footer):** `[0.6 tournament-log link] [0.7 diagnostics link]`. The 0.6 slot is reserved whether or not the tournament link is rendered (cash games show an empty slot of the same width — prevents 0.7 from shifting left and breaking spatial memory for users who toggle between cash and tournament during a session).
5. **Debug-flag slot policy.** The 0.7 slot is the one exception to rule 4: when `settings.debugDiagnostics === false`, the slot is **collapsed entirely** (zero width) because non-debug users never see it and cannot form spatial memory of its position. Debug-on users see 0.7 in its reserved slot consistently. This is the minimum-surprise policy.
6. **Single-owner.** Every Z0 slot has exactly one FSM owner in the rendering module (R-5.1). No other module writes to Z0 DOM nodes. The diagnostics panel expansion (0.7 / 0.8) is the only Z0-initiated write that extends beyond the Z0 container; the diagnostics panel's DOM ownership is shared with the element that opened it (first-in-wins — if 0.8 opens it and the user then taps 0.7, the panel stays open, unchanged).
7. **Debug-flag pairing.** 0.7 and 4.3 are gated by a single setting key: `settings.debugDiagnostics`. No independent flag for either. Flipping the key toggles both elements' visibility in lockstep.
8. **`hand:new` behavior (R-2.4).** Every Z0 element declares its `hand:new` behavior implicitly by being hand-agnostic: none of them reset, reload, or re-evaluate on a new hand. The Z0 pipeline state, hand count, app-bridge state, tournament presence, debug flag, and invariant decay timer are all hand-independent. This is the declaration of compliance with R-2.4 for the zone.

---

## Escalations

None. No inventory verdict was re-opened; no doctrine rule required amendment. One new surface (`settings.debugDiagnostics` key) is proposed in §0.7 and flagged for owner confirmation — not an escalation, but calling it out explicitly so it does not slip through.

## Self-check (per README authoring order)

- [x] One section per kept Z0 row in inventory order.
- [x] 8-field template used verbatim (§8 optional where no meaningful alternatives).
- [x] §3 glance pathway complete (all 4 sub-fields) on every spec.
- [x] ≥1 doctrine rule cited in §2 on every spec.
- [x] ≥1 S-frame cited in §7 on every spec (with TODO extensions noted where corpus is thin).
- [x] No spec re-opens an inventory verdict.
- [x] Batch invariants section present.

Awaiting owner review.
