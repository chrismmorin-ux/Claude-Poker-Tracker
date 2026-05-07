/**
 * identity-avatar-corpus.spec.js — visual regression suite for the IdentityAvatar primitive.
 *
 * Starter baseline (SPR-041 Phase 4):
 *   1. Feature Catalog — every authored variant of every category as swatches
 *   2. Real anchors grid — N=N profiles rendered at 24/48/96 px
 *   3. Synthesized profiles grid — synthesized edge-case combinations
 *
 * Why this exists. The avatar primitive is shipped engineer-art (v1) per
 * SPR-041 sprint outcome — the avataaars adoption attempt rolled back.
 * Phase 4 baselines lock the v1 visual surface so any future surgery
 * (palette reorders, silhouette tweaks, hat geometry, badge anchors)
 * surfaces in a snapshot diff before it reaches a manual eye-test.
 *
 * Mount path. The corpus auto-opens when the URL hash is `#avatar-corpus`
 * (see src/__dev__/identityAvatarCorpus.jsx). It mounts a fixed-position
 * overlay at #__identity-avatar-corpus-overlay above the app shell. Dev-mode
 * only — gated by import.meta.env.DEV in main.jsx — so this spec depends on
 * Playwright's webServer being run via `npm run dev`.
 *
 * Baseline storage: tests/playwright/identity-avatar-corpus.spec.js-snapshots/
 * (Playwright default; auto-created on first --update-snapshots run).
 *
 * Cross-browser scope. Chromium only for the starter pattern (mirrors PRF
 * S23). The avatar SVGs use color-mix() and CSS custom properties; firefox
 * + webkit may diff enough to require relaxed thresholds beyond what's set
 * in playwright.config.js. Add cross-browser projects in a follow-up if the
 * avatar surface stays load-bearing.
 */

import { test, expect } from '@playwright/test';

const HASH_ROUTE = '#avatar-corpus';
const OVERLAY_SELECTOR = '#__identity-avatar-corpus-overlay';

test.describe('identity avatar corpus', () => {
  test.beforeEach(async ({ page }) => {
    // Boot the app shell first, then jump to the corpus hash route.
    // The hash listener is on a setTimeout(0) so we wait for the overlay
    // to mount rather than racing the load event.
    await page.goto(`/${HASH_ROUTE}`);
    await page.locator(OVERLAY_SELECTOR).waitFor({ state: 'attached' });
    // Settle: wait for the corpus header to render. The Vite dev server
    // keeps an HMR websocket open so 'networkidle' never resolves; the
    // overlay's own DOM is the authoritative readiness signal.
    await page.getByRole('heading', { name: /Identity Avatar Corpus/i })
      .waitFor({ state: 'visible' });
  });

  test('feature catalog renders every authored variant', async ({ page }) => {
    // Heading-anchored region: the FeatureCatalog block under the corpus header.
    // Section starts at the "Feature Catalog" h1 and runs to the next h2 ("Real anchors").
    const heading = page.getByRole('heading', { name: /Feature Catalog/i });
    await heading.waitFor({ state: 'visible' });
    // Snapshot the parent .ancestor div that wraps the catalog (a styled
    // section with bg #fffefa per identityAvatarCorpus.jsx).
    const catalog = heading.locator('xpath=ancestor::div[1]');
    await expect(catalog).toHaveScreenshot('feature-catalog.png', {
      // Allow the inline-styled section to render at its natural height.
      // No animations to disable on this surface.
    });
  });

  test('real anchor profiles grid', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /Real anchors/i });
    await heading.waitFor({ state: 'visible' });
    // Snapshot the immediately-following grid div (sibling of the heading).
    const grid = heading.locator('xpath=following-sibling::div[1]');
    await expect(grid).toHaveScreenshot('anchors-grid.png');
  });

  test('synthesized profiles grid', async ({ page }) => {
    const heading = page.getByRole('heading', { name: /Synthesized profiles/i });
    await heading.waitFor({ state: 'visible' });
    const grid = heading.locator('xpath=following-sibling::div[1]');
    await expect(grid).toHaveScreenshot('synth-grid.png');
  });
});
