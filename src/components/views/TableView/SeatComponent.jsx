import React from 'react';
import PropTypes from 'prop-types';
import { CardSlot } from '../../ui/CardSlot';
import { VisibilityToggle } from '../../ui/VisibilityToggle';
import { PositionBadge } from '../../ui/PositionBadge';
import { ActionSequence } from '../../ui/ActionSequence';
import { LAYOUT, ACTIONS, ACTION_ABBREV } from '../../../constants/gameConstants';

/**
 * SeatComponent - Individual seat with action badges, position badges, and hole cards
 */
export const SeatComponent = ({
  seat,
  x,
  y,
  actionArray,
  isDealer,
  isSmallBlind,
  isBigBlind,
  isMySeat,
  playerName,
  holeCards,
  holeCardsVisible,
  getSeatColor,
  onSeatClick,
  onSeatRightClick,
  onDealerDragStart,
  onHoleCardClick,
  onToggleVisibility,
}) => {
  // Calculate player name offset based on position badges
  const hasPositionBadge = isDealer || isSmallBlind || isBigBlind;
  const playerNameMarginTop = hasPositionBadge ? '36px' : '4px';

  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {/* Action badges above seat */}
      {actionArray.length > 0 && (
        <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2">
          <ActionSequence
            actions={actionArray}
            size="small"
            maxVisible={2}
            ACTIONS={ACTIONS}
            ACTION_ABBREV={ACTION_ABBREV}
          />
        </div>
      )}

      {/* Seat button */}
      <button
        onClick={() => onSeatClick(seat)}
        onContextMenu={(e) => onSeatRightClick(e, seat)}
        className={`rounded-lg shadow-lg transition-all font-bold text-lg ${getSeatColor(seat)}`}
        style={{ width: `${LAYOUT.SEAT_SIZE}px`, height: `${LAYOUT.SEAT_SIZE}px` }}
      >
        {seat}
      </button>

      {/* Dealer button */}
      {isDealer && (
        <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2">
          <PositionBadge type="dealer" size="large" draggable={true} onDragStart={onDealerDragStart} />
        </div>
      )}

      {/* Small blind badge */}
      {isSmallBlind && (
        <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2">
          <PositionBadge type="sb" size="large" />
        </div>
      )}

      {/* Big blind badge */}
      {isBigBlind && (
        <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2">
          <PositionBadge type="bb" size="large" />
        </div>
      )}

      {/* Hole cards for my seat */}
      {isMySeat && (
        <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 flex gap-2 items-center">
          {holeCardsVisible ? (
            <>
              <CardSlot
                card={holeCards[0]}
                variant="hole-table"
                onClick={(e) => {
                  e.stopPropagation();
                  onHoleCardClick(0);
                }}
              />
              <CardSlot
                card={holeCards[1]}
                variant="hole-table"
                onClick={(e) => {
                  e.stopPropagation();
                  onHoleCardClick(1);
                }}
              />
            </>
          ) : (
            <>
              <CardSlot card={null} variant="hole-table" isHidden={true} canInteract={false} />
              <CardSlot card={null} variant="hole-table" isHidden={true} canInteract={false} />
            </>
          )}
          <VisibilityToggle
            visible={holeCardsVisible}
            onToggle={onToggleVisibility}
            size="large"
          />
        </div>
      )}

      {/* Player Name Badge */}
      {playerName && (
        <div
          className="absolute top-full left-1/2 transform -translate-x-1/2"
          style={{ marginTop: playerNameMarginTop }}
        >
          <div className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold whitespace-nowrap">
            {playerName}
          </div>
        </div>
      )}
    </div>
  );
};

SeatComponent.propTypes = {
  seat: PropTypes.number.isRequired,
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  actionArray: PropTypes.arrayOf(PropTypes.string).isRequired,
  isDealer: PropTypes.bool.isRequired,
  isSmallBlind: PropTypes.bool.isRequired,
  isBigBlind: PropTypes.bool.isRequired,
  isMySeat: PropTypes.bool.isRequired,
  playerName: PropTypes.string,
  holeCards: PropTypes.arrayOf(PropTypes.string).isRequired,
  holeCardsVisible: PropTypes.bool.isRequired,
  getSeatColor: PropTypes.func.isRequired,
  onSeatClick: PropTypes.func.isRequired,
  onSeatRightClick: PropTypes.func.isRequired,
  onDealerDragStart: PropTypes.func.isRequired,
  onHoleCardClick: PropTypes.func.isRequired,
  onToggleVisibility: PropTypes.func.isRequired,
};
