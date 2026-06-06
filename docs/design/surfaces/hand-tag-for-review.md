# Surface — Hand Tag-for-Review

**ID:** `hand-tag-for-review` (kebab-case, matches filename)
**Code paths:**
- `src/components/views/TableView/ControlZone.jsx` — one-tap tag affordance
- `src/components/views/TableView/CommandStrip.jsx` — wires the toggle to `dispatchGame`
- `src/reducers/gameReducer.js` — `TOGGLE_REVIEW_TAG` + `reviewTag` state
- `src/contexts/GameContext.jsx` — exposes `reviewTag`
- `src/hooks/usePersistence.js` — threads `reviewTag` into the saved record + restore
- `src/utils/persistence/handsStorage.js` — `updateHandReviewTag`, `getTaggedHands`
- `src/utils/persistence/migrations.js` — `migrateV27`
- `src/components/views/SessionsView/ReviewQueuePanel.jsx` — Review Queue
- `src/components/views/HandReplayView/HandReplayView.jsx` — tag badge + clear button

**Route / entry points:**
- Tag affordance: lives in `SCREEN.TABLE` (ControlZone), visible throughout a hand.
- Review Queue: rendered in `SCREEN.HISTORY` / Sessions view (renders only when ≥1 tagged hand exists).
- Opens HandReplayView via `setReplayHand(handId, hand)` + `setCurrentScreen(SCREEN.HAND_REPLAY)`.

**Last reviewed:** 2026-06-05

---

## Purpose

Let the owner flag a hand mid-session, with a single tap, so a fleeting "I should study that" becomes a durable Review Queue entry — without pausing the live capture flow. Tagged hands are revisited and cleared later from the hand replay surface.

## JTBD served

Primary:
- "When I notice something interesting mid-hand, flag it so I can find it later without losing focus right now." — entry (tag affordance) + side-effect (persisted on hand record).

Secondary:
- "After the session, work through the hands I flagged, one at a time, then clear each once reviewed." — Review Queue (list) + replay (clear).

## Personas served

- **mid-hand-chris** — primary; at the table, one-tap tag during action entry.
- **post-session-chris / between-hands-chris** — secondary; studies the queue afterward.

---

## Anatomy

- **Tag affordance (ControlZone):** full-width button above the utility row. Untagged → neutral dark with outline star + "Tag for Review". Tagged → gold-tinted, filled star + "Tagged for Review". `aria-pressed` reflects state.
- **Review Queue panel (SessionsView):** amber-bordered card above Past Sessions. Header: ⭐ "Tagged for Review" + count badge. Body: one row per tagged hand (display id + tagged-at timestamp), newest-tag first. Hidden entirely when empty.
- **Replay header (HandReplayView):** when the open hand is tagged, an amber "⭐ Tagged for review" label + "Reviewed — clear tag" button between the pot readout and the "Reviewing" marker.

```
ControlZone:  [ ★ Tag for Review            ]   ← one tap toggles
Sessions:     ┌ ★ Tagged for Review  (3) ────┐
              │ S1-H4            6/5 3:14 PM  │  → opens replay
              │ S1-H2            6/5 3:02 PM  │
              └──────────────────────────────┘
Replay hdr:   ← Back  S1-H4  FLOP  Pot $40   ★ Tagged for review [Reviewed — clear tag]   REVIEWING
```

## State

- **Live flag:** `gameState.reviewTag` (`null | { tagged: true, taggedAt: number }`), toggled by `TOGGLE_REVIEW_TAG` (payload carries `taggedAt` to keep the reducer pure). Reset to `null` on `NEXT_HAND` / `RESET_HAND`; restored via `HYDRATE_STATE`.
- **Persistence:** `usePersistence` writes `reviewTag` **top-level** on the hand record (stable object → auto-save dedup snapshot unaffected), and merges it back into the hydrate payload on reload.
- **Past-hand edits:** `updateHandReviewTag(handId, reviewTag|null)` writes directly to the record (untag from replay). `getTaggedHands(userId)` returns tagged hands sorted by `taggedAt` desc.
- **Migration:** IDB v27 defaults `reviewTag: null` on legacy hands (skipped for pre-v25 upgrades to avoid a concurrent same-store cursor clobbering v25 — those legacy hands carry `undefined`, treated as untagged).

## Props / context contract

- `ControlZone`: `reviewTagged: boolean`, `onToggleReviewTag: () => void` (affordance omitted entirely when handler absent).
- `ReviewQueuePanel`: `onOpenHand: (handId, hand) => void`, `userId?: string`.

## Key interactions

- **Tap tag (untagged → tagged):** stamps `taggedAt`; auto-save persists `reviewTag` to the record.
- **Tap tag again (tagged → untagged):** clears the flag.
- **Tap a Review Queue row:** opens that hand in HandReplayView.
- **Tap "Reviewed — clear tag":** `updateHandReviewTag(id, null)`; badge disappears; hand drops out of the queue on next load.

---

## Known behavior notes

- The live tag rides the existing debounced auto-save (no hand-end hook); `taggedAt` lives in state so the dedup snapshot stays stable.
- `reviewTag` is stored top-level, not inside the saved `gameState` subset — restore merges it into the hydrate payload.
- All reads use `hand.reviewTag?.tagged`, so `undefined` (pre-v25-upgrade legacy hands) and `null` both mean untagged.
- Cognitive-load rule: the tag is strictly one-tap (no modal/confirm). Enforced by `ControlZone.test.jsx`.

## Known issues

- None at authoring.

---

## Test coverage

- Reducer: `src/reducers/__tests__/gameReducer.test.js` (TOGGLE_REVIEW_TAG, resets, hydrate).
- Storage: `src/utils/persistence/__tests__/handsStorage.test.js` (updateHandReviewTag, getTaggedHands).
- Migration: `src/utils/persistence/__tests__/migrationV27.test.js` (defaults, idempotence, concurrent-cursor mitigation, fresh install).
- Components: `ControlZone.test.jsx` (one-tap toggle, aria, omission) + `ReviewQueuePanel.test.jsx` (rows, empty-hidden, row tap, userId).
- Visual verification: pending manual Playwright pass at 1600×720.

---

## Change log

- 2026-06-05 — Created (WS-190 / SPR-107). v1: one-tap tag, Sessions Review Queue, replay clear button. Note affordance deferred to v1.1.
