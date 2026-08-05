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

    // WS-374: the evidence the served prior rests on, carried on the prior itself.
    // Recorded per window because the resolution is per villain — the nearest-stake
    // substitution and the seat bucket can differ between two players in one run, and
    // an aggregate that hid that would be answering a question nobody asked.
    const ev = prior.evidence || null;
    const ref = ev && ev.reference;
    const pool = ev && ev.pool;

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
      // ── evidence behind the prior (WS-374) ──
      priorPseudocount: ev ? ev.totalPseudocount : prior.alpha + prior.beta,
      referenceN: ref ? ref.n : null,
      referenceK: ref ? ref.k : null,
      referenceRate: ref ? ref.rate : null,
      referenceLabel: ref ? ref.minedLabel : null,
      referenceBucket: ref ? ref.seatBucket : null,
      referenceStakeReach: ref && ref.requestedBb ? Math.abs(Math.log(ref.requestedBb / ref.referenceBb)) : null,
      referenceLimitedBy: ref ? ref.limitedBy : null,
      poolN: pool ? pool.n : null,
      poolPlayers: pool ? pool.players : null,
      poolLimitedBy: pool ? pool.limitedBy : null,
      // ── WS-373: WHICH POPULATION the prior describes ──
      // Per stage as well as overall, because the two stages can disagree: a
      // player-weighted reference blended under a hand-weighted founder pool is a real
      // future state, and the aggregate reads 'mixed' rather than picking one.
      priorWeighting: ev ? ev.weighting ?? null : null,
      referenceWeighting: ref ? ref.weighting ?? null : null,
      poolWeighting: pool ? pool.weighting ?? null : null,
      referenceWeightingDeclared: ref ? typeof ref.weighting === 'string' : null,
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

/** Distinct non-null values of a field, in first-seen order (small sets by construction). */
const distinct = (records, field) => {
  const out = [];
  for (const r of records) {
    const v = r[field];
    if (v == null) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out;
};

/**
 * Summarise the evidence behind one stat's served priors across a run (WS-374).
 *
 * `n` is reported as min/max rather than a mean: a run can resolve two villains to two
 * different mined rows, and a mean over 13,476,245 and 300 is a number that describes
 * neither. `limitedBy` says whether the stage's contribution was bounded by the data or
 * by the regularisation — a stage limited by `evidence` gets stronger with more mining,
 * one limited by `cap` never will.
 */
const summariseEvidence = (records) => {
  const refNs = records.map(r => r.referenceN).filter(n => n != null);
  const poolNs = records.map(r => r.poolN).filter(n => n != null);
  const reaches = records.map(r => r.referenceStakeReach).filter(x => x != null);
  return {
    windowsWithReference: refNs.length,
    referenceNMin: refNs.length ? Math.min(...refNs) : null,
    referenceNMax: refNs.length ? Math.max(...refNs) : null,
    referenceRows: distinct(records, 'referenceLabel'),
    referenceBuckets: distinct(records, 'referenceBucket'),
    maxStakeReachLogDist: reaches.length ? Math.max(...reaches) : null,
    referenceLimitedBy: distinct(records, 'referenceLimitedBy'),
    windowsWithPool: poolNs.length,
    poolNMin: poolNs.length ? Math.min(...poolNs) : null,
    poolNMax: poolNs.length ? Math.max(...poolNs) : null,
    poolLimitedBy: distinct(records, 'poolLimitedBy'),
    priorPseudocount: records.length ? records[0].priorPseudocount : null,
    // ── WS-373 ──
    // `distinct` drops nulls, so an undeclared basis would vanish from these lists and
    // read as "no reference stage" rather than "a reference stage that would not say".
    // The counter is what separates them, and it is what the guard tests.
    weightings: distinct(records, 'priorWeighting'),
    referenceWeightings: distinct(records, 'referenceWeighting'),
    poolWeightings: distinct(records, 'poolWeighting'),
    undeclaredWeightingWindows: records.filter(
      (r) => r.referenceN != null && r.referenceWeightingDeclared !== true,
    ).length,
  };
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
      // ── WS-374: what the served prior stands on, per stat ──
      // The prior's STRENGTH is capped (see poolBaseline's write-down), so it is the
      // same number whether the row behind it holds 13.5M hands or 300. These fields
      // are the only place that difference survives to a reader.
      evidence: summariseEvidence(rs),
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
/**
 * REGRESSION GATE — WS-374's half of the same rule.
 *
 * `assertReferenceTierLive` proves the tier MOVED the number. This proves the run can
 * still SAY WHAT IT MOVED ON. A scorecard whose priors came from a mined reference row
 * but which cannot name that row's n has re-severed the evidence channel — the exact
 * state HEAD was in, where `resolveReferenceCounts` computed `meta` on every call and
 * `resolveStatPriors` dropped it one line later, so a prior backed by 13,476,245 hands
 * and one backed by 300 were the same JavaScript number with nothing to tell them apart.
 *
 * This is a hard failure of the run, not a warning. A warning in a passing run is a
 * comment with extra steps.
 *
 * @param {Object} card - from buildStatPriorScorecard
 */
export const assertPriorEvidenceVisible = (card) => {
  if (card.referenceMode !== 'pool-train') return true;
  // Nothing scored at all is WS-284's failure, reported by WS-284's message. This gate
  // is about a run that DID score and cannot say what on.
  if (!card.perStat || card.perStat.length === 0) return true;

  const blind = card.perStat.filter(r => !r.evidence || !r.evidence.windowsWithReference);
  if (blind.length === card.perStat.length) {
    throw new Error(
      'Backtest refused: the resolved stat priors carry no reference evidence for any ' +
      'stat, so this run cannot say how much data its priors rest on (WS-374). ' +
      'resolveStatPriors must return the n and the resolution meta on the prior itself.',
    );
  }
  for (const r of blind) {
    throw new Error(
      `Backtest refused: stat "${r.stat}" was scored against a served prior with no ` +
      'recorded evidence (WS-374). A prior without its n cannot be shrunk against ' +
      'correctly and cannot be audited.',
    );
  }
  return true;
};

/**
 * REGRESSION GATE — WS-373. A prior must say WHICH POPULATION it describes.
 *
 * `assertPriorEvidenceVisible` proves the run can say HOW MUCH data its priors rest on.
 * This proves it can say WHAT THAT DATA IS A SAMPLE OF, which is a different question and
 * a larger one: on the shipped table the same six stats read 28.6% VPIP hand-weighted and
 * roughly 0.37–0.41 player-weighted. A 9–12pp gap on the most load-bearing preflop stat is
 * not a refinement — it is the difference between "the pool is tight" and "the pool is
 * loose", and a consumer holding 0.286 with no declared basis cannot tell which claim it
 * just made.
 *
 * The failure this refuses is the one that shipped: `HANDHQ_REFERENCE_META.weighting` has
 * existed since WS-325 and stopped at the table, so every consumer downstream was
 * ASSUMING a basis. Assuming is the failure; a run that cannot name its basis must stop.
 *
 * Note what this gate does NOT do: it does not require any PARTICULAR weighting. Which
 * basis is correct for serving priors is an open founder decision (WS-373) and the two
 * bases answer different questions — see the weighting block in `poolBaseline.js`. This
 * asserts only that the answer is recorded, not what it is.
 *
 * @param {Object} card - from buildStatPriorScorecard
 */
export const assertPriorWeightingDeclared = (card) => {
  if (card.referenceMode !== 'pool-train') return true;
  if (!card.perStat || card.perStat.length === 0) return true;

  for (const r of card.perStat) {
    const e = r.evidence || {};
    if (!e.windowsWithReference) continue;   // no reference stage → nothing to declare
    if (e.undeclaredWeightingWindows) {
      throw new Error(
        `Backtest refused: stat "${r.stat}" was scored against a reference prior whose ` +
        `WEIGHTING BASIS is undeclared in ${e.undeclaredWeightingWindows} of ` +
        `${e.windowsWithReference} windows (WS-373). A rate of 0.286 means one thing if it ` +
        'is the average HAND dealt and another if it is the average PLAYER — the shipped ' +
        'table differs by 9-12pp on VPIP between the two. Stamp `weighting` on the table ' +
        'rows (scripts/backtest/mine-pool-reference.py emits it) rather than letting the ' +
        'consumer assume one.',
      );
    }
  }
  return true;
};

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

  // WS-374 rides on the same gate deliberately: the two failures are one failure seen
  // twice — a tier that cannot be shown to matter, and a tier that cannot be shown to
  // rest on anything. Folding it in means every existing caller enforces both. It runs
  // LAST so the more specific WS-284 diagnoses keep their own messages.
  assertPriorEvidenceVisible(card);
  // WS-373 rides the same gate for the same reason, and runs after the evidence check:
  // "how much data" is a prerequisite for "a sample of what", so a run missing both
  // should hear about the missing evidence first.
  assertPriorWeightingDeclared(card);
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

  // WS-374. What each served prior actually stands on. The prior's STRENGTH is capped by
  // measured between-player overdispersion (WS-262), so it reads the same whether the row
  // behind it holds millions of hands or a handful — these columns are the only place that
  // difference reaches a reader.
  L.push('');
  L.push('  EVIDENCE BEHIND THE SERVED PRIOR — the prior\'s strength is capped, its n is not.');
  L.push('  stat          pseudo   reference n (min–max)   row / bucket        bound by   weighting');
  for (const r of card.perStat) {
    const e = r.evidence || {};
    const span = e.referenceNMin == null
      ? 'none'
      : (e.referenceNMin === e.referenceNMax
        ? String(e.referenceNMin)
        : `${e.referenceNMin}–${e.referenceNMax}`);
    const row = [...(e.referenceRows || []), ...(e.referenceBuckets || [])].join(' / ') || '—';
    // WS-373. UNDECLARED is printed loudly rather than blank: a blank reads as "not
    // applicable", and the whole defect was a basis nobody noticed was missing.
    const wt = (e.weightings || []).length ? e.weightings.join(',') : (e.windowsWithReference ? 'UNDECLARED' : '—');
    L.push(
      `    ${r.stat.padEnd(12)}${num(e.priorPseudocount, 1).padStart(6)}   ${span.padStart(21)}` +
      `   ${row.padEnd(19)} ${((e.referenceLimitedBy || []).join(',') || '—').padEnd(10)} ${wt}`,
    );
  }
  // The basis is not a footnote — it is what the numbers above are numbers ABOUT.
  L.push('');
  L.push('  WEIGHTING BASIS (WS-373). hand-weighted = the average HAND dealt, so high-volume');
  L.push('  players dominate; player-weighted = the average PLAYER. They answer different');
  L.push('  questions and differ by 9-12pp on VPIP. Which one SHOULD be served is an OPEN');
  L.push('  founder decision. All figures are ONLINE 2009 — TRANSFERRED to live, not measured.');
  if (card.perStat.some(r => r.evidence && r.evidence.windowsWithPool)) {
    for (const r of card.perStat) {
      const e = r.evidence || {};
      if (!e.windowsWithPool) continue;
      L.push(`    ${r.stat.padEnd(12)}pool n ${e.poolNMin}–${e.poolNMax} (${(e.poolLimitedBy || []).join(',')})`);
    }
  }
  L.push('');
  return L.join('\n');
};
