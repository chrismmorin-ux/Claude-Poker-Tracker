/**
 * percentGroup.js — Sum-preserving percentage formatter for partition displays.
 *
 * Scales an array of non-negative values to percentage strings that sum to
 * exactly 100 at the chosen decimal precision, via largest-remainder (Hare
 * quota) rounding. Use this whenever a UI renders a group of values that
 * is a partition — the displayed percentages must sum to 100 with no slack.
 *
 * Pure math. No engine imports. Fits the pokerCore/ "no engine imports"
 * rule per CLAUDE.md.
 *
 * Spec: WS-185 / SPR-083 — Postflop EV-bucket partition display fix.
 *
 * Use this on partition displays only (mutually-exclusive value groups
 * that conceptually sum to 100% of the universe). Do NOT use it on
 * overlapping displays (a hand can be both a made hand AND a draw) or
 * non-partition displays (per-action EV in big blinds is not a percentage
 * of anything). Per the bucket classification ratified 2026-05-12.
 */

/**
 * Format an array of non-negative values as percent strings that sum to
 * exactly 100 at the chosen decimal precision.
 *
 * @param {number[]} values - Non-negative numbers. The output is each
 *   value scaled to a percentage of the array sum, then rounded so the
 *   formatted percents sum to exactly 100 at the given decimals.
 * @param {number} [decimals=0] - Decimal places in the output strings.
 *   Must be a non-negative integer.
 * @returns {string[]} Formatted percent strings without the '%' suffix.
 *
 * Invariants:
 *   - sum(parseFloat(result[i])) === 100 exactly when input.sum() > 0
 *     (at the precision of `decimals`).
 *   - result.length === values.length.
 *   - All-zero input → result of '0.0…' strings.
 *
 * Throws:
 *   - TypeError if `values` is not an array, contains non-numbers,
 *     NaN, negative numbers, or non-finite numbers.
 *   - RangeError if `decimals` is not a non-negative integer.
 */
export const formatPercentGroup = (values, decimals = 0) => {
  const nums = percentGroupNumbers(values, decimals);
  return nums.map((n) => n.toFixed(decimals));
};

/**
 * Same as formatPercentGroup but returns numbers instead of strings.
 * Useful when a downstream renderer needs to drive a width or do
 * arithmetic on the formatted partition.
 *
 * @param {number[]} values
 * @param {number} [decimals=0]
 * @returns {number[]} Numeric percentages summing to exactly 100 at the
 *   given decimal precision.
 */
export const percentGroupNumbers = (values, decimals = 0) => {
  if (!Array.isArray(values)) {
    throw new TypeError('formatPercentGroup: values must be an array');
  }
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new RangeError('formatPercentGroup: decimals must be a non-negative integer');
  }

  for (const v of values) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new TypeError(
        'formatPercentGroup: every value must be a finite non-negative number',
      );
    }
  }

  if (values.length === 0) return [];

  let total = 0;
  for (const v of values) total += v;

  const scale = 10 ** decimals;
  const targetUnits = 100 * scale;

  if (total <= 0) {
    return new Array(values.length).fill(0);
  }

  // Convert each value to "integer-percent units" at the target precision.
  const raw = values.map((v) => (v / total) * targetUnits);
  const floors = raw.map((r) => Math.floor(r));
  const remainders = raw.map((r, i) => r - floors[i]);

  let floorSum = 0;
  for (const f of floors) floorSum += f;
  let remaining = targetUnits - floorSum;

  // Distribute the leftover integer units to the indices with the largest
  // fractional remainder. Ties broken by lower index — deterministic.
  if (remaining > 0) {
    const indices = remainders
      .map((r, i) => ({ r, i }))
      .sort((a, b) => (b.r - a.r) || (a.i - b.i));
    for (let k = 0; k < remaining; k++) {
      floors[indices[k].i] += 1;
    }
  }

  return floors.map((f) => f / scale);
};
