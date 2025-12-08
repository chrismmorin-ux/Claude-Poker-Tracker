import React, { useState, useEffect } from 'react';
import { ScaledContainer } from '../ui/ScaledContainer';
import { getAllHands, loadHandById, deleteHand, clearAllHands, getHandCount, getHandsBySessionId, getAllSessions } from '../../utils/persistence';
import { LAYOUT } from '../../constants/gameConstants';
import { GAME_ACTIONS } from '../../reducers/gameReducer';
import { CARD_ACTIONS } from '../../reducers/cardReducer';
import { PLAYER_ACTIONS } from '../../reducers/playerReducer';

const SCREEN = {
  TABLE: 'table',
  HISTORY: 'history',
};

// Filter options
const FILTER_ALL = 'all';
const FILTER_NO_SESSION = 'no_session';

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
  STREETS,
  showError
}) => {
  const [hands, setHands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [handCount, setHandCount] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [sessionFilter, setSessionFilter] = useState(FILTER_ALL);
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
      } else if (sessionFilter === FILTER_NO_SESSION) {
        // Get all hands and filter for those without a session
        const all = await getAllHands();
        allHands = all.filter(h => !h.sessionId);
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

  const handleDeleteHand = async (handId) => {
    if (!confirm('Delete this hand? This cannot be undone.')) {
      return;
    }

    try {
      await deleteHand(handId);
      console.log(`[HistoryView] Deleted hand ${handId}`);

      // Reload hand list
      await loadHands();
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

      // Reload hand list
      await loadHands();
    } catch (error) {
      console.error('[HistoryView] Failed to clear hands:', error);
      showError('Failed to clear hands. Please try again.');
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Relative time for recent hands
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    // Absolute time for older hands
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStreetDisplay = (street) => {
    if (!street) return 'preflop';
    return street;
  };

  const getActionSummary = (hand) => {
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
                <option value={FILTER_ALL}>All Sessions</option>
                <option value={FILTER_NO_SESSION}>No Session</option>
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
            <div className="grid grid-cols-1 gap-3">
              {hands.map((hand) => (
                <div
                  key={hand.handId}
                  className="bg-white rounded-lg border-2 border-gray-300 hover:border-blue-500 transition-colors"
                >
                  <div className="p-4 flex items-center justify-between">
                    {/* Hand Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <div className="text-2xl font-bold text-gray-700">
                          #{hand.handId}
                        </div>
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
                          {hand.sessionId && getSessionLabel(hand.sessionId) && (
                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">
                              {getSessionLabel(hand.sessionId)}
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
                        onClick={() => handleDeleteHand(hand.handId)}
                        className="bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScaledContainer>
  );
};
