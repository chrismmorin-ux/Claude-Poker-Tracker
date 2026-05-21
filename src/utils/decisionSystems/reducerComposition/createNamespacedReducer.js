/**
 * createNamespacedReducer.js — slice composition for decision systems with
 * multiple internal slices.
 *
 * Takes a slice map `{ key: [reducer, initialState] }` and returns a single
 * composed reducer over `{ [key]: sliceState }` plus an `initialState` and
 * per-slice dispatch helpers.
 *
 * Use case: a future decision system whose state cleanly decomposes (e.g.
 * PMC Phase 5b's "ledger + aggregator" or assumptionEngine's "assumptions
 * dict + drillSession" sub-slice). The shared shape lets each slice be
 * authored as a plain `(sliceState, action) => sliceState` reducer with no
 * coupling to siblings.
 *
 * **Adoption status (per ADR-1):** ships unadopted by anchorLibrary. The
 * existing anchorLibraryReducer is a single flat reducer over a multi-key
 * state; converting to namespaced slices would not reduce LOC and would
 * complicate the existing 8-action surface. Helper is "available, not yet
 * adopted" — explicit forcing function for the next stateful migration.
 *
 * Pure module — no IO, no side effects.
 */

/**
 * @typedef {[Function, unknown]} SliceDef
 * @property {Function} 0 - Reducer (sliceState, action) → sliceState.
 * @property {unknown} 1 - Initial slice state.
 */

/**
 * Build a namespaced reducer.
 *
 * @param {Object<string, SliceDef>} slices - Map of slice key → [reducer, initialState].
 * @param {Object} [options]
 * @param {string} [options.name] - Diagnostic label.
 * @returns {{
 *   reducer: Function,
 *   initialState: Object,
 *   dispatchHelpers: Object<string, Function>,
 * }}
 */
export const createNamespacedReducer = (slices, options = {}) => {
  if (!slices || typeof slices !== 'object' || Array.isArray(slices)) {
    throw new TypeError('createNamespacedReducer: slices must be a plain object');
  }
  const keys = Object.keys(slices);
  if (keys.length === 0) {
    throw new TypeError('createNamespacedReducer: at least one slice is required');
  }
  for (const key of keys) {
    const def = slices[key];
    if (!Array.isArray(def) || def.length !== 2 || typeof def[0] !== 'function') {
      throw new TypeError(
        `createNamespacedReducer: slice "${key}" must be [reducerFn, initialState]`,
      );
    }
  }

  const initialState = Object.freeze(
    keys.reduce((acc, key) => {
      acc[key] = slices[key][1];
      return acc;
    }, {}),
  );

  const reducer = (state = initialState, action) => {
    let changed = false;
    const next = {};
    for (const key of keys) {
      const sliceReducer = slices[key][0];
      const current = state[key];
      const updated = sliceReducer(current, action);
      next[key] = updated;
      if (updated !== current) changed = true;
    }
    return changed ? next : state;
  };

  /**
   * Per-slice dispatch helpers. Each helper wraps an action and tags it
   * with `__slice: <key>` so logging / persistence layers can attribute
   * the dispatch to its slice. The slice reducer still receives the
   * untagged action — the tag is metadata only.
   */
  const dispatchHelpers = keys.reduce((acc, key) => {
    acc[key] = (action) => ({ ...action, __slice: key });
    return acc;
  }, {});

  return { reducer, initialState, dispatchHelpers };
};
