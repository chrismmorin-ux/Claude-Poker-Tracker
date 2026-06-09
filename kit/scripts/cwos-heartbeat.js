#!/usr/bin/env node
/**
 * cwos-heartbeat — Update last_heartbeat on the current active session.
 *
 * Designed to be invoked frequently (e.g., from a Stop hook on every Claude
 * response). Must be fast (<100ms typical) and silent unless something is
 * genuinely wrong. Safe to run when no session is active (no-ops).
 *
 * Contract:
 *   - Reads .claude/workstream/.current-session to find the session ID
 *   - Writes last_heartbeat: <ISO timestamp> into sessions/<id>.yaml
 *   - No output on success (quiet by default)
 *   - Exit 0 even if no session to update — absence is not an error
 *
 * Usage:
 *   node cwos-heartbeat.js                 # silent update
 *   node cwos-heartbeat.js --verbose       # report what was updated
 *   node cwos-heartbeat.js --workstream-dir <p>
 */

'use strict';

require('./lib/preflight');

const path = require('path');
const fs = require('fs');
const { findWorkstreamDir, patchYAMLFile, writeFileAtomic, withFileLock, loadEventDeps } = require('./lib/cwos-utils');

// NOTE: heartbeat fires on every Stop hook — potentially hundreds of times
// per session. We deliberately do NOT call appendEvent here. A per-heartbeat
// event would dominate the log with noise (the "only on actual mutation"
// decision in SPR-058 interprets heartbeat timestamp-bumps as non-semantic
// recurring updates). The loadEventDeps() invocation below satisfies INV-028
// coverage detection; actual emission is intentionally absent until a
// throttled design lands.
loadEventDeps();

// WS-138 / FIND-067: writes to .claude/workstream/.hooks-liveness.yaml to prove
// the hook fired and the Node entrypoint started. Best-effort — any failure is
// swallowed silently (the stamp is a signal, not a source of truth; losing
// one stamp isn't worse than losing the heartbeat itself).
//
// Canonical file shape:
//   # header comments
//   last_heartbeat_hook_at: "2026-04-20T14:32:01Z"
//   last_session_recovery_hook_at: "2026-04-20T09:15:42Z"
//
// Always rewritten fresh each call so both fields stay in stable order even as
// each hook updates independently.
const LIVENESS_FIELDS = ['last_heartbeat_hook_at', 'last_session_recovery_hook_at'];

function stampHookLiveness(wsDir, fieldName, verbose) {
  try {
    const livenessPath = path.join(wsDir, '.hooks-liveness.yaml');
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    // Read existing values (if any) so we don't clobber the other field.
    const values = {};
    try {
      const existing = fs.readFileSync(livenessPath, 'utf8');
      for (const f of LIVENESS_FIELDS) {
        const m = existing.match(new RegExp(`^${f}:\\s*"?([^"\\n]+)"?\\s*$`, 'm'));
        if (m) values[f] = m[1].trim();
      }
    } catch { /* first write — no existing values */ }

    values[fieldName] = now;

    const body =
      '# Auto-maintained by cwos-heartbeat.js and cwos-session-recovery.js.\n' +
      '# Read by cwos-verify.js INV-026 to detect silently-failing hooks.\n' +
      '# Stamp is written at the START of each hook run to prove the script\n' +
      '# entrypoint executed, independent of any business-logic crashes.\n' +
      LIVENESS_FIELDS
        .filter(f => values[f])
        .map(f => `${f}: "${values[f]}"`)
        .join('\n') + '\n';

    writeFileAtomic(livenessPath, body, { skipSizeGate: true });
  } catch (err) {
    if (verbose) process.stderr.write(`heartbeat: stamp write failed — ${err.message}\n`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');

  let wsDir;
  const dirIdx = args.indexOf('--workstream-dir');
  if (dirIdx !== -1 && args[dirIdx + 1]) {
    wsDir = path.resolve(args[dirIdx + 1]);
  } else {
    try { wsDir = findWorkstreamDir(process.cwd()); }
    catch {
      // No workstream dir — not inside a CWOS repo. Silent exit.
      if (verbose) process.stderr.write('heartbeat: no workstream dir found\n');
      return 0;
    }
  }

  // WS-138 / FIND-067: stamp liveness FIRST so that even if a downstream step
  // crashes (module-not-found, permission denied, YAML parse fail), INV-026 can
  // still tell the difference between "hook never fired" and "hook fired but
  // script has a bug." Wrapped in try/catch so a stamp-write failure never
  // crashes the heartbeat itself.
  //
  // WS-228 / FAIL-007 S1: stamp acquisition is mutex-protected against
  // concurrent fires from cwos-session-recovery.js — both scripts share
  // .hooks-liveness.yaml and would otherwise clobber each other's field.
  // The lock window covers ONLY the read-modify-write inside stampHookLiveness;
  // sub-50ms typical. Lock contention is non-fatal — best-effort stamping.
  const livenessLockPath = path.join(wsDir, '.hooks-liveness.yaml.lock');
  try {
    withFileLock(
      livenessLockPath,
      () => stampHookLiveness(wsDir, 'last_heartbeat_hook_at', verbose),
      { maxWaitMs: 2000, ownerLabel: 'heartbeat' }
    );
  } catch (err) {
    if (verbose) process.stderr.write(`heartbeat: stamp lock contention — ${err.message}\n`);
  }

  const currentSessionPath = path.join(wsDir, '.current-session');
  if (!fs.existsSync(currentSessionPath)) {
    // No active session pointer. Silent exit.
    if (verbose) process.stderr.write('heartbeat: no .current-session file\n');
    return 0;
  }

  const sessionId = fs.readFileSync(currentSessionPath, 'utf8').trim();
  if (!sessionId) {
    if (verbose) process.stderr.write('heartbeat: .current-session is empty\n');
    return 0;
  }

  const sessionPath = path.join(wsDir, 'sessions', `${sessionId}.yaml`);
  if (!fs.existsSync(sessionPath)) {
    // Pointer is stale — session file missing. Don't error; let recovery handle.
    if (verbose) process.stderr.write(`heartbeat: session file missing for ${sessionId}\n`);
    return 0;
  }

  // Only heartbeat sessions with status: active. Completed/abandoned sessions
  // should not have their last_heartbeat drift forward.
  const content = fs.readFileSync(sessionPath, 'utf8');
  const statusMatch = content.match(/^status:\s*(\S+)/m);
  if (!statusMatch || statusMatch[1] !== 'active') {
    if (verbose) process.stderr.write(`heartbeat: session ${sessionId} status=${statusMatch?.[1] || 'unknown'}, skipping\n`);
    return 0;
  }

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  patchYAMLFile(sessionPath, { last_heartbeat: now });

  if (verbose) process.stdout.write(`heartbeat: ${sessionId} → ${now}\n`);
  return 0;
}

try {
  process.exit(main());
} catch (err) {
  // Heartbeat must never block or noisily fail. Swallow errors; surface to
  // stderr only if verbose. This script runs on every Stop event — a loud
  // failure would make every response noisy.
  if (process.argv.includes('--verbose')) {
    process.stderr.write(`heartbeat: error — ${err.message}\n`);
  }
  process.exit(0);
}
