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

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

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
// WS-124 (2026-05-01): switched from initDB to getDB. initDB does not attach
// an onversionchange handler to the returned DB; the test held connections
// across tests, blocking subsequent indexedDB.deleteDatabase calls and causing
// 12 of 14 tests to time out at 5000ms / 10000ms. getDB attaches the handler
// (database.js:171-174) so deleteDatabase can close prior connections cleanly.
// Sister test refresherMigration.test.js uses getDB and works.
import { getDB } from '../database';
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
    const db = await getDB();
    expect(db.objectStoreNames.contains(TELEMETRY_CONSENT_STORE_NAME)).toBe(true);
  });

  it('seeds the guest record with default opt-out shape (firstLaunchSeenAt null, all categories ON)', async () => {
    await getDB();
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
    await getDB();
    closeDB();
    resetDBPool();

    const db = await getDB();
    expect(db.objectStoreNames.contains(TELEMETRY_CONSENT_STORE_NAME)).toBe(true);

    const record = await getTelemetryConsent(GUEST_USER_ID);
    expect(record).not.toBeNull();
    expect(record.userId).toBe(GUEST_USER_ID);
  });

  it('does not overwrite a pre-existing dismissal on re-open', async () => {
    await getDB();
    const dismissed = {
      userId: GUEST_USER_ID,
      firstLaunchSeenAt: '2026-04-26T10:00:00.000Z',
      categories: { usage: false, session_replay: false, error_tracking: true, feature_flags: true },
      schemaVersion: '1.0.0',
    };
    await putTelemetryConsent(dismissed);
    closeDB();
    resetDBPool();

    const db = await getDB();
    expect(db.objectStoreNames.contains(TELEMETRY_CONSENT_STORE_NAME)).toBe(true);

    const record = await getTelemetryConsent(GUEST_USER_ID);
    expect(record.firstLaunchSeenAt).toBe('2026-04-26T10:00:00.000Z');
    expect(record.categories.usage).toBe(false);
    expect(record.categories.session_replay).toBe(false);
  });
});

describe('migrateV21 — pre-v21 stores untouched', () => {
  it('preserves the settings store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains(SETTINGS_STORE_NAME)).toBe(true);
  });

  it('preserves the hands store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains(STORE_NAME)).toBe(true);
  });

  it('preserves the players store', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains(PLAYERS_STORE_NAME)).toBe(true);
  });
});

describe('telemetryConsentStore CRUD', () => {
  it('returns null for an unknown user', async () => {
    await getDB();
    const record = await getTelemetryConsent('non-existent-user');
    expect(record).toBeNull();
  });

  it('round-trips a written record', async () => {
    await getDB();
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
    await getDB();
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
    await getDB();
    await expect(putTelemetryConsent({ categories: {} })).rejects.toThrow(/userId/);
    await expect(putTelemetryConsent(null)).rejects.toThrow(/userId/);
  });

  it('deletes a record', async () => {
    await getDB();
    let r = await getTelemetryConsent(GUEST_USER_ID);
    expect(r).not.toBeNull();
    await deleteTelemetryConsent(GUEST_USER_ID);
    r = await getTelemetryConsent(GUEST_USER_ID);
    expect(r).toBeNull();
  });

  it('does not throw when deleting an unknown user', async () => {
    await getDB();
    await expect(deleteTelemetryConsent('does-not-exist')).resolves.toBeUndefined();
  });
});
