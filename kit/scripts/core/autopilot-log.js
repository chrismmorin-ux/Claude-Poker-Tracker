/**
 * autopilot-log.js — append-only JSONL log for /autopilot cycles.
 *
 * WS-222 / ADR-026. Every cron fire of the /autopilot trigger writes one
 * line to .claude/workstream/autopilot-cycles.jsonl regardless of outcome
 * (bootstrap, guard_rail_exit, work_attempted, work_completed, work_failed,
 * teardown). This makes the observability gap (AS-801) impossible to
 * recreate — "trigger fired silently" is no longer a valid repo state.
 *
 * Line shape (one JSON object per line):
 *   {
 *     "ts": "2026-04-24T15:00:00Z",     // ISO UTC, cycle-fire time (required)
 *     "run_id": "ap-20260424-0715",      // (required)
 *     "cycle": 3,                        // monotonic within run (required)
 *     "outcome": "work_completed",       // see OUTCOMES (required)
 *     "reason": "...",                   // optional; required for guard_rail_exit + work_failed
 *     "item_id": "WS-141",               // optional; present when outcome touches a queue item
 *     "duration_ms": 12403               // optional; wall-clock for the cycle
 *   }
 *
 * File semantics: append-only. Readers treat malformed lines as warnings,
 * skip them, and continue. No rewrites; retention + archival is a GC
 * concern handled separately (DEC-030 §Consequences — 90-day archive to
 * .claude/workstream/archive/autopilot-runs/<run_id>.jsonl.gz).
 *
 * Concurrency: Node's fs.appendFileSync opens with O_APPEND; POSIX and NTFS
 * both make single-write appends atomic for lines below pipe-buffer size
 * (~4KB). Our lines are ~200 bytes max, so no advisory lock is needed.
 *
 * Zero external dependencies.
 */

'use strict';

require('../lib/preflight');

const fs = require('fs');
const path = require('path');

const { findWorkstreamDir } = require('../lib/cwos-utils');

const LOG_FILENAME = 'autopilot-cycles.jsonl';

const OUTCOMES = new Set([
  'bootstrap',
  'guard_rail_exit',
  'work_attempted',
  'work_completed',
  'work_failed',
  'teardown',
]);

const REQUIRED_FIELDS = ['ts', 'run_id', 'cycle', 'outcome'];

// Outcomes that MUST carry a human-readable `reason`. Enforced at append time.
const REASON_REQUIRED = new Set(['guard_rail_exit', 'work_failed']);

// ─── Path helpers ──────────────────────────────────────────────────────────

function logPath(workstreamDir) {
  const ws = workstreamDir || findWorkstreamDir();
  return path.join(ws, LOG_FILENAME);
}

// ─── Validation ────────────────────────────────────────────────────────────

function validateEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { ok: false, error: 'entry must be an object' };
  }
  const missing = REQUIRED_FIELDS.filter(f => entry[f] === undefined || entry[f] === null || entry[f] === '');
  if (missing.length) {
    return { ok: false, error: `missing required field(s): ${missing.join(', ')}` };
  }
  if (!OUTCOMES.has(String(entry.outcome))) {
    return { ok: false, error: `outcome "${entry.outcome}" must be one of ${[...OUTCOMES].join('|')}` };
  }
  if (typeof entry.cycle !== 'number' || !Number.isInteger(entry.cycle) || entry.cycle < 1) {
    return { ok: false, error: `cycle must be a positive integer (got ${entry.cycle})` };
  }
  if (REASON_REQUIRED.has(String(entry.outcome))) {
    const reason = String(entry.reason || '').trim();
    if (!reason) {
      return { ok: false, error: `outcome "${entry.outcome}" requires non-empty reason` };
    }
  }
  return { ok: true };
}

// ─── Write ─────────────────────────────────────────────────────────────────

/**
 * Append one JSON line to autopilot-cycles.jsonl.
 *
 * @param {object} entry - See module header for shape.
 * @param {object} [opts]
 * @param {string} [opts.workstreamDir]
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function appendCycleLog(entry, opts = {}) {
  const v = validateEntry(entry);
  if (!v.ok) return { ok: false, error: v.error };

  const workstreamDir = opts.workstreamDir || findWorkstreamDir();
  fs.mkdirSync(workstreamDir, { recursive: true });
  const file = logPath(workstreamDir);

  // Emit field ordering that matches the documented schema for human readability.
  const ordered = {
    ts: entry.ts,
    run_id: entry.run_id,
    cycle: entry.cycle,
    outcome: entry.outcome,
  };
  if (entry.reason !== undefined && entry.reason !== null && entry.reason !== '') ordered.reason = entry.reason;
  if (entry.item_id !== undefined && entry.item_id !== null && entry.item_id !== '') ordered.item_id = entry.item_id;
  if (entry.duration_ms !== undefined && entry.duration_ms !== null) ordered.duration_ms = entry.duration_ms;

  fs.appendFileSync(file, JSON.stringify(ordered) + '\n', 'utf8');
  return { ok: true };
}

// ─── Read ──────────────────────────────────────────────────────────────────

/**
 * Read all lines from the cycle log. Malformed lines are skipped; the line
 * number and parse error are returned in `warnings` so callers can surface
 * partial-corruption cases to operators.
 *
 * @param {object} [opts]
 * @param {string} [opts.workstreamDir]
 * @returns {{ entries: object[], warnings: {line: number, error: string, raw: string}[] }}
 */
function readAll(opts = {}) {
  const workstreamDir = opts.workstreamDir || findWorkstreamDir();
  const file = logPath(workstreamDir);
  if (!fs.existsSync(file)) return { entries: [], warnings: [] };

  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
  const entries = [];
  const warnings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        entries.push(obj);
      } else {
        warnings.push({ line: i + 1, error: 'not an object', raw: line });
      }
    } catch (err) {
      warnings.push({ line: i + 1, error: err.message, raw: line });
    }
  }
  return { entries, warnings };
}

/**
 * Return the last N entries (most recent last). N defaults to 20.
 */
function tailCycleLog(n, opts = {}) {
  const { entries } = readAll(opts);
  const count = Math.max(0, n === undefined || n === null ? 20 : Number(n));
  if (count === 0) return [];
  return entries.slice(-count);
}

/**
 * Return all entries belonging to `run_id`, in file order.
 */
function cyclesForRun(run_id, opts = {}) {
  if (!run_id) return [];
  const { entries } = readAll(opts);
  return entries.filter(e => e.run_id === run_id);
}

/**
 * Integer count of log entries for a run_id. Used by AS-801 cross-check
 * against Remote-Trigger run history (100% of fires must produce a line).
 */
function fireCount(run_id, opts = {}) {
  return cyclesForRun(run_id, opts).length;
}

// ─── Exports ───────────────────────────────────────────────────────────────

module.exports = {
  appendCycleLog,
  tailCycleLog,
  cyclesForRun,
  fireCount,
  readAll,
  validateEntry,
  logPath,
  OUTCOMES,
  LOG_FILENAME,
};
