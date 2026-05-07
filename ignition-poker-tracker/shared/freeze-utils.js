/**
 * shared/freeze-utils.js — Deep-freeze helper for cross-boundary payloads.
 *
 * Used at the SW boundary (WS-103) to ensure validated `live_context`
 * payloads are immutable before they fan out to consumers
 * (writeLiveContext, pushToAppBridge, the throttle queue, side-panel
 * forwards). Pairs with the validateMessage gate added in WS-105:
 * validate first, then freeze, then forward.
 *
 * Frozen objects survive structured clone (postMessage / chrome.storage)
 * and produce mutable copies on the receiving side, so this is safe to
 * apply on the sending boundary without breaking downstream writers.
 */

/**
 * Recursively freeze an object and any nested objects/arrays.
 * Idempotent on already-frozen objects. Skips non-objects and primitives.
 * @template T
 * @param {T} value
 * @returns {T} the same reference, deeply frozen
 */
export const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }
  return value;
};
