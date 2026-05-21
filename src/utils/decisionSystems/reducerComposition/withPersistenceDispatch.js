/**
 * withPersistenceDispatch.js — action-tagging convention for skipping the
 * persistence-hook debounce loop on ephemeral UI state.
 *
 * Some reducers mix durable domain state with transient UI state (open
 * modals, expanded rows, filter chips). Persisting on every action wastes
 * write capacity. This wrapper lets a reducer's caller mark transient
 * actions with `action.persist: false`; downstream persistence hooks
 * inspect the flag and skip the post-action diff/write for that dispatch.
 *
 * The wrapper itself is purely declarative: it accepts a reducer and
 * exposes `shouldPersistAction(action)` as a sibling helper. The
 * persistence hook is responsible for consulting `shouldPersistAction`
 * before debouncing.
 *
 * **Adoption status (per ADR-1):** ships unadopted by anchorLibrary; today
 * anchorLibrary's persistence hook diffs every slice on every state
 * change. The convention is "available, not yet adopted" until a future
 * decision system has measurable write-frequency pressure.
 *
 * Pure module — no IO.
 */

/**
 * Wrap a reducer with the persistence-dispatch convention. The wrapped
 * reducer behaves identically; the wrapper only attaches a sibling
 * `shouldPersistAction` helper for use by persistence consumers.
 *
 * @param {Function} reducer
 * @returns {{
 *   reducer: Function,
 *   shouldPersistAction: (action: { persist?: boolean }) => boolean,
 * }}
 */
export const withPersistenceDispatch = (reducer) => {
  if (typeof reducer !== 'function') {
    throw new TypeError('withPersistenceDispatch: reducer must be a function');
  }
  return {
    reducer,
    shouldPersistAction,
  };
};

/**
 * Returns false iff `action.persist === false`. Any other shape (missing,
 * true, truthy value) returns true. Default is "persist."
 *
 * @param {{ persist?: boolean }} action
 * @returns {boolean}
 */
export const shouldPersistAction = (action) => {
  if (!action || typeof action !== 'object') return true;
  return action.persist !== false;
};
