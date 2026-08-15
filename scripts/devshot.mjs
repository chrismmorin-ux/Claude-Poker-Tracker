/**
 * devshot.mjs — drive the running dev server in a real browser and capture screenshots.
 *
 * Exists because the Table View Redesign (TVR) kickoff could not verify a single
 * visual claim: the app would not boot in this environment, so Gate 1 was written
 * entirely from code reading and the founder had to supply phone screenshots by hand.
 * That is the gap this closes.
 *
 * The app is IndexedDB-first and has a real guest mode (GUEST_USER_ID), so it runs
 * fully without Firebase credentials — placeholder values in .env.local are enough to
 * get past module init, and `onAuthStateChanged` then fires with null (guest) from
 * local persistence without any network call. No production code is stubbed or mocked.
 *
 * Usage:
 *   npm run dev                                  # terminal 1
 *   node scripts/devshot.mjs                     # terminal 2 — default flow
 *   node scripts/devshot.mjs --out /tmp/shots    # custom output dir
 *   node scripts/devshot.mjs --w 1600 --h 720    # custom viewport
 *   node scripts/devshot.mjs --portrait          # portrait viewport (orientation-gate repro)
 *   node scripts/devshot.mjs --keep-open         # leave the browser up for manual poking
 *
 * Output: numbered PNGs plus console/pageerror logs printed to stdout.
 */

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);

const PORTRAIT = has('portrait');
const OUT = resolve(flag('out', './.devshots'));
const URL = flag('url', 'http://127.0.0.1:5173/');
const WIDTH = Number(flag('w', PORTRAIT ? 720 : 1600));
const HEIGHT = Number(flag('h', PORTRAIT ? 1600 : 720));

mkdirSync(OUT, { recursive: true });

let step = 0;
const shot = async (page, name) => {
  step += 1;
  const file = `${OUT}/${String(step).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: file });
  console.log(`  📸 ${file}`);
  return file;
};

// ---------------------------------------------------------------------------
// launch
// ---------------------------------------------------------------------------
const browser = await chromium.launch({
  // undefined → Playwright resolves its own managed Chromium (cross-platform);
  // PLAYWRIGHT_CHROMIUM_PATH overrides for sandboxed/system installs.
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: Number(flag('dpr', 1)),
});
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => {
  errors.push(String(e));
  console.log('  ❌ pageerror:', String(e).slice(0, 300));
});
page.on('console', (m) => {
  if (m.type() === 'error') console.log('  ⚠️  console.error:', m.text().slice(0, 300));
});

console.log(`\n▶ ${URL}  @ ${WIDTH}×${HEIGHT}${PORTRAIT ? ' (portrait)' : ''}\n`);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

// The first paint is blank while IndexedDB upgrades (v0 → v27 on a cold profile).
// Wait for real rendered text rather than a fixed timeout.
try {
  await page.waitForFunction(
    () => (document.body?.innerText || '').trim().length > 0,
    { timeout: 45000 },
  );
} catch {
  console.log('  ⚠️  no text rendered within 45s — capturing anyway');
}
await page.waitForTimeout(1500);

await shot(page, PORTRAIT ? 'boot-portrait' : 'boot');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const tap = async (selectorOrText, { label, timeout = 8000 } = {}) => {
  const loc = selectorOrText.startsWith('text=') || selectorOrText.startsWith('#') || selectorOrText.startsWith('.') || selectorOrText.startsWith('[')
    ? page.locator(selectorOrText)
    : page.getByText(selectorOrText, { exact: false });
  try {
    await loc.first().click({ timeout });
    await page.waitForTimeout(900);
    if (label) await shot(page, label);
    return true;
  } catch {
    console.log(`  ⚠️  could not tap "${selectorOrText}"`);
    return false;
  }
};

// Report the rendered size of a selector — the number that actually reaches a thumb,
// which is the whole point of WS-316 (declared px ≠ rendered px under ScaledContainer).
const measure = async (selector, label) => {
  const box = await page.locator(selector).first().boundingBox().catch(() => null);
  if (!box) return console.log(`  📏 ${label}: not found (${selector})`);
  console.log(`  📏 ${label}: ${Math.round(box.width)}×${Math.round(box.height)} rendered px`);
  return box;
};

// ---------------------------------------------------------------------------
// flow
// ---------------------------------------------------------------------------
if (PORTRAIT) {
  console.log('\n▶ portrait — expecting the RotateDeviceHint gate (WS-315)\n');
  const gate = await page.getByText('Please rotate to landscape').count().catch(() => 0);
  console.log(`  rotate gate visible: ${gate > 0}`);

  // WS-315 repro: does the gate clear when the viewport becomes landscape?
  console.log('\n▶ resizing viewport to landscape (simulates rotation)…\n');
  await page.setViewportSize({ width: 1600, height: 720 });
  await page.waitForTimeout(1500);
  await shot(page, 'after-rotate-to-landscape');
  const stillGated = await page.getByText('Please rotate to landscape').isVisible().catch(() => false);
  console.log(`  gate STILL visible after rotate: ${stillGated}  ${stillGated ? '← reproduces the founder report' : '← gate cleared (symptom is elsewhere)'}`);
} else {
  console.log('\n▶ navigating to the live table\n');
  await tap('Live Table', { label: 'after-live-table' });

  // A session may need starting before the table renders.
  const onTable = await page.locator('text=Next Hand').count().catch(() => 0);
  if (!onTable) {
    console.log('  (no table yet — session-start flow may be in the way)');
    await shot(page, 'session-gate');
  } else {
    await shot(page, 'table');

    console.log('\n▶ measuring rendered control sizes (WS-441, re-file of WS-316)\n');
    await page.evaluate(() => {
      const el = document.querySelector('[style*="scale("]');
      const t = el && getComputedStyle(el).transform;
      console.log('[devshot] canvas transform:', t);
    });
    const s = await page.evaluate(() => {
      const el = document.querySelector('[style*="scale("]');
      if (!el) return null;
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return m.a;
    });
    console.log(`  📐 ScaledContainer scale factor: ${s ?? 'not found'}`);
    if (s) console.log(`  📐 a declared 44px target renders at ~${(44 * s).toFixed(1)} CSS px`);

    await measure('button:has-text("Next Hand")', 'Next Hand CTA');

    // WS-311: is the primary CTA actually inside the viewport?
    const box = await page.locator('button:has-text("Next Hand")').first().boundingBox().catch(() => null);
    if (box) {
      const vh = page.viewportSize().height;
      const clipped = box.y + box.height > vh;
      console.log(`  🎯 Next Hand bottom edge: ${Math.round(box.y + box.height)}px vs viewport ${vh}px — ${clipped ? 'CLIPPED (WS-311 reproduces)' : 'visible'}`);
    }
  }
}

console.log(`\n✅ done — ${step} screenshot(s) in ${OUT}`);
console.log(`   pageerrors: ${errors.length}`);

if (has('keep-open')) {
  console.log('\n   --keep-open set; browser stays up. Ctrl-C to exit.\n');
  await new Promise(() => {});
}

await browser.close();
