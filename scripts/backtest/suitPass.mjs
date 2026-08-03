/**
 * suitPass.mjs — WS-323. Spend the finer grain only where the answer is in doubt.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY NOT JUST RUN 1,326 COMBOS
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * A 169-class cell is an approximation: `AKo` is twelve combos that differ by blockers and by
 * which suits are live, and the headline map prices ONE of them. The honest unit is the combo,
 * and the honest objection to using it everywhere is that it costs eight times the compute to
 * re-answer 1,174 cells whose intervals are nowhere near zero. `AA` from the button does not
 * become a fold because of a suit.
 *
 * So the pass is targeted: only cells whose interval STRADDLES ZERO — `fringe-tight` and
 * `unmeasured` — are re-priced at combo grain. That is the ticket's own argument applied one
 * level down. The honest answer to "don't brute-force more than needed" is to brute-force the
 * part that is genuinely small, and near zero is the only part where a suit could flip a sign.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THE PASS CAN FIND, AND THE TWO WAYS OF SAYING IT
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * `pointSignSplit` — the combos' point estimates fall on both sides of zero. This is WEAK
 *    evidence and is reported separately for exactly that reason: near zero, point estimates
 *    change sign from sampling noise alone, and a report that called that a finding would
 *    manufacture heterogeneity out of Monte Carlo error.
 *
 * `signSplit` — at least one combo's whole INTERVAL sits above zero and another's whole
 *    interval sits below. The intervals, not the estimates, establish the disagreement. THIS
 *    is the real finding, and it says something sharper than "this cell is marginal": it says
 *    THE CELL SHOULD NOT HAVE BEEN ONE CELL. A class whose suits genuinely disagree about
 *    whether to enter is a class the 169-grid cannot represent, and no amount of extra compute
 *    at class grain will fix that — only a finer partition will.
 *
 * `spread` is the plain magnitude — max margin minus min across combos. Compared against τ it
 * answers the practical question: is the within-class variation large enough for a player to
 * care about, or is the class a fair summary of its members?
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * `spread` IS BIASED UPWARD, AND `signSplit` IS NOT. READ THEM ACCORDINGLY.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * max-minus-min over a handful of NOISY estimates is a biased estimator of the true range: even
 * if every combo of a class had exactly the same margin, the sampled maximum would land above it
 * and the sampled minimum below, so `spread` would come out positive from Monte Carlo error
 * alone. The bias grows with the number of combos, which means a 12-combo offsuit class looks
 * more heterogeneous than a 6-combo pair for no reason but arithmetic.
 *
 * So `spreadExceedsTau` is a SCREEN, not a finding — it says "worth a look", and a large count
 * of them is partly a statement about how many replicates were run. `signSplit` is the finding,
 * because it asks the two combos' INTERVALS to establish opposite signs, and an interval that
 * already accounts for the noise cannot be tripped by it. When the two numbers disagree, the
 * conservative one is the one that means something.
 */

import { BANDS, bandOf } from './entryMap.mjs';

/** Schema version of the suit-pass artifact. */
export const SUIT_PASS_SCHEMA_VERSION = 1;

/** The bands whose cells the pass re-prices: precisely those whose interval straddles zero. */
export const STRADDLING_BANDS = Object.freeze([BANDS.FRINGE_TIGHT, BANDS.UNMEASURED]);

/**
 * The cells worth re-pricing, in the map's stable order.
 *
 * Deliberately keyed on BAND rather than on `|margin| < something`. The band already encodes
 * "the interval straddles zero", which is the property that makes a suit able to flip the
 * answer; a magnitude test on the point estimate would pick up confident cells that happen to
 * be small and miss uncertain ones that happen to be large.
 */
export const straddlingCells = (map) =>
  map.cells.filter((c) => STRADDLING_BANDS.includes(c.band));

const RANK_CHARS = 'AKQJT98765432';
const SUIT_CHARS = ['s', 'h', 'd', 'c'];

/**
 * Render an encoded card for the artifact.
 *
 * `cardParser` encodes as `rank * 4 + suit` with rank 0 = deuce and the suit index following
 * `SUITS = ['♠','♥','♦','♣']`. Letters rather than the unicode glyphs because this string ends
 * up in a JSON artifact that gets grepped, diffed and pasted into terminals.
 */
export const formatCard = (encoded) =>
  `${RANK_CHARS[12 - (encoded >> 2)]}${SUIT_CHARS[encoded & 3]}`;

export const formatCombo = (cards) => cards.map(formatCard).join('');

/**
 * Summarise one class's combos.
 *
 * @param {Object[]} combos - `{ cards, margin, lower, upper, halfWidth, ... }` per combo
 * @param {number} tauBB    - the τ the parent map was banded at
 */
export const summarizeCombos = (combos, tauBB) => {
  const priced = combos.filter((c) => typeof c.margin === 'number' && Number.isFinite(c.margin));
  if (priced.length === 0) {
    return {
      comboCount: combos.length, pricedCount: 0, degenerateCount: combos.length,
      minMargin: null, maxMargin: null, meanMargin: null, spread: null,
      spreadExceedsTau: null, pointSignSplit: null, signSplit: null, bands: {},
    };
  }

  const margins = priced.map((c) => c.margin);
  const min = Math.min(...margins);
  const max = Math.max(...margins);
  const mean = margins.reduce((a, b) => a + b, 0) / margins.length;
  const spread = max - min;

  const anyClearPlus = priced.some((c) => c.lower > 0);
  const anyClearMinus = priced.some((c) => c.upper < 0);

  const bands = priced.reduce((acc, c) => {
    const b = bandOf(c, tauBB);
    acc[b] = (acc[b] || 0) + 1;
    return acc;
  }, {});

  return {
    comboCount: combos.length,
    pricedCount: priced.length,
    degenerateCount: combos.length - priced.length,
    minMargin: min,
    maxMargin: max,
    meanMargin: mean,
    spread,
    spreadExceedsTau: spread > tauBB,
    // Weak: point estimates alone. Reported so it can be told apart from the strong claim.
    pointSignSplit: min < 0 && max > 0,
    // Strong: two combos' INTERVALS establish opposite signs. The class is not one cell.
    signSplit: anyClearPlus && anyClearMinus,
    bands,
  };
};

/**
 * Roll the per-cell summaries into the artifact's headline.
 *
 * `classesThatShouldNotBeOneCell` is the number this pass exists to produce. It is stated as a
 * count of CELLS rather than of hand classes because the same class can be a fair summary from
 * the button and a bad one from under the gun — the disagreement is a property of the spot, not
 * of the holding.
 */
export const suitPassHeadline = (cells, tauBB) => ({
  cellsRepriced: cells.length,
  combosEvaluated: cells.reduce((n, c) => n + c.summary.comboCount, 0),
  classesThatShouldNotBeOneCell: cells.filter((c) => c.summary.signSplit).length,
  pointSignSplitOnly: cells.filter((c) => c.summary.pointSignSplit && !c.summary.signSplit).length,
  spreadExceedsTau: cells.filter((c) => c.summary.spreadExceedsTau).length,
  tauBB,
});
