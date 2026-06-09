#!/usr/bin/env node
/**
 * cwos-value-ratio — outputs-acted-on metric (WS-369 / FIND-251).
 *
 * For each program, computes the ratio of "findings acted on" over a rolling
 * 90-day window. A finding is acted-on if it has been promoted to a workstream
 * item (i.e. carries a `promoted_to:` field linking it to a WS-NNN).
 *
 *   numerator   = count(findings where program == <id> AND created_at within window AND promoted_to is set)
 *   denominator = count(findings where program == <id> AND created_at within window)
 *   value_ratio = numerator / denominator  (rendered as percentage)
 *
 * Threshold: ratio < 50% → red (warning); ratio ≥ 50% → green.
 * Min signal: denominator < 5 → no judgment, return null pct.
 *
 * This is the synthesis-time partner to the WS-436 adopter-value gate
 * (INV-053). INV-053 catches findings that shouldn't have been filed in the
 * first place; the value-ratio catches programs whose findings ARE being
 * filed but aren't being acted on (operator-behavior-drift).
 *
 * Usage:
 *   node cwos-value-ratio.js --all                # all programs, JSON
 *   node cwos-value-ratio.js --all --human        # all programs, table
 *   node cwos-value-ratio.js --program kit-quality
 *   node cwos-value-ratio.js --program kit-quality --clock 2026-05-14
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const { globFiles, readYAMLFile, findWorkstreamDir, findRepoRoot, todayISO } = require('./lib/cwos-utils');

const WINDOW_DAYS = 90;
const MIN_SIGNAL = 5;
const VALUE_RATIO_WARN_THRESHOLD = 50; // percentage; below = red

function dateDaysAgo(today, days) {
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function loadFindings(rootDir) {
  let wsDir;
  try { wsDir = findWorkstreamDir(rootDir); }
  catch { return []; }
  const findingsDir = path.join(wsDir, 'findings');
  if (!fs.existsSync(findingsDir)) return [];
  const out = [];
  for (const f of globFiles(findingsDir, 'FIND-*.yaml')) {
    const r = readYAMLFile(f);
    if (!r.ok || !r.data) continue;
    out.push(r.data);
  }
  return out;
}

// Build the set of finding IDs that ARE referenced by at least one WS item.
// A finding counts as "promoted" if either:
//   (a) the finding YAML has promoted_to: <WS-NNN>, OR
//   (b) any WS item references the finding via source.finding, finding_id,
//       source.finding_id, or related.<list-containing-FIND-NNN>.
// (b) is the reverse-index; in this repo many findings have the WS pointer
// missing on the finding side even though the WS item exists, so a strict
// promoted_to-only definition would systematically undercount.
function loadPromotedFindingIds(rootDir) {
  let wsDir;
  try { wsDir = findWorkstreamDir(rootDir); }
  catch { return new Set(); }
  const queueDir = path.join(wsDir, 'queue');
  if (!fs.existsSync(queueDir)) return new Set();
  const ids = new Set();
  const findingIdPattern = /FIND-[A-Z0-9-]+/g;
  for (const f of globFiles(queueDir, 'WS-*.yaml')) {
    const r = readYAMLFile(f);
    if (!r.ok || !r.data) continue;
    const d = r.data;
    // Structured fields
    if (d.finding_id) ids.add(String(d.finding_id));
    if (d.source && d.source.finding) ids.add(String(d.source.finding));
    if (d.source && d.source.finding_id) ids.add(String(d.source.finding_id));
    if (d.source && d.source.evidence && typeof d.source.evidence === 'string') {
      const m = d.source.evidence.match(findingIdPattern);
      if (m) for (const fid of m) ids.add(fid);
    }
    // Free-text scan of related[] and notes for FIND-NNN references
    const relatedItems = Array.isArray(d.related) ? d.related : [];
    for (const r2 of relatedItems) {
      const m = String(r2).match(findingIdPattern);
      if (m) for (const fid of m) ids.add(fid);
    }
  }
  return ids;
}

function computeValueRatio(programId, rootDir, options = {}) {
  const today = options.clock || todayISO();
  const windowStart = dateDaysAgo(today, WINDOW_DAYS);
  const findings = options.findings || loadFindings(rootDir);
  const promotedIds = options.promotedIds || loadPromotedFindingIds(rootDir);

  let inWindow = 0;
  let promoted = 0;

  for (const d of findings) {
    if ((d.program || '') !== programId) continue;
    const createdAt = (d.created_at || d.detected_at || '').toString().slice(0, 10);
    if (!createdAt || createdAt < windowStart) continue;
    inWindow++;
    const hasForwardPtr = d.promoted_to && String(d.promoted_to).trim().length > 0;
    const hasReversePtr = d.id && promotedIds.has(String(d.id));
    if (hasForwardPtr || hasReversePtr) promoted++;
  }

  if (inWindow < MIN_SIGNAL) {
    return {
      program: programId,
      pct: null,
      window_count: inWindow,
      promoted_count: promoted,
      insufficient_signal: true,
      threshold: VALUE_RATIO_WARN_THRESHOLD,
      window_days: WINDOW_DAYS,
      window_start: windowStart,
      clock: today,
    };
  }

  const pct = Math.round((promoted / inWindow) * 100);
  return {
    program: programId,
    pct,
    window_count: inWindow,
    promoted_count: promoted,
    insufficient_signal: false,
    below_threshold: pct < VALUE_RATIO_WARN_THRESHOLD,
    threshold: VALUE_RATIO_WARN_THRESHOLD,
    window_days: WINDOW_DAYS,
    window_start: windowStart,
    clock: today,
  };
}

function listPrograms(rootDir) {
  const wsDir = findWorkstreamDir(rootDir);
  const programsDir = path.join(wsDir, 'programs');
  if (!fs.existsSync(programsDir)) return [];
  const out = [];
  for (const f of fs.readdirSync(programsDir)) {
    if (!/^prog-.+\.yaml$/.test(f) || f === 'prog-template.yaml') continue;
    const r = readYAMLFile(path.join(programsDir, f));
    if (!r.ok || !r.data || !r.data.id) continue;
    out.push(r.data.id);
  }
  return out;
}

function renderHuman(results) {
  const lines = [`## Value Ratio (90d) — outputs-acted-on per program`, ''];
  lines.push('| Program | Window N | Promoted | Ratio | Verdict |');
  lines.push('|---------|----------|----------|-------|---------|');
  for (const r of results) {
    const ratio = r.insufficient_signal
      ? '-'
      : `${r.pct}%${r.below_threshold ? ' !' : ''}`;
    const verdict = r.insufficient_signal
      ? `insufficient (N=${r.window_count} < ${MIN_SIGNAL})`
      : r.below_threshold ? `BELOW threshold (${VALUE_RATIO_WARN_THRESHOLD}%)` : 'OK';
    lines.push(`| ${r.program} | ${r.window_count} | ${r.promoted_count} | ${ratio} | ${verdict} |`);
  }
  lines.push('');
  lines.push(`Threshold: ${VALUE_RATIO_WARN_THRESHOLD}% (below = red \`!\`); window = ${WINDOW_DAYS} days; min-signal = ${MIN_SIGNAL} findings.`);
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const human = args.includes('--human');
  const all = args.includes('--all');
  const clockIdx = args.indexOf('--clock');
  const clock = clockIdx >= 0 && args[clockIdx + 1] ? args[clockIdx + 1] : null;
  const progIdx = args.indexOf('--program');
  const programArg = progIdx >= 0 && args[progIdx + 1] ? args[progIdx + 1] : null;

  const rootDir = findRepoRoot(process.cwd(), { markers: ['CLAUDE.md', 'kit'], requireAll: true, maxDepth: 8 });
  const findings = loadFindings(rootDir);
  const promotedIds = loadPromotedFindingIds(rootDir);
  const options = { clock, findings, promotedIds };

  let results;
  if (programArg) {
    results = [computeValueRatio(programArg, rootDir, options)];
  } else if (all) {
    const programs = listPrograms(rootDir);
    results = programs.map(id => computeValueRatio(id, rootDir, options));
  } else {
    process.stderr.write('Usage: cwos-value-ratio.js [--all | --program <id>] [--human] [--clock <YYYY-MM-DD>]\n');
    process.exit(2);
  }

  if (human) {
    process.stdout.write(renderHuman(results) + '\n');
  } else {
    process.stdout.write(JSON.stringify({ computed_at: clock || todayISO(), results }, null, 2) + '\n');
  }
}

if (require.main === module) main();

module.exports = { computeValueRatio, WINDOW_DAYS, MIN_SIGNAL, VALUE_RATIO_WARN_THRESHOLD };
