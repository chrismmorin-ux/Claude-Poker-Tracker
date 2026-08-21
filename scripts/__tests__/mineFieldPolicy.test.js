/**
 * mineFieldPolicy.test.js — the field policy, and the leakage it must refuse.
 *
 * This is the artefact that removes the session review's biggest refusal: without a measured
 * model of the field the founder actually plays, Pool Best Response has nothing to be a best
 * response TO, and the only alternative is a 2009 corpus level reported about a live modern
 * table — the top-ranked entry in the Suspected-Fault Register.
 *
 * The property that matters most here is not that it produces a table. It is that a table
 * mined from session N can never be used to price session N. That is the model reading its own
 * homework, and unlike ordinary noise it gets WORSE with more data. So the hold-out is checked
 * from the artifact's own provenance stamp, and these tests drive both sides of the check.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TableManager } from '../../ignition-poker-tracker/shared/table-manager.js';
import { openSession } from '../sessionSink/sessionStore.mjs';
import { mineFieldPolicy, MIN_FIELD_OBSERVATIONS } from '../sessionSink/mineFieldPolicy.mjs';
import { reviewSession } from '../villainArchetype/reviewSession.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const CAPTURES = join(REPO, 'ignition-poker-tracker/spike-data/captures');

let root;
let sessionId;
let sessionDir;

const seed = async (file, tableId, startIso) => {
  const captured = [];
  const tm = new TableManager((r) => captured.push(r), () => {});
  for (const line of readFileSync(join(CAPTURES, file), 'utf8').split('\n')) {
    if (!line) continue;
    let f;
    try { f = JSON.parse(line); } catch { continue; }
    if (f.kind !== 'msg') continue;
    try { tm.routeMessage(f.connId, f.data, f.url); } catch { /* producer swallows too */ }
  }
  const t0 = Date.parse(startIso);
  const s = await openSession({ tableId, startedAt: new Date(t0).toISOString(), root });
  let i = 0;
  for (const h of captured) {
    await s.accept({ ...h, captureId: `${tableId}_${h.ignitionMeta?.handNumber ?? i}` }, t0 + (i++) * 60_000);
  }
  return s.seal({ reason: 'test' });
};

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'field-policy-'));
  const m = await seed('ignition-frames-2026-06-19T06-48-05-980Z.jsonl', 'table_a', '2026-06-19T06:00:00Z');
  sessionId = m.setId;
  sessionDir = m.dir;
  await seed('ignition-frames-2026-06-15T17-41-16-205Z.jsonl', 'table_b', '2026-06-15T17:00:00Z');
}, 180_000);

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('mining a field policy from real sessions', () => {
  it('produces observations from real opponent decisions, not zero', async () => {
    // REGRESSION: the first cut passed a session-scoped subject key as the playerId, but
    // `accumulateDecisions` resolves a player by matching that id against the VALUES in
    // seatPlayers. Nothing matched, nothing threw, and every session mined exactly 0
    // decisions — a miner that would have refused forever while looking healthy.
    const r = await mineFieldPolicy({ root, minObservations: 1 });
    expect(r.refused).toBe(false);
    expect(r.observations).toBeGreaterThan(50);
    expect(r.failures.profile).toBe(0);
    expect(r.failures.accumulate).toBe(0);
  }, 120_000);

  it('builds a real policy table with verifiable provenance', async () => {
    const r = await mineFieldPolicy({ root, minObservations: 1 });
    expect(r.table.levels.length).toBeGreaterThan(1);
    expect(r.table.provenance.source).toBe('ignition-sessions');
    // The hold-out must be READABLE off the artifact — that is what makes it checkable
    // rather than a promise from whoever ran the miner.
    expect(Array.isArray(r.table.provenance.contributingSessions)).toBe(true);
    expect(r.table.provenance.contributingSessions.length).toBeGreaterThan(0);
  }, 120_000);

  it('records which sessions were excluded, so the hold-out is auditable', async () => {
    const r = await mineFieldPolicy({ root, exclude: [sessionId], minObservations: 1 });
    expect(r.refused).toBe(false);
    expect(r.table.provenance.contributingSessions).not.toContain(sessionId);
    expect(r.table.provenance.excludedSessions).toContain(sessionId);
  }, 120_000);
});

describe('refusing rather than emitting a table that is mostly its own prior', () => {
  it('refuses below the observation floor and states the shortfall in the OBSERVED rate', async () => {
    const r = await mineFieldPolicy({ root });
    expect(r.refused).toBe(true);
    expect(r.reason).toBe('unexamined:insufficient-n');
    expect(r.observations).toBeLessThan(MIN_FIELD_OBSERVATIONS);
    // "at this rate" has to mean this rate — a hardcoded divisor would put a number in the
    // refusal that its own data contradicts.
    expect(r.observationsPerSession).toBeGreaterThan(0);
    expect(r.resolvedBy).toMatch(/observed rate/);
  }, 120_000);

  it('refuses when every session on disk is the one being held out', async () => {
    const all = (await mineFieldPolicy({ root, minObservations: 1 })).table.provenance.contributingSessions;
    const r = await mineFieldPolicy({ root, exclude: all, minObservations: 1 });
    expect(r.refused).toBe(true);
    expect(r.reason).toBe('unexamined:no-sessions');
  }, 120_000);
});

describe('the leakage guard in the review runner', () => {
  it('REFUSES a policy mined from the session it is about to price', async () => {
    const leaky = await mineFieldPolicy({ root, minObservations: 1 });
    const path = join(root, 'leaky-policy.json');
    await writeFile(path, JSON.stringify(leaky.table), 'utf8');

    const out = await reviewSession({ sessionDir, fieldPolicyPath: path, now: () => 'T' });
    expect(out.review.money.reason).toBe('refused:leakage');
    // The remediation is a runnable command, not "be careful".
    expect(out.review.money.resolvedBy).toContain('--exclude');
    expect(out.review.money.resolvedBy).toContain(sessionId);
  }, 180_000);

  it('accepts a policy that demonstrably holds this session out', async () => {
    const held = await mineFieldPolicy({ root, exclude: [sessionId], minObservations: 1 });
    const path = join(root, 'held-policy.json');
    await writeFile(path, JSON.stringify(held.table), 'utf8');

    const out = await reviewSession({ sessionDir, fieldPolicyPath: path, now: () => 'T' });
    // Not priced yet — the per-decision PBR evaluation is the remaining stage — but the
    // hold-out passed, which is the gate under test.
    expect(out.review.money.reason).toBe('unexamined:pbr-evaluation-not-wired');
    expect(out.review.money.holdOut.verified).toBe(true);
    expect(out.review.money.holdOut.contributingSessions).not.toContain(sessionId);
  }, 180_000);

  it('refuses an unstamped policy rather than assuming it was held out', async () => {
    const path = join(root, 'unstamped.json');
    await writeFile(path, JSON.stringify({ provenance: {}, levels: [] }), 'utf8');

    const out = await reviewSession({ sessionDir, fieldPolicyPath: path, now: () => 'T' });
    expect(out.review.money.reason).toBe('unexamined:field-policy-unstamped');
  }, 180_000);

  it('refuses an unreadable policy rather than falling back to the corpus', async () => {
    const out = await reviewSession({
      sessionDir,
      fieldPolicyPath: join(root, 'does-not-exist.json'),
      now: () => 'T',
    });
    // A missing file must land on the no-field-policy refusal, never silently on the 2009 corpus.
    expect(out.review.money.reason).toBe('unexamined:no-field-policy');
    expect(out.review.money.arms.corpus.usable).toBe(false);
  }, 180_000);
});
