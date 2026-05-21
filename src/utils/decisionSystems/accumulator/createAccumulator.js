/**
 * createAccumulator.js — generic incremental accumulator factory.
 *
 * Produces `{ fold, step, finalize }` over a caller-supplied reducer.
 * Shape grounded in two existing consumers:
 *
 *   - anchorLibrary/primitiveValidity.applyFiringBatch
 *       `events.reduce((p, e) => updatePrimitiveValidity(p, e), primitive)`
 *     → becomes `createAccumulator({initialState, reduce: updatePrimitiveValidity}).fold(events)`
 *
 *   - Future: assumptionEngine/buildEvidence batch-update, PMC Phase 5b
 *     prediction ledger accumulation.
 *
 * The factory itself is intentionally thin — its value is consistency
 * (every decision system accumulates the same way) + the optional hooks
 * (`finalize`, `validate`) which give domain modules a uniform place to
 * compute derived stats and reject malformed observations.
 *
 * Pure module — no IO, no side effects.
 */

/**
 * @template TState, TObservation
 * @typedef {Object} AccumulatorOptions
 * @property {TState} initialState
 * @property {(state: TState, obs: TObservation) => TState} reduce
 * @property {(state: TState) => TState} [finalize]    - Optional post-fold derivation step.
 * @property {(obs: TObservation) => boolean} [validate] - Optional per-observation guard; false → skip.
 */

/**
 * @template TState, TObservation
 * @typedef {Object} Accumulator
 * @property {(observations: TObservation[], state?: TState) => TState} fold
 * @property {(state: TState, obs: TObservation) => TState} step
 * @property {(state: TState) => TState} finalize
 */

/**
 * Build an accumulator over a reducer.
 *
 * @template TState, TObservation
 * @param {AccumulatorOptions<TState, TObservation>} opts
 * @returns {Accumulator<TState, TObservation>}
 */
export const createAccumulator = (opts) => {
  if (!opts || typeof opts !== 'object') {
    throw new TypeError('createAccumulator: opts must be an object');
  }
  if (typeof opts.reduce !== 'function') {
    throw new TypeError('createAccumulator: opts.reduce must be a function');
  }
  if (!('initialState' in opts)) {
    throw new TypeError('createAccumulator: opts.initialState is required');
  }
  const validate = typeof opts.validate === 'function' ? opts.validate : null;
  const finalize = typeof opts.finalize === 'function' ? opts.finalize : (s) => s;
  const { reduce, initialState } = opts;

  const step = (state, obs) => {
    if (validate && !validate(obs)) return state;
    return reduce(state, obs);
  };

  const fold = (observations, startState = initialState) => {
    if (!Array.isArray(observations)) {
      throw new TypeError('createAccumulator.fold: observations must be an array');
    }
    let state = startState;
    for (const obs of observations) {
      state = step(state, obs);
    }
    return state;
  };

  return { fold, step, finalize };
};
