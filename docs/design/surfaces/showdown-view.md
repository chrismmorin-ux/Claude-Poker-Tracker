# Surface — Showdown View

**ID:** `showdown-view`
**Code paths:**
- `src/components/views/ShowdownView/ShowdownView.jsx` (350 lines)
- `./ShowdownHeader.jsx`, `./ShowdownSeatRow.jsx`
- `./CardGrid.jsx` (card selection mode)
- `./ActionHistoryGrid.jsx` (summary mode)
- `src/hooks/useShowdownHandlers.js`, `./useShowdownCardSelection.js`, `./useShowdownEquity.js`

**Route / entry points:**
- `SCREEN.SHOWDOWN` (routed via `uiReducer` + `ViewRouter`).
- Opens from: `TableView` via `openShowdownScreen()` (called by `useAutoStreetAdvance` when river action completes, or manually via CommandStrip end-hand).
- Closes to: `TableView` on "Next Hand" (clears hand state via `resetHand`) or on hand persistence completion.

**Product line:** Main app
**Tier placement:** Free+ (part of core live-entry).
**Last reviewed:** 2026-04-21

---

## Purpose

Capture the end-of-hand truth: which seats went to showdown, which cards they held, and who won. Two-mode surface — first a card-assignment step (tap seat → pick hole cards → enforce validity), then a summary of all actions taken through the hand for review before persisting. Closing the surface commits the completed hand to IDB.

## JTBD served

Primary:
- `JTBD-HE-11` finish the hand's action record
- `JTBD-HE-12` undo / repair a miskey before committing the hand
- `JTBD-SR-23` (seed) the completed hand becomes reviewable — the showdown record is the authoritative input to later review

Secondary:
- `JTBD-PM-06` side effect: player-seat association used by retroactive linking when seat was freshly assigned

## Personas served

- [Chris](../personas/core/chris-live-player.md) — primary; closes every live hand here
- [Between-hands Chris](../personas/situational/between-hands-chris.md) — this is literally what between-hands IS for live players
- [Weekend Warrior](../personas/core/weekend-warrior.md), [Rounder](../personas/core/rounder.md), [Circuit Grinder](../personas/core/circuit-grinder.md), [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md), [Ringmaster](../personas/core/ringmaster-home-host.md) — every table-based persona passes through here
- [Apprentice](../personas/core/apprentice-student.md) — reviewing the action history in summary mode

---

## Anatomy

```
┌──────────────────────────────────────────────────────┐
│ ShowdownHeader — street, pot, winning seat indicator │
├──────────────────────────────────────────────────────┤
│  MODE 1 — CARD SELECTION                             │
│   ┌────────────────────────────────────────┐         │
│   │ ShowdownSeatRow × active seats          │         │
│   │ [seat N]  [hole cards / pick]  [hand]   │         │
│   └────────────────────────────────────────┘         │
│   ┌────────────────────────────────────────┐         │
│   │ CardGrid (52 cards, filtered by used)   │         │
│   └────────────────────────────────────────┘         │
│                                                      │
│  MODE 2 — SUMMARY                                    │
│   ┌────────────────────────────────────────┐         │
│   │ ActionHistoryGrid — all actions grouped │         │
│   │ by street, per-seat rows                 │         │
│   └────────────────────────────────────────┘         │
├──────────────────────────────────────────────────────┤
│ [Back to Table]        [Next Hand / Commit]          │
└──────────────────────────────────────────────────────┘
```

## State

- **Card context (`useCard`):** `communityCards`, `holeCards`, `holeCardsVisible`, `allPlayerCards`.
- **Game context (`useGame`):** `actionSequence`, `currentStreet`, `mySeat`, `dealerButtonSeat`, seat/blind state.
- **Local (via `useShowdownCardSelection`):** which seat is currently picking cards, the selection state, validity.
- **Equity (via `useShowdownEquity`):** post-facto equity for displayed seats (shows how hero did vs. villain(s) at showdown).
- Writes: `CARD_ACTIONS.*` (assign cards), `GAME_ACTIONS.*` (mark winner, record showdown action). Commit flushes hand to `hands` store in IDB via `useSessionPersistence`.

## Props / context contract

- `scale: number` — viewport scale.

## Key interactions

1. **Tap a ShowdownSeatRow card slot** → activates CardGrid for that seat → tap 2 cards → cards assigned.
2. **Toggle holeCardsVisible** → reveals hero's own cards (if hidden by default for live privacy).
3. **Pick winner seat** (in ShowdownHeader or seat row) → records showdown action for that seat (`ACTIONS.WON` or equivalent).
4. **Next Hand** → persists current hand, resets hand state, returns to TableView ready for the next deal.
5. **Back to Table** → returns to TableView without persisting (used when the action is wrong and needs correction).

---

## Known behavior notes

- **Card uniqueness is enforced** — the CardGrid filters out cards already placed as community or hole cards.
- **Multiple winners** are supported (chopped pot).
- **Mucked cards** — seats that folded before showdown have no cards assigned; that's allowed.
- **Destructive action (Next Hand)** — commits + resets state; no confirmation step today. See Known Issues.

## Known issues

- [AUDIT-2026-04-21-showdown-view](../audits/2026-04-21-showdown-view.md) — 7 findings (1 sev-4 SHIPPED, 1 sev-3 queued, 3 sev-2 queued, 2 sev-1 queued). Dominant theme: destructive-action density under between-hands-chris's 30–90s window.
- **F1 shipped (P0 → DONE):** Next Hand in ShowdownHeader no longer fires unguarded. `useShowdownHandlers.handleNextHandFromShowdown` now snapshots full hand state, advances via `nextHand()`, and shows a 12s toast+undo that HYDRATE_STATEs both reducers and re-opens Showdown. Covers the winner-confirmation overlay Next Hand button as well (same handler).
- **P1/P2/P3 queued:** F2 visual separation Next Hand / Done; F3 Clear Cards undo; F4 Quick Mode Won passive mucks-count + undo; F5 CardGrid overflow-auto; F6 Labels dead buttons; F7 empty equity rankings explanation.

## Potentially missing

- No "save but don't end hand" affordance for incomplete showdown data.
- No explicit indicator of who was last to act at showdown (for table etiquette / fairness).

---

## Test coverage

- `src/components/views/ShowdownView/__tests__/*.test.jsx` — per-subcomponent coverage.

## Related surfaces

- `table-view` — entry.
- `hand-replay-view` — this surface's output feeds replay.
- `sessions-view` — session bankroll/stats update on commit.

---

## Change log

- 2026-04-21 — Created (DCOMP-W0 session 1, Tier A baseline).
- 2026-04-21 — DCOMP-W1-S4: Gate 4 heuristic audit + Gate 5 P0. `handleNextHandFromShowdown` rewritten with toast+undo. 111/111 tests pass.
- 2026-04-21 — **DCOMP-W1 S5–S7 (Gate 5): ALL 7 ShowdownView audit findings SHIPPED.** F1 (S4: Next Hand toast+undo with openShowdownView-on-undo). F3 + F4 (S5: Clear Cards undo + hide-in-Quick; Won auto-muck passive "mucks N" sub-label + undo for the bulk write). F2 + F5 (S6: ShowdownHeader layout separation with Done-left + Next-Hand-right; CardGrid overflow-auto). F6 + F7 (S7: Labels dead buttons removed → Seat N headers; empty-rankings info banner). **All findings code-complete. Pending owner visual verification on device.**
