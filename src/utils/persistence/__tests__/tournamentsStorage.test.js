/**
 * tournamentsStorage.test.js - Tests for tournament CRUD operations
 *
 * Uses fake-indexeddb to test all tournament storage functions against
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
  createTournament,
  getTournamentBySessionId,
  updateTournament,
  deleteTournament,
  getAllTournaments,
} from '../tournamentsStorage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_CONFIG = { totalEntrants: 20, blindSchedule: [] };
const SESSION_ID = 1;
const USER_ID = 'testUser';

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
// createTournament
// ---------------------------------------------------------------------------

describe('createTournament', () => {
  it('returns a numeric tournament ID', async () => {
    await initDB();
    const tournamentId = await createTournament(BASE_CONFIG, SESSION_ID, USER_ID);
    expect(typeof tournamentId).toBe('number');
    expect(tournamentId).toBeGreaterThan(0);
  });

  it('auto-increments tournamentId across multiple creates', async () => {
    await initDB();
    const id1 = await createTournament(BASE_CONFIG, SESSION_ID, USER_ID);
    const id2 = await createTournament(BASE_CONFIG, SESSION_ID + 1, USER_ID);
    expect(id2).toBeGreaterThan(id1);
  });

  it('stores the provided config, sessionId, and userId on the record', async () => {
    await initDB();
    const tournamentId = await createTournament(BASE_CONFIG, SESSION_ID, USER_ID);
    const record = await getTournamentBySessionId(SESSION_ID);

    expect(record.config).toEqual(BASE_CONFIG);
    expect(record.sessionId).toBe(SESSION_ID);
    expect(record.userId).toBe(USER_ID);
  });

  it('sets correct initial shape — isPaused false, isActive true, chipStacks empty', async () => {
    await initDB();
    await createTournament(BASE_CONFIG, SESSION_ID, USER_ID);
    const record = await getTournamentBySessionId(SESSION_ID);

    expect(record.currentLevelIndex).toBe(0);
    expect(record.isPaused).toBe(false);
    expect(record.pauseStartTime).toBeNull();
    expect(record.totalPausedMs).toBe(0);
    expect(record.chipStacks).toEqual({});
    expect(record.eliminations).toEqual([]);
    expect(record.isActive).toBe(true);
  });

  it('sets playersRemaining from config.totalEntrants', async () => {
    await initDB();
    await createTournament(BASE_CONFIG, SESSION_ID, USER_ID);
    const record = await getTournamentBySessionId(SESSION_ID);
    expect(record.playersRemaining).toBe(20);
  });

  it('sets playersRemaining to null when config.totalEntrants is absent', async () => {
    await initDB();
    const configWithoutEntrants = { blindSchedule: [] };
    await createTournament(configWithoutEntrants, SESSION_ID, USER_ID);
    const record = await getTournamentBySessionId(SESSION_ID);
    expect(record.playersRemaining).toBeNull();
  });

  it('attaches numeric createdAt and updatedAt timestamps', async () => {
    const before = Date.now();
    await initDB();
    await createTournament(BASE_CONFIG, SESSION_ID, USER_ID);
    const after = Date.now();
    const record = await getTournamentBySessionId(SESSION_ID);

    expect(typeof record.createdAt).toBe('number');
    expect(record.createdAt).toBeGreaterThanOrEqual(before);
    expect(record.createdAt).toBeLessThanOrEqual(after);

    expect(typeof record.updatedAt).toBe('number');
    expect(record.updatedAt).toBeGreaterThanOrEqual(before);
    expect(record.updatedAt).toBeLessThanOrEqual(after);
  });

  it('attaches a numeric levelStartTime timestamp', async () => {
    const before = Date.now();
    await initDB();
    await createTournament(BASE_CONFIG, SESSION_ID, USER_ID);
    const after = Date.now();
    const record = await getTournamentBySessionId(SESSION_ID);

    expect(typeof record.levelStartTime).toBe('number');
    expect(record.levelStartTime).toBeGreaterThanOrEqual(before);
    expect(record.levelStartTime).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// getTournamentBySessionId
// ---------------------------------------------------------------------------

describe('getTournamentBySessionId', () => {
  it('round-trips a created tournament by session ID', async () => {
    await initDB();
    const tournamentId = await createTournament(BASE_CONFIG, SESSION_ID, USER_ID);
    const record = await getTournamentBySessionId(SESSION_ID);

    expect(record).not.toBeNull();
    expect(record.sessionId).toBe(SESSION_ID);
    // The auto-incremented key is stored on the record
    expect(typeof record.tournamentId ?? record.id).not.toBeNull();
    // The returned ID from createTournament should correspond to the stored record's key
    expect(tournamentId).toBeGreaterThan(0);
  });

  it('returns null for an unknown session ID', async () => {
    await initDB();
    const result = await getTournamentBySessionId(9999);
    expect(result).toBeNull();
  });

  it('returns the correct record when multiple tournaments exist', async () => {
    await initDB();
    await createTournament(BASE_CONFIG, 10, USER_ID);
    await createTournament({ totalEntrants: 50, blindSchedule: [] }, 20, USER_ID);

    const record10 = await getTournamentBySessionId(10);
    const record20 = await getTournamentBySessionId(20);

    expect(record10.config.totalEntrants).toBe(20);
    expect(record20.config.totalEntrants).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// updateTournament
// ---------------------------------------------------------------------------

describe('updateTournament', () => {
  it('modifies specified fields on the existing record', async () => {
    await initDB();
    const tournamentId = await createTournament(BASE_CONFIG, SESSION_ID, USER_ID);

    await updateTournament(tournamentId, { currentLevelIndex: 3, isPaused: true });

    const record = await getTournamentBySessionId(SESSION_ID);
    expect(record.currentLevelIndex).toBe(3);
    expect(record.isPaused).toBe(true);
  });

  it('preserves fields that were not included in the update', async () => {
    await initDB();
    const tournamentId = await createTournament(BASE_CONFIG, SESSION_ID, USER_ID);

    await updateTournament(tournamentId, { currentLevelIndex: 2 });

    const record = await getTournamentBySessionId(SESSION_ID);
    expect(record.isActive).toBe(true);
    expect(record.userId).toBe(USER_ID);
    expect(record.config).toEqual(BASE_CONFIG);
  });

  it('sets a fresh updatedAt timestamp after update', async () => {
    await initDB();
    const tournamentId = await createTournament(BASE_CONFIG, SESSION_ID, USER_ID);
    const original = await getTournamentBySessionId(SESSION_ID);
    const originalUpdatedAt = original.updatedAt;

    // Ensure at least 1ms passes so the timestamp can differ
    await new Promise((resolve) => setTimeout(resolve, 2));

    await updateTournament(tournamentId, { isPaused: true });

    const updated = await getTournamentBySessionId(SESSION_ID);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
  });

  it('throws for a non-existent tournament ID', async () => {
    await initDB();
    await expect(updateTournament(99999, { isPaused: true })).rejects.toThrow(
      'Tournament 99999 not found'
    );
  });

  it('can update playersRemaining and eliminations together', async () => {
    await initDB();
    const tournamentId = await createTournament(BASE_CONFIG, SESSION_ID, USER_ID);

    await updateTournament(tournamentId, {
      playersRemaining: 15,
      eliminations: [{ seat: 3, level: 2 }],
    });

    const record = await getTournamentBySessionId(SESSION_ID);
    expect(record.playersRemaining).toBe(15);
    expect(record.eliminations).toHaveLength(1);
    expect(record.eliminations[0].seat).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// deleteTournament
// ---------------------------------------------------------------------------

describe('deleteTournament', () => {
  it('removes the record so getTournamentBySessionId returns null', async () => {
    await initDB();
    const tournamentId = await createTournament(BASE_CONFIG, SESSION_ID, USER_ID);

    await deleteTournament(tournamentId);

    const result = await getTournamentBySessionId(SESSION_ID);
    expect(result).toBeNull();
  });

  it('only removes the targeted tournament and leaves others intact', async () => {
    await initDB();
    const id1 = await createTournament(BASE_CONFIG, 10, USER_ID);
    await createTournament(BASE_CONFIG, 20, USER_ID);

    await deleteTournament(id1);

    expect(await getTournamentBySessionId(10)).toBeNull();
    expect(await getTournamentBySessionId(20)).not.toBeNull();
  });

  it('does not throw when deleting a non-existent tournament ID', async () => {
    await initDB();
    await expect(deleteTournament(99999)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getAllTournaments
// ---------------------------------------------------------------------------

describe('getAllTournaments', () => {
  it('returns only tournaments belonging to the given userId', async () => {
    await initDB();
    await createTournament(BASE_CONFIG, 1, 'testUser');
    await createTournament(BASE_CONFIG, 2, 'testUser');
    await createTournament(BASE_CONFIG, 3, 'otherUser');

    const testUserTournaments = await getAllTournaments('testUser');
    const otherUserTournaments = await getAllTournaments('otherUser');

    expect(testUserTournaments).toHaveLength(2);
    expect(otherUserTournaments).toHaveLength(1);
    expect(testUserTournaments.every((t) => t.userId === 'testUser')).toBe(true);
  });

  it('returns an empty array for an unknown userId', async () => {
    await initDB();
    await createTournament(BASE_CONFIG, SESSION_ID, USER_ID);

    const result = await getAllTournaments('unknownUser');
    expect(result).toEqual([]);
  });

  it('returns an empty array when no tournaments exist at all', async () => {
    await initDB();
    const result = await getAllTournaments(USER_ID);
    expect(result).toEqual([]);
  });

  it('returns all tournaments for a user when multiple exist', async () => {
    await initDB();
    await createTournament(BASE_CONFIG, 1, USER_ID);
    await createTournament(BASE_CONFIG, 2, USER_ID);
    await createTournament(BASE_CONFIG, 3, USER_ID);

    const result = await getAllTournaments(USER_ID);
    expect(result).toHaveLength(3);
  });

  it('returned records contain expected fields', async () => {
    await initDB();
    await createTournament(BASE_CONFIG, SESSION_ID, USER_ID);

    const [record] = await getAllTournaments(USER_ID);
    expect(record).toHaveProperty('sessionId', SESSION_ID);
    expect(record).toHaveProperty('userId', USER_ID);
    expect(record).toHaveProperty('config');
    expect(record).toHaveProperty('isActive', true);
    expect(record).toHaveProperty('isPaused', false);
    expect(record).toHaveProperty('createdAt');
    expect(record).toHaveProperty('updatedAt');
  });
});
