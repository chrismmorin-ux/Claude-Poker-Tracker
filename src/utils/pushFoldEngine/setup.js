/**
 * setup.js — pure assessment of a push/fold spot from game state.
 *
 * Extracted from usePushFold so the integration logic (effective stack,
 * facing-a-shove detection, ICM-context assembly) is testable without React.
 * Returns null when there is no push/fold spot (not short, no chips, etc.).
 */

import { hasSeatFolded, isSeatAllIn } from '../sequenceUtils';
import { getRangePositionCategory } from '../positionUtils';
import { buildIcmStacks } from '../icmEngine';
import { effectiveStackBB, isPushFoldDepth } from './effectiveStack';

const SEATS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * @param {Object} p
 * @param {Object} p.chipStacks
 * @param {number} p.mySeat
 * @param {Array} p.actionSequence
 * @param {number} p.bb
 * @param {number[]} [p.payouts]
 * @param {number|null} [p.playersRemaining]
 * @param {number|null} [p.totalChips]
 * @param {number} [p.dealerSeat]
 * @returns {null | { facingShove, villainSeat, effBB, heroChips, opponents:number[], icm, position }}
 */
export const assessPushFoldSetup = ({
  chipStacks, mySeat, actionSequence, bb, payouts, playersRemaining, totalChips, dealerSeat,
}) => {
  if (!chipStacks || !bb || bb <= 0) return null;
  const heroChips = chipStacks[mySeat];
  if (heroChips == null || heroChips <= 0) return null;

  const folded = new Set(SEATS.filter(s => hasSeatFolded(actionSequence, s)));
  const opponents = SEATS.filter(s => s !== mySeat && !folded.has(s) && chipStacks[s] > 0);
  if (opponents.length === 0) return null;

  const shoverSeat = opponents.find(s => isSeatAllIn(actionSequence, s));
  const facingShove = shoverSeat != null;

  const villainSeat = facingShove
    ? shoverSeat
    : opponents.reduce((best, s) => (chipStacks[s] > (chipStacks[best] ?? -1) ? s : best), opponents[0]);
  if (villainSeat == null) return null;

  const effBB = facingShove
    ? effectiveStackBB(heroChips, chipStacks[villainSeat], bb)
    : heroChips / bb; // jam the whole stack first-in
  if (!isPushFoldDepth(effBB)) return null;

  let icm = null;
  if (Array.isArray(payouts) && payouts.length > 0) {
    const built = buildIcmStacks({ chipStacks, mySeat, playersRemaining, totalChips });
    if (built && !built.tooLarge && built.heroIndex >= 0) {
      const villainIndex = built.seats.indexOf(villainSeat);
      if (villainIndex >= 0) {
        icm = {
          stacks: built.stacks, heroIndex: built.heroIndex, villainIndex,
          payouts, isApproximate: built.isApproximate,
        };
      }
    }
  }

  return {
    facingShove,
    villainSeat,
    effBB,
    heroChips,
    opponents,
    icm,
    position: getRangePositionCategory(mySeat, dealerSeat || 1),
  };
};
