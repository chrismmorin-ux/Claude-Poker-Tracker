import React from 'react';
import PropTypes from 'prop-types';
import { isRedSuit } from '../../../utils/displayUtils';

// Card constants
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = ['♠', '♥', '♦', '♣'];

/**
 * CardGrid - 52-card selection grid for showdown card assignment
 */
export const CardGrid = ({
  communityCards,
  holeCards,
  allPlayerCards,
  mySeat,
  highlightedSeat,
  highlightedHoleSlot,
  onSelectCard,
}) => {
  const canSelect = highlightedSeat !== null && highlightedHoleSlot !== null;

  return (
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

                // Check if card is used in community cards
                const isInCommunity = communityCards.includes(card);
                const communityIndex = communityCards.indexOf(card);

                // Check if card is used in any player's hand
                let usedBySeat = null;

                // Check my seat's hole cards
                if (holeCards.includes(card)) {
                  usedBySeat = mySeat;
                }

                // Check all other players
                Object.entries(allPlayerCards).forEach(([seat, playerHand]) => {
                  if (playerHand.indexOf(card) !== -1) {
                    usedBySeat = parseInt(seat);
                  }
                });

                const isUsed = isInCommunity || usedBySeat !== null;

                // Get street indicator for community cards
                let streetIndicator = null;
                if (isInCommunity) {
                  if (communityIndex <= 2) streetIndicator = 'F';
                  else if (communityIndex === 3) streetIndicator = 'T';
                  else if (communityIndex === 4) streetIndicator = 'R';
                }

                return (
                  <td key={card} className="p-1 relative">
                    <button
                      onClick={() => canSelect && onSelectCard(card)}
                      disabled={!canSelect}
                      className={`w-full rounded-lg font-bold transition-all relative flex flex-col items-center justify-center gap-1 ${
                        isUsed
                          ? 'bg-gray-300 text-gray-400 cursor-not-allowed opacity-40'
                          : !canSelect
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
                      {usedBySeat !== null && (
                        <div className="absolute top-1 left-1 bg-green-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {usedBySeat}
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
  );
};

CardGrid.propTypes = {
  communityCards: PropTypes.arrayOf(PropTypes.string).isRequired,
  holeCards: PropTypes.arrayOf(PropTypes.string).isRequired,
  allPlayerCards: PropTypes.object.isRequired,
  mySeat: PropTypes.number.isRequired,
  highlightedSeat: PropTypes.number,
  highlightedHoleSlot: PropTypes.number,
  onSelectCard: PropTypes.func.isRequired,
};
