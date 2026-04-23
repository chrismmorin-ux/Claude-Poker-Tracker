/**
 * suppression.js — Resolve suppression relationships between assumptions
 *
 * Part of the assumptionEngine module. See `CLAUDE.md` for rules (mandatory read).
 *
 * Per schema v1.1 §1.7.1 + I-AE-4 (no suppression cycles):
 *   - Each assumption carries `operator.suppresses: string[]` of assumption IDs.
 *   - When an actionable assumption suppresses another, the suppressed assumption's
 *     `operator.currentDial` is forced to 0 (still visible in drill for completeness;
 *     contributes nothing to live decisions).
 *   - Suppression cycles are forbidden (A suppresses B, B suppresses A). Detected
 *     at production time via Kahn's algorithm; throws on cycle.
 *
 * Canonical use case (POKER_THEORY.md §5.8 trap problem):
 *   - Assumption T1: "villain shows down premiums from passive lines" (trap detector)
 *   - Assumption L1: "villain's limp range is capped"
 *   - T1 lists L1 in `suppresses`. When T1 is actionable, L1 is dialed to 0 to prevent
 *     contradictory deviation recommendations.
 *
 * Pure module — imports only `./assumptionTypes`.
 */

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

/**
 * Resolve suppressions across a list of assumptions.
 *
 * Algorithm:
 *   1. Build suppression graph (id → suppressedIds[])
 *   2. Detect cycles via Kahn's topological sort; throw on cycle (I-AE-4)
 *   3. For each actionable suppressor, force all its suppressed assumptions' dials to 0
 *   4. Return the mutated list (caller decides whether to persist)
 *
 * Non-actionable suppressors are skipped — they don't have authority to suppress.
 * Suppressed assumptions whose suppressor is non-actionable retain their original dial.
 *
 * @param {Array} assumptions - VillainAssumption[] per schema v1.1
 * @returns {Array} Same assumptions array with dials updated for suppressed entries
 * @throws {Error} When a suppression cycle exists (named "SuppressionCycleError")
 */
export const resolveSuppressions = (assumptions) => {
  if (!Array.isArray(assumptions) || assumptions.length === 0) {
    return assumptions || [];
  }

  // Index by id for O(1) lookup
  const byId = new Map();
  for (const a of assumptions) {
    if (a && typeof a.id === 'string') {
      byId.set(a.id, a);
    }
  }

  // Build adjacency list: suppressor-id → [suppressed-id]
  const adjacency = new Map();
  for (const a of assumptions) {
    if (!a || typeof a.id !== 'string') continue;
    const suppresses = a.operator?.suppresses;
    if (!Array.isArray(suppresses) || suppresses.length === 0) continue;
    adjacency.set(a.id, suppresses.filter((sid) => typeof sid === 'string' && sid.length > 0));
  }

  // Cycle detection via Kahn's algorithm (topological sort)
  detectCycleOrThrow(byId, adjacency);

  // Apply suppressions: for each actionable suppressor, zero out suppressed dials
  for (const [suppressorId, suppressedIds] of adjacency.entries()) {
    const suppressor = byId.get(suppressorId);
    if (!suppressor || !isSuppressorActionable(suppressor)) continue;

    for (const suppressedId of suppressedIds) {
      const suppressed = byId.get(suppressedId);
      if (!suppressed || !suppressed.operator) continue;

      // Force dial to 0; mark that this is a suppression-induced zero
      // (caller can read `operator.suppressedBy` for drill-rendering)
      suppressed.operator.currentDial = 0;
      suppressed.operator.suppressedBy = suppressorId;
    }
  }

  return assumptions;
};

/**
 * Detect and return the set of suppression cycles in a list of assumptions.
 * Returns an empty array when no cycles exist. Does NOT throw — useful for
 * diagnostic tooling that wants to inspect problems before deciding on fail-hard.
 *
 * @param {Array} assumptions
 * @returns {Array<string[]>} List of cycle paths; each path is a list of ids forming a cycle
 */
export const findSuppressionCycles = (assumptions) => {
  if (!Array.isArray(assumptions) || assumptions.length === 0) return [];

  const adjacency = new Map();
  for (const a of assumptions) {
    if (!a || typeof a.id !== 'string') continue;
    const suppresses = a.operator?.suppresses;
    if (!Array.isArray(suppresses) || suppresses.length === 0) continue;
    adjacency.set(a.id, suppresses.filter((sid) => typeof sid === 'string' && sid.length > 0));
  }

  const cycles = [];
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const stack = [];

  const dfs = (nodeId) => {
    color.set(nodeId, GRAY);
    stack.push(nodeId);
    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      const neighborColor = color.get(neighbor) ?? WHITE;
      if (neighborColor === GRAY) {
        // Cycle detected — extract path from neighbor back to current
        const cycleStart = stack.indexOf(neighbor);
        if (cycleStart !== -1) {
          cycles.push([...stack.slice(cycleStart), neighbor]);
        }
      } else if (neighborColor === WHITE) {
        dfs(neighbor);
      }
    }
    stack.pop();
    color.set(nodeId, BLACK);
  };

  for (const id of adjacency.keys()) {
    if ((color.get(id) ?? WHITE) === WHITE) {
      dfs(id);
    }
  }

  return cycles;
};

/**
 * Sort assumptions into a "safe to apply" topological order respecting
 * suppression relationships. Suppressors come before suppressed.
 *
 * Throws on cycle.
 *
 * @param {Array} assumptions
 * @returns {Array} Topologically-ordered assumption IDs
 */
export const topologicalSuppressionOrder = (assumptions) => {
  if (!Array.isArray(assumptions) || assumptions.length === 0) return [];

  const byId = new Map();
  for (const a of assumptions) {
    if (a && typeof a.id === 'string') byId.set(a.id, a);
  }

  const adjacency = new Map();
  const inDegree = new Map();
  for (const id of byId.keys()) inDegree.set(id, 0);

  for (const a of assumptions) {
    if (!a || typeof a.id !== 'string') continue;
    const suppresses = a.operator?.suppresses;
    if (!Array.isArray(suppresses)) continue;
    for (const sid of suppresses) {
      if (!byId.has(sid)) continue; // ignore refs to unknown ids
      if (!adjacency.has(a.id)) adjacency.set(a.id, []);
      adjacency.get(a.id).push(sid);
      inDegree.set(sid, (inDegree.get(sid) || 0) + 1);
    }
  }

  detectCycleOrThrow(byId, adjacency);

  // Kahn's sort — roots (in-degree 0) first
  const queue = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }
  const order = [];
  while (queue.length > 0) {
    const id = queue.shift();
    order.push(id);
    const neighbors = adjacency.get(id) || [];
    for (const n of neighbors) {
      inDegree.set(n, inDegree.get(n) - 1);
      if (inDegree.get(n) === 0) queue.push(n);
    }
  }

  if (order.length !== byId.size) {
    // Shouldn't happen if detectCycleOrThrow above succeeded
    throw new SuppressionCycleError('Unresolvable suppression graph', []);
  }
  return order;
};

// ───────────────────────────────────────────────────────────────────────────
// Internal helpers
// ───────────────────────────────────────────────────────────────────────────

/**
 * Kahn's-based cycle detection. Throws SuppressionCycleError on cycle.
 */
const detectCycleOrThrow = (byId, adjacency) => {
  const inDegree = new Map();
  for (const id of byId.keys()) inDegree.set(id, 0);

  for (const [_, neighbors] of adjacency.entries()) {
    for (const n of neighbors) {
      if (byId.has(n)) {
        inDegree.set(n, (inDegree.get(n) || 0) + 1);
      }
    }
  }

  const queue = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  let visited = 0;
  while (queue.length > 0) {
    const id = queue.shift();
    visited++;
    const neighbors = adjacency.get(id) || [];
    for (const n of neighbors) {
      if (!byId.has(n)) continue;
      inDegree.set(n, inDegree.get(n) - 1);
      if (inDegree.get(n) === 0) queue.push(n);
    }
  }

  if (visited !== byId.size) {
    // Cycle exists; surface details for diagnostics.
    const cycles = findSuppressionCyclesFromGraph(byId, adjacency);
    const firstCycle = cycles[0] || [];
    throw new SuppressionCycleError(
      `Suppression cycle detected: ${firstCycle.join(' → ')}`,
      cycles,
    );
  }
};

/**
 * Find cycles using DFS coloring (internal helper).
 */
const findSuppressionCyclesFromGraph = (byId, adjacency) => {
  const cycles = [];
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const stack = [];

  const dfs = (nodeId) => {
    color.set(nodeId, GRAY);
    stack.push(nodeId);
    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!byId.has(neighbor)) continue;
      const neighborColor = color.get(neighbor) ?? WHITE;
      if (neighborColor === GRAY) {
        const cycleStart = stack.indexOf(neighbor);
        if (cycleStart !== -1) {
          cycles.push([...stack.slice(cycleStart), neighbor]);
        }
      } else if (neighborColor === WHITE) {
        dfs(neighbor);
      }
    }
    stack.pop();
    color.set(nodeId, BLACK);
  };

  for (const id of byId.keys()) {
    if ((color.get(id) ?? WHITE) === WHITE) {
      dfs(id);
    }
  }

  return cycles;
};

/**
 * Is the suppressor's dial high enough to exercise authority?
 * Only actionable suppressors zero out their suppressed assumptions' dials.
 */
const isSuppressorActionable = (assumption) => {
  return assumption.quality?.actionableInDrill === true
    || assumption.quality?.actionableLive === true;
};

// ───────────────────────────────────────────────────────────────────────────
// Error type
// ───────────────────────────────────────────────────────────────────────────

/**
 * Error thrown when a suppression cycle is detected (I-AE-4 violation).
 * Carries the list of cycles for debugging.
 */
export class SuppressionCycleError extends Error {
  constructor(message, cycles = []) {
    super(message);
    this.name = 'SuppressionCycleError';
    this.cycles = cycles;
  }
}
