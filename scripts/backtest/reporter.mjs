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
    L.push(`    applicable nodes    ${ev.applicable} across ${ev.handsRepresented} hands, grouped by ${ev.groupBy}`);
    L.push(`    COST                ${ev.bbPer100Hands == null ? 'n/a' : ev.bbPer100Hands.toFixed(2)} bb/100 HANDS  ← winrate-comparable`);
    L.push(`                        ${ev.bbPer100Decisions == null ? 'n/a' : ev.bbPer100Decisions.toFixed(2)} bb/100 decisions of this class`);
    L.push('    group                    n    pred fold  actual   error    bb/100 dec');
    for (const g of ev.groups) {
      L.push(
        `    ${g.group.padEnd(22)} ${String(g.n).padStart(5)}   ${pct(g.predictedFold)}  ${pct(g.actualFold)}  ` +
        `${(g.foldError >= 0 ? '+' : '') + (g.foldError * 100).toFixed(1)}pp   ` +
        `${g.bbPer100Decisions == null ? 'n/a' : g.bbPer100Decisions.toFixed(2)}${g.thin ? ' (thin)' : ''}`,
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
