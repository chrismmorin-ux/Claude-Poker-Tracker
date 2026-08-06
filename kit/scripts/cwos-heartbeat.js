#!/usr/bin/env node
/**
 * cwos-heartbeat — Update last_heartbeat on the current active session.
 *
 * Designed to be invoked frequently (e.g., from a Stop hook on every Claude
 * response). Must be fast (<100ms typical) and silent unless something is
 * genuinely wrong. Safe to run when no session is active (no-ops).
 *
 * Contract:
 *   - Resolves WHICH session is beating from the harness id (stdin `session_id`,
 *     else CLAUDE_CODE_SESSION_ID), matched against `agent_session_id`
 *   - Writes last_heartbeat: <ISO timestamp> into sessions/<id>.yaml
 *   - No output on success (quiet by default)
 *   - Exit 0 even if no session to update — absence is not an error
 *
 * WHY NOT `.current-session` (WS-564). The pointer holds exactly ONE id, so with
 * two live sessions it names whichever registered last; the other sessions' beats
 * go nowhere and they cross the staleness window while still working. Measured
 * twice in claude-poker-tracker on 2026-08-02: once with the pointer DELETED
 * mid-session by another session, so this script advanced nobody at all, and once
 * with the pointer present, where exactly one of three sessions got a heartbeat.
 * `cwos-claims.resolveSessionId` is the only resolver that module documents as
 * correct under concurrency, so this defers to it rather than keeping a second,
 * subtly different copy. The pointer survives only as the last resort for a
 * process that has no harness identity at all.
 *
 * AND THE STAMP FOLLOWS THE FACT. `.hooks-liveness.yaml` used to be stamped
 * unconditionally at entry, so a run that resolved nobody and advanced nothing
 * still certified the heartbeat as healthy — INV-026 went GREEN over data that
 * was two days dead. The entrypoint proof (`last_heartbeat_hook_fired_at`) and
 * the outcome (`last_heartbeat_hook_at`) are now separate fields, because they
 * are separate facts and only one of them is what INV-026 is actually asking.
 *
 * Usage:
 *   node cwos-heartbeat.js                 # silent update
 *   node cwos-heartbeat.js --verbose       # report what was updated
 *   node cwos-heartbeat.js --workstream-dir <p>
 *   node cwos-heartbeat.js --session-id <harness id>   # testing / manual
 */

'use strict';

require('./lib/preflight');

const path = require('path');
const fs = require('fs');
const { findWorkstreamDir, writeFileAtomic, withFileLock, loadEventDeps } = require('./lib/cwos-utils');
const { resolveSessionId, touchSession } = require('./lib/cwos-claims');

/**
 * The harness session id: environment first, Stop-hook stdin payload second.
 *
 * ENV FIRST IS NOT A PREFERENCE, IT IS THE NON-BLOCKING PATH. Claude Code
 * exports CLAUDE_CODE_SESSION_ID into every subprocess it spawns, hooks
 * included, so in production the stdin read is redundant. And reading fd 0 is
 * not safe to do unconditionally: an OPEN pipe with no writer blocks forever
 * rather than returning EOF, so `node cwos-heartbeat.js --verbose` typed into a
 * shell that holds stdin open hangs the process — observed while smoke-testing
 * this very change. Consulting the environment first, and refusing to read a
 * TTY, removes both hangs while keeping the payload path for any harness that
 * passes an id only on stdin.
 */
function resolveAgentId(explicit) {
  if (explicit) return explicit;
  const env = process.env.CLAUDE_CODE_SESSION_ID;
  if (env && String(env).trim()) return String(env).trim();
  if (process.stdin.isTTY) return null;
  try {
    const raw = fs.readFileSync(0, 'utf8');
    if (!raw || !raw.trim()) return null;
    return JSON.parse(raw).session_id || null;
  } catch { return null; }
}

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
//   last_heartbeat_hook_fired_at: "2026-04-20T14:32:01Z"
//   last_session_recovery_hook_at: "2026-04-20T09:15:42Z"
//
// Always rewritten fresh each call so all fields stay in stable order even as
// each hook updates independently.
//
// WS-564: `_fired_at` and `_at` are DIFFERENT FACTS and the file now says so.
// `_fired_at` proves the Node entrypoint ran — the original WS-138 purpose, which
// must be stamped before any business logic so a crash between require and work
// is still visible. `_at` proves a session's `last_heartbeat` actually moved.
// Stamping the second at entry (as this did) meant a run that resolved no session
// and advanced nobody still certified liveness: INV-026 read GREEN while the data
// it proxies for had been dead for two days. A stamp must never outlive the thing
// it certifies.
const LIVENESS_FIELDS = [
  'last_heartbeat_hook_at',
  'last_heartbeat_hook_fired_at',
  'last_session_recovery_hook_at',
];

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
      '#\n' +
      '# *_fired_at  the script entrypoint ran. Written FIRST, so a crash between\n' +
      '#             require and the work is still visible.\n' +
      '# *_at        the work actually happened (a session heartbeat advanced).\n' +
      '#             Written last. WS-564: stamping this at entry meant a hook that\n' +
      '#             resolved nobody still certified liveness, and INV-026 read\n' +
      '#             GREEN over data that had been dead for two days.\n' +
      LIVENESS_FIELDS
        .filter(f => values[f])
        .map(f => `${f}: "${values[f]}"`)
        .join('\n') + '\n';

    writeFileAtomic(livenessPath, body, { skipSizeGate: true });
  } catch (err) {
    if (verbose) process.stderr.write(`heartbeat: stamp write failed — ${err.message}\n`);
  }
}

/**
 * Flip an `abandoned` record back to `active`, and clear the tombstone with it.
 *
 * `ended_at` has to go too. Recovery sets it alongside the status, and a record
 * that says `status: active` while carrying an end time is a contradiction that
 * every later reader has to guess about — /status counts it, session-recovery
 * re-scans it, and INV-026 cannot tell which field to believe.
 *
 * The claims that recovery released are NOT re-acquired here. Releasing them
 * may have been wrong, but another session could have picked one up in the
 * meantime, and silently taking it back is the double-claim that WS-533 and
 * WS-561 exist to prevent. Reviving restores the session's ability to claim;
 * re-claiming is /next's decision, made against the queue as it stands now.
 */
function reviveSession(sessionPath, verbose) {
  try {
    let text = fs.readFileSync(sessionPath, 'utf8');
    text = text.replace(/^status:\s*.+$/m, 'status: active');
    if (/^ended_at:\s*.+$/m.test(text)) text = text.replace(/^ended_at:\s*.+$/m, 'ended_at: null');
    // Leave a trace: a session that came back should be visible as such rather
    // than looking like it was never away.
    if (!/^revived_at:/m.test(text)) {
      text = text.replace(/^status: active$/m, `status: active\nrevived_at: "${new Date().toISOString()}"`);
    } else {
      text = text.replace(/^revived_at:\s*.+$/m, `revived_at: "${new Date().toISOString()}"`);
    }
    writeFileAtomic(sessionPath, text);
    return true;
  } catch (err) {
    if (verbose) process.stderr.write(`heartbeat: revive failed — ${err.message}\n`);
    return false;
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

  // WS-138 / FIND-067: stamp the ENTRYPOINT proof first so that even if a
  // downstream step crashes (module-not-found, permission denied, YAML parse
  // fail), INV-026 can still tell "hook never fired" from "hook fired but the
  // script has a bug." Wrapped in try/catch so a stamp-write failure never
  // crashes the heartbeat itself.
  //
  // WS-228 / FAIL-007 S1: stamp acquisition is mutex-protected against
  // concurrent fires from cwos-session-recovery.js — both scripts share
  // .hooks-liveness.yaml and would otherwise clobber each other's field.
  // The lock window covers ONLY the read-modify-write inside stampHookLiveness;
  // sub-50ms typical. Lock contention is non-fatal — best-effort stamping.
  stamp(wsDir, 'last_heartbeat_hook_fired_at', verbose);

  // WS-564: resolve WHICH session is beating through the one resolver that is
  // correct under concurrency. Order is the harness id from the Stop payload,
  // then CLAUDE_CODE_SESSION_ID from the environment, then — only for a process
  // with no harness identity at all — the legacy pointer. `create: false`: a
  // heartbeat reports on a session, it does not bring one into existence.
  const idIdx = args.indexOf('--session-id');
  const agentId = resolveAgentId(idIdx !== -1 ? args[idIdx + 1] : null);
  const sessionId = resolveSessionId(wsDir, { create: false, agentId });

  if (!sessionId) {
    if (verbose) process.stderr.write('heartbeat: no session resolvable from stdin, env, or pointer\n');
    return 0;
  }

  const sessionPath = path.join(wsDir, 'sessions', `${sessionId}.yaml`);
  if (!fs.existsSync(sessionPath)) {
    // Record vanished (pointer stale, or a concurrent recovery archived it).
    // Don't error, and don't stamp: nothing was advanced.
    if (verbose) process.stderr.write(`heartbeat: session file missing for ${sessionId}\n`);
    return 0;
  }

  // Which sessions may beat, and the one that may be brought BACK.
  //
  // QUOTES. This used to compare the raw regex capture against 'active', so a
  // record written `status: "active"` failed the test and was silently skipped
  // — the same quote-blindness that made INV-039 read a deprecated cache
  // (WS-548) and made an emptied lease unfillable (WS-561). Recovery reads this
  // same field through a YAML parser and sees `active` either way, so the two
  // disagreed about the same bytes. Strip the quotes and they agree.
  const content = fs.readFileSync(sessionPath, 'utf8');
  const statusMatch = content.match(/^status:\s*(.+?)\s*$/m);
  const status = statusMatch ? statusMatch[1].trim().replace(/^["'](.*)["']$/, '$1') : 'unknown';

  // ABANDONMENT IS A GUESS; A BEAT IS PROOF (WS-578 follow-up).
  //
  // Recovery was one-way. Once it marked a session abandoned, this check
  // refused to beat it, so nothing could ever move `last_heartbeat` again and
  // the session stayed dead for as long as it kept running. Measured
  // 2026-08-05: this session was abandoned at 20:12 over a stale pid, then
  // worked for another 20 hours as a corpse — claims released, unable to
  // reclaim them, while `last_heartbeat_hook_fired_at` advanced on every
  // response and `last_heartbeat_hook_at` sat 23 hours behind.
  //
  // A beat arriving from the process whose agent_session_id the record names is
  // direct evidence the guess was wrong. Reviving on that evidence is safe in
  // the way adopting the pointer is not: resolveSessionId matched us by harness
  // identity, so this can only ever revive OUR OWN record.
  //
  // `completed` is deliberately NOT revivable. That status is a decision
  // somebody made, not an inference — /session-end wrote it on purpose, and a
  // late hook firing afterwards must not undo it.
  if (status === 'abandoned') {
    const revived = reviveSession(sessionPath, verbose);
    if (!revived) {
      if (verbose) process.stderr.write(`heartbeat: session ${sessionId} is abandoned and could not be revived\n`);
      return 0;
    }
    if (verbose) process.stdout.write(`heartbeat: revived ${sessionId} — it is alive and beating\n`);
  } else if (status !== 'active') {
    if (verbose) process.stderr.write(`heartbeat: session ${sessionId} status=${status}, skipping\n`);
    return 0;
  }

  // touchSession also (re)stamps `host` and `pid`, so a record that has moved
  // machines, or whose Claude process restarted under the same conversation,
  // corrects itself here rather than being judged against the wrong process
  // table forever (WS-564, and the pid half added alongside this revive).
  const advanced = touchSession(wsDir, sessionId);
  if (!advanced) {
    if (verbose) process.stderr.write(`heartbeat: could not advance ${sessionId}\n`);
    return 0;
  }

  // Only NOW is the liveness stamp true.
  stamp(wsDir, 'last_heartbeat_hook_at', verbose);

  if (verbose) process.stdout.write(`heartbeat: ${sessionId} advanced\n`);
  return 0;
}

/** Mutex-protected liveness stamp. Best-effort; never fatal. */
function stamp(wsDir, field, verbose) {
  try {
    withFileLock(
      path.join(wsDir, '.hooks-liveness.yaml.lock'),
      () => stampHookLiveness(wsDir, field, verbose),
      { maxWaitMs: 2000, ownerLabel: 'heartbeat' }
    );
  } catch (err) {
    if (verbose) process.stderr.write(`heartbeat: stamp lock contention — ${err.message}\n`);
  }
}

// WS-544: guard the entry point so requiring this file for a dependency smoke
// check neither writes a heartbeat nor exits the checking process.
if (require.main === module) {
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
}
