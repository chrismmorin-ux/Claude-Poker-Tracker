import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  LAYOUT,
  ACTIONS,
  ACTION_ABBREV,
  SEAT_STATUS,
  SEAT_ARRAY,
  STREETS,
  BETTING_STREETS,
  LIMITS,
  isFoldAction,
} from '../../../constants/gameConstants';
import { useCard, useGame, useUI } from '../../../contexts';
import { GAME_ACTIONS } from '../../../reducers/gameReducer';
import { useGameHandlers } from '../../../hooks/useGameHandlers';
import { useShowdownHandlers } from '../../../hooks/useShowdownHandlers';
import { useShowdownCardSelection } from '../../../hooks/useShowdownCardSelection';
import { getOverlayStatus, getActionColor, getActionDisplayName } from '../../../utils/actionUtils';
import { getHandAbbreviation } from '../../../utils/displayUtils';
import { CARD_ACTIONS } from '../../../reducers/cardReducer';
import { ShowdownHeader } from './ShowdownHeader';
import { ShowdownSeatRow } from './ShowdownSeatRow';
import { CardGrid } from './CardGrid';
import { ActionHistoryGrid } from './ActionHistoryGrid';

const log = (...args) => console.debug('[ShowdownView]', ...args);

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
    seatActions,
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
  } = useShowdownHandlers(
    dispatchCard,
    dispatchUi,
    dispatchGame,
    isSeatInactive,
    seatActions,
    recordSeatAction,
    nextHand,
    LIMITS.NUM_SEATS,
    log
  );

  // Showdown card selection
  const selectCardForShowdown = useShowdownCardSelection(
    highlightedSeat,
    highlightedHoleSlot,
    mySeat,
    holeCards,
    allPlayerCards,
    communityCards,
    seatActions,
    isSeatInactive,
    dispatchCard,
    dispatchUi,
    LIMITS.NUM_SEATS
  );

  // Handler for setting hole cards visibility
  const setHoleCardsVisible = useCallback((visible) => {
    dispatchCard({ type: CARD_ACTIONS.SET_HOLE_VISIBILITY, payload: visible });
  }, [dispatchCard]);
  const isAllCardsAssigned = allCardsAssigned();
  const mode = isAllCardsAssigned ? 'summary' : 'selection';

  // Check if anyone has won (for hiding Won button)
  const anyoneHasWon = Object.values(seatActions['showdown'] || {}).some(actions => {
    return (actions || []).includes(ACTIONS.WON);
  });

  // Handler to highlight a slot
  const handleHighlightSlot = (seat, cardSlot) => {
    setHighlightedSeat(seat);
    setHighlightedHoleSlot(cardSlot);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-800 overflow-hidden">
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
            SEAT_STATUS={SEAT_STATUS}
          />

          <div className="bg-gray-100 p-4">
            {/* Player Cards Display - Used in both modes */}
            <div className="grid grid-cols-9 gap-2 mb-4">
              {SEAT_ARRAY.map(seat => {
                const inactiveStatus = isSeatInactive(seat);
                const showdownActions = seatActions['showdown']?.[seat];
                const showdownActionsArray = Array.isArray(showdownActions) ? showdownActions : (showdownActions ? [showdownActions] : []);
                const isMucked = showdownActionsArray.includes(ACTIONS.MUCKED);
                const hasWon = showdownActionsArray.includes(ACTIONS.WON);
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
                    SEAT_STATUS={SEAT_STATUS}
                    ACTIONS={ACTIONS}
                    seatActions={showdownActions}
                    onSetHoleCardsVisible={setHoleCardsVisible}
                    onHighlightSlot={handleHighlightSlot}
                    onMuck={handleMuckSeat}
                    onWon={handleWonSeat}
                    getOverlayStatus={getOverlayStatus}
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
                BETTING_STREETS={BETTING_STREETS}
                ACTIONS={ACTIONS}
                ACTION_ABBREV={ACTION_ABBREV}
                SEAT_STATUS={SEAT_STATUS}
                seatActions={seatActions}
                allPlayerCards={allPlayerCards}
                holeCards={holeCards}
                mySeat={mySeat}
                isSeatInactive={isSeatInactive}
                getActionColor={getActionColor}
                getActionDisplayName={getActionDisplayName}
                isFoldAction={isFoldAction}
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
