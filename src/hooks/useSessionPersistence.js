/**
 * useSessionPersistence.js - React hook for session persistence
 *
 * Integrates IndexedDB session persistence with React state management.
 * Handles:
 * - Database initialization on mount
 * - Auto-restore active session on startup
 * - Debounced auto-save on session changes
 * - Session creation, ending, and field updates
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createSession,
  endSession as dbEndSession,
  getActiveSession,
  setActiveSession,
  clearActiveSession,
  getAllSessions,
  getSessionById,
  updateSession,
  deleteSession as dbDeleteSession,
  GUEST_USER_ID
} from '../utils/persistence';
import { SESSION_ACTIONS } from '../constants/sessionConstants';
import { logger, AppError, ERROR_CODES } from '../utils/errorHandler';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEBOUNCE_DELAY = 1500; // 1.5 seconds
const MODULE_NAME = 'useSessionPersistence';

// Backward-compatible logging wrappers
const log = (...args) => logger.debug(MODULE_NAME, ...args);
const logError = (error) => logger.error(MODULE_NAME, error);

// =============================================================================
// SESSION PERSISTENCE HOOK
// =============================================================================

/**
 * useSessionPersistence - React hook for session persistence
 *
 * @param {Object} sessionState - Session state from sessionReducer
 * @param {Function} dispatchSession - Session state dispatcher
 * @param {string} userId - User ID for data isolation (defaults to 'guest')
 * @returns {Object} { isReady, startNewSession, endCurrentSession, updateSessionField, loadAllSessions, deleteSessionById }
 */
export const useSessionPersistence = (sessionState, dispatchSession, userId = GUEST_USER_ID) => {
  // State
  const [isReady, setIsReady] = useState(false);

  // Refs
  const saveTimerRef = useRef(null);
  const isInitializedRef = useRef(false);

  // ==========================================================================
  // INITIALIZATION (on mount)
  // ==========================================================================

  useEffect(() => {
    const initialize = async () => {
      log(`Initializing session persistence for user ${userId}...`);

      try {
        // Load active session marker for this user (single source of truth)
        const activeSession = await getActiveSession(userId);
        const activeSessionId = activeSession?.sessionId || null;

        // P1 Fix: Reconcile dual source of truth
        // The activeSession store is the single source of truth.
        // If any sessions have isActive=true but don't match, fix them.
        const allSessions = await getAllSessions(userId);
        for (const session of allSessions) {
          const shouldBeActive = session.sessionId === activeSessionId;
          if (session.isActive !== shouldBeActive) {
            log(`Fixing isActive mismatch for session ${session.sessionId}: ${session.isActive} -> ${shouldBeActive}`);
            await updateSession(session.sessionId, { isActive: shouldBeActive });
          }
        }

        if (activeSessionId) {
          log(`Restoring active session ${activeSessionId}`);

          // Get full session data
          const sessionData = await getSessionById(activeSessionId);

          if (sessionData) {
            // Hydrate session state
            dispatchSession({
              type: SESSION_ACTIONS.HYDRATE_SESSION,
              payload: { session: sessionData }
            });
            log('Session state hydrated');
          } else {
            // Session was deleted but activeSession marker still exists - clean up
            log(`Active session ${activeSessionId} not found - clearing marker`);
            await clearActiveSession(userId);
          }
        } else {
          log(`No active session found for user ${userId} - starting without session`);
        }

        isInitializedRef.current = true;
        setIsReady(true);
        log('Session persistence ready');
      } catch (error) {
        logError('Initialization failed:', error);
        // Continue without session persistence
        isInitializedRef.current = true;
        setIsReady(true);
      }
    };

    initialize();
  }, [dispatchSession, userId]); // Re-initialize if userId changes

  // ==========================================================================
  // AUTO-SAVE (on session state change)
  // ==========================================================================

  useEffect(() => {
    // Don't save during initialization or if not ready
    if (!isReady || !isInitializedRef.current) {
      return;
    }

    // Don't save if no active session
    if (!sessionState.currentSession.sessionId) {
      return;
    }

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Set new timer for debounced save
    saveTimerRef.current = setTimeout(async () => {
      try {
        log(`Auto-saving session ${sessionState.currentSession.sessionId}...`);

        await updateSession(sessionState.currentSession.sessionId, {
          venue: sessionState.currentSession.venue,
          gameType: sessionState.currentSession.gameType,
          buyIn: sessionState.currentSession.buyIn,
          rebuyTransactions: sessionState.currentSession.rebuyTransactions,
          cashOut: sessionState.currentSession.cashOut,
          reUp: sessionState.currentSession.reUp,
          goal: sessionState.currentSession.goal,
          notes: sessionState.currentSession.notes,
          handCount: sessionState.currentSession.handCount
        });

        log('Session auto-saved successfully');
      } catch (error) {
        logError('Auto-save failed:', error);
      }
    }, DEBOUNCE_DELAY);

    // Cleanup on unmount
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [sessionState.currentSession, isReady]);

  // ==========================================================================
  // SESSION OPERATIONS
  // ==========================================================================

  /**
   * Start a new session (atomic with rollback)
   * @param {Object} sessionData - Session data (buyIn, goal, notes, etc.)
   * @returns {Promise<number>} The new session ID
   *
   * This function implements atomic session creation with rollback:
   * 1. Create session in DB
   * 2. Set as active session in DB
   * 3. Update React state
   * If step 3 fails, steps 1-2 are rolled back to prevent orphan sessions.
   */
  const startNewSession = useCallback(async (sessionData = {}) => {
    let sessionId = null;
    let activeSessionSet = false;

    try {
      log(`Starting new session for user ${userId}...`);

      // Step 1: Create session in database for this user
      sessionId = await createSession(sessionData, userId);
      log(`Session ${sessionId} created in database`);

      // Step 2: Set as active session for this user
      await setActiveSession(sessionId, userId);
      activeSessionSet = true;
      log(`Session ${sessionId} set as active`);

      // Step 3: Update reducer state (could fail)
      dispatchSession({
        type: SESSION_ACTIONS.START_SESSION,
        payload: {
          sessionId,
          startTime: Date.now(),
          venue: sessionData.venue || 'Online',
          gameType: sessionData.gameType || '1/2',
          buyIn: sessionData.buyIn || null,
          rebuyTransactions: sessionData.rebuyTransactions || [],
          reUp: sessionData.reUp || 0,
          goal: sessionData.goal || null,
          notes: sessionData.notes || null
        }
      });

      log('New session started successfully');
      return sessionId;
    } catch (error) {
      // Rollback: Clean up DB state if any step failed
      logError(new AppError(
        ERROR_CODES.OPERATION_FAILED,
        'Failed to start new session, attempting rollback',
        { sessionId, error: error.message }
      ));

      try {
        if (activeSessionSet) {
          await clearActiveSession(userId);
          log('Rollback: cleared active session');
        }
        if (sessionId) {
          await dbDeleteSession(sessionId);
          log(`Rollback: deleted session ${sessionId}`);
        }
      } catch (rollbackError) {
        // Log but don't throw - original error is more important
        logError(new AppError(
          ERROR_CODES.OPERATION_FAILED,
          'Rollback failed',
          { rollbackError: rollbackError.message }
        ));
      }

      throw error;
    }
  }, [dispatchSession, userId]);

  /**
   * End the current session
   * @param {number|null} cashOut - Optional cash out amount
   * @returns {Promise<void>}
   */
  const endCurrentSession = useCallback(async (cashOut = null) => {
    try {
      const sessionId = sessionState.currentSession.sessionId;

      if (!sessionId) {
        log('No active session to end');
        return;
      }

      log(`Ending session ${sessionId} with cashOut: ${cashOut}...`);

      // End session in database with cashOut
      await dbEndSession(sessionId, cashOut);
      log(`Session ${sessionId} ended in database`);

      // Clear active session for this user
      await clearActiveSession(userId);
      log('Active session cleared');

      // Update reducer state
      dispatchSession({
        type: SESSION_ACTIONS.END_SESSION,
        payload: {
          endTime: Date.now(),
          cashOut: cashOut
        }
      });

      log('Session ended successfully');
    } catch (error) {
      logError('Failed to end session:', error);
      throw error;
    }
  }, [sessionState.currentSession.sessionId, dispatchSession, userId]);

  /**
   * Update a field in the current session
   * @param {string} field - Field name (buyIn, rebuy, goal, notes, etc.)
   * @param {*} value - New value
   * @returns {Promise<void>}
   */
  const updateSessionField = useCallback(async (field, value) => {
    try {
      const sessionId = sessionState.currentSession.sessionId;

      if (!sessionId) {
        log('No active session to update');
        return;
      }

      log(`Updating session ${sessionId} field ${field}...`);

      // Update reducer state immediately (optimistic update)
      dispatchSession({
        type: SESSION_ACTIONS.UPDATE_SESSION_FIELD,
        payload: { field, value }
      });

      // Update in database (will be debounced via auto-save)
      log(`Field ${field} updated to:`, value);
    } catch (error) {
      logError(`Failed to update field ${field}:`, error);
      throw error;
    }
  }, [sessionState.currentSession.sessionId, dispatchSession]);

  /**
   * Load all sessions from database for this user
   * @returns {Promise<Array>} Array of session records
   */
  const loadAllSessions = useCallback(async () => {
    try {
      log(`Loading all sessions for user ${userId}...`);

      const sessions = await getAllSessions(userId);
      log(`Loaded ${sessions.length} sessions`);

      // Update reducer state
      dispatchSession({
        type: SESSION_ACTIONS.LOAD_SESSIONS,
        payload: { sessions }
      });

      return sessions;
    } catch (error) {
      logError('Failed to load sessions:', error);
      return [];
    }
  }, [dispatchSession, userId]);

  /**
   * Delete a session by ID
   * @param {number} sessionId - Session ID to delete
   * @returns {Promise<void>}
   */
  const deleteSessionById = useCallback(async (sessionId) => {
    try {
      log(`Deleting session ${sessionId}...`);

      await dbDeleteSession(sessionId);
      log(`Session ${sessionId} deleted`);

      // Reload all sessions to update list
      await loadAllSessions();
    } catch (error) {
      logError(`Failed to delete session ${sessionId}:`, error);
      throw error;
    }
  }, [loadAllSessions]);

  // ==========================================================================
  // RETURN VALUES
  // ==========================================================================

  return {
    isReady,
    startNewSession,
    endCurrentSession,
    updateSessionField,
    loadAllSessions,
    deleteSessionById
  };
};
