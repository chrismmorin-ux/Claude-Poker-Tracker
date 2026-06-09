#!/usr/bin/env node
/**
 * cwos-status-pre.js — Pre-phase script for /status command.
 *
 * Gathers all data needed for the system health dashboard in a single
 * invocation, outputting a YAML context bundle to stdout. Replaces
 * Steps 1-6 of status.md (20-30 tool calls → 1 Bash call).
 *
 * Usage: node cwos-status-pre.js
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');

const {
  emitBundle, bundleError, findStateFile,
  gatherVitalSigns, gatherQueueSummary, gatherProgramHealth,
  gatherFindings, gatherActiveSessions, gatherUsage,
} = require('./lib/cwos-orchestrate');
const { findWorkstreamDir, globFiles, readYAMLFile } = require('./lib/cwos-utils');
const { spawnSync } = require('child_process');

// WS-195: typed-API read path for recent command history (ADR-020 step 2).
// Guarded require per AS-23 — status must not break on pre-step-2 repos
// that don't have state-store installed.
let _stateStore = null;
try { _stateStore = require('./core/state-store'); } catch {}

const startMs = Date.now();
const errors = [];

// Locate workstream directory
let wsDir;
try {
  wsDir = findWorkstreamDir(process.cwd());
} catch {
  bundleError('Cannot find .claude/workstream/ — is CWOS installed?');
}

// Locate state file
const stateFile = findStateFile(process.cwd());

// Gather inventory accuracy (run cwos-inventory.js --verify)
function gatherInventory(errors) {
  try {
    const scriptPath = path.join(__dirname, 'cwos-inventory.js');
    if (!fs.existsSync(scriptPath)) return { available: false };

    const result = spawnSync('node', [scriptPath, '--verify'], {
      encoding: 'utf8', timeout: 5000, cwd: path.resolve(__dirname, '..', '..'),
    });

    // Parse the YAML output for mismatches
    const output = result.stdout || '';
    const mismatchMatch = output.match(/total_mismatches:\s*(\d+)/);
    const mismatches = mismatchMatch ? parseInt(mismatchMatch[1]) : 0;

    if (mismatches > 0) {
      errors.push(`inventory: ${mismatches} inventory count(s) in state.md are stale`);
    }

    return { available: true, mismatches, exit_code: result.status };
  } catch (err) {
    errors.push(`inventory: ${err.message}`);
    return { available: false };
  }
}

// WS-195: recent command history via state-store typed-API. Reads
// state/envelope.json via stateStore.envelope.recent(N) — a deterministic
// O(1) lookup over the materialized view, NOT a raw-event-log parse.
// This is the determinism-first principle in action (see
// feedback_determinism_first.md). Returns null if state-store is absent.
function gatherRecentCommands(errors, limit) {
  if (!_stateStore) return null;
  try {
    const store = _stateStore.loadState(wsDir);
    const recent = store.envelope.recent(limit || 5);
    const active = store.envelope.active();
    return {
      source: 'state-store (typed-API)',
      recent: recent.map((e) => ({
        command_id: e.command_id, tag: e.tag,
        started_at: e.started_at || null,
        completed_at: e.completed_at || null,
        exit_status: e.exit_status || null,
      })),
      active_count: active.length,
    };
  } catch (err) {
    errors.push(`recent_commands: ${err.message}`);
    return null;
  }
}

// WS-321 — Gather adoption_phase + m0_dormant + capture buffer counts.
// During dormant mode (M0), /status renders a different shape and the standard
// data sections are suppressed. The bundle always carries this block; the
// markdown renderer in status.md decides what to display based on adoption_phase.
function gatherAdoptionPhase(errors) {
  const onboardingPath = path.join(process.cwd(), '.cwos-onboarding.yaml');
  if (!fs.existsSync(onboardingPath)) {
    // Pre-/adopt repos: no onboarding file. Treat as M1 (legacy default).
    return { adoption_phase: 'M1', m0_dormant: null, capture_counts: null };
  }
  try {
    // readYAMLFile returns { ok, data, error, warnings } — unwrap it.
    const result = readYAMLFile(onboardingPath);
    if (!result.ok) {
      errors.push(`adoption_phase: ${result.error}`);
      return { adoption_phase: 'M1', m0_dormant: null, capture_counts: null };
    }
    const data = result.data || {};
    const phase = data.adoption_phase || 'M1';
    const m0 = data.m0_dormant || null;
    let captureCounts = null;
    if (phase === 'M0') {
      captureCounts = countCaptureBufferEvents(wsDir, errors);
    }
    return { adoption_phase: phase, m0_dormant: m0, capture_counts: captureCounts };
  } catch (err) {
    errors.push(`adoption_phase: ${err.message}`);
    return { adoption_phase: 'M1', m0_dormant: null, capture_counts: null };
  }
}

// WS-321 — Count T20:capture-buffer events grouped by track_tag.
// Cheap line-by-line read of events/current.jsonl. During M0 the file should
// be small (a few dozen events at most). Returns counts + total + span.
function countCaptureBufferEvents(workstreamDir, errors) {
  const eventsPath = path.join(workstreamDir, 'events', 'current.jsonl');
  if (!fs.existsSync(eventsPath)) {
    return { total: 0, by_tag: {}, span_start: null, span_end: null };
  }
  try {
    const content = fs.readFileSync(eventsPath, 'utf8');
    const lines = content.split('\n').filter((l) => l.trim());
    const byTag = {};
    let total = 0;
    let spanStart = null;
    let spanEnd = null;
    for (const line of lines) {
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      if (ev.source_track !== 'T20:capture-buffer') continue;
      total += 1;
      byTag[ev.track_tag] = (byTag[ev.track_tag] || 0) + 1;
      if (!spanStart || ev.timestamp < spanStart) spanStart = ev.timestamp;
      if (!spanEnd || ev.timestamp > spanEnd) spanEnd = ev.timestamp;
    }
    return { total, by_tag: byTag, span_start: spanStart, span_end: spanEnd };
  } catch (err) {
    errors.push(`capture_counts: ${err.message}`);
    return { total: 0, by_tag: {}, span_start: null, span_end: null };
  }
}

// WS-321 — Gather adoption phase first; if M0, suppress the heavy gatherers
// (their data is meaningless during dormant mode and showing it reproduces the
// "missing config" failure mode WS-321 explicitly avoids).
const adoptionPhase = gatherAdoptionPhase(errors);
const isDormant = adoptionPhase.adoption_phase === 'M0';

// WS-322 Phase C — collect deferred-scope tripwire counts. Surfaces in /status
// as a yellow line ("N deferred items eligible for re-eval") when ≥1 is
// eligible. Skipped in M0 (no tripwires before ignition).
function gatherDeferredScope(errors) {
  if (isDormant) return null;
  const queueDir = path.join(wsDir, 'queue');
  if (!fs.existsSync(queueDir)) return null;
  let eligibleCount = 0;
  let stillBlockedCount = 0;
  try {
    for (const f of fs.readdirSync(queueDir)) {
      if (!/^WS-.+\.yaml$/.test(f)) continue;
      const r = readYAMLFile(path.join(queueDir, f));
      if (!r.ok) continue;
      const item = r.data || {};
      if (!item.re_eval_trigger) continue;
      const note = (item.blocked_by_note || '').toString();
      if (item.status === 'blocked') stillBlockedCount += 1;
      else if (/^\[unblocked\]/.test(note)) eligibleCount += 1;
    }
  } catch (err) {
    errors.push(`deferred_scope: ${err.message}`);
    return null;
  }
  if (eligibleCount === 0 && stillBlockedCount === 0) return null;
  return { eligible: eligibleCount, still_blocked: stillBlockedCount };
}

const data = {
  adoption_phase: adoptionPhase,
  vital_signs: isDormant ? null : (stateFile ? gatherVitalSigns(stateFile, errors) : null),
  queue: isDormant ? null : gatherQueueSummary(wsDir, errors),
  programs: isDormant ? null : gatherProgramHealth(wsDir, errors),
  findings: isDormant ? null : gatherFindings(wsDir, errors),
  sessions: isDormant ? null : gatherActiveSessions(wsDir, errors),
  usage: gatherUsage(wsDir, errors),
  inventory: isDormant ? null : gatherInventory(errors),
  recent_commands: isDormant ? null : gatherRecentCommands(errors, 5),
  deferred_scope: gatherDeferredScope(errors),
};

// Emit bundle
emitBundle({
  command: 'status',
  script: 'cwos-status-pre.js',
  startMs,
  errors,
  data,
});
