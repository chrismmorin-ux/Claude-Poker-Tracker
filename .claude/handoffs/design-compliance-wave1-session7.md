# Handoff — Design Compliance Wave 1 Session 7 (Minor Polish + Dev-Clarity Batch)

**Session:** 2026-04-21
**Owner this session:** Claude (main)
**Project:** `.claude/projects/design-compliance.md` → DCOMP-W1
**Plan:** `C:\Users\chris\.claude\plans\twinkling-seeking-valiant.md` (Session 7)
**Status:** CLOSED — 8 XS/S findings shipped. Long-tail polish complete. ShowdownView audit fully closed.

---

## Scope delivered

The largest batch of the wave: 8 findings, 9 files, one test file update + rename. All independent.

### Code changes (9 source files)

**TableView surface:**
- **`SeatContextMenu.jsx`** (TV-F6) — RecentPlayersSection gains a "N players" count sub-label + conditional bottom-fade gradient when overflow is imminent (>8 rows). Scrollability becomes visible.
- **`src/components/ui/PotDisplay.jsx`** (TV-F9) — Single-tap → "Long-press to correct" hint (1.5s). 400ms long-press → edit mode. Input: `type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*"`. Compact numeric keypad on Android. First adopter of the inputMode=decimal pattern on the felt — reference cite for future numeric inputs.
- **`src/contexts/OnlineAnalysisContext.jsx`** (TV-F11) — Canonical `useAnalysisContext` + deprecated alias `useOnlineAnalysisContext = useAnalysisContext`. Error message reflects canonical name.
- **`src/contexts/index.js`** (TV-F11) — Re-exports both names.
- **`CommandStrip.jsx`**, **`OnlineView.jsx`**, **`ExtensionPanel.jsx`** (TV-F11) — 3 internal imports migrated.
- **`TableView.jsx`** (TV-F12) — `lastRangeDetailSeatRef` + `handleOpenRangeDetail`/`handleCloseRangeDetail`/`reopenLastRangeDetail`. Fixed-bottom-left "↻ Reopen range (S{N})" button when panel is closed and a seat was previously viewed.

**ShowdownView surface:**
- **`ActionHistoryGrid.jsx`** (SDV-F6) — Dead Labels buttons removed. Plain "Seat N" column headers.
- **`ShowdownView.jsx`** (SDV-F7) — Amber info banner "Hand rankings require all 5 board cards to be entered" when summary-mode `rankings.length === 0`.

**SessionsView surface:**
- **`src/components/ui/SessionForm.jsx`** (SV-F6) — `isDirty` derived from venue/gameType/buyIn/goal/customGoal/notes divergence. `handleBackdropClick` ignores backdrop taps when dirty. Explicit × button unaffected.
- **`SessionsView.jsx`** (SV-F7) — `pastSessionFilter` state (initialized from localStorage). All/Live/Online filter pills in past-sessions header, shown only when `onlineCount > 0`. In-memory filter; persists on change.

### Test changes (2 files)

- **`src/contexts/__tests__/OnlineAnalysisContext.test.jsx`** — error message expectation updated to canonical `useAnalysisContext` name; doc comment explains the alias-still-throws-canonical-name behavior.
- **`src/components/views/ShowdownView/__tests__/ActionHistoryGrid.test.jsx`** — "renders Labels buttons for all 9 seats" rewritten as "renders Seat N column headers for all 9 seats (SDV-F6)" with per-seat iteration.

## Tests

- **S7-affected subtrees:** 280/280 passing (13 test files across TableView, ShowdownView, SessionsView, OnlineView, contexts).
- **Full suite:** ran after rename. 1 pre-existing failure (`precisionAudit.test.js` stochastic Monte Carlo test); unrelated, documented in prior handoffs.

## Pattern + infrastructure added

- **First `inputMode="decimal"` adopter.** PotDisplay is the new reference cite for other numeric inputs. TV-F9's comment explicitly flags it as such.
- **Canonical-name + deprecated-alias rename pattern.** TV-F11 established the "rename in place, keep alias for grace period" approach. Future hook/context renames should follow.
- **First `localStorage`-persisted UI filter.** SV-F7 uses localStorage under `sessionsView.pastFilter`. Future filter preferences should mirror the try/catch-guarded pattern.

## Visual verification pending

Playwright MCP still unavailable. Owner checklist spans 8 findings (see EVID-2026-04-21-W1-S7-BATCH for the full list).

## What comes next

Per plan, **2 findings remain on Wave 1:**
- **S8: TV-F7** — Orbit strip wrap-layout (M effort). The last layout change on TableView with real visual-verification risk. Replaces `overflow-x-auto` with a wrapping grid; must preserve the F2 preview-count badges.
- **S9: SV-F2** — Optional tip field on CashOutModal + wire through P&L (M effort, P1). Additive schema change on Session record.

After S8 and S9 ship, **S10 = DCOMP-W1 close** — owner visual verification sweep + mark COMPLETE in backlog.

## Closed

7 tasks completed. DCOMP-W1 is 15 of 17 findings done. Only the two M-effort items remain, each scheduled as its own session per plan.
