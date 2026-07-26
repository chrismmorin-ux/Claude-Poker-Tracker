/**
 * evCost.mjs — WS-273. Converting a prediction error into money, where that
 * conversion is honest.
 *
 * THE SCOPE DECISION (founder-approved 2026-07-26). The ticket asks for the cost
 * of every simplification in bb/100. Prediction accuracy is directly measurable
 * everywhere; converting an accuracy error into money generally requires pushing
 * it through the whole EV pipeline, which is a large build in its own right.
 *
 * ONE decision class converts cheaply and exactly: FOLD-VS-BET. When a villain
 * faces a bet, the model's fold-probability estimate is the single input that
 * decides whether a hero bluff is profitable, and the engine already owns that
 * arithmetic (`calcBluffEV`, POKER_THEORY §6.1/§6.3). No new machinery, no new
 * assumptions about ranges or equity. Every other class reports accuracy only,
 * and full bb/100 coverage is a follow-up ticket — stated, not quietly dropped.
 *
 * WHAT THE NUMBER MEANS: REGRET, NOT ERROR.
 *
 * A fold-estimate error costs nothing if it does not change hero's decision. If
 * the model says villains fold 55% and they really fold 50%, but a bluff is
 * profitable at both, the error is free. The cost is only realised when the
 * error flips the decision across the breakeven fold frequency
 * (`betSize / (potSize + betSize)`, POKER_THEORY §6.3).
 *
 * So we measure REGRET:
 *
 *   1. hero acts on the MODEL's fold estimate  → bluff iff EV_bluff(predicted) > 0
 *   2. that action is settled at the TRUE rate → realised = EV_bluff(actual) or 0
 *   3. an oracle acts on the true rate         → optimal  = max(0, EV_bluff(actual))
 *   4. regret = optimal − realised   (≥ 0, in big blinds)
 *
 * Scaled ×100, that is bb/100 — the same unit as a winrate, so it can be
 * compared against one.
 *
 * THIS IS A LOWER BOUND on the cost of a bad villain model, not a total. It
 * prices ONE decision (whether to fire a bluff at this node) and ignores
 * multi-street consequences, sizing choices, and hero's own range. Reported as
 * such wherever it appears.
 */

import { calcBluffEV } from '../../src/utils/exploitEngine/foldEquityCalculator.js';

/**
 * Percentile bootstrap CI for the mean of a heavy-tailed sample.
 *
 * Regret is mostly zeros with a long right tail, so the mean is a legitimate EV
 * statistic (EV is additive — rare big losses genuinely count) but a badly
 * ESTIMATED one at these sample sizes. Quoting it bare implies a precision the
 * data does not support; an interval says "12 ± 9", which is honest.
 *
 * Deterministic LCG rather than Math.random: a backtest must reproduce exactly,
 * and an interval that moves between identical runs is worse than none.
 *
 * @returns {{mean, lo, hi, n, resamples}|null}
 */
export const bootstrapMeanCI = (values, { resamples = 2000, alpha = 0.05, seed = 0x9e3779b9 } = {}) => {
  const n = values?.length ?? 0;
  if (n < 2) return null;

  let state = seed >>> 0;
  const nextIdx = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % n;
  };

  const means = new Array(resamples);
  for (let b = 0; b < resamples; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += values[nextIdx()];
    means[b] = sum / n;
  }
  means.sort((a, b) => a - b);

  const at = (q) => means[Math.min(resamples - 1, Math.max(0, Math.floor(q * resamples)))];
  const mean = values.reduce((s, v) => s + v, 0) / n;

  return { mean, lo: at(alpha / 2), hi: at(1 - alpha / 2), n, resamples };
};

/**
 * Records must face a BET for the bridge to apply.
 *
 * Facing a RAISE is deliberately excluded. It is a structurally different
 * decision — there is already money in from this seat, the pot geometry and the
 * breakeven both shift, and treating a raise node with the pure-bluff formula
 * produces wild per-decision numbers driven by pot size rather than by model
 * error. The founder-approved scope is the fold-vs-bet class; widening it here
 * would be quietly reporting a number nobody sanctioned.
 */
const APPLICABLE_FACING = new Set(['bet']);

/**
 * Regret in big blinds for a single fold-vs-bet decision node.
 *
 * @param {Object} params
 * @param {number} params.potBB       - pot before the decision, in big blinds
 * @param {number} params.betBB       - the bet being answered, in big blinds
 * @param {number} params.predictedFold - model's P(fold)
 * @param {number} params.actualFold  - empirical P(fold) for this slice
 * @returns {number|null} regret in bb, or null when inputs are unusable
 */
export const foldEstimateRegretBB = ({ potBB, betBB, predictedFold, actualFold }) => {
  if (![potBB, betBB, predictedFold, actualFold].every(Number.isFinite)) return null;
  if (potBB <= 0 || betBB <= 0) return null;

  // heroEquity 0 = a pure bluff, the cleanest case: all the value comes from
  // fold equity, so the fold estimate is the ONLY input that matters. Including
  // an equity term would require assuming hero's holding, which we do not know.
  // calcBluffEV returns a breakdown object; `.ev` is the scalar in bb.
  const evAt = (foldPct) =>
    calcBluffEV({ potSize: potBB, betSize: betBB, foldPct, heroEquity: 0 }).ev;

  const heroBluffs = evAt(predictedFold) > 0;
  const trueEV = evAt(actualFold);

  const realised = heroBluffs ? trueEV : 0;
  const optimal = Math.max(0, trueEV);

  return Math.max(0, optimal - realised);
};

/**
 * Price the fold-vs-bet class across a record set.
 *
 * The empirical fold rate is computed PER GROUP rather than per record: a single
 * observation is a 0 or a 1, and comparing a probability against a coin flip
 * measures variance, not calibration.
 *
 * GROUPING DEFAULTS TO BET SIZE, AND THAT CHOICE IS LOAD-BEARING. Breakeven fold
 * frequency is `bet / (pot + bet)` — a pure function of bet-to-pot ratio. Within
 * a size bucket the breakeven is near-constant, so one group-average fold rate
 * can be fairly compared against it. Grouping by SPR zone (the first attempt
 * here) mixed sizings whose breakevens differ threefold and charged one average
 * fold rate against every pot in the group; micro-SPR spots, where the pot is
 * huge relative to the stack, then dominated the mean and inflated the headline
 * roughly thirtyfold. That was an artefact of the grouping, not a cost.
 *
 * Both a mean and a MEDIAN are reported. Regret is heavy-tailed — a handful of
 * very large pots move the mean a long way — so a mean quoted alone overstates
 * the typical case.
 *
 * @param {Array} records - prediction records from the runner
 * @param {Object} [opts]
 * @param {string} [opts.groupBy='sizeBucket'] - slice key defining a fold-rate group
 * @param {number} [opts.minGroupN=20] - groups thinner than this are reported but excluded
 * @returns {Object} { applicable, groups, bbPer100Hands, bbPer100Decisions, note }
 */
export const priceFoldVsBet = (records, { groupBy = 'sizeBucket', minGroupN = 20 } = {}) => {
  const applicable = (records || []).filter(r =>
    APPLICABLE_FACING.has(r?.slices?.facingAction)
    && Number.isFinite(r?._meta?.potBB)
    && Number.isFinite(r?._meta?.facingBetBB)
    && Number.isFinite(r?.predicted?.fold),
  );

  const groups = new Map();
  for (const r of applicable) {
    const key = `${r.slices.facingAction}|${r.slices?.[groupBy] ?? 'unknown'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const rows = [];
  let totalRegret = 0;
  let totalN = 0;

  for (const [key, rows_] of groups) {
    const n = rows_.length;
    const actualFold = rows_.filter(r => r.actual === 'fold').length / n;
    const predictedFold = rows_.reduce((s, r) => s + r.predicted.fold, 0) / n;

    let regretSum = 0;
    const regrets = [];
    for (const r of rows_) {
      const regret = foldEstimateRegretBB({
        potBB: r._meta.potBB,
        betBB: r._meta.facingBetBB,
        predictedFold: r.predicted.fold,
        actualFold,
      });
      if (regret != null) { regretSum += regret; regrets.push(regret); }
    }
    const priced = regrets.length;
    regrets.sort((a, b) => a - b);
    const median = priced > 0
      ? (priced % 2 ? regrets[(priced - 1) / 2] : (regrets[priced / 2 - 1] + regrets[priced / 2]) / 2)
      : null;

    const thin = n < minGroupN;
    const row = {
      group: key,
      n,
      thin,
      predictedFold,
      actualFold,
      foldError: predictedFold - actualFold,
      avgRegretBB: priced > 0 ? regretSum / priced : null,
      medianRegretBB: median,
      bbPer100Decisions: priced > 0 ? (regretSum / priced) * 100 : null,
      medianBbPer100Decisions: median != null ? median * 100 : null,
      // The share of decisions where the estimate error actually flipped the
      // bluff/no-bluff call. This is the number that makes the mean readable:
      // "3% of spots cost anything at all, and those cost a lot" is a finding;
      // an unexplained mean of 97 is not.
      nonZeroShare: priced > 0 ? regrets.filter(v => v > 0).length / priced : null,
      _regrets: regrets,
    };
    rows.push(row);

    if (!thin && priced > 0) { totalRegret += regretSum; totalN += priced; }
  }

  rows.sort((a, b) => b.n - a.n);

  // Bootstrap CI on the pooled mean.
  //
  // Regret is heavy-tailed — most decisions cost exactly zero and a few large
  // pots carry the whole average — so the mean is a legitimate EV statistic
  // (EV is additive; rare big losses genuinely count) but a BADLY ESTIMATED one
  // at these sample sizes. Quoting it without an interval implies a precision
  // the data does not support. The interval is what says "this is 12 ± 9",
  // which is an honest answer, rather than "83", which is not.
  //
  // Deterministic LCG rather than Math.random so a run is reproducible.
  const allRegrets = [];
  for (const r of rows) {
    if (!r.thin && Array.isArray(r._regrets)) allRegrets.push(...r._regrets);
  }
  const bootstrap = bootstrapMeanCI(allRegrets);

  for (const r of rows) delete r._regrets;

  // TWO DENOMINATORS, AND THEY MEAN DIFFERENT THINGS.
  //
  // `bbPer100Decisions` is regret per 100 decisions OF THIS CLASS. It is the
  // right number for comparing slices against each other, and the WRONG number
  // to compare against a winrate — facing a bet is not something that happens
  // once per hand.
  //
  // `bbPer100Hands` divides the same total regret by the hands those decisions
  // actually came from. THAT is the winrate-comparable figure. Reporting only
  // the first would overstate the cost by the frequency of the spot, which is
  // exactly the kind of number that gets quoted out of context.
  const handsRepresented = new Set(
    applicable.map(r => r?._meta?.handId).filter(id => id != null),
  ).size;

  return {
    applicable: applicable.length,
    handsRepresented,
    groupBy,
    minGroupN,
    groups: rows,
    totalRegretBB: totalRegret,
    bbPer100Decisions: totalN > 0 ? (totalRegret / totalN) * 100 : null,
    bbPer100Hands: handsRepresented > 0 ? (totalRegret / handsRepresented) * 100 : null,
    // 95% bootstrap CI on the per-decision mean, ×100 for bb/100-decisions.
    bbPer100DecisionsCI: bootstrap
      ? { lo: bootstrap.lo * 100, hi: bootstrap.hi * 100, resamples: bootstrap.resamples }
      : null,
    // Share of priced decisions where the error actually flipped the decision.
    nonZeroShare: bootstrap && bootstrap.n > 0
      ? allRegrets.filter(v => v > 0).length / bootstrap.n
      : null,
    note:
      'Fold-vs-BET class only (facing a raise is excluded — different pot geometry). ' +
      'Regret from the fold estimate flipping the bluff/no-bluff decision across breakeven ' +
      '(POKER_THEORY §6.3), priced with calcBluffEV at heroEquity=0. A LOWER BOUND on the ' +
      'cost of a bad villain model: one node, one decision, no multi-street or sizing ' +
      'consequences. Other decision classes report accuracy only.',
  };
};
