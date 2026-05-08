/**
 * divergenceReport.js — markdown formatter for comparator output.
 *
 * Produces a divergence report with:
 *   1. Run config
 *   2. Confusion matrix + Jaccard overlap
 *   3. Width comparison (derived vs reference)
 *   4. Missing hands (top 20)
 *   5. Extra hands (top 20)
 *   6. Boundary EVs (full)
 *   7. Confound decomposition (text section attributing possible delta sources)
 */

const fmtPct = (x) => `${(x * 100).toFixed(1)}%`;
const fmtEV = (x) => `${x >= 0 ? '+' : ''}${x.toFixed(3)} BB`;
const fmt = (x, digits = 3) => x.toFixed(digits);

/**
 * @param {Object} args
 * @param {string} args.position - 'BTN' or 'UTG'
 * @param {Object} args.config - { openSize, effStack, mcTrials, mcConvergenceThreshold }
 * @param {Object} args.comparison - output of compareToReference()
 * @param {Object} args.scenarioProbs - the joint/scenario probability table used (for transparency)
 * @returns {string} markdown
 */
export const formatDivergenceReport = ({ position, config, comparison, scenarioProbs }) => {
  const { confusion, overlap, referenceWidth, derivedWidth, missing, extra, boundary } = comparison;
  const { tp, fp, fn, tn } = confusion;
  const lines = [];

  lines.push(`# MW-Equity Validation — Divergence Report — ${position}`);
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  // 1. Run config
  lines.push('## Run Config');
  lines.push('');
  lines.push(`- **Position:** ${position}`);
  lines.push(`- **Reference target:** \`PREFLOP_CHARTS.${position}\` (\`src/utils/pokerCore/rangeMatrix.js:200-210\`; GTO 9-max 100bb)`);
  lines.push(`- **Open size (R):** ${config.openSize} BB`);
  lines.push(`- **Effective stack:** ${config.effStack} BB`);
  lines.push(`- **MC trials per scenario-class:** ${config.mcTrials}`);
  lines.push(`- **MC convergence threshold:** ${config.mcConvergenceThreshold}`);
  lines.push(`- **Range-behind model source:** \`getPopulationPrior(positionBucket, action)\` from \`src/utils/rangeEngine/populationPriors.js\``);
  lines.push(`- **3-bet response model:** \`heroResponseToThreeBet\` (3-tier strength bucket per WS-168 plan)`);
  lines.push('');

  // 2. Scenario probabilities used
  if (scenarioProbs) {
    lines.push('### Scenario probabilities (hand-authored)');
    lines.push('');
    lines.push('```');
    lines.push(JSON.stringify(scenarioProbs, null, 2));
    lines.push('```');
    lines.push('');
  }

  // 3. Confusion matrix + overlap
  lines.push('## Confusion Matrix (combo-weighted, /1326 total)');
  lines.push('');
  lines.push('|              | In Reference | Not in Reference |');
  lines.push('|--------------|--------------|------------------|');
  lines.push(`| **In Derived**     | TP=${tp} | FP=${fp} |`);
  lines.push(`| **Not in Derived** | FN=${fn} | TN=${tn} |`);
  lines.push('');
  lines.push(`**Jaccard overlap:** ${fmtPct(overlap)}  (TP / (TP + FP + FN))`);
  lines.push(`**Reference width:** ~${referenceWidth}%  |  **Derived width:** ~${derivedWidth}%`);
  lines.push('');

  // 4. Missing hands (top 20)
  lines.push(`## Missing hands (in reference, not derived) — top 20 of ${missing.length}`);
  lines.push('');
  if (missing.length === 0) {
    lines.push('_(none — derived range covers all reference hands)_');
  } else {
    lines.push('| # | Hand | EV (derived) | Reference weight | Strength tier |');
    lines.push('|---|------|--------------|------------------|---------------|');
    missing.slice(0, 20).forEach((m, i) => {
      const tier = (((m.idx >> 4) + (m.idx & 15)) / 32).toFixed(2); // approx; not load-bearing
      lines.push(`| ${i+1} | ${m.label} | ${fmtEV(m.ev)} | ${fmt(m.refWeight, 2)} | ~${tier} |`);
    });
  }
  lines.push('');

  // 5. Extra hands (top 20)
  lines.push(`## Extra hands (in derived, not reference) — top 20 of ${extra.length}`);
  lines.push('');
  if (extra.length === 0) {
    lines.push('_(none — derived range is a subset of reference)_');
  } else {
    lines.push('| # | Hand | EV (derived) |');
    lines.push('|---|------|--------------|');
    extra.slice(0, 20).forEach((e, i) => {
      lines.push(`| ${i+1} | ${e.label} | ${fmtEV(e.ev)} |`);
    });
  }
  lines.push('');

  // 6. Boundary EVs
  lines.push(`## Boundary EVs (|EV| < 0.5 BB) — ${boundary.length} hands`);
  lines.push('');
  if (boundary.length === 0) {
    lines.push('_(none — all hands are decisively in or out)_');
  } else {
    lines.push('| Hand | EV | In Reference? |');
    lines.push('|------|-----|---------------|');
    boundary.forEach((b) => {
      lines.push(`| ${b.label} | ${fmtEV(b.ev)} | ${b.inReference ? 'yes' : 'no'} |`);
    });
  }
  lines.push('');

  // 7. Confound decomposition
  lines.push('## Confound Decomposition');
  lines.push('');
  lines.push('Possible sources of delta between derived and reference (in approximate decreasing-likelihood order for v1):');
  lines.push('');
  lines.push('1. **Population priors vs GTO frame** — `populationPriors.js` is calibrated to live 1/2 (looser, more passive). PREFLOP_CHARTS is GTO. Live regs over-fold premium opens and under-3bet from the blinds vs GTO, so derived ranges are expected to come in **tighter than the chart** (less fold equity in the open scenario → fewer EV-positive marginal opens).');
  lines.push('');
  lines.push('2. **Joint probability authoring** — the (sb_action, bb_action) joint distribution for BTN (or the 5-scenario truncation for UTG) is hand-authored from live 1/2 baselines. Cell-level error of ±5% is plausible.');
  lines.push('');
  lines.push('3. **3-bet response model coarseness** — 3-tier strength bucket (4bet / call / fold) approximates a mixed-frequency GTO response. Boundary combos (JJ, AKo) get hard-coded `call` instead of GTO\'s ~50/50 mix. Affects EV near the response-tier boundaries.');
  lines.push('');
  lines.push('4. **Engine math (`handVsRangesMW`)** — covered by HU-degenerate parity test in `monteCarloEquity.test.js`. If reference and derived widths diverge >20%, suspect engine; otherwise priors/joint table dominate.');
  lines.push('');
  lines.push('5. **5-bet recursion truncation** — depth-3 capped with hardcoded stack-off heuristic. Affects only the 4-bet branch EV for premium hands; expected impact <0.1 BB on top-tier combos.');
  lines.push('');
  lines.push('6. **Live-1/2 chart-regime drift** — PREFLOP_CHARTS is rake-free GTO 100bb 2.5x. Harness pins 2.5x and 100bb to match. No straddle, no limpers (folded-to-hero). All match.');
  lines.push('');

  // 8. Verification footer
  lines.push('## Verification spot-checks');
  lines.push('');
  lines.push('Expected sanity bounds (if any of these fail, harness is broken — not a population-prior signal):');
  lines.push('');
  lines.push('- AA must be in derived range. Currently: ' + (comparison.both.find(h => h.label === 'AA') ? '✓' : '✗ FAIL'));
  lines.push('- KK must be in derived range. Currently: ' + (comparison.both.find(h => h.label === 'KK') ? '✓' : '✗ FAIL'));
  lines.push('- 72o must NOT be in derived range. Currently: ' + (comparison.extra.find(h => h.label === '72o') || comparison.both.find(h => h.label === '72o') ? '✗ FAIL' : '✓'));
  lines.push('');

  return lines.join('\n');
};
