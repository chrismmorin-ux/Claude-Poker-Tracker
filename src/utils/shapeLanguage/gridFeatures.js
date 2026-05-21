/**
 * gridFeatures.js — Pure feature extractors over a 169-cell preflop range grid.
 *
 * Consumers: silhouetteClassifier.js (Range Silhouette prototype scoring).
 *
 * The 169-cell grid follows the canonical layout from
 * `src/utils/pokerCore/rangeMatrix.js`:
 *   - rank 0..12 = '2'..'A'
 *   - pair index   = r*13 + r           (diagonal)
 *   - suited index = high*13 + low      (high > low, upper triangle in the matrix)
 *   - offsuit index = low*13 + high     (lower triangle in the matrix)
 *
 * Every feature here is a pure function of the grid — no IDB, no React,
 * no dispatch. Silhouette labels are derived OUTPUTS of these features;
 * features are never derived from labels.
 *
 * SLS Stream B1 — WS-041 / SPR-082.
 */

export const GRID_SIZE = 169;
export const NUM_RANKS = 13;

/** Combo counts per cell type (used for "% of hands" computations). */
export const COMBOS_PAIR = 6;
export const COMBOS_SUITED = 4;
export const COMBOS_OFFSUIT = 12;
export const TOTAL_COMBOS = 1326; // 52 choose 2

const isPairIndex = (idx) => Math.floor(idx / NUM_RANKS) === idx % NUM_RANKS;
const isSuitedIndex = (idx) => {
  const row = Math.floor(idx / NUM_RANKS);
  const col = idx % NUM_RANKS;
  return row > col; // per rangeMatrix.js suited convention
};

/**
 * Decode the (high, low) ranks for a grid index.
 * Returns rank-sum (used as a coarse strength proxy by other features).
 */
const decodeRanks = (idx) => {
  const row = Math.floor(idx / NUM_RANKS);
  const col = idx % NUM_RANKS;
  const high = Math.max(row, col);
  const low = Math.min(row, col);
  return { high, low, rankSum: high + low };
};

/** Combo count for a cell, independent of weight. */
const combosForIndex = (idx) => {
  if (isPairIndex(idx)) return COMBOS_PAIR;
  if (isSuitedIndex(idx)) return COMBOS_SUITED;
  return COMBOS_OFFSUIT;
};

/**
 * Total weighted combo mass — sum over cells of weight * combos.
 * Returns a number in [0, 1326]. A "50% range" yields ~663.
 */
export const totalMass = (grid) => {
  if (!grid || grid.length !== GRID_SIZE) return 0;
  let sum = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    const w = grid[i];
    if (w > 0) sum += w * combosForIndex(i);
  }
  return sum;
};

/**
 * Premium-mass fraction: portion of weighted combo mass that sits at
 * rank-sum ≥ 18 — the absolute "premium quadrant" of the 13×13 grid.
 * Returns [0, 1].
 *
 * rs ≥ 18 covers JJ+, A8+, KT+, QT+, JT+, T9+, broadly the top ~20% of
 * the universe by rank-sum. This is a FIXED reference threshold (not
 * relative to what's in the range), so it discriminates Triangle (a wide
 * range whose premium is a smaller fraction) from Oval (a tight range
 * dominated by premium cells).
 */
export const premiumMassFraction = (grid) => {
  if (!grid || grid.length !== GRID_SIZE) return 0;
  const total = totalMass(grid);
  if (total === 0) return 0;
  let premium = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    const w = grid[i];
    if (w <= 0) continue;
    if (decodeRanks(i).rankSum >= 18) {
      premium += w * combosForIndex(i);
    }
  }
  return premium / total;
};

/**
 * Back-compat alias retained for any external caller. Prefer
 * `premiumMassFraction`.
 */
export const topCornerConcentration = premiumMassFraction;

/**
 * Mean rank-sum weighted by combo mass. Range [0, 24].
 * High value = strong-hand-heavy range. Low = weak-hand-heavy.
 */
export const rankSumWeightedMean = (grid) => {
  if (!grid || grid.length !== GRID_SIZE) return 0;
  let weightedSum = 0;
  let total = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    const w = grid[i];
    if (w > 0) {
      const combos = combosForIndex(i);
      const mass = w * combos;
      weightedSum += mass * decodeRanks(i).rankSum;
      total += mass;
    }
  }
  return total === 0 ? 0 : weightedSum / total;
};

/**
 * Variance of rank-sum weighted by combo mass.
 * High value = wide range; low value = tight range.
 */
export const rankSumVariance = (grid) => {
  if (!grid || grid.length !== GRID_SIZE) return 0;
  const mean = rankSumWeightedMean(grid);
  let weightedSqDev = 0;
  let total = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    const w = grid[i];
    if (w > 0) {
      const combos = combosForIndex(i);
      const mass = w * combos;
      const dev = decodeRanks(i).rankSum - mean;
      weightedSqDev += mass * dev * dev;
      total += mass;
    }
  }
  return total === 0 ? 0 : weightedSqDev / total;
};

/**
 * Bimodality of mass over rank-sum bins. Returns [0, 1].
 *
 * True bimodality requires mass at BOTH a high cluster and a low
 * cluster, with a thinner middle. A unimodal premium-only range (Oval)
 * scores near 0 because the low cluster is empty. A barbell (premium
 * value + low-rank-sum bluffs) scores high.
 *
 * Implementation: bin into 5 rank-sum buckets; bimodality = geometric
 * mean of the two extreme buckets, penalized by fat middle.
 */
export const rankSumBimodality = (grid) => {
  if (!grid || grid.length !== GRID_SIZE) return 0;
  const buckets = [0, 0, 0, 0, 0];
  const edges = [5, 10, 15, 20, 24];
  let total = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    const w = grid[i];
    if (w > 0) {
      const combos = combosForIndex(i);
      const mass = w * combos;
      const rs = decodeRanks(i).rankSum;
      let b = 0;
      while (b < 4 && rs > edges[b]) b++;
      buckets[b] += mass;
      total += mass;
    }
  }
  if (total === 0) return 0;
  const high = buckets[4] / total;
  const low = buckets[0] / total;
  const midLow = buckets[1] / total;
  const middle = buckets[2] / total;
  // Geometric mean of the two extremes (zero if either is empty),
  // penalized by middle-bucket fatness.
  const peakProduct = Math.sqrt(high * low);
  const score = peakProduct - 0.4 * middle;
  // Scale up so the natural range becomes [0, 1] for typical fixtures.
  return Math.max(0, Math.min(1, 3 * score));
};

/**
 * Suited-vs-offsuit asymmetry by weighted cell count. Returns [-1, 1].
 *
 * +1 = all weighted cells in suited triangle (pure suited range — Comb-like).
 * -1 = all weighted cells in offsuit triangle (offsuit-only, rare).
 *  0 = balanced cell count.
 *
 * Pairs are excluded (they're on the diagonal). Weight per cell is used
 * instead of combo-mass so that a range with 1 suited + 1 offsuit cell
 * scores 0 (visually balanced on the 13×13 grid), not -0.5 (combo-mass-
 * weighted, which over-penalizes offsuit because offsuit cells contain
 * 3× the combos of suited cells).
 *
 * This is the geometric/visual asymmetry that drives silhouette
 * classification, not the combo-mass asymmetry.
 */
export const suitedAsymmetry = (grid) => {
  if (!grid || grid.length !== GRID_SIZE) return 0;
  let suitedWeight = 0;
  let offsuitWeight = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    const w = grid[i];
    if (w <= 0 || isPairIndex(i)) continue;
    if (isSuitedIndex(i)) suitedWeight += w;
    else offsuitWeight += w;
  }
  const denom = suitedWeight + offsuitWeight;
  if (denom === 0) return 0;
  return (suitedWeight - offsuitWeight) / denom;
};

/**
 * Wedge monotonicity. Returns [0, 1].
 *
 * Measures how concentrated the mass is in the top half of cells by
 * rank-sum, across ALL 169 cells (including zero-weight cells). A pure
 * wedge has nonzero weights only at high rs → topHalfMass / total ≈ 1.0.
 * A uniform diffuse distribution has half the mass in the bottom half
 * → topHalfMass / total ≈ 0.5. A barbell has bottom-cluster bluffs →
 * topHalfMass / total falls between.
 *
 * Returns `max(0, 2*(topHalfFraction - 0.5))`: 1.0 = perfect wedge,
 * 0.0 = uniform-or-inverted.
 *
 * Crucially: considers zero-weight cells when ranking, so a tight range
 * (Oval) AND a wedge (Triangle) both score high; the rangeWidthPct
 * feature separates them.
 */
export const wedgeMonotonicity = (grid) => {
  if (!grid || grid.length !== GRID_SIZE) return 0;
  const total = totalMass(grid);
  if (total === 0) return 1; // trivially monotonic
  // Enumerate all 169 cells with their rank-sum + mass (zero-weight included).
  const cells = new Array(GRID_SIZE);
  for (let i = 0; i < GRID_SIZE; i++) {
    cells[i] = {
      rankSum: decodeRanks(i).rankSum,
      mass: (grid[i] || 0) * combosForIndex(i),
    };
  }
  cells.sort((a, b) => b.rankSum - a.rankSum);
  const halfCount = Math.floor(GRID_SIZE / 2);
  let topMass = 0;
  for (let i = 0; i < halfCount; i++) topMass += cells[i].mass;
  const topFrac = topMass / total;
  return Math.max(0, Math.min(1, 2 * (topFrac - 0.5)));
};

/**
 * Diagonal (pair) mass dominance. Returns [0, 1].
 * High = pair-heavy range (rare; usually paired with pocket-pair-only opens).
 */
export const diagonalDominance = (grid) => {
  if (!grid || grid.length !== GRID_SIZE) return 0;
  const total = totalMass(grid);
  if (total === 0) return 0;
  let pairMass = 0;
  for (let r = 0; r < NUM_RANKS; r++) {
    const i = r * NUM_RANKS + r;
    if (grid[i] > 0) pairMass += grid[i] * COMBOS_PAIR;
  }
  return pairMass / total;
};

/**
 * Shannon entropy of normalized weights. Returns [0, log2(169)].
 *
 * High entropy = mass diffused across many cells (Cloud).
 * Low entropy = mass concentrated in few cells (Oval).
 * Normalized to [0, 1] by dividing by log2(GRID_SIZE).
 */
export const entropy = (grid) => {
  if (!grid || grid.length !== GRID_SIZE) return 0;
  const total = totalMass(grid);
  if (total === 0) return 0;
  let h = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    const w = grid[i];
    if (w > 0) {
      const p = (w * combosForIndex(i)) / total;
      if (p > 0) h -= p * Math.log2(p);
    }
  }
  return h / Math.log2(GRID_SIZE);
};

/**
 * Spatial contiguity. Returns [0, 1].
 *
 * 1 = active cells are tightly clustered.
 * 0 = active cells are scattered across the grid.
 *
 * Implementation: average pairwise grid distance between active cells,
 * normalized by the maximum possible distance, then inverted.
 */
export const spatialContiguity = (grid) => {
  if (!grid || grid.length !== GRID_SIZE) return 0;
  const active = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    if (grid[i] > 0) {
      active.push({
        row: Math.floor(i / NUM_RANKS),
        col: i % NUM_RANKS,
        w: grid[i] * combosForIndex(i),
      });
    }
  }
  if (active.length < 2) return 1;
  let sum = 0;
  let pairs = 0;
  for (let a = 0; a < active.length; a++) {
    for (let b = a + 1; b < active.length; b++) {
      const dr = active[a].row - active[b].row;
      const dc = active[a].col - active[b].col;
      const d = Math.sqrt(dr * dr + dc * dc);
      const wpair = active[a].w + active[b].w;
      sum += d * wpair;
      pairs += wpair;
    }
  }
  if (pairs === 0) return 1;
  const avgDist = sum / pairs;
  const maxDist = Math.sqrt(2) * (NUM_RANKS - 1); // diagonal of 12x12 grid ≈ 16.97
  return Math.max(0, Math.min(1, 1 - avgDist / maxDist));
};

/**
 * Compute the full feature vector for a grid.
 *
 * Pure function; same input → same output. Returns frozen object so
 * consumers can't mutate it inadvertently.
 */
export const computeGridFeatures = (grid) => {
  const tm = totalMass(grid);
  return Object.freeze({
    totalMass: tm,
    rangeWidthPct: tm / TOTAL_COMBOS, // [0, 1]
    premiumMassFraction: premiumMassFraction(grid),
    rankSumMean: rankSumWeightedMean(grid),
    rankSumVariance: rankSumVariance(grid),
    bimodality: rankSumBimodality(grid),
    suitedAsymmetry: suitedAsymmetry(grid),
    wedgeMonotonicity: wedgeMonotonicity(grid),
    diagonalDominance: diagonalDominance(grid),
    entropy: entropy(grid),
    contiguity: spatialContiguity(grid),
  });
};
