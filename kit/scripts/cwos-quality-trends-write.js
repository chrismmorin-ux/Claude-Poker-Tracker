#!/usr/bin/env node
/**
 * cwos-quality-trends-write — populate docs/evolution/quality-trends.yaml
 * after each quality-judge run. WS-310 Phase D.
 *
 * The schema for quality-trends.yaml is documented in the file itself
 * (engines.<engine_name> block + global summary). For 17 quality-judge runs
 * the file's `engines: {}` field stayed empty because Phase 3c of the engine
 * was prose ("update the file") rather than a deterministic write. This
 * script closes that gap.
 *
 * Modes:
 *   default                       — read --score-file, recompute engines.<id>
 *                                   block + global summary, splice into file.
 *   --write-calibration           — append a calibration batch entry to
 *                                   docs/evolution/calibration.yaml from the
 *                                   score-file's finding_assessments where
 *                                   calibration_match=false.
 *
 * Inputs:
 *   --score-file <path>           Required. Path to score-<run-id>.yaml.
 *   --trends-file <path>          Optional override (default docs/evolution/quality-trends.yaml).
 *   --calibration-file <path>     Optional override (default docs/evolution/calibration.yaml).
 *   --feedback-file <path>        Optional override (default docs/evolution/findings-feedback.yaml).
 *   --scores-dir <path>           Optional override for the score-file directory
 *                                 (default docs/evolution/quality-scores).
 *
 * Determinism: every input is a file on disk. new Date() is called only at
 * the write boundary (last_computed timestamps).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { readYAMLFile, writeFileAtomic, findWorkstreamDir, withFileLock, resolveEvolutionDir } = require('./lib/cwos-utils');

let spearmanCorrelation = null;
try { ({ spearmanCorrelation } = require('./cwos-reconcile')); }
catch { /* reconcile unavailable — spearman_rho stays null */ }

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i === args.length - 1) return null;
  return args[i + 1];
}
function hasFlag(args, name) { return args.includes(`--${name}`); }

function repoRoot() {
  const ws = findWorkstreamDir(process.cwd());
  return path.resolve(ws, '..', '..');
}

// ─── Paths ────────────────────────────────────────────────────────────────

function resolvePaths(args) {
  const root = repoRoot();
  return {
    scoreFile:       readFlag(args, 'score-file'),
    trendsFile:      readFlag(args, 'trends-file')      || path.join(root, 'docs', 'evolution', 'quality-trends.yaml'),
    calibrationFile: readFlag(args, 'calibration-file') || path.join(root, 'docs', 'evolution', 'calibration.yaml'),
    feedbackFile:    readFlag(args, 'feedback-file')    || path.join(resolveEvolutionDir(root), 'findings-feedback.yaml'), // WS-421: scope-aware
    scoresDir:       readFlag(args, 'scores-dir')       || path.join(root, 'docs', 'evolution', 'quality-scores'),
  };
}

// ─── Score-file aggregation ───────────────────────────────────────────────

function listScoreFiles(scoresDir) {
  if (!fs.existsSync(scoresDir)) return [];
  return fs.readdirSync(scoresDir)
    .filter(f => /^score-.*\.yaml$/.test(f))
    .map(f => path.join(scoresDir, f))
    .sort();
}

function loadScores(scoresDir) {
  const out = [];
  for (const fp of listScoreFiles(scoresDir)) {
    const r = readYAMLFile(fp);
    if (!r.ok || !r.data) continue;
    out.push({ ...r.data, _file: fp });
  }
  // Sort by date string. Falls back to filename for stable order when date is
  // missing — score files are conventionally named score-run-NNN, so the
  // suffix sort approximates run ordering when dates collide.
  out.sort((a, b) => {
    const da = String(a.date || ''), db = String(b.date || '');
    if (da !== db) return da.localeCompare(db);
    return a._file.localeCompare(b._file);
  });
  return out;
}

// ─── Math helpers ─────────────────────────────────────────────────────────

const DIMENSIONS = ['relevance', 'calibration', 'completeness', 'novelty', 'constitution_compliance'];

function readDim(score, dim) {
  const v = score.scores && score.scores[dim];
  return typeof v === 'number' ? v : null;
}

function avg(arr) {
  if (!arr.length) return null;
  let s = 0, n = 0;
  for (const v of arr) { if (typeof v === 'number') { s += v; n++; } }
  return n ? s / n : null;
}

function round2(v) { return v == null ? null : Math.round(v * 100) / 100; }
function round3(v) { return v == null ? null : Math.round(v * 1000) / 1000; }

// ISO week (YYYY-WNN) for a date string. Returns null on parse failure.
function isoWeek(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Shift to Thursday of the same ISO week.
  target.setUTCDate(target.getUTCDate() + 3 - ((target.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7));
  const week = 1 + Math.round((target - firstThursday) / (7 * 86400000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Linear-fit trend label from a sequence of overall scores.
// `improving` if slope > +0.1 / units; `declining` if < -0.1; `stable` else.
// `insufficient_data` for fewer than 5 runs (per plan).
function trendLabel(overalls) {
  if (overalls.length < 5) return 'insufficient_data';
  const last5 = overalls.slice(-5);
  const xs = last5.map((_, i) => i);
  const xm = xs.reduce((a, b) => a + b, 0) / xs.length;
  const ym = last5.reduce((a, b) => a + b, 0) / last5.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - xm) * (last5[i] - ym);
    den += (xs[i] - xm) ** 2;
  }
  if (den === 0) return 'stable';
  const slope = num / den;
  if (slope > 0.1) return 'improving';
  if (slope < -0.1) return 'declining';
  return 'stable';
}

// ─── Founder-relevance ────────────────────────────────────────────────────

function loadFeedback(feedbackFile) {
  if (!fs.existsSync(feedbackFile)) return [];
  const r = readYAMLFile(feedbackFile);
  if (!r.ok || !r.data || !Array.isArray(r.data.entries)) return [];
  return r.data.entries.filter(e => e && e.signal && e.signal !== 'pending');
}

function computeFounderRelevance(engineId, allScores, feedback) {
  // signal_rate over feedback entries for this engine.
  const fb = feedback.filter(e => e.engine === engineId);
  let useful = 0, notUseful = 0;
  for (const e of fb) {
    if (e.signal === 'useful') useful++;
    else if (e.signal === 'not_useful' || e.signal === 'dismiss') notUseful++;
    // 'defer' / 'wrong_priority' are neutral
  }
  const graded = useful + notUseful;
  const signal_rate = graded >= 5 ? round3(useful / graded) : null;

  // Spearman: pair (overall, signal_rate per run) for this engine.
  // Mirrors validateEngineCalibration in cwos-reconcile.
  let spearman_rho = null, spearman_n = 0;
  if (spearmanCorrelation && allScores.length >= 1 && fb.length >= 1) {
    const byRun = {};
    for (const e of fb) {
      if (!e.run_id) continue;
      if (!byRun[e.run_id]) byRun[e.run_id] = { useful: 0, not_useful: 0 };
      if (e.signal === 'useful') byRun[e.run_id].useful++;
      else if (e.signal === 'not_useful' || e.signal === 'dismiss') byRun[e.run_id].not_useful++;
    }
    const pairs = [];
    for (const s of allScores.filter(x => x.engine === engineId)) {
      const runStats = byRun[s.run_id];
      if (!runStats) continue;
      const total = runStats.useful + runStats.not_useful;
      if (total === 0) continue;
      const rate = runStats.useful / total;
      const overall = readDim(s, 'overall') ?? (s.scores && s.scores.overall);
      if (typeof overall !== 'number') continue;
      pairs.push({ overall, rate });
    }
    if (pairs.length >= 20) {
      spearman_rho = round3(spearmanCorrelation(pairs.map(p => p.overall), pairs.map(p => p.rate)));
      spearman_n = pairs.length;
    } else {
      spearman_n = pairs.length; // record sample size even if below threshold
    }
  }

  return {
    graded_count: graded,
    signal_rate,
    spearman_rho,
    spearman_n,
    last_computed: new Date().toISOString().slice(0, 10),
  };
}

// ─── Per-engine block ─────────────────────────────────────────────────────

function buildEngineBlock(engineId, allScores, feedback) {
  const engineScores = allScores.filter(s => s.engine === engineId);
  if (engineScores.length === 0) return null;

  const last10 = engineScores.slice(-10);

  const overalls = engineScores
    .map(s => s.scores && s.scores.overall)
    .filter(v => typeof v === 'number');

  const last10Overalls = last10
    .map(s => s.scores && s.scores.overall)
    .filter(v => typeof v === 'number');

  const current_avg = round2(avg(last10Overalls));

  // Dimension averages over last 10 → weakest/strongest
  const dimAvgs = {};
  for (const d of DIMENSIONS) {
    const vals = last10.map(s => readDim(s, d)).filter(v => v != null);
    dimAvgs[d] = avg(vals);
  }
  let weakest = null, strongest = null;
  for (const d of DIMENSIONS) {
    if (dimAvgs[d] == null) continue;
    if (weakest === null || dimAvgs[d] < dimAvgs[weakest]) weakest = d;
    if (strongest === null || dimAvgs[d] > dimAvgs[strongest]) strongest = d;
  }

  // scores_over_time: weekly buckets, capped at 20
  const buckets = new Map();
  for (const s of engineScores) {
    const wk = isoWeek(s.date);
    if (!wk) continue;
    if (!buckets.has(wk)) buckets.set(wk, []);
    buckets.get(wk).push(s);
  }
  const sortedWeeks = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const scoresOverTime = sortedWeeks.slice(-20).map(([week, runs]) => ({
    week,
    runs: runs.length,
    avg_overall:      round2(avg(runs.map(r => readDim(r, 'overall')      ?? (r.scores && r.scores.overall)))),
    avg_relevance:    round2(avg(runs.map(r => readDim(r, 'relevance')))),
    avg_calibration:  round2(avg(runs.map(r => readDim(r, 'calibration')))),
    avg_completeness: round2(avg(runs.map(r => readDim(r, 'completeness')))),
    avg_novelty:      round2(avg(runs.map(r => readDim(r, 'novelty')))),
  }));

  return {
    runs_evaluated: engineScores.length,
    quality_trend: trendLabel(overalls),
    current_avg,
    scores_over_time: scoresOverTime,
    weakest_dimension: weakest || '',
    strongest_dimension: strongest || '',
    founder_relevance: computeFounderRelevance(engineId, allScores, feedback),
  };
}

// ─── YAML emission ────────────────────────────────────────────────────────

function emitNum(v, dec) {
  if (v == null || Number.isNaN(v)) return 'null';
  if (dec === 0) return String(Math.round(v));
  return String(Number(v).toFixed(dec)).replace(/\.0+$/, '.0');
}

function emitEngine(name, block) {
  const lines = [];
  lines.push(`  ${name}:`);
  lines.push(`    runs_evaluated: ${block.runs_evaluated}`);
  lines.push(`    quality_trend: ${block.quality_trend}`);
  lines.push(`    current_avg: ${emitNum(block.current_avg, 2)}`);
  if (block.scores_over_time.length === 0) {
    lines.push(`    scores_over_time: []`);
  } else {
    lines.push(`    scores_over_time:`);
    for (const w of block.scores_over_time) {
      lines.push(`      - week: "${w.week}"`);
      lines.push(`        runs: ${w.runs}`);
      lines.push(`        avg_overall: ${emitNum(w.avg_overall, 2)}`);
      lines.push(`        avg_relevance: ${emitNum(w.avg_relevance, 2)}`);
      lines.push(`        avg_calibration: ${emitNum(w.avg_calibration, 2)}`);
      lines.push(`        avg_completeness: ${emitNum(w.avg_completeness, 2)}`);
      lines.push(`        avg_novelty: ${emitNum(w.avg_novelty, 2)}`);
    }
  }
  lines.push(`    weakest_dimension: "${block.weakest_dimension}"`);
  lines.push(`    strongest_dimension: "${block.strongest_dimension}"`);
  lines.push(`    founder_relevance:`);
  lines.push(`      graded_count: ${block.founder_relevance.graded_count}`);
  lines.push(`      signal_rate: ${emitNum(block.founder_relevance.signal_rate, 3)}`);
  lines.push(`      spearman_rho: ${emitNum(block.founder_relevance.spearman_rho, 3)}`);
  lines.push(`      spearman_n: ${block.founder_relevance.spearman_n}`);
  lines.push(`      last_computed: "${block.founder_relevance.last_computed}"`);
  return lines.join('\n');
}

function emitEngines(engines) {
  const names = Object.keys(engines).sort();
  if (names.length === 0) return ' {}';
  return '\n' + names.map(n => emitEngine(n, engines[n])).join('\n') + '\n';
}

function emitGlobal(engines) {
  const names = Object.keys(engines);
  let totalRuns = 0;
  for (const n of names) totalRuns += engines[n].runs_evaluated || 0;

  const fleetAvg = (() => {
    const avgs = names.map(n => engines[n].current_avg).filter(v => typeof v === 'number');
    return round2(avg(avgs));
  })();

  let best = null, worst = null;
  for (const n of names) {
    const a = engines[n].current_avg;
    if (typeof a !== 'number') continue;
    if (best === null || a > engines[best].current_avg) best = n;
    if (worst === null || a < engines[worst].current_avg) worst = n;
  }

  // most_improved: engine with quality_trend === 'improving' having highest current_avg
  let mostImproved = null;
  for (const n of names) {
    if (engines[n].quality_trend !== 'improving') continue;
    if (!mostImproved || (engines[n].current_avg || 0) > (engines[mostImproved].current_avg || 0)) {
      mostImproved = n;
    }
  }

  const lines = [];
  lines.push('global:');
  lines.push(`  total_runs_evaluated: ${totalRuns}`);
  lines.push(`  fleet_avg_quality: ${emitNum(fleetAvg, 2)}`);
  lines.push(`  best_performing_engine: ${best ? `"${best}"` : 'null'}`);
  lines.push(`  worst_performing_engine: ${worst ? `"${worst}"` : 'null'}`);
  lines.push(`  most_improved_engine: ${mostImproved ? `"${mostImproved}"` : 'null'}`);
  lines.push(`  systemic_weaknesses: []`);
  return lines.join('\n');
}

// ─── Splicing into the file ───────────────────────────────────────────────

// Replace the contents of a top-level YAML block (key == `engines` or `global`)
// in `text` with `newKeyAndBody`. The block extends from `^key:` until the
// first column-0 line that's outside the block (treating column-0 # comments
// and other top-level keys as boundaries). Comments outside the block are
// preserved untouched.
function spliceTopLevelBlock(text, key, newKeyAndBody) {
  const lines = text.split(/\r?\n/);
  let start = -1;
  const headRe = new RegExp(`^${key}\\s*:`);
  for (let i = 0; i < lines.length; i++) {
    if (headRe.test(lines[i])) { start = i; break; }
  }
  if (start === -1) {
    return text.replace(/\s+$/, '') + '\n\n' + newKeyAndBody + '\n';
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') continue;
    if (/^[ \t]/.test(line)) continue;
    end = i;
    break;
  }
  while (end > start + 1 && lines[end - 1].trim() === '') end--;
  return [
    ...lines.slice(0, start),
    newKeyAndBody,
    ...lines.slice(end),
  ].join('\n');
}

// ─── Mode handlers ────────────────────────────────────────────────────────

function modeWriteTrends(paths) {
  if (!paths.scoreFile) {
    process.stderr.write('cwos-quality-trends-write: --score-file required\n');
    process.exit(2);
  }
  if (!fs.existsSync(paths.scoreFile)) {
    process.stderr.write(`cwos-quality-trends-write: score file not found: ${paths.scoreFile}\n`);
    process.exit(2);
  }
  if (!fs.existsSync(paths.trendsFile)) {
    process.stderr.write(`cwos-quality-trends-write: trends file not found: ${paths.trendsFile}\n`);
    process.exit(2);
  }

  // The score-file dir overrides scoresDir, so a fixture score file located
  // outside docs/evolution/quality-scores still drives the rolling window.
  const inferredScoresDir = path.dirname(paths.scoreFile);
  const scoresDir = fs.existsSync(inferredScoresDir) ? inferredScoresDir : paths.scoresDir;

  const allScores = loadScores(scoresDir);
  if (allScores.length === 0) {
    process.stderr.write(`cwos-quality-trends-write: no score files in ${scoresDir}\n`);
    process.exit(2);
  }

  const feedback = loadFeedback(paths.feedbackFile);

  // Build blocks for every engine present in score files (not just the one
  // referenced by --score-file). This keeps the trends file globally consistent.
  const engineIds = [...new Set(allScores.map(s => s.engine).filter(Boolean))];
  const engines = {};
  for (const eid of engineIds) {
    const blk = buildEngineBlock(eid, allScores, feedback);
    if (blk) engines[eid] = blk;
  }

  const text = fs.readFileSync(paths.trendsFile, 'utf8');
  let updated = spliceTopLevelBlock(text, 'engines', 'engines:' + emitEngines(engines));
  updated = spliceTopLevelBlock(updated, 'global', emitGlobal(engines));

  writeFileAtomic(paths.trendsFile, updated);
  process.stdout.write(JSON.stringify({
    ok: true,
    mode: 'write-trends',
    score_file: paths.scoreFile,
    engines_updated: Object.keys(engines).length,
    total_score_files: allScores.length,
  }, null, 2) + '\n');
}

function modeWriteCalibration(paths) {
  if (!paths.scoreFile) {
    process.stderr.write('cwos-quality-trends-write --write-calibration: --score-file required\n');
    process.exit(2);
  }
  const sr = readYAMLFile(paths.scoreFile);
  if (!sr.ok || !sr.data) {
    process.stderr.write(`cwos-quality-trends-write: score file unparseable: ${paths.scoreFile}\n`);
    process.exit(2);
  }
  const score = sr.data;
  const issues = (score.finding_assessments || [])
    .filter(fa => fa && fa.calibration_match === false)
    .map(fa => ({
      finding_id: fa.finding_id,
      predicted_severity: fa.predicted_severity,
      judge_severity: fa.judge_severity,
      rationale: fa.rationale || '',
    }));

  if (issues.length === 0) {
    process.stdout.write(JSON.stringify({
      ok: true,
      mode: 'write-calibration',
      no_op: true,
      reason: 'no calibration mismatches in score file',
    }, null, 2) + '\n');
    return;
  }

  const sevDist = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const fa of (score.finding_assessments || [])) {
    const sev = String(fa.predicted_severity || '').toLowerCase();
    if (sev === 'critical') sevDist.critical++;
    else if (sev === 'high') sevDist.high++;
    else if (sev === 'medium') sevDist.medium++;
    else if (sev === 'low') sevDist.low++;
  }

  const batchId = `QJ-${score.run_id || 'unknown'}`;
  const date = score.date || new Date().toISOString().slice(0, 10);

  const lines = [];
  lines.push(`  - batch_id: "${batchId}"`);
  lines.push(`    date: "${date}"`);
  lines.push(`    engines: [${score.engine || 'unknown'}]`);
  lines.push(`    finding_count: ${(score.finding_assessments || []).length}`);
  lines.push(`    severity_distribution:`);
  lines.push(`      critical: ${sevDist.critical}`);
  lines.push(`      high: ${sevDist.high}`);
  lines.push(`      medium: ${sevDist.medium}`);
  lines.push(`      low: ${sevDist.low}`);
  lines.push(`    user_feedback_type: "quality-judge-auto"`);
  lines.push(`    calibration_issues:`);
  for (const it of issues) {
    lines.push(`      - finding_id: "${it.finding_id}"`);
    lines.push(`        predicted_severity: ${it.predicted_severity}`);
    lines.push(`        judge_severity: ${it.judge_severity}`);
    lines.push(`        rationale: ${JSON.stringify(it.rationale)}`);
  }
  lines.push(`    calibration_outcome: "${issues.length} of ${(score.finding_assessments || []).length} findings flagged for severity recalibration."`);

  if (!fs.existsSync(paths.calibrationFile)) {
    process.stderr.write(`cwos-quality-trends-write: calibration file not found: ${paths.calibrationFile}\n`);
    process.exit(2);
  }

  // WS-311: lock the read-modify-write so this writer can't race with
  // the founder-calibration writer (modeWriteFounderCalibration).
  const calibrationLock = paths.calibrationFile + '.lock';
  const lockDir = path.dirname(calibrationLock);
  if (!fs.existsSync(lockDir)) fs.mkdirSync(lockDir, { recursive: true });
  withFileLock(calibrationLock, () => {
    // Append before the `summary:` block (or at end of entries: list).
    const text = fs.readFileSync(paths.calibrationFile, 'utf8');
    const fileLines = text.split(/\r?\n/);
    let insertAt = fileLines.length;
    for (let i = 0; i < fileLines.length; i++) {
      if (/^summary\s*:/.test(fileLines[i])) { insertAt = i; break; }
    }
    while (insertAt > 0 && fileLines[insertAt - 1].trim() === '') insertAt--;
    const updated = [
      ...fileLines.slice(0, insertAt),
      '',
      ...lines,
      '',
      ...fileLines.slice(insertAt),
    ].join('\n');

    writeFileAtomic(paths.calibrationFile, updated);
  }, { ownerLabel: 'quality-trends:write-calibration', maxWaitMs: 5000 });

  process.stdout.write(JSON.stringify({
    ok: true,
    mode: 'write-calibration',
    batch_id: batchId,
    issues_appended: issues.length,
  }, null, 2) + '\n');
}

// ─── Founder calibration writer (WS-311: replaces /evolve calibrate AI prose) ─
//
// Reads a JSON batch file produced by /evolve calibrate Step 4 and appends
// the entry to docs/evolution/calibration.yaml under the same lockfile that
// modeWriteCalibration uses, so the auto-eval writer and the founder writer
// can't corrupt each other.
//
// Batch file shape (validated below):
//   {
//     "batch_id": "CAL-BATCH-NNN",     // optional — derived from next id if absent
//     "date": "YYYY-MM-DD",            // optional — defaults to today
//     "engines": ["eng-engine", ...],
//     "finding_count": <int>,
//     "severity_distribution": { "critical": N, "high": N, "medium": N, "low": N },
//     "launch_relevance": "most|about-half|few|none",
//     "user_feedback": [
//       { "signal": "...", "implication": "...", "affects": ["..."] },
//       ...
//     ],
//     "findings_calibrated": ["FIND-NNN", ...],
//     "calibration_outcome": "..."
//   }

function nextFounderBatchId(text) {
  const m = (text || '').match(/batch_id:\s*"CAL-BATCH-(\d+)"/g) || [];
  let max = 0;
  for (const tok of m) {
    const n = parseInt(tok.match(/(\d+)/)[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `CAL-BATCH-${String(max + 1).padStart(3, '0')}`;
}

function formatFounderBatch(batch) {
  const lines = [];
  lines.push(`  - batch_id: "${batch.batch_id}"`);
  lines.push(`    date: "${batch.date}"`);
  const engines = Array.isArray(batch.engines) ? batch.engines.join(', ') : String(batch.engines || '');
  lines.push(`    engines: [${engines}]`);
  lines.push(`    finding_count: ${batch.finding_count || 0}`);
  const sd = batch.severity_distribution || {};
  lines.push(`    severity_distribution:`);
  lines.push(`      critical: ${sd.critical || 0}`);
  lines.push(`      high: ${sd.high || 0}`);
  lines.push(`      medium: ${sd.medium || 0}`);
  lines.push(`      low: ${sd.low || 0}`);
  lines.push(`    user_feedback_type: "founder-calibration"`);
  if (batch.launch_relevance) {
    lines.push(`    launch_relevance: "${batch.launch_relevance}"`);
  }
  const fb = Array.isArray(batch.user_feedback) ? batch.user_feedback : [];
  if (fb.length) {
    lines.push(`    user_feedback:`);
    for (const f of fb) {
      lines.push(`      - signal: ${JSON.stringify(f.signal || '')}`);
      lines.push(`        implication: ${JSON.stringify(f.implication || '')}`);
      const affects = Array.isArray(f.affects) ? f.affects.join(', ') : String(f.affects || '');
      lines.push(`        affects: [${affects}]`);
    }
  }
  const fc = Array.isArray(batch.findings_calibrated) ? batch.findings_calibrated : [];
  if (fc.length) {
    const ids = fc.map(id => `"${id}"`).join(', ');
    lines.push(`    findings_calibrated: [${ids}]`);
  }
  if (batch.calibration_outcome) {
    lines.push(`    calibration_outcome: ${JSON.stringify(batch.calibration_outcome)}`);
  }
  return lines;
}

function modeWriteFounderCalibration(paths, batchFile) {
  if (!batchFile) {
    process.stderr.write('cwos-quality-trends-write --write-founder-calibration: --batch-file required\n');
    process.exit(2);
  }
  if (!fs.existsSync(batchFile)) {
    process.stderr.write(`cwos-quality-trends-write: batch file not found: ${batchFile}\n`);
    process.exit(2);
  }
  let batch;
  try {
    batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
  } catch (e) {
    process.stderr.write(`cwos-quality-trends-write: batch file unparseable: ${e.message}\n`);
    process.exit(2);
  }
  if (!fs.existsSync(paths.calibrationFile)) {
    process.stderr.write(`cwos-quality-trends-write: calibration file not found: ${paths.calibrationFile}\n`);
    process.exit(2);
  }

  const calibrationLock = paths.calibrationFile + '.lock';
  const lockDir = path.dirname(calibrationLock);
  if (!fs.existsSync(lockDir)) fs.mkdirSync(lockDir, { recursive: true });

  let assignedBatchId;
  withFileLock(calibrationLock, () => {
    const text = fs.readFileSync(paths.calibrationFile, 'utf8');
    if (!batch.batch_id) batch.batch_id = nextFounderBatchId(text);
    if (!batch.date) batch.date = new Date().toISOString().slice(0, 10);
    assignedBatchId = batch.batch_id;
    const entryLines = formatFounderBatch(batch);

    const fileLines = text.split(/\r?\n/);
    let insertAt = fileLines.length;
    for (let i = 0; i < fileLines.length; i++) {
      if (/^summary\s*:/.test(fileLines[i])) { insertAt = i; break; }
    }
    while (insertAt > 0 && fileLines[insertAt - 1].trim() === '') insertAt--;
    const updated = [
      ...fileLines.slice(0, insertAt),
      '',
      ...entryLines,
      '',
      ...fileLines.slice(insertAt),
    ].join('\n');

    writeFileAtomic(paths.calibrationFile, updated);
  }, { ownerLabel: 'quality-trends:write-founder-calibration', maxWaitMs: 5000 });

  process.stdout.write(JSON.stringify({
    ok: true,
    mode: 'write-founder-calibration',
    batch_id: assignedBatchId,
    file: paths.calibrationFile,
  }, null, 2) + '\n');
}

// ─── Dispatch ─────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    process.stdout.write('usage: cwos-quality-trends-write --score-file <path> [--write-calibration] [--trends-file P] [--feedback-file P] [--scores-dir P]\n');
    process.stdout.write('       cwos-quality-trends-write --write-founder-calibration --batch-file <path> [--calibration-file P]\n');
    process.exit(args.length === 0 ? 1 : 0);
  }
  const paths = resolvePaths(args);
  if (hasFlag(args, 'write-founder-calibration')) {
    return modeWriteFounderCalibration(paths, readFlag(args, 'batch-file'));
  }
  if (hasFlag(args, 'write-calibration')) return modeWriteCalibration(paths);
  return modeWriteTrends(paths);
}

if (require.main === module) main();

module.exports = {
  isoWeek, trendLabel, buildEngineBlock, computeFounderRelevance,
  emitEngine, emitEngines, emitGlobal, spliceTopLevelBlock,
  loadScores, loadFeedback, listScoreFiles,
};
