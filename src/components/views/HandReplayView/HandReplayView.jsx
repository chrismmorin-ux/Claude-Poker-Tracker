/**
 * HandReplayView.jsx - Immersive hand replay with visual table
 *
 * Standalone view that replays a recorded hand action-by-action on a felt table.
 * Reuses SEAT_POSITIONS, CardSlot, LAYOUT constants from TableView.
 * Visually differentiated with blue-slate felt tones.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useUI, usePlayer, useTendency } from '../../../contexts';
import { useHandReview } from '../../../hooks/useHandReview';
import { useHandReplayAnalysis } from '../../../hooks/useHandReplayAnalysis';
import { useReplayState } from '../../../hooks/useReplayState';
import { loadHandById } from '../../../utils/persistence/index';
import { buildTimeline, buildSeatNameMap, getPlayerName } from '../../../utils/handAnalysis';
import { getPositionName } from '../../../utils/positionUtils';
import { LAYOUT, SEAT_ARRAY, SEAT_POSITIONS } from '../../../constants/gameConstants';
import { PRIMITIVE_BUTTON_CONFIG } from '../../../constants/primitiveActions';
import { SCREEN } from '../../../constants/uiConstants';
import { CardSlot } from '../../ui/CardSlot';
import { ReviewPanel } from './ReviewPanel';

const POSITION_BADGES = { D: '#d4a847', SB: '#9ca3af', BB: '#60a5fa' };

export const HandReplayView = ({ scale }) => {
  const { replayHandId, replayHand, setCurrentScreen } = useUI();
  const { allPlayers } = usePlayer();
  const { tendencyMap } = useTendency();

  const [hand, setHand] = useState(replayHand || null);
  const [loading, setLoading] = useState(!replayHand);

  // Load from IndexedDB only when hand not passed via UI state (e.g., browser refresh)
  useEffect(() => {
    if (replayHand) { setHand(replayHand); setLoading(false); return; }
    if (!replayHandId) { setLoading(false); return; }
    setLoading(true);
    loadHandById(replayHandId)
      .then(h => setHand(h || null))
      .catch(err => { console.warn('[HandReplay] Failed to load hand', replayHandId, err); setHand(null); })
      .finally(() => setLoading(false));
  }, [replayHandId, replayHand]);

  // Build timeline from hand (memoize to avoid infinite re-render)
  const timeline = useMemo(() => hand ? buildTimeline(hand) : [], [hand]);
  const heroSeat = hand?.gameState?.mySeat ?? null;
  const buttonSeat = hand?.gameState?.dealerButtonSeat ?? 1;
  const seatPlayers = hand?.seatPlayers || {};
  const allPlayerCards = hand?.cardState?.allPlayerCards || {};
  const heroCards = hand?.cardState?.holeCards || [];

  // Precomputed analysis
  const { actionAnalysis, isComputing } = useHandReplayAnalysis(hand, timeline, tendencyMap);

  // Replay stepping state
  const replay = useReplayState(timeline, hand, actionAnalysis);

  const handleBack = useCallback(() => {
    setCurrentScreen(SCREEN.HISTORY);
  }, [setCurrentScreen]);

  // Keyboard navigation (use refs to avoid effect churn)
  const replayRef = React.useRef(replay);
  replayRef.current = replay;
  const handleBackRef = React.useRef(handleBack);
  handleBackRef.current = handleBack;

  useEffect(() => {
    const handleKey = (e) => {
      const r = replayRef.current;
      if (e.key === 'ArrowRight') { e.preventDefault(); r.stepForward(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); r.stepBack(); }
      else if (e.key === 'Home') { e.preventDefault(); r.jumpToStart(); }
      else if (e.key === 'End') { e.preventDefault(); r.jumpToEnd(); }
      else if (e.key === 'Escape') { handleBackRef.current(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Seat-to-name lookup
  const seatNames = useMemo(() => buildSeatNameMap(seatPlayers, allPlayers), [seatPlayers, allPlayers]);

  // Get position badge for seat
  const getPosBadge = (seat) => {
    if (seat === buttonSeat) return 'D';
    const posName = getPositionName(seat, buttonSeat);
    if (posName === 'SB') return 'SB';
    if (posName === 'BB') return 'BB';
    return null;
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400">
        Loading hand...
      </div>
    );
  }

  if (!hand) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-3">
        <span>Hand not found</span>
        <button onClick={handleBack} className="px-4 py-2 bg-gray-700 rounded text-sm hover:bg-gray-600">
          Back to Review
        </button>
      </div>
    );
  }

  // Check if hand reached showdown (any allPlayerCards have values)
  const hasShowdown = SEAT_ARRAY.some(s => {
    const cards = allPlayerCards[s];
    return cards && cards[0] && cards[1];
  });

  return (
    <div className="flex items-center justify-center h-dvh bg-gray-950 overflow-hidden">
    <div
      className="relative overflow-hidden"
      style={{
        width: `${LAYOUT.TABLE_WIDTH}px`,
        height: `${LAYOUT.TABLE_HEIGHT}px`,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
      }}
    >
      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 h-[40px] flex items-center px-4 bg-gray-900/80 border-b border-gray-800 z-10">
        <button
          onClick={handleBack}
          className="text-gray-400 hover:text-white text-sm mr-4 flex items-center gap-1"
        >
          <span className="text-lg leading-none">&larr;</span> Back
        </button>
        <span className="text-cyan-400 font-bold text-sm">
          {hand.handDisplayId || `Hand #${replayHandId}`}
        </span>
        <span className="text-gray-500 text-xs ml-3">
          {replay.currentStreet.toUpperCase()}
        </span>
        <span className="text-gray-500 text-xs ml-3">
          Pot ${replay.potAtPoint}
        </span>
        {isComputing && <span className="text-gray-600 text-[10px] ml-3">(analyzing...)</span>}
        <span className="ml-auto text-cyan-600 text-[10px] font-semibold tracking-widest uppercase">
          Reviewing
        </span>
      </div>

      {/* Main layout: felt + review panel */}
      <div className="absolute top-[40px] left-0 right-0 bottom-0 flex">
        {/* Left: Felt table area */}
        <div className="relative flex-1 p-4">
          <div
            className="absolute"
            style={{
              top: `${LAYOUT.TABLE_OFFSET_Y - 40}px`,
              left: `${LAYOUT.TABLE_OFFSET_X - 50}px`,
              width: `${LAYOUT.FELT_WIDTH}px`,
              height: `${LAYOUT.FELT_HEIGHT}px`,
              borderRadius: `${LAYOUT.FELT_HEIGHT / 2}px`,
              background: 'linear-gradient(160deg, #1a2a3a 0%, #0d1520 30%, #081218 70%, #0d1520 100%)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(100,180,220,0.08)',
            }}
          >
            {/* Inner felt */}
            <div
              className="absolute inset-3"
              style={{
                borderRadius: `${LAYOUT.FELT_HEIGHT / 2 - 12}px`,
                background: 'radial-gradient(ellipse 90% 70% at 50% 45%, #1a4a5a 0%, #153d4a 40%, #0f3040 70%, #0a2a3a 100%)',
                boxShadow: 'inset 0 2px 40px rgba(0,0,0,0.35), inset 0 0 80px rgba(0,0,0,0.15)',
                border: '2px solid rgba(0,0,0,0.3)',
              }}
            >
              {/* Community cards */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex gap-2">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <CardSlot
                    key={idx}
                    card={replay.communityCardsAtPoint[idx] || null}
                    variant="table"
                    canInteract={false}
                  />
                ))}
              </div>

              {/* Pot display */}
              {replay.potAtPoint > 0 && (
                <div className="absolute top-[30%] left-1/2 transform -translate-x-1/2 text-center">
                  <div className="bg-black/50 rounded-full px-3 py-1">
                    <span className="text-green-400 text-xs font-bold">${replay.potAtPoint}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Seats */}
            {SEAT_POSITIONS.map(({ seat, x, y }) => {
              const seatState = replay.seatStates.get(seat);
              const hasFolded = seatState?.hasFolded || false;
              const lastAction = seatState?.lastAction || null;
              const isCurrentActor = replay.currentActionEntry && Number(replay.currentActionEntry.seat) === seat;
              const isVillainSelected = replay.selectedVillainSeat === seat;
              const isVillainPinned = replay.pinnedVillainSeat === seat;
              const isHero = seat === heroSeat;
              const posBadge = getPosBadge(seat);
              const playerName = getPlayerName(seatNames, seat);
              const seatCards = allPlayerCards[seat] || [];
              const hasCards = seatCards[0] && seatCards[1];
              const isRevealed = replay.revealedSeats.has(seat);
              const heroHoleCards = isHero ? heroCards : null;

              // Action badge config
              const actionConfig = lastAction ? PRIMITIVE_BUTTON_CONFIG[lastAction] : null;

              return (
                <div
                  key={seat}
                  className="absolute flex flex-col items-center"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: 'translate(-50%, -50%)',
                    opacity: hasFolded ? 0.4 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {/* Seat circle */}
                  <div
                    onClick={() => !isHero && replay.selectVillain(seat)}
                    className={`
                      w-[52px] h-[52px] rounded-full flex items-center justify-center
                      transition-all cursor-pointer relative
                      ${isCurrentActor ? 'ring-3 ring-cyan-400 shadow-lg shadow-cyan-400/30' : ''}
                      ${isVillainPinned ? 'ring-3 ring-indigo-400 shadow-lg shadow-indigo-400/30' : ''}
                      ${isVillainSelected && !isVillainPinned ? 'ring-2 ring-indigo-400/50' : ''}
                      ${isHero ? 'bg-emerald-900/60 border-2 border-emerald-500/50' : 'bg-gray-800/80 border-2 border-gray-600/50'}
                    `}
                  >
                    <span className="text-white text-xs font-bold">{seat}</span>

                    {/* Position badge */}
                    {posBadge && (
                      <div
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-black"
                        style={{ backgroundColor: POSITION_BADGES[posBadge] || '#9ca3af' }}
                      >
                        {posBadge}
                      </div>
                    )}
                  </div>

                  {/* Player name */}
                  <span className="text-[9px] text-gray-400 mt-0.5 max-w-[60px] truncate text-center">
                    {playerName}
                  </span>

                  {/* Hole cards */}
                  {isHero && heroHoleCards && heroHoleCards[0] && heroHoleCards[1] && (
                    <div className="flex gap-0.5 mt-0.5">
                      <CardSlot card={heroHoleCards[0]} variant="hole-table" canInteract={false} />
                      <CardSlot card={heroHoleCards[1]} variant="hole-table" canInteract={false} />
                    </div>
                  )}

                  {/* Villain cards (showdown) */}
                  {!isHero && hasShowdown && hasCards && (
                    <div className="flex gap-0.5 mt-0.5 relative">
                      {isRevealed ? (
                        <>
                          <CardSlot card={seatCards[0]} variant="hole-table" canInteract={false} />
                          <CardSlot card={seatCards[1]} variant="hole-table" canInteract={false} />
                        </>
                      ) : (
                        <>
                          <CardSlot card={null} variant="hole-table" isHidden={true} canInteract={false} />
                          <CardSlot card={null} variant="hole-table" isHidden={true} canInteract={false} />
                        </>
                      )}
                      {/* Eye toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); replay.toggleReveal(seat); }}
                        className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-700/90 flex items-center justify-center text-[10px] hover:bg-gray-600 transition-colors"
                        title={isRevealed ? 'Hide cards' : 'Reveal cards'}
                      >
                        {isRevealed ? '🙈' : '👁'}
                      </button>
                    </div>
                  )}

                  {/* Action badge */}
                  {lastAction && !hasFolded && (
                    <div
                      className="mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold text-white"
                      style={{ backgroundColor: actionConfig?.bg || '#4b5563' }}
                    >
                      {actionConfig?.label || lastAction}
                      {seatState?.totalBet > 0 ? ` $${seatState.totalBet}` : ''}
                    </div>
                  )}

                  {/* Folded badge */}
                  {hasFolded && (
                    <div className="mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold text-gray-500 bg-gray-800/60">
                      Fold
                    </div>
                  )}
                </div>
              );
            })}

            {/* "REVIEWING" label */}
            <div
              className="absolute left-1/2 -translate-x-1/2 text-center"
              style={{ bottom: '-28px' }}
            >
              <span className="text-cyan-600 text-[10px] font-bold tracking-[0.2em] uppercase">
                Reviewing
              </span>
            </div>
          </div>
        </div>

        {/* Right: Review Panel */}
        <div className="w-[450px] border-l border-gray-800 bg-gray-900/50 overflow-y-auto">
          <ReviewPanel
            replay={replay}
            hand={hand}
            heroSeat={heroSeat}
            buttonSeat={buttonSeat}
            seatPlayers={seatPlayers}
            seatNames={seatNames}
            tendencyMap={tendencyMap}
            actionAnalysis={actionAnalysis}
            allPlayerCards={allPlayerCards}
          />
        </div>
      </div>
    </div>
    </div>
  );
};
