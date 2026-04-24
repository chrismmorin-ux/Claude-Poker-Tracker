/**
 * baselineSynthesis.js — Synthesize a representative game state from a VillainAssumption
 *
 * Part of the citedDecision module. See `CLAUDE.md` for rules (mandatory read).
 *
 * Why: assumptions carry only `claim.scope` (street, texture, position, sprRange,
 * betSizeRange, playersToAct), not specific holdings/board. To compute a real
 * game-tree baseline (per architecture §10 Theory Roundtable Stage 4 resolution),
 * we need a concrete `{ heroCards, board, villainRange, potSize, ... }` to pass
 * to `evaluateGameTree()`.
 *
 * The synthesis is **representative**, not actual: drill is a teaching surface
 * (pre-Session Preparer JTBD SE-01..03), not a hand-replay. The drill UI MUST
 * disclose that the spot is synthesized — `synthesized: true` flag on the result
 * powers the "Representative spot · river · wet · IP" badge in DrillReveal.
 *
 * Tables (BOARD_TEMPLATES, HERO_HOLDING_BY_DEVIATION, VILLAIN_RANGE_BY_STYLE)
 * are intentionally lookup-driven so they're easy to expand without API changes.
 *
 * Pure module. No async, no IDB, no React. Returns a plain object.
 */

import {
  encodeCard,
  parseAndEncode,
} from '../pokerCore/cardParser';
import { parseRangeString, createRange } from '../pokerCore/rangeMatrix';

// ───────────────────────────────────────────────────────────────────────────
// Templates — board archetypes by (texture, street)
// ───────────────────────────────────────────────────────────────────────────

/**
 * One representative board per (texture, street) cell. Suits + connectivity
 * chosen to match canonical "wet/dry" semantics from boardTexture.analyzeBoard.
 *
 * Wet boards: connected, suited, draw-rich.
 * Dry boards: rainbow, disconnected, low-equity-realization-friendly.
 *
 * Strings — encoded into integers at synthesis time so this table is human-readable.
 */
const BOARD_TEMPLATES = Object.freeze({
  wet: {
    flop:  ['T♥', '9♥', '6♠'],                   // two-tone middling — canonical 3BP wet
    turn:  ['T♥', '9♥', '6♠', '5♦'],             // straightening turn
    river: ['T♥', '9♥', '6♠', '5♦', '2♣'],       // brick river
  },
  dry: {
    flop:  ['A♠', '7♥', '2♦'],                   // rainbow disconnected
    turn:  ['A♠', '7♥', '2♦', '8♣'],             // brick turn
    river: ['A♠', '7♥', '2♦', '8♣', '3♥'],       // brick river
  },
});

// ───────────────────────────────────────────────────────────────────────────
// Templates — hero holding by deviation type
// ───────────────────────────────────────────────────────────────────────────

/**
 * Each deviation type has a representative hero holding archetype expressed
 * as a list of candidate combos (try in order; first that doesn't collide
 * with the board wins).
 *
 * Rationale per type:
 *   bluff-prune   → missed-draw bluff combo (low-blocker air)
 *   value-expand  → thin top pair w/ marginal kicker
 *   range-bet     → top pair good kicker
 *   sizing-shift  → strong made hand (overpair / two pair)
 *   spot-skip     → air with no equity
 *   line-change   → marginal made hand
 */
const HERO_HOLDING_BY_DEVIATION = Object.freeze({
  'bluff-prune':  ['A♠5♠', 'A♣4♣', 'K♠4♠', 'Q♣5♣'],   // wheel/blocker air
  'value-expand': ['K♥9♥', 'K♣8♣', 'A♥9♥', 'Q♣9♣'],    // thin TP-ish
  'range-bet':    ['A♥K♣', 'A♠Q♥', 'K♣Q♠', 'A♣J♦'],   // strong unpaired holding
  'sizing-shift': ['K♣K♦', 'Q♥Q♦', 'A♥A♣', 'J♣J♦'],   // overpair / set
  'spot-skip':    ['7♣4♣', '8♦3♦', '6♣2♣', '5♥3♥'],   // pure air
  'line-change':  ['Q♣J♣', 'J♥T♣', 'T♣9♦', '8♥7♣'],   // marginal made / draw
});

// Default — used when deviationType is unrecognized.
const DEFAULT_HERO_HOLDING = ['A♠K♣', 'K♥Q♥', 'Q♣J♦'];

// ───────────────────────────────────────────────────────────────────────────
// Templates — villain range by style
// ───────────────────────────────────────────────────────────────────────────

/**
 * Style-conditioned villain ranges. Strings → 169-cell Float64Array via
 * pokerCore/rangeMatrix. Cached per style to avoid re-parsing.
 *
 * These are pre-flop archetypes meant to represent the villain's wide range
 * BEFORE postflop narrowing. The gameTreeEvaluator narrows via narrowByBoard
 * given the villainAction.
 */
const VILLAIN_RANGE_STRINGS = Object.freeze({
  Fish:    '22-JJ,A2s-AJs,K2s+,Q2s+,J2s+,T5s+,95s+,84s+,74s+,63s+,53s+,42s+,32s,A2o-AQo,K5o+,Q7o+,J7o+,T7o+,97o+,86o+,75o+,65o',
  Nit:     'TT+,AQs+,AKo',
  LAG:     '22-JJ,A2s-AJs,K7s+,Q8s+,J9s+,T8s+,98s,87s,76s,65s,A8o-AQo,KTo+,QTo+,JTo,T9o',
  TAG:     '22-JJ,A2s-AJs,KTs+,QTs+,J9s+,T9s,98s,87s,76s,ATo-AQo,KJo+,QJo,JTo',
  Unknown: '22-JJ,A2s-AJs,K9s+,Q9s+,J9s+,T9s,98s,87s,76s,65s,ATo-AQo,KTo+,QTo+,JTo',
});

const _villainRangeCache = {};

/**
 * Build a villain range from style. Cached per style; returns a copy so
 * consumers can't mutate the cache. Exported for use by the real-data
 * backtest reconstructor (Plan B / S21) which needs the same style-conditioned
 * range without re-implementing the lookup.
 */
export const villainRangeForStyle = (style) => {
  const key = VILLAIN_RANGE_STRINGS[style] ? style : 'Unknown';
  if (!_villainRangeCache[key]) {
    _villainRangeCache[key] = parseRangeString(VILLAIN_RANGE_STRINGS[key]);
  }
  // Return a copy so consumers can't mutate the cache.
  const out = createRange();
  out.set(_villainRangeCache[key]);
  return out;
};

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

/**
 * Pick the first hero holding from a candidate list whose two cards don't
 * collide with the board.
 */
const pickHeroHoldingForBoard = (candidates, boardEncoded) => {
  const boardSet = new Set(boardEncoded);
  for (const combo of candidates) {
    const c1 = parseAndEncode(combo.slice(0, 2));
    const c2 = parseAndEncode(combo.slice(2, 4));
    if (c1 < 0 || c2 < 0) continue;
    if (boardSet.has(c1) || boardSet.has(c2)) continue;
    return [c1, c2];
  }
  // Fallback — synthesize a generic AKo offsuit if nothing fits.
  const ace = encodeCard(12, 0);
  const king = encodeCard(11, 1);
  if (!boardSet.has(ace) && !boardSet.has(king)) return [ace, king];
  // Last resort — deal any two non-board cards.
  for (let r = 0; r < 13; r++) {
    for (let s = 0; s < 4; s++) {
      const c = encodeCard(r, s);
      if (!boardSet.has(c)) {
        for (let r2 = 0; r2 < 13; r2++) {
          for (let s2 = 0; s2 < 4; s2++) {
            const c2 = encodeCard(r2, s2);
            if (c2 !== c && !boardSet.has(c2)) return [c, c2];
          }
        }
      }
    }
  }
  // Theoretically unreachable.
  return [0, 1];
};

const midpointOfRange = (range, fallback) => {
  if (!Array.isArray(range) || range.length !== 2) return fallback;
  const [lo, hi] = range;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return fallback;
  return (lo + hi) / 2;
};

const normalizeStreet = (s) => {
  if (s === 'flop' || s === 'turn' || s === 'river') return s;
  return 'flop';
};

const normalizeTexture = (t) => {
  if (t === 'wet' || t === 'dry') return t;
  // 'medium', 'paired', 'monotone', 'any', null → default to 'wet'
  return 'wet';
};

const normalizeIsIP = (position) => {
  if (position === 'IP') return true;
  if (position === 'OOP') return false;
  // 'any', null → default to IP (more common in drill scope archetypes)
  return true;
};

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

/**
 * Synthesize a representative game state for a VillainAssumption.
 *
 * @param {Object} assumption    - VillainAssumption v1.1 (must have claim.scope + consequence.deviationType)
 * @param {Object} villainTendency - { style: 'Fish'|'Nit'|'LAG'|'TAG'|'Unknown' } at minimum
 * @param {Object} [opts={}]
 * @returns {Object} {
 *   heroCards, board, villainRange, potSize, villainBet, villainAction,
 *   isIP, effectiveStack, street, numOpponents,
 *   synthesized: true, templateId
 * }
 */
export const synthesizeNodeFromAssumption = (assumption, villainTendency = {}, opts = {}) => {
  if (!assumption || typeof assumption !== 'object') {
    throw new Error('synthesizeNodeFromAssumption: assumption is required');
  }
  const scope = assumption.claim?.scope;
  if (!scope) {
    throw new Error('synthesizeNodeFromAssumption: assumption.claim.scope is required');
  }

  const street = normalizeStreet(scope.street);
  const texture = normalizeTexture(scope.texture);
  const isIP = normalizeIsIP(scope.position);
  const style = villainTendency.style || 'Unknown';
  const deviationType = assumption.consequence?.deviationType;

  // Board template lookup with fallback
  const boardTemplate = BOARD_TEMPLATES[texture]?.[street]
    ?? BOARD_TEMPLATES.wet[street];
  const boardEncoded = boardTemplate.map(parseAndEncode);

  // Hero holding — choose by deviation type, ensure no board collision
  const holdingCandidates = HERO_HOLDING_BY_DEVIATION[deviationType] ?? DEFAULT_HERO_HOLDING;
  const heroCards = pickHeroHoldingForBoard(holdingCandidates, boardEncoded);

  // Villain range — style-conditioned
  const villainRange = villainRangeForStyle(style);

  // Pot + bet — derived from scope ranges (midpoint), with sane defaults.
  // Use small defaults consistent with single-raised-pot live cash baselines.
  const sprMid = midpointOfRange(scope.sprRange, 4);  // SPR ~4 = mid-range
  const betFraction = midpointOfRange(scope.betSizeRange, 0.66); // 2/3 pot default

  // Pot sizing convention: pot expressed in big blinds.
  // Single-raised-pot baseline ≈ 6bb; 3bp ≈ 22bb. Pick by deviation type:
  //   range-bet (cbet) → SRP-sized pot; bluff-prune (river) → larger from prior streets.
  let potSize;
  if (street === 'river') potSize = 22;
  else if (street === 'turn') potSize = 14;
  else potSize = 6; // flop default
  const effectiveStack = Math.max(potSize * sprMid, 0);

  // VillainAction: encode the situation hero faces.
  // For range-bet/value-expand → villain is checking (hero acts).
  // For bluff-prune → hero is barreling (villain checks); but the gameTree
  // models the node from villain's perspective only if villainBet > 0.
  // Keep simple: villain checks when hero-aggressor, villain bets otherwise.
  const heroIsAggressor = (deviationType === 'bluff-prune'
    || deviationType === 'value-expand'
    || deviationType === 'range-bet'
    || deviationType === 'sizing-shift');
  const villainAction = heroIsAggressor ? 'check' : 'bet';
  const villainBet = villainAction === 'bet' ? potSize * betFraction : 0;

  const templateId = `${street}-${texture}-${isIP ? 'IP' : 'OOP'}-${deviationType ?? 'unknown'}`;

  return {
    heroCards,
    board: boardEncoded,
    villainRange,
    potSize,
    villainBet,
    villainAction,
    isIP,
    effectiveStack,
    street,
    numOpponents: 1,
    synthesized: true,
    templateId,
    // Display fields (for UI disclosure)
    display: {
      board: [...boardTemplate],
      texture,
      position: isIP ? 'IP' : 'OOP',
      style,
      street,
    },
  };
};

// Exposed for tests + debugging only.
export const __TEST_ONLY__ = Object.freeze({
  BOARD_TEMPLATES,
  HERO_HOLDING_BY_DEVIATION,
  VILLAIN_RANGE_STRINGS,
});
