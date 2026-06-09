#!/usr/bin/env node
/**
 * cwos-feedback-capture.js — append founder per-finding dispositions to
 * docs/evolution/findings-feedback.yaml.
 *
 * Closes the calibration loop (FIND-125, AS-58, AC-11). The engine briefing
 * inline-disposition surface (engines/standard/eng-engine.md, WS-293)
 * generates founder one-letter marks per finding; this CLI persists them
 * into the findings-feedback log that quality-judge / AC-11 already reads.
 *
 * Letter map: u=useful, n=not_useful, p=wrong_priority, s=pending (skip)
 *
 * Idempotent: an entry with the same (run_id, finding_id, marked_by) is
 * upserted, not duplicated.
 *
 * Replay-pure: pure file mutation; no event emission today (the file IS
 * the durable record, mirroring docs/measurements/ADR-038-30day-report.md).
 *
 * Usage:
 *   node cwos-feedback-capture.js --run-id run-015 \
 *     --dispositions "FIND-122:u,FIND-123:n,FIND-124:p,FIND-125:s" \
 *     [--engine eng-engine] [--reason "..."] [--marked-by founder]
 *   node cwos-feedback-capture.js --feedback-file <path>   # for tests
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { withFileLock, findRepoRoot, resolveEvolutionDir } = require('./lib/cwos-utils');

// WS-421: basename only — the directory is resolved per repo scope via
// resolveEvolutionDir (docs/evolution/ in HomeBase, .claude/workstream/ in adopters).
const FEEDBACK_BASENAME = 'findings-feedback.yaml';
// Shared lockfile path mirrors cwos-findings-feedback-validate.js:64 so all
// three writer paths (this script, auto-resolved.js, validate --update)
// serialize against each other.
const DEFAULT_LOCK_FILE = '.claude/workstream/state/findings-feedback.lock';
const SIGNAL_MAP = {
  u: 'useful',
  n: 'not_useful',
  p: 'wrong_priority',
  s: 'pending',
};
const VALID_SIGNALS = new Set(['useful', 'not_useful', 'wrong_priority', 'pending', 'auto-resolved']);
const VALID_MARKERS = new Set(['founder', 'auto-resolved', 'passive']);

function parseArgs(argv) {
  const out = { runId: null, dispositions: null, engine: 'eng-engine', reason: null, markedBy: 'founder', feedbackFile: null, lockFile: null, clock: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--run-id' && argv[i + 1]) out.runId = argv[++i];
    else if (a === '--dispositions' && argv[i + 1]) out.dispositions = argv[++i];
    else if (a === '--engine' && argv[i + 1]) out.engine = argv[++i];
    else if (a === '--reason' && argv[i + 1]) out.reason = argv[++i];
    else if (a === '--marked-by' && argv[i + 1]) out.markedBy = argv[++i];
    else if (a === '--feedback-file' && argv[i + 1]) out.feedbackFile = argv[++i];
    else if (a === '--lock-file' && argv[i + 1]) out.lockFile = argv[++i];
    else if (a === '--clock' && argv[i + 1]) out.clock = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

/**
 * Parse "FIND-122:u,FIND-123:n" → [{finding_id, signal}, ...].
 * Throws on malformed input.
 */
function parseDispositions(text) {
  if (!text || !text.trim()) throw new Error('--dispositions empty');
  const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const m = p.match(/^(FIND-\d{3,})\s*:\s*([unps])$/i);
    if (!m) throw new Error(`malformed disposition pair: "${p}" — expected FIND-NNN:[u|n|p|s]`);
    const findingId = m[1].toUpperCase();
    const letter = m[2].toLowerCase();
    const signal = SIGNAL_MAP[letter];
    out.push({ finding_id: findingId, signal });
  }
  return out;
}

// ─── Minimal YAML helpers ──────────────────────────────────────────────────
//
// findings-feedback.yaml has a fixed shape: top-level `schema_version: 1` +
// `entries:` list of {finding_id, engine, run_id, signal, marked_at,
// marked_by, reason}. We don't need the general-purpose parser — we splice
// new entries before the trailing example-comment block.

function appendEntries(text, newEntries) {
  // Find the `entries:` line; insert before any trailing `# Example entries...`
  // commentary or end-of-file.
  const lines = text.split(/\r?\n/);
  let entriesIdx = -1;
  let appendIdx = lines.length; // default: end
  for (let i = 0; i < lines.length; i++) {
    if (/^entries\s*:/.test(lines[i])) { entriesIdx = i; }
    // Stop appending point: first comment block AFTER an entries: header that
    // looks like an example block (`# Example entries`).
    if (entriesIdx !== -1 && /^\s*#\s*Example entries/i.test(lines[i])) {
      appendIdx = i;
      // Skip back over leading blank/comment lines so we insert before whitespace
      while (appendIdx > entriesIdx + 1 && lines[appendIdx - 1].trim() === '') appendIdx--;
      break;
    }
  }
  if (entriesIdx === -1) {
    // No entries: header present — append a fresh one.
    return (text.replace(/\s+$/, '')) + '\n\nentries:\n' + newEntries.map(formatEntry).join('') + '\n';
  }
  const inserted = newEntries.map(formatEntry).join('');
  return [...lines.slice(0, appendIdx), inserted.trimEnd(), '', ...lines.slice(appendIdx)].join('\n');
}

function formatEntry(e) {
  const reasonLine = e.reason ? `    reason: ${JSON.stringify(e.reason)}\n` : '';
  return [
    `  - finding_id: "${e.finding_id}"`,
    `    engine: "${e.engine}"`,
    `    run_id: "${e.run_id}"`,
    `    signal: ${e.signal}`,
    `    marked_at: "${e.marked_at}"`,
    `    marked_by: ${e.marked_by}`,
    reasonLine.trimEnd() || null,
  ].filter(Boolean).join('\n') + '\n';
}

/**
 * Parse existing entries (loose match — we only need keys for idempotency
 * de-duplication, not full fidelity). Returns Set of "run_id|finding_id|marked_by".
 */
function existingKeys(text) {
  const lines = text.split(/\r?\n/);
  const keys = new Set();
  let cur = null;
  for (const l of lines) {
    const m = l.match(/^\s*-\s*finding_id\s*:\s*"?([\w-]+)"?\s*$/);
    if (m) {
      if (cur && cur.run_id && cur.finding_id && cur.marked_by) {
        keys.add(`${cur.run_id}|${cur.finding_id}|${cur.marked_by}`);
      }
      cur = { finding_id: m[1] };
      continue;
    }
    if (!cur) continue;
    const m2 = l.match(/^\s*(run_id|marked_by|engine)\s*:\s*"?([^"\n]+?)"?\s*$/);
    if (m2) cur[m2[1]] = m2[2].trim();
  }
  if (cur && cur.run_id && cur.finding_id && cur.marked_by) {
    keys.add(`${cur.run_id}|${cur.finding_id}|${cur.marked_by}`);
  }
  return keys;
}

// ─── Main capture ──────────────────────────────────────────────────────────

function capture(opts, repoRoot) {
  if (!opts.runId) return { ok: false, exit: 2, error: 'capture: --run-id required' };
  if (!opts.dispositions) return { ok: false, exit: 2, error: 'capture: --dispositions required' };
  if (!VALID_MARKERS.has(opts.markedBy)) return { ok: false, exit: 2, error: `capture: invalid --marked-by value (must be founder|auto-resolved|passive)` };

  let parsed;
  try { parsed = parseDispositions(opts.dispositions); }
  catch (e) { return { ok: false, exit: 2, error: `capture: ${e.message}` }; }

  for (const p of parsed) {
    if (!VALID_SIGNALS.has(p.signal)) return { ok: false, exit: 2, error: `capture: invalid signal ${p.signal} for ${p.finding_id}` };
  }

  const filePath = opts.feedbackFile || path.join(resolveEvolutionDir(repoRoot), FEEDBACK_BASENAME);
  // WS-311: lock the read-modify-write so this writer can't race with
  // auto-resolved.js (also appends entries) or with validate --update
  // (rewrites content_hash). Lockfile dir may not exist on a fresh repo;
  // mkdir lazily under the lock owner so the primitive can openSync('wx').
  const lockPath = opts.lockFile || path.join(repoRoot, DEFAULT_LOCK_FILE);
  const lockDir = path.dirname(lockPath);
  if (!fs.existsSync(lockDir)) fs.mkdirSync(lockDir, { recursive: true });

  return withFileLock(lockPath, () => {
    let text = '';
    if (fs.existsSync(filePath)) text = fs.readFileSync(filePath, 'utf8');
    else text = '# findings-feedback.yaml\nschema_version: 1\n\nentries:\n';

    const existing = existingKeys(text);
    const markedAt = opts.clock || new Date().toISOString();
    const newEntries = [];
    const skipped = [];

    for (const p of parsed) {
      if (p.signal === 'pending') { skipped.push(p.finding_id); continue; }
      const key = `${opts.runId}|${p.finding_id}|${opts.markedBy}`;
      if (existing.has(key)) { skipped.push(p.finding_id + '(exists)'); continue; }
      newEntries.push({
        finding_id: p.finding_id,
        engine: opts.engine,
        run_id: opts.runId,
        signal: p.signal,
        marked_at: markedAt,
        marked_by: opts.markedBy,
        reason: opts.reason,
      });
    }

    if (newEntries.length) {
      const updated = appendEntries(text, newEntries);
      fs.writeFileSync(filePath, updated, 'utf8');
    }

    return {
      ok: true,
      exit: 0,
      written_count: newEntries.length,
      skipped: skipped,
      new_entries: newEntries.map((e) => `${e.finding_id}:${e.signal}`),
      file: filePath,
    };
  }, { ownerLabel: 'feedback-capture', maxWaitMs: 5000 });
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write('usage: cwos-feedback-capture --run-id <run-NNN> --dispositions "FIND-NNN:[u|n|p|s],..." [--engine X] [--reason "..."]\n');
    process.exit(0);
  }
  const repoRoot = findRepoRoot(process.cwd());
  const result = capture(opts, repoRoot);
  if (!result.ok) {
    process.stderr.write(result.error + '\n');
    process.exit(result.exit);
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.exit);
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  parseDispositions,
  capture,
  appendEntries,
  existingKeys,
  formatEntry,
  SIGNAL_MAP,
  VALID_SIGNALS,
};
