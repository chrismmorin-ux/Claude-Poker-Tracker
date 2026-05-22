/**
 * rangeEquityHistogram.js — Range Lab Phase 2 (WS-057) equity-distribution
 * + subrange-filter primitives.
 *
 * Two responsibilities, both consumed by the Custom (Range Lab) surface in
 * ExplorerMode:
 *
 *   1. filterCombosByGroups — PURE. Given a segmentRange output (the `.engine`
 *      field of handTypeBreakdown) + a set of HAND_TYPE_GROUPS ids, return the
 *      combos whose hand type falls in any selected group. This is a SELECTION
 *      filter only — it never touches equity.
 *
 *   2. computeEquityHistogram — async. Bins each combo's equity-vs-a-random-hand
 *      into an equity distribution. Equity is card math (handVsRange, the same
 *      exhaustive evaluator behind the WS-205 exact cache) — the bins are an
 *      OUTPUT of computed equity, never a label-driven narrowing. This is the
 *      correct direction of AP-RL-01 (POKER_THEORY §7.6): we read equity per
 *      combo and group by it; we do not narrow the range by bucket label.
 *
 * "vs random" = each combo's equity against a hand drawn uniformly at random
 * from all combos not blocked by the board or the combo's own cards — the
 * standard Flopzilla "equity distribution vs random hand" baseline. handVsRange
 * handles the dead-card exclusion (hero + board) for us.
 *
 * The histogram is a Monte-Carlo estimate (carries sampling noise); it is a
 * separate, clearly-labelled study readout from the exact `equityCache` kernel
 * pinned by INV-LSW-RL-EQUITY-PARITY. There is still ONE equity implementation
 * (handVsRange / bestFiveFromSeven) — no second source to drift.
 *
 * Scope is the flop (Custom mode renders the flop breakdown; turn/river
 * per-street evolution is Phase 3 / DS-66).
 */

import { createRange } from '../pokerCore/rangeMatrix';
import { handVsRange } from '../pokerCore/monteCarloEquity';
import { HAND_TYPE_GROUPS } from '../exploitEngine/rangeSegmenter';

/**
 * A 169-cell range with every cell at full weight — i.e. a uniformly random
 * villain hand. Built once and frozen-by-convention (callers must not mutate).
 */
export const UNIFORM_VILLAIN_RANGE = (() => {
  const r = createRange();
  r.fill(1);
  return r;
})();

/** Default Monte-Carlo trials per combo for the histogram pass. */
export const DEFAULT_HISTOGRAM_TRIALS = 600;

/** Default number of equal-width equity bins (quintiles: 0–20 … 80–100). */
export const DEFAULT_BIN_COUNT = 5;

/**
 * Pure selection filter. Returns the combos in `seg.combos` whose `handType`
 * belongs to any of the selected HAND_TYPE_GROUPS. An empty / null selection
 * means "no filter" → all combos are returned (a fresh array copy).
 *
 * @param {{ combos: Array<{card1:number, card2:number, weight:number, handType:string}> }} seg
 *        the `.engine` field of a handTypeBreakdown result (raw segmentRange output)
 * @param {Iterable<string>|null} selectedGroupIds  HAND_TYPE_GROUPS keys
 * @returns {Array<{card1:number, card2:number, weight:number, handType:string}>}
 */
export const filterCombosByGroups = (seg, selectedGroupIds) => {
  const combos = seg && Array.isArray(seg.combos) ? seg.combos : [];
  const selected = selectedGroupIds ? new Set(selectedGroupIds) : new Set();
  if (selected.size === 0) return [...combos];

  // Union of every hand type owned by a selected group.
  const allowedTypes = new Set();
  for (const groupId of selected) {
    const group = HAND_TYPE_GROUPS[groupId];
    if (!group) continue;
    for (const ht of group.types) allowedTypes.add(ht);
  }
  return combos.filter((c) => allowedTypes.has(c.handType));
};

/**
 * Build `n` equal-width equity bins covering [0, 1]. Each bin is
 * `{ lo, hi, weight, pct, count }`; an equity `e` lands in bin
 * `clamp(floor(e * n), 0, n-1)` so the top bin is closed at 1.0.
 */
const makeBins = (n) => {
  const bins = [];
  for (let i = 0; i < n; i++) {
    bins.push({ lo: i / n, hi: (i + 1) / n, weight: 0, pct: 0, count: 0 });
  }
  return bins;
};

const binIndexFor = (equity, n) => {
  const i = Math.floor(equity * n);
  if (i < 0) return 0;
  if (i >= n) return n - 1;
  return i;
};

/**
 * Compute the equity-vs-random distribution of a combo set on a board.
 *
 * For each combo we ask the equity kernel for its equity vs a uniformly random
 * hand and accumulate the combo's weight into the matching equity bin. The
 * result is a weighted histogram plus the weighted-mean equity of the set.
 *
 * @param {Array<{card1:number, card2:number, weight:number}>} combos
 * @param {number[]} board  3–5 encoded board cards (Phase 2 uses the flop)
 * @param {object} [opts]
 * @param {number} [opts.bins=DEFAULT_BIN_COUNT]   number of equal-width bins
 * @param {number} [opts.trials=DEFAULT_HISTOGRAM_TRIALS]  MC trials/combo (default kernel only)
 * @param {(combo:{card1:number,card2:number,weight:number}) => Promise<number>|number} [opts.equityFn]
 *        injectable per-combo equity function (default: handVsRange vs UNIFORM_VILLAIN_RANGE).
 *        Returning NaN/null marks the combo illegal and excludes it.
 * @param {(done:number, total:number) => void} [opts.onProgress]
 * @returns {Promise<{ bins: Array<{lo,hi,weight,pct,count}>, meanEquity: number, totalWeight: number, combosEvaluated: number, trials: number }>}
 */
export const computeEquityHistogram = async (combos, board, opts = {}) => {
  const n = opts.bins ?? DEFAULT_BIN_COUNT;
  const trials = opts.trials ?? DEFAULT_HISTOGRAM_TRIALS;
  const equityFn =
    opts.equityFn ||
    ((combo) =>
      handVsRange([combo.card1, combo.card2], UNIFORM_VILLAIN_RANGE, board, { trials }).then((r) => r.equity));

  const bins = makeBins(n);
  const list = Array.isArray(combos) ? combos : [];
  const total = list.length;

  let totalWeight = 0;
  let weightedEquitySum = 0;
  let combosEvaluated = 0;

  for (let i = 0; i < total; i++) {
    const combo = list[i];
    const equity = await equityFn(combo);
    if (typeof opts.onProgress === 'function') opts.onProgress(i + 1, total);
    if (equity == null || Number.isNaN(equity)) continue; // illegal combo — skip

    const w = combo.weight ?? 1;
    const bin = bins[binIndexFor(equity, n)];
    bin.weight += w;
    bin.count += 1;
    totalWeight += w;
    weightedEquitySum += equity * w;
    combosEvaluated += 1;
  }

  for (const bin of bins) {
    bin.pct = totalWeight > 0 ? bin.weight / totalWeight : 0;
  }

  return {
    bins,
    meanEquity: totalWeight > 0 ? weightedEquitySum / totalWeight : 0,
    totalWeight,
    combosEvaluated,
    trials,
  };
};
