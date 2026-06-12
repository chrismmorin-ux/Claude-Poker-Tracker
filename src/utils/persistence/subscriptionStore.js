/**
 * subscriptionStore.js — IDB CRUD for the Monetization & PMF subscription store
 *
 * Provides read + write operations for the v18 `subscription` IDB store.
 * Single record per install (keyPath: userId).
 *
 * MPMF G5-B1 (2026-04-25): authored as part of entitlement foundation batch.
 * Architecture: `docs/projects/monetization-and-pmf/entitlement-architecture.md`
 * WRITERS: `docs/projects/monetization-and-pmf/WRITERS.md` §subscription store
 *
 * Writer registry (WRITERS.md I-WR-1):
 *   W-SUB-1 — migration-seed (in migrations.js migrateV18)
 *   W-SUB-2 — payment-success-callback (Phase 5+ webhook handler — TBD)
 *   W-SUB-3 — cancellation-writer (Phase 5+ from cancellation journey J3)
 *   W-SUB-4 — plan-change-writer (Phase 5+ from plan-change journey J4)
 *   W-SUB-5 — dev-override-writer (dev-only)
 *
 * The functions in this file (`putSubscription`, `getSubscription`) are
 * the low-level IDB primitives the writers compose with. The persistence
 * hook calls them on hydration + debounced state-change writes.
 */

import {
  readTx,
  writeTx,
  SUBSCRIPTION_STORE_NAME,
  GUEST_USER_ID,
  log,
  logError,
} from './database';

/**
 * Read the subscription record for a given user.
 *
 * @param {string} userId - User ID (defaults to GUEST_USER_ID)
 * @returns {Promise<Object|null>} Subscription record or null if not found
 */
export const getSubscription = async (userId = GUEST_USER_ID) => {
  try {
    const record = await readTx(SUBSCRIPTION_STORE_NAME, (store) => store.get(userId));
    log(record
      ? `Subscription loaded for user ${userId}`
      : `No subscription found for user ${userId}`);
    return record ?? null;
  } catch (error) {
    logError('Error in getSubscription:', error);
    throw error;
  }
};

/**
 * Write (create or replace) the subscription record for a given user.
 *
 * The record's `userId` field is required and used as the keypath. Callers
 * should pass the full state object (per WRITERS.md schema) — partial
 * updates are not supported at this layer.
 *
 * @param {Object} record - Full subscription record (must include userId)
 * @returns {Promise<void>}
 */
export const putSubscription = async (record) => {
  if (!record || !record.userId) {
    throw new Error('putSubscription requires a record with a userId field');
  }
  try {
    await writeTx(SUBSCRIPTION_STORE_NAME, (store) => store.put(record));
    log(`Subscription saved for user ${record.userId}`);
  } catch (error) {
    logError('Error in putSubscription:', error);
    throw error;
  }
};

/**
 * Delete the subscription record for a given user.
 *
 * Reserved for testing + dev-mode reset flows. Production cancellation does
 * NOT delete the record — it sets `cancellation.isCancelled = true` per
 * WRITERS.md W-SUB-3 (preserves historical Stripe IDs for audit trail).
 *
 * @param {string} userId - User ID (defaults to GUEST_USER_ID)
 * @returns {Promise<void>}
 */
export const deleteSubscription = async (userId = GUEST_USER_ID) => {
  try {
    await writeTx(SUBSCRIPTION_STORE_NAME, (store) => store.delete(userId));
    log(`Subscription deleted for user ${userId}`);
  } catch (error) {
    logError('Error in deleteSubscription:', error);
    throw error;
  }
};
