#!/usr/bin/env node
/**
 * verify-harness.mjs — Automated visual verification of the side panel harness.
 *
 * Launches a Chromium browser, navigates to the harness, clicks through
 * every static fixture AND every temporal scenario, takes screenshots,
 * and reports any anomalies detected by the anomaly detector.
 *
 * Usage:
 *   1. Build the harness:  npm run harness:build  (or node side-panel/harness/build-harness.mjs)
 *   2. Start the server:   npx serve side-panel/harness/dist -l 3333
 *   3. Run this script:    node side-panel/harness/verify-harness.mjs
 *
 * Or all-in-one:  npm run harness:verify  (if wired in package.json)
 *
 * Outputs screenshots to side-panel/harness/screenshots/
 */

import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = resolve(__dirname, 'screenshots');
const HARNESS_URL = 'http://localhost:3333';
const DIST_DIR = resolve(__dirname, 'dist');

// ── Helpers ──────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Build harness if needed ──────────────────────────────────────────────

if (!existsSync(resolve(DIST_DIR, 'index.html'))) {
  console.log('[verify] Building harness...');
  execSync('node side-panel/harness/build-harness.mjs', {
    cwd: resolve(__dirname, '..', '..'),
    stdio: 'inherit',
  });
}

// ── Start local server ──────────────────────────────────────────────────

let server = null;
let serverReady = false;

async function startServer() {
  // Check if already running
  try {
    const res = await fetch(HARNESS_URL);
    if (res.ok) { serverReady = true; return; }
  } catch (_) { /* not running */ }

  console.log('[verify] Starting local server on port 3333...');
  server = spawn('npx', ['serve', DIST_DIR, '-l', '3333', '--no-clipboard'], {
    stdio: 'pipe',
    shell: true,
  });

  // Wait for server to be ready
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const res = await fetch(HARNESS_URL);
      if (res.ok) { serverReady = true; return; }
    } catch (_) { /* retry */ }
  }
  throw new Error('Server failed to start within 15s');
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  ensureDir(SCREENSHOT_DIR);
  await startServer();

  console.log('[verify] Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await context.newPage();

  let totalScreenshots = 0;
  let totalAnomalies = 0;
  const results = { static: [], temporal: [] };

  try {
    await page.goto(HARNESS_URL, { waitUntil: 'networkidle' });
    console.log('[verify] Harness loaded.\n');

    // ── Phase 1: Static fixtures ──────────────────────────────────────

    console.log('=== STATIC FIXTURES ===\n');
    const staticButtons = await page.$$('.scenario-btn:not(.temporal-btn)');
    console.log(`Found ${staticButtons.length} static fixtures.\n`);

    for (const btn of staticButtons) {
      const name = await btn.getAttribute('data-scenario');
      await btn.click();
      await sleep(200); // Let render settle

      const screenshotPath = resolve(SCREENSHOT_DIR, `static-${name}.png`);
      // Screenshot just the panel content area
      const panel = await page.$('.panel-content');
      if (panel) {
        await panel.screenshot({ path: screenshotPath });
      } else {
        await page.screenshot({ path: screenshotPath });
      }
      totalScreenshots++;

      // Check for visible content
      const streetCardText = await page.$eval('#street-card', el => el.textContent.trim().slice(0, 60)).catch(() => '(empty)');
      const headerText = await page.$eval('#unified-header', el => el.textContent.trim().slice(0, 60)).catch(() => '(empty)');
      const hasContent = streetCardText.length > 0 || headerText.length > 0;

      const status = hasContent ? 'OK' : 'EMPTY';
      console.log(`  [${status}] ${name}`);
      if (streetCardText) console.log(`         card: ${streetCardText}`);

      results.static.push({ name, status, streetCardText, headerText, screenshotPath });
    }

    // ── Phase 2: Temporal scenarios ───────────────────────────────────

    console.log('\n=== TEMPORAL SCENARIOS ===\n');
    const temporalButtons = await page.$$('.temporal-btn');
    console.log(`Found ${temporalButtons.length} temporal scenarios.\n`);

    for (const btn of temporalButtons) {
      const name = await btn.getAttribute('data-scenario');
      const label = await btn.textContent();
      console.log(`  [PLAY] ${label} (${name})`);

      // Click to start the temporal scenario
      await btn.click();

      // Wait for it to complete (poll data-state on #temporal-status)
      let done = false;
      let elapsed = 0;
      const maxWait = 30000;
      while (!done && elapsed < maxWait) {
        await sleep(300);
        elapsed += 300;
        const state = await page.$eval('#temporal-status', el => el.dataset.state).catch(() => 'unknown');
        done = state === 'done';
      }

      if (!done) {
        console.log(`    TIMEOUT waiting for scenario to complete`);
      }

      // Screenshot final state
      const screenshotPath = resolve(SCREENSHOT_DIR, `temporal-${name}.png`);
      const panel = await page.$('.panel-content');
      if (panel) {
        await panel.screenshot({ path: screenshotPath });
      }
      totalScreenshots++;

      // Read completion status
      const statusText = await page.$eval('#temporal-status', el => el.textContent).catch(() => '');

      // Read anomaly alerts
      const anomalies = await page.$$eval('.anomaly-badge', els =>
        els.map(el => ({
          text: el.textContent,
          severity: el.classList.contains('anomaly-error') ? 'error' : 'warning',
          step: el.dataset.stepIndex,
        }))
      ).catch(() => []);

      // Read telemetry summary
      const telemetryRows = await page.$$eval('.telemetry-row', els =>
        els.map(el => ({
          text: el.textContent,
          skipped: el.classList.contains('skipped'),
        }))
      ).catch(() => []);

      const skipCount = telemetryRows.filter(r => r.skipped).length;
      const renderCount = telemetryRows.length;
      const errorCount = anomalies.filter(a => a.severity === 'error').length;
      const warnCount = anomalies.filter(a => a.severity === 'warning').length;
      totalAnomalies += errorCount;

      const resultStatus = errorCount > 0 ? 'FAIL' : warnCount > 0 ? 'WARN' : 'PASS';
      console.log(`    [${resultStatus}] ${statusText}`);
      console.log(`         renders: ${renderCount}, skipped: ${skipCount}`);
      if (anomalies.length > 0) {
        for (const a of anomalies) {
          const icon = a.severity === 'error' ? 'X' : '!';
          console.log(`         [${icon}] ${a.text}`);
        }
      }

      // Step-by-step screenshots for screenshot-marked steps
      // (Already captured final; for detailed analysis, use manual step mode)

      results.temporal.push({
        name, label, resultStatus, statusText,
        renderCount, skipCount, anomalies, screenshotPath,
      });
    }

    // ── Summary ───────────────────────────────────────────────────────

    console.log('\n=== SUMMARY ===\n');
    console.log(`Screenshots: ${totalScreenshots} (saved to ${SCREENSHOT_DIR})`);
    console.log(`Static fixtures: ${results.static.length}`);
    console.log(`Temporal scenarios: ${results.temporal.length}`);

    const failedTemporal = results.temporal.filter(r => r.resultStatus === 'FAIL');
    const warnedTemporal = results.temporal.filter(r => r.resultStatus === 'WARN');

    if (failedTemporal.length > 0) {
      console.log(`\nFAILED scenarios (${failedTemporal.length}):`);
      for (const f of failedTemporal) {
        console.log(`  - ${f.label}: ${f.anomalies.filter(a => a.severity === 'error').map(a => a.text).join('; ')}`);
      }
    }
    if (warnedTemporal.length > 0) {
      console.log(`\nWARNED scenarios (${warnedTemporal.length}):`);
      for (const w of warnedTemporal) {
        console.log(`  - ${w.label}: ${w.anomalies.map(a => a.text).join('; ')}`);
      }
    }
    if (failedTemporal.length === 0 && warnedTemporal.length === 0) {
      console.log('\nAll scenarios passed with no anomalies.');
    }

    console.log('');
    return totalAnomalies;

  } finally {
    await browser.close();
    if (server) {
      server.kill();
      console.log('[verify] Server stopped.');
    }
  }
}

main()
  .then(anomalyCount => {
    process.exit(anomalyCount > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error('[verify] Fatal error:', err.message);
    process.exit(2);
  });
