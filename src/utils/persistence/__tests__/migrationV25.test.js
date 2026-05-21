// @vitest-environment jsdom
/**
 * migrationV25.test.js — IDB v25 migration (PMC Phase 5a / WS-177 / SPR-068).
 *
 * Verifies:
 *   - Defaults `predictionAudit: null` for legacy hands lacking the field
 *     (forward-only — Q2 ratified; no engine-replay backfill).
 *   - Idempotent — re-running on an already-migrated record produces no
 *     change.
 *   - Preserves existing `predictionAudit` payload (does not overwrite).
 *   - Fresh install (no hands store) is a no-op.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  closeDB,
  resetDBPool,
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
} from '../database';
import { getDB } from '../database';

const deleteEntireDB = () =>
  new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });

// Open the DB at a specific version and seed hands. Returns nothing — the test
// re-fetches via getAll after the upgrade triggers.
const seedHandsAtVersion = (version, hands) =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, version);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'handId',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('userId_timestamp', ['userId', 'timestamp'], { unique: false });
        store.createIndex('sessionId', 'sessionId', { unique: false });
      }
    };
    req.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      hands.forEach((h) => store.put(h));
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });

const readAllHands = async () => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const r = store.getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
};

beforeEach(async () => {
  closeDB();
  resetDBPool();
  await deleteEntireDB();
});

afterEach(async () => {
  closeDB();
  resetDBPool();
});

describe('DB_VERSION', () => {
  it('is at v25 or later (PMC Phase 5a / WS-177)', () => {
    expect(DB_VERSION).toBeGreaterThanOrEqual(25);
  });
});

describe('migrateV25 — predictionAudit field default', () => {
  it('adds predictionAudit: null to legacy hand without the field', async () => {
    const legacyHand = {
      timestamp: Date.now(),
      version: '1.3.0',
      userId: 'guest',
      sessionId: null,
      sessionHandNumber: null,
      handDisplayId: 'H1234',
      gameState: { currentStreet: 'preflop', dealerButtonSeat: 1, mySeat: 2, actionSequence: [], absentSeats: [] },
      cardState: { communityCards: ['', '', '', '', ''], holeCards: ['', ''], holeCardsVisible: false, allPlayerCards: {} },
      seatPlayers: {},
    };
    await seedHandsAtVersion(24, [legacyHand]);
    await getDB(); // triggers v25 upgrade
    const hands = await readAllHands();
    expect(hands).toHaveLength(1);
    expect(hands[0].predictionAudit).toBeNull();
  });

  it('preserves existing predictionAudit payload (does not overwrite)', async () => {
    const existingAudit = {
      predictedDistribution: [{ actor: 'villain', actorId: 42, seat: 3, distribution: [{ action: 'fold', weight: 0.5 }, { action: 'call', weight: 0.5 }] }],
      observedAction: [{ actor: 'villain', actorId: 42, seat: 3, actionTaken: 'call', sizing: 100 }],
      modelVersion: 'range-3+engine-v123',
    };
    const handWithAudit = {
      timestamp: Date.now(),
      version: '1.3.0',
      userId: 'guest',
      sessionId: null,
      sessionHandNumber: null,
      handDisplayId: 'H5678',
      gameState: { currentStreet: 'flop', dealerButtonSeat: 1, mySeat: 2, actionSequence: [], absentSeats: [] },
      cardState: { communityCards: ['', '', '', '', ''], holeCards: ['', ''], holeCardsVisible: false, allPlayerCards: {} },
      seatPlayers: {},
      predictionAudit: existingAudit,
    };
    await seedHandsAtVersion(24, [handWithAudit]);
    await getDB();
    const hands = await readAllHands();
    expect(hands[0].predictionAudit).toEqual(existingAudit);
  });

  it('handles multiple legacy hands in one migration pass', async () => {
    const makeHand = (id) => ({
      timestamp: Date.now() + id,
      version: '1.3.0',
      userId: 'guest',
      sessionId: null,
      sessionHandNumber: null,
      handDisplayId: `H${id}`,
      gameState: { currentStreet: 'preflop', dealerButtonSeat: 1, mySeat: 2, actionSequence: [], absentSeats: [] },
      cardState: { communityCards: ['', '', '', '', ''], holeCards: ['', ''], holeCardsVisible: false, allPlayerCards: {} },
      seatPlayers: {},
    });
    await seedHandsAtVersion(24, [makeHand(1), makeHand(2), makeHand(3)]);
    await getDB();
    const hands = await readAllHands();
    expect(hands).toHaveLength(3);
    hands.forEach((h) => expect(h.predictionAudit).toBeNull());
  });
});

describe('migrateV25 — idempotence', () => {
  it('re-opening the DB at v25 does not change predictionAudit defaults', async () => {
    const legacyHand = {
      timestamp: Date.now(),
      version: '1.3.0',
      userId: 'guest',
      sessionId: null,
      sessionHandNumber: null,
      handDisplayId: 'H1',
      gameState: { currentStreet: 'preflop', dealerButtonSeat: 1, mySeat: 2, actionSequence: [], absentSeats: [] },
      cardState: { communityCards: ['', '', '', '', ''], holeCards: ['', ''], holeCardsVisible: false, allPlayerCards: {} },
      seatPlayers: {},
    };
    await seedHandsAtVersion(24, [legacyHand]);
    await getDB();
    closeDB();
    resetDBPool();
    // Re-open — no upgrade should run; the v25 default should still hold.
    await getDB();
    const hands = await readAllHands();
    expect(hands[0].predictionAudit).toBeNull();
  });
});

describe('migrateV25 — fresh install (no hands store)', () => {
  it('runs cleanly when no hands store exists yet (v0 → v25 path)', async () => {
    // No seed; first open creates everything from scratch via runMigrations.
    const db = await getDB();
    expect(db.objectStoreNames.contains(STORE_NAME)).toBe(true);
    const hands = await readAllHands();
    expect(hands).toEqual([]);
  });
});
