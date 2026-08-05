/**
 * statPriorScore.mjs — WS-284. The instrument that can actually see the Reference tier.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * WS-273's scorecard measures ONE thing: the villain ACTION DISTRIBUTION emitted
 * by `queryActionDistribution`. Two runs over the identical corpus — one with a
 * POOL-mined reference table, one with `--reference none` — returned numbers that
 * were identical to 16 significant figures.
 *
 * That was not a small effect. WS-284 traced the channel and it is severed, at a
 * point outside this harness:
 *
 *   resolveStatPriors  →  blended six-scalar priors        (differs: vpip .250→.198,
 *                                                           foldTo3Bet .550→.866, …)
 *        ↓
 *   derivePercentages(stats, statPriors)
 *        ↓                    ↓
 *   point estimates      intervals            ← the ONLY prior-carrying output
 *   (RAW k/n — the prior
 *    is not in them)
 *        ↓
 *   classifyStyle(pct)   ← reads vpip / pfr / af, i.e. the RAW estimates
 *        ↓
 *   style → buildActionPriors(style) → the distribution this harness scores
 *
 * So the tier is loaded, validated and blended, and then its value terminates in
 * `pct.intervals`, which the scored path never reads. Inertness is CORRECT for
 * that measurement — and it means `--reference` and its 19 leakage tests were
 * ceremony over a channel no reported number depended on.
 *
 * This module is WS-284 accept-criterion (a): score the decision class the six
 * scalar priors DO feed, on the same two-level split, so `--reference` becomes
 * falsifiable instead of unfalsifiable.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IT MEASURES
 *
 * At every walk-forward checkpoint, the engine holds a posterior belief about six
 * scalar rates for this villain — vpip, pfr, threeBet, cbet, foldToCbet,
 * foldTo3Bet — formed from the training prefix plus the resolved prior:
 *
 *     p̂ = (k_train + α) / (n_train + α + β)
 *
 * That belief is scored, as a Bernoulli log-loss, against what the villain
 * actually did in the NEXT window of hands. The baseline is the identical
 * computation under the static founder estimate (`STAT_PRIORS`).
 *
 * The lift therefore answers exactly the WS-263 question: **does the imported
 * HandHQ reference predict a held-out player's future behaviour better than the
 * founder's hand-authored guess?** With `--reference none` the resolved prior IS
 * the founder estimate, so the lift is exactly 0 — a run whose lift is 0.0 is a
 * run in which the tier did nothing, and that is now visible in the output rather
 * than discoverable only by diffing two whole scorecards.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LEAKAGE
 *
 * This instrument inherits both levels of the split unchanged and adds no new
 * channel: the priors come from POOL players (channel 1, stamped table + the
 * EVAL-only scoring assertion), the scored window is strictly after the training
 * prefix (channel 2, asserted per window by `LeakageGuard.assertStatWindow`), and
 * the villain's own hands are excluded from any founder-observed pool stage
 * (`excludePlayerId`, the leave-one-out guard poolBaseline already implements).
 *
 * It also gives those assertions something to defend: unlike the action
 * scorecard, THIS number moves if the reference table is mined from the players
 * it scores.
 *
 * CAVEAT, inherited: HandHQ online cash, July 2009, numeric stakes (SRC-011).
 */

import { STAT_COUNT_FIELDS, resolveStatPriors } from '../../src/utils/exploitEngine/poolBaseline.js';
import { STAT_PRIORS } from '../../src/utils/exploitEngine/bayesianConfidence.js';

/** The six scalar proportions the Reference tier feeds. */
export const SCORED_STATS = Object.keys(STAT_COUNT_FIELDS);

/** Keeps log-loss finite when a posterior sits at the boundary. */
const EPS = 1e-9;
const clamp = (p) => Math.min(1 - EPS, Math.max(EPS, p));

/** Posterior-predictive rate for the next trial, given a prefix and a Beta prior. */
const posteriorRate = (k, n, prior) => (k + prior.alpha) / (n + prior.alpha + prior.beta);

/** Mean Bernoulli log-loss of belief `p` against `k` successes in `n` trials. */
const bernoulliLogLoss = (p, k, n) => {
  const q = clamp(p);
  return -((k * Math.log(q)) + ((n - k) * Math.log(1 - q))) / n;
};

/** Pull (k, n) for one stat out of a buildPlayerStats running-totals object. */
const countsFor = (stats, stat) => {
  const f = STAT_COUNT_FIELDS[stat];
  return { k: stats?.[f.num] || 0, n: stats?.[f.den] || 0 };
};

/**
 * Score one walk-forward window's six scalar beliefs.
 *
 * This is the SAME `resolveStatPriors` call the runner uses to build the
 * percentages it feeds the model, so the priors scored here are the priors the
 * run actually ran on — not a parallel reconstruction that could drift from it.
 *
 * @param {Object} p
 * @param {*}      p.playerId
 * @param {Object} p.trainStats - buildPlayerStats over hands [0, cp)
 * @param {Object} p.testStats  - buildPlayerStats over hands [cp, cp+interval)
 * @param {string|null} p.segmentKey
 * @param {'6max'|'full'|null} p.seatBucket
 * @param {Array|null} [p.referenceTable=null] - the guard-validated POOL table; null = tier off
 * @param {Map|null}   [p.poolIndex=null]      - no founder-observed pool for a corpus villain
 * @param {Object} [p.staticPriors=STAT_PRIORS]
 * @returns {{ priors: Object, records: Array, priorsDiverged: boolean }}
 */
export const scoreStatPriorWindow = ({
  playerId,
  trainStats,
  testStats,
  segmentKey,
  seatBucket,
  referenceTable = null,
  poolIndex = null,
  staticPriors = STAT_PRIORS,
}) => {
  const priors = resolveStatPriors({
    poolIndex,
    segmentKey,
    excludePlayerId: playerId,
    referenceTable,
    seatBucket,
    staticPriors,
  });

  const records = [];
  let priorsDiverged = false;

  for (const stat of SCORED_STATS) {
    const prior = priors[stat] || staticPriors[stat];
    const base = staticPriors[stat];
    if (prior.alpha !== base.alpha || prior.beta !== base.beta) priorsDiverged = true;

    const train = countsFor(trainStats, stat);
    const test = countsFor(testStats, stat);
    if (test.n <= 0) continue;

    const pModel = posteriorRate(train.k, train.n, prior);
    const pBaseline = posteriorRate(train.k, train.n, base);

    records.push({
      stat,
      nTrain: train.n,
      kTrain: train.k,
      nTest: test.n,
      kTest: test.k,
      pModel,
      pBaseline,
      actualRate: test.k / test.n,
      logLossModel: bernoulliLogLoss(pModel, test.k, test.n),
      logLossBaseline: bernoulliLogLoss(pBaseline, test.k, test.n),
    });
  }

  return { priors, records, priorsDiverged };
};

/** Trial-weighted mean of a per-record field. */
const weighted = (records, field) => {
  let num = 0;
  let den = 0;
  for (const r of records) { num += r[field] * r.nTest; den += r.nTest; }
  return den > 0 ? num / den : null;
};

/**
 * Aggregate window records into a scorecard.
 *
 * @param {Array} records - concatenated `scoreStatPriorWindow().records`
 * @param {Object} [meta] - { referenceMode, windows, divergedWindows }
 */
export const buildStatPriorScorecard = (records, meta = {}) => {
  const rows = SCORED_STATS.map((stat) => {
    const rs = records.filter(r => r.stat === stat);
    const trials = rs.reduce((s, r) => s + r.nTest, 0);
    const logLoss = weighted(rs, 'logLossModel');
    const baselineLogLoss = weighted(rs, 'logLossBaseline');
    return {
      stat,
      windows: rs.length,
      trials,
      logLoss,
      baselineLogLoss,
      lift: baselineLogLoss ? (baselineLogLoss - logLoss) / baselineLogLoss : null,
      avgPredicted: weighted(rs, 'pModel'),
      avgActual: weighted(rs, 'actualRate'),
    };
  }).filter(r => r.trials > 0);

  const logLoss = weighted(records, 'logLossModel');
  const baselineLogLoss = weighted(records, 'logLossBaseline');

  return {
    referenceMode: meta.referenceMode ?? null,
    windows: meta.windows ?? null,
    divergedWindows: meta.divergedWindows ?? null,
    overall: {
      windowRecords: records.length,
      trials: records.reduce((s, r) => s + r.nTest, 0),
      logLoss,
      baselineLogLoss,
      lift: baselineLogLoss ? (baselineLogLoss - logLoss) / baselineLogLoss : null,
    },
    perStat: rows,
  };
};

/**
 * REGRESSION GATE — the reason WS-284 exists.
 *
 * A run that declares a reference table and then produces a number identical to
 * the no-reference run has an inert tier. That happened for the life of WS-273
 * and was only caught because a human diffed two scorecards by eye. It is now a
 * hard failure of the run that claims the tier.
 *
 * Throws unless BOTH hold: the resolved priors actually differed from the founder
 * estimate at some checkpoint, and the resulting score actually moved.
 *
 * @param {Object} card - from buildStatPriorScorecard
 */
export const assertReferenceTierLive = (card) => {
  if (card.referenceMode !== 'pool-train') return true;

  if (!card.divergedWindows) {
    throw new Error(
      'Backtest refused: --reference supplied a POOL table, but the resolved stat priors ' +
      'were identical to the static founder estimate at every checkpoint. The Reference ' +
      'tier is INERT in this run (WS-284). Check the segment key — resolveReferenceCounts ' +
      'serves online/<numeric-stake> segments only.',
    );
  }

  const { logLoss, baselineLogLoss } = card.overall;
  if (logLoss == null || baselineLogLoss == null) {
    throw new Error(
      'Backtest refused: --reference supplied a POOL table but no stat window was scored, ' +
      'so the tier could not have affected any reported number (WS-284).',
    );
  }
  if (logLoss === baselineLogLoss) {
    throw new Error(
      'Backtest refused: the Reference tier moved the priors but NOT the score — ' +
      `log-loss ${logLoss} is bit-identical to the founder-estimate baseline. That is the ` +
      'WS-284 failure mode returning: a mandatory flag over a channel no number depends on.',
    );
  }
  return true;
};

const num = (v, d = 4) => (v == null ? 'n/a' : v.toFixed(d));
const pctf = (v) => (v == null ? '   n/a' : `${(v * 100).toFixed(1)}%`);

/**
 * Render the stat-prior scorecard as console text.
 * @param {Object} card
 * @param {string} caveat
 * @returns {string}
 */
export const renderStatPriorScorecard = (card, caveat = '') => {
  const L = [];
  L.push('');
  L.push('═'.repeat(78));
  L.push('  WS-284 REFERENCE-TIER SCORECARD — the six scalar priors, walk-forward');
  L.push('═'.repeat(78));
  if (caveat) L.push(`  ${caveat}`);
  L.push('─'.repeat(78));
  L.push(`  reference tier      ${card.referenceMode}`);
  L.push(`  windows scored      ${card.windows} (${card.divergedWindows} with priors ≠ founder estimate)`);
  L.push('');
  L.push('  Belief = (k_train + α) / (n_train + α + β), scored against the NEXT window.');
  L.push('  Baseline = the same belief under the static founder estimate (STAT_PRIORS).');
  L.push('  LIFT is exactly 0.0% when the Reference tier is off — that is the point.');
  L.push('');
  L.push('  stat          windows   trials    log-loss   baseline    lift    pred / actual');
  for (const r of card.perStat) {
    L.push(
      `    ${r.stat.padEnd(12)}${String(r.windows).padStart(6)}${String(r.trials).padStart(9)}` +
      `   ${num(r.logLoss)}   ${num(r.baselineLogLoss)}  ${pctf(r.lift)}` +
      `   ${pctf(r.avgPredicted)} / ${pctf(r.avgActual)}`,
    );
  }
  const o = card.overall;
  L.push('  ' + '─'.repeat(74));
  L.push(
    `    ${'OVERALL'.padEnd(12)}${String(o.windowRecords).padStart(6)}${String(o.trials).padStart(9)}` +
    `   ${num(o.logLoss)}   ${num(o.baselineLogLoss)}  ${pctf(o.lift)}`,
  );
  L.push('');
  return L.join('\n');
};
