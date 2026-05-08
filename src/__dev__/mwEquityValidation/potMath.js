/**
 * potMath.js — pot accounting for the MW-equity validation harness.
 *
 * Centralizes the "what's hero's net EV in scenario S given open size R"
 * calculation. Live 1/2 conventions: SB posts 0.5 BB, BB posts 1.0 BB,
 * no antes, no straddle (v1 — see baseline-2026-05-08.md).
 *
 * Net-EV identity (always):
 *   scenario_EV = (P(hero_wins_scenario) × pot_won) - hero_total_investment
 *
 * Dead money is the blinds that don't continue (e.g., SB folds → 0.5 BB dead).
 * Hero's open R is returned in the all-fold case (no one called) — the +1.5 BB
 * is the blinds-stolen profit, not gross winnings.
 */

/**
 * Compute pot at flop and hero investment for a scenario.
 *
 * @param {Object} scenario
 * @param {string[]} scenario.callers   - array of position labels who called (e.g. ['BB'])
 * @param {string[]} scenario.threeBettors - array of position labels who 3-bet
 * @param {string[]} scenario.folders  - array of position labels who folded
 * @param {number} R - hero's open size in BB (typically 2.5)
 * @returns {{ potAtFlop: number, heroInvestment: number, deadMoney: number }}
 *
 * Only the all-fold-or-call case is computed here. 3-bet branches use
 * threeBetPotMath() below since those involve hero's response.
 */
export const computeFlatScenarioPot = ({ callers = [], folders = [] }, R) => {
  // Validate: this helper only handles fold/call branches; 3-bets routed elsewhere.
  // Each caller contributes R; SB has already posted 0.5, BB 1.0 (we credit those).
  // Dead money = blinds from folders.
  let deadMoney = 0;
  if (folders.includes('SB')) deadMoney += 0.5;
  if (folders.includes('BB')) deadMoney += 1.0;

  // Hero invests R (the open).
  const heroInvestment = R;

  // Pot at flop:
  //   hero contribution: R
  //   each caller contributes R (BB tops up R - 1.0; SB tops up R - 0.5; non-blind callers add R fresh)
  //   plus dead money from folded blinds
  const totalCallerContribs = callers.length * R;
  const potAtFlop = R + totalCallerContribs + deadMoney;

  return { potAtFlop, heroInvestment, deadMoney };
};

/**
 * Pot math for hero's response to a single 3-bet from behind.
 *
 * Assumed sequence: hero opens R, villain 3-bets to S, hero responds (fold / call / 4bet).
 * Live 1/2 standard 3-bet sizes: ~9-11 BB IP, ~12 BB OOP. We use S = 10 BB for v1.
 *
 * @param {Object} ctx
 * @param {number} ctx.R - hero's open size (BB)
 * @param {number} ctx.S - villain's 3-bet size (BB)
 * @param {string[]} ctx.deadFolders - blind positions that folded preflop ('SB' / 'BB')
 * @returns {{ potBeforeHeroResponse: number, heroFoldCost: number }}
 *
 * potBeforeHeroResponse = pot if hero just calls (not yet adding hero's call amount).
 * Specifically: villain's S + hero's already-committed R + dead blinds + dead-3bettor's contribution.
 * (When villain 3-bets, hero faces a call of S - R to continue.)
 */
export const computeThreeBetCtx = ({ R, S = 10, deadFolders = [] }) => {
  let deadMoney = 0;
  if (deadFolders.includes('SB')) deadMoney += 0.5;
  if (deadFolders.includes('BB')) deadMoney += 1.0;

  // Pot if hero calls: hero's R (already in) + hero's call amount (S - R) + villain's S + dead = 2S + dead.
  // But heroFoldCost is what hero loses by folding now: just the R already invested.
  const heroFoldCost = R;

  // Pot if hero calls and we go to flop = 2S + dead.
  const potIfCall = 2 * S + deadMoney;
  // Hero's incremental call amount = S - R.
  const heroCallAmount = S - R;

  return {
    potIfCall,
    heroCallAmount,
    heroFoldCost,
    threeBetSize: S,
  };
};

/**
 * Pot math for hero's 4-bet branch.
 *
 * Sequence: hero opens R → villain 3-bets to S → hero 4-bets to F.
 * Live 1/2 standard 4-bet sizes IP: ~22-25 BB. v1 uses F = 23 BB.
 *
 * @param {Object} ctx
 * @param {number} ctx.R - hero's open size
 * @param {number} ctx.S - villain's 3-bet size
 * @param {number} ctx.F - hero's 4-bet size
 * @param {string[]} ctx.deadFolders
 * @returns {{ heroFourBetCost: number, potIfVillainFolds: number, potIfVillainCalls4Bet: number, fiveBetJamSize: number, heroCallJamCost: number, potIfCallJam: number }}
 */
export const computeFourBetCtx = ({ R, S = 10, F = 23, deadFolders = [] }) => {
  let deadMoney = 0;
  if (deadFolders.includes('SB')) deadMoney += 0.5;
  if (deadFolders.includes('BB')) deadMoney += 1.0;

  // Hero's 4-bet cost: F (replaces the open R, so incremental = F - R).
  const heroFourBetCost = F;

  // If villain folds to 4-bet: hero wins the 3-bet pot = villain's S + dead + hero's R-portion-now-3bet-return.
  // Hero net gain = villain's S + dead. (Hero's R + (F-R) = F goes back since no one called.)
  const potIfVillainFolds = S + deadMoney;

  // If villain calls 4-bet: pot at flop = 2F + dead.
  const potIfVillainCalls4Bet = 2 * F + deadMoney;

  // If villain 5-bet jams: assume jam to 100 BB effective (eff_stack = 100).
  // Hero faces a call of (100 - F) to win pot (100 + F + dead).
  const fiveBetJamSize = 100;
  const heroCallJamCost = fiveBetJamSize - F;
  const potIfCallJam = fiveBetJamSize + F + deadMoney;

  return {
    heroFourBetCost,
    potIfVillainFolds,
    potIfVillainCalls4Bet,
    fiveBetJamSize,
    heroCallJamCost,
    potIfCallJam,
  };
};
