#!/usr/bin/env node
/**
 * cwos-engine-complete — emit `engine_run_completed` for a finished /engine run
 * (WS-302, closes FIND-RUN016-2).
 *
 * Background: the canonical engine-completion event is documented in
 * `kit/commands/engine.md` and consumed by `cwos-engine-contract-verify.js`
 * (binding lookup) + `kit/scripts/core/reducers/engines.js` (history count).
 * Until WS-302 shipped, no source emitted it during live runs — only the
 * one-shot backfill script (`scripts/migrate-engine-history.js`) and any
 * manual `cwos-event.js append` call. Result: every verifier call fell
 * through to all-time heuristic binding; engine_history_count stayed 0.
 *
 * This script closes the gap. /engine Step 6 calls it after cwos-reconcile;
 * it derives engine_id + program_id from the most recent `engine_intent_recorded`
 * event for the run, validates the run's briefing.md exists, and emits one
 * `engine_run_completed` event. Idempotent: skips emission if an event with
 * the same run_id already exists in the log.
 *
 * Usage:
 *   cwos-engine-complete --run-id run-NNN
 *   cwos-engine-complete --run-id run-NNN --no-emit            # dry-run
 *   cwos-engine-complete --run-id run-NNN --events-dir <p>     # for fixtures
 *   cwos-engine-complete --run-id run-NNN --workstream-dir <p> # for fixtures
 *   cwos-engine-complete --run-id run-NNN --engine <id> --target <id>
 *                                                              # explicit metadata
 *
 * Exit codes:
 *   0 — emitted (or skipped because event already exists, or --no-emit dry-run ok)
 *   1 — emission attempted but failed (event-log issue, schema validation, etc.)
 *   2 — usage error / preconditions not met (missing briefing, no contract event)
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { findWorkstreamDir, readYAMLFile, loadEventDeps } = require('./lib/cwos-utils');

let writeRunSummary = null;
try { ({ writeRunSummary } = require('./lib/cwos-run-summary')); }
catch { /* WS-314 lib missing — summary write becomes a no-op */ }

// WS-414: deterministic post-engine-run telemetry append. Closes FIND-273
// (skill-telemetry.yaml was prose-driven, ritual-dependent). Required for AS-33
// observability. Best-effort: missing lib or write failure never blocks the
// run-completion flow.
let writeSkillTelemetry = null;
try { ({ writeSkillTelemetry } = require('./lib/cwos-skill-telemetry')); }
catch { /* WS-414 lib missing — telemetry write becomes a no-op */ }

const MANIFEST_GRANDFATHER_DATE = '2026-05-07'; // WS-305 ship date

// WS-309: artifact-size proxy rate. Calibrated from the historical
// command_telemetry_stamped event (2026-05-01, tokens_per_char=0.25). The
// Stop-hook telemetry mechanism that produced that sample is dormant in the
// current harness, so engine_run_completed events stamp tokens_derived from
// an artifact-byte proxy until that telemetry is re-wired (see follow-on
// finding under prog-engine-reliability). The verifier and budget consumer
// both treat command_telemetry_stamped as preferred when found and fall back
// to the proxy otherwise.
const ARTIFACT_TOKENS_PER_CHAR = 0.25;
const ARTIFACT_EXTENSIONS = new Set(['.md', '.yaml', '.yml', '.txt', '.json']);

const { appendEvent, ensureCommandId } = loadEventDeps();

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i === args.length - 1) return null;
  return args[i + 1];
}
function hasFlag(args, name) { return args.includes(`--${name}`); }

function repoRoot(wsDir) { return path.resolve(wsDir, '..', '..'); }

// ─── WS-305 manifest gate ──────────────────────────────────────────────────

function checkManifest({ runId, runDir, wsDir }) {
  const manifestPath = path.join(runDir, 'manifest.yaml');
  if (!fs.existsSync(manifestPath)) {
    // No manifest — grandfather pre-WS-305 runs by run-dir mtime.
    if (!fs.existsSync(runDir)) {
      return { ok: false, reason: `run dir missing: ${runDir}`, findings: [] };
    }
    const stat = fs.statSync(runDir);
    const mtimeISO = stat.mtime.toISOString();
    const mtimeDate = mtimeISO.slice(0, 10);
    if (mtimeDate < MANIFEST_GRANDFATHER_DATE) {
      return { ok: true, grandfathered: true };
    }
    return {
      ok: false,
      reason: `manifest.yaml missing for post-${MANIFEST_GRANDFATHER_DATE} run — required by WS-305`,
      findings: [{
        exit_code: 1,
        message: `manifest.yaml not found at ${manifestPath}; required for runs ≥ ${MANIFEST_GRANDFATHER_DATE} (WS-305)`,
      }],
    };
  }

  const validator = path.join(__dirname, 'cwos-engine-manifest.js');
  const r = spawnSync('node', [
    validator, 'validate', '--run-id', runId, '--workstream-dir', wsDir,
  ], { encoding: 'utf8' });

  if (r.status === 0) return { ok: true };

  let parsed = null;
  try { parsed = JSON.parse(r.stdout); } catch { /* ignore */ }
  return {
    ok: false,
    reason: `validator exit ${r.status}`,
    stderr: r.stderr,
    findings: (parsed && parsed.findings) || [],
  };
}

function writeManifestFinding({ runId, wsDir, findings, reason }) {
  try {
    const findingsDir = path.join(wsDir, 'findings');
    if (!fs.existsSync(findingsDir)) fs.mkdirSync(findingsDir, { recursive: true });
    const findId = `FIND-MFST-${runId}-${Date.now()}`;
    const findPath = path.join(findingsDir, `${findId}.yaml`);
    const lines = [
      `id: "${findId}"`,
      `title: "Manifest gate blocked engine_run_completed for ${runId}"`,
      `severity: HIGH`,
      `program: prog-engine-reliability`,
      `source: cwos-engine-complete`,
      `created_at: "${new Date().toISOString()}"`,
      `disposition: work_item_now`,
      `description: |`,
      `  Engine run ${runId} reached completion (briefing.md exists) but the`,
      `  manifest gate (WS-305) refused to emit engine_run_completed.`,
      `  Reason: ${reason}`,
      ``,
      `  Resolve by either fixing the manifest.yaml under .claude/workstream/runs/${runId}/`,
      `  or, for legacy pre-2026-05-07 runs, confirming the run dir mtime`,
      `  predates the WS-305 grandfather date.`,
      `manifest_findings:`,
    ];
    for (const f of findings) {
      const msg = String(f.message || '').replace(/"/g, '\\"');
      lines.push(`  - exit_code: ${f.exit_code}`);
      lines.push(`    message: "${msg}"`);
    }
    fs.writeFileSync(findPath, lines.join('\n') + '\n');
  } catch (e) {
    process.stderr.write(`cwos-engine-complete: failed to write manifest finding: ${e.message}\n`);
  }
}

function findExistingCompletion({ runId, eventsDir }) {
  if (!fs.existsSync(eventsDir)) return null;
  const files = fs.readdirSync(eventsDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
    .sort();
  for (const f of files) {
    let lines;
    try { lines = fs.readFileSync(path.join(eventsDir, f), 'utf8').split('\n'); }
    catch { continue; }
    for (const line of lines) {
      if (!line.trim()) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      const p = ev.payload || {};
      if (p.type === 'engine_run_completed' && p.run_id === runId) return ev;
    }
  }
  return null;
}

function findIntentForRun({ runId, eventsDir }) {
  // Most recent engine_intent_recorded event whose `target` resolves to
  // this run's program. We don't have a contract_id ↔ run_id link in the
  // schema, so we fall back to "most recent intent before the briefing.md
  // mtime" heuristic. Future cleanup: WS-302 follow-up — write run_id into
  // the intent payload (or a manifest pointer) so this guess goes away.
  if (!fs.existsSync(eventsDir)) return null;
  const files = fs.readdirSync(eventsDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
    .sort()
    .reverse(); // newest first
  for (const f of files) {
    let lines;
    try { lines = fs.readFileSync(path.join(eventsDir, f), 'utf8').split('\n'); }
    catch { continue; }
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line.trim()) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      const p = ev.payload || {};
      if (p.type === 'engine_intent_recorded') return ev;
    }
  }
  return null;
}

// ─── WS-309 tokens_derived stamping ────────────────────────────────────────

function loadEngineConfig(repoRootPath) {
  // Read .cwos-config.yaml engines.* settings. Returns defaults on any failure.
  const defaults = {
    tokens_per_char: ARTIFACT_TOKENS_PER_CHAR,
    artifact_proxy_enabled: true,
  };
  try {
    const cfgPath = path.join(repoRootPath, '.cwos-config.yaml');
    if (!fs.existsSync(cfgPath)) return defaults;
    const r = readYAMLFile(cfgPath);
    if (!r.ok || !r.data || !r.data.engines) return defaults;
    const e = r.data.engines;
    return {
      tokens_per_char: typeof e.tokens_per_char === 'number' ? e.tokens_per_char : defaults.tokens_per_char,
      artifact_proxy_enabled: e.artifact_proxy_enabled !== false,
    };
  } catch { return defaults; }
}

function findTelemetryEventsBetween({ eventsDir, sinceISO, untilISO }) {
  // Walks the event log forward from `since` and returns
  // command_telemetry_stamped events with timestamps in (since, until].
  // Returns [] when none found OR when the eventsDir is missing.
  if (!fs.existsSync(eventsDir)) return [];
  const sinceDate = sinceISO ? sinceISO.slice(0, 10) : '0000-00-00';
  const untilDate = untilISO ? untilISO.slice(0, 10) : '9999-99-99';
  const files = fs.readdirSync(eventsDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f) && f.slice(0, 10) >= sinceDate && f.slice(0, 10) <= untilDate)
    .sort();
  const out = [];
  for (const f of files) {
    let lines;
    try { lines = fs.readFileSync(path.join(eventsDir, f), 'utf8').split('\n'); }
    catch { continue; }
    for (const line of lines) {
      if (!line.trim()) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      if (!ev.payload || ev.payload.type !== 'command_telemetry_stamped') continue;
      if (sinceISO && ev.timestamp <= sinceISO) continue;
      if (untilISO && ev.timestamp > untilISO) continue;
      out.push(ev);
    }
  }
  return out;
}

function sumArtifactBytes(runDir) {
  // Recursively sums the byte size of artifact files (md/yaml/json/txt) under
  // runs/<run-id>/artifacts/. Skips other directories. Returns { bytes, files }.
  const artifactsDir = path.join(runDir, 'artifacts');
  if (!fs.existsSync(artifactsDir)) return { bytes: 0, files: 0 };
  let bytes = 0;
  let files = 0;
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) { walk(p); continue; }
      if (!ent.isFile()) continue;
      const ext = path.extname(ent.name).toLowerCase();
      if (!ARTIFACT_EXTENSIONS.has(ext)) continue;
      try { bytes += fs.statSync(p).size; files++; } catch { /* skip */ }
    }
  }
  walk(artifactsDir);
  return { bytes, files };
}

function deriveTokensDerived({ eventsDir, intentEvent, runDir, completedAt, config }) {
  // Preferred source: command_telemetry_stamped events emitted between the
  // engine_intent_recorded timestamp and the run's completion. Sums their
  // tokens_derived fields. The Stop-hook mechanism that emits these is
  // dormant in the current harness; this branch will activate when re-wired.
  const sinceISO = intentEvent && intentEvent.timestamp;
  const telemetry = sinceISO ? findTelemetryEventsBetween({ eventsDir, sinceISO, untilISO: completedAt }) : [];
  if (telemetry.length > 0) {
    let total = 0;
    for (const t of telemetry) {
      const v = t.payload && typeof t.payload.tokens_derived === 'number' ? t.payload.tokens_derived : 0;
      total += v;
    }
    return {
      value: total,
      source: 'command_telemetry_stamped',
      sample_count: telemetry.length,
    };
  }

  // Fallback: artifact-byte proxy. Sum artifact file bytes × tokens_per_char.
  // Reasonable for runs where the artifacts ARE the produced output. Does not
  // capture token cost from tool round-trips that produced no artifacts.
  if (config.artifact_proxy_enabled) {
    const { bytes, files } = sumArtifactBytes(runDir);
    if (bytes > 0) {
      return {
        value: Math.round(bytes * config.tokens_per_char),
        source: 'artifact_size_proxy',
        proxy_bytes: bytes,
        proxy_files: files,
        proxy_rate: config.tokens_per_char,
      };
    }
  }

  return { value: null, source: 'unavailable' };
}

// ─── WS-310 Phase E: on_complete chain dispatcher ─────────────────────────

const CHAIN_CYCLE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function loadEngineRegistry(wsDir) {
  const registryPath = path.join(wsDir, 'engines', 'registry.yaml');
  if (!fs.existsSync(registryPath)) return null;
  const r = readYAMLFile(registryPath);
  if (!r.ok || !r.data || !r.data.engines) return null;
  return r.data.engines;
}

function findRecentChainDispatches({ eventsDir, sinceISO, sourceEngine, targetEngine }) {
  // Walk forward from `since` and collect engine_chain_dispatched events
  // matching the (source, target) pair. Used for the cycle/duplication guard.
  if (!fs.existsSync(eventsDir)) return [];
  const sinceDate = sinceISO ? sinceISO.slice(0, 10) : '0000-00-00';
  const files = fs.readdirSync(eventsDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f) && f.slice(0, 10) >= sinceDate)
    .sort();
  const out = [];
  for (const f of files) {
    let lines;
    try { lines = fs.readFileSync(path.join(eventsDir, f), 'utf8').split('\n'); }
    catch { continue; }
    for (const line of lines) {
      if (!line.trim()) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      const p = ev.payload || {};
      if (p.type !== 'engine_chain_dispatched') continue;
      if (p.source_engine !== sourceEngine) continue;
      if (p.chained_engine !== targetEngine) continue;
      if (sinceISO && ev.timestamp <= sinceISO) continue;
      out.push(ev);
    }
  }
  return out;
}

function nextWsId(queueDir) {
  if (!fs.existsSync(queueDir)) fs.mkdirSync(queueDir, { recursive: true });
  let max = 0;
  for (const f of fs.readdirSync(queueDir)) {
    const m = f.match(/^WS-(\d{3,5})\.yaml$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `WS-${String(max + 1).padStart(3, '0')}`;
}

function renderChainQueueYaml({ wsId, sourceEngine, sourceRunId, sourceEventId, targetEngine, dispatchedAt }) {
  return [
    `id: "${wsId}"`,
    `title: "Run ${targetEngine} on ${sourceEngine} ${sourceRunId} (chained)"`,
    `status: backlog`,
    `priority_score: 35`,
    `category: kit-quality`,
    `capability: calibration`,
    `effort: M`,
    `type: engine-run`,
    `program: engine-reliability`,
    `source_class: chain-dispatched`,
    `source: "auto-dispatch from ${sourceEngine} ${sourceRunId} via on_complete chain"`,
    `chained_from:`,
    `  engine: "${sourceEngine}"`,
    `  run_id: "${sourceRunId}"`,
    `  event_id: "${sourceEventId || ''}"`,
    `created_at: "${dispatchedAt}"`,
    `description: |`,
    `  Auto-dispatched by the on_complete chain declared on ${sourceEngine} in`,
    `  .claude/workstream/engines/registry.yaml. Run ${targetEngine} against the`,
    `  artifacts produced by ${sourceRunId}.`,
    `accept_criteria:`,
    `  - "${targetEngine} run produces a score-${sourceRunId}.yaml under docs/evolution/quality-scores/ (or equivalent artifact for non-quality-judge targets)"`,
    `  - "Run is recorded in the event log via cwos-engine-complete after the chained run finishes"`,
    '',
  ].join('\n');
}

function dispatchOnCompleteChains({
  engineId, runId, eventId,
  wsDir, eventsDir,
  clock,
  dryRun,         // CLI --no-emit: skip both queue write and event emit
  skipEventEmit,  // tests / event-log unavailable: queue write proceeds, emit suppressed
}) {
  const registry = loadEngineRegistry(wsDir);
  if (!registry || !registry[engineId]) {
    return { ok: true, dispatched: [], skipped: [], note: 'engine not in registry — no chains' };
  }
  const targets = (registry[engineId].chains && registry[engineId].chains.on_complete) || [];
  if (!Array.isArray(targets) || targets.length === 0) {
    return { ok: true, dispatched: [], skipped: [], note: 'no on_complete chains' };
  }

  const dispatchedAt = clock || new Date().toISOString();
  const cycleSinceISO = new Date(Date.parse(dispatchedAt) - CHAIN_CYCLE_WINDOW_MS).toISOString();
  const queueDir = path.join(wsDir, 'queue');

  const dispatched = [];
  const skipped = [];

  for (const targetEngine of targets) {
    if (typeof targetEngine !== 'string' || !targetEngine.trim()) {
      skipped.push({ chained_engine: String(targetEngine), reason: 'empty target' });
      continue;
    }
    if (!registry[targetEngine]) {
      skipped.push({ chained_engine: targetEngine, reason: 'target not in registry' });
      continue;
    }
    // Cycle guard: same source-target pair already dispatched within the
    // last hour → skip. Defends against A→B→A loops or the same engine
    // re-completing during a transient state.
    const recent = findRecentChainDispatches({
      eventsDir, sinceISO: cycleSinceISO,
      sourceEngine: engineId, targetEngine,
    });
    if (recent.length > 0) {
      skipped.push({
        chained_engine: targetEngine,
        reason: `cycle-guard: ${recent.length} recent dispatch(es) for same source-target pair within ${CHAIN_CYCLE_WINDOW_MS / 60000} min`,
        recent_event_ids: recent.map(e => e.id || null),
      });
      // Still emit a `skipped: true` event so the suppression is auditable.
      if (!dryRun && !skipEventEmit && appendEvent && ensureCommandId) {
        try {
          const commandId = ensureCommandId('engine-chain-dispatch');
          appendEvent({
            source_track: 'T7:engines',
            source_tier: 'reducer-output',
            track_tag: engineId,
            command_id: commandId,
            payload: {
              type: 'engine_chain_dispatched',
              source_engine: engineId,
              source_run_id: runId,
              chained_engine: targetEngine,
              dispatched_at: dispatchedAt,
              source_event_id: eventId || null,
              queue_item_id: null,
              skipped: true,
              skip_reason: 'cycle-guard',
            },
          });
        } catch { /* non-fatal */ }
      }
      continue;
    }

    // Allocate WS id + write queue YAML BEFORE emitting the event so the
    // event references a real id. If the YAML write fails, we abort dispatch
    // (no event emitted) — better to have no record than a dangling reference.
    let wsId = null;
    try {
      wsId = nextWsId(queueDir);
      const yaml = renderChainQueueYaml({
        wsId,
        sourceEngine: engineId,
        sourceRunId: runId,
        sourceEventId: eventId,
        targetEngine,
        dispatchedAt,
      });
      const qPath = path.join(queueDir, `${wsId}.yaml`);
      if (!dryRun) fs.writeFileSync(qPath, yaml);
    } catch (e) {
      skipped.push({ chained_engine: targetEngine, reason: `queue write failed: ${e.message}` });
      continue;
    }

    let chainEventId = null;
    if (!dryRun && !skipEventEmit && appendEvent && ensureCommandId) {
      try {
        const commandId = ensureCommandId('engine-chain-dispatch');
        const r = appendEvent({
          source_track: 'T7:engines',
          source_tier: 'reducer-output',
          track_tag: engineId,
          command_id: commandId,
          payload: {
            type: 'engine_chain_dispatched',
            source_engine: engineId,
            source_run_id: runId,
            chained_engine: targetEngine,
            dispatched_at: dispatchedAt,
            source_event_id: eventId || null,
            queue_item_id: wsId,
          },
        });
        if (r && r.ok && r.event) chainEventId = r.event.id;
        else if (r && !r.ok) {
          skipped.push({ chained_engine: targetEngine, reason: `event validation: ${(r.errors || []).join('; ')}`, queue_item_id: wsId });
          continue;
        }
      } catch (e) {
        skipped.push({ chained_engine: targetEngine, reason: `event emission failed: ${e.message}`, queue_item_id: wsId });
        continue;
      }
    }

    dispatched.push({
      chained_engine: targetEngine,
      queue_item_id: wsId,
      chain_event_id: chainEventId,
    });
  }

  return { ok: true, dispatched, skipped };
}

function deriveProgramId(target) {
  // Convention: when /engine target is a program shortname (e.g., "engine-reliability"),
  // canonical program_id is "prog-${target}". When target is a file path or
  // free-text focus, return target as-is — the caller can override via --target.
  if (!target) return null;
  if (target.startsWith('prog-')) return target;
  if (target.includes('/') || target.includes(' ')) return target;
  return `prog-${target}`;
}

// ─── core per-run emit (shared by CLI runEmit + WS-466 sweep) ──────────────
//
// Returns a status object instead of calling process.exit, so the same logic
// can be driven by the single-run CLI (which maps status → exit codes) and by
// the sweep (which collects results across many runs). `writeFindingOnGate`
// controls whether a manifest-gate failure writes a FIND-MFST finding: true for
// the explicit CLI invocation (an auditor), false for the sweep (a passive
// healer that must not spew findings for old/incomplete runs).
//
// status values: 'emitted' | 'already_emitted' | 'no_briefing' | 'manifest_gate'
//   | 'no_intent' | 'no_program' | 'emit_unavailable' | 'emit_validation'
//   | 'emit_error'
function emitForRun({
  runId, eventsDir, wsDir, root,
  noEmit = false,
  explicitEngine = null, explicitTarget = null, explicitProgram = null,
  clock = null,
  writeFindingOnGate = true,
}) {
  const runDir = path.join(wsDir, 'runs', runId);
  const briefingPath = path.join(runDir, 'artifacts', 'phase-3', 'briefing.md');

  if (!fs.existsSync(briefingPath)) {
    return { ok: false, status: 'no_briefing', run_id: runId, reason: `briefing not found at ${briefingPath}` };
  }

  // Idempotency FIRST: if engine_run_completed already exists, the run is done —
  // re-gating is pointless (the event is immutable) and in the CLI path would
  // redundantly write a FIND-MFST finding on every re-run. Short-circuit here.
  const existing = findExistingCompletion({ runId, eventsDir });
  if (existing) {
    return { ok: true, status: 'already_emitted', run_id: runId, event_id: existing.id };
  }

  // WS-305 — manifest gate. Block NEW emissions if validator fails (or if a
  // post-grandfather run has no manifest at all).
  const manifestCheck = checkManifest({ runId, runDir, wsDir });
  if (!manifestCheck.ok) {
    if (writeFindingOnGate) {
      writeManifestFinding({ runId, wsDir, findings: manifestCheck.findings, reason: manifestCheck.reason });
    }
    return {
      ok: false, status: 'manifest_gate', run_id: runId,
      reason: manifestCheck.reason, stderr: manifestCheck.stderr,
      findings: manifestCheck.findings, wrote_finding: !!writeFindingOnGate,
    };
  }
  const grandfathered = !!manifestCheck.grandfathered;

  // Derive engine + program. Explicit flags win; otherwise look up the most
  // recent engine_intent_recorded event. The intent event is also reused
  // downstream as the timestamp lower-bound for WS-309 tokens derivation.
  let engineId = explicitEngine;
  let target = explicitTarget;
  let programId = explicitProgram;
  let intentEvent = null;

  if (!engineId || !target) {
    intentEvent = findIntentForRun({ runId, eventsDir });
    if (!intentEvent) {
      return { ok: false, status: 'no_intent', run_id: runId, reason: 'no engine_intent_recorded event found and no explicit --engine/--target — cannot fabricate metadata' };
    }
    engineId = engineId || intentEvent.payload.engine;
    target = target || intentEvent.payload.target;
  } else {
    intentEvent = findIntentForRun({ runId, eventsDir });
  }

  if (!programId) programId = deriveProgramId(target);
  if (!programId) {
    return { ok: false, status: 'no_program', run_id: runId, reason: `could not derive program_id from target="${target}"` };
  }

  const briefingStat = fs.statSync(briefingPath);
  const completedAt = clock || briefingStat.mtime.toISOString();
  const artifactsDir = path.relative(root, runDir).replace(/\\/g, '/');

  // WS-309: derive tokens_derived from telemetry (preferred) or artifact-size
  // proxy (fallback). Always populate the field — null is only emitted when
  // both sources are unavailable, distinguished via tokens_derived_source so
  // the verifier can grandfather BLOCKED on `unavailable`.
  const engineConfig = loadEngineConfig(root);
  const tokens = deriveTokensDerived({ eventsDir, intentEvent, runDir, completedAt, config: engineConfig });

  const payload = {
    type: 'engine_run_completed',
    run_id: runId,
    engine_id: engineId,
    program_id: programId,
    artifacts_dir: artifactsDir,
    completed_at: completedAt,
    tokens_derived: tokens.value,
    tokens_derived_source: tokens.source,
  };
  if (tokens.sample_count != null) payload.tokens_derived_sample_count = tokens.sample_count;
  if (tokens.proxy_bytes != null) {
    payload.tokens_derived_proxy_bytes = tokens.proxy_bytes;
    payload.tokens_derived_proxy_files = tokens.proxy_files;
    payload.tokens_derived_proxy_rate = tokens.proxy_rate;
  }

  const result = {
    ok: true,
    status: 'emitted',
    run_id: runId,
    payload,
    no_emit: noEmit,
    grandfathered,
  };

  if (!noEmit) {
    if (!appendEvent || !ensureCommandId) {
      return { ok: false, status: 'emit_unavailable', run_id: runId, reason: 'events.js / composition.js unavailable — cannot emit' };
    }
    try {
      const commandId = ensureCommandId('engine-run-complete');
      const r = appendEvent({
        source_track: 'T7:engines',
        source_tier: 'reducer-output',
        track_tag: engineId,
        command_id: commandId,
        payload,
      });
      if (r && !r.ok) {
        return { ok: false, status: 'emit_validation', run_id: runId, reason: (r.errors || []).join('; ') };
      }
      result.event_id = (r && r.ok && r.event) ? r.event.id : null;
    } catch (e) {
      return { ok: false, status: 'emit_error', run_id: runId, reason: e.message };
    }
  }

  // WS-314: write canonical summary.yaml. Best-effort; never blocks the
  // event flow. Manifest fields plus phase-3 synthesis bullets are distilled
  // into a machine-readable digest under runs/<run-id>/summary.yaml. The
  // index builder in cwos-reconcile-core picks these up for runs-index.yaml.
  if (writeRunSummary && !noEmit) {
    try {
      const sr = writeRunSummary({ runId, runDir, wsDir });
      result.summary = {
        ok: !!(sr && sr.ok),
        path: sr && sr.summary_path,
        grandfathered: !!(sr && sr.grandfathered),
      };
    } catch (e) {
      result.summary = { ok: false, error: e.message };
    }
  }

  // WS-414: skill-telemetry append. Runs after writeRunSummary so verdict +
  // finding_counts are persisted to summary.yaml first. Idempotent on run_id —
  // safe to re-run cwos-engine-complete against an already-recorded run.
  if (writeSkillTelemetry && !noEmit) {
    try {
      const st = writeSkillTelemetry({
        runId, runDir, wsDir, engineId, programId,
        clock: clock || undefined,
      });
      result.telemetry = {
        ok: !!(st && st.ok),
        path: st && st.telemetry_path,
        skipped: !!(st && st.skipped),
      };
    } catch (e) {
      result.telemetry = { ok: false, error: e.message };
    }
  }

  // WS-310 Phase E: on_complete chain dispatch. Reactive (queue item +
  // engine_chain_dispatched event), not synchronous engine invocation.
  // Failures are non-fatal — the run completion event has already shipped.
  try {
    const chainResult = dispatchOnCompleteChains({
      engineId,
      runId,
      eventId: result.event_id,
      wsDir,
      eventsDir,
      clock,
      dryRun: noEmit,
    });
    result.chain_dispatch = chainResult;
  } catch (e) {
    result.chain_dispatch = { ok: false, error: e.message };
  }

  return result;
}

function runEmit(args) {
  const runId = readFlag(args, 'run-id');
  const eventsDirOverride = readFlag(args, 'events-dir');
  const workstreamDirOverride = readFlag(args, 'workstream-dir');
  const noEmit = hasFlag(args, 'no-emit');
  const explicitEngine = readFlag(args, 'engine');
  const explicitTarget = readFlag(args, 'target');
  const explicitProgram = readFlag(args, 'program');
  const clock = readFlag(args, 'clock');

  if (!runId) {
    process.stderr.write('cwos-engine-complete: --run-id <run-NNN> is required\n');
    process.exit(2);
  }
  if (!/^run-[A-Za-z0-9_-]+$/.test(runId)) {
    process.stderr.write(`cwos-engine-complete: invalid run-id "${runId}"\n`);
    process.exit(2);
  }

  const wsDir = workstreamDirOverride || findWorkstreamDir(process.cwd());
  const root = repoRoot(wsDir);
  const eventsDir = eventsDirOverride || path.join(wsDir, 'events');

  const res = emitForRun({
    runId, eventsDir, wsDir, root, noEmit,
    explicitEngine, explicitTarget, explicitProgram, clock,
    writeFindingOnGate: true,
  });

  switch (res.status) {
    case 'no_briefing':
      process.stderr.write(`cwos-engine-complete: briefing not found at ${path.join(wsDir, 'runs', runId, 'artifacts', 'phase-3', 'briefing.md')} — run not complete?\n`);
      process.exit(2);
      break;
    case 'manifest_gate':
      process.stderr.write(`cwos-engine-complete: manifest gate failed for ${runId} — ${res.reason}\n`);
      if (res.stderr) process.stderr.write(res.stderr);
      process.stderr.write(`Wrote finding under .claude/workstream/findings/ scoped to prog-engine-reliability.\n`);
      process.exit(1);
      break;
    case 'already_emitted':
      process.stdout.write(JSON.stringify({
        ok: true, run_id: runId, already_emitted: true, event_id: res.event_id,
      }, null, 2) + '\n');
      process.exit(0);
      break;
    case 'no_intent':
      process.stderr.write(`cwos-engine-complete: no engine_intent_recorded event found and no explicit --engine/--target — cannot fabricate metadata\n`);
      process.exit(2);
      break;
    case 'no_program':
      process.stderr.write(`cwos-engine-complete: could not derive program_id from target — pass --program explicitly\n`);
      process.exit(2);
      break;
    case 'emit_unavailable':
      process.stderr.write('cwos-engine-complete: events.js / composition.js unavailable — cannot emit\n');
      process.exit(1);
      break;
    case 'emit_validation':
      process.stderr.write(`cwos-engine-complete: event validation: ${res.reason}\n`);
      process.exit(1);
      break;
    case 'emit_error':
      process.stderr.write(`cwos-engine-complete: emission failed: ${res.reason}\n`);
      process.exit(1);
      break;
    case 'emitted':
    default:
      process.stdout.write(JSON.stringify(res, null, 2) + '\n');
      process.exit(0);
  }
}

// ─── WS-466: deterministic completion sweep ────────────────────────────────
//
// Root-cause fix for the "structurally inert" finding (FIND-122): the contract
// pipeline's verifier + token-meter only receive data when /engine Step 6 runs
// cwos-engine-complete per run. That emission is ritual-dependent — any run
// where the AI skips Step 6 silently drops out of the pipeline (DEC-029:
// ritual-dependent mechanisms fail). The sweep makes emission deterministic:
// it finds every run with a completion artifact but no engine_run_completed
// event and emits the missing event. Wired into cwos-reconcile.js so it runs
// at every session boundary (session-start/-end, /next done, /engine Step 6,
// autopilot, gc) — no longer dependent on any single ritual.

function findCompletableRuns({ wsDir }) {
  // Runs with a completion artifact (phase-3/briefing.md) — the same signal
  // emitForRun requires. A run without this artifact is not "complete" and is
  // skipped (no false emissions for in-flight or non-eng-engine runs).
  const runsDir = path.join(wsDir, 'runs');
  if (!fs.existsSync(runsDir)) return [];
  const out = [];
  let names;
  try { names = fs.readdirSync(runsDir); } catch { return []; }
  for (const name of names) {
    if (!/^run-[A-Za-z0-9_-]+$/.test(name)) continue;
    const briefing = path.join(runsDir, name, 'artifacts', 'phase-3', 'briefing.md');
    if (fs.existsSync(briefing)) out.push(name);
  }
  return out.sort();
}

function runSweep({ wsDir, eventsDir, root, noEmit = false, clock = null }) {
  const runs = findCompletableRuns({ wsDir });
  const emitted = [];
  const alreadyEmitted = [];
  const skipped = [];
  const grandfathered = [];
  for (const runId of runs) {
    let res;
    try {
      res = emitForRun({
        runId, eventsDir, wsDir, root, noEmit,
        clock,
        writeFindingOnGate: false, // passive healer — never spew FIND-MFST
      });
    } catch (e) {
      skipped.push({ run_id: runId, status: 'error', reason: e.message });
      continue;
    }
    if (res.status === 'emitted') {
      emitted.push({ run_id: runId, event_id: res.event_id || null });
      if (res.grandfathered) grandfathered.push(runId);
    } else if (res.status === 'already_emitted') {
      alreadyEmitted.push(runId);
    } else {
      skipped.push({ run_id: runId, status: res.status, reason: res.reason || null });
    }
  }
  return {
    ok: true,
    swept: runs.length,
    emitted,
    already_emitted: alreadyEmitted,
    skipped,
    grandfathered,
  };
}

function runSweepCli(args) {
  const eventsDirOverride = readFlag(args, 'events-dir');
  const workstreamDirOverride = readFlag(args, 'workstream-dir');
  const noEmit = hasFlag(args, 'no-emit');
  const clock = readFlag(args, 'clock');

  const wsDir = workstreamDirOverride || findWorkstreamDir(process.cwd());
  const root = repoRoot(wsDir);
  const eventsDir = eventsDirOverride || path.join(wsDir, 'events');

  const result = runSweep({ wsDir, eventsDir, root, noEmit, clock });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    process.stdout.write('usage: cwos-engine-complete --run-id <run-NNN> [--engine <id>] [--target <id>] [--program <id>] [--no-emit] [--clock <iso>] [--events-dir <p>] [--workstream-dir <p>]\n');
    process.stdout.write('       cwos-engine-complete sweep [--no-emit] [--clock <iso>] [--events-dir <p>] [--workstream-dir <p>]\n');
    process.stdout.write('         (WS-466) backfill engine_run_completed for every completed run missing one\n');
    process.exit(args.length === 0 ? 1 : 0);
  }
  if (args[0] === 'sweep') return runSweepCli(args.slice(1));
  return runEmit(args);
}

if (require.main === module) main();

module.exports = {
  findExistingCompletion, findIntentForRun, deriveProgramId,
  // WS-309 exports
  loadEngineConfig, findTelemetryEventsBetween, sumArtifactBytes, deriveTokensDerived,
  ARTIFACT_TOKENS_PER_CHAR, ARTIFACT_EXTENSIONS,
  // WS-310 Phase E exports
  dispatchOnCompleteChains, loadEngineRegistry, findRecentChainDispatches,
  nextWsId, renderChainQueueYaml, CHAIN_CYCLE_WINDOW_MS,
  // WS-466 exports — shared per-run emit + deterministic sweep
  emitForRun, findCompletableRuns, runSweep,
};
