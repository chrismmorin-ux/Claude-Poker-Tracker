#!/usr/bin/env node
/**
 * cwos-engine-manifest.js — Engine-run pre/post manifest gate (WS-305).
 *
 * Twin of cwos-provenance-validate.js (WS-304) lifted to the engine-run layer.
 * Owns the canonical schema + lifecycle for `.claude/workstream/runs/run-NNN/manifest.yaml`.
 * See `kit/templates/workstream/runs/MANIFEST.md` for the full schema.
 *
 * Subcommands (each idempotent — read → mutate → write):
 *   init     --run-id <r> --engine <e> --target <t> --contract-id <c>
 *            --contract-event-id <ev> --mode <m> --stretch <bool>
 *            --readiness <r> --success-shape <s> --scope-ceiling <s>
 *            --founder <h> [--trigger <t>] [--declared-dispatch-path <p>]
 *            [--declared-artifact-format <fmt>] --declared-phases <csv>
 *            --declared-agents <csv>
 *
 *   update   --run-id <r> --phase <n> --agent <name> --status <s>
 *            [--bytes <n>] [--agent-id <id>] [--subagent-type <s>]
 *            [--artifact-path <p>] [--dispatched-at <iso>] [--completed-at <iso>]
 *            [--spec-compliant <bool>] [--spec-compliant-reason <s>]
 *            [--phase-status <s>]
 *
 *   refire   --run-id <r> --agent <name> --reason <s> [--agent-id <id>]
 *
 *   complete --run-id <r> --findings-raw <n> --findings-after <n>
 *            --work-items <n> [--tokens <n>] [--completed-at <iso>]
 *            [--mode-status <s>] [--mode-note <s>] [--stretch-status <s>]
 *            [--stretch-note <s>] [--success-status <s>] [--success-note <s>]
 *            [--scope-status <s>] [--scope-note <s>]
 *
 *   validate --run-id <r> [--workstream-dir <p>]
 *
 * Output: JSON to stdout. Human messages to stderr.
 *
 * Exit codes (validate):
 *   0 = valid
 *   1 = required field missing
 *   2 = pre/post mismatch (declared vs actual)
 *   3 = artifact byte threshold violated
 *   4 = required section header missing
 *   5 = spec-deviation without acknowledgment
 *   6 = contract_alignment block incomplete
 *   (lowest exit code wins on multiple findings)
 *
 * Exit codes (other subcommands):
 *   0 = success
 *   1 = I/O failure
 *   2 = usage error
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');

const {
  parseYAML, readYAMLFile, serializeYAML, writeFileAtomic,
  findWorkstreamDir, todayISO, withFileLock,
} = require('./lib/cwos-utils');

const GRANDFATHER_DATE = '2026-05-07';
const DEFAULT_MIN_BYTES = 1000;
const VALID_AGENT_STATUS = new Set([
  'dispatched', 'writing', 'complete', 'empty-failed', 'timeout',
]);
const TERMINAL_AGENT_STATUS = new Set(['complete', 'empty-failed', 'timeout']);
const VALID_PHASE_STATUS = new Set([
  'pending', 'dispatched', 'writing', 'complete', 'failed', 'skipped',
]);

// ─── CLI argument helpers ───────────────────────────────────────────────────

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i === args.length - 1) return null;
  return args[i + 1];
}

function readBoolFlag(args, name) {
  const v = readFlag(args, name);
  if (v === null) return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
}

function requireFlag(args, name, subcmd) {
  const v = readFlag(args, name);
  if (v === null || v === '') {
    process.stderr.write(`cwos-engine-manifest ${subcmd}: --${name} is required\n`);
    process.exit(2);
  }
  return v;
}

// ─── Path resolution ────────────────────────────────────────────────────────

function manifestPathFor(runId, wsDirOverride) {
  const wsDir = wsDirOverride || findWorkstreamDir(process.cwd());
  return {
    wsDir,
    runDir: path.join(wsDir, 'runs', runId),
    manifestPath: path.join(wsDir, 'runs', runId, 'manifest.yaml'),
  };
}

function ensureRunDir(runDir) {
  if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });
}

function loadManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return null;
  const r = readYAMLFile(manifestPath);
  if (!r || r.ok === false) {
    throw new Error(`failed to parse manifest: ${manifestPath}: ${(r && r.error) || 'unknown'}`);
  }
  return r.data || {};
}

function saveManifest(manifestPath, manifest) {
  const lockPath = `${manifestPath}.lock`;
  withFileLock(lockPath, () => {
    const yaml = serializeYAML(manifest);
    writeFileAtomic(manifestPath, yaml + (yaml.endsWith('\n') ? '' : '\n'));
  }, { ownerLabel: 'engine-manifest', maxWaitMs: 10000 });
}

// ─── Repo-relative helpers ──────────────────────────────────────────────────

function repoRoot(wsDir) { return path.resolve(wsDir, '..', '..'); }

function relToRepo(absPath, wsDir) {
  return path.relative(repoRoot(wsDir), absPath).replace(/\\/g, '/');
}

// ─── input_state_snapshot helper (WS-314) ──────────────────────────────────
//
// Captures queue / findings / sprint counts at run-start. Written into the
// manifest's pre-artifact block; later read by cwos-run-summary when
// distilling summary.yaml. Best-effort: missing or unreadable indexes
// produce a null sub-block, never an exception.

function gatherInputStateSnapshot(wsDir) {
  const snap = { captured_at: new Date().toISOString() };

  // queue-index.yaml — has total_items + by_status map
  try {
    const r = readYAMLFile(path.join(wsDir, 'queue-index.yaml'));
    if (r.ok && r.data) {
      const byStatus = r.data.by_status || {};
      snap.queue = {
        total: r.data.total_items || 0,
        backlog: byStatus.backlog || 0,
        claimed: byStatus.claimed || 0,
        done: byStatus.done || 0,
        deferred: byStatus.deferred || 0,
        blocked: byStatus.blocked || 0,
      };
    }
  } catch { /* leave queue undefined */ }

  // findings-index.yaml — array of findings, count + open count
  try {
    const r = readYAMLFile(path.join(wsDir, 'findings-index.yaml'));
    if (r.ok && r.data && Array.isArray(r.data.findings)) {
      const all = r.data.findings;
      snap.findings = {
        total: all.length,
        open: all.filter(f => f && f.status === 'open').length,
      };
    }
  } catch { /* leave findings undefined */ }

  // sprint-index.yaml — sprints array; surface active count
  try {
    const r = readYAMLFile(path.join(wsDir, 'sprint-index.yaml'));
    if (r.ok && r.data && Array.isArray(r.data.sprints)) {
      const all = r.data.sprints;
      snap.sprints = {
        total: all.length,
        active: all.filter(s => s && (s.status === 'active' || s.status === 'approved')).length,
      };
    }
  } catch { /* leave sprints undefined */ }

  return snap;
}

// ─── Subcommand: init ───────────────────────────────────────────────────────

function cmdInit(args) {
  const runId = requireFlag(args, 'run-id', 'init');
  const engine = requireFlag(args, 'engine', 'init');
  const target = requireFlag(args, 'target', 'init');
  const contractId = requireFlag(args, 'contract-id', 'init');
  const contractEventId = requireFlag(args, 'contract-event-id', 'init');
  const mode = requireFlag(args, 'mode', 'init');
  const stretch = readBoolFlag(args, 'stretch');
  const readiness = requireFlag(args, 'readiness', 'init');
  const successShape = requireFlag(args, 'success-shape', 'init');
  const scopeCeiling = requireFlag(args, 'scope-ceiling', 'init');
  const founder = requireFlag(args, 'founder', 'init');
  const declaredPhasesCsv = requireFlag(args, 'declared-phases', 'init');
  const declaredAgentsCsv = requireFlag(args, 'declared-agents', 'init');

  const trigger = readFlag(args, 'trigger') || '';
  const declaredDispatchPath = readFlag(args, 'declared-dispatch-path')
    || '.claude/agents/<name>.md';
  const declaredArtifactFormat = readFlag(args, 'declared-artifact-format') || '.md';
  const startedAt = readFlag(args, 'started-at') || new Date().toISOString();
  const wsDirOverride = readFlag(args, 'workstream-dir');

  if (stretch === null) {
    process.stderr.write(`cwos-engine-manifest init: --stretch true|false is required\n`);
    process.exit(2);
  }

  const declaredPhases = declaredPhasesCsv.split(',').map((s) => s.trim()).filter(Boolean);
  const declaredAgents = declaredAgentsCsv.split(',').map((s) => s.trim()).filter(Boolean);

  if (declaredPhases.length === 0 || declaredAgents.length === 0) {
    process.stderr.write(`cwos-engine-manifest init: --declared-phases and --declared-agents must be non-empty\n`);
    process.exit(2);
  }

  const { wsDir, runDir, manifestPath } = manifestPathFor(runId, wsDirOverride);
  ensureRunDir(runDir);

  if (fs.existsSync(manifestPath)) {
    // Idempotent: re-running init on an existing manifest is a no-op (returns existing)
    const existing = loadManifest(manifestPath);
    process.stdout.write(JSON.stringify({
      ok: true, run_id: runId, already_initialized: true,
      schema_version: existing && existing.schema_version,
    }, null, 2) + '\n');
    process.exit(0);
  }

  const agentsObj = {};
  for (const a of declaredAgents) {
    agentsObj[a] = {
      subagent_type: null,
      agent_id: null,
      dispatched_at: null,
      completed_at: null,
      duration_seconds: null,
      artifact_path: null,
      artifact_bytes: null,
      status: 'pending',
    };
  }

  const inputStateSnapshot = gatherInputStateSnapshot(wsDir);

  const manifest = {
    schema_version: 1,
    run_id: runId,
    engine,
    target,
    contract_id: contractId,
    contract_event_id: contractEventId,
    contract: {
      mode,
      stretch,
      readiness,
      success_shape: successShape,
      scope_ceiling: scopeCeiling,
    },
    trigger,
    founder,
    started_at: startedAt,
    declared_dispatch_path: declaredDispatchPath,
    declared_artifact_format: declaredArtifactFormat,
    declared_phases: declaredPhases,
    declared_agents: declaredAgents,
    input_state_snapshot: inputStateSnapshot,
    punchlist: {
      phase_1_parallel_research: {
        expected_count: declaredAgents.length,
        actual_complete: 0,
        actual_empty: 0,
        status: 'pending',
        agents: agentsObj,
      },
    },
  };

  saveManifest(manifestPath, manifest);
  process.stdout.write(JSON.stringify({
    ok: true, run_id: runId, manifest_path: manifestPath,
    declared_agents: declaredAgents.length,
  }, null, 2) + '\n');
  process.exit(0);
}

// ─── Subcommand: update ─────────────────────────────────────────────────────

function cmdUpdate(args) {
  const runId = requireFlag(args, 'run-id', 'update');
  const phaseRaw = requireFlag(args, 'phase', 'update');
  const phase = parseInt(phaseRaw, 10);
  const wsDirOverride = readFlag(args, 'workstream-dir');

  if (!Number.isInteger(phase) || phase < 0 || phase > 6) {
    process.stderr.write(`cwos-engine-manifest update: --phase must be integer 0-6\n`);
    process.exit(2);
  }

  const { manifestPath } = manifestPathFor(runId, wsDirOverride);
  if (!fs.existsSync(manifestPath)) {
    process.stderr.write(`cwos-engine-manifest update: manifest not found at ${manifestPath} — run init first\n`);
    process.exit(2);
  }

  const manifest = loadManifest(manifestPath);
  manifest.punchlist = manifest.punchlist || {};
  const phaseKey = phaseKeyFor(phase);
  manifest.punchlist[phaseKey] = manifest.punchlist[phaseKey] || {};
  const phaseEntry = manifest.punchlist[phaseKey];

  const phaseStatus = readFlag(args, 'phase-status');
  if (phaseStatus !== null) {
    if (!VALID_PHASE_STATUS.has(phaseStatus)) {
      process.stderr.write(`cwos-engine-manifest update: invalid --phase-status "${phaseStatus}"\n`);
      process.exit(2);
    }
    phaseEntry.status = phaseStatus;
  }

  const agent = readFlag(args, 'agent');
  if (agent) {
    const agentStatus = readFlag(args, 'status');
    if (agentStatus !== null && !VALID_AGENT_STATUS.has(agentStatus)) {
      process.stderr.write(`cwos-engine-manifest update: invalid --status "${agentStatus}"\n`);
      process.exit(2);
    }
    if (phase === 1) {
      phaseEntry.agents = phaseEntry.agents || {};
      const a = phaseEntry.agents[agent] = phaseEntry.agents[agent] || {
        subagent_type: null, agent_id: null, dispatched_at: null,
        completed_at: null, duration_seconds: null, artifact_path: null,
        artifact_bytes: null, status: 'pending',
      };
      applyAgentFields(a, args, agentStatus);
      recomputePhase1Counts(phaseEntry);
    } else if (phase === 2) {
      phaseEntry.expected_agent = agent;
      applyAgentFields(phaseEntry, args, agentStatus);
    } else {
      // phase 3/4/5/6 — store under named agent key under the phase entry
      phaseEntry.agents = phaseEntry.agents || {};
      const a = phaseEntry.agents[agent] = phaseEntry.agents[agent] || {};
      applyAgentFields(a, args, agentStatus);
    }
  }

  // Optional reason field for skipped/complete phases
  const reason = readFlag(args, 'reason');
  if (reason !== null) phaseEntry.reason = reason;

  saveManifest(manifestPath, manifest);
  process.stdout.write(JSON.stringify({
    ok: true, run_id: runId, phase, agent: agent || null,
  }, null, 2) + '\n');
  process.exit(0);
}

function phaseKeyFor(phase) {
  switch (phase) {
    case 0: return 'phase_0_setup';
    case 1: return 'phase_1_parallel_research';
    case 2: return 'phase_2_cross_critique';
    case 3: return 'phase_3_synthesis';
    case 4: return 'phase_4_backlog';
    case 5: return 'phase_5_briefing';
    case 6: return 'phase_6_optimization_epilogue';
    default: throw new Error(`bad phase ${phase}`);
  }
}

function applyAgentFields(target, args, status) {
  if (status !== null) target.status = status;
  const subagent = readFlag(args, 'subagent-type');
  if (subagent !== null) target.subagent_type = subagent;
  const agentId = readFlag(args, 'agent-id');
  if (agentId !== null) target.agent_id = agentId;
  const dispatchedAt = readFlag(args, 'dispatched-at');
  if (dispatchedAt !== null) target.dispatched_at = dispatchedAt;
  const completedAt = readFlag(args, 'completed-at');
  if (completedAt !== null) target.completed_at = completedAt;
  const artifactPath = readFlag(args, 'artifact-path');
  if (artifactPath !== null) target.artifact_path = artifactPath;
  const bytesRaw = readFlag(args, 'bytes');
  if (bytesRaw !== null) {
    const n = parseInt(bytesRaw, 10);
    if (!Number.isFinite(n)) {
      process.stderr.write(`cwos-engine-manifest update: --bytes "${bytesRaw}" is not an integer\n`);
      process.exit(2);
    }
    target.artifact_bytes = n;
  }
  const duration = readFlag(args, 'duration-seconds');
  if (duration !== null) target.duration_seconds = parseInt(duration, 10);
  const specCompliant = readBoolFlag(args, 'spec-compliant');
  if (specCompliant !== null) target.spec_compliant = specCompliant;
  const specReason = readFlag(args, 'spec-compliant-reason');
  if (specReason !== null) target.spec_compliant_reason = specReason;
}

function recomputePhase1Counts(phaseEntry) {
  const agents = phaseEntry.agents || {};
  let complete = 0, empty = 0;
  for (const name of Object.keys(agents)) {
    const s = agents[name].status;
    if (s === 'complete') complete++;
    else if (s === 'empty-failed' || s === 'timeout') empty++;
  }
  phaseEntry.actual_complete = complete;
  phaseEntry.actual_empty = empty;
  phaseEntry.expected_count = Object.keys(agents).length;
}

// ─── Subcommand: refire ─────────────────────────────────────────────────────

function cmdRefire(args) {
  const runId = requireFlag(args, 'run-id', 'refire');
  const agent = requireFlag(args, 'agent', 'refire');
  const reason = requireFlag(args, 'reason', 'refire');
  const agentId = readFlag(args, 'agent-id') || '<unknown>';
  const wsDirOverride = readFlag(args, 'workstream-dir');

  const { manifestPath } = manifestPathFor(runId, wsDirOverride);
  if (!fs.existsSync(manifestPath)) {
    process.stderr.write(`cwos-engine-manifest refire: manifest not found at ${manifestPath}\n`);
    process.exit(2);
  }

  const manifest = loadManifest(manifestPath);
  manifest.discarded_redundant_dispatches = manifest.discarded_redundant_dispatches || [];
  manifest.discarded_redundant_dispatches.push({
    agent_id: agentId, persona: agent, reason,
  });
  saveManifest(manifestPath, manifest);

  process.stdout.write(JSON.stringify({
    ok: true, run_id: runId, agent, recorded: true,
  }, null, 2) + '\n');
  process.exit(0);
}

// ─── Subcommand: complete ───────────────────────────────────────────────────

function cmdComplete(args) {
  const runId = requireFlag(args, 'run-id', 'complete');
  const findingsRaw = parseInt(requireFlag(args, 'findings-raw', 'complete'), 10);
  const findingsAfter = parseInt(requireFlag(args, 'findings-after', 'complete'), 10);
  const workItems = parseInt(requireFlag(args, 'work-items', 'complete'), 10);
  const tokensRaw = readFlag(args, 'tokens');
  const completedAt = readFlag(args, 'completed-at') || new Date().toISOString();
  const wsDirOverride = readFlag(args, 'workstream-dir');

  const { manifestPath } = manifestPathFor(runId, wsDirOverride);
  if (!fs.existsSync(manifestPath)) {
    process.stderr.write(`cwos-engine-manifest complete: manifest not found at ${manifestPath}\n`);
    process.exit(2);
  }

  const manifest = loadManifest(manifestPath);
  manifest.findings_raw_count = findingsRaw;
  manifest.findings_after_synthesis = findingsAfter;
  manifest.work_items_to_create = workItems;
  manifest.completed_at = completedAt;
  if (tokensRaw !== null) manifest.tokens_observed = parseInt(tokensRaw, 10);
  else if (manifest.tokens_observed === undefined) manifest.tokens_observed = null;

  // Build contract_alignment from contract spec
  const contract = manifest.contract || {};
  manifest.contract_alignment = manifest.contract_alignment || {};
  const ca = manifest.contract_alignment;
  ensureAlignment(ca, `mode_${contract.mode || 'unknown'}`,
    readFlag(args, 'mode-status'), readFlag(args, 'mode-note'));
  ensureAlignment(ca, `stretch_${contract.stretch ? 'true' : 'false'}`,
    readFlag(args, 'stretch-status'), readFlag(args, 'stretch-note'));
  ensureAlignmentFull(ca, 'success_shape',
    readFlag(args, 'success-status'), readFlag(args, 'success-note'));
  ensureAlignment(ca, 'scope_ceiling',
    readFlag(args, 'scope-status'), readFlag(args, 'scope-note'));

  saveManifest(manifestPath, manifest);
  process.stdout.write(JSON.stringify({
    ok: true, run_id: runId, completed_at: completedAt,
  }, null, 2) + '\n');
  process.exit(0);
}

function ensureAlignment(ca, axis, status, note) {
  if (!ca[axis]) ca[axis] = {};
  if (status !== null) ca[axis].status = status;
  else if (!ca[axis].status) ca[axis].status = 'unverified';
  if (note !== null) ca[axis].note = note;
  else if (!ca[axis].note) ca[axis].note = '';
}

function ensureAlignmentFull(ca, axis, status, note) {
  if (!ca[axis]) ca[axis] = {};
  if (status !== null) ca[axis].status = status;
  else if (!ca[axis].status) ca[axis].status = 'unverified';
  if (note !== null) ca[axis].note = note;
  else if (!ca[axis].note) ca[axis].note = '';
  ca[axis].target_items_hit = ca[axis].target_items_hit || [];
  ca[axis].target_items_missed = ca[axis].target_items_missed || [];
}

// ─── Subcommand: validate ───────────────────────────────────────────────────

function cmdValidate(args) {
  const runId = requireFlag(args, 'run-id', 'validate');
  const wsDirOverride = readFlag(args, 'workstream-dir');
  const minBytesOverride = readFlag(args, 'min-bytes');

  const { wsDir, runDir, manifestPath } = manifestPathFor(runId, wsDirOverride);

  if (!fs.existsSync(manifestPath)) {
    return emit(runId, [{
      exit_code: 1, severity: 'block',
      message: `manifest not found at ${manifestPath}`,
    }]);
  }

  let manifest;
  try {
    manifest = loadManifest(manifestPath);
  } catch (err) {
    return emit(runId, [{
      exit_code: 1, severity: 'block',
      message: `failed to parse manifest: ${err.message}`,
    }]);
  }
  if (!manifest) {
    return emit(runId, [{
      exit_code: 1, severity: 'block',
      message: 'manifest is empty',
    }]);
  }

  // Grandfather pre-2026-05-07 runs (matches WS-304 convention)
  const startedAt = manifest.started_at || '';
  const startedDate = startedAt.slice(0, 10);
  if (startedDate && startedDate < GRANDFATHER_DATE) {
    return emit(runId, []); // grandfathered — no findings
  }

  const findings = [];
  const minBytes = minBytesOverride ? parseInt(minBytesOverride, 10)
    : loadConfigMinBytes(wsDir);

  // Step 1 — required pre-artifact fields
  const requiredTop = [
    'schema_version', 'run_id', 'engine', 'target', 'contract_id',
    'contract_event_id', 'contract', 'founder', 'started_at',
    'declared_dispatch_path', 'declared_artifact_format',
    'declared_phases', 'declared_agents',
  ];
  for (const f of requiredTop) {
    if (manifest[f] === undefined || manifest[f] === null) {
      findings.push({
        exit_code: 1, severity: 'block',
        message: `required field missing: ${f}`,
      });
    }
  }
  if (manifest.contract && typeof manifest.contract === 'object') {
    const requiredContract = ['mode', 'stretch', 'readiness', 'success_shape', 'scope_ceiling'];
    for (const f of requiredContract) {
      if (manifest.contract[f] === undefined || manifest.contract[f] === null) {
        findings.push({
          exit_code: 1, severity: 'block',
          message: `required field missing: contract.${f}`,
        });
      }
    }
  }
  // Bail early if pre-artifact is broken — later checks would noise out
  if (findings.some((f) => f.exit_code === 1)) {
    return emit(runId, findings);
  }

  // Step 2 — punchlist completeness for declared agents
  const punchlist = manifest.punchlist || {};
  const phase1 = punchlist.phase_1_parallel_research || {};
  const agents = phase1.agents || {};
  const declared = manifest.declared_agents || [];

  const completionExpected = manifest.completed_at != null;

  for (const name of declared) {
    if (!agents[name]) {
      findings.push({
        exit_code: 2, severity: 'block',
        message: `declared agent "${name}" missing from punchlist.phase_1_parallel_research.agents`,
      });
      continue;
    }
    if (completionExpected && !TERMINAL_AGENT_STATUS.has(agents[name].status)) {
      findings.push({
        exit_code: 2, severity: 'block',
        message: `agent "${name}" has non-terminal status "${agents[name].status}" — manifest declares completed_at`,
      });
    }
  }

  // Step 2b — count consistency
  if (completionExpected) {
    const expected = phase1.expected_count;
    const complete = phase1.actual_complete || 0;
    const empty = phase1.actual_empty || 0;
    const accountedFor = complete + empty;
    if (typeof expected === 'number' && expected !== accountedFor) {
      findings.push({
        exit_code: 2, severity: 'block',
        message: `phase_1 count mismatch: expected_count=${expected} but actual_complete + actual_empty = ${accountedFor}`,
      });
    }
  }

  // Step 3 — artifact byte threshold + Step 4 — section headers
  // + Step 5 — spec-compliance honesty
  const declaredDispatchPath = manifest.declared_dispatch_path || '';
  const declaredDispatchDir = stripBasenamePattern(declaredDispatchPath);

  for (const name of declared) {
    const a = agents[name];
    if (!a || a.status !== 'complete') continue;
    const artifactPath = a.artifact_path;
    if (!artifactPath) {
      findings.push({
        exit_code: 2, severity: 'block',
        message: `agent "${name}" status=complete but artifact_path missing`,
      });
      continue;
    }
    const absArtifact = path.isAbsolute(artifactPath)
      ? artifactPath
      : path.join(runDir, path.relative('.', artifactPath).replace(/^artifacts[\\/]/, 'artifacts/'));
    // Tolerate run-relative ("artifacts/phase-1/x.md") and ws-relative paths
    const candidates = uniquePaths([
      absArtifact,
      path.join(runDir, artifactPath),
      path.join(wsDir, artifactPath),
      path.join(repoRoot(wsDir), artifactPath),
    ]);
    const found = candidates.find((p) => fs.existsSync(p));
    if (!found) {
      findings.push({
        exit_code: 2, severity: 'block',
        message: `agent "${name}" artifact not found: ${artifactPath} (searched ${candidates.length} locations)`,
      });
      continue;
    }

    const stat = fs.statSync(found);
    if (stat.size < minBytes) {
      findings.push({
        exit_code: 3, severity: 'block',
        message: `agent "${name}" artifact ${found} is ${stat.size}B (below threshold ${minBytes}B)`,
      });
      continue; // section-header check would noise on a too-small file
    }

    // Step 4 — section headers
    const requiredSections = lookupRequiredSections(name, found, repoRoot(wsDir));
    if (requiredSections.length > 0 && /\.md$/i.test(found)) {
      const text = fs.readFileSync(found, 'utf8');
      const missing = requiredSections.filter((sec) => !hasHeading(text, sec));
      for (const sec of missing) {
        findings.push({
          exit_code: 4, severity: 'block',
          message: `agent "${name}" artifact ${found} missing required section header: "${sec}"`,
        });
      }
    }

    // Step 5 — spec-compliance honesty
    if (declaredDispatchDir) {
      const wantsPath = declaredDispatchDir;
      // The artifact_path is to the run's artifact dir, NOT to the persona
      // dispatch path. Spec-compliance compares the SUBAGENT TYPE / dispatch
      // origin, captured in a.subagent_type. If subagent_type contains
      // "general-purpose+persona-load" or any non-".claude/agents/" pattern,
      // we require an explicit spec_compliant: false declaration.
      const sub = a.subagent_type || '';
      const usesSpecdDispatch = sub.includes('.claude/agents/')
        || sub.includes('(native)')
        || /^roundtable-/.test(sub)
        // A bare persona name (e.g. "architect") IS canonical dispatch: the
        // Claude Code Agent tool resolves subagent_type=<name> to
        // .claude/agents/<name>.md. Recognize it so honest orchestrators can
        // stamp spec_compliant: true instead of being forced into a false
        // declaration. (WS-389 follow-up — root cause of INV-046 false-negatives.)
        || sub === name;
      if (!usesSpecdDispatch && a.spec_compliant !== false) {
        findings.push({
          exit_code: 5, severity: 'block',
          message: `agent "${name}" subagent_type "${sub}" does not match declared_dispatch_path "${wantsPath}" — declare spec_compliant: false with reason`,
        });
      }
      if (a.spec_compliant === false && (!a.spec_compliant_reason || a.spec_compliant_reason === '')) {
        findings.push({
          exit_code: 5, severity: 'block',
          message: `agent "${name}" declares spec_compliant: false but spec_compliant_reason is empty`,
        });
      }
    }
  }

  // Step 6 — contract_alignment block (only required at completion)
  if (completionExpected) {
    const ca = manifest.contract_alignment || {};
    const requiredAxes = [
      `mode_${manifest.contract.mode}`,
      `stretch_${manifest.contract.stretch ? 'true' : 'false'}`,
      'success_shape',
      'scope_ceiling',
    ];
    for (const axis of requiredAxes) {
      if (!ca[axis] || typeof ca[axis] !== 'object') {
        findings.push({
          exit_code: 6, severity: 'block',
          message: `contract_alignment.${axis} is missing — required at completion`,
        });
      } else if (!ca[axis].status) {
        findings.push({
          exit_code: 6, severity: 'block',
          message: `contract_alignment.${axis}.status is missing`,
        });
      }
    }
    const requiredCompletion = ['findings_raw_count', 'findings_after_synthesis', 'work_items_to_create'];
    for (const f of requiredCompletion) {
      if (manifest[f] === undefined || manifest[f] === null) {
        findings.push({
          exit_code: 6, severity: 'block',
          message: `required completion field missing: ${f}`,
        });
      }
    }
  }

  return emit(runId, findings);
}

function uniquePaths(arr) {
  const seen = new Set();
  const out = [];
  for (const p of arr) {
    const norm = path.normalize(p);
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

function stripBasenamePattern(dispatchPath) {
  // ".claude/agents/<name>.md" -> ".claude/agents"
  // ".claude/agents/architect.md" -> ".claude/agents"
  return dispatchPath.replace(/\/[^/]*$/, '');
}

function lookupRequiredSections(personaName, artifactPath, repo) {
  // Search personas/**/<name>.md for frontmatter required_sections.
  const candidates = [
    path.join(repo, 'personas', 'core', `${personaName}.md`),
    path.join(repo, 'personas', 'domain', `${personaName}.md`),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');
    const fm = extractFrontmatter(text);
    if (!fm) continue;
    const r = fm.required_sections;
    if (Array.isArray(r) && r.length > 0) return r.map(String);
  }
  // Fallback global default for .md artifacts
  if (/\.md$/i.test(artifactPath)) return ['## Findings'];
  return [];
}

function extractFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  try {
    return parseYAML(m[1]);
  } catch {
    return null;
  }
}

function hasHeading(text, prefix) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!/^#{1,6}\s/.test(line)) continue;
    if (line === prefix || line.startsWith(`${prefix} `) || line.startsWith(`${prefix}\t`)) {
      return true;
    }
  }
  return false;
}

function loadConfigMinBytes(wsDir) {
  const cfgPath = path.join(repoRoot(wsDir), '.cwos-config.yaml');
  if (!fs.existsSync(cfgPath)) return DEFAULT_MIN_BYTES;
  try {
    const r = readYAMLFile(cfgPath);
    const v = r && r.data && r.data.engines && r.data.engines.manifest_min_artifact_bytes;
    if (typeof v === 'number' && v > 0) return v;
  } catch { /* fall through */ }
  return DEFAULT_MIN_BYTES;
}

function emit(runId, findings) {
  const exitCode = findings.length === 0
    ? 0 : Math.min(...findings.map((f) => f.exit_code));
  const out = {
    ok: findings.length === 0,
    exit_code: exitCode,
    run_id: runId,
    findings,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  if (findings.length > 0) {
    process.stderr.write('\n');
    for (const f of findings) {
      process.stderr.write(`BLOCK [exit ${f.exit_code}] run-id=${runId}\n  ${f.message}\n`);
    }
    process.stderr.write(
      '\nManifest gate enforces engine-run pre/post alignment (WS-305). ' +
      'See kit/templates/workstream/runs/MANIFEST.md\n'
    );
  }
  process.exit(exitCode);
}

// ─── Subcommand: allocate-run-id (WS-311 AC e — concurrent-run guard) ───────
//
// Atomically reads next_run_id from .claude/workstream/config.yaml, increments
// it, writes the file back, and returns the allocated id. Locked on
// `<config>.lock` so two engines firing in the same minute can't both read
// the same id and silently overwrite each other's run scaffolding.
//
// Output: JSON `{ ok, run_id }` to stdout.

function cmdAllocateRunId(args) {
  const wsDirOverride = readFlag(args, 'workstream-dir');
  const wsDir = wsDirOverride
    ? path.resolve(wsDirOverride)
    : findWorkstreamDir(process.cwd());
  const configPath = path.join(wsDir, 'config.yaml');
  if (!fs.existsSync(configPath)) {
    process.stderr.write(`cwos-engine-manifest allocate-run-id: config.yaml not found at ${configPath}\n`);
    process.exit(1);
  }

  const lockPath = configPath + '.lock';
  let allocated;
  withFileLock(lockPath, () => {
    const raw = fs.readFileSync(configPath, 'utf8');
    const m = raw.match(/^next_run_id:\s*(\d+)/m);
    if (!m) {
      throw new Error(`config.yaml missing next_run_id field: ${configPath}`);
    }
    const current = parseInt(m[1], 10);
    if (!Number.isFinite(current) || current < 1) {
      throw new Error(`config.yaml next_run_id is invalid: ${m[1]}`);
    }
    allocated = current;
    const next = current + 1;
    const updated = raw.replace(
      /^next_run_id:\s*\d+(\s*#[^\n]*)?$/m,
      (_full, cmt) => `next_run_id: ${next}${cmt || ''}`
    );
    writeFileAtomic(configPath, updated);
  }, { ownerLabel: 'engine-manifest:allocate-run-id', maxWaitMs: 10000 });

  const runId = `run-${String(allocated).padStart(3, '0')}`;
  process.stdout.write(JSON.stringify({ ok: true, run_id: runId, raw_id: allocated }, null, 2) + '\n');
  process.exit(0);
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2);
  const subcmd = argv[0];
  const args = argv.slice(1);

  if (!subcmd || subcmd === '--help' || subcmd === '-h') {
    process.stdout.write(
      'Usage: cwos-engine-manifest <subcommand> [...flags]\n' +
      '  allocate-run-id  atomically allocate next run-id (locked config.yaml RMW)\n' +
      '  init             create pre-artifact for a new run\n' +
      '  update           update live punchlist (per agent / phase)\n' +
      '  refire           record a discarded redundant dispatch\n' +
      '  complete         write post-artifact (contract_alignment + counts)\n' +
      '  validate         verify pre/post alignment, byte threshold, headers\n' +
      '\nSee kit/templates/workstream/runs/MANIFEST.md for the schema.\n'
    );
    process.exit(subcmd ? 0 : 1);
  }

  switch (subcmd) {
    case 'allocate-run-id': return cmdAllocateRunId(args);
    case 'init': return cmdInit(args);
    case 'update': return cmdUpdate(args);
    case 'refire': return cmdRefire(args);
    case 'complete': return cmdComplete(args);
    case 'validate': return cmdValidate(args);
    default:
      process.stderr.write(`cwos-engine-manifest: unknown subcommand "${subcmd}"\n`);
      process.exit(2);
  }
}

if (require.main === module) main();

module.exports = {
  // Exposed for tests
  loadManifest, saveManifest, manifestPathFor,
  hasHeading, extractFrontmatter, lookupRequiredSections,
  recomputePhase1Counts, phaseKeyFor,
  GRANDFATHER_DATE, DEFAULT_MIN_BYTES,
  // WS-314 — input_state_snapshot capture
  gatherInputStateSnapshot,
};
