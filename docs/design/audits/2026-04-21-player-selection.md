# Audit — 2026-04-21 — Player Selection

**Scope:** Journey (player-selection) + 3 Surfaces (seat-context-menu, player-picker, player-editor)
**Auditor:** Claude (main)
**Method:** Heuristic walkthrough (Nielsen 10 + Poker-Live-Table + Mobile-Landscape) + JTBD trace per persona across 5 flows
**Status:** Draft — pending owner review

---

## Executive summary

Audited the three surfaces that ship the player-selection experience (shipped 5 days ago under PEO). The engine is sound — picker and editor are fresh builds with solid bones (recognition-first cards, feature-filter search, non-blocking form, draft autosave, retro-link undo). The defects are at the seams and at the edges: **menu ordering fights user intent** on occupied seats, **undo coverage is asymmetric** between paired actions (assign has undo; clear does not), **landscape scroll fails on sub-reference phones** for the editor's long form, and **touch targets shrink below 44px at scale <0.5**. Two findings (F1, F7) were pre-reported by the owner; the audit formalizes them with severity and recommended fixes. Eleven total findings surfaced, six of them ≥ severity 3.

---

## Scope details

- **Surfaces audited:** seat-context-menu, player-picker, player-editor.
- **Journeys audited:** player-selection (Flows A, B, C, D, E).
- **Personas considered:** Seat-swap Chris, Chris (core), Weekend Warrior, Rounder, Ringmaster, Circuit Grinder, Newcomer, Between-hands Chris, Post-session Chris. Nine personas across primary and secondary.
- **Heuristic sets applied:** Nielsen 10 (H-N01..10), Poker-Live-Table (H-PLT01..08), Mobile-Landscape (H-ML01..07).
- **Out of scope:** the actual player database logic; auth/permissions; sidebar integration; tournament-specific seat changes (Circuit Grinder's multi-day continuity — a distinct concern).

## Artifacts referenced

- `surfaces/seat-context-menu.md`, `surfaces/player-picker.md`, `surfaces/player-editor.md`
- `journeys/player-selection.md`
- `personas/situational/seat-swap-chris.md` (primary situational)
- `personas/core/chris-live-player.md`, `weekend-warrior.md`, `rounder.md`, `ringmaster-home-host.md`, `newcomer.md`
- `heuristics/nielsen-10.md`, `poker-live-table.md`, `mobile-landscape.md`
- `evidence/LEDGER.md`: EVID-2026-04-21-CLEAR-PLAYER, EVID-2026-04-21-LANDSCAPE-SCROLL

---

## Findings

### F1 — "Clear Player" buried at bottom of menu when seat is occupied

- **Severity:** 3 (blocks JTBD-PM-01 in primary situation for Seat-swap Chris; owner-reported)
- **Situations affected:** [Seat-swap Chris](../personas/situational/seat-swap-chris.md) (primary); [Between-hands Chris](../personas/situational/between-hands-chris.md) (secondary)
- **JTBD impact:** `JTBD-PM-01` Clear a seat — completes but with avoidable effort (extra scan/scroll). Target: <3s. Current: likely 4–6s per observation.
- **Heuristics violated:** [H-PLT07](../heuristics/poker-live-table.md) state-aware primary action (primary); H-N05 error prevention; H-N08 minimalist (when Clear is buried rather than promoted).
- **Evidence:** [EVID-2026-04-21-CLEAR-PLAYER](../evidence/LEDGER.md#evid-2026-04-21-clear-player) — owner statement; verified in code at `SeatContextMenu.jsx:91-99`.
- **Observation:** On an occupied seat, the owner reports that the most common post-departure intent is Clear. Current menu places Clear at position 7 (after 2 seat-config + 2 assign + up-to-3 recent-players). When seat is empty, Clear is correctly hidden. When seat is occupied, Clear should be *promoted*, not buried.
- **Recommended fix:** Reorder menu dynamically based on seat state.
  - **Empty seat:** Find Player → Create New Player → Recent list → Make My Seat / Make Dealer.
  - **Occupied seat:** **Clear Player (red, top)** → divider → Make My Seat → Make Dealer → divider → Find Player → Create New Player → Recent list.
  - Consider visual divider above Clear to reduce miss-tap risk (see F2).
- **Effort:** S (file-local changes to `SeatContextMenu.jsx` + test updates).
- **Risk:** Low. Menu rendering is stateless; parent handlers unchanged. Tests must verify both empty-seat and occupied-seat orderings.
- **Proposed backlog item:** `[P1] [AUDIT-2026-04-21 F1] Reorder seat context menu based on seat occupancy; promote Clear Player to top when occupied`

---

### F2 — No undo for Clear Player (destructive action without safety net)

- **Severity:** 3 (user can lose seat assignment to misclick; mitigation exists but friction-heavy)
- **Situations affected:** All seat-swap and between-hands situations; extreme for Rounder who has hundreds of player records where the seat-player mapping is harder to reconstruct from memory.
- **JTBD impact:** `JTBD-CC-01` / `CC-76` undo for destructive actions — fails for Clear specifically, passes for Assign+retro-link.
- **Heuristics violated:** H-N03 user control and freedom (primary); H-PLT06 zero-cost misclick absorption; H-N05 error prevention.
- **Evidence:** Implied by F1's ergonomics plus the established pattern of retro-link undo toast elsewhere (PEO-1). Code at `SeatContextMenu.jsx:93-98` shows direct invocation of `onClearPlayer(seat)` with no undo wrapper.
- **Observation:** Assign+retro-link shows an 8-second undo toast with explicit "Undo" action. Clear Player fires immediately with no toast, no confirmation, no retro-link counterpart. Asymmetric safety for paired operations.
- **Recommended fix:** Wrap `onClearPlayer` in an undo token / toast flow mirroring retro-link:
  - Capture prior `{ seat, playerId }` before clearing.
  - Show toast: "Cleared Seat N" with "Undo" action that re-assigns.
  - Toast lives for 5–8 seconds (match retro-link duration).
- **Effort:** S (requires small hook addition: `useClearSeatUndo` or similar).
- **Risk:** Low. Undo flow pattern is established. Must ensure retro-link state (if cleared seat had retro-linked prior hands) is also reversed on undo — may need a small decision about re-retro-link or leaving as "just re-assigned."
- **Proposed backlog item:** `[P1] [AUDIT-2026-04-21 F2] Add undo toast for Clear Player (mirror retro-link undo pattern)`

---

### F3 — Menu order not state-aware (H-PLT07 violation beyond just Clear)

- **Severity:** 2 (friction; see F1 for the most acute symptom, but principle applies beyond Clear)
- **Situations affected:** All seat-context-menu invocations.
- **JTBD impact:** Affects multiple PM-* JTBDs; not a single blocker, but a design-principle violation.
- **Heuristics violated:** H-PLT07 state-aware primary action (the explicit example in the heuristic file cites this menu).
- **Evidence:** Code inspection — menu renders identical order regardless of seat state; only Clear visibility changes.
- **Observation:** Beyond F1's acute problem, the principle that a seat's context menu should reflect the seat's state is broken in smaller ways too. For example, "Make My Seat" and "Make Dealer" are always at the top even when the user almost never reaches them on an occupied seat (those actions are typically set once per session). For a frequent-swap session, the menu should promote player-management and demote seat-config.
- **Recommended fix:** Adopt a general state-aware ordering policy. Document in `seat-context-menu.md` surface artifact.
  - Seat config (Make My Seat, Make Dealer) demoted below player management when seat is occupied.
  - Always at top: the single-most-likely action for the current state.
- **Effort:** S (included naturally in F1 fix if done well).
- **Risk:** Low.
- **Proposed backlog item:** Bundled with F1.

---

### F4 — Touch targets fall below 44px at scale < 0.5

- **Severity:** 3 (affects every surface at small-phone-landscape scale; mis-tap risk compounds across long sessions)
- **Situations affected:** All personas on small-phone landscape devices (~640×360 to 900×400 CSS px).
- **JTBD impact:** Indirect — increases mis-tap rate on all seat-context-menu / picker / editor interactions. Compounds into Flow A (Clear mis-tap) and Flow B (wrong ResultCard tap).
- **Heuristics violated:** H-ML06 (≥44 CSS-px after scale); H-ML04 (scale + layout math).
- **Evidence:** Code inspection — `SeatContextMenu.jsx:31` uses `py-2` (8px) → row height ≈36-40px DOM. At scale 0.5, visual height ~18-20px. Picker ResultCards are `py-2 gap-3` → similar DOM height ~64px (with avatar 48px) → ~32px visual at scale 0.5 (closer, but still below threshold per tap target).
- **Observation:** The `useScale` hook sets scale = min(w/1600, h/720, 1). On a 900×400 viewport this is ~0.556. On a 720×360 viewport, 0.45. Below ~0.5 scale, interaction targets on this flow risk mis-tap on the menu (adjacent red-bounded Clear + recent-player rows is the worst case).
- **Recommended fix:** Audit and increase minimum DOM-space row heights for interaction surfaces that live under the scale transform. Candidates:
  - `SeatContextMenu.jsx` menu rows: bump from `py-2` to `py-3` or enforce `min-h-[48px]`.
  - `ResultCard.jsx` is probably OK at 64px DOM; verify visually.
  - `FilterChips` chips are currently `px-2.5 py-1` (~28px tall) → at scale 0.5 they become ~14px visual → insufficient. Bump to `py-1.5` minimum.
- **Effort:** S (CSS-only changes).
- **Risk:** Low. Layout may shift slightly; visual verification needed on reference device.
- **Proposed backlog item:** `[P1] [AUDIT-2026-04-21 F4] Enforce 48 DOM-px min tap-target height on interactive rows in seat-context-menu + picker + editor`

---

### F5 — Filter chip panel expansion can push results awkwardly on short viewports

- **Severity:** 2 (friction; not blocking)
- **Situations affected:** Seat-swap Chris, Weekend Warrior, any persona on small-phone landscape.
- **JTBD impact:** `JTBD-PM-09` find player by visual features — completes but with visual awkwardness.
- **Heuristics violated:** H-ML02 scroll containers obvious; H-N08 minimalist.
- **Evidence:** Code inspection of `FilterChips.jsx:149-163` — the panel renders inline below the chip row in the same vertical flow as search input + results. On a viewport where the search + chips row already claim a significant percentage of visible height (small landscape), opening a shape panel (which can be tall — hair has 10+ options) pushes results below the fold.
- **Observation:** This is a milder cousin of F7 (editor scroll). Not yet reported by owner; surfaced as an anticipated issue.
- **Recommended fix:** Two options:
  1. Make the filter-chip panel overlay-positioned absolutely (above the result area, not flowing with it). Risk: overlays stack poorly in `overflow-auto`.
  2. Cap panel to a scrollable max-height (e.g., `max-h-32 overflow-y-auto`) so results never disappear entirely.
- **Effort:** S.
- **Risk:** Low–medium; visual verification across viewports needed.
- **Proposed backlog item:** `[P2] [AUDIT-2026-04-21 F5] Constrain filter-chip panel height / overlay to preserve result list visibility on short viewports`

---

### F6 — Picker does not flag "already assigned to another seat this session"

- **Severity:** 2 (friction with silent correctness risk — incorrect data if user accidentally double-assigns)
- **Situations affected:** Ringmaster (batch entry, multi-seat sessions), Rounder (busy sessions with regulars shuffling).
- **JTBD impact:** `JTBD-PM-02` assign known player — succeeds but may create inconsistent seat state.
- **Heuristics violated:** H-N01 visibility of system status; H-N05 error prevention.
- **Evidence:** Code inspection of `PlayerPickerView.jsx:61-106` — `handlePickPlayer` calls `assignPlayerToSeat(currentSeat, playerId)` unconditionally. No check for whether the player is already assigned elsewhere in the current session.
- **Observation:** If the same player is assigned to two seats concurrently, stats attribution is ambiguous. Unclear from code what the data layer does — likely overwrites prior seat assignment silently, leaving seat-1 empty. Needs verification. Either way, user gets no warning.
- **Recommended fix:** Pre-pick check — if target player is already assigned to another seat in the current session, show inline warning on the `ResultCard` ("already at seat 3") and require a confirmation tap to proceed (or offer a "move from seat 3 to seat 5?" affordance).
- **Effort:** M (touches picker + possibly PlayerContext to expose current-session-assignments lookup).
- **Risk:** Medium — changes interaction contract; must not break batch flow.
- **Proposed backlog item:** `[P2] [AUDIT-2026-04-21 F6] Detect + warn on duplicate-player-to-multiple-seats in picker`

---

### F7 — Player Editor cut off on small-phone landscape (landscape scroll failure)

- **Severity:** 3 (owner-reported; blocks JTBD-PM-03 in primary situation on small phones)
- **Situations affected:** [Seat-swap Chris](../personas/situational/seat-swap-chris.md) (primary); all personas on sub-reference viewports (~640×360 to 900×400).
- **JTBD impact:** `JTBD-PM-03` create a new player and assign — can't reach Save button or lower form sections on small-phone landscape.
- **Heuristics violated:** H-ML01 works-on-viewport-range; H-ML02 scroll containers obvious; H-ML04 respect scale transform.
- **Evidence:** [EVID-2026-04-21-LANDSCAPE-SCROLL](../evidence/LEDGER.md#evid-2026-04-21-landscape-scroll) — owner statement; partial code inspection at `PlayerEditorView.jsx:129-156`.
- **Observation:** Root is `min-h-screen bg-gray-100 flex flex-col` with `transform: scale(scale)` and `transformOrigin: 'top left'`. Body is `flex-1 overflow-auto`. Hypothesis: the interaction between (a) scale transform making everything visually smaller, (b) `min-h-screen` forcing DOM at 100vh regardless of scale, and (c) the body's dynamic height under flex-1 combines to either (i) make the scroll trigger in the wrong DOM region, or (ii) make the scroll area visually indistinguishable from non-scrolling content. The long form (9 avatar-feature sections + name + physical + notes + image upload) runs 1500–2000px DOM tall, far exceeding even 414px viewport.

  **Specific hypothesis requiring reproduction:** at scale 0.5 on a 900×400 viewport:
  - DOM root: 400px tall (min-h-screen = 100vh).
  - Body (flex-1): 400 - 41 (header) = ~359px DOM tall.
  - Content (form): ~2000px DOM tall.
  - Overflow-auto should trigger scroll on a 359px-bounded container.
  - Visual rendering: all scaled to 0.5 → 180px of body visible.
  - User attempts to scroll within body → drag should translate to scroll within the DOM-space bounded container.
  - If scroll DOES work but is not visually obvious (no scroll indicator), user perceives "cut off and doesn't scroll."
  - Alternative: if the scale transform interferes with touch-scroll event propagation, scroll may actually fail.

- **Recommended fix:** Two-phase.
  1. **Reproduction first** (Session 3, visual verification on 900×400 and 720×360 viewports). Confirm whether scroll works DOM-wise and the issue is *perception* (no scroll affordance) vs. *behavior* (scroll actually blocked).
  2. **Depending on root cause:**
     - If perception-only: add visible scroll-hint (fade gradient on bottom edge of body, a small chevron indicator). Also revisit `min-h-screen` — consider `h-screen` instead, which hard-bounds to viewport height and makes the flex-1 overflow-auto relationship cleaner at small scales.
     - If behavior-blocked: diagnose scale+touch-event interaction. Possible fixes: move the scale transform to a wrapper that doesn't interfere with touch-pointer events, or convert the scrollable body to use `-webkit-overflow-scrolling: touch` explicitly (iOS legacy consideration).
- **Effort:** M (reproduction + fix + regression tests across viewports).
- **Risk:** Medium — layout changes on an actively-used view. Needs visual verification on at least 3 viewport sizes.
- **Proposed backlog item:** `[P1] [AUDIT-2026-04-21 F7] Reproduce + fix Player Editor landscape scroll on small-phone viewports`

---

### F8 — AvatarFeatureBuilder: all categories expanded by default overwhelms Newcomer

- **Severity:** 2 (friction for Newcomer persona; non-blocking for others)
- **Situations affected:** [Newcomer](../personas/core/newcomer.md) (primary); [Weekend Warrior](../personas/core/weekend-warrior.md) first use.
- **JTBD impact:** `JTBD-PM-03` (create new player) — completes, but perceived complexity may cause abandonment (a trackable issue if telemetry existed).
- **Heuristics violated:** H-N08 minimalist design; H-N07 flexibility and efficiency (no quick path for users who don't want feature-rich avatars).
- **Evidence:** Code inspection of `AvatarFeatureBuilder.jsx` — 9 categories rendered always-open (Skin, Hair Style, Hair Color [conditional], Beard, Beard Color [conditional], Eyes, Eye Color, Glasses, Hat).
- **Observation:** The long vertical form is core to F7 as well. PhysicalSection (legacy physical-description form) is correctly collapsible; AvatarFeatureBuilder is not. Asymmetric density pattern. For a power user (Rounder, Chris) the always-open layout is fine. For a Newcomer it's intimidating.
- **Recommended fix:** Add a "Minimal / Full" toggle at the top of AvatarFeatureBuilder (or similar pattern). Minimal mode shows just Skin + Hair Style + Beard Style (the three high-recognition-value fields). Full mode shows everything. Default depending on persona / first-use state is a design question.
  - Alternative (simpler): collapse all categories except Skin by default, expand on tap. Less sophisticated but reduces vertical mass by ~70%.
- **Effort:** S (CSS + small state additions) or M (toggle UX).
- **Risk:** Low — touches only the editor.
- **Proposed backlog item:** `[P2] [AUDIT-2026-04-21 F8] Collapse AvatarFeatureBuilder categories by default or add Minimal/Full toggle`

---

### F9 — Asymmetric density pattern: PhysicalSection collapsible, AvatarFeatureBuilder not

- **Severity:** 1 (minor friction; design coherence issue)
- **Situations affected:** All editor users.
- **JTBD impact:** None directly; violates design consistency.
- **Heuristics violated:** H-N04 consistency and standards.
- **Evidence:** Code inspection — `PhysicalSection.jsx:30` uses `useState(false)` for default-closed; `AvatarFeatureBuilder.jsx` has no equivalent pattern.
- **Observation:** Two consecutive sections in the same form handle density differently. If the project preference is "optional / legacy content is collapsible," then AvatarFeatureBuilder's color-fields should follow suit (beard color, eye color arguably are elaborations not essentials). If preference is "all inline always," then PhysicalSection should expand by default.
- **Recommended fix:** Pick a consistent default. Recommendation: make PhysicalSection default-open when editing an existing record that has physical data; default-closed when creating. Bundled with F8 if F8 adopts the collapsible approach.
- **Effort:** XS (single-line fix once policy is decided).
- **Risk:** Low.
- **Proposed backlog item:** Bundle with F8.

---

### F10 — Swap-Player flow is implicit; no direct "Swap" action

- **Severity:** 2 (friction for Seat-swap Chris, Circuit Grinder; adds ~6s to every Swap)
- **Situations affected:** Seat-swap Chris (primary); Circuit Grinder (table-move day-2); Ringmaster (cash game cross-seat-change).
- **JTBD impact:** `JTBD-PM-04` swap the player on a seat — completes in two-step flow via F1-burdened clear-then-assign. Target: 10–15s total. Current with F1 burden: 18–25s.
- **Heuristics violated:** H-N07 flexibility and efficiency (accelerators for experts).
- **Evidence:** Journey Flow D analysis. No code supports a "Swap" action; the two-step path is the current practice.
- **Observation:** The current code in `PlayerPickerView.handlePickPlayer` likely overwrites an existing assignment silently (unverified). This is *implicitly* a swap, but the UI doesn't label it as such. A direct "Swap Player…" action in the context menu when seat is occupied would route to picker with context "replace seat N," visible and more honest.
- **Recommended fix:** Add "Swap Player…" action in `SeatContextMenu` when seat is occupied, alongside Clear Player. Routes to picker with `pickerContext.swapMode = true` (new field) so picker can signal "replacing John" in the top bar. Semantics = direct assign (no explicit clear needed).
- **Effort:** M (menu change + picker context + top-bar message + tests).
- **Risk:** Medium — introduces new user-facing flow; must not conflict with batch mode.
- **Proposed backlog item:** `[P2] [AUDIT-2026-04-21 F10] Add direct "Swap Player" flow to seat context menu`

---

### F11 — Seat-context-menu destructive-action adjacency (Clear next to Recent Player list)

- **Severity:** 2 (miss-tap risk with recurring cost)
- **Situations affected:** All users of the menu on occupied seats where Recent list is populated.
- **JTBD impact:** Indirect — amplifies F2's no-undo consequences.
- **Heuristics violated:** H-N05 error prevention; H-PLT06 zero-cost misclick absorption.
- **Evidence:** Code inspection — menu order places Recent Players immediately above Clear with only a 1px divider between the last Recent row and Clear.
- **Observation:** Tapping slightly-too-low on the last Recent row can land on Clear. Miss-tap rate compounds over hundreds of session interactions.
- **Recommended fix:** Bundled with F1. After reorder: Clear is at top with visible margin + divider above the Make-my-seat actions. Recent Players are deeper in the menu and NOT adjacent to Clear. Miss-tap risk resolved structurally.
- **Effort:** Absorbed into F1.
- **Risk:** None additional.
- **Proposed backlog item:** Bundled with F1.

---

## Observations without fixes

- **Batch mode re-entry is one-way.** If user assigns 2 seats normally then wants to batch the rest, there's no path. Not a finding because the batch pattern is uncommon mid-session; noted for future consideration.
- **No "save and add another" pattern in editor** for Ringmaster creating multiple new players at session start. Could promote the batch pattern from picker to editor. Out of scope — would require discovery.
- **Create-from-query CTA is sticky bottom,** which is good, but its tap area at scale 0.5 on a 900×400 viewport is ~22px visual. Similar issue to F4. Check as part of F4 sweep.
- **The "🔍 Find Player…" vs "+ Create New Player" pair uses two different icon styles** (Unicode emoji vs. textual "+"). Mild consistency issue (H-N04); not worth a finding.

## Open questions

- **What does `assignPlayerToSeat` do when the seat is already assigned to another player?** Verify: silent overwrite, or reject, or warn. If silent overwrite, F10 becomes more urgent; if reject, Flow D is literally impossible without Flow A first.
- **When a player is retro-linked, then assigned to a different seat, does the retro-link follow?** Verify. Possible data-integrity concern beyond UX scope.
- **Does batch mode handle the CreateFromQueryCTA → editor → save path?** Specifically: does batch-mode state survive the editor round-trip, or does it reset?

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 1 | F1 — Promote Clear to top when seat occupied | 3 | S | **P1** |
| 2 | F7 — Landscape scroll reproduction + fix | 3 | M | **P1** |
| 3 | F2 — Undo for Clear Player | 3 | S | **P1** |
| 4 | F4 — Touch-target minimum at scale <0.5 | 3 | S | **P1** |
| 5 | F6 — Duplicate-player-to-seats warning | 2 | M | P2 |
| 6 | F10 — Direct Swap Player action | 2 | M | P2 |
| 7 | F5 — Filter chip panel overlay / max-height | 2 | S | P2 |
| 8 | F8 — AvatarFeatureBuilder collapsible or toggle | 2 | S/M | P2 |
| 9 | F3 — Formalize state-aware menu order (bundled with F1) | 2 | - | (F1) |
| 10 | F11 — Destructive adjacency (bundled with F1) | 2 | - | (F1) |
| 11 | F9 — Density-consistency decision (bundled with F8) | 1 | XS | (F8) |

**Session 3 scope recommendation (P1 only):** F1+F3+F11 as a single commit (menu reorder); F2 as a single commit (undo); F4 as a single commit (touch targets); F7 as a separate commit (reproduction + fix with visual verification).

---

## Backlog proposals

Copy-paste ready for `.claude/BACKLOG.md`:

```
- [ ] [P1] [AUDIT-2026-04-21 F1+F3+F11] Reorder seat context menu based on occupancy; promote Clear to top when occupied, structural miss-tap prevention
- [ ] [P1] [AUDIT-2026-04-21 F2] Add undo toast for Clear Player (mirror retro-link undo pattern)
- [ ] [P1] [AUDIT-2026-04-21 F4] Enforce 48 DOM-px min tap-target height on seat-context-menu + picker + editor interactive rows
- [ ] [P1] [AUDIT-2026-04-21 F7] Reproduce + fix Player Editor landscape scroll on small-phone viewports
- [ ] [P2] [AUDIT-2026-04-21 F6] Detect + warn on duplicate-player-to-multiple-seats in picker
- [ ] [P2] [AUDIT-2026-04-21 F10] Add direct "Swap Player" flow to seat context menu
- [ ] [P2] [AUDIT-2026-04-21 F5] Constrain filter-chip panel height / overlay to preserve result visibility
- [ ] [P2] [AUDIT-2026-04-21 F8+F9] Collapse AvatarFeatureBuilder categories; align density pattern with PhysicalSection
```

## New discoveries surfaced during this audit

None — every finding maps to an *existing broken feature* rather than a *missing feature*. Observations without fixes may become future discoveries (save-and-add-another, batch re-entry, cross-session player cross-venue linking already in DISC-02).

## Severity rubric (for reference)

| Severity | Definition |
|----------|------------|
| 0 | Cosmetic. No functional impact. |
| 1 | Minor friction. JTBD completes with avoidable effort. |
| 2 | Blocks a secondary situation; JTBD completes in primary. |
| 3 | Blocks JTBD in a secondary situation OR causes destructive action in primary. |
| 4 | Blocks JTBD completion in primary situation OR causes silent data corruption. |

---

## Implementation status (Session 3 — 2026-04-21)

| Finding | Status | Notes |
|---------|--------|-------|
| F1 + F3 + F11 | ✅ Implemented | Menu reordered in `SeatContextMenu.jsx`; state-aware render; divider separation. |
| F2 | ✅ Implemented | Undo toast wired in `TableView.jsx` `handleClearPlayer`. |
| F4 | ✅ Implemented | `py-3 min-h-[44px]` on menu rows; filter chips bumped to `min-h-[36px]`. Pragmatic compromise — 44 DOM-px at scale 0.5 ≈ 22 visual. Full H-ML06 compliance would need 88 DOM-px, deferred. |
| F7 | ✅ Implemented | Root changed from `min-h-screen` to `h-screen` + `overflow-hidden`. Applied to both editor and picker for consistency. **Hypothesis-based fix — awaits visual verification.** |
| F5 | ✅ Implemented (Session 4) | `FilterChips.jsx` panels now `max-h-32 overflow-y-auto`. Panel scrolls internally instead of pushing results below fold. |
| F6 | ✅ Implemented (Session 4) | `ResultCard` shows "at seat N" badge when player is assigned elsewhere. `PlayerPickerView.handlePickPlayer` clears prior seat before assigning and shows "Moved from seat X to seat Y" toast. Eliminates silent double-assign. |
| F8 + F9 | ✅ Implemented (Session 4) | `AvatarFeatureBuilder` secondary rows (Eyes / Eye Color / Glasses / Hat) collapsed behind "More details" toggle matching `PhysicalSection` pattern. Auto-expands if record already has non-default selections in that group (edit mode preserves visibility). Primary rows (Skin, Hair, Beard + conditional colors) remain visible. |
| F10 | ✅ Implemented (Session 4) | "⇄ Swap Player…" action in `SeatContextMenu` when seat is occupied. Routes to picker with `swapMode: true`. Picker top-bar labels action as "Swap <prior name> (seat N)". Behavior reuses the same F6 move logic (clear prior + assign). |

**Verification caveat:** Visual verification via Playwright MCP failed (`browser_navigate` returned "Target page, context or browser has been closed"). Owner should verify on physical phone before closing P1 findings. Test suite: 6120/6122 passing (2 pre-existing flaky Monte Carlo tests, unrelated).

## Review sign-off

- **Drafted by:** Claude (main) on 2026-04-21.
- **Reviewed by:** pending owner review of Session 3 implementation.
- **Closed:** pending visual verification on physical device.

Audit is immutable after close. Follow-up audits create a new file.

---

## Change log

- 2026-04-21 — Draft.
- 2026-04-21 — Session 3 implementation status appended.
