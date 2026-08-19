/**
 * buildRangeCharts — the preflop range charts, with the measured half and the assumed half
 * kept visibly apart.
 *
 * FOUNDER, 2026-08-18: *"defining the villain's preflop range is also needed. As many charts as
 * needed to fully describe what we know from his showdowns and open rates."*
 *
 * TWO CLAIMS, TWO EVIDENCE BASES, AND THEY MUST NOT BE DRAWN THE SAME WAY.
 *
 *   WIDTH is MEASURED. It comes from every decision he took in the spot, cards or no cards,
 *   and it is as solid as anything in this repo. A villain who enters 12.8% first-in refutes
 *   an 8% opening range outright with no card ever shown.
 *
 *   COMPOSITION is ASSUMED. The only hard constraints are the hands actually turned face up,
 *   and there are 27 of them across 1,937 decisions. Everything between those points is there
 *   because WE imposed a strength ordering and filled to the measured width. That is a
 *   convention, not an observation about him.
 *
 * THE ORDERING IS NAMED, because an unnamed ordering is an invisible assumption. We use
 * `EQUITY_VS_OPEN` (preflopEquityTable.js) — committed Monte-Carlo equity per hand class
 * against an opening range, ~+/-35bp sampling error. It is a property of the deck plus a
 * stated reference range, NOT a chart convention, which matters because the whole finding
 * here is that his ranges are not charts.
 *
 * THE CHART CARRIES ITS OWN FALSIFIER. For each entry type we count how many of his SHOWN
 * hands fall outside the equity-ordered range of his measured width. A shown hand outside the
 * range is a hand he demonstrably plays that the assumed ordering excludes — which refutes the
 * ordering for him, not the width. That count is printed on every chart.
 *
 * SURVIVOR BIAS RUNS ONE WAY AND IT MAKES THE WEAK HANDS THE STRONG EVIDENCE. A hand reaches
 * showdown by CONTINUING, so strong hands are over-represented among the revealed. Seeing him
 * turn over aces is what the filter produces anyway and tells us almost nothing. Seeing a small
 * pair or a suited connector survive that filter is evidence running AGAINST the bias, which
 * is what makes it load-bearing.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { EQUITY_VS_OPEN, HAND_LABELS } from '../../src/utils/pokerCore/preflopEquityTable.js';
import { PREFLOP_CHARTS, decodeIndex } from '../../src/utils/pokerCore/rangeMatrix.js';

export const TOTAL_COMBOS = 1326;

/** Combos per hand class: pairs 6, suited 4, offsuit 12. */
export const combosOf = (idx) => {
  const { isPair, suited } = decodeIndex(idx);
  return isPair ? 6 : suited ? 4 : 12;
};

export const wilson = (k, n, z = 1.96) => {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
};

/**
 * Normalise a shown holding to its hand-class label: "KdKc" and "K♦K♣" both -> "KK".
 *
 * The corpus writes suits as UNICODE GLYPHS. A first version stripped anything outside
 * `[2-9TJQKAshdc]`, which silently ate ♠♥♦♣ and left a two-character string — so the suit
 * comparison read `undefined` and every hand would have been classified from ranks alone.
 * Mapped explicitly rather than stripped, because "suited or not" is the entire difference
 * between 76s and 76o and they sit 30 classes apart in the ordering.
 */
const SUIT_GLYPH = { '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };
export const toClass = (cards) => {
  const R = '23456789TJQKA';
  const s = String(cards)
    .replace(/[♠♥♦♣]/g, (m) => SUIT_GLYPH[m])
    .replace(/[^2-9TJQKAshdc]/gi, '');
  if (s.length < 4) throw new Error(`cannot classify holding "${cards}" — got "${s}"`);
  const r1 = s[0].toUpperCase(), s1 = s[1].toLowerCase();
  const r2 = s[2].toUpperCase(), s2 = s[3].toLowerCase();
  const hi = R.indexOf(r1) >= R.indexOf(r2) ? r1 : r2;
  const lo = R.indexOf(r1) >= R.indexOf(r2) ? r2 : r1;
  if (r1 === r2) return `${hi}${lo}`;
  return `${hi}${lo}${s1 === s2 ? 's' : 'o'}`;
};

/**
 * Fill an equity-ordered range to a target width.
 *
 * The boundary class is kept as a FRACTION rather than rounded in or out. Rounding a class in
 * overstates the range and rounding it out understates it, and at these widths one class is
 * several percent of the whole — the boundary is where the assumption is doing the most work,
 * so it is drawn as partial rather than hidden.
 */
export const fillToWidth = (widthShare, equityKey) => {
  const eq = EQUITY_VS_OPEN[equityKey];
  if (!eq) throw new Error(`no equity table for ${equityKey}`);
  const order = [...eq.keys()].sort((a, b) => eq[b] - eq[a]);
  const target = widthShare * TOTAL_COMBOS;

  const cells = new Map();          // label -> weight in [0,1]
  let used = 0;
  for (const idx of order) {
    if (used >= target) break;
    const c = combosOf(idx);
    const room = target - used;
    const weight = room >= c ? 1 : room / c;
    cells.set(HAND_LABELS[idx], weight);
    used += c * weight;
  }
  return { cells, usedCombos: used, targetCombos: target, order };
};

/** Which conventional chart, if any, sits closest to this spot — for CONTRAST, never as truth. */
export const conventionalChart = (chartKey) => {
  const chart = PREFLOP_CHARTS[chartKey];
  if (!chart) return null;
  const cells = new Map();
  let combos = 0;
  for (let i = 0; i < chart.length; i++) {
    if (chart[i] > 0) { cells.set(HAND_LABELS[i], chart[i]); combos += combosOf(i) * chart[i]; }
  }
  return { cells, combos, share: combos / TOTAL_COMBOS };
};

/**
 * Build one chart.
 *
 * @param {Object} spec
 * @param {string} spec.id
 * @param {string} spec.title
 * @param {number} spec.k        - times he took the entry action
 * @param {number} spec.n        - times he faced the spot
 * @param {string} spec.equityKey - EARLY | MIDDLE | LATE | SB | BB
 * @param {string|null} spec.chartKey - a PREFLOP_CHARTS key for contrast
 * @param {string[]} spec.shown  - holdings observed taking this entry action
 */
export const buildChart = (spec) => {
  const { id, title, k, n, equityKey, chartKey = null, shown = [], note = '' } = spec;
  const rate = n ? k / n : 0;
  const [lo, hi] = wilson(k, n);
  const { cells, usedCombos, targetCombos } = fillToWidth(rate, equityKey);

  const shownClasses = shown.map(toClass);
  const inside = shownClasses.filter((c) => (cells.get(c) ?? 0) > 0);
  const outside = shownClasses.filter((c) => (cells.get(c) ?? 0) === 0);

  // A shown hand is a HARD CONSTRAINT: he demonstrably plays it here. So it is force-included
  // at weight 1 regardless of where the ordering put it, and the fact that the ordering
  // excluded it is recorded rather than smoothed away.
  const withConstraints = new Map(cells);
  for (const c of shownClasses) withConstraints.set(c, 1);

  const conventional = chartKey ? conventionalChart(chartKey) : null;
  const conventionalMisses = conventional
    ? shownClasses.filter((c) => (conventional.cells.get(c) ?? 0) === 0)
    : [];

  return {
    id, title, note,
    measured: {
      k, n, rate, ci: [lo, hi],
      widthCombos: Math.round(targetCombos),
      ciCombos: [Math.round(lo * TOTAL_COMBOS), Math.round(hi * TOTAL_COMBOS)],
    },
    ordering: {
      basis: `EQUITY_VS_OPEN.${equityKey}`,
      description: 'hand classes sorted by Monte-Carlo equity against an opening range (committed table, ~±35bp)',
      filledCombos: Math.round(usedCombos),
    },
    cells: [...withConstraints.entries()].map(([label, weight]) => ({
      label,
      weight,
      confirmed: shownClasses.includes(label),
      // A cell the ordering excluded but the evidence forces in. The most informative cell on
      // the chart: it is where the assumed shape is measurably wrong.
      contradictsOrdering: shownClasses.includes(label) && (cells.get(label) ?? 0) === 0,
    })).sort((a, b) => HAND_LABELS.indexOf(a.label) - HAND_LABELS.indexOf(b.label)),
    evidence: {
      shownCount: shownClasses.length,
      shownClasses,
      insideOrdering: inside,
      outsideOrdering: outside,
      // THE FALSIFIER, printed on every chart.
      orderingRefuted: outside.length > 0,
    },
    conventional: conventional ? {
      key: chartKey,
      share: conventional.share,
      combos: conventional.combos,
      shownHandsTheChartExcludes: conventionalMisses,
    } : null,
  };
};

export const renderChartAscii = (chart) => {
  const R = '23456789TJQKA'.split('').reverse();
  const on = new Map(chart.cells.map((c) => [c.label, c]));
  const lines = [];
  lines.push(`${chart.title}  —  ${(chart.measured.rate * 100).toFixed(1)}% `
    + `[${(chart.measured.ci[0] * 100).toFixed(1)}-${(chart.measured.ci[1] * 100).toFixed(1)}]  `
    + `k/n ${chart.measured.k}/${chart.measured.n}  ~${chart.measured.widthCombos} combos`);
  for (const hi of R) {
    let row = '  ';
    for (const lo of R) {
      const iH = R.indexOf(hi), iL = R.indexOf(lo);
      const label = iH === iL ? `${hi}${lo}` : iH < iL ? `${hi}${lo}s` : `${lo}${hi}o`;
      const c = on.get(label);
      row += !c ? ' . ' : c.contradictsOrdering ? ' ! ' : c.confirmed ? ' * ' : c.weight >= 1 ? ' # ' : ' + ';
    }
    lines.push(row);
  }
  lines.push(`  # assumed in · + boundary (partial) · * CONFIRMED by showdown · ! confirmed but ordering excluded it`);
  if (chart.evidence.orderingRefuted) {
    lines.push(`  ORDERING REFUTED for this spot: ${chart.evidence.outsideOrdering.join(', ')} shown, outside the assumed range.`);
  }
  return lines.join('\n');
};

export const buildAllCharts = (specs) => specs.map(buildChart);

// ─── CLI ─────────────────────────────────────────────────────────────────────
if (process.argv[1] && process.argv[1].endsWith('buildRangeCharts.mjs')) {
  const { readFileSync } = await import('node:fs');
  const specs = JSON.parse(readFileSync(process.env.SPECS || '.tmp-arch/chart-specs.json', 'utf8'));
  const charts = buildAllCharts(specs);
  mkdirSync('.tmp-arch', { recursive: true });
  writeFileSync(process.env.OUT || '.tmp-arch/range-charts.json', JSON.stringify(charts, null, 1));
  for (const c of charts) { console.log(renderChartAscii(c)); console.log(); }
  const refuted = charts.filter((c) => c.evidence.orderingRefuted);
  console.log(`ORDERING REFUTED on ${refuted.length} of ${charts.length} charts: `
    + refuted.map((c) => c.id).join(', '));
}
