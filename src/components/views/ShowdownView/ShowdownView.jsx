import React from 'react';
import PropTypes from 'prop-types';
import { LAYOUT } from '../../../constants/gameConstants';
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
  communityCards,
  holeCards,
  holeCardsVisible,
  mySeat,
  dealerButtonSeat,
  allPlayerCards,
  highlightedSeat,
  highlightedHoleSlot,
  seatActions,
  SEAT_ARRAY,
  STREETS,
  BETTING_STREETS,
  ACTIONS,
  ACTION_ABBREV,
  SEAT_STATUS,
  handleNextHandFromShowdown,
  handleClearShowdownCards,
  handleCloseShowdown,
  allCardsAssigned,
  isSeatInactive,
  getSmallBlindSeat,
  getBigBlindSeat,
  setHoleCardsVisible,
  setHighlightedSeat,
  setHighlightedCardSlot,
  handleMuckSeat,
  handleWonSeat,
  selectCardForShowdown,
  getOverlayStatus,
  getActionColor,
  getActionDisplayName,
  isFoldAction,
  getHandAbbreviation,
  SkipForward,
}) => {
  const isAllCardsAssigned = allCardsAssigned();
  const mode = isAllCardsAssigned ? 'summary' : 'selection';

  // Check if anyone has won (for hiding Won button)
  const anyoneHasWon = Object.values(seatActions['showdown'] || {}).some(actions => {
    return (actions || []).includes(ACTIONS.WON);
  });

  // Handler to highlight a slot
  const handleHighlightSlot = (seat, cardSlot) => {
    setHighlightedSeat(seat);
    setHighlightedCardSlot(cardSlot);
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
            SkipForward={SkipForward}
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
                    hasWon={hasWon || anyoneHasWon}
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

  // Card state
  communityCards: PropTypes.arrayOf(PropTypes.string).isRequired,
  holeCards: PropTypes.arrayOf(PropTypes.string).isRequired,
  holeCardsVisible: PropTypes.bool.isRequired,
  allPlayerCards: PropTypes.object.isRequired,
  highlightedSeat: PropTypes.number,
  highlightedHoleSlot: PropTypes.number,

  // Game state
  mySeat: PropTypes.number.isRequired,
  dealerButtonSeat: PropTypes.number.isRequired,
  seatActions: PropTypes.object.isRequired,

  // Constants
  SEAT_ARRAY: PropTypes.arrayOf(PropTypes.number).isRequired,
  STREETS: PropTypes.arrayOf(PropTypes.string).isRequired,
  BETTING_STREETS: PropTypes.arrayOf(PropTypes.string).isRequired,
  ACTIONS: PropTypes.object.isRequired,
  ACTION_ABBREV: PropTypes.object.isRequired,
  SEAT_STATUS: PropTypes.shape({
    FOLDED: PropTypes.string,
    ABSENT: PropTypes.string,
  }).isRequired,

  // Handlers
  handleNextHandFromShowdown: PropTypes.func.isRequired,
  handleClearShowdownCards: PropTypes.func.isRequired,
  handleCloseShowdown: PropTypes.func.isRequired,
  handleMuckSeat: PropTypes.func.isRequired,
  handleWonSeat: PropTypes.func.isRequired,
  selectCardForShowdown: PropTypes.func.isRequired,

  // Utility functions
  allCardsAssigned: PropTypes.func.isRequired,
  isSeatInactive: PropTypes.func.isRequired,
  getSmallBlindSeat: PropTypes.func.isRequired,
  getBigBlindSeat: PropTypes.func.isRequired,
  getOverlayStatus: PropTypes.func.isRequired,
  getActionColor: PropTypes.func.isRequired,
  getActionDisplayName: PropTypes.func.isRequired,
  isFoldAction: PropTypes.func.isRequired,
  getHandAbbreviation: PropTypes.func.isRequired,

  // State setters
  setHoleCardsVisible: PropTypes.func.isRequired,
  setHighlightedSeat: PropTypes.func.isRequired,
  setHighlightedCardSlot: PropTypes.func.isRequired,

  // Icons
  SkipForward: PropTypes.elementType.isRequired,
};
