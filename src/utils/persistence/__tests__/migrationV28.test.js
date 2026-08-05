// @vitest-environment jsdom
/**
 * migrationV28.test.js — IDB v28 migration (positive hand provenance / WS-368).
 *
 * THE ASSERTION THIS FILE EXISTS FOR: a row that predates stamping comes out
 * `source: 'unknown'`, and specifically NOT `'live'`. Those rows are genuinely
 * ambiguous — probably live on the founder's device, but the import path
 * (exportUtils.importAllData → saveHand) stamped nothing, so some may have
 * arrived from a backup file. Stamping them 'live' would manufacture the exact
 * population FAULT-population-mismatch's falsifier is supposed to measure, and
 * would do so irreversibly. Everything else here is supporting cast.
 *
 * Also verifies:
 *   - A row already carrying a trustworthy scalar source ('ignition') KEEPS it
 *     and gains the structured provenance object, flagged backfilled.
 *   - Idempotence — re-opening at v28 does not re-stamp or overwrite.
 *   - Fresh install (no hands store) is a no-op.
 *   - The concurrent-cursor contract: on a pre-v25 → v28 upgrade, where
 *     migrateV25 co-runs its own hands walk, provenance survives AND
 *     predictionAudit is not lost.
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
import { HAND_SOURCE, PROVENANCE_SCHEMA_VERSION, UNKNOWN_REASON_PRE_STAMPING } from '../handProvenance';

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
        store.createIndex('source', 'source', { unique: false });
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
    const r = tx.objectStore(STORE_NAME).getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
};

/** A hand as it existed before provenance stamping — note: NO `source`. */
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
  predictionAudit: null,
  reviewTag: null,
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
  it('is at v28 or later (positive hand provenance / WS-368)', () => {
    expect(DB_VERSION).toBeGreaterThanOrEqual(28);
  });
});

describe('migrateV28 — unstamped legacy rows are UNKNOWN, never live', () => {
  it('stamps an unstamped legacy hand source: "unknown"', async () => {
    await seedHandsAtVersion(27, [makeLegacyHand(1)]);
    await getDB(); // triggers the v27 → v28 upgrade
    const hands = await readAllHands();
    expect(hands).toHaveLength(1);
    expect(hands[0].source).toBe(HAND_SOURCE.UNKNOWN);
  });

  it('does NOT assume unstamped rows are live (the whole point of the migration)', async () => {
    await seedHandsAtVersion(27, [makeLegacyHand(1), makeLegacyHand(2), makeLegacyHand(3)]);
    await getDB();
    const hands = await readAllHands();
    expect(hands).toHaveLength(3);
    hands.forEach((h) => {
      expect(h.source).not.toBe(HAND_SOURCE.LIVE);
      expect(h.source).toBe(HAND_SOURCE.UNKNOWN);
    });
  });

  it('records WHY the row is unknown, and what it literally had before', async () => {
    await seedHandsAtVersion(27, [makeLegacyHand(1)]);
    await getDB();
    const [hand] = await readAllHands();
    expect(hand.provenance).toMatchObject({
      channel: HAND_SOURCE.UNKNOWN,
      reason: UNKNOWN_REASON_PRE_STAMPING,
      observedSource: null,
      schemaVersion: PROVENANCE_SCHEMA_VERSION,
    });
    // Nothing is invented to fill the population fields.
    expect(hand.provenance.venue).toBeNull();
    expect(hand.provenance.stake).toBeNull();
    expect(hand.provenance.stakeLabel).toBeNull();
  });

  it('keeps unknown rows OUT of the live arm — getHandsBySource("live") stays empty', async () => {
    await seedHandsAtVersion(27, [makeLegacyHand(1), makeLegacyHand(2)]);
    await getDB();
    const { getHandsBySource } = await import('../handsStorage');
    expect(await getHandsBySource(HAND_SOURCE.LIVE, 'guest')).toHaveLength(0);
    expect(await getHandsBySource(HAND_SOURCE.UNKNOWN, 'guest')).toHaveLength(2);
  });
});

describe('migrateV28 — rows with a trustworthy scalar source keep it', () => {
  it('preserves source: "ignition" and backfills the structured object', async () => {
    await seedHandsAtVersion(27, [makeLegacyHand(1, { source: 'ignition' })]);
    await getDB();
    const [hand] = await readAllHands();
    expect(hand.source).toBe(HAND_SOURCE.IGNITION);
    expect(hand.provenance).toMatchObject({
      channel: HAND_SOURCE.IGNITION,
      venue: 'Ignition',
      // Flagged so a reader can tell a reconstruction from a write-time stamp.
      backfilled: true,
    });
  });

  it('separates the two kinds of legacy row in one pass', async () => {
    await seedHandsAtVersion(27, [
      makeLegacyHand(1, { source: 'ignition' }),
      makeLegacyHand(2),
    ]);
    await getDB();
    const hands = await readAllHands();
    const sources = hands.map((h) => h.source).sort();
    expect(sources).toEqual(['ignition', 'unknown']);
  });
});

describe('migrateV28 — idempotence', () => {
  it('re-opening the DB at v28 does not re-stamp or overwrite provenance', async () => {
    await seedHandsAtVersion(27, [makeLegacyHand(1)]);
    await getDB();
    const [first] = await readAllHands();
    closeDB();
    resetDBPool();
    await getDB();
    const [second] = await readAllHands();
    expect(second.source).toBe(HAND_SOURCE.UNKNOWN);
    expect(second.provenance.stampedAt).toBe(first.provenance.stampedAt);
  });
});

describe('migrateV28 — concurrent-cursor contract (pre-v25 → v28)', () => {
  it('wins the race against migrateV25 without costing predictionAudit', async () => {
    // Seed at v24 so ONE upgrade transaction runs migrateV25, migrateV27 and
    // migrateV28. v28's cursor is queued last, so its put lands last; it must
    // therefore re-apply v25's and v27's defaults rather than clobber them.
    await seedHandsAtVersion(24, [
      { ...makeLegacyHand(1), predictionAudit: undefined, reviewTag: undefined },
    ]);
    await getDB();
    const hands = await readAllHands();
    expect(hands).toHaveLength(1);
    // Provenance may never be lost — it is the illegal state being removed.
    expect(hands[0].source).toBe(HAND_SOURCE.UNKNOWN);
    expect(hands[0].provenance.channel).toBe(HAND_SOURCE.UNKNOWN);
    // v25's default survives the later put.
    expect(hands[0].predictionAudit).toBeNull();
    // v27 skips its own pass here; v28 applies the default in its place.
    expect(hands[0].reviewTag).toBeNull();
  });
});

describe('migrateV28 — fresh install (no hands store)', () => {
  it('runs cleanly when no hands store exists yet (v0 → v28 path)', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains(STORE_NAME)).toBe(true);
    expect(await readAllHands()).toEqual([]);
  });
});
