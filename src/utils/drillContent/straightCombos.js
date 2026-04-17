/**
 * straightCombos.js — pure combo-counting utilities for the Blocker/Straight
 * Coverage framework.
 *
 * Central insight driving this module: hand equity depends on how many
 * 5-card straight patterns a 2-card hand can directly participate in (using
 * BOTH cards), and how many of those patterns survive after subtracting
 * villain's ranks. This is the "high overcards steal straight combos from
 * JTs but not from 45s" effect — AK kills both of JTs's top two straights
 * but only one of 54s's (the wheel).
 *
 * All functions are pure. Ranks are 0-indexed (2=0, …, A=12).
 */

/**
 * All 10 canonical 5-card straight patterns, each as an array of ranks.
 * Includes the wheel (A-2-3-4-5 → ranks [12, 0, 1, 2, 3]).
 */
export const ALL_STRAIGHTS = (() => {
  const out = [];
  for (let high = 4; high <= 12; high++) {
    const low = high - 4;
    out.push([low, low + 1, low + 2, low + 3, low + 4]);
  }
  out.push([0, 1, 2, 3, 12]); // wheel
  return out;
})();

/**
 * All 5-card straight patterns that include BOTH of the given ranks.
 * For a pair (rank1 === rank2), returns empty (can't use both same-rank
 * cards in one straight).
 */
export const straightPatternsForHand = (rank1, rank2) => {
  if (rank1 === rank2) return [];
  return ALL_STRAIGHTS.filter((p) => p.includes(rank1) && p.includes(rank2));
};

/**
 * Filter patterns to those containing NONE of the blocker ranks.
 */
export const livePatternsAgainst = (patterns, blockerRanks) => {
  const blocked = new Set(blockerRanks);
  return patterns.filter((p) => !p.some((r) => blocked.has(r)));
};

/**
 * Symmetric analysis of straight coverage for two hands. Reports total
 * straight combos each hand can make (using both cards), plus how many
 * survive the other side's blocker cards.
 *
 * @param {{ rankHigh: number, rankLow: number, pair: boolean }} handA
 * @param {{ rankHigh: number, rankLow: number, pair: boolean }} handB
 */
export const analyzeStraightCoverage = (handA, handB) => {
  const aAll = straightPatternsForHand(handA.rankHigh, handA.rankLow);
  const bAll = straightPatternsForHand(handB.rankHigh, handB.rankLow);

  const aRanks = handA.pair ? [handA.rankHigh] : [handA.rankHigh, handA.rankLow];
  const bRanks = handB.pair ? [handB.rankHigh] : [handB.rankHigh, handB.rankLow];

  const aLive = livePatternsAgainst(aAll, bRanks);
  const bLive = livePatternsAgainst(bAll, aRanks);

  return {
    aTotal: aAll.length,
    aLive: aLive.length,
    aBlocked: aAll.length - aLive.length,
    aPatterns: aAll,
    aLivePatterns: aLive,
    bTotal: bAll.length,
    bLive: bLive.length,
    bBlocked: bAll.length - bLive.length,
    bPatterns: bAll,
    bLivePatterns: bLive,
  };
};

/**
 * Classify a hand by its straight potential shape.
 *   - 'pair':       pocket pair (no direct straight combos)
 *   - 'connector':  adjacent ranks (0-gap, e.g., JT)
 *   - 'one_gap':    1-gap (e.g., J9)
 *   - 'two_gap':    2-gap (e.g., J8)
 *   - 'three_gap':  3-gap (e.g., J7)
 *   - 'disconnected': 4+ gap, 0 direct straight combos (e.g., K4)
 */
export const classifyConnectedness = (rankHigh, rankLow) => {
  if (rankHigh === rankLow) return 'pair';
  const gap = rankHigh - rankLow - 1;
  // Wheel interactions: A with 2/3/4/5 count as bridges (the A is low).
  if (rankHigh === 12 && rankLow <= 3) {
    // A2: gap 10 numerically but wheel gives 1 straight (A2345).
    // Treat as degraded connector/gapper by effective-gap within the wheel.
    const wheelDistance = rankLow; // A=12 acting as rank -1 next to 2=0
    if (wheelDistance === 0) return 'connector';   // A2
    if (wheelDistance === 1) return 'one_gap';     // A3
    if (wheelDistance === 2) return 'two_gap';     // A4
    if (wheelDistance === 3) return 'three_gap';   // A5
    return 'disconnected';
  }
  if (gap === 0) return 'connector';
  if (gap === 1) return 'one_gap';
  if (gap === 2) return 'two_gap';
  if (gap === 3) return 'three_gap';
  return 'disconnected';
};

/**
 * Compute the raw count of direct straight combos for a hand, without any
 * blocker consideration. Useful as the "best-case straight potential."
 */
export const straightComboCount = (rankHigh, rankLow) =>
  straightPatternsForHand(rankHigh, rankLow).length;
