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
  deleteSession as dbDeleteSession
} from '../utils/persistence';
import { SESSION_ACTIONS } from '../constants/sessionConstants';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEBOUNCE_DELAY = 1500; // 1.5 seconds
const DEBUG = true;

// =============================================================================
// LOGGING
// =============================================================================

const log = (...args) => DEBUG && console.log('[useSessionPersistence]', ...args);
const logError = (...args) => console.error('[useSessionPersistence]', ...args);

// =============================================================================
// SESSION PERSISTENCE HOOK
// =============================================================================

/**
 * useSessionPersistence - React hook for session persistence
 *
 * @param {Object} sessionState - Session state from sessionReducer
 * @param {Function} dispatchSession - Session state dispatcher
 * @returns {Object} { isReady, startNewSession, endCurrentSession, updateSessionField, loadAllSessions, deleteSessionById }
 */
export const useSessionPersistence = (sessionState, dispatchSession) => {
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
      log('Initializing session persistence...');

      try {
        // Load active session
        const activeSession = await getActiveSession();

        if (activeSession && activeSession.sessionId) {
          log(`Restoring active session ${activeSession.sessionId}`);

          // Get full session data
          const sessionData = await getSessionById(activeSession.sessionId);

          if (sessionData) {
            // Hydrate session state
            dispatchSession({
              type: SESSION_ACTIONS.HYDRATE_SESSION,
              payload: { session: sessionData }
            });
            log('Session state hydrated');
          }
        } else {
          log('No active session found - starting without session');
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
  }, []); // Run once on mount

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
   * Start a new session
   * @param {Object} sessionData - Session data (buyIn, goal, notes, etc.)
   * @returns {Promise<number>} The new session ID
   */
  const startNewSession = useCallback(async (sessionData = {}) => {
    try {
      log('Starting new session...');

      // Create session in database
      const sessionId = await createSession(sessionData);
      log(`Session ${sessionId} created in database`);

      // Set as active session
      await setActiveSession(sessionId);
      log(`Session ${sessionId} set as active`);

      // Update reducer state
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
      logError('Failed to start new session:', error);
      throw error;
    }
  }, [dispatchSession]);

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

      // Clear active session
      await clearActiveSession();
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
  }, [sessionState.currentSession.sessionId, dispatchSession]);

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
   * Load all sessions from database
   * @returns {Promise<Array>} Array of session records
   */
  const loadAllSessions = useCallback(async () => {
    try {
      log('Loading all sessions...');

      const sessions = await getAllSessions();
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
  }, [dispatchSession]);

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
