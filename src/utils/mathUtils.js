/**
 * mathUtils.js - Shared math utilities
 */

export const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

/**
 * Safe division — returns fallback when denominator is zero or non-finite.
 * @param {number} numerator
 * @param {number} denominator
 * @param {number} [fallback=0] - Value returned when division is unsafe
 * @returns {number}
 */
export const safeDiv = (numerator, denominator, fallback = 0) => {
  if (denominator === 0 || !Number.isFinite(denominator)) return fallback;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
};

/**
 * Standard logistic sigmoid: 1 / (1 + exp(-x)).
 * Maps any real number to (0, 1).
 */
export const sigmoid = (x) => 1 / (1 + Math.exp(-x));

/**
 * Scaled logistic for equity-ratio decisions.
 * Maps input through a logistic centered at `center`, output clamped to [floor, floor+scale].
 * Default params match the call-probability logistic used across the game tree.
 *
 * @param {number} x - Input value (e.g. equity ratio)
 * @param {number} steepness - Logistic steepness (higher = sharper transition)
 * @param {number} [center=1.0] - Logistic center point
 * @param {number} [floor=0.10] - Minimum output
 * @param {number} [scale=0.70] - Output range above floor
 * @returns {number} Probability in [floor, floor+scale]
 */
export const scaledLogistic = (x, steepness, center = 1.0, floor = 0.10, scale = 0.70) =>
  floor + sigmoid(steepness * (x - center)) * scale;

/**
 * Numerically stable softmax — subtracts max before exponentiation to prevent overflow.
 * Returns null if input is empty or computation produces non-finite values.
 *
 * @param {number[]} values - Raw values to convert to probabilities
 * @param {number} temperature - Scaling factor (higher = more uniform)
 * @returns {number[]|null} Normalized weights rounded to 2 decimal places, or null on failure
 */
export const stableSoftmax = (values, temperature) => {
  if (!values || values.length === 0 || !temperature) return null;
  const maxVal = Math.max(...values);
  if (!Number.isFinite(maxVal)) return null;
  const exps = values.map(v => Math.exp((v - maxVal) / temperature));
  const sum = exps.reduce((s, e) => s + e, 0);
  if (!Number.isFinite(sum) || sum === 0) return null;
  return exps.map(e => Math.round((e / sum) * 100) / 100);
};
