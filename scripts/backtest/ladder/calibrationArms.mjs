/**
 * calibrationArms.mjs — WS-543. Arms that measure the INSTRUMENT, not the poker.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHY THESE EXIST
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Founder, 2026-08-18: "There are some things we can use to make a clear and obvious check that
 * our testing is right, dominated events... should yield clear results in the direction we
 * expect... These help us calibrate the model."
 *
 * Every arm below has a sign fixed BEFORE the run — by domination, or by algebra. So a result
 * that contradicts the sign is a defect in the estimator, not a discovery about the pool. The
 * pattern is inherited from `ALWAYS_FOLD` / `UNIFORM`, which ship because "both have a sign
 * known in advance, which is exactly what makes them a plumbing proof"; this extends it from
 * proving the plumbing to MEASURING THE ERROR.
 *
 * Pre-registration: `calibrationPrereg.json`, hashed and stamped by the runner, which refuses
 * to run without it.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * CLONE_THE_POOL IS THE IMPORTANT ONE, AND IT IS AN IDENTITY RATHER THAN A PREDICTION
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * `edge = wisValue - poolValue`. If pi_ours equals pi_pool at every decision, every importance
 * weight is exactly 1, the weighted mean IS the plain mean, and the edge is EXACTLY ZERO. That
 * is algebra, not an empirical claim — so any deviation the harness reports is pure instrument
 * error, and it is the floor every other figure must be read against.
 *
 * It needs no new plumbing. An arm that abstains everywhere, run with `fallback: 'pool'`,
 * already IS pi_ours = pi_pool — the fallback path substitutes the behaviour policy verbatim.
 * Building it any other way (e.g. threading `poolActions` into the arm interface) would risk
 * measuring a second implementation of the pool policy rather than the one the estimator
 * divides by, which is the exact thing this arm exists to check.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHY THE DOMINATED ARMS ARE NOT MERELY "BAD STRATEGIES"
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * A bad strategy losing money proves little — most strategies lose money. What makes these
 * useful is that their loss has a KNOWN MECHANISM the harness must reproduce. `never-fold`
 * must lose by paying off value bets; `call-every-large-bet` must lose in the size buckets
 * where the pool is most polarised. If an arm loses for the wrong reason, or wins, the
 * estimator is not carrying the arm's opinion into the number.
 */

import { RESPONSES_BY_FACING } from '../behaviorPolicy.mjs';
import { withModuleDescriptor } from '../strategyArm.mjs';

const ENCODING_DIRECT = 'direct';

const responsesFor = (ctx) => RESPONSES_BY_FACING[ctx?.facingAction] || RESPONSES_BY_FACING.none;

/** Spread mass evenly over a set of actions. */
const evenly = (actions) => {
  const out = {};
  for (const a of actions) out[a] = 1 / actions.length;
  return out;
};

/**
 * CLONE_THE_POOL — abstains everywhere. Under `fallback: 'pool'` this makes pi_ours identical
 * to pi_pool, so the edge must be EXACTLY zero. The single sharpest check in this file.
 *
 * MUST be run with fallback 'pool'. Under 'engine' it would measure the engine instead, which
 * is a different arm wearing this one's name — the runner asserts the fallback rather than
 * trusting the caller.
 */
export const CLONE_THE_POOL = Object.freeze({
  id: 'clone-the-pool',
  version: '1.0.0',
  encoding: ENCODING_DIRECT,
  sourceRef: 'internal:calibration — algebraic identity, expected EXACTLY 0',
  requiresFallback: 'pool',
  policyAt: () => ({ covered: false }),
});

/** NEVER_FOLD — mass over every legal response except fold. Expected NEGATIVE. */
export const NEVER_FOLD = Object.freeze({
  id: 'never-fold',
  version: '1.0.0',
  encoding: ENCODING_DIRECT,
  sourceRef: 'internal:calibration — dominated, expected NEGATIVE',
  policyAt: ({ ctx }) => {
    const responses = responsesFor(ctx);
    const keep = responses.filter((a) => a !== 'fold');
    if (keep.length === 0) return { covered: false };
    return { covered: true, actions: evenly(keep) };
  },
});

/**
 * CALL_EVERY_LARGE_BET — calls 100% facing an overbet. Expected NEGATIVE, and the most
 * directly interpretable arm here: its magnitude says how punishing this pool's large bets are.
 */
export const CALL_EVERY_LARGE_BET = Object.freeze({
  id: 'call-every-large-bet',
  version: '1.0.0',
  encoding: ENCODING_DIRECT,
  sourceRef: 'internal:calibration — dominated, expected NEGATIVE',
  policyAt: ({ ctx, geo }) => {
    const responses = responsesFor(ctx);
    if (!responses.includes('call')) return { covered: false };
    const s = geo?.sBucket;
    if (s !== '100-150' && s !== '150+') return { covered: false };
    return { covered: true, actions: { call: 1 } };
  },
});

/** FOLD_EVERY_SMALL_BET — folds at the best price on offer. Expected NEGATIVE. */
export const FOLD_EVERY_SMALL_BET = Object.freeze({
  id: 'fold-every-small-bet',
  version: '1.0.0',
  encoding: ENCODING_DIRECT,
  sourceRef: 'internal:calibration — dominated, expected NEGATIVE',
  policyAt: ({ ctx, geo }) => {
    const responses = responsesFor(ctx);
    if (!responses.includes('fold')) return { covered: false };
    if (geo?.sBucket !== '0-33') return { covered: false };
    return { covered: true, actions: { fold: 1 } };
  },
});

/** RAISE_EVERYTHING — raises the whole range wherever raising is legal. Expected NEGATIVE. */
export const RAISE_EVERYTHING = Object.freeze({
  id: 'raise-everything',
  version: '1.0.0',
  encoding: ENCODING_DIRECT,
  sourceRef: 'internal:calibration — dominated, expected NEGATIVE',
  policyAt: ({ ctx }) => {
    const responses = responsesFor(ctx);
    if (!responses.includes('raise')) return { covered: false };
    return { covered: true, actions: { raise: 1 } };
  },
});

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * WS-546 — THE MIXED ARMS. Same domination, broad support.
 * ══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Every dominated arm above is DETERMINISTIC, and that is what collapses its support. An arm
 * that puts zero mass on an action the pool takes constantly earns a zero importance weight on
 * every one of those decisions, so it is graded on a shrinking and increasingly unrepresentative
 * slice. `never-fold` ran at ESS 37%, `raise-everything` at 21%.
 *
 * Softening keeps a floor of probability on every legal response, so the weight is small rather
 * than zero and the row stays in the estimate. THE TRADE, STATED RATHER THAN HIDDEN: this
 * changes the rung being modelled. `never-fold-mixed` is not `never-fold`; it is a policy that
 * folds rarely. It buys instrument validity with fidelity to the rule, and a reader comparing
 * the two is comparing two different policies, not one policy measured two ways.
 *
 * WHICH IS WHY THESE SHIP ALONGSIDE THE DETERMINISTIC ARMS AND NEVER REPLACE THEM. The
 * deterministic arms are the ones that failed; withdrawing them would erase the evidence that
 * WS-543 exists to preserve.
 *
 * THE FLOOR IS AN UNMEASURED CONSTANT. Per `.claude/rules/unmeasured-constants.md` it ships as
 * two arms rather than one chosen value, and the difference between them is itself a result: if
 * the sign is stable across both floors then the verdict does not depend on a number nobody
 * measured, and if it flips the floor is load-bearing and becomes its own measurement target.
 */

/** Floors declared as named constants so the prereg and the arms cannot drift apart. */
export const MIX_FLOOR_LOW = 0.05;
export const MIX_FLOOR_HIGH = 0.15;

/**
 * Put `floor` on every legal response the arm does NOT prefer, and split the rest over the
 * ones it does.
 *
 * Returns `{covered: false}` rather than a clamped distribution when the floors alone would
 * exceed unity — a silently renormalised policy would be a THIRD arm wearing this one's name,
 * and the whole point of the calibration set is that an arm is what it says it is.
 */
const mixed = (preferred, responses, floor) => {
  const keep = preferred.filter((a) => responses.includes(a));
  const others = responses.filter((a) => !keep.includes(a));
  if (keep.length === 0) return { covered: false };
  const spent = floor * others.length;
  if (spent >= 1) return { covered: false };
  const out = {};
  for (const a of others) out[a] = floor;
  for (const a of keep) out[a] = (1 - spent) / keep.length;
  return { covered: true, actions: out };
};

/** NEVER_FOLD with a low mixing floor on fold. Expected NEGATIVE — same domination. */
export const NEVER_FOLD_MIXED_LOW = Object.freeze({
  id: 'never-fold-mixed-low',
  version: '1.0.0',
  encoding: ENCODING_DIRECT,
  sourceRef: 'internal:calibration — dominated, expected NEGATIVE, support-preserving',
  policyAt: ({ ctx }) => {
    const responses = responsesFor(ctx);
    return mixed(responses.filter((a) => a !== 'fold'), responses, MIX_FLOOR_LOW);
  },
});

/** NEVER_FOLD at the high floor. The pair measures whether the floor is load-bearing. */
export const NEVER_FOLD_MIXED_HIGH = Object.freeze({
  id: 'never-fold-mixed-high',
  version: '1.0.0',
  encoding: ENCODING_DIRECT,
  sourceRef: 'internal:calibration — dominated, expected NEGATIVE, support-preserving',
  policyAt: ({ ctx }) => {
    const responses = responsesFor(ctx);
    return mixed(responses.filter((a) => a !== 'fold'), responses, MIX_FLOOR_HIGH);
  },
});

/** RAISE_EVERYTHING with a low mixing floor. Expected NEGATIVE — same domination. */
export const RAISE_EVERYTHING_MIXED_LOW = Object.freeze({
  id: 'raise-everything-mixed-low',
  version: '1.0.0',
  encoding: ENCODING_DIRECT,
  sourceRef: 'internal:calibration — dominated, expected NEGATIVE, support-preserving',
  policyAt: ({ ctx }) => {
    const responses = responsesFor(ctx);
    if (!responses.includes('raise')) return { covered: false };
    return mixed(['raise'], responses, MIX_FLOOR_LOW);
  },
});

/** RAISE_EVERYTHING at the high floor. */
export const RAISE_EVERYTHING_MIXED_HIGH = Object.freeze({
  id: 'raise-everything-mixed-high',
  version: '1.0.0',
  encoding: ENCODING_DIRECT,
  sourceRef: 'internal:calibration — dominated, expected NEGATIVE, support-preserving',
  policyAt: ({ ctx }) => {
    const responses = responsesFor(ctx);
    if (!responses.includes('raise')) return { covered: false };
    return mixed(['raise'], responses, MIX_FLOOR_HIGH);
  },
});

/**
 * The calibration set, with each arm's PRE-REGISTERED expectation carried beside it so the
 * runner cannot report a result without the prediction it is being judged against.
 */
const SPEC = [
  { exportName: 'CLONE_THE_POOL', arm: CLONE_THE_POOL, expect: 'zero', tolerance: 0.01 },
  { exportName: 'NEVER_FOLD', arm: NEVER_FOLD, expect: 'negative' },
  { exportName: 'CALL_EVERY_LARGE_BET', arm: CALL_EVERY_LARGE_BET, expect: 'negative' },
  { exportName: 'FOLD_EVERY_SMALL_BET', arm: FOLD_EVERY_SMALL_BET, expect: 'negative' },
  { exportName: 'RAISE_EVERYTHING', arm: RAISE_EVERYTHING, expect: 'negative' },
  // WS-546. Same expectation as the deterministic arms they soften — domination does not care
  // how much mass an arm keeps on the action it is dominated for.
  { exportName: 'NEVER_FOLD_MIXED_LOW', arm: NEVER_FOLD_MIXED_LOW, expect: 'negative' },
  { exportName: 'NEVER_FOLD_MIXED_HIGH', arm: NEVER_FOLD_MIXED_HIGH, expect: 'negative' },
  { exportName: 'RAISE_EVERYTHING_MIXED_LOW', arm: RAISE_EVERYTHING_MIXED_LOW, expect: 'negative' },
  { exportName: 'RAISE_EVERYTHING_MIXED_HIGH', arm: RAISE_EVERYTHING_MIXED_HIGH, expect: 'negative' },
];

/**
 * The calibration set, each arm carrying a module-export descriptor so it can be rebuilt in a
 * worker (WS-543). Async because the descriptor hashes the policy's SOURCE — an identity check
 * on a closure has to compare code, not a declared label.
 */
export const loadCalibrationArms = async () => Promise.all(SPEC.map(async (s) => ({
  ...s,
  arm: await withModuleDescriptor(s.arm, {
    modulePath: './ladder/calibrationArms.mjs',
    exportName: s.exportName,
  }),
})));

export default loadCalibrationArms;
