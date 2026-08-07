/**
 * allInEquity.js — all-in EV adjustment for a single hand.
 *
 * Pure. No persistence, no React, no RNG.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS FOR
 * ---------------------------------------------------------------------------
 * A win rate measured over a few dozen sessions is mostly noise (POKER_THEORY
 * §1.2 — EV is the average over infinite repetitions; a sample is not that).
 * When the money goes in and the cards are on their backs, the *result* is a
 * coin-flip resolution but the *equity* is known exactly. Replacing the realized
 * outcome with the equity-weighted expectation removes that particular slice of
 * variance and converges faster on the true rate.
 *
 * ---------------------------------------------------------------------------
 * WHY IT IS MECHANICAL, AND WHY THAT MATTERS
 * ---------------------------------------------------------------------------
 * The founder's first instinct was to tag hands he felt he won or lost to luck.
 * That is asymmetric in practice — bad beats get remembered and logged, suckouts
 * do not — so it would drift the rate upward and call the result rigorous. This
 * module never asks anyone's opinion: it reads the all-in flag the hand already
 * carries, computes equity from the cards, and corrects hero's suckouts exactly
 * as hard as hero's bad beats.
 *
 * ---------------------------------------------------------------------------
 * THE LIMIT, STATED PLAINLY
 * ---------------------------------------------------------------------------
 * This removes variance ONLY from all-in pots. A cooler paid off on the river
 * with chips behind is untouched, as is every fold-equity swing. It narrows the
 * interval; it does not collapse it. Any figure derived here is *modelled* per
 * POKER_THEORY §14.4 and must be displayed as such.
 *
 * @see src/utils/sequenceUtils.js — `allIn` lives on the action entry
 * @see src/utils/pokerCore/monteCarloEquity.js — exactComboEquity
 */

import { parseAndEncode, parseBoard, getCardsForStreet } from '../pokerCore/cardParser';
import { exactComboEquity } from '../pokerCore/monteCarloEquity';
import { computeHandVsHand } from '../pokerCore/preflopEquity';
import { calculatePot, parseBlinds, estimateRake } from '../potCalculator';
import { ACTIONS } from '../../constants/gameConstants';
import { PRIMITIVE_ACTIONS } from '../../constants/primitiveActions';

/**
 * Why a hand contributes no adjustment. Every rejection is named — a silent
 * `null` would make "we couldn't compute this" indistinguishable from
 * "this hand was exactly as expected", and the coverage count would lie.
 */
export const INELIGIBLE = {
  NO_ALL_IN: 'no-all-in',
  HERO_NOT_IN: 'hero-not-involved',
  HERO_FOLDED: 'hero-folded',
  MULTIWAY: 'multiway-all-in',
  NO_VILLAIN: 'no-villain-contesting',
  VILLAIN_CARDS_UNKNOWN: 'villain-cards-unknown',
  HERO_CARDS_UNKNOWN: 'hero-cards-unknown',
  BOARD_INCOMPLETE: 'board-incomplete',
  BAD_CARDS: 'unparseable-cards',
};

const FOLD_ACTIONS = new Set([
  ACTIONS.FOLD, ACTIONS.FOLD_TO_CR, ACTIONS.FOLD_TO_CBET, ACTIONS.MUCKED,
  PRIMITIVE_ACTIONS.FOLD,
]);

const RANK_CHARS = '23456789TJQKA';

const ineligible = (reason) => ({
  eligible: false,
  reason,
  equity: null,
  realizedShare: null,
  pot: null,
  delta: 0,
});

/**
 * Two encoded cards → hand-class notation ("AKs", "QQ", "T9o").
 *
 * Used only on the preflop path, where the available exact solver takes classes
 * rather than combos.
 *
 * @param {number[]} cards - two encoded cards
 * @returns {string|null}
 */
export const toHandClass = (cards) => {
  if (!Array.isArray(cards) || cards.length !== 2) return null;
  const [a, b] = cards;
  const rA = a >> 2;
  const rB = b >> 2;
  const suited = (a & 3) === (b & 3);
  const hi = Math.max(rA, rB);
  const lo = Math.min(rA, rB);
  const hiC = RANK_CHARS[hi];
  const loC = RANK_CHARS[lo];
  if (hi === lo) return `${hiC}${loC}`;
  return `${hiC}${loC}${suited ? 's' : 'o'}`;
};

/**
 * Seats still contesting the pot at a given point in the action sequence.
 *
 * A seat is out once it folds or mucks, whenever that happened. Folds *after*
 * the all-in still count as out — a player who folds to a shove is not
 * contesting it.
 *
 * @param {Array<Object>} actionSequence
 * @returns {Set<number>} seats that never folded
 */
export const contestingSeats = (actionSequence = []) => {
  const acted = new Set();
  const folded = new Set();
  for (const entry of actionSequence) {
    if (!entry || typeof entry.seat !== 'number') continue;
    acted.add(entry.seat);
    if (FOLD_ACTIONS.has(entry.action)) folded.add(entry.seat);
  }
  for (const seat of folded) acted.delete(seat);
  return acted;
};

/**
 * The first action entry where a seat committed its last chips.
 * @param {Array<Object>} actionSequence
 * @returns {Object|null}
 */
export const findAllInEntry = (actionSequence = []) =>
  actionSequence.find((entry) => entry && entry.allIn === true) || null;

/**
 * All-in EV adjustment for one hand.
 *
 * @param {Object} hand - stored hand record ({ gameState, cardState, ... })
 * @param {Object} [options]
 * @param {Object} [options.rakeConfig] - { pct, cap, noFlopNoDrop } from GAME_TYPES
 * @param {string} [options.gameType] - e.g. "1/3", used to derive blinds
 * @returns {{
 *   eligible: boolean, reason: string|null, equity: number|null,
 *   realizedShare: number|null, pot: number|null, delta: number,
 *   street: string|null, equitySource: 'exact'|'preflop-class'|null, modelled: true
 * }}
 */
export const computeAllInAdjustment = (hand, options = {}) => {
  const gameState = hand?.gameState;
  const cardState = hand?.cardState;
  if (!gameState || !cardState) return { ...ineligible(INELIGIBLE.NO_ALL_IN), modelled: true };

  const actionSequence = gameState.actionSequence || [];
  const allInEntry = findAllInEntry(actionSequence);
  if (!allInEntry) return { ...ineligible(INELIGIBLE.NO_ALL_IN), modelled: true };

  const heroSeat = gameState.mySeat;
  const live = contestingSeats(actionSequence);

  if (!live.has(heroSeat)) {
    // Either hero never acted, or hero folded — in both cases hero's result is
    // not an all-in coin flip and nothing should be adjusted.
    const heroActed = actionSequence.some((e) => e && e.seat === heroSeat);
    return {
      ...ineligible(heroActed ? INELIGIBLE.HERO_FOLDED : INELIGIBLE.HERO_NOT_IN),
      modelled: true,
    };
  }

  const villains = [...live].filter((seat) => seat !== heroSeat);
  if (villains.length === 0) return { ...ineligible(INELIGIBLE.NO_VILLAIN), modelled: true };
  // Multiway all-ins split into side pots with different equities per pot.
  // v1 declines rather than computing a number that looks right and isn't.
  if (villains.length > 1) return { ...ineligible(INELIGIBLE.MULTIWAY), modelled: true };

  const villainSeat = villains[0];
  const villainCards = cardState.allPlayerCards?.[villainSeat];
  if (!Array.isArray(villainCards) || villainCards.filter(Boolean).length !== 2) {
    return { ...ineligible(INELIGIBLE.VILLAIN_CARDS_UNKNOWN), modelled: true };
  }
  const heroCardStrings = (cardState.holeCards || []).filter(Boolean);
  if (heroCardStrings.length !== 2) {
    return { ...ineligible(INELIGIBLE.HERO_CARDS_UNKNOWN), modelled: true };
  }

  // The realized outcome is read off the finished board, so the hand must have
  // run out. Without five cards there is nothing to compare the equity against.
  const fullBoard = parseBoard(cardState.communityCards || []);
  if (fullBoard.length !== 5) {
    return { ...ineligible(INELIGIBLE.BOARD_INCOMPLETE), modelled: true };
  }

  let hero;
  let villain;
  let boardAtAllIn;
  try {
    hero = heroCardStrings.map(parseAndEncode);
    villain = villainCards.map(parseAndEncode);
    // Board as it stood when the chips went in — NOT the finished board. Equity
    // is a function of information available at that moment.
    boardAtAllIn = parseBoard(getCardsForStreet(cardState.communityCards || [], allInEntry.street));
  } catch {
    return { ...ineligible(INELIGIBLE.BAD_CARDS), modelled: true };
  }
  // `parseAndEncode` signals "unparseable" with -1, which IS an integer — so the
  // guard has to be on the range, not the type. Letting a -1 through would feed
  // a nonsense card into the evaluator and produce a confident wrong equity.
  if (hero.some((c) => !(c >= 0)) || villain.some((c) => !(c >= 0))) {
    return { ...ineligible(INELIGIBLE.BAD_CARDS), modelled: true };
  }

  let equity;
  let equitySource;
  if (boardAtAllIn.length === 0) {
    // Preflop shove. The exact solver here works on hand CLASSES, so this branch
    // ignores suit blockers between the two holdings (AhKh vs QhQd is not quite
    // AhKh vs QsQd). The error is well under a percentage point, but it is real —
    // hence the separate `equitySource` so callers never claim it is exact.
    const heroClass = toHandClass(hero);
    const villainClass = toHandClass(villain);
    if (!heroClass || !villainClass) {
      return { ...ineligible(INELIGIBLE.BAD_CARDS), modelled: true };
    }
    equity = computeHandVsHand(heroClass, villainClass).equity;
    equitySource = 'preflop-class';
  } else {
    equity = exactComboEquity(hero, villain, boardAtAllIn);
    equitySource = 'exact';
  }
  if (!Number.isFinite(equity)) {
    // NaN means the matchup is illegal — a shared card between the two holdings
    // or with the board. That is bad data, not a zero-equity spot.
    return { ...ineligible(INELIGIBLE.BAD_CARDS), modelled: true };
  }

  // Realized share comes from the SAME function on the finished board, where it
  // resolves to exactly 1 (won), 0 (lost) or 0.5 (chop). Deriving it from the
  // cards rather than from a recorded WON action means the adjustment does not
  // depend on whether the founder remembered to tap the winner.
  const realizedShare = exactComboEquity(hero, villain, fullBoard);
  if (!Number.isFinite(realizedShare)) {
    return { ...ineligible(INELIGIBLE.BAD_CARDS), modelled: true };
  }

  const blinds = parseBlinds(options.gameType);
  // calculatePot returns { total, currentBet, isEstimated } — not a scalar.
  const grossPot = calculatePot(actionSequence, blinds)?.total ?? 0;
  const rake = options.rakeConfig
    ? estimateRake(grossPot, options.rakeConfig, allInEntry.street)
    : 0;
  const pot = Math.max(0, grossPot - rake);

  // Hero's own contribution is identical under both outcomes, so it cancels:
  //   realized = realizedShare × pot − contribution
  //   expected = equity        × pot − contribution
  //   delta    = (equity − realizedShare) × pot
  const delta = (equity - realizedShare) * pot;

  return {
    eligible: true,
    reason: null,
    equity,
    realizedShare,
    pot,
    delta,
    street: allInEntry.street,
    equitySource,
    modelled: true,
  };
};

/**
 * Aggregate the adjustment across a session's hands.
 *
 * Returns a delta to layer on top of the session's realized P&L — the session
 * total (`cashOut − buyIn − rebuys`) stays authoritative and is never recomputed
 * from hands, which would introduce a second, disagreeing source of truth.
 *
 * @param {Array<Object>} hands
 * @param {Object} [options] - { gameType, rakeConfig }
 * @returns {{delta:number, adjustedHands:number, totalHands:number,
 *   reasons:Object<string,number>, modelled:true}}
 */
export const computeSessionAdjustment = (hands = [], options = {}) => {
  const list = Array.isArray(hands) ? hands : [];
  let delta = 0;
  let adjustedHands = 0;
  const reasons = {};

  for (const hand of list) {
    const result = computeAllInAdjustment(hand, options);
    if (result.eligible) {
      delta += result.delta;
      adjustedHands += 1;
    } else if (result.reason) {
      reasons[result.reason] = (reasons[result.reason] || 0) + 1;
    }
  }

  return { delta, adjustedHands, totalHands: list.length, reasons, modelled: true };
};

export default computeAllInAdjustment;
