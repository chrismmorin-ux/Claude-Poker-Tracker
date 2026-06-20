/**
 * effectiveStack.js — effective stack in big blinds (push/fold trigger).
 *
 * Effective stack = min(hero, the relevant villain) / bb — the amount actually
 * at risk. Read from state, never input by the user (persona rule). Returns null
 * when chips/bb are unavailable (e.g. manual cash has no stacks → no verdict).
 */

export const PUSH_FOLD_MAX_BB = 15;

/**
 * @param {number|null} heroChips
 * @param {number|null} villainChips - the relevant opponent's chips (the shover, or
 *   the chip leader for a first-in jam). Null → use hero's stack alone.
 * @param {number} bb
 * @returns {number|null} effective stack in BB
 */
export const effectiveStackBB = (heroChips, villainChips, bb) => {
  if (!bb || bb <= 0 || heroChips == null || heroChips <= 0) return null;
  const eff = (villainChips != null && villainChips > 0) ? Math.min(heroChips, villainChips) : heroChips;
  return eff / bb;
};

/** Whether a given effective stack is in push/fold territory. */
export const isPushFoldDepth = (effStackBB) =>
  effStackBB != null && effStackBB > 0 && effStackBB <= PUSH_FOLD_MAX_BB;
