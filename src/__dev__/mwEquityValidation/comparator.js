/**
 * comparator.js — compare derived range to a reference (PREFLOP_CHARTS) range.
 *
 * Both inputs are 169-cell weight grids. The comparison is binary:
 *   in_derived(idx)  ↔ derivedEV[idx] > 0
 *   in_reference(idx) ↔ referenceWeights[idx] > 0
 *
 * Outputs a confusion matrix + Jaccard overlap + sorted divergence lists.
 */

import { decodeIndex, rangeWidth } from '../../utils/pokerCore/rangeMatrix';
import { handStrengthTier } from './scenarios/heroResponse';

const RANK_CHARS = '23456789TJQKA';

const handLabel = (idx) => {
  const { rank1, rank2, isPair, suited } = decodeIndex(idx);
  if (isPair) return `${RANK_CHARS[rank1]}${RANK_CHARS[rank1]}`;
  return `${RANK_CHARS[rank1]}${RANK_CHARS[rank2]}${suited ? 's' : 'o'}`;
};

const comboCount = (idx) => {
  const { isPair, suited } = decodeIndex(idx);
  if (isPair) return 6;
  return suited ? 4 : 12;
};

/**
 * Compare derived EV grid to reference weight grid.
 *
 * @param {Float64Array} derivedEV - 169 cells of EV(open) in BB
 * @param {Float64Array} referenceWeights - 169 cells of solver-chart weights (0..1)
 * @returns {Object} comparison report
 */
export const compareToReference = (derivedEV, referenceWeights) => {
  let tp = 0, fp = 0, fn = 0, tn = 0; // combo-weighted counts
  const missing = []; // in reference, not derived
  const extra = [];   // in derived, not reference
  const boundary = []; // |EV| < 0.5 BB
  const both = [];    // in both (for inspection)

  for (let idx = 0; idx < 169; idx++) {
    const ev = derivedEV[idx];
    const refW = referenceWeights[idx];
    const inDerived = ev > 0;
    const inReference = refW > 0;
    const combos = comboCount(idx);

    if (inDerived && inReference) {
      tp += combos;
      both.push({ idx, label: handLabel(idx), ev, refWeight: refW });
    } else if (inDerived && !inReference) {
      fp += combos;
      extra.push({ idx, label: handLabel(idx), ev, refWeight: 0 });
    } else if (!inDerived && inReference) {
      fn += combos;
      missing.push({ idx, label: handLabel(idx), ev, refWeight: refW });
    } else {
      tn += combos;
    }

    if (Math.abs(ev) < 0.5) {
      boundary.push({
        idx,
        label: handLabel(idx),
        ev,
        inReference,
        refWeight: refW,
      });
    }
  }

  // Sort missing by reference weight × strength tier (most-confident misses first)
  missing.sort((a, b) =>
    (b.refWeight * handStrengthTier(b.idx)) - (a.refWeight * handStrengthTier(a.idx))
  );
  // Sort extra by EV (most-confidently-extra first)
  extra.sort((a, b) => b.ev - a.ev);
  // Sort boundary by absolute EV ascending (closest to 0 first)
  boundary.sort((a, b) => Math.abs(a.ev) - Math.abs(b.ev));

  const totalUnion = tp + fp + fn;
  const overlap = totalUnion > 0 ? tp / totalUnion : 1.0;

  // Approximate range widths
  const referenceWidth = rangeWidth(referenceWeights);
  // Build a derived-binary grid for width calculation
  const derivedBinary = new Float64Array(169);
  for (let i = 0; i < 169; i++) derivedBinary[i] = derivedEV[i] > 0 ? 1 : 0;
  const derivedWidth = rangeWidth(derivedBinary);

  return {
    confusion: { tp, fp, fn, tn },
    overlap,
    referenceWidth,
    derivedWidth,
    missing,
    extra,
    boundary,
    both,
  };
};
