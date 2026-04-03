/**
 * shared/hand-format.js - Hand record format bridge specification
 *
 * Defines the normalized hand format that the extension produces,
 * bridging Ignition's raw captured data to the main app's
 * validateHandRecord() schema.
 */

// ============================================================================
// ACTION ENTRY FORMAT
// ============================================================================

/**
 * Creates an action entry matching the main app's actionSequence format.
 */
export const createActionEntry = ({ seat, action, street, order, amount }) => {
  const entry = { seat, action, street, order };
  if (amount !== undefined && amount !== null) {
    entry.amount = amount;
  }
  return entry;
};

// ============================================================================
// CARD FORMAT
// ============================================================================

export const SUIT_MAP = {
  '♥': '♥', '♦': '♦', '♣': '♣', '♠': '♠',
  'hearts': '♥', 'diamonds': '♦', 'clubs': '♣', 'spades': '♠',
  'heart': '♥', 'diamond': '♦', 'club': '♣', 'spade': '♠',
  'h': '♥', 'd': '♦', 'c': '♣', 's': '♠',
  'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠',
};

export const RANK_MAP = {
  '10': 'T', 'ten': 'T', 'jack': 'J', 'queen': 'Q', 'king': 'K', 'ace': 'A',
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  'T': 'T', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
  't': 'T', 'j': 'J', 'q': 'Q', 'k': 'K', 'a': 'A',
};

/**
 * Normalize a card string to Unicode format (e.g., 'A♥', 'T♦').
 * @param {string} raw - Raw card representation
 * @returns {string} Normalized card string, or '' if unparseable
 */
export const normalizeCard = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();

  // Already in Unicode format (e.g., 'A♥', 'T♦')
  if (/^[2-9TJQKA][♥♦♣♠]$/.test(trimmed)) return trimmed;

  // Already in lowercase format (e.g., 'Ah', 'Td') — convert to Unicode
  if (/^[2-9TJQKA][hdcs]$/.test(trimmed)) {
    return trimmed[0] + SUIT_MAP[trimmed[1]];
  }

  // Try rank+suit extraction from various formats
  const rankMatch = trimmed.match(/^(10|[2-9]|[TJQKA]|ten|jack|queen|king|ace)/i);
  const suitMatch = trimmed.match(/([hdcsHDCS♥♦♣♠]|hearts?|diamonds?|clubs?|spades?)$/i);

  if (rankMatch && suitMatch) {
    const rank = RANK_MAP[rankMatch[1].toLowerCase()] || RANK_MAP[rankMatch[1]];
    const suit = SUIT_MAP[suitMatch[1].toLowerCase()] || SUIT_MAP[suitMatch[1]];
    if (rank && suit) return rank + suit;
  }

  return '';
};

// ============================================================================
// HAND RECORD BUILDER
// ============================================================================

/**
 * Creates a complete hand record ready for the main app.
 */
export const buildHandRecord = ({
  currentStreet,
  dealerButtonSeat,
  mySeat,
  actionSequence = [],
  absentSeats = [],
  communityCards = [],
  holeCards = ['', ''],
  allPlayerCards = {},
  seatPlayers = {},
  tableId,
  ignitionMeta = {},
}) => {
  // Pad community cards to exactly 5 elements
  const paddedCommunity = [...communityCards];
  while (paddedCommunity.length < 5) paddedCommunity.push('');

  // Normalize all cards
  const normalizedCommunity = paddedCommunity.map(normalizeCard);
  const normalizedHole = holeCards.map(normalizeCard);
  const normalizedPlayerCards = {};
  for (const [seat, cards] of Object.entries(allPlayerCards)) {
    if (Array.isArray(cards)) {
      normalizedPlayerCards[seat] = cards.map(normalizeCard);
    }
  }

  return {
    timestamp: Date.now(),
    version: '1.3.0',
    source: 'ignition',
    tableId,

    gameState: {
      currentStreet,
      dealerButtonSeat,
      mySeat,
      actionSequence,
      absentSeats,
    },

    cardState: {
      communityCards: normalizedCommunity,
      holeCards: normalizedHole,
      holeCardsVisible: normalizedHole[0] !== '' && normalizedHole[1] !== '',
      allPlayerCards: normalizedPlayerCards,
    },

    seatPlayers,

    ignitionMeta: {
      capturedAt: Date.now(),
      ...ignitionMeta,
    },
  };
};

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates a hand record matches the expected schema.
 *
 * @param {Object} record - Hand record to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const validateHandRecord = (record) => {
  const errors = [];

  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Hand record must be an object'] };
  }

  if (!record.timestamp || typeof record.timestamp !== 'number') {
    errors.push('Missing or invalid timestamp');
  }

  // gameState
  if (!record.gameState) {
    errors.push('Missing gameState');
  } else {
    if (typeof record.gameState.currentStreet !== 'string') {
      errors.push('gameState.currentStreet must be string');
    }
    if (typeof record.gameState.dealerButtonSeat !== 'number' ||
        record.gameState.dealerButtonSeat < 1) {
      errors.push('gameState.dealerButtonSeat must be a positive number');
    }
    if (typeof record.gameState.mySeat !== 'number' ||
        record.gameState.mySeat < 1) {
      errors.push('gameState.mySeat must be a positive number');
    }
    if (!Array.isArray(record.gameState.actionSequence)) {
      errors.push('gameState.actionSequence must be array');
    }
  }

  // cardState
  if (!record.cardState) {
    errors.push('Missing cardState');
  } else {
    if (!Array.isArray(record.cardState.communityCards) ||
        record.cardState.communityCards.length !== 5) {
      errors.push('cardState.communityCards must be array of 5');
    }
    if (!Array.isArray(record.cardState.holeCards) ||
        record.cardState.holeCards.length !== 2) {
      errors.push('cardState.holeCards must be array of 2');
    }
  }

  // seatPlayers
  if (record.seatPlayers && typeof record.seatPlayers !== 'object') {
    errors.push('seatPlayers must be an object');
  }

  return { valid: errors.length === 0, errors };
};
