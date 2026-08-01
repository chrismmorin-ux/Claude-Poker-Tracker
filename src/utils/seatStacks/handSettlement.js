/**
 * handSettlement.js — turn a finished hand into stack-ledger carry-forward inputs
 *
 * Surface spec: docs/design/surfaces/seat-stack-ledger.md
 *
 * Sits between the action record and the ledger so `gameReducer` stays thin and
 * the arithmetic stays testable without a reducer harness.
 *
 * Everything here DERIVES from `actionSequence`, which is already the single
 * source of truth for actions, and from `calculateSidePots`, which is already the
 * single source of truth for how committed chips partition into pots. No second
 * definition of either is introduced — the INV-POT-CONSERVATION doctrine that
 * governs pots governs these payouts by construction.
 */

import {
  calculateSidePots,
  getTotalContributions,
  estimateRake,
} from '../potCalculator';
import { getPotWinnerSeat } from '../sequenceUtils';

/**
 * What each seat put in and what each seat took out.
 *
 * RAKE. When `rakeConfig` is supplied the winner receives the pot net of rake,
 * because that is what actually lands in front of them. When it is not, payouts
 * are gross and carried stacks drift upward by roughly the rake per pot won.
 * That drift is bounded by design rather than by accident: a carried stack goes
 * `stale` after one orbit (`STALE_AFTER_HANDS`), so accumulated rake error can
 * never exceed about one orbit's worth before the value stops being admissible
 * at all. Supplying rakeConfig tightens it; omitting it is safe, not silent.
 *
 * @param {Array} actionSequence
 * @param {{sb: number, bb: number}} blinds
 * @param {object} [opts]
 * @param {number} [opts.smallBlindSeat]
 * @param {number} [opts.bigBlindSeat]
 * @param {object|null} [opts.rakeConfig] — { pct, cap, noFlopNoDrop } or null
 * @param {string} [opts.street] — street the hand ended on, for no-flop-no-drop
 * @returns {{ contributions: Object, payouts: Object, estimated: boolean }}
 */
export const settleHand = (actionSequence, blinds, opts = {}) => {
  const { smallBlindSeat, bigBlindSeat, rakeConfig = null, street = 'river' } = opts;

  const contributions = getTotalContributions(
    actionSequence,
    blinds,
    smallBlindSeat,
    bigBlindSeat,
  );

  const { pots, returned, returnedSeat, isEstimated } = calculateSidePots(
    actionSequence,
    blinds,
    { smallBlindSeat, bigBlindSeat },
  );

  const payouts = {};
  const credit = (seat, amount) => {
    if (seat === null || seat === undefined || !(amount > 0)) return;
    payouts[seat] = (payouts[seat] || 0) + amount;
  };

  // An uncalled bet is returned, not won — it never became a pot and is never
  // raked. Crediting it is what keeps chips conserved when everyone folds.
  credit(returnedSeat, returned);

  for (let index = 0; index < pots.length; index++) {
    const pot = pots[index];
    const winner = getPotWinnerSeat(actionSequence, index);
    if (winner === null || winner === undefined) continue;
    const rake = rakeConfig ? estimateRake(pot.amount, rakeConfig, street) : 0;
    credit(winner, Math.max(0, pot.amount - rake));
  }

  return { contributions, payouts, estimated: !!isEstimated };
};

/**
 * Chips each seat has committed SO FAR — used to read a stack mid-hand.
 *
 * The ledger stores START-OF-HAND stacks. A consumer asking "what does seat 4
 * have right now" wants start minus what is already in the middle, which is a
 * different question from what carry-forward answers at the end of the hand.
 *
 * @param {Array} visibleActions — actions up to the cursor (replay) or all so far (live)
 */
export const committedSoFar = (visibleActions, blinds, opts = {}) => {
  const { smallBlindSeat, bigBlindSeat } = opts;
  return getTotalContributions(visibleActions, blinds, smallBlindSeat, bigBlindSeat);
};
