// @vitest-environment jsdom
/**
 * migrationV21.test.js
 *
 * Tests for IDB v21 migration: creates the telemetryConsent object store
 * and seeds a guest record. Verifies:
 *   - Fresh install creates the store + seed.
 *   - Idempotency: re-open at v21 doesn't duplicate the seed or wipe a
 *     pre-existing dismissal.
 *   - v20 stores untouched (additive-only invariant).
 *   - Round-trip via getTelemetryConsent / putTelemetryConsent.
 *
 * MPMF G5-B2 (2026-04-26).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../errorHandler', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), action: vi.fn() },
  DEBUG: false,
}));

import {
  resetDBPool,
  closeDB,
  DB_NAME,
  DB_VERSION,
  TELEMETRY_CONSENT_STORE_NAME,
  SETTINGS_STORE_NAME,
  STORE_NAME,
  PLAYERS_STORE_NAME,
} from '../database';
import { initDB } from '../database';
import {
  getTelemetryConsent,
  putTelemetryConsent,
  deleteTelemetryConsent,
} from '../telemetryConsentStore';
import { GUEST_USER_ID } from '../../../constants/authConstants';

const deleteEntireDB = () =>
  new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
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
});

describe('DB_VERSION', () => {
  it('is at v21 or later (telemetryConsent store creation)', () => {
    expect(DB_VERSION).toBeGreaterThanOrEqual(21);
  });
});

describe('migrateV21 — fresh install', () => {
  it('creates the telemetryConsent store on initial open', async () => {
    const db = await initDB();
    expect(db.objectStoreNames.contains(TELEMETRY_CONSENT_STORE_NAME)).toBe(true);
  });

  it('seeds the guest record with default opt-out shape (firstLaunchSeenAt null, all categories ON)', async () => {
    await initDB();
    const record = await getTelemetryConsent(GUEST_USER_ID);
    expect(record).not.toBeNull();
    expect(record.userId).toBe(GUEST_USER_ID);
    expect(record.firstLaunchSeenAt).toBeNull();
    expect(record.categories).toEqual({
      usage: true,
      session_replay: true,
      error_tracking: true,
      feature_flags: true,
    });
    expect(record.schemaVersion).toBe('1.0.0');
  });
});

describe('migrateV21 — idempotency', () => {
  it('does not duplicate seed when re-opened at the same version', async () => {
    await initDB();
    closeDB();
    resetDBPool();

    const db = await initDB();
    expect(db.objectStoreNames.contains(TELEMETRY_CONSENT_STORE_NAME)).toBe(true);

    const record = await getTelemetryConsent(GUEST_USER_ID);
    expect(record).not.toBeNull();
    expect(record.userId).toBe(GUEST_USER_ID);
  });

  it('does not overwrite a pre-existing dismissal on re-open', async () => {
    await initDB();
    const dismissed = {
      userId: GUEST_USER_ID,
      firstLaunchSeenAt: '2026-04-26T10:00:00.000Z',
      categories: { usage: false, session_replay: false, error_tracking: true, feature_flags: true },
      schemaVersion: '1.0.0',
    };
    await putTelemetryConsent(dismissed);
    closeDB();
    resetDBPool();

    const db = await initDB();
    expect(db.objectStoreNames.contains(TELEMETRY_CONSENT_STORE_NAME)).toBe(true);

    const record = await getTelemetryConsent(GUEST_USER_ID);
    expect(record.firstLaunchSeenAt).toBe('2026-04-26T10:00:00.000Z');
    expect(record.categories.usage).toBe(false);
    expect(record.categories.session_replay).toBe(false);
  });
});

describe('migrateV21 — pre-v21 stores untouched', () => {
  it('preserves the settings store', async () => {
    const db = await initDB();
    expect(db.objectStoreNames.contains(SETTINGS_STORE_NAME)).toBe(true);
  });

  it('preserves the hands store', async () => {
    const db = await initDB();
    expect(db.objectStoreNames.contains(STORE_NAME)).toBe(true);
  });

  it('preserves the players store', async () => {
    const db = await initDB();
    expect(db.objectStoreNames.contains(PLAYERS_STORE_NAME)).toBe(true);
  });
});

describe('telemetryConsentStore CRUD', () => {
  it('returns null for an unknown user', async () => {
    await initDB();
    const record = await getTelemetryConsent('non-existent-user');
    expect(record).toBeNull();
  });

  it('round-trips a written record', async () => {
    await initDB();
    const record = {
      userId: 'test-user-1',
      firstLaunchSeenAt: '2026-04-26T11:00:00.000Z',
      categories: { usage: true, session_replay: false, error_tracking: true, feature_flags: false },
      schemaVersion: '1.0.0',
    };
    await putTelemetryConsent(record);
    const fetched = await getTelemetryConsent('test-user-1');
    expect(fetched).toEqual(record);
  });

  it('replaces an existing record on put', async () => {
    await initDB();
    await putTelemetryConsent({
      userId: 'lifecycle-user',
      firstLaunchSeenAt: null,
      categories: { usage: true, session_replay: true, error_tracking: true, feature_flags: true },
      schemaVersion: '1.0.0',
    });
    await putTelemetryConsent({
      userId: 'lifecycle-user',
      firstLaunchSeenAt: '2026-04-26T12:00:00.000Z',
      categories: { usage: false, session_replay: false, error_tracking: false, feature_flags: false },
      schemaVersion: '1.0.0',
    });
    const fetched = await getTelemetryConsent('lifecycle-user');
    expect(fetched.firstLaunchSeenAt).toBe('2026-04-26T12:00:00.000Z');
    expect(fetched.categories.usage).toBe(false);
  });

  it('throws when userId missing on put', async () => {
    await initDB();
    await expect(putTelemetryConsent({ categories: {} })).rejects.toThrow(/userId/);
    await expect(putTelemetryConsent(null)).rejects.toThrow(/userId/);
  });

  it('deletes a record', async () => {
    await initDB();
    let r = await getTelemetryConsent(GUEST_USER_ID);
    expect(r).not.toBeNull();
    await deleteTelemetryConsent(GUEST_USER_ID);
    r = await getTelemetryConsent(GUEST_USER_ID);
    expect(r).toBeNull();
  });

  it('does not throw when deleting an unknown user', async () => {
    await initDB();
    await expect(deleteTelemetryConsent('does-not-exist')).resolves.toBeUndefined();
  });
});
