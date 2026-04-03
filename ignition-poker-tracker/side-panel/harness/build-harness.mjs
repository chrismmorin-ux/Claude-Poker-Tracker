/**
 * build-harness.mjs — Build the visual test harness.
 *
 * 1. Reads side-panel.html to extract the <style> block and <body> structure
 * 2. Bundles harness.js with esbuild (resolves all ES module imports)
 * 3. Generates a self-contained harness/dist/index.html
 */

import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, 'dist');
const SIDE_PANEL_HTML = resolve(__dirname, '..', 'side-panel.html');

// Clean
if (existsSync(DIST)) rmSync(DIST, { recursive: true });
mkdirSync(DIST, { recursive: true });

// ── 1. Extract CSS and body from side-panel.html ──
const html = readFileSync(SIDE_PANEL_HTML, 'utf8');

// Extract everything between <style> and </style>
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
const cssContent = styleMatch ? styleMatch[1] : '';

// Extract body content (between <body> and the <script> tags)
const bodyMatch = html.match(/<body>([\s\S]*?)(?=\s*<script)/);
const bodyContent = bodyMatch ? bodyMatch[1] : '';

// ── 2. Bundle harness.js ──
await esbuild.build({
  entryPoints: [resolve(__dirname, 'harness.js')],
  outfile: resolve(DIST, 'harness.js'),
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  minify: false,
});

console.log('[harness] Bundled harness.js');

// ── 3. Generate index.html ──
const harnessHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Side Panel Test Harness</title>
  <style>
    /* ── Harness layout ── */
    html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
    .harness-layout {
      display: flex;
      height: 100vh;
      background: #0d0d1a;
      font-family: 'Segoe UI', system-ui, sans-serif;
    }
    .scenario-sidebar {
      width: 220px;
      background: #111827;
      border-right: 1px solid #2a2a4a;
      padding: 12px;
      overflow-y: auto;
      flex-shrink: 0;
    }
    .scenario-sidebar h2 {
      color: #d4a847;
      font-size: 13px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .scenario-btn {
      display: block;
      width: 100%;
      background: #1e2642;
      color: #e0e0e0;
      border: 1px solid #2a2a4a;
      border-radius: 6px;
      padding: 6px 10px;
      margin-bottom: 4px;
      cursor: pointer;
      font-size: 11px;
      text-align: left;
      transition: all 0.15s;
    }
    .scenario-btn:hover { border-color: #d4a847; color: #d4a847; }
    .scenario-btn.active {
      background: rgba(212, 168, 71, 0.15);
      border-color: #d4a847;
      color: #d4a847;
      font-weight: 600;
    }
    .panel-wrapper {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 16px;
      overflow-y: auto;
    }
    .panel-content {
      width: 400px;
      min-height: 600px;
      overflow-y: auto;
      max-height: calc(100vh - 80px);
      border-radius: 12px;
      box-shadow: 0 0 20px rgba(0,0,0,0.5);
    }
    .harness-info {
      color: #6b7280;
      font-size: 10px;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #2a2a4a;
    }
    #active-scenario {
      color: #d4a847;
      font-weight: 600;
    }
  </style>
  <style>
    /* ── Side panel CSS (extracted from side-panel.html) ── */
    .panel-content {
${cssContent}
    }
  </style>
</head>
<body>
  <div class="harness-layout">
    <div class="scenario-sidebar">
      <h2>Scenarios</h2>
      <div id="scenario-picker"></div>
      <div class="harness-info">
        Active: <span id="active-scenario">—</span>
        <br>Click a scenario to render it in the panel.
        <br><br>Use Playwright to screenshot each state for visual verification.
      </div>
    </div>
    <div class="panel-wrapper">
      <div class="panel-content">
${bodyContent}
      </div>
    </div>
  </div>
  <script src="harness.js"></script>
</body>
</html>`;

writeFileSync(resolve(DIST, 'index.html'), harnessHtml);
console.log('[harness] Generated index.html');
console.log('[harness] Done! Serve with: npx serve side-panel/harness/dist -l 3333');
