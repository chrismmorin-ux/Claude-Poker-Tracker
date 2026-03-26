/**
 * validation.js - Input validation utilities
 */

/**
 * Validates a seat number
 * @param {number} seat - Seat number to validate
 * @param {number} numSeats - Total number of seats
 * @returns {boolean} - True if valid
 */
export const isValidSeat = (seat, numSeats = 9) => {
  return Number.isInteger(seat) && seat >= 1 && seat <= numSeats;
};

/**
 * Checks if a card is already in use
 * @param {string} card - Card to check
 * @param {Array} communityCards - Community cards array
 * @param {Array} holeCards - Hole cards array
 * @param {Object} allPlayerCards - All player cards object
 * @param {number} currentSeat - Current seat (to exclude from check)
 * @param {number} currentSlot - Current slot (to exclude from check)
 * @returns {boolean} - True if card is in use elsewhere
 */
export const isCardInUse = (card, communityCards, holeCards, allPlayerCards, currentSeat = null, currentSlot = null) => {
  // Check community cards
  const inCommunity = communityCards.includes(card);

  // Check hole cards (exclude current slot if it's in hole cards)
  const inHole = currentSeat === null && holeCards.includes(card);

  // Check other player cards
  let inOtherPlayers = false;
  if (allPlayerCards) {
    Object.keys(allPlayerCards).forEach(seat => {
      const seatNum = parseInt(seat);
      allPlayerCards[seatNum].forEach((c, idx) => {
        // Skip current seat/slot
        if (seatNum === currentSeat && idx === currentSlot) return;
        if (c === card) inOtherPlayers = true;
      });
    });
  }

  return inCommunity || inHole || inOtherPlayers;
};

