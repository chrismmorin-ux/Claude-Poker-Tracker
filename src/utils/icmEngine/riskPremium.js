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

/**
 * ICM tax on a chip-EV decision for a COMMITTED (effectively all-in) spot.
 *
 * The risk premium says hero needs more raw equity than chip-EV pot odds suggest
 * before a gamble is +$EV. For a committed stack-off (chips won ≈ chips risked, the
 * symmetric case), the ICM-correct ordering is reproduced by discounting the loss
 * side of chip-EV by the bubble factor β:
 *
 *   icmAdjustedEV = chipEV − (β − 1) · P(lose) · riskChips
 *
 * This makes the break-even equity equal `requiredEquity = β/(1+β)` — the exact ICM
 * break-even (POKER_THEORY §10.3/§10.4). The form is exact ONLY when winChips ≈
 * riskChips, so callers MUST gate this to committed/all-in spots; partial-pot bets
 * (winChips ≠ riskChips) need the per-spot `computeRiskPremium` treatment and are
 * out of scope here.
 *
 * β is DERIVED per spot via `computeRiskPremium` (never a label, §10.3). Returns the
 * non-negative chip-EV penalty to SUBTRACT from the action's chip-EV. Returns 0
 * (identity) when there is no ICM pressure — so cash games and pay-structure-locked
 * spots are unaffected.
 *
 * @param {Object} opts
 * @param {number[]} opts.stacks      - chip stacks of the modeled field
 * @param {number} opts.heroIndex     - hero's index in `stacks`
 * @param {number[]} opts.payouts     - payout ladder
 * @param {number} opts.villainIndex  - the contesting opponent's index in `stacks`
 * @param {number} opts.riskChips     - hero's committed (at-risk) chips, net of rake
 * @param {number} opts.pLose         - probability hero loses those chips (0-1)
 * @returns {number} chip-EV penalty to subtract (>= 0)
 */
export const computeCommittedIcmTax = ({
  stacks, heroIndex, payouts, villainIndex, riskChips, pLose,
} = {}) => {
  if (!Array.isArray(stacks) || !Array.isArray(payouts)) return 0;
  if (heroIndex == null || heroIndex < 0 || heroIndex >= stacks.length) return 0;
  if (villainIndex == null || villainIndex < 0 || villainIndex >= stacks.length) return 0;
  if (!(riskChips > 0) || !(pLose > 0)) return 0;

  // Committed/symmetric: chips won ≈ chips risked.
  const { bubbleFactor } = computeRiskPremium(stacks, heroIndex, payouts, {
    villainIndex, riskChips, winChips: riskChips,
  });
  // β can legitimately equal 1 when the pay structure behind hero is locked
  // (chips ≈ dollars) → no premium → identity. Guard is `<= 1`, not `< 1`.
  if (bubbleFactor == null || bubbleFactor <= 1) return 0;

  return (bubbleFactor - 1) * pLose * riskChips;
};
