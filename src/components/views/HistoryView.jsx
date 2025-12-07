import React, { useState, useEffect } from 'react';
import { ScaledContainer } from '../ui/ScaledContainer';
import { getAllHands, loadHandById, deleteHand, clearAllHands, getHandCount } from '../../utils/persistence';
import { GAME_ACTIONS } from '../../reducers/gameReducer';
import { CARD_ACTIONS } from '../../reducers/cardReducer';
import { PLAYER_ACTIONS } from '../../reducers/playerReducer';

const SCREEN = {
  TABLE: 'table',
  HISTORY: 'history',
};

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
  STREETS
}) => {
  const [hands, setHands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [handCount, setHandCount] = useState(0);

  // Load all hands on mount
  useEffect(() => {
    loadHands();
  }, []);

  const loadHands = async () => {
    setLoading(true);
    try {
      const allHands = await getAllHands();
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
      alert('Failed to load hand. Please try again.');
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
      alert('Failed to delete hand. Please try again.');
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
      alert('Failed to clear hands. Please try again.');
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
          const actions = streetActions[seat];
          if (Array.isArray(actions)) {
            actionCount += actions.length;
          } else if (actions) {
            actionCount += 1;
          }
        });
      }
    });

    return actionCount > 0 ? `${actionCount} actions` : 'No actions';
  };

  return (
    <ScaledContainer scale={scale}>
      <div className="bg-gray-50 overflow-y-auto" style={{ width: '1600px', height: '720px' }}>
        {/* Header */}
        <div className="bg-white border-b border-gray-300 p-6 sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Hand History</h2>
              <p className="text-gray-600 mt-1">
                {loading ? 'Loading...' : `${handCount} saved ${handCount === 1 ? 'hand' : 'hands'}`}
              </p>
            </div>
            <div className="flex gap-3">
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
