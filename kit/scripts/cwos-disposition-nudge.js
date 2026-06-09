#!/usr/bin/env node
/**
 * cwos-disposition-nudge.js — SessionStart hook (WS-293).
 *
 * Surfaces "N findings from M runs have no disposition yet" once per session
 * to keep the calibration loop closing. Skippable in 1 keystroke (the message
 * is informational — no prompt, no block).
 *
 * Counts findings in .claude/workstream/findings-index.yaml that:
 *   - are ≥ MIN_AGE_HOURS old, AND
 *   - have no entry with marked_by=founder in docs/evolution/findings-feedback.yaml
 *
 * Replay-pure: read-only.
 *
 * Usage:
 *   node cwos-disposition-nudge.js                  # default: write to stderr
 *   node cwos-disposition-nudge.js --quiet          # silent (still exits 0)
 *   node cwos-disposition-nudge.js --json           # JSON to stdout
 *   node cwos-disposition-nudge.js --findings-index <path> --feedback-file <path>  # tests
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { findRepoRoot, resolveEvolutionDir } = require('./lib/cwos-utils');

const DEFAULT_FINDINGS_INDEX = '.claude/workstream/findings-index.yaml';
// WS-421: basename only — directory resolved per repo scope via resolveEvolutionDir.
const FEEDBACK_BASENAME = 'findings-feedback.yaml';
const MIN_AGE_HOURS = 24;

function parseArgs(argv) {
  const out = { quiet: false, json: false, findingsIndex: null, feedbackFile: null, clock: null, minAgeHours: MIN_AGE_HOURS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--quiet') out.quiet = true;
    else if (a === '--json') out.json = true;
    else if (a === '--findings-index' && argv[i + 1]) out.findingsIndex = argv[++i];
    else if (a === '--feedback-file' && argv[i + 1]) out.feedbackFile = argv[++i];
    else if (a === '--clock' && argv[i + 1]) out.clock = argv[++i];
    else if (a === '--min-age-hours' && argv[i + 1]) out.minAgeHours = Number(argv[++i]);
  }
  return out;
}

/**
 * Loose YAML parsing for the two known files. The findings-index has shape:
 *   findings: [{id, run_id?, created_at, ...}]
 * The feedback file: entries: [{finding_id, run_id, marked_by, ...}]
 *
 * Both are stable schemas; we extract id-pairs without a full YAML parser.
 */
function readFindingsIndex(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const out = [];
  let cur = null;
  for (const l of lines) {
    const idMatch = l.match(/^\s*-\s*id\s*:\s*"?(FIND-\d{3,})"?\s*$/);
    if (idMatch) {
      if (cur && cur.id) out.push(cur);
      cur = { id: idMatch[1] };
      continue;
    }
    if (!cur) continue;
    const m = l.match(/^\s*(run_id|created_at|engine|status)\s*:\s*"?([^"\n]+?)"?\s*$/);
    if (m) cur[m[1]] = m[2].trim();
  }
  if (cur && cur.id) out.push(cur);
  return out;
}

function readFeedbackKeys(filePath) {
  if (!fs.existsSync(filePath)) return new Set();
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const keys = new Set();
  let cur = null;
  for (const l of lines) {
    const m = l.match(/^\s*-\s*finding_id\s*:\s*"?(FIND-\d{3,})"?\s*$/);
    if (m) {
      if (cur && cur.finding_id && cur.marked_by) keys.add(`${cur.finding_id}|${cur.marked_by}`);
      cur = { finding_id: m[1] };
      continue;
    }
    if (!cur) continue;
    const m2 = l.match(/^\s*(marked_by|run_id)\s*:\s*"?([^"\n]+?)"?\s*$/);
    if (m2) cur[m2[1]] = m2[2].trim();
  }
  if (cur && cur.finding_id && cur.marked_by) keys.add(`${cur.finding_id}|${cur.marked_by}`);
  return keys;
}

function compute(findings, feedbackKeys, opts) {
  const now = opts.clock ? new Date(opts.clock).getTime() : Date.now();
  const cutoff = now - (opts.minAgeHours * 60 * 60 * 1000);
  let unfilledCount = 0;
  const runs = new Set();
  const unfilledByRun = new Map();
  for (const f of findings) {
    if (!f.created_at) continue;
    const ts = Date.parse(f.created_at);
    if (Number.isNaN(ts) || ts > cutoff) continue;
    const founderKey = `${f.id}|founder`;
    if (feedbackKeys.has(founderKey)) continue;
    unfilledCount++;
    const runId = f.run_id || 'unknown';
    runs.add(runId);
    unfilledByRun.set(runId, (unfilledByRun.get(runId) || 0) + 1);
  }
  return {
    unfilled_findings: unfilledCount,
    runs_with_unfilled: runs.size,
    unfilled_by_run: Object.fromEntries(unfilledByRun),
    min_age_hours: opts.minAgeHours,
  };
}

function renderNudge(m) {
  if (m.unfilled_findings === 0) return null;
  return `📊 ${m.unfilled_findings} finding${m.unfilled_findings === 1 ? '' : 's'} from ${m.runs_with_unfilled} run${m.runs_with_unfilled === 1 ? '' : 's'} have no disposition yet — reply with [u/n/p/s] in the next briefing or run cwos-feedback-capture\n`;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const repoRoot = findRepoRoot(process.cwd());
  const findingsIndex = opts.findingsIndex || path.join(repoRoot, DEFAULT_FINDINGS_INDEX);
  const feedbackFile = opts.feedbackFile || path.join(resolveEvolutionDir(repoRoot), FEEDBACK_BASENAME);
  const findings = readFindingsIndex(findingsIndex);
  const feedbackKeys = readFeedbackKeys(feedbackFile);
  const m = compute(findings, feedbackKeys, opts);
  if (opts.json) { process.stdout.write(JSON.stringify(m, null, 2) + '\n'); process.exit(0); }
  if (opts.quiet) process.exit(0);
  const nudge = renderNudge(m);
  if (nudge) process.stderr.write(nudge);
  process.exit(0);
}

if (require.main === module) main();

module.exports = { parseArgs, readFindingsIndex, readFeedbackKeys, compute, renderNudge, MIN_AGE_HOURS };
