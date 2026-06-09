#!/usr/bin/env node
/**
 * cwos-asn-report.js — surface AS-N (load-bearing assumption) status across
 * program YAMLs, ADRs, and program charters. Deterministic walker, zero LLM
 * calls, zero external deps.
 *
 * Companion to cwos-asn-validate.js (structural validator) and
 * cwos-asn-transition.js (manual lifecycle bookkeeping). This script is the
 * surfacing/forcing-function layer per WS-318: it reports *which* AS-Ns are
 * declared, which have machine-runnable falsification tests, which are
 * overdue, and (with --emit-findings) writes per-AS-N findings for entries
 * lacking a deterministically-runnable test.
 *
 * Invocations:
 *   node cwos-asn-report.js               # JSON to stdout (default)
 *   node cwos-asn-report.js --json        # explicit JSON
 *   node cwos-asn-report.js --human       # human-readable tables
 *   node cwos-asn-report.js --emit-findings  # write FIND-NNN.yaml for non-runnable AS-Ns
 *
 * Exit codes:
 *   0 = report generated (regardless of contents)
 *   1 = fatal (couldn't read repo / parse error in own state)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { parseYAML, readYAMLFile, globFiles, todayISO, findWorkstreamDir, findRepoRoot } = require('./lib/cwos-utils');

// ─── Constants ──────────────────────────────────────────────────────────────

const ID_RE = /^AS-\d+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Methodological control_case is "machine-runnable" when it begins with a
// recognized command-line invoker. Anything else (prose, "review the X",
// "compare against Y") is treated as needing a manual evaluator.
const RUNNABLE_PREFIXES = /^\s*(node|grep|sh|bash|rg|ripgrep)\s+/i;

// ─── Repo / artifact helpers ───────────────────────────────────────────────

// Mirror of cwos-asn-validate.js's extractFencedYaml — duplicated to keep
// the validator's module untouched.
function extractFencedYaml(md, headingRe) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let inSection = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      inSection = headingRe.test(lines[i]);
      continue;
    }
    if (!inSection) continue;
    if (/^```(?:yaml|yml)?\s*$/.test(lines[i])) {
      const buf = [];
      let j = i + 1;
      while (j < lines.length && !/^```\s*$/.test(lines[j])) {
        buf.push(lines[j]);
        j++;
      }
      return buf.join('\n');
    }
  }
  return null;
}

function tryParseYaml(text) {
  try { return { data: parseYAML(text), error: null }; }
  catch (err) { return { data: null, error: err.message }; }
}

function asnsFromYamlText(text) {
  const r = tryParseYaml(text);
  if (r.error) return null;
  const d = r.data;
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.assumptions)) return d.assumptions;
  return null;
}

// ─── Classification ────────────────────────────────────────────────────────

function daysUntilRevisit(revisit, todayStr) {
  if (!ISO_DATE_RE.test(String(revisit || ''))) return null;
  const t = Date.parse(todayStr + 'T00:00:00Z');
  const r = Date.parse(revisit + 'T00:00:00Z');
  if (isNaN(t) || isNaN(r)) return null;
  return Math.round((r - t) / 86400000);
}

function classifyMachineRunnable(asn) {
  const f = asn && asn.falsifies_if;
  if (!f || typeof f !== 'object' || Array.isArray(f)) return false;
  const t = String(asn.type || '');
  if (t === 'methodological') {
    const cc = String(f.control_case || '').trim();
    return RUNNABLE_PREFIXES.test(cc);
  }
  if (t === 'empirical') {
    const thr = String(f.threshold || '').trim();
    const src = String(f.observation_source || '').trim();
    if (!thr || !src) return false;
    if (!/(\d+|>=|<=|>|<|==|!=)/.test(thr)) return false;
    return /(\.claude\/|kit\/|state\.|findings|queue|events?|metrics)/i.test(src);
  }
  // strategic and any other type: never machine_runnable (watch_surfaces are URLs).
  return false;
}

function buildItem(asn, todayStr) {
  if (!asn || typeof asn !== 'object' || !asn.id || !ID_RE.test(String(asn.id))) {
    return null;
  }
  const dur = daysUntilRevisit(asn.revisit, todayStr);
  const overdue = (asn.status === 'active' || asn.status === 'proposed')
    && dur !== null && dur < 0;
  return {
    id: asn.id,
    type: asn.type || null,
    status: asn.status || null,
    severity: asn.severity || null,
    revisit: asn.revisit || null,
    days_until_revisit: dur,
    overdue,
    machine_runnable: classifyMachineRunnable(asn),
    claim: String(asn.claim || '').trim(),
    falsifies_if: asn.falsifies_if || null,
  };
}

// ─── Per-artifact report builders ──────────────────────────────────────────

function reportFromProgramYaml(p, todayStr) {
  const r = readYAMLFile(p);
  if (!r.ok || !r.data) return null;
  const asns = Array.isArray(r.data.assumptions) ? r.data.assumptions : [];
  const items = asns.map(a => buildItem(a, todayStr)).filter(Boolean);
  if (items.length === 0) return null;
  return {
    artifact_id: r.data.id || path.basename(p, '.yaml').replace(/^prog-/, ''),
    artifact_kind: 'program',
    source: p,
    items,
  };
}

function reportFromMarkdown(p, headingRe, kind, todayStr) {
  let md;
  try { md = fs.readFileSync(p, 'utf8'); } catch { return null; }
  const block = extractFencedYaml(md, headingRe);
  if (!block) return null;
  const asns = asnsFromYamlText(block);
  if (!asns) return null;
  const items = asns.map(a => buildItem(a, todayStr)).filter(Boolean);
  if (items.length === 0) return null;
  return {
    artifact_id: path.basename(p, path.extname(p)),
    artifact_kind: kind,
    source: p,
    items,
  };
}

function findArtifactReports(repoRoot, todayStr) {
  const reports = [];
  const progDir = path.join(repoRoot, '.claude', 'workstream', 'programs');
  if (fs.existsSync(progDir)) {
    for (const f of globFiles(progDir, 'prog-*.yaml')) {
      if (path.basename(f) === 'prog-template.yaml') continue;
      const r = reportFromProgramYaml(f, todayStr);
      if (r) reports.push(r);
    }
  }
  const adrDir = path.join(repoRoot, 'docs', 'adrs');
  if (fs.existsSync(adrDir)) {
    for (const f of globFiles(adrDir, 'ADR-*.md')) {
      const r = reportFromMarkdown(f, /^##\s+Load-Bearing\s+Assumptions/i, 'adr', todayStr);
      if (r) reports.push(r);
    }
  }
  const charterDir = path.join(repoRoot, 'docs', 'programs');
  if (fs.existsSync(charterDir)) {
    for (const f of globFiles(charterDir, '*.md')) {
      const r = reportFromMarkdown(f,
        /^##\s+(Load-Bearing\s+Assumptions|Assumptions(\s+being\s+tracked)?)/i,
        'charter', todayStr);
      if (r) reports.push(r);
    }
  }
  return reports;
}

// ─── Aggregation ───────────────────────────────────────────────────────────

function emptyCounts() {
  return { proposed: 0, active: 0, validated: 0, contradicted: 0, at_risk: 0, retired: 0 };
}

function aggregateReport(artifactReports, todayStr) {
  const out = {
    scanned_at: todayStr,
    artifacts_checked: artifactReports.length,
    total_assumptions: 0,
    counts_by_status: emptyCounts(),
    machine_runnable_total: 0,
    overdue_total: 0,
    by_artifact: {},
  };
  for (const r of artifactReports) {
    const counts = emptyCounts();
    let runnable = 0, overdue = 0;
    for (const it of r.items) {
      out.total_assumptions++;
      if (counts[it.status] != null) counts[it.status]++;
      if (out.counts_by_status[it.status] != null) out.counts_by_status[it.status]++;
      if (it.machine_runnable) { runnable++; out.machine_runnable_total++; }
      if (it.overdue) { overdue++; out.overdue_total++; }
    }
    out.by_artifact[r.artifact_id] = {
      kind: r.artifact_kind,
      source: r.source,
      counts,
      machine_runnable: runnable,
      overdue,
      total: r.items.length,
      items: r.items,
    };
  }
  return out;
}

// ─── Pulse-friendly per-program summary ────────────────────────────────────

/**
 * Compute the compact per-program assumption summary used by /pulse.
 * Pure function over a program's `assumptions:` array — no I/O.
 * Returns null when there are no AS-N entries to surface.
 */
function summarizeProgramAssumptions(assumptions, todayStr) {
  if (!Array.isArray(assumptions) || assumptions.length === 0) return null;
  const today = todayStr || todayISO();
  const counts = emptyCounts();
  let runnable = 0, overdue = 0, total = 0;
  for (const a of assumptions) {
    const it = buildItem(a, today);
    if (!it) continue;
    total++;
    if (counts[it.status] != null) counts[it.status]++;
    if (it.machine_runnable) runnable++;
    if (it.overdue) overdue++;
  }
  if (total === 0) return null;
  return { total, counts, machine_runnable: runnable, overdue };
}

// ─── Human render ──────────────────────────────────────────────────────────

function renderHuman(agg) {
  const out = [];
  out.push(`# AS-N Report — scanned ${agg.scanned_at}`);
  out.push('');
  const artifactCount = Object.keys(agg.by_artifact).length;
  out.push(`Total: ${agg.total_assumptions} AS-Ns across ${artifactCount} artifact(s) (${agg.artifacts_checked} scanned).`);
  out.push(`By status: ${formatCounts(agg.counts_by_status)}.`);
  out.push(`Machine-runnable: ${agg.machine_runnable_total}/${agg.total_assumptions}.`);
  out.push(`Overdue (active/proposed past revisit): ${agg.overdue_total}.`);
  out.push('');
  out.push(`| Artifact | Kind | Total | Active | Proposed | Validated | Contradicted | Runnable | Overdue |`);
  out.push(`|----------|------|-------|--------|----------|-----------|--------------|----------|---------|`);
  const keys = Object.keys(agg.by_artifact).sort();
  for (const k of keys) {
    const a = agg.by_artifact[k];
    const flag = a.overdue > 0 ? ' (!)' : '';
    out.push(`| ${k}${flag} | ${a.kind} | ${a.total} | ${a.counts.active} | ${a.counts.proposed} | ${a.counts.validated} | ${a.counts.contradicted} | ${a.machine_runnable}/${a.total} | ${a.overdue} |`);
  }
  out.push('');
  return out.join('\n');
}

function formatCounts(c) {
  const parts = [];
  for (const k of ['proposed', 'active', 'validated', 'contradicted', 'at_risk', 'retired']) {
    if (c[k] > 0) parts.push(`${c[k]} ${k}`);
  }
  return parts.length ? parts.join(', ') : 'none';
}

// ─── Finding emission ──────────────────────────────────────────────────────

function loadExistingDedupKeys(findingsDir) {
  const set = new Set();
  for (const f of fs.readdirSync(findingsDir)) {
    if (!/^FIND-\d+\.yaml$/.test(f)) continue;
    let text;
    try { text = fs.readFileSync(path.join(findingsDir, f), 'utf8'); }
    catch { continue; }
    const m = /^dedup_key:\s*"?([^"\n]+?)"?\s*$/m.exec(text);
    if (m) set.add(m[1].trim());
  }
  return set;
}

function findMaxFindingId(findingsDir) {
  let maxId = 0;
  for (const f of fs.readdirSync(findingsDir)) {
    const m = /^FIND-(\d+)\.yaml$/.exec(f);
    if (m) maxId = Math.max(maxId, parseInt(m[1], 10));
  }
  return maxId;
}

function emitFindings(agg, opts = {}) {
  const repoRoot = opts.repoRoot || findRepoRoot();
  const findingsDir = opts.findingsDir
    || path.join(repoRoot, '.claude', 'workstream', 'findings');
  if (!fs.existsSync(findingsDir)) {
    return { ok: false, error: `findings dir not found: ${findingsDir}`, written: [], skipped: [] };
  }
  const dedup = loadExistingDedupKeys(findingsDir);
  let nextId = findMaxFindingId(findingsDir);
  const written = [];
  const skipped = [];
  const createdAt = new Date().toISOString();

  for (const artifactId of Object.keys(agg.by_artifact).sort()) {
    const a = agg.by_artifact[artifactId];
    for (const it of a.items) {
      if (it.machine_runnable) continue;
      // Skip retired/validated AS-Ns — no action needed for them.
      if (it.status === 'retired' || it.status === 'validated') continue;
      const dedupKey = `asn-not-runnable:${it.id}:${artifactId}`;
      if (dedup.has(dedupKey)) { skipped.push(dedupKey); continue; }
      nextId++;
      const findingId = `FIND-${String(nextId).padStart(3, '0')}`;
      const sourceRel = path.relative(repoRoot, a.source).replace(/\\/g, '/');
      const yaml = renderFindingYaml({
        id: findingId, asn: it, artifactId, kind: a.kind,
        sourceRel, dedupKey, createdAt,
      });
      fs.writeFileSync(path.join(findingsDir, `${findingId}.yaml`), yaml, 'utf8');
      dedup.add(dedupKey);
      written.push({ id: findingId, dedup_key: dedupKey, asn_id: it.id, artifact: artifactId });
    }
  }
  return { ok: true, written, skipped, scanned_at: agg.scanned_at };
}

function renderFindingYaml({ id, asn, artifactId, kind, sourceRel, dedupKey, createdAt }) {
  const lines = [];
  lines.push(`id: "${id}"`);
  lines.push(`engine: cwos-asn-report`);
  lines.push(`run_id: "asn-report-${createdAt.slice(0, 10)}"`);
  lines.push(`persona: deterministic`);
  lines.push(`severity: medium`);
  lines.push(`priority_score: 25`);
  lines.push(`milestone_context: "Surfaced by cwos-asn-report.js first-sweep on ${createdAt.slice(0, 10)} (WS-318)"`);
  lines.push(`recommended_action: "Either rewrite ${asn.id}'s falsifies_if as a deterministically-runnable test (methodological control_case starting with node|grep|sh|bash, OR empirical threshold + CWOS observation_source path) — or accept it as manual-only and revisit on schedule via cwos-asn-transition.js."`);
  lines.push(`status: open`);
  lines.push(`title: "AS-N ${asn.id} in ${artifactId} has prose-only falsification test (not deterministically runnable)"`);
  lines.push(`description: |`);
  lines.push(`  Artifact: ${artifactId} (${kind})`);
  lines.push(`  Type: ${asn.type || 'unknown'}`);
  lines.push(`  Status: ${asn.status || 'unknown'}`);
  lines.push(`  Revisit: ${asn.revisit || 'n/a'}`);
  lines.push(`  Claim: ${oneline(asn.claim)}`);
  lines.push(`  Falsifies_if shape:`);
  lines.push(yamlNested(asn.falsifies_if, '    '));
  lines.push(`evidence:`);
  lines.push(`  file: "${sourceRel}"`);
  lines.push(`  asn_id: "${asn.id}"`);
  lines.push(`dedup_key: "${dedupKey}"`);
  lines.push(`program: "program-integrity"`);
  lines.push(`problem_class: "Schema Validity"`);
  lines.push(`graduated_to: ""`);
  lines.push(`created_at: "${createdAt}"`);
  lines.push('');
  return lines.join('\n');
}

function oneline(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

function yamlNested(obj, indent) {
  if (!obj || typeof obj !== 'object') return `${indent}<missing>`;
  const lines = [];
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      lines.push(`${indent}${k}:`);
      for (const item of v) lines.push(`${indent}  - ${oneline(item)}`);
    } else if (v && typeof v === 'object') {
      lines.push(`${indent}${k}:`);
      for (const [k2, v2] of Object.entries(v)) {
        lines.push(`${indent}  ${k2}: ${oneline(v2)}`);
      }
    } else {
      lines.push(`${indent}${k}: ${oneline(v)}`);
    }
  }
  return lines.join('\n');
}

// ─── Main ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const flags = new Set(argv);
  return {
    human: flags.has('--human'),
    json: flags.has('--json'),
    emit: flags.has('--emit-findings'),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = findRepoRoot();
  const today = todayISO();
  const reports = findArtifactReports(repoRoot, today);
  const agg = aggregateReport(reports, today);

  if (args.emit) {
    const result = emitFindings(agg, { repoRoot });
    process.stdout.write(JSON.stringify({
      ok: result.ok !== false,
      scanned_at: agg.scanned_at,
      total_assumptions: agg.total_assumptions,
      machine_runnable_total: agg.machine_runnable_total,
      overdue_total: agg.overdue_total,
      findings: result,
    }, null, 2) + '\n');
    return;
  }
  if (args.human) {
    process.stdout.write(renderHuman(agg));
    return;
  }
  process.stdout.write(JSON.stringify(agg, null, 2) + '\n');
}

if (require.main === module) {
  try { main(); }
  catch (err) {
    process.stderr.write(`Fatal: ${err.message}\n${err.stack}\n`);
    process.exit(1);
  }
}

module.exports = {
  classifyMachineRunnable,
  daysUntilRevisit,
  buildItem,
  summarizeProgramAssumptions,
  aggregateReport,
  emitFindings,
  renderHuman,
  findArtifactReports,
};
