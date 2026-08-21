/**
 * build.mjs — esbuild script for the Ignition poker tracker extension
 *
 * Bundles ES modules into IIFE format per Chrome extension context.
 * Copies static assets, HTML files, and manifest to dist/.
 */

import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, 'dist');
const isWatch = process.argv.includes('--watch');

// ---------------------------------------------------------------------------
// BUILD STAMP — which code is this, and where did it come from?
// ---------------------------------------------------------------------------
//
// A loaded unpacked extension gives no way to tell WHICH checkout produced it.
// On 2026-08-21 that cost a live test cycle: the founder loaded
// `ignition-poker-tracker/dist/`, the canonical path the docs name, and it held
// a build of a DIFFERENT branch's in-flight work — none of the fixes he was
// testing, plus someone else's half-finished changes. The panel reported the
// bug faithfully, and there was no way to see from inside it that the code
// under test was not the code in question.
//
// The tickets had already flagged the hazard in prose ("dist/ was last built
// 2026-08-04 and the source is two commits ahead; anything checked against the
// loaded extension is testing old code"). Prose did not stop it. This does: the
// build's identity is compiled INTO the artifact and rendered where it is
// looked at, so a wrong build announces itself instead of being inferred.
//
// `sourceDir` is the load-bearing field — it is what distinguishes the main
// checkout from a worktree, which is exactly the confusion that occurred.
const git = (cmd, fallback = '') => {
  try {
    return execSync(cmd, { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch (_) {
    return fallback; // not a git checkout, or git unavailable — never fail a build for this
  }
};

const BUILD_STAMP = (() => {
  const branch = git('git rev-parse --abbrev-ref HEAD', 'unknown');
  const commit = git('git rev-parse --short HEAD', 'unknown');
  // Scope the dirty check to the extension: unrelated churn elsewhere in the
  // repo must not mark this artifact as modified.
  const dirty = git('git status --porcelain -- .') !== '';
  return {
    version: JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')).version,
    branch,
    commit: dirty ? `${commit}+dirty` : commit,
    builtAt: new Date().toISOString(),
    // Parent of ignition-poker-tracker/ — the checkout root's folder name.
    sourceDir: basename(resolve(__dirname, '..')),
  };
})();

// Clean dist/
if (existsSync(DIST)) rmSync(DIST, { recursive: true });
mkdirSync(DIST, { recursive: true });

// Build-time hash — changes every build so content script guard keys detect new code
const BUILD_HASH = Date.now().toString(36);

// Stealth: random channel ID and message type codes per build.
// These are shared between the MAIN world probe and the ISOLATED world capture script.
// Randomized so no static string can fingerprint the extension.
const CHANNEL_ID = 'mc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const MSG_TYPES = {
  T_LC:  Math.floor(Math.random() * 9000) + 1000,
  T_MSG: Math.floor(Math.random() * 9000) + 1000,
  T_RDY: Math.floor(Math.random() * 9000) + 1000,
  T_PRE: Math.floor(Math.random() * 9000) + 1000,
  T_BFC: Math.floor(Math.random() * 9000) + 1000,
};

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
    // Object literal, not a string — consumers read fields directly.
    '__BUILD_STAMP__': JSON.stringify(BUILD_STAMP),
    '__CHANNEL_ID__': JSON.stringify(CHANNEL_ID),
    '__T_LC__': String(MSG_TYPES.T_LC),
    '__T_MSG__': String(MSG_TYPES.T_MSG),
    '__T_RDY__': String(MSG_TYPES.T_RDY),
    '__T_PRE__': String(MSG_TYPES.T_PRE),
    '__T_BFC__': String(MSG_TYPES.T_BFC),
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
probeSource = probeSource
  .replace(/%%BUILD_HASH%%/g, BUILD_HASH)
  .replace(/%%CHANNEL_ID%%/g, CHANNEL_ID)
  .replace(/%%T_LC%%/g, String(MSG_TYPES.T_LC))
  .replace(/%%T_MSG%%/g, String(MSG_TYPES.T_MSG))
  .replace(/%%T_RDY%%/g, String(MSG_TYPES.T_RDY))
  .replace(/%%T_PRE%%/g, String(MSG_TYPES.T_PRE))
  .replace(/%%T_BFC%%/g, String(MSG_TYPES.T_BFC));
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

// `version_name` is rendered by Chrome on chrome://extensions next to the
// version. Stamping provenance there means a wrong build announces itself AT
// THE MOMENT OF LOADING — before any behaviour is judged — rather than only
// inside the panel where you have to know to look. This is the cheap half of
// the fix and the half that fires earliest.
manifest.version_name = `${BUILD_STAMP.version} (${BUILD_STAMP.sourceDir}/${BUILD_STAMP.branch}@${BUILD_STAMP.commit})`;

writeFileSync(resolve(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2));

// Plain-text sibling so the artifact can be identified without Chrome, without
// the panel, and without parsing JSON — e.g. from a shell, in a bug report, or
// when comparing two dist/ folders.
writeFileSync(
  resolve(DIST, 'BUILD_INFO.txt'),
  Object.entries(BUILD_STAMP).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n'
);

console.log('[build] Generated manifest.json');
console.log(`[build] Stamp: ${BUILD_STAMP.sourceDir}/${BUILD_STAMP.branch}@${BUILD_STAMP.commit}`);
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
