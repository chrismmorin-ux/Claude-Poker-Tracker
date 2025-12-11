import React, { useState, useEffect } from 'react';
import { ScaledContainer } from '../ui/ScaledContainer';
import { getAllHands, loadHandById, deleteHand, clearAllHands, getHandCount, getHandsBySessionId, getAllSessions, getSessionHandCount } from '../../utils/persistence';
import { LAYOUT } from '../../constants/gameConstants';
import { GAME_ACTIONS } from '../../reducers/gameReducer';
import { CARD_ACTIONS } from '../../reducers/cardReducer';
import { PLAYER_ACTIONS } from '../../reducers/playerReducer';
import { SESSION_ACTIONS } from '../../reducers/sessionReducer';

const SCREEN = {
  TABLE: 'table',
  HISTORY: 'history',
};

// Filter options
const FILTER_ALL = 'all';
const FILTER_CURRENT_SESSION = 'current_session';

/**
 * HistoryView - Displays saved hand history
 * Lists all saved hands with timestamps and allows loading/deleting
 */
export const HistoryView = ({
  scale,
  setCurrentScreen,
  dispatchGame,
  dispatchCard,
  dispatchPlayer,
  dispatchSession,
  STREETS,
  showError,
  showSuccess,
  showInfo,
  currentSessionId
}) => {
  const [hands, setHands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [handCount, setHandCount] = useState(0);
  const [sessions, setSessions] = useState([]);
  // Default to current session if available, otherwise all
  const [sessionFilter, setSessionFilter] = useState(
    currentSessionId ? FILTER_CURRENT_SESSION : FILTER_ALL
  );
  const [sessionsMap, setSessionsMap] = useState({}); // Map sessionId to session data

  // Load all hands and sessions on mount
  useEffect(() => {
    loadSessionsData();
    loadHands();
  }, []);

  // Reload hands when filter changes
  useEffect(() => {
    loadHands();
  }, [sessionFilter]);

  const loadSessionsData = async () => {
    try {
      const allSessions = await getAllSessions();
      setSessions(allSessions);

      // Create a map for quick lookup
      const map = {};
      allSessions.forEach(session => {
        map[session.sessionId] = session;
      });
      setSessionsMap(map);
    } catch (error) {
      console.error('[HistoryView] Failed to load sessions:', error);
    }
  };

  const loadHands = async () => {
    setLoading(true);
    try {
      let allHands;

      if (sessionFilter === FILTER_ALL) {
        allHands = await getAllHands();
      } else if (sessionFilter === FILTER_CURRENT_SESSION) {
        // Filter by current session if available
        if (currentSessionId) {
          allHands = await getHandsBySessionId(currentSessionId);
        } else {
          // No current session, show all hands
          allHands = await getAllHands();
        }
      } else {
        // Filter by specific session ID
        allHands = await getHandsBySessionId(parseInt(sessionFilter, 10));
      }

      const count = await getHandCount();

      // Sort by timestamp descending (most recent first)
      const sortedHands = allHands.sort((a, b) => b.timestamp - a.timestamp);

      setHands(sortedHands);
      setHandCount(count);
    } catch (error) {
      console.error('[HistoryView] Failed to load hands:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadHand = async (handId) => {
    try {
      const hand = await loadHandById(handId);

      if (hand) {
        // Hydrate game state
        if (hand.gameState) {
          dispatchGame({
            type: GAME_ACTIONS.HYDRATE_STATE,
            payload: hand.gameState
          });
        }

        // Hydrate card state
        if (hand.cardState) {
          dispatchCard({
            type: CARD_ACTIONS.HYDRATE_STATE,
            payload: {
              communityCards: hand.cardState.communityCards,
              holeCards: hand.cardState.holeCards,
              holeCardsVisible: hand.cardState.holeCardsVisible,
              allPlayerCards: hand.cardState.allPlayerCards
            }
          });
        }

        // Hydrate player seat assignments
        if (hand.seatPlayers && dispatchPlayer) {
          dispatchPlayer({
            type: PLAYER_ACTIONS.HYDRATE_SEAT_PLAYERS,
            payload: { seatPlayers: hand.seatPlayers }
          });
        }

        // Return to table view
        setCurrentScreen(SCREEN.TABLE);

        console.log(`[HistoryView] Loaded hand ${handId}`);
      }
    } catch (error) {
      console.error('[HistoryView] Failed to load hand:', error);
      showError('Failed to load hand. Please try again.');
    }
  };

  const handleDeleteHand = async (handId, handSessionId) => {
    if (!confirm('Delete this hand? This cannot be undone.')) {
      return;
    }

    try {
      await deleteHand(handId);
      console.log(`[HistoryView] Deleted hand ${handId}`);

      // If deleted hand was from current session, update the session hand count
      if (currentSessionId && handSessionId === currentSessionId && dispatchSession) {
        try {
          const newCount = await getSessionHandCount(currentSessionId);
          dispatchSession({
            type: SESSION_ACTIONS.SET_HAND_COUNT,
            payload: { count: newCount }
          });
        } catch (countError) {
          console.error('[HistoryView] Failed to update hand count:', countError);
          // Non-fatal: hand was deleted, just couldn't sync count
        }
      }

      // Reload hand list
      await loadHands();
      if (showSuccess) {
        showSuccess('Hand deleted');
      }
    } catch (error) {
      console.error('[HistoryView] Failed to delete hand:', error);
      showError('Failed to delete hand. Please try again.');
    }
  };

  const handleClearAll = async () => {
    if (!confirm(`Delete all ${handCount} hands? This cannot be undone.`)) {
      return;
    }

    try {
      await clearAllHands();
      console.log('[HistoryView] Cleared all hands');

      // Reset session hand count since all hands are cleared
      if (dispatchSession) {
        dispatchSession({
          type: SESSION_ACTIONS.SET_HAND_COUNT,
          payload: { count: 0 }
        });
      }

      // Reload hand list
      await loadHands();
      if (showSuccess) {
        showSuccess('History cleared');
      }
    } catch (error) {
      console.error('[HistoryView] Failed to clear hands:', error);
      showError('Failed to clear hands. Please try again.');
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStreetDisplay = (street) => {
    if (!street) return 'preflop';
    return street;
  };

  const getActionSummary = (hand) => {
    // Prefer actionSequence (new format) if available
    const sequence = hand.actionSequence || hand.gameState?.actionSequence;
    if (sequence && sequence.length > 0) {
      return `${sequence.length} actions`;
    }

    // Fallback to counting seatActions (legacy format)
    if (!hand.gameState || !hand.gameState.seatActions) {
      return 'No actions';
    }

    const seatActions = hand.gameState.seatActions;
    const streets = STREETS || ['preflop', 'flop', 'turn', 'river', 'showdown'];

    // Count total actions across all streets
    let actionCount = 0;
    streets.forEach(street => {
      const streetActions = seatActions[street];
      if (streetActions) {
        Object.keys(streetActions).forEach(seat => {
          const actions = streetActions[seat] || [];
          actionCount += actions.length;
        });
      }
    });

    return actionCount > 0 ? `${actionCount} actions` : 'No actions';
  };

  const getSessionLabel = (sessionId) => {
    if (!sessionId) return null;
    const session = sessionsMap[sessionId];
    if (!session) return `Session #${sessionId}`;

    const date = new Date(session.startTime);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const venue = session.venue || 'Unknown';
    return `${dateStr} - ${venue}`;
  };

  const formatSessionOption = (session) => {
    const date = new Date(session.startTime);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const venue = session.venue || 'Unknown';
    return `${dateStr} - ${venue} (${session.handCount || 0} hands)`;
  };

  return (
    <ScaledContainer scale={scale}>
      <div className="bg-gray-50 overflow-y-auto" style={{ width: `${LAYOUT.TABLE_WIDTH}px`, height: `${LAYOUT.TABLE_HEIGHT}px` }}>
        {/* Header */}
        <div className="bg-white border-b border-gray-300 p-6 sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Hand History</h2>
              <p className="text-gray-600 mt-1">
                {loading ? 'Loading...' : `${hands.length} ${sessionFilter === FILTER_ALL ? 'of ' + handCount + ' total' : ''} ${hands.length === 1 ? 'hand' : 'hands'}`}
              </p>
            </div>
            <div className="flex gap-3 items-center">
              {/* Session Filter Dropdown */}
              <select
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                className="px-4 py-3 rounded-lg border-2 border-gray-300 bg-white text-gray-700 font-medium focus:border-blue-500 focus:outline-none"
              >
                {currentSessionId && (
                  <option value={FILTER_CURRENT_SESSION}>Current Session</option>
                )}
                <option value={FILTER_ALL}>All Sessions</option>
                {sessions
                  .sort((a, b) => b.startTime - a.startTime)
                  .map(session => (
                    <option key={session.sessionId} value={session.sessionId}>
                      {formatSessionOption(session)}
                    </option>
                  ))
                }
              </select>
              {handCount > 0 && (
                <button
                  onClick={handleClearAll}
                  className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-semibold"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => setCurrentScreen(SCREEN.TABLE)}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold"
              >
                ⬅ Back to Table
              </button>
            </div>
          </div>
        </div>

        {/* Hand List */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-20">
              <div className="text-gray-500 text-xl">Loading hands...</div>
            </div>
          ) : hands.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-gray-400 text-2xl mb-2">No hands saved yet</div>
              <div className="text-gray-500">Play a hand and it will be automatically saved here</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {hands.map((hand, index) => {
                // Check if this is the first hand of a new session (for session headers)
                const prevHand = index > 0 ? hands[index - 1] : null;
                const isNewSession = !prevHand || prevHand.sessionId !== hand.sessionId;
                const showSessionHeader = sessionFilter === FILTER_ALL && isNewSession;

                // Get session color for left border (alternating colors by session)
                const sessionColors = [
                  'border-l-purple-500',
                  'border-l-blue-500',
                  'border-l-green-500',
                  'border-l-orange-500',
                  'border-l-pink-500',
                  'border-l-teal-500',
                ];
                const sessionIndex = hand.sessionId
                  ? Object.keys(sessionsMap).indexOf(String(hand.sessionId)) % sessionColors.length
                  : -1;
                const borderColor = sessionIndex >= 0 ? sessionColors[sessionIndex] : 'border-l-gray-300';

                return (
                  <React.Fragment key={hand.handId}>
                    {/* Session Header - shown when session changes */}
                    {showSessionHeader && (
                      <div className="mt-4 mb-2 first:mt-0">
                        <div className={`bg-gray-100 rounded-lg px-4 py-3 border-l-4 ${borderColor}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-gray-700">
                                {hand.sessionId ? getSessionLabel(hand.sessionId) : 'No Session'}
                              </span>
                              {hand.sessionId && sessionsMap[hand.sessionId] && (
                                <span className="text-sm text-gray-500">
                                  {sessionsMap[hand.sessionId].gameType || '1/2'}
                                </span>
                              )}
                            </div>
                            <span className="text-sm text-gray-500">
                              {hands.filter(h => h.sessionId === hand.sessionId).length} hands
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Hand Card */}
                    <div
                      className={`bg-white rounded-lg border-2 border-gray-300 hover:border-blue-500 transition-colors ${
                        sessionFilter === FILTER_ALL ? `border-l-4 ${borderColor}` : ''
                      }`}
                    >
                      <div className="p-4 flex items-center justify-between">
                        {/* Hand Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <div className="text-2xl font-bold text-gray-700">
                              {/* Display session hand number if available, otherwise fall back to handId */}
                              #{hand.sessionHandNumber || hand.handId}
                            </div>
                            {/* Show handDisplayId for reference/search */}
                            {hand.handDisplayId && (
                              <div className="text-xs text-gray-400 font-mono">
                                {hand.handDisplayId}
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <span className="bg-blue-100 text-blue-900 px-3 py-1 rounded-full text-sm font-semibold">
                                {getStreetDisplay(hand.gameState?.currentStreet)}
                              </span>
                              <span className="text-gray-600 text-sm">
                                {formatTimestamp(hand.timestamp)}
                              </span>
                              <span className="text-gray-500 text-sm">
                                {getActionSummary(hand)}
                              </span>
                              {hand.gameState?.mySeat && (
                                <span className="text-gray-500 text-sm">
                                  Seat {hand.gameState.mySeat}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleLoadHand(hand.handId)}
                            className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 font-semibold"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => handleDeleteHand(hand.handId, hand.sessionId)}
                            className="bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 font-semibold"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ScaledContainer>
  );
};
