/**
 * geometryAblation.mjs — does STREET add signal beyond GEOMETRY? (WS-333 Part D, AS-711)
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE CLAIM UNDER TEST.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * ADR-009 registers AS-711 (severity high, `status: proposed`):
 *
 *   > Decisions sharing pot-odds geometry — bet-to-pot ratio, SPR band, players remaining,
 *   > and whether the action closes — are the same decision problem and may be pooled across
 *   > streets and positions, materially raising decisions per cell.
 *
 * with this as its named falsifier:
 *
 *   > An ablation over well-sampled geometry cells that adds street back as a dimension and
 *   > measures whether it improves prediction beyond geometry alone — the same ablation
 *   > method that established HIERARCHY_ORDER, run on the same decisions with sample counts
 *   > reported. PASS: street adds no material signal beyond geometry across a majority of
 *   > well-sampled cells. If it does, pooling bought statistical power with bias.
 *
 * This module is that falsifier. It can refute the claim, and it is meant to.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * METHOD, AND THE TWO TRAPS IT AVOIDS.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * PAIRED, ON THE SAME DECISIONS. Every arm is scored on the identical EVAL decision set and
 * differenced PER DECISION, then averaged. Scoring arms on their own decision sets measures
 * the decisions, not the arms — `analyze_records.py` §0 makes the same point, and
 * `calibrationMetrics`' fallback-level table is the recorded example of getting it wrong
 * (log-loss rises monotonically by level, which reads as specificity paying off and is
 * actually a selection effect: deeper levels contain easier decisions).
 *
 * NO SPAN NORMALISATION. `reporter.mjs:217` records that the first ablation divided deltas
 * by `(none − full)`, assuming full context is the ceiling. The data refuted it, the span
 * went negative, and the fractions inverted. Raw log-loss deltas against an explicit
 * reference arm, always. **Geometry-only beating the full ladder is a legitimate result
 * here, not a bug** — it is in fact what AS-711 predicts.
 *
 * ADMISSIBILITY: a difference counts only if its paired 95% CI excludes zero. Same rule the
 * bake-off already applies. Everything else is reported as `n.s.` rather than as a small win.
 */

import { buildPolicyTable, queryPolicy, POLICY_HIERARCHY, POLICY_HIERARCHY_GEOMETRY, POLICY_HIERARCHY_GEOMETRY_ONLY, RESPONSES_BY_FACING } from './behaviorPolicy.mjs';

/** Floor on log-loss, matching `calibrationMetrics.LOG_LOSS_FLOOR`. */
const LOG_LOSS_FLOOR = 1e-6;

/** Per-cell sample floor for the cell-level report, matching `analyze_records.py` §3. */
export const MIN_CELL_N = 100;

/**
 * The arms.
 *
 * `ctrl:pooled` is the delete-it baseline — facingAction only. Every other arm has to beat
 * it to have earned its dimensions at all, which is the check that caught `street`,
 * `texture` and `posCategory` each being WORSE than pooling in WS-285.
 */
export const buildGeometryAblationArms = () => ([
  { name: 'ctrl:pooled', kind: 'control', hierarchy: [] },
  { name: 'ctrl:shipped', kind: 'control', hierarchy: POLICY_HIERARCHY },
  { name: 'geometry+street', kind: 'candidate', hierarchy: POLICY_HIERARCHY_GEOMETRY },
  { name: 'geometry-only', kind: 'candidate', hierarchy: POLICY_HIERARCHY_GEOMETRY_ONLY },
]);

/** Negative log-likelihood of the observed action under a predicted distribution. */
const logLossOf = (actions, observed) => {
  const p = Math.max(actions?.[observed] ?? 0, LOG_LOSS_FLOOR);
  return -Math.log(p);
};

/**
 * Mean, standard error and 95% CI of a paired difference.
 *
 * The paired form is what makes this admissible: both arms saw the same decision, so the
 * per-decision difference removes decision difficulty entirely and the remaining variance is
 * the thing being measured.
 */
export const pairedDelta = (deltas) => {
  const n = deltas.length;
  if (n < 2) return { n, mean: null, se: null, ciLow: null, ciHigh: null, verdict: 'insufficient' };
  const mean = deltas.reduce((a, b) => a + b, 0) / n;
  const variance = deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const se = Math.sqrt(variance / n);
  const ciLow = mean - 1.96 * se;
  const ciHigh = mean + 1.96 * se;
  // Sign convention: delta = arm − reference, and log-loss is a LOSS, so negative is better.
  const verdict = ciHigh < 0 ? 'BETTER' : ciLow > 0 ? 'WORSE' : 'n.s.';
  return { n, mean, se, ciLow, ciHigh, verdict };
};

/**
 * Score every arm on one held-out observation set.
 *
 * @param {Array} trainObs - POOL-half observations, used to BUILD each ladder
 * @param {Array} evalObs  - EVAL-half observations, used to SCORE every ladder
 */
export const runGeometryAblation = ({ trainObs, evalObs, arms = buildGeometryAblationArms() }) => {
  const tables = arms.map((arm) => ({
    arm,
    table: buildPolicyTable(trainObs, { partitionNote: 'ablation' }, { hierarchy: arm.hierarchy }),
  }));

  // Per-decision log-loss for every arm, in one pass, so the rows stay aligned and the
  // pairing is exact.
  const perArmLoss = new Map(arms.map((a) => [a.name, []]));
  const scored = [];
  for (const obs of evalObs) {
    const responses = RESPONSES_BY_FACING[obs.facingAction ?? 'none'];
    if (!responses || !responses.includes(obs.action)) continue;
    scored.push(obs);
    for (const { arm, table } of tables) {
      perArmLoss.get(arm.name).push(logLossOf(queryPolicy(table, obs).actions, obs.action));
    }
  }

  const lossOf = (name) => perArmLoss.get(name);
  const meanOf = (name) => {
    const xs = lossOf(name);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };

  // Every arm against the delete-it baseline, then the question WS-333 actually asks:
  // geometry+street against geometry-only.
  const vsPooled = arms.map((a) => ({
    arm: a.name,
    kind: a.kind,
    logLoss: meanOf(a.name),
    ...pairedDelta(lossOf(a.name).map((x, i) => x - lossOf('ctrl:pooled')[i])),
  }));

  const streetContribution = pairedDelta(
    lossOf('geometry+street').map((x, i) => x - lossOf('geometry-only')[i]),
  );

  return {
    decisionsScored: scored.length,
    arms: vsPooled,
    // THE ANSWER. delta = (geometry+street) − (geometry-only). Negative means adding street
    // back HELPED, i.e. geometry alone was losing signal and AS-711 is in trouble.
    streetContribution,
    verdict: streetVerdict(streetContribution),
    cells: cellReport(scored, tables, perArmLoss),
  };
};

/**
 * Turn the paired result into the language AS-711 is written in.
 *
 * Deliberately does NOT say "pooling is safe" on an `n.s.` result. An underpowered null is
 * not evidence of no effect, and the repo has a standing rule about exactly this:
 * small-and-measured and small-because-underpowered are different results.
 */
export const streetVerdict = (delta) => {
  if (delta.verdict === 'insufficient') return 'INSUFFICIENT — too few paired decisions to say anything';
  if (delta.verdict === 'BETTER') {
    return 'AS-711 FALSIFIED — street adds signal beyond geometry; pooling bought power with bias '
      + 'and the geometry key must stay split by street';
  }
  if (delta.verdict === 'WORSE') {
    return 'AS-711 SUPPORTED — adding street back made prediction WORSE, so geometry pooling is '
      + 'not merely safe but preferable on these decisions';
  }
  return 'AS-711 NOT REFUTED — street adds no measurable signal beyond geometry here. NOT the '
    + 'same as proven: report the effective sample before treating this as settled';
};

/**
 * Per-cell report over well-sampled geometry cells, with sample counts.
 *
 * AS-711's falsifier asks for "a majority of well-sampled cells", so the cell grain is part
 * of the acceptance criterion rather than a nicety. Thin cells are FLAGGED, never dropped —
 * the repo convention (`calibrationMetrics.aggregateBySlice`'s `thin` flag).
 */
const cellReport = (scored, tables, perArmLoss) => {
  const byCell = new Map();
  scored.forEach((obs, i) => {
    const key = [obs.sizeBucket ?? '?', obs.sprBand ?? '?', obs.closesAction ?? '?'].join('|');
    let cell = byCell.get(key);
    if (!cell) byCell.set(key, (cell = { key, n: 0, deltas: [] }));
    cell.n++;
    cell.deltas.push(
      perArmLoss.get('geometry+street')[i] - perArmLoss.get('geometry-only')[i],
    );
  });

  const cells = [...byCell.values()].map((c) => ({
    cell: c.key,
    n: c.n,
    thin: c.n < MIN_CELL_N,
    ...pairedDelta(c.deltas),
  })).sort((a, b) => b.n - a.n);

  const wellSampled = cells.filter((c) => !c.thin);
  const streetHelps = wellSampled.filter((c) => c.verdict === 'BETTER').length;

  return {
    cells,
    wellSampledCount: wellSampled.length,
    thinCount: cells.length - wellSampled.length,
    minCellN: MIN_CELL_N,
    streetHelpsInCells: streetHelps,
    // The majority test AS-711 is written against.
    majorityVerdict: wellSampled.length === 0
      ? 'no well-sampled cells'
      : (streetHelps > wellSampled.length / 2
        ? 'street helps in a MAJORITY of well-sampled cells — AS-711 falsified at cell grain'
        : 'street does not help in a majority of well-sampled cells'),
  };
};

/** Render the ablation for a terminal. */
export const renderGeometryAblation = (r) => {
  const L = [];
  const bb = (x) => (x === null || x === undefined ? '—' : x.toFixed(4));
  L.push('');
  L.push('═'.repeat(88));
  L.push('  GEOMETRY ABLATION — does STREET add signal beyond GEOMETRY? (AS-711)');
  L.push('═'.repeat(88));
  L.push('');
  L.push(`  ${r.decisionsScored} paired decisions, scored on the EVAL half`);
  L.push('');
  L.push('  ARMS vs ctrl:pooled (raw log-loss; negative delta = better; no span normalisation)');
  L.push('  ' + '─'.repeat(84));
  for (const a of r.arms) {
    L.push(`    ${a.arm.padEnd(20)} loss ${bb(a.logLoss)}   delta ${bb(a.mean).padStart(9)}   `
      + `CI [${bb(a.ciLow)}, ${bb(a.ciHigh)}]   ${a.verdict}`);
  }
  L.push('');
  L.push('  STREET CONTRIBUTION  (geometry+street) − (geometry-only)');
  L.push('  ' + '─'.repeat(84));
  const s = r.streetContribution;
  L.push(`    delta ${bb(s.mean)}   CI [${bb(s.ciLow)}, ${bb(s.ciHigh)}]   n=${s.n}   ${s.verdict}`);
  L.push('');
  L.push(`    ${r.verdict}`);
  L.push('');
  L.push(`  CELLS (n >= ${r.cells.minCellN} counted as well-sampled; thin cells flagged, never dropped)`);
  L.push('  ' + '─'.repeat(84));
  L.push(`    ${r.cells.wellSampledCount} well-sampled, ${r.cells.thinCount} thin`);
  L.push(`    street helps in ${r.cells.streetHelpsInCells} of ${r.cells.wellSampledCount}`);
  L.push(`    ${r.cells.majorityVerdict}`);
  L.push('');
  for (const c of r.cells.cells.slice(0, 12)) {
    L.push(`    ${c.cell.padEnd(28)} n=${String(c.n).padStart(6)}${c.thin ? ' (thin)' : '       '}  `
      + `delta ${bb(c.mean).padStart(9)}  ${c.verdict}`);
  }
  L.push('');
  L.push('═'.repeat(88));
  return L.join('\n');
};
