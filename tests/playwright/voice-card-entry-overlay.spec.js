/**
 * voice-card-entry-overlay.spec.js — Playwright regression guard for VCE PTT placement.
 *
 * Ticket: WS-181. Gate 2 finding SC-4 (binding): the PTT button on TableView
 * must NOT physically overlap any other clickable element. A prior bottom-right
 * placement landed inside the `Next Hand` button's bbox (a destructive primary
 * CTA — easy to mis-tap, hard to undo). This spec enumerates every clickable
 * on TableView at the reference 1600×720 viewport and asserts zero overlap
 * with the rendered PTT bbox.
 *
 * The spec also enables the VCE feature flag at runtime via the Settings UI
 * (default is OFF — R3 ship-or-drop). No localStorage / IDB seeding required;
 * the flag persists once toggled.
 *
 * Future regressions to catch:
 *   - Anyone moving the PTT placement classes back to bottom-right.
 *   - Future TableView layout that pushes a new clickable into the
 *     y=52–188 right-edge band that the placement currently occupies.
 *
 * Cross-browser scope: chromium-only — matches existing visual specs in this
 * directory. The overlap geometry is layout-driven, not rendering-driven, so
 * a single browser is sufficient.
 */

import { test, expect } from '@playwright/test';

const TABLEVIEW_HASH = '#table';
const SETTINGS_HASH = '#settings';

test.describe('voice card entry overlay placement', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Placement geometry is layout-driven; chromium-only.');

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 720 });
    // Land on Settings, enable VCE, then jump to TableView.
    await page.goto(`/${SETTINGS_HASH}`);
    await page.locator('[data-testid="settings-voice-card-entry-section"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="settings-voice-card-entry-on"]').click();
    // Sanity check the toggle.
    await expect(page.locator('[data-testid="settings-voice-card-entry-on"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('PTT renders on TableView with zero overlap against any clickable element', async ({ page }) => {
    // Click "Back to Table" → TableView.
    await page.getByRole('button', { name: /back to table/i }).click();
    // Wait for the overlay + PTT to mount.
    await page.locator('[data-testid="voice-card-entry-overlay"]').waitFor({ state: 'attached' });
    await page.locator('[data-testid="voice-ptt-button"]').waitFor({ state: 'visible' });

    // Enumerate every clickable element outside the VCE overlay; compute
    // overlap against the PTT bbox.
    const overlapReport = await page.evaluate(() => {
      const overlay = document.querySelector('[data-testid="voice-card-entry-overlay"]');
      const ptt = document.querySelector('[data-testid="voice-ptt-button"]');
      if (!ptt) return { error: 'no-ptt' };
      const pttR = ptt.getBoundingClientRect();
      const clickables = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"]'));
      const overlaps = [];
      for (const el of clickables) {
        if (overlay && overlay.contains(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const intersects = !(pttR.right < r.left || pttR.left > r.right || pttR.bottom < r.top || pttR.top > r.bottom);
        if (intersects) {
          overlaps.push({
            label: (el.textContent || '').trim().slice(0, 60) || el.getAttribute('aria-label') || el.tagName,
            rect: { l: r.left, t: r.top, r: r.right, b: r.bottom },
          });
        }
      }
      return {
        pttRect: { l: pttR.left, t: pttR.top, r: pttR.right, b: pttR.bottom },
        overlaps,
      };
    });

    expect(overlapReport.error, 'PTT button should be in the DOM').toBeUndefined();
    // The load-bearing assertion: zero overlap.
    expect(
      overlapReport.overlaps,
      `PTT (${JSON.stringify(overlapReport.pttRect)}) overlaps ${overlapReport.overlaps?.length} element(s): ${JSON.stringify(overlapReport.overlaps)}`,
    ).toEqual([]);
  });

  test('PTT remains ≥44 visual-px (H-ML06 binding)', async ({ page }) => {
    await page.getByRole('button', { name: /back to table/i }).click();
    const ptt = page.locator('[data-testid="voice-ptt-button"]');
    await ptt.waitFor({ state: 'visible' });
    const box = await ptt.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('overlay is absent on Settings view (E-5 state-aware gate)', async ({ page }) => {
    // We're still on Settings (from beforeEach). The overlay should not be in
    // the DOM since the state-aware predicate gates on currentView === TABLE.
    await page.waitForTimeout(150); // settle
    await expect(page.locator('[data-testid="voice-card-entry-overlay"]')).toHaveCount(0);
  });
});
