// @vitest-environment jsdom
/**
 * migrationV24.test.js — IDB v24 migration (SPR-041 Phase 3).
 *
 * Verifies:
 *   - Defaults `distinguishingMarks: []` and `accessoryInventory: []` for
 *     legacy players who lack the fields.
 *   - Backfills `accessoryInventory` from legacy `headwear` + `hatColor` and
 *     `eyewear` + `eyewearColor` (the two flat fields the founder flagged in
 *     `feedback_glasses_headwear_are_accessories.md`).
 *   - Idempotent — re-running on an already-migrated record produces no
 *     duplicate inventory entries.
 *   - Preserves existing `accessoryInventory` entries (does not overwrite).
 *   - Preserves the legacy headwear/eyewear/hatColor/eyewearColor fields (this
 *     migration is additive only; field removal is a separate ticket — avatar
 *     renderer + PlayerEditor still read those fields).
 *   - Fresh install (no players store) is a no-op.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  closeDB,
  resetDBPool,
  DB_NAME,
  DB_VERSION,
  PLAYERS_STORE_NAME,
} from '../database';
import { getDB } from '../database';

const deleteEntireDB = () =>
  new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });

// Open the DB at a specific version and seed players. Returns the seeded
// playerIds so the test can re-fetch by key after migration.
const seedPlayersAtVersion = (version, players) =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, version);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(PLAYERS_STORE_NAME)) {
        db.createObjectStore(PLAYERS_STORE_NAME, {
          keyPath: 'playerId',
          autoIncrement: true,
        });
      }
    };
    req.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction(PLAYERS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PLAYERS_STORE_NAME);
      const ids = [];
      players.forEach((p) => {
        const r = store.put(p);
        r.onsuccess = () => ids.push(r.result);
      });
      tx.oncomplete = () => {
        db.close();
        resolve(ids);
      };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });

const readAllPlayers = async () => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYERS_STORE_NAME, 'readonly');
    const store = tx.objectStore(PLAYERS_STORE_NAME);
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
  it('is at v24 or later (SPR-041 Phase 3)', () => {
    expect(DB_VERSION).toBeGreaterThanOrEqual(24);
  });
});

describe('migrateV24 — defaults for missing fields', () => {
  it('adds distinguishingMarks: [] to legacy player without the field', async () => {
    await seedPlayersAtVersion(23, [
      { name: 'Alice', sex: 'female' },
    ]);
    await getDB(); // triggers v24 upgrade
    const players = await readAllPlayers();
    expect(players).toHaveLength(1);
    expect(players[0].distinguishingMarks).toEqual([]);
  });

  it('adds accessoryInventory: [] to legacy player without the field', async () => {
    await seedPlayersAtVersion(23, [
      { name: 'Bob', sex: 'male' },
    ]);
    await getDB();
    const players = await readAllPlayers();
    expect(players[0].accessoryInventory).toEqual([]);
  });

  it('preserves existing distinguishingMarks (does not overwrite)', async () => {
    const existing = [
      {
        type: 'tattoo',
        location: 'arm',
        description: 'sleeve',
        firstSeenAt: 1000,
        lastSeenAt: 2000,
      },
    ];
    await seedPlayersAtVersion(23, [
      { name: 'Carol', distinguishingMarks: existing },
    ]);
    await getDB();
    const players = await readAllPlayers();
    expect(players[0].distinguishingMarks).toEqual(existing);
  });

  it('preserves existing accessoryInventory (does not overwrite)', async () => {
    const existing = [
      {
        accessoryId: 'pre-existing-1',
        kind: 'jewelry',
        subtype: 'ring',
        color: 'gold',
        note: 'left hand',
        firstSeenAt: 100,
        lastSeenAt: 200,
        timesSeen: 3,
      },
    ];
    await seedPlayersAtVersion(23, [
      { name: 'Dave', accessoryInventory: existing },
    ]);
    await getDB();
    const players = await readAllPlayers();
    expect(players[0].accessoryInventory).toContainEqual(existing[0]);
  });
});

describe('migrateV24 — legacy headwear backfill', () => {
  it('backfills headwear="cap" + hatColor="red" → {kind: hat, subtype: cap, color: red}', async () => {
    await seedPlayersAtVersion(23, [
      { name: 'Eve', headwear: 'cap', hatColor: 'red' },
    ]);
    await getDB();
    const players = await readAllPlayers();
    expect(players[0].accessoryInventory).toHaveLength(1);
    const entry = players[0].accessoryInventory[0];
    expect(entry.kind).toBe('hat');
    expect(entry.subtype).toBe('cap');
    expect(entry.color).toBe('red');
    expect(entry.note).toBe('');
    expect(entry.timesSeen).toBe(1);
    expect(typeof entry.accessoryId).toBe('string');
    expect(entry.accessoryId.length).toBeGreaterThan(0);
  });

  it('backfills headwear with no hatColor → entry with color: null', async () => {
    await seedPlayersAtVersion(23, [
      { name: 'Frank', headwear: 'beanie' },
    ]);
    await getDB();
    const players = await readAllPlayers();
    expect(players[0].accessoryInventory).toHaveLength(1);
    expect(players[0].accessoryInventory[0]).toMatchObject({
      kind: 'hat',
      subtype: 'beanie',
      color: null,
    });
  });

  it('does NOT backfill headwear="none" (no observation to record)', async () => {
    await seedPlayersAtVersion(23, [
      { name: 'Grace', headwear: 'none' },
    ]);
    await getDB();
    const players = await readAllPlayers();
    expect(players[0].accessoryInventory).toEqual([]);
  });

  it('does NOT backfill missing/empty headwear', async () => {
    await seedPlayersAtVersion(23, [
      { name: 'Hank' },
    ]);
    await getDB();
    const players = await readAllPlayers();
    expect(players[0].accessoryInventory).toEqual([]);
  });

  it('preserves legacy headwear + hatColor fields (additive migration only)', async () => {
    await seedPlayersAtVersion(23, [
      { name: 'Iris', headwear: 'cap', hatColor: 'red' },
    ]);
    await getDB();
    const players = await readAllPlayers();
    expect(players[0].headwear).toBe('cap');
    expect(players[0].hatColor).toBe('red');
  });
});

describe('migrateV24 — legacy eyewear backfill', () => {
  it('backfills eyewear="sunglasses" + eyewearColor="black" → {kind: glasses, subtype: sunglasses, color: black}', async () => {
    await seedPlayersAtVersion(23, [
      { name: 'Jane', eyewear: 'sunglasses', eyewearColor: 'black' },
    ]);
    await getDB();
    const players = await readAllPlayers();
    expect(players[0].accessoryInventory).toHaveLength(1);
    expect(players[0].accessoryInventory[0]).toMatchObject({
      kind: 'glasses',
      subtype: 'sunglasses',
      color: 'black',
    });
  });

  it('does NOT backfill eyewear="none"', async () => {
    await seedPlayersAtVersion(23, [
      { name: 'Karl', eyewear: 'none' },
    ]);
    await getDB();
    const players = await readAllPlayers();
    expect(players[0].accessoryInventory).toEqual([]);
  });

  it('preserves legacy eyewear + eyewearColor fields', async () => {
    await seedPlayersAtVersion(23, [
      { name: 'Liam', eyewear: 'aviators', eyewearColor: 'gold' },
    ]);
    await getDB();
    const players = await readAllPlayers();
    expect(players[0].eyewear).toBe('aviators');
    expect(players[0].eyewearColor).toBe('gold');
  });
});

describe('migrateV24 — both headwear + eyewear backfill', () => {
  it('player with both legacy fields gets two inventory entries', async () => {
    await seedPlayersAtVersion(23, [
      {
        name: 'Mia',
        headwear: 'fedora',
        hatColor: 'black',
        eyewear: 'readers',
        eyewearColor: 'tortoiseshell',
      },
    ]);
    await getDB();
    const players = await readAllPlayers();
    const inv = players[0].accessoryInventory;
    expect(inv).toHaveLength(2);
    expect(inv).toContainEqual(expect.objectContaining({
      kind: 'hat', subtype: 'fedora', color: 'black',
    }));
    expect(inv).toContainEqual(expect.objectContaining({
      kind: 'glasses', subtype: 'readers', color: 'tortoiseshell',
    }));
  });
});

describe('migrateV24 — idempotence', () => {
  it('re-opening the DB at v24 does not duplicate backfilled entries', async () => {
    await seedPlayersAtVersion(23, [
      { name: 'Noah', headwear: 'cap', hatColor: 'blue' },
    ]);
    await getDB();
    closeDB();
    resetDBPool();
    // Re-open: triggers no upgrade (already at v24) but verifies the data is stable.
    await getDB();
    const players = await readAllPlayers();
    expect(players[0].accessoryInventory).toHaveLength(1);
  });

  it('does not duplicate when the same backfilled entry already exists in inventory', async () => {
    // Simulate a record where someone manually added a matching hat entry
    // BEFORE the v24 backfill runs. Migration should detect the match and skip.
    const preExisting = {
      accessoryId: 'manual-1',
      kind: 'hat',
      subtype: 'cap',
      color: 'green',
      note: '',
      firstSeenAt: 100,
      lastSeenAt: 200,
      timesSeen: 5,
    };
    await seedPlayersAtVersion(23, [
      {
        name: 'Olivia',
        headwear: 'cap',
        hatColor: 'green',
        accessoryInventory: [preExisting],
      },
    ]);
    await getDB();
    const players = await readAllPlayers();
    expect(players[0].accessoryInventory).toHaveLength(1);
    expect(players[0].accessoryInventory[0]).toEqual(preExisting);
  });
});

describe('migrateV24 — fresh install (no players store)', () => {
  it('runs cleanly when no players store exists yet', async () => {
    // No seed; first open creates everything from scratch.
    const db = await getDB();
    expect(db.objectStoreNames.contains(PLAYERS_STORE_NAME)).toBe(true);
    const players = await readAllPlayers();
    expect(players).toEqual([]);
  });
});
