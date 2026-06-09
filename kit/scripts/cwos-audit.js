#!/usr/bin/env node
/**
 * cwos-audit — CLI consolidation of /audit (WS-268, ADR-037 Decision #3).
 *
 * Exactly 5 subcommands (Decision #3 / AS-037-4 — non-negotiable):
 *   focus          — drill into one audit area (drift / invariants /
 *                    programs / failures / queue). Returns scoped JSON.
 *   compose        — full audit envelope in ONE round of structured I/O.
 *                    Returns findings[] (with computed proposed_route),
 *                    gc_report, queue_health, drift_summary,
 *                    programs_summary, failures_summary.
 *   constitutional — wrapper around kit/scripts/cwos-constitutional-audit.js;
 *                    passes through args + exit codes.
 *   render         — read a compose envelope (file or stdin -), emit
 *                    markdown report + Decision #8 footer.
 *   verify-route   — dry-run proposed_route computation for one finding.
 *
 * Output convention (mirrors cwos-next.js / cwos-pulse.js):
 *   - JSON to stdout by default; `--human` flag adds formatted text.
 *   - Exit 0 on clean success, 1 on validation failure, 2 on invalid arg.
 *   - Most error paths exit 0 + stderr (AS-23 discipline). compose +
 *     verify-route + render + focus are READ-ONLY by design — no events
 *     emitted, no mutations.
 *
 * Replay-purity:
 *   - All reads via cwos-utils + state-store typed-API.
 *   - new Date() ONLY at clock-injection boundaries; tests use
 *     `--clock <iso>` for determinism.
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let stateStoreMod = null;
try { stateStoreMod = require('./core/state-store'); }
catch { process.exit(0); }

const {
  findWorkstreamDir,
  readYAMLFile,
  globFiles,
  todayISO,
  dateDiffDays,
} = require('./lib/cwos-utils');

// ─── Shared helpers ────────────────────────────────────────────────────────

const VALID_FOCUS_AREAS = new Set(['drift', 'invariants', 'programs', 'failures', 'queue']);

const DECISION_8_FOOTER = 'Audit envelope: deterministic (CLI). Finding routing: deterministic (CLI). Constitutional check: deterministic (CLI).';

function writeJson(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i === args.length - 1) return null;
  return args[i + 1];
}

function hasFlag(args, name) {
  return args.includes(`--${name}`);
}

function repoRoot() {
  const ws = findWorkstreamDir(process.cwd());
  return path.resolve(ws, '..', '..');
}

function findingsIndexPath() {
  return path.join(repoRoot(), '.claude', 'workstream', 'findings-index.yaml');
}

function loadFindingsIndex() {
  const p = findingsIndexPath();
  if (!fs.existsSync(p)) return [];
  const r = readYAMLFile(p);
  if (!r.ok || !r.data || !Array.isArray(r.data.findings)) return [];
  return r.data.findings;
}

function loadOpenFindings() {
  return loadFindingsIndex().filter((f) => f && f.status === 'open');
}

function loadProgramsList() {
  const dir = path.join(repoRoot(), '.claude', 'workstream', 'programs');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!/^prog-.+\.yaml$/.test(f) || f === 'prog-template.yaml') continue;
    const r = readYAMLFile(path.join(dir, f));
    if (r.ok && r.data) out.push(r.data);
  }
  return out;
}

function loadQueueIndex() {
  const p = path.join(repoRoot(), '.claude', 'workstream', 'queue-index.yaml');
  if (!fs.existsSync(p)) return [];
  const r = readYAMLFile(p);
  if (!r.ok || !r.data || !Array.isArray(r.data.items)) return [];
  return r.data.items;
}

// ─── Routing computation (founder fork-1: computed view, no schema change) ─

function computeProposedRoute(finding) {
  const program = finding.program || null;
  const severity = (finding.severity || '').toLowerCase();
  const promotedTo = finding.promoted_to || null;
  const wouldPromote = (severity === 'critical' || severity === 'high') && !promotedTo;
  const reasoning = buildRouteReasoning(severity, program, promotedTo);
  return { program, reasoning, would_promote_to_queue: wouldPromote };
}

function buildRouteReasoning(severity, program, promotedTo) {
  const parts = [];
  if (severity === 'critical' || severity === 'high') {
    parts.push(`severity=${severity} qualifies for queue promotion`);
  } else if (severity) {
    parts.push(`severity=${severity} below promotion threshold`);
  } else {
    parts.push('severity unset');
  }
  if (program) parts.push(`program=${program} owns accountability`);
  else parts.push('no program assigned — orphan finding');
  if (promotedTo) parts.push(`already promoted to ${promotedTo}`);
  return parts.join('; ');
}

// ─── Drift detection (read-only summary) ──────────────────────────────────

function computeDriftSummary(today) {
  const out = {
    state_md: null,
    decisions_md: null,
    intention_md: null,
  };
  const stateMd = path.join(repoRoot(), 'system', 'state.md');
  if (fs.existsSync(stateMd)) {
    const stat = fs.statSync(stateMd);
    const lastModISO = stat.mtime.toISOString().slice(0, 10);
    out.state_md = { last_modified: lastModISO, days_since: dateDiffDays(lastModISO, today) };
  }
  const decisionsMd = path.join(repoRoot(), 'system', 'decisions.md');
  if (fs.existsSync(decisionsMd)) {
    const stat = fs.statSync(decisionsMd);
    const lastModISO = stat.mtime.toISOString().slice(0, 10);
    out.decisions_md = { last_modified: lastModISO, days_since: dateDiffDays(lastModISO, today) };
  }
  const intentionMd = path.join(repoRoot(), 'system', 'intention.md');
  if (fs.existsSync(intentionMd)) {
    const stat = fs.statSync(intentionMd);
    const lastModISO = stat.mtime.toISOString().slice(0, 10);
    out.intention_md = { last_modified: lastModISO, days_since: dateDiffDays(lastModISO, today) };
  }
  return out;
}

// ─── Invariants summary (parse the .md doc) ────────────────────────────────

function computeInvariantsSummary() {
  const p = path.join(repoRoot(), 'system', 'invariants.md');
  if (!fs.existsSync(p)) return { present: false, count: 0 };
  const text = fs.readFileSync(p, 'utf8');
  // Each invariant section starts with "### INV-..." or "### INV..."
  const headings = (text.match(/^### INV[-A-Za-z0-9_]+:/gm) || []).length;
  // Count "Last Verified:" stamps
  const verified = (text.match(/^\*\*Last Verified:\*\*/gm) || []).length;
  return { present: true, count: headings, verified_stamps: verified };
}

// ─── Failures summary ─────────────────────────────────────────────────────

function computeFailuresSummary() {
  const p = path.join(repoRoot(), 'system', 'failures.md');
  if (!fs.existsSync(p)) return { present: false, count: 0 };
  const text = fs.readFileSync(p, 'utf8');
  const headings = (text.match(/^### FAIL[-A-Za-z0-9_]+:/gm) || []).length;
  return { present: true, count: headings };
}

// ─── Programs registry drift (INV-052) ───────────────────────────────────
//
// /pulse reads prog-<id>.yaml directly. /next reads programs/registry.yaml.
// When the two disagree on tier, /next blocks sprints or composes against
// stale tier info. INV-052 asserts every prog-<id>.yaml in programs/ has a
// matching registry entry with the same tier. Surface drift as a finding.

function computeProgramsRegistryDrift() {
  try {
    const { detectDrift } = require('./lib/cwos-program-registry');
    const programsDir = path.join(repoRoot(), '.claude', 'workstream', 'programs');
    if (!fs.existsSync(programsDir)) return { entries: [] };
    return { entries: detectDrift(programsDir) };
  } catch {
    return { entries: [] };
  }
}

// ─── Programs summary ────────────────────────────────────────────────────

function computeProgramsSummary(programs) {
  const tiers = { critical: 0, active: 0, watch: 0, dormant: 0, other: 0 };
  let stale_block = 0;
  for (const p of programs) {
    if (p.monitor_only) continue;
    const t = p.tier || 'dormant';
    if (tiers.hasOwnProperty(t)) tiers[t] += 1; else tiers.other += 1;
    const acc = p.accountability || {};
    if (acc.on_stale && acc.on_stale.block_sprint === true) stale_block += 1;
  }
  return { count: programs.length, tiers, block_sprint_count: stale_block };
}

// ─── Queue health ────────────────────────────────────────────────────────

function computeQueueHealth(queueItems) {
  let backlog = 0, claimed = 0, in_progress = 0, done = 0, other = 0;
  let blocked_with_note = 0;
  let blocked_with_deps = 0;
  for (const q of queueItems) {
    const s = q.status || '';
    if (s === 'backlog') backlog += 1;
    else if (s === 'claimed') claimed += 1;
    else if (s === 'in_progress') in_progress += 1;
    else if (s === 'done') done += 1;
    else other += 1;
    if (q.blocked_by_note && String(q.blocked_by_note).length > 0) blocked_with_note += 1;
    if (Array.isArray(q.blocked_by) && q.blocked_by.length > 0) blocked_with_deps += 1;
  }
  return { count: queueItems.length, by_status: { backlog, claimed, in_progress, done, other }, soft_blocked: blocked_with_note, dependency_blocked: blocked_with_deps };
}

// ─── GC report ────────────────────────────────────────────────────────────

function computeGcReport(findings, today) {
  // Findings older than 90 days that are still open are GC candidates.
  const STALE_DAYS = 90;
  const candidates = [];
  for (const f of findings) {
    if (f.status !== 'open') continue;
    const created = f.created_at || f.created || null;
    if (!created) continue;
    const days = dateDiffDays(created, today);
    if (days >= STALE_DAYS) {
      candidates.push({ id: f.id, days_since_created: days, severity: f.severity, program: f.program || null });
    }
  }
  return { stale_threshold_days: STALE_DAYS, candidate_count: candidates.length, candidates };
}

// ─── 1. focus ──────────────────────────────────────────────────────────────

function runFocus(args) {
  const human = hasFlag(args, 'human');
  const today = readFlag(args, 'clock') || todayISO();
  const pos = args.filter((a) => !a.startsWith('--'));
  const area = pos[0];
  if (!area) {
    process.stderr.write(`focus: <area> is required (one of: ${Array.from(VALID_FOCUS_AREAS).join(', ')})\n`);
    process.exit(2);
  }
  if (!VALID_FOCUS_AREAS.has(area)) {
    process.stderr.write(`focus: invalid area '${area}'. Valid: ${Array.from(VALID_FOCUS_AREAS).join(', ')}\n`);
    process.exit(2);
  }
  const result = { area, computed_at: today };
  switch (area) {
    case 'drift':       result.summary = computeDriftSummary(today); break;
    case 'invariants':  result.summary = computeInvariantsSummary(); break;
    case 'programs':    result.summary = computeProgramsSummary(loadProgramsList()); break;
    case 'failures':    result.summary = computeFailuresSummary(); break;
    case 'queue':       result.summary = computeQueueHealth(loadQueueIndex()); break;
  }
  if (human) {
    process.stdout.write(renderFocusHuman(result));
    return;
  }
  writeJson(result);
}

function renderFocusHuman(result) {
  const out = [];
  out.push(`## Focus: ${result.area} — computed ${result.computed_at}`);
  out.push(``);
  out.push('```json');
  out.push(JSON.stringify(result.summary, null, 2));
  out.push('```');
  out.push(``);
  out.push(`---`);
  out.push(DECISION_8_FOOTER);
  out.push(``);
  return out.join('\n');
}

// ─── 2. compose ────────────────────────────────────────────────────────────

function runCompose(args) {
  const today = readFlag(args, 'clock') || todayISO();
  const includeGc = !args.includes('--no-gc');

  const findings = loadOpenFindings();
  const programs = loadProgramsList();
  const queueItems = loadQueueIndex();

  const findingsWithRoute = findings.map((f) => Object.assign({}, f, { proposed_route: computeProposedRoute(f) }));

  const envelope = {
    computed_at: today,
    findings: findingsWithRoute,
    programs_summary: computeProgramsSummary(programs),
    queue_health: computeQueueHealth(queueItems),
    drift_summary: computeDriftSummary(today),
    invariants_summary: computeInvariantsSummary(),
    failures_summary: computeFailuresSummary(),
    programs_registry_drift: computeProgramsRegistryDrift(),
    stage_mismatch: detectStageMismatch(today),
    gc_report: includeGc ? computeGcReport(findings, today) : null,
  };
  writeJson(envelope);
}

// Stage-mismatch detection (WS-251). Reads .cwos-onboarding.yaml + invokes
// cwos-stage-detect.js scan. Returns an ephemeral finding shape if the
// detected_min stage exceeds declared, else null. Ephemeral by design — the
// finding is recomputed every audit run; founder addresses by either running
// /stage re <detected_min> (declaration moves up) or by noting the exception
// in system/context.md (declaration stays). No persistent FIND-NNN.yaml
// written; mismatch lives in the audit envelope only.
function detectStageMismatch(today) {
  try {
    const onboardingPath = path.join(repoRoot(), '.cwos-onboarding.yaml');
    if (!fs.existsSync(onboardingPath)) return null;
    const { readYAMLFile } = require('./lib/cwos-utils.js');
    const r = readYAMLFile(onboardingPath);
    if (!r.ok || !r.data) return null;
    const declared = r.data.stage || r.data.declared_stage;
    const archetype = r.data.archetype || r.data.declared_archetype;
    if (!declared || !archetype || archetype === 'NONE') return null;

    const isCommercial = !/^N\d/.test(declared);
    const detectScript = path.join(__dirname, 'cwos-stage-detect.js');
    if (!fs.existsSync(detectScript)) return null;
    const dr = spawnSync(process.execPath, [detectScript, 'scan', '--target-dir', repoRoot(), isCommercial ? '--commercial' : '--non-commercial'], { encoding: 'utf8', timeout: 15000 });
    if (dr.status !== 0 || !dr.stdout) return null;
    let detected;
    try { detected = JSON.parse(dr.stdout); } catch { return null; }
    const detectedMin = isCommercial ? detected.detected_min : detected.detected_min_non_commercial;
    if (!detectedMin) return null;

    const STAGE_RANK = { S1: 1, S2: 2, S3: 3, S4: 4, S5: 5, N1: 1, N2: 2, N3: 3 };
    if ((STAGE_RANK[detectedMin] || 0) <= (STAGE_RANK[declared] || 0)) return null;

    const signalIds = (detected.signals_fired || []).map((s) => s.id);
    return {
      kind: 'stage_mismatch',
      severity: 'medium',
      title: `Stage mismatch: declared ${declared} but signals imply ${detectedMin}`,
      dedup_key: `stage-mismatch-declared-${declared}-detected-${detectedMin}`,
      program: 'self-compliance',
      declared_stage: declared,
      detected_stage_min: detectedMin,
      signals_fired: signalIds,
      recommended_action: `Run /stage re ${detectedMin} to advance, or document the exception in system/context.md if the declaration is intentional.`,
      detected_at: today,
    };
  } catch { return null; }
}

// ─── 3. constitutional ─────────────────────────────────────────────────────

function runConstitutional(args) {
  const auditScript = path.join(__dirname, 'cwos-constitutional-audit.js');
  if (!fs.existsSync(auditScript)) {
    process.stderr.write('constitutional: cwos-constitutional-audit.js not found\n');
    process.exit(0);
  }
  // Pass through all args verbatim. Default: --json (matches the wrapper
  // contract documented in the plan).
  const passThrough = args.length > 0 ? args : ['--json'];
  const r = spawnSync(process.execPath, [auditScript, ...passThrough], { stdio: 'inherit' });
  process.exit(r.status == null ? 0 : r.status);
}

// ─── 4. render ─────────────────────────────────────────────────────────────

function runRender(args) {
  const envelopeFile = readFlag(args, 'envelope');
  let envelopeText = null;
  if (envelopeFile) {
    envelopeText = fs.readFileSync(envelopeFile, 'utf8');
  } else if (args.includes('-')) {
    envelopeText = readStdinSync();
  } else {
    process.stderr.write('render: --envelope <file> or `-` (stdin) is required\n');
    process.exit(2);
  }
  let envelope;
  try { envelope = JSON.parse(envelopeText); }
  catch (e) {
    process.stderr.write(`render: cannot parse envelope JSON: ${e.message}\n`);
    process.exit(2);
  }
  process.stdout.write(renderEnvelopeHuman(envelope));
}

function readStdinSync() {
  const chunks = [];
  const buf = Buffer.alloc(8192);
  let n;
  try {
    while ((n = fs.readSync(0, buf, 0, buf.length, null)) > 0) {
      chunks.push(buf.slice(0, n).toString('utf8'));
    }
  } catch (e) {
    // EAGAIN on non-blocking stdin — give up
  }
  return chunks.join('');
}

function renderEnvelopeHuman(env) {
  const out = [];
  const findings = Array.isArray(env.findings) ? env.findings : [];
  const critical = findings.filter((f) => f.severity === 'critical');
  const high = findings.filter((f) => f.severity === 'high');

  out.push(`## Audit Envelope — computed ${env.computed_at || '(unknown)'}`);
  out.push(``);
  out.push(`### Findings summary`);
  out.push(`- Open total: ${findings.length}`);
  out.push(`- Critical: ${critical.length}`);
  out.push(`- High: ${high.length}`);
  out.push(`- Would auto-promote to queue: ${findings.filter((f) => f.proposed_route && f.proposed_route.would_promote_to_queue).length}`);
  out.push(``);

  if (critical.length > 0) {
    out.push(`### Critical findings (top of mind)`);
    for (const f of critical.slice(0, 10)) {
      out.push(`- **${f.id}** (${f.program || 'unassigned'}) — ${f.title || ''}`);
      if (f.proposed_route) {
        out.push(`    proposed_route → ${f.proposed_route.program || 'none'}; ${f.proposed_route.reasoning}`);
      }
    }
    out.push(``);
  }

  if (env.programs_summary) {
    out.push(`### Programs`);
    const t = env.programs_summary.tiers || {};
    out.push(`Total: ${env.programs_summary.count}; critical=${t.critical || 0}, active=${t.active || 0}, watch=${t.watch || 0}, dormant=${t.dormant || 0}; ${env.programs_summary.block_sprint_count || 0} block_sprint-firing.`);
    out.push(``);
  }

  if (env.queue_health) {
    const s = env.queue_health.by_status || {};
    out.push(`### Queue health`);
    out.push(`Total: ${env.queue_health.count}; backlog=${s.backlog || 0}, claimed=${s.claimed || 0}, in_progress=${s.in_progress || 0}, done=${s.done || 0}.`);
    out.push(`Soft-blocked (blocked_by_note set): ${env.queue_health.soft_blocked}; dependency-blocked: ${env.queue_health.dependency_blocked}.`);
    out.push(``);
  }

  if (env.drift_summary) {
    out.push(`### Drift summary`);
    for (const [k, v] of Object.entries(env.drift_summary)) {
      if (v && v.days_since != null) out.push(`- ${k}: ${v.days_since} day(s) since last modified (${v.last_modified})`);
    }
    out.push(``);
  }

  if (env.stage_mismatch) {
    const sm = env.stage_mismatch;
    out.push(`### Stage mismatch (ephemeral finding)`);
    out.push(`⚠ ${sm.title}`);
    out.push(`Signals fired: ${(sm.signals_fired || []).join(', ') || '(none recorded)'}`);
    out.push(`Action: ${sm.recommended_action}`);
    out.push(``);
  }

  if (env.gc_report) {
    out.push(`### GC report (stale ≥${env.gc_report.stale_threshold_days} days)`);
    out.push(`Candidates: ${env.gc_report.candidate_count}.`);
    if (env.gc_report.candidates && env.gc_report.candidates.length > 0) {
      for (const c of env.gc_report.candidates.slice(0, 10)) {
        out.push(`- ${c.id} (${c.severity}, ${c.program || 'unassigned'}) — ${c.days_since_created} days old`);
      }
    }
    out.push(``);
  }

  out.push(`---`);
  out.push(DECISION_8_FOOTER);
  out.push(``);
  return out.join('\n');
}

// ─── 5. verify-route ───────────────────────────────────────────────────────

function runVerifyRoute(args) {
  const findingId = readFlag(args, 'finding') || args.filter((a) => !a.startsWith('--'))[0];
  if (!findingId) {
    process.stderr.write('verify-route: --finding <FIND-NNN> (or positional) is required\n');
    process.exit(2);
  }
  const findings = loadFindingsIndex();
  const finding = findings.find((f) => f && f.id === findingId);
  if (!finding) {
    process.stderr.write(`verify-route: finding not found: ${findingId}\n`);
    process.exit(2);
  }
  const proposed = computeProposedRoute(finding);
  writeJson({
    finding_id: finding.id,
    title: finding.title || null,
    severity: finding.severity || null,
    status: finding.status || null,
    current_program: finding.program || null,
    current_promoted_to: finding.promoted_to || null,
    proposed_route: proposed,
    note: 'Dry-run: no mutations. Run compose for the full envelope.',
  });
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const sub = args[0];
  if (!sub || sub === '--help' || sub === '-h') {
    process.stdout.write('usage: cwos-audit <focus|compose|constitutional|render|verify-route> [options]\n');
    process.exit(sub ? 0 : 1);
  }
  try {
    switch (sub) {
      case 'focus':          return runFocus(args.slice(1));
      case 'compose':        return runCompose(args.slice(1));
      case 'constitutional': return runConstitutional(args.slice(1));
      case 'render':         return runRender(args.slice(1));
      case 'verify-route':   return runVerifyRoute(args.slice(1));
      default:
        process.stderr.write(`cwos-audit: unknown subcommand: ${sub}\n`);
        process.exit(2);
    }
  } catch (err) {
    process.stderr.write(`cwos-audit: ${err.message}\n${err.stack || ''}\n`);
    process.exit(0);
  }
}

if (require.main === module) main();

module.exports = {
  runFocus, runCompose, runConstitutional, runRender, runVerifyRoute,
  computeProposedRoute, buildRouteReasoning,
  computeDriftSummary, computeInvariantsSummary, computeProgramsSummary,
  computeQueueHealth, computeGcReport, computeFailuresSummary,
  renderEnvelopeHuman, renderFocusHuman,
  VALID_FOCUS_AREAS, DECISION_8_FOOTER,
};
