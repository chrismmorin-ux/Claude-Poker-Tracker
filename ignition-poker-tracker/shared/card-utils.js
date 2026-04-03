/**
 * shared/card-utils.js — Card parsing + board texture analysis
 *
 * Self-contained port of pokerCore/cardParser.js + pokerCore/boardTexture.js.
 * No dependencies on the main app — inlines rank/suit constants.
 *
 * Card format: 2-char strings like 'Ah', 'Td', 'Kc' (from protocol.js decodeCard)
 */

// =========================================================================
// CARD CONSTANTS (self-contained, matches extension's protocol.js format)
// =========================================================================

// Rank values: 2=0, 3=1, ... A=12 (same encoding as main app's cardParser)
export const RANK_VALUES = { '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, 'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12 };
export const SUIT_VALUES = { 'h': 0, 'd': 1, 'c': 2, 's': 3 };

// =========================================================================
// CARD PARSING
// =========================================================================

export const parseCard = (str) => {
  if (!str || str.length < 2) return null;
  const rank = RANK_VALUES[str[0]];
  const suit = SUIT_VALUES[str[1]];
  if (rank === undefined || suit === undefined) return null;
  return { rank, suit };
};

export const encodeCard = (rank, suit) => rank * 4 + suit;
export const cardRank = (encoded) => (encoded >> 2);
export const cardSuit = (encoded) => (encoded & 3);

export const parseAndEncode = (str) => {
  const parsed = parseCard(str);
  if (!parsed) return -1;
  return encodeCard(parsed.rank, parsed.suit);
};

export const parseBoard = (communityCards) => {
  if (!Array.isArray(communityCards)) return [];
  return communityCards
    .filter(c => c && c !== '')
    .map(parseAndEncode)
    .filter(c => c >= 0);
};

// =========================================================================
// BOARD TEXTURE ANALYSIS
// (Direct port of src/utils/pokerCore/boardTexture.js)
// =========================================================================

/**
 * Analyze board texture from encoded card array.
 * @param {number[]} boardCards - Encoded cards (from parseBoard)
 * @returns {Object|null} Board texture analysis
 */
export const analyzeBoardTexture = (boardCards) => {
  if (!boardCards || boardCards.length === 0) return null;

  const ranks = boardCards.map(cardRank);
  const suits = boardCards.map(cardSuit);
  const n = boardCards.length;

  // Rank frequency
  const rankFreq = new Uint8Array(13);
  for (const r of ranks) rankFreq[r]++;

  const maxRankFreq = Math.max(...rankFreq);
  const isPaired = maxRankFreq >= 2;
  const isTrips = maxRankFreq >= 3;

  // Suit frequency
  const suitFreq = new Uint8Array(4);
  for (const s of suits) suitFreq[s]++;

  const maxSuitFreq = Math.max(...suitFreq);
  const flushDraw = maxSuitFreq >= 3;
  const flushComplete = maxSuitFreq >= 4;
  const monotone = maxSuitFreq === n && n >= 3;
  const rainbow = n >= 3 && maxSuitFreq === 1;
  const twoTone = n >= 3 && !monotone && maxSuitFreq >= 2;

  // Straight connectivity: check 5-rank windows
  const rankPresent = new Uint8Array(13);
  for (const r of ranks) rankPresent[r] = 1;

  let maxInWindow = 0;
  for (let low = 0; low <= 8; low++) {
    let count = 0;
    for (let r = low; r < low + 5; r++) {
      count += rankPresent[r];
    }
    maxInWindow = Math.max(maxInWindow, count);
  }
  // Check A-2-3-4-5 wheel window
  const wheelCount = rankPresent[12] + rankPresent[0] + rankPresent[1] + rankPresent[2] + rankPresent[3];
  maxInWindow = Math.max(maxInWindow, wheelCount);

  const straightPossible = maxInWindow >= 3;

  // Connected: count adjacent-rank pairs
  let connected = 0;
  const sortedRanks = [...ranks].sort((a, b) => a - b);
  for (let i = 1; i < sortedRanks.length; i++) {
    if (sortedRanks[i] - sortedRanks[i - 1] === 1) connected++;
  }

  // Broadway cards (T=8, J=9, Q=10, K=11, A=12)
  const highCardCount = ranks.filter(r => r >= 8).length;

  // Wetness scoring
  let wetScore = 30; // baseline
  if (flushDraw) wetScore += 25;
  if (monotone) wetScore += 35;
  if (flushComplete) wetScore += 10;
  if (straightPossible) wetScore += 15;
  wetScore += connected * 10;
  if (isPaired) wetScore -= 20;
  if (rainbow) wetScore -= 15;
  wetScore += highCardCount * 5;

  wetScore = Math.max(0, Math.min(100, wetScore));

  const texture = wetScore >= 65 ? 'wet' : wetScore >= 40 ? 'medium' : 'dry';

  return {
    isPaired,
    isTrips,
    flushDraw,
    flushComplete,
    monotone,
    rainbow,
    twoTone,
    straightPossible,
    connected,
    highCardCount,
    texture,
    wetScore,
  };
};

/**
 * Convenience: analyze from raw community card strings.
 * @param {string[]} communityCards - e.g. ['Ah', 'Kd', '2c']
 * @returns {Object|null} Board texture or null if no cards
 */
export const analyzeBoardFromStrings = (communityCards) => {
  const encoded = parseBoard(communityCards);
  return analyzeBoardTexture(encoded);
};
