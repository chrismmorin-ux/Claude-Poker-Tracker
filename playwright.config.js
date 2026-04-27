/**
 * playwright.config.js — Playwright snapshot-test configuration.
 *
 * Scope (PRF-G5-PDF S23 starter): visual regression testing for the
 * Printable Refresher. Spawns the Vite dev server and exercises the
 * catalog + PrintPreview at representative grid/page/color permutations.
 *
 * Run:
 *   npm run test:visual              — run the full visual suite (compares snapshots)
 *   npm run test:visual:update       — regenerate baselines after intentional UI changes
 *   npm run test:visual:debug        — headed run for diagnosing failures
 *
 * Baseline storage: `tests/playwright/printable-refresher.spec.js-snapshots/`
 * (Playwright default; auto-created on first --update-snapshots run).
 *
 * Cross-browser (firefox + webkit) deferred to S24+ — start with chromium
 * for faster CI iteration and the most reliable @page CSS support.
 *
 * Galaxy A22 1600×720 viewport per CLAUDE.md mobile-optimized target.
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PLAYWRIGHT_PORT || 5193;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/playwright',
  testMatch: /.*\.spec\.js$/,

  // Run tests serially within a file; parallel across files is fine but a
  // shared dev server means one IDB seed at a time per worker. Keep it simple.
  fullyParallel: false,
  workers: 1,

  // Retries are off in dev so flakes surface immediately.
  retries: 0,

  // Stop on first failure when CI is set; locally allow all to run for diff.
  forbidOnly: !!process.env.CI,

  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: BASE_URL,
    // Galaxy A22 landscape — matches CLAUDE.md mobile target.
    viewport: { width: 1600, height: 720 },
    // Don't keep traces locally to avoid bloating the repo; CI can override.
    trace: 'off',
    // Screenshot only on test failure (so passing runs stay quick).
    screenshot: 'only-on-failure',
    // No video by default.
    video: 'off',
  },

  // Tighten snapshot diff thresholds — a tiny rendering shift counts as a
  // regression. PRF cards are deliberately deterministic (no animations,
  // no random IDs in DOM) so this should hold.
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
      animations: 'disabled',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 720 } },
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  // Where to put traces / screenshots / etc. when something fails.
  outputDir: 'tests/playwright/.test-results',
});
