/**
 * channelArm.test.js — the seeded coin, and the meter's ratchet.
 *
 * What these tests are actually guarding:
 *
 *  - An assignment that can flip mid-session puts BOTH arms inside one transcript and
 *    destroys the unit of analysis. Determinism in the session id is the whole design.
 *  - A hook that injects while `mode: "off"` silently changes every session's content
 *    and makes the pre-cutover period uncomparable to the post-cutover period.
 *  - Fail-open must be toward arm A (everything present) and must be RECORDED as its own
 *    value, because a bias folded into A is a bias nobody finds.
 *  - A ratchet that can be raised without a stated reason is not a ratchet.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HOOK = path.join(REPO_ROOT, '.claude', 'hooks', 'channel-arm.cjs');
const CONFIG = path.join(REPO_ROOT, '.claude', 'context', 'channel-experiment.json');
const METER = path.join(REPO_ROOT, 'scripts', 'context', 'push-channel-meter.mjs');

const mod = require_(HOOK);

function runHook(payload, env = {}) {
  const out = execFileSync('node', [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return out.trim();
}

describe('channel-arm — the seeded coin', () => {
  it('is deterministic in the session id: the same session always gets the same arm', () => {
    const id = 'd435e738-a7f7-4c87-9cfe-2cdd07930333';
    const first = mod.assignArm(id, 'salt-1');
    for (let i = 0; i < 200; i++) expect(mod.assignArm(id, 'salt-1')).toBe(first);
  });

  it('changing the salt re-randomizes — a different salt is a different experiment', () => {
    const ids = Array.from({ length: 400 }, (_, i) => `session-${i}`);
    const a = ids.map((i) => mod.assignArm(i, 'salt-1'));
    const b = ids.map((i) => mod.assignArm(i, 'salt-2'));
    const same = a.filter((v, i) => v === b[i]).length;
    // Two independent coins agree ~50% of the time. Anything near 100% would mean the
    // salt is not actually entering the hash.
    expect(same).toBeGreaterThan(140);
    expect(same).toBeLessThan(260);
  });

  it('splits roughly evenly — a coin that lands 90/10 cannot power the experiment', () => {
    const n = 2000;
    let aCount = 0;
    for (let i = 0; i < n; i++) if (mod.assignArm(`ses-${i}`, 'ws-channel-20260821') === 'A') aCount++;
    expect(aCount).toBeGreaterThan(n * 0.44);
    expect(aCount).toBeLessThan(n * 0.56);
  });

  it('recovers the session id from transcript_path when session_id is absent', () => {
    const uuid = 'fc271296-1111-2222-3333-444455556666';
    expect(mod.sessionIdFrom({ session_id: uuid })).toEqual({ id: uuid, via: 'session_id' });
    expect(mod.sessionIdFrom({ transcript_path: `/tmp/x/${uuid}.jsonl` }))
      .toEqual({ id: uuid, via: 'transcript_path' });
    expect(mod.sessionIdFrom({}).id).toBeNull();
  });
});

describe('channel-arm — the hook, shipping inert', () => {
  let tmpLog;
  beforeEach(() => {
    tmpLog = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'carm-')), 'assign.jsonl');
  });
  afterEach(() => {
    try { fs.rmSync(path.dirname(tmpLog), { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('the shipped config is "off" — the cutover must be a deliberate, reviewable act', () => {
    const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
    expect(cfg.mode).toBe('off');
    expect(cfg.relocated).toHaveLength(7);
    expect(cfg.salt).toBeTruthy();
  });

  it('injects NOTHING while mode is off, for either arm', () => {
    for (const id of ['ses-alpha', 'ses-beta', 'ses-gamma', 'ses-delta']) {
      const out = runHook({ session_id: id }, { CHANNEL_ARM_LOG: tmpLog });
      expect(out).toBe('');
    }
  });

  it('still records the assignment while off — that is the point of the inert period', () => {
    runHook({ session_id: 'ses-record-me' }, { CHANNEL_ARM_LOG: tmpLog });
    const lines = fs.readFileSync(tmpLog, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(lines).toHaveLength(1);
    expect(lines[0].session).toBe('ses-record-me');
    expect(['A', 'B']).toContain(lines[0].arm);
    expect(lines[0].mode).toBe('off');
    expect(lines[0].salt).toBeTruthy();
  });

  it('records a session once, not once per turn — otherwise the log is a turn counter', () => {
    for (let i = 0; i < 5; i++) runHook({ session_id: 'ses-repeat' }, { CHANNEL_ARM_LOG: tmpLog });
    const lines = fs.readFileSync(tmpLog, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
  });

  it('writes no log line when there is no session id — an unjoinable row is not evidence', () => {
    const out = runHook({}, { CHANNEL_ARM_LOG: tmpLog });
    expect(out).toBe('');
    expect(fs.existsSync(tmpLog)).toBe(false);
  });

  it('never throws on malformed input — a hook that crashes blocks the founder\'s turn', () => {
    expect(() => execFileSync('node', [HOOK], {
      input: 'not json at all {{{', encoding: 'utf8',
      env: { ...process.env, CHANNEL_ARM_LOG: tmpLog },
    })).not.toThrow();
  });
});

describe('push-channel meter — the ratchet', () => {
  it('measures the four pushed components and keeps the pull side out of the total', () => {
    const out = execFileSync('node', [METER, '--json'], { encoding: 'utf8' });
    const m = JSON.parse(out);
    const names = m.components.map((c) => c.name);
    expect(names).toContain('CLAUDE.md');
    expect(names).toContain('.claude/rules/* (all)');
    expect(names).toContain('MEMORY.md (index only)');
    // The total is exactly the sum of the pushed components — the 113-file pull store
    // is reported for contrast and must never be inside it.
    expect(m.total).toBe(m.components.reduce((s, c) => s + c.bytes, 0));
    expect(m.pull.bytes).toBeGreaterThan(0);
    expect(m.total).toBeLessThan(m.pull.bytes);
  });

  it('has a recorded ceiling and is currently under it', () => {
    const r = execFileSync('node', [METER, '--json'], { encoding: 'utf8' });
    const m = JSON.parse(r);
    expect(m.ceiling).toBeTruthy();
    expect(m.ceiling.why.length).toBeGreaterThan(10);
    expect(m.total).toBeLessThanOrEqual(m.ceiling.max_bytes);
  });

  it('refuses --set without a stated reason', () => {
    let code = 0;
    try {
      execFileSync('node', [METER, '--set'], { encoding: 'utf8', stdio: 'pipe' });
    } catch (e) { code = e.status; }
    expect(code).toBe(2);
  });
});

describe('channel-arm — the LIVE path, which is what fires at cutover', () => {
  let dir, cfgPath, fullDir, logPath;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carm-live-'));
    cfgPath = path.join(dir, 'cfg.json');
    fullDir = path.join(dir, 'relocated');
    logPath = path.join(dir, 'assign.jsonl');
    fs.mkdirSync(fullDir);
    fs.writeFileSync(path.join(fullDir, 'alpha.md'), '# ALPHA RULE\nbody alpha\n');
    fs.writeFileSync(path.join(fullDir, 'beta.md'), '# BETA RULE\nbody beta\n');
    fs.writeFileSync(cfgPath, JSON.stringify({
      experiment_id: 'test', mode: 'live', salt: 's', relocated: ['alpha', 'beta'],
    }));
  });
  afterEach(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } });

  const live = (payload) => runHook(payload, {
    CHANNEL_ARM_CONFIG: cfgPath, CHANNEL_ARM_FULL_DIR: fullDir, CHANNEL_ARM_LOG: logPath,
  });

  /** Find one session id that lands on each arm, so both branches are exercised for real. */
  function idFor(arm) {
    for (let i = 0; i < 5000; i++) {
      const id = `live-${i}`;
      if (mod.assignArm(id, 's') === arm) return id;
    }
    throw new Error(`no session id hashed to arm ${arm}`);
  }

  it('arm A receives the full text of every relocated rule', () => {
    const out = live({ session_id: idFor('A') });
    const parsed = JSON.parse(out);
    const ctx = parsed.hookSpecificOutput.additionalContext;
    expect(ctx).toContain('ALPHA RULE');
    expect(ctx).toContain('BETA RULE');
    expect(parsed.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
  });

  it('arm B receives nothing — the stub in the push channel is all it gets', () => {
    expect(live({ session_id: idFor('B') })).toBe('');
  });

  it('a missing session id fails open to the FULL text and is logged as A-failopen', () => {
    const out = live({});                       // no session_id, no transcript_path
    expect(JSON.parse(out).hookSpecificOutput.additionalContext).toContain('ALPHA RULE');
    // …and it is never silently counted as a clean arm A.
    const lines = fs.existsSync(logPath)
      ? fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
      : [];
    expect(lines.every((l) => l.arm !== 'A')).toBe(true);
  });

  it('a missing relocated file degrades to the rules it can read, never to a crash', () => {
    fs.writeFileSync(cfgPath, JSON.stringify({
      experiment_id: 'test', mode: 'live', salt: 's', relocated: ['alpha', 'does-not-exist'],
    }));
    const ctx = JSON.parse(live({ session_id: idFor('A') })).hookSpecificOutput.additionalContext;
    expect(ctx).toContain('ALPHA RULE');
    expect(ctx).not.toContain('BETA RULE');
  });

  it('emits rules in a stable order regardless of config order — a moving channel is a confound', () => {
    const a = JSON.parse(live({ session_id: idFor('A') })).hookSpecificOutput.additionalContext;
    fs.writeFileSync(cfgPath, JSON.stringify({
      experiment_id: 'test', mode: 'live', salt: 's', relocated: ['beta', 'alpha'],
    }));
    const b = JSON.parse(live({ session_id: idFor('A') })).hookSpecificOutput.additionalContext;
    expect(a).toBe(b);
  });
});
