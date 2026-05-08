/**
 * scenarios/heroResponse.js — hero's response model to a 3-bet from behind.
 *
 * 3-tier strength bucket per WS-168 plan agent §B2 (option 1).
 * Tier source: `handStrengthTier(idx)` from rangeMatrix decodeIndex —
 * raw = rank1 + rank2 + (isPair ? 8 : 0) + (suited ? 2 : 0); max = 32 (AA).
 *
 * Live 1/2 reg defaults:
 *   tier > 0.85  → 4-bet  (AA, KK, QQ, AKs)  — top ~3% of hands
 *   tier > 0.70  → call    (JJ, TT, 99, AKo, AQs, AJs)  — next ~5%
 *   tier ≤ 0.70  → fold
 *
 * Versus a SQUEEZE (caller + 3-bettor), tighten thresholds because the pot
 * is bigger, hero is committing more to continue, and the 3-bettor's value
 * frequency is higher.
 */

import { decodeIndex } from '../../../utils/pokerCore/rangeMatrix';

/**
 * Compute hand strength tier (0..1) from grid index.
 * Mirrors the formula in rangeEngine/populationPriors.js (private there).
 */
export const handStrengthTier = (idx) => {
  const { rank1, rank2, isPair, suited } = decodeIndex(idx);
  const raw = rank1 + rank2 + (isPair ? 8 : 0) + (suited ? 2 : 0);
  const max = 12 + 12 + 8; // AA = 32
  return raw / max;
};

/**
 * Hero's response distribution to a single 3-bet from behind (vs-open 3-bet).
 *
 * @param {number} handClassIdx - 0..168
 * @returns {{ fold: number, call: number, fourBet: number }}
 */
export const heroResponseToThreeBet = (handClassIdx) => {
  const tier = handStrengthTier(handClassIdx);
  if (tier > 0.85) return { fold: 0.0, call: 0.0, fourBet: 1.0 };
  if (tier > 0.70) return { fold: 0.0, call: 1.0, fourBet: 0.0 };
  return                  { fold: 1.0, call: 0.0, fourBet: 0.0 };
};

/**
 * Hero's response distribution vs a squeeze (caller + 3-bettor).
 * Tighter thresholds.
 */
export const heroResponseToSqueeze = (handClassIdx) => {
  const tier = handStrengthTier(handClassIdx);
  if (tier > 0.90) return { fold: 0.0, call: 0.0, fourBet: 1.0 };
  if (tier > 0.78) return { fold: 0.0, call: 1.0, fourBet: 0.0 };
  return                  { fold: 1.0, call: 0.0, fourBet: 0.0 };
};

/**
 * Hero's response to a 5-bet jam after hero 4-bets.
 * Stack-off heuristic: AA / KK / AKs snap-call; QQ / AKo mix; below QQ fold.
 *
 * @param {number} handClassIdx
 * @returns {{ call: number, fold: number }}
 */
export const heroResponseToFiveBetJam = (handClassIdx) => {
  const tier = handStrengthTier(handClassIdx);
  if (tier > 0.92) return { call: 1.0, fold: 0.0 };
  if (tier > 0.85) return { call: 0.5, fold: 0.5 };
  return                  { call: 0.0, fold: 1.0 };
};

/**
 * Villain's response to hero's 4-bet.
 * v1 simplification: villains fold ~70% of their 3-bet range to a 4-bet,
 * call 20% (premiums), 5-bet jam 10% (top of range).
 *
 * @returns {{ fold: number, call: number, jam: number }}
 */
export const VILLAIN_RESPONSE_TO_FOURBET = {
  fold: 0.70,
  call: 0.20,
  jam:  0.10,
};
