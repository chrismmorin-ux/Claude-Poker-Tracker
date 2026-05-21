/**
 * boardShorthand.js — Convert a community-cards array to canonical
 * board-shorthand string matching the upper-surface filename encoding.
 *
 * Conventions (matches the artifact filenames in
 * `docs/upper-surface/reasoning-artifacts/*.md`):
 *
 * - Ranks concatenated descending: 'T96', 'Q72', 'K77'
 * - Suit suffix:
 *     '' (no suffix) — rainbow on 3-card flop OR explicit rainbow turn/river
 *     'r'            — explicit rainbow ('Q72r')
 *     'ss'           — two-tone (exactly two cards share a suit)
 *     'mono' or 'sss'— monotone (all 3+ same suit) — use 'mono' for clarity
 * - Paired boards (K77, T99, AA2): pair implicit in the rank string;
 *   suffix follows same rules as unpaired.
 *
 * Turn/river boards: append the 4th/5th card after the 3-card flop
 * shorthand if specified by caller. v1 default is flop-only shorthand
 * (3 cards in → 3-card shorthand; 4-5 cards in → still flop-shorthand
 * using the first 3 cards, since spot-key resolution is street-scoped
 * via the `nodeId` dimension).
 *
 * Pure function. SLS spike §"Encoding mismatch — quantified" line 100
 * estimated this at ~10 LoC; landed close.
 *
 * SLS Stream E — SPR-087 / WS-193.
 */

const RANK_TO_CHAR = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8',
  '9': '9', 'T': 'T', '10': 'T',
  'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A',
};

const RANK_VALUE = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

/**
 * Parse a card-string like 'Q♠', 'Th', '10c' into {rank, suit}.
 * Returns null on un-parseable input.
 */
const parseCard = (card) => {
  if (typeof card !== 'string' || card.length < 2) return null;
  // Two-character ranks ('10') get normalized via RANK_TO_CHAR.
  let rankStr;
  let suitStr;
  if (card.startsWith('10')) {
    rankStr = '10';
    suitStr = card.slice(2);
  } else {
    rankStr = card[0].toUpperCase();
    suitStr = card.slice(1);
  }
  const rank = RANK_TO_CHAR[rankStr];
  if (!rank) return null;
  // Normalize suit to single lowercase char ('h', 'd', 's', 'c').
  // Unicode suits map to letters per convention.
  const suitMap = {
    '♥': 'h', '♦': 'd', '♠': 's', '♣': 'c',
    'h': 'h', 'd': 'd', 's': 's', 'c': 'c',
    'H': 'h', 'D': 'd', 'S': 's', 'C': 'c',
  };
  const suit = suitMap[suitStr];
  if (!suit) return null;
  return { rank, suit };
};

/**
 * Compute the suit suffix for a board.
 * 3-card flop:
 *   - 3 distinct suits → '' (rainbow; no suffix to match upper-surface convention)
 *   - 2 distinct suits → 'ss' (two-tone)
 *   - 1 distinct suit  → 'mono'
 * 4-5 cards: same logic on the first 3 cards (flop-only shorthand for v1).
 */
const suitSuffix = (parsedCards) => {
  // Only consider the first 3 cards for flop suit pattern.
  const flopCards = parsedCards.slice(0, 3);
  if (flopCards.length < 3) return '';
  const distinctSuits = new Set(flopCards.map((c) => c.suit));
  if (distinctSuits.size === 3) return ''; // rainbow flop, no suffix
  if (distinctSuits.size === 2) return 'ss';
  return 'mono';
};

/**
 * Convert community cards to canonical shorthand.
 *
 * @param {Array<string>} communityCards — e.g., ['Q♠', '7♥', '2♣']
 * @returns {string|null} — 'Q72' / 'Q72ss' / 'K77' / 'T96ss' etc., or
 *                          null when the input doesn't parse to ≥3 cards
 */
export const toBoardShorthand = (communityCards) => {
  if (!Array.isArray(communityCards) || communityCards.length < 3) return null;

  const parsed = [];
  for (const card of communityCards) {
    const p = parseCard(card);
    if (!p) return null; // any un-parseable card → invalid input
    parsed.push(p);
  }

  // Sort by rank descending, then by suit (stable for deterministic output).
  // Only the first 3 cards (flop) drive the shorthand; turn/river cards
  // affect the nodeId dimension, not the board shorthand itself.
  const flopParsed = parsed.slice(0, 3).sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
  const rankStr = flopParsed.map((c) => c.rank).join('');
  const suffix = suitSuffix(flopParsed);
  return rankStr + suffix;
};

/**
 * Add an explicit 'r' suffix on a rainbow board for callers who want
 * the disambiguated form (matches `btn-vs-bb-srp-ip-dry-q72r` filename
 * convention). Otherwise rainbow boards return the bare rank string.
 *
 * Most upper-surface filenames use the suffixed form ('q72r'), so use
 * this when comparing for filename parity.
 */
export const toBoardShorthandRainbowExplicit = (communityCards) => {
  const base = toBoardShorthand(communityCards);
  if (!base) return null;
  // If base has no suit suffix and the input has ≥3 cards, it was rainbow.
  // Append 'r' for explicit form.
  const hasSuffix = base.endsWith('ss') || base.endsWith('mono');
  return hasSuffix ? base : base + 'r';
};
