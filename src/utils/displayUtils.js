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

/**
 * Formats time in 12-hour format with AM/PM
 * @param {number} timestamp - Unix timestamp
 * @returns {string} - Formatted time (e.g., "2:30 PM")
 */
export const formatTime12Hour = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Calculates total from rebuy transactions
 * @param {Array} rebuyTransactions - Array of {timestamp, amount} objects
 * @returns {number} - Total rebuy amount
 */
export const calculateTotalRebuy = (rebuyTransactions = []) => {
  if (!Array.isArray(rebuyTransactions)) return 0;
  return rebuyTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
};

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, 4th, etc.)
 * @param {number} n - The number
 * @returns {string} Ordinal suffix (st, nd, rd, th)
 */
export const ordinalSuffix = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

/**
 * Formats milliseconds as a compact timer string (M:SS)
 * @param {number} ms - Milliseconds remaining
 * @returns {string} - Formatted timer (e.g., "12:05")
 */
export const formatMsToTimer = (ms) => {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Formats minutes as a human-readable estimate
 * @param {number} minutes - Number of minutes
 * @returns {string} - Human-readable string (e.g., "~25 min", "~1h 30m")
 */
export const formatMinutesHuman = (minutes) => {
  if (minutes <= 0) return 'now';
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `~${hours}h ${mins}m` : `~${hours}h`;
};
