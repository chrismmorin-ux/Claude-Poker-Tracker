/**
 * emotionalStateComputer.js — Orchestrator for two-dimensional emotional state
 *
 * Part of the emotionalState module. See `CLAUDE.md` for rules (mandatory read).
 *
 * Per schema v1.1 §3 (`EmotionalState`) and owner directive 2026-04-23:
 *   - Fear and greed are TWO SEPARATE dimensions (not a single signed axis).
 *   - joint: [fearIndex, greedIndex] is preserved on every output for later
 *     quadrant-distribution analysis (Phase 8 deliverable).
 *   - netTilt is a DERIVED convenience field only, never used as primary metric downstream.
 *
 * Computation is range-weighted — hero doesn't see villain's cards, so fear and greed
 * are aggregated over villain's RANGE (169-cell grid with per-combo weights) rather than
 * any specific holding.
 */

import { computeFearIndex } from './fearIndex';
import { computeGreedIndex } from './greedIndex';

/**
 * Compute the full EmotionalState for a given decision node.
 *
 * @param {Object} villainRange - Range profile or raw 169-cell weights
 *   Accepts either:
 *     - Float64Array of length 169 (direct weights)
 *     - { ranges: { [pos]: { [action]: Float64Array } }, ...profile } — full profile; caller must pass pre-narrowed weights in `activeRange` option
 *     - { weights: Float64Array } — { weights } shape
 * @param {Object} gameState - { spr: number, nodeId: string, ... }
 * @param {Object} sessionContext - { villainBBDelta?: number, ... }
 * @param {Object} [options]
 * @param {Float64Array} [options.activeRangeWeights] - Explicit 169-cell weights when villainRange is a full profile
 * @returns {Object} EmotionalState conforming to schema v1.1 §3
 */
export const computeEmotionalState = (villainRange, gameState = {}, sessionContext = {}, options = {}) => {
  const weights = resolveWeights(villainRange, options);
  const fear = computeFearIndex(weights, gameState, sessionContext);
  const greed = computeGreedIndex(weights, gameState, sessionContext);

  const fearIndex = fear.index;
  const greedIndex = greed.index;
  const netTilt = greedIndex - fearIndex; // derived; range [-1, +1]

  return {
    fearIndex,
    greedIndex,
    netTilt,
    joint: [fearIndex, greedIndex], // preserved per owner directive 2026-04-23
    sources: [...fear.sources, ...greed.sources],
    computedAt: new Date().toISOString(),
    nodeId: gameState.nodeId ?? null,
  };
};

/**
 * Resolve the 169-cell weight array from various input shapes.
 * Accepts Float64Array directly, `{weights}` object, or a range profile (requires options.activeRangeWeights).
 */
const resolveWeights = (input, options) => {
  if (options?.activeRangeWeights instanceof Float64Array) {
    return options.activeRangeWeights;
  }
  if (input instanceof Float64Array) return input;
  if (Array.isArray(input) && input.length === 169) {
    return new Float64Array(input);
  }
  if (input && input.weights instanceof Float64Array) return input.weights;
  if (input && Array.isArray(input.weights) && input.weights.length === 169) {
    return new Float64Array(input.weights);
  }
  // Fall-through: empty range (all zeros). Upstream callers should detect this
  // and fall back to "no emotional state" (fear=0, greed=0).
  return new Float64Array(169);
};
