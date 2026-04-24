/**
 * handStateReconstructor.js — Reconstruct engine-ready state at a target decision node (Plan B / S21)
 *
 * Part of the assumptionEngine module. See `CLAUDE.md` for rules.
 *
 * Plan B's purpose: feed REAL hand state into the engine for per-firing dividend
 * computation, so the dividend gap measured by `dividendCalibrationBacktest` reflects
 * what the engine produces against actual hands hero played — not just a representative
 * synthesized spot.
 *
 * What's REAL:
 *   - heroCards (from cardState.holeCards — always populated for hero)
 *   - board (sliced from cardState.communityCards to the node's street)
 *   - potSize (from calculatePot walking the actionSequence prefix UP TO this node)
 *   - villainBet, villainAction (the matched node entry itself)
 *   - dealer position → derives isIP / OOP
 *
 * What's DEFAULTED or SYNTHESIZED:
 *   - effectiveStack (defaults to 100×bb — no per-seat stack tracking in the data model)
 *   - villainRange (style-conditioned synthesis — actual villain holding only known at showdown)
 *
 * SKIPPED with explicit reason (engine reliability gate):
 *   - multiway (>2 active seats at the decision node)
 *   - missing hero hole cards (legacy hands)
 *   - missing communityCards for the node's street
 *   - all-in branches mid-hand (effective-stack reconstruction unreliable)
 *
 * Pure module — no async, no IO. Caller resolves blinds (via session lookup) and
 * villain tendency (via _villainSnapshot or explicit override) and passes them in.
 */

import { PRIMITIVE_ACTIONS } from '../../../constants/primitiveActions';
import { parseAndEncode, parseCard } from '../../pokerCore/cardParser';
import { villainRangeForStyle } from '../../citedDecision/baselineSynthesis';
import { createRange, rangeIndex } from '../../pokerCore/rangeMatrix';
import { analyzeBoardFromStrings } from '../../pokerCore/boardTexture';

const STREET_BOARD_COUNT = { preflop: 0, flop: 3, turn: 4, river: 5 };

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

/**
 * Encode an array of card strings to integer cards via parseAndEncode.
 * Returns null if any card fails to parse.
 */
const encodeCards = (cardStrings) => {
  if (!Array.isArray(cardStrings)) return null;
  const out = [];
  for (const s of cardStrings) {
    if (!s) return null;
    const enc = parseAndEncode(s);
    if (enc < 0) return null;
    out.push(enc);
  }
  return out;
};

/**
 * Calculate the pot at a target node by walking the actionSequence prefix.
 * Stops BEFORE applying the target node entry itself — pot is "what the
 * decision-maker faces when it's their turn."
 *
 * Mirrors potCalculator.calculatePot but with an early-exit at targetOrder.
 * Same semantics: starts with sb + bb, currentBet starts at bb on preflop.
 *
 * @returns {{ total, currentBet, isAllIn }}
 */
const calculatePotUpToNode = (actionSequence, targetOrder, blinds) => {
  const { sb, bb } = blinds || { sb: 1, bb: 2 };
  let total = sb + bb;
  let currentBet = bb;
  let currentStreet = 'preflop';
  let seatContribs = {};
  let isAllIn = false;

  if (!Array.isArray(actionSequence) || actionSequence.length === 0) {
    return { total, currentBet, isAllIn };
  }

  for (const entry of actionSequence) {
    if (entry.order >= targetOrder) break; // stop strictly before target

    if (entry.street !== currentStreet) {
      currentStreet = entry.street;
      currentBet = 0;
      seatContribs = {};
    }

    switch (entry.action) {
      case PRIMITIVE_ACTIONS.FOLD:
      case PRIMITIVE_ACTIONS.CHECK:
        break;

      case PRIMITIVE_ACTIONS.CALL: {
        if (entry.amount !== undefined) {
          total += entry.amount;
          seatContribs[entry.seat] = (seatContribs[entry.seat] || 0) + entry.amount;
        } else {
          const alreadyIn = seatContribs[entry.seat] || 0;
          const increment = Math.max(0, currentBet - alreadyIn);
          total += increment;
          seatContribs[entry.seat] = currentBet;
        }
        break;
      }

      case PRIMITIVE_ACTIONS.BET:
      case PRIMITIVE_ACTIONS.RAISE: {
        if (entry.amount !== undefined) {
          total += entry.amount;
          currentBet = entry.amount;
          seatContribs[entry.seat] = (seatContribs[entry.seat] || 0) + entry.amount;
        }
        break;
      }

      default:
        break;
    }
  }

  return { total, currentBet, isAllIn };
};

/**
 * Count seats still active (not folded) up to a target node.
 *
 * Counts seats present in actionSequence prefix; subtracts seats that folded
 * BEFORE the target order. Returns active count INCLUDING the actor about to
 * decide (since they're still in the hand).
 */
const countActiveSeats = (actionSequence, targetOrder, absentSeats = []) => {
  const allSeats = new Set();
  const folded = new Set();
  for (const seat of absentSeats) folded.add(seat); // absent treated as out

  if (!Array.isArray(actionSequence)) return 0;

  for (const entry of actionSequence) {
    if (entry.order >= targetOrder) break;
    if (Number.isInteger(entry.seat)) allSeats.add(entry.seat);
    if (entry.action === PRIMITIVE_ACTIONS.FOLD) folded.add(entry.seat);
  }

  let active = 0;
  for (const seat of allSeats) {
    if (!folded.has(seat)) active += 1;
  }
  return active;
};

/**
 * Pin villain's range to a single combo when showdown reveal is available.
 *
 * When `cardState.allPlayerCards[villainSeat]` contains two real cards (showdown
 * reached + cards revealed), the villain's actual hand is known. Replace the
 * style-synthesized 169-cell range with a single-combo Float64Array — only the
 * cell corresponding to villain's hand class has weight 1.0.
 *
 * Materially improves engine accuracy on the showdown subset of firings vs the
 * style-synthesized fallback (which spans many possible villain holdings).
 *
 * @returns {Float64Array | null} Pinned single-combo range, or null if showdown
 *                                cards are missing/unparseable.
 */
const pinVillainRangeFromShowdown = (cardState, villainSeat) => {
  const cards = cardState?.allPlayerCards?.[villainSeat];
  if (!Array.isArray(cards) || cards.length !== 2) return null;
  const [s1, s2] = cards;
  if (!s1 || !s2) return null;

  const c1 = parseCard(s1);
  const c2 = parseCard(s2);
  if (!c1 || !c2) return null;

  const suited = c1.suit === c2.suit;
  // Pair handling is automatic — rangeIndex returns the diagonal cell when ranks match.
  const idx = rangeIndex(c1.rank, c2.rank, suited);
  if (idx < 0 || idx >= 169) return null;

  const range = createRange();
  range[idx] = 1.0;
  return range;
};

/**
 * Determine if the villain (target seat) is in position relative to hero.
 *
 * Position = "acts last on later streets." On postflop streets the dealer-button
 * relative order matters: BTN acts last, then CO, then HJ, etc. Heads-up logic:
 * BTN (also SB in HU) is OOP preflop, IP postflop.
 *
 * For multiway / 9-handed cash, "in position" means the seat is closer to the
 * button (in playing order) than hero. We approximate via dealer-relative offset.
 *
 * Returns true if villain is IP relative to hero. v1 supports HU + uses simple
 * "closer to button = IP postflop" heuristic.
 */
const isVillainInPosition = ({ villainSeat, heroSeat, dealerButtonSeat, numSeats = 9 }) => {
  if (!Number.isInteger(villainSeat) || !Number.isInteger(heroSeat) || !Number.isInteger(dealerButtonSeat)) {
    return false;
  }
  // Distance from dealer (lower = closer to button = later position)
  const distFromBtn = (seat) => {
    let d = (seat - dealerButtonSeat + numSeats) % numSeats;
    if (d === 0) d = numSeats; // dealer is "0" but counts as later than everyone else
    return d;
  };
  // Lower distance from button = later position = IP
  return distFromBtn(villainSeat) > distFromBtn(heroSeat);
};

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

/**
 * Reconstruct engine-ready state at the target decision node.
 *
 * @param {Object} opts
 * @param {Object} opts.hand            — hand record from getAllHands
 * @param {Object} opts.decisionNode    — node from extractDecisionNodes:
 *                                          { handId, villainSeat, street, action, amount, texture }
 *                                        + optional `order` to disambiguate when same villainSeat acts
 *                                        multiple times on the same street (we'll use first match if absent)
 * @param {{ sb, bb }} opts.blinds      — blinds for this hand
 * @param {Object} opts.villainTendency — { style } for synthesized villain range
 * @param {Object} [opts.defaults]      — { effectiveStackBB: 100 }
 *
 * @returns {Object} reconstructed-state OR { reconstructed: false, skipped: true, reason }
 */
export const reconstructStateAtDecisionNode = ({
  hand,
  decisionNode,
  blinds,
  villainTendency = { style: 'Unknown' },
  defaults = {},
} = {}) => {
  if (!hand || !decisionNode) {
    return { reconstructed: false, skipped: true, reason: 'missing-input' };
  }

  const gs = hand.gameState;
  const cs = hand.cardState;
  if (!gs || !cs) {
    return { reconstructed: false, skipped: true, reason: 'missing-state' };
  }

  const { actionSequence, mySeat: heroSeat, dealerButtonSeat, absentSeats = [] } = gs;
  const { villainSeat, street, action: villainAct, amount: villainBetAmt } = decisionNode;
  const { sb = 1, bb = 2 } = blinds || {};
  const effectiveStackBB = Number.isFinite(defaults.effectiveStackBB) ? defaults.effectiveStackBB : 100;

  // ─── Skip-conditions ────────────────────────────────────────────────────

  // Hero hole cards must be present + parse to two real cards.
  const heroCards = encodeCards(cs.holeCards);
  if (!heroCards || heroCards.length !== 2) {
    return { reconstructed: false, skipped: true, reason: 'missing-hero-cards' };
  }

  // Board must have enough cards for the node's street.
  const boardCount = STREET_BOARD_COUNT[street];
  if (!Number.isInteger(boardCount) || boardCount < 3) {
    return { reconstructed: false, skipped: true, reason: 'preflop-or-unknown-street' };
  }
  const boardStrings = (cs.communityCards || []).slice(0, boardCount).filter(Boolean);
  if (boardStrings.length !== boardCount) {
    return { reconstructed: false, skipped: true, reason: 'missing-board' };
  }
  const board = encodeCards(boardStrings);
  if (!board) {
    return { reconstructed: false, skipped: true, reason: 'invalid-board' };
  }

  // Locate the target order — first matching (villainSeat, street, action) entry.
  // Decision nodes from extractDecisionNodes don't carry `order`, so we do this
  // here. If decisionNode.order is provided, prefer it.
  let targetOrder = decisionNode.order;
  if (!Number.isInteger(targetOrder)) {
    if (!Array.isArray(actionSequence)) {
      return { reconstructed: false, skipped: true, reason: 'missing-action-sequence' };
    }
    const match = actionSequence.find(
      (e) => e.seat === villainSeat && e.street === street && e.action === villainAct,
    );
    if (!match) {
      return { reconstructed: false, skipped: true, reason: 'node-not-in-sequence' };
    }
    targetOrder = match.order;
  }

  // Multiway gate: only HU is supported by v1.
  const activeAtNode = countActiveSeats(actionSequence, targetOrder, absentSeats);
  if (activeAtNode > 2) {
    return { reconstructed: false, skipped: true, reason: 'multiway' };
  }

  // ─── Reconstruct ────────────────────────────────────────────────────────

  // Pot at the moment of the decision (before villain's action).
  const { total: potSize, isAllIn } = calculatePotUpToNode(actionSequence, targetOrder, { sb, bb });
  if (isAllIn) {
    // Reserved for future when isAllIn detection is more precise.
    return { reconstructed: false, skipped: true, reason: 'all-in' };
  }

  // Villain bet — from the matched node entry itself.
  const villainBet = (villainAct === PRIMITIVE_ACTIONS.BET || villainAct === PRIMITIVE_ACTIONS.RAISE)
    ? (Number.isFinite(villainBetAmt) ? villainBetAmt : 0)
    : 0;

  // Villain action mapped to the engine's vocabulary.
  // gameTreeEvaluator expects 'bet' | 'check' | 'raise' | (none for hero-aggressor).
  let villainAction;
  if (villainAct === PRIMITIVE_ACTIONS.BET) villainAction = 'bet';
  else if (villainAct === PRIMITIVE_ACTIONS.RAISE) villainAction = 'raise';
  else if (villainAct === PRIMITIVE_ACTIONS.CHECK) villainAction = 'check';
  else if (villainAct === PRIMITIVE_ACTIONS.CALL) villainAction = 'call';
  else villainAction = villainAct;

  // Position
  const isIP = !isVillainInPosition({ villainSeat, heroSeat, dealerButtonSeat });
  // Note: function returns whether VILLAIN is IP. Hero IP = villain OOP. So we
  // negate to get hero's perspective for the engine.

  // Effective stack (defaulted)
  const effectiveStack = effectiveStackBB * bb;

  // Villain range — pin to showdown-revealed combo when available; else fall back
  // to style-synthesized 169-cell range. Pinning materially improves engine
  // accuracy for the showdown subset of firings.
  const pinnedRange = pinVillainRangeFromShowdown(cs, villainSeat);
  const villainRange = pinnedRange ?? villainRangeForStyle(villainTendency.style ?? 'Unknown');
  const villainRangeSource = pinnedRange ? 'showdown-pinned' : 'style-synthesized';
  const villainShowdownCards = pinnedRange ? cs.allPlayerCards[villainSeat] : null;

  // Texture for display
  const analysis = analyzeBoardFromStrings(boardStrings);
  const texture = analysis?.texture ?? 'medium';

  return {
    reconstructed: true,
    source: 'real-board-pot',
    heroCards,
    board,
    villainRange,
    villainRangeSource,
    villainShowdownCards,
    potSize,
    villainBet,
    villainAction,
    isIP,
    effectiveStack,
    street,
    numOpponents: 1,
    // Display info for diagnostic UI
    display: {
      board: boardStrings,
      texture,
      position: isIP ? 'IP' : 'OOP',
      style: villainTendency.style ?? 'Unknown',
      street,
      villainRangeSource,
      villainShowdownCards,
    },
  };
};

// Exposed for tests
export const __TEST_ONLY__ = Object.freeze({
  encodeCards,
  calculatePotUpToNode,
  countActiveSeats,
  isVillainInPosition,
  pinVillainRangeFromShowdown,
  STREET_BOARD_COUNT,
});
