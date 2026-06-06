// @vitest-environment jsdom
/**
 * migrationV27.test.js — IDB v27 migration (mid-hand tag-for-review / WS-190 / SPR-107).
 *
 * Verifies:
 *   - Defaults `reviewTag: null` for legacy hands lacking the field
 *     (forward-only — no backfill of historical hands).
 *   - Preserves an existing reviewTag payload (does not overwrite).
 *   - Handles multiple legacy hands in one pass.
 *   - Idempotent — re-opening at v27 leaves defaults intact.
 *   - Fresh install (no hands store) is a no-op.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  closeDB,
  resetDBPool,
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
  getDB,
} from '../database';

const deleteEntireDB = () =>
  new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });

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

const makeLegacyHand = (id, extra = {}) => ({
  timestamp: Date.now() + id,
  version: '1.3.0',
  userId: 'guest',
  sessionId: null,
  sessionHandNumber: null,
  handDisplayId: `H${id}`,
  gameState: { currentStreet: 'preflop', dealerButtonSeat: 1, mySeat: 2, actionSequence: [], absentSeats: [] },
  cardState: { communityCards: ['', '', '', '', ''], holeCards: ['', ''], holeCardsVisible: false, allPlayerCards: {} },
  seatPlayers: {},
  ...extra,
});

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
  it('is at v27 or later (mid-hand tag-for-review / WS-190)', () => {
    expect(DB_VERSION).toBeGreaterThanOrEqual(27);
  });
});

describe('migrateV27 — reviewTag field default', () => {
  it('adds reviewTag: null to a legacy hand lacking the field', async () => {
    await seedHandsAtVersion(26, [makeLegacyHand(1)]);
    await getDB(); // triggers v27 upgrade
    const hands = await readAllHands();
    expect(hands).toHaveLength(1);
    expect(hands[0].reviewTag).toBeNull();
  });

  it('preserves an existing reviewTag payload (does not overwrite)', async () => {
    const tag = { tagged: true, taggedAt: 1717000000000 };
    await seedHandsAtVersion(26, [makeLegacyHand(2, { reviewTag: tag })]);
    await getDB();
    const hands = await readAllHands();
    expect(hands[0].reviewTag).toEqual(tag);
  });

  it('handles multiple legacy hands in one migration pass', async () => {
    await seedHandsAtVersion(26, [makeLegacyHand(1), makeLegacyHand(2), makeLegacyHand(3)]);
    await getDB();
    const hands = await readAllHands();
    expect(hands).toHaveLength(3);
    hands.forEach((h) => expect(h.reviewTag).toBeNull());
  });
});

describe('migrateV27 — idempotence', () => {
  it('re-opening the DB at v27 leaves reviewTag defaults intact', async () => {
    await seedHandsAtVersion(26, [makeLegacyHand(1)]);
    await getDB();
    closeDB();
    resetDBPool();
    await getDB();
    const hands = await readAllHands();
    expect(hands[0].reviewTag).toBeNull();
  });
});

describe('migrateV27 — concurrent-cursor hazard mitigation (pre-v25 → v27)', () => {
  it('skips the reviewTag pass when v25 co-runs, preserving predictionAudit (no clobber)', async () => {
    // Seed at v24 so the single upgrade runs BOTH migrateV25 and migrateV27.
    // v27 must skip its cursor to avoid clobbering v25's predictionAudit write.
    await seedHandsAtVersion(24, [makeLegacyHand(1)]);
    await getDB(); // 24 → 27 in one transaction
    const hands = await readAllHands();
    expect(hands).toHaveLength(1);
    // v25 default survives (not clobbered by v27's stale-snapshot put):
    expect(hands[0].predictionAudit).toBeNull();
    // v27 deliberately left reviewTag unset; consumers treat undefined as untagged:
    expect(hands[0].reviewTag).toBeUndefined();
  });
});

describe('migrateV27 — fresh install (no hands store)', () => {
  it('runs cleanly when no hands store exists yet (v0 → v27 path)', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains(STORE_NAME)).toBe(true);
    const hands = await readAllHands();
    expect(hands).toEqual([]);
  });
});
