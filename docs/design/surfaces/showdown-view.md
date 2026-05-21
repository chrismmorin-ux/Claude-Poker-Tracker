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
- `JTBD-HE-17` flag hand for later review at record time — HRP Gate 4 wire adds the producer-side toggle (2026-05-17)
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
│   ┌────────────────────────────────────────┐         │
│   │ ⚐ Flag for review (HRP Gate 4, SPR-085) │         │
│   │   single-tap toggle; reversible from    │         │
│   │   HandBrowser later                     │         │
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

## HRP flag-for-review (HRP Gate 4 wire, 2026-05-17, SPR-085 / WS-067)

**Added by:** WS-067 / SPR-085 (HRP Phase 3 Gate 4 surface specs). See `docs/design/surfaces/hand-review-modal.md` for the full new-surface spec.

**What this adds.** A single-tap "Flag for review" toggle in ShowdownView mode-2 (Summary), serving as the HE-17 producer entry. ShowdownView is the natural host per Stage D Information Architect voice (Gate 2 audit line 180): "ShowdownView is the natural host for HE-17 producer — it's the record-committing surface. Add 'Flag for review' checkbox/button there. Avoid TableView intrusion (live-cadence surface)."

**Visual treatment.** A flag chip below the ActionHistoryGrid in Summary mode (see updated Anatomy). Two states:
- **Unflagged** — gray ⚐ icon + "Flag for review" label
- **Flagged** — colored ⚐ icon + "Flagged ✓" label

Tap toggles. No modal. No "are you sure?" confirmation. The flag is fully reversible from HandBrowser later (per `analysis-view.md` HandBrowser augmentations), so a tap-and-undo workflow doesn't need destructive-action ceremony at record time.

**Interaction.**
- Single tap toggles `hand.flags[]` for the current hand
- When toggling on: append `{id: <ulid>, createdAt: <now>, source: 'showdown'}` to `hand.flags[]`
- When toggling off: remove the most recent `source: 'showdown'` entry from `hand.flags[]`
- The flag persists with the hand on `Next Hand` commit (no separate persistence path; uses the existing hand-commit IDB write)
- Flag changes are included in the existing toast+undo flow (F1 ship 2026-04-21) — if the user toggles flag then taps Next Hand then hits Undo, the flag state is restored along with the rest of the hand state

**State integration.**
- Writes to `hand.flags[]` via a new `useShowdownHandlers.toggleFlagForReview()` action (planned at Stream U Phase 8 — spec only here)
- Reads `hand.flags[].some(f => f.source === 'showdown')` to determine the chip's flagged state
- Multiple flags can accumulate on a hand across different sessions (flagged at showdown, re-flagged later from HandBrowser, etc.); the showdown chip only tracks its own source entries

**Anti-pattern compliance:**
- Red line #5 (no engagement-pressure): the chip is a neutral toggle. No "you should flag this" prompts, no "review streak", no "flagged hands per session" counter.
- Red line #8 (no cross-surface contamination): the flag-for-review chip lives only in ShowdownView. TableView is explicitly excluded (live-cadence intrusion is banned per Gate 2 Stage D).
- No destructive-action concern: flag toggle is fully reversible, no commit ceremony, no confirmation dialog.

**Cross-reference:** Schema details (`hand.flags[]` entry shape with `source: 'showdown' | 'handbrowser' | 'replay'`) at `docs/design/surfaces/hand-review-modal.md` §Schema additions.

---

## Test coverage

- `src/components/views/ShowdownView/__tests__/*.test.jsx` — per-subcomponent coverage.

## Related surfaces

- `table-view` — entry.
- `hand-replay-view` — this surface's output feeds replay.
- `sessions-view` — session bankroll/stats update on commit.
- `hand-review-modal` — HRP Gate 4 deep-surface (2026-05-17). ShowdownView is the HE-17 producer (writes `hand.flags[]` with `source: 'showdown'`); the modal is the consumer (reads the flags + renders the linked artifact).
- `analysis-view` — HandBrowser augmentations consume `hand.flags[]` produced here (flag filter chip + per-card indicator + last-reviewed column).

---

## Change log

- 2026-04-21 — Created (DCOMP-W0 session 1, Tier A baseline).
- 2026-04-21 — DCOMP-W1-S4: Gate 4 heuristic audit + Gate 5 P0. `handleNextHandFromShowdown` rewritten with toast+undo. 111/111 tests pass.
- 2026-04-21 — **DCOMP-W1 S5–S7 (Gate 5): ALL 7 ShowdownView audit findings SHIPPED.** F1 (S4: Next Hand toast+undo with openShowdownView-on-undo). F3 + F4 (S5: Clear Cards undo + hide-in-Quick; Won auto-muck passive "mucks N" sub-label + undo for the bulk write). F2 + F5 (S6: ShowdownHeader layout separation with Done-left + Next-Hand-right; CardGrid overflow-auto). F6 + F7 (S7: Labels dead buttons removed → Seat N headers; empty-rankings info banner). **All findings code-complete. Pending owner visual verification on device.**
- 2026-05-17 — HRP Gate 4 wire (WS-067 / SPR-085). HE-17 producer entry spec'd: "Flag for review" single-tap toggle in Summary mode, below ActionHistoryGrid. Writes `hand.flags[]` with `source: 'showdown'`; fully reversible from HandBrowser later. Integrated with existing toast+undo flow on Next Hand commit. JTBDs served list grew: HE-17 (flag for review). Spec-only: no code (HRP Phase 3 is documentation-only). Schema authored in `hand-review-modal.md`; ShowdownView is producer-only.
