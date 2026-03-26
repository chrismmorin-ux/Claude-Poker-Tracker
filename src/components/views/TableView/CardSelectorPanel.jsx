import React from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { CardSlot } from '../../ui/CardSlot';
import { isRedSuit } from '../../../utils/displayUtils';

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];

/**
 * CardSelectorPanel - Full-screen card picker overlay
 * Uses position:fixed to give cards maximum thumb-friendly touch targets.
 */
export const CardSelectorPanel = ({
  currentStreet,
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
  onToggleHoleVisibility,
  onClearBoard,
  onClearHole,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-gray-900/95 flex flex-col"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Single header row: Board slots + Hole slots + actions + close */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-4">
          {/* Board cards */}
          <div>
            <div className="text-xs font-bold text-gray-400 mb-1">BOARD</div>
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
          </div>

          <div className="h-10 w-px bg-gray-600" />

          {/* Hole cards */}
          <div>
            <div className="text-xs font-bold text-gray-400 mb-1">HOLE CARDS</div>
            <div className="flex gap-1 items-center">
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
              <button
                onClick={onToggleHoleVisibility}
                className="ml-1 p-2 rounded-lg hover:bg-gray-700 text-gray-300"
                title={holeCardsVisible ? 'Hide hole cards' : 'Show hole cards'}
              >
                {holeCardsVisible ? <Eye size={22} /> : <EyeOff size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Street indicator */}
        <div className="text-3xl font-extrabold text-blue-400 capitalize tracking-wide">{currentStreet}</div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClearBoard}
            className="bg-red-700 hover:bg-red-800 text-white px-5 py-3 rounded-lg font-bold text-base min-h-[48px]"
          >
            Clear Board
          </button>
          <button
            onClick={onClearHole}
            className="bg-red-700 hover:bg-red-800 text-white px-5 py-3 rounded-lg font-bold text-base min-h-[48px]"
          >
            Clear Hole
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-base min-h-[48px]"
          >
            <X size={20} />
            Back to Table
          </button>
        </div>
      </div>

      {/* Card Grid — fills all remaining screen space */}
      <div className="flex-1 flex flex-col px-3 py-2 overflow-hidden">
        {/* Rank headers */}
        <div className="flex mb-1">
          <div style={{ width: '40px', flexShrink: 0 }} />
          {RANKS.map(rank => (
            <div key={rank} className="flex-1 text-center">
              <span className="text-lg font-bold text-gray-300">{rank}</span>
            </div>
          ))}
        </div>
        {/* Card rows — each row stretches to fill equal vertical space */}
        <div className="flex-1 flex flex-col gap-1.5">
          {SUITS.map(suit => (
            <div key={suit} className="flex-1 flex gap-1 min-h-0">
              <div className="flex items-center justify-center" style={{ width: '40px', flexShrink: 0 }}>
                <span className={`text-3xl font-bold ${isRedSuit(suit) ? 'text-red-400' : 'text-white'}`}>
                  {suit}
                </span>
              </div>
              {RANKS.map(rank => {
                const card = `${rank}${suit}`;
                const isInCommunity = communityCards.includes(card);
                const isInHole = holeCards.includes(card);
                const isUsed = isInCommunity || (holeCardsVisible && isInHole);
                const canSelect = highlightedBoardIndex !== null;
                const streetIndicator = getCardStreet(card);

                return (
                  <button
                    key={card}
                    onClick={() => canSelect && onSelectCard(card)}
                    disabled={!canSelect}
                    className={`flex-1 rounded-lg font-bold transition-all relative flex flex-col items-center justify-center min-w-0 ${
                      isUsed
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-40'
                        : highlightedBoardIndex === null
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : isRedSuit(suit)
                            ? 'bg-red-900/60 hover:bg-red-700/80 border-2 border-red-500 text-red-300'
                            : 'bg-gray-700 hover:bg-gray-500 border-2 border-gray-400 text-white'
                    }`}
                  >
                    <div className="text-xl font-bold leading-tight">{rank}</div>
                    <div className="text-2xl leading-none">{suit}</div>
                    {streetIndicator && (
                      <div className="absolute bottom-0.5 right-0.5 bg-blue-600 text-white text-[9px] font-bold px-1 rounded">
                        {streetIndicator}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


