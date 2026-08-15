#!/usr/bin/env node
/**
 * cwos-kit-health — Deterministic kit-degradation detector (WS-379).
 *
 * Cross-references kit/MANIFEST.yaml + .cwos-onboarding.yaml#capabilities
 * against actual file presence in the target repo. Optionally checks
 * hardlink integrity on Windows and kit-version drift. Designed for
 * <500ms latency so /session-start and /status can call it freely.
 *
 * Usage:
 *   node cwos-kit-health.js                      # JSON to stdout
 *   node cwos-kit-health.js --line               # one-line summary
 *   node cwos-kit-health.js --quiet              # silent unless degraded
 *   node cwos-kit-health.js --target <path>      # check this repo
 *   node cwos-kit-health.js --homebase <path>    # locate MANIFEST here
 *
 * Exit: 0 clean, 1 degraded.
 *
 * In HomeBase mode (no .cwos-onboarding.yaml in target), checks that all
 * MANIFEST source files exist on disk under the homebase root.
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const { readYAMLFile } = require('./lib/cwos-utils');
const { compareSemver, lagSeverity, resolveInstalledVersion } = require('./lib/kit-version');

const VALID_CAPABILITIES = ['core', 'workstream', 'engines', 'governance', 'autonomous'];

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { line: false, quiet: false, target: process.cwd(), homebase: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--line') opts.line = true;
    else if (a === '--quiet') opts.quiet = true;
    else if (a === '--target' && args[i + 1]) opts.target = path.resolve(args[++i]);
    else if (a === '--homebase' && args[i + 1]) opts.homebase = path.resolve(args[++i]);
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'usage: cwos-kit-health [--line] [--quiet] [--target <path>] [--homebase <path>]\n'
      );
      process.exit(0);
    }
  }
  return opts;
}

/**
 * HomeBase as recorded by the install, from `.cwos-version.homebase_path`.
 *
 * WS-640. The parent-walk below is sufficient inside HomeBase and useless
 * everywhere else: in an adopted repo HomeBase is a SIBLING directory, never an
 * ancestor, so the walk runs to the filesystem root and returns null. Until this
 * script shipped, that never showed — it only ever ran in HomeBase, where the
 * walk succeeds on the first iteration.
 *
 * `homebase_path` is the mechanism CLAUDE.md already names for exactly this
 * ("Read HomeBase path from `.cwos-version.homebase_path`") and both affected
 * repos carry it. Tried BEFORE the walk so an adopted repo gets its recorded
 * hub rather than whatever happens to sit above it on disk.
 */
function homebaseFromVersionStamp(target) {
  if (!target) return null;
  const fp = path.join(target, '.cwos-version');
  if (!fs.existsSync(fp)) return null;
  const r = readYAMLFile(fp);
  const p = r.ok && r.data && r.data.homebase_path;
  if (!p) return null;
  const abs = path.resolve(String(p));
  return fs.existsSync(path.join(abs, 'kit', 'MANIFEST.yaml')) ? abs : null;
}

function findHomebase(start) {
  let dir = start;
  for (let d = 0; d < 10; d++) {
    if (fs.existsSync(path.join(dir, 'kit', 'MANIFEST.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function readManifest(homebase) {
  const fp = path.join(homebase, 'kit', 'MANIFEST.yaml');
  const r = readYAMLFile(fp);
  if (!r.ok || !Array.isArray(r.data && r.data.files)) {
    throw new Error(`MANIFEST.yaml unparseable or missing files[] at ${fp}`);
  }
  return r.data.files;
}

function readOnboarding(target) {
  const fp = path.join(target, '.cwos-onboarding.yaml');
  if (!fs.existsSync(fp)) return null;
  const r = readYAMLFile(fp);
  if (!r.ok || !r.data) return null;
  return r.data;
}

function readVersionStamp(target) {
  const fp = path.join(target, '.cwos-version');
  if (!fs.existsSync(fp)) return null;
  const r = readYAMLFile(fp);
  return (r.ok && r.data) ? r.data : null;
}

function readKitVersion(homebase) {
  const fp = path.join(homebase, 'kit', 'VERSION');
  if (!fs.existsSync(fp)) return null;
  return fs.readFileSync(fp, 'utf8').trim();
}

function enabledCapabilities(onboarding) {
  if (!onboarding || !onboarding.capabilities) return new Set();
  const out = new Set();
  for (const cap of VALID_CAPABILITIES) {
    const entry = onboarding.capabilities[cap];
    if (entry && entry.state === 'enabled') out.add(cap);
  }
  return out;
}

function expectedFiles(manifest, enabled, mode) {
  // mode: 'adopted' filters by enabled capabilities; 'homebase' checks every
  // M1 entry exists locally as the source of truth.
  return manifest.filter(f => {
    if (!f || !f.source || !f.destination) return false;
    if (mode === 'homebase') return true;
    const cap = f.capability || 'core';
    if (!enabled.has(cap)) return false;
    // Skip conditional entries — they install only when /adopt evaluates the
    // condition (repo_claims, has_ai_evaluator, archetype). Without re-running
    // those evaluators here we can't tell whether the file SHOULD be present.
    if (f.conditional) return false;
    // Skip deferred entries — they install only when the founder asks /adopt
    // to install the deferred group. Their absence is expected, not a gap.
    if (f.install_phase === 'deferred') return false;
    return true;
  });
}

function checkPresence(expected, root, mode) {
  const coverage = {};
  const gaps = [];
  for (const cap of VALID_CAPABILITIES) coverage[cap] = { expected: 0, present: 0, missing: [] };

  for (const f of expected) {
    const cap = f.capability || 'core';
    const checkPath = mode === 'homebase'
      ? path.join(root, f.source)
      : path.join(root, f.destination);
    const c = coverage[cap] = coverage[cap] || { expected: 0, present: 0, missing: [] };
    c.expected++;
    if (fs.existsSync(checkPath)) {
      c.present++;
    } else {
      c.missing.push(f.destination);
      gaps.push({ capability: cap, destination: f.destination, reason: 'missing' });
    }
  }
  return { coverage, gaps };
}

// Hardlink integrity check (Windows-only — HomeBase is Windows; OneDrive sync
// is the documented break source per HC-002). On non-Windows: skipped.
// Runs in both adopted and homebase modes — HomeBase is self-hosting, so the
// kit/commands/ ↔ .claude/commands/ hardlink pairing is local in both.
function checkHardlinks(expected, homebase, target, mode) {
  if (process.platform !== 'win32') {
    return { checked: 0, broken: 0, broken_paths: [] };
  }
  let checked = 0, broken = 0;
  const broken_paths = [];
  // In homebase mode, the "target" we check against is the homebase root itself
  // (both source and destination live there). In adopted mode, target is the
  // adopted repo root, where the hardlink dst was created at install time.
  const dstRoot = mode === 'homebase' ? homebase : target;
  for (const f of expected) {
    // Heuristic: the kit/commands/*.md ↔ .claude/commands/*.md pairing is the
    // documented hardlink set (per CLAUDE.md). engines/* and personas/* are
    // installed via copy, not hardlink. Limit hardlink check to that pairing.
    if (!/^kit\/commands\//.test(f.source)) continue;
    const srcPath = path.join(homebase, f.source);
    const dstPath = path.join(dstRoot, f.destination);
    if (!fs.existsSync(srcPath) || !fs.existsSync(dstPath)) continue;
    try {
      const srcStat = fs.statSync(srcPath);
      const dstStat = fs.statSync(dstPath);
      checked++;
      // On NTFS, hardlinked files share a nlink count > 1 and an identical
      // ino. A severed hardlink (OneDrive replaced one with a copy) shows
      // ino mismatch and/or nlink == 1 on the dst.
      if (srcStat.ino !== dstStat.ino || dstStat.nlink < 2) {
        broken++;
        broken_paths.push(f.destination);
      }
    } catch { /* permission / race — skip silently */ }
  }
  return { checked, broken, broken_paths };
}

// WS-547: both moved to lib/kit-version.js, which is now the only version
// comparator in kit/scripts/. Re-exported below so existing callers and tests
// keep working. `compareVersion` keeps its historical name here; the lib calls
// it compareSemver.
//
// One behaviour change came with the move: the old pair coerced unparseable
// components to 0 via `parseInt(n, 10) || 0`, so "3.x" silently compared equal
// to "3.0". The lib returns null from parseSemver instead and lagSeverity
// answers 'none' — an unknown lag is not a lag. INV-065 is what catches a
// version that will not parse, rather than letting it read as up-to-date.
const compareVersion = compareSemver;

function checkDrift(versionStamp, kitVersion) {
  // WS-547: was `versionStamp.kit_version_at_install` alone — the narrowest of
  // the four readers. It reported no drift for any repo whose stamp lacked that
  // one field, including every /genesis-created repo.
  const resolved = resolveInstalledVersion(versionStamp, null);
  const installed = resolved ? resolved.version : null;
  if (!installed || !kitVersion) {
    return {
      kit_version_installed: installed || null,
      kit_version_homebase: kitVersion || null,
      version_lags: false,
      lag_severity: 'none',
    };
  }
  const cmp = compareVersion(installed, kitVersion);
  return {
    kit_version_installed: installed,
    kit_version_homebase: kitVersion,
    version_lags: cmp < 0,
    lag_severity: lagSeverity(installed, kitVersion),
  };
}

function buildLine(result) {
  const totalExpected = Object.values(result.coverage).reduce((n, c) => n + c.expected, 0);
  if (!result.degraded) {
    return `Kit health: clean — ${totalExpected} files across ${
      Object.entries(result.coverage)
        .filter(([_, c]) => c.expected > 0)
        .map(([cap]) => cap).join(', ')
    } (${result.elapsed_ms}ms).`;
  }
  const perCap = Object.entries(result.coverage)
    .filter(([_, c]) => c.expected > 0)
    .map(([cap, c]) => `${cap} ${c.present}/${c.expected}`)
    .join(', ');
  const hl = result.hardlinks.broken > 0 ? `, ${result.hardlinks.broken} broken hardlink(s)` : '';
  return `Kit health: ${result.gaps.length} gap(s) detected since last session — ${perCap}${hl}. Run /audit for details, /adopt --repair to fix.`;
}

function main() {
  const startMs = Date.now();
  const opts = parseArgs(process.argv);
  const homebase = opts.homebase
    || homebaseFromVersionStamp(opts.target)
    || findHomebase(opts.target)
    || findHomebase(__dirname);
  if (!homebase) {
    process.stderr.write(
      'cwos-kit-health: cannot locate kit/MANIFEST.yaml — no --homebase given, '
      + 'no homebase_path in .cwos-version, and none found above this repo\n'
    );
    process.exit(2);
  }

  let manifest;
  try { manifest = readManifest(homebase); }
  catch (err) {
    process.stderr.write(`cwos-kit-health: ${err.message}\n`);
    process.exit(2);
  }

  const onboarding = readOnboarding(opts.target);
  // WS-407: an adopted repo (has .cwos-version) that lacks .cwos-onboarding.yaml
  // is a latent failure — upgrade-path tooling reads that file and silently
  // falls back to defaults. Surface it explicitly instead of letting the missing
  // file silently flip this check into homebase mode. HomeBase itself has
  // neither file, so the .cwos-version guard avoids a false positive there.
  const onboardingMissing = !onboarding
    && fs.existsSync(path.join(opts.target, '.cwos-version'));
  const mode = onboarding ? 'adopted' : 'homebase';
  const enabled = mode === 'adopted'
    ? enabledCapabilities(onboarding)
    : new Set(VALID_CAPABILITIES);

  const expected = expectedFiles(manifest, enabled, mode);
  const presence = checkPresence(expected, mode === 'homebase' ? homebase : opts.target, mode);
  const hardlinks = checkHardlinks(expected, homebase, opts.target, mode);
  const versionStamp = readVersionStamp(opts.target);
  const kitVersion = readKitVersion(homebase);
  const drift = checkDrift(versionStamp, kitVersion);

  const degraded = presence.gaps.length > 0 || hardlinks.broken > 0;
  const result = {
    ok: !degraded,
    degraded,
    exit_code: degraded ? 1 : 0,
    mode,
    onboarding_missing: onboardingMissing,
    checked_at: new Date().toISOString(),
    elapsed_ms: Date.now() - startMs,
    coverage: presence.coverage,
    gaps: [
      ...presence.gaps,
      ...hardlinks.broken_paths.map(p => ({ capability: 'core', destination: p, reason: 'hardlink-broken' })),
    ],
    hardlinks,
    drift,
  };

  if (opts.quiet && !degraded) {
    process.exit(0);
  }
  if (opts.line) {
    process.stdout.write(buildLine(result) + '\n');
  } else {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }
  process.exit(result.exit_code);
}

if (require.main === module) main();

module.exports = {
  enabledCapabilities,
  expectedFiles,
  checkPresence,
  checkHardlinks,
  compareVersion,
  lagSeverity,
  checkDrift,
  buildLine,
};
