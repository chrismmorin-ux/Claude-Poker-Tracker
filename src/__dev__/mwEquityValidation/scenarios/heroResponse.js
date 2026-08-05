/**
 * scenarios/heroResponse.js — hero's response model to a 3-bet from behind.
 *
 * 3-tier strength bucket per WS-168 plan agent §B2 (option 1). Strength is
 * `strengthPercentile(idx, heroPosition)` — the combo-weighted equity percentile, the same
 * quantity the engine scores with. See `../strengthPercentile.js` for what it is, why it is
 * re-derived here rather than imported, and the realization caveat every boundary below
 * inherits.
 *
 * THRESHOLDS ARE FRACTIONS OF THE FIELD, NOT SCORES (WS-367). On a percentile axis a foot of
 * `1 − f` selects exactly the top `f` of the 1326 combos, so each tier below is stated as
 * the fraction it admits. Two of the three branches carried a doctrine number of their own
 * and are DERIVED from it; the third carried none and is TRANSPORTED by quantile matching —
 * the old rank-sum threshold selected q combos, so the new foot is `1 − q/1326`, which
 * selects the same fraction of the field. This is the WS-304 procedure, applied to the copy
 * of the rank sum that survived under `__dev__`.
 *
 * MEASURED MEMBERSHIP OF EVERY TIER (assert-backed in `mwEquityValidationSmoke.test.js`, so
 * this comment cannot drift from the code the way its predecessor did):
 *
 *   vs a single 3-bet — hero at UTG (EARLY) / BTN (LATE)
 *     4-bet, top 3%:   EARLY {AA,KK,QQ,JJ,AKs,TT} 34 combos 2.56%
 *                      LATE  {AA,KK,QQ,JJ,TT,99,AKs} 40 combos 3.02%
 *     call, top 8%:    EARLY 110 combos 8.30%, adding AKo,AQs,AQo,99,AJs,AJo,ATs,88,KQs,ATo
 *                      LATE  112 combos 8.45%, adding AKo,AQs,88,AJs,AQo,AJo,ATs,77,ATo
 *     fold:            everything else
 *
 *   vs a squeeze (caller + 3-bettor) — tighter, because the pot is bigger, hero is
 *   committing more to continue, and the 3-bettor's value frequency is higher
 *     4-bet, top 0.90%: {AA,KK} at both
 *     call, top 2.11%:  EARLY {AA,KK,QQ,JJ,AKs}; LATE {AA,KK,QQ,JJ,TT}
 *     fold:             everything else
 *
 *   vs a 5-bet jam after hero 4-bets
 *     snap-call, top 0.90%: {AA,KK}
 *     mix 50/50, top 1.36%: {QQ}
 *     fold:                 everything else
 *
 * WHY THE OLD DOCBLOCK'S NAMED TIERS WERE WRONG, AND WHICH OF THEM SURVIVE. It read
 * "tier > 0.85 → 4-bet (AA, KK, QQ, AKs) — top ~3%" and "tier > 0.70 → call (JJ, TT, 99,
 * AKo, AQs, AJs) — next ~5%". Under its own rank sum, AKs scored 0.781 and did NOT 4-bet,
 * and 99 scored 0.688 and did NOT call — two of the six named hands were misfiled by the
 * formula that was supposed to place them, and the 0.85 tier delivered 1.36% against a
 * stated ~3%. That shortfall is the same signature WS-304 found in the engine's 3-bet
 * branch (stated 3–5%, delivered 1.04%), so the stated fractions are treated as the
 * doctrine and the rank-sum thresholds as the defect. On the corrected axis all six named
 * hands land where the comment always said they did, at both hero positions — and 3% is
 * independently the smallest round fraction that admits the whole named 4-bet set (EARLY
 * needs 2.56%, LATE 3.02%), so the two routes agree here as they did in WS-304.
 *
 * WHAT COULD NOT BE SAVED, AND WHY IT IS RECORDED RATHER THAN FORCED. The 5-bet-jam block's
 * old comment claimed "AA / KK / AKs snap-call; QQ / AKo mix; below QQ fold". Under the rank
 * sum, AKs and AKo did neither — both folded. And on the equity axis the set {AA,KK,AKs} is
 * NOT a prefix at any threshold: admitting AKs drags JJ and TT (and 99 at LATE) in with it,
 * which the same sentence explicitly folds. AK is a stack-off hand because of realization,
 * blockers, and the narrowness of a 5-bettor's range — none of which all-in equity against
 * an opening range can see. So this branch keeps its transported thresholds and the comment
 * now states the membership the code actually produces. Same reason AKs drops out of the
 * LATE squeeze-call tier: TT and 99 outrank it on all-in equity from a late opener's seat.
 * That is the named approximation biting, not a second defect.
 */

import { strengthPercentile, TOTAL_COMBOS } from '../strengthPercentile';

/**
 * DERIVED (the branch states its own band). Top 3% 4-bets, the next 5% calls.
 */
const THREE_BET_FOUR_BET_FRACTION = 0.03;
const THREE_BET_CONTINUE_FRACTION = 0.08; // 3% + the next 5%

/**
 * TRANSPORTED (no doctrine number of their own) — old rank-sum thresholds, and the combo
 * count each selected. Note 0.90 and 0.92 selected the SAME 12 combos: the 33-level rank sum
 * had no room to separate them, which is the defect restated.
 */
const SQUEEZE_FOUR_BET_FOOT = 1 - 12 / TOTAL_COMBOS;  // old 0.90 → 12 combos (0.90%)
const SQUEEZE_CONTINUE_FOOT = 1 - 28 / TOTAL_COMBOS;  // old 0.78 → 28 combos (2.11%)
const JAM_SNAP_FOOT = 1 - 12 / TOTAL_COMBOS;          // old 0.92 → 12 combos (0.90%)
const JAM_MIX_FOOT = 1 - 18 / TOTAL_COMBOS;           // old 0.85 → 18 combos (1.36%)

/**
 * Hero's response distribution to a single 3-bet from behind (vs-open 3-bet).
 *
 * @param {number} handClassIdx - 0..168
 * @param {string} heroPosition - EQUITY_VS_OPEN key; see `HERO_EQUITY_KEY`
 * @returns {{ fold: number, call: number, fourBet: number }}
 */
export const heroResponseToThreeBet = (handClassIdx, heroPosition) => {
  const strength = strengthPercentile(handClassIdx, heroPosition);
  if (strength > 1 - THREE_BET_FOUR_BET_FRACTION) return { fold: 0.0, call: 0.0, fourBet: 1.0 };
  if (strength > 1 - THREE_BET_CONTINUE_FRACTION) return { fold: 0.0, call: 1.0, fourBet: 0.0 };
  return                                                { fold: 1.0, call: 0.0, fourBet: 0.0 };
};

/**
 * Hero's response distribution vs a squeeze (caller + 3-bettor). Tighter thresholds.
 *
 * @param {number} handClassIdx
 * @param {string} heroPosition
 * @returns {{ fold: number, call: number, fourBet: number }}
 */
export const heroResponseToSqueeze = (handClassIdx, heroPosition) => {
  const strength = strengthPercentile(handClassIdx, heroPosition);
  if (strength > SQUEEZE_FOUR_BET_FOOT) return { fold: 0.0, call: 0.0, fourBet: 1.0 };
  if (strength > SQUEEZE_CONTINUE_FOOT) return { fold: 0.0, call: 1.0, fourBet: 0.0 };
  return                                       { fold: 1.0, call: 0.0, fourBet: 0.0 };
};

/**
 * Hero's response to a 5-bet jam after hero 4-bets.
 * Stack-off heuristic: AA / KK snap-call; QQ mixes; everything else folds. See the docblock
 * above for why the doctrine set {AA, KK, AKs} cannot be expressed on this axis.
 *
 * @param {number} handClassIdx
 * @param {string} heroPosition
 * @returns {{ call: number, fold: number }}
 */
export const heroResponseToFiveBetJam = (handClassIdx, heroPosition) => {
  const strength = strengthPercentile(handClassIdx, heroPosition);
  if (strength > JAM_SNAP_FOOT) return { call: 1.0, fold: 0.0 };
  if (strength > JAM_MIX_FOOT) return { call: 0.5, fold: 0.5 };
  return                              { call: 0.0, fold: 1.0 };
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
