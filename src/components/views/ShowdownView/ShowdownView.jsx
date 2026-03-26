import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  LAYOUT,
  ACTIONS,
  SEAT_ARRAY,
  STREETS,
  LIMITS,
} from '../../../constants/gameConstants';
import { useCard, useGame, useUI } from '../../../contexts';
import { GAME_ACTIONS } from '../../../reducers/gameReducer';
import { useGameHandlers } from '../../../hooks/useGameHandlers';
import { useShowdownHandlers } from '../../../hooks/useShowdownHandlers';
import { useShowdownCardSelection } from '../../../hooks/useShowdownCardSelection';

import { getHandAbbreviation } from '../../../utils/displayUtils';
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
    dispatchUi,
  } = useUI();

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
    dispatchUi,
    dispatchGame,
    isSeatInactive,
    actionSequence,
    recordSeatAction,
    nextHand,
    numSeats: LIMITS.NUM_SEATS,
    log,
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
    dispatchUi,
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
  const mode = isAllCardsAssigned ? 'summary' : 'selection';

  // HE-2c: Filter to active seats in selection mode
  const activeSeats = useMemo(
    () => SEAT_ARRAY.filter(seat => !isSeatInactive(seat)),
    [isSeatInactive]
  );
  const displaySeats = mode === 'selection' ? activeSeats : SEAT_ARRAY;

  // Check if anyone has won (for hiding Won button)
  const anyoneHasWon = actionSequence.some(
    e => e.street === 'showdown' && e.action === ACTIONS.WON
  );

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
          />

          <div className="flex-1 min-h-0 overflow-y-auto bg-gray-100 p-4">
            {/* Player Cards Display - Used in both modes */}
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

            {/* Mode-specific content */}
            {isAllCardsAssigned ? (
              /* Summary Mode - Action History Grid */
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
              /* Card Selection Mode - 52-card grid */
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
          </div>
        </div>
      </div>
    </div>
  );
};

ShowdownView.propTypes = {
  scale: PropTypes.number.isRequired,
};
