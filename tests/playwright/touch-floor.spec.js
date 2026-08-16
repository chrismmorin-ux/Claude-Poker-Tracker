/**
 * touch-floor.spec.js — WS-441: rendered-px enforcement of the 44px touch floor.
 *
 * THE INSTRUMENT THIS REPO WAS MISSING. Every in-hand control lives inside a
 * 1600×720 design canvas under `transform: scale(s)` (src/hooks/useCanvasFit.js),
 * so a declared `44px` is delivered as `44·s` — 41.8px even on the design canvas
 * (s=0.95) and ~30.6px on the founder's phone (provisional s≈0.695). Twelve jsdom
 * tests asserting `minHeight: 44px` pass while the real target misses the floor;
 * jsdom has no layout engine and cannot see the ancestor transform. Playwright's
 * `boundingBox()` returns post-transform CSS px — the honest measurement.
 * AUDIT-2026-04-21-TV F8 shipped "44px targets" with no such instrument; this
 * spec exists so that class of believed-shipped fix cannot recur.
 *
 * Roster discipline (mirrors src/test/viewScrollContainers.test.js): subjects are
 * DERIVED — every visible `button/input/select` inside `[data-testid="command-column"]`
 * (TableView) — so a newly added control is measured automatically and cannot opt
 * out by being new. An anti-vacuity guard fails the suite if the roster collapses.
 *
 * PINNED ledger (invariantMatrix `pinned_bug` semantics): controls deliberately
 * NOT raised by WS-441's interim mitigation are locked at today's rendered size
 * (regression floor) and named to WS-489, the layout migration that un-scales the
 * column and flips every pin to must-pass. A pinned control that starts PASSING
 * fails the stale-pin meta-check — pins may only shrink, never linger.
 *
 * Device profiles: tests/playwright/deviceProfiles.mjs — the S22 dpr is
 * PROVISIONAL; correcting it from /device-probe.html changes that one file.
 *
 * Chromium-only: geometry is layout-driven, not rendering-driven (same rationale
 * as voice-card-entry-overlay.spec.js).
 */

import { test, expect } from '@playwright/test';
import { DEVICE_PROFILES, TOUCH_FLOOR_CSS_PX } from './deviceProfiles.mjs';

// TableView has no deep-link hash (viewRegistry.jsx) — it is entered from the
// Homebase "Live Table" tile, which starts a live session.
async function gotoTableView(page) {
  await page.goto('/');
  await page.getByRole('button', { name: /live table/i }).click();
}

// key: exact data-testid, or a RegExp tested against the control's visible label.
// minToday: today's measured rendered floor at the galaxyS22 profile (regression
// lock — the control may not shrink further while it waits for WS-489).
const PINNED = [
  { match: /^ALL[\s-]?IN/i, minToday: 34, reason: 'collapsed all-in toggle, 56 design px', ticket: 'WS-489' },
  { match: /^(Clear Seat|Undo|Tag for Review|Undo Seat|Deselect|Absent|Reset Street)/i, minToday: 29, reason: 'ControlZone secondary row, 48 design px', ticket: 'WS-489' },
  { match: /^Reset Hand/i, minToday: 24, reason: 'deliberately de-emphasized destructive action, 40 design px', ticket: 'WS-489' },
];

const findPin = (key) => PINNED.find((p) => p.match.test(key));

async function measureRoster(page, rootSelector) {
  const root = page.locator(rootSelector);
  await root.waitFor({ state: 'visible' });
  const controls = root.locator('button, [role="button"], input, select');
  const n = await controls.count();
  const rows = [];
  for (let i = 0; i < n; i++) {
    const el = controls.nth(i);
    const box = await el.boundingBox();
    if (!box || box.width === 0 || box.height === 0) continue; // hidden state variant
    const testid = await el.getAttribute('data-testid');
    const label = (await el.innerText().catch(() => '')).trim().replace(/\s+/g, ' ');
    rows.push({ key: testid || label || `unnamed#${i}`, box });
  }
  return rows;
}

// `binding` = the worst-scale profile (galaxyS22). Pins encode "below floor at
// the DEVICE profile"; at milder profiles a pinned control passing the floor is
// expected, so the stale-pin meta-check only runs on the binding profile.
function assertFloor(rows, profileName, { binding }) {
  const failures = [];
  const stalePins = [];
  for (const { key, box } of rows) {
    const m = Math.min(box.width, box.height);
    const pin = findPin(key);
    if (pin) {
      if (m >= TOUCH_FLOOR_CSS_PX) {
        if (binding) stalePins.push(`${key} (${m.toFixed(1)}px — passes; remove its pin)`);
      } else {
        expect
          .soft(m, `pinned control "${key}" shrank below its regression floor (${pin.reason}, ${pin.ticket})`)
          .toBeGreaterThanOrEqual(pin.minToday);
      }
    } else if (m < TOUCH_FLOOR_CSS_PX) {
      failures.push(`${key}: ${box.width.toFixed(1)}×${box.height.toFixed(1)}`);
    }
  }
  expect(failures, `controls below the ${TOUCH_FLOOR_CSS_PX}px rendered touch floor @ ${profileName}`).toEqual([]);
  expect(stalePins, `pinned controls now pass @ ${profileName} — remove their pins`).toEqual([]);
}

test.describe('touch floor (rendered px)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Geometry is layout-driven; chromium-only.');

  for (const [profileName, profile] of Object.entries(DEVICE_PROFILES)) {
    test(`TableView command column ≥ ${TOUCH_FLOOR_CSS_PX}px @ ${profileName} (${profile.viewport.width}×${profile.viewport.height})`, async ({ page }) => {
      await page.setViewportSize(profile.viewport);
      await gotoTableView(page);
      const rows = await measureRoster(page, '[data-testid="command-column"]');
      // Anti-vacuity: street tabs (5) + control zone + Next Hand alone exceed this.
      expect(rows.length, 'derived roster went vacuous — selector or view broke').toBeGreaterThan(8);
      assertFloor(rows, profileName, { binding: profileName === 'galaxyS22' });

      // Pinned-anchor visibility (table-view-geometry.md Overflow contract): the
      // street tabs and the Next Hand CTA must be FULLY inside the viewport —
      // boundingBox() happily measures off-screen elements, and the first run of
      // this suite passed while Next Hand sat 124px below the fold (caught by
      // devshot, 2026-08-15). Only the middle band may overflow.
      for (const anchor of [/^Pre$/i, /next hand/i]) {
        const el = page.locator('[data-testid="command-column"]').getByText(anchor).first();
        const box = await el.boundingBox();
        expect(box, `pinned anchor ${anchor} not rendered`).not.toBeNull();
        expect(box.y, `pinned anchor ${anchor} clipped above viewport`).toBeGreaterThanOrEqual(0);
        expect(
          box.y + box.height,
          `pinned anchor ${anchor} clipped below the ${profile.viewport.height}px viewport`
        ).toBeLessThanOrEqual(profile.viewport.height + 0.5);
      }
    });
  }

  // State-dependent controls (action grid, sizing presets, custom input + GO,
  // all-in form) render only mid-hand with a seat selected; the HandReplay
  // transport requires a recorded hand (no deep-link hash exists for the view).
  // Driving that state end-to-end is WS-489 Phase B's accept criterion — until
  // then their DECLARED sizes are raised by WS-441's mitigation and reviewed by
  // `npm run devshot`. Recorded here as fixme, not silently skipped.
  test.fixme(
    'mid-hand controls (action grid, sizing panel) + HandReplay transport measured e2e',
    async () => {}
  );
});
