# Session Handoff: printable-refresher-session28
Status: COMPLETE | Written: 2026-04-27

## Backlog Item

**PRF-G5-CI — GitHub Actions visual-regression workflow.** Continues PRF-G5-UI from S18+S19+S20+S21+S22+S23+S24+S25+S26+S27. The 39-baseline visual regression suite shipped in S23–S27 is now wired to CI: every PR + push to main runs the 14-test × 3-browser Playwright suite on `ubuntu-latest`. Advisory mode (`continue-on-error: true`) until Linux baselines are committed — see "Cross-platform baseline gap" below.

| S28 deliverable | Status |
|---|---|
| `.github/workflows/visual-regression.yml` (new file) | DONE |
| Browser cache keyed on `package-lock.json` hash | DONE |
| Conditional browser install (cache hit/miss) | DONE |
| Unconditional system-deps install | DONE |
| `continue-on-error: true` on test step (advisory mode) | DONE |
| Artifact upload on failure with `${{ github.run_id }}`-named bundle | DONE |
| `::warning` annotation on failure for PR check visibility | DONE |
| Inline doc-comment with cross-platform baseline gap + resolution path | DONE |
| STATUS top entry replaced; PRF S27 demoted to "Prior update" | DONE |
| BACKLOG row PRF-G5-UI updated with S28 detail | DONE |
| Linux baseline regeneration | DEFERRED to owner-driven future session |
| Removal of `continue-on-error: true` (hard PR gate flip) | DEFERRED to future session after Linux baselines committed |

## What I Did This Session

Single deliverable: 1 new file at `.github/workflows/visual-regression.yml` (~80 LOC including extensive header doc-comment).

**Why a separate workflow file (not `ci.yml` extension):**

1. Different cadence — `ci.yml` runs sub-1-minute unit tests + coherence scan; visual regression is 3.5m locally and likely 4–5m on CI.
2. Different platform constraints — visual regression has cross-platform baseline issues that unit tests don't.
3. Different failure semantics — visual regression is advisory until Linux baselines are committed; unit tests are hard-gate.

Mixing these cadences would mean slow visual tests delay fast unit feedback, and the advisory failure-mode would muddy ci.yml's pass/fail meaning.

**Workflow structure** (`name: Visual Regression`):

```yaml
on:
  pull_request: { branches: [main] }
  push:         { branches: [main] }

jobs:
  playwright-visual:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4 (node 20, cache: npm)
      - run: npm ci
      - uses: actions/cache@v4 (~/.cache/ms-playwright, key based on package-lock.json hash)
      - run: npx playwright install chromium firefox webkit  # if cache miss
      - run: npx playwright install-deps chromium firefox webkit  # always (apt-system)
      - run: npm run test:visual  # id: visual-test, continue-on-error: true
      - uses: actions/upload-artifact@v4 (on failure, name: playwright-report-${{ github.run_id }})
      - run: echo "::warning ..."  # surface advisory failure
```

**Key implementation choices:**

- **Browser cache key**: `playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}`. Auto-invalidates when Playwright version bumps. No need for explicit version pinning.

- **System deps install runs unconditionally**: `~/.cache/ms-playwright` only caches browser binaries; apt-installed dependencies (libnss, libgbm, libwoff, etc.) live system-wide on the runner and aren't cached. Standard Playwright-on-CI pattern.

- **Test step has `id: visual-test`**: Lets the artifact upload step + warning step reference its outcome via `steps.visual-test.outcome != 'success'`.

- **Artifact upload conditional on failure**: `if: ${{ !cancelled() && steps.visual-test.outcome != 'success' }}`. `!cancelled()` excludes user-cancelled runs. Path glob covers both `playwright-report/` (HTML diff viewer) and `tests/playwright/.test-results/` (raw diff PNGs). `if-no-files-found: ignore` prevents this step from failing when the test step actually passes.

- **`::warning` annotation step**: Surfaces a yellow warning in the PR check summary panel even when the job is "green" (advisory mode). Owner sees the message + can drill into artifacts without the PR being blocked.

## Cross-platform baseline gap (THE KEY GOTCHA)

All 39 baselines committed to date are `*-{chromium,firefox,webkit}-win32.png` because they were generated on the owner's local Windows machine. CI runs on `ubuntu-latest`, which Playwright auto-suffixes baselines as `*-{browser}-linux.png`.

**The two coexist** (Playwright suffixes baselines by platform), but **Linux baselines do not yet exist in the repo**, so the first CI runs **WILL** report:

```
Error: A snapshot doesn't exist at /work/tests/playwright/printable-refresher.spec.js-snapshots/catalog-default-chromium-linux.png
```

…for all 13 snapshot tests × 3 browsers = 39 missing baseline errors per CI run.

This is **intentional bootstrapping**. The workflow is gated `continue-on-error: true` so it does not block PRs. Failure surfaces as `::warning` annotation + downloadable `playwright-report-${{ github.run_id }}` artifact.

**Resolution path (owner-driven, future session):**

1. **Regenerate Linux baselines locally.** Three options (in order of recommended):

   a. **Playwright Docker image** (preferred — runtime matches GitHub Actions runner exactly):
   ```bash
   docker run --rm -v "$PWD:/work" -w /work \
     mcr.microsoft.com/playwright:v1.59.1-noble \
     sh -c "npm ci && npm run test:visual:update"
   ```
   This generates 39 new `*-{browser}-linux.png` files in `tests/playwright/printable-refresher.spec.js-snapshots/`.

   b. **WSL on Windows** — install Linux Playwright in WSL, run `npm run test:visual:update`, copy the generated baselines back to the Windows-mounted repo.

   c. **Download artifacts from a CI run** — pull `playwright-report-<run_id>` from a failed workflow run, extract the `actual_*.png` renders, rename to match the missing baseline names, commit. Slower + more error-prone but works without Docker/WSL.

2. **Commit the new Linux baselines.** The existing `!tests/playwright/**/*.png` `.gitignore` exception covers them.

3. **Remove `continue-on-error: true`** from the test step in `.github/workflows/visual-regression.yml` so visual regressions become a hard PR gate. (This is a 1-line removal.)

Until step 3 lands, this workflow is **advisory only**.

## Files I Own (DO NOT EDIT)

*Session is COMPLETE.* No file lock needed.

## Uncommitted Changes (after S28)

**Modified in this session:**
- `.claude/BACKLOG.md` — PRF-G5-UI row updated with S28 detail; status flipped to "S18+...+S27+S28 shipped 2026-04-27"
- `.claude/STATUS.md` — top entry replaced with PRF S28 detail; previous PRF S27 entry demoted to "Prior update"

**Created in this session:**
- `.github/workflows/visual-regression.yml` — the new advisory-mode CI workflow
- `.claude/handoffs/printable-refresher-session28.md` — this file

**NOT modified:**
- All PRF source code (`PrintableRefresherView/*` + utils + contexts + hooks + reducers) — stable.
- `playwright.config.js` — stable from S25.
- `tests/playwright/printable-refresher.spec.js` — stable from S27.
- All 39 win32 baselines from S23–S27 — stable.
- `package.json` / `package-lock.json` / `.gitignore` — stable.
- `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` — stable, untouched.
- `PokerTracker.jsx` / `AppProviders.jsx` / `useAppState.js` / `contexts/index.js` — owned by parallel EAL sessions; untouched.
- `src/styles/printable-refresher.css` / `src/constants/runtimeVersions.js` / `src/main.jsx` — stable from S21.
- `SYSTEM_MODEL.md` — defer until S29+ if larger-scope work lands.

## What's Next

**S29+ — owner priority pick.** Recommended order:

(a) **Owner-driven Linux baseline regeneration** — unblocks the hard-gate flip on the visual-regression workflow. The single highest-leverage next step. Steps documented above ("Resolution path"). After Linux baselines are committed, a 1-line removal of `continue-on-error: true` makes visual regression a hard PR gate. Estimated effort: ~30 minutes including Docker setup.

(b) **URL routing for sub-views** — `#printableRefresher/card/PRF-X` deep-links open CardDetail; same pattern for `/print-preview`. Currently sub-view nav is component-state-based. Small + owner-visible. Estimated effort: 1 session.

(c) **Filter expansion** — phases + tiers in addition to classes. `useRefresherView.filter` already supports them in state shape. Small + owner-visible. Estimated effort: 1 session.

(d) **CardDetail snapshots per class** — only math has manifests today; preflop/equity/exceptions detail snapshots are gated on PRF-G5-A + PRF-G5-C card authoring. Defer until those phases ship.

(e) **16-permutation full grid×page×color matrix** — current 7 representative permutations × 3 browsers; full matrix would balloon to ~96 × 3 = 288 baselines. Diminishing returns — defer until specific permutations show owner-visible regressions.

(f) **PRF-G5-A Phase A preflop card authoring** — Q5 differentiation demo first; gated on Q5 Gate 4 review verdict. Outside PRF-G5-UI scope.

(g) **PRF-G5-C Phase C equity + exceptions card authoring** — per-card Voice-3-equivalent fidelity review at PR time. Outside PRF-G5-UI scope.

The PRF-G5-UI run today (S20–S28) has shipped a comprehensive Phase 5 implementation plus advisory CI integration. Natural pause point — recommend stopping here or moving to (a) Linux baseline regeneration to flip the workflow to hard-gate.

## Gotchas / Context

1. **The cross-platform baseline gap is the single biggest gotcha.** Anyone who looks at the CI status post-S28 will see the visual-regression job repeatedly "passing with warning" while reporting 39 missing-baseline errors per run. This is intentional. The workflow header doc-comment + STATUS top entry + this handoff all explain. If a future session wants to remove the noise without committing Linux baselines, the answer is to disable the workflow trigger (e.g., comment out `pull_request:` and `push:` blocks) — but that defeats the purpose of CI integration. Better: bite the bullet and regenerate Linux baselines.

2. **`continue-on-error: true` makes the JOB pass even when the STEP fails.** GitHub's check status will show "✓ Visual regression / Playwright visual regression (PRF)" even when 39 snapshot assertions failed. The `::warning` annotation step is what surfaces failure visibility in the PR check summary panel. Without that step, a failing visual-regression run would be silently green — bad UX.

3. **Browser cache invalidation key uses `package-lock.json` hash.** This means: any `npm install` that bumps Playwright version will invalidate the cache, triggering a fresh browser install (~2-3m on next CI run). Acceptable trade-off for not-running-against-stale-browsers.

4. **System deps install runs every time, even on cache hit.** This is correct: `~/.cache/ms-playwright` caches browser binaries (chromium-XXXX/, firefox-YYYY/, webkit-ZZZZ/), but apt-installed dependencies live system-wide and aren't user-cached. The runner is fresh each time. ~10s overhead per run.

5. **Playwright config already has `forbidOnly: !!process.env.CI` and `reporter: process.env.CI ? 'github' : 'list'`.** No config changes needed in `playwright.config.js` for CI integration. The github reporter automatically emits `::error` annotations on failed assertions; combined with `continue-on-error: true` on the test step, those annotations show but the job is green.

6. **Workers stay at 1 even on CI.** The `playwright.config.js` has `fullyParallel: false, workers: 1` because the dev-server + IDB are shared per-worker. To parallelize to `workers: 3` (one per browser), each worker would need its own dev-server instance with its own port + its own IDB origin. That's a deeper refactor; deferred until CI cost surfaces as a real problem. Current CI wall-time estimate: 4-5m (vs 3.5m local).

7. **Path filters were considered and deferred.** A path filter restricting the workflow trigger to changes in `src/components/views/PrintableRefresherView/**` etc. would save CI time on PRs that don't touch refresher code. But it introduces brittleness when refactors move files (path filter becomes stale, tests don't run when they should). For now, run-on-all-PRs is simpler. Add path filters if CI cost becomes an issue.

8. **Artifact retention is 14 days (GitHub default).** Sufficient for owner to download + review without auto-purging stale runs. Can be tuned via `retention-days:` if longer review windows are needed.

9. **The ci.yml and visual-regression.yml workflows are independent.** `ci.yml` runs unit tests + coherence scan; `visual-regression.yml` runs Playwright snapshots. They both trigger on the same PR/push events but execute in parallel, each with their own runner. A failure in one doesn't affect the other.

10. **PRF-G5-UI run summary across the day's session run (S20-S28):**
    - 4 card templates (Math + Preflop + Equity + Exceptions)
    - 5 sub-views (CardCatalog + CardDetail + PrintPreview + PrintControls + Settings RefresherSettings)
    - 3 modals (PrintConfirmationModal + SuppressConfirmModal + LineageModal)
    - 1 banner (StalenessBanner)
    - 1 global stylesheet
    - 1 constants file
    - ~252 unit tests
    - 39 visual regression baselines across 3 browsers
    - 1 GitHub Actions workflow (advisory, awaiting Linux baselines)
    - 7 commits, all clean
    - 4 real bugs caught + fixed by Playwright
    - PRF-G5-UI status: comprehensive Phase 5 implementation, Phase 5 CI wired (advisory), ready for hard-gate flip after Linux baselines.

11. **Parallel-session coordination.** S28 owned `.github/workflows/visual-regression.yml` (new) + STATUS + BACKLOG + this handoff only. No source code changes. EAL S15-S17 + parallel sessions in `src/hooks/`, `src/contexts/`, `src/components/views/HandReplayView/` are untouched. Top-entry succession on STATUS: EAL S14 → PRF S20 → EAL S15 → EAL S16 → EAL S17 → PRF S21 → EAL S17 visual-verification → PRF S22 → PRF S23 → PRF S24 → PRF S25 → PRF S26 → PRF S27 → PRF S28 (this entry).

## System Model Updates Needed

Defer until larger-scope work lands. The current PRF-G5-UI run has been small additive sessions; SYSTEM_MODEL update would be cheap but premature. CI integration adds a new workflow file but doesn't change app architecture.

## Test Status

S28 net-add: **0 new unit tests; 0 new visual baselines; 0 source code changes.** The S28 deliverable is exclusively CI infrastructure (a new workflow file).

PRF unit-test scope: unchanged at 240 view-scope + 12 Settings = 252 across 16 view+settings test files.

Visual regression scope: unchanged at 42/42 test runs stable on second run (3.5m wall time) = 14 tests × 3 browsers (chromium + firefox + webkit). 39 win32 baselines committed (13 snapshot tests × 3 browsers; 14th test is behavior-only).

CI bundle-grep gate: **PASS** — no html2canvas / jspdf / pdf-lib in PRF namespace. Run via `bash scripts/check-refresher-bundle.sh`.

CI workflow: visual-regression.yml created; will activate on next PR/push to main. First run will fail with 39 missing-baseline errors (expected; advisory mode).

The known precisionAudit flake + parallel-MPMF-G5-B2 + parallel-EAL-migration test situations remain unchanged. Zero new regressions from S28.

## Verification

Workflow file is yaml-valid and structurally correct (eyeball-validated):
- 2-space indentation consistent throughout.
- `on:` triggers cover both `pull_request` and `push` to `[main]`.
- Job spec has all required fields (`name`, `runs-on`, `timeout-minutes`, `steps`).
- All `if:` conditions reference `steps.visual-test.outcome` correctly.
- `${{ }}` expression syntax is correct (no missing braces, no unquoted spaces in expressions).
- `actions/cache@v4` + `actions/upload-artifact@v4` action versions match GitHub's current LTS recommendations as of 2026-04-27.

Real-world validation will happen on the first PR/push that triggers the workflow. Until then, the workflow is dormant + ready to fire on the next git push to main or PR creation.
