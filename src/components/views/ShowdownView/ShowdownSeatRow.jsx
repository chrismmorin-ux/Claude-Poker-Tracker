import React from 'react';
import PropTypes from 'prop-types';
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
  mode, // 'selection' or 'summary'
  showdownActionsArray = [],
  ranking = null,
  onSetHoleCardsVisible,
  onHighlightSlot,
  onMuck,
  onWon,
}) => {
  const canInteract = mode === 'selection' && inactiveStatus !== SEAT_STATUS.ABSENT && !isMucked;
  const isFolded = inactiveStatus === SEAT_STATUS.FOLDED;

  // Check if any seat has won (for hiding Won button on other seats)
  const someoneHasWon = mode === 'selection' && anyoneHasWon;

  return (
    <div className={`flex flex-col items-center ${isFolded ? 'opacity-40' : ''}`}>
      {/* Seat Number + Folded Badge */}
      <div className="text-sm font-bold mb-1">
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

      {/* Card Slots */}
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

      {/* Hand ranking badge */}
      {ranking && (
        <div className={`text-xs font-semibold mb-1 ${ranking.isWinner ? 'text-green-600' : 'text-gray-600'}`}>
          <span className={`inline-block px-1.5 py-0.5 rounded ${ranking.isWinner ? 'bg-green-100' : 'bg-gray-100'}`}>
            {ranking.rank === 1 ? '1st' : ranking.rank === 2 ? '2nd' : `${ranking.rank}th`} — {ranking.category}
          </span>
        </div>
      )}

      {/* Muck/Won Buttons - Only in selection mode for active seats */}
      {mode === 'selection' &&
        inactiveStatus !== SEAT_STATUS.FOLDED &&
        inactiveStatus !== SEAT_STATUS.ABSENT &&
        !isMucked &&
        !showdownActionsArray.includes(ACTIONS.WON) && (
          <div className="flex gap-1">
            <button
              onClick={() => onMuck(seat)}
              className="bg-gray-500 hover:bg-gray-600 text-white text-xs px-2 py-1 rounded font-semibold"
            >
              Muck
            </button>
            {/* Only show Won button if no seat has won yet */}
            {!someoneHasWon && (
              <button
                onClick={() => onWon(seat)}
                className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 rounded font-semibold"
              >
                Won
              </button>
            )}
          </div>
        )}
    </div>
  );
};

ShowdownSeatRow.propTypes = {
  seat: PropTypes.number.isRequired,
  cards: PropTypes.arrayOf(PropTypes.string).isRequired,
  isMySeat: PropTypes.bool.isRequired,
  isDealer: PropTypes.bool.isRequired,
  isSB: PropTypes.bool.isRequired,
  isBB: PropTypes.bool.isRequired,
  holeCardsVisible: PropTypes.bool.isRequired,
  inactiveStatus: PropTypes.string,
  isMucked: PropTypes.bool.isRequired,
  hasWon: PropTypes.bool.isRequired,
  anyoneHasWon: PropTypes.bool.isRequired,
  highlightedSeat: PropTypes.number,
  highlightedHoleSlot: PropTypes.number,
  mode: PropTypes.oneOf(['selection', 'summary']).isRequired,
  showdownActionsArray: PropTypes.arrayOf(PropTypes.string),
  ranking: PropTypes.shape({
    rank: PropTypes.number,
    category: PropTypes.string,
    isWinner: PropTypes.bool,
    score: PropTypes.number,
  }),
  onSetHoleCardsVisible: PropTypes.func.isRequired,
  onHighlightSlot: PropTypes.func,
  onMuck: PropTypes.func,
  onWon: PropTypes.func,
};
