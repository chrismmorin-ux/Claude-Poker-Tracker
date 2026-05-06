# Audit — 2026-05-06 — Entry — Straddle UX (Sprint A2)

**Scope:** Sprint A2 of the WS-002 straddle build — UX layer (session-config field + per-hand long-press + amount modal + TableHeader/SeatComponent indicators).
**Auditor:** Claude (main), session 2026-05-06.
**Method:** LIFECYCLE.md Gate 1 — scope classification, persona check, JTBD check, gap analysis.
**Status:** Closed — GREEN; proceed directly to Gate 4 (Design) inline below, then Gate 5 (Implementation).

---

## Executive summary

Sprint A2 ships the user-facing layer of straddle support that Sprint A1's engine plumbing now supports. Owner pre-decided the major UX choices (2026-05-06 conversation): straddle is **session-or-hand-specific, never persistent settings**; long-press on UTG or BTN seat opens an amount modal; amount may also be set at session creation as a default. Gate 1 is GREEN: every persona is already in the cast, and 1 missing JTBD (HE-18 — *post a straddle for the current hand*) is authored inline as part of this audit (standard Gate 1 framework expansion, not a YELLOW gap requiring Gate 2). All affected surfaces are existing — no new surface artifact required; `table-view.md` and `seat-context-menu.md` get small extensions.

---

## Scope details

- **Surfaces affected:**
  - `table-view` — new TableHeader straddle chip, new SeatComponent straddler badge, long-press handler on UTG/BTN seat (extends existing seat-tap pattern)
  - `seat-context-menu` — long-press as alternate gesture entry (no menu item — direct modal open)
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
- 2026-05-06 owner conversation: session-or-hand-specific (no persistent settings); long-press is the gesture; amount configurable at session start AND per-hand

---

## Scope classification

**Surface-bound extension** — no new view, no new journey, no cross-product expansion. Three existing surfaces (table-view, seat-context-menu, session-creation form) gain small additive elements. One small confirm-modal pattern is introduced (StraddleModal); it follows the existing `ConfirmDeleteModal` / `VersionMismatchModal` Tailwind pattern and does not warrant its own surface artifact.

## Personas check

Every relevant persona is in the existing cast. **No new persona required.**

| Persona | Relevance | Already in cast? |
|---|---|---|
| chris-live-player | core; primary user of TableView | ✅ |
| mid-hand-chris | situational; straddle decision happens BEFORE first action, so this persona's "no modal interrupt" constraint is honored — long-press is a deliberate held gesture, not interrupt; modal opens only on intentional press-and-hold on UTG/BTN | ✅ |
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
  - User can post a straddle in ≤2 taps from a non-modal state: long-press UTG or BTN seat → modal pre-fills amount → tap "Post."
  - Session-default straddle auto-applies to every hand without further interaction.
  - Per-hand override is possible — long-press still works even when session default is set, allowing hand-specific amount or skip via Cancel.
  - UTG > BTN precedence is enforced: posting UTG straddle while BTN was set as session default suppresses the BTN straddle for that hand.
  - Posted straddle is visible in TableHeader (chip with seat + amount) and on the straddler's seat (small "STR" badge).
  - Undo path: clearing the seat or resetting the hand removes the straddle.
- **Failure modes:**
  - Straddle modal opens accidentally during normal seat-tap recording → mitigation: long-press (500ms hold) gates the modal; seat must have no preflop action recorded yet
  - Both UTG and BTN posted as session defaults → mitigation: session-config form allows only one seat-position selection (UI radio)
  - Modal interrupt during mid-hand action → mitigation: long-press only fires before any preflop action is in actionSequence; once any seat acts, the gesture becomes a no-op
- **Distinguished from:** HE-11 (one-tap action entry — straddle is NOT an in-decision action, it's a posted blind before action begins). HE-12 (undo a miskeyed action — covers straddle removal via the same Undo flow).
- **Surfaces:** `table-view` (long-press on UTG/BTN seat → StraddleModal; TableHeader chip; SeatComponent badge); session-creation form (optional default).

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
  - Triggered by long-press (500ms hold) on UTG or BTN seat, gated by `actionSequence.length === 0` (no preflop action recorded yet)
  - Title: `"Straddle from {position}?"` where {position} is "UTG" or "BTN"
  - Field: amount input, numeric, pre-filled with session default (if set) or `2 * blinds.bb` otherwise; user-editable
  - Buttons: "Post Straddle" (primary, purple) / "Cancel"
  - On Post: dispatches `RECORD_STRADDLE` reducer action
  - On Cancel or backdrop click: closes without effect
  - UTG > BTN precedence: if a STRADDLE entry already exists for the current hand, long-press on the OTHER position is a no-op (Cancel-equivalent)

**Implementation paths:**
- `src/components/views/TableView/StraddleModal.jsx` (new; small file, ConfirmDeleteModal pattern)
- `src/components/views/TableView/SeatComponent.jsx` — long-press handler; straddler badge render
- `src/components/views/TableView/TableHeader.jsx` — chip render
- `src/reducers/gameReducer.js` — new `RECORD_STRADDLE` action; auto-fire from session config in `nextHand`
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
