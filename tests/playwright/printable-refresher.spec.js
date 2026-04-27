/**
 * printable-refresher.spec.js — visual regression suite for the Printable Refresher.
 *
 * Starter baseline (PRF-G5-PDF S23):
 *   1. Catalog default state (6 math cards, no banner, no filter).
 *   2. PrintPreview at default (12-up Letter, Color (auto), Lineage on) — all 6 cards on 1 page.
 *   3. PrintPreview at 4-up Letter Color — 6 cards across 2 pages.
 *   4. PrintPreview at 1-up Letter B&W — single card per page.
 *   5. PrintConfirmationModal opened on top of PrintPreview.
 *   6. Catalog with StalenessBanner visible (after IDB seeding).
 *
 * Pattern documented for S24+ extension:
 *   - Each test seeds IDB to a known state via `page.evaluate()` BEFORE the
 *     dev-server hydrates the persistence hook. We use `page.goto()` after
 *     seeding so the React mount picks up the seeded state on hydrate.
 *   - Snapshots target stable DOM regions (e.g. the catalog list, the
 *     `.print-preview-container` wrapper) rather than full-viewport screenshots
 *     to keep baselines tight against scroll-position drift.
 *   - `expect(page).toHaveScreenshot('name.png')` auto-stores under
 *     `printable-refresher.spec.js-snapshots/`.
 *
 * Cross-browser snapshots (firefox + webkit) deferred to S24+ — start with
 * chromium for the most reliable `@page` CSS support and faster iteration.
 */

import { test, expect } from '@playwright/test';

const HASH_ROUTE = '#printableRefresher';

/**
 * Reset the Printable Refresher slice in IDB. Each test's `page.goto`
 * happens AFTER this resolves so React's persistence hook hydrates from
 * the freshly-seeded state.
 */
async function resetRefresherIDB(page) {
  await page.goto('/');
  await page.evaluate(async () => {
    const DB_NAME = 'PokerTrackerDB';
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction(['userRefresherConfig', 'printBatches'], 'readwrite');
    const cfg = await new Promise((res, rej) => {
      const r = tx.objectStore('userRefresherConfig').get('singleton');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    if (cfg) {
      cfg.cardVisibility = {};
      cfg.suppressedClasses = [];
      cfg.notifications = { staleness: false };
      cfg.printPreferences = {
        pageSize: 'letter',
        cardsPerSheet: 12,
        colorMode: 'auto',
        includeLineage: true,
        includeCodex: false,
      };
      cfg.lastExportAt = null;
      await new Promise((res, rej) => {
        const r = tx.objectStore('userRefresherConfig').put(cfg);
        r.onsuccess = () => res();
        r.onerror = () => rej(r.error);
      });
    }
    // Wipe printBatches store
    await new Promise((res, rej) => {
      const r = tx.objectStore('printBatches').clear();
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  });
}

/**
 * Patch printPreferences (page size, cards per sheet, color mode) directly
 * in IDB before navigation, so PrintPreview hydrates with the desired layout
 * without needing UI clicks. Faster + less flaky than driving toggles.
 */
async function setPrintPrefs(page, prefs) {
  await page.evaluate(async ({ prefs }) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('PokerTrackerDB');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction('userRefresherConfig', 'readwrite');
    const store = tx.objectStore('userRefresherConfig');
    const cfg = await new Promise((res, rej) => {
      const r = store.get('singleton');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    cfg.printPreferences = { ...cfg.printPreferences, ...prefs };
    await new Promise((res, rej) => {
      const r = store.put(cfg);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { prefs });
}

/**
 * Seed an opted-in stale scenario: notifications.staleness=true + a stub
 * batch with diverging contentHashes so 2 cards flag as stale.
 */
async function seedStaleScenario(page) {
  await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('PokerTrackerDB');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction(['userRefresherConfig', 'printBatches'], 'readwrite');
    const cfg = await new Promise((res, rej) => {
      const r = tx.objectStore('userRefresherConfig').get('singleton');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    cfg.notifications = { ...(cfg.notifications || {}), staleness: true };
    await new Promise((res, rej) => {
      const r = tx.objectStore('userRefresherConfig').put(cfg);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      const r = tx.objectStore('printBatches').put({
        batchId: 'snap-stale-batch-1',
        printedAt: '2026-04-24T00:00:00Z',
        label: 'visual-regression',
        cardIds: ['PRF-MATH-AUTO-PROFIT', 'PRF-MATH-POT-ODDS'],
        engineVersion: 'v122',
        appVersion: 'v122',
        perCardSnapshots: {
          'PRF-MATH-AUTO-PROFIT': { contentHash: 'sha256:OLD-AUTO', version: '1' },
          'PRF-MATH-POT-ODDS': { contentHash: 'sha256:OLD-POT-ODDS', version: '1' },
        },
      });
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  });
}

/**
 * Navigate to the refresher view + wait for hydrated catalog.
 *
 * The HASH_TO_SCREEN deep-link in PokerTracker.jsx fires on mount via
 * `useEffect`, but Playwright's `page.goto` with a hash-only change doesn't
 * re-trigger a full mount on a same-origin SPA, so the deep-link wouldn't
 * fire reliably. Click the sidebar "Refresher" button instead — mirrors
 * what an owner would do + always works deterministically.
 */
async function gotoRefresher(page) {
  // Reload to ensure a fresh React mount that picks up the latest IDB state.
  await page.reload();
  await page.getByRole('button', { name: 'Refresher' }).click();
  await page.getByText('Print preview →').waitFor({ state: 'visible' });
}

test.describe('PrintableRefresherView — visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await resetRefresherIDB(page);
  });

  test('catalog default — 6 math cards, no banner', async ({ page }) => {
    await gotoRefresher(page);
    // Snapshot the main view region (excludes browser chrome).
    await expect(page.getByRole('main')).toHaveScreenshot('catalog-default.png');
  });

  test('PrintPreview default — 12-up Letter Color', async ({ page }) => {
    await gotoRefresher(page);
    await page.getByLabel('Open print preview').click();
    await page.locator('.print-preview-container').waitFor({ state: 'visible' });
    await expect(page.locator('.print-preview-container')).toHaveScreenshot('print-preview-12up-letter-color.png');
  });

  test('PrintPreview — 4-up Letter Color', async ({ page }) => {
    await setPrintPrefs(page, { cardsPerSheet: 4 });
    await gotoRefresher(page);
    await page.getByLabel('Open print preview').click();
    await page.locator('.print-preview-container').waitFor({ state: 'visible' });
    await expect(page.locator('.print-preview-container')).toHaveScreenshot('print-preview-4up-letter-color.png');
  });

  test('PrintPreview — 1-up Letter B&W', async ({ page }) => {
    await setPrintPrefs(page, { cardsPerSheet: 1, colorMode: 'bw' });
    await gotoRefresher(page);
    await page.getByLabel('Open print preview').click();
    const wrapper = page.locator('.print-preview-container');
    await wrapper.waitFor({ state: 'visible' });
    // Scroll the first page into view so the snapshot is deterministic.
    await wrapper.locator('.refresher-print-page').first().scrollIntoViewIfNeeded();
    await expect(wrapper.locator('.refresher-print-page').first()).toHaveScreenshot('print-preview-1up-letter-bw-page1.png');
  });

  test('PrintConfirmationModal — opened on top of PrintPreview', async ({ page }) => {
    await gotoRefresher(page);
    await page.getByLabel('Open print preview').click();
    await page.locator('.print-preview-container').waitFor({ state: 'visible' });
    await page.getByLabel('Send to print dialog').click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    // Mask the date input value (defaults to today; would drift baselines daily).
    await expect(dialog).toHaveScreenshot('print-confirmation-modal.png', {
      mask: [dialog.getByLabel('Print date')],
    });
  });

  test('catalog — StalenessBanner visible (opt-in seeded)', async ({ page }) => {
    await seedStaleScenario(page);
    await gotoRefresher(page);
    await page.locator('.refresher-staleness-banner').waitFor({ state: 'visible' });
    await expect(page.getByRole('main')).toHaveScreenshot('catalog-staleness-banner.png');
  });
});
