/**
 * range-grid-data.js — Self-contained GTO range data for the extension sidebar.
 *
 * Ports essential parts of rangeMatrix.js + positionUtils.js so the extension
 * can render preflop range grids without importing from the main app.
 *
 * All functions are pure — no DOM access, no Chrome APIs.
 */

// =========================================================================
// RANK / INDEX UTILITIES
// =========================================================================

const RANK_CHARS = '23456789TJQKA';
const NUM_SEATS = 9;

export const rankFromChar = (c) => RANK_CHARS.indexOf(c);

/**
 * Get grid index from two rank values.
 * Suited = upper triangle (high*13+low), Offsuit = lower triangle (low*13+high).
 * Pairs on diagonal.
 */
export const rangeIndex = (rank1, rank2, suited) => {
  const high = Math.max(rank1, rank2);
  const low = Math.min(rank1, rank2);
  if (high === low) return high * 13 + low;
  return suited ? (high * 13 + low) : (low * 13 + high);
};

/**
 * Decode grid index back to hand description.
 */
export const decodeIndex = (idx) => {
  const row = Math.floor(idx / 13);
  const col = idx % 13;
  if (row === col) return { rank1: row, rank2: col, suited: false, isPair: true };
  const high = Math.max(row, col);
  const low = Math.min(row, col);
  const suited = row > col;
  return { rank1: high, rank2: low, suited, isPair: false };
};

// =========================================================================
// RANGE STRING PARSER
// =========================================================================

export const parseRangeString = (str) => {
  const range = new Float64Array(169);
  const parts = str.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('+')) {
      const base = trimmed.replace('+', '');
      if (base.length === 2 && base[0] === base[1]) {
        const r = rankFromChar(base[0]);
        for (let i = r; i <= 12; i++) range[rangeIndex(i, i, false)] = 1.0;
      } else if (base.length === 3) {
        const high = rankFromChar(base[0]);
        const low = rankFromChar(base[1]);
        const suited = base[2] === 's';
        for (let i = low; i < high; i++) range[rangeIndex(high, i, suited)] = 1.0;
      }
    } else if (trimmed.length === 2) {
      const r = rankFromChar(trimmed[0]);
      if (r >= 0) range[rangeIndex(r, r, false)] = 1.0;
    } else if (trimmed.length === 3) {
      const r1 = rankFromChar(trimmed[0]);
      const r2 = rankFromChar(trimmed[1]);
      const suited = trimmed[2] === 's';
      if (r1 >= 0 && r2 >= 0) range[rangeIndex(r1, r2, suited)] = 1.0;
    }
  }
  return range;
};

// =========================================================================
// GTO PREFLOP CHARTS (RFI ranges, 9-max 100bb cash)
// =========================================================================

export const PREFLOP_CHARTS = {
  UTG: parseRangeString('66+,A9s+,A5s,KTs+,QTs+,JTs,T9s,98s,AQo+'),
  'UTG+1': parseRangeString('66+,A4s+,K9s+,Q9s+,J9s+,T9s,98s,AJo+,KQo'),
  MP1: parseRangeString('66+,A2s+,K9s+,Q9s+,J9s+,T9s,98s,87s,76s,AJo+,KQo'),
  MP2: parseRangeString('44+,A2s+,K9s+,Q9s+,J9s+,T9s,98s,87s,76s,65s,ATo+,KJo+'),
  HJ: parseRangeString('22+,A2s+,K8s+,Q9s+,J9s+,T9s,98s,87s,76s,65s,54s,ATo+,KJo+'),
  CO: parseRangeString('22+,A2s+,K7s+,Q8s+,J8s+,T8s+,97s+,86s+,75s+,64s+,54s,43s,A9o+,KJo+'),
  BTN: parseRangeString('22+,A2s+,K2s+,Q2s+,J6s+,T6s+,96s+,85s+,75s+,64s+,53s+,43s,32s,A2o+,K7o+,Q8o+,J8o+,T8o+,97o+,87o,76o'),
  SB: parseRangeString('22+,A2s+,K8s+,Q9s+,J9s+,T8s+,97s+,86s+,76s,65s,54s,A8o+,KTo+,QTo+,JTo,T9o'),
  BB: parseRangeString('22+,A2s+,K4s+,Q7s+,J7s+,T7s+,97s+,86s+,76s,75s,65s,64s,54s,53s,43s,A6o+,K9o+,Q9o+,J9o+,T9o,98o,87o'),
};

// =========================================================================
// POSITION UTILITIES
// =========================================================================

/**
 * Position names in clockwise order from button (index 0 = BTN).
 * Matches main app's positionUtils.js POSITION_NAMES.
 */
const POSITION_NAMES = ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP1', 'MP2', 'HJ', 'CO'];

/**
 * Get position name for a seat relative to button.
 * @param {number} seat - Seat number (1-9)
 * @param {number} buttonSeat - Button seat number (1-9)
 * @returns {string} Position name or null
 */
export const getPositionName = (seat, buttonSeat) => {
  if (!seat || !buttonSeat) return null;
  if (seat < 1 || seat > NUM_SEATS || buttonSeat < 1 || buttonSeat > NUM_SEATS) return null;
  const offset = (seat - buttonSeat + NUM_SEATS) % NUM_SEATS;
  return POSITION_NAMES[offset] || null;
};

// =========================================================================
// HOLE CARD PARSING
// =========================================================================

const RANK_MAP = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6,
  '9': 7, 'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12,
};

/**
 * Parse hole cards from liveContext format to rank/suited info.
 * @param {string[]} cards - e.g., ['A♠', 'K♥']
 * @returns {{ rank1: number, rank2: number, suited: boolean }|null}
 */
export const parseHoleCards = (cards) => {
  if (!cards || cards.length < 2) return null;
  const [c1, c2] = cards;
  if (!c1 || !c2 || c1 === '' || c2 === '') return null;

  const r1 = RANK_MAP[c1[0]];
  const r2 = RANK_MAP[c2[0]];
  if (r1 === undefined || r2 === undefined) return null;

  // Suit is the remaining character(s) after the rank char
  const s1 = c1.slice(1);
  const s2 = c2.slice(1);
  const suited = s1 === s2;

  return { rank1: r1, rank2: r2, suited };
};

/**
 * Get the 13x13 grid index for hero's hole cards.
 * @param {string[]} cards - e.g., ['A♠', 'K♥']
 * @returns {number} Grid index 0-168, or -1 if invalid
 */
export const heroHandIndex = (cards) => {
  const parsed = parseHoleCards(cards);
  if (!parsed) return -1;
  return rangeIndex(parsed.rank1, parsed.rank2, parsed.suited);
};

// =========================================================================
// RANGE WIDTH
// =========================================================================

/**
 * Get approximate range width (% of hands).
 */
export const rangeWidth = (range) => {
  if (!range) return 0;
  let totalCombos = 0;
  for (let idx = 0; idx < 169; idx++) {
    if (range[idx] <= 0) continue;
    const { isPair, suited } = decodeIndex(idx);
    const combos = isPair ? 6 : suited ? 4 : 12;
    totalCombos += combos * range[idx];
  }
  return Math.round((totalCombos / 1326) * 100);
};

// =========================================================================
// DEFENDING RANGE (facing raise)
// =========================================================================

/**
 * Hand strength score for sorting which hands to keep when tightening.
 * Higher = stronger. Pairs weighted by rank, suited > offsuit.
 */
const handStrengthScore = (idx) => {
  const { rank1, rank2, suited, isPair } = decodeIndex(idx);
  if (isPair) return 200 + rank1 * 10; // AA=320, KK=310, ..., 22=200
  const base = rank1 * 10 + rank2;
  const suitBonus = suited ? 30 : 0;
  const connBonus = (rank1 - rank2 <= 2) ? 5 : 0;
  return base + suitBonus + connBonus;
};

/**
 * Compute a defending range for facing-raise situations.
 * Keeps the strongest ~65% of the opening range (by hand strength score).
 * @param {string} position - PREFLOP_CHARTS key
 * @returns {Float64Array} 169-cell defending range
 */
export const getDefendingRange = (position) => {
  const base = PREFLOP_CHARTS[position];
  if (!base) return new Float64Array(169);

  // Collect hands in the base range with their strength scores
  const hands = [];
  for (let idx = 0; idx < 169; idx++) {
    if (base[idx] > 0) {
      hands.push({ idx, score: handStrengthScore(idx) });
    }
  }

  // Sort by strength descending, keep top ~65%
  hands.sort((a, b) => b.score - a.score);
  const keepCount = Math.ceil(hands.length * 0.65);

  const defending = new Float64Array(169);
  for (let i = 0; i < keepCount; i++) {
    defending[hands[i].idx] = 1.0;
  }
  return defending;
};
