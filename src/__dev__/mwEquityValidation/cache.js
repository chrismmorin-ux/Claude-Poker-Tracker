/**
 * cache.js — equity cache keyed by (handClassIdx, scenarioVillainRangesHash).
 *
 * For preflop (empty board), equity for a hero hand class C against a fixed
 * set of villain ranges is constant within MC noise. The natural loop is
 * "for each scenario S, sweep all 169 hand classes" — within a scenario,
 * the villain ranges are identical across classes, so the cache hit rate
 * is 0% on first pass but 100% on any later re-use of the same scenario.
 *
 * Cache key is `${handClassIdx}|${scenarioHash}` where scenarioHash is a
 * deterministic hash of the villain ranges' grid contents.
 */

/**
 * Compute a 32-bit hash of an array of Float64Array range grids.
 * Order-sensitive: [r1, r2] hashes different from [r2, r1].
 *
 * Uses FNV-1a over the IEEE-754 bytes of each grid cell's value (truncated
 * to 4 sig digits to absorb floating-point representational noise).
 */
export const hashScenarioRanges = (ranges) => {
  let hash = 2166136261; // FNV offset basis
  for (let r = 0; r < ranges.length; r++) {
    const grid = ranges[r];
    // Mark range boundary
    hash = (hash ^ 0xDEADBEEF) >>> 0;
    hash = Math.imul(hash, 16777619);
    for (let i = 0; i < grid.length; i++) {
      // Truncate to 4 sig digits
      const v = Math.round(grid[i] * 10000);
      hash = (hash ^ v) >>> 0;
      hash = Math.imul(hash, 16777619);
    }
  }
  return hash >>> 0;
};

/**
 * Create a fresh equity cache.
 */
export const createCache = () => {
  const map = new Map();
  return {
    get: (handClassIdx, scenarioHash) => map.get(`${handClassIdx}|${scenarioHash}`),
    set: (handClassIdx, scenarioHash, equity) => map.set(`${handClassIdx}|${scenarioHash}`, equity),
    has: (handClassIdx, scenarioHash) => map.has(`${handClassIdx}|${scenarioHash}`),
    size: () => map.size,
    clear: () => map.clear(),
  };
};
