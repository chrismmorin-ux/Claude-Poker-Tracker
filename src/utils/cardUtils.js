/**
 * cardUtils.js - Utility functions for card operations
 */

/**
 * Assigns a card to a slot and removes it from other slots
 * @param {Array} cards - Current cards array
 * @param {string} card - Card to assign
 * @param {number} targetSlot - Slot index to assign to
 * @returns {Array} - Updated cards array
 */
export const assignCardToSlot = (cards, card, targetSlot) => {
  const newCards = [...cards];

  // Remove card from other slot if it's there
  const existingIndex = newCards.indexOf(card);
  if (existingIndex !== -1 && existingIndex !== targetSlot) {
    newCards[existingIndex] = '';
  }

  // Assign to target slot
  newCards[targetSlot] = card;
  return newCards;
};

/**
 * Removes a card from all player hands
 * @param {Object} allPlayerCards - All player cards object
 * @param {string} card - Card to remove
 * @returns {Object} - Updated player cards object
 */
export const removeCardFromAllPlayers = (allPlayerCards, card) => {
  const newCards = { ...allPlayerCards };

  Object.keys(newCards).forEach(seatStr => {
    const seat = parseInt(seatStr);
    newCards[seat] = newCards[seat].map(c => c === card ? '' : c);
  });

  return newCards;
};

/**
 * Removes a card from an array
 * @param {Array} cards - Cards array
 * @param {string} card - Card to remove
 * @returns {Array} - Updated cards array
 */
export const removeCardFromArray = (cards, card) => {
  return cards.map(c => c === card ? '' : c);
};

/**
 * Checks if auto-close should happen for community card selection
 * @param {string} currentStreet - Current street
 * @param {number} highlightedIndex - Currently highlighted board index
 * @returns {boolean} - True if should auto-close
 */
export const shouldAutoCloseCardSelector = (currentStreet, highlightedIndex) => {
  return (
    (currentStreet === 'flop' && highlightedIndex === 2) ||
    (currentStreet === 'turn' && highlightedIndex === 3) ||
    (currentStreet === 'river' && highlightedIndex === 4)
  );
};

/**
 * Gets the next card index to highlight after selection
 * @param {number} currentIndex - Current index
 * @param {number} maxIndex - Maximum index (default 4 for community cards)
 * @returns {number|null} - Next index or null if at end
 */
export const getNextCardIndex = (currentIndex, maxIndex = 4) => {
  if (currentIndex < maxIndex) {
    return currentIndex + 1;
  }
  return null;
};

/**
 * Finds the next empty card slot in showdown view
 * @param {number} currentSeat - Current seat
 * @param {number} currentSlot - Current slot (0 or 1)
 * @param {number} mySeat - Player's seat
 * @param {Array} holeCards - Player's hole cards
 * @param {Object} allPlayerCards - All player cards
 * @param {Function} isSeatInactive - Function to check if seat is inactive
 * @param {Object} seatActions - Seat actions object
 * @param {Object} ACTIONS - Actions constants
 * @param {Object} SEAT_STATUS - Seat status constants
 * @param {number} NUM_SEATS - Total number of seats
 * @returns {Object|null} - {seat, slot} or null if none found
 */
export const findNextEmptySlot = (
  currentSeat,
  currentSlot,
  mySeat,
  holeCards,
  allPlayerCards,
  isSeatInactive,
  seatActions,
  ACTIONS,
  SEAT_STATUS,
  NUM_SEATS
) => {
  // First check if the second slot of current seat is empty
  if (currentSlot === 0) {
    const cards = currentSeat === mySeat ? holeCards : allPlayerCards[currentSeat];
    if (!cards[1]) {
      return { seat: currentSeat, slot: 1 };
    }
  }

  // Otherwise, look for next seat with empty slots
  let nextSeat = currentSeat + 1;
  while (nextSeat <= NUM_SEATS) {
    const nextStatus = isSeatInactive(nextSeat);
    const nextMucked = seatActions['showdown']?.[nextSeat] === ACTIONS.MUCKED;
    const nextWon = seatActions['showdown']?.[nextSeat] === ACTIONS.WON;

    // Skip folded, absent, mucked, and won seats
    if (nextStatus !== SEAT_STATUS.FOLDED && nextStatus !== SEAT_STATUS.ABSENT && !nextMucked && !nextWon) {
      const cards = nextSeat === mySeat ? holeCards : allPlayerCards[nextSeat];
      // Check first slot
      if (!cards[0]) {
        return { seat: nextSeat, slot: 0 };
      }
      // Check second slot
      if (!cards[1]) {
        return { seat: nextSeat, slot: 1 };
      }
    }
    nextSeat++;
  }

  // No empty slots found
  return null;
};

/**
 * Assigns a card to a player's slot and removes from other players
 * @param {Object} allPlayerCards - All player cards
 * @param {number} seat - Target seat
 * @param {number} slot - Target slot
 * @param {string} card - Card to assign
 * @returns {Object} - Updated player cards
 */
export const assignCardToPlayer = (allPlayerCards, seat, slot, card) => {
  // First remove card from all players
  const clearedCards = removeCardFromAllPlayers(allPlayerCards, card);

  // Then assign to target seat/slot
  const updatedCards = { ...clearedCards };
  updatedCards[seat] = [...updatedCards[seat]];
  updatedCards[seat][slot] = card;

  return updatedCards;
};
