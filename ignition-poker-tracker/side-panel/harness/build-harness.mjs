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
      width: 240px;
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
    .temporal-btn {
      border-left: 3px solid #6366f1;
    }
    .temporal-btn.active {
      border-left-color: #818cf8;
      background: rgba(99, 102, 241, 0.15);
      border-color: #818cf8;
      color: #a5b4fc;
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

    /* ── Temporal section ── */
    .section-divider {
      border-top: 1px solid #2a2a4a;
      margin: 12px 0 8px;
    }
    .temporal-controls {
      display: flex;
      gap: 4px;
      margin: 8px 0;
    }
    .ctrl-btn {
      flex: 1;
      background: #1e2642;
      color: #a5b4fc;
      border: 1px solid #3730a3;
      border-radius: 4px;
      padding: 4px 6px;
      font-size: 10px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .ctrl-btn:hover { background: #312e81; border-color: #6366f1; }
    .temporal-info {
      color: #9ca3af;
      font-size: 10px;
      margin: 4px 0;
      line-height: 1.4;
    }
    #temporal-step {
      color: #a5b4fc;
      font-weight: 600;
    }

    /* ── Telemetry log ── */
    .telemetry-log {
      max-height: 120px;
      overflow-y: auto;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 4px;
      padding: 4px;
      font-family: 'Consolas', monospace;
      font-size: 9px;
    }
    .telemetry-row {
      color: #94a3b8;
      padding: 1px 4px;
      border-radius: 2px;
      white-space: nowrap;
    }
    .telemetry-row.skipped {
      color: #475569;
    }

    /* ── Anomaly alerts ── */
    .anomaly-alerts {
      margin-top: 4px;
    }
    .anomaly-badge {
      padding: 3px 6px;
      border-radius: 4px;
      font-size: 9px;
      margin-bottom: 3px;
      font-family: 'Consolas', monospace;
      line-height: 1.3;
    }
    .anomaly-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid #dc2626;
      color: #fca5a5;
    }
    .anomaly-warning {
      background: rgba(234, 179, 8, 0.15);
      border: 1px solid #ca8a04;
      color: #fde047;
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
      <h2>Static Fixtures</h2>
      <div id="scenario-picker"></div>

      <div class="section-divider"></div>

      <h2>Temporal Replay</h2>
      <div id="temporal-picker"></div>
      <div class="temporal-controls">
        <button id="btn-step" class="ctrl-btn">Step</button>
        <button id="btn-pause" class="ctrl-btn">Pause</button>
        <button id="btn-resume" class="ctrl-btn">Resume</button>
        <button id="btn-stop" class="ctrl-btn">Stop</button>
      </div>
      <div id="temporal-status" class="temporal-info" data-state="idle">Select a temporal scenario</div>
      <div id="temporal-step" class="temporal-info"></div>

      <div class="section-divider"></div>

      <h2>Telemetry</h2>
      <div id="telemetry-log" class="telemetry-log"></div>

      <h2>Anomalies</h2>
      <div id="anomaly-alerts" class="anomaly-alerts"></div>

      <div class="harness-info">
        Active: <span id="active-scenario">\u2014</span>
        <br>Static: click a fixture. Temporal: click a scenario to replay.
        <br>Use Playwright to screenshot each state.
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
