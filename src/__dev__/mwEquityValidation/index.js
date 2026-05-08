/**
 * mwEquityValidation/index.js — dev-console entry for the validation harness.
 *
 * Exposes:
 *   window.__validateMWEquity('BTN' | 'UTG', { mcTrials, openSize, ... })
 *     → runs the harness, prints the divergence report, returns the comparison object.
 *
 *   window.__validateMWEquity.help()
 *     → prints usage + supported positions.
 *
 * The harness runs entirely client-side; one position takes ~10–15 minutes
 * (BTN) or ~10 minutes (UTG with 5-scenario truncation) at default trials.
 *
 * For an offline/scriptable run, see `scripts/validate-mw-equity.cjs`.
 */

import { buildOpeningRange } from './derivation';
import { compareToReference } from './comparator';
import { formatDivergenceReport } from './divergenceReport';
import { PREFLOP_CHARTS } from '../../utils/pokerCore/rangeMatrix';

const help = () => {
  // eslint-disable-next-line no-console
  console.log(`
window.__validateMWEquity(position, opts) — MW equity solver-alignment validation

Positions (v1):
  'BTN'  — 2 opponents behind (SB + BB); 9-scenario joint-probability decomposition
  'UTG'  — 8 opponents behind; 5-scenario truncation (allFold / oneCaller / oneThreeBettor / multiwayFlat / squeeze)

Options (defaults shown):
  {
    openSize: 2.5,                 // BB; pinned to match GTO 9-max chart regime
    effStack: 100,                 // BB; documentation only (recursion uses 100 BB jam)
    mcTrials: 5000,                // per scenario-class
    mcConvergenceThreshold: 0.02,  // early-exit relative CI
  }

Returns: { derivedEV, comparison, report (markdown), config, scenarioProbs, cache, elapsedMs }

Tip: run BTN first (~10 min). Inspect divergence + boundary EVs before running UTG.
`);
};

const run = async (position, userOpts = {}) => {
  // eslint-disable-next-line no-console
  console.log(`[mwEquityValidation] starting derivation for ${position}...`);
  const start = performance.now();

  const onProgress = (done, total) => {
    if (done % 20 === 0 || done === total) {
      // eslint-disable-next-line no-console
      console.log(`[mwEquityValidation] ${position}: ${done}/${total} hand classes`);
    }
  };

  const { derivedEV, scenarioProbs, cache, config } = await buildOpeningRange(position, {
    ...userOpts,
    onProgress,
  });

  const reference = PREFLOP_CHARTS[position];
  if (!reference) throw new Error(`No PREFLOP_CHARTS reference for position '${position}'`);

  const comparison = compareToReference(derivedEV, reference);
  const report = formatDivergenceReport({ position, config, comparison, scenarioProbs });

  const elapsedMs = Math.round(performance.now() - start);
  // eslint-disable-next-line no-console
  console.log(`[mwEquityValidation] ${position} done in ${(elapsedMs / 1000).toFixed(1)}s. Cache size: ${cache.size()}.`);
  // eslint-disable-next-line no-console
  console.log(`[mwEquityValidation] Jaccard overlap: ${(comparison.overlap * 100).toFixed(1)}%; derived ~${comparison.derivedWidth}% vs reference ~${comparison.referenceWidth}%`);
  // eslint-disable-next-line no-console
  console.log('--- divergence report (markdown) ---');
  // eslint-disable-next-line no-console
  console.log(report);

  return {
    derivedEV,
    comparison,
    report,
    config,
    scenarioProbs,
    cache,
    elapsedMs,
  };
};

run.help = help;

if (typeof window !== 'undefined') {
  window.__validateMWEquity = run;
}

export { run };
