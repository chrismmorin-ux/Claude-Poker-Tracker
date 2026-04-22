# Audit — 2026-04-22 — players-view

**Scope:** Surface — `players-view` (the routed Player Management top-level view; distinct from the in-table `player-picker` + `player-editor` surfaces shipped under PEO)
**Auditor:** Claude (main) via code inspection + Playwright MCP walk
**Method:** Gate-4 Design audit. Code review of `src/components/views/PlayersView.jsx` (509 lines) + live walk at 1600×720 via Playwright + DOM measurement of touch targets + heuristic evaluation against Nielsen-10, Mobile-Landscape, Poker-Live-Table heuristics.
**Status:** Draft

---

## Executive summary

**Verdict: RED.** Three P0 destructive-action anti-patterns — the same class that DCOMP Wave 1 systematically eliminated from TableView / ShowdownView / SessionsView — persist on players-view. Notable: SessionsView-F1 (shipped 2026-04-21) replaced a confirm() delete with a 12s toast+undo, but PlayersView still uses a blocking modal with "This action cannot be undone" copy on its own delete flow. Plus `handleClearAllSeats` uses native `confirm()` directly. Plus the per-seat "Clear" button commits silently with no undo. Secondary pattern: every row-level action button (Range / Edit / Delete, and per-seat Clear) is well below the ≥44px touch-target minimum (H-ML06). 4 P0 / 4 P1 / 3 P2 / 2 P3 findings total. Unblocks W4 only after P0 fixes ship.

---

## Scope details

- **Surface audited:** `players-view`
- **Personas considered:** Chris (out-of-session edits), Ringmaster (pre-game seat assignment), Rounder / Hybrid Semi-Pro / Circuit Grinder (database browse + edit), Coach (student inspection)
- **JTBDs audited:** PM-02, PM-04, PM-05 (grid-based), PM-07, PM-09, SR-23
- **Heuristic sets applied:** Nielsen-10 + Mobile-Landscape + Poker-Live-Table
- **Out of scope:** player-picker (PEO-3) + player-editor (PEO-2) audited separately as `2026-04-21-player-selection.md`; `RangeDetailPanel` overlay details (covered under stats-view)

## Artifacts referenced

- `src/components/views/PlayersView.jsx` — the view (code-inspected 1:1)
- `src/components/ui/PlayerRow.jsx` — row-level component (action button sizes inherited from here)
- `src/components/ui/SeatAssignmentGrid.jsx` — seat grid + per-seat Clear button
- `src/components/ui/PlayerFilters.jsx` — filter row (8 selects + search + sort)
- `docs/design/surfaces/players-view.md` — surface artifact (pre-audit)
- `docs/design/heuristics/nielsen-10.md`, `mobile-landscape.md`, `poker-live-table.md`
- `docs/design/audits/2026-04-21-player-selection.md` — sibling audit on picker/editor flow (no findings overlap this audit)

---

## Findings

Ordered by severity descending, then by effort ascending.

### F1 — `handleClearAllSeats` uses native confirm() dialog

- **Severity:** 4 (P0)
- **Situations affected:** Ringmaster pre-game setup persona — most frequent user of this button
- **JTBD impact:** PM-05 (batch seat assignment) — the undo path to "I clicked Clear All Seats by accident" is missing
- **Heuristics violated:** H-N5 (error prevention — destructive action without toast+undo), H-PLT-04 (no confirmation native dialogs during live play), Wave-1-established pattern (12s toast+undo)
- **Evidence:** `PlayersView.jsx:219` — `if (confirm('Clear all seat assignments? This will not delete any players.')) { clearAllSeatAssignments(); setSelectedSeat(null); }`
- **Observation:** Blocking native confirm dialog; no undo. Same anti-pattern class as Wave 1's `window.confirm` elimination across TV/SDV/SV. No reason this surface was exempt.
- **Recommended fix:** Replace with optimistic clear + toast with Undo button (12s). Capture the previous `seatPlayers` object in the undo token; on undo, dispatch a restore action. Matches TV-F1 / SV-F1 pattern.
- **Effort:** S
- **Risk:** Low — pattern is established and tested in three other surfaces.
- **Proposed backlog item:** `LSW-F2-A1 — PlayersView Clear All Seats → toast+undo` (P0)

### F2 — Delete Player uses blocking modal with "cannot be undone" copy

- **Severity:** 4 (P0)
- **Situations affected:** Every persona that edits the player database
- **JTBD impact:** PM-07 edit a player record — accidental delete has no recovery path
- **Heuristics violated:** H-N3 (user control and freedom — no escape from committed action), H-N5 (error prevention), Wave-1-established pattern (SV-F1 made session-delete undoable)
- **Evidence:** `PlayersView.jsx:432-462` — delete confirmation dialog with literal copy: "Are you sure you want to delete **{name}**? This action cannot be undone."
- **Observation:** The whole point of SV-F1 was establishing that "destructive action + no undo" is a Wave-1 anti-pattern. A player with 6+ months of tendency data is a higher-consequence delete than a session. The "cannot be undone" copy is accurate in the current implementation but is itself the leak — not a necessary property of the action.
- **Recommended fix:** Follow SessionsView-F1 pattern — optimistic delete + deferred commit (the player record stays in IDB for 12s, is visually removed from the list, undo restores fully including tendency aggregates + any seat assignment). Drop the blocking modal entirely.
- **Effort:** M — deferred-delete requires session-scoped cache + cancellation of the IDB delete on undo. Sessions persistence pattern is replicable but the deletion has side effects (seat assignment clears, tendency cleanup) that need to be undone too.
- **Risk:** Medium — undo semantics for delete-with-side-effects are trickier than delete-only. Reference `useSessionPersistence.deferSessionDelete` for the pattern.
- **Proposed backlog item:** `LSW-F2-A2 — PlayersView Delete Player → deferred-delete toast+undo` (P0)

### F3 — Per-seat "Clear" button commits silently (no undo, no toast)

- **Severity:** 4 (P0)
- **Situations affected:** Ringmaster setup persona + anyone fixing a seat assignment
- **JTBD impact:** PM-02 / PM-04 — misclick on a crowded seat row removes a player's seat binding silently
- **Heuristics violated:** H-N5 (error prevention), H-PLT-03 (visible destructive consequences)
- **Evidence:** `SeatAssignmentGrid.jsx` `onClearSeat={clearSeatAssignment}` — called directly. The "Clear" text sits beneath each occupied seat's player name at 24×16px (see F7).
- **Observation:** A 24×16 text-link that directly mutates state on tap, with no confirmation, no toast, no undo. Worst-in-class combination: tiny target + instant destructive commit.
- **Recommended fix:** Add a lightweight undo toast for per-seat clear (reuse the same undo-token pattern as F1's Clear All Seats). Not a modal — just a toast with Undo.
- **Effort:** S — one call site + reuse F1's undo token.
- **Risk:** Low.
- **Proposed backlog item:** `LSW-F2-A3 — PlayersView per-seat Clear → toast+undo` (P0)

### F4 — "Clear All Seats" button styled destructive (red bg) but guarded only by native confirm

- **Severity:** 3 (P1; pairs with F1)
- **Situations affected:** Same as F1
- **JTBD impact:** Same as F1
- **Heuristics violated:** H-N5 + visual-signal/actual-behavior mismatch
- **Evidence:** Button measured bg = `rgb(220, 38, 38)` (red-600) — a destructive color signal — combined with F1's native `confirm()` call (which itself is the anti-pattern).
- **Observation:** The color is right (user sees "this is destructive"); the guard is wrong (native dialog instead of toast+undo). This is one finding that bundles with F1's fix.
- **Recommended fix:** Folded into F1 — when F1's toast+undo ships, the red color remains correct and now the guard matches Wave-1 pattern.
- **Effort:** S (covered by F1)
- **Proposed backlog item:** Bundled with F1 (no separate ticket).

### F5 — Row action buttons (Range / Edit / Delete) are 22–35 × 20px

- **Severity:** 3 (P1)
- **Situations affected:** All personas at 1600×720 mobile-landscape reference
- **JTBD impact:** PM-07 (edit) + SR-23 (range inspect) + delete — all require precise tap on sub-minimum targets
- **Heuristics violated:** H-ML06 (minimum 44×44 touch target)
- **Evidence:** DOM-measured via Playwright — `rowRange` 34×20, `rowEdit` 22×20, `rowDelete` 35×20. All text-link-styled (`background: transparent`).
- **Observation:** 57 row-action buttons visible at once (19 players × 3 actions). Each is a text link with no padding-to-44px. On the reference device this fails mobile-landscape heuristic uniformly — and the problem scales with the player-list length.
- **Recommended fix:** Convert the three per-row actions to icon buttons in a horizontal strip with ≥44px hit area (icon-only with tooltip on hover, or icon+label with sufficient padding). Alternative: row-level overflow menu (⋮) that expands a context menu — reduces permanent per-row surface area from 3 actions to 1.
- **Effort:** M — requires PlayerRow.jsx touch-target refactor; affects a dense, test-covered component. SessionsView's ActiveSessionCard delete pattern is a direct referent.
- **Risk:** Medium — visual density change; test updates needed for PlayerRow.test.jsx.
- **Proposed backlog item:** `LSW-F2-A4 — PlayerRow row-actions touch-target refactor` (P1)

### F6 — Per-seat "Clear" button is 24×16px

- **Severity:** 3 (P1)
- **Situations affected:** Every user of the seat grid
- **JTBD impact:** PM-04 swap/clear seat — rate-limited by a microscopic target
- **Heuristics violated:** H-ML06
- **Evidence:** DOM-measured 24×16; `background: transparent` (text-link).
- **Observation:** The smallest tap target on the entire surface. Combined with F3's "tap silently destroys the binding" this is the worst tap-target × consequence product on players-view.
- **Recommended fix:** When F3's toast+undo lands, also resize the tap area to ≥44×44 (expand via padding; keep visual footprint compact via larger invisible hit-box, or enlarge visual footprint per seat).
- **Effort:** S — single component edit.
- **Risk:** Low.
- **Proposed backlog item:** `LSW-F2-A5 — SeatAssignmentGrid per-seat Clear touch-target` (P1)

### F7 — Clear All Seats button is 102×28px (below 44px height)

- **Severity:** 2 (P2)
- **Situations affected:** Ringmaster pre-game setup
- **JTBD impact:** PM-05 — the "I need to start fresh" escape hatch is smaller than primary actions
- **Heuristics violated:** H-ML06
- **Evidence:** DOM-measured 102×28.
- **Observation:** Destructive action. Less critical than F5/F6 because it's low-frequency, but for a 1600×720 reference device the ≥44px rule still applies.
- **Recommended fix:** Increase height to 44px via padding (keep visual size compact if needed via inner content spacing).
- **Effort:** S — one CSS class.
- **Proposed backlog item:** `LSW-F2-A6 — Clear All Seats button height` (P2)

### F8 — Filter row density: 8 selects + search + sort consumes 209px / 29% of 1600×720 viewport

- **Severity:** 2 (P2)
- **Situations affected:** Rounder / Circuit Grinder / Coach browsing 50+ player database
- **JTBD impact:** PM-09 find by visual features — legitimately needs many filters, but consuming 29% of viewport on a browse-heavy surface compresses the actual content (seat grid + player list) that the user came to see
- **Heuristics violated:** H-ML02 (information density vs chrome), H-PLT-05 (primary content prominence)
- **Evidence:** 8 `<select>` elements + 1 search input + 1 sort select + "Showing N of M" text = 11 chrome elements above the fold. Filter area measured at 209px tall.
- **Observation:** Every filter IS useful; the density is not. Adjacent surfaces (SessionsView) use filter pills + localStorage persistence (SV-F7) to make filter state sticky. PlayersView doesn't persist filter state at all — users re-configure every session.
- **Recommended fix:** Two-phase. Phase 1: persist all filter state to localStorage (cheap, matches SV-F7 pattern). Phase 2: collapse filters behind a "Filter" button with a sheet/drawer that only shows when user engages; visible bar shows "N of M players" + active-filter pill count + a Clear-filters link.
- **Effort:** M — filter-persist is S; collapse-behind-sheet is M.
- **Risk:** Low for persist; Medium for visual redesign (requires product decision on the right density for power users vs casual).
- **Proposed backlog item:** `LSW-F2-A7 — PlayerFilters persist + optional collapse` (P2)

### F9 — No bulk operations surface (delete-many, assign-many, export-selection)

- **Severity:** 2 (P2)
- **Situations affected:** Rounder / Circuit Grinder managing a database of 50+ players over months
- **JTBD impact:** PM-10 (bulk cleanup, not yet mapped), data-export JTBDs
- **Heuristics violated:** H-N6 (efficiency — power users)
- **Evidence:** Surface artifact `players-view.md` "Potentially missing" section already acknowledges this.
- **Observation:** Not a current-state bug; a feature gap. Worth a backlog entry but not a blocker.
- **Recommended fix:** Defer. Author a new feature request in `docs/design/features/` if prioritized.
- **Effort:** L
- **Proposed backlog item:** Discovery entry, not a content-fix ticket.

### F10 — No inline tag editing from the row

- **Severity:** 1 (P3)
- **Situations affected:** Chris / Coach adding tags to observed players fast
- **JTBD impact:** Minor friction on PM-07
- **Evidence:** Each row's "Style" column renders a tag chip but is read-only; must open full editor to change.
- **Recommended fix:** Defer; not worth the complexity vs full editor.
- **Effort:** M
- **Proposed backlog item:** Discovery entry, not a content-fix ticket.

### F11 — Icon-nav sidebar on TableView has no visible aria-labels on some paths

- **Severity:** 1 (P3 — cross-surface, flagged here because noticed during the walk)
- **Situations affected:** Screen reader users + keyboard navigation
- **Evidence:** During navigation from SessionsView → TableView, icon-only nav buttons returned empty `aria-label` and empty `textContent` in a DOM query. Playwright's accessibility snapshot DID show descriptive names (Stats, Hand Review, Sessions, Players, Analysis, Extension, Settings), suggesting `title` attributes are present but `aria-label` isn't.
- **Observation:** Not specific to players-view — belongs on a sidebar-chrome audit. Noting it here so the lead doesn't get lost.
- **Recommended fix:** Cross-reference to a sidebar-chrome-navigation audit (Wave 5 candidate).
- **Proposed backlog item:** Discovery entry `2026-04-22-sidebar-nav-aria-labels` (cross-surface).

### F12 — "Player Management" title vs "Players" nav label inconsistency

- **Severity:** 0 (cosmetic)
- **Evidence:** Left-nav button says "Players"; view header says "Player Management". Minor.
- **Recommended fix:** Align to "Players" or keep both if owner prefers formal title in the view chrome.
- **Effort:** S — one string.
- **Proposed backlog item:** Bundled polish.

### F13 — No per-row avatar features — all players show fallback "S" monogram

- **Severity:** 0 (seed-data defect, not a view defect)
- **Evidence:** All 19 seed players in the dev environment show the generic avatar monogram. PEO-1 shipped `avatarFeatures` sub-object; seed data doesn't populate it.
- **Observation:** Not a players-view finding per se — a seed-data gap. Flagged for completeness since it affects visual recognition during audit.
- **Recommended fix:** Update `src/__dev__/seedTestData.js` to include avatar features for seeded players. Out of scope for this audit; route to a dev-ergonomics backlog item.
- **Proposed backlog item:** `LSW-F2-A8 — Seed players with avatarFeatures` (P3, dev-ergonomics).

---

## Observations without fixes

- **Drag-and-drop is implemented but un-documented to the user** — no visual cue that rows are draggable onto seats. Discovery depends on experimentation. Could be a hint-chip or a one-time coach-mark. Not a finding per se — needs owner input on whether "keyboard-first click-to-assign" or "drag-first assign" is the intended primary path.
- **Auto-advance to next empty seat after assign** is implemented and correct for the Ringmaster persona. Probably under-documented in UI copy.
- **Replace Prompt modal** (seat already occupied) is a defensible destructive-action pattern here because the user explicitly initiated an action on an occupied seat — low surprise. Not flagged as P0.

## Open questions for the owner

- Should the "Clear All Seats" button remain on this view at all, or is it redundant once per-seat Clear is undoable + there's a Sessions-level reset?
- Is the 1600×720 reference still the single sizing target, or do we also care about tablet portrait for power users managing their database outside of active sessions? (Affects F8 density priority.)
- Is bulk-delete a Plus/Pro feature or a Free+ convenience? (Affects F9 prioritization.)

---

## Prioritized fix list

| # | Finding | Severity | Effort | Priority |
|---|---------|----------|--------|----------|
| 1 | F1 — Clear All Seats native confirm → toast+undo | 4 | S | P0 |
| 2 | F3 — Per-seat Clear silent commit → toast+undo | 4 | S | P0 |
| 3 | F2 — Delete Player modal → deferred-delete toast+undo | 4 | M | P0 |
| 4 | F6 — Per-seat Clear touch target 24×16 → ≥44×44 | 3 | S | P1 |
| 5 | F5 — Row actions 20–35×20 → ≥44×44 | 3 | M | P1 |
| 6 | F7 — Clear All Seats button height 28 → 44 | 2 | S | P2 |
| 7 | F8 — Filter persist (localStorage) + optional collapse | 2 | M | P2 |
| 8 | F12 — "Player Management" → "Players" (or keep) | 0 | S | P4 polish |
| 9 | F13 — Seed avatarFeatures in dev data | 0 | S | P3 dev-ergonomics |
| 10 | F9 — Bulk operations | 2 | L | deferred (discovery) |
| 11 | F10 — Inline tag editing | 1 | M | deferred (discovery) |
| 12 | F11 — Sidebar aria-labels | 1 | S | deferred (cross-surface) |

---

## Backlog proposals

Copy-paste ready for `.claude/BACKLOG.md`:

```
- [P0] [DCOMP-W4-A1 F1] PlayersView Clear All Seats → toast+undo (reuse TV-F1 pattern)
- [P0] [DCOMP-W4-A1 F2] PlayersView Delete Player → deferred-delete toast+undo (reuse SV-F1 pattern)
- [P0] [DCOMP-W4-A1 F3] PlayersView per-seat Clear → toast+undo
- [P1] [DCOMP-W4-A1 F5] PlayerRow row-actions (Range/Edit/Delete) touch-target refactor
- [P1] [DCOMP-W4-A1 F6] SeatAssignmentGrid per-seat Clear ≥44×44
- [P2] [DCOMP-W4-A1 F7] Clear All Seats button height ≥44
- [P2] [DCOMP-W4-A1 F8] PlayerFilters persist + optional collapse
- [P3] [DCOMP-W4-A1 F13] Seed players with avatarFeatures (dev-ergonomics)
```

---

## Severity rubric

Standard template rubric — see `docs/design/audits/_template.md`.

## Review sign-off

- **Drafted by:** Claude (main), session 2026-04-22
- **Reviewed by:** [owner] on [date]
- **Closed:** [date]

Audit is immutable after close. Follow-up audits create a new file.

## Change log

- 2026-04-22 — Draft.
