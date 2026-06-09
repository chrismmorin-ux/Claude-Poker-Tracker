/**
 * snapshot-diff.js — post-command instrumentation verifier.
 *
 * ADR-018 §Scope line 92, WS-186. Snapshots workstream state before and
 * after a command, diffs to find what actually changed, and compares
 * against the events the command emitted. Flags:
 *   - `missing`: paths that changed but no event was emitted → instrumentation gap
 *   - `spurious`: events claimed a mutation but the file is unchanged → false positive
 *   - `reconciled`: paths covered by emitted events
 *
 * Replaces the 48-hour parallel-branch dogfooding protocol. Instead of
 * running old-kit and new-kit side-by-side and diffing mutations after
 * 48 hours of real use, we snapshot-diff every command synchronously.
 *
 * Zero external dependencies.
 */

'use strict';

require('../lib/preflight');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { findWorkstreamDir } = require('../lib/cwos-utils');

const DEFAULT_SNAPSHOT_GLOBS = [
  '.claude/workstream',
  'system',
];

// Paths excluded from snapshotting — either the event log itself (which IS
// the output we're verifying) or ephemeral local state (telemetry, locks).
const EXCLUDE_PATTERNS = [
  /\/\.claude\/workstream\/events(\/|$)/,
  /\/\.claude\/workstream\/telemetry(\/|$)/,
  /\/\.claude\/workstream\/chain-anchors\.yaml$/,
  /\/\.claude\/workstream\/\.current-session$/,
  /\/\.claude\/workstream\/\.hooks-liveness\.yaml$/,
  /\/\.write\.lock$/,
];

// ─── Snapshot primitives ───────────────────────────────────────────────────

function hashFile(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch {
    return null;
  }
}

function walkFiles(root, relBase, out) {
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    const rel = relBase ? path.join(relBase, entry.name) : entry.name;
    const posixRel = rel.replace(/\\/g, '/');
    if (EXCLUDE_PATTERNS.some((re) => re.test('/' + posixRel))) continue;
    if (entry.isDirectory()) walkFiles(full, rel, out);
    else if (entry.isFile()) out.push({ abs: full, rel: posixRel });
  }
}

/**
 * Snapshot a set of directories under `repoRoot`. Returns
 * { path → sha256 } keyed by the posix-relative path from repoRoot.
 */
function snapshotState(opts = {}) {
  const repoRoot = opts.repoRoot || path.resolve(__dirname, '..', '..', '..');
  const globs = opts.paths || DEFAULT_SNAPSHOT_GLOBS;
  const map = {};
  for (const g of globs) {
    const abs = path.join(repoRoot, g);
    if (!fs.existsSync(abs)) continue;
    const files = [];
    walkFiles(abs, g, files);
    for (const f of files) {
      const h = hashFile(f.abs);
      if (h !== null) map[f.rel] = h;
    }
  }
  return map;
}

/**
 * Compute the symmetric diff between two snapshots.
 * Returns { added: string[], removed: string[], modified: string[] }.
 */
function diffSnapshots(before, after) {
  const beforeKeys = new Set(Object.keys(before));
  const afterKeys = new Set(Object.keys(after));
  const added = [];
  const removed = [];
  const modified = [];
  for (const k of afterKeys) {
    if (!beforeKeys.has(k)) added.push(k);
    else if (before[k] !== after[k]) modified.push(k);
  }
  for (const k of beforeKeys) if (!afterKeys.has(k)) removed.push(k);
  added.sort(); removed.sort(); modified.sort();
  return { added, removed, modified };
}

/**
 * Extract the set of paths that a list of events CLAIMS were mutated.
 * Events carry `payload.path` or `payload.file` when the emitter
 * conforms to the WS-187 instrumentation contract. Returns a Set of
 * posix-relative paths.
 */
function expectedFromEvents(eventsList) {
  const paths = new Set();
  for (const ev of eventsList || []) {
    const p = ev && ev.payload;
    if (!p) continue;
    const candidate = p.path || p.file || p.target || p.filePath;
    if (typeof candidate === 'string' && candidate.length > 0) {
      paths.add(candidate.replace(/\\/g, '/'));
    }
  }
  return paths;
}

/**
 * Reconcile snapshot diff against emitted events.
 *
 * Returns:
 *   {
 *     ok: bool,
 *     missing: paths that changed but no event claimed them (instrumentation gap),
 *     spurious: paths events claimed but file didn't change,
 *     reconciled: paths covered by events,
 *     changed: total changed paths,
 *     coverage: ratio of reconciled to changed (0..1),
 *   }
 *
 * `opts.ignorePatterns` — regex list; paths matching any are suppressed
 * from the missing set (e.g. expected legacy gaps).
 */
function verify(opts = {}) {
  const { beforeSnap, afterSnap, events } = opts;
  if (!beforeSnap || !afterSnap) throw new Error('verify requires beforeSnap and afterSnap');
  const { added, removed, modified } = diffSnapshots(beforeSnap, afterSnap);
  const changed = new Set([...added, ...removed, ...modified]);
  const expected = expectedFromEvents(events || []);

  const ignore = (p) => (opts.ignorePatterns || []).some((re) => re.test(p));

  const reconciled = [];
  const missing = [];
  for (const p of changed) {
    if (ignore(p)) continue;
    // Exact match first; then prefix-match (events may claim a directory
    // while the file diff lists individual files within it).
    const covered = expected.has(p) || Array.from(expected).some((e) =>
      e && (p === e || p.startsWith(e + '/') || p.startsWith(e.replace(/\/$/, '') + '/'))
    );
    if (covered) reconciled.push(p);
    else missing.push(p);
  }

  const spurious = [];
  for (const e of expected) {
    if (ignore(e)) continue;
    const matched = changed.has(e) || [...changed].some((c) =>
      c === e || c.startsWith(e + '/') || c.startsWith(e.replace(/\/$/, '') + '/')
    );
    if (!matched) spurious.push(e);
  }

  const totalChanged = changed.size;
  const coverage = totalChanged === 0 ? 1 : reconciled.length / totalChanged;
  return {
    ok: missing.length === 0,
    changed: totalChanged,
    missing: missing.sort(),
    spurious: spurious.sort(),
    reconciled: reconciled.sort(),
    coverage,
  };
}

module.exports = {
  DEFAULT_SNAPSHOT_GLOBS,
  EXCLUDE_PATTERNS,
  snapshotState,
  diffSnapshots,
  expectedFromEvents,
  verify,
};
