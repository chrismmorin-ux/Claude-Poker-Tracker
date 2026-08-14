#!/usr/bin/env node
/**
 * cwos-session-register — register THIS session automatically, and say who else is here.
 *
 * ROOT CAUSE THIS FIXES (WS-533). The session registry rotted from 2026-05-15 to
 * 2026-07-26 for a structural reason, not a broken hook: **registration was manual
 * while maintenance was automatic.** Only `/session-start` wrote
 * `.current-session`, and a Stop hook can only UPDATE a registry entry — it can
 * never create one. So every session that just started talking (i.e. nearly all of
 * them) never registered, `cwos-heartbeat.js` had nothing to beat, and
 * `cwos-session-recovery.js` had nothing to recover. The machinery was alive and
 * the registry was empty.
 *
 * The fix is to register from the SessionStart hook, which fires whether or not
 * anyone remembers a command.
 *
 * IDENTITY COMES FROM THE HARNESS, NOT FROM A CLOCK. Claude Code passes
 * `session_id` on stdin. Using it means:
 *   - no minting race. Two sessions starting in the same minute get distinct
 *     identities; a timestamp-derived id would collide, and worse, both would
 *     overwrite the single `.current-session` pointer and each lose track of itself.
 *   - stability across re-fires. SessionStart also fires on resume, and matching on
 *     `agent_session_id` re-finds the existing record instead of forking a new one.
 *
 * `.current-session` is still written for the consumers that read it
 * (cwos-heartbeat, cwos-verify's INV-026), but it is explicitly NOT the identity of
 * record: one pointer cannot represent N concurrent sessions. The session files are
 * the registry; the pointer is a legacy convenience.
 *
 * NEVER BLOCKS. Always exits 0. A registry is an aid to the founder, and a session
 * that cannot start is worse than a session nobody logged.
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const { cliGate } = require('./lib/cli');
const { findWorkstreamDir, writeFileAtomic, patchYAMLFile, withFileLock, makeEventEmitter } = require('./lib/cwos-utils');

const emitEvent = makeEventEmitter();
const {
  listLiveSessions, registryHealth, touchSession, findByAgentSessionId,
  staleActiveSessions, localHost, patchOrInsert,
} = require('./lib/cwos-claims');

const CLI = {
  name: 'cwos-session-register',
  summary: 'register this session in the repo registry and report other live sessions',
  flags: {
    quiet: { type: 'boolean', describe: 'suppress the report; still registers' },
    'no-register': { type: 'boolean', describe: 'report only — do not create or touch a record' },
    'session-id': { type: 'string', placeholder: 'id', describe: 'harness session id (default: read from stdin JSON)' },
    'workstream-dir': { type: 'string', placeholder: 'path', describe: 'override workstream dir discovery' },
    json: { type: 'boolean', describe: 'emit machine-readable output' },
  },
  notes: 'Always exits 0 — a session start must never be blocked by bookkeeping.',
};

/** SessionStart hook payload: { session_id, cwd, hook_event_name, ... } */
function readHookStdin() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    if (!raw || !raw.trim()) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function humanId(agentId, now) {
  const stamp = new Date(now).toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  const suffix = String(agentId || 'nohook').replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'nohook';
  return `ses-${stamp}-${suffix}`;
}

function register(wsDir, agentId, pid) {
  const existing = findByAgentSessionId(wsDir, agentId);
  if (existing) {
    touchSession(wsDir, existing.id);
    // Re-assert the pid: a resumed session runs in a new process. DATE it in the
    // same write (WS-351, restored 2026-08-13 — the 3.10.3 kit sync dropped it):
    // an undated pid cannot be told apart from one recycled across a reboot.
    // patchOrInsert (not patchYAMLFile with insertMissing) because records
    // predating the field must gain BOTH keys atomically, placed after `pid` —
    // the same replace-only drop that broke claims (WS-529/WS-561).
    try {
      patchOrInsert(existing.file, { pid, pid_recorded_at: new Date().toISOString() }, 'pid');
    } catch { /* best-effort */ }
    return { id: existing.id, created: false };
  }

  const now = Date.now();
  const id = humanId(agentId, now);
  const ts = new Date(now).toISOString();
  const sessDir = path.join(wsDir, 'sessions');
  try { fs.mkdirSync(sessDir, { recursive: true }); } catch { /* exists */ }
  const file = path.join(sessDir, `${id}.yaml`);

  if (!fs.existsSync(file)) {
    writeFileAtomic(file, [
      `id: "${id}"`,
      'status: active',
      `started_at: "${ts}"`,
      'ended_at: null',
      'mode: auto',
      `last_heartbeat: "${ts}"`,
      // The session's process. `process.pid` here would be this short-lived hook,
      // useless the moment it exits; the caller passes CLAUDE_PID or `process.ppid`
      // — the Claude Code harness — which outlives the whole session.
      //
      // This IS load-bearing (WS-351): a dead pid recovers the session without
      // waiting on the heartbeat timeout. What makes that safe is the stamp below.
      // A pid alone cannot be told apart from a pid recycled after a reboot, so
      // `sessionOwnerVerdict` reads a pid recorded before the current boot as dead
      // outright rather than consulting the process table.
      `pid: ${pid}`,
      `pid_recorded_at: "${ts}"`,
      // WS-564: which machine that pid belongs to. `sessions/` is tracked, so
      // records travel between nodes by git pull — without this, the pid above
      // and the boot-time proof in cwos-claims are both evaluated against
      // whichever machine happens to be reading, and a live session on another
      // node reads as dead and has its claims taken.
      `host: "${localHost() || ''}"`,
      // The harness id is the join key. Keep it: it is what makes re-fires
      // idempotent and what distinguishes concurrent sessions from each other.
      `agent_session_id: "${agentId || ''}"`,
      '',
      '# Registered automatically by cwos-session-register (SessionStart hook, WS-533).',
      '# Registration is deliberately NOT dependent on anyone running /session-start —',
      '# that dependency is why this registry sat empty from 2026-05-15 to 2026-07-26.',
      'claimed_items: []',
      'files_locked: []',
      '',
    ].join('\n'));
  }

  // WS-560 (INV-028): session registration is the fact every claim-conflict
  // and liveness decision is built on (WS-533). It must leave a trace.
  emitEvent('T15:session-end', 'session-registered', { session_id: id, agent_session_id: agentId || null });

  // Legacy pointer, best-effort and lock-guarded. Not the identity of record.
  try {
    withFileLock(path.join(wsDir, '.current-session.lock'), () => {
      writeFileAtomic(path.join(wsDir, '.current-session'), id);
    }, { ownerLabel: 'session-register', maxWaitMs: 2000 });
  } catch { /* a lost pointer race is harmless — the session file is authoritative */ }

  return { id, created: true };
}

function main() {
  const { values } = cliGate(process.argv.slice(2), CLI);

  let wsDir;
  try {
    wsDir = values['workstream-dir']
      ? path.resolve(values['workstream-dir'])
      : findWorkstreamDir(process.cwd());
  } catch {
    return 0; // no workstream here — nothing to register, not an error
  }

  const hook = values['session-id'] ? null : readHookStdin();
  const agentId = values['session-id'] || (hook && hook.session_id) || null;

  let self = { id: null, created: false };
  if (!values['no-register']) {
    try { self = register(wsDir, agentId, process.env.CLAUDE_PID || process.ppid || process.pid); }
    catch { /* registration is best-effort; still report below */ }
  }

  const others = listLiveSessions(wsDir, self.id);
  const health = registryHealth(wsDir);
  const stale = staleActiveSessions(wsDir, { selfId: self.id });

  if (values.json) {
    process.stdout.write(JSON.stringify({ self, others, registry: health, stale_active: stale }) + '\n');
    return 0;
  }
  if (values.quiet) return 0;

  const lines = [];

  // The line that would have prevented the 2026-07-26 incident.
  if (others.length) {
    lines.push(`⚠ ${others.length} other session(s) live in this repo:`);
    for (const o of others) {
      const claims = o.claimed_items.length ? ` — claims ${o.claimed_items.join(', ')}` : '';
      const where = o.foreign_host ? ` on ${o.host || 'an unknown host'}` : '';
      lines.push(`  - ${o.id} (pid ${o.pid == null ? '?' : o.pid})${where}${claims}`);
    }
    lines.push('  Coordinate before editing shared files, or work in a separate worktree.');
  }

  // A dead registry must never read as "all clear" (WS-533 item 4).
  if (!health.ok) {
    lines.push(`⚠ session registry unhealthy: ${health.reason}`);
    lines.push('  Until fixed, "no other session" means UNKNOWN, not none.');
  }

  // WS-564: records that SAY active but stopped heartbeating. They are what makes
  // every concurrency signal unusable in both directions — filtered out as
  // not-live by anything that trusts heartbeats, counted forever by anything that
  // does not. Recovery is supposed to clear them; when it is not running, the
  // population is the symptom that says so.
  if (stale.length) {
    lines.push(`⚠ ${stale.length} session(s) marked active but not heartbeating:`);
    for (const s of stale.slice(0, 6)) {
      const held = s.claimed_items.length ? ` holding ${s.claimed_items.join(', ')}` : '';
      const age = s.minutes_stale == null ? 'no heartbeat' : `${Math.floor(s.minutes_stale / 60)}h stale`;
      lines.push(`  - ${s.id} (${age})${held}`);
    }
    if (stale.length > 6) lines.push(`  - ... and ${stale.length - 6} more`);
    lines.push('  Clear with: node kit/scripts/cwos-session-recovery.js --auto');
  }

  if (lines.length) process.stdout.write(lines.join('\n') + '\n');
  return 0;
}

// WS-544: guard the entry point so requiring this file for a dependency smoke
// check neither registers a session nor exits the checking process.
if (require.main === module) {
  try { main(); }
  catch { /* never block a session start */ }
  process.exit(0);
}
