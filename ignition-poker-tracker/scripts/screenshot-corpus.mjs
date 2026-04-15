#!/usr/bin/env node
/**
 * screenshot-corpus.mjs — SR-3 Stage 3 capture tool.
 *
 * Starts a static file server on the prebuilt replay harness (dist/), launches
 * Playwright (chromium, 400x720 viewport), and for each corpus S1–S5:
 *   1. Navigates to the harness page (fresh page per corpus → fresh IIFE)
 *   2. Calls window.__replay.loadCorpus(id)
 *   3. Steps through events one at a time, screenshotting after each
 *      snapshot/fast_snapshot event (+ one final frame after drain)
 *   4. Writes PNGs to docs/sidebar-inventory/<id>/<NN>-<cursor>-<type>.png
 *
 * Prereqs:
 *   npm run replay:harness:build   (generates dist/)
 *   # chromium binary — installed via `npx playwright install chromium` if missing
 *
 * Run:
 *   npm run replay:screenshots
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'side-panel', 'replay-harness', 'dist');
const OUT = resolve(ROOT, '..', '.claude', 'projects', 'sidebar-rebuild', 'screenshots');
const PORT = 3347;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
};

function startServer(root) {
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
      const filePath = join(root, decodeURIComponent(urlPath));
      if (!filePath.startsWith(root)) {
        res.writeHead(403).end('forbidden'); return;
      }
      const buf = await readFile(filePath);
      res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' });
      res.end(buf);
    } catch (err) {
      res.writeHead(404).end(String(err && err.message || err));
    }
  });
  return new Promise((ok) => server.listen(PORT, () => ok(server)));
}

async function captureCorpus(browser, id) {
  const corpusDir = join(OUT, id);
  await mkdir(corpusDir, { recursive: true });

  const context = await browser.newContext({ viewport: { width: 400, height: 720 } });
  const page = await context.newPage();
  const consoleLog = [];
  page.on('console', (msg) => consoleLog.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => consoleLog.push(`[pageerror] ${err.message}`));

  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => !!window.__replay, null, { timeout: 5000 });

  const meta = await page.evaluate(async (corpusId) => window.__replay.loadCorpus(corpusId), id);
  console.log(`[${id}] loaded: ${meta.eventCount} events — ${meta.label}`);

  // Initial frame before any step.
  await page.screenshot({ path: join(corpusDir, `00-init.png`) });

  const frames = [];
  let n = 1;
  while (true) {
    const step = await page.evaluate(async () => window.__replay.stepNext());
    if (!step) break;
    const shouldShoot = step.type === 'snapshot' || step.type === 'fast_snapshot' || step.type === 'final_drain';
    if (shouldShoot) {
      const label = `${String(n).padStart(2, '0')}-cur${step.index}-${step.type}.png`;
      await page.screenshot({ path: join(corpusDir, label) });
      const snap = await page.evaluate(() => window.__replay.snapshotLabel());
      frames.push({ file: label, step, snap });
      n++;
    }
  }

  await writeFile(join(corpusDir, 'frames.json'), JSON.stringify({ id, label: meta.label, frames }, null, 2));
  await writeFile(join(corpusDir, 'console.log'), consoleLog.join('\n'));

  console.log(`[${id}] ${frames.length} frames captured → ${corpusDir}`);
  await context.close();
}

async function main() {
  if (!existsSync(DIST)) {
    console.error(`Missing ${DIST}. Run: npm run replay:harness:build`);
    process.exit(1);
  }
  await mkdir(OUT, { recursive: true });

  const server = await startServer(DIST);
  console.log(`[server] http://localhost:${PORT}/ (root: ${DIST})`);

  const browser = await chromium.launch();
  try {
    for (const id of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13']) {
      await captureCorpus(browser, id);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
