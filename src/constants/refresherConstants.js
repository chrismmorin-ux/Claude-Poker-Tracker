/**
 * refresherConstants.js — Constants for the Printable Refresher reducer + context.
 *
 * Mirrors `anchorLibraryConstants.js` shape (frozen ACTIONS + initialState +
 * STATE_SCHEMA). State is intentionally simple compared to EAL because writers
 * are the IDB write path — the reducer's job is to track post-write state +
 * support selector reads.
 *
 * PRF Phase 5 — Session 14 (PRF-G5-HK).
 *
 * State shape:
 *   - config:        userRefresherConfig singleton (read-merge-replaced via writers)
 *   - printBatches:  array of all batches (chronological DESC; appended on W-URC-3)
 *   - isReady:       hydration flag (false until useRefresherPersistence completes)
 *   - schemaVersion: '1.0.0'
 *
 * Three actions covering the full lifecycle:
 *   1. REFRESHER_HYDRATED          (boot from IDB; bulk load config + batches)
 *   2. REFRESHER_CONFIG_REPLACED   (W-URC-1 / W-URC-2 returned record merged in)
 *   3. REFRESHER_BATCH_APPENDED    (W-URC-3 returned batch + updated config for lastExportAt)
 */

import { buildDefaultRefresherConfig } from '../utils/persistence/refresherDefaults';

// ───────────────────────────────────────────────────────────────────────────
// Reducer action types
// ───────────────────────────────────────────────────────────────────────────

export const REFRESHER_ACTIONS = Object.freeze({
  REFRESHER_HYDRATED: 'REFRESHER_HYDRATED',
  REFRESHER_CONFIG_REPLACED: 'REFRESHER_CONFIG_REPLACED',
  REFRESHER_BATCH_APPENDED: 'REFRESHER_BATCH_APPENDED',
});

// ───────────────────────────────────────────────────────────────────────────
// Initial state
// ───────────────────────────────────────────────────────────────────────────

/**
 * Reducer initial state. Config defaults to `buildDefaultRefresherConfig()` so
 * pre-hydration reads return safe defaults rather than null. Hydration replaces
 * with the actual IDB record.
 *
 * The default singleton is generated fresh per call (not Object.freeze'd here)
 * because reducers spread + replace the slice; freezing would break that path.
 */
export const initialRefresherState = {
  config: buildDefaultRefresherConfig(),
  printBatches: [],
  isReady: false,
  schemaVersion: '1.0.0',
};

// ───────────────────────────────────────────────────────────────────────────
// State schema for createValidatedReducer
// ───────────────────────────────────────────────────────────────────────────

export const REFRESHER_STATE_SCHEMA = Object.freeze({
  config: { type: 'object' },
  printBatches: { type: 'array' },
  isReady: { type: 'boolean' },
  schemaVersion: { type: 'string' },
});

// ───────────────────────────────────────────────────────────────────────────
// localStorage keys (useRefresherView)
// ───────────────────────────────────────────────────────────────────────────

export const REFRESHER_VIEW_LOCALSTORAGE_KEY = 'pokerTracker.refresherView.v1';

/**
 * Default UI view state. Loaded from localStorage on mount; persisted on change.
 * Sort enum mirrors `selectors.md` §Filter + sort composition.
 */
export const initialRefresherView = Object.freeze({
  filter: Object.freeze({
    classes: Object.freeze([]),       // empty = all classes
    phases: Object.freeze([]),        // empty = all phases
    tiers: Object.freeze([]),         // empty = all tiers
    showSuppressed: false,            // default — selectActiveCards path
  }),
  sort: 'theoretical',                // 'theoretical' | 'alphabetical' | 'lastPrinted' | 'pinnedFirst'
});

export const VALID_SORT_VALUES = Object.freeze([
  'theoretical',
  'alphabetical',
  'lastPrinted',
  'pinnedFirst',
]);
