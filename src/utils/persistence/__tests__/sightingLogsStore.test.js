// @vitest-environment jsdom
/**
 * sightingLogsStore.test.js
 *
 * IDB v23 store CRUD: append + index reads + cascade delete.
 * Per WS-160 / SPR-034 (PIO Gate 5 child A).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  appendSighting,
  getSightingsForPlayer,
  getSightingsBySession,
  getSightingsByFeature,
  deleteSightingsForPlayer,
} from '../sightingLogsStore';
import { closeDB, resetDBPool, DB_NAME } from '../database';

const deleteEntireDB = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
    req.onblocked = () => resolve();
  });

beforeEach(async () => {
  closeDB();
  resetDBPool();
  await deleteEntireDB();
});

afterEach(async () => {
  closeDB();
  resetDBPool();
  await deleteEntireDB();
});

describe('sightingLogsStore — preconditions', () => {
  it('appendSighting requires a sighting object with playerId', async () => {
    await expect(appendSighting(null)).rejects.toThrow(/sighting object/);
    await expect(appendSighting({})).rejects.toThrow(/playerId/);
  });

  it('getSightingsForPlayer requires non-empty string playerId', async () => {
    await expect(getSightingsForPlayer('')).rejects.toThrow(/playerId/);
    await expect(getSightingsForPlayer(null)).rejects.toThrow(/playerId/);
  });

  it('getSightingsByFeature requires non-empty feature', async () => {
    await expect(getSightingsByFeature('')).rejects.toThrow(/feature/);
  });

  it('deleteSightingsForPlayer requires non-empty string playerId', async () => {
    await expect(deleteSightingsForPlayer('')).rejects.toThrow(/playerId/);
  });
});

describe('sightingLogsStore — round-trip', () => {
  it('appendSighting then getSightingsForPlayer returns the record', async () => {
    const id = await appendSighting({
      playerId: 'p1',
      sessionId: 's1',
      capturedAt: 1700000000000,
      venueId: 'v1',
      featuresSeen: ['hat', 'wardrobe'],
      attributes: { ageDecade: '30s', wardrobe: ['black-hoodie'] },
    });
    expect(typeof id).toBe('number');

    const records = await getSightingsForPlayer('p1');
    expect(records).toHaveLength(1);
    expect(records[0].playerId).toBe('p1');
    expect(records[0].featuresSeen).toEqual(['hat', 'wardrobe']);
  });

  it('returns empty array for unknown playerId', async () => {
    const records = await getSightingsForPlayer('nonexistent');
    expect(records).toEqual([]);
  });

  it('sorts results by capturedAt descending', async () => {
    await appendSighting({ playerId: 'p1', capturedAt: 1700000001000, attributes: {} });
    await appendSighting({ playerId: 'p1', capturedAt: 1700000003000, attributes: {} });
    await appendSighting({ playerId: 'p1', capturedAt: 1700000002000, attributes: {} });

    const records = await getSightingsForPlayer('p1');
    expect(records.map((r) => r.capturedAt)).toEqual([1700000003000, 1700000002000, 1700000001000]);
  });

  it('defaults capturedAt + venueId + featuresSeen when omitted', async () => {
    const before = Date.now();
    const id = await appendSighting({ playerId: 'p2', attributes: {} });
    expect(typeof id).toBe('number');
    const records = await getSightingsForPlayer('p2');
    expect(records[0].capturedAt).toBeGreaterThanOrEqual(before);
    expect(records[0].venueId).toBeNull();
    expect(records[0].featuresSeen).toEqual([]);
  });
});

describe('sightingLogsStore — index queries', () => {
  it('getSightingsBySession filters by playerId+sessionId composite', async () => {
    await appendSighting({ playerId: 'p1', sessionId: 's1', attributes: {} });
    await appendSighting({ playerId: 'p1', sessionId: 's2', attributes: {} });
    await appendSighting({ playerId: 'p2', sessionId: 's1', attributes: {} });

    const s1 = await getSightingsBySession('p1', 's1');
    expect(s1).toHaveLength(1);
    expect(s1[0].playerId).toBe('p1');
    expect(s1[0].sessionId).toBe('s1');
  });

  it('getSightingsByFeature uses multiEntry index', async () => {
    await appendSighting({ playerId: 'p1', featuresSeen: ['hat', 'wardrobe'], attributes: {} });
    await appendSighting({ playerId: 'p2', featuresSeen: ['hat'], attributes: {} });
    await appendSighting({ playerId: 'p3', featuresSeen: ['jewelry'], attributes: {} });

    const hatSightings = await getSightingsByFeature('hat');
    expect(hatSightings).toHaveLength(2);
    expect(hatSightings.map((r) => r.playerId).sort()).toEqual(['p1', 'p2']);

    const jewelry = await getSightingsByFeature('jewelry');
    expect(jewelry).toHaveLength(1);
    expect(jewelry[0].playerId).toBe('p3');
  });

  it('returns empty array when no matching feature', async () => {
    await appendSighting({ playerId: 'p1', featuresSeen: ['hat'], attributes: {} });
    const result = await getSightingsByFeature('logo');
    expect(result).toEqual([]);
  });
});

describe('sightingLogsStore — cascade delete', () => {
  it('deletes all sightings for a player + leaves other players intact', async () => {
    await appendSighting({ playerId: 'p1', attributes: {} });
    await appendSighting({ playerId: 'p1', attributes: {} });
    await appendSighting({ playerId: 'p2', attributes: {} });

    const count = await deleteSightingsForPlayer('p1');
    expect(count).toBe(2);
    expect(await getSightingsForPlayer('p1')).toEqual([]);
    expect(await getSightingsForPlayer('p2')).toHaveLength(1);
  });

  it('returns 0 when no sightings exist for a player', async () => {
    const count = await deleteSightingsForPlayer('nonexistent');
    expect(count).toBe(0);
  });
});
