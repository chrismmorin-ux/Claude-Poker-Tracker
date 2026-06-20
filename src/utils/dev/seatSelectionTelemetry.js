/**
 * Seat-selection telemetry — dev-mode-only observation surface for WS-189 Phase 1.
 *
 * Purpose: capture every getFirstActionSeat() evaluation and every
 * useAutoSeatSelection firing during live sessions, so Phase 2 can root-cause
 * which of H1 (logic), H2 (timing), H3 (multi-seat clobber) explains owner-
 * observed wrong-seat picks.
 *
 * Both functions are no-ops in production builds — gated by import.meta.env.DEV
 * (Vite). No persistence; logs go to console.log only. Phase 2 may upgrade to
 * a ring buffer or IDB sink once the capture shape is validated.
 *
 * Phase 1 ships and closes. Phase 2 is a separate WS authored after ≥3 owner-
 * captured wrong-selection observations.
 */

// Test-only override for the dev gate. Production callers never set this;
// it exists because Vitest's import.meta.env.DEV cannot be cleanly flipped
// per-test. Set via __setDevGateOverride(true|false) in a test, reset to
// null in afterEach to restore the real import.meta.env.DEV check.
let __devGateOverride = null;

const isDev = () => {
  if (__devGateOverride !== null) return __devGateOverride;
  return (
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.DEV
  );
};

/**
 * Log a getFirstActionSeat() evaluation.
 * @param {object} inputs - { currentStreet, dealerSeat, absentSeats, straddler, foldedSeats, numSeats }
 * @param {number|null} output - returned seat number, or null for hand-over states
 */
export const logFirstActionSeat = (inputs, output) => {
  if (!isDev()) return;
  // eslint-disable-next-line no-console
  console.log('[seat-select] getFirstActionSeat', { inputs, output });
};

/**
 * Log a useAutoSeatSelection firing.
 * @param {object} payload - {
 *   trigger: 'mount' | 'street-change' | 'selector-close' | 'scheduled',
 *   currentStreet,
 *   prevStreet,
 *   candidateSeat,
 *   currentSelection,
 *   action: 'set' | 'noop-empty-candidate' | 'noop-respect-manual-queue'
 * }
 */
export const logAutoSelectFiring = (payload) => {
  if (!isDev()) return;
  // eslint-disable-next-line no-console
  console.log('[seat-select] useAutoSeatSelection', payload);
};

/**
 * Test-only — override the dev gate for the duration of a test. Pass null to
 * restore the real import.meta.env.DEV check (do this in afterEach).
 * @internal
 */
export const __setDevGateOverride = (value) => {
  __devGateOverride = value;
};
