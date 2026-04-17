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
 * All 5-card straight patterns that include EXACTLY ONE of the given ranks
 * (XOR). These are the "partial" coverage runs — hero contributes one card
 * to the straight and the board must supply the other four.
 *
 * For a pair (rank1 === rank2), returns all patterns containing that rank
 * (the pair can only contribute one copy to a straight; the other is burned).
 */
export const singleCardPatternsForHand = (rank1, rank2) => {
  if (rank1 === rank2) {
    return ALL_STRAIGHTS.filter((p) => p.includes(rank1));
  }
  return ALL_STRAIGHTS.filter((p) => {
    const has1 = p.includes(rank1);
    const has2 = p.includes(rank2);
    return (has1 && !has2) || (!has1 && has2);
  });
};

/**
 * Filter patterns to those that remain live against a set of blocker ranks.
 *
 * Blocker logic: a blocker kills a pattern iff the blocker's rank needs to
 * come from the BOARD to complete the straight. Ranks hero already holds
 * are excluded — villain's copy of a hero rank doesn't remove any
 * board card hero still needs.
 *
 * Example: hero AK, pattern TJQKA. Hero already has A and K, so board must
 * supply T, J, Q. A villain holding another A does NOT block this pattern
 * (A isn't on the board-needed list). A villain with QQ, however, contests
 * the Q that the board must supply, so the pattern is treated as blocked.
 *
 * @param {number[][]} patterns
 * @param {number[]} blockerRanks villain's card ranks
 * @param {number[]} heroRanks hero's card ranks (omit for the raw
 *   "does-any-blocker-touch-the-pattern" semantics used in legacy callsites)
 */
export const livePatternsAgainst = (patterns, blockerRanks, heroRanks = []) => {
  const hero = new Set(heroRanks);
  const blocked = new Set(blockerRanks);
  return patterns.filter((p) => {
    for (const r of p) {
      if (!hero.has(r) && blocked.has(r)) return false;
    }
    return true;
  });
};

// Heuristic equity weight per live straight pattern. Direct (both-card) runs
// are open-ended/oesd-prone on many flops; single-card runs require a
// 4-to-a-straight board which is much rarer. Weights chosen so a connector's
// 4 direct combos (weight 8.0) clearly outscore a broadway's 1 direct + many
// single-card combos, while still rewarding partial coverage.
const DIRECT_WEIGHT = 2.0;
const SINGLE_CARD_WEIGHT = 0.7;

/**
 * Symmetric analysis of straight coverage for two hands. Reports:
 *   - direct combos (both hole cards in the straight)
 *   - single-card combos (one hole card in the straight, four from board)
 *   - which of each are "live" after subtracting blockers
 *   - a weighted coverage score summarising total straight potential
 *
 * This is what separates AK (2345A + 9TJQK + TJQKA = 3 patterns) from
 * AQ (2345A + 89TJQ + 9TJQK + TJQKA = 4 patterns): the Q sits in more
 * 5-card runs than the K does.
 *
 * @param {{ rankHigh: number, rankLow: number, pair: boolean }} handA
 * @param {{ rankHigh: number, rankLow: number, pair: boolean }} handB
 */
export const analyzeStraightCoverage = (handA, handB) => {
  const aDirect = straightPatternsForHand(handA.rankHigh, handA.rankLow);
  const bDirect = straightPatternsForHand(handB.rankHigh, handB.rankLow);
  const aSingle = singleCardPatternsForHand(handA.rankHigh, handA.rankLow);
  const bSingle = singleCardPatternsForHand(handB.rankHigh, handB.rankLow);

  const aRanks = handA.pair ? [handA.rankHigh] : [handA.rankHigh, handA.rankLow];
  const bRanks = handB.pair ? [handB.rankHigh] : [handB.rankHigh, handB.rankLow];

  const aDirectLive = livePatternsAgainst(aDirect, bRanks, aRanks);
  const bDirectLive = livePatternsAgainst(bDirect, aRanks, bRanks);
  const aSingleLive = livePatternsAgainst(aSingle, bRanks, aRanks);
  const bSingleLive = livePatternsAgainst(bSingle, aRanks, bRanks);

  const score = (direct, single) =>
    DIRECT_WEIGHT * direct + SINGLE_CARD_WEIGHT * single;

  return {
    // Legacy direct-only fields (preserved for back-compat).
    aTotal: aDirect.length,
    aLive: aDirectLive.length,
    aBlocked: aDirect.length - aDirectLive.length,
    aPatterns: aDirect,
    aLivePatterns: aDirectLive,
    bTotal: bDirect.length,
    bLive: bDirectLive.length,
    bBlocked: bDirect.length - bDirectLive.length,
    bPatterns: bDirect,
    bLivePatterns: bDirectLive,

    // Single-card (partial) coverage.
    aSingleCardTotal: aSingle.length,
    aSingleCardLive: aSingleLive.length,
    aSingleCardPatterns: aSingle,
    aSingleCardLivePatterns: aSingleLive,
    bSingleCardTotal: bSingle.length,
    bSingleCardLive: bSingleLive.length,
    bSingleCardPatterns: bSingle,
    bSingleCardLivePatterns: bSingleLive,

    // Weighted coverage scores — higher means more straight potential,
    // after blockers.
    aCoverageScore: score(aDirectLive.length, aSingleLive.length),
    bCoverageScore: score(bDirectLive.length, bSingleLive.length),
    aCoverageScoreRaw: score(aDirect.length, aSingle.length),
    bCoverageScoreRaw: score(bDirect.length, bSingle.length),
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
