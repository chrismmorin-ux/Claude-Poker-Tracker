/**
 * ShapeMasteryContext.jsx — Shape Language mastery state context.
 *
 * SLS Stream D (2026-05-14, SPR-081 / WS-040). Mirrors AnchorLibraryContext.jsx
 * shape — receives state + dispatch as props, hydrates via persistence hook
 * inside the provider, exposes selectors via useCallback in the value.
 *
 * Read-only sprint scope:
 *   - Selectors expose descriptor state + enrollment flag.
 *   - Writers (recovery affordances) are deferred to fast-follow WS; consumers
 *     dispatch through `dispatchShapeMastery` from the value for the 3 active
 *     writers (HYDRATED / ENROLL / DISENROLL).
 *
 * Per `docs/design/contracts/shape-mastery.md` Readers table:
 *   - shape-language-study-home  → useShapeMastery() (read all descriptors)
 *   - shape-skill-map            → useShapeMastery() + future decay + signal-composition hooks
 *   - lesson-runner              → useShapeMastery() + future dispatch
 *   - seeder                     → future hooks (I-SM-4 deferred)
 *   - Settings sub-panel         → useShapeMastery()
 *   - welcome-back banner        → useShapeMastery() for lastInteractedAt gate
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import { useShapeMasteryPersistence } from '../hooks/useShapeMasteryPersistence';

// =============================================================================
// CONTEXT
// =============================================================================

const ShapeMasteryContext = createContext(null);

// =============================================================================
// PROVIDER
// =============================================================================

/**
 * ShapeMasteryProvider — wraps children with shape mastery state + helpers.
 *
 * @param {Object} props
 * @param {Object} props.shapeMasteryState - State from shapeMasteryReducer
 * @param {Function} props.dispatchShapeMastery - Dispatcher for shape mastery actions
 * @param {string} [props.userId] - Override userId for persistence (defaults to GUEST_USER_ID inside the hook)
 * @param {React.ReactNode} props.children
 */
export const ShapeMasteryProvider = ({
  shapeMasteryState,
  dispatchShapeMastery,
  userId,
  children,
}) => {
  // Persistence: hydrates from IDB on mount; auto-saves on state change.
  const { isReady } = useShapeMasteryPersistence(
    shapeMasteryState,
    dispatchShapeMastery,
    userId ? { userId } : undefined,
  );

  // ==========================================================================
  // SELECTOR HELPERS
  // ==========================================================================

  /**
   * Returns the full descriptors dictionary (catalog-keyed).
   */
  const selectAllDescriptors = useCallback(
    () => shapeMasteryState?.descriptors || {},
    [shapeMasteryState],
  );

  /**
   * Returns a single descriptor's mastery record, or null if unknown.
   */
  const selectDescriptor = useCallback(
    (descriptorId) => shapeMasteryState?.descriptors?.[descriptorId] || null,
    [shapeMasteryState],
  );

  /**
   * True when the user has enrolled in the Shape Language adaptive layer.
   * Per Q2-A master toggle. Surfaces gate Deliberate/Discover entry on this.
   */
  const selectIsEnrolled = useCallback(
    () => Boolean(shapeMasteryState?.enrolled),
    [shapeMasteryState],
  );

  // ==========================================================================
  // VALUE
  // ==========================================================================

  const value = useMemo(
    () => ({
      // Raw state
      ...shapeMasteryState,
      // Persistence readiness
      isReady,
      // Selector helpers
      selectAllDescriptors,
      selectDescriptor,
      selectIsEnrolled,
      // Dispatch (writers go through SHAPE_MASTERY_ACTIONS constants)
      dispatchShapeMastery,
    }),
    [
      shapeMasteryState,
      isReady,
      selectAllDescriptors,
      selectDescriptor,
      selectIsEnrolled,
      dispatchShapeMastery,
    ],
  );

  return (
    <ShapeMasteryContext.Provider value={value}>
      {children}
    </ShapeMasteryContext.Provider>
  );
};

// =============================================================================
// CONSUMER HOOK
// =============================================================================

/**
 * useShapeMastery — access shape mastery state + helpers from any descendant.
 *
 * @returns {Object} See ShapeMasteryProvider §VALUE
 * @throws {Error} If called outside a ShapeMasteryProvider
 */
export const useShapeMastery = () => {
  const context = useContext(ShapeMasteryContext);
  if (!context) {
    throw new Error('useShapeMastery must be used within a ShapeMasteryProvider');
  }
  return context;
};

export default ShapeMasteryContext;
