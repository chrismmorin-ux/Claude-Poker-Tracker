import React, { useRef, useCallback } from 'react';
import { CardSlot } from '../../ui/CardSlot';
import { VisibilityToggle } from '../../ui/VisibilityToggle';
import { PositionBadge } from '../../ui/PositionBadge';
import { ActionSequence } from '../../ui/ActionSequence';
import { ExploitBadges } from '../../ui/ExploitBadges';
import IdentityAvatar from '../../ui/IdentityAvatar';
import { LAYOUT } from '../../../constants/gameConstants';

const LONG_PRESS_MS = 500;

/**
 * SeatComponent - Individual seat with action badges, position badges, and hole cards
 */
const SeatComponentInner = ({
  seat,
  x,
  y,
  actionArray,
  isDealer,
  isSmallBlind,
  isBigBlind,
  isMySeat,
  playerName,
  player, // Phase 2: full player record for IdentityAvatar render
  exploitSummary,
  exploits,
  sampleSize,
  pendingBriefingCount = 0,
  weaknessCount = 0,
  holeCards,
  holeCardsVisible,
  getSeatColor,
  onSeatClick,
  onSeatRightClick,
  onSeatLongPress, // WS-002 Sprint A2: optional; fires after 500ms hold
  onDealerDragStart,
  onHoleCardClick,
  onToggleVisibility,
  onOpenRangeDetail,
  seatBet,
  isPFR,
  isStraddler = false, // WS-002 Sprint A2: render "STR" badge overlay
  isNextToAct = false,
}) => {
  // Seat color (returns { className, style })
  const seatColor = getSeatColor(seat);

  // WS-002 Sprint A2: long-press timer for the straddle gesture.
  // Mirror of CommandStrip's sizing-button long-press pattern. Started on
  // pointerdown, cleared on pointerup / pointerleave / pointercancel.
  const longPressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);

  const startLongPress = useCallback(() => {
    if (!onSeatLongPress) return;
    longPressFiredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      onSeatLongPress(seat);
    }, LONG_PRESS_MS);
  }, [onSeatLongPress, seat]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    // Suppress click if long-press already fired — otherwise the straddle
    // modal opens AND the seat gets selected.
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    onSeatClick(seat);
  }, [onSeatClick, seat]);

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
          onClick={handleClick}
          onContextMenu={(e) => onSeatRightClick(e, seat)}
          onPointerDown={onSeatLongPress ? startLongPress : undefined}
          onPointerUp={onSeatLongPress ? cancelLongPress : undefined}
          onPointerLeave={onSeatLongPress ? cancelLongPress : undefined}
          onPointerCancel={onSeatLongPress ? cancelLongPress : undefined}
          className={`absolute inset-0 rounded-lg shadow-lg transition-all font-bold text-lg ${seatColor.className}${isNextToAct ? ' seat-next-to-act' : ''}`}
          style={{ margin: '-4px', width: `${LAYOUT.SEAT_SIZE + 8}px`, height: `${LAYOUT.SEAT_SIZE + 8}px`, ...seatColor.style }}
        >
          {seat}
        </button>

        {/* WS-002 Sprint A2: STR badge — visible when this seat posted a straddle. */}
        {isStraddler && (
          <div
            className="absolute pointer-events-none rounded font-extrabold"
            style={{
              top: '-6px',
              right: '-8px',
              padding: '1px 5px',
              fontSize: '10px',
              letterSpacing: '0.4px',
              background: '#a855f7',
              color: '#ffffff',
              border: '1px solid #6b21a8',
              boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
              zIndex: 5,
            }}
            aria-label={`Seat ${seat} posted the straddle this hand`}
          >
            STR
          </div>
        )}
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

      {/* Player Name Badge — Phase 2: now includes IdentityAvatar to the left
          of the name for at-a-glance recognition (audit §10 most important
          new render). */}
      {playerName && (
        <div
          className="absolute top-full left-1/2 transform -translate-x-1/2"
          style={{ marginTop: playerNameMarginTop }}
        >
          <div
            className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-blue-700 flex items-center gap-1.5"
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenRangeDetail) onOpenRangeDetail(seat);
            }}
          >
            {player ? (
              <div className="rounded-full overflow-hidden bg-white/20 shrink-0">
                <IdentityAvatar player={player} size={20} />
              </div>
            ) : null}
            <span>{playerName}</span>
          </div>
          {/* Exploit category badges */}
          {exploitSummary && (
            <div className="mt-1">
              <ExploitBadges
                exploitSummary={exploitSummary}
                sampleSize={sampleSize}
                exploits={exploits}
                pendingBriefingCount={pendingBriefingCount}
                weaknessCount={weaknessCount}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// RT-36: Memoize to prevent re-render on every GameContext update.
// Custom comparator handles actionArray (new reference each render).
const arePropsEqual = (prev, next) => {
  const keys = Object.keys(next);
  for (const key of keys) {
    if (key === 'actionArray') {
      const pa = prev.actionArray;
      const na = next.actionArray;
      if (pa === na) continue;
      if (!pa || !na || pa.length !== na.length) return false;
      // Shallow compare last entry (most common change)
      if (pa.length > 0) {
        const pl = pa[pa.length - 1];
        const nl = na[na.length - 1];
        if (pl.seat !== nl.seat || pl.action !== nl.action || pl.order !== nl.order) return false;
      }
      continue;
    }
    // WS-002 Sprint A2: isStraddler / onSeatLongPress are also covered by
    // the default reference compare below — no special handling needed.
    if (prev[key] !== next[key]) return false;
  }
  return true;
};

export const SeatComponent = React.memo(SeatComponentInner, arePropsEqual);
