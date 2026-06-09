#!/usr/bin/env node
/**
 * cwos-findings-feedback-validate — guard the highest-weight calibration input.
 *
 * docs/evolution/findings-feedback.yaml feeds AC-11 (weight 0.20 in the
 * analysis constitution). A bug or stray edit silently corrupts the metric
 * that's supposed to detect engine drift — making the worst possible case
 * "the calibration loop says everything is fine because the data was rewritten
 * underneath it." This validator enforces two invariants:
 *
 *   1. content_hash field at file head must match the canonical SHA-256 of
 *      the entries list (in file order).
 *   2. Append-only: the first prior_count entries must hash identically to
 *      the snapshot recorded in
 *      .claude/workstream/state/findings-feedback-manifest.json. Modifying
 *      or deleting any prior entry is rejected.
 *
 * Modes:
 *   --check    Verify both invariants. Exit 0 ok / 1 hash mismatch /
 *              2 append-only violation / 3 schema error.
 *   --update   Recompute content_hash + bump manifest after a writer
 *              appended new entries. Exit 0 ok / 3 schema error.
 *   --init     One-time bootstrap. Computes content_hash + writes manifest
 *              from current file state. Idempotent.
 *
 * Hash algorithm uses kit/scripts/core/canonical-json.js (same canonicalizer
 * as the event log) so the hash is stable across implementations.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  readYAMLFile,
  writeFileAtomic,
  findWorkstreamDir,
  withFileLock,
  resolveEvolutionDir,
} = require('./lib/cwos-utils');
const { hashEvent } = require('./core/canonical-json');

function repoRoot() {
  const ws = findWorkstreamDir(process.cwd());
  return path.resolve(ws, '..', '..');
}

// Tests pass --feedback-path / --manifest-path / --lock-path to point the
// validator at fixture files. CLI-style usage (no overrides) resolves all
// three from the repo root containing the script's invoker.
function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i !== -1 && i + 1 < args.length) return args[i + 1];
  return null;
}

function resolvePaths(args) {
  const fbOverride = readFlag(args, 'feedback-path');
  const mOverride = readFlag(args, 'manifest-path');
  const lOverride = readFlag(args, 'lock-path');
  const root = repoRoot();
  return {
    feedback: fbOverride || path.join(resolveEvolutionDir(root), 'findings-feedback.yaml'), // WS-421: scope-aware
    manifest: mOverride || path.join(root, '.claude', 'workstream', 'state', 'findings-feedback-manifest.json'),
    lock: lOverride || path.join(root, '.claude', 'workstream', 'state', 'findings-feedback.lock'),
  };
}

// Default path helpers preserved for other code that imports them.
function feedbackPath() { return resolvePaths([]).feedback; }
function manifestPath() { return resolvePaths([]).manifest; }
function lockPath() { return resolvePaths([]).lock; }

function readEntriesAndHash(fp) {
  fp = fp || feedbackPath();
  if (!fs.existsSync(fp)) {
    return { ok: false, code: 3, error: `findings-feedback.yaml not found at ${fp}` };
  }
  const raw = fs.readFileSync(fp, 'utf8');
  const r = readYAMLFile(fp);
  if (!r.ok || !r.data) {
    return { ok: false, code: 3, error: `findings-feedback.yaml unparseable: ${r.error || 'unknown'}` };
  }
  const data = r.data;
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const fullHash = hashEvent({ entries });
  // content_hash field is parsed as part of `data` if present
  const recordedHash = typeof data.content_hash === 'string' ? data.content_hash : null;
  return { ok: true, raw, data, entries, fullHash, recordedHash };
}

function readManifest(mp) {
  mp = mp || manifestPath();
  if (!fs.existsSync(mp)) return null;
  try {
    return JSON.parse(fs.readFileSync(mp, 'utf8'));
  } catch (e) {
    return { _parseError: e.message };
  }
}

function writeManifest(manifest, mp) {
  mp = mp || manifestPath();
  const dir = path.dirname(mp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  writeFileAtomic(mp, JSON.stringify(manifest, null, 2) + '\n');
}

function rewriteContentHash(rawText, newHash) {
  // Replace existing content_hash line; if absent, insert after schema_version.
  if (/^content_hash:\s*.*$/m.test(rawText)) {
    return rawText.replace(/^content_hash:\s*.*$/m, `content_hash: "${newHash}"`);
  }
  if (/^schema_version:\s*\d+\s*$/m.test(rawText)) {
    return rawText.replace(
      /^(schema_version:\s*\d+\s*)$/m,
      (m, g1) => `${g1.trimEnd()}\ncontent_hash: "${newHash}"`
    );
  }
  // Fallback: insert at top after any leading comments / before `entries:`.
  return `content_hash: "${newHash}"\n` + rawText;
}

// Mode helpers: return {code, body, err} so the caller can release the lock
// (via withFileLock's finally) before process.exit. Calling process.exit
// from inside the lock callback skips finally and leaks the lockfile,
// which deadlocks subsequent invocations.

function modeInit(paths) {
  const result = withFileLock(paths.lock, () => {
    const r = readEntriesAndHash(paths.feedback);
    if (!r.ok) return { code: r.code, err: `init: ${r.error}` };
    const newRaw = rewriteContentHash(r.raw, r.fullHash);
    if (newRaw !== r.raw) writeFileAtomic(paths.feedback, newRaw);
    writeManifest({
      schema_version: 1,
      prior_count: r.entries.length,
      last_hash: r.fullHash,
      last_validated_at: new Date().toISOString(),
      bootstrapped_at: new Date().toISOString(),
    }, paths.manifest);
    return {
      code: 0,
      body: { ok: true, mode: 'init', entries: r.entries.length, content_hash: r.fullHash },
    };
  }, { ownerLabel: 'findings-feedback-validate:init' });
  if (result.err) process.stderr.write(result.err + '\n');
  if (result.body) process.stdout.write(JSON.stringify(result.body, null, 2) + '\n');
  process.exit(result.code);
}

function modeUpdate(paths) {
  const result = withFileLock(paths.lock, () => {
    const r = readEntriesAndHash(paths.feedback);
    if (!r.ok) return { code: r.code, err: `update: ${r.error}` };
    const newRaw = rewriteContentHash(r.raw, r.fullHash);
    if (newRaw !== r.raw) writeFileAtomic(paths.feedback, newRaw);
    const manifest = readManifest(paths.manifest) || { schema_version: 1 };
    manifest.prior_count = r.entries.length;
    manifest.last_hash = r.fullHash;
    manifest.last_validated_at = new Date().toISOString();
    writeManifest(manifest, paths.manifest);
    return {
      code: 0,
      body: { ok: true, mode: 'update', entries: r.entries.length, content_hash: r.fullHash },
    };
  }, { ownerLabel: 'findings-feedback-validate:update' });
  if (result.err) process.stderr.write(result.err + '\n');
  if (result.body) process.stdout.write(JSON.stringify(result.body, null, 2) + '\n');
  process.exit(result.code);
}

function modeCheck(paths) {
  const r = readEntriesAndHash(paths.feedback);
  if (!r.ok) {
    process.stderr.write(`check: ${r.error}\n`);
    process.exit(r.code);
  }
  const result = {
    ok: true,
    mode: 'check',
    entries: r.entries.length,
    computed_hash: r.fullHash,
    recorded_hash: r.recordedHash,
    manifest_present: false,
    append_only_ok: null,
  };

  if (!r.recordedHash) {
    process.stderr.write('check: content_hash field missing — run --init first\n');
    result.ok = false;
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(3);
  }
  if (r.recordedHash !== r.fullHash) {
    process.stderr.write(
      `check: content_hash mismatch (recorded ${r.recordedHash.slice(0,12)}…, computed ${r.fullHash.slice(0,12)}…)\n`
    );
    result.ok = false;
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(1);
  }

  const manifest = readManifest(paths.manifest);
  if (manifest && !manifest._parseError) {
    result.manifest_present = true;
    const prior = Math.max(0, Math.min(manifest.prior_count || 0, r.entries.length));
    const priorHash = hashEvent({ entries: r.entries.slice(0, prior) });
    if (priorHash !== manifest.last_hash) {
      process.stderr.write(
        `check: append-only violation — first ${prior} entries no longer hash to manifest snapshot ` +
        `(snapshot ${(manifest.last_hash||'').slice(0,12)}…, recomputed ${priorHash.slice(0,12)}…)\n`
      );
      result.ok = false;
      result.append_only_ok = false;
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      process.exit(2);
    }
    if (r.entries.length < prior) {
      process.stderr.write(
        `check: append-only violation — entries shrunk from ${prior} to ${r.entries.length}\n`
      );
      result.ok = false;
      result.append_only_ok = false;
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      process.exit(2);
    }
    result.append_only_ok = true;
  }

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    process.stdout.write('usage: cwos-findings-feedback-validate <--check|--update|--init> [--feedback-path P] [--manifest-path P] [--lock-path P]\n');
    process.exit(args.length === 0 ? 1 : 0);
  }
  const paths = resolvePaths(args);
  if (args.includes('--init')) return modeInit(paths);
  if (args.includes('--update')) return modeUpdate(paths);
  if (args.includes('--check')) return modeCheck(paths);
  process.stderr.write(`unknown mode: ${args.join(' ')}\n`);
  process.exit(2);
}

if (require.main === module) main();

module.exports = {
  feedbackPath,
  manifestPath,
  readEntriesAndHash,
  readManifest,
  writeManifest,
  rewriteContentHash,
};
