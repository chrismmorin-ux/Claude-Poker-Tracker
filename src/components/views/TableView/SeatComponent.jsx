import React from 'react';
import PropTypes from 'prop-types';
import { CardSlot } from '../../ui/CardSlot';
import { VisibilityToggle } from '../../ui/VisibilityToggle';
import { PositionBadge } from '../../ui/PositionBadge';
import { ActionSequence } from '../../ui/ActionSequence';
import { ExploitBadges } from '../../ui/ExploitBadges';
import { LAYOUT } from '../../../constants/gameConstants';

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
  exploitSummary,
  exploits,
  sampleSize,
  holeCards,
  holeCardsVisible,
  getSeatColor,
  onSeatClick,
  onSeatRightClick,
  onDealerDragStart,
  onHoleCardClick,
  onToggleVisibility,
  onOpenRangeDetail,
  seatBet,
  isPFR,
}) => {
  // Calculate player name offset based on position badges
  const hasOtherBadge = isDealer || isSmallBlind || isBigBlind;
  const hasPositionBadge = hasOtherBadge || isPFR;
  const playerNameMarginTop = (hasOtherBadge && isPFR) ? '64px' : hasPositionBadge ? '36px' : '4px';

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
          />
        </div>
      )}

      {/* Chip bet indicator — placed on inner concentric stadium (60% scale) */}
      {seatBet > 0 && (
        <div
          className="absolute z-10 pointer-events-none"
          style={(() => {
            const INNER_SCALE = 0.75;
            const half = LAYOUT.SEAT_SIZE / 2;
            // Chip position on inner stadium (scaled toward felt center)
            const chipX = 50 + (x - 50) * INNER_SCALE;
            const chipY = 50 + (y - 50) * INNER_SCALE;
            // Pixel offset from seat center
            const ox = ((chipX - x) / 100) * LAYOUT.FELT_WIDTH;
            const oy = ((chipY - y) / 100) * LAYOUT.FELT_HEIGHT;
            return {
              left: `${half + ox}px`,
              top: `${half + oy}px`,
              transform: 'translate(-50%, -50%)',
            };
          })()}
        >
          <div className="flex flex-col items-center">
            <div className="w-4 h-4 rounded-full bg-yellow-400 border-2 border-yellow-600 shadow" />
            <div className="bg-black/70 text-yellow-300 text-xs font-bold px-1 rounded whitespace-nowrap -mt-0.5">
              ${seatBet}
            </div>
          </div>
        </div>
      )}

      {/* Seat button with expanded hit area */}
      <div className="relative" style={{ width: `${LAYOUT.SEAT_SIZE}px`, height: `${LAYOUT.SEAT_SIZE}px` }}>
        <button
          onClick={() => onSeatClick(seat)}
          onContextMenu={(e) => onSeatRightClick(e, seat)}
          className={`absolute inset-0 rounded-lg shadow-lg transition-all font-bold text-lg ${getSeatColor(seat)}`}
          style={{ margin: '-4px', width: `${LAYOUT.SEAT_SIZE + 8}px`, height: `${LAYOUT.SEAT_SIZE + 8}px` }}
        >
          {seat}
        </button>
      </div>

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

      {/* PFR badge — shown on postflop streets */}
      {isPFR && (
        <div
          className="absolute top-full left-1/2 transform -translate-x-1/2"
          style={{ marginTop: (isDealer || isSmallBlind || isBigBlind) ? '36px' : '8px' }}
        >
          <PositionBadge type="pfr" size="large" />
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
          <div
            className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-blue-700"
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenRangeDetail) onOpenRangeDetail(seat);
            }}
          >
            {playerName}
          </div>
          {/* Exploit category badges */}
          {exploitSummary && (
            <div className="mt-1">
              <ExploitBadges
                exploitSummary={exploitSummary}
                sampleSize={sampleSize}
                exploits={exploits}
              />
            </div>
          )}
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
  exploitSummary: PropTypes.shape({
    weakness: PropTypes.number,
    strength: PropTypes.number,
    tendency: PropTypes.number,
    note: PropTypes.number,
  }),
  exploits: PropTypes.arrayOf(PropTypes.object),
  sampleSize: PropTypes.number,
  holeCards: PropTypes.arrayOf(PropTypes.string).isRequired,
  holeCardsVisible: PropTypes.bool.isRequired,
  getSeatColor: PropTypes.func.isRequired,
  onSeatClick: PropTypes.func.isRequired,
  onSeatRightClick: PropTypes.func.isRequired,
  onDealerDragStart: PropTypes.func.isRequired,
  onHoleCardClick: PropTypes.func.isRequired,
  onToggleVisibility: PropTypes.func.isRequired,
  onOpenRangeDetail: PropTypes.func,
  seatBet: PropTypes.number,
  isPFR: PropTypes.bool,
};
