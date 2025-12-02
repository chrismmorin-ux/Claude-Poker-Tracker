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
 * Validates a card string
 * @param {string} card - Card string (e.g., "A♠", "K♥")
 * @returns {boolean} - True if valid
 */
export const isValidCard = (card) => {
  if (typeof card !== 'string' || card.length !== 2) return false;

  const validRanks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
  const validSuits = ['♠', '♥', '♦', '♣'];

  const rank = card[0];
  const suit = card[1];

  return validRanks.includes(rank) && validSuits.includes(suit);
};

/**
 * Validates a street name
 * @param {string} street - Street name
 * @param {Array} validStreets - Array of valid street names
 * @returns {boolean} - True if valid
 */
export const isValidStreet = (street, validStreets = ['preflop', 'flop', 'turn', 'river', 'showdown']) => {
  return validStreets.includes(street);
};

/**
 * Validates an action
 * @param {string} action - Action to validate
 * @param {Object} ACTIONS - Actions constants object
 * @returns {boolean} - True if valid
 */
export const isValidAction = (action, ACTIONS) => {
  return Object.values(ACTIONS).includes(action);
};

/**
 * Validates community cards array
 * @param {Array} cards - Array of community cards
 * @returns {boolean} - True if valid (0-5 cards)
 */
export const isValidCommunityCards = (cards) => {
  if (!Array.isArray(cards)) return false;
  if (cards.length > 5) return false;

  // Check each card is valid or empty string
  return cards.every(card => card === '' || isValidCard(card));
};

/**
 * Validates hole cards array
 * @param {Array} cards - Array of hole cards
 * @returns {boolean} - True if valid (exactly 2 cards)
 */
export const isValidHoleCards = (cards) => {
  if (!Array.isArray(cards)) return false;
  if (cards.length !== 2) return false;

  // Check each card is valid or empty string
  return cards.every(card => card === '' || isValidCard(card));
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

/**
 * Validates player cards object
 * @param {Object} playerCards - Player cards object
 * @param {number} numSeats - Total number of seats
 * @returns {boolean} - True if valid
 */
export const isValidPlayerCards = (playerCards, numSeats = 9) => {
  if (typeof playerCards !== 'object' || playerCards === null) return false;

  // Check all seats 1-9 exist
  for (let seat = 1; seat <= numSeats; seat++) {
    if (!playerCards[seat]) return false;
    if (!Array.isArray(playerCards[seat])) return false;
    if (playerCards[seat].length !== 2) return false;

    // Check each card is valid or empty
    if (!playerCards[seat].every(card => card === '' || isValidCard(card))) {
      return false;
    }
  }

  return true;
};

/**
 * Validates seat actions object
 * @param {Object} seatActions - Seat actions object
 * @param {Array} validStreets - Array of valid street names
 * @param {Object} ACTIONS - Actions constants
 * @returns {boolean} - True if valid
 */
export const isValidSeatActions = (seatActions, validStreets, ACTIONS) => {
  if (typeof seatActions !== 'object' || seatActions === null) return false;

  // Check each street
  for (const street in seatActions) {
    if (!isValidStreet(street, validStreets)) return false;

    // Check each seat in the street
    for (const seat in seatActions[street]) {
      const seatNum = parseInt(seat);
      if (!isValidSeat(seatNum)) return false;

      const action = seatActions[street][seat];
      if (!isValidAction(action, ACTIONS)) return false;
    }
  }

  return true;
};
