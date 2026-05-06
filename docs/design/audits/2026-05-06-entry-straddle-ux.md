# Audit — 2026-05-06 — Entry — Straddle UX (Sprint A2)

**Scope:** Sprint A2 of the WS-002 straddle build — UX layer (session-config field + per-hand long-press + amount modal + TableHeader/SeatComponent indicators).
**Auditor:** Claude (main), session 2026-05-06.
**Method:** LIFECYCLE.md Gate 1 — scope classification, persona check, JTBD check, gap analysis.
**Status:** Closed — GREEN; proceed directly to Gate 4 (Design) inline below, then Gate 5 (Implementation).

---

## Executive summary

Sprint A2 ships the user-facing layer of straddle support that Sprint A1's engine plumbing now supports. Owner pre-decided the major UX choices (2026-05-06 conversation): straddle is **session-or-hand-specific, never persistent settings**; right-click / long-press UTG or BTN seat surfaces a `🎲 Straddle…` row in the SeatContextMenu (revised same-day from a standalone long-press gesture which collided with the menu's own long-press trigger); amount may also be set at session creation as a default. Gate 1 is GREEN: every persona is already in the cast, and 1 missing JTBD (HE-18 — *post a straddle for the current hand*) is authored inline as part of this audit (standard Gate 1 framework expansion, not a YELLOW gap requiring Gate 2). All affected surfaces are existing — no new surface artifact required; `table-view.md` and `seat-context-menu.md` get small extensions.

---

## Scope details

- **Surfaces affected:**
  - `table-view` — new TableHeader straddle chip, new SeatComponent straddler badge
  - `seat-context-menu` — new `🎲 Straddle…` row in the seat-config section, eligibility-gated by an optional `onStraddle` prop (undefined ⇒ row hidden); revised 2026-05-06 from initial long-press gesture proposal which collided with the menu's own trigger
  - Session creation flow (cash + tournament) — optional "Default straddle" field
- **Surfaces created:** none (StraddleModal is a small confirm-modal pattern; lives inline in `table-view.md` Anatomy)
- **Journeys affected:** none (action recorded in same flow as any other primitive action; no cross-surface)
- **Personas considered:** chris-live-player (primary), mid-hand-chris (situational primary — straddle is a between-hands or pre-first-action decision, not mid-action), between-hands-chris (the actual operating mode for posting a straddle), ringmaster-home-host (home games run straddles often), rounder, weekend-warrior, circuit-grinder
- **Heuristic sets applied:** Nielsen-10 (visibility of state, undo affordance), Poker-Live-Table (one-tap entry, discreet operation), Mobile-Landscape (1600×720 thumb reach)
- **Out of scope:** re-straddles, all-in straddles, Mississippi-style any-position straddle (owner scope decided 2026-05-02: UTG + BTN only, UTG > BTN precedence, no re-straddle)

## Artifacts referenced

- `docs/design/surfaces/table-view.md` — primary surface
- `docs/design/surfaces/seat-context-menu.md` — gesture pattern reference
- `docs/design/jtbd/domains/hand-entry.md` — JTBD home (HE-* family)
- `.claude/failures/TABLEVIEW_INVARIANT_GAP.md` line 104 — failure-file scope catalog
- `src/components/views/TableView/__tests__/actionInvariants.fixture.js` — STRADDLE COVERAGE comment block (Sprint A1)
- WS-002 / SPR-010 owner-decided scope (2026-05-02): UTG+BTN only, UTG>BTN precedence, no re-straddle
- 2026-05-06 owner conversation (initial scope): session-or-hand-specific (no persistent settings); long-press is the gesture; amount configurable at session start AND per-hand
- 2026-05-06 owner clarification (post-Sprint-A2): long-press conflicts with the existing right-click / long-press menu — straddle should be a menu row alongside "Make My Seat" / "Make Dealer". Sprint A2 amended same-session to honor.

---

## Scope classification

**Surface-bound extension** — no new view, no new journey, no cross-product expansion. Three existing surfaces (table-view, seat-context-menu, session-creation form) gain small additive elements. One small confirm-modal pattern is introduced (StraddleModal); it follows the existing `ConfirmDeleteModal` / `VersionMismatchModal` Tailwind pattern and does not warrant its own surface artifact.

## Personas check

Every relevant persona is in the existing cast. **No new persona required.**

| Persona | Relevance | Already in cast? |
|---|---|---|
| chris-live-player | core; primary user of TableView | ✅ |
| mid-hand-chris | situational; straddle decision happens BEFORE first action, so this persona's "no modal interrupt" constraint is honored — the menu row is a deliberate two-step affordance (open menu → tap Straddle), not an interrupt | ✅ |
| between-hands-chris | situational; the actual operating mode for posting a straddle (between hands, before action begins) | ✅ |
| ringmaster-home-host | home games run straddles frequently; permanent-rule scenario via session default | ✅ |
| rounder, weekend-warrior, circuit-grinder | live-table users who may encounter straddles in their pool | ✅ |

## JTBD check

One missing JTBD identified and authored inline below:

**HE-18 — Post a straddle for the current hand** *(new — added by this audit)*

> When a player at my table posts a straddle (UTG or BTN), I want to record it on the current hand before action begins, so the action order, pot, and recommendation engine treat the straddle as the effective last raise. If my table runs a permanent straddle rule, I want to set it once at session start so I don't have to mark every hand.

- **State:** Active (Sprint A2 implementation in this session).
- **Primary persona:** between-hands-chris (the operating mode); chris-live-player (the user).
- **Success criteria:**
  - User can post a straddle in ≤3 taps from a non-modal state: right-click / long-press UTG or BTN seat → tap `🎲 Straddle…` row → modal pre-fills amount → tap "Post."
  - Session-default straddle auto-applies to every hand without further interaction.
  - Per-hand override is possible — the menu row still appears even when a session default is active, allowing hand-specific amount or skip via the menu's natural dismissal.
  - UTG > BTN precedence is enforced: posting UTG straddle while BTN was set as session default suppresses the BTN straddle for that hand.
  - Posted straddle is visible in TableHeader (chip with seat + amount) and on the straddler's seat (small "STR" badge).
  - Undo path: clearing the seat or resetting the hand removes the straddle.
- **Failure modes:**
  - Modal opens accidentally during normal flow → mitigation: row only shown when seat is UTG or BTN AND `actionSequence.length === 0` AND no STRADDLE entry exists; eligibility computed in TableView's `eligibleStraddleSeats` memo.
  - Both UTG and BTN posted as session defaults → mitigation: session-config form allows only one seat-position selection (UI radio).
  - Long-press collision (the original 2026-05-06 design) → resolved by moving the affordance into the menu that long-press already opens.
- **Distinguished from:** HE-11 (one-tap action entry — straddle is NOT an in-decision action, it's a posted blind before action begins). HE-12 (undo a miskeyed action — covers straddle removal via the same Undo flow).
- **Surfaces:** `table-view` (header chip + seat badge); `seat-context-menu` (Straddle row); session-creation form (optional default).

## Gap analysis output

**GREEN** — all personas exist; 1 missing JTBD (HE-18) authored inline as standard Gate 1 framework expansion. No Gate 2 trigger.

| Dimension | Status | Notes |
|---|---|---|
| Persona coverage | GREEN | Every relevant persona already in cast |
| JTBD coverage | GREEN (after authoring HE-18) | New JTBD is small, fits cleanly in existing HE-* domain |
| Heuristic pre-check | GREEN | One-tap (Poker-Live-Table H-PLT01) honored by long-press default-fill; visibility (Nielsen H-N01) honored by header chip + seat badge; undo (Nielsen H-N03) inherited from existing seat-clear path |
| Cross-surface | GREEN | No journeys touched; no other product line affected |
| Autonomy red lines | GREEN | No engagement-pressure, no graded work, no demographic targeting; user-initiated gesture only |

---

## Gate 4 inline (Design)

Per LIFECYCLE.md, surface-bound additions update existing surface artifacts. Authored as part of this audit:

### Extension to `surfaces/table-view.md`

**Anatomy additions:**
- **TableHeader straddle chip** (when straddle active for current hand): compact pill rendered to the right of stakes/venue, format `"$X (UTG)" or "$X (BTN)"`, color = #a855f7 (matches `PRIMITIVE_BUTTON_CONFIG.STRADDLE.bg` from Sprint A1). Visible only on preflop street; clears when hand advances to flop.
- **SeatComponent straddler badge** (on UTG or BTN seat when posted): small "STR" tag overlay, same purple, positioned top-right of seat avatar. Persists for the duration of the hand.
- **StraddleModal** (small confirm modal):
  - Triggered by tapping the `🎲 Straddle…` row in the SeatContextMenu (see seat-context-menu.md extension below)
  - Title: `"Straddle from {position}?"` where {position} is "UTG" or "BTN"
  - Field: amount input, numeric, pre-filled with session default (if set) or `2 * blinds.bb` otherwise; user-editable
  - Buttons: "Post Straddle" (primary, purple) / "Cancel"
  - On Post: dispatches `RECORD_STRADDLE` reducer action
  - On Cancel or backdrop click: closes without effect
  - UTG > BTN precedence: if a STRADDLE entry already exists for the current hand, the menu row is hidden on the OTHER position's menu

### Extension to `surfaces/seat-context-menu.md`

- New `🎲 Straddle…` row in the seat-config section (alongside "Make My Seat" / "Make Dealer"). Purple text (matches Sprint A1 STRADDLE primitive color).
- Eligibility-gated via an optional `onStraddle` prop on `SeatContextMenu` — undefined ⇒ row hidden. Caller computes eligibility (UTG / BTN only, preflop only, `actionSequence.length === 0`, no existing STRADDLE entry).
- `data-testid="menu-straddle"` for testing.

**Implementation paths:**
- `src/components/views/TableView/StraddleModal.jsx` (new; small file, ConfirmDeleteModal pattern)
- `src/components/views/TableView/SeatContextMenu.jsx` — new `StraddleButton` row + `onStraddle` prop
- `src/components/views/TableView/SeatComponent.jsx` — straddler badge render only (no gesture handler — long-press is the menu's own trigger)
- `src/components/views/TableView/TableHeader.jsx` — chip render
- `src/components/views/TableView/TableView.jsx` — `eligibleStraddleSeats` memo, `handleSeatStraddle` handler, modal state, wires `onStraddle` to the menu
- `src/reducers/gameReducer.js` — new `RECORD_STRADDLE` action; auto-fire from session config via TableView effect keyed on handCount
- `src/contexts/SessionContext.jsx` (or session schema) — `straddle: { seat, amount } | null` optional field

### Extension to session-creation form

Cash session start + tournament setup form gain an optional collapsible "Default straddle" subsection:
- Radio: None (default) / UTG / BTN
- Number input: amount (visible only when seat is selected; pre-fills `2 * bb`)
- Persists with the session record; auto-applies on every new hand started in that session

---

## Verdict

GREEN — proceed to Gate 5 (Implementation) immediately in same session.

## Change log

- 2026-05-06 — Created. HE-18 authored inline. Sprint A1 (engine plumbing) closed earlier same day; Sprint A2 begins on owner approval of this audit.
- 2026-05-06 (same-day amendment #1 — gesture) — Owner identified that the original long-press gesture for straddle entry collides with the existing right-click / long-press SeatContextMenu trigger (see `surfaces/seat-context-menu.md`). The mechanic was re-grounded as a `🎲 Straddle…` row inside the same menu, alongside "Make My Seat" / "Make Dealer". Sprint A2 implementation amended same-session: long-press handler removed from SeatComponent; new `StraddleButton` + `onStraddle` prop added to SeatContextMenu; TableView wires eligibility through. STR badge + TableHeader chip + StraddleModal + reducer behavior unchanged.
- 2026-05-06 (same-day amendment #2 — action order) — Owner clarified Mississippi action-order rule: when a straddle is in play, first to act preflop = next active seat clockwise from the straddler ("left of the straddle"; the straddle takes the place of the BB for action-order purposes). The original Sprint A1 implementation of `getFirstActionSeat` used "BB+1, skip straddler" logic which produced the wrong first-to-act for BTN straddle (returned UTG instead of SB). Replaced with `getNextActiveSeat(straddler)` when a straddler is present; falls back to BB+1 when no straddle. Postflop unaffected. 5 new tests added to `seatUtils.test.js` covering UTG straddle, BTN straddle, wraparound, absent-seat skipping, and postflop unchanged. Matrix fixture INV-S-014's narrative comment corrected (button-shape result unchanged — the harness only asserts button shape per `selectedPlayers`, not flow position). All 256 targeted tests green post-amendment (74 → 79 in seatUtils).
