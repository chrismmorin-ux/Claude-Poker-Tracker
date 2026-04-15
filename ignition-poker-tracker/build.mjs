/**
 * build.mjs — esbuild script for the Ignition poker tracker extension
 *
 * Bundles ES modules into IIFE format per Chrome extension context.
 * Copies static assets, HTML files, and manifest to dist/.
 */

import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, 'dist');
const isWatch = process.argv.includes('--watch');

// Clean dist/
if (existsSync(DIST)) rmSync(DIST, { recursive: true });
mkdirSync(DIST, { recursive: true });

// Build-time hash — changes every build so content script guard keys detect new code
const BUILD_HASH = Date.now().toString(36);

// ---------------------------------------------------------------------------
// 1. ESBUILD — 5 entry points → IIFE bundles
// ---------------------------------------------------------------------------

const commonOptions = {
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  minify: false, // Keep readable for debugging
  sourcemap: false,
  define: {
    '__BUILD_HASH__': JSON.stringify(BUILD_HASH),
  },
};

const entryPoints = [
  {
    entryPoints: [resolve(__dirname, 'background/service-worker.js')],
    outfile: resolve(DIST, 'background/service-worker.js'),
  },
  {
    entryPoints: [resolve(__dirname, 'content/ignition-capture.js')],
    outfile: resolve(DIST, 'content/ignition-capture.js'),
  },
  {
    entryPoints: [resolve(__dirname, 'content/app-bridge.js')],
    outfile: resolve(DIST, 'content/app-bridge.js'),
  },
  {
    entryPoints: [resolve(__dirname, 'side-panel/side-panel.js')],
    outfile: resolve(DIST, 'side-panel/side-panel.js'),
  },
  {
    entryPoints: [resolve(__dirname, 'popup/popup.js')],
    outfile: resolve(DIST, 'popup/popup.js'),
  },
  {
    entryPoints: [resolve(__dirname, 'options/options.js')],
    outfile: resolve(DIST, 'options/options.js'),
  },
];

console.log('[build] Bundling entry points...');

await Promise.all(entryPoints.map(entry => esbuild.build({ ...commonOptions, ...entry })));

console.log(`[build] Bundled ${entryPoints.length} entry points`);

// ---------------------------------------------------------------------------
// 2. COPY STANDALONE FILES
// ---------------------------------------------------------------------------

// capture-websocket-probe.js — MAIN world, must NOT be bundled
// Copy then inject BUILD_HASH (esbuild define doesn't apply to non-bundled files)
mkdirSync(resolve(DIST, 'content'), { recursive: true });
cpSync(
  resolve(__dirname, 'content/capture-websocket-probe.js'),
  resolve(DIST, 'content/capture-websocket-probe.js'),
);
const probePath = resolve(DIST, 'content/capture-websocket-probe.js');
let probeSource = readFileSync(probePath, 'utf8');
probeSource = probeSource.replace(/%%BUILD_HASH%%/g, BUILD_HASH);
writeFileSync(probePath, probeSource);

// Assets (icons)
cpSync(resolve(__dirname, 'assets'), resolve(DIST, 'assets'), { recursive: true });

console.log('[build] Copied static files');

// ---------------------------------------------------------------------------
// 3. TRANSFORM HTML — replace multiple script tags with single bundled file
// ---------------------------------------------------------------------------

// Side panel HTML: replace 6 script tags with 1
const sidePanelHtml = readFileSync(resolve(__dirname, 'side-panel/side-panel.html'), 'utf8');
const sidePanelTransformed = sidePanelHtml
  .replace(
    /\s*<script src="\.\.\/shared\/[^"]+"><\/script>\s*/g,
    '',
  )
  .replace(
    /<script src="side-panel\.js"><\/script>/,
    '<script src="side-panel.js"></script>',
  );
mkdirSync(resolve(DIST, 'side-panel'), { recursive: true });
writeFileSync(resolve(DIST, 'side-panel/side-panel.html'), sidePanelTransformed);

// Popup HTML: replace 3 script tags with 1
const popupHtml = readFileSync(resolve(__dirname, 'popup/popup.html'), 'utf8');
const popupTransformed = popupHtml
  .replace(
    /\s*<script src="\.\.\/shared\/[^"]+"><\/script>\s*/g,
    '',
  )
  .replace(
    /<script src="popup\.js"><\/script>/,
    '<script src="popup.js"></script>',
  );
mkdirSync(resolve(DIST, 'popup'), { recursive: true });
writeFileSync(resolve(DIST, 'popup/popup.html'), popupTransformed);

// Options HTML — no shared scripts to strip; copy as-is.
const optionsHtml = readFileSync(resolve(__dirname, 'options/options.html'), 'utf8');
mkdirSync(resolve(DIST, 'options'), { recursive: true });
writeFileSync(resolve(DIST, 'options/options.html'), optionsHtml);

console.log('[build] Transformed HTML files');

// ---------------------------------------------------------------------------
// 4. MANIFEST — update for bundled content scripts
// ---------------------------------------------------------------------------

const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf8'));

// Content scripts: replace multi-file arrays with single bundled file
// Each bundled file includes all shared deps — no separate shared/*.js needed
const BUNDLED_CONTENT_SCRIPTS = new Set([
  'content/ignition-capture.js',
  'content/app-bridge.js',
]);

manifest.content_scripts = manifest.content_scripts.map(cs => {
  // MAIN world probe stays standalone
  if (cs.world === 'MAIN') return cs;

  // ISOLATED world: find the bundled entry point by exact name
  const mainScript = cs.js.find(f => BUNDLED_CONTENT_SCRIPTS.has(f));
  if (mainScript) {
    return { ...cs, js: [mainScript] };
  }
  return cs;
});

writeFileSync(resolve(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log('[build] Generated manifest.json');
console.log('[build] Done! Load dist/ as unpacked extension in Chrome.');

if (isWatch) {
  console.log('[build] Watch mode — rebuild on change...');
  // Simple watch: rebuild all on any source change
  const contexts = [];
  for (const entry of entryPoints) {
    const ctx = await esbuild.context({ ...commonOptions, ...entry });
    await ctx.watch();
    contexts.push(ctx);
  }
  console.log('[build] Watching for changes...');
}
