/**
 * decisionGeometry.mjs — pot, faced bet, and live-opponent count at a decision node.
 *
 * Small on purpose, and shared on purpose (WS-287). Three consumers need this geometry:
 * the behaviour-policy miner (to key propensities by bet sizing), the hero policy (to
 * feed the engine), and the scoring pass (to slice results). Deriving it three times
 * would be three chances to disagree about what "the pot" means at a node — and the pot
 * convention is one of the details that silently corrupts every downstream number if it
 * drifts.
 *
 * This module deliberately imports no engine code, so the miner can use it without
 * paying for the game tree.
 */

import { PRIMITIVE_ACTIONS } from '../../src/constants/primitiveActions.js';

/**
 * The live bet this seat is answering, as a TOTAL street commitment in chips.
 *
 * "Total street commitment" is the corpus's own convention for BET/RAISE amounts
 * (`raise to`, not the increment), and it matches the app's `villainBet`.
 */
export const facedBetChips = (hand, order, street) => {
  let faced = null;
  for (const e of hand.gameState.actionSequence) {
    if (e.order >= order) break;
    if (e.street !== street) continue;
    if (e.action === PRIMITIVE_ACTIONS.BET || e.action === PRIMITIVE_ACTIONS.RAISE) {
      faced = e.amount;
    }
  }
  return Number.isFinite(faced) ? faced : 0;
};

/**
 * Pot geometry at a decision, in big blinds.
 *
 * `potBB` INCLUDES the bet hero is facing — that is how the corpus pot accumulates.
 * The engine wants it excluded (it re-adds `villainBet` internally), which is what
 * `enginePotChips` below is for. Keeping both explicit, with the difference named, is
 * the whole point of putting this in one place.
 */
export const decisionGeometry = (hand, order, street) => {
  const bt = hand._backtest;
  const bb = Number(bt?.bb);
  const potChips = bt?.potBeforeByOrder?.[order];
  if (!Number.isFinite(bb) || bb <= 0 || !Number.isFinite(potChips)) return null;

  const betChips = facedBetChips(hand, order, street);
  return {
    bb,
    potChips,
    betChips,
    potBB: potChips / bb,
    facingBetBB: betChips / bb,
    // Pot EXCLUDING the live bet — the value `evaluateGameTree` expects as `potSize`.
    enginePotChips: Math.max(0, potChips - betChips),
    stackChips: bt?.stackBeforeByOrder?.[order] ?? null,
  };
};

/**
 * Bet size as a fraction of the pot, on the WS-262 mining boundaries.
 *
 * Duplicated deliberately from `runner.sizeBucketFor` rather than imported: importing
 * would pull the whole villain-prediction runner (and the engine behind it) into the
 * miner. The boundaries are asserted identical by test.
 */
export const sizeBucketFor = (betBB, potBB) => {
  if (!Number.isFinite(betBB) || !Number.isFinite(potBB) || potBB <= 0) return 'unknown';
  const frac = betBB / potBB;
  if (frac < 0.33) return '0-33';
  if (frac < 0.66) return '33-66';
  if (frac < 1.0) return '66-100';
  if (frac < 1.5) return '100-150';
  return '150+';
};

/**
 * Opponents still live and not hero at this point in the hand.
 *
 * Opponent count drives the multiway terms of the decision spine — fold-through
 * compounds (POKER_THEORY 6.1) and the value threshold rises as 0.5^(1/k) (6.4) — so
 * defaulting this to 1 would score a heads-up engine on multiway pots, which is the
 * exact defect WS-277 exists for.
 */
export const liveOpponentCount = (hand, order, heroSeat) => {
  const folded = new Set();
  for (const e of hand.gameState.actionSequence) {
    if (e.order >= order) break;
    if (e.action === PRIMITIVE_ACTIONS.FOLD) folded.add(String(e.seat));
  }
  let n = 0;
  for (const seat of Object.keys(hand.seatPlayers)) {
    if (String(seat) === String(heroSeat)) continue;
    if (!folded.has(String(seat))) n++;
  }
  return n;
};
