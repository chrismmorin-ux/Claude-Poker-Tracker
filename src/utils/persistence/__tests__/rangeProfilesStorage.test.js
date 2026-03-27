/**
 * rangeProfilesStorage.test.js - Tests for range profile CRUD operations
 *
 * Uses fake-indexeddb to test all range profile storage functions against
 * a real IndexedDB schema without browser dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

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
  saveRangeProfile,
  getRangeProfile,
  deleteRangeProfile,
  getAllRangeProfiles,
} from '../rangeProfilesStorage';
import { createEmptyProfile, RANGE_POSITIONS, RANGE_ACTIONS } from '../../rangeEngine/rangeProfile';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLAYER_ID = 42;
const USER_ID = 'testUser';
const OTHER_USER_ID = 'otherUser';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  globalThis.window = { indexedDB: globalThis.indexedDB };
});

afterEach(() => {
  delete globalThis.window;
});

// ---------------------------------------------------------------------------
// saveRangeProfile + getRangeProfile — round-trip
// ---------------------------------------------------------------------------

describe('saveRangeProfile + getRangeProfile', () => {
  it('round-trip preserves core profile fields', async () => {
    await initDB();
    const profile = createEmptyProfile(PLAYER_ID, USER_ID);

    await saveRangeProfile(profile, USER_ID);
    const loaded = await getRangeProfile(PLAYER_ID, USER_ID);

    expect(loaded).not.toBeNull();
    expect(loaded.playerId).toBe(PLAYER_ID);
    expect(loaded.userId).toBe(USER_ID);
    expect(loaded.profileKey).toBe(`${USER_ID}_${PLAYER_ID}`);
    expect(loaded.handsProcessed).toBe(0);
    expect(loaded.showdownAnchors).toEqual([]);
  });

  it('returns Float64Array instances for all range grids after deserialization', async () => {
    await initDB();
    const profile = createEmptyProfile(PLAYER_ID, USER_ID);

    await saveRangeProfile(profile, USER_ID);
    const loaded = await getRangeProfile(PLAYER_ID, USER_ID);

    for (const pos of RANGE_POSITIONS) {
      for (const action of RANGE_ACTIONS) {
        expect(loaded.ranges[pos][action]).toBeInstanceOf(Float64Array);
        expect(loaded.ranges[pos][action]).toHaveLength(169);
      }
    }
  });

  it('returns null for a profile that has never been saved', async () => {
    await initDB();
    const result = await getRangeProfile(99999, USER_ID);
    expect(result).toBeNull();
  });

  it('upserts — second save overwrites first, get returns latest values', async () => {
    await initDB();
    const profile = createEmptyProfile(PLAYER_ID, USER_ID);

    await saveRangeProfile(profile, USER_ID);

    // Mutate and save again
    const updated = { ...profile, handsProcessed: 17 };
    await saveRangeProfile(updated, USER_ID);

    const loaded = await getRangeProfile(PLAYER_ID, USER_ID);
    expect(loaded.handsProcessed).toBe(17);
  });

  it('preserves non-zero range cell values through serialize/deserialize', async () => {
    await initDB();
    const profile = createEmptyProfile(PLAYER_ID, USER_ID);

    // Set several cells to known values
    profile.ranges['EARLY']['open'][0] = 0.75;
    profile.ranges['EARLY']['open'][100] = 0.42;
    profile.ranges['BB']['fold'][168] = 0.99;

    await saveRangeProfile(profile, USER_ID);
    const loaded = await getRangeProfile(PLAYER_ID, USER_ID);

    expect(loaded.ranges['EARLY']['open'][0]).toBeCloseTo(0.75);
    expect(loaded.ranges['EARLY']['open'][100]).toBeCloseTo(0.42);
    expect(loaded.ranges['BB']['fold'][168]).toBeCloseTo(0.99);
  });

  it('preserves all 169 cells in a grid after round-trip', async () => {
    await initDB();
    const profile = createEmptyProfile(PLAYER_ID, USER_ID);

    // Fill one entire grid with known values
    for (let i = 0; i < 169; i++) {
      profile.ranges['MIDDLE']['limp'][i] = i / 168;
    }

    await saveRangeProfile(profile, USER_ID);
    const loaded = await getRangeProfile(PLAYER_ID, USER_ID);

    for (let i = 0; i < 169; i++) {
      expect(loaded.ranges['MIDDLE']['limp'][i]).toBeCloseTo(i / 168, 10);
    }
  });

  it('preserves actionCounts and opportunities through round-trip', async () => {
    await initDB();
    const profile = createEmptyProfile(PLAYER_ID, USER_ID);
    profile.actionCounts['LATE']['open'] = 12;
    profile.opportunities['LATE'].total = 30;

    await saveRangeProfile(profile, USER_ID);
    const loaded = await getRangeProfile(PLAYER_ID, USER_ID);

    expect(loaded.actionCounts['LATE']['open']).toBe(12);
    expect(loaded.opportunities['LATE'].total).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// deleteRangeProfile
// ---------------------------------------------------------------------------

describe('deleteRangeProfile', () => {
  it('removes the profile so getRangeProfile returns null afterward', async () => {
    await initDB();
    const profile = createEmptyProfile(PLAYER_ID, USER_ID);

    await saveRangeProfile(profile, USER_ID);
    await deleteRangeProfile(PLAYER_ID, USER_ID);

    const result = await getRangeProfile(PLAYER_ID, USER_ID);
    expect(result).toBeNull();
  });

  it('resolves without error when deleting a profile that does not exist', async () => {
    await initDB();
    await expect(deleteRangeProfile(99999, USER_ID)).resolves.toBeUndefined();
  });

  it('only removes the targeted profile and leaves others intact', async () => {
    await initDB();
    const profile1 = createEmptyProfile(PLAYER_ID, USER_ID);
    const profile2 = createEmptyProfile(PLAYER_ID + 1, USER_ID);

    await saveRangeProfile(profile1, USER_ID);
    await saveRangeProfile(profile2, USER_ID);

    await deleteRangeProfile(PLAYER_ID, USER_ID);

    expect(await getRangeProfile(PLAYER_ID, USER_ID)).toBeNull();
    expect(await getRangeProfile(PLAYER_ID + 1, USER_ID)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getAllRangeProfiles
// ---------------------------------------------------------------------------

describe('getAllRangeProfiles', () => {
  it('returns an empty array when no profiles exist for the user', async () => {
    await initDB();
    const result = await getAllRangeProfiles(USER_ID);
    expect(result).toEqual([]);
  });

  it('returns an empty array for an unrecognized userId', async () => {
    await initDB();
    const profile = createEmptyProfile(PLAYER_ID, USER_ID);
    await saveRangeProfile(profile, USER_ID);

    const result = await getAllRangeProfiles('nobody');
    expect(result).toEqual([]);
  });

  it('returns only profiles belonging to the requested userId', async () => {
    await initDB();
    const ownProfile = createEmptyProfile(PLAYER_ID, USER_ID);
    const otherProfile = createEmptyProfile(PLAYER_ID, OTHER_USER_ID);

    await saveRangeProfile(ownProfile, USER_ID);
    await saveRangeProfile(otherProfile, OTHER_USER_ID);

    const result = await getAllRangeProfiles(USER_ID);
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe(USER_ID);
  });

  it('returns all profiles for a user when multiple exist', async () => {
    await initDB();
    await saveRangeProfile(createEmptyProfile(1, USER_ID), USER_ID);
    await saveRangeProfile(createEmptyProfile(2, USER_ID), USER_ID);
    await saveRangeProfile(createEmptyProfile(3, USER_ID), USER_ID);

    const result = await getAllRangeProfiles(USER_ID);
    expect(result).toHaveLength(3);
  });

  it('returns deserialized profiles with Float64Array ranges', async () => {
    await initDB();
    const profile = createEmptyProfile(PLAYER_ID, USER_ID);
    await saveRangeProfile(profile, USER_ID);

    const [loaded] = await getAllRangeProfiles(USER_ID);
    for (const pos of RANGE_POSITIONS) {
      for (const action of RANGE_ACTIONS) {
        expect(loaded.ranges[pos][action]).toBeInstanceOf(Float64Array);
      }
    }
  });

  it('does not return profiles that were deleted', async () => {
    await initDB();
    await saveRangeProfile(createEmptyProfile(PLAYER_ID, USER_ID), USER_ID);
    await saveRangeProfile(createEmptyProfile(PLAYER_ID + 1, USER_ID), USER_ID);

    await deleteRangeProfile(PLAYER_ID, USER_ID);

    const result = await getAllRangeProfiles(USER_ID);
    expect(result).toHaveLength(1);
    expect(result[0].playerId).toBe(PLAYER_ID + 1);
  });
});

// ---------------------------------------------------------------------------
// Cross-user isolation
// ---------------------------------------------------------------------------

describe('cross-user isolation', () => {
  it('same playerId under different userIds are stored independently', async () => {
    await initDB();
    const profileA = createEmptyProfile(PLAYER_ID, USER_ID);
    const profileB = createEmptyProfile(PLAYER_ID, OTHER_USER_ID);

    profileA.handsProcessed = 5;
    profileB.handsProcessed = 99;

    await saveRangeProfile(profileA, USER_ID);
    await saveRangeProfile(profileB, OTHER_USER_ID);

    const loadedA = await getRangeProfile(PLAYER_ID, USER_ID);
    const loadedB = await getRangeProfile(PLAYER_ID, OTHER_USER_ID);

    expect(loadedA.handsProcessed).toBe(5);
    expect(loadedB.handsProcessed).toBe(99);
    expect(loadedA.profileKey).toBe(`${USER_ID}_${PLAYER_ID}`);
    expect(loadedB.profileKey).toBe(`${OTHER_USER_ID}_${PLAYER_ID}`);
  });

  it('deleting a profile for one user does not affect the same playerId for another user', async () => {
    await initDB();
    await saveRangeProfile(createEmptyProfile(PLAYER_ID, USER_ID), USER_ID);
    await saveRangeProfile(createEmptyProfile(PLAYER_ID, OTHER_USER_ID), OTHER_USER_ID);

    await deleteRangeProfile(PLAYER_ID, USER_ID);

    expect(await getRangeProfile(PLAYER_ID, USER_ID)).toBeNull();
    expect(await getRangeProfile(PLAYER_ID, OTHER_USER_ID)).not.toBeNull();
  });

  it('getAllRangeProfiles for one user is unaffected by profiles belonging to another', async () => {
    await initDB();
    await saveRangeProfile(createEmptyProfile(1, USER_ID), USER_ID);
    await saveRangeProfile(createEmptyProfile(2, USER_ID), USER_ID);
    await saveRangeProfile(createEmptyProfile(1, OTHER_USER_ID), OTHER_USER_ID);
    await saveRangeProfile(createEmptyProfile(2, OTHER_USER_ID), OTHER_USER_ID);
    await saveRangeProfile(createEmptyProfile(3, OTHER_USER_ID), OTHER_USER_ID);

    const userResults = await getAllRangeProfiles(USER_ID);
    const otherResults = await getAllRangeProfiles(OTHER_USER_ID);

    expect(userResults).toHaveLength(2);
    expect(otherResults).toHaveLength(3);
    expect(userResults.every((p) => p.userId === USER_ID)).toBe(true);
    expect(otherResults.every((p) => p.userId === OTHER_USER_ID)).toBe(true);
  });
});
