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
  isFoldAction,
} from '../../../constants/gameConstants';
import { useCard, useGame, useUI } from '../../../contexts';
import { CARD_ACTIONS } from '../../../reducers/cardReducer';
import { ShowdownHeader } from './ShowdownHeader';
import { ShowdownSeatRow } from './ShowdownSeatRow';
import { CardGrid } from './CardGrid';
import { ActionHistoryGrid } from './ActionHistoryGrid';

/**
 * ShowdownView - Showdown card assignment and summary interface
 * Two modes: card selection (assigns cards to players) and summary (shows action history)
 */
export const ShowdownView = ({
  scale,
  // Handlers defined in parent
  handleNextHandFromShowdown,
  handleClearShowdownCards,
  handleCloseShowdown,
  allCardsAssigned,
  isSeatInactive,
  handleMuckSeat,
  handleWonSeat,
  selectCardForShowdown,
  // Utility functions
  getOverlayStatus,
  getActionColor,
  getActionDisplayName,
  getHandAbbreviation,
}) => {
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
    getSmallBlindSeat,
    getBigBlindSeat,
  } = useGame();

  // Get UI state from UIContext
  const {
    highlightedSeat,
    highlightedHoleSlot,
    setHighlightedSeat,
    setHighlightedHoleSlot,
  } = useUI();

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
                    isSB={getSmallBlindSeat() === seat}
                    isBB={getBigBlindSeat() === seat}
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
  // Layout
  scale: PropTypes.number.isRequired,

  // Handlers (still passed from parent)
  handleNextHandFromShowdown: PropTypes.func.isRequired,
  handleClearShowdownCards: PropTypes.func.isRequired,
  handleCloseShowdown: PropTypes.func.isRequired,
  handleMuckSeat: PropTypes.func.isRequired,
  handleWonSeat: PropTypes.func.isRequired,
  selectCardForShowdown: PropTypes.func.isRequired,

  // Utility functions (still passed from parent)
  allCardsAssigned: PropTypes.func.isRequired,
  isSeatInactive: PropTypes.func.isRequired,
  getOverlayStatus: PropTypes.func.isRequired,
  getActionColor: PropTypes.func.isRequired,
  getActionDisplayName: PropTypes.func.isRequired,
  getHandAbbreviation: PropTypes.func.isRequired,
};
