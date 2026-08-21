/**
 * backfillFromCapture — the two things that were actually wrong before this test existed.
 *
 * Both were caught by a `--dry-run` against the real captures, not by reasoning, and both
 * would have written a plausible-looking store full of false facts:
 *
 *   1. THE CLOCK. `record-builder` stamps `timestamp` with `Date.now()` at BUILD time, so a
 *      replay dated all thirteen sessions to the replay minute — four months late — and every
 *      time-keyed reading downstream would have been anchored to it.
 *   2. THE IDENTITY. `captureId` is stamped by `enqueueHand`, which a backfill never calls, so
 *      every hand arrived without the store's dedupe key and NOTHING was written at all.
 *
 * The third case is the one that has no symptom until it is too late: `generateCaptureId`
 * falls back to `Date.now()` when `handNumber` is missing, which would make a re-run write the
 * same hand again under a fresh identity, forever.
 */
import { describe, it, expect } from 'vitest';
import { splitIntoSessions } from '../sessionSink/backfillFromCapture.mjs';
import { DEFAULT_IDLE_MS } from '../sessionSink/sessionStore.mjs';

const hand = (tableId, t, captureId = `${tableId}_${t}`) => ({
  captureId,
  tableId,
  timestamp: t,
  ignitionMeta: { handNumber: String(t) },
  gameState: { mySeat: 2 },
});

const T0 = Date.parse('2026-06-19T03:01:04.599Z');

describe('splitIntoSessions', () => {
  it('keeps hands at one table inside one session while the gap stays under idle', () => {
    const { sessions } = splitIntoSessions([
      hand('t1', T0),
      hand('t1', T0 + 60_000),
      hand('t1', T0 + 120_000),
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].hands).toHaveLength(3);
    expect(sessions[0].startedAtMs).toBe(T0);
  });

  it('splits the same table on a gap longer than idle', () => {
    const { sessions } = splitIntoSessions([
      hand('t1', T0),
      hand('t1', T0 + DEFAULT_IDLE_MS + 1),
    ]);
    expect(sessions).toHaveLength(2);
    expect(sessions.map((s) => s.hands.length)).toEqual([1, 1]);
  });

  it('does NOT merge two tables played at the same time', () => {
    // Multi-tabling is the normal case, not the edge case: concurrent tables are concurrent
    // SESSIONS, and interleaving them would put one table's action in another's Conduct Card.
    const { sessions } = splitIntoSessions([
      hand('t1', T0),
      hand('t2', T0 + 1_000),
      hand('t1', T0 + 2_000),
      hand('t2', T0 + 3_000),
    ]);
    expect(sessions).toHaveLength(2);
    expect(new Set(sessions.map((s) => s.tableId))).toEqual(new Set(['t1', 't2']));
    expect(sessions.every((s) => s.hands.length === 2)).toBe(true);
  });

  it('orders by the hand clock, not by arrival order in the file', () => {
    const { sessions } = splitIntoSessions([
      hand('t1', T0 + 120_000),
      hand('t1', T0),
      hand('t1', T0 + 60_000),
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].hands.map((h) => h.timestamp)).toEqual([T0, T0 + 60_000, T0 + 120_000]);
  });

  it('reports an undatable hand instead of folding it into whichever session is open', () => {
    const bad = { captureId: 'x', tableId: 't1' };
    const { sessions, undatable } = splitIntoSessions([hand('t1', T0), bad]);
    expect(undatable).toEqual([bad]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].hands).toHaveLength(1);
  });

  it('places a hand by its own clock even when capturedAt is the only one present', () => {
    const h = { captureId: 'y', tableId: 't1', capturedAt: T0 + 30_000 };
    const { sessions, undatable } = splitIntoSessions([hand('t1', T0), h]);
    expect(undatable).toHaveLength(0);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].hands).toHaveLength(2);
  });
});
