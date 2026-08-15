#!/usr/bin/env node
/**
 * cwos-exception-sunset-check — deterministic sunset detection for exception
 * artifacts under .claude/workstream/evidence/. WS-413, closes FIND-272 CRITICAL.
 *
 * Background: ADR-050 ships under a labeled, dated, sunset-bearing exception
 * documented at .claude/workstream/evidence/corrective/v1-gate-exception.yaml.
 * The artifact carries on_sunset_action.if_unresolved prose ("auto-escalate to
 * RED finding") but, until WS-413, no script reads it. Result: the exception
 * lapses silently if the founder has no HomeBase sessions between sunset and
 * the next manual check. 5-of-5 phase-1 personas converged on this in run-022.
 *
 * This script closes the gap. It:
 *   1. Globs .claude/workstream/evidence/ for files with a top-level
 *      sunset_date field.
 *   2. Evaluates sunset_date against today (or --clock override).
 *      - If resolved_at present → skip (already closed).
 *      - If today > sunset_date → emit RED finding, exit code 4.
 *      - If 0 ≤ daysUntilSunset ≤ 7 → emit at_risk warning, exit code 1.
 *      - Else → no finding.
 *   3. Cascading rule (WS-417 / FIND-276): for each artifact with a
 *      `cascade_from_assumption` field, look up that AS-N's status in
 *      meta/as-n-status.yaml. If contradicted AND past its revisit date,
 *      emit a cascading transition finding recommending the artifact's
 *      `cascade_resolution_path` (typically B = retire).
 *   4. Dedup by `{exception_id, sunset_state}` so re-running on the same
 *      state does not duplicate findings.
 *
 * Output JSON to stdout: `{ok, exit_code, artifacts_checked, findings, transitions}`.
 * Human summary to stderr.
 *
 * Exit codes:
 *   0 — clean (no findings, no transitions)
 *   1 — at_risk warning(s) emitted
 *   2 — cascading transition fired
 *   4 — past sunset (block-worthy)
 *
 * Usage:
 *   cwos-exception-sunset-check                     # run, emit findings, JSON output
 *   cwos-exception-sunset-check --clock 2026-06-14  # override today (testing)
 *   cwos-exception-sunset-check --no-emit           # dry-run, no findings written
 *   cwos-exception-sunset-check --workstream-dir <p># for fixtures
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');

const {
  readYAMLFile,
  serializeYAML,
  writeFileAtomic,
  withFileLock,
  globFiles,
  findWorkstreamDir,
  todayISO,
  dateDiffDays,
  loadEventDeps,
} = require('./lib/cwos-utils');

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ATRISK_WINDOW_DAYS = 7;

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return null;
  const v = args[i + 1];
  if (!v || v.startsWith('--')) return null;
  return v;
}

function hasFlag(args, name) {
  return args.includes(`--${name}`);
}

function todayFrom(clock) {
  if (clock && ISO_DATE_RE.test(clock)) return clock;
  if (clock) {
    // Allow ISO datetime — strip to date.
    const d = new Date(clock);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return todayISO();
}

function discoverExceptionArtifacts(wsDir) {
  const evidenceDir = path.join(wsDir, 'evidence');
  if (!fs.existsSync(evidenceDir)) return [];
  const out = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.ya?ml$/i.test(e.name)) continue;
      const r = readYAMLFile(p);
      if (!r || !r.ok || !r.data) continue;
      if (!r.data.sunset_date) continue; // not an exception artifact
      out.push({ path: p, data: r.data });
    }
  }
  walk(evidenceDir);
  return out;
}

function readAsNStatus(wsDir) {
  const p = path.join(wsDir, 'meta', 'as-n-status.yaml');
  if (!fs.existsSync(p)) return { schema_version: 1, entries: [] };
  const r = readYAMLFile(p);
  if (!r || !r.ok || !r.data) return { schema_version: 1, entries: [] };
  if (!Array.isArray(r.data.entries)) r.data.entries = [];
  return r.data;
}

function findAsN(statusDoc, id) {
  if (!statusDoc || !Array.isArray(statusDoc.entries)) return null;
  return statusDoc.entries.find(e => e && e.id === id) || null;
}

// ─── Finding emission ──────────────────────────────────────────────────────

function existingFindingForDedup(findingsDir, dedupKey) {
  if (!fs.existsSync(findingsDir)) return null;
  // Scan only active findings (not archive) — a re-emitted at_risk after the
  // first one was archived should still produce a fresh finding. This matches
  // cwos-plan-scan.js dedup behavior.
  const files = globFiles(findingsDir, 'FIND-*.yaml');
  for (const f of files) {
    const r = readYAMLFile(f);
    if (!r || !r.ok || !r.data) continue;
    if (r.data.dedup_key === dedupKey && r.data.status !== 'resolved') return f;
  }
  return null;
}

function emitFinding(wsDir, finding, emitEvent) {
  const findingsDir = path.join(wsDir, 'findings');
  if (!fs.existsSync(findingsDir)) fs.mkdirSync(findingsDir, { recursive: true });

  // Dedup BEFORE acquiring the ID lock so we don't burn an ID on a no-op.
  const existing = existingFindingForDedup(findingsDir, finding.dedup_key);
  if (existing) return { emitted: false, reason: 'dedup', existing };

  const lockPath = path.join(findingsDir, '.find-counter.lock');
  let findingId = null;
  withFileLock(lockPath, () => {
    const existingFiles = globFiles(findingsDir, 'FIND-*.yaml');
    const archive = fs.existsSync(path.join(findingsDir, 'archive'))
      ? globFiles(path.join(findingsDir, 'archive'), 'FIND-*.yaml')
      : [];
    const allIds = [...existingFiles, ...archive]
      .map(f => parseInt(path.basename(f).match(/FIND-(\d+)/)?.[1] || '0', 10));
    const nextId = (allIds.length ? Math.max(...allIds) : 0) + 1;
    findingId = `FIND-${String(nextId).padStart(3, '0')}`;
    // Findings that warrant a WS item (cascading transitions + past sunsets)
    // declare would_promote_to_queue so the existing auto-promote pipeline
    // (cwos-reconcile.js Phase 2k) can create the corresponding WS. The at_risk
    // tiers stay as warnings (they're advisory and may resolve on their own).
    const shouldPromote = finding.sunset_state === 'cascading_at_risk'
      || finding.sunset_state === 'past_in_grace'
      || finding.sunset_state === 'past_grace_lapsed';
    const doc = {
      id: findingId,
      title: finding.title,
      // engine + adopter_detection are required/recommended by the finding schema.
      // adopter_detection is mandatory on open findings (INV-058); an exception
      // sunset is something the founder must act on, so it's founder-visible.
      // Omitting it shipped every exception-sunset finding in an INV-058-failing
      // state (FIND-322 / WS-449; FIND-321 was the instance that exposed it).
      engine: 'cwos-exception-sunset-check',
      adopter_detection: 'founder-visible',
      severity: finding.severity,
      status: 'open',
      type: 'exception_sunset',
      program: finding.program,
      dedup_key: finding.dedup_key,
      source: {
        script: 'cwos-exception-sunset-check',
        exception_id: finding.exception_id,
        sunset_state: finding.sunset_state,
        exception_path: finding.exception_path,
      },
      description: finding.description,
      proposed_route: {
        would_promote_to_queue: shouldPromote,
        rationale: shouldPromote
          ? 'Exception requires founder action (resolve / retire / cascade preparation) — needs a tracked WS item, not just a finding.'
          : 'Advisory only — finding surfaces the at-risk window; founder may resolve without queue churn.',
      },
      created_at: todayISO(),
    };
    const yaml = serializeYAML(doc);
    writeFileAtomic(path.join(findingsDir, `${findingId}.yaml`), yaml + (yaml.endsWith('\n') ? '' : '\n'));
  }, { ownerLabel: 'exception-sunset:emit', maxWaitMs: 10000 });

  if (emitEvent) {
    emitEvent('T6:workstream', 'exception-sunset-finding', {
      finding_id: findingId,
      exception_id: finding.exception_id,
      sunset_state: finding.sunset_state,
    });
  }
  return { emitted: true, finding_id: findingId };
}

// ─── Per-artifact evaluation ───────────────────────────────────────────────

function evaluateArtifact(artifact, today, statusDoc) {
  const { data, path: artifactPath } = artifact;
  const findings = [];
  const transitions = [];

  // Already resolved → skip.
  if (data.resolved_at) return { findings, transitions };

  if (!ISO_DATE_RE.test(String(data.sunset_date || ''))) {
    return { findings, transitions, warning: `${artifactPath}: sunset_date not ISO (YYYY-MM-DD)` };
  }

  const daysUntil = dateDiffDays(today, data.sunset_date); // positive if sunset in future
  const exceptionId = String(data.exception_id || path.basename(artifactPath, path.extname(artifactPath)));
  const program = String(data.program || 'unknown');

  if (daysUntil < -ATRISK_WINDOW_DAYS) {
    findings.push({
      severity: 'critical',
      sunset_state: 'past_grace_lapsed',
      exception_id: exceptionId,
      exception_path: path.relative(path.resolve(artifactPath, '..', '..', '..', '..'), artifactPath).replace(/\\/g, '/'),
      program,
      dedup_key: `exception-sunset:past_grace_lapsed:${exceptionId}`,
      title: `Exception ${exceptionId} is ${-daysUntil} days past sunset (RED — beyond ${ATRISK_WINDOW_DAYS}-day grace)`,
      description: `Exception artifact ${artifactPath} reached its sunset_date (${data.sunset_date}) ${-daysUntil} days ago WITHOUT a resolved_at field, exceeding the ${ATRISK_WINDOW_DAYS}-day grace window. ${data.on_sunset_action && data.on_sunset_action.if_unresolved ? data.on_sunset_action.if_unresolved : 'Resolve via one of sunset_resolution_options.'}`,
    });
  } else if (daysUntil < 0) {
    findings.push({
      severity: 'high',
      sunset_state: 'past_in_grace',
      exception_id: exceptionId,
      exception_path: path.relative(path.resolve(artifactPath, '..', '..', '..', '..'), artifactPath).replace(/\\/g, '/'),
      program,
      dedup_key: `exception-sunset:past_in_grace:${exceptionId}`,
      title: `Exception ${exceptionId} is ${-daysUntil} day(s) past sunset (within ${ATRISK_WINDOW_DAYS}-day grace)`,
      description: `Exception artifact ${artifactPath} reached its sunset_date (${data.sunset_date}) ${-daysUntil} day(s) ago. Within the ${ATRISK_WINDOW_DAYS}-day grace window — pick a sunset_resolution_option (record / retire / amend) and write resolved_at before the grace lapses and this escalates to RED.`,
    });
  } else if (daysUntil <= ATRISK_WINDOW_DAYS) {
    findings.push({
      severity: 'high',
      sunset_state: 'at_risk_7d',
      exception_id: exceptionId,
      exception_path: path.relative(path.resolve(artifactPath, '..', '..', '..', '..'), artifactPath).replace(/\\/g, '/'),
      program,
      dedup_key: `exception-sunset:at_risk:${exceptionId}`,
      title: `Exception ${exceptionId} sunset is ${daysUntil} day(s) away (${data.sunset_date})`,
      description: `Exception artifact ${artifactPath} sunsets in ${daysUntil} day(s). Pick a sunset_resolution_option (record / retire / amend) and write resolved_at to close the exception before the deadline.`,
    });
  }

  // Cascading rule. Optional fields: cascade_from_assumption + primary_assumption.
  if (data.cascade_from_assumption && data.primary_assumption) {
    const upstream = findAsN(statusDoc, String(data.cascade_from_assumption));
    if (upstream && upstream.status === 'contradicted') {
      // Only fire if upstream was contradicted at or before today (revisit
      // passed and check has actually run).
      const evaluated = String(upstream.last_evaluated_at || '').slice(0, 10);
      if (evaluated && evaluated <= today) {
        const primary = String(data.primary_assumption);
        const resolutionPath = data.cascade_resolution_path || 'B';
        transitions.push({
          exception_id: exceptionId,
          primary_assumption: primary,
          cascade_from: String(data.cascade_from_assumption),
          new_status: 'at_risk',
          resolution_path: resolutionPath,
        });
        findings.push({
          severity: 'high',
          sunset_state: 'cascading_at_risk',
          exception_id: exceptionId,
          exception_path: path.relative(path.resolve(artifactPath, '..', '..', '..', '..'), artifactPath).replace(/\\/g, '/'),
          program,
          dedup_key: `exception-sunset:cascade:${exceptionId}:${primary}`,
          title: `Cascading AS-N transition: ${primary} → at_risk (upstream ${data.cascade_from_assumption} contradicted)`,
          description: `Upstream assumption ${data.cascade_from_assumption} was contradicted at ${upstream.last_evaluated_at}. Per cascade rule on ${artifactPath}, ${primary} transitions to at_risk and resolution_path ${resolutionPath} is now the recommended close-out. Auto-create a WS item to begin path ${resolutionPath} preparation.`,
        });
      }
    }
  }

  return { findings, transitions };
}

// ─── Hook liveness stamp ───────────────────────────────────────────────────

function stampHooksLiveness(wsDir, today) {
  const livenessPath = path.join(wsDir, '.hooks-liveness.yaml');
  let doc = {};
  if (fs.existsSync(livenessPath)) {
    const r = readYAMLFile(livenessPath);
    if (r && r.ok && r.data) doc = r.data;
  }
  doc.last_exception_sunset_hook_at = new Date().toISOString();
  const yaml = serializeYAML(doc);
  const lockPath = `${livenessPath}.lock`;
  try {
    withFileLock(lockPath, () => {
      writeFileAtomic(livenessPath, yaml + (yaml.endsWith('\n') ? '' : '\n'));
    }, { ownerLabel: 'exception-sunset:liveness', maxWaitMs: 5000 });
  } catch { /* non-fatal */ }
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write('usage: cwos-exception-sunset-check [--clock YYYY-MM-DD] [--no-emit] [--workstream-dir <p>]\n');
    process.exit(0);
  }

  const noEmit = hasFlag(args, 'no-emit');
  const clock = readFlag(args, 'clock');
  const wsDirOverride = readFlag(args, 'workstream-dir');
  const wsDir = wsDirOverride || findWorkstreamDir(process.cwd());
  if (!wsDir) {
    process.stderr.write('cwos-exception-sunset-check: workstream dir not found (run inside an adopted repo)\n');
    process.exit(2);
  }

  const today = todayFrom(clock);
  const artifacts = discoverExceptionArtifacts(wsDir);
  const statusDoc = readAsNStatus(wsDir);

  let exitCode = 0;
  const findings = [];
  const transitions = [];
  const warnings = [];

  const { appendEvent, ensureCommandId } = loadEventDeps();
  const emitEvent = (track, tag, payload) => {
    if (!appendEvent) return;
    try {
      const commandId = ensureCommandId ? ensureCommandId('exception-sunset-check') : null;
      appendEvent({ source_track: track, track_tag: tag, command_id: commandId, payload: payload || {} });
    } catch { /* swallow */ }
  };

  for (const artifact of artifacts) {
    const r = evaluateArtifact(artifact, today, statusDoc);
    if (r.warning) warnings.push(r.warning);
    for (const f of r.findings) {
      let emission = { emitted: false, reason: 'no-emit' };
      if (!noEmit) emission = emitFinding(wsDir, f, emitEvent);
      findings.push({
        ...f,
        finding_id: emission.finding_id || null,
        emitted: emission.emitted,
        skipped_reason: emission.reason || null,
      });

      // Exit code escalation by severity.
      if (f.sunset_state === 'past_grace_lapsed') exitCode = Math.max(exitCode, 4);
      else if (f.sunset_state === 'past_in_grace') exitCode = Math.max(exitCode, 4);
      else if (f.sunset_state === 'cascading_at_risk') exitCode = Math.max(exitCode, 2);
      else if (f.sunset_state === 'at_risk_7d') exitCode = Math.max(exitCode, 1);
    }
    for (const t of r.transitions) transitions.push(t);
  }

  if (!noEmit) stampHooksLiveness(wsDir, today);

  const result = {
    ok: exitCode === 0,
    exit_code: exitCode,
    today,
    artifacts_checked: artifacts.length,
    findings,
    transitions,
    warnings,
  };

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  // Human stderr summary
  if (findings.length === 0 && transitions.length === 0) {
    process.stderr.write(`exception-sunset-check: clean (${artifacts.length} artifact(s) checked, today=${today})\n`);
  } else {
    process.stderr.write(`exception-sunset-check: ${findings.length} finding(s), ${transitions.length} cascading transition(s) (today=${today})\n`);
    for (const f of findings) {
      process.stderr.write(`  [${f.severity.toUpperCase()}] ${f.title}\n`);
    }
  }

  process.exit(exitCode);
}

if (require.main === module) main();

module.exports = {
  discoverExceptionArtifacts,
  evaluateArtifact,
  emitFinding,
  todayFrom,
  ATRISK_WINDOW_DAYS,
};
