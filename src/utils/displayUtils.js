/**
 * displayUtils.js - Display and formatting utilities
 */

const SUIT_ABBREV = { '♥': 'h', '♦': 'd', '♣': 'c', '♠': 's' };

/**
 * Checks if a card is red (hearts or diamonds)
 * @param {string} card - Card string (e.g., "A♥", "K♦")
 * @returns {boolean} - True if card is red
 */
export const isRedCard = (card) => {
  return card && (card.includes('♥') || card.includes('♦'));
};

/**
 * Checks if a suit is red (hearts or diamonds)
 * @param {string} suit - Suit character (♥, ♦, ♣, ♠)
 * @returns {boolean} - True if suit is red
 */
export const isRedSuit = (suit) => {
  return suit === '♥' || suit === '♦';
};

/**
 * Gets card abbreviation (A♥ → Ah)
 * @param {string} card - Card string (e.g., "A♥")
 * @param {Object} suitAbbrev - Suit abbreviation map (default: internal SUIT_ABBREV)
 * @returns {string} - Card abbreviation (e.g., "Ah")
 */
export const getCardAbbreviation = (card, suitAbbrev = SUIT_ABBREV) => {
  if (!card) return '';
  const rank = card[0];
  const suit = card[1];
  return rank + suitAbbrev[suit];
};

/**
 * Gets hand abbreviation from two cards
 * @param {Array} cards - Array of two cards (e.g., ["A♥", "K♠"])
 * @param {Object} suitAbbrev - Suit abbreviation map (default: internal SUIT_ABBREV)
 * @returns {string} - Hand abbreviation (e.g., "AhKs")
 */
export const getHandAbbreviation = (cards, suitAbbrev = SUIT_ABBREV) => {
  if (!cards || cards.length !== 2) return '';
  const card1 = getCardAbbreviation(cards[0], suitAbbrev);
  const card2 = getCardAbbreviation(cards[1], suitAbbrev);
  if (!card1 || !card2) return '';
  return card1 + card2;
};
