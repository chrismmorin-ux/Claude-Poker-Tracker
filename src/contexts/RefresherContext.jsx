/**
 * RefresherContext.jsx — Printable Refresher state context + writer-action helpers.
 *
 * Provides config + printBatches + isReady + selector helpers + writer-action
 * helpers (patchConfig / setCardVisibility / setClassSuppressed / recordPrintBatch).
 *
 * Architecture (post-write update pattern):
 *   1. UI handler calls a writer-action helper.
 *   2. Helper awaits the corresponding W-URC-* writer (validates + writes IDB).
 *   3. On success, helper dispatches REFRESHER_CONFIG_REPLACED or
 *      REFRESHER_BATCH_APPENDED with the writer's returned record.
 *   4. Reducer updates state. Selectors re-render with fresh data.
 *
 * Mirrors `AnchorLibraryContext.jsx` shape (Provider + selector helpers via
 * useCallback + consumer hook + ENROLLMENT-style helpers; PRF has no enrollment
 * concept so the helper set is smaller).
 *
 * PRF Phase 5 — Session 14 (PRF-G5-HK).
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import { useRefresherPersistence } from '../hooks/useRefresherPersistence';
import { REFRESHER_ACTIONS } from '../constants/refresherConstants';
import {
  writeConfigPreferences,
  writeCardVisibility,
  writeSuppressedClass,
  writePrintBatch,
} from '../utils/printableRefresher/writers';
import {
  selectAllCards,
  selectActiveCards,
  selectPinnedCards,
  selectSuppressedCards,
  selectCardsForBatchPrint,
  selectStaleCards,
} from '../utils/printableRefresher/refresherSelectors';

// =============================================================================
// CONTEXT
// =============================================================================

const RefresherContext = createContext(null);

// =============================================================================
// PROVIDER
// =============================================================================

/**
 * RefresherProvider — wraps children with Printable Refresher state + helpers.
 *
 * @param {Object} props
 * @param {Object} props.refresherState - State from refresherReducer
 * @param {Function} props.dispatchRefresher - Dispatcher for refresher actions
 * @param {Array} [props.cardRegistry] - Manifest registry from cardRegistry.js
 * @param {React.ReactNode} props.children
 */
export const RefresherProvider = ({
  refresherState,
  dispatchRefresher,
  cardRegistry = [],
  children,
}) => {
  // Hydrate IDB on mount.
  const { isReady } = useRefresherPersistence(dispatchRefresher);

  // ==========================================================================
  // WRITER-ACTION HELPERS
  // ==========================================================================

  /**
   * patchConfig — W-URC-1 entry point. Call this from setting toggles
   * (PrintControls, settings notifications.staleness, etc.). Caller is
   * responsible for debouncing rapid changes.
   *
   * @param {object} patch — see W-URC-1 spec for valid keys.
   * @returns {Promise<object>} merged singleton record.
   * @throws if patch fails W-URC-1 validation (caller should try/catch).
   */
  const patchConfig = useCallback(
    async (patch) => {
      const updatedConfig = await writeConfigPreferences(patch);
      dispatchRefresher({
        type: REFRESHER_ACTIONS.REFRESHER_CONFIG_REPLACED,
        payload: { config: updatedConfig },
      });
      return updatedConfig;
    },
    [dispatchRefresher],
  );

  /**
   * setCardVisibility — W-URC-2a entry point. Call from CardRow / CardDetail
   * action-chip handlers (📌 Pin / 👁 Hide / un-pin / un-hide).
   *
   * @param {{ cardId: string, visibility: 'default' | 'hidden' | 'pinned' }} args
   * @returns {Promise<object>} merged singleton record.
   */
  const setCardVisibility = useCallback(
    async ({ cardId, visibility }) => {
      const updatedConfig = await writeCardVisibility({ cardId, visibility });
      dispatchRefresher({
        type: REFRESHER_ACTIONS.REFRESHER_CONFIG_REPLACED,
        payload: { config: updatedConfig },
      });
      return updatedConfig;
    },
    [dispatchRefresher],
  );

  /**
   * setClassSuppressed — W-URC-2b entry point. Call from SuppressConfirmModal
   * confirm handler (with confirmed:true) or un-suppress chip (with
   * ownerInitiated:true). The writer enforces both guards.
   *
   * @param {{ classId, suppress, confirmed?, ownerInitiated? }} args
   * @returns {Promise<object>} merged singleton record.
   */
  const setClassSuppressed = useCallback(
    async (args) => {
      const updatedConfig = await writeSuppressedClass(args);
      dispatchRefresher({
        type: REFRESHER_ACTIONS.REFRESHER_CONFIG_REPLACED,
        payload: { config: updatedConfig },
      });
      return updatedConfig;
    },
    [dispatchRefresher],
  );

  /**
   * recordPrintBatch — W-URC-3 entry point. Call only from
   * PrintConfirmationModal confirm handler (red line #15 owner-initiated).
   *
   * The writer also invokes W-URC-1 internally to update lastExportAt; this
   * helper reads the resulting config so the dispatch can update both slices
   * atomically at the reducer level.
   *
   * @param {object} payload — see W-URC-3 spec.
   * @returns {Promise<{ batchId: string, record: object }>}
   */
  const recordPrintBatch = useCallback(
    async (payload) => {
      const { batchId, record } = await writePrintBatch(payload);
      // W-URC-3 invokes W-URC-1 internally; the IDB now has the lastExportAt
      // update. Read it via writeConfigPreferences's no-op-merge path? Easier:
      // construct the updated config from the existing reducer state + the
      // post-write lastExportAt (since W-URC-1 only changed that field).
      // The reducer payload includes both pieces; consumer composes from the
      // dispatched batch + lastExportAt update.
      const updatedConfig = {
        ...refresherState.config,
        lastExportAt: record.printedAt,
      };
      dispatchRefresher({
        type: REFRESHER_ACTIONS.REFRESHER_BATCH_APPENDED,
        payload: { batch: record, updatedConfig },
      });
      return { batchId, record };
    },
    [dispatchRefresher, refresherState],
  );

  // ==========================================================================
  // SELECTOR HELPERS
  // ==========================================================================

  /**
   * Returns every card from the registry annotated with visibility +
   * classSuppressed state. Used by catalog "Show suppressed" full view.
   */
  const getAllCards = useCallback(
    () => selectAllCards({
      cardRegistry,
      userRefresherConfig: refresherState.config,
    }),
    [cardRegistry, refresherState.config],
  );

  /**
   * Returns active cards (excludes hidden + class-suppressed).
   */
  const getActiveCards = useCallback(
    () => selectActiveCards({
      cardRegistry,
      userRefresherConfig: refresherState.config,
    }),
    [cardRegistry, refresherState.config],
  );

  /**
   * Returns pinned cards subset.
   */
  const getPinnedCards = useCallback(
    () => selectPinnedCards({
      cardRegistry,
      userRefresherConfig: refresherState.config,
    }),
    [cardRegistry, refresherState.config],
  );

  /**
   * Returns suppressed cards (hidden OR class-suppressed).
   */
  const getSuppressedCards = useCallback(
    () => selectSuppressedCards({
      cardRegistry,
      userRefresherConfig: refresherState.config,
    }),
    [cardRegistry, refresherState.config],
  );

  /**
   * Returns selectedIds filtered to active (defense-in-depth print-export read).
   */
  const getCardsForBatchPrint = useCallback(
    (selectedIds) => selectCardsForBatchPrint({
      cardRegistry,
      userRefresherConfig: refresherState.config,
    }, selectedIds),
    [cardRegistry, refresherState.config],
  );

  /**
   * Returns stale cards — active cards whose contentHash differs from the
   * most-recent print snapshot.
   */
  const getStaleCards = useCallback(
    () => selectStaleCards({
      cardRegistry,
      userRefresherConfig: refresherState.config,
    }, refresherState.printBatches),
    [cardRegistry, refresherState.config, refresherState.printBatches],
  );

  // ==========================================================================
  // VALUE
  // ==========================================================================

  const value = useMemo(
    () => ({
      // Raw state
      config: refresherState.config,
      printBatches: refresherState.printBatches,
      isReady,
      schemaVersion: refresherState.schemaVersion,

      // Writer-action helpers (UI handlers call these, never writers.js directly)
      patchConfig,
      setCardVisibility,
      setClassSuppressed,
      recordPrintBatch,

      // Selector helpers (memoized over cardRegistry + config + printBatches)
      getAllCards,
      getActiveCards,
      getPinnedCards,
      getSuppressedCards,
      getCardsForBatchPrint,
      getStaleCards,
    }),
    [
      refresherState.config,
      refresherState.printBatches,
      refresherState.schemaVersion,
      isReady,
      patchConfig,
      setCardVisibility,
      setClassSuppressed,
      recordPrintBatch,
      getAllCards,
      getActiveCards,
      getPinnedCards,
      getSuppressedCards,
      getCardsForBatchPrint,
      getStaleCards,
    ],
  );

  return (
    <RefresherContext.Provider value={value}>
      {children}
    </RefresherContext.Provider>
  );
};

// =============================================================================
// CONSUMER HOOK
// =============================================================================

/**
 * useRefresher — access refresher state + helpers from any descendant.
 *
 * @returns {Object} See RefresherProvider §VALUE
 * @throws {Error} If called outside a RefresherProvider
 */
export const useRefresher = () => {
  const context = useContext(RefresherContext);
  if (!context) {
    throw new Error('useRefresher must be used within a RefresherProvider');
  }
  return context;
};

export default RefresherContext;
