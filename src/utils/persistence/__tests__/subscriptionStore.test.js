// @vitest-environment jsdom
/**
 * subscriptionStore.test.js
 *
 * Tests for IDB v18 migration + subscriptionStore CRUD operations.
 * Verifies:
 *   - v17 → v18 migration creates the subscription store with seed record
 *   - Migration is idempotent (re-running on v18 doesn't duplicate seed)
 *   - v17 stores untouched (additive-only invariant)
 *   - getSubscription / putSubscription / deleteSubscription round-trip
 *
 * Uses fake-indexeddb (auto-imported in src/test/setup.js) for in-memory IDB.
 * Runs in jsdom env so database.js's `window.indexedDB` check resolves.
 *
 * MPMF G5-B1 (2026-04-25).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getSubscription,
  putSubscription,
  deleteSubscription,
} from '../subscriptionStore';
import {
  getDB,
  closeDB,
  resetDBPool,
  DB_NAME,
  DB_VERSION,
  SUBSCRIPTION_STORE_NAME,
  PLAYERS_STORE_NAME,
  STORE_NAME,
} from '../database';
import { GUEST_USER_ID } from '../../../constants/authConstants';

// Helper: wipe IDB completely between tests for clean migration runs
const deleteEntireDB = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
    req.onblocked = () => resolve(); // fake-indexeddb shouldn't block
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
  // MPMF G5-B1 introduced the subscription store at v18. EAL Phase 6 Stream D B3
  // (2026-04-25 S11) bumped DB_VERSION to 19 per gate4-p3-decisions.md §2 dynamic-target
  // pattern. The subscription store remains correctly migrated by the v18 hook within
  // the v18→v19 chain — this assertion just tracks the floor.
  it('is at v18 or later (subscription store is created at v18)', () => {
    expect(DB_VERSION).toBeGreaterThanOrEqual(18);
  });
});

describe('migrateV18 — fresh install', () => {
  it('creates the subscription store on initial open', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains(SUBSCRIPTION_STORE_NAME)).toBe(true);
  });

  it('seeds a guest record with default free-tier shape', async () => {
    await getDB();
    const record = await getSubscription(GUEST_USER_ID);
    expect(record).not.toBeNull();
    expect(record.userId).toBe(GUEST_USER_ID);
    expect(record.tier).toBe('free');
    expect(record.cohort).toBe('standard');
    expect(record.schemaVersion).toBe('1.0.0');
  });

  it('seeded record has nested cancellation/pendingPlanChange/cardDecline objects', async () => {
    await getDB();
    const record = await getSubscription(GUEST_USER_ID);
    expect(record.cancellation).toEqual({ isCancelled: false, canceledAt: null, accessThrough: null });
    expect(record.pendingPlanChange).toEqual({ isActive: false, targetTier: null, effectiveDate: null });
    expect(record.cardDecline).toEqual({ isActive: false, declinedAt: null, graceUntil: null });
  });
});

describe('migrateV18 — idempotency', () => {
  it('does not duplicate seed when re-opened at v18', async () => {
    // First open creates the store + seed
    await getDB();
    closeDB();
    resetDBPool();

    // Second open at same version should not re-run create or seed
    const db = await getDB();
    expect(db.objectStoreNames.contains(SUBSCRIPTION_STORE_NAME)).toBe(true);

    // Still exactly one record (the seed)
    const record = await getSubscription(GUEST_USER_ID);
    expect(record).not.toBeNull();
    expect(record.userId).toBe(GUEST_USER_ID);
  });
});

describe('migrateV18 — v17 stores untouched', () => {
  it('preserves existing players store post-migration', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains(PLAYERS_STORE_NAME)).toBe(true);
  });

  it('preserves existing hands store post-migration', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains(STORE_NAME)).toBe(true);
  });
});

describe('getSubscription', () => {
  it('returns null for a non-existent user', async () => {
    await getDB();
    const record = await getSubscription('non-existent-user');
    expect(record).toBeNull();
  });

  it('returns the seeded guest record', async () => {
    await getDB();
    const record = await getSubscription(GUEST_USER_ID);
    expect(record).not.toBeNull();
    expect(record.tier).toBe('free');
  });
});

describe('putSubscription', () => {
  it('creates a new record for a custom userId', async () => {
    await getDB();
    const record = {
      userId: 'test-user-1',
      tier: 'plus',
      cohort: 'standard',
      schemaVersion: '1.0.0',
    };
    await putSubscription(record);
    const fetched = await getSubscription('test-user-1');
    expect(fetched).toEqual(record);
  });

  it('replaces an existing record (full overwrite)', async () => {
    await getDB();
    const seed = await getSubscription(GUEST_USER_ID);
    const updated = { ...seed, tier: 'pro', billingCycle: 'monthly' };
    await putSubscription(updated);
    const fetched = await getSubscription(GUEST_USER_ID);
    expect(fetched.tier).toBe('pro');
    expect(fetched.billingCycle).toBe('monthly');
  });

  it('throws when userId is missing', async () => {
    await getDB();
    await expect(putSubscription({ tier: 'pro' })).rejects.toThrow(/userId/);
  });

  it('throws when record is null', async () => {
    await getDB();
    await expect(putSubscription(null)).rejects.toThrow(/userId/);
  });
});

describe('deleteSubscription', () => {
  it('removes the seeded guest record', async () => {
    await getDB();
    let record = await getSubscription(GUEST_USER_ID);
    expect(record).not.toBeNull();

    await deleteSubscription(GUEST_USER_ID);
    record = await getSubscription(GUEST_USER_ID);
    expect(record).toBeNull();
  });

  it('does not throw when deleting non-existent user', async () => {
    await getDB();
    await expect(deleteSubscription('non-existent')).resolves.toBeUndefined();
  });
});

describe('round-trip', () => {
  it('handles full subscription lifecycle (create → update → delete)', async () => {
    await getDB();

    // Create
    const initial = {
      userId: 'lifecycle-user',
      tier: 'free',
      cohort: 'standard',
      schemaVersion: '1.0.0',
    };
    await putSubscription(initial);
    expect(await getSubscription('lifecycle-user')).toEqual(initial);

    // Upgrade
    const upgraded = {
      ...initial,
      tier: 'pro',
      billingCycle: 'monthly',
      nextBillAt: '2026-05-25T00:00:00.000Z',
      nextBillAmount: 2900,
    };
    await putSubscription(upgraded);
    expect(await getSubscription('lifecycle-user')).toEqual(upgraded);

    // Cancel
    const cancelled = {
      ...upgraded,
      cancellation: {
        isCancelled: true,
        canceledAt: '2026-04-25T12:00:00.000Z',
        accessThrough: '2026-05-25T00:00:00.000Z',
      },
    };
    await putSubscription(cancelled);
    expect((await getSubscription('lifecycle-user')).cancellation.isCancelled).toBe(true);

    // Delete
    await deleteSubscription('lifecycle-user');
    expect(await getSubscription('lifecycle-user')).toBeNull();
  });
});
