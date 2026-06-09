#!/usr/bin/env node
/**
 * cwos-session-recovery — Detect and recover abandoned sessions.
 *
 * Sessions are "abandoned" when last_heartbeat is older than
 * session_abandon_timeout_hours (from config.yaml, default 4h).
 *
 * Recovery synthesizes handoff notes from observable state (git log, sprint
 * progress, queue changes) so no context is lost even when /session-end is
 * never run. Also releases claimed_items and removes stale locks.
 *
 * This script is the primary defense against the 2026-04-20 incident where
 * a single session ran for 12 days through 11 sprint completions and a
 * /checkpoint init run without ever being closed. See DEC-029.
 *
 * Usage:
 *   node cwos-session-recovery.js               # report abandoned sessions
 *   node cwos-session-recovery.js --auto        # recover automatically (used by session-start)
 *   node cwos-session-recovery.js --quiet       # silent unless recovery happened
 *   node cwos-session-recovery.js --dry-run     # compute but don't write
 *   node cwos-session-recovery.js --force       # recover even if within timeout
 *   node cwos-session-recovery.js --workstream-dir <p>
 *
 * Exit codes:
 *   0 — no recovery needed, or recovery succeeded
 *   1 — abandoned sessions detected in --report mode (for CI-style gates)
 */

'use strict';

require('./lib/preflight');

const path = require('path');
const fs = require('fs');
const { runGit } = require('./lib/shell-safe');
const {
  findWorkstreamDir,
  globFiles,
  readYAMLFile,
  patchYAMLFile,
  writeFileAtomic,
  todayISO,
  withFileLock,
} = require('./lib/cwos-utils');

// Session-recovery is high-frequency (fires on every session-start hook);
// the liveness-stamp write at line 78 is intentionally NOT emitted —
// same rationale as cwos-heartbeat.js. Real state-change mutations
// (session mark-abandoned at line 229, lock cleanup at 234/242) DO emit.
const { makeEventEmitter } = require('./lib/cwos-utils');
const emitEvent = makeEventEmitter();

const DEFAULT_TIMEOUT_HOURS = 4;

// WS-138 / FIND-067: same liveness stamp as cwos-heartbeat.js. Kept
// duplicated (rather than extracted to a shared helper) because each hook
// script needs to write this BEFORE any require-chain work that could fail —
// factoring into lib would defeat that purpose.
const LIVENESS_FIELDS = ['last_heartbeat_hook_at', 'last_session_recovery_hook_at'];

function stampHookLiveness(wsDir, fieldName, verbose) {
  try {
    const livenessPath = path.join(wsDir, '.hooks-liveness.yaml');
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
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
    if (verbose) process.stderr.write(`session-recovery: stamp write failed — ${err.message}\n`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const auto = args.includes('--auto');
  const quiet = args.includes('--quiet');
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  let wsDir;
  const dirIdx = args.indexOf('--workstream-dir');
  if (dirIdx !== -1 && args[dirIdx + 1]) {
    wsDir = path.resolve(args[dirIdx + 1]);
  } else {
    try { wsDir = findWorkstreamDir(process.cwd()); }
    catch {
      if (!quiet) process.stderr.write('session-recovery: no workstream dir found\n');
      return 0;
    }
  }

  // WS-138 / FIND-067: stamp hook liveness at the top of main so INV-026 can
  // detect if this hook stops firing (hook-broken vs. no-sessions scenarios).
  // Best-effort — a stamp-write failure never crashes the recovery path.
  //
  // WS-228 / FAIL-007 S1: stamp acquisition is mutex-protected against
  // concurrent fires from cwos-heartbeat.js.
  const livenessLockPath = path.join(wsDir, '.hooks-liveness.yaml.lock');
  try {
    withFileLock(
      livenessLockPath,
      () => stampHookLiveness(wsDir, 'last_session_recovery_hook_at', !quiet),
      { maxWaitMs: 2000, ownerLabel: 'recovery' }
    );
  } catch (err) {
    if (!quiet) process.stderr.write(`session-recovery: stamp lock contention — ${err.message}\n`);
  }

  // WS-228 / FAIL-007 S3: SessionStart hook + /session-start Step 0b can race.
  // Auto-recovery is mutex-protected so only one wins; the second exits cleanly.
  // maxWaitMs is intentionally TINY (100ms): we don't want to block; if another
  // recovery process holds the mutex, the work is already in progress — bail.
  if (auto) {
    const recoveryMutexPath = path.join(wsDir, '.session-recovery.mutex');
    try {
      return withFileLock(
        recoveryMutexPath,
        () => runRecovery(wsDir, { auto, quiet, dryRun, force }),
        { maxWaitMs: 100, ownerLabel: 'recovery-auto' }
      );
    } catch (err) {
      if (!quiet) process.stdout.write('session-recovery: another recovery instance is running — exiting cleanly.\n');
      return 0;
    }
  }
  return runRecovery(wsDir, { auto, quiet, dryRun, force });
}

// runRecovery: extracted from main() per WS-228 to allow withFileLock wrapping
// in --auto mode. Same logic that was inline in main() before; refactored only.
function runRecovery(wsDir, { auto, quiet, dryRun, force }) {

  const timeoutHours = readTimeoutHours(wsDir);
  const sessionsDir = path.join(wsDir, 'sessions');
  if (!fs.existsSync(sessionsDir)) return 0;

  const active = scanActiveSessions(sessionsDir);
  if (active.length === 0) {
    if (!quiet) process.stdout.write('session-recovery: no active sessions.\n');
    return 0;
  }

  const nowMs = Date.now();
  const timeoutMs = timeoutHours * 60 * 60 * 1000;

  const abandoned = [];
  for (const session of active) {
    const heartbeatMs = parseHeartbeatMs(session);
    const ageMs = heartbeatMs === null ? Infinity : (nowMs - heartbeatMs);
    if (force || ageMs > timeoutMs) {
      abandoned.push({ ...session, age_hours: ageMs === Infinity ? null : ageMs / (60 * 60 * 1000) });
    }
  }

  if (abandoned.length === 0) {
    if (!quiet) process.stdout.write(`session-recovery: ${active.length} active session(s), none abandoned.\n`);
    return 0;
  }

  // In report-only mode, list and exit 1 so the caller can gate.
  if (!auto) {
    process.stdout.write(`session-recovery: ${abandoned.length} abandoned session(s) detected:\n`);
    for (const s of abandoned) {
      const ageStr = s.age_hours === null ? 'no heartbeat' : `${s.age_hours.toFixed(1)}h stale`;
      process.stdout.write(`  - ${s.id} (${ageStr})\n`);
    }
    process.stdout.write('\nRun with --auto to recover, or manually close via /session-end.\n');
    return 1;
  }

  // --auto: recover each abandoned session
  for (const session of abandoned) {
    recoverSession(wsDir, session, { dryRun, quiet });
  }

  if (!quiet) {
    process.stdout.write(`session-recovery: recovered ${abandoned.length} abandoned session(s).\n`);
    for (const s of abandoned) {
      process.stdout.write(`  - ${s.id} → status: abandoned\n`);
    }
  }

  return 0;
}

// ─── Session Scanning ──────────────────────────────────────────────────────

function scanActiveSessions(sessionsDir) {
  const files = globFiles(sessionsDir, 'ses-*.yaml');
  const active = [];
  for (const f of files) {
    const { ok, data } = readYAMLFile(f);
    if (!ok || !data) continue;
    if (data.status === 'active') {
      active.push({
        id: data.id,
        path: f,
        started_at: data.started_at,
        last_heartbeat: data.last_heartbeat,
        claimed_items: Array.isArray(data.claimed_items) ? data.claimed_items : [],
        goals: Array.isArray(data.goals) ? data.goals : [],
        raw: data,
      });
    }
  }
  return active;
}

function readTimeoutHours(wsDir) {
  const configPath = path.join(wsDir, 'config.yaml');
  if (!fs.existsSync(configPath)) return DEFAULT_TIMEOUT_HOURS;
  const { ok, data } = readYAMLFile(configPath);
  if (!ok) return DEFAULT_TIMEOUT_HOURS;
  const val = data.session_abandon_timeout_hours;
  const num = typeof val === 'number' ? val : parseFloat(val);
  return Number.isFinite(num) && num > 0 ? num : DEFAULT_TIMEOUT_HOURS;
}

function parseHeartbeatMs(session) {
  const hb = session.last_heartbeat || session.started_at;
  if (!hb) return null;
  const t = Date.parse(hb);
  return Number.isFinite(t) ? t : null;
}

// ─── Recovery ──────────────────────────────────────────────────────────────

function recoverSession(wsDir, session, opts) {
  const { dryRun, quiet } = opts;
  const repoRoot = path.resolve(wsDir, '..', '..');

  // 1. Synthesize handoff notes from observable state.
  const handoff = synthesizeHandoff(wsDir, repoRoot, session);

  if (dryRun) {
    if (!quiet) {
      process.stdout.write(`session-recovery: [dry-run] would recover ${session.id}\n`);
      process.stdout.write(handoff.split('\n').map(l => '    ' + l).join('\n') + '\n');
    }
    return;
  }

  // 2. Release claimed_items back to backlog.
  releaseClaimedItems(wsDir, session.id, session.claimed_items);

  // 3. Update session file: status=abandoned, ended_at=now, handoff_notes=synthesized.
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const sessionContent = fs.readFileSync(session.path, 'utf8');
  const updated = updateSessionYaml(sessionContent, {
    status: 'abandoned',
    ended_at: now,
    handoff_notes: handoff,
  });
  writeFileAtomic(session.path, updated);
  emitEvent('T15:session-end', 'session-abandoned', {
    session_id: session.id,
    path: path.relative(process.cwd(), session.path).replace(/\\/g, '/'),
    reason: 'timeout',
  });

  // 4. Remove lock file.
  const lockPath = path.join(wsDir, '.active-sessions', `${session.id}.lock`);
  if (fs.existsSync(lockPath)) {
    try { fs.unlinkSync(lockPath); } catch { /* best-effort */ }
  }

  // 5. Clear .current-session if it points at this session.
  const currentPath = path.join(wsDir, '.current-session');
  if (fs.existsSync(currentPath)) {
    const current = fs.readFileSync(currentPath, 'utf8').trim();
    if (current === session.id) {
      try { fs.unlinkSync(currentPath); } catch { /* best-effort */ }
    }
  }
}

function releaseClaimedItems(wsDir, sessionId, claimedIds) {
  if (!claimedIds || claimedIds.length === 0) return;
  const queueDir = path.join(wsDir, 'queue');
  for (const id of claimedIds) {
    const itemPath = path.join(queueDir, `${id}.yaml`);
    if (!fs.existsSync(itemPath)) continue;
    const content = fs.readFileSync(itemPath, 'utf8');
    const statusMatch = content.match(/^status:\s*(\S+)/m);
    // Only release items that are still claimed by this session and not done.
    if (statusMatch && statusMatch[1] === 'claimed') {
      patchYAMLFile(itemPath, {
        status: 'backlog',
        claimed_by: '',
        claimed_at: '',
      });
    }
  }
}

function updateSessionYaml(content, patches) {
  // Patch simple scalars first.
  for (const [key, value] of Object.entries(patches)) {
    if (key === 'handoff_notes') continue; // block scalar — handled separately
    const regex = new RegExp(`^(${key}:\\s*).*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `$1${formatScalar(value)}`);
    } else {
      // Append if missing
      content = content.trimEnd() + `\n${key}: ${formatScalar(value)}\n`;
    }
  }

  // Replace or append handoff_notes block scalar.
  if ('handoff_notes' in patches) {
    const indented = patches.handoff_notes
      .split('\n')
      .map(l => l.length > 0 ? '  ' + l : l)
      .join('\n');
    const blockLiteral = `handoff_notes: |\n${indented}`;

    // Try to replace existing handoff_notes block (line up to next same-or-less-indented key)
    const blockRegex = /^handoff_notes:\s*[|>][^\n]*\n(?:(?:[ \t]+.*|)\n?)+?(?=^\S|\Z)/m;
    if (blockRegex.test(content)) {
      content = content.replace(blockRegex, blockLiteral + '\n');
    } else {
      // Single-line handoff_notes → replace with block
      const singleRegex = /^handoff_notes:\s*.*$/m;
      if (singleRegex.test(content)) {
        content = content.replace(singleRegex, blockLiteral);
      } else {
        content = content.trimEnd() + `\n${blockLiteral}\n`;
      }
    }
  }

  return content;
}

function formatScalar(value) {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'string') {
    if (value === '' || /^[\d\-+]/.test(value) || /[:#@,\[\]{}|>*&!%'"\\]/.test(value)) {
      return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return `"${value}"`;
  }
  return String(value);
}

// ─── Handoff Synthesis ─────────────────────────────────────────────────────

function synthesizeHandoff(wsDir, repoRoot, session) {
  const lines = [];
  lines.push(`Session auto-recovered by cwos-session-recovery on ${todayISO()}.`);
  lines.push(`Original start: ${session.started_at || 'unknown'}.`);
  lines.push(`Last heartbeat: ${session.last_heartbeat || 'never'}.`);
  lines.push('');

  if (session.goals && session.goals.length > 0) {
    lines.push('Original goals:');
    for (const g of session.goals) lines.push(`  - ${g}`);
    lines.push('');
  }

  // Sprints completed since session started.
  const sprints = summarizeSprintsSince(wsDir, session.started_at);
  if (sprints.length > 0) {
    lines.push(`Sprints completed during this session (${sprints.length}):`);
    for (const s of sprints) lines.push(`  - ${s.id}: ${s.title}`);
    lines.push('');
  }

  // Git commits since session started.
  const commits = gitCommitsSince(repoRoot, session.started_at);
  if (commits.length > 0) {
    lines.push(`Git commits during this session (${commits.length}):`);
    for (const c of commits.slice(0, 20)) lines.push(`  - ${c}`);
    if (commits.length > 20) lines.push(`  - ... and ${commits.length - 20} more`);
    lines.push('');
  }

  if (session.claimed_items && session.claimed_items.length > 0) {
    lines.push(`Released ${session.claimed_items.length} claimed work item(s) back to backlog.`);
    lines.push('');
  }

  lines.push('RECOVERY NOTES:');
  lines.push('  - system/state.md may be stale — next /session-start should flag it.');
  lines.push('  - Any decisions made during this session should be verified against system/decisions.md.');
  lines.push('  - Any plan docs authored may have WS items not yet promoted to the queue.');
  lines.push('    Run node kit/scripts/cwos-plan-scan.js to check.');

  return lines.join('\n');
}

function summarizeSprintsSince(wsDir, startedAt) {
  if (!startedAt) return [];
  const sprintsDir = path.join(wsDir, 'sprints');
  if (!fs.existsSync(sprintsDir)) return [];

  const startedMs = Date.parse(startedAt);
  if (!Number.isFinite(startedMs)) return [];

  const results = [];
  const dirs = [sprintsDir, path.join(sprintsDir, 'archive')];
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    const files = globFiles(d, 'SPR-*.yaml');
    for (const f of files) {
      const { ok, data } = readYAMLFile(f);
      if (!ok || !data) continue;
      if (data.status !== 'completed' && data.status !== 'abandoned') continue;
      const completedAt = data.completed_at || data.created_at;
      const completedMs = Date.parse(completedAt);
      if (Number.isFinite(completedMs) && completedMs >= startedMs) {
        results.push({ id: data.id, title: data.title || '(untitled)' });
      }
    }
  }
  return results.sort((a, b) => a.id.localeCompare(b.id));
}

function gitCommitsSince(repoRoot, startedAt) {
  if (!startedAt) return [];
  try {
    const since = startedAt.replace('T', ' ').replace('Z', '');
    const r = runGit(['log', '--since', since, '--pretty=format:%h %s', '-n', '100'], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (!r.ok) return [];
    return String(r.stdout).split('\n').map(l => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// WS-277: expose pure helpers for cwos-frame.js consumption without firing
// the CLI's main(). When require()'d as a module, main() is skipped and the
// exports below are usable. CLI behavior unchanged when invoked directly.
if (require.main === module && process.env.CWOS_SESSION_RECOVERY_NORUN !== '1') {
  try {
    process.exit(main());
  } catch (err) {
    process.stderr.write(`session-recovery: fatal — ${err.message}\n`);
    if (process.argv.includes('--verbose')) process.stderr.write(err.stack + '\n');
    process.exit(2);
  }
}

/**
 * isSessionHealthy(wsDir, [opts]) — pure check used by cwos-frame.js to
 * populate the contract's `readiness` field. Returns:
 *   { healthy: bool, stale_session_ids: [], reason: string|null }
 *
 * "Healthy" = no active session has a heartbeat older than the configured
 * timeout. If any active session is stale, returns healthy:false and lists
 * the stale ids so the caller can surface them to the founder.
 *
 * Pure read — no state mutations, no event emission, no recovery action.
 * For actual recovery, callers run `cwos-session-recovery --auto` directly.
 *
 * Replay-purity: pass `now` (ms-epoch) to override Date.now() for tests.
 */
function isSessionHealthy(wsDir, opts) {
  const now = (opts && typeof opts.now === 'number') ? opts.now : Date.now();
  const timeoutHours = readTimeoutHours(wsDir);
  const timeoutMs = timeoutHours * 60 * 60 * 1000;
  const sessionsDir = path.join(wsDir, 'sessions');
  if (!fs.existsSync(sessionsDir)) {
    return { healthy: true, stale_session_ids: [], reason: null };
  }
  const active = scanActiveSessions(sessionsDir);
  const stale = [];
  for (const s of active) {
    const hb = parseHeartbeatMs(s);
    if (hb === null) {
      // No parseable heartbeat — treat as stale (no signal == max stale)
      stale.push(s.id);
      continue;
    }
    if (now - hb > timeoutMs) stale.push(s.id);
  }
  if (stale.length === 0) {
    return { healthy: true, stale_session_ids: [], reason: null };
  }
  return {
    healthy: false,
    stale_session_ids: stale,
    reason: `${stale.length} active session(s) past ${timeoutHours}h heartbeat timeout: ${stale.join(', ')}. Run /session-end or cwos-session-recovery --auto to clear.`,
  };
}

module.exports = {
  isSessionHealthy,
  scanActiveSessions,
  readTimeoutHours,
  parseHeartbeatMs,
};
