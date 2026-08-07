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
**Last reviewed:** 2026-05-19 (PSD Gate 4 — inline Pre-Session Drill entry added)

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
- `JTBD-SE-01` prepare tonight's watchlist — entry path served by the inline `Pre-Session Drill` button (PSD Gate 4, 2026-05-19). Routes to `postflop-drills` Pre-Session mode with `activeTab='presession'` + `mode='prep'`. SessionsView is the primary launching surface for the daily Pre-Session workflow per `presession-preparer` persona.
- `JTBD-DE-72` raw JSON export (Download backup)
- `JTBD-DE-75` full-archive export on leave

Secondary:
- `JTBD-MT-62` offline-first at signal-less casino — the Sessions surface is the anchor for local-first data
- `JTBD-CC-77` state recovery after crash

## Personas served

- [Chris](../personas/core/chris-live-player.md), [Between-hands Chris](../personas/situational/between-hands-chris.md), [Post-session Chris](../personas/situational/post-session-chris.md) — primary
- [Pre-Session preparer](../personas/situational/presession-preparer.md) — situational primary for the inline Pre-Session Drill entry added 2026-05-19. Sibling of `post-session-chris` (Gate 3 A-R1 reconciliation): SessionsView serves the prep workflow (open PSD) while `post-session-chris` covers general post-session review; PSD's own review-mode covers drill-prediction-specific review only.
- [Weekend Warrior](../personas/core/weekend-warrior.md), [Rounder](../personas/core/rounder.md), [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md), [Circuit Grinder](../personas/core/circuit-grinder.md) — primary bankroll users
- [Traveler](../personas/core/traveler.md) — offline-first / multi-currency pain point (F-P14 proposed)
- [Ringmaster](../personas/core/ringmaster-home-host.md) — home-game settling flows
- [Banker / Staker](../personas/core/banker-staker.md) — read the bankroll (future staker portal F-P08 lives downstream of this)

---

## Anatomy

```
┌──────────────────────────────────────────────────────────┐
│ BankrollDisplay — totals across all sessions             │
├──────────────────────────────────────────────────────────┤
│ ActiveSessionCard (if session is running)                │
│   [Resume] [Cash Out] [Add-on] [Abandon]                 │
├──────────────────────────────────────────────────────────┤
│ [+ New Session] [Log past session] [Import] [Backup]     │
│ [Pre-Session Drill]                                      │
├──────────────────────────────────────────────────────────┤
│ VarianceBand (collapsible) — cash sessions only          │
│   • measured $/hr + swing per hour                       │
│   • true-win-rate interval bar w/ zero marker + verdict   │
│   • bankroll needed (tolerance pills) + risk of ruin      │
│   • downswings: worst had / expected / be-ready-for       │
│   • all-in EV adjusted rate (or "nothing to adjust")      │
│   • Kelly: full / half / quarter                          │
├──────────────────────────────────────────────────────────┤
│ Past sessions list (SessionCard ×N)                      │
│   • date • venue • game • hands • net                    │
│   → click to edit/delete/inspect                         │
├──────────────────────────────────────────────────────────┤
│ SessionLogForm (overlay) — log a past session OR edit    │
│   date · venue · stake · time in/out · buy-in · rebuys   │
│   · cash-out · tip · notes; live duration echo           │
│ CashOutModal / ImportConfirmModal (overlays)             │
└──────────────────────────────────────────────────────────┘
```

**SessionLogForm rationale (2026-08-07).** One component serves both *log a past
session* and *edit an existing one* — the fields are identical and two forms would
drift. Field order mirrors the spreadsheet row the founder used for two years
(date · time in/out · $ in · rebuys · $ out) so muscle memory transfers. Native
`type="date"` / `type="time"` inputs give the right mobile keyboards with no custom
picker to maintain. A live duration echo under the clocks ("3h 30m · ran past
midnight") makes a mistyped time visible before saving rather than surfacing later
as a wrong $/hr.

**Modal-stacking constraint.** `SessionDetailModal` and `SessionLogForm` are both
`fixed inset-0 z-50`. Opening the form from the detail modal MUST close the detail
modal — otherwise its backdrop sits over the form and swallows the Save tap.

**VarianceBand placement rationale (2026-08-07).** Mounted directly below `InsightsBand`, as a
sibling rather than an extension of it. InsightsBand is already dense (6 tiles + chart + 2
breakdowns), and the two answer different questions: Insights reports *what happened*, Variance
reports *what it means*. Both scope with the Live/Online/All filter. VarianceBand renders only
when a cash sample exists, so a founder with tournaments only never sees an empty shell.

**All-in EV adjusted rate (2026-08-07).** Shown inside the win-rate block, beside
the measured rate and never instead of it. Mechanical: equity at the street the
chips went in, realized share read off the finished board by the same function.
Coverage is always stated, and zero coverage says so in words rather than printing
a number identical to the raw rate. The ceiling is stated in the UI — only all-in
pots are corrected. Manual "I lost that to variance" tagging was considered and
**rejected** as an input: it is asymmetric in practice and would inflate the rate.

**Honesty contract (binding, POKER_THEORY §14.3/§14.4).** The cluster unit is the **session**,
never the hand, and every block states its `n`. Projected figures (required bankroll, risk of
ruin, Kelly, modelled drawdown) carry a visible `modelled` tag. The win-rate interval refuses to
render below 20 cash sessions, and when it straddles zero the panel says so in plain words rather
than letting a positive observed rate imply a proven one. Tournaments and sessions with no
recorded times are excluded from the math and their counts are declared, so the panel never reads
as if it covered everything.

Action-row placement rationale (Pre-Session Drill, 2026-05-19): inline button placed between `[Import]` and `[Backup]`. The button is for *opening tomorrow's drill*, not for managing sessions; placing it in the primary action row mirrors `+ New Session` discoverability for the daily-prep workflow. The button is visible on every SessionsView mount — no submenu, no overflow. Routes to `postflop-drills` with `activeTab='presession'` + `mode='prep'`; user picks variant (5/15/30) + mood inside the destination view.

Wrapped in `ScaledContainer` with `scale` prop forwarded.

## State

- **Session context (`useSession`):** `currentSession`, `allSessions`, `startNewSession`, `endCurrentSession`, `updateSessionField`, `loadAllSessions`.
- **UI context (`useUI`):** `autoOpenNewSession` flag, `setCurrentScreen`, `SCREEN`.
- **Tournament context (`useTournament`):** `initTournament`, `createNewTournament` — cross-wiring when session is a tournament.
- **Sync bridge (`useSyncBridge`):** opt-in sync observer (paused for Firebase per F-W3).
- **Local (via SessionsView):** modal open/close, form draft state, import candidate, error state.
- **Local (via SessionsView):** `logFormTarget` — `null` closed, `'new'` logging a
  past session, or a session object being edited. `cashOutEndTime` holds the
  optional finish-time correction at cash-out.
- **Session ops:** `logCompletedSession` (backfill) and `editSession` (correction)
  on `useSession`; both reload the list so Insights and Variance recompute. The
  edit path strips `isActive` — session lifecycle belongs to start/end.
- **Local (via VarianceBand):** collapse state (`sessionsView.varianceCollapsed`), ruin tolerance
  (`sessionsView.ruinTolerance`, default 5% matching the founder's spreadsheet), and current
  bankroll (`sessionsView.bankroll`) — all localStorage-persisted. No settings-schema change.
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
7. **Pre-Session Drill** (added 2026-05-19, PSD Gate 4) → tap inline `[Pre-Session Drill]` button → `setCurrentScreen(SCREEN.POSTFLOP_DRILLS)` with `activeTab='presession'` + `mode='prep'` UI hint. No modal; one-tap launch. Variant + mood picker rendered inside the destination view (per `postflop-drills.md` Pre-Session mode anatomy). Cross-link: serves JTBD-SE-01 (prepare tonight's watchlist) for `presession-preparer` persona.

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
- ~~**Session backfill flow** (SM-22)~~ — **SERVED 2026-08-07** by `SessionLogForm` ("Log past session"), plus edit-any-session from the detail modal.
- **Retroactive all-in adjustment** — the imported sessions carry no hands, so the adjusted rate starts at zero coverage and accrues only from future tracked sessions.
- **Multiway all-in equity** — side-pot equity is declared ineligible rather than approximated.
- **Repeatable spreadsheet import** — the 2026-08-07 import is a one-time seed by founder choice. Sessions logged in the sheet after 5 Aug 2026 need the seed file regrown; the writer is idempotent so re-running is safe.
- **bb/100 normalisation across stakes** — blocked on hand counts, which the imported history does not carry.

---

## Test coverage

- `src/components/views/SessionsView/__tests__/*.test.jsx` — component + handler coverage, incl. `VarianceBand.test.jsx` (19 tests: interval verdicts, modelled stamps, tolerance pills, certain-ruin path, Kelly withholding).
- `src/utils/sessionStats/__tests__/bankrollVariance.test.js` — estimators against hand-worked closed forms, plus an end-to-end block over the real imported sheet.
- `src/utils/sessionStats/__tests__/sheetImport.test.js` — sheet normalisation (year typos, overnight wrap, recovered P&L, idempotent keys).
- `src/utils/persistence/__tests__/sessionsStorage.test.js` — `importHistoricalSessions` idempotency + non-destructiveness.
- `src/components/ui/__tests__/SessionLogForm.test.jsx` — prefill, duration echo incl. midnight wrap, validation, miss-tap guard.
- `src/utils/sessionStats/__tests__/sessionLogFields.test.js` — date/clock/money conversions; blank-vs-zero cash-out.
- `src/utils/handStats/__tests__/allInEquity.test.js` — equity at the all-in street, symmetry of the correction, every ineligibility reason by name.
- Persistence covered in `useSessionPersistence` tests + reducer tests.

## Related surfaces

- `table-view` — primary exit for "Resume / Start New".
- `tournament-view` — exit for tournament sessions.
- `stats-view` — consumes sessions aggregate.
- `hand-replay-view` — drills down into per-hand review from a SessionCard.
- `settings-view` — venue / game-type config that populates SessionForm dropdowns.
- `postflop-drills` (Pre-Session mode) — added 2026-05-19. Inline `Pre-Session Drill` button in the action row routes here with `activeTab='presession'` + `mode='prep'`. Primary daily-prep workflow entry path for `presession-preparer` persona. See `postflop-drills.md` § Pre-Session mode for the destination spec.

---

## Change log

- 2026-04-21 — Created (DCOMP-W0 session 1, Tier A baseline).
- 2026-04-21 — DCOMP-W1-S4: Gate 4 heuristic audit + Gate 5 P0 implementation. `handleDeleteSession` rewritten to deferred-delete toast+undo pattern. F3 (import warning copy) verified and withdrawn.
- 2026-04-21 — **DCOMP-W1 S4–S9 (Gate 5): ALL 6 active SessionsView audit findings SHIPPED** (F3 withdrawn). F1 (S4: deferred-delete Delete Session). F4 (S5: rebuy inputMode=decimal + 44px + "Use $X" preset + undo). F5 (S6: bottom-bar flex container). F6 + F7 (S7: SessionForm dirty-state backdrop guard; Live/Online filter pills with localStorage persistence). F2 (S9: optional tip field on CashOutModal wired through P&L — additive schema, backward-compat). **All findings code-complete. Pending owner visual verification on device.**
- 2026-05-19 — **PSD Gate 4 entry-point** (WS-199 / SPR-092): inline `[Pre-Session Drill]` button added to the primary action row between `[Import]` and `[Backup]`. Persona list extended with `presession-preparer` (sibling of `post-session-chris` per Gate 3 A-R1). JTBD list extended with JTBD-SE-01 (entry path). Key interactions list extended with the launch interaction (one-tap, no modal, routes to `postflop-drills` with `activeTab='presession'` + `mode='prep'` UI hint). Related surfaces section extended with `postflop-drills (Pre-Session mode)` entry. Companion to `postflop-drills.md` § Pre-Session mode + `hand-replay-view.md` overflow-menu addition.
- 2026-06-06 — **Active-session live stats (Sessions View Improvement Phase 4).** `ActiveSessionCard` shows a live elapsed-time ticker ("Playing for 2h 14m", `setInterval` 30s) replacing the static "Started Xm ago"; the card's stat grid stacks single-column on narrow phones (`grid-cols-1 sm:grid-cols-3`). A live running-P&L was intentionally omitted (no live chip-count is tracked — see `../audits/2026-06-06-entry-active-session-stats.md`). Final phase of the 4-phase Sessions View Improvement.
- 2026-06-06 — **List sort/search/grouping + session detail (Sessions View Improvement Phase 3).** Past Sessions header gains a search box (venue/stake/goal), a sort `<select>` (newest / biggest win / longest), and a "By month" grouping toggle (sort + grouping persist to localStorage). Each row gains a "Details" button opening the new `SessionDetailModal` (full stats, venue note, goal/notes, rebuy timeline, and the session's hands → HandReplay). Logic in `sessionsFilter.js` (`sortSessions`/`searchSessions`/`groupSessionsByMonth`); no IDB change (hands lazy-loaded via `getHandsBySessionId`). See `../audits/2026-06-06-entry-sessions-list-detail.md`.
- 2026-06-06 — **Portrait-native fluid layout (responsive addendum).** `SessionsView` dropped `ScaledContainer` / the fixed 1600×720 frame and now renders fluid single-column (capped `max-w-3xl`, vertical scroll) at real sizes; header buttons wrap; the drill CTAs moved from an absolute bottom bar to an inline wrapping row. `SCREEN.SESSIONS` added to `VIEW_TO_ORIENTATION='portrait'` (best-effort lock). `SessionForm` modal sizes responsively (no scale transform). Fixes ~24%-scale illegibility on phone portrait. Owner-requested 2026-06-06. See `../audits/2026-06-06-entry-sessions-settings-portrait.md`.
- 2026-06-06 — **Insights band (Sessions View Improvement Phase 2).** New `InsightsBand` section at the top of the view (after the Online card, before the Review Queue): net P&L, $/hr, win-rate, hands, best/worst tiles + a hand-rolled `BankrollChart` SVG trend + by-stake/by-venue breakdowns. Pure derivation via `src/utils/sessionStats/sessionAnalytics.js` (no IDB change); scopes with the Live/Online/All filter; collapsible (localStorage). The former bottom-left `BankrollDisplay` widget is folded into the band's Net P&L tile and the component + its test were removed. See `../audits/2026-06-06-entry-insights-band.md`.
- 2026-06-06 — **Venue notes (Sessions View Improvement Phase 1).** A past-session row (`SessionCard`) now shows a small note line (📝 icon + muted italic text) under its header when the session's venue has a note. `SessionsView` looks up the note via `useSettings().getVenueNote(session.venue)` and threads it through `SessionRowWithRollup` → `SessionCard` as the `venueNote` prop (both stay pure-prop, no context). The note itself is authored in `settings-view` → Custom Venues. The new-session `SessionForm` shows the same note as a hint under the venue dropdown. See `../audits/2026-06-06-entry-venue-notes.md`. This is Phase 1 of a 4-phase view lift (Phases 2–4: insights band, list sort/search/detail, active-session flow + polish — each gets its own Gate-1 check).
- 2026-08-07 — **Bankroll history import + Bankroll & Variance band** (Gate 1 audit `../audits/2026-08-07-entry-bankroll-variance.md`, GREEN; Gate 2 not triggered). New `VarianceBand` mounted below `InsightsBand`: measured win rate with 70%/95% confidence intervals on the *true* rate, required bankroll at a selectable ruin tolerance, risk of ruin against an entered bankroll, observed vs modelled downswings, and Kelly sizings. Session is the cluster unit and projected figures carry a `modelled` tag, per POKER_THEORY §14.3/§14.4. Companion one-shot import in Settings → Data & About seeds 78 sessions transcribed from the founder's Google Sheet (Nov 2024 → Aug 2026) via a new additive, idempotent `importHistoricalSessions` writer — deliberately NOT the destructive `importAllData` path. P&L is recomputed from buy-in/rebuys/cash-out, which recovers the 9 sessions the sheet left blank and corrects the stated lifetime total from −$6,175 to −$1,693.66. No IndexedDB version bump (additive optional fields only).
- 2026-08-07 — **Session logging that replaces the spreadsheet + all-in EV adjusted win rate** (Gate 1 audit `../audits/2026-08-07-entry-session-logging-adjusted-winrate.md`, GREEN; Gate 2 not triggered). New `SessionLogForm` serves both *Log past session* (header button) and *Edit session* (from `SessionDetailModal`), backed by a new `createCompletedSession` writer that can never produce an active session, and the previously-unwired `updateSession`. Live capture hardened: the active session's start time is editable (and `startTime` added to the auto-save field list, without which the correction was silently lost on reload), and `CashOutModal` takes an optional finish time. New `utils/handStats/allInEquity.js` computes a mechanical all-in EV adjustment — equity at the street the chips went in via `exactComboEquity`, realized share off the finished board, delta `(equity − realized) × pot` less rake — surfaced in `VarianceBand` beside the raw rate, stamped modelled, with coverage always stated. Manual variance tagging was proposed by the founder and **rejected on bias grounds** in favour of the mechanical path. No hand-entry change: `allIn` was already modelled and captured. No IndexedDB version bump.
