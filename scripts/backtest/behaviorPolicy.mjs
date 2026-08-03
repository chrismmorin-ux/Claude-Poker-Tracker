/**
 * behaviorPolicy.mjs — pi_pool(a | s): what the FIELD actually does at a decision node.
 *
 * WHY THIS EXISTS (WS-287). The hero-EV instrument estimates the value of the engine's
 * advice by importance-weighting realized corpus outcomes:
 *
 *     w = pi_ours(a_observed | s) / pi_pool(a_observed | s)
 *
 * `pi_pool` is the BEHAVIOUR policy — the propensity with which the observed action was
 * generated. It sits in the denominator of every weight, so two properties are
 * load-bearing:
 *
 *   1. IT MUST BE MINED FROM THE POOL HALF. Fitting propensities on the same players
 *      the instrument scores would make the weights a function of the evaluation set,
 *      which is the leakage the WS-259 two-level split exists to prevent. The table
 *      carries the same `pool-train` provenance stamp `leakageGuard.validateReferenceTable`
 *      already enforces, so an unstamped table cannot be used by accident.
 *   2. IT MUST CONDITION ON EVERYTHING pi_ours CONDITIONS ON. Any state variable the
 *      engine's policy reacts to but the propensity ignores is an unobserved confounder,
 *      and the weights are biased rather than merely noisy. That is why `sizeBucket`
 *      appears in the hierarchy below and not just in the slicing: the engine's advice
 *      is strongly driven by bet-to-pot ratio (it sets pot odds and the POKER_THEORY 6.3
 *      breakeven), so a propensity blind to sizing would be the wrong conditional.
 *
 * ESTIMATION — SHRINKAGE, NEVER A THRESHOLD. Contexts are resolved by the same
 * construction WS-285 installed in `villainDecisionModel` (POKER_THEORY 11.5): every
 * broader level primes the next as its prior, so a thin cell stays near the pooled
 * behaviour and a well-sampled one dominates it, with no cutoff anywhere. The
 * `exploitEngine/CLAUDE.md` anti-pattern is explicit that `if (n >= K) use the specific
 * estimate` is "a threshold label, the same anti-pattern in another costume" — and it
 * would bite harder here than in the villain model, because a propensity that jumps
 * discontinuously produces weights that jump with it.
 */

import { HIERARCHY_ORDER } from '../../src/utils/exploitEngine/villainDecisionModel.js';
import { LeakageError } from './leakageGuard.mjs';

/** Response sets per facing action — mirrors RESPONSES_BY_FACING in villainDecisionModel. */
export const RESPONSES_BY_FACING = {
  none: ['check', 'bet'],
  bet: ['fold', 'call', 'raise'],
  raise: ['fold', 'call', 'raise'],
};

/**
 * Context dimensions, broadest-first, that the policy conditions on.
 *
 * The first five are `HIERARCHY_ORDER` — MEASURED by the WS-285 ablation, not reasoned,
 * and imported rather than re-declared so a future re-measurement cannot leave the two
 * out of step. `sizeBucket` is appended as the most specific dimension for the
 * confounding reason in the header: pi_ours reacts to bet sizing, so pi_pool must too.
 */
export const POLICY_HIERARCHY = [...HIERARCHY_ORDER, 'sizeBucket'];

/** Provenance stamp the leakage guard requires. Same value the reference table uses. */
export const POLICY_PARTITION_STAMP = 'pool-train';

/** Dirichlet strength of the parent constraint at each shrinkage step. */
export const DEFAULT_SHRINK_WEIGHT = 10;

/** Uniform seed prior, so an entirely unobserved cell is flat rather than undefined. */
const SEED_ALPHA = 1;

/**
 * Geometry-extended hierarchies (WS-333).
 *
 * `POLICY_HIERARCHY` stays the shipped default and is unchanged. These are the ARMS of the
 * geometry ablation: whether decisions sharing pot-odds geometry pool across streets and
 * positions is AS-711, and AS-711 has an ablation as its named falsifier — so the hierarchy
 * is a parameter here rather than a decision made in a comment.
 *
 * Note both extended arms keep `sizeBucket` and append the new coordinates at the SPECIFIC
 * end, exactly as `sizeBucket` itself was appended: the measured `HIERARCHY_ORDER` is
 * imported, never re-declared, so a future re-measurement cannot leave the two out of step.
 */
export const GEOMETRY_DIMS = ['sprBand', 'closesAction'];

/** Geometry appended to the shipped ladder — does geometry add anything to what we have? */
export const POLICY_HIERARCHY_GEOMETRY = [...POLICY_HIERARCHY, ...GEOMETRY_DIMS];

/**
 * Geometry ALONE, with `street` and `posCategory` removed.
 *
 * This is the arm that actually tests the founder's claim: if structurally identical spots
 * pool, this should not lose materially to the full ladder — and it buys far more decisions
 * per cell. If it DOES lose, pooling bought power with bias and the key must stay split.
 */
export const POLICY_HIERARCHY_GEOMETRY_ONLY = [
  ...HIERARCHY_ORDER.filter((d) => d !== 'street' && d !== 'posCategory'),
  'sizeBucket',
  ...GEOMETRY_DIMS,
];

const levelKey = (ctx, depth, hierarchy = POLICY_HIERARCHY) => {
  const parts = [ctx.facingAction ?? 'none'];
  for (let i = 0; i < depth; i++) parts.push(String(ctx[hierarchy[i]] ?? '*'));
  return parts.join('|');
};

/**
 * Tally observed (context -> action) pairs into per-depth count tables.
 *
 * One pass produces every level, because each observation belongs to exactly one cell
 * at each depth. The full table is small — the dimensions are all low-cardinality, so
 * even the deepest level is on the order of a thousand cells.
 *
 * @param {Iterable<Object>} observations - { facingAction, action, ...POLICY_HIERARCHY dims }
 * @param {Object} [meta] - provenance detail merged into the stamp
 * @returns {Object} policy table
 */
export const buildPolicyTable = (observations, meta = {}, { hierarchy = POLICY_HIERARCHY } = {}) => {
  const levels = Array.from({ length: hierarchy.length + 1 }, () => ({}));
  let total = 0;
  const skipped = { unknownFacing: 0, actionNotInResponseSet: 0 };

  for (const obs of observations) {
    const facing = obs.facingAction ?? 'none';
    const responses = RESPONSES_BY_FACING[facing];
    if (!responses) { skipped.unknownFacing++; continue; }
    if (!responses.includes(obs.action)) { skipped.actionNotInResponseSet++; continue; }

    for (let depth = 0; depth <= hierarchy.length; depth++) {
      const key = levelKey(obs, depth, hierarchy);
      const cell = levels[depth][key] || (levels[depth][key] = {});
      cell[obs.action] = (cell[obs.action] || 0) + 1;
    }
    total++;
  }

  return {
    provenance: {
      partition: POLICY_PARTITION_STAMP,
      // The table records the hierarchy it was BUILT with, and `queryPolicy` reads it back
      // rather than assuming the module default — otherwise an ablation arm would be scored
      // against level keys it never built.
      hierarchy,
      shrinkWeight: DEFAULT_SHRINK_WEIGHT,
      observations: total,
      skipped,
      ...meta,
    },
    levels,
  };
};

/**
 * Refuse a behaviour-policy table that could contaminate the scored set.
 *
 * Deliberately a separate function from `leakageGuard.validateReferenceTable` rather
 * than a reuse of it: that one asserts the SHAPE of a stake-keyed reference table
 * (`reference.stakes` non-empty), which a policy table does not have. Shoehorning one
 * into the other would mean weakening a guard to fit a second payload — the wrong
 * direction entirely. What IS shared is the discipline and the error type, so a
 * refusal here is indistinguishable from a refusal there.
 *
 * @throws {LeakageError}
 */
export const validateBehaviorPolicy = (table, poolPct) => {
  if (!table || typeof table !== 'object' || !Array.isArray(table.levels)) {
    throw new LeakageError(
      'Hero-EV run refused: no behaviour-policy table supplied. Importance weights ' +
      'divide by pi_pool, so an absent or ad-hoc propensity source would silently ' +
      'decide the result. Mine one with mine-behavior-policy.mjs.',
    );
  }
  const p = table.provenance;
  if (!p || p.partition !== POLICY_PARTITION_STAMP) {
    throw new LeakageError(
      `Hero-EV run refused: behaviour-policy table is not stamped "${POLICY_PARTITION_STAMP}". ` +
      `Got partition=${JSON.stringify(p?.partition)}. An unstamped table is assumed to ` +
      'have been fitted on all players, which would put the scored players into their ' +
      'own propensities.',
      { provenance: p },
    );
  }
  if (p.poolPct !== poolPct) {
    throw new LeakageError(
      `Hero-EV run refused: behaviour policy was mined at poolPct=${p.poolPct} but this ` +
      `run partitions at poolPct=${poolPct}. The EVAL set would not be disjoint from the ` +
      'players whose behaviour defines the propensities.',
      { provenance: p, poolPct },
    );
  }
  if (!(p.observations > 0)) {
    throw new LeakageError('Hero-EV run refused: behaviour-policy table has no observations.', { provenance: p });
  }
  return table;
};

/**
 * pi_pool(. | s) — resolve a context to an action distribution by shrinkage.
 *
 * Walks broadest -> most specific. Each step rescales the running posterior to the
 * parent-constraint weight and adds that level's raw counts on top, so evidence
 * accumulates smoothly and a cell with no observations of its own simply inherits its
 * parent. Identical in construction to `resolveByShrinkage` in villainDecisionModel.
 *
 * @returns {{actions: Object, evidenceN: number, deepestDepth: number}}
 */
export const queryPolicy = (table, ctx, { shrinkWeight } = {}) => {
  const facing = ctx.facingAction ?? 'none';
  const responses = RESPONSES_BY_FACING[facing] || RESPONSES_BY_FACING.none;
  const w = Number.isFinite(shrinkWeight)
    ? shrinkWeight
    : (table?.provenance?.shrinkWeight ?? DEFAULT_SHRINK_WEIGHT);

  const alpha = {};
  for (const a of responses) alpha[a] = SEED_ALPHA;

  let evidenceN = 0;
  let deepestDepth = -1;
  let lastAppliedN = null;

  // Read the hierarchy back off the table rather than assuming the module default: an
  // ablation arm built under a different ladder must be QUERIED under that same ladder, or
  // it would be scored against level keys it never built (WS-333).
  const hierarchy = table?.provenance?.hierarchy ?? POLICY_HIERARCHY;

  for (let depth = 0; depth <= hierarchy.length; depth++) {
    const cell = table?.levels?.[depth]?.[levelKey(ctx, depth, hierarchy)];
    if (!cell) continue;

    let totalN = 0;
    for (const a of responses) totalN += cell[a] || 0;
    if (totalN <= 0) continue;
    // A cell identical in size to its parent contains the same observations; applying
    // it again would double-count that evidence and over-sharpen the estimate.
    if (totalN === lastAppliedN) continue;

    let sum = 0;
    for (const a of responses) sum += alpha[a];
    for (const a of responses) {
      alpha[a] = (alpha[a] / sum) * w + (cell[a] || 0);
    }

    lastAppliedN = totalN;
    deepestDepth = depth;
    evidenceN = Math.max(evidenceN, totalN);
  }

  let sum = 0;
  for (const a of responses) sum += alpha[a];
  const actions = {};
  for (const a of responses) actions[a] = alpha[a] / sum;

  return { actions, evidenceN, deepestDepth };
};

/**
 * Shift a distribution's fold mass by `deltaPp` percentage points, renormalizing the
 * remaining actions proportionally.
 *
 * This is the live-shift arm of the sensitivity band (founder decision, 2026-07-28:
 * certify structure, stress-test the value). WS-283 measured the shipped fold-to-bet
 * estimate running ~13pp low, and live pools are widely believed to fold differently
 * from 2009 online ones. Re-running the estimate with the field folding more tells us
 * whether the SIGN of the edge survives conditions we did not observe.
 *
 * WHAT THIS IS NOT. The realized outcomes remain 2009 outcomes. This re-weights the
 * hands we have; it does not simulate a live game. It answers "if the field folded
 * more, would this advice still look good on these hands" and nothing broader.
 */
export const applyFoldShift = (actions, deltaPp) => {
  if (!Number.isFinite(deltaPp) || deltaPp === 0) return { ...actions };
  if (!('fold' in actions)) return { ...actions };

  const delta = deltaPp / 100;
  const newFold = Math.min(0.99, Math.max(0.01, (actions.fold ?? 0) + delta));
  const others = Object.keys(actions).filter((a) => a !== 'fold');
  const otherMass = others.reduce((s, a) => s + (actions[a] ?? 0), 0);

  const out = { fold: newFold };
  const remaining = 1 - newFold;
  for (const a of others) {
    out[a] = otherMass > 0 ? (actions[a] / otherMass) * remaining : remaining / others.length;
  }
  return out;
};
