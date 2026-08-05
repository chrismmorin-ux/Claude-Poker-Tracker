/**
 * atomize.js — THE READER predictionAudit never had (WS-328).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHAT WAS WRONG.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * `reconstructPredictionAudit` is called at hand-save time by `usePersistence`, sanitized by
 * `predictionAuditWriter.writePredictionAudit`, and stored on the hand record. Nothing has ever
 * read it back. `readPredictionAudit` exists in the writer and has no production caller;
 * WS-328's own ticket names this as the repo's canonical shipped-but-inert capability, and
 * WS-284 (commit f1b712eb) established what an accepted fix looks like: wire a production
 * caller in the SAME change, and add an assertion that the wired path DIVERGES from the
 * unwired one, so inertness is a run failure rather than something a human notices later.
 *
 * Data captured but never queried is WORSE than absent: it looks like coverage, costs run time,
 * and rots silently because nothing exercises it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE IS.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * A predictionAudit payload is ALREADY a decision record: a predicted action distribution per
 * modeled node, the observed action per sequence entry, and a model version. That is a Decision
 * Atom with three fields missing (a situation key, a surface id, and a basis-carrying truth).
 * So the fix is not a new capture — it is a projection of the existing one onto the Standard of
 * Record's primary record, which makes every atom reader in `atomsSelfCheck` a reader of
 * predictionAudit by construction. One reader added by hand rots; a reader the self-check
 * enforces cannot.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE MODELED-NODE WALK IS REDONE HERE RATHER THAN JOINED ON AN ID.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * `predictedDistribution` entries carry `{actor, actorId, seat, distribution}` and NO order,
 * so they cannot be joined back to the action they describe by key. What they do carry is D3=A's
 * guarantee: exactly one entry per modeled node, in sequence order. This module re-walks the
 * action sequence with the SAME predicate (`defaultIsModeledNode`, now exported rather than
 * re-implemented — a second implementation would drift and the atoms would then describe nodes
 * the app never modeled) and zips. A length mismatch THROWS: a silent off-by-one would attach
 * every prediction to the wrong decision, and every number downstream would still look fine.
 */

import { buildDecisionAtom, buildAtomTruth } from '../standardOfRecord/decisionAtom.js';
import { StandardOfRecordError } from '../standardOfRecord/schemas.js';
import { defaultIsModeledNode } from './reconstruct.js';

/** Why an atom carries no usable distribution. Atom-level, not a counter — WS-328's directive. */
export const ATOM_SKIP_REASONS = Object.freeze({
  /** D3=A: the model was asked and could not evaluate this node. */
  MODEL_EMPTY_DISTRIBUTION: 'model-returned-empty-distribution',
  /** No engine deps were supplied, so no model was ever asked. A DIFFERENT fact. */
  NO_MODEL_SUPPLIED: 'no-model-supplied',
});

/** `[{action, weight}]` -> `{action: weight}`. A pure action is `{act: 1.0}` — one shape. */
const toDistribution = (list) => {
  const out = {};
  for (const item of list ?? []) {
    if (!item?.action || !Number.isFinite(item.weight)) continue;
    out[item.action] = (out[item.action] ?? 0) + item.weight;
  }
  return out;
};

/**
 * Every alternative's score under the surface's own model, plus the decision MARGIN.
 *
 * The margin is the point: near-ties are where two strategies differ and where a model is
 * fragile, and a stored top choice cannot say whether this decision was a coin-flip or a
 * landslide. Answers WS-328's "how close was this?".
 */
const scoreAlternatives = (distribution) => {
  const entries = Object.entries(distribution);
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  return {
    scores: Object.fromEntries(entries),
    best: sorted[0][0],
    runnerUp: sorted[1]?.[0] ?? null,
    margin: sorted.length > 1 ? sorted[0][1] - sorted[1][1] : null,
    alternativeCount: entries.length,
  };
};

/** The modeled nodes of a hand, in sequence order. Mirrors reconstruct.js exactly. */
export const modeledNodes = (actionSequence, { mySeat, isModeledNode = defaultIsModeledNode }) => {
  const nodes = [];
  const prevByStreet = {};
  for (let i = 0; i < actionSequence.length; i += 1) {
    const entry = actionSequence[i];
    const street = entry?.street ?? null;
    const seat = entry?.seat ?? null;
    if (street && seat != null) {
      const prevActionsThisStreet = prevByStreet[street] || [];
      const ctx = {
        street,
        seat,
        actor: (seat != null && seat === mySeat) ? 'hero' : 'villain',
        prevActionsThisStreet: prevActionsThisStreet.slice(),
        fullActionSequence: actionSequence,
        index: i,
      };
      if (isModeledNode(entry, ctx)) nodes.push({ entry, ctx });
    }
    if (street) {
      prevByStreet[street] = prevByStreet[street] || [];
      prevByStreet[street].push(entry);
    }
  }
  return nodes;
};

/**
 * Project a predictionAudit payload onto Decision Atoms.
 *
 * @param {Object} params
 * @param {Object} params.handData - the app-shaped hand the audit was reconstructed from
 * @param {Object} params.audit - `reconstructPredictionAudit` output (or a stored payload)
 * @param {string} params.surfaceId - which surface produced these actions
 * @param {Function} params.situationKeyFor - `({entry, ctx, handData}) => string`. REQUIRED.
 *   No default: a fallback would be "a positional string of the caller's own devising", which
 *   the atom schema explicitly forbids, and a wrong key is worse than a missing one because
 *   every slice built on it silently mixes populations.
 * @param {Function} [params.carriedFor] - `({entry, ctx}) => object`, the carried context
 * @param {Object} [params.seeds] - seeds this hand's decisions depended on
 * @param {Function} [params.beliefFor] - `({entry, ctx}) => object|null`, range per live opponent
 * @param {string} [params.handId]
 */
export const atomizePredictionAudit = ({
  handData,
  audit,
  surfaceId,
  situationKeyFor,
  carriedFor = null,
  seeds = {},
  beliefFor = null,
  handId = null,
} = {}) => {
  if (typeof situationKeyFor !== 'function') {
    throw new StandardOfRecordError(
      'atomizePredictionAudit: situationKeyFor is required. There is deliberately no default — '
      + 'the atom schema forbids a positional key of the caller\'s own devising, and a plausible '
      + 'wrong key silently mixes populations in every slice built on it.',
    );
  }
  const gameState = handData?.gameState ?? {};
  const actionSequence = Array.isArray(gameState.actionSequence) ? gameState.actionSequence : [];
  const mySeat = gameState.mySeat;
  const id = handId ?? handData?.handId ?? 'hand';

  const nodes = modeledNodes(actionSequence, { mySeat });
  const predicted = Array.isArray(audit?.predictedDistribution) ? audit.predictedDistribution : [];

  // THE PHASE 5a SHAPE, and why it is a case rather than an error. `reconstructPredictionAudit`
  // short-circuits to `predictedDistribution: []` when no engine dep was supplied — so the
  // UNWIRED arm has no entries at all, not empty ones. Refusing it would make the unwired arm
  // unrepresentable, and an arm you cannot represent is an arm you cannot compare against:
  // `assertPredictionAuditLive` would have nothing to prove divergence FROM. So a wholly empty
  // prediction list over a hand that has modeled nodes is recorded as `no-model-supplied` on
  // every node — a different fact from `model-returned-empty-distribution`, and the pair is
  // what makes inertness measurable rather than merely suspected.
  const noModelSupplied = predicted.length === 0 && nodes.length > 0;

  if (!noModelSupplied && predicted.length !== nodes.length) {
    throw new StandardOfRecordError(
      `atomizePredictionAudit: the audit carries ${predicted.length} predicted distributions but `
      + `the hand has ${nodes.length} modeled nodes. D3=A guarantees 1:1 alignment, so a mismatch `
      + 'means the predicate that produced the audit is not the one reading it — and a silent '
      + 'off-by-one would attach every prediction to the wrong decision.',
      { handId: id, predicted: predicted.length, nodes: nodes.length },
    );
  }

  const showdown = gameState.showdownCards ?? {};

  return nodes.map(({ entry, ctx }, i) => {
    const p = predicted[i] ?? {};
    const distribution = toDistribution(p.distribution);
    const empty = Object.keys(distribution).length === 0;

    // A revealed holding is `observed`; nothing else here ever is. `buildAtomTruth` throws on a
    // missing basis rather than defaulting one, so a hypothesized branch can never be scored
    // against a shown hand by accident.
    const revealed = showdown?.[ctx.seat] ?? null;
    const truth = revealed
      ? buildAtomTruth({ revealed, basis: 'observed', revealedAt: 'showdown' })
      : null;

    return buildDecisionAtom({
      atomId: `${id}#${entry.order ?? i}@${ctx.seat}`,
      situationKey: situationKeyFor({ entry, ctx, handData }),
      carried: carriedFor ? carriedFor({ entry, ctx, handData }) : {},
      surfaceId,
      // The DISTRIBUTION the surface emitted. Empty stays empty and is flagged by skipReason —
      // substituting the observed action here would turn "the model could not evaluate" into
      // "the model predicted perfectly", which is the most flattering possible corruption.
      action: distribution,
      ruleId: audit?.modelVersion ?? null,
      warrant: null,
      layers: [],
      outcome: {
        observedAction: entry?.action ?? null,
        sizing: Number.isFinite(entry?.amount) ? entry.amount : null,
        street: ctx.street,
      },
      skipReason: empty
        ? (noModelSupplied
          ? ATOM_SKIP_REASONS.NO_MODEL_SUPPLIED
          : ATOM_SKIP_REASONS.MODEL_EMPTY_DISTRIBUTION)
        : null,
      alternativeScores: scoreAlternatives(distribution),
      rulesMatchedAndLost: [],
      beliefState: beliefFor ? beliefFor({ entry, ctx, handData }) : null,
      truth,
      seeds,
      actorSeat: ctx.seat,
      actorRole: ctx.actor,
      wallTimeMs: null,
      tokens: null,
    });
  });
};

/**
 * A reader over atomized predictions — the query the anti-rot rule demands, written here at
 * capture time rather than promised for later.
 *
 * Reports k/n WITH the conditioning set, and the INVERSE conditional, per the repo rule that a
 * number travels with what it is conditional on: P(scored | modeled) and P(modeled | scored)
 * support opposite reads of the same run.
 */
export const predictionAuditCoverage = (atoms) => {
  const n = atoms.length;
  const scored = atoms.filter((a) => Object.keys(a.action ?? {}).length > 0);
  const bySkip = {};
  for (const a of atoms) {
    if (a.skipReason) bySkip[a.skipReason] = (bySkip[a.skipReason] ?? 0) + 1;
  }
  const byRole = {};
  for (const a of atoms) byRole[a.actorRole ?? 'unknown'] = (byRole[a.actorRole ?? 'unknown'] ?? 0) + 1;
  const withTruth = atoms.filter((a) => a.truth !== null);
  const nearTies = scored.filter((a) => a.alternativeScores?.margin != null
    && a.alternativeScores.margin < 0.1);

  return Object.freeze({
    modeledNodes: n,
    scored: scored.length,
    scoredGivenModeled: Object.freeze({
      k: scored.length, n, rate: n ? scored.length / n : null,
      conditional: 'P(the model produced a distribution | the node was modeled)',
    }),
    skippedBySkipReason: bySkip,
    byActorRole: byRole,
    withGroundTruth: Object.freeze({
      k: withTruth.length, n, rate: n ? withTruth.length / n : null,
      conditional: 'P(the actor\'s holding was revealed | the node was modeled) — showdown-selected',
    }),
    nearTies: Object.freeze({
      k: nearTies.length, n: scored.length, rate: scored.length ? nearTies.length / scored.length : null,
      conditional: 'P(top-two margin < 0.10 | the model produced a distribution)',
    }),
  });
};

/**
 * THE DIVERGENCE ASSERTION. Inertness becomes a run failure, not a later discovery.
 *
 * WS-284's `assertReferenceTierLive` is the precedent and the shape is the same: run the arm
 * WITH the capability and the arm WITHOUT it, and refuse to accept a run in which they agree.
 * A capability that is correct, tested, and unreachable is green in every test that calls it
 * directly — which is exactly how predictionAudit shipped and sat for a year.
 *
 * What has to diverge here is not "some field is different" but the SCORED SET: the wired arm
 * must produce distributions where the unwired arm produced empties. Comparing anything weaker
 * (atom counts, ids) would pass on two runs that both scored nothing.
 *
 * @param {Object} params
 * @param {Array} params.wired - atoms from the arm with engine deps supplied
 * @param {Array} params.unwired - atoms from the arm with no deps (Phase 5a behaviour)
 */
export const assertPredictionAuditLive = ({ wired = [], unwired = [] } = {}) => {
  const scoredOf = (atoms) => atoms.filter((a) => Object.keys(a.action ?? {}).length > 0).length;
  const wiredScored = scoredOf(wired);
  const unwiredScored = scoredOf(unwired);

  if (wired.length === 0) {
    throw new StandardOfRecordError(
      'assertPredictionAuditLive: the wired arm produced no atoms at all. A reader that reads '
      + 'nothing is the inert state wearing a green tick.',
      { wired: 0 },
    );
  }
  if (wiredScored <= unwiredScored) {
    throw new StandardOfRecordError(
      `assertPredictionAuditLive: the wired arm scored ${wiredScored} of ${wired.length} nodes and `
      + `the unwired arm scored ${unwiredScored} of ${unwired.length}. The engine deps made no `
      + 'difference, so predictionAudit is inert on this path — the exact failure family this '
      + 'change exists to close (WS-276 perceivedHeroRange, WS-284 --reference). Refusing the run.',
      { wiredScored, unwiredScored, wired: wired.length, unwired: unwired.length },
    );
  }
  return Object.freeze({
    wiredScored,
    unwiredScored,
    lift: unwiredScored === 0 ? null : (wiredScored - unwiredScored) / unwiredScored,
    divergedNodes: wiredScored - unwiredScored,
    conditional: 'nodes scored with engine deps minus nodes scored without, over the same hands',
  });
};
