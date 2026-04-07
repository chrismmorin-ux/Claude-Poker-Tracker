/**
 * settingsStorage.test.js - Tests for settings CRUD operations
 *
 * Uses fake-indexeddb to test all settings storage functions against
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
  getSettings,
  saveSettings,
  updateSettings,
  resetSettings,
  clearSettings,
} from '../settingsStorage';
import { DEFAULT_SETTINGS } from '../../../constants/settingsConstants';

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
// getSettings
// ---------------------------------------------------------------------------

describe('getSettings', () => {
  it('returns null when no settings exist', async () => {
    await initDB();
    const result = await getSettings('testUser');
    expect(result).toBeNull();
  });

  it('returns null for a different user when only another user has settings', async () => {
    await initDB();
    await saveSettings({ theme: 'light' }, 'otherUser');
    const result = await getSettings('testUser');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// saveSettings + getSettings round-trip
// ---------------------------------------------------------------------------

describe('saveSettings', () => {
  it('round-trips saved settings back via getSettings', async () => {
    await initDB();
    const settings = { theme: 'light', cardSize: 'large' };
    await saveSettings(settings, 'testUser');
    const result = await getSettings('testUser');
    expect(result).not.toBeNull();
    expect(result.theme).toBe('light');
    expect(result.cardSize).toBe('large');
  });

  it('getSettings strips the id field from the returned object', async () => {
    await initDB();
    await saveSettings({ theme: 'dark' }, 'testUser');
    const result = await getSettings('testUser');
    expect(result).not.toHaveProperty('id');
  });

  it('getSettings strips the userId field from the returned object', async () => {
    await initDB();
    await saveSettings({ theme: 'dark' }, 'testUser');
    const result = await getSettings('testUser');
    expect(result).not.toHaveProperty('userId');
  });

  it('overwrites existing settings on a second save (full replacement)', async () => {
    await initDB();
    await saveSettings({ theme: 'light', cardSize: 'small' }, 'testUser');
    await saveSettings({ theme: 'dark' }, 'testUser');
    const result = await getSettings('testUser');
    expect(result.theme).toBe('dark');
    // cardSize was not included in the second save — full replacement means it
    // is absent unless DEFAULT_SETTINGS provided it implicitly; the raw value
    // saved was only { theme: 'dark' } so cardSize should be undefined
    expect(result.cardSize).toBeUndefined();
  });

  it('adds an updatedAt timestamp to the saved record', async () => {
    const before = Date.now();
    await initDB();
    await saveSettings({ theme: 'dark' }, 'testUser');
    const after = Date.now();
    const result = await getSettings('testUser');
    expect(typeof result.updatedAt).toBe('number');
    expect(result.updatedAt).toBeGreaterThanOrEqual(before);
    expect(result.updatedAt).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// updateSettings
// ---------------------------------------------------------------------------

describe('updateSettings', () => {
  it('merges updates with existing settings', async () => {
    await initDB();
    await saveSettings({ theme: 'light', cardSize: 'small', autoBackupEnabled: false }, 'testUser');
    await updateSettings({ theme: 'dark' }, 'testUser');
    const result = await getSettings('testUser');
    expect(result.theme).toBe('dark');
    expect(result.cardSize).toBe('small');
    expect(result.autoBackupEnabled).toBe(false);
  });

  it('creates settings from DEFAULT_SETTINGS when no existing settings exist', async () => {
    await initDB();
    const returned = await updateSettings({ theme: 'light' }, 'testUser');
    // Should have merged with defaults — all DEFAULT_SETTINGS keys present
    expect(returned.theme).toBe('light');
    expect(returned).toHaveProperty('cardSize', DEFAULT_SETTINGS.cardSize);
    expect(returned).toHaveProperty('autoBackupEnabled', DEFAULT_SETTINGS.autoBackupEnabled);
  });

  it('adds updatedAt timestamp', async () => {
    const before = Date.now();
    await initDB();
    await updateSettings({ theme: 'dark' }, 'testUser');
    const after = Date.now();
    const result = await getSettings('testUser');
    expect(typeof result.updatedAt).toBe('number');
    expect(result.updatedAt).toBeGreaterThanOrEqual(before);
    expect(result.updatedAt).toBeLessThanOrEqual(after);
  });

  it('returns the merged settings object (without id/userId)', async () => {
    await initDB();
    const returned = await updateSettings({ theme: 'dark' }, 'testUser');
    expect(returned).not.toHaveProperty('id');
    expect(returned).not.toHaveProperty('userId');
    expect(returned.theme).toBe('dark');
  });

  it('overwrites only the specified fields and leaves others intact', async () => {
    await initDB();
    await saveSettings({ ...DEFAULT_SETTINGS, theme: 'light', cardSize: 'large' }, 'testUser');
    await updateSettings({ cardSize: 'small' }, 'testUser');
    const result = await getSettings('testUser');
    expect(result.cardSize).toBe('small');
    expect(result.theme).toBe('light');
  });
});

// ---------------------------------------------------------------------------
// resetSettings
// ---------------------------------------------------------------------------

describe('resetSettings', () => {
  it('saves DEFAULT_SETTINGS, overwriting any existing settings', async () => {
    await initDB();
    await saveSettings({ theme: 'light', cardSize: 'large', autoBackupEnabled: true }, 'testUser');
    await resetSettings('testUser');
    const result = await getSettings('testUser');
    expect(result.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(result.cardSize).toBe(DEFAULT_SETTINGS.cardSize);
    expect(result.autoBackupEnabled).toBe(DEFAULT_SETTINGS.autoBackupEnabled);
  });

  it('creates a settings record from defaults when none existed before', async () => {
    await initDB();
    await resetSettings('testUser');
    const result = await getSettings('testUser');
    expect(result).not.toBeNull();
    expect(result.theme).toBe(DEFAULT_SETTINGS.theme);
  });

  it('resolves without error when called on a fresh database', async () => {
    await initDB();
    await expect(resetSettings('testUser')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// clearSettings
// ---------------------------------------------------------------------------

describe('clearSettings', () => {
  it('removes the settings record so getSettings returns null afterwards', async () => {
    await initDB();
    await saveSettings({ theme: 'dark' }, 'testUser');
    await clearSettings('testUser');
    const result = await getSettings('testUser');
    expect(result).toBeNull();
  });

  it('resolves without error when no settings exist to clear', async () => {
    await initDB();
    await expect(clearSettings('testUser')).resolves.toBeUndefined();
  });

  it('does not remove settings belonging to a different user', async () => {
    await initDB();
    await saveSettings({ theme: 'light' }, 'testUser');
    await saveSettings({ theme: 'dark' }, 'otherUser');
    await clearSettings('testUser');
    const otherResult = await getSettings('otherUser');
    expect(otherResult).not.toBeNull();
    expect(otherResult.theme).toBe('dark');
  });
});

// ---------------------------------------------------------------------------
// User isolation
// ---------------------------------------------------------------------------

describe('user isolation', () => {
  it('different users have completely independent settings', async () => {
    await initDB();
    await saveSettings({ theme: 'light', cardSize: 'small' }, 'testUser');
    await saveSettings({ theme: 'dark', cardSize: 'large' }, 'otherUser');

    const testUserSettings = await getSettings('testUser');
    const otherUserSettings = await getSettings('otherUser');

    expect(testUserSettings.theme).toBe('light');
    expect(testUserSettings.cardSize).toBe('small');
    expect(otherUserSettings.theme).toBe('dark');
    expect(otherUserSettings.cardSize).toBe('large');
  });

  it('updating one user does not affect another user', async () => {
    await initDB();
    await saveSettings({ theme: 'light' }, 'testUser');
    await saveSettings({ theme: 'light' }, 'otherUser');

    await updateSettings({ theme: 'dark' }, 'testUser');

    const testUserSettings = await getSettings('testUser');
    const otherUserSettings = await getSettings('otherUser');

    expect(testUserSettings.theme).toBe('dark');
    expect(otherUserSettings.theme).toBe('light');
  });

  it('settings key uses settings_${userId} pattern (verified by isolation)', async () => {
    await initDB();
    // If keying were broken, 'testUser' and 'guest' would collide
    await saveSettings({ theme: 'light' }, 'testUser');
    await saveSettings({ theme: 'dark' }, 'guest');

    const testUserResult = await getSettings('testUser');
    const guestResult = await getSettings('guest');

    expect(testUserResult.theme).toBe('light');
    expect(guestResult.theme).toBe('dark');
  });
});
