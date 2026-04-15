/**
 * build.mjs — Build the SR-3 browser replay harness.
 *
 * Produces `dist/index.html` + `dist/driver.js` + `dist/side-panel.js`.
 * The page loads driver.js first; driver installs chrome-stub + fake clock,
 * then dynamically appends the production-bundled side-panel.js IIFE, which
 * binds to window.chrome (stubbed) and renders into the sidebar DOM.
 *
 * Run:
 *   node side-panel/replay-harness/build.mjs
 *   npx serve side-panel/replay-harness/dist -l 3333
 */

import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const DIST = resolve(__dirname, 'dist');
const SIDE_PANEL_HTML = resolve(__dirname, '..', 'side-panel.html');

// Clean
if (existsSync(DIST)) rmSync(DIST, { recursive: true });
mkdirSync(DIST, { recursive: true });

const BUILD_HASH = Date.now().toString(36);

const common = {
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  minify: false,
  sourcemap: false,
  define: { '__BUILD_HASH__': JSON.stringify(BUILD_HASH) },
};

// ── Bundle the production side-panel.js (IIFE, same config as prod build) ──
await esbuild.build({
  ...common,
  entryPoints: [resolve(ROOT, 'side-panel', 'side-panel.js')],
  outfile: resolve(DIST, 'side-panel.js'),
});
console.log('[replay-harness] bundled side-panel.js');

// ── Bundle the driver (ESM entry → IIFE) ──
await esbuild.build({
  ...common,
  entryPoints: [resolve(__dirname, 'driver.js')],
  outfile: resolve(DIST, 'driver.js'),
});
console.log('[replay-harness] bundled driver.js');

// ── Extract CSS + body from side-panel.html ──
const html = readFileSync(SIDE_PANEL_HTML, 'utf8');
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
const cssContent = styleMatch ? styleMatch[1] : '';
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)(?=\s*<script)/i);
const bodyContent = bodyMatch ? bodyMatch[1] : '';

// ── Generate index.html ──
const indexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sidebar Replay Harness (SR-3)</title>
  <style>
    html, body { margin: 0; padding: 0; background: #0d0d1a; }
    body { width: 400px; min-height: 720px; }
${cssContent}
  </style>
</head>
<body>
${bodyContent}
  <script src="driver.js"></script>
</body>
</html>
`;

writeFileSync(resolve(DIST, 'index.html'), indexHtml);
console.log('[replay-harness] wrote index.html');
console.log('[replay-harness] done. serve with: npx serve side-panel/replay-harness/dist -l 3333');
