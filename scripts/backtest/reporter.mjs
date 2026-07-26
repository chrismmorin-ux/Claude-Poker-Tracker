/**
 * reporter.mjs — WS-273 scorecard rendering.
 *
 * CAVEATS TRAVEL WITH THE NUMBERS. WS-262/263 made the corpus caveats binding:
 * online pools only, July 2009 era, numeric stakes. A backtest number says the
 * model predicts THAT population; live 1/2 generalisation is an assumption, not
 * a finding. This reporter attaches `CORPUS_CAVEAT` to every emitted table and
 * repeats it in the console output, because a caveat stated once in a footer is
 * a caveat that gets quoted away from.
 */

import {
  scoreWithBaseline,
  computeCalibration,
  analyzeFallbackQuality,
  aggregateAllSlices,
} from '../../src/utils/exploitEngine/calibrationMetrics.js';
import { priceFoldVsBet } from './evCost.mjs';

export const CORPUS_CAVEAT =
  'HandHQ online cash, July 2009, numeric stakes (SRC-011). Measures prediction ' +
  'against THAT population. Live 1/2 generalisation is an assumption, not a result.';

const pct = (v) => (v == null ? '   n/a' : `${(v * 100).toFixed(1)}%`);
const num = (v, d = 4) => (v == null ? 'n/a' : v.toFixed(d));

/**
 * Build the full scorecard object from a run result.
 *
 * @param {Object} run - from runBacktest
 * @returns {Object} scorecard, JSON-serialisable
 */
export const buildScorecard = (run) => {
  const { records } = run;
  const overall = scoreWithBaseline(records);

  return {
    caveat: CORPUS_CAVEAT,
    generatedFrom: {
      config: run.config,
      counters: run.counters,
      integrity: run.integrity,
      runtimeMs: run.runtimeMs,
    },
    overall: {
      ...overall.model,
      baselineLogLoss: overall.baseline.logLoss,
      baselineBrier: overall.baseline.brier,
      baselineAccuracy: overall.baseline.accuracy,
      lift: overall.lift,
      caveat: CORPUS_CAVEAT,
    },
    calibration: {
      buckets: computeCalibration(records),
      caveat: CORPUS_CAVEAT,
    },
    fallbackQuality: {
      levels: analyzeFallbackQuality(records),
      caveat: CORPUS_CAVEAT,
    },
    slices: {
      ...aggregateAllSlices(records, { minN: 30 }),
      caveat: CORPUS_CAVEAT,
    },
    // The one decision class that converts to money without new machinery.
    evCost: {
      ...priceFoldVsBet(records),
      caveat: CORPUS_CAVEAT,
    },
  };
};

/**
 * Render a scorecard as console text.
 * @returns {string}
 */
export const renderScorecard = (card) => {
  const L = [];
  const { overall, generatedFrom } = card;

  L.push('');
  L.push('═'.repeat(78));
  L.push('  WS-273 ENGINE BACKTEST — villain action prediction');
  L.push('═'.repeat(78));
  L.push(`  ${card.caveat}`);
  L.push('─'.repeat(78));

  L.push('  INTEGRITY');
  L.push(`    reference tier      ${generatedFrom.integrity.referenceMode}`);
  L.push(`    partition           poolPct=${generatedFrom.integrity.poolPct} (eval players scored only)`);
  L.push(`    eval players        ${generatedFrom.integrity.evalPlayersChecked}`);
  L.push(`    walk-forward checks ${generatedFrom.integrity.decisionsChecked}`);
  L.push('');

  L.push('  RUN');
  L.push(`    hierarchy variant   ${generatedFrom.config.hierarchyVariant}`);
  L.push(`    hands read          ${generatedFrom.counters.handsRead}`);
  L.push(`    players scored      ${generatedFrom.counters.scoredPlayers} of ${generatedFrom.counters.eligiblePlayers} eligible`);
  L.push(`    checkpoints         ${generatedFrom.counters.checkpoints} (${generatedFrom.counters.skippedCheckpoints} skipped)`);
  L.push(`    decisions scored    ${generatedFrom.counters.decisionsScored}`);
  L.push(`    runtime             ${(generatedFrom.runtimeMs / 1000).toFixed(1)}s`);
  L.push('');

  L.push('  OVERALL  (lift vs population prior is the headline; raw log-loss alone means nothing)');
  L.push(`    n                   ${overall.n}`);
  L.push(`    log-loss            ${num(overall.logLoss)}   baseline ${num(overall.baselineLogLoss)}`);
  L.push(`    brier               ${num(overall.brier)}   baseline ${num(overall.baselineBrier)}`);
  L.push(`    accuracy            ${pct(overall.accuracy)}   baseline ${pct(overall.baselineAccuracy)}`);
  L.push(`    LIFT                ${pct(overall.lift)}${overall.lift != null && overall.lift < 0 ? '  ← model LOSES to the prior' : ''}`);
  if (overall.impossibleActuals > 0) {
    L.push(`    impossible actuals  ${overall.impossibleActuals}  ← model assigned zero probability to an observed action`);
  }
  L.push('');

  L.push('  CALIBRATION  (when it says X%, does it happen X%?)');
  L.push('    bucket        n      predicted   actual    error');
  for (const b of card.calibration.buckets) {
    if (b.count === 0) continue;
    L.push(`    ${b.label.padEnd(10)} ${String(b.count).padStart(6)}   ${pct(b.avgPredicted)}    ${pct(b.actualRate)}   ${num(b.error, 3)}`);
  }
  L.push('');

  L.push('  FALLBACK LADDER  (does specificity earn its keep?)');
  L.push('    level          n       log-loss   brier    accuracy');
  for (const lv of card.fallbackQuality.levels) {
    L.push(`    ${lv.source.padEnd(12)} ${String(lv.count).padStart(6)}   ${num(lv.avgLogLoss)}   ${num(lv.avgBrier)}   ${pct(lv.accuracy)}`);
  }
  L.push('');

  const ev = card.evCost;
  L.push('  COST OF THE FOLD ESTIMATE  (the one class that converts to money cheaply)');
  if (!ev || ev.applicable === 0) {
    L.push('    no fold-vs-bet decisions with pot context in this run');
  } else {
    const ci = ev.bbPer100DecisionsCI;
    L.push(`    applicable nodes    ${ev.applicable} across ${ev.handsRepresented} hands, grouped by ${ev.groupBy}`);
    L.push(`    COST                ${ev.bbPer100Hands == null ? 'n/a' : ev.bbPer100Hands.toFixed(2)} bb/100 HANDS  ← winrate-comparable`);
    L.push(`                        ${ev.bbPer100Decisions == null ? 'n/a' : ev.bbPer100Decisions.toFixed(2)} bb/100 decisions of this class`);
    if (ci) {
      L.push(`    95% CI              [${ci.lo.toFixed(2)}, ${ci.hi.toFixed(2)}] bb/100 dec  (${ci.resamples} bootstrap resamples)`);
    }
    if (ev.nonZeroShare != null) {
      L.push(`    decisions that cost ${pct(ev.nonZeroShare)} — the rest are FREE (the error did not flip the call)`);
    }
    L.push('    group                    n    pred fold  actual   error    bb/100 dec   costly%');
    for (const g of ev.groups) {
      L.push(
        `    ${g.group.padEnd(22)} ${String(g.n).padStart(5)}   ${pct(g.predictedFold)}  ${pct(g.actualFold)}  ` +
        `${(g.foldError >= 0 ? '+' : '') + (g.foldError * 100).toFixed(1)}pp   ` +
        `${(g.bbPer100Decisions == null ? 'n/a' : g.bbPer100Decisions.toFixed(2)).padStart(9)}   ` +
        `${pct(g.nonZeroShare)}${g.thin ? ' (thin)' : ''}`,
      );
    }
    L.push(`    ${ev.note}`);
  }
  L.push('');

  for (const [dim, rows] of Object.entries(card.slices)) {
    if (dim === 'caveat' || !Array.isArray(rows) || rows.length === 0) continue;
    L.push(`  BY ${dim.toUpperCase()}`);
    L.push('    slice              n       log-loss   lift      accuracy');
    for (const r of rows) {
      const thin = r.thin ? ' (thin)' : '';
      L.push(`    ${String(r.slice).padEnd(16)} ${String(r.n).padStart(6)}   ${num(r.logLoss)}   ${pct(r.lift).padStart(7)}   ${pct(r.accuracy)}${thin}`);
    }
    L.push('');
  }

  L.push('─'.repeat(78));
  L.push(`  ${card.caveat}`);
  L.push('═'.repeat(78));
  L.push('');

  return L.join('\n');
};

/**
 * ABLATION REPORT — "what should I be paying attention to at the table?"
 *
 * Ranks each context dimension by how much predictive accuracy it carries, in
 * two readings that answer different practical questions:
 *
 *   ONLY  — this dimension alone, against nothing. "If I could track exactly one
 *           thing about a spot, which one earns its keep?"
 *   DROP  — everything except this dimension. "Given I already track the rest,
 *           what does this one still add?" — i.e. what I can stop recording.
 *
 * Both are expressed as a share of the total information the full context
 * carries, so they read as percentages of an achievable ceiling rather than as
 * raw log-loss units nobody can interpret.
 *
 *   captureShare = (none.logLoss - only.logLoss) / (none.logLoss - full.logLoss)
 *   marginal     = (drop.logLoss - full.logLoss) / (none.logLoss - full.logLoss)
 *
 * A dimension can be LOW on marginal and HIGH on capture — that means it is
 * informative but redundant with what you already record. For a live-capture
 * decision that is the crucial distinction, and it is invisible if you only
 * measure one of the two.
 *
 * @param {Object} run - a runBacktest result carrying recordsByArm + arms
 * @returns {Object} ranked dimensions + the two controls
 */
export const buildAblationReport = (run) => {
  const scoreOf = (name) => {
    const recs = run.recordsByArm?.[name];
    return recs ? scoreWithBaseline(recs) : null;
  };

  const full = scoreOf('ctrl:full');
  const none = scoreOf('ctrl:none');
  const shipped = scoreOf('shipped');

  if (!full || !none || full.model.logLoss == null || none.model.logLoss == null) {
    return { available: false, reason: 'ablation controls missing from this run' };
  }

  // NO NORMALISATION BY A "SPAN".
  //
  // The first version of this report divided every dimension by
  // (none.logLoss - full.logLoss), assuming full context is the ceiling and
  // facing-action alone is the floor. The data refuted that assumption: full
  // context routinely scores WORSE than facing-action alone, because a fully
  // specified spot has almost no observations for a given villain, falls below
  // MIN_EFFECTIVE_N, and answers from the bare population prior instead. The
  // "span" is therefore often NEGATIVE, and dividing by it produced inverted
  // nonsense.
  //
  // That inversion is not noise — it is the central result (see `specificityCost`
  // below), and it is exactly why the fallback ladder is load-bearing. So the
  // report now compares everything to the honest reference point — facing-action
  // alone, the cheapest thing you could possibly track — in raw log-loss units,
  // where NEGATIVE delta means the dimension helped.
  const ref = none.model.logLoss;
  const dims = (run.arms || []).filter(a => a.kind === 'only').map(a => a.dim);

  const rows = dims.map((dim) => {
    const only = scoreOf(`only:${dim}`);
    const drop = scoreOf(`drop:${dim}`);
    return {
      dimension: dim,
      onlyLogLoss: only?.model.logLoss ?? null,
      onlyAccuracy: only?.model.accuracy ?? null,
      // Negative = tracking this ONE thing beats tracking nothing.
      onlyDelta: only?.model.logLoss != null ? only.model.logLoss - ref : null,
      dropLogLoss: drop?.model.logLoss ?? null,
      // Negative = the full context is BETTER without this dimension.
      dropDelta: drop?.model.logLoss != null && full.model.logLoss != null
        ? drop.model.logLoss - full.model.logLoss
        : null,
      n: only?.model.n ?? 0,
    };
  }).sort((a, b) => (a.onlyDelta ?? Infinity) - (b.onlyDelta ?? Infinity));

  return {
    available: true,
    caveat: CORPUS_CAVEAT,
    controls: {
      fullLogLoss: full.model.logLoss,
      noneLogLoss: none.model.logLoss,
      shippedLogLoss: shipped?.model.logLoss ?? null,
      fullAccuracy: full.model.accuracy,
      noneAccuracy: none.model.accuracy,
      // > 0 means specifying the spot fully HURTS relative to not specifying it
      // at all — the data-starvation effect the ladder exists to counter.
      specificityCost: full.model.logLoss - none.model.logLoss,
    },
    dimensions: rows,
    note:
      'onlyDelta = log-loss change from tracking THIS DIMENSION ALONE versus tracking ' +
      'nothing but the action faced. NEGATIVE = it helped. dropDelta = change from ' +
      'removing it from full context; NEGATIVE = full context is better WITHOUT it. ' +
      'Ranked best-first by onlyDelta, which is the table-capture question. ' +
      'specificityCost > 0 means full context loses to no context, because narrow ' +
      'spots run out of observations and fall back to the bare prior.',
  };
};

/** Render the ablation report as console text. */
export const renderAblation = (ab, labels = {}) => {
  if (!ab?.available) return `\n  (ablation unavailable: ${ab?.reason ?? 'unknown'})\n`;
  const L = [];
  const c = ab.controls;
  L.push('');
  L.push('═'.repeat(78));
  L.push('  WHAT ACTUALLY CARRIES THE INFORMATION');
  L.push('  "what minimum pieces of info make the most difference at the table"');
  L.push('═'.repeat(78));
  L.push(`  ${ab.caveat}`);
  L.push('─'.repeat(78));
  L.push(`  reference  facing-action only   log-loss ${num(c.noneLogLoss)}   accuracy ${pct(c.noneAccuracy)}`);
  L.push(`  full spot  every dimension     log-loss ${num(c.fullLogLoss)}   accuracy ${pct(c.fullAccuracy)}`);
  L.push(`  shipped    ladder as built     log-loss ${num(c.shippedLogLoss)}`);
  L.push('');
  if (c.specificityCost > 0) {
    L.push(`  ⚠ SPECIFYING THE SPOT FULLY COSTS ${num(c.specificityCost)} LOG-LOSS vs specifying nothing.`);
    L.push('    Narrow spots run out of observations for a given villain, drop below the');
    L.push('    minimum-evidence bar, and answer from the bare population prior. This is');
    L.push('    the data-starvation effect the fallback ladder exists to counter.');
    L.push('');
  }
  L.push('  ranked by what ONE dimension alone buys you (negative = helps):');
  L.push('  dimension                        alone Δ    accuracy   drop Δ     n');
  for (const d of ab.dimensions) {
    const label = (labels[d.dimension] || d.dimension).padEnd(30);
    const sign = (v) => (v == null ? '   n/a' : (v >= 0 ? '+' : '') + v.toFixed(4));
    L.push(`  ${label} ${sign(d.onlyDelta).padStart(8)}   ${pct(d.onlyAccuracy).padStart(7)}   ${sign(d.dropDelta).padStart(8)}   ${d.n}`);
  }
  L.push('');
  L.push(`  ${ab.note}`);
  L.push('═'.repeat(78));
  L.push('');
  return L.join('\n');
};

/**
 * Compare two runs of the same corpus under different variants — the
 * "cost of a simplification" output.
 *
 * @param {Object} baseCard - scorecard for the control arm
 * @param {Object} variantCard
 * @returns {Object} per-slice deltas
 */
export const compareScorecards = (baseCard, variantCard) => {
  const deltaOf = (a, b) => (a == null || b == null ? null : b - a);

  const sliceDeltas = {};
  for (const [dim, rows] of Object.entries(baseCard.slices)) {
    if (dim === 'caveat' || !Array.isArray(rows)) continue;
    const variantRows = new Map((variantCard.slices[dim] || []).map(r => [r.slice, r]));
    sliceDeltas[dim] = rows.map(r => {
      const v = variantRows.get(r.slice);
      return {
        slice: r.slice,
        n: r.n,
        baseLogLoss: r.logLoss,
        variantLogLoss: v?.logLoss ?? null,
        deltaLogLoss: deltaOf(r.logLoss, v?.logLoss),
      };
    });
  }

  return {
    caveat: CORPUS_CAVEAT,
    base: baseCard.generatedFrom.config.hierarchyVariant,
    variant: variantCard.generatedFrom.config.hierarchyVariant,
    overall: {
      baseLogLoss: baseCard.overall.logLoss,
      variantLogLoss: variantCard.overall.logLoss,
      deltaLogLoss: deltaOf(baseCard.overall.logLoss, variantCard.overall.logLoss),
      baseLift: baseCard.overall.lift,
      variantLift: variantCard.overall.lift,
    },
    slices: sliceDeltas,
  };
};
