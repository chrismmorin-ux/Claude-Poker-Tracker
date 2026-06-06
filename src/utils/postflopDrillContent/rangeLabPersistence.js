/**
 * rangeLabPersistence.js — session-scoped persistence for the Range Lab paint flow.
 *
 * Phase 1 (WS-056) persists a painted range "for the session" via sessionStorage:
 * an explicit Save writes the range; a page reload restores it; closing the tab
 * clears it. Durable cross-session saved-ranges (IndexedDB `rangeProfiles`) are
 * Phase 5 scope — deliberately NOT built here.
 *
 * The range is serialized through `rangeToString` ↔ `parseRangeString` (the
 * Phase-0 round-trip, regression-pinned) so what we persist is the same compact
 * representation the rest of the app understands — no second serialization to drift.
 *
 * All reads/writes are wrapped: a quota error, disabled storage, or corrupt
 * payload returns null / no-ops rather than throwing (per .claude/rules/error-handling).
 */

import { rangeToString, parseRangeString } from '../pokerCore/rangeMatrix';

const STORAGE_KEY = 'rangelab:painted:v1';

const getStore = () => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    // Accessing sessionStorage can throw in sandboxed/private contexts.
    return null;
  }
};

/**
 * Persist the painted range(s) + board to sessionStorage.
 *
 * Phase 2b (WS-210) adds an optional second range (B) + a compare flag, persisted
 * additively alongside the Phase-1 single range (A). Old single-range blobs remain
 * loadable (they simply lack `rangeBStr` / `compareOn`).
 *
 * @param {{ range: Float64Array, board: string[], rangeB?: Float64Array|null, compareOn?: boolean }} state
 * @returns {boolean} true if written, false if storage was unavailable/failed
 */
export const saveRangeLabState = ({ range, board, rangeB = null, compareOn = false }) => {
  const store = getStore();
  if (!store || !range) return false;
  try {
    const payload = JSON.stringify({
      rangeStr: rangeToString(range),
      board: Array.isArray(board) ? board : [],
      // Additive (Phase 2b): only written when a comparison range exists.
      rangeBStr: rangeB ? rangeToString(rangeB) : null,
      compareOn: !!compareOn,
    });
    store.setItem(STORAGE_KEY, payload);
    return true;
  } catch (e) {
    // Quota exceeded or serialization failure — degrade silently, do not crash paint.
    console.warn('[rangeLab] saveRangeLabState failed:', e?.message || e);
    return false;
  }
};

/**
 * Load the last-saved painted range(s) + board.
 *
 * @returns {{ range: Float64Array, board: string[], rangeB: Float64Array|null, compareOn: boolean } | null}
 *   null if nothing saved, storage unavailable, or the payload is corrupt.
 *   `rangeB` is null and `compareOn` false for legacy single-range blobs.
 */
export const loadRangeLabState = () => {
  const store = getStore();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.rangeStr !== 'string') return null;
    return {
      range: parseRangeString(parsed.rangeStr),
      board: Array.isArray(parsed.board) ? parsed.board : [],
      rangeB: typeof parsed.rangeBStr === 'string' ? parseRangeString(parsed.rangeBStr) : null,
      compareOn: !!parsed.compareOn,
    };
  } catch (e) {
    console.warn('[rangeLab] loadRangeLabState failed:', e?.message || e);
    return null;
  }
};

/** Remove any saved Range Lab state. */
export const clearRangeLabState = () => {
  const store = getStore();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
};
