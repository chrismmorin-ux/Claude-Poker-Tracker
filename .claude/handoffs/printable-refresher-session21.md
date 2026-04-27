# Session Handoff: printable-refresher-session21
Status: COMPLETE | Written: 2026-04-27

## Backlog Item

**PRF-G5-UI continued — print flow shipped end-to-end.** S18 shipped initial UI; S19 shipped sub-view + modal nav + menu; S20 shipped 3 remaining card templates. S21 ships the print flow: PrintPreview sub-view + PrintControls panel + PrintConfirmationModal + global stylesheet `src/styles/printable-refresher.css`. Owner can now preview, configure, and print laminate cards with batch tracking for staleness diff.

| S21 deliverable | Status |
|---|---|
| `ClassDispatchedTemplate.jsx` (lifted from CardDetail) | DONE |
| `PrintControls.jsx` (4 toggles + W-URC-1 debounced writes) | DONE |
| `PrintPreview.jsx` (WYSIWYG grid via `.print-preview-container`) | DONE |
| `PrintConfirmationModal.jsx` (date + label + W-URC-3 + window.print) | DONE |
| `src/styles/printable-refresher.css` (4 grids × 2 sizes × 2 colors) | DONE |
| `src/constants/runtimeVersions.js` (engine/app version) | DONE |
| `index.jsx` wiring (state + handlers + ternary + Print preview button) | DONE |
| `src/main.jsx` CSS import | DONE |
| `CardDetail.jsx` updated to import lifted dispatcher | DONE |
| Tests (4 new files + 1 extended; ~70 net new) | DONE |
| Bundle-grep CI gate | PASS |
| Playwright visual verification | DONE — caught real bug |
| StalenessBanner / filter expansion / URL routing / PRF-G5-PDF | DEFERRED to S22+ |

## What I Did This Session

4 new component files + 1 stylesheet + 1 constants file + 4 new test files + 1 extended test file + 3 file edits.

**(1) `ClassDispatchedTemplate.jsx` — lifted shared dispatcher.**

Moved the inner `ClassDispatchedTemplate` function from `CardDetail.jsx` (where S20 had it) to its own file. Two consumers (CardDetail + PrintPreview) is the threshold for extraction; preserves single-source-of-truth for the 4-way `switch` dispatch + default placeholder.

**(2) `PrintControls.jsx` — 4 toggle groups (~250 LOC).**

Per `surfaces/printable-refresher.md` §PrintPreview — Page (Letter/A4) / Cards/sheet (12/6/4/1) / Color (auto/bw) / Footer (Lineage on/off + disabled "Personal codex: Phase 2+" with tooltip per AP-PRF-09).

- aria-pressed reflects current state from `refresher.config.printPreferences`.
- ≥44×44 tap targets per H-ML06.
- Writes via `refresher.patchConfig({ printPreferences })` debounced 400ms via pending-patch ref accumulation. Rapid changes within the window collapse into a single W-URC-1 IDB write (e.g., toggling Page → Cards/sheet → Color in <400ms = 1 patchConfig call with all 3 deltas merged).
- **Longhand-only border properties** (`borderWidth/borderStyle/borderColor`) — initially used `border: '1px solid #374151'` shorthand which mixed with the active state's `borderColor: '#6b7280'` longhand, emitting React's "Updating a style property during rerender ... Removing border borderColor" warning on every state toggle. Switched to all-longhand triple in `TOGGLE_BUTTON_STYLE`. Caught by Playwright; not visible in unit tests (jsdom doesn't emit these warnings reliably).
- Surfaces writer rejection (e.g., AP-PRF-09 includeCodex=true) inline as `role="alert"` for 3s before clearing.
- includeCodex toggle is rendered DISABLED with a tooltip per AP-PRF-09 + red line #16 — communicates the future capability without enabling Phase 2+ behavior in Phase 1.

**(3) `PrintPreview.jsx` — WYSIWYG sub-view (~200 LOC).**

- Renders all active cards (`refresher.getActiveCards()`) in `.refresher-print-page[data-cards-per-sheet]` grids inside a `.print-preview-container` wrapper. The container class triggers the `@media print, .print-preview-container { ... }` CSS pattern so the on-screen preview matches printed output exactly.
- Cards chunked into pages of N where N = `cardsPerSheet`. Each page is its own `.refresher-print-page` element with `break-inside: avoid` for clean print pagination.
- Cards rendered via the lifted `ClassDispatchedTemplate` with a memoized `runtime` prop (`{ engineVersion: 'v123', appVersion: 'v123' }` from new `src/constants/runtimeVersions.js`).
- PrintControls panel mounted above the grid; "Send to print dialog →" primary teal button below.
- `handleSendToPrintDialog` builds the W-URC-3 batch context (`cardIds` + `perCardSnapshots` map keyed by cardId → `{ contentHash, version: String(schemaVersion) }`) from a single `activeCards` array — I-WR-6 1:1 cardIds-vs-snapshots contract enforced from one source.
- Empty-state copy + Send-to-dialog button disabled when no active cards.

**(4) `PrintConfirmationModal.jsx` — final confirmation modal (~200 LOC).**

Mirrors SuppressConfirmModal/LineageModal patterns (aria-modal=true, aria-labelledby, Esc + backdrop close, focus trap, ≥44px tap targets) but **without the 2-tap checkbox gate** — printing is a normal owner action; suppress requires friction (R-8.1), print does not.

- Native `<input type="date">` defaulting to today (YYYY-MM-DD via `todayIsoDate()` helper).
- Optional batch-label input (≤120 chars; trimmed; empty-trim coerces to null per W-URC-3 contract).
- Factual reminder copy per CD-1 ("Disable browser headers and footers for best laminate result. If a card is cut off, check the page-size setting.").
- Confirm calls parent's `onConfirm({printedAt, label})` which awaits `recordPrintBatch(payload)` then fires `window.print()` ONLY if the IDB write resolves.
- Re-throws on writer rejection so modal surfaces error inline as `role="alert"` and does NOT auto-close (owner can adjust + retry).
- Date input rejects empty value (Confirm button disabled if blank).

**(5) `src/styles/printable-refresher.css` — global stylesheet (~150 LOC).**

Imported via `src/main.jsx` between `index.css` and dev seeders. Defines:

- `@page { size: letter; margin: 0.4in; }` default.
- `.refresher-print-page[data-cards-per-sheet="12|6|4|1"]` CSS Grid templates (3×4 / 2×3 / 2×2 / 1×1) with row heights tuned to Letter usable area (2.25in / 3.25in / 4.875in / 10in).
- `body[data-page-size="a4"]` variant compresses row heights for A4's 11.69in page.
- `[data-color-mode="bw"]` applies `filter: grayscale(100%)` on the WYSIWYG container + cards under `@media print`.
- `[data-include-lineage="off"]` hides `.refresher-card-region-4-5` + `.refresher-exceptions-audit-id`.
- `@media print { body > #root > *:not(.print-preview-host) { display: none !important; } }` hides app chrome during print so only the print preview prints.
- `.refresher-print-page { page-break-after: always; break-after: page }` with `:last-child { auto }` for clean N-page output.

**(6) `src/constants/runtimeVersions.js` — tiny constants file.**

`ENGINE_VERSION = 'v123'` + `APP_VERSION = 'v123'`, co-versioned with `Architecture (v123)` in CLAUDE.md. Used by PrintPreview's `runtime` prop and by PrintConfirmationModal's W-URC-3 payload. Replaces the `unknown-engine` / `unknown-app` fallbacks from `lineage.js`.

**(7) `PrintableRefresherView/index.jsx` MODIFIED.**

- Added `[showPrintPreview, setShowPrintPreview]` + `[pendingPrintConfirm, setPendingPrintConfirm]` state slots.
- 5 new handlers: `handleOpenPrintPreview` / `handleClosePrintPreview` / `handleRequestPrintConfirm(batchContext)` / `handlePrintCancel` / `handlePrintConfirm({printedAt, label})` async with W-URC-3 payload + `window.print()` sequence + re-throw on error.
- Ternary render extended `showPrintPreview ? PrintPreview : selectedCard ? CardDetail : CardCatalog`.
- PrintConfirmationModal rendered as overlay when `pendingPrintConfirm` non-null.
- Existing footer placeholder ("Print preview and batch print will land in Session 20+") replaced with a "Print preview →" entry-point button (teal primary; only visible in catalog mode).
- "Showing N of M" status hidden when in print-preview view.

**(8) `src/main.jsx` MODIFIED.**

Added `import './styles/printable-refresher.css'` after `index.css`.

**(9) `CardDetail.jsx` MODIFIED.**

- Replaced inner `ClassDispatchedTemplate` function definition with a top-of-file `import { ClassDispatchedTemplate } from './ClassDispatchedTemplate'`.
- Deleted 4 redundant template imports (now internal to the lifted file).

**(10) Tests (4 new files + 1 extended; ~70 net new tests).**

- `ClassDispatchedTemplate.test.jsx` (7 tests): all 4 valid classes route correctly / unknown class falls to default placeholder / null manifest returns null / runtime + compact props pass through.
- `PrintControls.test.jsx` (18 tests): renders 4 toggle groups + all option buttons + aria-pressed reflects state + disabled includeCodex with tooltip + clicking each option schedules `patchConfig` with the right payload after 400ms debounce + rapid changes collapse into a single call (delta-merged via pendingPatchRef) + clicking disabled codex no-ops + writer rejection surfaces inline as role=alert + ≥44px tap targets.
- `PrintPreview.test.jsx` (16 tests): heading + back button + summary + PrintControls panel + WYSIWYG wrapper + grid pages count + 14-card multi-page chunk + cards via dispatched template + grid `data-cards-per-sheet` attr + container `data-page-size` + `data-color-mode` + `data-include-lineage` attrs + 4-up reflow + empty-state + Send-to-dialog-disabled-empty + onBack handler + `onRequestPrintConfirm` payload (cardIds + cardCount + pageCount + pageSize + cardsPerSheet + colorMode) + perCardSnapshots map shape + I-WR-6 1:1 cardIds-vs-snapshots contract.
- `PrintConfirmationModal.test.jsx` (23 tests): title + summary + singular/plural for 1-card/1-page + date input today default + optional label placeholder + factual reminder copy + Cancel/Confirm buttons + Confirm enabled by default (no checkbox gate) + aria-modal/aria-labelledby + ≥44px tap targets on buttons + minHeight on date/label inputs + Cancel/Esc/backdrop-click fire onCancel + click-inside-dialog does NOT close + label/date input edit + Confirm calls onConfirm with `{printedAt, label}` + label whitespace-trimmed-to-null when empty + onConfirm rejection surfaces error inline + "Recording…" submit state + Confirm disabled when printedAt empty + null-context fallback to 0/0.
- `PrintableRefresherView.test.jsx` extended (+6 tests; replaced 1 footer-placeholder assertion): "Print preview →" entry-point + opens PrintPreview / Back returns to catalog / "Send to print dialog →" opens PrintConfirmationModal / Cancel returns to PrintPreview without firing recordPrintBatch / "Showing N of M" hidden in print-preview / entry-point hidden in print-preview.

**Total S21: 215/215 view tests green across 14 files (was 145/10 at S20 baseline; +70 tests / +4 files); full PRF + persistence + reducer + hooks + context + UI scope 784/784 green across 30 test files** in isolation.

**(11) CI gate + Visual verification.**

- `bash scripts/check-refresher-bundle.sh` → ✅ PASS. No html2canvas / jspdf / pdf-lib in PRF namespace.
- Playwright visual verification (mandatory per session memory of S19 finding 2 browser-only bugs):
  1. Loaded `#printableRefresher` → catalog renders 6 math cards.
  2. Clicked "Print preview →" → PrintPreview renders with 6 cards · 1 page on 12-up Letter Color (auto).
  3. Toggled to 4-up → grid reflows to 6 cards · 2 pages.
  4. Clicked "Send to print dialog →" → PrintConfirmationModal opens with summary "6 cards across 2 pages on Letter at 4-up (Color (auto))" + today's date prefilled + optional label + factual reminders + enabled Confirm button.
  5. Pressed Esc → modal closes back to PrintPreview.
- **Zero console errors throughout the full flow** (after the borderColor fix below).
- **Real browser-runtime bug caught + fixed:** PrintControls' toggle buttons initially used `border: '1px solid #374151'` shorthand mixed with `borderColor: '#6b7280'` longhand in the active-state override. React emitted "Updating a style property during rerender ... Removing border borderColor" warnings on every state toggle. Fixed by switching to all-longhand `borderWidth/borderStyle/borderColor` triple in `TOGGLE_BUTTON_STYLE`. Verified clean in fresh-tab reload after the fix.

**(12) Governance.**

- BACKLOG row PRF-G5-UI: status flipped from "S18+S19+S20 shipped 2026-04-27" → "S18+S19+S20+S21 shipped 2026-04-27"; S21 deliverable detail appended.
- STATUS top entry: replaced with PRF S21 entry; previous EAL S17 entry demoted to "Prior update" line. Top-entry succession: EAL S14 → PRF S20 → EAL S15 → EAL S16 → EAL S17 → PRF S21 (this entry).
- This handoff written.

## Files I Own (DO NOT EDIT)

*Session is COMPLETE.* No file lock needed.

## Uncommitted Changes (after S21)

Created in this session:
- `src/components/views/PrintableRefresherView/ClassDispatchedTemplate.jsx`
- `src/components/views/PrintableRefresherView/PrintControls.jsx`
- `src/components/views/PrintableRefresherView/PrintPreview.jsx`
- `src/components/views/PrintableRefresherView/PrintConfirmationModal.jsx`
- `src/components/views/PrintableRefresherView/__tests__/ClassDispatchedTemplate.test.jsx`
- `src/components/views/PrintableRefresherView/__tests__/PrintControls.test.jsx`
- `src/components/views/PrintableRefresherView/__tests__/PrintPreview.test.jsx`
- `src/components/views/PrintableRefresherView/__tests__/PrintConfirmationModal.test.jsx`
- `src/styles/printable-refresher.css`
- `src/constants/runtimeVersions.js`
- `.claude/handoffs/printable-refresher-session21.md` (this file)

Modified in this session:
- `src/components/views/PrintableRefresherView/CardDetail.jsx` (import lifted dispatcher; deleted 4 template imports + inner function)
- `src/components/views/PrintableRefresherView/index.jsx` (state + handlers + ternary + footer button)
- `src/components/views/PrintableRefresherView/__tests__/PrintableRefresherView.test.jsx` (+6 tests; replaced footer assertion)
- `src/main.jsx` (1 CSS import)
- `.claude/BACKLOG.md` (PRF-G5-UI row status + S21 deliverable detail)
- `.claude/STATUS.md` (top entry replaced; EAL S17 demoted to Prior update)

Untracked (gitignored — `*.png` rule):
- `prf-s21-catalog.png`, `prf-s21-print-preview.png`, `prf-s21-print-confirm-modal.png` (Playwright screenshots)

**NOT modified:**
- All other PRF infrastructure (CI / MIG / SL / ST / WR / HK / RL / RI / DS / LG / AppRoot / writers / lineage / cardRegistry / refresherSelectors) — stable.
- 6 Phase B math manifests — stable.
- 4 card templates (`MathCardTemplate.jsx` / `PreflopCardTemplate.jsx` / `EquityCardTemplate.jsx` / `ExceptionsCardTemplate.jsx`) — stable. They're now imported by `ClassDispatchedTemplate.jsx` instead of `CardDetail.jsx` directly.
- `LineageModal.jsx` / `SuppressConfirmModal.jsx` / `CardCatalog.jsx` / `CardRow.jsx` — stable.
- `RefresherProvider` / `useRefresher` / writers / W-URC-3 — stable.
- `PokerTracker.jsx` / `AppProviders.jsx` / `useAppState.js` / `contexts/index.js` — owned by parallel EAL sessions; untouched.
- `CollapsibleSidebar.jsx` — S19 left it complete; untouched.
- `SYSTEM_MODEL.md` — defer until S22+ since the print-flow architecture is now fully shipped and S22 work is smaller.

## What's Next

**S22 — owner priority pick.** Per backlog row, the deferred items are:

(a) **StalenessBanner** — top-of-catalog count when `staleCardIds.size > 0`. The `getStaleCards()` selector already exposes the data; quickest follow-up.

(b) **Filter expansion** — phases + tiers in addition to classes. `useRefresherView.filter` already supports them in state shape; just needs UI chips beyond the existing 4 class filters.

(c) **URL routing for sub-views** — `#printableRefresher/card/PRF-X` deep-links open CardDetail; same pattern for `/print-preview`. Currently sub-view nav is component-state-based; would extend `HASH_TO_SCREEN` parsing in `PokerTracker.jsx` to support multi-segment hashes.

(d) **PRF-G5-PDF — Playwright cross-browser snapshots** — 4 grid × 2 page × 2 color = 16 per card × 6 math cards = 96-snapshot baseline. **Now unblocked by S21** (PrintPreview is the snapshot target).

(e) **PRF-G5-A — Phase A preflop card authoring** — Q5 differentiation demo first; gated on Q5 Gate 4 review verdict.

(f) **PRF-G5-C — Phase C equity + exceptions card authoring** — per-card Voice-3-equivalent fidelity review at PR time. Requires bucket-definition glossary + POKER_THEORY §9 audit-ids.

**Suggested order**: (a) is the smallest follow-up and adds owner-visible value (stale count surfaces a print-refresh trigger). (d) is naturally next since S21's PrintPreview is the snapshot target. (b)+(c) are smaller polish work. (e)+(f) require manifest authoring + design-side gates.

## Gotchas / Context

1. **Playwright caught a real React rerender warning that unit tests missed.** PrintControls' inline-style toggle buttons mixed `border` shorthand (in base style) with `borderColor` longhand (in active-state override). React's stricter dev warnings flag this as a "Updating a style property during rerender ... Removing border borderColor" warning. Fix: use longhand-only `borderWidth/borderStyle/borderColor` triple in the base style. **Future inline-style toggles that change `borderColor` should follow this pattern.** Don't mix `border` shorthand with longhand overrides.

2. **`window.print()` fires AFTER `await recordPrintBatch(payload)` resolves.** If the IDB write throws (e.g., I-WR-6 perCardSnapshots completeness violation), the modal surfaces the error inline and `window.print()` does NOT fire. The writer promise is the sequencing guarantee. Owner sees the failure before any browser dialog appears.

3. **Lifted ClassDispatchedTemplate is the canonical dispatcher.** CardDetail now imports it; PrintPreview also imports it. Future surfaces that render cards (e.g., AnchorLibraryView reusing card visuals, FavoritePicker, etc.) should also import it rather than re-implementing the switch.

4. **WYSIWYG selector pattern requires duplication.** CSS doesn't allow combining `@media print` + `.print-preview-container` in a single selector, so the rule bodies are duplicated. The duplication is intentional and small (~80 LOC of the stylesheet); the alternative (post-processing CSS to mirror rules into both contexts) would be over-engineering. Keep them in sync manually when adding new print rules.

5. **printPreferences are IDB-persisted via W-URC-1.** Distinct from `useRefresherView` (filter/sort) which is localStorage-only UI state. Print prefs survive cross-device sync; filter/sort are device-local only. This is per the architecture set up at PRF-G5-WR.

6. **Native `<input type="date">` was the right call.** Galaxy A22 1600×720 mobile target gets the native picker; no library needed; the value shape (YYYY-MM-DD) is exactly what we need to convert to ISO 8601 for W-URC-3 (`${printedAt}T00:00:00Z`).

7. **engineVersion + appVersion are co-versioned at `'v123'`.** Bump `src/constants/runtimeVersions.js` when:
   - Engine algorithm changes (gameTree, exploitEngine, rangeEngine, weaknessDetector).
   - App architecture changes meaningfully (state shape, persistence schema).
   Stale-printed-card detection uses `contentHash` (not version), so bumping these does NOT mark prior prints as stale on its own — only the lineage footer string changes. (Updated CLAUDE.md previously had `Architecture (v123)`; my constants match.)

8. **Pending-patch ref accumulator pattern (mirror of EAL S15's `useAnchorObservationDraft`).** When 3 toggles fire within the 400ms debounce window, the pending payload is merged in a `pendingPatchRef` and dispatched as a single `patchConfig({ printPreferences: { pageSize, cardsPerSheet, colorMode } })` call, not 3 sequential calls. Avoids racing 3 separate IDB writes. Adopt this pattern wherever rapid UI toggles need debounced persistence.

9. **3 Playwright PNG screenshots** saved to repo root (`prf-s21-catalog.png`, `prf-s21-print-preview.png`, `prf-s21-print-confirm-modal.png`). Gitignored via `*.png` rule; they're for owner record but not committed.

10. **S22 owner priority is open.** Recommended (a) StalenessBanner first since it's smallest + (d) PRF-G5-PDF next since S21 unblocks it. (b)+(c) are polish. (e)+(f) require manifest authoring outside PRF-G5-UI scope.

11. **Parallel-session coordination.** S21 owned `PrintableRefresherView/*` + `src/styles/printable-refresher.css` + `src/constants/runtimeVersions.js` + `src/main.jsx` (1 import line). EAL S15/S16/S17 ran in parallel and ship in `src/hooks/`, `src/contexts/`, `src/components/views/HandReplayView/`. Zero file conflicts. Top-entry succession on STATUS: EAL S14 → PRF S20 → EAL S15 → EAL S16 → EAL S17 → PRF S21 (this entry).

## System Model Updates Needed

Defer until S22+ ships StalenessBanner or filter expansion. The print-flow architecture is now stable; templates + dispatcher + CSS strategy are documented in surface specs and the BACKLOG row. The §1 Component Map should grow at S22+ to include:

- PrintPreview / PrintControls / PrintConfirmationModal as sub-views of PrintableRefresherView.
- ClassDispatchedTemplate as a shared util used by CardDetail + PrintPreview.
- Global stylesheet `src/styles/printable-refresher.css` as a new top-level CSS asset.
- runtimeVersions.js as a shared constant module.

## Test Status

S21 net-add: **~70 new tests across 4 new test files + 6 net new in extended `PrintableRefresherView.test.jsx`.**

PRF view scope: **215/215 green across 14 test files** (was 145/10 at S20 baseline; +70 / +4).

Full PRF + persistence + reducer + hooks + context + UI scope: **784/784 green across 30 test files** in isolation.

CI bundle-grep gate: **PASS** — no html2canvas / jspdf / pdf-lib in PRF namespace.

Cumulative scaling validation:
- S15 (1 manifest, no UI): 399 tests / 19 files.
- S16 (4 manifests): 528 tests / 19 files.
- S17 (6 manifests): 614 tests / 19 files.
- S18 (6 manifests + 4 UI files): 662 tests / 23 files.
- S19 (6 manifests + 7 UI files): 710 tests / 26 files.
- S20 (6 manifests + 10 UI files): 714 tests / 26 files.
- S21 (6 manifests + 14 UI files + global stylesheet + runtimeVersions): 784 tests / 30 files.

Full smart-test-runner not run this session — modifications are scoped entirely to `PrintableRefresherView/*` + `src/styles/printable-refresher.css` + `src/constants/runtimeVersions.js` + 1-line import in `src/main.jsx`. The known precisionAudit flake + parallel-MPMF-G5-B2 + parallel-EAL-migration test situations remain unchanged. Zero new regressions from S21.

## Visual Verification (Playwright)

Full flow exercised end-to-end:

1. ✅ Catalog renders 6 math cards with the new "Print preview →" footer button.
2. ✅ Clicking "Print preview →" opens PrintPreview sub-view.
3. ✅ PrintControls panel shows Letter / 12-up / Color (auto) / Lineage on as defaults; aria-pressed correctly reflects state.
4. ✅ All 6 math cards render in the WYSIWYG container with full 7-field lineage footers showing real `engine v123 / app v123` values (no `unknown-engine`/`unknown-app` fallback).
5. ✅ Toggling 4-up reflows to 2 pages; preference persists to IDB and survives reload.
6. ✅ "Send to print dialog →" opens PrintConfirmationModal with batch summary, today's date prefilled, optional label, factual reminders, enabled Confirm.
7. ✅ Esc closes the modal back to PrintPreview without firing `window.print()`.
8. ✅ **Zero console errors throughout** (after fixing the borderColor warning).

Real browser-runtime bug caught by Playwright: PrintControls borderColor mixing — fixed via longhand-only triple. Unit tests didn't catch this because jsdom doesn't emit React's stricter rerender warnings reliably.
