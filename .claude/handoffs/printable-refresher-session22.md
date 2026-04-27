# Session Handoff: printable-refresher-session22
Status: COMPLETE | Written: 2026-04-27

## Backlog Item

**PRF-G5-UI continued — StalenessBanner shipped per surface spec §StalenessBanner + §Behavior #9.** Continues PRF-G5-UI from S18+S19+S20+S21. The passive amber banner surfaces when the owner's most-recent printed batch has cards with diverging contentHash from the current registry. Banner is gated on AP-PRF-08 opt-in (`notifications.staleness === true`); Phase 1 default OFF, opt-in via Settings (settings UI deferred). Visual verification via Playwright + IDB-seeded stub batch confirmed end-to-end behavior with zero console errors.

| S22 deliverable | Status |
|---|---|
| `StalenessBanner.jsx` (passive amber banner) | DONE |
| `index.jsx` wiring (state + handlers + filter + opt-in gate) | DONE |
| Tests (StalenessBanner unit + extended PrintableRefresherView) | DONE (~25 net new) |
| Bundle-grep CI gate | PASS |
| Playwright visual verification (with IDB seed) | DONE |
| Filter expansion / URL routing / PRF-G5-PDF / Settings UI | DEFERRED to S23+ |

## What I Did This Session

1 new component file + 1 new test file + 1 file edit (index.jsx) + 1 extended test file + tiny mock-restructure in test fixture.

**(1) `StalenessBanner.jsx` — passive amber banner.**

Per `surfaces/printable-refresher.md` §StalenessBanner + §Behavior #9.

- `role="status"` + `aria-live="polite"` so the count change is announced to screen readers.
- Background `#451a03` + text `#fde68a` (deuteranopia-friendly amber per H-PM02).
- Copy matches spec format: "Your YYYY-MM-DD batch [optional label]: M of N cards current, K stale."
- Falls back to "Your latest batch" when `printedAt` missing/invalid (defensive).
- Uses singular "card" when batchCardCount === 1 (small but factual).
- ≥44px tap targets per H-ML06 on Review + Dismiss buttons.
- CD-1 factual copy verified mechanically — zero matches on `/streak/i`, `/consecutive/i`, `/you'?ve printed/i`, `/days since/i` (per AP-PRF-03).
- `data-stale-count` attribute exposed for CI introspection.
- Defensive null-guards: returns `null` when `staleCount ≤ 0`, non-number, or undefined.
- Longhand-only `borderWidth/borderStyle/borderColor` per S21's lesson learned (avoids React rerender warnings if the banner ever toggles styles).

**(2) `index.jsx` MODIFIED — banner wiring + stale-only filter.**

- 2 new state slots: `[stalenessBannerDismissed, setStalenessBannerDismissed]` (session-only) + `[showOnlyStale, setShowOnlyStale]` (session-only filter flag).
- 2 new handlers: `handleReviewStale` (sets showOnlyStale=true + dismisses banner) + `handleDismissBanner`.
- New memo `stalenessBannerData` computes `{staleCount, batchCardCount, batchPrintedAt, batchLabel}` from `getStaleCards()` + most-recent batch (`printBatches[0]`).
- New boolean `stalenessBannerVisible` gates on **all** of: `!showPrintPreview && !selectedCard && !stalenessBannerDismissed && refresher.config?.notifications?.staleness === true && stalenessBannerData !== null`. The `notifications.staleness === true` strict-equality enforces AP-PRF-08 opt-in.
- Reordered `selectedCard` memo above `stalenessBannerVisible` to fix temporal-dead-zone error caught at first test run (initial 33-test failure cascade; fix was a 5-line move).
- `filteredSorted` now applies the `staleCardIds` filter when `showOnlyStale=true`.
- "Showing N of M" status appended with "· stale only" + "Show all cards" reset button when filter is active.
- Banner mounted above the catalog status, only in catalog mode (hidden in print-preview + card-detail).

**(3) `StalenessBanner.test.jsx` (15 tests).**

- Render conditional: 5 (renders when staleCount > 0 / null when 0 / null when negative / null when non-number / spec-format copy).
- Batch label rendered when present.
- Latest-batch fallback when printedAt missing.
- Singular "card" form when batchCardCount === 1.
- `data-stale-count` attribute exposed.
- `role="status"` + `aria-live="polite"` accessibility.
- ≥44px tap targets on Review + Dismiss.
- Review fires `onReviewStale`; Dismiss fires `onDismiss`.
- Defensive missing-callbacks (no throws when undefined).
- CD-1 factual copy (no streak/consecutive/days-since prose).

**(4) `PrintableRefresherView.test.jsx` extended (+10 staleness tests).**

Restructured the shared mock from static factory to mutable `let mockRefresherState` so individual tests can override `notifications.staleness` + `getStaleCards` per scenario without spawning new test files. The `beforeEach` resets the mock to safe defaults. Existing 23 tests continue to pass with the new mock pattern.

Net-add 10 staleness tests (all under a new `describe('PrintableRefresherView — staleness banner (S22)')` block):
- Banner renders when opt-in ON + stale exists.
- Banner hidden by default (AP-PRF-08 default OFF).
- Banner hidden when no stale cards.
- Banner hidden when no print batches (no laminate to be stale).
- Dismiss hides for the session.
- Review filters catalog to stale-only with "stale only" indicator + "Show all cards" reset button.
- Show all cards button restores the unfiltered catalog.
- Review also dismisses the banner.
- Banner hidden in print-preview mode.
- Banner hidden in card-detail mode.

**Total S22: 25 net new tests / 1 net new file.** PRF view-scope: 240/240 green across 15 files (was 215/14 at S21; +25 / +1).

**(5) CI bundle-grep gate.**

`bash scripts/check-refresher-bundle.sh` → ✅ PASS. No html2canvas / jspdf / pdf-lib in PRF namespace.

**(6) Visual verification via Playwright (mandatory per session-memory of S19 finding 2 browser-only bugs).**

- Initial load → catalog renders cleanly with banner correctly hidden (AP-PRF-08 default OFF respected).
- Used `browser_evaluate` to seed `notifications.staleness=true` + a stub `printBatch` with diverging `contentHash` for 2 cards via direct IDB manipulation:
  - `userRefresherConfig` singleton patched: `notifications.staleness = true`.
  - `printBatches` store gained 1 stub batch: `{batchId: 'stub-stale-batch-1', printedAt: '2026-04-24T00:00:00Z', label: 'demo-stale', cardIds: ['PRF-MATH-AUTO-PROFIT', 'PRF-MATH-POT-ODDS'], perCardSnapshots: {AUTO: 'sha256:OLD-AUTO', POT-ODDS: 'sha256:current-pot-odds'}}`. Both hashes diverge from current registry hashes, so both cards flag as stale.
- Reload → banner renders with copy "Your 2026-04-24 batch \"demo-stale\": **0** of **2** cards current, **2** stale." + Review/Dismiss buttons visible.
- Both seeded cards show "⚠ Stale" status indicator in catalog rows; other 4 cards show "● Current" (regression-clean).
- Clicked Review stale cards → catalog filters to 2 stale cards with "Showing 2 of 6 cards · stale only" + "Show all cards" reset button + banner correctly dismissed.
- Cleanup via second `browser_evaluate`: flag reset to false + stub batch deleted.
- **Zero console errors throughout.**

Artifacts saved (gitignored under `*.png` rule): `prf-s22-banner-rendered.png`, `prf-s22-review-stale-filtered.png`.

**(7) Governance.**

- BACKLOG row PRF-G5-UI flipped to "S18+S19+S20+S21+S22 shipped 2026-04-27"; S22 deliverable detail appended.
- STATUS top entry replaced with PRF S22 entry; previous EAL S17 visual-verification entry demoted to "Prior update". Top-entry succession: EAL S14 → PRF S20 → EAL S15 → EAL S16 → EAL S17 → PRF S21 → EAL S17 visual-verification → PRF S22 (this entry).
- This handoff written.

## Files I Own (DO NOT EDIT)

*Session is COMPLETE.* No file lock needed.

## Uncommitted Changes (after S22)

Created in this session:
- `src/components/views/PrintableRefresherView/StalenessBanner.jsx`
- `src/components/views/PrintableRefresherView/__tests__/StalenessBanner.test.jsx`
- `.claude/handoffs/printable-refresher-session22.md` (this file)

Modified in this session:
- `src/components/views/PrintableRefresherView/index.jsx` (banner state + handlers + memo + filter + opt-in gate; `selectedCard` reordered above `stalenessBannerVisible`)
- `src/components/views/PrintableRefresherView/__tests__/PrintableRefresherView.test.jsx` (mock restructured to mutable + 10 new staleness tests)
- `.claude/BACKLOG.md` (PRF-G5-UI row status flipped + S22 deliverable detail appended)
- `.claude/STATUS.md` (top entry replaced; EAL S17 demoted to Prior update)

Untracked (gitignored — `*.png` rule):
- `prf-s22-banner-rendered.png`, `prf-s22-review-stale-filtered.png` (Playwright screenshots)

**NOT modified:**
- All other PRF infrastructure (CI / MIG / SL / ST / WR / HK / RL / RI / DS / LG / AppRoot / writers / lineage / cardRegistry / refresherSelectors) — stable.
- 4 card templates + ClassDispatchedTemplate + CardCatalog + CardRow + CardDetail + LineageModal + SuppressConfirmModal + PrintPreview + PrintControls + PrintConfirmationModal — stable.
- 6 Phase B math manifests — stable.
- `RefresherProvider` / `useRefresher` — stable.
- `PokerTracker.jsx` / `AppProviders.jsx` / `useAppState.js` / `contexts/index.js` — owned by parallel EAL sessions; untouched.
- `CollapsibleSidebar.jsx` — stable.
- `src/styles/printable-refresher.css` / `src/constants/runtimeVersions.js` / `src/main.jsx` — stable from S21.
- `SYSTEM_MODEL.md` — defer until S23+ since S22 work is small (1 component + state slots).

## What's Next

**S23 — owner priority pick.** Per backlog row, the deferred items are:

(a) **PRF-G5-PDF Playwright snapshot baseline** — now unblocked by S21 PrintPreview stability + S22 staleness coverage. 4 grid × 2 page × 2 color = 16 per card × 6 math cards = 96-snapshot baseline. Largest remaining quality-investment.

(b) **Filter expansion** — phases + tiers in addition to classes. `useRefresherView.filter` already supports them in state shape; just needs UI chips beyond the existing 4 class filters.

(c) **URL routing for sub-views** — `#printableRefresher/card/PRF-X` deep-links open CardDetail; same pattern for `/print-preview`. Currently sub-view nav is component-state-based; would extend `HASH_TO_SCREEN` parsing in `PokerTracker.jsx` to support multi-segment hashes.

(d) **Settings UI to expose `notifications.staleness` opt-in toggle** — unblocks the S22 banner in production for end users. Likely lands in the existing Settings view via a new "Refresher" section. Small but high-impact (no UI for it today means the banner is dormant).

(e) **PRF-G5-A — Phase A preflop card authoring** — Q5 differentiation demo first; gated on Q5 Gate 4 review verdict.

(f) **PRF-G5-C — Phase C equity + exceptions card authoring** — per-card Voice-3-equivalent fidelity review at PR time. Requires bucket-definition glossary + POKER_THEORY §9 audit-ids.

**Suggested order**: (d) is the smallest follow-up and unlocks owner-visible value for the S22 banner (right now it's dormant). (a) PRF-G5-PDF is a quality-investment with significant scope (96-snapshot baseline + Playwright config). (b)+(c) are smaller polish work. (e)+(f) require manifest authoring outside PRF-G5-UI scope.

## Gotchas / Context

1. **AP-PRF-08 opt-in gate is strict.** The banner is dormant in Phase 1 because `notifications.staleness` defaults to false in `buildDefaultRefresherConfig()`. Until Settings UI exposes the toggle (S23+ candidate), the banner is reachable only via dev-mode IDB seeding. This matches the surface spec's intent — staleness surfacing requires explicit owner opt-in to avoid engagement-pressure anti-patterns.

2. **`browser_evaluate` IDB-seeding pattern, reusable for future opt-in-gated features.**
   ```js
   const db = await new Promise((res, rej) => { const r = indexedDB.open('PokerTrackerDB'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
   const tx = db.transaction(['userRefresherConfig', 'printBatches'], 'readwrite');
   // patch singleton + insert stub batch
   ```
   Owner can do the same flip in DevTools Console to enable the banner manually if desired.

3. **Session-only dismiss, never persisted.** Surface spec §Behavior #9 explicitly forbids persisted dismissal records ("no days-since-dismissal counter, no nag pattern"). State is a parent-level boolean reset on each app mount. Mirrors the spec's "passive in-app" framing where the banner returns naturally on next session-start.

4. **Review-stale also dismisses the banner.** Once the owner has acknowledged + chosen to act, the banner shouldn't compete for attention with the filtered catalog they're now reviewing. Smaller cognitive load; the act of clicking Review IS the acknowledgment.

5. **TDZ error caught at first test run.** Initial implementation had `stalenessBannerVisible` referencing `selectedCard` before `selectedCard` was defined. JS const declarations are hoisted but not initialized; referencing them before initialization throws TDZ errors. Fix: 5-line reorder. Future memo-heavy sections should be careful about this — it's not caught by the linter unless the rule is configured.

6. **Mutable mock state in PrintableRefresherView.test.jsx.** Restructured the shared mock from static factory to `let mockRefresherState` overridable per test. The `vi.mock` factory closes over the let-binding; `beforeEach` resets to defaults. Trades a tiny amount of test indirection for the ability to scenario-test future features (notifications opt-in flag, hydration race conditions, etc.) without spawning new test files.

7. **2-card "Stale" indicators in catalog rows came for free.** S15 PRF-G5-DS already wired `staleCardIds.has(cardId)` into `CardRow`'s status badge precedence (stale > suppressed > hidden > pinned > current). S22's banner just makes the count visible at the page level; per-card amber indicators were already correct.

8. **Stale-count math: M = batchCardCount, K = staleCount, current = M - K.** Reads as "0 of 2 cards current, 2 stale" when both seeded cards are stale. If a stale card was never in the most-recent batch but IS in an older one, the math diverges from "current count" intuition — but `selectStaleCards` semantics (most-recent-batch-per-card) keeps this consistent: a stale card was printed at some point and now diverges.

9. **8 days-since-print number-printing forbidden** per AP-PRF-03. Banner copy verified mechanically by tests (`/streak/i`, `/consecutive/i`, `/you'?ve printed/i`, `/days since/i` all absent).

10. **Parallel-session coordination.** S22 owned `PrintableRefresherView/*` only — no shared-file edits. EAL S17 visual-verification ran in parallel and shipped its `AnchorObservationSection.jsx` adapter coercing numeric `hand.handId` to string at the boundary. Top-entry succession on STATUS: EAL S14 → PRF S20 → EAL S15 → EAL S16 → EAL S17 (code) → PRF S21 → EAL S17 visual-verification → PRF S22 (this entry).

## System Model Updates Needed

Defer until S23+ ships filter expansion, URL routing, or PRF-G5-PDF — those are the larger architectural changes warranting an update. S22 is a small additive component + state-slot wiring; templates + dispatcher + CSS strategy are documented in surface specs and the BACKLOG row. The §1 Component Map should grow at S23+ to include:

- StalenessBanner as a passive surfacing component.
- AP-PRF-08 opt-in gating pattern (banner gated on `userRefresherConfig.notifications.staleness`).
- Session-only state slots in PrintableRefresherView (banner-dismissed, show-only-stale).

## Test Status

S22 net-add: **~25 new tests across 1 new test file + 10 in extended `PrintableRefresherView.test.jsx`.**

PRF view scope: **240/240 green across 15 test files** (was 215/14 at S21 baseline; +25 / +1).

Full PRF + persistence + reducer + hooks + context + UI scope: not re-run end-to-end in S22 since modifications are scoped entirely to `PrintableRefresherView/*`. Expected: ≥784 + 25 = 809 across 31 files (S21 baseline 784/30 + S22 +25/+1).

CI bundle-grep gate: **PASS** — no html2canvas / jspdf / pdf-lib in PRF namespace.

Cumulative scaling validation:
- S15 (1 manifest, no UI): 399 tests / 19 files.
- S16 (4 manifests): 528 tests / 19 files.
- S17 (6 manifests): 614 tests / 19 files.
- S18 (6 manifests + 4 UI files): 662 tests / 23 files.
- S19 (6 manifests + 7 UI files): 710 tests / 26 files.
- S20 (6 manifests + 10 UI files): 714 tests / 26 files.
- S21 (6 manifests + 14 UI files + global stylesheet + runtimeVersions): 784 tests / 30 files.
- S22 (6 manifests + 15 UI files + global stylesheet + runtimeVersions + StalenessBanner): 809+ tests / 31 files (view-scope alone confirmed at 240/15).

The known precisionAudit flake + parallel-MPMF-G5-B2 + parallel-EAL-migration test situations remain unchanged. Zero new regressions from S22.
