/**
 * self-coach-view.spec.js — visual regression baseline for SelfCoachView (Phase-5a slice).
 *
 * Phase-5a snapshots (SPR-042 / WS-159, 2026-05-06):
 *   1. curriculum-tab-collapsed — initial render; descriptor header + all
 *      umbrellas collapsed; tier-grouped tree visible.
 *   2. curriculum-tab-cbet-expanded — after tapping the cbet-defense-cluster
 *      umbrella; sub-concept rows visible (some with "Lesson coming" tags).
 *   3. composition-inspector-open — after tapping a composite-score badge;
 *      4-field CD-5 inspector inline-expanded.
 *   4. settings-tab — owner-tier radio + signal toggles + signal weight
 *      sliders rendered.
 *
 * Mount path. SelfCoachView opens from #selfCoach hash route (registered in
 * src/PokerTracker.jsx HASH_TO_SCREEN). Spec navigates via that hash.
 *
 * Cross-browser scope. Chromium-only — matches the SPR-041 IdentityAvatar
 * + PRF S23 starter precedent. SelfCoachView relies on inline-styled rows +
 * monospace numerics; firefox + webkit may diff enough to require relaxed
 * thresholds. Add cross-browser projects in a follow-up if the surface stays
 * load-bearing.
 */

import { test, expect } from '@playwright/test';

const HASH_ROUTE = '#selfCoach';

test.describe('self coach view', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Phase-5a baseline is chromium-only.');

  test.beforeEach(async ({ page }) => {
    await page.goto(`/${HASH_ROUTE}`);
    // SelfCoachView is lazy-loaded; wait for the test-id container to mount.
    await page.locator('[data-testid="self-coach-view"]').waitFor({ state: 'attached' });
    await page.locator('[data-testid="self-coach-curriculum-tab"]').waitFor({ state: 'visible' });
    // Wait for the descriptor (which appears once mastery loads) so we don't
    // snapshot the loading state.
    await page.locator('[data-testid="curriculum-descriptor"]').waitFor({ state: 'visible' });
  });

  test('curriculum tab collapsed', async ({ page }) => {
    const view = page.locator('[data-testid="self-coach-view"]');
    await expect(view).toHaveScreenshot('curriculum-tab-collapsed.png');
  });

  test('curriculum tab cbet expanded', async ({ page }) => {
    // Toggle the cbet-defense-cluster umbrella; sub-concepts render below.
    await page.locator('[data-testid="concept-row-cbet-defense-cluster-toggle"]').click();
    await page.locator('[data-testid="concept-row-ip-cbet-defense-dry-LATE"]').waitFor({ state: 'visible' });
    const view = page.locator('[data-testid="self-coach-view"]');
    await expect(view).toHaveScreenshot('curriculum-tab-cbet-expanded.png');
  });

  test('composition inspector open', async ({ page }) => {
    // Tap a composite badge on a leaf row (pot-odds is at Tier 1 + always present).
    await page.locator('[data-testid="concept-row-pot-odds-composite-badge"]').click();
    await page.locator('[data-testid="composition-inspector"]').waitFor({ state: 'visible' });
    const view = page.locator('[data-testid="self-coach-view"]');
    await expect(view).toHaveScreenshot('composition-inspector-open.png');
  });

  test('settings tab', async ({ page }) => {
    await page.locator('[data-testid="self-coach-tab-settings"]').click();
    await page.locator('[data-testid="self-coach-settings-tab"]').waitFor({ state: 'visible' });
    const view = page.locator('[data-testid="self-coach-view"]');
    await expect(view).toHaveScreenshot('settings-tab.png');
  });
});
