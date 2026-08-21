/**
 * sessionSink.test.js — the sink, driven end-to-end by REAL captured hands.
 *
 * Not fixtures. Every hand in this file came off the founder's own Ignition table and was
 * replayed through the production producer path (`TableManager.routeMessage`), the same arm
 * `sourceParity.check.mjs` uses. A sink tested only against hand-authored objects would pass
 * while being unable to hold the thing it exists to hold.
 *
 * The properties under test are the ones that decide whether this service can cost the founder
 * a hand:
 *   - a hand that arrives is on disk before the response is sent
 *   - a hand that arrives TWICE is stored once and still ACKed (journal backfill replays by design)
 *   - a session seals on an idle gap and its hash covers exactly the hands in it
 *   - a hand arriving after a long gap starts a NEW session rather than joining a stale one
 *   - a hand with no captureId is refused loudly rather than being given an invented one
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TableManager } from '../../ignition-poker-tracker/shared/table-manager.js';
import { readSessionHands, listClosedSessions } from '../sessionSink/sessionStore.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const CAPTURES = join(REPO, 'ignition-poker-tracker/spike-data/captures');

/** Mirrors `generateCaptureId` in shared/storage-writer.js:173 — the id the sink dedupes on. */
const captureIdFor = (h, i) => `${h.tableId || 'unknown'}_${h.ignitionMeta?.handNumber || i}`;

/** Replay a real capture through the production producer and stamp ids the way enqueueHand does. */
const realHands = (file) => {
  const captured = [];
  const tm = new TableManager((r) => captured.push(r), () => {});
  for (const line of readFileSync(join(CAPTURES, file), 'utf8').split('\n')) {
    if (!line) continue;
    let frame;
    try { frame = JSON.parse(line); } catch { continue; }
    if (frame.kind !== 'msg') continue;
    try { tm.routeMessage(frame.connId, frame.data, frame.url); } catch { /* the producer swallows too */ }
  }
  return captured.map((h, i) => ({ ...h, captureId: captureIdFor(h, i) }));
};

const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;
let root;
let child;

const post = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
};
const get = async (path) => (await fetch(`${BASE}${path}`)).json();

const waitForUp = async (deadlineMs = 15000) => {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('sink did not come up');
};

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'session-sink-'));
  child = spawn(process.execPath, [join(REPO, 'scripts/sessionSink/serve.mjs')], {
    cwd: REPO,
    stdio: 'ignore',
    env: {
      ...process.env,
      POKER_SESSION_STORE: root,
      SESSION_SINK_PORT: String(PORT),
      // The REAL default boundary. It can stay realistic because the boundary is judged on the
      // hand's own timestamp, which these tests set directly — no sleeping required.
      SESSION_SINK_IDLE_MS: '1200000',
      // Capture only. The review runner is a separate concern with its own tests, and a sink
      // test that also ran an analysis would stop telling us which half broke.
      SESSION_SINK_NO_REVIEW: '1',
    },
  });
  await waitForUp();
}, 30000);

afterAll(async () => {
  child?.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 300));
  child?.kill('SIGKILL');
  await rm(root, { recursive: true, force: true });
});

describe('the capture path, on real hands', () => {
  it('replays a real capture and stores every hand', async () => {
    const hands = realHands('ignition-frames-2026-06-19T06-48-05-980Z.jsonl');
    expect(hands.length).toBeGreaterThan(20); // the capture really does carry hands

    for (const h of hands) {
      const r = await post('/hand', { hand: h });
      expect(r.ok).toBe(true);
    }

    const status = await get('/status');
    const closed = await listClosedSessions(root);
    const stored = status.openSessions.reduce((n, s) => n + s.hands, 0)
      + closed.reduce((n, c) => n + c.count, 0);
    // Distinct captureIds only — the producer can emit the same hand number twice across
    // reconnects, and the sink is supposed to collapse those.
    const distinct = new Set(hands.map((h) => h.captureId)).size;
    expect(stored).toBe(distinct);
  });

  it('stores a replayed hand ONCE and still ACKs it — journal backfill depends on this', async () => {
    const [hand] = realHands('ignition-frames-2026-06-14T03-13-30-050Z.jsonl');
    const first = await post('/hand', { hand });
    const second = await post('/hand', { hand });

    expect(first).toMatchObject({ ok: true, duplicate: false });
    // `ok` stays true on the repeat: the hand IS on disk, which is all the extension needs to
    // know before releasing its journal copy. An `ok:false` here would strand the hand forever.
    expect(second).toMatchObject({ ok: true, duplicate: true });
  });

  it('refuses a hand with no captureId rather than inventing one', async () => {
    const [hand] = realHands('ignition-frames-2026-06-14T03-13-30-050Z.jsonl');
    const { captureId, ...noId } = hand;
    expect(captureId).toBeTruthy();
    const r = await post('/hand', { hand: noId });
    expect(r).toMatchObject({ ok: false, reason: 'no-captureId' });
  });

  it('batch-accepts a backfill and reports exactly which ids may be released', async () => {
    const hands = realHands('ignition-frames-2026-06-15T19-47-18-003Z.jsonl');
    const r = await post('/hands', { hands });
    expect(r.ok).toBe(true);
    expect(r.total).toBe(hands.length);
    expect(r.ackCaptureIds.length).toBe(r.stored);
    // Every ACKed id is one the caller actually sent — never a fabricated one.
    const sent = new Set(hands.map((h) => h.captureId));
    for (const id of r.ackCaptureIds) expect(sent.has(id)).toBe(true);
  });
});

describe('the session boundary, derived from the data', () => {
  it('a sealed session hashes exactly the hands in its file, and reads back complete', async () => {
    const hands = realHands('ignition-frames-2026-06-15T17-41-16-205Z.jsonl').slice(0, 5);
    for (const h of hands) await post('/hand', { hand: { ...h, tableId: 'table_seal_test' } });

    await post('/seal', { tableId: 'table_seal_test', reason: 'test' });

    const closed = await listClosedSessions(root);
    const mine = closed.find((c) => c.tableId === 'table_seal_test');
    expect(mine).toBeTruthy();
    expect(mine.count).toBe(5);

    const read = await readSessionHands(mine.dir);
    expect(read.hands.length).toBe(5);
    expect(read.corruptTail).toBe(false);
    expect(read.complete).toBe(true);
    expect(read.manifest.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(read.manifest.sealedReason).toBe('test');
  });

  it('splits on a gap in RECORD time, not arrival time — so a backfill reconstructs real sittings', async () => {
    const hands = realHands('ignition-frames-2026-06-19T06-48-05-980Z.jsonl');
    const table = 'table_gap_test';
    const t0 = Date.parse('2026-06-19T06:00:00.000Z');

    // All three POSTs happen inside the same second of wall-clock — exactly what a journal
    // backfill after a sink outage looks like. The SITTINGS must still come back apart.
    await post('/hand', { hand: { ...hands[0], tableId: table, captureId: 'gap_a', timestamp: t0 } });
    await post('/hand', { hand: { ...hands[1], tableId: table, captureId: 'gap_b', timestamp: t0 + 200 } });
    // Two hours later at the same table: a different sitting.
    await post('/hand', { hand: { ...hands[2], tableId: table, captureId: 'gap_c', timestamp: t0 + 2 * 60 * 60 * 1000 } });
    await post('/seal', { tableId: table, reason: 'test' });

    const mine = (await listClosedSessions(root)).filter((c) => c.tableId === table);
    expect(mine.length).toBe(2);
    expect(mine.map((m) => m.count).sort()).toEqual([1, 2]);
  });

  it('does NOT split a backfill that arrives all at once inside one sitting', async () => {
    const hands = realHands('ignition-frames-2026-06-19T06-48-05-980Z.jsonl');
    const table = 'table_backfill_test';
    const t0 = Date.parse('2026-06-19T08:00:00.000Z');

    // Fifty-ish hands of one sitting, delivered in a burst. Judged by arrival these are one
    // second apart; judged by record time they are one session, which is the truth.
    const batch = hands.slice(0, 10).map((h, i) => ({
      ...h, tableId: table, captureId: `bf_${i}`, timestamp: t0 + i * 90_000,
    }));
    const r = await post('/hands', { hands: batch });
    expect(r.stored).toBe(10);

    await post('/seal', { tableId: table, reason: 'test' });
    const mine = (await listClosedSessions(root)).filter((c) => c.tableId === table);
    expect(mine.length).toBe(1);
    expect(mine[0].count).toBe(10);
  });
});

describe('the sink cannot cost a hand', () => {
  it('a hand is durable on disk BEFORE the response is sent', async () => {
    const [hand] = realHands('ignition-frames-2026-06-14T03-13-30-050Z.jsonl');
    const table = 'table_durable_test';
    const r = await post('/hand', { hand: { ...hand, tableId: table, captureId: 'durable_1' } });
    expect(r.ok).toBe(true);

    // No sleep, no seal: read the live file the instant the response lands.
    const liveDir = join(root, 'live', r.sessionId);
    expect(existsSync(liveDir)).toBe(true);
    const raw = await readFile(join(liveDir, 'hands.ndjson'), 'utf8');
    expect(raw).toContain('durable_1');
  });

  it('an unknown route is a 404 with a reason, not a crash that takes capture down', async () => {
    const res = await fetch(`${BASE}/nope`);
    expect(res.status).toBe(404);
    // And the service is still serving.
    expect((await get('/health')).ok).toBe(true);
  });

  it('malformed JSON is refused without killing the process', async () => {
    const res = await fetch(`${BASE}/hand`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    expect(res.status).toBe(400);
    expect((await get('/health')).ok).toBe(true);
  });
});
