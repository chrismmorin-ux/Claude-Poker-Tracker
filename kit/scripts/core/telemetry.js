/**
 * telemetry.js — Per-invocation telemetry writer + summarizer.
 *
 * ADR-018 step 1, WS-172. Captures per-command duration / byte-IO / (optional)
 * token-derived figures to `.claude/workstream/telemetry/baseline.jsonl`.
 * Zero external dependencies. Schema-validated at write time against
 * `core/schemas/telemetry-v1.schema.json` — malformed records are rejected
 * before append (warn-only per ADR; callers decide whether to hard-fail).
 */

'use strict';

require('../lib/preflight');

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const { findWorkstreamDir } = require('../lib/cwos-utils');

const SCHEMA_VERSION = 1;
const SCHEMA_PATH = path.join(__dirname, 'schemas', 'telemetry-v1.schema.json');

// Allowlist — matches schema. Writing any other field is refused.
const ALLOWED_FIELDS = new Set([
  'schema_version',
  'timestamp',
  'command_name',
  'duration_ms',
  'exit_code',
  'command_id',
  'events_emitted',
  'bytes_read',
  'bytes_written',
  'files_read',
  'tokens_derived',
  'tokens_source',
  'kit_sha',
]);

const REQUIRED_FIELDS = ['schema_version', 'timestamp', 'command_name', 'duration_ms', 'exit_code'];

function telemetryDir(workstreamDir) {
  const ws = workstreamDir || findWorkstreamDir();
  return path.join(ws, 'telemetry');
}

function baselineFile(workstreamDir) {
  return path.join(telemetryDir(workstreamDir), 'baseline.jsonl');
}

/**
 * Minimal schema validator — zero-dep (does not pull Ajv). Covers the
 * allowlist + required-field + type + enum + numeric-minimum rules in
 * telemetry-v1.schema.json. Returns { ok, errors[] }.
 */
function validate(record) {
  const errors = [];

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { ok: false, errors: ['record must be an object'] };
  }

  for (const key of Object.keys(record)) {
    if (!ALLOWED_FIELDS.has(key)) errors.push(`unknown field: ${key}`);
  }
  for (const key of REQUIRED_FIELDS) {
    if (!(key in record)) errors.push(`missing required field: ${key}`);
  }

  if ('schema_version' in record && record.schema_version !== SCHEMA_VERSION) {
    errors.push(`schema_version must be ${SCHEMA_VERSION} (got ${record.schema_version})`);
  }
  if ('timestamp' in record && typeof record.timestamp !== 'string') {
    errors.push('timestamp must be a string (ISO-8601)');
  }
  if ('command_name' in record) {
    if (typeof record.command_name !== 'string' || record.command_name.length === 0 || record.command_name.length > 128) {
      errors.push('command_name must be a non-empty string ≤128 chars');
    }
  }
  for (const num of ['duration_ms', 'events_emitted', 'bytes_read', 'bytes_written', 'files_read']) {
    if (num in record && record[num] != null) {
      if (!Number.isInteger(record[num]) || record[num] < 0) {
        errors.push(`${num} must be a non-negative integer`);
      }
    }
  }
  if ('exit_code' in record && !Number.isInteger(record.exit_code)) {
    errors.push('exit_code must be an integer');
  }
  if ('tokens_derived' in record && record.tokens_derived !== null) {
    if (!Number.isInteger(record.tokens_derived) || record.tokens_derived < 0) {
      errors.push('tokens_derived must be a non-negative integer or null');
    }
  }
  if ('tokens_source' in record) {
    if (!['transcript', 'proxy', 'unavailable'].includes(record.tokens_source)) {
      errors.push('tokens_source must be one of transcript|proxy|unavailable');
    }
  }
  if ('kit_sha' in record && record.kit_sha != null) {
    if (typeof record.kit_sha !== 'string' || !/^[0-9a-f]{7,40}$/.test(record.kit_sha)) {
      errors.push('kit_sha must be a 7–40 char hex string or null');
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Build a record. Fills in schema_version + timestamp if omitted.
 * Does NOT write — call appendTelemetry(record) for that.
 */
function buildRecord(fields) {
  const rec = Object.assign({
    schema_version: SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
  }, fields || {});
  return rec;
}

/**
 * Append a telemetry record as a single JSONL line. The record is
 * validated first; on failure returns { ok: false, errors }. The file
 * and its parent directory are created if needed.
 *
 * Append uses O_APPEND (atomic for line-sized writes on Node/POSIX/NTFS
 * when the line is well under PIPE_BUF/sector-boundary thresholds).
 * Telemetry lines are short and capped by the allowlist; no advisory
 * lock is required at the telemetry layer (the shadow event log is
 * what carries hash-chain integrity — telemetry is coarse counters).
 */
function appendTelemetry(record, opts = {}) {
  const rec = (record.schema_version && record.timestamp) ? record : buildRecord(record);
  const check = validate(rec);
  if (!check.ok) return { ok: false, errors: check.errors };

  const targetFile = opts.file || baselineFile(opts.workstreamDir);
  const targetDir = path.dirname(targetFile);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const line = JSON.stringify(rec) + '\n';
  fs.appendFileSync(targetFile, line, { encoding: 'utf8' });
  return { ok: true, file: targetFile };
}

/**
 * Read every telemetry record from a file. Skips blank lines + malformed
 * JSON (malformed lines are surfaced in the `warnings[]` result field so
 * corrupted tails don't silently zero out a baseline).
 */
function readTelemetry(file) {
  if (!fs.existsSync(file)) return { records: [], warnings: [`file not found: ${file}`] };
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split('\n');
  const records = [];
  const warnings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    try {
      const obj = JSON.parse(line);
      const v = validate(obj);
      if (!v.ok) { warnings.push(`line ${i + 1}: ${v.errors.join('; ')}`); continue; }
      records.push(obj);
    } catch (err) {
      warnings.push(`line ${i + 1}: malformed JSON (${err.message})`);
    }
  }
  return { records, warnings };
}

function quantile(sortedAsc, q) {
  if (sortedAsc.length === 0) return 0;
  const pos = (sortedAsc.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedAsc[base + 1] !== undefined) {
    return sortedAsc[base] + rest * (sortedAsc[base + 1] - sortedAsc[base]);
  }
  return sortedAsc[base];
}

/**
 * Compute baseline summary: total tokens across corpus (null if every
 * record lacks tokens_derived), p50/p95 latency, byte totals, record count.
 * This is the single-scalar + p50/p95 artifact WS-172 requires.
 */
function summarize(records) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      record_count: 0,
      total_tokens: null,
      tokens_source_breakdown: {},
      p50_latency_ms: 0,
      p95_latency_ms: 0,
      total_bytes_read: 0,
      total_bytes_written: 0,
    };
  }

  const latencies = records.map((r) => r.duration_ms).sort((a, b) => a - b);
  let totalTokens = 0;
  let tokensSeen = false;
  const tokenSources = {};
  let bytesRead = 0;
  let bytesWritten = 0;

  for (const r of records) {
    if (typeof r.tokens_derived === 'number') { totalTokens += r.tokens_derived; tokensSeen = true; }
    tokenSources[r.tokens_source || 'unavailable'] = (tokenSources[r.tokens_source || 'unavailable'] || 0) + 1;
    if (typeof r.bytes_read === 'number') bytesRead += r.bytes_read;
    if (typeof r.bytes_written === 'number') bytesWritten += r.bytes_written;
  }

  return {
    record_count: records.length,
    total_tokens: tokensSeen ? totalTokens : null,
    tokens_source_breakdown: tokenSources,
    p50_latency_ms: Math.round(quantile(latencies, 0.5)),
    p95_latency_ms: Math.round(quantile(latencies, 0.95)),
    total_bytes_read: bytesRead,
    total_bytes_written: bytesWritten,
  };
}

/**
 * Compute variance (coefficient of variation) across N run summaries.
 * Used to validate the WS-172 reproducibility criterion: <5% variance
 * across 3 runs.
 */
function runVariance(summaries, metric) {
  if (!Array.isArray(summaries) || summaries.length < 2) return { cv: 0, mean: 0 };
  const vals = summaries.map((s) => s[metric]).filter((v) => typeof v === 'number');
  if (vals.length < 2) return { cv: 0, mean: 0 };
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (mean === 0) return { cv: 0, mean: 0 };
  const variance = vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length;
  const stdev = Math.sqrt(variance);
  return { cv: stdev / mean, mean, stdev };
}

/**
 * Regression check: compare a candidate summary against a locked baseline.
 * Returns { ok, diff_pct, metric, threshold } and a verdict. Exit code
 * non-zero on >threshold drift is the caller's responsibility.
 */
function regressionCheck(baseline, candidate, opts = {}) {
  const metric = opts.metric || 'total_tokens';
  const threshold = opts.threshold != null ? opts.threshold : 0.10;
  const b = baseline[metric];
  const c = candidate[metric];
  if (typeof b !== 'number' || typeof c !== 'number') {
    return { ok: null, diff_pct: null, metric, threshold, verdict: 'skip', reason: `${metric} not present in both summaries` };
  }
  if (b === 0) {
    return { ok: c === 0, diff_pct: c === 0 ? 0 : Infinity, metric, threshold, verdict: c === 0 ? 'pass' : 'fail' };
  }
  const diff = (c - b) / b;
  const ok = Math.abs(diff) <= threshold;
  return { ok, diff_pct: diff, metric, threshold, verdict: ok ? 'pass' : 'fail' };
}

// ─── Transcript-based token derivation (WS-180, ADR-018 §Baseline) ────────
//
// Claude Code writes per-session transcripts to
//   ~/.claude/projects/<project-dir>/<session-uuid>.jsonl
// where <project-dir> encodes the repo's absolute path with a convention:
// drive letter (minus colon) + dashes for separators. Each transcript line
// is a JSON object; assistant messages carry `message.usage.{input_tokens,
// output_tokens, cache_creation_input_tokens, cache_read_input_tokens}`.
// Summing those across a range of lines is the per-command token envelope.

/**
 * Derive the project-dir name used by ~/.claude/projects for a given cwd.
 * Example: "C:\\Users\\chris\\Claude HomeBase" → "C--Users-chris-Claude-HomeBase".
 * Returns null for empty input.
 */
function projectDirNameForCwd(cwd) {
  if (!cwd) return null;
  // Normalize backslashes, strip drive colon, collapse separators to dashes.
  let s = String(cwd).replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1-');
  s = s.replace(/\//g, '-').replace(/\s+/g, '-');
  return s;
}

function transcriptsRoot() {
  return path.join(os.homedir(), '.claude', 'projects');
}

function transcriptsDirForCwd(cwd) {
  const name = projectDirNameForCwd(cwd || process.cwd());
  if (!name) return null;
  const full = path.join(transcriptsRoot(), name);
  return fs.existsSync(full) ? full : null;
}

/**
 * Most recently modified .jsonl file in the given project transcript dir,
 * or null if none. This is the active session's transcript.
 */
function latestTranscriptFile(projectDir) {
  if (!projectDir || !fs.existsSync(projectDir)) return null;
  const files = fs.readdirSync(projectDir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({ f, m: fs.statSync(path.join(projectDir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  return files.length ? path.join(projectDir, files[0].f) : null;
}

/**
 * Return the current line count of the active session's transcript, or
 * null if no transcript is available. Line count is used as a monotonic
 * "mark" — callers snapshot the mark at command entry and exit to
 * attribute tokens to a command_id envelope.
 */
function currentTranscriptMark(opts = {}) {
  const dir = opts.projectDir || transcriptsDirForCwd(opts.cwd);
  if (!dir) return null;
  const file = latestTranscriptFile(dir);
  if (!file) return null;
  try {
    // Line count via byte-scan (fast, no full parse). Trailing newline is
    // counted conservatively — one-off drift of ±1 is acceptable.
    const raw = fs.readFileSync(file, 'utf8');
    let n = 0;
    for (let i = 0; i < raw.length; i++) if (raw.charCodeAt(i) === 10) n++;
    return n;
  } catch {
    return null;
  }
}

/**
 * Sum token usage across transcript lines [startMark, endMark). Each line
 * is parsed; if it carries `message.usage`, the four token fields are
 * summed. Lines without usage (snapshots, user turns, tool results) are
 * skipped. Returns { tokens: integer, source: 'transcript' } on success
 * or { tokens: null, source: 'unavailable' } if the transcript cannot be
 * read / the range is invalid.
 */
function deriveTokensForSession(opts = {}) {
  const dir = opts.projectDir || transcriptsDirForCwd(opts.cwd);
  if (!dir) return { tokens: null, source: 'unavailable', reason: 'no-project-dir' };
  const file = opts.transcriptFile || latestTranscriptFile(dir);
  if (!file) return { tokens: null, source: 'unavailable', reason: 'no-transcript-file' };

  const startMark = Number.isInteger(opts.startMark) ? opts.startMark : 0;
  const endMark = Number.isInteger(opts.endMark) ? opts.endMark : Number.POSITIVE_INFINITY;
  if (endMark <= startMark) return { tokens: 0, source: 'transcript', range: [startMark, endMark] };

  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); }
  catch { return { tokens: null, source: 'unavailable', reason: 'read-failed' }; }

  const lines = raw.split('\n');
  let total = 0;
  const upper = Math.min(endMark, lines.length);
  for (let i = startMark; i < upper; i++) {
    const line = lines[i];
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      const u = obj && obj.message && obj.message.usage;
      if (u) {
        total += (u.input_tokens || 0) + (u.output_tokens || 0)
             + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
      }
    } catch { /* skip malformed lines */ }
  }
  return { tokens: total, source: 'transcript', range: [startMark, Math.min(endMark, lines.length)] };
}

module.exports = {
  SCHEMA_VERSION,
  SCHEMA_PATH,
  ALLOWED_FIELDS,
  REQUIRED_FIELDS,
  telemetryDir,
  baselineFile,
  validate,
  buildRecord,
  appendTelemetry,
  readTelemetry,
  summarize,
  runVariance,
  regressionCheck,
  // WS-180: real transcript-based token derivation
  projectDirNameForCwd,
  transcriptsRoot,
  transcriptsDirForCwd,
  latestTranscriptFile,
  currentTranscriptMark,
  deriveTokensForSession,
};
