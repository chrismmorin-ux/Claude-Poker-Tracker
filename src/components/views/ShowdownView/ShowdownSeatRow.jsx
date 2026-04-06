import React from 'react';
import { CardSlot } from '../../ui/CardSlot';
import { VisibilityToggle } from '../../ui/VisibilityToggle';
import { PositionBadge } from '../../ui/PositionBadge';
import { DiagonalOverlay } from '../../ui/DiagonalOverlay';
import { ACTIONS, SEAT_STATUS } from '../../../constants/gameConstants';
import { getOverlayStatus } from '../../../utils/actionUtils';

/**
 * ShowdownSeatRow - Individual seat display for showdown view
 * Handles both card selection and summary modes
 */
export const ShowdownSeatRow = ({
  seat,
  cards,
  isMySeat,
  isDealer,
  isSB,
  isBB,
  holeCardsVisible,
  inactiveStatus,
  isMucked,
  hasWon,
  anyoneHasWon,
  highlightedSeat,
  highlightedHoleSlot,
  mode, // 'selection', 'summary', or 'quick'
  showdownActionsArray = [],
  ranking = null,
  onSetHoleCardsVisible,
  onHighlightSlot,
  onMuck,
  onWon,
  hideCards = false,
  quickMode = false,
}) => {
  const canInteract = mode === 'selection' && inactiveStatus !== SEAT_STATUS.ABSENT && !isMucked;
  const isFolded = inactiveStatus === SEAT_STATUS.FOLDED;

  // Check if any seat has won (for hiding Won button on other seats)
  const someoneHasWon = mode === 'selection' && anyoneHasWon;

  return (
    <div
      className={`flex flex-col items-center ${isFolded ? 'opacity-40' : ''}`}
      style={hasWon ? {
        background: 'rgba(34, 197, 94, 0.15)',
        border: '2px solid #22c55e',
        borderRadius: '12px',
        padding: '8px 4px',
      } : { padding: '8px 4px' }}
    >
      {/* Seat Number + Folded Badge */}
      <div className="text-sm font-bold mb-1">
        {hasWon && <span className="text-green-500 mr-1">&#10003;</span>}
        Seat {seat}
        {isFolded && <span className="ml-1 text-xs text-red-600 font-normal">(F)</span>}
      </div>

      {/* Position Badges + Visibility Toggle */}
      <div className="flex gap-1 mb-1 items-center" style={{ minHeight: '24px' }}>
        {isDealer && <PositionBadge type="dealer" size="small" />}
        {isSB && <PositionBadge type="sb" size="small" />}
        {isBB && <PositionBadge type="bb" size="small" />}
        {isMySeat && <PositionBadge type="me" size="small" />}
        {isMySeat && (
          <VisibilityToggle
            visible={holeCardsVisible}
            onToggle={() => onSetHoleCardsVisible(!holeCardsVisible)}
            size="small"
          />
        )}
      </div>

      {/* Card Slots — hidden in quick showdown mode */}
      {!hideCards && (
        <div className="flex gap-1 mb-1 relative">
          {[0, 1].map(cardSlot => {
            const card = cards[cardSlot];
            const isHighlighted = mode === 'selection' && highlightedSeat === seat && highlightedHoleSlot === cardSlot;
            const shouldHideCard = isMySeat && !holeCardsVisible;
            const cardStatus = isMucked ? 'mucked' : hasWon ? 'won' : inactiveStatus || null;

            return (
              <CardSlot
                key={cardSlot}
                card={card}
                variant="showdown"
                isHighlighted={isHighlighted}
                isHidden={shouldHideCard}
                status={cardStatus}
                canInteract={canInteract}

                onClick={() => {
                  if (canInteract && onHighlightSlot) {
                    onHighlightSlot(seat, cardSlot);
                  }
                }}
              />
            );
          })}

          {/* Diagonal Overlay Label */}
          <DiagonalOverlay
            status={getOverlayStatus(inactiveStatus, isMucked, hasWon)}
            SEAT_STATUS={SEAT_STATUS}
          />
        </div>
      )}

      {/* Hand ranking badge */}
      {!hideCards && ranking && (
        <div className={`text-xs font-semibold mb-1 ${ranking.isWinner ? 'text-green-600' : 'text-gray-600'}`}>
          <span className={`inline-block px-1.5 py-0.5 rounded ${ranking.isWinner ? 'bg-green-100' : 'bg-gray-100'}`}>
            {ranking.rank === 1 ? '1st' : ranking.rank === 2 ? '2nd' : `${ranking.rank}th`} — {ranking.category}
          </span>
        </div>
      )}

      {/* Muck/Won Buttons - In selection or quick mode for active seats */}
      {(mode === 'selection' || mode === 'quick') &&
        inactiveStatus !== SEAT_STATUS.FOLDED &&
        inactiveStatus !== SEAT_STATUS.ABSENT &&
        !isMucked &&
        !showdownActionsArray.includes(ACTIONS.WON) && (
          <div className={`flex ${quickMode ? 'flex-col gap-2 w-full' : 'gap-1'}`}>
            <button
              onClick={() => onMuck(seat)}
              className={`btn-press bg-gray-500 hover:bg-gray-600 text-white rounded font-semibold ${
                quickMode ? 'text-base px-4 py-3' : 'text-xs px-2 py-1'
              }`}
              style={quickMode ? { minHeight: '48px' } : undefined}
            >
              Muck
            </button>
            {/* Only show Won button if no seat has won yet */}
            {!someoneHasWon && (
              <button
                onClick={() => onWon(seat)}
                className={`btn-press bg-green-500 hover:bg-green-600 text-white rounded font-semibold ${
                  quickMode ? 'text-base px-4 py-3' : 'text-xs px-2 py-1'
                }`}
                style={quickMode ? { minHeight: '48px' } : undefined}
              >
                Won
              </button>
            )}
          </div>
        )}
    </div>
  );
};

