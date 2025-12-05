import React from 'react';
import { CardSlot } from '../ui/CardSlot';
import { VisibilityToggle } from '../ui/VisibilityToggle';
import { PositionBadge } from '../ui/PositionBadge';
import { DiagonalOverlay } from '../ui/DiagonalOverlay';
import { isRedSuit } from '../../utils/displayUtils';

// Card constants
const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = ['♠', '♥', '♦', '♣'];

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
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-800 overflow-hidden">
      <div style={{
        width: '1600px',
        height: '720px',
        transform: `scale(${scale})`,
        transformOrigin: 'center center'
      }}>
        <div
          className="bg-gradient-to-br from-green-800 to-green-900 flex flex-col"
          style={{ width: '1600px', height: '720px' }}
        >
          <div className="bg-white p-6 flex justify-between items-center">
            <h2 className="text-3xl font-bold">
              Showdown - Click a card slot, then click a card
            </h2>
            <div className="flex items-center gap-4">
              {/* Community Cards Display */}
              <div>
                <div className="text-sm font-bold mb-2 text-center">BOARD</div>
                <div className="flex gap-2">
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <CardSlot
                      key={idx}
                      card={communityCards[idx]}
                      variant="selector"
                      canInteract={false}
                    SEAT_STATUS={SEAT_STATUS} />
                  ))}
                </div>
              </div>
              <button
                onClick={handleNextHandFromShowdown}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg text-xl font-bold flex items-center gap-2"
              >
                <SkipForward size={24} />
                Next Hand
              </button>
              <button
                onClick={handleClearShowdownCards}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-xl font-bold"
              >
                Clear Cards
              </button>
              <button
                onClick={handleCloseShowdown}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg text-xl font-bold"
              >
                Done
              </button>
            </div>
          </div>

          <div className="bg-gray-100 p-4">
            {allCardsAssigned() ? (
              /* Summary View - Show action history for each seat */
              <>
                {/* Player Cards Display */}
                <div className="grid grid-cols-9 gap-2 mb-4">
                  {SEAT_ARRAY.map(seat => {
                    const inactiveStatus = isSeatInactive(seat);
                    const isMucked = seatActions['showdown']?.[seat] === ACTIONS.MUCKED;
                    const cards = seat === mySeat ? holeCards : allPlayerCards[seat];
                    const isDealer = dealerButtonSeat === seat;
                    const isSB = getSmallBlindSeat() === seat;
                    const isBB = getBigBlindSeat() === seat;
                    const isMySeat = mySeat === seat;

                    return (
                      <div key={seat} className="flex flex-col items-center">
                        {/* Seat Number */}
                        <div className="text-sm font-bold mb-1">Seat {seat}</div>

                        {/* Dealer/Blinds/My Seat Indicators with Visibility Toggle */}
                        <div className="flex gap-1 mb-1 items-center" style={{ minHeight: '24px' }}>
                          {isDealer && <PositionBadge type="dealer" size="small" />}
                          {isSB && <PositionBadge type="sb" size="small" />}
                          {isBB && <PositionBadge type="bb" size="small" />}
                          {isMySeat && <PositionBadge type="me" size="small" />}
                          {isMySeat && (
                            <VisibilityToggle
                              visible={holeCardsVisible}
                              onToggle={() => setHoleCardsVisible(!holeCardsVisible)}
                              size="small"
                            />
                          )}
                        </div>

                        {/* Card Slots */}
                        <div className="flex gap-1 mb-1 relative">
                          {[0, 1].map(cardSlot => {
                            const card = cards[cardSlot];
                            const shouldHideCard = isMySeat && !holeCardsVisible;
                            const hasWon = seatActions['showdown']?.[seat] === ACTIONS.WON;
                            const cardStatus = isMucked ? 'mucked' : hasWon ? 'won' : inactiveStatus || null;

                            return (
                              <CardSlot
                                key={cardSlot}
                                card={card}
                                variant="showdown"
                                isHidden={shouldHideCard}
                                status={cardStatus}
                                canInteract={false}
                              SEAT_STATUS={SEAT_STATUS} />
                            );
                          })}

                          {/* Diagonal Overlay Label */}
                          <DiagonalOverlay status={getOverlayStatus(inactiveStatus, isMucked, seatActions['showdown']?.[seat] === ACTIONS.WON)} SEAT_STATUS={SEAT_STATUS} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Action History Grid - Segmented by Street */}
                <div className="bg-white rounded shadow p-4">
                  <div className="grid grid-cols-9 gap-2">
                    {/* Headers with Labels buttons */}
                    {SEAT_ARRAY.map(seat => (
                      <div key={seat} className="flex flex-col items-center">
                        <button className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 rounded font-semibold w-full mb-2">
                          Labels
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Street Sections */}
                  {STREETS.map(street => (
                    <div key={street} className="mb-3">
                      <div className="text-xs font-bold text-gray-700 uppercase mb-1 border-b-2 border-gray-600 pb-1">
                        {street}
                      </div>
                      <div className="grid grid-cols-9 gap-2">
                        {SEAT_ARRAY.map(seat => {
                          const action = seatActions[street]?.[seat];
                          const inactiveStatus = isSeatInactive(seat);
                          const cards = seat === mySeat ? holeCards : allPlayerCards[seat];

                          let displayAction = '';
                          let actionColor = 'bg-gray-100 text-gray-900';

                          // For showdown street, check if player folded on a previous street
                          let effectiveAction = action;
                          if (street === 'showdown' && !action) {
                            // Check all previous streets for fold
                            const hasFolded = BETTING_STREETS.some(prevStreet => {
                              const prevAction = seatActions[prevStreet]?.[seat];
                              return isFoldAction(prevAction);
                            });
                            if (hasFolded) {
                              effectiveAction = ACTIONS.FOLD;
                            }
                          }

                          if (effectiveAction) {
                            actionColor = getActionColor(effectiveAction);
                            displayAction = getActionDisplayName(effectiveAction);

                            // For showdown, add cards if available
                            if (street === 'showdown') {
                              const handAbbr = getHandAbbreviation(cards);

                              if (effectiveAction === ACTIONS.MUCKED) {
                                // Muck - no cards shown
                                displayAction = 'muck';
                              } else if (effectiveAction === ACTIONS.WON) {
                                // Won - show cards if available
                                if (handAbbr) {
                                  displayAction = `won ${handAbbr}`;
                                } else {
                                  displayAction = 'won';
                                }
                              } else if (isFoldAction(effectiveAction)) {
                                // Folded - show cards if available, otherwise just "fold"
                                if (handAbbr) {
                                  displayAction = `fold ${handAbbr}`;
                                } else {
                                  displayAction = 'fold';
                                }
                              } else if (inactiveStatus === SEAT_STATUS.ABSENT) {
                                // Absent - no action
                                displayAction = '';
                              } else {
                                // Active player who made it to showdown - only show "show" if cards present
                                if (handAbbr) {
                                  displayAction = `show ${handAbbr}`;
                                } else {
                                  // No cards assigned and not folded/mucked/won/absent - don't display anything
                                  displayAction = '';
                                }
                              }
                            }
                          } else if (street === 'showdown') {
                            // No action recorded for showdown, but check if player has cards
                            const handAbbr = getHandAbbreviation(cards);
                            if (handAbbr && inactiveStatus !== SEAT_STATUS.ABSENT && inactiveStatus !== SEAT_STATUS.FOLDED) {
                              displayAction = `show ${handAbbr}`;
                              actionColor = 'bg-gray-100 text-gray-900';
                            }
                          }

                          return (
                            <div key={seat} className="text-center py-1 px-1 text-xs" style={{ minHeight: '24px' }}>
                              {displayAction ? (
                                <div className={`${actionColor} rounded px-1 py-1 font-semibold`}>
                                  {displayAction}
                                </div>
                              ) : (
                                <div className="text-gray-300">—</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              /* Card Selection View */
              <>
                <div className="grid grid-cols-9 gap-2 mb-4">
                  {SEAT_ARRAY.map(seat => {
                    const inactiveStatus = isSeatInactive(seat);
                    const isMucked = seatActions['showdown']?.[seat] === ACTIONS.MUCKED;
                    // Use holeCards for my seat, allPlayerCards for others
                    const cards = seat === mySeat ? holeCards : allPlayerCards[seat];
                    const isDealer = dealerButtonSeat === seat;
                    const isSB = getSmallBlindSeat() === seat;
                    const isBB = getBigBlindSeat() === seat;
                    const isMySeat = mySeat === seat;

                    return (
                      <div key={seat} className="flex flex-col items-center">
                        {/* Seat Number - Always at top */}
                        <div className="text-sm font-bold mb-1">Seat {seat}</div>

                        {/* Dealer/Blinds/My Seat Indicators with Visibility Toggle */}
                        <div className="flex gap-1 mb-1 items-center" style={{ minHeight: '24px' }}>
                          {isDealer && <PositionBadge type="dealer" size="small" />}
                          {isSB && <PositionBadge type="sb" size="small" />}
                          {isBB && <PositionBadge type="bb" size="small" />}
                          {isMySeat && <PositionBadge type="me" size="small" />}
                          {isMySeat && (
                            <VisibilityToggle
                              visible={holeCardsVisible}
                              onToggle={() => setHoleCardsVisible(!holeCardsVisible)}
                              size="small"
                            />
                          )}
                        </div>

                        {/* Card Slots with Overlaid Labels */}
                        <div className="flex gap-1 mb-1 relative">
                          {[0, 1].map(cardSlot => {
                            const card = cards[cardSlot];
                            const isHighlighted = highlightedSeat === seat && highlightedHoleSlot === cardSlot;
                            const shouldHideCard = isMySeat && !holeCardsVisible;
                            const canInteract = inactiveStatus !== SEAT_STATUS.ABSENT && !isMucked;
                            const cardStatus = isMucked ? 'mucked' : inactiveStatus || null;

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
                                  if (canInteract) {
                                    setHighlightedSeat(seat);
                                    setHighlightedCardSlot(cardSlot);
                                  }
                                }}
                              />
                            );
                          })}

                          {/* Diagonal Overlay Label for Folded/Absent/Mucked/Won */}
                          <DiagonalOverlay status={getOverlayStatus(inactiveStatus, isMucked, seatActions['showdown']?.[seat] === ACTIONS.WON)} SEAT_STATUS={SEAT_STATUS} />
                        </div>

                        {/* Muck and Won Buttons - Only for non-folded and non-absent and non-mucked/won hands */}
                        {inactiveStatus !== SEAT_STATUS.FOLDED && inactiveStatus !== SEAT_STATUS.ABSENT && !isMucked && seatActions['showdown']?.[seat] !== ACTIONS.WON && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleMuckSeat(seat)}
                              className="bg-gray-500 hover:bg-gray-600 text-white text-xs px-2 py-1 rounded font-semibold"
                            >
                              Muck
                            </button>
                            {/* Only show Won button if no seat has won yet */}
                            {!Object.values(seatActions['showdown'] || {}).includes(ACTIONS.WON) && (
                              <button
                                onClick={() => handleWonSeat(seat)}
                                className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 rounded font-semibold"
                              >
                                Won
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Card Selection Table */}
                <div className="flex-1 bg-white py-1 px-2 overflow-hidden flex items-center justify-center">
                  <table className="border-collapse">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}></th>
                        {RANKS.map(rank => (
                          <th key={rank} className="text-center">
                            <div className="text-xl font-bold">{rank}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {SUITS.map(suit => (
                        <tr key={suit}>
                          <td className="text-center" style={{ width: '40px' }}>
                            <div className={`text-3xl ${isRedSuit(suit) ? 'text-red-600' : 'text-black'}`}>
                              {suit}
                            </div>
                          </td>
                          {RANKS.map(rank => {
                            const card = `${rank}${suit}`;

                            // Check if card is used in community cards
                            const isInCommunity = communityCards.includes(card);
                            const communityIndex = communityCards.indexOf(card);

                            // Check if card is used in any player's hand
                            let usedBySeat = null;
                            let cardSlotIndex = null;

                            // Check my seat's hole cards
                            if (holeCards.includes(card)) {
                              usedBySeat = mySeat;
                            }

                            // Check all other players
                            Object.entries(allPlayerCards).forEach(([seat, playerHand]) => {
                              const index = playerHand.indexOf(card);
                              if (index !== -1) {
                                usedBySeat = parseInt(seat);
                                cardSlotIndex = index;
                              }
                            });

                            const isUsed = isInCommunity || usedBySeat !== null;
                            const canSelect = highlightedSeat !== null && highlightedHoleSlot !== null;

                            // Get street indicator for community cards
                            let streetIndicator = null;
                            if (isInCommunity) {
                              if (communityIndex <= 2) streetIndicator = 'F';
                              else if (communityIndex === 3) streetIndicator = 'T';
                              else if (communityIndex === 4) streetIndicator = 'R';
                            }

                            return (
                              <td key={card} className="p-1 relative">
                                <button
                                  onClick={() => canSelect && selectCardForShowdown(card)}
                                  disabled={!canSelect}
                                  className={`w-full rounded-lg font-bold transition-all relative flex flex-col items-center justify-center gap-1 ${
                                    isUsed
                                      ? 'bg-gray-300 text-gray-400 cursor-not-allowed opacity-40'
                                      : !canSelect
                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                        : isRedSuit(suit)
                                          ? 'bg-red-50 hover:bg-red-200 border-2 border-red-400 text-red-600 hover:scale-105'
                                          : 'bg-gray-50 hover:bg-gray-200 border-2 border-gray-800 text-black hover:scale-105'
                                  }`}
                                  style={{ height: '90px', width: '62px' }}
                                >
                                  <div className="text-lg font-bold">{rank}</div>
                                  <div className="text-3xl leading-none">{suit}</div>
                                  {streetIndicator && (
                                    <div className="absolute bottom-0 right-0 bg-blue-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-tl">
                                      {streetIndicator}
                                    </div>
                                  )}
                                  {usedBySeat !== null && (
                                    <div className="absolute top-1 left-1 bg-green-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                      {usedBySeat}
                                    </div>
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
