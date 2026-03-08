import React from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';
import { CardSlot } from './CardSlot';
import { isRedSuit } from '../../utils/displayUtils';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = ['♠', '♥', '♦', '♣'];

/**
 * CardSelectorOverlay - Compact card picker rendered as a portal overlay on top of the table
 */
export const CardSelectorOverlay = ({
  isOpen,
  communityCards,
  holeCards,
  holeCardsVisible,
  cardSelectorType,
  highlightedBoardIndex,
  onSelectCard,
  onClose,
  getCardStreet,
  setCardSelectorType,
  setHighlightedCardIndex,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl p-4 max-w-[760px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: board slots + hole slots + close */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((idx) => {
                const isHighlighted = cardSelectorType === 'community' && highlightedBoardIndex === idx;
                return (
                  <CardSlot
                    key={idx}
                    card={communityCards[idx]}
                    variant="selector"
                    isHighlighted={isHighlighted}
                    onClick={() => { setCardSelectorType('community'); setHighlightedCardIndex(idx); }}
                  />
                );
              })}
            </div>
            <div className="h-10 w-px bg-gray-300" />
            <div className="flex gap-1">
              {[0, 1].map((idx) => {
                const isHighlighted = cardSelectorType === 'hole' && highlightedBoardIndex === idx;
                return (
                  <CardSlot
                    key={idx}
                    card={holeCards[idx]}
                    variant="selector"
                    isHighlighted={isHighlighted}
                    isHidden={!holeCardsVisible}
                    onClick={() => { setCardSelectorType('hole'); setHighlightedCardIndex(idx); }}
                  />
                );
              })}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-3 p-1 rounded hover:bg-gray-200"
            aria-label="Close card selector"
          >
            <X size={22} />
          </button>
        </div>

        {/* Card grid */}
        <table className="border-collapse">
          <thead>
            <tr>
              <th style={{ width: '28px' }}></th>
              {RANKS.map(rank => (
                <th key={rank} className="text-center">
                  <div className="text-sm font-bold">{rank}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SUITS.map(suit => (
              <tr key={suit}>
                <td className="text-center" style={{ width: '28px' }}>
                  <div className={`text-xl ${isRedSuit(suit) ? 'text-red-600' : 'text-black'}`}>
                    {suit}
                  </div>
                </td>
                {RANKS.map(rank => {
                  const card = `${rank}${suit}`;
                  const isInCommunity = communityCards.includes(card);
                  const isInHole = holeCards.includes(card);
                  const isUsed = isInCommunity || (holeCardsVisible && isInHole);
                  const canSelect = highlightedBoardIndex !== null;
                  const streetIndicator = getCardStreet(card);

                  return (
                    <td key={card} className="p-0.5 relative">
                      <button
                        onClick={() => canSelect && onSelectCard(card)}
                        disabled={!canSelect}
                        className={`w-full rounded font-bold transition-all relative flex flex-col items-center justify-center ${
                          isUsed
                            ? 'bg-gray-300 text-gray-400 cursor-not-allowed opacity-40'
                            : highlightedBoardIndex === null
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : isRedSuit(suit)
                                ? 'bg-red-50 hover:bg-red-200 border border-red-400 text-red-600 hover:scale-105'
                                : 'bg-gray-50 hover:bg-gray-200 border border-gray-800 text-black hover:scale-105'
                        }`}
                        style={{ height: '68px', width: '48px' }}
                      >
                        <div className="text-sm font-bold">{rank}</div>
                        <div className="text-xl leading-none">{suit}</div>
                        {streetIndicator && (
                          <div className="absolute bottom-0 right-0 bg-blue-600 text-white text-[9px] font-bold px-1 rounded-tl">
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
    </div>,
    document.body
  );
};

CardSelectorOverlay.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  communityCards: PropTypes.array.isRequired,
  holeCards: PropTypes.array.isRequired,
  holeCardsVisible: PropTypes.bool.isRequired,
  cardSelectorType: PropTypes.string,
  highlightedBoardIndex: PropTypes.number,
  onSelectCard: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  getCardStreet: PropTypes.func.isRequired,
  setCardSelectorType: PropTypes.func.isRequired,
  setHighlightedCardIndex: PropTypes.func.isRequired,
};
