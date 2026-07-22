/**
 * backfillOnlineStakes.test.js — WS-260 one-time re-key of legacy online sessions.
 *
 * Legacy online sessions were hardcoded gameType 'NL Holdem' (FIND-037); their hands
 * carry the real blinds in ignitionMeta. The backfill derives majority stakes per
 * session from its own stored hands and re-labels the session — idempotent,
 * non-destructive, scoped to the given userId's ignition sessions only.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { resetDBPool } from '../database';

// Mock the errorHandler to suppress logs
vi.mock('../../errorHandler', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    action: vi.fn(),
  },
  DEBUG: false,
}));

import { initDB, STORE_NAME } from '../database';
import { createSession, getSessionById, getOrCreateOnlineSession } from '../sessionsStorage';
import { backfillOnlineStakes, deriveStakesFromHands } from '../backfillOnlineStakes';

/** Insert a raw hand record with optional ignitionMeta blinds. */
const insertHand = async (sessionId, { userId = 'guest', blinds } = {}) => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).add({
    timestamp: Date.now(),
    sessionId,
    userId,
    gameState: { street: 'preflop' },
    actionSequence: [],
    ...(blinds !== undefined ? { ignitionMeta: { blinds } } : {}),
  });
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
};

describe('backfillOnlineStakes', () => {
  beforeEach(() => {
    resetDBPool();
    globalThis.indexedDB = new IDBFactory();
    globalThis.window = { indexedDB: globalThis.indexedDB };
  });

  afterEach(() => {
    delete globalThis.window;
  });

  describe('deriveStakesFromHands', () => {
    it('returns the majority blinds so a stray partial capture cannot mislabel the table', () => {
      const hands = [
        { ignitionMeta: { blinds: { sb: 0.02, bb: 0.05 } } },
        { ignitionMeta: { blinds: { sb: 0.02, bb: 0.05 } } },
        { ignitionMeta: { blinds: { sb: 5, bb: 10 } } },
      ];
      expect(deriveStakesFromHands(hands)).toEqual({ sb: 0.02, bb: 0.05 });
    });

    it('ignores hands with missing or null blinds', () => {
      const hands = [
        {},
        { ignitionMeta: {} },
        { ignitionMeta: { blinds: { sb: null, bb: null } } },
        { ignitionMeta: { blinds: { sb: 1, bb: 2 } } },
      ];
      expect(deriveStakesFromHands(hands)).toEqual({ sb: 1, bb: 2 });
    });

    it('returns null when no hand carries valid blinds', () => {
      expect(deriveStakesFromHands([])).toBeNull();
      expect(deriveStakesFromHands([{ ignitionMeta: { blinds: { sb: null, bb: null } } }])).toBeNull();
      expect(deriveStakesFromHands(null)).toBeNull();
    });
  });

  it('re-keys a legacy online session from its stored hands\' blinds', async () => {
    const sessionId = await getOrCreateOnlineSession('table-legacy', 'guest'); // 'NL Holdem'
    await insertHand(sessionId, { blinds: { sb: 0.02, bb: 0.05 } });
    await insertHand(sessionId, { blinds: { sb: 0.02, bb: 0.05 } });

    const res = await backfillOnlineStakes('guest');
    expect(res).toEqual({ scanned: 1, updated: 1 });

    const session = await getSessionById(sessionId);
    expect(session.stakes).toEqual({ sb: 0.02, bb: 0.05 });
    expect(session.gameType).toBe('0.02/0.05');
  });

  it('is idempotent — a second run finds nothing to touch', async () => {
    const sessionId = await getOrCreateOnlineSession('table-once', 'guest');
    await insertHand(sessionId, { blinds: { sb: 1, bb: 2 } });

    await backfillOnlineStakes('guest');
    const second = await backfillOnlineStakes('guest');
    expect(second).toEqual({ scanned: 0, updated: 0 });

    const session = await getSessionById(sessionId);
    expect(session.gameType).toBe('1/2');
  });

  it('leaves sessions with no captured blinds untouched (legacy segment, founder-estimate fallback)', async () => {
    const sessionId = await getOrCreateOnlineSession('table-noblinds', 'guest');
    await insertHand(sessionId); // no ignitionMeta at all

    const res = await backfillOnlineStakes('guest');
    expect(res).toEqual({ scanned: 1, updated: 0 });

    const session = await getSessionById(sessionId);
    expect(session.gameType).toBe('NL Holdem');
    expect(session.stakes).toBeNull();
  });

  it('never touches live sessions', async () => {
    const liveId = await createSession({ gameType: '1/2' }, 'guest');
    await insertHand(liveId, { blinds: { sb: 5, bb: 10 } }); // pathological, must still be ignored

    const res = await backfillOnlineStakes('guest');
    expect(res).toEqual({ scanned: 0, updated: 0 });

    const session = await getSessionById(liveId);
    expect(session.gameType).toBe('1/2');
    expect(session.stakes).toBeUndefined();
  });

  it('is scoped to the given userId — other users\' sessions are untouched', async () => {
    const otherId = await getOrCreateOnlineSession('table-other', 'player_99');
    await insertHand(otherId, { userId: 'player_99', blinds: { sb: 1, bb: 2 } });

    const res = await backfillOnlineStakes('guest');
    expect(res).toEqual({ scanned: 0, updated: 0 });

    const session = await getSessionById(otherId);
    expect(session.gameType).toBe('NL Holdem');
  });

  it('does not clobber stakes healed by a concurrent writer between scan and update', async () => {
    // Session already has stakes by the time the update tx runs — the in-tx
    // re-check must skip it. Simulate by pre-healing via the reuse path.
    const sessionId = await getOrCreateOnlineSession('table-race', 'guest');
    await insertHand(sessionId, { blinds: { sb: 1, bb: 2 } });
    await getOrCreateOnlineSession('table-race', 'guest', { blinds: { sb: 5, bb: 10 } }); // heals first

    const res = await backfillOnlineStakes('guest');
    // Scan ran before our heal? No — heal happened first, so nothing qualifies.
    expect(res).toEqual({ scanned: 0, updated: 0 });

    const session = await getSessionById(sessionId);
    expect(session.stakes).toEqual({ sb: 5, bb: 10 });
  });
});
