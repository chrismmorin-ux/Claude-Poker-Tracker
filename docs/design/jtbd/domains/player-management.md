# JTBD Domain — Player Management

All jobs related to associating (or disassociating) player records with seats at the virtual table, plus edits and lookups on player records.

**Seeded:** 2026-04-21 (Session 1) — feeds the Session 2 audit of player selection surfaces.

---

## Surfaces in scope

- `SeatContextMenu.jsx` — right-click / long-press on a seat. Entry point to most jobs here.
- `PlayerPickerView/` — fullscreen picker. Main path for assign-known-player and create-from-search-query.
- `PlayerEditorView/` — fullscreen editor. Create-new and edit-existing.
- `PlayersView` — the list view for player records (less relevant to in-session jobs).

---

## JTBD-PM-01 — Clear a seat when a player leaves

### Job statement

> When a player leaves the table and no one has sat in their place yet, I want to clear their association from that seat, so the app's reads and stats for that seat stop pulling from a stale player record.

### Dimensions

- **Functional:** Seat N goes from `assigned(playerId)` to `unassigned`. Stats for that seat pause accumulating under the departed player's record.
- **Emotional:** Confident that the next hand won't attribute actions to the wrong person.
- **Social:** Fast enough that the dealer doesn't have to wait.

### Applicable personas

- [Seat-swap Chris](../../personas/situational/seat-swap-chris.md) — primary. The highest-frequency player-management job between hands.
- [Between-hands Chris](../../personas/situational/between-hands-chris.md) — secondary.

### Success criteria

- [ ] < 3 seconds from intent (right-click on seat) to seat-cleared confirmation.
- [ ] ≤ 2 taps total.
- [ ] Clear action is obviously the primary option when the seat has an assigned player.
- [ ] Undo is available for at least 5s after clearing.

### Failure modes

- User intended to swap (assign new) but tapped Clear then had to reopen the menu. [EVID: evidence ledger should capture observed cases]
- Clear action is far from thumb reach in landscape; user performs two-hand grip to complete. [EVID-2026-04-21-CLEAR-PLAYER]
- User tapped a player row thinking it would re-open the picker, but clicking an existing player row was actually a no-op or had unexpected behavior.

### Surfaces involved

- `SeatContextMenu.jsx` — primary entry point and action surface. Currently places Clear at bottom of menu.

### Related JTBD

- **Composes with:** JTBD-PM-04 (swap) — half of swap is clear.
- **Prerequisite to:** JTBD-PM-02 if the seat was previously occupied.

### Notes / non-obvious constraints

- Clearing a seat does not delete the player record. The record persists; only the seat association is removed.
- Should a just-cleared seat's stats be visually muted immediately, or only at the next hand boundary? (Open question for Session 2.)

---

## JTBD-PM-02 — Assign a known player to a seat

### Job statement

> When a player the app has seen before sits in a seat, I want to recall and assign them to that seat, so subsequent hands accumulate under the right record.

### Dimensions

- **Functional:** Seat N goes from `unassigned` or `assigned(other)` to `assigned(playerId)`. If prior hands in the session captured actions from this seat without a player, those are retro-linked.
- **Emotional:** Recognition — "the app remembers this guy."
- **Social:** Done fast enough to still catch the first read on the new villain.

### Applicable personas

- [Seat-swap Chris](../../personas/situational/seat-swap-chris.md) — primary.
- [Between-hands Chris](../../personas/situational/between-hands-chris.md) — secondary.

### Success criteria

- [ ] < 10s from intent to assignment, for a player with a distinctive name or feature.
- [ ] Player found by partial name match OR by visual feature match (hair, build, etc.).
- [ ] Retroactive link succeeds for same-session prior hands.
- [ ] Undo available on retro-link toast (≥5s).

### Failure modes

- Name is forgotten; visual search fails because feature filter doesn't match how user tagged them last time.
- Picker shows too many irrelevant results; user can't quickly identify the right player.
- User picks the wrong player (look-alike); undo is available but discovered late.

### Surfaces involved

- `SeatContextMenu.jsx` — entry ("Find Player..." option).
- `PlayerPickerView/` — primary action surface.

### Related JTBD

- **Composes with:** JTBD-PM-09 (visual feature search).
- **Composes with:** JTBD-PM-06 (retro-link).

---

## JTBD-PM-03 — Create a new player and assign to seat

### Job statement

> When a player the app hasn't seen before sits down, I want to create a new player record and assign them to the seat, so the app can start learning their tendencies from the current hand forward.

### Dimensions

- **Functional:** New player record created in IDB. Seat assigned to new player. Optional: retro-link to any prior-session hands that captured actions from this seat.
- **Emotional:** Getting them logged before the first hand they play against hero.
- **Social:** Low-key — taking notes on people can feel conspicuous. Entry should be fast and doesn't require prolonged head-down time.

### Applicable personas

- [Seat-swap Chris](../../personas/situational/seat-swap-chris.md) — primary.
- [Post-session Chris](../../personas/situational/post-session-chris.md) — for polish after the fact.

### Success criteria

- [ ] < 60s from intent to seat-assigned if using auto-name fallback.
- [ ] < 2 minutes if filling in avatar features and notes during a slow hand.
- [ ] Draft survives phone sleep, navigation, and unrelated actions.
- [ ] All required form fields fit in the phone landscape viewport without horizontal scroll.
- [ ] Vertical scroll works for fields below the fold.

### Failure modes

- Form is cut off in phone landscape and doesn't scroll. [EVID-2026-04-21-LANDSCAPE-SCROLL]
- Abandonment mid-entry because a hand deals; draft is lost. (PEO-2 solved this for create flow via autosave; verify still holds.)
- Autosave draft collides with a subsequent create attempt.

### Surfaces involved

- `SeatContextMenu.jsx` — "Create New Player" entry.
- `PlayerEditorView/` — primary action surface.
- `CreateFromQueryCTA` in picker — alternate entry (seeds name from search query).

### Related JTBD

- **Composes with:** JTBD-PM-06 (retro-link after save).
- **Composes with:** JTBD-PM-08 (draft resume if returning).

---

## JTBD-PM-04 — Swap the player on a seat

### Job statement

> When a different player takes over a seat that already has an assigned player, I want to change the seat's assignment, so future actions don't attribute to the previous player.

### Dimensions

- **Functional:** Seat goes from `assigned(A)` to `assigned(B)`. No retro-link (the prior hands belong to A, not B).
- **Emotional:** The old player's history stays attached to them, not to the new seat.
- **Social:** Fast — often happens at the dealer button move or during a new dealer push.

### Applicable personas

- [Seat-swap Chris](../../personas/situational/seat-swap-chris.md) — primary.

### Success criteria

- [ ] < 15s from intent to reassigned.
- [ ] Previous player's record is unchanged.
- [ ] If user accidentally ran Clear first then Assign, the net effect is correct. (Or: a direct Swap path exists that doesn't require the two-step.)

### Failure modes

- Clear and Assign are separate flows; user must complete both without unifying "Swap" action.
- User swaps to wrong player; no undo because swap doesn't generate a retro-link toast.

### Surfaces involved

- `SeatContextMenu.jsx` — entry.
- `PlayerPickerView/` — reassign path.

### Related JTBD

- **Composes with:** JTBD-PM-01 + JTBD-PM-02 (if swap is implemented as clear+assign under the hood).
- **Substitutes for:** Direct-assign on occupied seat may be equivalent to swap.

---

## JTBD-PM-05 — Batch-assign players to seats at session start

### Job statement

> When I sit down at a table for a new session and there are already 7 other players, I want to assign them to seats in a single uninterrupted flow, so I don't context-switch between seat-selection and player-picking for each of them.

### Dimensions

- **Functional:** N seats go from unassigned to assigned in one flow. Each assignment triggers retro-link for same-session prior hands.
- **Emotional:** Feeling "set up" before the first hand, not scrambling mid-hand.
- **Social:** Unobtrusive — batch entry should look like looking at the phone briefly, not building a database.

### Applicable personas

- [Between-hands Chris](../../personas/situational/between-hands-chris.md) — typically done before first hand.

### Success criteria

- [ ] Batch mode is explicitly enterable (dedicated control) and exitable.
- [ ] Progress visible (X / 9 seats filled).
- [ ] Single abandon doesn't force restart — partial assignments persist.
- [ ] Batch flow handles the mix of known + unknown players naturally.

### Failure modes

- Batch entry conflates with single-assign; exit is ambiguous.
- Progress indicator is hard to read in landscape.
- Switching to create-new inside batch breaks the batch state.

### Surfaces involved

- `PlayerPickerView/` — batch mode with `BatchSeatRibbon`.

### Related JTBD

- **Composes with:** JTBD-PM-02, JTBD-PM-03, JTBD-PM-06.

---

## JTBD-PM-06 — Retroactively link prior hands to a new player

### Job statement

> When I assign a player to a seat that has already been collecting actions this session (e.g., the player was there during a hand or two before I tagged them), I want those earlier actions re-linked to the new player, so session stats are accurate.

### Dimensions

- **Functional:** Prior same-session hands with actions on seat N get `playerId` updated.
- **Emotional:** Not losing data because of late tagging.
- **Social:** Invisible — this happens automatically; user sees it only as a toast confirmation.

### Applicable personas

- [Seat-swap Chris](../../personas/situational/seat-swap-chris.md) — primary.

### Success criteria

- [ ] Retro-link is atomic.
- [ ] Undo available ≥5s after success.
- [ ] Respects session boundary (doesn't leak to prior sessions).
- [ ] Respects seat-change events within session (doesn't link across a seat-swap).

### Failure modes

- Retro-link across a seat-change incorrectly attributes another player's hands. (PEO-1 handles this with boundary stops — verify on audit.)
- Undo fires but doesn't actually revert due to async race.

### Surfaces involved

- Happens as a side effect of JTBD-PM-02 and JTBD-PM-03.

---

## JTBD-PM-07 — Edit an existing player's record

### Job statement

> When I realize I've mis-noted a player's name, features, or notes, I want to update their record, so the app reflects what I actually know.

### Dimensions

- **Functional:** Player record in IDB is updated. Changes reflect immediately in pickers, stats, etc.
- **Emotional:** Correcting past haste without cost.
- **Social:** Private; nobody sees.

### Applicable personas

- [Post-session Chris](../../personas/situational/post-session-chris.md) — primary.
- [Between-hands Chris](../../personas/situational/between-hands-chris.md) — occasional.

### Success criteria

- [ ] Reachable from `PlayersView` and from contextual entry points.
- [ ] Saves atomically.
- [ ] All fields accessible on phone landscape without cutoff. [EVID-2026-04-21-LANDSCAPE-SCROLL]

### Failure modes

- Same landscape scroll issue as JTBD-PM-03.
- Concurrent edits or merges (likely not an issue in single-device mode).

### Surfaces involved

- `PlayerEditorView/` — primary.
- `PlayersView/` — entry point.

---

## JTBD-PM-08 — Resume an in-progress player draft

### Job statement

> When I started creating a player and got interrupted, I want to pick up where I left off, so I don't lose any of the avatar features or notes I already entered.

### Dimensions

- **Functional:** Draft stored in IDB `playerDrafts` store; on re-entry to editor in create mode with matching draft, resume is offered.
- **Emotional:** Trust — "the app didn't lose my work."
- **Social:** Invisible.

### Applicable personas

- [Between-hands Chris](../../personas/situational/between-hands-chris.md) — interrupted by next hand dealing.
- [Seat-swap Chris](../../personas/situational/seat-swap-chris.md) — interrupted by urgent mid-hand concerns.

### Success criteria

- [ ] Resume banner appears promptly on mount.
- [ ] User can choose Resume or Discard.
- [ ] Resume fully restores all fields including avatar features.
- [ ] Discard clears the draft cleanly.

### Failure modes

- Resume banner doesn't appear when it should.
- Resume partially restores fields (some avatar features missing).
- Discard leaves an orphan draft.

### Surfaces involved

- `PlayerEditorView/DraftResumeBanner`.

---

## JTBD-PM-09 — Find a player by visual features (not name)

### Job statement

> When I can't remember a player's name but recall what they look like (build, hair, hat, glasses, etc.), I want to filter the player list by visual features, so I can find their record without a name.

### Dimensions

- **Functional:** Visual filter chips filter the picker result set.
- **Emotional:** Not hitting a dead end because names are hard to remember.
- **Social:** Fast.

### Applicable personas

- [Seat-swap Chris](../../personas/situational/seat-swap-chris.md) — primary.
- [Between-hands Chris](../../personas/situational/between-hands-chris.md).

### Success criteria

- [ ] Filters are expressive enough to narrow the list materially.
- [ ] Filter chips are visually clear (active vs. inactive).
- [ ] Combining name + feature filters AND-narrows.
- [ ] Clear-all resets quickly.

### Failure modes

- Too few filter options.
- Filter chips take too much vertical space in landscape.
- Active filter state ambiguous.

### Surfaces involved

- `PlayerPickerView/FilterChips`.

---

## Change log

- 2026-04-21 — Created. All 9 entries defined to support Session 2 audit.
