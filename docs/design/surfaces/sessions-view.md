# Surface — Sessions View

**ID:** `sessions-view`
**Code paths:**
- `src/components/views/SessionsView/SessionsView.jsx` (419 lines)
- `./ActiveSessionCard.jsx` — ongoing session summary + Resume button
- `./BankrollDisplay.jsx` — running totals
- `./CashOutModal.jsx` — destructive flow for closing a session
- `./ImportConfirmModal.jsx` — import confirmation UI
- `src/components/ui/SessionForm.jsx`, `./SessionCard.jsx` — list rendering
- `src/contexts/SessionContext.jsx`, `src/hooks/useSessionPersistence.js`

**Route / entry points:**
- `SCREEN.SESSIONS`.
- Opens from: bottom-nav, post-login (if no active session), or auto-open-new-session flow after player cleanup.
- Closes to: `TableView` on start/resume; `TournamentView` when session is a tournament; stays in place on cash-out.

**Product line:** Main app
**Tier placement:** Free+ (cap on session count applies in Free tier per INVENTORY F-04). BB-ante / ICM timing and cloud backup are Plus+ / Pro.
**Last reviewed:** 2026-04-21

---

## Purpose

Session lifecycle control: start a new cash-game or tournament session, resume an active one, view the bankroll history, cash out, edit or delete a past session, and import / export backup data. The span between hands at a venue is framed by a Session — this surface is how the user starts, ends, and recalls them.

## JTBD served

Primary:
- `JTBD-SM-17` open session with preset stakes / venue / game type
- `JTBD-SM-18` log add-ons / rebuys (via ActiveSessionCard / CashOutModal)
- `JTBD-SM-19` pause without closing session
- `JTBD-SM-20` recover session from interruption (post-crash resume)
- `JTBD-SM-21` clean cash-out with tip logging
- `JTBD-SM-22` backfill a forgotten session (manual create with past dates)
- `JTBD-DE-72` raw JSON export (Download backup)
- `JTBD-DE-75` full-archive export on leave

Secondary:
- `JTBD-MT-62` offline-first at signal-less casino — the Sessions surface is the anchor for local-first data
- `JTBD-CC-77` state recovery after crash

## Personas served

- [Chris](../personas/core/chris-live-player.md), [Between-hands Chris](../personas/situational/between-hands-chris.md), [Post-session Chris](../personas/situational/post-session-chris.md) — primary
- [Weekend Warrior](../personas/core/weekend-warrior.md), [Rounder](../personas/core/rounder.md), [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md), [Circuit Grinder](../personas/core/circuit-grinder.md) — primary bankroll users
- [Traveler](../personas/core/traveler.md) — offline-first / multi-currency pain point (F-P14 proposed)
- [Ringmaster](../personas/core/ringmaster-home-host.md) — home-game settling flows
- [Banker / Staker](../personas/core/banker-staker.md) — read the bankroll (future staker portal F-P08 lives downstream of this)

---

## Anatomy

```
┌────────────────────────────────────────────────┐
│ BankrollDisplay — totals across all sessions   │
├────────────────────────────────────────────────┤
│ ActiveSessionCard (if session is running)      │
│   [Resume] [Cash Out] [Add-on] [Abandon]       │
├────────────────────────────────────────────────┤
│ [+ New Session]   [Import]   [Download backup] │
├────────────────────────────────────────────────┤
│ Past sessions list (SessionCard ×N)            │
│   • date • venue • game • hands • net          │
│   → click to edit/delete/inspect               │
├────────────────────────────────────────────────┤
│ CashOutModal / ImportConfirmModal (overlays)   │
└────────────────────────────────────────────────┘
```

Wrapped in `ScaledContainer` with `scale` prop forwarded.

## State

- **Session context (`useSession`):** `currentSession`, `allSessions`, `startNewSession`, `endCurrentSession`, `updateSessionField`, `loadAllSessions`.
- **UI context (`useUI`):** `autoOpenNewSession` flag, `setCurrentScreen`, `SCREEN`.
- **Tournament context (`useTournament`):** `initTournament`, `createNewTournament` — cross-wiring when session is a tournament.
- **Sync bridge (`useSyncBridge`):** opt-in sync observer (paused for Firebase per F-W3).
- **Local (via SessionsView):** modal open/close, form draft state, import candidate, error state.
- Writes: `sessionReducer` (CRUD), IDB `sessions` / `activeSession` stores via `useSessionPersistence`, export downloads via `exportUtils`.

## Props / context contract

- `scale: number` — viewport scale.

## Key interactions

1. **Start New Session** → `SessionForm` → validates → `startNewSession` → navigates to `TableView`.
2. **Resume** (on `ActiveSessionCard`) → `setCurrentScreen(SCREEN.TABLE)`.
3. **Cash Out** → `CashOutModal` (tip + final stack inputs) → `endCurrentSession` → session moves to past-list.
4. **Edit past session** → click `SessionCard` → inline or modal editor → `updateSessionField` → persists.
5. **Import** → `readJsonFile` → `validateImportData` → `ImportConfirmModal` → `importAllData` merges into IDB.
6. **Download backup** → `downloadBackup()` emits a JSON archive of sessions + hands + players.

---

## Known behavior notes

- **`autoOpenNewSession` flag** — set by flows that end with "go to sessions and open the new-session form" (e.g., post-player-cleanup); consumed once by SessionsView on mount.
- **Tournament init** is routed here: creating a tournament session dispatches to `TournamentContext` and navigates to `TournamentView`, not `TableView`.
- **Bankroll math** includes add-ons, rebuys (`calculateTotalRebuy`), tips, and cash-out deltas.
- **Destructive actions** — Delete Session, Cash Out, Import (which can merge duplicates) are all irreversible and today rely on explicit user dialogs rather than undoable toasts.

## Known issues

- Flagged at framework creation: **Online Sessions are not separated** from live sessions in this view (F-03 connection gap). Online-captured hands are persisted to the same list. See [AUDIT-2026-04-21-SV F7](../audits/2026-04-21-sessions-view.md) — P3 Live/Online filter pills proposed.
- [AUDIT-2026-04-21-sessions-view](../audits/2026-04-21-sessions-view.md) — 6 active findings (1 sev-4 → SHIPPED, 1 sev-3 queued, 2 sev-2 queued, 2 sev-1 queued). F1 `window.confirm` on Delete Session → toast+undo shipped (same pattern ported from TableView). F3 withdrawn after code verification: `importAllData` actually replaces (calls `clearAllData()` first), so the warning copy is accurate.
- **P1 queued:** F2 tip field on CashOutModal — `JTBD-SM-21` names tip logging but no field exists. Requires session schema change + BankrollDisplay wire-through.
- **P2 queued:** F4 rebuy entry (inputMode + undo toast + 44px + preset), F5 bottom-bar collision risk at sub-reference scale.
- **P3 queued:** F6 SessionForm dirty-state backdrop guard, F7 Live/Online filter pills.

## Potentially missing

- **Online Sessions tab / filter** — sidebar imports surface here with no visual differentiation (F-W gap from INVENTORY).
- **Multi-currency display** (F-P14) — not served; Traveler persona pain point.
- **Tax-friendly per-year export** (DE-71) — only raw JSON ships today.
- **Session backfill flow** (SM-22) — possible via manual create, but no dedicated "backfill" affordance.

---

## Test coverage

- `src/components/views/SessionsView/__tests__/*.test.jsx` — component + handler coverage.
- Persistence covered in `useSessionPersistence` tests + reducer tests.

## Related surfaces

- `table-view` — primary exit for "Resume / Start New".
- `tournament-view` — exit for tournament sessions.
- `stats-view` — consumes sessions aggregate.
- `hand-replay-view` — drills down into per-hand review from a SessionCard.
- `settings-view` — venue / game-type config that populates SessionForm dropdowns.

---

## Change log

- 2026-04-21 — Created (DCOMP-W0 session 1, Tier A baseline).
- 2026-04-21 — DCOMP-W1-S4: Gate 4 heuristic audit + Gate 5 P0 implementation. `handleDeleteSession` rewritten to deferred-delete toast+undo pattern. F3 (import warning copy) verified and withdrawn.
- 2026-04-21 — **DCOMP-W1 S4–S9 (Gate 5): ALL 6 active SessionsView audit findings SHIPPED** (F3 withdrawn). F1 (S4: deferred-delete Delete Session). F4 (S5: rebuy inputMode=decimal + 44px + "Use $X" preset + undo). F5 (S6: bottom-bar flex container). F6 + F7 (S7: SessionForm dirty-state backdrop guard; Live/Online filter pills with localStorage persistence). F2 (S9: optional tip field on CashOutModal wired through P&L — additive schema, backward-compat). **All findings code-complete. Pending owner visual verification on device.**
