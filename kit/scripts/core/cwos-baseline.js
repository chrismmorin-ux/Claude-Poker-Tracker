#!/usr/bin/env node
/**
 * cwos-baseline — WS-172 replay-corpus runner + summarizer + regression gate.
 *
 * Subcommands:
 *   run                          Execute the pinned corpus, produce a run dir with baseline.jsonl
 *   summarize --run <path>       Emit summary.json for a given run
 *   pin                          Promote mean of latest 3 runs to pinned-baseline.json (if CV ≤ 5%)
 *   check --threshold <pct>      Regression check vs pinned-baseline.json (non-zero exit on drift)
 *   variance                     Report coefficient of variation across latest 3 runs
 *
 * Zero external dependencies. Called by CI (for `check`) and ad-hoc by the
 * founder (for `run` / `pin`).
 */

'use strict';

require('../lib/preflight');

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const telemetry = require('./telemetry');
const { parseYAML } = require('../lib/cwos-utils');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const CORPUS_DIR = path.join(REPO_ROOT, 'sim', 'benchmarks', 'baseline-corpus');
const RUNS_DIR = path.join(CORPUS_DIR, 'runs');
const PINNED_FILE = path.join(CORPUS_DIR, 'pinned-baseline.json');
const MANIFEST_FILE = path.join(CORPUS_DIR, 'manifest.yaml');

function loadManifest() {
  const raw = fs.readFileSync(MANIFEST_FILE, 'utf8');
  const m = parseYAML(raw);
  // CWOS YAML parser leaves flow-style inline maps as strings. Post-process
  // turns[] so each entry is a real object { tag, command, args? }. Narrow
  // parser — only handles the exact shape used in this manifest.
  if (Array.isArray(m.turns)) {
    m.turns = m.turns.map(parseTurnRow);
  }
  return m;
}

function parseTurnRow(row) {
  if (row && typeof row === 'object' && !Array.isArray(row)) return row;
  if (typeof row !== 'string') return { command: String(row) };
  // Strip braces + outer whitespace
  const inner = row.trim().replace(/^\{\s*|\s*\}$/g, '');
  const obj = {};
  // Split on commas that are NOT inside brackets (the args array is the only
  // bracketed construct we accept).
  const parts = [];
  let depth = 0;
  let buf = '';
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '[') depth++;
    else if (c === ']') depth--;
    if (c === ',' && depth === 0) { parts.push(buf); buf = ''; continue; }
    buf += c;
  }
  if (buf.trim()) parts.push(buf);
  for (const p of parts) {
    const idx = p.indexOf(':');
    if (idx === -1) continue;
    const key = p.slice(0, idx).trim();
    let val = p.slice(idx + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      const items = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^"(.*)"$|^'(.*)'$/, '$1$2'));
      obj[key] = items.filter(Boolean);
    } else {
      obj[key] = val.replace(/^"(.*)"$|^'(.*)'$/, '$1$2');
    }
  }
  return obj;
}

function currentKitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function newRunId() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `run-${stamp}`;
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// ─── run ────────────────────────────────────────────────────────────────────

/**
 * Execute each turn in the manifest. This is a STUB executor: because WS-172
 * is the baseline-capture piece (not end-to-end replay), we don't actually
 * invoke slash-commands here — we simulate plausible per-command duration +
 * byte-IO using a stable pseudo-random function keyed on (command_name, turn).
 * The real executor lands when WS-174 wires event-emission into live
 * commands; at that point this function is replaced with a subprocess-driven
 * replay against a sandbox repo.
 *
 * The stub is intentionally deterministic-per-commit so the reproducibility
 * contract (<5% CV across 3 runs) can be validated against the machinery
 * itself before real data exists.
 */
function runCorpus(opts = {}) {
  const manifest = loadManifest();
  const runId = opts.runId || newRunId();
  const runDir = path.join(RUNS_DIR, runId);
  ensureDir(runDir);
  const baselineFile = path.join(runDir, 'baseline.jsonl');

  const kitSha = currentKitSha();
  const commandId = `baseline-${runId}`;

  const turns = manifest.turns || [];
  let turnIndex = 0;
  for (const turn of turns) {
    turnIndex += 1;
    const cmd = turn.command;
    const args = turn.args || [];
    const seed = hashTo32Bit(`${kitSha || ''}:${cmd}:${turnIndex}`);
    const durationMs = 120 + (seed % 380); // 120–500ms per invocation (stable per-commit)
    const bytesRead = 2048 + (seed % 8192);
    const bytesWritten = 512 + (seed % 1024);
    const filesRead = 4 + (seed % 12);

    const derived = telemetry.deriveTokensForSession(commandId);

    const rec = telemetry.buildRecord({
      command_name: cmd,
      duration_ms: durationMs,
      exit_code: 0,
      command_id: commandId,
      events_emitted: 0, // step-1 placeholder; real events land when WS-174 wires instrumentation
      bytes_read: bytesRead,
      bytes_written: bytesWritten,
      files_read: filesRead,
      tokens_derived: derived.tokens,
      tokens_source: derived.source,
      kit_sha: kitSha,
    });

    const result = telemetry.appendTelemetry(rec, { file: baselineFile });
    if (!result.ok) {
      throw new Error(`telemetry validation failed on turn ${turnIndex} (${cmd}): ${result.errors.join('; ')}`);
    }
  }

  // Meta record for the run
  const meta = {
    run_id: runId,
    manifest_name: manifest.name,
    locked_sha: manifest.locked_sha,
    kit_sha: kitSha,
    executed_at: new Date().toISOString(),
    turn_count: turns.length,
    executor: 'stub-deterministic',
    note: 'Stub executor produces per-commit-deterministic telemetry for machinery validation. Replace when WS-174 instruments live commands.',
  };
  fs.writeFileSync(path.join(runDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');

  // Produce summary.json alongside the run
  const { records, warnings } = telemetry.readTelemetry(baselineFile);
  const summary = telemetry.summarize(records);
  summary.run_id = runId;
  summary.warnings = warnings;
  fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');

  return { runDir, summary, meta };
}

// Cheap, stable 32-bit hash — FNV-1a — used for deterministic stub values.
function hashTo32Bit(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// ─── summarize / variance / pin / check ────────────────────────────────────

function listRuns() {
  if (!fs.existsSync(RUNS_DIR)) return [];
  return fs.readdirSync(RUNS_DIR)
    .filter((d) => d.startsWith('run-'))
    .sort();
}

function summarizeRun(runDir) {
  const baselineFile = path.join(runDir, 'baseline.jsonl');
  const { records, warnings } = telemetry.readTelemetry(baselineFile);
  const summary = telemetry.summarize(records);
  summary.warnings = warnings;
  fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  return summary;
}

function latestRunSummaries(n) {
  const runs = listRuns().slice(-n);
  return runs.map((id) => {
    const p = path.join(RUNS_DIR, id, 'summary.json');
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }).filter(Boolean);
}

function varianceReport(summaries) {
  const tokenMetric = summaries.every((s) => typeof s.total_tokens === 'number') ? 'total_tokens' : 'p50_latency_ms';
  const tok = telemetry.runVariance(summaries, tokenMetric);
  const p50 = telemetry.runVariance(summaries, 'p50_latency_ms');
  const p95 = telemetry.runVariance(summaries, 'p95_latency_ms');
  const br = telemetry.runVariance(summaries, 'total_bytes_read');
  return {
    run_count: summaries.length,
    primary_metric: tokenMetric,
    primary_cv: tok.cv,
    primary_mean: tok.mean,
    p50_latency_cv: p50.cv,
    p95_latency_cv: p95.cv,
    bytes_read_cv: br.cv,
  };
}

function pin(opts = {}) {
  const required = 3;
  const summaries = latestRunSummaries(required);
  if (summaries.length < required) {
    return { ok: false, reason: `need ${required} runs, found ${summaries.length}` };
  }
  const report = varianceReport(summaries);
  const cap = 0.05;
  if (report.primary_cv > cap && !opts.force) {
    return { ok: false, reason: `coefficient of variation ${(report.primary_cv * 100).toFixed(2)}% exceeds ${cap * 100}% on ${report.primary_metric}`, report };
  }

  // Mean of the 3 summaries is the pinned baseline.
  const mean = (key) => {
    const vals = summaries.map((s) => s[key]).filter((v) => typeof v === 'number');
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };
  const allHaveTokens = summaries.every((s) => typeof s.total_tokens === 'number');
  const pinned = {
    pinned_at: new Date().toISOString(),
    source_runs: summaries.map((s) => s.run_id),
    metric_of_record: allHaveTokens ? 'total_tokens' : 'composite_proxy',
    total_tokens: allHaveTokens ? mean('total_tokens') : null,
    total_bytes_read: mean('total_bytes_read'),
    total_bytes_written: mean('total_bytes_written'),
    p50_latency_ms: mean('p50_latency_ms'),
    p95_latency_ms: mean('p95_latency_ms'),
    variance_report: report,
  };
  fs.writeFileSync(PINNED_FILE, JSON.stringify(pinned, null, 2), 'utf8');
  return { ok: true, pinned, file: PINNED_FILE };
}

function check(opts = {}) {
  if (!fs.existsSync(PINNED_FILE)) {
    return { ok: null, reason: 'no pinned-baseline.json — run `cwos-baseline pin` first', verdict: 'skip' };
  }
  const pinned = JSON.parse(fs.readFileSync(PINNED_FILE, 'utf8'));
  const latest = latestRunSummaries(1)[0];
  if (!latest) return { ok: null, reason: 'no runs available to check', verdict: 'skip' };
  const threshold = opts.threshold != null ? opts.threshold : 0.10;

  // Prefer total_tokens when both baselines have it; fallback to bytes_read composite.
  const metric = pinned.metric_of_record === 'total_tokens' && typeof latest.total_tokens === 'number'
    ? 'total_tokens'
    : 'total_bytes_read';

  return telemetry.regressionCheck(pinned, latest, { metric, threshold });
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArg(args, flag, fallback) {
  const i = args.indexOf(flag);
  if (i === -1 || i === args.length - 1) return fallback;
  return args[i + 1];
}

function main() {
  const args = process.argv.slice(2);
  const sub = args[0];

  if (!sub || sub === '--help' || sub === '-h') {
    process.stdout.write(`usage: cwos-baseline <run|summarize|variance|pin|check> [options]\n`);
    process.exit(sub ? 0 : 1);
  }

  switch (sub) {
    case 'run': {
      const result = runCorpus();
      process.stdout.write(JSON.stringify(result.summary, null, 2) + '\n');
      return;
    }
    case 'summarize': {
      const runPath = parseArg(args, '--run', null);
      if (!runPath) { process.stderr.write('--run <path> required\n'); process.exit(2); }
      const abs = path.isAbsolute(runPath) ? runPath : path.join(REPO_ROOT, runPath);
      const summary = summarizeRun(abs);
      process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
      return;
    }
    case 'variance': {
      const summaries = latestRunSummaries(3);
      const report = varianceReport(summaries);
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      return;
    }
    case 'pin': {
      const force = args.includes('--force');
      const result = pin({ force });
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      process.exit(result.ok ? 0 : 1);
    }
    case 'check': {
      const threshold = parseFloat(parseArg(args, '--threshold', '0.10'));
      const result = check({ threshold });
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      process.exit(result.verdict === 'fail' ? 1 : 0);
    }
    default: {
      process.stderr.write(`unknown subcommand: ${sub}\n`);
      process.exit(2);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runCorpus,
  summarizeRun,
  latestRunSummaries,
  varianceReport,
  pin,
  check,
};
