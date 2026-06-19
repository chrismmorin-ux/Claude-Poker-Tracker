// @vitest-environment jsdom
/**
 * migrateGuestData.test.js — verifies the one-time guest→account merge:
 * re-key (not copy), id + reference preservation, idempotence, non-destruction, guards.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('../../errorHandler', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), action: vi.fn() },
  AppError: class AppError extends Error {
    constructor(code, message) { super(`[${code}] ${message}`); this.code = code; }
  },
  ERROR_CODES: { DB_INIT_FAILED: 'E301', SAVE_FAILED: 'E302', LOAD_FAILED: 'E303' },
}));

import {
  saveHand, getAllHands, createSession, getAllSessions, createPlayer, getAllPlayers,
} from '../index';
import { resetDBPool } from '../database';
import { migrateGuestDataToUser } from '../migrateGuestData';

const GUEST = 'guest';
const UID = 'firebase-uid-123';

const validHand = (overrides = {}) => ({
  timestamp: Date.now(),
  gameState: { currentStreet: 'preflop', dealerButtonSeat: 1, mySeat: 5, ...overrides.gameState },
  cardState: { communityCards: ['', '', '', '', ''], holeCards: ['', ''], ...overrides.cardState },
  ...overrides,
});

describe('migrateGuestDataToUser', () => {
  beforeEach(async () => {
    resetDBPool(); // close cached connection so deleteDatabase isn't blocked (WS-126)
    await new Promise((resolve, reject) => {
      const r = indexedDB.deleteDatabase('PokerTrackerDB');
      r.onsuccess = () => resolve();
      r.onblocked = () => resolve(); // proceed even if a stale handle lingers
      r.onerror = () => reject(r.error);
    });
    // No direct initDB() — the CRUD/migration lazily init via getDB (a managed,
    // resetDBPool-closable connection). A direct initDB() would leak an unmanaged
    // handle that blocks the next deleteDatabase.
  });

  afterEach(() => { resetDBPool(); });

  it('moves guest sessions/hands/players to the account, preserving ids + references', async () => {
    // Guest-owned data (created while signed out)
    const gP1 = await createPlayer({ name: 'Villain A' }, GUEST);
    const gP2 = await createPlayer({ name: 'Villain B' }, GUEST);
    await createSession({ venue: 'Bellagio' }, GUEST);
    await createSession({ venue: 'Aria' }, GUEST);
    const gH1 = await saveHand(validHand({ seatPlayers: { 1: gP1, 2: gP2 } }), GUEST);
    await saveHand(validHand({ seatPlayers: { 3: gP1 } }), GUEST);

    // Pre-existing account data (e.g. tonight's online session under the Firebase UID)
    await createPlayer({ name: 'Online Villain' }, UID);
    await createSession({ venue: 'Ignition' }, UID);
    await saveHand(validHand(), UID);

    const res = await migrateGuestDataToUser(UID);

    expect(res.migrated).toBe(true);
    expect(res.total).toBe(6); // 2 players + 2 sessions + 2 hands

    // Guest drawer now empty
    expect(await getAllHands(GUEST)).toHaveLength(0);
    expect(await getAllSessions(GUEST)).toHaveLength(0);
    expect(await getAllPlayers(GUEST)).toHaveLength(0);

    // Account now holds moved + pre-existing
    expect(await getAllHands(UID)).toHaveLength(3);
    expect(await getAllSessions(UID)).toHaveLength(3);
    expect(await getAllPlayers(UID)).toHaveLength(3);

    // Ids preserved → references intact (re-key, not copy)
    const movedHand = (await getAllHands(UID)).find((h) => h.handId === gH1);
    expect(movedHand).toBeTruthy();
    expect(movedHand.seatPlayers).toEqual({ 1: gP1, 2: gP2 });
    const uidPlayerIds = (await getAllPlayers(UID)).map((p) => p.playerId);
    expect(uidPlayerIds).toEqual(expect.arrayContaining([gP1, gP2]));
  });

  it('is idempotent — a second run moves nothing and changes nothing', async () => {
    await createPlayer({ name: 'X' }, GUEST);
    await saveHand(validHand(), GUEST);
    await createSession({}, GUEST);

    await migrateGuestDataToUser(UID);
    const second = await migrateGuestDataToUser(UID);

    expect(second.total).toBe(0);
    expect(second.migrated).toBe(false);
    expect(await getAllPlayers(UID)).toHaveLength(1);
    expect(await getAllHands(UID)).toHaveLength(1);
    expect(await getAllSessions(UID)).toHaveLength(1);
  });

  it('no-ops for a guest/empty target (never re-keys to itself)', async () => {
    await createPlayer({ name: 'X' }, GUEST);
    expect((await migrateGuestDataToUser(GUEST)).migrated).toBe(false);
    expect((await migrateGuestDataToUser(null)).migrated).toBe(false);
    expect((await migrateGuestDataToUser(undefined)).reason).toBe('no-target');
    // guest data untouched
    expect(await getAllPlayers(GUEST)).toHaveLength(1);
  });
});
