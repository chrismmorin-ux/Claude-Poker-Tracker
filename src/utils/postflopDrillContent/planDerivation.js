/**
 * planDerivation.js — Engine-derived plan derivation for the Hand Plan Layer
 * (Stream P P4).
 *
 * Wraps `computeBucketEVsV2` output into the engine-derived plan shape that
 * the Hand Plan Layer UI consumes. v1 ship surfaces:
 *   - per-action EV (incl. action label, kind, sizing, CI)
 *   - best-action label + templated reason
 *   - decisionKind (standard / bluff-catch / thin-value)
 *   - confidence caveats (incl. `v1-simplified-ev`)
 *   - errorState propagation (graceful degradation per I-HP-2)
 *
 * The `nextStreetPlan` field is a **forward-look stub** that always returns
 * null in v1. LSW-D1 (depth-2 injection) will populate it once the
 * gameTreeEvaluator's `handPlan` field is wired through to the drill engine.
 * P5 should treat null `nextStreetPlan` as "no forward look yet" and render
 * a copy line ("forward-look available after depth-2 injection ships").
 *
 * Pure module — no imports from UI, state, or persistence layers.
 */

import { computeBucketEVsV2 } from './drillModeEngine';

/**
 * @typedef {object} EnginePlanAction
 * @property {string} actionLabel    — e.g. 'bet 75%'
 * @property {string|null} actionKind — 'check'|'bet'|'raise'|'jam'|'call'|'fold'|null
 * @property {number|null} betFraction — 0.75, etc., or null for non-bet actions
 * @property {number} ev             — total EV (bb)
 * @property {number|null} evLow     — CI lower bound; null if unavailable
 * @property {number|null} evHigh    — CI upper bound; null if unavailable
 * @property {boolean} isBest        — true for the highest-EV supported action
 * @property {boolean} unsupported   — true if the engine couldn't model this action (e.g. v1 'call')
 */

/**
 * @typedef {object} EnginePlan
 * @property {string|null} heroCombo     — display string (e.g., 'J♥T♠') or null
 * @property {EnginePlanAction[]} perAction
 * @property {string|null} bestActionLabel
 * @property {string|null} bestActionReason — templated reason from engine
 * @property {string} decisionKind         — 'standard'|'bluff-catch'|'thin-value'
 * @property {string[]} caveats            — engine confidence caveats (verbatim)
 * @property {object|null} nextStreetPlan  — v1 stub: always null. D1-populated.
 * @property {object|null} errorState      — engine-error envelope or null
 */

/**
 * Transform a `computeBucketEVsV2` output into the engine-derived plan
 * shape. Returns:
 *  - `null` for null/missing input or empty actionEVs (engine produced nothing usable)
 *  - a plan object with populated `errorState` when the engine returned an error
 *  - a fully-formed plan otherwise
 *
 * @param {object} bucketEVs — `computeBucketEVsV2` output
 * @param {object} [options]
 * @param {string|null} [options.heroCombo=null] — display string for the pinned combo
 * @param {string} [options.decisionKind='standard'] — decision kind from the line node
 * @returns {EnginePlan | null}
 */
export const derivePlanFromBucketEVs = (
  bucketEVs,
  { heroCombo = null, decisionKind = 'standard' } = {},
) => {
  if (!bucketEVs || typeof bucketEVs !== 'object') return null;

  if (bucketEVs.errorState) {
    return {
      heroCombo,
      perAction: [],
      bestActionLabel: null,
      bestActionReason: null,
      decisionKind,
      caveats: [],
      nextStreetPlan: null,
      errorState: bucketEVs.errorState,
    };
  }

  if (!Array.isArray(bucketEVs.actionEVs) || bucketEVs.actionEVs.length === 0) {
    return null;
  }

  const perAction = bucketEVs.actionEVs.map((a) => ({
    actionLabel: typeof a.actionLabel === 'string' ? a.actionLabel : '',
    actionKind: typeof a.kind === 'string' ? a.kind : null,
    betFraction: Number.isFinite(a.betFraction) ? a.betFraction : null,
    ev: Number.isFinite(a.totalEV) ? a.totalEV : 0,
    evLow: Number.isFinite(a.totalEVCI?.low) ? a.totalEVCI.low : null,
    evHigh: Number.isFinite(a.totalEVCI?.high) ? a.totalEVCI.high : null,
    isBest: a.isBest === true,
    unsupported: a.unsupported === true,
  }));

  return {
    heroCombo,
    perAction,
    bestActionLabel: typeof bucketEVs.recommendation?.actionLabel === 'string' && bucketEVs.recommendation.actionLabel.length > 0
      ? bucketEVs.recommendation.actionLabel
      : null,
    bestActionReason: typeof bucketEVs.recommendation?.templatedReason === 'string' && bucketEVs.recommendation.templatedReason.length > 0
      ? bucketEVs.recommendation.templatedReason
      : null,
    decisionKind,
    caveats: Array.isArray(bucketEVs.confidence?.caveats)
      ? bucketEVs.confidence.caveats.slice()
      : [],
    nextStreetPlan: null, // v1 stub — LSW-D1 populates
    errorState: null,
  };
};

/**
 * Convenience wrapper — runs `computeBucketEVsV2` and translates the output
 * into the engine plan shape. Use this from P5 (UI) instead of calling the
 * pieces separately. Returns a plan with errorState populated on engine
 * failure; never throws (per I-HP-2 graceful-degradation contract).
 *
 * @param {object} input — same shape as computeBucketEVsV2 input
 * @param {string|null} [heroComboString=null] — display string (e.g. 'J♥T♠'); null skips display
 * @returns {Promise<EnginePlan|null>}
 */
export const computeEnginePlan = async (input, heroComboString = null) => {
  const bucketEVs = await computeBucketEVsV2(input);
  return derivePlanFromBucketEVs(bucketEVs, {
    heroCombo: heroComboString,
    decisionKind: input?.decisionKind || 'standard',
  });
};
