/**
 * archetypeRangeBuilder.js — RT-112 range-delta builder.
 *
 * Reweights a baseline range per a villain style archetype (fish / reg / pro)
 * by multiplying each combo's weight by a per-bucket multiplier declared in a
 * frozen table. Archetype is therefore a **table key**, never a decision
 * branch — no `if (archetype === 'fish')` downstream. This preserves the
 * first-principles rule (POKER_THEORY.md §7.4, memory `feedback_first_principles_decisions`)
 * that style labels must not be used as post-hoc decision modifiers on top
 * of the stats that define them.
 *
 * This module is the SOLE location where archetype values map to concrete
 * numerical multipliers. Everywhere else (teaching logic, decision rationale,
 * branch correctness) must consume the output of this module, never the
 * archetype label itself.
 *
 * Pure module. Imports from `exploitEngine/rangeSegmenter` via the INV-08.a
 * permitted-dependency path (RT-109).
 *
 * ## Multiplier design (v1)
 *
 * For each archetype, we declare a multiplier per segmenter bucket
 * (nuts/strong/marginal/draw/air). Fish: expands the calling range by up-
 * weighting marginal and bottom-pair holdings that stick; de-weights air
 * (fish DO play air pre/post occasionally but 3bp-donk-level air is rare).
 * Pro: compresses marginal (pros fold thinly), amplifies strong + draws.
 * Reg: identity baseline — multiplier 1.0 everywhere.
 *
 * These numbers are authoring-level priors, not fitted constants. Refine
 * by observing real session data if a calibration lane opens (would join the
 * RT-108 engine-vs-authored snapshot as a sentinel).
 */

import { segmentRange } from '../exploitEngine/rangeSegmenter';
import { analyzeBoardTexture } from '../pokerCore/boardTexture';

/**
 * Per-archetype × per-bucket combo-weight multipliers. Declarative — no
 * decision logic consumes these values except via the lookup in this module.
 */
export const ARCHETYPE_BUCKET_MULTIPLIERS = Object.freeze({
  // Fish: sticky, call-prone. Over-represents marginal + draw (passive
  // continuation with showdown-value hands and any piece of board).
  // Under-represents air (live fish still fold bottom-of-range pre-3bp).
  fish: Object.freeze({
    nuts: 1.00, strong: 1.20, marginal: 1.40, draw: 1.15, air: 0.50,
  }),
  // Reg: baseline. No reweighting.
  reg: Object.freeze({
    nuts: 1.00, strong: 1.00, marginal: 1.00, draw: 1.00, air: 1.00,
  }),
  // Pro: aggressive, range-polarized. Marginal compresses (fold thinner);
  // semi-bluffs (draws) up; air up slightly (bluff-heavy uncapped ranges).
  pro: Object.freeze({
    nuts: 1.00, strong: 0.95, marginal: 0.70, draw: 1.20, air: 1.25,
  }),
});

/** All archetype IDs this module knows. */
export const listKnownArchetypes = () => Object.keys(ARCHETYPE_BUCKET_MULTIPLIERS);

/** Type guard: is this a known archetype string? */
export const isKnownArchetype = (archetype) =>
  typeof archetype === 'string'
  && Object.prototype.hasOwnProperty.call(ARCHETYPE_BUCKET_MULTIPLIERS, archetype);

/**
 * Reweight a range for a given archetype on a specific board.
 *
 * @param {{
 *   archetype: string,        // 'fish' | 'reg' | 'pro' (or any future key)
 *   baseRange: Float64Array,   // 169-cell weighted grid
 *   board: number[],           // encoded cards (length 3-5)
 *   boardTexture?: object,     // optional precomputed
 * }} args
 * @returns {{
 *   archetype: string,
 *   combos: Array<{ card1: number, card2: number, weight: number, bucket: string, handType: string }>,
 *   totalWeight: number,
 *   multipliers: { nuts: number, strong: number, marginal: number, draw: number, air: number },
 * }}
 */
export const buildArchetypeWeightedRange = ({ archetype, baseRange, board, boardTexture = null }) => {
  if (!isKnownArchetype(archetype)) {
    throw new Error(`buildArchetypeWeightedRange: unknown archetype '${archetype}'`);
  }
  if (!Array.isArray(board) || board.length < 3 || board.length > 5) {
    throw new Error(`buildArchetypeWeightedRange: board must have 3-5 encoded cards`);
  }
  const multipliers = ARCHETYPE_BUCKET_MULTIPLIERS[archetype];
  const tx = boardTexture || analyzeBoardTexture(board);
  const seg = segmentRange(baseRange, board, [], tx);

  const combos = [];
  let totalWeight = 0;
  for (const c of seg.combos) {
    // Table-lookup by bucket — zero decision branching on archetype label.
    const mult = multipliers[c.bucket] ?? 1.0;
    const w = c.weight * mult;
    if (w <= 0) continue;
    combos.push({
      card1: c.card1,
      card2: c.card2,
      weight: w,
      bucket: c.bucket,
      handType: c.handType,
    });
    totalWeight += w;
  }

  return {
    archetype,
    combos,
    totalWeight,
    multipliers: { ...multipliers },
  };
};

/**
 * Aggregate bucket weights from a weighted-combos list. Small helper for
 * consumers that want summary stats without rewalking seg output.
 */
export const aggregateBucketWeights = (weightedRange) => {
  const out = Object.create(null);
  for (const c of weightedRange.combos) {
    out[c.bucket] = (out[c.bucket] || 0) + c.weight;
  }
  return out;
};
