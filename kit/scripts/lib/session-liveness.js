'use strict';
/**
 * session-liveness — one verdict on whether a session record's process is gone.
 *
 * Before this module there were three liveness checkers with three different
 * notions of "alive", and none of them looked at the one definitive signal
 * already sitting in every session record: the PID.
 *
 *   cwos-session-recovery  heartbeat age > 4h        blind to a process that
 *                                                    died ten minutes ago
 *   cwos-fleet-scan        heartbeat predates boot   blind to any death that
 *                                                    did not involve a reboot
 *   claude-sentinel.ps1    process name only         counted the Claude Desktop
 *                                                    app's Electron helpers
 *
 * Measured 2026-08-03: 18 session records claimed `status: active` while four
 * processes were alive. One corpse (HomeBase ses-20260803-2116-0a7d8844, pid
 * 11880) held WS-567/569/574/575 fenced, and nothing would have freed them for
 * up to four hours — and then only if someone happened to start a session in
 * that same repo. fleet-scan reported a dead pid 21444 as LIVE at the time.
 *
 * ── The asymmetry, which is the whole design ──────────────────────────────
 *
 * A DEAD PID IS PROOF OF DEATH. The process is gone; act immediately, no
 * timeout, no grace period. Nothing about a dead process becomes truer by
 * waiting four hours.
 *
 * A LIVE PID IS NOT PROOF OF LIFE. PIDs get reused, and this fleet demonstrably
 * reuses them: on 2026-08-03 pid 31664 held records in both ai-personal and
 * claude-poker-tracker, and pid 9124 held two records in claude-poker-tracker
 * alone. A live PID means only "not yet proven dead" — the heartbeat and boot
 * rules still have to run.
 *
 * PID CHECKS ARE VALID ONLY ON THE OWNING HOST. A record carries `host`
 * (e.g. `MorinComputer`). Asking this machine whether pid 11880 is running
 * tells you nothing about pid 11880 on CM-NODE1. A record with no `host`
 * predates the field and must NOT be assumed local: the cost of guessing wrong
 * is declaring a live remote session dead and yanking its claims out from under
 * it. Same reasoning as cwos-fleet-scan's isLocalHostRecord (WS-564).
 *
 * Heartbeat staleness is the one rule that survives a foreign host, because a
 * timestamp is wall-clock and means the same thing everywhere. Boot time does
 * not: our uptime says nothing about theirs.
 *
 * ── Consumers ─────────────────────────────────────────────────────────────
 *
 * cwos-session-recovery.js  gates recovery on the verdict instead of a timeout
 * cwos-fleet-scan.js        reports LIVE/STALE from the verdict
 * cwos-session-sweep.js     acts fleet-wide on proof, reports on suspicion
 */

const os = require('os');

const DEFAULT_TIMEOUT_HOURS = 4;

/** Proof the process is gone. Safe to act on with no timeout. */
const DEAD_PID = 'dead-pid';
/** Proof the process is gone: its heartbeat predates the machine's boot. */
const DEAD_BOOT = 'dead-boot';
/** Suspicion only. Requires the abandon timeout before anyone acts. */
const STALE_HEARTBEAT = 'stale-heartbeat';
/** No reason to think it is gone. */
const ALIVE = 'alive';
/** Not judgeable from here — foreign host, or no host recorded. Never acted on. */
const UNKNOWN = 'unknown';

/**
 * Was this record written by the machine now reading it?
 *
 * Hostless returns false deliberately. See the header: a missing `host` predates
 * the field and cannot be assumed local.
 */
function isLocalHostRecord(recordHost, assumeLocal = false) {
  if (!recordHost) return Boolean(assumeLocal);
  try {
    return String(recordHost).trim().toLowerCase() === os.hostname().trim().toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Approximate wall-clock ms of the last boot. A heartbeat written before this
 * cannot belong to a live process. os.uptime() avoids a shell-out and behaves
 * the same on Windows and POSIX.
 */
function bootTimeMs() {
  try {
    return Date.now() - os.uptime() * 1000;
  } catch {
    return null;
  }
}

/**
 * Is this PID running on THIS machine?
 *
 *   true   running (or running as another user — EPERM still proves existence)
 *   false  definitively gone (ESRCH)
 *   null   cannot tell — malformed pid, or an errno we do not recognise
 *
 * `null` rather than `false` on the unknown path is load-bearing. Returning
 * false for "we could not tell" would manufacture proof of death out of an
 * unrelated failure, and proof of death is the thing this module lets callers
 * act on without a timeout.
 *
 * signal 0 performs the permission-and-existence check without delivering a
 * signal; Node implements it on Windows too.
 */
function isPidAlive(pid) {
  const n = typeof pid === 'number' ? pid : parseInt(pid, 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  if (n === process.pid) return true;
  try {
    process.kill(n, 0);
    return true;
  } catch (err) {
    if (err && err.code === 'ESRCH') return false;
    if (err && err.code === 'EPERM') return true;
    return null;
  }
}

/**
 * Classify one session record.
 *
 * @param {object} record   session YAML data — needs status/pid/host/last_heartbeat
 * @param {object} [opts]
 * @param {number} [opts.timeoutHours]  abandon timeout, default 4
 * @param {number} [opts.nowMs]         injectable clock, for tests
 * @param {number} [opts.bootMs]        injectable boot time, for tests
 * @param {boolean} [opts.assumeLocal]  caller has independent proof this record
 *        is host-local — in practice, fleet/registry.yaml says the repo is
 *        `hosted_on` this node, and repos on this fleet are node-local disk
 *        rather than shared mounts. Upgrades a HOSTLESS record to local so
 *        older kits (which never wrote `host`) can still be judged. It can
 *        never override an explicit foreign host — a record that names another
 *        machine stays foreign no matter what the registry says.
 * @returns {{verdict:string, proof:boolean, reason:string, age_hours:number|null}}
 *          `proof` is true only when the process is provably gone.
 */
function classifySession(record, opts = {}) {
  const timeoutHours = Number.isFinite(opts.timeoutHours) && opts.timeoutHours > 0
    ? opts.timeoutHours
    : DEFAULT_TIMEOUT_HOURS;
  const nowMs = Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now();
  const bootMs = opts.bootMs === undefined ? bootTimeMs() : opts.bootMs;

  const data = record || {};
  const local = isLocalHostRecord(data.host, opts.assumeLocal);

  const hbRaw = data.last_heartbeat || data.started_at || null;
  const hbMs = hbRaw ? Date.parse(hbRaw) : NaN;
  const hbOk = Number.isFinite(hbMs);
  const ageHours = hbOk ? (nowMs - hbMs) / (60 * 60 * 1000) : null;

  const verdict = (v, reason) => ({
    verdict: v,
    proof: v === DEAD_PID || v === DEAD_BOOT,
    reason,
    age_hours: ageHours,
  });

  // ── Host-local rules: the two that can produce proof ─────────────────────
  if (local) {
    const alive = isPidAlive(data.pid);

    // Strongest signal first. A dead PID ends the question.
    if (alive === false) {
      return verdict(DEAD_PID, `pid ${data.pid} is not running on ${os.hostname()}`);
    }

    // Independent of whether the PID is alive: if the heartbeat predates boot,
    // the process that wrote it is gone. A live PID here means the OS handed
    // that number to something else — exactly the reuse the header describes.
    if (hbOk && Number.isFinite(bootMs) && hbMs < bootMs) {
      const reused = alive === true ? ` (pid ${data.pid} now belongs to another process)` : '';
      return verdict(DEAD_BOOT, `heartbeat predates last system boot${reused}`);
    }

    // PID unreadable and no boot proof — fall through to the timeout rule.
  }

  // ── Host-independent rule: wall-clock staleness ──────────────────────────
  // Applies to foreign and hostless records too. A timestamp means the same
  // thing on every machine; a PID and an uptime do not.
  if (!hbOk) {
    return local
      ? verdict(STALE_HEARTBEAT, 'no parseable heartbeat')
      : verdict(UNKNOWN, 'no parseable heartbeat, and record is not host-local');
  }
  if (ageHours > timeoutHours) {
    return verdict(STALE_HEARTBEAT, `heartbeat ${ageHours.toFixed(1)}h old (timeout ${timeoutHours}h)`);
  }

  // Fresh heartbeat. For a foreign record that is the most we can say — we
  // cannot check its PID, so "alive" would overclaim.
  if (!local) {
    return verdict(UNKNOWN, `record host ${data.host || '(unset)'} is not this machine; heartbeat is fresh`);
  }
  return verdict(ALIVE, 'pid check and heartbeat both clean');
}

module.exports = {
  classifySession,
  isPidAlive,
  isLocalHostRecord,
  bootTimeMs,
  DEFAULT_TIMEOUT_HOURS,
  ALIVE,
  DEAD_PID,
  DEAD_BOOT,
  STALE_HEARTBEAT,
  UNKNOWN,
};
