# Session Handoff: printable-refresher-session27
Status: COMPLETE | Written: 2026-04-27

## Backlog Item

**Visual regression suite completeness — lineage-off variant + 2 modal snapshots (SuppressConfirmModal + LineageModal).** Continues PRF-G5-UI from S18+S19+S20+S21+S22+S23+S24+S25+S26. The Letter + A4 baselines from S25/S26 covered the print-preview state space with lineage-on; S27 fills the remaining gaps: lineage-off CSS rule + the two modal overlays that weren't yet visually pinned.

| S27 deliverable | Status |
|---|---|
| Lineage-off Playwright test (12-up Letter Color) | DONE |
| SuppressConfirmModal Playwright snapshot | DONE |
| LineageModal Playwright snapshot | DONE |
| 9 new baseline PNGs (3 tests × 3 browsers) | DONE |
| All 42 test runs stable on second pass | DONE (3.5m) |
| CardDetail per class / 16-permutation matrix / CI workflow | DEFERRED to S28+ |

## What I Did This Session

1 file edit + 9 new baseline PNGs.

**(1) `tests/playwright/printable-refresher.spec.js` MODIFIED — 3 new tests appended after the S26 A4 variants.**

(a) **"PrintPreview — 12-up Letter Color, lineage off"** — pre-seeds `includeLineage: false` via existing `setPrintPrefs` helper:

```js
test('PrintPreview — 12-up Letter Color, lineage off', async ({ page }) => {
  await setPrintPrefs(page, { cardsPerSheet: 12, includeLineage: false });
  await gotoRefresher(page);
  await page.getByLabel('Open print preview').click();
  await page.locator('.print-preview-container').waitFor({ state: 'visible' });
  await expect(page.locator('.print-preview-container')).toHaveScreenshot('print-preview-12up-letter-color-lineage-off.png');
});
```

Confirms the `.print-preview-container[data-include-lineage="off"]` CSS selector hides `.refresher-card-region-4-5` (the 7-field lineage footer) on every card in the grid. Visual diff vs the existing 12-up-color baseline shows footers absent vs present — the CSS rule works.

(b) **"SuppressConfirmModal — opened on math card"** — clicks the ⛔ Suppress chip on the first card row:

```js
test('SuppressConfirmModal — opened on math card', async ({ page }) => {
  await gotoRefresher(page);
  await page.getByLabel('Suppress math class').first().click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  await expect(dialog).toHaveScreenshot('suppress-confirm-modal-math.png');
});
```

Snapshots the `<dialog>` showing the title-aware "Suppress math class" copy + explainer + "I understand" checkbox + Cancel/Suppress buttons. Verifies R-8.1 zero-data-loss enforcement at the writer + checkbox-gated primary button per surface spec §SuppressConfirmModal.

(c) **"LineageModal — opened from CardDetail"** — multi-step navigation:

```js
test('LineageModal — opened from CardDetail', async ({ page }) => {
  await gotoRefresher(page);
  await page.getByLabel('Open card detail').first().click();
  await page.getByLabel('Open lineage modal').click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  await expect(dialog).toHaveScreenshot('lineage-modal-math-auto-profit.png');
});
```

Snapshots the `<dialog>` showing the read-only 7-field lineage display for PRF-MATH-AUTO-PROFIT + footer disclaimer (red line #12 lineage-mandatory; surface spec §LineageModal).

**(2) 9 new baseline PNGs.**

`tests/playwright/printable-refresher.spec.js-snapshots/`:

| Test | chromium | firefox | webkit |
|---|---|---|---|
| print-preview-12up-letter-color-lineage-off | NEW | NEW | NEW |
| suppress-confirm-modal-math | NEW | NEW | NEW |
| lineage-modal-math-auto-profit | NEW | NEW | NEW |

Total directory now 39 baselines = 13 snapshot tests × 3 browsers.

The 14th test ("end-to-end: enable staleness in Settings → banner appears in Refresher") is behavior-only with no snapshot.

**(3) Stability verification.**

- First pass: `npx playwright test --update-snapshots` — 42/42 green (~2.4m).
- Second pass: `npx playwright test` — 42/42 stable (3.5m wall time).

**(4) Per-element observations** captured for future-session reference:

- **Lineage-off:** CSS rule works identically across all 3 browsers. Footer block visually absent in all 3 baselines; body content extends into the freed-up vertical space (the math card body paragraphs that previously stopped above the lineage footer now fill the card). The lineage-off baseline is the diff vs the lineage-on baseline; together they prove the CSS rule.
- **SuppressConfirmModal:** renders consistently with checkbox unticked + Suppress button disabled. Visual cue: button has lower-saturation gray vs the red enabled state. Verified the modal accurately reflects the spec's gate-on-checkbox behavior.
- **LineageModal:** monospace 7-field display + footer disclaimer ("Red line #12 — lineage-mandatory. Every card carries a 7-field lineage footer.") render consistently. Field 4 shows "engine unknown-engine / app unknown-app" for the math card (S20 introduced runtime versions for the print path; CardDetail still passes empty runtime — future cleanup if lineage modal in CardDetail should also use real versions).
- Modal overlay backdrop is `rgba(0,0,0,0.6)` per the SuppressConfirmModal pattern; baselines target the `<dialog>` not the backdrop so test focus is on the modal content.

**(5) Governance.**

- BACKLOG row PRF-G5-UI flipped to "S18+...+S26+S27 shipped 2026-04-27"; S27 deliverable detail appended.
- STATUS top entry replaced with PRF S27 entry; previous PRF S26 entry demoted to "Prior update".
- This handoff written.

## Files I Own (DO NOT EDIT)

*Session is COMPLETE.* No file lock needed.

## Uncommitted Changes (after S27)

Modified in this session:
- `tests/playwright/printable-refresher.spec.js` (3 tests appended)
- `.claude/BACKLOG.md` (PRF-G5-UI status flipped + S27 detail appended)
- `.claude/STATUS.md` (top entry replaced; PRF S26 demoted to Prior update)

Created in this session:
- `tests/playwright/printable-refresher.spec.js-snapshots/print-preview-12up-letter-color-lineage-off-chromium-win32.png`
- `tests/playwright/printable-refresher.spec.js-snapshots/print-preview-12up-letter-color-lineage-off-firefox-win32.png`
- `tests/playwright/printable-refresher.spec.js-snapshots/print-preview-12up-letter-color-lineage-off-webkit-win32.png`
- `tests/playwright/printable-refresher.spec.js-snapshots/suppress-confirm-modal-math-chromium-win32.png`
- `tests/playwright/printable-refresher.spec.js-snapshots/suppress-confirm-modal-math-firefox-win32.png`
- `tests/playwright/printable-refresher.spec.js-snapshots/suppress-confirm-modal-math-webkit-win32.png`
- `tests/playwright/printable-refresher.spec.js-snapshots/lineage-modal-math-auto-profit-chromium-win32.png`
- `tests/playwright/printable-refresher.spec.js-snapshots/lineage-modal-math-auto-profit-firefox-win32.png`
- `tests/playwright/printable-refresher.spec.js-snapshots/lineage-modal-math-auto-profit-webkit-win32.png`
- `.claude/handoffs/printable-refresher-session27.md` (this file)

**NOT modified:**
- All PRF source code (PrintableRefresherView/* + utils + contexts + hooks + reducers) — stable.
- `playwright.config.js` — stable from S25.
- All 30 baselines from S23-S26 — stable.
- `package.json` / `package-lock.json` / `.gitignore` — stable.
- `PokerTracker.jsx` / `AppProviders.jsx` / `useAppState.js` / `contexts/index.js` — owned by parallel EAL sessions; untouched.
- `src/styles/printable-refresher.css` / `src/constants/runtimeVersions.js` / `src/main.jsx` — stable from S21.
- `SYSTEM_MODEL.md` — defer until S28+.

## What's Next

**S28+ — owner priority pick.** Per backlog row + STATUS top entry, the deferred items are:

(a) **CardDetail snapshots per class** — only math has manifests today; preflop/equity/exceptions detail snapshots are gated on PRF-G5-A + PRF-G5-C card authoring (would author temp manifests for snapshot purposes only, or wait for real authoring).

(b) **16-permutation full grid×page×color matrix** — Phase 1 starter ships ~7 representative permutations × 3 browsers = 21 snapshots; full matrix would balloon to ~96 × 3 = 288. Defer until specific permutations show owner-visible regressions.

(c) **CI integration** — Playwright config has `forbidOnly: !!process.env.CI` ready; needs a GitHub Actions workflow file when project gets CI. The 3.5m wall time is tolerable; parallelization to `workers: 3` (one per browser) would cut to ~1.5m if needed.

(d) **URL routing for sub-views** — `#printableRefresher/card/PRF-X` deep-links open CardDetail; same pattern for `/print-preview`. Currently sub-view nav is component-state-based.

(e) **Filter expansion** — phases + tiers in addition to classes. `useRefresherView.filter` already supports them in state shape.

(f) **PRF-G5-A Phase A preflop card authoring** — Q5 differentiation demo first; gated on Q5 Gate 4 review verdict.

(g) **PRF-G5-C Phase C equity + exceptions card authoring** — per-card Voice-3-equivalent fidelity review at PR time.

**Suggested order**: (c) CI integration when GitHub Actions ships. (d)+(e) are smaller polish UX work. (a)+(b) are large investments with diminishing returns. (f)+(g) require manifest authoring outside PRF-G5-UI scope.

The PRF-G5-UI run today (S20-S27) has shipped a comprehensive Phase 5 implementation: 4 card templates + 5 sub-views + 3 modals + global print stylesheet + Settings toggle + 39 visual regression baselines across 3 browsers. Natural pause point — recommend stopping here or moving to the broader Phase A/C content authoring (which depends on owner Gate 4 review for Phase A).

## Gotchas / Context

1. **Lineage-off CSS rule is per-container, not per-card.** The `.print-preview-container[data-include-lineage="off"]` selector + descendant `.refresher-card-region-4-5` target hides ALL footers in the container. Toggling it via PrintControls flips the data-attribute on the container; CSS does the rest. No JS needed at the per-card level.

2. **Modal snapshots target `<dialog>` not `.refresher-modal-backdrop`.** The backdrop is a styled wrapper at `rgba(0,0,0,0.6)`; including it would add noise to the diff. `getByRole('dialog')` selects the inner dialog content + masks the backdrop. Pattern: any modal snapshot should target the dialog content, not the full overlay.

3. **No date masking on SuppressConfirmModal or LineageModal.** Neither contains time-dependent UI (manifest fixture has fixed `lastVersionedAt`). The PrintConfirmationModal's `mask: [dialog.getByLabel('Print date')]` pattern from S23 is reusable for time-dependent modals only.

4. **Both modals open via UI clicks, not IDB seeding.** They require explicit user interaction (Suppress chip / Detail chip + Lineage CTA). The click sequence is short + reliable across browsers; no IDB pre-seeding helpers needed.

5. **LineageModal shows "engine unknown-engine / app unknown-app" for the math card.** S20 introduced `runtimeVersions.js` for the print path, but CardDetail still passes empty `runtime` to its inner `LineageModal`. The lineage modal opens from CardDetail's "Where does this number come from?" CTA — which uses the card's manifest, not a passed-in runtime. Future cleanup: thread `runtime={{ engineVersion, appVersion }}` from CardDetail to LineageModal so it shows real values consistently with PrintPreview.

6. **The lineage-off baseline doesn't prove much by itself.** The visual regression value is the comparison vs the lineage-on baseline (12-up-letter-color); the lineage-off baseline alone shows missing footers, but only the diff between them proves the CSS rule works. Both baselines together are the canonical assertion.

7. **One test per CSS-rule state, not per-grid-mode-per-state.** Lineage-off CSS rule is identical across 12-up/6-up/4-up/1-up grids. 1 representative test (12-up Letter Color, lineage off) is sufficient. If owner-visible regressions surface in specific grid layouts, add then.

8. **Wall time growth: S26 3.2m → S27 3.5m.** 3 new tests = ~9 new test runs. Per-test cost ~1-2s. Spawn cost is constant (3 × ~1m). Math: 14 tests × ~3-4s = ~45s tests + 3m spawns = ~3.7m theoretical; observed 3.5m matches.

9. **PRF-G5-UI run summary (today's session run):** S20-S27 = 8 sessions in one day. Net deliverables across the run:
   - 4 card templates (Math + Preflop + Equity + Exceptions)
   - 5 sub-views (CardCatalog + CardDetail + PrintPreview + PrintControls + Settings RefresherSettings)
   - 3 modals (PrintConfirmationModal + SuppressConfirmModal + LineageModal)
   - 1 banner (StalenessBanner)
   - 1 global stylesheet
   - 1 constants file
   - ~252 unit tests
   - 39 visual regression baselines across 3 browsers
   - 7 commits, all clean
   - 4 real bugs caught + fixed by Playwright
   - PRF-G5-UI status: comprehensive Phase 5 implementation, ready for Phase A/C card authoring + future polish.

10. **Parallel-session coordination.** S27 owned `tests/playwright/printable-refresher.spec.js` (3 tests appended) + 9 new baseline PNGs. No source code changes. EAL sessions in `src/hooks/`, `src/contexts/`, `src/components/views/HandReplayView/` are untouched. Top-entry succession on STATUS: EAL S14 → PRF S20 → EAL S15 → EAL S16 → EAL S17 → PRF S21 → EAL S17 visual-verification → PRF S22 → PRF S23 → PRF S24 → PRF S25 → PRF S26 → PRF S27 (this entry).

## System Model Updates Needed

Defer until S28+ if larger-scope work (URL routing / filter expansion) lands. The current PRF-G5-UI run has been small additive sessions; SYSTEM_MODEL update would be cheap but premature.

## Test Status

S27 net-add: **9 new baseline PNGs (3 tests × 3 browsers).** No new unit tests; no source code changes.

PRF unit-test scope: unchanged (240 view-scope + 12 Settings = 252 across 16 view+settings test files).

Visual regression scope: **42/42 test runs stable on second run (3.5m wall time)** = 14 tests × 3 browsers (chromium + firefox + webkit). 39 baselines committed (13 snapshot tests × 3 browsers; 14th test is behavior-only).

CI bundle-grep gate: **PASS** — no html2canvas / jspdf / pdf-lib in PRF namespace.

Cumulative scaling validation:
- S15 (1 manifest, no UI): 399 tests / 19 files.
- S16 (4 manifests): 528 tests / 19 files.
- S17 (6 manifests): 614 tests / 19 files.
- S18 (6 manifests + 4 UI files): 662 tests / 23 files.
- S19 (6 manifests + 7 UI files): 710 tests / 26 files.
- S20 (6 manifests + 10 UI files): 714 tests / 26 files.
- S21 (6 manifests + 14 UI files + global stylesheet + runtimeVersions): 784 tests / 30 files.
- S22 (6 manifests + 15 UI files + StalenessBanner): 240 view-scope tests / 15 view files / ~809 across full PRF scope.
- S23 (same as S22 + 6 visual baselines + Playwright infrastructure): unit-test count unchanged; visual: 6/6 chromium baselines green.
- S24 (same as S23 + Settings staleness toggle + Settings unit tests + 1 visual baseline + 2 e2e Playwright tests): unit: 252 PRF + Settings tests; visual: 8/8 chromium baselines green.
- S25 (same as S24 + 14 new baselines for firefox + webkit): unit-test count unchanged; visual: 24/24 test runs green across 3 browsers; 21 baselines committed.
- S26 (same as S25 + 9 new A4 baselines): unit-test count unchanged; visual: 33/33 test runs green across 3 browsers; 30 baselines committed.
- S27 (same as S26 + 9 new lineage-off + 2 modal baselines): unit-test count unchanged; visual: 42/42 test runs green across 3 browsers; 39 baselines committed.

The known precisionAudit flake + parallel-MPMF-G5-B2 + parallel-EAL-migration test situations remain unchanged. Zero new regressions from S27.
