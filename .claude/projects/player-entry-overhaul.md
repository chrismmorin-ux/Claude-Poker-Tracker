# Player Entry UX Overhaul (PEO)

**Status:** CLOSED (2026-04-16)
**Program ID:** PEO
**Sessions:** PEO-1 → PEO-4 (all shipped)
**Opened:** 2026-04-16
**Closed:** 2026-04-16
**Approved plan:** `C:\Users\chris\.claude\plans\fluttering-booping-puddle.md`
**Owner:** Claude (main repo), approved by site owner 2026-04-16

---

## Problem

At a live casino table (mobile landscape, 1600×720), the user needs to identify and assign 8 opponents to seats under time pressure and frequent interruption. Today's flow fails at every step:

1. Tiny floating `SeatContextMenu` popup on seat right-click — cramped, non-primary action for a primary workflow.
2. `PlayerForm` renders as a modal — small portrait-shaped area inside an already constrained landscape viewport.
3. Seat↔player is per-hand forward-only. If seat 3 has prior hands recorded as "Seat 3", assigning a player later does **not** backfill those hands → data loss on every assignment.
4. No visual avatar system. Players are text dropdowns (ethnicity/build/facialHair) — at a glance the list is a wall of text.
5. Filter lives in PlayersView only, not at the seat-assignment moment. User can't filter "dark skin, goatee, male" while deciding if seat 3 already has a profile.
6. Form is blocking. Interrupt to deal with a live hand → return → lose partial entry.

## Intended Outcome

Fast, recognition-oriented, non-blocking player-entry flow:

- **Fullscreen picker** with live name + characteristic filtering, launched from seat.
- **Fullscreen create screen** with tap-to-pick feature avatars, interrupt-safe draft persistence.
- **Silent retroactive linking** of prior-session seat hands with undo-toast.
- Data-layer primitives (pure functions, single-draft invariant, atomic commits) that future extensions don't need to re-plumb.

## Decisions (D1–D10)

Authored 2026-04-16 after roundtable critique. See approved plan for full detail.

1. **D1** — `avatarFeatures` as nullable sub-object on Player; namespaced feature IDs (`"hair.short-wavy"`); `"<category>.none"` is a first-class ID rendered as empty `<g/>`.
2. **D2** — `playerDrafts` IDB store keyed by `userId` (guest sentinel for unauthed). Single draft per user. Persist `seatContext` + `sessionId`; do not persist `prevScreen`.
3. **D3** — Retroactive link is a pure function returning `{ handIds, undoToken }`. Walks backward in session; stops at different-player or cleared-seat boundary. Idempotent. Triggers stats recompute.
4. **D4** — Custom SVG feature avatars (no library). Layered composition. CSS custom properties for colors. Declarative `LAYER_ORDER`.
5. **D5** — Save always succeeds. `autoName` fallback chain: user-typed → seat+feature → timestamp. Record `nameSource: 'user' | 'auto'`. Duplicate-name non-blocking warning. Atomic commit (player put + draft delete in one transaction).
6. **D6** — Feature avatar canonical (lists, picker, seat badges). Image upload secondary (detail view only).
7. **D7** — Recognition UX: avatar-left, name prefix bolded on match, non-matching feature chips faded 0.5. Not "bold everything that matches."
8. **D8** — `pendingSeatForPlayerAssignment` generalized to `editorContext` / `pickerContext` in S1. Removed in S4.
9. **D9** — Batch mode ends on: explicit exit OR all 9 seats OR navigation away. Does not persist across app reload.
10. **D10** — No feature flags (per CLAUDE.md). Sequencing handles rollout: S1 dark data layer; S2 dark editor; S3 wires entries → feature live; S4 cutover + cleanup.

## Invariants (Promoted to INVARIANTS.md in S1)

- **I-PEO-1 Draft singleton per user.** At most one draft record per userId. Commit = player `put` + draft `delete` in one IDB transaction.
- **I-PEO-2 Retro-link session scope.** Linking only modifies hands with matching `sessionId`. Cross-session backfill never happens.
- **I-PEO-3 Retro-link idempotence.** Re-applying `(handId, seat, playerId)` is a no-op. Unlink-then-relink produces identical state.
- **I-PEO-4 Undo captures.** Undo tokens carry the exact `handIds` list captured at link time; undo reverts only those hands.

## Session Summaries

### PEO-1 — Data Layer + Avatar System (infrastructure, no UI)
Schemas, persistence, pure fns, avatar data module + renderer. Dark merge. 16 new files, 11 modified, ~60 tests.

### PEO-2 — Fullscreen Create/Edit Player Screen
`SCREEN.PLAYER_EDITOR` route. Fully functional; no entry points wired yet (one session dark).

### PEO-3 — Fullscreen Player Picker + Wire Entries
`SCREEN.PLAYER_PICKER` route. Wire `SeatContextMenu` "Find Player…" and "Create New Player" to new screens. Feature live.

### PEO-4 — Cutover + Cleanup + Docs
Migrate PlayersView create path. Delete old `PlayerForm/`. Remove `pendingSeatForPlayerAssignment`. Update SYSTEM_MODEL, INVARIANTS, STATE_SCHEMA, CHANGELOG.

## Out of Scope (explicit)

- Cross-device sync of drafts and avatarFeatures.
- Avatar presets / share-avatar feature.
- Full stats recompute beyond `handCount` after retro-link (revisit after S1).
- Seat-badge avatar rendering on TableView (visual polish, follow-on).
- Bottom-sheet replacement of right-click SeatContextMenu on mobile-touch.
- Multi-draft (per-seat) — rejected by user decision.

## Perf Ceiling Note

Live filter on every keystroke across all players runs on main thread. At ~500 players with 7 AND'd filters, fine at 60fps. Ceiling: re-architect (memoized pre-index or worker) if player count grows beyond ~2,000.

## Post-Mortem (2026-04-16)

### What shipped

- **2 new SCREEN routes**: `PLAYER_EDITOR` (create/edit) and `PLAYER_PICKER` (live filter + recognition-first selection).
- **Custom SVG feature-avatar system**: 6 categories (skin/hair/beard/eyes/glasses/hat), namespaced IDs, CSS-custom-property colors, declarative layer order, `PlayerAvatar` unified wrapper with monogram fallback.
- **Retroactive seat↔player linking**: pure `linkPlayerToPriorSeatHands` with session scope + idempotence + undo tokens. Atomic batch updates in single IDB transactions. Undo toast integrated into both editor and picker save flows.
- **Draft persistence**: `playerDrafts` IDB store (v14 migration), single-draft-per-user invariant, atomic `commitDraft`, debounced autosave + blur-flush via `usePlayerDraft` hook.
- **4 new invariants** (I-PEO-1..4) in INVARIANTS.md with full test coverage.
- **8 new hooks**: `usePlayerDraft`, `useRetroactiveLinking`, `useScreenFocusManagement`, `usePlayerEditor`, `usePlayerPicker` + extended `usePlayerFiltering` with `scorePlayerMatch`.
- **25 new components** across PlayerEditorView/ (9) and PlayerPickerView/ (6), plus avatar primitives (3), plus 7 auxiliary utility files.

### End-state test count

- Baseline at program start: 5,422 tests
- End-of-program: 5,623 tests
- Net delta: +201 tests (PEO-4 deleted ~137 legacy `PlayerForm` tests; new feature added ~338 across all four sessions)

### What went well

- **Plan-first paid off.** Decisions D1–D10 were locked before any code touched; zero re-architecting mid-stream. The Plan-agent critique (fade mismatches, avatar-left, atomic commit, session-scoped retro-link with undo captures) caught three issues that would have been painful to retrofit.
- **Dark-merge sequencing.** Landing PEO-1 (data layer) and PEO-2 (editor route, no entries wired) before PEO-3 wired the menu meant every merge stayed green with no feature-flag machinery. Per CLAUDE.md convention.
- **Pure-function boundary for the linker.** `linkPlayerToPriorSeatHands` is fully unit-tested against edge cases (session boundary, mid-session player change, cleared-seat tolerance, idempotence, undo-token round-trip) without ever touching IDB. Gave confidence the production flow is correct without integration-test dependency explosion.
- **Atomic commits.** Wrapping `player.add + draft.delete` and `batchUpdateSeatPlayers` each in a single IDB transaction means partial failures cannot leave the store half-written. Tests exercise the abort paths explicitly.

### What we'd revisit

- **`stats` recompute is handCount-only for now.** If/when stats become heavier and denormalised, retro-link's "update handCount only" shortcut will need to re-run the full stats pipeline. Noted as out-of-scope per plan but flagged as a near-future debt.
- **Batch-mode state is hook-local.** It doesn't survive navigation to the editor (e.g. if user taps "+ Create new" mid-batch, the batch state lives on `pickerContext` which gets overwritten by `editorContext`). This is correct per D9 ("doesn't persist across app reload") but a power user running batches might want it. Possible enhancement: when opening editor from picker-in-batch-mode, auto-return to picker with batch state intact on editor close.
- **No image-upload compression.** `ImageUploadSection` takes a file up to 2 MB and stores raw base64. For phones taking photos in the dark, this could balloon. Consider client-side downscale to ~400×400 before encoding.
- **Avatar render cost.** Each `PlayerAvatar` renders a fresh `<svg>` with 6 layers. At ~500 players in the picker list, that's ~3,000 SVG elements. Currently fine, but if players list grows significantly consider a virtualised list before optimising avatar render.

### Invariants held under observed pressure

- **I-PEO-1 (draft singleton per user)** survived the multi-user test path and the commit-fails-then-draft-preserved test. ✅
- **I-PEO-2 (retro-link session scope)** survived the cross-session exclusion test with seeded prior-session hands. ✅
- **I-PEO-3 (idempotence)** verified by the "re-running the same link yields empty plan" test. ✅
- **I-PEO-4 (undo captures exact handIds)** verified by the "since-reassigned seat is preserved on undo" test. ✅

### Architectural decisions that paid off

- **Feature-avatar system with CSS custom properties.** Layered SVG + `var(--skin)` / `var(--hair)` / etc. means coloring a feature requires zero path duplication and zero JS. Switching skin tone = one style update. Swatches render by setting the color var on each preview avatar.
- **Namespaced feature IDs (`"hair.short-wavy"`)** instead of flat strings. Added `glasses` and `hat` late and they slotted in without collision.
- **`editorContext` / `pickerContext` as full nav + semantic state**, not just a sentinel seat number. Carries `prevScreen`, `seatContext`, `nameSeed`, `mode`, `playerId` all together. Means every entry point — SeatContextMenu, picker's CreateFromQueryCTA, PlayersView's edit button — configures the target view consistently without either view needing to read other global state.

### Out-of-scope items explicitly deferred

- Cross-device sync of drafts and avatarFeatures.
- Avatar presets / share-avatar feature.
- Full stats recompute beyond `handCount` after retro-link.
- Seat-badge avatar rendering on TableView (visual polish, follow-on item).
- Bottom-sheet replacement of right-click SeatContextMenu on mobile-touch.
- Multi-draft (per-seat) — rejected by user decision during planning.

---

_Program closed. All four sessions shipped 2026-04-16._
