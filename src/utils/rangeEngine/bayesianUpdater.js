/**
 * bayesianUpdater.js - Bayesian range weight updates
 *
 * Takes a profile + extracted actions and updates the range grids
 * using population priors as a Bayesian starting point.
 *
 * KEY DESIGN: Updates are split by scenario (facedRaise vs noRaiseFaced).
 * Open and threeBet are NOT competing — they occur in different game states.
 * A hand like AA can be 100% in both "open" and "threeBet" ranges.
 */

import {
  getPopulationPrior,
  NO_RAISE_FREQUENCIES,
  FACED_RAISE_FREQUENCIES,
  NO_RAISE_ACTIONS,
  FACED_RAISE_ACTIONS,
  NO_RAISE_SUBCLASSES,
  FACED_RAISE_SUBCLASSES,
  SUBCLASS_SPLIT,
  SUBCLASS_PRIOR_WEIGHT,
  PRIOR_WEIGHT,
} from './populationPriors';
import { RANGE_ACTIONS, RANGE_POSITIONS } from './rangeProfile';
import { decodeIndex, rangeIndex } from '../pokerCore/rangeMatrix';
import { logger } from '../errorHandler';

const GRID_SIZE = 169;

/**
 * Update a profile's action counts and range weights from extracted actions.
 * @param {Object} profile - Range profile (mutated)
 * @param {Array} extractions - Output of extractAllActions
 * @returns {Object} The updated profile
 */
export const updateProfileFromActions = (profile, extractions) => {
  // 1. Count actions per position, split by scenario.
  //
  // Extractions are now DECISION POINTS, not hands (POKER_THEORY §2.5.4):
  // a limp-reraise hand contributes two, one to each tree. That is a
  // deliberate correction — the re-raise was previously invisible to the
  // range classes entirely (WS-256; WS-255 is the stats-layer twin). Hands
  // with no limp-reraise are counted exactly as before.
  for (const ext of extractions) {
    const { position, rangeAction, subAction } = ext;
    if (!profile.actionCounts[position] || !RANGE_ACTIONS.includes(rangeAction)) continue;

    profile.actionCounts[position][rangeAction]++;

    // Subclass counts sum into their parent; null means parent-only (the
    // unmodelled 4-bet tree, WS-270).
    if (subAction && profile.actionCounts[position][subAction] !== undefined) {
      profile.actionCounts[position][subAction]++;
    }

    profile.opportunities[position].total++;

    if (ext.facedRaise) {
      profile.opportunities[position].facedRaise++;
    } else {
      profile.opportunities[position].noRaiseFaced++;
    }
  }

  // 2. Update ranges per position, per scenario
  for (const pos of RANGE_POSITIONS) {
    const counts = profile.actionCounts[pos];
    const opp = profile.opportunities[pos];

    // --- No-raise scenario: fold / limp / open ---
    updateScenarioRanges(
      profile.ranges[pos],
      counts,
      NO_RAISE_ACTIONS,
      NO_RAISE_FREQUENCIES[pos],
      opp.noRaiseFaced,
      pos
    );

    // --- Faced-raise scenario: fold / coldCall / threeBet ---
    updateScenarioRanges(
      profile.ranges[pos],
      counts,
      FACED_RAISE_ACTIONS,
      FACED_RAISE_FREQUENCIES[pos],
      opp.facedRaise,
      pos
    );

    // --- Derived subclasses, apportioned out of their parent's grid ---
    updateSubclassRanges(profile.ranges[pos], counts, 'open', NO_RAISE_SUBCLASSES, pos);
    updateSubclassRanges(profile.ranges[pos], counts, 'threeBet', FACED_RAISE_SUBCLASSES, pos);
  }

  // 3. Apply showdown anchors and count showdowns.
  //
  // Update gating policy (RANGE_ENGINE_DESIGN.md §4.5; ratified WS-175 / SPR-067):
  // every showdown reveal applies an anchor on every buildRangeProfile call.
  // The architecture is stateless full-rebuild — there is no incremental write
  // queue to batch against. The 'every showdown' policy was chosen explicitly
  // over batch / N-threshold variants because (a) showdowns are sparse and
  // already gated by reaching the river, (b) the count-cache skip pattern in
  // usePlayerTendencies handles recompute-thrash, (c) batching contradicts
  // the live-HUD freshness contract.
  for (const ext of extractions) {
    if (ext.showdownIndex !== null) {
      // Anchor the retained PARENT grid — every existing consumer of
      // `threeBet` / `open` keeps seeing every anchor it saw before.
      applyShowdownAnchor(
        profile,
        ext.position,
        ext.rangeAction,
        ext.showdownIndex,
        ext.showdownOutcome,
        ext.revealMechanism || 'showdown'
      );

      // ...and the derived subclass, when one applies. A revealed hand
      // genuinely belongs to both ranges — mixing is real, and we never
      // reduce a hand's weight in one range because it appeared in another
      // (rangeEngine/CLAUDE.md §2, §6).
      if (ext.subAction) {
        applyShowdownAnchor(
          profile,
          ext.position,
          ext.subAction,
          ext.showdownIndex,
          ext.showdownOutcome,
          ext.revealMechanism || 'showdown'
        );
      }

      // showdownsSeen counts HANDS, not decision points — a limp-reraise hand
      // reveals one hand, not two.
      if (ext.isPrimaryDecision !== false) {
        profile.opportunities[ext.position].showdownsSeen++;
      }
    }
  }

  return profile;
};

/**
 * Update range weights for one scenario (noRaise or facedRaise).
 * Each scenario's actions are independent and sum to 1.0 within that scenario.
 *
 * @param {Object} ranges - ranges[action] = Float64Array(169) for this position
 * @param {Object} counts - actionCounts for this position
 * @param {string[]} actions - the actions in this scenario (e.g. ['fold','limp','open'])
 * @param {Object} popFreqs - population frequencies for this scenario
 * @param {number} totalObserved - total observations in this scenario
 * @param {string} pos - position key
 */
const updateScenarioRanges = (ranges, counts, actions, popFreqs, totalObserved, pos) => {
  // Derive scenario-specific fold count.
  // Fold is stored as one combined count, but we need it per scenario.
  // fold_in_scenario = totalObserved - sum(non_fold_actions_in_scenario)
  const nonFoldActions = actions.filter(a => a !== 'fold');
  const nonFoldTotal = nonFoldActions.reduce((sum, a) => sum + (counts[a] || 0), 0);
  const rawFoldCount = totalObserved - nonFoldTotal;
  if (rawFoldCount < 0) {
    logger.warn('BayesianUpdater', `Negative fold count (${rawFoldCount}) at ${pos}: totalObserved=${totalObserved}, nonFoldTotal=${nonFoldTotal}`);
  }
  const scenarioFoldCount = Math.max(0, rawFoldCount);

  for (const action of actions) {
    const populationFreq = popFreqs[action];
    if (populationFreq === undefined) continue;

    const prior = getPopulationPrior(pos, action);
    const observedCount = action === 'fold' ? scenarioFoldCount : (counts[action] || 0);

    // Bayesian effective frequency
    const effectiveFreq = (PRIOR_WEIGHT * populationFreq + observedCount) /
                          (PRIOR_WEIGHT + totalObserved);

    // Scale prior range by frequency ratio
    const ratio = populationFreq > 0 ? effectiveFreq / populationFreq : effectiveFreq;

    for (let i = 0; i < GRID_SIZE; i++) {
      ranges[action][i] = Math.min(1.0, prior[i] * ratio);
    }
  }
};

/**
 * Update the derived subclass grids for one parent, with HIERARCHICAL SHRINKAGE.
 *
 * The sparse-data rule (POKER_THEORY §2.5.3 / DEC-025 AS-2): splitting a class
 * divides the same observations across more buckets, so a subclass must shrink
 * toward ITS PARENT — never toward an independent flat prior. A thin subclass
 * therefore reproduces its parent's behavior, and only accumulating evidence
 * pulls it away. This mirrors the poolBaseline.js hierarchical philosophy
 * (§6.5a).
 *
 * The shrinkage binds in BOTH dimensions, and both were wrong in the first
 * WS-256 implementation:
 *
 *   1. SPLIT — what share of the parent each subclass takes. Estimated
 *      CONDITIONALLY, against the parent's own occurrences:
 *        splitPost_sub = (W_s · SPLIT[pos][sub] + n_sub) / (W_s + n_parent)
 *      The denominator is the number of times the PARENT action actually
 *      happened — not the scenario-wide opportunity count N. A fold is not an
 *      opportunity to observe *which kind* of 3-bet occurred, and counting it
 *      as one is what let a single squeeze in 40 spots move the estimate ~4×.
 *      W_s is therefore read the same way as PRIOR_WEIGHT: ~10 virtual 3-bets
 *      before observed data dominates the doctrine split.
 *
 *   2. GRID — WHICH HANDS the subclass contains. The subclass grid is carved
 *      OUT OF the parent grid, never built beside it:
 *        ranges[sub][h] = ranges[parent][h] × share_sub(h) × totalShare
 *      where share_sub(h) = P(sub | h, parent) ∝ splitPost_sub · prior_sub(h),
 *      summing to 1 across siblings. `prior_sub(h)` is the doctrine propensity
 *      grid used as-is — see the note in the loop on why normalizing it is
 *      wrong.
 *
 * Deriving the grid independently (prior_sub × ratio) was the more serious half
 * of the defect: it let a child range exceed its own parent — `limpReraise[QQ]
 * = 1.00` against `threeBet[QQ] = 0.58`, with subclass mass summing above the
 * parent in 151/169 cells — contradicting the ratified meaning of a parent as
 * EXACTLY the union of its subclasses (DEC-025 §1). Anchoring to the parent
 * grid makes that impossible by construction: a lone observation now shifts the
 * SPLIT between siblings instead of resizing the range.
 *
 * `totalShare = Σ splitPost` falls out of the same arithmetic and is ≤ 1
 * exactly when some parent observations carry no subclass — which is precisely
 * the unmodelled 4-bet tree (`subAction: null`). The residual is not a fudge
 * factor; it is WS-270's slice, left with the parent.
 *
 * The per-subclass priors keep their doctrinal job — they supply P(h | sub),
 * the SHAPE (cold3Bet strongest, squeeze polar, limpReraise uncapped) — but as
 * a RELATIVE statement about how the parent divides, not an absolute range.
 *
 * @param {Object} ranges - ranges[action] = Float64Array(169) for this position
 * @param {Object} counts - actionCounts for this position
 * @param {string} parent - retained parent action ('open' | 'threeBet')
 * @param {string[]} subclasses - the parent's subclasses
 * @param {string} pos - position key
 */
const updateSubclassRanges = (ranges, counts, parent, subclasses, pos) => {
  const split = SUBCLASS_SPLIT[parent]?.[pos];
  const parentGrid = ranges[parent];
  if (!split || !parentGrid) return;

  const present = subclasses.filter(sub => ranges[sub]);
  if (present.length === 0) return;

  // --- Dimension 1: the conditional split, and each subclass's hand shape.
  const parentCount = counts[parent] || 0;
  const splitPost = {};
  const shapes = {};
  let shareTotal = 0;

  for (const sub of present) {
    const fraction = split[sub] ?? 0;

    // A structurally impossible subclass (BB limp-reraise: BB cannot limp)
    // takes zero parent mass rather than inheriting a spurious share.
    if (fraction <= 0) {
      splitPost[sub] = 0;
      shapes[sub] = null;
      continue;
    }

    splitPost[sub] = (SUBCLASS_PRIOR_WEIGHT * fraction + (counts[sub] || 0)) /
                     (SUBCLASS_PRIOR_WEIGHT + parentCount);
    shareTotal += splitPost[sub];

    // The doctrine prior, used AS IS. `getPopulationPrior` returns a per-hand
    // PROPENSITY (how readily this hand takes this line) — the same semantics
    // every other grid in this engine carries — not a distribution over hands.
    // Normalizing it by its own total would divide each cell by the range's
    // breadth, penalizing wide ranges everywhere: it made the deliberately
    // uncapped limpReraise range LESS likely at AA than the narrow squeeze
    // range, inverting §2.5.2. Propensities compose directly:
    //   P(sub | h, parent) = P(sub|h) / Σ_siblings P(sib|h)
    shapes[sub] = getPopulationPrior(pos, sub);
  }

  // What the modelled subclasses claim between them; the rest stays with the
  // parent alone (the unmodelled 4-bet tree — WS-270).
  const totalShare = Math.min(1, shareTotal);

  if (totalShare <= 0) {
    for (const sub of present) ranges[sub].fill(0);
    return;
  }

  // --- Dimension 2: apportion the parent grid, cell by cell.
  const weights = new Float64Array(present.length);

  for (let i = 0; i < GRID_SIZE; i++) {
    let denom = 0;
    for (let s = 0; s < present.length; s++) {
      const shape = shapes[present[s]];
      const w = shape ? splitPost[present[s]] * shape[i] : 0;
      weights[s] = w;
      denom += w;
    }

    for (let s = 0; s < present.length; s++) {
      const sub = present[s];
      // When no subclass prior covers this hand, the parent still says the
      // hand IS raised here — so it must be SOME subclass. Fall back to the
      // split-only apportionment rather than letting the mass vanish.
      const share = denom > 0 ? weights[s] / denom : splitPost[sub] / shareTotal;
      ranges[sub][i] = parentGrid[i] * share * totalShare;
    }
  }
};

/**
 * Apply a showdown anchor — a confirmed hand in a known action range.
 * Sets that hand to weight 1.0 and boosts hands with shared ranks.
 *
 * If we see AKs opened, boost: AKo (same ranks, different suitedness),
 * other Ax suited, other Kx suited (same high/low card combos).
 * Does NOT boost arbitrary grid neighbors — only semantically related hands.
 *
 * FM-SEL-01 disposition (RANGE_ENGINE_DESIGN.md §4.5; ratified WS-175 / SPR-067):
 * showdown selection bias (MNAR) is ACCEPTED with observability rails — the
 * `revealMechanism` field is recorded on every anchor so future calibration
 * (when distinguishable mechanisms are extracted) can apply mechanism-aware
 * boost-magnitude correction without a schema change. Boost magnitudes are
 * NOT reduced today (no math change); the field exists as a hook.
 *
 * @param {Object} profile - Range profile (mutated)
 * @param {string} position
 * @param {string} action
 * @param {number} handGridIndex - 0-168 grid index
 * @param {string|null} outcome - 'won', 'lost', or null (backward compat)
 * @param {string} revealMechanism - 'showdown' | 'mucked-shown' | 'all-in-runout' | 'inferred-from-fold' (default 'showdown')
 */
export const applyShowdownAnchor = (profile, position, action, handGridIndex, outcome = null, revealMechanism = 'showdown') => {
  if (!profile.ranges[position] || !profile.ranges[position][action]) return;

  const range = profile.ranges[position][action];
  const { rank1, rank2, suited, isPair } = decodeIndex(handGridIndex);

  // Outcome-aware boost levels
  const altSuitBoost = outcome === 'won' ? 0.30 : outcome === 'lost' ? 0.15 : 0.25;
  const adjPairBoost = outcome === 'won' ? 0.25 : outcome === 'lost' ? 0.10 : 0.20;
  const adjKickerBoost = outcome === 'won' ? 0.20 : outcome === 'lost' ? 0.08 : 0.15;

  // Set confirmed hand to weight 1.0
  range[handGridIndex] = 1.0;

  // Boost the other suitedness variant (AKs seen → boost AKo, and vice versa)
  if (!isPair) {
    const altIdx = rangeIndex(rank1, rank2, !suited);
    range[altIdx] = Math.min(1.0, range[altIdx] + altSuitBoost);
  }

  // Boost adjacent pairs (if we see TT, boost 99 and JJ)
  if (isPair) {
    if (rank1 > 0) {
      const lowerPair = rangeIndex(rank1 - 1, rank1 - 1, false);
      range[lowerPair] = Math.min(1.0, range[lowerPair] + adjPairBoost);
    }
    if (rank1 < 12) {
      const higherPair = rangeIndex(rank1 + 1, rank1 + 1, false);
      range[higherPair] = Math.min(1.0, range[higherPair] + adjPairBoost);
    }
  } else {
    // Boost same high card with adjacent kickers (AKs → AQs, AJs get small boost)
    for (let delta = -1; delta <= 1; delta += 2) {
      const adjKicker = rank2 + delta;
      if (adjKicker >= 0 && adjKicker < rank1) {
        const adjIdx = rangeIndex(rank1, adjKicker, suited);
        range[adjIdx] = Math.min(1.0, range[adjIdx] + adjKickerBoost);
      }
    }
  }

  // Record the anchor (revealMechanism is the FM-SEL-01 observability rail —
  // every recorded mechanism today is 'showdown' but the field is reserved
  // for future distinguishability per RANGE_ENGINE_DESIGN.md §4.5).
  profile.showdownAnchors.push({
    position,
    action,
    handIndex: handGridIndex,
    outcome,
    revealMechanism,
  });
};

/**
 * Update sub-action counts (limp follow-up actions) from extracted sub-actions.
 * @param {Object} profile - Range profile (mutated)
 * @param {Array} subExtractions - Output of extractAllSubActions
 * @returns {Object} The updated profile
 */
export const updateSubActionCounts = (profile, subExtractions) => {
  for (const ext of subExtractions) {
    const { position, subAction } = ext;
    if (profile.subActionCounts[position] && profile.subActionCounts[position][subAction] !== undefined) {
      profile.subActionCounts[position][subAction]++;
    }
  }
  return profile;
};
