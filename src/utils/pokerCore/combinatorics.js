/**
 * combinatorics.js — mental-math helpers for poker equity reasoning.
 *
 * Every function here is pure math: no card objects, no enumeration. The
 * goal is to expose the formulas a player can execute in their head,
 * alongside the exact computed value, so the UI can teach multiple
 * mental paths to the same answer.
 *
 * Two guiding principles:
 *
 * 1. *Rules of thumb and exact values side-by-side.* Every approximation
 *    returns the rule-of-thumb value AND the exact value so the user can
 *    calibrate their shortcut.
 *
 * 2. *Expose the intermediates.* Don't just return "19.6%" — return the
 *    components (outs, unseen cards, cards to come, blockers removed)
 *    so the UI can render step-by-step.
 *
 * Pure module — no imports.
 */

// ---------- Basic combinatorics ---------- //

/**
 * Binomial coefficient C(n, k). Integer-safe for the small n's used in poker
 * (n ≤ 52).
 */
export const C = (n, k) => {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
};

// ---------- Rule of 4 and 2 ---------- //

/**
 * Rule of 4 & 2 — street-dependent quick equity estimate from outs.
 *
 *   Flop to river (2 cards to come):  outs × 4 (approx)
 *   Turn to river (1 card to come):   outs × 2 (approx)
 *
 * The exact formula uses cumulative probability:
 *   flop→river: 1 − C(47−outs, 2)/C(47, 2)   (47 unseen cards when 2+3 known)
 *   turn→river: outs / 46
 *
 * This function returns both.
 *
 * @param {number} outs
 * @param {'flop'|'turn'} street  which street hero is on
 * @returns {{ rule: number, exact: number, pctRule: string, pctExact: string, note: string }}
 */
export const ruleOf4And2 = (outs, street = 'flop') => {
  if (outs < 0 || !Number.isFinite(outs)) {
    throw new Error(`ruleOf4And2: outs must be non-negative number, got ${outs}`);
  }
  if (street === 'flop') {
    // Unseen after flop = 52 − 2 (hero) − 3 (flop) = 47.
    // P(hit turn or river) = 1 − P(miss both) = 1 − (47−outs)/47 × (46−outs)/46.
    const missBoth = ((47 - outs) / 47) * ((46 - outs) / 46);
    const exact = 1 - missBoth;
    const rule = Math.min(outs * 0.04, 1);
    return {
      outs,
      rule,
      exact,
      pctRule: `${(rule * 100).toFixed(1)}%`,
      pctExact: `${(exact * 100).toFixed(1)}%`,
      street,
      note:
        `Rule of 4: ${outs} × 4 = ${outs * 4}% (approx). ` +
        `Exact: 1 − (${47 - outs}/47 × ${46 - outs}/46) = ${(exact * 100).toFixed(1)}%. ` +
        `Rule overshoots when outs > 9; use exact for big draws (combo draws, open-ended + flush).`,
    };
  }
  if (street === 'turn') {
    const exact = outs / 46;
    const rule = Math.min(outs * 0.02, 1);
    return {
      outs,
      rule,
      exact,
      pctRule: `${(rule * 100).toFixed(1)}%`,
      pctExact: `${(exact * 100).toFixed(1)}%`,
      street,
      note:
        `Rule of 2: ${outs} × 2 = ${outs * 2}% (approx). ` +
        `Exact: ${outs}/46 = ${(exact * 100).toFixed(1)}%. ` +
        `Rule is within 0.2pp for outs ≤ 15.`,
    };
  }
  throw new Error(`ruleOf4And2: street must be 'flop' or 'turn', got ${street}`);
};

// ---------- Flush completion with blockers ---------- //

/**
 * Probability of completing a flush from FLOPPED 4-flush through the river,
 * with optional blocker cards (villain holding same-suited cards that aren't
 * visible to hero but are part of the dead set).
 *
 * Starting state: hero has 2 suited cards, flop brought 2 more of that suit.
 * Total known of that suit = 4. Unseen of that suit = 13 − 4 − blockers = 9 − blockers.
 * Unseen total after flop = 47 − blockers (for hero's perspective).
 *
 * This function intentionally takes `blockers` separately so the UI can
 * render "hero thinks 9 outs, but villain holds 2 of the suit, so it's
 * really 7 outs" — a concrete teaching moment.
 *
 * @param {number} blockers   number of same-suit cards held by villain or
 *                            otherwise known dead (default 0)
 * @param {'flop'|'turn'} [startStreet='flop']
 * @returns {{ outs, unseen, cardsToCome, exact, note }}
 */
export const flushCompletionExact = (blockers = 0, startStreet = 'flop') => {
  const outs = 9 - blockers;
  if (outs < 0) {
    return { outs: 0, unseen: 0, cardsToCome: 0, exact: 0,
      note: `All 9 flush cards are accounted for by blockers — 0% to complete.` };
  }
  if (startStreet === 'flop') {
    // Cards to come: 2 (turn + river). Unseen after flop: 47 (minus hero's
    // awareness of blockers). For the hero's naïve calc: 47 unseen.
    // If we ALSO remove blockers from unseen, we get the true probability
    // conditional on knowing villain's suit count.
    const unseen = 47; // from hero's perspective (doesn't see villain cards)
    const missBoth = ((unseen - outs) / unseen) * ((unseen - 1 - outs) / (unseen - 1));
    const exact = 1 - missBoth;
    return {
      outs,
      unseen,
      cardsToCome: 2,
      exact,
      note:
        `Flopped flush draw. 9 flush cards exist total; ${blockers} held by villain ` +
        `(blocker). Outs: ${outs}. Unseen cards: ${unseen}. ` +
        `P(complete) = 1 − (${unseen - outs}/${unseen} × ${unseen - 1 - outs}/${unseen - 1}) ` +
        `= ${(exact * 100).toFixed(1)}%. Rule of 4 says ${outs * 4}%.`,
    };
  }
  if (startStreet === 'turn') {
    const unseen = 46;
    const exact = outs / unseen;
    return {
      outs,
      unseen,
      cardsToCome: 1,
      exact,
      note:
        `Turned flush draw. Outs: ${outs} (9 − ${blockers} blockers). ` +
        `P(complete) = ${outs}/${unseen} = ${(exact * 100).toFixed(1)}%. Rule of 2 says ${outs * 2}%.`,
    };
  }
  throw new Error(`flushCompletionExact: startStreet must be 'flop' or 'turn'`);
};

// ---------- Flopping a pair with a hole card ---------- //

/**
 * Probability of flopping a pair (or better) of ONE specific hole-card rank,
 * given there are 3 remaining cards of that rank unseen.
 *
 * P(pair the rank) = 1 − C(47, 3)/C(50, 3) -- wait, that's not right.
 *   Correct: P(at least one of 3 target cards in 3 flop slots)
 *          = 1 − C(47, 3) / C(50, 3)   (3 target, 47 non-target, pick 3)
 *
 * We expose both the exact formula and an intuition-friendly multiplication
 * form so the UI can teach the mental math.
 *
 * @param {number} outsPerRank  typically 3 (four in deck, one in hand).
 *                              Pass 2 if hero has a pair (both cards of same rank).
 * @param {number} [unseen=50]  total unseen cards (default 50: 52 − hero's 2)
 * @param {number} [flopSlots=3]
 * @returns {{ exact, pctExact, note }}
 */
export const flopPairOneRank = (outsPerRank = 3, unseen = 50, flopSlots = 3) => {
  const missAll = C(unseen - outsPerRank, flopSlots) / C(unseen, flopSlots);
  const exact = 1 - missAll;
  return {
    outs: outsPerRank,
    unseen,
    flopSlots,
    exact,
    pctExact: `${(exact * 100).toFixed(1)}%`,
    note:
      `P(pair a rank with ${outsPerRank} outs from ${unseen} unseen) ` +
      `= 1 − ${unseen - outsPerRank}C${flopSlots} / ${unseen}C${flopSlots} ` +
      `= 1 − (${unseen - outsPerRank}/${unseen} × ${unseen - 1 - outsPerRank}/${unseen - 1} × ${unseen - 2 - outsPerRank}/${unseen - 2}) ` +
      `= ${(exact * 100).toFixed(1)}%.`,
  };
};

/**
 * Probability of flopping a pair of EITHER of two different hole-card ranks
 * (the classic "AK pairs up" math). Uses inclusion-exclusion:
 *
 *   P(pair A OR pair K) = P(pair A) + P(pair K) − P(pair both)
 *
 * For same outsPerRank on both ranks, the formula simplifies.
 *
 * @param {number} outsRank1  usually 3 (one rank-1 card in hand)
 * @param {number} outsRank2  usually 3 (one rank-2 card in hand)
 * @param {number} [unseen=50]
 * @returns {{ eitherRank, bothRanks, rank1Only, rank2Only, exact, note }}
 */
export const flopPairEitherRank = (outsRank1 = 3, outsRank2 = 3, unseen = 50) => {
  // P(miss rank 1) over 3 flop slots = C(unseen−outsRank1, 3)/C(unseen, 3)
  const pMissR1 = C(unseen - outsRank1, 3) / C(unseen, 3);
  const pMissR2 = C(unseen - outsRank2, 3) / C(unseen, 3);
  // P(miss both) = choose 3 from (unseen − outsRank1 − outsRank2)
  const pMissBoth = C(unseen - outsRank1 - outsRank2, 3) / C(unseen, 3);
  const pHitR1 = 1 - pMissR1;
  const pHitR2 = 1 - pMissR2;
  const pHitBoth = pHitR1 + pHitR2 - (1 - pMissBoth);
  const pEither = 1 - pMissBoth;
  return {
    outsRank1,
    outsRank2,
    unseen,
    pHitR1,
    pHitR2,
    pHitBoth,
    pEither,
    note:
      `P(pair either rank) = 1 − P(miss both) = 1 − C(${unseen - outsRank1 - outsRank2}, 3)/C(${unseen}, 3) = ` +
      `${(pEither * 100).toFixed(1)}%. ` +
      `Mental shortcut: each rank is ~${(pHitR1 * 100).toFixed(0)}%; ` +
      `P(either) ≈ P(A) + P(K) − P(both) = ${(pHitR1 * 100).toFixed(0)}+${(pHitR2 * 100).toFixed(0)}−${(pHitBoth * 100).toFixed(0)} = ${(pEither * 100).toFixed(0)}%.`,
  };
};

// ---------- Straight combos ---------- //

/**
 * Count the DIRECT 5-card straight runs a hand participates in — i.e., the
 * unique run of 5 consecutive ranks that contains BOTH hole cards.
 *
 * For hand (rankHigh, rankLow), only sequences [lo..lo+4] that contain both
 * ranks are direct. Separation between rankHigh and rankLow must be ≤ 4.
 *
 * Wheel straight (A2345) is handled: Ace can serve as "1" in A2345.
 *
 * Returns an array of the run-high ranks (0–12) that qualify.
 *
 * @param {number} rankHigh 0..12
 * @param {number} rankLow  0..12
 * @returns {number[]}      high-rank of each direct run (0=6-high, 3=5-high wheel, ..., 12=A-high Broadway)
 */
export const directStraightRuns = (rankHigh, rankLow) => {
  if (rankHigh === rankLow) return []; // pair — no direct runs
  const hi = Math.max(rankHigh, rankLow);
  const lo = Math.min(rankHigh, rankLow);
  const runs = [];
  // Regular: the run high can be anywhere from max(hi, 4) to min(lo+4, 12).
  // Both hole cards must lie in [high-4, high].
  const runHighMin = Math.max(hi, 4);
  const runHighMax = Math.min(lo + 4, 12);
  for (let h = runHighMin; h <= runHighMax; h++) {
    runs.push(h);
  }
  // Wheel (A2345, rank indices [12, 0, 1, 2, 3]). Participates if hand has A
  // and a card from {2,3,4,5}, or two cards both from {2,3,4,5}.
  const hasAce = hi === 12;
  const lowCards = [lo, hi].filter((r) => r < 4);
  if ((hasAce && lowCards.length >= 1) || lowCards.length === 2) {
    runs.push(3); // wheel high is 5 (index 3)
  }
  // De-dup (wheel with A5 gives run-high=3 already from regular pass? no,
  // A5 has hi=12, lo=3, runHighMin=max(12,4)=12, runHighMax=min(3+4,12)=7, so
  // loop doesn't fire. Only wheel path adds 3.)
  return Array.from(new Set(runs)).sort((a, b) => a - b);
};

/**
 * Count SINGLE-CARD 5-card straight runs a hand participates in — exactly
 * one hole card plus 4 board cards complete the straight.
 *
 * For each 5-card run, the run is "single-card live" for this hand if
 * exactly one of the two hole cards is in the run (the other is irrelevant
 * or duplicated).
 *
 * Returns an array of { runHigh, contributingRank }.
 */
export const singleCardStraightRuns = (rankHigh, rankLow) => {
  const runs = [];
  // Enumerate all 10 5-card straight patterns, including wheel.
  const patterns = [];
  for (let h = 4; h <= 12; h++) {
    patterns.push({ runHigh: h, ranks: [h - 4, h - 3, h - 2, h - 1, h] });
  }
  patterns.push({ runHigh: 3, ranks: [0, 1, 2, 3, 12] }); // wheel

  for (const p of patterns) {
    const inRunHigh = p.ranks.includes(rankHigh);
    const inRunLow = p.ranks.includes(rankLow);
    // Single-card: exactly one hole card is in the run.
    if (inRunHigh !== inRunLow) {
      runs.push({ runHigh: p.runHigh, contributingRank: inRunHigh ? rankHigh : rankLow });
    }
  }
  return runs;
};

// ---------- Runout math (multiple boards, e.g., run-it-twice) ---------- //

/**
 * Probability of at least one success when running an independent outcome
 * N times, each with probability p.
 *
 * Classic use: "If I'm all-in on the flop at 40% equity and we run it twice,
 * what's my chance of winning at least one of the two boards?" → 1 − (1−p)^2.
 *
 * @param {number} p         single-outcome probability (0..1)
 * @param {number} runs      number of independent runs
 * @returns {{ atLeastOne, exactlyOne, allSucceed, expectedWins, note }}
 */
export const independentRunouts = (p, runs = 2) => {
  if (p < 0 || p > 1) throw new Error(`independentRunouts: p must be in [0,1]`);
  if (runs < 1) throw new Error(`independentRunouts: runs must be ≥ 1`);
  const missOne = 1 - p;
  const allMiss = Math.pow(missOne, runs);
  const atLeastOne = 1 - allMiss;
  const allSucceed = Math.pow(p, runs);
  // Exactly one: choose 1 of N runs to succeed, rest fail
  const exactlyOne = runs * p * Math.pow(1 - p, runs - 1);
  const expectedWins = p * runs;
  return {
    p,
    runs,
    atLeastOne,
    exactlyOne,
    allSucceed,
    expectedWins,
    note:
      `Running ${runs} independent boards at p=${(p * 100).toFixed(1)}%: ` +
      `P(win all)=${(allSucceed * 100).toFixed(1)}%, ` +
      `P(win exactly one)=${(exactlyOne * 100).toFixed(1)}%, ` +
      `P(win at least one)=${(atLeastOne * 100).toFixed(1)}%. ` +
      `Expected wins = ${expectedWins.toFixed(2)} of ${runs}. ` +
      `Run-it-twice doesn't change EV but halves variance for the short-term swing.`,
  };
};

// ---------- Pot-odds helpers ---------- //

/**
 * Break-even equity for calling a bet of `bet` into a pot of `pot`.
 *
 *   BE = bet / (pot + 2*bet)   — the classic pot-odds formula
 *
 * Returned along with implied reverse form so the user can see "I need
 * X% equity to call" next to "pot is laying me Y:1".
 */
export const breakEvenEquity = (pot, bet) => {
  if (bet <= 0 || pot < 0) throw new Error(`breakEvenEquity: need pot ≥ 0 and bet > 0`);
  const total = pot + 2 * bet;
  const equity = bet / total;
  const ratio = (pot + bet) / bet; // "I'm laid X:1"
  return {
    pot,
    bet,
    equity,
    pctEquity: `${(equity * 100).toFixed(1)}%`,
    ratio,
    ratioLabel: `${ratio.toFixed(2)}:1`,
    note:
      `Call ${bet} to win ${pot + bet} → need ${(equity * 100).toFixed(1)}% equity. ` +
      `Pot lays ${ratio.toFixed(2)}:1. ` +
      `Mental: "${bet} to win ${pot + bet}" → ${bet}/(${bet}+${pot + bet}) = ${(equity * 100).toFixed(1)}%.`,
  };
};
