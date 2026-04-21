/**
 * studyPriorityIndex.js — scores lines + nodes by study value.
 *
 * Study Priority Index (SPI) combines three factors:
 *
 *   SPI = log-frequency score × potSize (bb) × (1 + difficultyBonus)
 *
 *   frequencyScore = log10(reachProbability × 1e6), floored at 0
 *   potSize        = pot at the node, in big blinds
 *   difficultyBonus ∈ [0, 1] — reserved for Phase 4+ when we can compute the
 *                              EV gap between the best and second-best branch.
 *                              In Phase 4 v1 it is a fixed 0.2 for decision
 *                              nodes, 0 for terminal nodes, since our engine
 *                              can't yet compute branch EVs against live
 *                              ranges without added plumbing.
 *
 * Reach probability is a DAG walk from the line's root:
 *
 *   P(reach_node) = P(positionPair) × P(potType) × P(boardClass | potType)
 *                 × ∏_{edges on path} P(villainAction | street, potType, boardClass)
 *
 * Where multiple paths reach a node (DAG convergence), we take the SUM of
 * per-path probabilities — a node reachable by more routes is encountered
 * at higher frequency.
 *
 * Population constants in this file are hand-calibrated from 9-max live cash
 * (1/2-5/10). Phase 4 overlay that uses the user's own IndexedDB hand
 * distribution is deferred — see project file.
 *
 * Pure module — no imports from UI, state, or persistence layers.
 */

import { walkLine } from './lineSchema';

// ======================================================================
// Population constants
// ======================================================================

/**
 * Frequency that a given position-matchup reaches postflop (one pair of
 * active players remaining after preflop action). 9-max live cash baselines.
 *
 * Format: hero-position → villain-position → probability (per hand dealt,
 * not per hand-that-reached-postflop).
 *
 * Numbers are approximate — the shape matters more than any individual
 * cell. BTN-vs-BB dominates because:
 *   (a) BTN opens widest,
 *   (b) BB is forced to defend the most,
 *   (c) Every other position has to fold or limp-in less often.
 */
export const POSITION_PAIR_FREQ = Object.freeze({
  BTN: {
    BB:  0.11,   // dominant HU matchup
    SB:  0.035,
    CO:  0.015,
    HJ:  0.01,
    MP1: 0.006,
    UTG: 0.003,
  },
  CO: {
    BB:  0.065,
    SB:  0.025,
    BTN: 0.015,
    HJ:  0.008,
    MP1: 0.005,
  },
  HJ: {
    BB:  0.04,
    SB:  0.018,
    CO:  0.006,
    BTN: 0.008,
    MP1: 0.004,
  },
  MP1: {
    BB:  0.025,
    SB:  0.012,
    CO:  0.005,
    BTN: 0.005,
    HJ:  0.003,
  },
  UTG: {
    BB:  0.015,
    SB:  0.008,
    BTN: 0.003,
    CO:  0.002,
  },
  SB: {
    BB:  0.04,   // SB vs BB is common but often limped
    BTN: 0.018,
    CO:  0.012,
  },
  BB: {
    // BB as hero (rare in our lines but wired for completeness)
    BTN: 0.002,
    SB:  0.002,
    CO:  0.001,
  },
});

/**
 * Frequency of each pot-type conditional on reaching postflop.
 * SRP dominates; 4BPs are rare.
 */
export const POT_TYPE_FREQ = Object.freeze({
  'srp':       0.70,
  '3bp':       0.15,
  '4bp':       0.02,
  'limped':    0.13,
  'srp-3way':  0.12,  // subset — note 3-way SRPs are a subset of general multiway
  '3bp-3way':  0.015,
  'srp-4way':  0.03,
});

/**
 * Flop board-class frequency. Categories OVERLAP (a board can be both
 * unpaired-rainbow AND high-card). Lines declare their primary class via
 * tags; SPI picks the most-specific present.
 */
export const BOARD_CLASS_FREQ = Object.freeze({
  'unpaired-rainbow': 0.47,
  'unpaired-twotone': 0.39,
  'unpaired-monotone': 0.05,
  'paired':           0.17,
  'trips':            0.002,
  'wet':              0.35,     // many straight/flush draws present
  'dry':              0.35,     // few draws
  'high-card':        0.35,     // top card T+
  'middling':         0.22,
  'low':              0.18,
});

/**
 * Villain action frequency on the flop, conditional on pot type.
 * Postflop street conditioning is an approximation — on turn/river the same
 * distribution applies with minor skew we ignore in v1.
 */
export const VILLAIN_ACTION_FREQ = Object.freeze({
  // BB donk lead into PFA is RARE in SRP, more common in 3BP on scary boards.
  'donk': { srp: 0.04, '3bp': 0.18, '4bp': 0.10, 'limped': 0.20, default: 0.08 },
  // Check is the plurality villain action at the flop.
  'check': { srp: 0.75, '3bp': 0.65, '4bp': 0.70, 'limped': 0.55, default: 0.70 },
  // Villain bet (cbet or lead) — normalized to stay ≤ 1.
  'bet': { srp: 0.15, '3bp': 0.12, '4bp': 0.15, 'limped': 0.20, default: 0.15 },
  'cbet': { srp: 0.15, '3bp': 0.12, '4bp': 0.15, 'limped': 0.20, default: 0.15 },
  // Raise and check-raise are rare
  'raise':      { default: 0.03 },
  'checkraise': { default: 0.04 },
  'call':       { default: 0.50 },  // applies after hero bets
  'fold':       { default: 0.30 },
});

// ======================================================================
// Helpers
// ======================================================================

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

const positionPairProbability = (hero, villain) => {
  const heroPos = hero?.position;
  const villainPos = villain?.position;
  if (!heroPos || !villainPos) return 0.02;
  const row = POSITION_PAIR_FREQ[heroPos];
  if (!row) return 0.005;
  return row[villainPos] ?? 0.005;
};

const potTypeProbability = (potType) => POT_TYPE_FREQ[potType] ?? 0.01;

const boardClassProbability = (tags) => {
  if (!Array.isArray(tags) || tags.length === 0) return 0.25;
  // Take the MIN frequency of any matching tag — the rarest class wins,
  // since specifying multiple tags narrows, not broadens.
  let min = 1;
  let matched = false;
  for (const tag of tags) {
    const f = BOARD_CLASS_FREQ[tag];
    if (typeof f === 'number') {
      matched = true;
      if (f < min) min = f;
    }
  }
  return matched ? min : 0.25;
};

const villainActionProbability = (kind, potType) => {
  if (!kind) return 1;
  const row = VILLAIN_ACTION_FREQ[kind];
  if (!row) return 0.1;
  if (potType && typeof row[potType] === 'number') return row[potType];
  return row.default ?? 0.1;
};

// ======================================================================
// Reach probability (per node, via DAG)
// ======================================================================

/**
 * Compute P(reach_node) for every reachable node in the line.
 *
 * Base factor (entering the root): positionPair × potType × boardClass.
 * Edge factor: each decision branch contributes a transition probability
 *   that is the product of [branch-taken weight] × [next-node villainAction
 *   given the branch]. For v1, branch-taken weight is distributed uniformly
 *   across branches (a hero-choice, not a frequency-weighted event), and
 *   villainAction is weighted by its population frequency.
 *
 * The DAG-sum semantics mean shared downstream nodes accumulate probability
 * across all parents that reach them.
 *
 * @returns {Record<string, number>} nodeId -> P(reach_node)
 */
export const reachProbabilities = (line) => {
  const probs = {};
  if (!line || !line.nodes || !line.rootId) return probs;

  const rootNode = line.nodes[line.rootId];
  if (!rootNode) return probs;

  const potType = line.setup?.potType;
  const villain = line.setup?.villains?.[0];
  const base =
    positionPairProbability(line.setup?.hero, villain)
    * potTypeProbability(potType)
    * boardClassProbability(line.tags);

  const rootActionFactor = villainActionProbability(rootNode.villainAction?.kind, potType);
  probs[line.rootId] = base * rootActionFactor;

  // DAG topological walk with probability accumulation. Since walkLine
  // already handles cycle detection, we can iterate a simple BFS layered
  // approach: visit in order of first-discovery and propagate.
  const { reachable } = walkLine(line);
  const order = [];
  const visited = new Set();
  const visit = (id) => {
    if (visited.has(id)) return;
    visited.add(id);
    const n = line.nodes[id];
    if (!n) return;
    order.push(id);
    if (n.decision) {
      for (const b of n.decision.branches) {
        if (b.nextId && line.nodes[b.nextId]) visit(b.nextId);
      }
    }
  };
  visit(line.rootId);

  // Propagate probabilities in discovery order (DAG-safe because lines
  // are guaranteed acyclic by validateLine).
  for (const id of order) {
    const node = line.nodes[id];
    const pNode = probs[id] ?? 0;
    if (!node || !node.decision) continue;
    const branchWeight = 1 / node.decision.branches.length;
    for (const b of node.decision.branches) {
      if (!b.nextId || !line.nodes[b.nextId]) continue;
      const next = line.nodes[b.nextId];
      const actionFactor = villainActionProbability(next.villainAction?.kind, potType);
      const contribution = pNode * branchWeight * actionFactor;
      probs[b.nextId] = (probs[b.nextId] ?? 0) + contribution;
    }
  }

  // Cull any accidental entries for unreachable nodes
  for (const id of Object.keys(probs)) {
    if (!reachable.has(id)) delete probs[id];
  }

  return probs;
};

// ======================================================================
// SPI computation
// ======================================================================

const DIFFICULTY_DECISION = 0.2;
const DIFFICULTY_TERMINAL = 0.0;

const logScore = (p) => {
  const scaled = p * 1e6;
  return Math.max(0, Math.log10(Math.max(1e-9, scaled)));
};

/**
 * SPI for a single node given its reach probability and pot size.
 */
export const computeNodeSPI = (node, reachProb) => {
  if (!node) return 0;
  const pot = typeof node.pot === 'number' ? node.pot : 0;
  const diff = node.decision ? DIFFICULTY_DECISION : DIFFICULTY_TERMINAL;
  return logScore(reachProb) * pot * (1 + diff);
};

/**
 * Multiway complexity multiplier: MW spots are harder to study per unit
 * of frequency because the decision surface is larger. Small uplift so
 * MW lines remain ranked by raw frequency × pot × difficulty but aren't
 * dominated by HU lines with marginally more reach probability.
 */
const multiwayBoost = (line) => {
  const n = line?.setup?.villains?.length ?? 1;
  if (n <= 1) return 1;
  if (n === 2) return 1.15;
  if (n === 3) return 1.25;
  return 1.3;
};

/**
 * SPI for a line — takes the max across all reachable nodes so that the
 * deepest-EV spot in the line drives the ranking.
 */
export const computeLineSPI = (line) => {
  const probs = reachProbabilities(line);
  const mwBoost = multiwayBoost(line);
  let maxScore = 0;
  let maxNodeId = null;
  for (const [id, p] of Object.entries(probs)) {
    const node = line.nodes[id];
    const s = computeNodeSPI(node, p) * mwBoost;
    if (s > maxScore) {
      maxScore = s;
      maxNodeId = id;
    }
  }
  return { score: maxScore, dominantNodeId: maxNodeId, probs, mwBoost };
};

/**
 * Compute SPI for every line in a catalog. Returns ordered copy by score
 * descending plus a lookup map.
 */
export const rankLinesBySPI = (lines) => {
  const entries = lines.map((line) => {
    const { score, dominantNodeId } = computeLineSPI(line);
    return { line, score, dominantNodeId };
  });
  entries.sort((a, b) => b.score - a.score);
  return entries;
};

// ======================================================================
// Explanation (for tooltip breakdown)
// ======================================================================

/**
 * Break the line's SPI down into its component factors for a tooltip.
 * Returns a structured object the UI can render without re-computing.
 */
export const explainSPI = (line) => {
  const hero = line.setup?.hero;
  const villain = line.setup?.villains?.[0];
  const potType = line.setup?.potType;

  const positionFactor = positionPairProbability(hero, villain);
  const potTypeFactor = potTypeProbability(potType);
  const boardFactor = boardClassProbability(line.tags);

  const { score, dominantNodeId, probs } = computeLineSPI(line);
  const dominantNode = dominantNodeId ? line.nodes[dominantNodeId] : null;
  const dominantReach = dominantNodeId ? (probs[dominantNodeId] ?? 0) : 0;
  const dominantPot = dominantNode?.pot ?? 0;
  const dominantDiff = dominantNode?.decision ? DIFFICULTY_DECISION : DIFFICULTY_TERMINAL;

  return {
    score,
    factors: {
      positionFactor,
      potTypeFactor,
      boardFactor,
      positionLabel: hero?.position && villain?.position
        ? `${hero.position} vs ${villain.position}`
        : '—',
      potTypeLabel: potType || '—',
      boardTagsLabel: (line.tags || []).filter((t) => BOARD_CLASS_FREQ[t]).join(' + ') || '—',
    },
    dominantNode: {
      id: dominantNodeId,
      street: dominantNode?.street,
      reachProbability: dominantReach,
      potBB: dominantPot,
      difficultyBonus: dominantDiff,
      logFreqComponent: logScore(dominantReach),
    },
  };
};

// ======================================================================
// Filter matching (used by LinePicker chips)
// ======================================================================

/**
 * Return true if the line matches the provided filter chips.
 * `filters` is an object of filter-name -> selected-value-set.
 *
 * Example: `{ potType: new Set(['srp']), position: new Set(['BTN']) }`.
 * Empty or missing filters always match.
 */
export const lineMatchesFilters = (line, filters = {}) => {
  if (!filters || Object.keys(filters).length === 0) return true;

  const hero = line.setup?.hero;
  const villain = line.setup?.villains?.[0];
  const tags = line.tags || [];

  if (filters.potType && filters.potType.size > 0) {
    if (!filters.potType.has(line.setup?.potType)) return false;
  }
  if (filters.heroPosition && filters.heroPosition.size > 0) {
    if (!filters.heroPosition.has(hero?.position)) return false;
  }
  if (filters.villainPosition && filters.villainPosition.size > 0) {
    if (!filters.villainPosition.has(villain?.position)) return false;
  }
  if (filters.multiway) {
    const isMW = (line.setup?.villains?.length ?? 1) > 1;
    if (filters.multiway === 'mw' && !isMW) return false;
    if (filters.multiway === 'hu' && isMW) return false;
  }
  if (filters.boardTag && filters.boardTag.size > 0) {
    const hit = tags.some((t) => filters.boardTag.has(t));
    if (!hit) return false;
  }
  return true;
};
