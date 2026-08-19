// Instantiated in: useAppState.js
/**
 * usePersistence.js - React hook for state persistence
 *
 * Integrates IndexedDB persistence with React state management.
 * Handles:
 * - Database initialization on mount
 * - Auto-restore latest hand on startup
 * - Debounced auto-save on state changes
 * - Hydration of reducer state from persisted data
 */

import { useEffect, useRef, useState } from 'react';
import { initDB, saveHand, loadLatestHand, GUEST_USER_ID, createPersistenceLogger } from '../utils/persistence/index';
import { reportPersistenceFailure, reportPersistenceHealthy } from '../utils/persistenceHealth';
import { logErrorObject } from '../utils/errorLog';
import { ERROR_CODES } from '../utils/errorHandler';
import { sanitizePredictionAudit } from '../utils/persistence/predictionAuditWriter';
import { reconstructPredictionAudit } from '../utils/predictionAudit/reconstruct';
import { GAME_ACTIONS } from '../reducers/gameReducer';
import { CARD_ACTIONS } from '../reducers/cardReducer';
import { PLAYER_ACTIONS } from '../constants/playerConstants';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEBOUNCE_DELAY = 1500; // 1.5 seconds

const { log, logError } = createPersistenceLogger('usePersistence');

// =============================================================================
// PERSISTENCE HOOK
// =============================================================================

/**
 * usePersistence - React hook for state persistence
 *
 * @param {Object} gameState - Game state from gameReducer
 * @param {Object} cardState - Card state from cardReducer
 * @param {Object} playerState - Player state from playerReducer
 * @param {Function} dispatchGame - Game state dispatcher
 * @param {Function} dispatchCard - Card state dispatcher
 * @param {Function} dispatchPlayer - Player state dispatcher (optional, for seat assignments)
 * @param {string} userId - User ID for data isolation (defaults to 'guest')
 * @returns {Object} { isReady, lastSavedAt }
 */
export const usePersistence = (gameState, cardState, playerState, dispatchGame, dispatchCard, dispatchPlayer = null, userId = GUEST_USER_ID, engineCtxGetterRef = null) => {
  // State
  const [isReady, setIsReady] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // Refs
  const saveTimerRef = useRef(null);
  const pendingSaveRef = useRef(null);
  const isInitializedRef = useRef(false);
  const lastSnapshotRef = useRef(null);

  // ==========================================================================
  // INITIALIZATION (on mount)
  // ==========================================================================

  useEffect(() => {
    const initialize = async () => {
      log(`Initializing persistence for user ${userId}...`);

      try {
        // Initialize database
        await initDB();
        log('Database initialized');

        // Load latest hand for this user
        const latestHand = await loadLatestHand(userId);

        if (latestHand) {
          log(`Restoring hand ${latestHand.handId} from ${new Date(latestHand.timestamp).toLocaleString()}`);

          // Hydrate game state. reviewTag (WS-190) is stored top-level on the
          // hand record, not inside the saved gameState subset, so merge it back
          // into the hydrate payload to restore the live tag flag across reload.
          if (latestHand.gameState) {
            dispatchGame({
              type: GAME_ACTIONS.HYDRATE_STATE,
              payload: { ...latestHand.gameState, reviewTag: latestHand.reviewTag ?? null }
            });
            log('Game state hydrated');
          }

          // Hydrate card state (only persistent fields)
          if (latestHand.cardState) {
            dispatchCard({
              type: CARD_ACTIONS.HYDRATE_STATE,
              payload: {
                communityCards: latestHand.cardState.communityCards,
                holeCards: latestHand.cardState.holeCards,
                holeCardsVisible: latestHand.cardState.holeCardsVisible,
                allPlayerCards: latestHand.cardState.allPlayerCards
              }
            });
            log('Card state hydrated');
          }

          // Hydrate player seat assignments
          if (latestHand.seatPlayers && dispatchPlayer) {
            dispatchPlayer({
              type: PLAYER_ACTIONS.HYDRATE_SEAT_PLAYERS,
              payload: { seatPlayers: latestHand.seatPlayers }
            });
            log('Player seat assignments hydrated');
          }
        } else {
          log('No previous hand found - starting fresh');
        }

        isInitializedRef.current = true;
        setIsReady(true);
        reportPersistenceHealthy('hands');
        log('Persistence ready');
      } catch (error) {
        // Continue without persistence — refusing to open would be worse at a
        // live table — but REPORT it. Continuing silently meant every button
        // worked while nothing was written, and the founder found out when the
        // session was already gone. HealthIndicator surfaces this.
        reportPersistenceFailure('hands', error);
        logError('Initialization failed:', error);
        isInitializedRef.current = true;
        setIsReady(true);
      }
    };

    initialize();
  }, [dispatchGame, dispatchCard, dispatchPlayer, userId]); // Re-initialize if userId changes

  // ==========================================================================
  // AUTO-SAVE (on state change)
  // ==========================================================================

  useEffect(() => {
    // Don't save during initialization or if not ready
    if (!isReady || !isInitializedRef.current) {
      return;
    }

    const handData = {
      gameState: {
        currentStreet: gameState.currentStreet,
        dealerButtonSeat: gameState.dealerButtonSeat,
        mySeat: gameState.mySeat,
        actionSequence: gameState.actionSequence,
        absentSeats: gameState.absentSeats,
        // Seat stack ledger (surface `seat-stack-ledger`). START-OF-HAND stacks
        // with provenance. Additive field — the IDB additive-only invariant
        // holds and no migration is required; hands saved before this exist
        // without it and read back as `{}`, i.e. "unknown", which is correct.
        seatStacks: gameState.seatStacks ?? {},
        handNumber: gameState.handNumber ?? 0
      },
      cardState: {
        communityCards: cardState.communityCards,
        holeCards: cardState.holeCards,
        holeCardsVisible: cardState.holeCardsVisible,
        allPlayerCards: cardState.allPlayerCards
      },
      seatPlayers: playerState.seatPlayers,
      // WS-190: mid-hand tag-for-review. Stored top-level on the hand record as
      // null | { tagged: true, taggedAt }. Stable object (no fresh timestamp
      // here) so the dedup snapshot below stays stable between renders.
      reviewTag: gameState.reviewTag ?? null
    };

    // Skip save if data hasn't actually changed. Snapshot intentionally
    // excludes predictionAudit — that field is reconstructed inside the
    // async save closure below (Phase 5a-2 made reconstruction async, so it
    // can no longer run inline here). Engine-context changes that don't
    // affect game state shouldn't trigger a save anyway.
    const snapshot = JSON.stringify(handData);
    if (snapshot === lastSnapshotRef.current) {
      return;
    }

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Capture data for save closure.
    //
    // WS-556: `saveThis` exists so the closure can null the ref ONLY IF IT STILL OWNS IT.
    // Previously the closure ended with an unconditional `pendingSaveRef.current = null`,
    // and the ref is shared across effect runs. That produced a second, silent loss path
    // independent of the swallowed catch:
    //
    //   1. state A changes  -> pendingSaveRef = saveA, timer_A(1500)
    //   2. state B changes before 1500 -> cleanup clears timer_A and calls saveA()
    //                                     (starts, then awaits), new effect sets
    //                                     pendingSaveRef = saveB and timer_B(1500)
    //   3. saveA's awaits resolve, saveA finishes and nulls the ref -- clobbering saveB
    //   4. timer_B fires: `pendingSaveRef.current?.()` is now null, so NOTHING RUNS
    //
    // State B is never written, with no error and no log line, until some later state
    // change happens to save it. If B was the last action of the hand, the hand's final
    // state is simply gone. Found by writing the backgrounding test below, which could
    // not observe a pending write because the older closure had already erased it.
    const saveThis = async () => {
      try {
        // PMC Phase 5a (WS-177) + Phase 5a-2 (WS-178): attach predictionAudit
        // field at hand-save time. Q1 ratified — post-hoc reconstruction from
        // handData; no live coupling. Engine-context deps come via the
        // ref-getter bridge (D1=A, populated by <EngineCtxBridge/> inside
        // TendencyProvider). When the ref is null/empty (initial render
        // before bridge mounts), reconstruct falls back to Phase 5a behavior
        // (empty predictedDistribution).
        // sanitizePredictionAudit enforces AP-PMC-04 schema-level (drops
        // evRealized from any hero observedAction entries — defensive).
        // Failures are swallowed so a reconstructor regression cannot break
        // the auto-save hot path.
        try {
          const deps = (engineCtxGetterRef && typeof engineCtxGetterRef.current === 'function')
            ? (engineCtxGetterRef.current() ?? {})
            : {};
          handData.predictionAudit = sanitizePredictionAudit(
            await reconstructPredictionAudit(handData, deps),
          );
        } catch (e) {
          logError('predictionAudit reconstruction failed (auto-save continues):', e);
          handData.predictionAudit = null;
        }

        lastSnapshotRef.current = snapshot;
        const handId = await saveHand(handData, userId);
        setLastSavedAt(new Date());
        // A write that works clears a prior write/init failure. Without this the
        // indicator would stick on red after a transient quota blip that has since
        // resolved, and an alarm that never clears stops being read.
        reportPersistenceHealthy('hands');
        log(`Auto-saved hand ${handId} for user ${userId}`);
      } catch (error) {
        // WS-556. This catch used to end at logError — i.e. console.error and nothing
        // else. It is the ONLY production saveHand call site, so every hand recorded
        // live passed through a failure path that told the founder nothing, and nobody
        // reads a console on a phone at a table.
        //
        // The channel to say it on already existed and was only ever wired to INIT
        // failures: reportPersistenceFailure lights HealthIndicator, which is mounted
        // app-root (PokerTracker.jsx) and whose HIGHEST-priority fault is already
        // 'Not saving — data at risk'. That indicator was designed for exactly this
        // case and could not fire for the most common way saving fails.
        //
        // logErrorObject additionally puts it in the exportable on-device error log
        // (Settings → Error Log), so a failure survives the session it happened in.
        logError('Auto-save failed:', error);
        reportPersistenceFailure('hands', error);
        logErrorObject(error, ERROR_CODES.SAVE_FAILED, {
          view: 'auto-save',
          subsystem: 'hands',
          userId,
        });
      }
      // Only clear the ref if this closure is still the pending one (see above).
      if (pendingSaveRef.current === saveThis) {
        pendingSaveRef.current = null;
      }
    };
    pendingSaveRef.current = saveThis;

    // Set new debounced save
    saveTimerRef.current = setTimeout(() => {
      pendingSaveRef.current?.();
    }, DEBOUNCE_DELAY);

    // WS-556: flush the pending write when the page is BACKGROUNDED, not only when
    // React unmounts.
    //
    // Unmount is a React lifecycle event. Locking the phone, switching apps, or the
    // OS evicting a backgrounded tab are not — the component never unmounts, the
    // cleanup never runs, and up to DEBOUNCE_DELAY (1.5s) of the most recent action
    // is discarded with no error at all, because the closure that would have caught
    // one never executed. On the target device (Galaxy S22, used one-handed at a live
    // table) this is the most likely way the F1 class actually fires.
    //
    // 'visibilitychange' → hidden is the reliable signal on mobile; 'pagehide' covers
    // bfcache/navigation. Deliberately NOT 'beforeunload', which mobile browsers fire
    // unreliably and which blocks bfcache.
    const flushNow = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      pendingSaveRef.current?.();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushNow);

    // Cleanup: flush pending save on unmount or dependency change
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushNow);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (pendingSaveRef.current) {
        pendingSaveRef.current();
      }
    };
  }, [gameState, cardState, playerState, isReady, userId]);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    isReady,
    lastSavedAt
  };
};
