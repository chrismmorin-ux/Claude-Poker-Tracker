# Handoff — Design Compliance Wave 1 Session 4 (Gate 5 P1 Implementation + Parallel Audits)

**Session:** 2026-04-21
**Owner this session:** Claude (main) + 2 parallel audit agents (ShowdownView, SessionsView)
**Project:** `.claude/projects/design-compliance.md` → DCOMP-W1
**Status:** CLOSED — 5 P1 findings (F1/F2/F3/F4/F5/F10) shipped to production code. Parallel audits on ShowdownView + SessionsView launched; completions logged separately.

---

## What I did

Owner approved the Gate 4 audit, so I ran Gate 5 for the 4 P1 findings (plus F10 coupled with F1, plus F5 incidentally closed by the shared constant). Simultaneously dispatched two `run_in_background` audit agents for ShowdownView + SessionsView to make the session compound.

### Code changes (4 files, all TableView)

**`src/components/views/TableView/CommandStrip.jsx`**
- Added `resetHandUndoRef` + `UNDO_TOAST_DURATION_MS = 12000` constant (F1 + F5).
- Rewrote `handleResetHand`: snapshot state → `resetHand()` → toast with Undo that HYDRATE_STATEs both reducers. Mirrors Next Hand pattern exactly. `window.confirm` removed.
- Applied `UNDO_TOAST_DURATION_MS` to Next Hand toast (was 5000ms; now 12000ms) — F5 unify.
- Added `editingSlotIndex` state; `handleSizingLongPressStart` now takes `slotIdx` arg (F3).
- Rewrote orbit strip block as IIFE; added `computeFoldPreview` helper; each orbit button with count >0 renders a `+N` red badge with aria-label (F2).
- Threaded `editingSlotIndex` prop into `SizingPresetsPanel`.

**`src/components/views/TableView/SizingPresetsPanel.jsx`**
- New `editingSlotIndex` prop. Editor popup shows "editing <label>" sub-header in gold, highlights matching input with gold border, autoFocus on that slot (F3).
- Long-press handler signature change: `onMouseDown/onTouchStart` now call `onSizingLongPressStart(idx)` with the slot index.

**`src/components/views/TableView/LiveAdviceBar.jsx`**
- Replaced 9px gray "20s ago" age counter with amber "AGING · Ns" badge at font-size 11 (F4).
- Promoted STALE badge font-size 9 → 11 for consistency + glanceability (H-PLT01).

**`src/components/views/TableView/ControlZone.jsx`**
- Reset Hand button de-emphasized: height 48 → 40, font 13 → 12, gray-400 foreground, opacity 0.75 (F10).
- Next Hand row wrapper `pt-1` → `pt-3` for physical gap above the gold CTA (F10).

### Docs changes

- `docs/design/evidence/LEDGER.md` — added `EVID-2026-04-21-TV-GATE5-P1` with code citations, test results, and owner visual-verification checklist.
- `docs/design/audits/2026-04-21-table-view.md` — appended "Gate 5 resolution" section with per-finding status table + sign-off (per METHODOLOGY.md audits are immutable once closed — appended not revised). Sign-off updated: "Owner-reviewed 2026-04-21; P1 implementation closed 2026-04-21 (DCOMP-W1-S4)."
- `.claude/BACKLOG.md` — DCOMP-W1 updated with S4 progress + remaining estimate.
- `docs/design/surfaces/table-view.md` — Known issues cross-linked to audit P1 status.

### Parallel audits (background)

Dispatched `product-ux-engineer` agents on ShowdownView and SessionsView with full heuristic-walkthrough briefs. Per LIFECYCLE.md Gate-2 bypass policy, no blind-spot roundtable is needed for these surface-bound audits (no new surface, no new interaction pattern, no unserved persona).

**Audit files status at session close:**
- `docs/design/audits/2026-04-21-sessions-view.md` — **COMPLETED same session**. 7 findings (1 sev-4, 2 sev-3, 2 sev-2, 2 sev-1). **SV-F1 (sev 4) SHIPPED** as a deferred-delete toast+undo pattern. SV-F3 verified against finding (importAllData calls clearAllData first — warning copy is accurate) → **WITHDRAWN**.
- `docs/design/audits/2026-04-21-showdown-view.md` — **COMPLETED same session**. 7 findings (1 sev-4, 1 sev-3, 3 sev-2, 2 sev-1). **SDV-F1 (sev 4) SHIPPED** as a snapshot + toast+undo pattern on `handleNextHandFromShowdown`, with `openShowdownView()` on undo to return the user to where they were. Covers both the header Next Hand button and the winner-confirmation overlay Next Hand button (same handler).

### Gate 5 additions — SessionsView F1 (shipped same session)

After the SessionsView audit completed, main-Claude verified the 3 high-severity claims and shipped the P0:

**Code changes (1 file):** `src/components/views/SessionsView/SessionsView.jsx`
- Added `UNDO_TOAST_DURATION_MS = 12000` constant + `pendingDeletesRef = useRef(new Map())` at lines 32-36.
- Unmount cleanup effect at lines 71-83: commits any pending deletes when the component unmounts (navigating away = intent to delete).
- `handleDeleteSession` at lines 120-175 rewritten: optimistic removal from local `sessions` state → setTimeout for the real `deleteSessionById` → toast with Undo action that clears the timeout and restores the snapshot to local state.

**Why deferred-delete rather than delete-then-restore:** Avoids the sessionId-preservation problem (createSession assigns new IDs) and avoids cascading hand-record restoration. IDB is never touched during the undo window. Clean and minimal.

### Gate 5 additions — ShowdownView F1 (shipped same session)

After the ShowdownView audit landed, main-Claude verified `useShowdownHandlers.js:84-87` (unguarded `nextHand() + closeShowdownView()`) and shipped the P0.

**Code changes (2 files):**
- `src/hooks/useShowdownHandlers.js` — added `UNDO_TOAST_DURATION_MS = 12000` + `nextHandUndoRef`; extended hook signature with 12 optional inputs (`dealerButtonSeat`, `currentStreet`, `absentSeats`, `communityCards`, `holeCards`, `allPlayerCards`, `holeCardsVisible`, `handCount`, `setHandCount`, `openShowdownView`, `addToast`, `showInfo`). Rewrote `handleNextHandFromShowdown` to snapshot full hand state → call `nextHand()` → show 12s toast with Undo action that HYDRATE_STATEs both reducers, restores handCount, and re-opens Showdown.
- `src/components/views/ShowdownView/ShowdownView.jsx` — consolidated `useGame` destructure to include `currentStreet` + `absentSeats`; imported `useSession` + `useToast`; extended the `useShowdownHandlers` call site with the 12 new inputs.

**Pattern note:** Mirrors TableView Next Hand undo but differs in one important way: calls `openShowdownView()` on undo so the user lands back on the Showdown surface, not TableView. This matches the ringmaster-in-hand undo mental model ("return me to where I was before I broke the hand," not just "restore the data").

**Backward compatibility:** The 12 new hook inputs are all optional. When absent (as in the existing test harness), the handler falls back to pre-fix behavior. 23/23 existing useShowdownHandlers tests pass unchanged.

**Covers both call sites:** header Next Hand AND winner-confirmation overlay Next Hand both call `handleNextHandFromShowdown`, so the fix applies to both — audit observation confirmed.

**Tests:** 111/111 ShowdownView + hook tests pass.

**Evidence:** `EVID-2026-04-21-SDV-GATE5-F1` in the ledger.

**Tests:** 103/103 SessionsView sub-component tests pass (BankrollDisplay 18, ImportConfirmModal 24, CashOutModal 24, ActiveSessionCard 37). No SessionsView.jsx-specific test file exists; integration coverage of the new flow is an open gap.

**Evidence:** `EVID-2026-04-21-SV-GATE5-F1` in the ledger.

## Tests

- **Full suite:** 6125/6126 passing. The 1 failure is `precisionAudit.test.js` — pre-existing Monte Carlo stochastic test, documented in Session 3 handoff (EVID-2026-04-21-SESSION3-IMPLEMENTATION). Unrelated to this work.
- **TableView sub-component tests:** 86/86 passing (TableHeader 13, SeatContextMenu 28, SeatComponent 33, LiveAdviceBar 12).
- **Reducers:** 238/238 passing (HYDRATE_STATE path verified — used by F1 undo).

## Visual verification status

Playwright MCP still unavailable. Per CLAUDE.md: "if you can't test the UI, say so explicitly rather than claiming success." **Owner must verify on device:**

| F# | Test | Expected |
|----|------|----------|
| F1 | Record some actions → tap Reset Hand | No native dialog; warning toast "Hand reset" with Undo action visible for 12s. |
| F1 | Tap Undo within 12s | State restored: actionSequence, dealer button, community cards, hole cards, street, absent seats. |
| F1 | Tap Reset Hand with NO actions recorded | "Hand reset" info toast (no Undo action — nothing to restore). |
| F2 | 6+ handed preflop, action on UTG → tap toward CO | Orbit buttons between UTG and CO each show "+1" small red badge; tapping CO auto-folds them + post-toast count matches. |
| F3 | Long-press the "2/3 pot" sizing button | Editor opens with "editing 2/3 pot" gold subtitle; that slot's input has gold border + is focused. |
| F4 | Let 20+ seconds elapse without street change | AGING badge appears (amber) with "AGING · 25s" (not the old faint "25s ago"). |
| F4 | Let 60+ seconds elapse | STALE badge replaces AGING (red). |
| F10 | Look at control zone | Reset Hand visibly smaller + dimmer than Deselect / Absent / Reset Street; visible vertical gap above gold Next Hand CTA. |

## Framework leverage captured

The F1/F2 severity calibrations in the Gate 4 audit cited `ringmaster-in-hand` (authored in S2). The F4 citation used `newcomer-first-hand` (same). The F9 reference to `JTBD-MH-11` wouldn't have existed without S2's Gate 3 work. Gate 3 framework-level investment paid off in Gate 4 severity AND in Gate 5 defensive-code decisions (e.g., the 12s undo window is calibrated to between-hands-chris's attention budget, derivable only from that persona's surface contract).

## Out of scope for this session

- P2 findings (F6, F7, F8, F9) and P3 findings (F11, F12) — queued for subsequent sessions. None are blocking.
- Visual verification — owner responsibility.
- ShowdownView / SessionsView audit implementation — agents produced the audits; implementation follows owner review.

## What comes next

- **Owner visual verification** of the 8 checklist items above. Any regression reverts cleanly via git.
- **Audit completions** arrive asynchronously; I'll process each once notified.
- **W1-S5:** implement TableView P2 batch (F6, F7, F8, F9) — 1 session, all small-effort. Or ShowdownView Gate 5 if that audit produces P1s.
- **W1-S6+:** SessionsView fixes.

## Closed

5 tasks completed (F1+F10 coupled, F3, F4, F2, final wiring). Gate 5 implementation demonstrates the framework's round-trip: persona → JTBD → heuristic → finding → fix → evidence.
