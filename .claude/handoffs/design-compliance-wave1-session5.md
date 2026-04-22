# Handoff — Design Compliance Wave 1 Session 5 (Destructive-Action Completion Batch)

**Session:** 2026-04-21
**Owner this session:** Claude (main)
**Project:** `.claude/projects/design-compliance.md` → DCOMP-W1
**Plan:** `C:\Users\chris\.claude\plans\twinkling-seeking-valiant.md` (Session 5 of 6)
**Status:** CLOSED — 3 P2 findings shipped across ShowdownView + SessionsView. Pattern now applied to every identified destructive-action path in Wave-1 core surfaces.

---

## Scope delivered

Per the approved plan: extend the S4 toast+undo pattern to the remaining destructive actions. Three findings, three files, one unified semantic.

### Code changes (5 source files + 2 test files)

**`src/hooks/useShowdownHandlers.js`** — SDV-F3 + SDV-F4
- Added `clearCardsUndoRef` + `wonSeatUndoRef` alongside the existing `nextHandUndoRef`.
- `handleClearShowdownCards` rewritten: snapshot `{communityCards, holeCards, allPlayerCards, holeCardsVisible, actionSequence}`, clear, 12s warning toast with Undo that HYDRATE_STATEs both reducers. Guarded on `hadCards && addToast` for backward compat.
- `handleWonSeat` rewritten: captures `actionSequence` pre-write, records WON + MUCKED, 12s success toast ("Seat N won (M others mucked)") with Undo that HYDRATE_STATEs `actionSequence`. Only fires toast when `remaining.length > 0`.

**`src/components/views/ShowdownView/ShowdownHeader.jsx`** — SDV-F3
- Clear Cards button now gated on `showdownMode !== 'quick'`. Comment documents the Full-Mode-utility rationale.

**`src/components/views/ShowdownView/ShowdownSeatRow.jsx`** — SDV-F4
- New optional prop `wonAutoMuckCount`.
- Won button in Quick Mode renders a passive "mucks N others" sub-label (font 10px, opacity 0.9) when `wonAutoMuckCount >= 2` — below threshold the Won button is unchanged. Matches the preview-before-commit pattern from TV-F2 orbit-strip badges.

**`src/components/views/ShowdownView/ShowdownView.jsx`** — SDV-F4
- Added `activeShowdownSeatCount` `useMemo` computing the number of still-active showdown seats (mirrors the scope computation inside `handleWonSeat`). Threaded as `wonAutoMuckCount={Math.max(0, activeShowdownSeatCount - 1)}` into each Quick-Mode SeatRow.

**`src/components/views/SessionsView/ActiveSessionCard.jsx`** — SV-F4
- Imported `useToast` + `UNDO_TOAST_DURATION_MS = 12000`.
- New `commitRebuy(amount)` helper: snapshots prior `rebuyTransactions`, appends new, shows 12s success toast with Undo that reverts via `onUpdateField`.
- `handleConfirmRebuy` now delegates to `commitRebuy`.
- New `handlePresetRebuy` uses `getDefaultRebuyAmount(gameType)` to commit a default rebuy with zero keyboard entry.
- Rebuy input: `type="number"` → `type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*"` (compact numeric keypad; H-ML03).
- All four rebuy buttons (+Add, preset, Confirm, Cancel): `minHeight: 44px` (H-ML06).

### Test changes (2 files)

**`src/components/views/ShowdownView/__tests__/ShowdownHeader.test.jsx`**
- 3 existing tests now pass `showdownMode="full"` explicitly (Clear Cards hidden in Quick Mode post-F3).
- New positive-coverage test: "hides Clear Cards button in quick mode (SDV-F3)".

**`src/components/views/SessionsView/__tests__/ActiveSessionCard.test.jsx`**
- `lucide-react` mock extended with `X, AlertCircle, CheckCircle, Info, AlertTriangle` (Toast.jsx transitive imports).
- Added `vi.mock('../../../../contexts/ToastContext', ...)` returning stub `useToast` — allows unit tests to render without wrapping in `ToastProvider`.
- 3 rebuy tests migrated from `getByRole('spinbutton')` → `getByRole('textbox')` after input type switch.

## Tests

- **SessionsView + ShowdownView + hooks:** 215/215 passing (9 files).
- Pre-existing `precisionAudit.test.js` stochastic failure remains unrelated.

## Why the three variants matter

Different state models call for different undo semantics:
- **SDV-F3 / SDV-F4:** reducer state → HYDRATE_STATE undo (pure-state restore, no IDB touch).
- **SV-F4:** parent-controlled `rebuyTransactions` → optimistic append + undo-via-prior-snapshot (passes prior array back through `onUpdateField`).
- **SV-F1 (S4):** IDB row delete → deferred-delete (defer the IDB write until the undo window closes).

All three produce the same user-visible experience (12s toast with Undo, single unified duration) but honor the underlying data model. The 12000ms constant is defined in CommandStrip, useShowdownHandlers, SessionsView, ActiveSessionCard — four constants with identical values. Fair candidate for future consolidation into a shared constant module; not in scope this session.

## Visual verification pending

Playwright MCP still unavailable. Owner must verify:

| Finding | Check |
|---|---|
| SDV-F3 | Full Mode: Clear Cards visible → tap → warning toast with Undo restores cards + action sequence. Quick Mode: Clear Cards absent. |
| SDV-F4 | 5-way Quick Mode: each Won button shows "mucks 4 others" sub-label. Tap → success toast with Undo reverts WON+MUCKED batch. Heads-up: no sub-label (threshold 2). |
| SV-F4 | "+ Add Rebuy" → "Use $X" preset button above input (commits with 0 taps in input). Numeric keypad on typed input (Android). Confirm button visibly larger. Undo toast restores prior rebuy list. |

## What comes next

Plan Session 6: Layout + visual separation + touch-target batch (S × 4) — SDV-F2, SDV-F5, SV-F5, TV-F8. All pure layout/CSS; needs owner visual verification on reference + narrow viewport.

Then S7 (polish + rename), S8 (TV-F7 orbit wrap), S9 (SV-F2 tip field), S10 (verification sweep + W1 close).

## Closed

4 tasks completed. Wave-1 destructive-action surface area is now fully covered by the toast+undo pattern.
