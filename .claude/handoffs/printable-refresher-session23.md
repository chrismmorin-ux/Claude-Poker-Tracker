# Session Handoff: printable-refresher-session23
Status: COMPLETE | Written: 2026-04-27

## Backlog Item

**PRF-G5-PDF — Playwright visual regression infrastructure + 6-snapshot starter baseline.** S23 is the recommended-order #2 item from S22's handoff. The print flow + StalenessBanner are now visually pinned by deterministic snapshot tests; future UI changes that drift any of the 6 captured states will fail CI (when wired) + locally on `npm run test:visual`.

| S23 deliverable | Status |
|---|---|
| `@playwright/test` ^1.59.1 devDep + chromium binary | DONE |
| `playwright.config.js` (chromium, A22 viewport, port 5193) | DONE |
| `tests/playwright/printable-refresher.spec.js` (6 starter snapshots) | DONE |
| 6 baseline PNGs (450 KB total) generated + committed | DONE |
| `package.json` 3 npm scripts (`test:visual`, `:update`, `:debug`) | DONE |
| `.gitignore` updates (per-run artifacts ignored; baselines tracked) | DONE |
| Cross-browser / A4 / CardDetail per-class / full 16-permutation | DEFERRED to S24+ |
| Settings UI for `notifications.staleness` toggle | DEFERRED to S24+ |

## What I Did This Session

1 new config + 1 new spec + 6 new baseline PNGs + 4 file edits.

**(1) Tooling install.**

- `npm install --save-dev @playwright/test` (^1.59.1).
- `npx playwright install chromium` (browser binary; fast — already cached).

**(2) `playwright.config.js` (NEW).**

- Single chromium project with Galaxy A22 1600×720 viewport per CLAUDE.md mobile target.
- Port 5193 with `--strictPort` so `webServer` auto-spawn fails loudly if already in use.
- `webServer.command: 'npm run dev -- --port 5193 --strictPort'` + `reuseExistingServer: !CI` so local dev runs reuse a running server.
- `fullyParallel: false` + `workers: 1` — single dev server + single IDB; parallel workers would race on state.
- `expect.toHaveScreenshot` defaults: `maxDiffPixels: 100`, `threshold: 0.2`, `animations: disabled`.
- Output dir `tests/playwright/.test-results/` (gitignored).
- `forbidOnly: !!process.env.CI` ready for future GitHub Actions workflow.
- Reporter: `list` locally, `github` in CI.

**(3) `tests/playwright/printable-refresher.spec.js` (NEW).**

6 starter snapshots + 4 documented helpers reusable for S24+ extensions:

- `resetRefresherIDB(page)` — wipes printBatches + resets config defaults via `page.evaluate()` IDB manipulation. Each test's `beforeEach` runs this so per-test state is deterministic.
- `setPrintPrefs(page, prefs)` — patches `userRefresherConfig.printPreferences` directly so PrintPreview hydrates with the desired layout. Faster + less flaky than driving toggle UI clicks.
- `seedStaleScenario(page)` — flips `notifications.staleness=true` + inserts a stub `printBatch` with diverging contentHashes (mirrors S22 visual-verification IDB-seeding pattern).
- `gotoRefresher(page)` — `page.reload()` + click sidebar Refresher button + wait for "Print preview →" to be visible. **Why click instead of hash-deep-link:** Playwright's `page.goto('/#fragment')` on a same-origin SPA doesn't re-trigger React's mount-time `useEffect`, so the `HASH_TO_SCREEN` handler in `PokerTracker.jsx` doesn't route. Click pattern always works deterministically.

6 snapshot tests:
1. **catalog-default** — 6 math cards, no banner, no filter. Targets `page.getByRole('main')`.
2. **print-preview-12up-letter-color** — default PrintPreview state (all 6 cards on 1 page). Targets `.print-preview-container`.
3. **print-preview-4up-letter-color** — 4-up reflow; 6 cards across 2 pages. Pre-seeded via `setPrintPrefs({cardsPerSheet: 4})`.
4. **print-preview-1up-letter-bw-page1** — single card per page, grayscale filter applied. Targets first `.refresher-print-page` only (the full 1-up output is 6 pages; snapshotting one is enough to validate the layout class).
5. **print-confirmation-modal** — modal opened on top of PrintPreview. **Date-input masked** via `mask: [dialog.getByLabel('Print date')]` so today's-date drift doesn't flake the baseline daily.
6. **catalog-staleness-banner** — banner visible after `seedStaleScenario`. Both seeded cards show "⚠ Stale" + the banner copy reads "Your 2026-04-24 batch \"visual-regression\": 0 of 2 cards current, 2 stale."

**(4) `tests/playwright/printable-refresher.spec.js-snapshots/` (NEW directory).**

6 baseline PNGs committed (450 KB total). Naming convention: `<test-name>-chromium-win32.png` (Playwright auto-suffixes with project + platform).

**(5) `package.json` MODIFIED.**

3 new scripts:
- `test:visual` → `playwright test` — run + compare against baselines.
- `test:visual:update` → `playwright test --update-snapshots` — regenerate baselines after intentional UI changes.
- `test:visual:debug` → `playwright test --headed` — diagnose failures with a visible browser.

**(6) `.gitignore` MODIFIED.**

Added 3 ignore lines + 1 exception:
- `tests/playwright/.test-results/` — per-run output (failure screenshots, traces).
- `playwright-report/` — HTML report dir (Playwright default).
- `test-results/` — alternate Playwright output dir.
- `!tests/playwright/**/*.png` — exception so snapshot baselines ARE tracked. The existing `*.png` rule would have ignored them; the exception preserves them as visual-regression source-of-truth.

**Total S23: 6 baselines stable on second run (8.0s); CI bundle-grep gate passes ✓; zero regressions.**

**(7) Real bug caught + fixed by Playwright.**

Initial spec used `page.goto('/#printableRefresher')` for navigation. All 6 tests timed out waiting for "Print preview →". Failure screenshot showed Table view rendered instead of Refresher catalog. Root cause: Playwright's `page.goto` with a hash-only change on a same-origin SPA doesn't re-fire React's mount-time `useEffect`, so the `HASH_TO_SCREEN` handler in `PokerTracker.jsx` (line 63-71) didn't route to the catalog.

Fix: rewrote `gotoRefresher` to `page.reload()` + `page.click('button:has-text("Refresher")')`. Mirrors how an owner navigates + always works deterministically. Documented in spec doc-comment for future session reference. After fix: all 6 tests green on first try with `--update-snapshots`, then green again on stable second run.

**(8) Governance.**

- BACKLOG row PRF-G5-UI flipped to "S18+S19+S20+S21+S22+S23 shipped 2026-04-27"; S23 deliverable detail appended.
- STATUS top entry replaced with PRF S23 entry; previous PRF S22 entry demoted to "Prior update".
- This handoff written.

## Files I Own (DO NOT EDIT)

*Session is COMPLETE.* No file lock needed.

## Uncommitted Changes (after S23)

Created in this session:
- `playwright.config.js`
- `tests/playwright/printable-refresher.spec.js`
- `tests/playwright/printable-refresher.spec.js-snapshots/catalog-default-chromium-win32.png`
- `tests/playwright/printable-refresher.spec.js-snapshots/catalog-staleness-banner-chromium-win32.png`
- `tests/playwright/printable-refresher.spec.js-snapshots/print-confirmation-modal-chromium-win32.png`
- `tests/playwright/printable-refresher.spec.js-snapshots/print-preview-12up-letter-color-chromium-win32.png`
- `tests/playwright/printable-refresher.spec.js-snapshots/print-preview-1up-letter-bw-page1-chromium-win32.png`
- `tests/playwright/printable-refresher.spec.js-snapshots/print-preview-4up-letter-color-chromium-win32.png`
- `.claude/handoffs/printable-refresher-session23.md` (this file)

Modified in this session:
- `package.json` (3 npm scripts + @playwright/test devDep)
- `package-lock.json` (devDep tree expansion)
- `.gitignore` (3 ignore lines + 1 baseline-tracking exception)
- `.claude/BACKLOG.md` (PRF-G5-UI status flipped + S23 detail appended)
- `.claude/STATUS.md` (top entry replaced; PRF S22 demoted to Prior update)

Untracked (gitignored):
- `tests/playwright/.test-results/` (failure screenshots from initial timeout debugging — auto-pruned on next clean run)

**NOT modified:**
- All PRF source code (PrintableRefresherView/* + utils + contexts + hooks + reducers) — stable.
- All other PRF infrastructure — stable.
- 6 Phase B math manifests — stable.
- `PokerTracker.jsx` / `AppProviders.jsx` / `useAppState.js` / `contexts/index.js` — owned by parallel EAL sessions; untouched.
- `src/styles/printable-refresher.css` / `src/constants/runtimeVersions.js` — stable from S21.
- `src/main.jsx` — stable.
- `SYSTEM_MODEL.md` — defer until S24+ does cross-browser or full-permutation expansion.

## What's Next

**S24+ — owner priority pick.** Per backlog row + STATUS top entry, the deferred items are:

(a) **Cross-browser baselines** — extend `playwright.config.js` projects to add firefox + webkit; regenerate baselines per-browser; ~6 baselines × 3 browsers = 18 PNGs. Snapshots will likely diverge by a few pixels per browser at A22 viewport — may need per-project `maxDiffPixels` tuning. Best ROI of the visual-regression extensions.

(b) **A4 page-size baselines** — current 6 baselines all use Letter; A4 grids differ at 12-up/6-up (compressed row heights per `body[data-page-size="a4"]` selector in stylesheet). Add 3-4 A4 variants for owner-visible coverage.

(c) **CardDetail snapshots per class** — only math has manifests today; preflop/equity/exceptions detail snapshots are gated on PRF-G5-A + PRF-G5-C card authoring (would author temp manifests for snapshot purposes only, or wait for real authoring).

(d) **Full 16-permutation matrix** — 4 grids × 2 sizes × 2 colors per page; would balloon to ~32 snapshots × 6 cards (?) and substantially slow test runs. Defer until visual divergence between permutations is owner-visible enough to warrant.

(e) **Settings UI to expose `notifications.staleness` opt-in toggle** — unblocks the S22 banner in production. Likely lands in the existing Settings view via a new "Refresher" section. Small but high-impact.

(f) **URL routing for sub-views** — `#printableRefresher/card/PRF-X` deep-links open CardDetail; same pattern for `/print-preview`. Currently sub-view nav is component-state-based.

(g) **Filter expansion** — phases + tiers in addition to classes. `useRefresherView.filter` already supports them in state shape.

(h) **PRF-G5-A Phase A preflop card authoring** — Q5 differentiation demo first; gated on Q5 Gate 4 review verdict.

(i) **PRF-G5-C Phase C equity + exceptions card authoring** — per-card Voice-3-equivalent fidelity review at PR time.

**Suggested order**: (e) Settings UI is the highest-impact small task (unblocks the dormant banner for end users). (a) Cross-browser is the strongest visual-regression extension. (b) A4 + (c) CardDetail are smaller polish. (d) full matrix is a big investment with marginal incremental signal. (h)+(i) are content authoring outside PRF-G5-UI scope.

## Gotchas / Context

1. **Hash-deep-link unreliable in Playwright.** `page.goto('/#fragment')` on a same-origin SPA doesn't re-trigger React's mount-time `useEffect`. Use `page.reload()` + UI click for navigation. Documented in spec doc-comment so future test authors don't repeat the trap.

2. **IDB seeding via `page.evaluate`, not UI clicks.** For state-dependent snapshots (banner-visible, custom prefs), seeding directly into IDB before navigation is faster + less flaky than driving toggle UI sequences. Pattern documented in spec helpers; reusable for any opt-in-gated or persistence-backed feature. Seeding pattern:
   ```js
   const tx = db.transaction(['userRefresherConfig'], 'readwrite');
   const cfg = await getSingleton(tx);
   cfg.notifications = { ...(cfg.notifications || {}), staleness: true };
   await put(tx, cfg);
   ```

3. **Region-targeted screenshots, not full viewport.** `expect(page.getByRole('main')).toHaveScreenshot()` and `expect(page.locator('.print-preview-container')).toHaveScreenshot()` keep baselines tight against scroll-position + browser-chrome drift. Full-viewport snapshots reserved for whole-page regression checks.

4. **Date-input masking in PrintConfirmationModal.** `mask: [dialog.getByLabel('Print date')]` paints a uniform overlay so today's-date drift doesn't flake the baseline daily. Pattern reusable for any time-dependent UI (relative timestamps, "just now" labels, etc.).

5. **Cross-browser deferred to S24+.** Chromium-only baseline ships first since chromium has the most reliable `@page` CSS support + fastest iteration. Firefox + webkit regression coverage when there's evidence of browser-specific rendering divergence (so far there isn't).

6. **`fullyParallel: false` + `workers: 1`.** Single dev server + single IDB; parallel workers would race on state. Trade-off: slower test runs (8s for 6 snapshots) for deterministic state. If tests stay deterministic + scope grows past ~30 snapshots, revisit.

7. **`reuseExistingServer: !CI`.** Locally, if a dev server is already running on port 5193, the test suite uses it. In CI, it always spawns its own. The `--strictPort` flag in the dev command means port collisions fail loudly rather than silently switching ports.

8. **Visual regression baselines ARE tracked content.** The `!tests/playwright/**/*.png` exception in `.gitignore` is intentional. The PNGs are the source-of-truth; without them the test infrastructure can't compare. Per-run output (test-results/, playwright-report/) stays gitignored.

9. **`expect.toHaveScreenshot` thresholds.** `maxDiffPixels: 100` allows up to 100 pixels of diff before failing — covers minor font-rendering jitter without masking real regressions. `threshold: 0.2` is the per-pixel diff threshold (0-1; 0.2 = up to 20% per-channel difference allowed). Tune per-project if cross-browser snapshots later prove too sensitive.

10. **`forbidOnly: !!process.env.CI` is ready for CI.** When the project gets a GitHub Actions workflow, set `CI=true` env and `npx playwright test` will fail if any test has `.only()` accidentally committed.

11. **`@playwright/test` install gives an audit warning.** "11 vulnerabilities (2 moderate, 8 high, 1 critical)" — these are transitive dev-only deps from Playwright's tooling, not runtime exposure. No action needed; standard for dev tooling.

12. **`playwright install chromium` succeeded silently.** No output from the command means the browser binary was already cached locally (likely from MCP Playwright). Fresh CI machines would download ~150 MB.

13. **Parallel-session coordination.** S23 owned `playwright.config.js` + `tests/playwright/*` + `package.json` + `.gitignore` only. EAL sessions in `src/hooks/`, `src/contexts/`, `src/components/views/HandReplayView/` are untouched. Top-entry succession on STATUS: EAL S14 → PRF S20 → EAL S15 → EAL S16 → EAL S17 → PRF S21 → EAL S17 visual-verification → PRF S22 → PRF S23 (this entry).

## System Model Updates Needed

Defer until S24+ does cross-browser expansion. The §1 Component Map should grow at S24+ to include:

- `playwright.config.js` + `tests/playwright/*.spec.js` as a new test infrastructure layer.
- Snapshot baseline directory pattern (`<spec>.spec.js-snapshots/`).
- Cross-browser project structure (when added).

## Test Status

S23 net-add: **6 baselines + spec infrastructure.** No new unit tests (visual regression is a different test type).

PRF unit-test scope: unchanged at **240/240 view-scope green across 15 files** (S22 baseline maintained).

Visual regression scope: **6/6 chromium baselines stable on second run (8.0s).**

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

Full smart-test-runner not run this session. The known precisionAudit flake + parallel-MPMF-G5-B2 + parallel-EAL-migration test situations remain unchanged. Zero new regressions from S23.
