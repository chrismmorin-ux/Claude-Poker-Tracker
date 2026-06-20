/**
 * pushFold.js — short-stack push/fold verdict ($EV decision, POKER_THEORY §10.4).
 *
 * Binary verdict (no mixed strategies — persona rule), computed from first
 * principles, NOT a hardcoded chart and NOT an M-ratio label (§10.3/§10.5):
 *
 *  - CALL vs a shove (rigorous): hero calls when equity-vs-shover-range ≥ the
 *    required equity. Required equity = chip-EV pot odds, ICM-adjusted upward
 *    via computeRiskPremium when a payout ladder exists.
 *  - SHOVE first-in: $EV jam = foldEq·(win the dead pot) + (1−foldEq)·(ICM EV
 *    of the all-in showdown). Chip-EV when no payouts. Fold equity + the villain
 *    calling range come from population priors (assembled by the caller) — the
 *    one documented approximation; the call case is exact.
 *
 * Equity (heroEq) is computed by the caller (handVsRange / equity worker) and
 * passed in — keeps this module pure and testable.
 */

import { computeRiskPremium, computeIcmEquity } from '../icmEngine';

const pct = (x) => `${Math.round((x ?? 0) * 100)}%`;

const buildCallReason = (verdict, heroEq, requiredEquity, icmAdjusted) => {
  const tag = icmAdjusted ? ' (ICM-adjusted)' : '';
  return verdict === 'CALL'
    ? `Call — ${pct(heroEq)} equity clears the ${pct(requiredEquity)} you need${tag}`
    : `Fold — ${pct(heroEq)} equity is below the ${pct(requiredEquity)} needed${tag}`;
};

const buildShoveReason = (verdict, foldEq, heroEq, requiredEquity, icmAdjusted) => {
  const tag = icmAdjusted ? ' (ICM-adjusted)' : '';
  if (verdict === 'SHOVE') {
    const called = requiredEquity != null ? `, ${pct(heroEq)} vs ${pct(requiredEquity)} when called` : '';
    return `Shove — ${pct(foldEq)} fold equity${called}${tag}`;
  }
  return `Fold — not enough fold equity or showdown equity to jam +EV${tag}`;
};

/**
 * CALL-or-FOLD facing an all-in. The rigorous case.
 *
 * @param {Object} p
 * @param {number} p.heroEq    - hero equity vs the shover's range (0..1)
 * @param {number} p.callCost  - chips hero must put in to call
 * @param {number} p.pot       - chips already in the pot hero would win
 * @param {Object} [p.icm]     - { stacks, heroIndex, villainIndex, payouts } for ICM
 * @returns {{ verdict:'CALL'|'FOLD', heroEq:number, requiredEquity:number, chipRequired:number, icmAdjusted:boolean, reason:string }}
 */
export const computeCallVerdict = ({ heroEq, callCost, pot, icm }) => {
  const denom = callCost + pot;
  const chipRequired = denom > 0 ? callCost / denom : 1;
  let requiredEquity = chipRequired;
  let icmAdjusted = false;

  if (icm && Array.isArray(icm.payouts) && icm.payouts.length > 0) {
    const rp = computeRiskPremium(icm.stacks, icm.heroIndex, icm.payouts, {
      villainIndex: icm.villainIndex, riskChips: callCost, winChips: pot,
    });
    if (rp.requiredEquity != null) {
      requiredEquity = rp.requiredEquity;
      icmAdjusted = true;
    }
  }

  const verdict = heroEq >= requiredEquity ? 'CALL' : 'FOLD';
  return {
    verdict, heroEq, requiredEquity, chipRequired, icmAdjusted,
    reason: buildCallReason(verdict, heroEq, requiredEquity, icmAdjusted),
  };
};

/**
 * SHOVE-or-FOLD when first in (hero jams their effective stack).
 *
 * @param {Object} p
 * @param {number} p.heroEq      - hero equity vs the villain CALLING range (0..1)
 * @param {number} p.foldEq      - P(all remaining villains fold) (0..1)
 * @param {number} p.effStackBB  - hero effective stack in BB (the jam size)
 * @param {number} p.potBB       - dead money already in the pot, in BB (blinds + antes)
 * @param {Object} [p.icm]       - { stacks, heroIndex, villainIndex, payouts, riskChips, winChips, potChips }
 * @returns {{ verdict:'SHOVE'|'FOLD', heroEq, foldEq, shoveEV, requiredEquity, icmAdjusted, reason }}
 */
export const computeShoveVerdict = ({ heroEq, foldEq, effStackBB, potBB, icm }) => {
  if (icm && Array.isArray(icm.payouts) && icm.payouts.length > 0) {
    const eqNow = computeIcmEquity(icm.stacks, icm.payouts);
    const heroNow = eqNow[icm.heroIndex] ?? 0;
    const rp = computeRiskPremium(icm.stacks, icm.heroIndex, icm.payouts, {
      villainIndex: icm.villainIndex, riskChips: icm.riskChips, winChips: icm.winChips,
    });
    // Fold branch: hero wins the dead pot without a showdown.
    const foldStacks = icm.stacks.slice();
    foldStacks[icm.heroIndex] = foldStacks[icm.heroIndex] + (icm.potChips || 0);
    const foldGain = (computeIcmEquity(foldStacks, icm.payouts)[icm.heroIndex] ?? 0) - heroNow;
    // Called branch: ICM $EV of the all-in showdown.
    const calledEV = heroEq * (rp.heroWin ?? heroNow) + (1 - heroEq) * (rp.heroLose ?? 0) - heroNow;
    const shoveEV = foldEq * foldGain + (1 - foldEq) * calledEV;
    const verdict = shoveEV > 0 ? 'SHOVE' : 'FOLD';
    return {
      verdict, heroEq, foldEq, shoveEV, requiredEquity: rp.requiredEquity, icmAdjusted: true,
      reason: buildShoveReason(verdict, foldEq, heroEq, rp.requiredEquity, true),
    };
  }

  // Chip-EV (no payout ladder): standard jam EV in BB.
  const risk = effStackBB;
  const potWhenCalled = potBB + 2 * effStackBB; // heads-up approximation
  const shoveEV = foldEq * potBB + (1 - foldEq) * (heroEq * potWhenCalled - risk);
  const verdict = shoveEV > 0 ? 'SHOVE' : 'FOLD';
  return {
    verdict, heroEq, foldEq, shoveEV, requiredEquity: null, icmAdjusted: false,
    reason: buildShoveReason(verdict, foldEq, heroEq, null, false),
  };
};
