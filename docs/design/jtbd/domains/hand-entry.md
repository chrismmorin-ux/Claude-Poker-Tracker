# JTBD Domain — Hand Entry

Jobs that capture what happened in a hand — either live (manual taps) or online (auto-capture via sidebar).

**Primary personas:** All live-playing personas; [Multi-Tabler](../../personas/core/multi-tabler.md) and [Online MTT Shark](../../personas/core/online-mtt-shark.md) via auto-capture.

**Surfaces:** `TableView` (action buttons, seat grid), sidebar capture pipeline.

---

## HE-11 — One-tap seat action entry

> When a hand starts, I want to tap a single button per seat-action (fold / check / bet / raise / call), so I don't fall behind.

## HE-12 — Undo / repair a miskeyed action

> When I tap the wrong action, I want to undo or correct it without losing the hand, so data stays clean.

## HE-13 — Auto-capture via sidebar (online)

> When playing online on Ignition, I want actions captured automatically, so I enter nothing manually.

## HE-14 — Discreet entry that looks like texting

> When at a live table, I want data entry that visually looks like phone use (scrolling, texting), so I don't draw attention.

- See also [H-PLT04](../../heuristics/poker-live-table.md) — Socially discreet.

## HE-15 — Enter a hand post-session from memory

> When I remember a hand after the session ends, I want to enter it from memory with partial data, so the record survives.

## HE-16 — Voice input for action calls

> When my hands are on chips / cards, I want to call actions by voice, so I stay hands-free during action.

- State: **Proposed** (DISC-03).

## HE-17 — Flag a hand for post-session review while still recording it

> When something unusual happens in a hand that I want to think about later, I want to mark it for review in one tap without leaving the live-entry flow, so the thought isn't lost to between-hands cognitive flush.

- State: **Active** (JTBD) / feature gap — no surface serves it today. Surfaced via [blind-spot audit 2026-04-21 table-view §B1](../../audits/2026-04-21-blindspot-table-view.md).
- Primary persona: [Between-hands Chris](../../personas/situational/between-hands-chris.md); secondary: [Mid-hand Chris](../../personas/situational/mid-hand-chris.md) (if the flag is single-tap).
- Success criteria: flag persists with the hand record; can be retrieved via `hand-replay-view` or `analysis-view` filter.
- Distinguished from [SR-26](./session-review.md) (Proposed — flag disagreement + add reasoning): SR-26 is a **review-surface** action performed post-hand with commentary. HE-17 is a **live-surface** single-tap mark with no required metadata. HE-17 is the low-friction entry; SR-26 is the richer annotation that can be added later.
- Primary surface: `TableView` (1-tap mark); retrieval in `hand-replay-view` + `analysis-view`.

## HE-18 — Post a straddle for the current hand

> When a player at my table posts a straddle (UTG or BTN), I want to record it on the current hand before action begins, so the action order, pot, and recommendation engine treat the straddle as the effective last raise. If my table runs a permanent straddle rule, I want to set it once at session start so I don't have to mark every hand.

- State: **Active** — Sprint A2 of WS-002 ships the surface in this session; engine plumbing landed in commit `f3cdb89` (Sprint A1). Surface mechanic revised 2026-05-06 from long-press to context-menu row (long-press collided with the existing right-click / long-press menu trigger; see [`seat-context-menu.md`](../../surfaces/seat-context-menu.md)).
- Primary persona: [Between-hands Chris](../../personas/situational/between-hands-chris.md) (the operating mode); secondary: [Chris (live player)](../../personas/core/chris-live-player.md), [Ringmaster](../../personas/core/ringmaster-home-host.md) (home games run straddles often).
- Owner scope (WS-002 / SPR-010, ratified 2026-05-02): UTG + BTN positions only; UTG > BTN precedence; no re-straddle.
- Action-order rule (Mississippi, owner-clarified 2026-05-06): when a straddle is in play, first to act preflop = next active seat clockwise from the straddler (the straddle "takes the place of the BB" for action-order). UTG straddle → first action UTG+1; BTN straddle → first action SB. Postflop unaffected.
- Success criteria:
  - Right-click / long-press UTG or BTN seat → SeatContextMenu shows a `🎲 Straddle…` row when seat is eligible (no preflop action recorded yet, no existing straddle posted). Tap row → StraddleModal opens.
  - Modal pre-fills amount with session default (if set) or `2 × bb`; user-editable; "Post" / "Cancel."
  - Session-default straddle auto-applies to every hand; per-hand menu row is the override.
  - UTG > BTN precedence: STRADDLE entry already on this hand → row hidden on the other position's menu.
  - Posted straddle is visible in TableHeader (chip with position + amount) and on the straddler's seat ("STR" badge).
  - Undo via existing reset-hand / clear-seat path.
- Failure modes:
  - Row shown after action begins → mitigated by `actionSequence.length === 0` gate in TableView; row not rendered.
  - Row shown on non-eligible seats → mitigated by UTG / BTN-only computation; only those two seats receive the `onStraddle` callback.
  - Both UTG and BTN as session defaults → mitigated by single-radio config UI.
- Distinguished from [HE-11](#he-11--one-tap-seat-action-entry) — straddle is a posted blind before action begins, not a betting decision; from [HE-12](#he-12--undo--repair-a-miskeyed-action) — straddle removal uses the existing undo path.
- Primary surface: `TableView` (context-menu row, modal, header chip, seat badge); session-creation form (optional default).

---

## Domain-wide constraints

- Hand entry must survive phone sleep and return to exact state on unlock (H-PLT05).
- One action entered wrongly cascades to incorrect advice — undo must be robust.
- Entry taps must be within thumb-reach zone for one-handed landscape use.

## Change log

- 2026-04-21 — Created Session 1b.
