/**
 * riskPremium.js — ICM risk premium / bubble factor (POKER_THEORY.md §10.3).
 *
 * The risk premium is how much MORE raw equity hero needs than chip-EV pot odds
 * suggest before an all-in is +$EV. It is DERIVED from ICM (never a label):
 * compare hero's $EV now vs the two outcomes of the gamble.
 *
 *   requiredEquity (ICM) = (heroNow − heroLose) / (heroWin − heroLose)
 *   bubbleFactor         = (heroNow − heroLose) / (heroWin − heroNow)
 *
 * bubbleFactor = 1 → chips ≈ dollars (no premium). > 1 → losing costs more $EV
 * than winning gains, so you need extra equity (rises near the bubble / pay jumps).
 */

import { computeIcmEquity } from './malmuthHarville';

const cloneWithTransfer = (stacks, heroIndex, villainIndex, heroDelta, villainDelta) => {
  const next = stacks.slice();
  next[heroIndex] = Math.max(0, next[heroIndex] + heroDelta);
  if (villainIndex != null && villainIndex >= 0 && villainIndex < next.length) {
    next[villainIndex] = Math.max(0, next[villainIndex] + villainDelta);
  }
  return next;
};

/**
 * Risk premium / bubble factor for hero risking `riskChips` against `villainIndex`.
 *
 * @param {number[]} stacks
 * @param {number} heroIndex
 * @param {number[]} payouts
 * @param {Object} opts
 * @param {number} opts.villainIndex  - the opponent whose chips are contested
 * @param {number} opts.riskChips     - chips hero puts at risk (effective all-in amount)
 * @param {number} [opts.winChips]    - chips hero wins if they win (defaults to riskChips)
 * @returns {{
 *   heroNow: number, heroWin: number, heroLose: number,
 *   requiredEquity: number|null, bubbleFactor: number|null
 * }}
 */
export const computeRiskPremium = (stacks, heroIndex, payouts, opts = {}) => {
  const { villainIndex, riskChips, winChips } = opts;
  const gain = (winChips != null ? winChips : riskChips) || 0;
  const risk = riskChips || 0;

  const heroNow = computeIcmEquity(stacks, payouts)[heroIndex] ?? 0;

  // Win: hero gains `gain` chips from villain. Lose: hero loses `risk` chips to villain.
  const winStacks = cloneWithTransfer(stacks, heroIndex, villainIndex, gain, -gain);
  const loseStacks = cloneWithTransfer(stacks, heroIndex, villainIndex, -risk, risk);

  const heroWin = computeIcmEquity(winStacks, payouts)[heroIndex] ?? 0;
  const heroLose = computeIcmEquity(loseStacks, payouts)[heroIndex] ?? 0;

  const spread = heroWin - heroLose;
  const upside = heroWin - heroNow;

  return {
    heroNow,
    heroWin,
    heroLose,
    // Equity needed for the all-in to break even in $EV (vs chip-EV pot odds).
    requiredEquity: spread > 1e-9 ? Math.min(1, Math.max(0, (heroNow - heroLose) / spread)) : null,
    // > 1 means a real risk premium; null when there's no upside to model.
    bubbleFactor: upside > 1e-9 ? Math.max(0, (heroNow - heroLose) / upside) : null,
  };
};

/**
 * Representative hero ICM pressure for display: hero shoves/calls for their
 * effective stack against the chip leader. Consumers (all-in verdict, push/fold)
 * call computeRiskPremium directly with the real opponent + amounts.
 *
 * @param {number[]} stacks
 * @param {number} heroIndex
 * @param {number[]} payouts
 * @returns {{ bubbleFactor: number|null, requiredEquity: number|null, villainIndex: number|null }}
 */
export const computeHeroPressure = (stacks, heroIndex, payouts) => {
  if (!Array.isArray(stacks) || heroIndex < 0 || heroIndex >= stacks.length) {
    return { bubbleFactor: null, requiredEquity: null, villainIndex: null };
  }
  // Largest opponent = the chip leader hero would gamble against.
  let villainIndex = -1;
  let villainStack = -1;
  for (let i = 0; i < stacks.length; i++) {
    if (i === heroIndex) continue;
    if (stacks[i] > villainStack) { villainStack = stacks[i]; villainIndex = i; }
  }
  if (villainIndex < 0) return { bubbleFactor: null, requiredEquity: null, villainIndex: null };

  // Effective stack at risk = min(hero, villain).
  const riskChips = Math.min(stacks[heroIndex], stacks[villainIndex]);
  const { bubbleFactor, requiredEquity } = computeRiskPremium(stacks, heroIndex, payouts, {
    villainIndex, riskChips,
  });
  return { bubbleFactor, requiredEquity, villainIndex };
};
