import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { CardSlot } from '../ui/CardSlot';
import { VisibilityToggle } from '../ui/VisibilityToggle';
import { isRedSuit } from '../../utils/displayUtils';
import { LAYOUT } from '../../constants/gameConstants';
import { useCard, useUI, useGame } from '../../contexts';
import { CARD_ACTIONS } from '../../reducers/cardReducer';

// Card constants
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = ['♠', '♥', '♦', '♣'];

/**
 * CardSelectorView - Interactive card selection interface
 * Used for selecting community cards and hole cards
 */
export const CardSelectorView = ({
  scale,
  getCardStreet,
  selectCard,
  clearCards,
  handleCloseCardSelector,
}) => {
  // Get card state from CardContext
  const {
    communityCards,
    holeCards,
    holeCardsVisible,
    dispatchCard,
  } = useCard();

  // Get UI state from UIContext
  const {
    cardSelectorType,
    highlightedBoardIndex,
    setCardSelectorType,
    setHighlightedCardIndex,
  } = useUI();

  // Get game state from GameContext
  const { currentStreet } = useGame();

  // Handler for toggling hole cards visibility
  const handleToggleHoleCardsVisibility = useCallback(() => {
    dispatchCard({ type: CARD_ACTIONS.TOGGLE_HOLE_VISIBILITY });
  }, [dispatchCard]);
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-800 overflow-hidden">
      <div style={{
        width: `${LAYOUT.TABLE_WIDTH}px`,
        height: `${LAYOUT.TABLE_HEIGHT}px`,
        transform: `scale(${scale})`,
        transformOrigin: 'center center'
      }}>
        <div
          className="bg-gradient-to-br from-green-800 to-green-900 flex flex-col"
          style={{ width: `${LAYOUT.TABLE_WIDTH}px`, height: `${LAYOUT.TABLE_HEIGHT}px` }}
        >
          <div className="bg-white p-6 flex justify-between items-center">
            <h2 className="text-3xl font-bold capitalize">
              Select Cards: {currentStreet}
            </h2>
            <div className="flex items-center gap-4">
              {/* Community Cards Display */}
              <div>
                <div className="text-sm font-bold mb-2 text-center">BOARD</div>
                <div className="flex gap-2">
                  {[0, 1, 2, 3, 4].map((idx) => {
                    const isHighlighted = cardSelectorType === 'community' && highlightedBoardIndex === idx;
                    return (
                      <CardSlot
                        key={idx}
                        card={communityCards[idx]}
                        variant="selector"
                        isHighlighted={isHighlighted}
                        onClick={() => {setCardSelectorType('community'); setHighlightedCardIndex(idx);}}
                      />
                    );
                  })}
                </div>
              </div>
              {/* Vertical Separator */}
              <div className="h-24 w-1 bg-gray-300"></div>
              {/* Hole Cards Display */}
              <div>
                <div className="text-sm font-bold mb-2 text-center">HOLE CARDS</div>
                <div className="flex gap-2 items-center">
                  {[0, 1].map((idx) => {
                    const isHighlighted = cardSelectorType === 'hole' && highlightedBoardIndex === idx;
                    return (
                      <CardSlot
                        key={idx}
                        card={holeCards[idx]}
                        variant="selector"
                        isHighlighted={isHighlighted}
                        isHidden={!holeCardsVisible}
                        onClick={() => {setCardSelectorType('hole'); setHighlightedCardIndex(idx);}}
                      />
                    );
                  })}
                  <VisibilityToggle
                    visible={holeCardsVisible}
                    onToggle={handleToggleHoleCardsVisibility}
                    size="large"
                  />
                </div>
              </div>
              <button
                onClick={() => clearCards('community')}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg text-xl font-bold"
              >
                Clear Board
              </button>
              <button
                onClick={() => clearCards('hole')}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg text-xl font-bold"
              >
                Clear Hole
              </button>
              <button
                onClick={handleCloseCardSelector}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg text-xl font-bold"
              >
                Table View
              </button>
            </div>
          </div>

          <div className="flex-1 bg-white py-1 px-2 overflow-hidden flex items-center justify-center">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  {RANKS.map(rank => (
                    <th key={rank} className="text-center">
                      <div className="text-xl font-bold">{rank}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SUITS.map(suit => (
                  <tr key={suit}>
                    <td className="text-center" style={{ width: '40px' }}>
                      <div className={`text-3xl ${isRedSuit(suit) ? 'text-red-600' : 'text-black'}`}>
                        {suit}
                      </div>
                    </td>
                    {RANKS.map(rank => {
                      const card = `${rank}${suit}`;
                      const isInCommunity = communityCards.includes(card);
                      const isInHole = holeCards.includes(card);
                      // Only consider it "used" if it's visible
                      const isUsed = isInCommunity || (holeCardsVisible && isInHole);
                      const canSelect = highlightedBoardIndex !== null;
                      const streetIndicator = getCardStreet(card);

                      return (
                        <td key={card} className="p-1 relative">
                          <button
                            onClick={() => canSelect && selectCard(card)}
                            disabled={!canSelect}
                            className={`w-full rounded-lg font-bold transition-all relative flex flex-col items-center justify-center gap-1 ${
                              isUsed
                                ? 'bg-gray-300 text-gray-400 cursor-not-allowed opacity-40'
                                : highlightedBoardIndex === null
                                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                  : isRedSuit(suit)
                                    ? 'bg-red-50 hover:bg-red-200 border-2 border-red-400 text-red-600 hover:scale-105'
                                    : 'bg-gray-50 hover:bg-gray-200 border-2 border-gray-800 text-black hover:scale-105'
                            }`}
                            style={{ height: '90px', width: '62px' }}
                          >
                            <div className="text-lg font-bold">{rank}</div>
                            <div className="text-3xl leading-none">{suit}</div>
                            {streetIndicator && (
                              <div className="absolute bottom-0 right-0 bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-tl">
                                {streetIndicator}
                              </div>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

CardSelectorView.propTypes = {
  // Layout
  scale: PropTypes.number.isRequired,

  // Utility functions (still passed from parent until further refactoring)
  getCardStreet: PropTypes.func.isRequired,
  selectCard: PropTypes.func.isRequired,
  clearCards: PropTypes.func.isRequired,

  // Handlers
  handleCloseCardSelector: PropTypes.func.isRequired,
};
