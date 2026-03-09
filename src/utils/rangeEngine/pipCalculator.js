/**
 * pipCalculator.js - Player vs. Population (PIP) deviation calculator
 *
 * Produces compact, memorable format: "+2 pairs, +1 suited connectors from LATE"
 * by comparing player range widths to GTO baselines per hand category.
 */

import { RANGE_POSITIONS } from './rangeProfile';
import { decodeIndex, POSITION_GTO_KEYS, averageCharts } from '../pokerCore/rangeMatrix';

const GRID_SIZE = 169;

// =============================================================================
// HAND CATEGORY CLASSIFIER
// =============================================================================

/**
 * Hand categories with tier definitions.
 * Each category maps grid indices to tiers (ordered by strength).
 */
const HAND_CATEGORIES = {
  pocketPairs: { label: 'Pairs' },
  suitedAces: { label: 'Suited Aces' },
  suitedBroadways: { label: 'Suited Broadways' },
  suitedConnectors: { label: 'Suited Connectors' },
  suitedGappers: { label: 'Suited Gappers' },
  offsuitBroadways: { label: 'Offsuit Broadways' },
};

/**
 * Classify a grid index into a hand category and tier.
 * @param {number} idx - Grid index 0-168
 * @returns {{ category: string, tier: number } | null}
 */
export const classifyHand = (idx) => {
  const { rank1, rank2, suited, isPair } = decodeIndex(idx);

  // Pocket pairs: AA(tier 12) down to 22(tier 0)
  if (isPair) return { category: 'pocketPairs', tier: rank1 };

  // Broadway = rank >= 8 (T=8, J=9, Q=10, K=11, A=12)
  const isBroadway1 = rank1 >= 8;
  const isBroadway2 = rank2 >= 8;
  const gap = rank1 - rank2;

  if (suited) {
    // Suited aces (A=12): AKs(tier 11) ... A2s(tier 0)
    if (rank1 === 12 && rank2 < 12) return { category: 'suitedAces', tier: rank2 };

    // Suited broadways (both T+, not aces): KQs, KJs, QJs, etc.
    if (isBroadway1 && isBroadway2 && rank1 < 12) return { category: 'suitedBroadways', tier: rank1 + rank2 - 16 };

    // Suited connectors: gap=1, not broadways
    if (gap === 1 && !isBroadway2) return { category: 'suitedConnectors', tier: rank2 };

    // Suited gappers: gap=2, not broadways
    if (gap === 2 && !isBroadway2) return { category: 'suitedGappers', tier: rank2 };
  } else {
    // Offsuit broadways: both T+
    if (isBroadway1 && isBroadway2) return { category: 'offsuitBroadways', tier: rank1 + rank2 - 16 };
  }

  return null; // uncategorized (suited 3-gappers, offsuit non-broadways, etc.)
};

// =============================================================================
// PIP COMPUTATION
// =============================================================================

const WEIGHT_THRESHOLD = 0.3;

/**
 * Count how many tiers in a category have weight > threshold.
 * @param {Float64Array} range - 169-cell range grid
 * @param {string} category - Category key
 * @returns {number} Count of tiers with weight > threshold
 */
const countActiveTiers = (range, category) => {
  const tierWeights = {};
  for (let i = 0; i < GRID_SIZE; i++) {
    const info = classifyHand(i);
    if (!info || info.category !== category) continue;
    // Take max weight per tier (a tier can map to one index)
    tierWeights[info.tier] = Math.max(tierWeights[info.tier] || 0, range[i]);
  }
  let count = 0;
  for (const w of Object.values(tierWeights)) {
    if (w > WEIGHT_THRESHOLD) count++;
  }
  return count;
};

/**
 * Compute PIP deviations for one position's range vs a GTO baseline.
 * Positive = wider than GTO, negative = tighter.
 *
 * @param {Float64Array} playerRange - Player's range (typically open or combined)
 * @param {Float64Array} gtoRange - GTO baseline range
 * @returns {{ [category]: number }} Tier deviation per category
 */
export const computePips = (playerRange, gtoRange) => {
  const result = {};
  for (const category of Object.keys(HAND_CATEGORIES)) {
    const playerTiers = countActiveTiers(playerRange, category);
    const gtoTiers = countActiveTiers(gtoRange, category);
    result[category] = playerTiers - gtoTiers;
  }
  return result;
};


/**
 * Compute PIPs for all positions in a range profile.
 * Uses the player's "open" range (noRaiseFaced) as the primary comparison.
 *
 * @param {Object} rangeProfile - Full range profile
 * @returns {{ [position]: { [category]: number } }} PIP deviations per position
 */
export const computeAllPips = (rangeProfile) => {
  if (!rangeProfile?.ranges) return null;

  const result = {};
  for (const pos of RANGE_POSITIONS) {
    const openRange = rangeProfile.ranges[pos]?.open;
    if (!openRange) continue;

    // Combine limp + open ranges (max weight per cell) as "voluntary playing range"
    const limpRange = rangeProfile.ranges[pos]?.limp;
    let playerRange;
    if (limpRange) {
      playerRange = new Float64Array(GRID_SIZE);
      for (let i = 0; i < GRID_SIZE; i++) {
        playerRange[i] = Math.min(1.0, (openRange[i] || 0) + (limpRange[i] || 0));
      }
    } else {
      playerRange = openRange;
    }

    const gtoKeys = POSITION_GTO_KEYS[pos];
    if (!gtoKeys) continue;

    const gtoRange = averageCharts(...gtoKeys);
    result[pos] = computePips(playerRange, gtoRange);
  }
  return result;
};

/**
 * Format PIPs into human-readable strings.
 * @param {{ [position]: { [category]: number } }} pips
 * @returns {Array<{ position: string, deviations: string[] }>}
 */
export const formatPips = (pips) => {
  if (!pips) return [];

  const results = [];
  for (const pos of RANGE_POSITIONS) {
    if (!pips[pos]) continue;
    const deviations = [];
    for (const [category, delta] of Object.entries(pips[pos])) {
      if (delta === 0) continue;
      const label = HAND_CATEGORIES[category]?.label || category;
      const sign = delta > 0 ? '+' : '';
      deviations.push(`${sign}${delta} ${label}`);
    }
    if (deviations.length > 0) {
      results.push({ position: pos, deviations });
    }
  }
  return results;
};
