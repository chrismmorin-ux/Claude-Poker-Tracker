/**
 * refresherReducer.js — Printable Refresher state management.
 *
 * Tracks post-write state for the userRefresherConfig singleton + printBatches
 * array. Writers (W-URC-1/2/3 in `src/utils/printableRefresher/writers.js`)
 * own IDB writes; this reducer reflects writer outcomes so selectors can read
 * fresh state without round-tripping through IDB on every render.
 *
 * Architecture: post-write update pattern (cleaner than per-slice diff-write
 * pattern in EAL because writers already validate field-ownership):
 *   1. UI action handler awaits a writer call.
 *   2. Writer validates + writes IDB + returns updated record.
 *   3. Action handler dispatches REFRESHER_CONFIG_REPLACED or
 *      REFRESHER_BATCH_APPENDED with the writer's returned data.
 *   4. Reducer updates in-memory state to match IDB.
 *
 * Mirrors `anchorLibraryReducer.js` shape (createValidatedReducer wrapper +
 * defensive returns same-state on missing payload).
 *
 * PRF Phase 5 — Session 14 (PRF-G5-HK).
 */

import {
  REFRESHER_ACTIONS,
  REFRESHER_STATE_SCHEMA,
  initialRefresherState,
} from '../constants/refresherConstants';
import { createValidatedReducer } from '../utils/reducerUtils';

// =============================================================================
// RAW REDUCER
// =============================================================================

const rawRefresherReducer = (state, action) => {
  switch (action.type) {
    // -------------------------------------------------------------------------
    // REFRESHER_HYDRATED
    // Bulk-load on mount from IDB. useRefresherPersistence parallel-reads
    // getRefresherConfig + getAllPrintBatches and dispatches with both slices.
    // -------------------------------------------------------------------------
    case REFRESHER_ACTIONS.REFRESHER_HYDRATED: {
      const payload = action.payload || {};
      return {
        ...state,
        config: payload.config && typeof payload.config === 'object'
          ? payload.config
          : state.config,
        printBatches: Array.isArray(payload.printBatches)
          ? payload.printBatches
          : [],
        isReady: true,
      };
    }

    // -------------------------------------------------------------------------
    // REFRESHER_CONFIG_REPLACED
    // W-URC-1 (printPreferences/notifications/lastExportAt) +
    // W-URC-2a (cardVisibility[cardId]) +
    // W-URC-2b (suppressedClasses[]) all return the merged singleton record.
    // The action handler in RefresherContext dispatches with that record.
    // -------------------------------------------------------------------------
    case REFRESHER_ACTIONS.REFRESHER_CONFIG_REPLACED: {
      const config = action.payload?.config;
      if (!config || typeof config !== 'object' || config.id !== 'singleton') {
        return state;
      }
      return {
        ...state,
        config,
      };
    }

    // -------------------------------------------------------------------------
    // REFRESHER_BATCH_APPENDED
    // W-URC-3 returns { batch, updatedConfig } (W-URC-3 also invokes W-URC-1
    // for lastExportAt as a final step). Action handler dispatches both
    // pieces in one action — reducer appends batch + replaces config slice.
    //
    // Append-only per I-WR-5: a duplicate batchId from caller is dropped (the
    // writer should never generate a duplicate; this is defense-in-depth).
    // -------------------------------------------------------------------------
    case REFRESHER_ACTIONS.REFRESHER_BATCH_APPENDED: {
      const batch = action.payload?.batch;
      const updatedConfig = action.payload?.updatedConfig;
      if (!batch || typeof batch !== 'object' || typeof batch.batchId !== 'string') {
        return state;
      }
      const existingIds = new Set((state.printBatches || []).map((b) => b.batchId));
      if (existingIds.has(batch.batchId)) {
        // Duplicate batchId — should never happen per W-URC-3 fresh UUIDs;
        // defense-in-depth: don't double-append, keep existing array shape.
        return updatedConfig && typeof updatedConfig === 'object' && updatedConfig.id === 'singleton'
          ? { ...state, config: updatedConfig }
          : state;
      }
      return {
        ...state,
        // Prepend so most-recent batch sorts first (matches getAllPrintBatches DESC).
        printBatches: [batch, ...(state.printBatches || [])],
        config: updatedConfig && typeof updatedConfig === 'object' && updatedConfig.id === 'singleton'
          ? updatedConfig
          : state.config,
      };
    }

    default:
      return state;
  }
};

// =============================================================================
// VALIDATED REDUCER (export this)
// =============================================================================

export const refresherReducer = createValidatedReducer(
  rawRefresherReducer,
  REFRESHER_STATE_SCHEMA,
  'refresherReducer',
);

// Re-export initialRefresherState for AppRoot useReducer call
export { initialRefresherState };
