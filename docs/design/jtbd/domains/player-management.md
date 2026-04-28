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

## JTBD-PM-10 — Cold-read a table at session start with mixed match-or-create flow

### Job statement

> When I sit down at a new table needing to populate 5–8 seats over 5–15 minutes, with some half-recognized faces and most strangers, I want a single landscape-optimized surface that fluidly handles match-or-create plus stable + ephemeral feature capture, so I don't context-switch between picker, editor, and database views and don't compromise the first hand.

### Dimensions

- **Functional:** 5–8 seats go from unassigned to assigned in one continuous flow on one surface. Mix of `match` (existing record assignment) and `create` (new record + assignment). Per-seat clothing observations captured to seat record, not player record. Build state survives interruption (phone sleep, mid-hand pitch, Seat-Swap handoff).
- **Emotional:** Set up before the first hand; not scrambling mid-hand. Confident that recognition will work next session because stable features were captured deliberately.
- **Social:** Glance-at-phone discreet — observation feel light, not "running a forensic interview."

### Applicable personas

- [Cold-Read Chris](../../personas/situational/cold-read-chris.md) — primary. The persona this JTBD is authored for.
- [Chris (live player)](../../personas/core/chris-live-player.md) — core.
- [Ringmaster (home host)](../../personas/core/ringmaster-home-host.md) — secondary; database is regular-heavy so match dominates, but the same surface serves with adaptive disclosure.

### Success criteria

- [ ] < 5 minutes to populate 7 seats when ~50% are matches.
- [ ] < 10 minutes when all 7 are creates with ≥3 stable features captured per seat.
- [ ] Build state survives phone sleep, mid-hand pitch interruption, and Seat-Swap handoff.
- [ ] Save-and-next green-light state is "≥3 stable features captured" (not "all features filled").
- [ ] Possible-Matches panel (PM-11) fires before save when overlap threshold met.
- [ ] Layout chrome ≤25% of 1600×720 viewport; input + candidate-header + first 4 candidate rows visible above keyboard fold simultaneously.
- [ ] Feature-creation chrome collapses to slim header until the user types past zero matches or taps create.
- [ ] First-session Newcomer can use the surface productively without encountering stability-flag override controls (progressive disclosure for first ≥3 saved players).

### Failure modes

- Chrome consumes >25% of landscape viewport (DCOMP-W4-A1 F8 echoes — current PlayersView filter row is 29%).
- Virtual keyboard occludes candidate list while user types — typing blind.
- Feature-creation chrome forced visible before user has typed past zero matches — Ringmaster wastes screen real estate on creates that won't happen.
- Merge confirmation (PM-11) navigates away from Table-Build, forcing user to re-enter and lose build progress.
- Build state lost on phone sleep — only the in-flight player draft survives, not "seat 4 of 8 filled" progress.
- Stability-flag override UI overwhelms first-session Newcomer.
- "Save player" requires full AvatarFeatureBuilder traversal — too slow for 7-seat session start.

### Surfaces involved

- `surfaces/table-build.md` — primary action surface (new, Gate 4 deliverable).
- `surfaces/seat-context-menu.md` — entry point; "Find Player" + "Create New Player" entries collapse to "Open Table-Build".
- `surfaces/player-picker.md` — superseded.
- `surfaces/player-editor.md` — create-from-query path superseded; edit-existing path retained.
- `surfaces/players-view.md` — seat-assignment grid superseded; database-browser + bulk-operations retained.

### Related JTBD

- **Composes with:** PM-02 (assign known), PM-03 (create new), PM-05 (batch-assign — PM-10 is the unified-surface variant), PM-06 (retro-link), PM-09 (find by features).
- **Composes with:** PM-11 (dedup on save), PM-12 (today-feature capture).
- **Distinct from:** PM-05 by specifying mixed-mode + unified-surface constraints; PM-05 is the umbrella job, PM-10 is the surface-specific persona-action.

### Notes / non-obvious constraints

- Cold-Read Chris's two-handed window (dealer hasn't pitched cards) is one of the few persona-actions where the one-handed-landscape constraint relaxes. Surface design can assume two-handed for the first 2–3 minutes, then degrade gracefully.
- Time budget per seat is non-uniform: ~30s for matches, ~60s for creates with 3 stable features, up to 2 min for creates with notes + ethnicity + clothing.

---

## JTBD-PM-11 — Detect potential duplicates on save and offer manual merge

### Job statement

> When I'm about to save a new player whose stable features and partial name overlap with an existing record above some threshold, I want the surface to surface those candidates with side-by-side compare and a manual-merge action that preserves stats, range profile, and hand history of the surviving record — so I don't silently create a duplicate I'll have to clean up later.

### Dimensions

- **Functional:** Duplicate-detection runs on weighted stable-feature score + name-prefix score + ethnicity-overlap score. Threshold-crossing candidates surface in an inline panel above the save button (not a modal, not a navigate-away). User reviews **evidence** (overlapping-features list), not a confidence number. Manual merge into the surviving record preserves stats, range profile, hand history, and retro-link history. Merge action emits a 12s toast+undo with a session-scoped pre-merge cache.
- **Emotional:** Not creating a duplicate I'll have to find and clean up later. Trust that the system shows me why it thinks these are the same person, not just that it thinks so.
- **Social:** Invisible to others; happens silently on save.

### Applicable personas

- [Cold-Read Chris](../../personas/situational/cold-read-chris.md) — primary. Mid-build save is where this JTBD fires.
- [Post-Session Chris](../../personas/situational/post-session-chris.md) — secondary; cleanup of pre-merge duplicates that escaped detection.
- [Chris (live player)](../../personas/core/chris-live-player.md) — core.

### Success criteria

- [ ] Possible-Matches panel renders the **evidence** for the proposed match (matched-features list, e.g. "name prefix matched, ethnicity matched, skin+hair stable-feature matched"), never a confidence score.
- [ ] Merge action is one-tap from the panel.
- [ ] Merge preserves stats, range profile, hand history, retro-link history of the surviving record.
- [ ] Undo available for ≥12s after merge.
- [ ] Auto-merge never fires; user confirmation always required.
- [ ] Merge UI lands as inline panel inside Table-Build; never unmounts the surface.
- [ ] Threshold formula is documented (Gate 3 deliverable) and tunable.

### Failure modes

- Confidence score shown instead of evidence list — user is asked to trust an opaque inference (autonomy red line #2 violation).
- Auto-merge fires silently — user discovers later that two records collapsed into one without consent (autonomy red line #3 violation).
- Merge unmounts Table-Build → user must re-enter the surface and loses build progress.
- Merge fails to preserve hand history → existing player's stats corrupted by merge.
- Threshold too aggressive → noise; too conservative → silent duplicates pass through.
- Undo doesn't restore both records pristine.

### Surfaces involved

- `surfaces/table-build.md` — Possible-Matches panel + merge UI.
- `surfaces/players-view.md` — merged record continues here in the database browser.

### Related JTBD

- **Composes with:** PM-02 (the "this is the same as existing" path), PM-03 (the create path that triggered the panel), PM-09 (visual-feature search shares the stable-feature-score sub-formula).
- **Supersedes:** the inline duplicate-name warning currently in `PlayerEditorView/NameSection` — that warning fires on name-only and offers no merge.

### Notes / non-obvious constraints

- Autonomy red line #2 (full transparency on demand) applied at this JTBD: panel renders **what** matched, not **how confident** the system is. A "85% match" number is the wrong primitive.
- Threshold formula is a Gate 3 research deliverable. Starting proposal: `name_prefix × 0.4 + ethnicity_match × 0.2 + skin_match × 0.15 + build_match × 0.15 + hair_color_stable_match × 0.1`, threshold tunable.
- Ringmaster persona benefits most from this JTBD — high regular density means high duplicate-creation risk if a regular's appearance changes between sessions.

---

## JTBD-PM-12 — Capture today-only observations without polluting the player record

### Job statement

> When I want to note that a player is wearing a vest today, has a today's-hat read, or is in sunglasses, I want those observations to live on the per-seat-per-session record — visible during this session for recognition, decaying or re-prompting at session end so they don't permanently distort the player's stable feature record.

### Dimensions

- **Functional:** today-features captured in a `seatClothingObservations` store (parallel pattern to EAL `anchorObservations`), keyed by `sessionId + seatNumber + playerId`. Visible on the seat avatar during session. Decay / promote / discard at session end per the lifetime rule (Gate 1 Q4). Promote `today → always` on the player record after N consecutive observed sessions per the promotion rule (Gate 1 Q3); user-overridden stability is sticky against re-promotion (autonomy red line #3).
- **Emotional:** Capturing useful recognition cues without committing them to the durable record. Confident that today's vest doesn't pollute next session's match.
- **Social:** Brief observation entry, not data entry.

### Applicable personas

- [Cold-Read Chris](../../personas/situational/cold-read-chris.md) — primary.
- [Seat-Swap Chris](../../personas/situational/seat-swap-chris.md) — secondary; same observation pattern on mid-session arrivals.
- [Chris (live player)](../../personas/core/chris-live-player.md) — core.

### Success criteria

- [ ] today-feature capture is one-tap from the Table-Build seat panel.
- [ ] today-features render visibly on seat avatars during session.
- [ ] today→always auto-promotion occurs after ≥N consecutive observed sessions (N is a Gate 3 deliverable; default proposal N=2).
- [ ] User override of an auto-promotion is durable: explicit `today` setting persists against future auto-promote attempts.
- [ ] today-features do not appear on the player record's stable feature view.
- [ ] today-feature stability flag carries `source: 'inferred' | 'user'`; re-inference path respects `source === 'user'`.

### Failure modes

- today-feature pollutes player record (e.g., "vest" appears on the player's `avatarFeatures` instead of `seatClothingObservations`).
- Auto-promotion fires without user awareness; user discovers a beard variant they thought was today-only is now the player's permanent feature.
- User override of auto-promotion silently re-fires next session (autonomy red line #3 violation).
- today-feature persists past session end without review prompt or decay.
- Storing `seatClothingObservations` couples to EAL infrastructure such that an EAL schema change forces a player-management migration.

### Surfaces involved

- `surfaces/table-build.md` — primary capture surface.
- Seat avatars (TableView, ShowdownView) — render today-features during session.
- Post-Session Chris flow — review prompt at session end if Q4 verdict is option (b).

### Related JTBD

- **Composes with:** PM-02, PM-03, PM-10.
- **Architectural sibling:** EAL's `anchorObservation` capture pattern (same conceptual shape — ephemeral per-instance observation that may promote to a sticky annotation after repeat-occurrence). Architectural pattern reused; storage parallel (separate store per Gate 2 Stage B verdict).

### Notes / non-obvious constraints

- The autonomy contract here mirrors EAL's anchor lifecycle: inferred status is durable but **never overrides** explicit user intent. The shape `{ value: 'today' | 'always' | 'unknown', source: 'inferred' | 'user' }` is load-bearing.
- Today-feature lifetime at session end (Q4) and promotion threshold (Q3) are Gate 3 research deliverables. Defaults proposed: N=2 sessions for promotion; option (c) auto-promote-to-unknown for session-end lifetime, with optional Post-Session-Chris review prompt as a follow-up.
- Cross-session render: a `today` feature is visible on the seat during the session it was captured AND during any future session where the same player sits (rendered with stability indicator) — until either auto-promotion fires or user explicitly demotes/discards.

---

## Change log

- 2026-04-21 — Created. All 9 entries defined to support Session 2 audit.
- 2026-04-26 — Added PM-10 (cold-read mixed match-or-create), PM-11 (duplicate-detection + manual merge), PM-12 (today-only observation capture). Authored as Gate 3 deliverable for the Table-Build surface (`docs/design/audits/2026-04-26-entry-table-build.md` Gate 1 RED → `2026-04-26-blindspot-table-build.md` Gate 2 YELLOW). Pairs with new situational persona [Cold-Read Chris](../../personas/situational/cold-read-chris.md).
