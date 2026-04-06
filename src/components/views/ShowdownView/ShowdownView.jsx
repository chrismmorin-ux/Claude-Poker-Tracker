import React, { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import {
  LAYOUT,
  ACTIONS,
  SEAT_ARRAY,
  STREETS,
  LIMITS,
} from '../../../constants/gameConstants';
import { useCard, useGame, useUI, usePlayer } from '../../../contexts';
import { GAME_ACTIONS } from '../../../reducers/gameReducer';
import { useGameHandlers } from '../../../hooks/useGameHandlers';
import { useShowdownHandlers } from '../../../hooks/useShowdownHandlers';
import { useShowdownCardSelection } from '../../../hooks/useShowdownCardSelection';

import { getHandAbbreviation } from '../../../utils/displayUtils';
import { getPositionName } from '../../../utils/positionUtils';
import { getShowdownActions, hasShowdownAction } from '../../../utils/sequenceUtils';
import { CARD_ACTIONS } from '../../../reducers/cardReducer';
import { ShowdownHeader } from './ShowdownHeader';
import { ShowdownSeatRow } from './ShowdownSeatRow';
import { CardGrid } from './CardGrid';
import { ActionHistoryGrid } from './ActionHistoryGrid';
import { useShowdownEquity } from '../../../hooks/useShowdownEquity';

/**
 * ShowdownView - Showdown card assignment and summary interface
 * Two modes: card selection (assigns cards to players) and summary (shows action history)
 */
export const ShowdownView = ({ scale }) => {
  // Get card state from CardContext
  const {
    communityCards,
    holeCards,
    holeCardsVisible,
    allPlayerCards,
    dispatchCard,
  } = useCard();

  // Get game state from GameContext
  const {
    mySeat,
    dealerButtonSeat,
    actionSequence,
    smallBlindSeat,
    bigBlindSeat,
    dispatchGame,
  } = useGame();

  // Get UI state from UIContext
  const {
    highlightedSeat,
    highlightedHoleSlot,
    setHighlightedSeat,
    setHighlightedHoleSlot,
    closeShowdownView,
    closeCardSelector,
    showdownMode,
    setShowdownMode,
  } = useUI();

  // Player names for heads-up display
  const { getSeatPlayerName } = usePlayer();

  // Game handlers for shared logic
  const {
    isSeatInactive,
    allCardsAssigned,
    recordSeatAction,
    nextHand,
  } = useGameHandlers();

  // Showdown-specific handlers
  const {
    handleClearShowdownCards,
    handleMuckSeat,
    handleWonSeat,
    handleNextHandFromShowdown,
    handleCloseShowdown,
  } = useShowdownHandlers({
    dispatchCard,
    setHighlightedSeat,
    setHighlightedHoleSlot,
    closeShowdownView,
    closeCardSelector,
    dispatchGame,
    isSeatInactive,
    actionSequence,
    recordSeatAction,
    nextHand,
    numSeats: LIMITS.NUM_SEATS,
    log: (...args) => console.debug('[Showdown]', ...args),
  });

  // Showdown card selection
  const selectCardForShowdown = useShowdownCardSelection({
    highlightedSeat,
    highlightedHoleSlot,
    mySeat,
    holeCards,
    allPlayerCards,
    communityCards,
    actionSequence,
    isSeatInactive,
    dispatchCard,
    setHighlightedSeat,
    setHighlightedHoleSlot,
    numSeats: LIMITS.NUM_SEATS,
  });

  // Showdown hand rankings
  const { rankings } = useShowdownEquity({
    allPlayerCards,
    holeCards,
    mySeat,
    communityCards,
    actionSequence,
  });

  // Build a lookup map for seat -> ranking
  const rankingBySeat = useMemo(() => {
    const map = {};
    for (const r of rankings) {
      map[r.seat] = r;
    }
    return map;
  }, [rankings]);

  // Handler for setting hole cards visibility
  const setHoleCardsVisible = useCallback((visible) => {
    dispatchCard({ type: CARD_ACTIONS.SET_HOLE_VISIBILITY, payload: visible });
  }, [dispatchCard]);
  const isAllCardsAssigned = allCardsAssigned();
  const mode = showdownMode === 'quick' ? 'quick'
    : isAllCardsAssigned ? 'summary'
    : 'selection';

  // HE-2c: Filter to active seats in selection mode
  const activeSeats = useMemo(
    () => SEAT_ARRAY.filter(seat => !isSeatInactive(seat)),
    [isSeatInactive]
  );
  const isHeadsUp = activeSeats.length === 2;
  const displaySeats = (mode === 'selection' || mode === 'quick') ? activeSeats : SEAT_ARRAY;

  // Toggle between quick and full showdown modes
  const handleToggleMode = useCallback(() => {
    setShowdownMode(showdownMode === 'quick' ? 'full' : 'quick');
  }, [showdownMode, setShowdownMode]);

  // Check if anyone has won (for hiding Won button)
  const anyoneHasWon = actionSequence.some(
    e => e.street === 'showdown' && e.action === ACTIONS.WON
  );

  // Derive winner seat for display
  const winnerSeat = useMemo(() => {
    const entry = actionSequence.find(e => e.street === 'showdown' && e.action === ACTIONS.WON);
    return entry ? entry.seat : null;
  }, [actionSequence]);

  // HE-2c: Auto-advance timer in quick mode after a winner is marked
  const autoAdvanceTimer = useRef(null);
  const [autoAdvanceCancelled, setAutoAdvanceCancelled] = useState(false);

  useEffect(() => {
    if (anyoneHasWon && showdownMode === 'quick' && !autoAdvanceCancelled) {
      autoAdvanceTimer.current = setTimeout(() => {
        handleNextHandFromShowdown();
      }, 1500);
      return () => clearTimeout(autoAdvanceTimer.current);
    }
  }, [anyoneHasWon, showdownMode, autoAdvanceCancelled, handleNextHandFromShowdown]);

  // Reset cancelled flag when a new hand starts (anyoneHasWon goes false)
  useEffect(() => {
    if (!anyoneHasWon) setAutoAdvanceCancelled(false);
  }, [anyoneHasWon]);

  const handleCancelAutoAdvance = useCallback(() => {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    setAutoAdvanceCancelled(true);
  }, []);

  // Handler to highlight a slot
  const handleHighlightSlot = (seat, cardSlot) => {
    setHighlightedSeat(seat);
    setHighlightedHoleSlot(cardSlot);
  };

  return (
    <div className="flex items-center justify-center h-dvh bg-gray-800 overflow-hidden">
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
          {/* Header with community cards and buttons */}
          <ShowdownHeader
            communityCards={communityCards}
            onNextHand={handleNextHandFromShowdown}
            onClearCards={handleClearShowdownCards}
            onDone={handleCloseShowdown}
            showdownMode={showdownMode}
            onToggleMode={handleToggleMode}
          />

          <div className="flex-1 min-h-0 overflow-y-auto bg-gray-100 p-4 relative">
            {/* HE-2c: Winner confirmation overlay with auto-advance countdown */}
            {anyoneHasWon && showdownMode === 'quick' && !autoAdvanceCancelled && (
              <div
                onClick={handleCancelAutoAdvance}
                className="absolute inset-0 z-10 flex flex-col items-center justify-center cursor-pointer"
                style={{ background: 'rgba(0, 0, 0, 0.5)' }}
              >
                <div className="rounded-2xl px-12 py-8 text-center" style={{ background: 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)' }}>
                  <div className="text-white font-extrabold" style={{ fontSize: '32px' }}>
                    Seat {winnerSeat} Won!
                  </div>
                  <div className="text-green-200 font-semibold mt-1" style={{ fontSize: '16px' }}>
                    {winnerSeat && getSeatPlayerName(winnerSeat) ? getSeatPlayerName(winnerSeat) : ''}
                  </div>
                  <div className="mt-4 rounded-full overflow-hidden" style={{ height: '6px', background: 'rgba(255,255,255,0.3)', width: '200px' }}>
                    <div style={{ height: '100%', background: '#fff', animation: 'countdown-shrink 1.5s linear forwards' }} />
                  </div>
                  <div className="text-green-200 mt-3" style={{ fontSize: '13px' }}>Tap to stay on showdown</div>
                </div>
              </div>
            )}

            {/* Quick mode: heads-up — two large winner buttons */}
            {mode === 'quick' && isHeadsUp && !anyoneHasWon ? (
              <div className="flex gap-6 justify-center items-center py-8">
                {activeSeats.map(seat => {
                  const playerName = getSeatPlayerName(seat);
                  const posName = getPositionName(seat, dealerButtonSeat);
                  return (
                    <button
                      key={seat}
                      onClick={() => handleWonSeat(seat)}
                      className="btn-press rounded-xl font-extrabold text-white shadow-lg"
                      style={{
                        width: '200px', height: '120px', fontSize: '22px',
                        background: 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)',
                      }}
                    >
                      Seat {seat} Won
                      <div style={{ fontSize: '14px', fontWeight: 500, opacity: 0.8, marginTop: '4px' }}>
                        {posName}{playerName ? ` — ${playerName}` : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : mode === 'quick' ? (
              /* Quick mode: 3+ players — responsive grid (max 4 per row) */
              <div className="grid gap-3 mb-4" style={{
                gridTemplateColumns: displaySeats.length > 4
                  ? 'repeat(auto-fill, minmax(140px, 1fr))'
                  : `repeat(${displaySeats.length}, minmax(0, 1fr))`,
              }}>
                {displaySeats.map(seat => {
                  const inactiveStatus = isSeatInactive(seat);
                  const showdownActionsArray = getShowdownActions(actionSequence, seat);
                  const isMucked = hasShowdownAction(actionSequence, seat, 'mucked');
                  const hasWon = hasShowdownAction(actionSequence, seat, 'won');
                  const cards = seat === mySeat ? holeCards : allPlayerCards[seat];

                  return (
                    <ShowdownSeatRow
                      key={seat}
                      seat={seat}
                      cards={cards}
                      isMySeat={mySeat === seat}
                      isDealer={dealerButtonSeat === seat}
                      isSB={smallBlindSeat === seat}
                      isBB={bigBlindSeat === seat}
                      holeCardsVisible={holeCardsVisible}
                      inactiveStatus={inactiveStatus}
                      isMucked={isMucked}
                      hasWon={hasWon}
                      anyoneHasWon={anyoneHasWon}
                      highlightedSeat={highlightedSeat}
                      highlightedHoleSlot={highlightedHoleSlot}
                      mode={mode}
                      showdownActionsArray={showdownActionsArray}
                      ranking={null}
                      onSetHoleCardsVisible={setHoleCardsVisible}
                      onHighlightSlot={handleHighlightSlot}
                      onMuck={handleMuckSeat}
                      onWon={handleWonSeat}
                      hideCards
                      quickMode
                    />
                  );
                })}
              </div>
            ) : (
              /* Full mode: original card assignment + summary flow */
              <>
                <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: `repeat(${displaySeats.length}, minmax(0, 1fr))` }}>
                  {displaySeats.map(seat => {
                    const inactiveStatus = isSeatInactive(seat);
                    const showdownActionsArray = getShowdownActions(actionSequence, seat);
                    const isMucked = hasShowdownAction(actionSequence, seat, 'mucked');
                    const hasWon = hasShowdownAction(actionSequence, seat, 'won');
                    const cards = seat === mySeat ? holeCards : allPlayerCards[seat];

                    return (
                      <ShowdownSeatRow
                        key={seat}
                        seat={seat}
                        cards={cards}
                        isMySeat={mySeat === seat}
                        isDealer={dealerButtonSeat === seat}
                        isSB={smallBlindSeat === seat}
                        isBB={bigBlindSeat === seat}
                        holeCardsVisible={holeCardsVisible}
                        inactiveStatus={inactiveStatus}
                        isMucked={isMucked}
                        hasWon={hasWon}
                        anyoneHasWon={anyoneHasWon}
                        highlightedSeat={highlightedSeat}
                        highlightedHoleSlot={highlightedHoleSlot}
                        mode={mode}
                        showdownActionsArray={showdownActionsArray}
                        ranking={rankingBySeat[seat] || null}
                        onSetHoleCardsVisible={setHoleCardsVisible}
                        onHighlightSlot={handleHighlightSlot}
                        onMuck={handleMuckSeat}
                        onWon={handleWonSeat}
                      />
                    );
                  })}
                </div>

                {isAllCardsAssigned ? (
                  <ActionHistoryGrid
                    SEAT_ARRAY={SEAT_ARRAY}
                    STREETS={STREETS}
                    actionSequence={actionSequence}
                    allPlayerCards={allPlayerCards}
                    holeCards={holeCards}
                    mySeat={mySeat}
                    isSeatInactive={isSeatInactive}
                    getHandAbbreviation={getHandAbbreviation}
                  />
                ) : (
                  <CardGrid
                    communityCards={communityCards}
                    holeCards={holeCards}
                    allPlayerCards={allPlayerCards}
                    mySeat={mySeat}
                    highlightedSeat={highlightedSeat}
                    highlightedHoleSlot={highlightedHoleSlot}
                    onSelectCard={selectCardForShowdown}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

