/**
 * shared/storage-writer.js — Session storage queue for hand delivery
 *
 * Writes completed hand records to chrome.storage.session as a delivery queue.
 * The app-bridge content script listens via chrome.storage.onChanged and forwards
 * hands to the React app. This bypasses the service worker entirely, making hand
 * delivery immune to MV3 SW suspension.
 *
 * Callable from any extension context (content scripts, SW).
 */

import { SESSION_KEYS } from './constants.js';
import * as errors from './error-reporter.js';

// Track whether storage access has been lost (context invalidated).
// Once true, all storage operations silently no-op instead of flooding console.
let _storageDead = false;
const _checkStorage = () => {
  if (_storageDead) return false;
  try {
    if (!chrome?.storage?.session) { _storageDead = true; return false; }
    return true;
  } catch (_) { _storageDead = true; return false; }
};

const QUEUE_KEY = SESSION_KEYS.HAND_QUEUE;
const SEQ_KEY = SESSION_KEYS.HAND_QUEUE_SEQ;
export const MAX_QUEUE = 100;

// Cross-tab lock names — navigator.locks provides mutual exclusion across
// all extension contexts (content scripts, SW) sharing the same origin.
const QUEUE_LOCK = 'poker_hand_queue_lock';

/**
 * Generate a deterministic capture ID from hand content.
 * Same hand always produces the same ID (dedup key).
 */
const generateCaptureId = (handRecord) => {
  const handNum = handRecord.ignitionMeta?.handNumber || Date.now();
  const tableId = handRecord.tableId || 'unknown';
  return `${tableId}_${handNum}`;
};

/**
 * Enqueue a completed hand for delivery to the app.
 * Uses navigator.locks for cross-tab serialization (safe with multi-table).
 * @param {Object} handRecord - Validated hand record from the state machine
 * @returns {Promise<{ success: boolean, queueLength: number }>}
 */
export const enqueueHand = (handRecord) => {
  if (!_checkStorage()) return Promise.resolve({ success: false, queueLength: -1 });
  return navigator.locks.request(QUEUE_LOCK, async () => {
    try {
      const result = await chrome.storage.session.get([QUEUE_KEY, SEQ_KEY]);
      const queue = result[QUEUE_KEY] || [];
      const seq = (result[SEQ_KEY] || 0) + 1;

      handRecord.captureId = generateCaptureId(handRecord);
      handRecord.capturedAt = Date.now();
      handRecord._seq = seq;

      // Dedup by captureId
      if (queue.some(h => h.captureId === handRecord.captureId)) {
        return { success: true, queueLength: queue.length, duplicate: true };
      }

      queue.push(handRecord);

      // Enforce max queue size — evict oldest
      if (queue.length > MAX_QUEUE) {
        queue.splice(0, queue.length - MAX_QUEUE);
      }

      await chrome.storage.session.set({ [QUEUE_KEY]: queue, [SEQ_KEY]: seq });
      return { success: true, queueLength: queue.length };
    } catch (e) {
      if (!_storageDead) errors.report('storage', e, { op: 'enqueue' });
      return { success: false, queueLength: -1 };
    }
  });
};

/**
 * Remove delivered hands from the queue.
 * Called by app-bridge after forwarding hands to the React app.
 * @param {string[]} captureIds - IDs of hands to remove
 * @returns {Promise<number>} Number of hands removed
 */
export const dequeueHands = (captureIds) => {
  if (!captureIds || captureIds.length === 0) return Promise.resolve(0);
  const idSet = new Set(captureIds);

  return navigator.locks.request(QUEUE_LOCK, async () => {
    try {
      const result = await chrome.storage.session.get(QUEUE_KEY);
      const queue = result[QUEUE_KEY] || [];
      const kept = queue.filter(h => !idSet.has(h.captureId));
      const removed = queue.length - kept.length;
      if (removed > 0) {
        await chrome.storage.session.set({ [QUEUE_KEY]: kept });
      }
      return removed;
    } catch (e) {
      if (!_storageDead) errors.report('storage', e, { op: 'dequeue' });
      return 0;
    }
  });
};

/**
 * Get all queued hands (for cold-start drain or diagnostics).
 * @returns {Promise<Object[]>}
 */
export const getQueuedHands = async () => {
  try {
    const result = await chrome.storage.session.get(QUEUE_KEY);
    return result[QUEUE_KEY] || [];
  } catch (e) {
    if (!_storageDead) errors.report('storage', e, { op: 'readQueue' });
    return [];
  }
};

/**
 * Get queue length without loading all hand data.
 * @returns {Promise<number>}
 */
export const getQueueLength = async () => {
  try {
    const result = await chrome.storage.session.get(QUEUE_KEY);
    return (result[QUEUE_KEY] || []).length;
  } catch (e) {
    return 0;
  }
};

/**
 * Clear the delivery queue.
 * @returns {Promise<void>}
 */
export const clearQueue = async () => {
  await chrome.storage.session.set({ [QUEUE_KEY]: [], [SEQ_KEY]: 0 });
};

// ============================================================================
// SIDE PANEL HANDS — persistent mirror for HUD stats (not drained by ACK)
// ============================================================================

const SIDE_PANEL_KEY = SESSION_KEYS.SIDE_PANEL_HANDS;
const MAX_SIDE_PANEL_HANDS = 200;

/**
 * Append a completed hand to the side panel mirror.
 * Unlike the delivery queue, this store is never drained — hands persist
 * for the entire browser session so the side panel can compute stats
 * even after the app has ACK'd and dequeued the delivery copies.
 *
 * No lock needed: single writer (ignition-capture.js content script).
 * @param {Object} handRecord - Validated hand record (must have captureId)
 * @returns {Promise<void>}
 */
export const appendSidePanelHand = async (handRecord) => {
  if (!_checkStorage()) return;
  try {
    const result = await chrome.storage.session.get(SIDE_PANEL_KEY);
    const hands = result[SIDE_PANEL_KEY] || [];

    // Dedup by captureId
    if (hands.some(h => h.captureId === handRecord.captureId)) return;

    hands.push(handRecord);

    // Cap at max — evict oldest
    if (hands.length > MAX_SIDE_PANEL_HANDS) {
      hands.splice(0, hands.length - MAX_SIDE_PANEL_HANDS);
    }

    await chrome.storage.session.set({ [SIDE_PANEL_KEY]: hands });
  } catch (e) {
    if (!_storageDead) errors.report('storage', e, { op: 'sidePanelAppend' });
  }
};

/**
 * Read all side panel hands (for stats computation on panel open).
 * @returns {Promise<Object[]>}
 */
export const getSidePanelHands = async () => {
  try {
    const result = await chrome.storage.session.get(SIDE_PANEL_KEY);
    return result[SIDE_PANEL_KEY] || [];
  } catch (e) {
    if (!_storageDead) errors.report('storage', e, { op: 'sidePanelRead' });
    return [];
  }
};

// ============================================================================
// LIVE CONTEXT — in-progress hand state (throttled, single-key overwrite)
// ============================================================================

const LIVE_CONTEXT_KEY = SESSION_KEYS.LIVE_CONTEXT;
const LIVE_CONTEXT_THROTTLE = 200;
let liveContextPending = null;
let liveContextTimer = null;

/**
 * Write live hand context to session storage (throttled).
 * Only the latest context matters — older writes are dropped.
 * @param {Object} context - From HandStateMachine.getLiveHandContext()
 */
export const writeLiveContext = (context) => {
  if (!_checkStorage()) return;
  liveContextPending = context;
  if (!liveContextTimer) {
    liveContextTimer = setTimeout(() => {
      liveContextTimer = null;
      const ctx = liveContextPending;
      liveContextPending = null;
      if (!ctx || _storageDead) return;
      try {
        chrome.storage.session.set({
          [LIVE_CONTEXT_KEY]: { ...ctx, _persistedAt: Date.now() },
        });
      } catch (e) {
        if (!_storageDead) errors.report('storage', e, { op: 'writeLiveContext' });
      }
    }, LIVE_CONTEXT_THROTTLE);
  }
};

/** Clear the live context throttle timer (for version-upgrade cleanup). */
export const clearLiveContextTimer = () => {
  if (liveContextTimer) {
    clearTimeout(liveContextTimer);
    liveContextTimer = null;
    liveContextPending = null;
  }
};

/**
 * Read live context from session storage (for cold-start).
 * Returns null if stale (> 5s old) or missing.
 * @returns {Promise<Object|null>}
 */
export const readLiveContext = async () => {
  try {
    const result = await chrome.storage.session.get(LIVE_CONTEXT_KEY);
    const ctx = result[LIVE_CONTEXT_KEY];
    if (ctx && ctx._persistedAt && (Date.now() - ctx._persistedAt < 5000)) {
      return ctx;
    }
    return null;
  } catch (_) {
    return null;
  }
};

// ============================================================================
// CONNECTION STATE — single source of truth for capture + bridge alive status
// ============================================================================

const CONN_STATE_KEY = SESSION_KEYS.CONNECTION_STATE;
const CONN_STATE_LOCK = 'poker_conn_state_lock';

/**
 * Update connection state. Merges fields into existing state so capture
 * and bridge scripts can write independently without overwriting each other.
 * Uses navigator.locks for cross-tab serialization.
 * @param {Object} update - Fields to merge: { captureAlive?, appBridgeAlive? }
 */
export const writeConnectionState = (update) => {
  if (!_checkStorage()) return Promise.resolve();
  return navigator.locks.request(CONN_STATE_LOCK, async () => {
    try {
      const result = await chrome.storage.session.get(CONN_STATE_KEY);
      const current = result[CONN_STATE_KEY] || {};
      await chrome.storage.session.set({
        [CONN_STATE_KEY]: { ...current, ...update, timestamp: Date.now() },
      });
    } catch (e) {
      if (!_storageDead) errors.report('storage', e, { op: 'writeConnectionState' });
    }
  });
};

/**
 * Read current connection state.
 * @returns {Promise<{ captureAlive: boolean, appBridgeAlive: boolean, timestamp: number } | null>}
 */
export const readConnectionState = async () => {
  try {
    const result = await chrome.storage.session.get(CONN_STATE_KEY);
    return result[CONN_STATE_KEY] || null;
  } catch (_) {
    return null;
  }
};
