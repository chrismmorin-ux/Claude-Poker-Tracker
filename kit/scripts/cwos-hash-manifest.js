#!/usr/bin/env node
/**
 * cwos-hash-manifest — generate the per-version kit file-hash baseline.
 *
 * Walks every `source` file declared in kit/MANIFEST.yaml, computes its
 * sha256, and writes kit/hashes-<version>.yaml. This baseline reaches adopted
 * repos via the explicit copy in cwos-kit-upgrade.js (step 3f) — NOT via a
 * MANIFEST entry; kit/hashes-*.yaml is deliberately absent from MANIFEST.yaml
 * so that HomeBase's historical baselines do not ship to every adopter. Once
 * there, /kit-upgrade uses it to detect locally hand-edited kit files: the
 * upgrade compares the adopter's current file hash against the baseline
 * recorded for their installed version and surfaces any divergence before
 * overwriting (the WS-040 hand-edit case).
 *
 * Run this at every kit release, right after bumping kit/VERSION and before
 * tagging kit-v<version> (see CLAUDE.md "Tag kit releases").
 *
 * ── Backfill (WS-548 / ADR-064 P2) ────────────────────────────────────────
 * The release path above can only hash the CURRENT working tree, so for most
 * of the kit's history no baseline was ever written — 2 of 16 shipped versions
 * had one. The gap matters because the other way to answer "was this file
 * hand-edited since install?" is `git show kit-vX:<path>` against a HomeBase
 * clone (cwos-migrate.js), and run-027 established that the Claude Code plugin
 * cache is not a git repository. Once kit content ships as a plugin that
 * lookup has nothing to resolve against.
 *
 * `--from-tag` reconstructs a baseline from git objects at an already-released
 * tag, so history can be captured into files while git is still the source of
 * truth. Hashes on that path are over git blobs (LF) rather than working-tree
 * bytes (CRLF on Windows); that difference is absorbed by
 * lineEndingVariantHashes() in cwos-kit-upgrade.js, which accepts a baseline
 * matching any of the local file's three renderings. `hash_basis` in the
 * output records which path produced it.
 *
 * Usage:
 *   node kit/scripts/cwos-hash-manifest.js [--version <v>] [--homebase <path>]
 *                                          [--out <file>] [--check] [--json]
 *   node kit/scripts/cwos-hash-manifest.js --from-tag <tag> [--out <file>] [--force]
 *   node kit/scripts/cwos-hash-manifest.js --backfill-all [--force]
 *
 *   --version      override version (default: read kit/VERSION)
 *   --homebase     HomeBase root (default: walk up from this script)
 *   --out          output path (default: kit/hashes-<version>.yaml)
 *   --check        do not write; compare against an existing manifest and exit 1
 *                  if any hash drifted (CI guard that the committed manifest is fresh)
 *   --from-tag     reconstruct the baseline for an already-released kit-v* tag
 *                  from git objects instead of the working tree
 *   --backfill-all reconstruct every kit-v* tag that has no baseline yet
 *   --force        allow --from-tag / --backfill-all to overwrite an existing
 *                  baseline (they refuse by default)
 *   --json         emit a JSON summary to stdout
 */

'use strict';

require('./lib/preflight');

const path = require('path');
const fs = require('fs');
const { loadManifest, sha256 } = require('./cwos-adopt-install');
const { parseYAML } = require('./lib/cwos-utils');
const { runGitInRepo, validateGitRef } = require('./lib/shell-safe');

function findHomeBase(override) {
  if (override) return path.resolve(override);
  // This script lives in <HomeBase>/kit/scripts/.
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'kit', 'VERSION')) &&
        fs.existsSync(path.join(dir, 'kit', 'MANIFEST.yaml'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // WS-549: kit/VERSION and kit/MANIFEST.yaml are distribution content, so the
  // fallback is the distribution root rather than a hop count.
  return require('./lib/kit-paths').resolveDistRoot();
}

// Collect the distributable `source` paths out of a parsed MANIFEST files array.
// Shared by the working-tree path and the --from-tag path so both agree on what
// counts as a hashable source.
function sourcesFromManifestFiles(files) {
  const sources = new Set();
  if (!Array.isArray(files)) return sources;
  for (const entry of files) {
    if (entry && typeof entry.source === 'string' && entry.source.trim()) {
      const s = entry.source.trim();
      // hash manifests are baselines, not validated kit content — never hash them
      if (/^kit\/hashes-.*\.yaml$/.test(s)) continue;
      sources.add(s);
    }
  }
  return sources;
}

// Build { source: 'sha256:...' } over every distributable MANIFEST source.
// Sorted keys → deterministic, reviewable diffs across releases.
function computeHashes(homebase) {
  const sources = sourcesFromManifestFiles(loadManifest(homebase));
  const hashes = {};
  const missing = [];
  for (const source of [...sources].sort()) {
    const abs = path.join(homebase, source);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      missing.push(source);
      continue;
    }
    hashes[source] = sha256(fs.readFileSync(abs));
  }
  return { hashes, missing };
}

// ─── Backfill from git objects (WS-548) ────────────────────────────────────

/** Raw bytes of one path at one ref, or null if it does not exist there. */
function readBlobAtRef(homebase, ref, filePath) {
  const r = runGitInRepo(homebase, ['cat-file', 'blob', `${ref}:${filePath}`], {
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  });
  return r.ok ? r.stdout : null;
}

/** Every tracked path at `ref` beneath any of `prefixes`. */
function listTreeAtRef(homebase, ref, prefixes) {
  const r = runGitInRepo(homebase, ['ls-tree', '-r', '--name-only', ref, '--', ...prefixes], {
    maxBuffer: 32 * 1024 * 1024,
  });
  if (!r.ok) return [];
  return r.stdout.split('\n').map(s => s.trim()).filter(Boolean);
}

/** The top-level directories the current MANIFEST ships from (kit, engines, …). */
function manifestPrefixes(homebase) {
  const prefixes = new Set();
  for (const s of sourcesFromManifestFiles(loadManifest(homebase))) {
    const top = s.split('/')[0];
    if (top) prefixes.add(top + '/');
  }
  return [...prefixes].sort();
}

/**
 * Decide what file list describes a released tag.
 *
 * Preferred: that tag's own kit/MANIFEST.yaml — the authoritative record of
 * what the version shipped. kit-v2.0 and kit-v3.0 predate MANIFEST.yaml
 * entirely, so they fall back to the tag's tree beneath the directories the
 * kit ships from. The fallback is a RECONSTRUCTION, not a record — it says
 * "these files existed at that tag", which is a superset of what was
 * installed. `source_list: tree-fallback` in the output keeps that visible so
 * the two can never be confused.
 */
function sourcesAtTag(homebase, tag) {
  const manifestText = readBlobAtRef(homebase, tag, 'kit/MANIFEST.yaml');
  if (manifestText) {
    const data = parseYAML(manifestText.toString('utf8'));
    const sources = sourcesFromManifestFiles(data && data.files);
    if (sources.size) return { sources: [...sources].sort(), sourceList: 'manifest' };
  }
  const tree = listTreeAtRef(homebase, tag, manifestPrefixes(homebase));
  return { sources: tree.sort(), sourceList: 'tree-fallback' };
}

/**
 * Build the baseline for an already-released tag from git objects.
 *
 * `missing` here means "declared by that tag's manifest but absent from that
 * tag's tree" — a real inconsistency in the release, worth reporting, not an
 * error in this reconstruction.
 */
function computeHashesFromTag(homebase, tag) {
  validateGitRef(tag);
  const { sources, sourceList } = sourcesAtTag(homebase, tag);
  const hashes = {};
  const missing = [];
  for (const source of sources) {
    const buf = readBlobAtRef(homebase, tag, source);
    if (buf === null) { missing.push(source); continue; }
    hashes[source] = sha256(buf);
  }
  return { hashes, missing, sourceList };
}

/** "kit-v3.7.1" → "3.7.1". Returns null for anything not shaped like a kit tag. */
function versionFromTag(tag) {
  const m = /^kit-v(.+)$/.exec(String(tag).trim());
  return m ? m[1] : null;
}

/** Every kit-v* tag in the repo, oldest release first. */
function listKitTags(homebase) {
  const r = runGitInRepo(homebase, ['tag', '-l', 'kit-v*'], { maxBuffer: 4 * 1024 * 1024 });
  if (!r.ok) return [];
  const { compareSemver } = require('./lib/kit-version');
  return r.stdout.split('\n').map(s => s.trim()).filter(Boolean)
    .sort((a, b) => compareSemver(versionFromTag(a), versionFromTag(b)));
}

// ─── Output ────────────────────────────────────────────────────────────────

function renderYAML(version, hashes, generatedAt, provenance) {
  const lines = [
    '# CWOS kit file-hash baseline — generated by cwos-hash-manifest.js.',
    '# Copied into adopted repos by /kit-upgrade, which reads the entry matching',
    '# the installed version to detect locally hand-edited kit files before overwrite.',
    '# Do not hand-edit — regenerate at each release.',
    `version: "${version}"`,
    `generated_at: "${generatedAt}"`,
  ];
  // Provenance is written only on the backfill path, so the release path's
  // output — and therefore --check's byte comparison against hashes-3.8.x — is
  // unchanged.
  if (provenance) {
    lines.push(
      `hash_basis: "${provenance.hashBasis}"`,
      `source_list: "${provenance.sourceList}"`,
      `reconstructed_from: "${provenance.ref}"`
    );
  }
  lines.push(
    `file_count: ${Object.keys(hashes).length}`,
    'files:'
  );
  for (const source of Object.keys(hashes)) {
    lines.push(`  "${source}": "${hashes[source]}"`);
  }
  return lines.join('\n') + '\n';
}

function parseArgs(argv) {
  const opts = {
    version: null, homebase: null, out: null, check: false, json: false,
    fromTag: null, backfillAll: false, force: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--version' && argv[i + 1]) opts.version = argv[++i];
    else if (a === '--homebase' && argv[i + 1]) opts.homebase = argv[++i];
    else if (a === '--out' && argv[i + 1]) opts.out = argv[++i];
    else if (a === '--check') opts.check = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--from-tag' && argv[i + 1]) opts.fromTag = argv[++i];
    else if (a === '--backfill-all') opts.backfillAll = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--help' || a === '-h') {
      process.stdout.write([
        'Usage: cwos-hash-manifest.js [--version <v>] [--homebase <path>] [--out <file>] [--check] [--json]',
        '       cwos-hash-manifest.js --from-tag <tag> [--out <file>] [--force] [--json]',
        '       cwos-hash-manifest.js --backfill-all [--force] [--json]',
        '',
        'Release path (default): hash the working tree and write kit/hashes-<version>.yaml.',
        'Backfill path: reconstruct a baseline for an already-released kit-v* tag from git',
        'objects. Refuses to overwrite an existing baseline without --force.',
      ].join('\n') + '\n');
      process.exit(0);
    } else {
      // ADR-063 guarantee 2: never act on an instruction we did not parse. This
      // parser used to fall through silently, so a typo'd flag produced a
      // confident, wrong release artifact.
      process.stderr.write(`cwos-hash-manifest: unknown argument: ${a}\n`);
      process.exit(2);
    }
  }
  return opts;
}

// WS-544: the manifest must be COMPLETE before it can be baselined. Hashing a
// manifest that omits a required module produces a release whose own file list
// is a lie — which is how four scripts reached claude-poker-tracker without
// lib/cli.js. This runs on both paths (generate and --check) because both are
// the release path, and there is deliberately no bypass flag.
function assertManifestComplete(homebase, opts) {
  const { checkManifestDeps, renderHuman } = require('./cwos-manifest-deps-validate');
  const result = checkManifestDeps(homebase);
  if (result.ok) return;

  if (opts.json) {
    process.stdout.write(JSON.stringify({
      ok: false,
      error: 'manifest dependency gate failed',
      violations: result.violations,
    }) + '\n');
  } else {
    process.stderr.write('ERROR: manifest dependency gate failed — refusing to baseline an incomplete manifest.\n');
    process.stderr.write(renderHuman(result));
    process.stderr.write('\nFix the violations above, or run:\n  node kit/scripts/cwos-manifest-deps-validate.js --human\n');
  }
  process.exit(1);
}

/**
 * Write one backfilled baseline. Returns a per-tag result record.
 *
 * The WS-544 dependency gate deliberately does NOT run here. That gate guards
 * SHIPPING: it refuses to baseline a manifest that omits a module its own
 * scripts require, so an incomplete release cannot be tagged. A version that
 * already shipped cannot be un-shipped. Refusing to record what kit-v3.7.1
 * contained would not make 3.7.1 any more complete — it would only leave the
 * three repos installed on it with no baseline at all. The gate stays
 * mandatory on the release path, which is the only path that can still change
 * what goes out.
 */
function backfillTag(homebase, tag, opts) {
  const version = versionFromTag(tag);
  if (!version) return { tag, ok: false, skipped: false, error: `not a kit-v* tag: ${tag}` };

  const outPath = opts.out || path.join(homebase, 'kit', `hashes-${version}.yaml`);
  if (fs.existsSync(outPath) && !opts.force) {
    return { tag, version, ok: true, skipped: true, out: path.relative(homebase, outPath).replace(/\\/g, '/') };
  }

  const { hashes, missing, sourceList } = computeHashesFromTag(homebase, tag);
  if (!Object.keys(hashes).length) {
    return { tag, version, ok: false, skipped: false, error: `no files resolved at ${tag} — is the tag present in this clone?` };
  }

  fs.writeFileSync(outPath, renderYAML(version, hashes, new Date().toISOString(), {
    hashBasis: 'git-blob',
    sourceList,
    ref: tag,
  }), 'utf8');

  return {
    tag,
    version,
    ok: true,
    skipped: false,
    out: path.relative(homebase, outPath).replace(/\\/g, '/'),
    file_count: Object.keys(hashes).length,
    source_list: sourceList,
    missing_count: missing.length,
    missing,
  };
}

function runBackfill(homebase, opts) {
  const tags = opts.fromTag ? [opts.fromTag] : listKitTags(homebase);
  if (!tags.length) {
    const msg = 'no kit-v* tags found — nothing to backfill';
    if (opts.json) process.stdout.write(JSON.stringify({ ok: false, error: msg }) + '\n');
    else process.stderr.write(`ERROR: ${msg}\n`);
    process.exit(1);
  }

  const results = tags.map(tag => backfillTag(homebase, tag, opts));
  const failed = results.filter(r => !r.ok);
  const written = results.filter(r => r.ok && !r.skipped);
  const skipped = results.filter(r => r.skipped);

  if (opts.json) {
    process.stdout.write(JSON.stringify({
      ok: failed.length === 0, written: written.length, skipped: skipped.length, results,
    }) + '\n');
  } else {
    for (const r of results) {
      if (!r.ok) { process.stderr.write(`  ✗ ${r.tag}: ${r.error}\n`); continue; }
      if (r.skipped) { process.stdout.write(`  · ${r.tag}: baseline exists (${r.out}) — use --force to regenerate\n`); continue; }
      const note = r.source_list === 'tree-fallback' ? ' [tree-fallback: no MANIFEST at this tag]' : '';
      process.stdout.write(`  ✓ ${r.tag}: ${r.file_count} files → ${r.out}${note}\n`);
      if (r.missing_count) {
        process.stdout.write(`      ${r.missing_count} manifest source(s) declared but absent from the tag's tree\n`);
      }
    }
    process.stdout.write(`\n${written.length} written, ${skipped.length} already present, ${failed.length} failed.\n`);
  }
  process.exit(failed.length ? 1 : 0);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const homebase = findHomeBase(opts.homebase);

  if (opts.fromTag && opts.backfillAll) {
    process.stderr.write('cwos-hash-manifest: --from-tag and --backfill-all are mutually exclusive\n');
    process.exit(2);
  }
  if ((opts.fromTag || opts.backfillAll) && opts.check) {
    process.stderr.write('cwos-hash-manifest: --check applies to the release path, not the backfill path\n');
    process.exit(2);
  }
  if (opts.backfillAll && opts.out) {
    process.stderr.write('cwos-hash-manifest: --out takes a single file and cannot be combined with --backfill-all\n');
    process.exit(2);
  }
  if (opts.fromTag || opts.backfillAll) return runBackfill(homebase, opts);

  let version = opts.version;
  if (!version) {
    try { version = fs.readFileSync(path.join(homebase, 'kit', 'VERSION'), 'utf8').trim(); }
    catch { process.stderr.write('ERROR: could not read kit/VERSION\n'); process.exit(1); }
  }

  assertManifestComplete(homebase, opts);

  const { hashes, missing } = computeHashes(homebase);
  const outPath = opts.out || path.join(homebase, 'kit', `hashes-${version}.yaml`);

  if (opts.check) {
    // Compare freshly-computed hashes against the committed manifest.
    if (!fs.existsSync(outPath)) {
      const msg = `hash manifest missing: ${path.relative(homebase, outPath)} (run without --check to generate)`;
      if (opts.json) process.stdout.write(JSON.stringify({ ok: false, error: msg }) + '\n');
      else process.stderr.write(`ERROR: ${msg}\n`);
      process.exit(1);
    }
    const committed = fs.readFileSync(outPath, 'utf8');
    const expected = renderYAML(version, hashes, '__IGNORE__');
    // Compare only the files: section (ignore generated_at line).
    const stripTs = s => s.replace(/^generated_at:.*$/m, 'generated_at: __IGNORE__');
    const drift = stripTs(committed).replace(/^generated_at:.*$/m, 'generated_at: __IGNORE__') !==
                  stripTs(expected);
    if (drift) {
      if (opts.json) process.stdout.write(JSON.stringify({ ok: false, error: 'hash manifest stale', out: outPath }) + '\n');
      else process.stderr.write(`ERROR: hash manifest is stale — regenerate: node kit/scripts/cwos-hash-manifest.js --version ${version}\n`);
      process.exit(1);
    }
    if (opts.json) process.stdout.write(JSON.stringify({ ok: true, version, file_count: Object.keys(hashes).length }) + '\n');
    else process.stdout.write(`Hash manifest current (${Object.keys(hashes).length} files, v${version}).\n`);
    process.exit(0);
  }

  const generatedAt = new Date().toISOString();
  fs.writeFileSync(outPath, renderYAML(version, hashes, generatedAt), 'utf8');

  const summary = {
    ok: true,
    version,
    out: path.relative(homebase, outPath).replace(/\\/g, '/'),
    file_count: Object.keys(hashes).length,
    missing_count: missing.length,
    missing,
  };
  if (opts.json) {
    process.stdout.write(JSON.stringify(summary) + '\n');
  } else {
    process.stdout.write(`Wrote ${summary.out} — ${summary.file_count} files hashed (v${version}).\n`);
    if (missing.length) {
      process.stdout.write(`  ${missing.length} manifest source(s) not found on disk (skipped):\n`);
      for (const m of missing.slice(0, 10)) process.stdout.write(`    ${m}\n`);
      if (missing.length > 10) process.stdout.write(`    … and ${missing.length - 10} more\n`);
    }
  }
}

module.exports = {
  computeHashes, renderYAML, findHomeBase,
  sourcesFromManifestFiles, computeHashesFromTag, sourcesAtTag,
  versionFromTag, listKitTags, backfillTag,
};

if (require.main === module) main();
