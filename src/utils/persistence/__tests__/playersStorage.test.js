/**
 * playersStorage.test.js - Tests for player CRUD operations
 *
 * Uses fake-indexeddb to test all player storage functions against
 * a real IndexedDB schema without browser dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { resetDBPool } from '../database';

// Mock the errorHandler to suppress logs during tests
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

import { initDB } from '../database';
import {
  createPlayer,
  getAllPlayers,
  getPlayerById,
  updatePlayer,
  deletePlayer,
  getPlayerByName,
} from '../playersStorage';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetDBPool();
  globalThis.indexedDB = new IDBFactory();
  globalThis.window = { indexedDB: globalThis.indexedDB };
});

afterEach(() => {
  delete globalThis.window;
});

// ---------------------------------------------------------------------------
// createPlayer
// ---------------------------------------------------------------------------

describe('createPlayer', () => {
  it('returns a numeric playerId', async () => {
    await initDB();
    const playerId = await createPlayer({ name: 'Alice' }, 'testUser');
    expect(typeof playerId).toBe('number');
    expect(playerId).toBeGreaterThan(0);
  });

  it('round-trips: created player is retrievable by id', async () => {
    await initDB();
    const playerId = await createPlayer({ name: 'Alice' }, 'testUser');
    const player = await getPlayerById(playerId);
    expect(player).not.toBeNull();
    expect(player.name).toBe('Alice');
    expect(player.userId).toBe('testUser');
    expect(player.playerId).toBe(playerId);
  });

  it('attaches metadata fields to the saved record', async () => {
    const before = Date.now();
    await initDB();
    const playerId = await createPlayer({ name: 'Alice' }, 'testUser');
    const after = Date.now();
    const player = await getPlayerById(playerId);

    expect(typeof player.createdAt).toBe('number');
    expect(player.createdAt).toBeGreaterThanOrEqual(before);
    expect(player.createdAt).toBeLessThanOrEqual(after);
    expect(typeof player.lastSeenAt).toBe('number');
    expect(player.handCount).toBe(0);
    expect(player.stats).toBeNull();
  });

  it('throws when a duplicate name is created for the same userId', async () => {
    await initDB();
    await createPlayer({ name: 'Alice' }, 'testUser');
    await expect(createPlayer({ name: 'Alice' }, 'testUser')).rejects.toThrow(
      'Player with name "Alice" already exists'
    );
  });

  it('allows the same name for different userIds', async () => {
    await initDB();
    const id1 = await createPlayer({ name: 'Alice' }, 'testUser');
    const id2 = await createPlayer({ name: 'Alice' }, 'otherUser');
    expect(typeof id1).toBe('number');
    expect(typeof id2).toBe('number');
    expect(id1).not.toBe(id2);
  });

  it('auto-increments playerId across multiple creates', async () => {
    await initDB();
    const id1 = await createPlayer({ name: 'Alice' }, 'testUser');
    const id2 = await createPlayer({ name: 'Bob' }, 'testUser');
    expect(id2).toBeGreaterThan(id1);
  });

  it('throws when name is missing', async () => {
    await initDB();
    await expect(createPlayer({}, 'testUser')).rejects.toThrow('Invalid player data');
  });

  it('throws when name is an empty string', async () => {
    await initDB();
    await expect(createPlayer({ name: '' }, 'testUser')).rejects.toThrow('Invalid player data');
  });
});

// ---------------------------------------------------------------------------
// getAllPlayers
// ---------------------------------------------------------------------------

describe('getAllPlayers', () => {
  it('returns only players belonging to the given userId', async () => {
    await initDB();
    await createPlayer({ name: 'Alice' }, 'testUser');
    await createPlayer({ name: 'Bob' }, 'testUser');
    await createPlayer({ name: 'Alice' }, 'otherUser');

    const testUserPlayers = await getAllPlayers('testUser');
    const otherUserPlayers = await getAllPlayers('otherUser');

    expect(testUserPlayers).toHaveLength(2);
    expect(otherUserPlayers).toHaveLength(1);
    expect(testUserPlayers.every(p => p.userId === 'testUser')).toBe(true);
  });

  it('returns empty array for a userId with no players', async () => {
    await initDB();
    const result = await getAllPlayers('testUser');
    expect(result).toEqual([]);
  });

  it('returns empty array for an unknown userId when other users have players', async () => {
    await initDB();
    await createPlayer({ name: 'Alice' }, 'otherUser');
    const result = await getAllPlayers('testUser');
    expect(result).toEqual([]);
  });

  it('returns players that contain expected fields', async () => {
    await initDB();
    await createPlayer({ name: 'Alice' }, 'testUser');
    const [player] = await getAllPlayers('testUser');

    expect(player).toHaveProperty('playerId');
    expect(player).toHaveProperty('name', 'Alice');
    expect(player).toHaveProperty('userId', 'testUser');
    expect(player).toHaveProperty('createdAt');
    expect(player).toHaveProperty('handCount', 0);
  });
});

// ---------------------------------------------------------------------------
// getPlayerById
// ---------------------------------------------------------------------------

describe('getPlayerById', () => {
  it('returns the correct player for a valid playerId', async () => {
    await initDB();
    const playerId = await createPlayer({ name: 'Alice' }, 'testUser');
    const player = await getPlayerById(playerId);
    expect(player).not.toBeNull();
    expect(player.playerId).toBe(playerId);
    expect(player.name).toBe('Alice');
  });

  it('returns null for a non-existent playerId', async () => {
    await initDB();
    const result = await getPlayerById(99999);
    expect(result).toBeNull();
  });

  it('returns the correct player when multiple players exist', async () => {
    await initDB();
    const id1 = await createPlayer({ name: 'Alice' }, 'testUser');
    const id2 = await createPlayer({ name: 'Bob' }, 'testUser');

    const player1 = await getPlayerById(id1);
    const player2 = await getPlayerById(id2);

    expect(player1.name).toBe('Alice');
    expect(player2.name).toBe('Bob');
  });
});

// ---------------------------------------------------------------------------
// updatePlayer
// ---------------------------------------------------------------------------

describe('updatePlayer', () => {
  it('modifies the specified fields on the player', async () => {
    await initDB();
    const playerId = await createPlayer({ name: 'Alice' }, 'testUser');
    await updatePlayer(playerId, { name: 'Alice Updated', notes: 'Very aggressive' }, 'testUser');

    const updated = await getPlayerById(playerId);
    expect(updated.name).toBe('Alice Updated');
    expect(updated.notes).toBe('Very aggressive');
  });

  it('preserves fields that were not included in the update', async () => {
    await initDB();
    const playerId = await createPlayer({ name: 'Alice', notes: 'original note' }, 'testUser');
    await updatePlayer(playerId, { notes: 'new note' }, 'testUser');

    const updated = await getPlayerById(playerId);
    expect(updated.name).toBe('Alice');
    expect(updated.notes).toBe('new note');
  });

  it('throws when player is not found', async () => {
    await initDB();
    await expect(updatePlayer(99999, { name: 'Ghost' }, 'testUser')).rejects.toThrow(
      'Player 99999 not found'
    );
  });

  it('throws on duplicate name when another player already has that name', async () => {
    await initDB();
    await createPlayer({ name: 'Alice' }, 'testUser');
    const bobId = await createPlayer({ name: 'Bob' }, 'testUser');

    await expect(updatePlayer(bobId, { name: 'Alice' }, 'testUser')).rejects.toThrow(
      'Player with name "Alice" already exists'
    );
  });

  it('allows updating a player name to its own current name (no false duplicate)', async () => {
    await initDB();
    const playerId = await createPlayer({ name: 'Alice' }, 'testUser');
    // Updating to the same name should not throw
    await expect(updatePlayer(playerId, { name: 'Alice' }, 'testUser')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// deletePlayer
// ---------------------------------------------------------------------------

describe('deletePlayer', () => {
  it('removes the player so it can no longer be retrieved', async () => {
    await initDB();
    const playerId = await createPlayer({ name: 'Alice' }, 'testUser');
    await deletePlayer(playerId);
    const result = await getPlayerById(playerId);
    expect(result).toBeNull();
  });

  it('does not affect other players when one is deleted', async () => {
    await initDB();
    const aliceId = await createPlayer({ name: 'Alice' }, 'testUser');
    const bobId = await createPlayer({ name: 'Bob' }, 'testUser');

    await deletePlayer(aliceId);

    expect(await getPlayerById(aliceId)).toBeNull();
    expect(await getPlayerById(bobId)).not.toBeNull();
  });

  it('reduces the player count for the user', async () => {
    await initDB();
    const aliceId = await createPlayer({ name: 'Alice' }, 'testUser');
    await createPlayer({ name: 'Bob' }, 'testUser');

    let players = await getAllPlayers('testUser');
    expect(players).toHaveLength(2);

    await deletePlayer(aliceId);

    players = await getAllPlayers('testUser');
    expect(players).toHaveLength(1);
  });

  it('does not throw when deleting a non-existent playerId', async () => {
    await initDB();
    await expect(deletePlayer(99999)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getPlayerByName
// ---------------------------------------------------------------------------

describe('getPlayerByName', () => {
  it('returns the correct player for a known name', async () => {
    await initDB();
    const playerId = await createPlayer({ name: 'Alice' }, 'testUser');
    const player = await getPlayerByName('Alice', 'testUser');

    expect(player).not.toBeNull();
    expect(player.playerId).toBe(playerId);
    expect(player.name).toBe('Alice');
    expect(player.userId).toBe('testUser');
  });

  it('returns null for a name that does not exist', async () => {
    await initDB();
    const result = await getPlayerByName('Ghost', 'testUser');
    expect(result).toBeNull();
  });

  it('returns null when the name exists for a different userId', async () => {
    await initDB();
    await createPlayer({ name: 'Alice' }, 'otherUser');
    const result = await getPlayerByName('Alice', 'testUser');
    expect(result).toBeNull();
  });

  it('returns the correct player when multiple players share the store', async () => {
    await initDB();
    await createPlayer({ name: 'Alice' }, 'testUser');
    await createPlayer({ name: 'Bob' }, 'testUser');

    const alice = await getPlayerByName('Alice', 'testUser');
    const bob = await getPlayerByName('Bob', 'testUser');

    expect(alice.name).toBe('Alice');
    expect(bob.name).toBe('Bob');
  });

  it('returns null for an empty database', async () => {
    await initDB();
    const result = await getPlayerByName('Alice', 'testUser');
    expect(result).toBeNull();
  });
});
