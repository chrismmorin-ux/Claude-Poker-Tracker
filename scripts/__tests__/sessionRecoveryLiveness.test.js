/**
 * sessionRecoveryLiveness.test.js — WS-351. Abandonment is decided from the OS, not the clock.
 *
 * ── THE INCIDENT THIS PINS ────────────────────────────────────────────────────────────
 * MorinComputer hard-hung 2026-08-03 at 11:55:50 and was power-cycled. One recovery run
 * afterwards got the answer wrong in BOTH directions at once:
 *
 *   ses-20260803-1713-5167c910  registered 40s after the reboot, pid 21920 already gone,
 *                               heartbeat ~12 min old, timeout 4h  → reported as ACTIVE,
 *                               and the SessionStart hook then told the next session to
 *                               coordinate with a process that did not exist.
 *   --force                     the documented escape hatch for exactly that case → would
 *                               have marked the LIVE session running the command abandoned,
 *                               released its claims, and deleted .current-session under it.
 *
 * Both readings come from the same line: `if (force || ageMs > timeoutMs)`. The record has
 * carried `pid` since WS-533 and nothing read it.
 *
 * ── WHY THE FIXTURES LOOK LIKE THIS ───────────────────────────────────────────────────
 * Liveness is a question about THIS machine, so the tests use real pids rather than a stub:
 * `process.pid` for alive, and the pid of a node process that has already exited for dead.
 * A stubbed probe would have passed against the pre-WS-351 code too, since the bug was that
 * the probe was never called.
 *
 * Boot time is likewise real — every "post-boot" timestamp is derived from `os.uptime()`
 * rather than hardcoded, because the pre-boot death proof is the one rule that must not be
 * satisfiable by accident on a machine that happens to have been up for a long time.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const RECOVERY = path.resolve(process.cwd(), 'kit/scripts/cwos-session-recovery.js');
const REGISTER = path.resolve(process.cwd(), 'kit/scripts/cwos-session-register.js');
const EVENT = path.resolve(process.cwd(), 'kit/scripts/cwos-event.js');

const HOST = os.hostname();
const BOOT_MS = Date.now() - os.uptime() * 1000;

const iso = (ms) => new Date(ms).toISOString();
const ago = (ms) => iso(Date.now() - ms);
/** Just after the current boot — so the recorded pid cannot be a post-reboot recycle. */
const POST_BOOT = iso(BOOT_MS + 1000);
const PRE_BOOT = iso(BOOT_MS - 60_000);

/** A pid that is certainly not running: a node process we watched exit. */
const DEAD_PID = spawnSync(process.execPath, ['-e', ''], { stdio: 'ignore' }).pid;
const LIVE_PID = process.pid;

let ROOT;
let seq = 0;

beforeAll(() => { ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'wsrecovery-')); });
afterAll(() => { try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch { /* temp */ } });

function mkRepo() {
  const repo = path.join(ROOT, `r${seq++}`);
  const ws = path.join(repo, '.claude', 'workstream');
  fs.mkdirSync(path.join(ws, 'sessions'), { recursive: true });
  fs.mkdirSync(path.join(ws, 'events'), { recursive: true });
  fs.mkdirSync(path.join(ws, 'queue'), { recursive: true });
  fs.writeFileSync(path.join(ws, 'config.yaml'), 'session_abandon_timeout_hours: 4\n');
  return { repo, ws };
}

function session(ws, {
  id, status = 'active', started = POST_BOOT, heartbeat, pid, pidAt = POST_BOOT,
  host = HOST, items = [],
}) {
  const lines = [
    `id: "${id}"`,
    `status: ${status}`,
    `started_at: "${started}"`,
    'ended_at: null',
    'mode: auto',
    `last_heartbeat: "${heartbeat}"`,
  ];
  if (pid !== undefined) lines.push(`pid: ${pid}`);
  if (pidAt !== null && pid !== undefined) lines.push(`pid_recorded_at: "${pidAt}"`);
  if (host !== null) lines.push(`host: "${host}"`);
  lines.push(`agent_session_id: "agent-${id}"`);
  lines.push(items.length ? 'claimed_items:' : 'claimed_items: []');
  for (const i of items) lines.push(`  - "${i}"`);
  lines.push('files_locked: []');
  fs.writeFileSync(path.join(ws, 'sessions', `${id}.yaml`), lines.join('\n') + '\n');
}

function item(ws, id, claimedBy) {
  fs.writeFileSync(
    path.join(ws, 'queue', `${id}.yaml`),
    [`id: "${id}"`, 'status: backlog', `claimed_by: "${claimedBy}"`, 'claimed_at: "2026-08-03T17:00:00Z"'].join('\n') + '\n',
  );
}

function run(script, { repo, ws }, args, input = '') {
  const r = spawnSync(process.execPath, [script, '--workstream-dir', ws, ...args], {
    cwd: repo, encoding: 'utf8', input,
    env: { ...process.env, CWOS_SKIP_RENDER: '1' },
  });
  return { status: r.status, out: r.stdout || '', err: r.stderr || '' };
}

const statusOf = (ws, id) => {
  const raw = fs.readFileSync(path.join(ws, 'sessions', `${id}.yaml`), 'utf8');
  return (raw.match(/^status:\s*"?([^"\n]+)"?/m) || [])[1];
};

// ─────────────────────────────────────────────────────────────────────────────────────

describe('cwos-session-recovery — a dead process is proof, and does not wait for the clock', () => {
  test('a dead-pid session on this host is recovered by --auto inside the timeout', () => {
    // The exact ses-20260803-1713-5167c910 shape: 12 minutes stale against a 4h timeout.
    // Pre-WS-351 this printed "no sessions abandoned" and left the record active.
    const r = mkRepo();
    session(r.ws, { id: 'ses-dead', heartbeat: ago(12 * 60_000), pid: DEAD_PID });

    const out = run(RECOVERY, r, ['--auto']);
    expect(out.status).toBe(0);
    expect(statusOf(r.ws, 'ses-dead')).toBe('abandoned');
  });

  test('recovery hands the dead session\'s claims back to the queue', () => {
    // The whole point of recovery: a crash must not fence the queue for the timeout window.
    const r = mkRepo();
    session(r.ws, { id: 'ses-dead', heartbeat: ago(12 * 60_000), pid: DEAD_PID, items: ['WS-999'] });
    item(r.ws, 'WS-999', 'ses-dead');

    run(RECOVERY, r, ['--auto']);
    const q = fs.readFileSync(path.join(r.ws, 'queue', 'WS-999.yaml'), 'utf8');
    expect(q).toMatch(/^claimed_by:\s*""\s*$/m);
  });

  test('the report names the evidence, not a misleading staleness figure', () => {
    const r = mkRepo();
    session(r.ws, { id: 'ses-dead', heartbeat: ago(12 * 60_000), pid: DEAD_PID });

    const out = run(RECOVERY, r, []);
    expect(out.status).toBe(1);
    expect(out.out).toMatch(/ses-dead \(process \d+ is gone\)/);
  });

  test('the abandonment event records WHY — dead-process, not timeout', () => {
    const r = mkRepo();
    session(r.ws, { id: 'ses-dead', heartbeat: ago(12 * 60_000), pid: DEAD_PID });

    run(RECOVERY, r, ['--auto']);
    const log = fs.readFileSync(path.join(r.ws, 'events', 'current.jsonl'), 'utf8');
    const ev = log.trim().split('\n').map(JSON.parse).find((e) => e.track_tag === 'session-abandoned');
    expect(ev.payload.reason).toBe('dead-process');
  });
});

describe('cwos-session-recovery — a live process is a veto, including under --force', () => {
  test('running recovery from inside a live session cannot abandon that session', () => {
    // The false positive. --force is the documented fix for the false negative above, and
    // recovery is always invoked FROM a session — so a --force that sweeps live sessions
    // means the only offered remedy is unsafe whenever anyone is at the keyboard.
    const r = mkRepo();
    session(r.ws, { id: 'ses-live', heartbeat: ago(30_000), pid: LIVE_PID, items: ['WS-777'] });
    item(r.ws, 'WS-777', 'ses-live');

    const out = run(RECOVERY, r, ['--auto', '--force']);
    expect(out.status).toBe(0);
    expect(statusOf(r.ws, 'ses-live')).toBe('active');
    expect(fs.readFileSync(path.join(r.ws, 'queue', 'WS-777.yaml'), 'utf8')).toMatch(/claimed_by: "ses-live"/);
  });

  test('--force still closes a session whose process cannot be vouched for', () => {
    // The flag must keep doing its job, or the fix has just removed the escape hatch.
    const r = mkRepo();
    session(r.ws, { id: 'ses-nopid', heartbeat: ago(30_000), pid: undefined });

    run(RECOVERY, r, ['--auto', '--force']);
    expect(statusOf(r.ws, 'ses-nopid')).toBe('abandoned');
  });
});

describe('cwos-session-recovery — pid reuse across a reboot cannot resurrect a session', () => {
  test('a pid recorded before the current boot reads dead even though that pid is alive now', () => {
    // LIVE_PID is genuinely running. Recorded pre-boot it can only be a recycled number,
    // so the process it named is gone regardless of what the process table says today.
    const r = mkRepo();
    session(r.ws, { id: 'ses-recycled', started: PRE_BOOT, pidAt: PRE_BOOT, heartbeat: ago(60_000), pid: LIVE_PID });

    run(RECOVERY, r, ['--auto']);
    expect(statusOf(r.ws, 'ses-recycled')).toBe('abandoned');
  });

  test('an undated pid on a pre-boot record is condemned by started_at', () => {
    // Every record written before WS-351 carries a pid and no date for it. started_at is
    // when both writers stamped the pid, so it is the correct stand-in.
    const r = mkRepo();
    session(r.ws, { id: 'ses-legacy', started: PRE_BOOT, pidAt: null, heartbeat: ago(60_000), pid: LIVE_PID });

    run(RECOVERY, r, ['--auto']);
    expect(statusOf(r.ws, 'ses-legacy')).toBe('abandoned');
  });

  test('a session resumed since the boot is NOT condemned by its pre-boot start', () => {
    // SessionStart re-fires on resume and re-asserts the pid; started_at stays where it
    // was. Reading start-before-boot as fatal here would sweep a session mid-work — the
    // same false positive, moved one rule along.
    const r = mkRepo();
    session(r.ws, { id: 'ses-resumed', started: PRE_BOOT, pidAt: POST_BOOT, heartbeat: ago(30_000), pid: LIVE_PID });

    run(RECOVERY, r, ['--auto', '--force']);
    expect(statusOf(r.ws, 'ses-resumed')).toBe('active');
  });
});

describe('cwos-session-recovery — a pid is only meaningful on the machine that issued it', () => {
  test('a foreign-host record falls back to heartbeat age and survives a dead local pid', () => {
    // sessions/ is a TRACKED directory: records arrive from CM-NODE1 by git pull. Pid
    // 4242 there is something else entirely here, and reading it locally is how WS-564
    // stole claims from a machine that was still working.
    const r = mkRepo();
    session(r.ws, { id: 'ses-remote', heartbeat: ago(12 * 60_000), pid: DEAD_PID, host: 'CM-NODE1' });

    run(RECOVERY, r, ['--auto']);
    expect(statusOf(r.ws, 'ses-remote')).toBe('active');
  });

  test('a foreign-host record is still recovered once its heartbeat exceeds the timeout', () => {
    const r = mkRepo();
    session(r.ws, { id: 'ses-remote-old', heartbeat: ago(5 * 60 * 60_000), pid: DEAD_PID, host: 'CM-NODE1' });

    run(RECOVERY, r, ['--auto']);
    expect(statusOf(r.ws, 'ses-remote-old')).toBe('abandoned');
  });

  test('a record with no host at all is treated as foreign, not as local', () => {
    const r = mkRepo();
    session(r.ws, { id: 'ses-nohost', heartbeat: ago(12 * 60_000), pid: DEAD_PID, host: null });

    run(RECOVERY, r, ['--auto']);
    expect(statusOf(r.ws, 'ses-nohost')).toBe('active');
  });
});

describe('cwos-session-recovery — the 2026-08-03 run, reproduced', () => {
  test('exactly the dead session is recovered and the live one is untouched', () => {
    const r = mkRepo();
    session(r.ws, { id: 'ses-20260803-1713-5167c910', heartbeat: ago(12 * 60_000), pid: DEAD_PID });
    session(r.ws, { id: 'ses-20260803-1714-5b348fc1', heartbeat: ago(6 * 60_000), pid: LIVE_PID });

    const out = run(RECOVERY, r, ['--auto']);
    expect(out.status).toBe(0);
    expect(statusOf(r.ws, 'ses-20260803-1713-5167c910')).toBe('abandoned');
    expect(statusOf(r.ws, 'ses-20260803-1714-5b348fc1')).toBe('active');
  });

  test('and --force on that same state still cannot touch the live one', () => {
    const r = mkRepo();
    session(r.ws, { id: 'ses-20260803-1713-5167c910', heartbeat: ago(12 * 60_000), pid: DEAD_PID });
    session(r.ws, { id: 'ses-20260803-1714-5b348fc1', heartbeat: ago(6 * 60_000), pid: LIVE_PID });

    run(RECOVERY, r, ['--auto', '--force']);
    expect(statusOf(r.ws, 'ses-20260803-1714-5b348fc1')).toBe('active');
  });
});

describe('cwos-session-register — the "N other session(s) live" warning', () => {
  test('stops citing a session whose process is gone', () => {
    const r = mkRepo();
    session(r.ws, { id: 'ses-dead', heartbeat: ago(12 * 60_000), pid: DEAD_PID });

    const out = run(REGISTER, r, ['--no-register', '--json']);
    const json = JSON.parse(out.out.trim());
    expect(json.others.map((o) => o.id)).not.toContain('ses-dead');
  });

  test('still cites a live peer — the warning must not go silent', () => {
    const r = mkRepo();
    session(r.ws, { id: 'ses-live', heartbeat: ago(30_000), pid: LIVE_PID });

    const out = run(REGISTER, r, ['--no-register', '--json']);
    const json = JSON.parse(out.out.trim());
    expect(json.others.map((o) => o.id)).toContain('ses-live');
  });

  test('registration dates the pid it records, so the next boot can judge it', () => {
    const r = mkRepo();
    run(REGISTER, r, ['--session-id', 'agent-fresh', '--quiet']);
    const file = fs.readdirSync(path.join(r.ws, 'sessions'))[0];
    const raw = fs.readFileSync(path.join(r.ws, 'sessions', file), 'utf8');
    expect(raw).toMatch(/^pid: \d+$/m);
    expect(raw).toMatch(/^pid_recorded_at: "\d{4}-\d{2}-\d{2}T/m);
  });

  test('a re-fire re-asserts pid AND its date onto a record that lacks the field', () => {
    // patchYAMLFile alone drops a key the record does not already carry (WS-561), which
    // would leave every pre-WS-351 record permanently undated.
    const r = mkRepo();
    session(r.ws, { id: 'ses-old', heartbeat: ago(60_000), pid: 4242, pidAt: null });
    run(REGISTER, r, ['--session-id', 'agent-ses-old', '--quiet']);

    const raw = fs.readFileSync(path.join(r.ws, 'sessions', 'ses-old.yaml'), 'utf8');
    expect(raw).toMatch(/^pid_recorded_at: "\d{4}-\d{2}-\d{2}T/m);
    expect(raw).not.toMatch(/^pid: 4242$/m);
  });
});

describe('cwos-event — the session-abandoned event is emittable from the CLI', () => {
  test('append reproduces the payload the recovery script emits internally', () => {
    // WS-351 was filed believing this path rejected the event and that the cleanup had to
    // go through makeEventEmitter() by hand. It does not: T15:session-end has no schema
    // lookup, and the positional simply lands in payload.type.
    const r = mkRepo();
    const e = spawnSync(process.execPath, [
      EVENT, 'append', 'session-abandoned',
      '--track', 'T15:session-end', '--tag', 'session-abandoned',
      '--payload', JSON.stringify({ session_id: 'ses-x', path: 'p', reason: 'dead-process' }),
    ], { cwd: r.repo, encoding: 'utf8', env: { ...process.env, CWOS_SKIP_RENDER: '1' } });

    expect(e.stderr || '').not.toMatch(/validation failed/);
    const log = fs.readFileSync(path.join(r.ws, 'events', 'current.jsonl'), 'utf8');
    const ev = log.trim().split('\n').map(JSON.parse).pop();
    expect(ev.source_track).toBe('T15:session-end');
    expect(ev.track_tag).toBe('session-abandoned');
    expect(ev.payload.reason).toBe('dead-process');
  });
});
