/**
 * shared/render-staleness.js — V-3 §II pure render module.
 *
 * Implements the closed 5-tier freshness register + mechanism declarations
 * resolved at SHC Gate 4 V-3 walkthrough (2026-04-27, doctrine v4 R-1.8 +
 * INV-FRESH-1..5) and implemented at Gate 5 PR-4 (2026-04-29). Closes the
 * D-3 forensic — staleness rendered with two incompatible patterns + three
 * disjoint clearing mechanisms across `render-orchestrator.js:1324-1342`
 * (Z0 state-derived dot) and `side-panel.js:1064-1112` (Z2 timer-driven
 * badge).
 *
 * Shell-spec source: docs/design/surfaces/sidebar-shell-spec.md §II.
 * Doctrine source:   docs/SIDEBAR_DESIGN_PRINCIPLES.md §1 R-1.8.
 *
 * Per V-3 §II.3 each freshness signal must declare:
 *   { scope, mechanism, clearing-path, single-writer, visible-rejection }
 * via INV-FRESH-1..5. The signal registry below is the canonical inventory
 * — new signals must be added here + carry the declaration. Future PRs
 * extend dom-mutation-discipline.test.js to assert no .stale-badge mutation
 * occurs outside the canonical writer registered in this module.
 */

// ===========================================================================
// CLOSED 5-TIER FRESHNESS REGISTER (V-3 §II.1)
// ===========================================================================
// Adding a new tier requires a doctrine amendment per R-1.8 + §II.

export const FRESHNESS_TIERS = Object.freeze({
  LIVE: 'live',         // age within freshness threshold; signal is current
  AGING: 'aging',       // age beyond threshold but below stale floor
  STALE: 'stale',       // age beyond stale floor; data is suspect
  UNKNOWN: 'unknown',   // signal absent / age unknown / source missing
  REJECTED: 'rejected', // SW replay rejection / explicit rejection event
});

// ===========================================================================
// CLOSED FRESHNESS MECHANISM REGISTRY (V-3 §II.2 + INV-FRESH-2)
// ===========================================================================
// Per INV-FRESH-2 every signal must declare its mechanism. Adding a new
// mechanism requires a doctrine amendment.

export const FRESHNESS_MECHANISMS = Object.freeze({
  TIMER_DRIVEN_AGING: 'timer-driven-aging',         // 1Hz tick re-evaluates age
  STATE_EVENT_DRIVEN: 'state-event-driven',         // tier flips on coordinator state event
  SW_REPLAY_REJECTION: 'sw-replay-rejection',       // SW dropped frame on protocol mismatch
  UNKNOWN: 'unknown',                                // no declared mechanism (defensive)
});

// ===========================================================================
// CANONICAL FRESHNESS SIGNAL REGISTRY (INV-FRESH-1..5)
// ===========================================================================
// Each entry declares { scope, mechanism, clearingPath, singleWriter,
// visibleRejection } per V-3 §II.3. A future PR (per Gate 5 sequencing)
// adds signals for status-dot pipeline-stage (V-status §I co-ship) and
// app-bridge synced/absent.

export const FRESH_SIGNAL_REGISTRY = Object.freeze({
  STALE_ADVICE: Object.freeze({
    name: 'stale-advice',
    scope: 'Z2-action-bar',
    mechanism: FRESHNESS_MECHANISMS.TIMER_DRIVEN_AGING,
    clearingPath: 'new advice push OR table-switch lifecycle event',
    singleWriter: 'side-panel.js#updateStaleAdviceBadge',
    visibleRejection: false,        // stale-advice never escalates to REJECTED tier
  }),
  STALE_CONTEXT: Object.freeze({
    name: 'stale-context',
    scope: 'Z2-via-coordinator-state',
    mechanism: FRESHNESS_MECHANISMS.TIMER_DRIVEN_AGING,
    clearingPath: 'new live-context push OR full-clear at >120s',
    singleWriter: 'side-panel.js#staleContext-timer',
    visibleRejection: false,
  }),
});

// ===========================================================================
// mapAgeToTier — age (ms) → tier classifier
// ===========================================================================
// Defaults match the canonical advice-staleness thresholds in side-panel.js:
//   ≤10s = LIVE, 10-60s = AGING, >60s = STALE.
// `reason === 'street-mismatch'` short-circuits to STALE regardless of age
// (per the existing computeAdviceStaleness contract); `null` ageMs → UNKNOWN.

export const mapAgeToTier = (ageMs, opts = {}) => {
  const { agingMs = 10_000, staleMs = 60_000, reason = null } = opts;
  if (reason === 'rejected') return FRESHNESS_TIERS.REJECTED;
  if (reason === 'street-mismatch') return FRESHNESS_TIERS.STALE;
  if (ageMs == null || !Number.isFinite(ageMs)) return FRESHNESS_TIERS.UNKNOWN;
  if (ageMs <= agingMs) return FRESHNESS_TIERS.LIVE;
  if (ageMs <= staleMs) return FRESHNESS_TIERS.AGING;
  return FRESHNESS_TIERS.STALE;
};

// ===========================================================================
// getStaleBadgeText — canonical badge label
// ===========================================================================
// Pure function returning the badge inner text. Separated from the badge-
// container HTML helper so consumers with their own container-management
// (e.g., side-panel.js#updateStaleAdviceBadge with create/update/destroy
// logic) can write idempotent `badge.textContent = ...` without mutating
// the badge container itself on each 1Hz tick.

export const getStaleBadgeText = ({ tier, ageSec = null, reason = null } = {}) => {
  if (reason === 'street-mismatch') return 'Stale — recomputing';
  if (tier === FRESHNESS_TIERS.REJECTED) return 'Rejected';
  if (tier === FRESHNESS_TIERS.UNKNOWN) return 'Stale';
  // LIVE never renders a badge in the current spec; the helper still
  // returns a defensive label in case a consumer reaches this path.
  if (tier === FRESHNESS_TIERS.LIVE) return 'Live';
  if (ageSec != null && Number.isFinite(ageSec) && ageSec >= 0) {
    return `Stale ${Math.round(ageSec)}s`;
  }
  return 'Stale';
};

// ===========================================================================
// renderStaleBadge — full canonical badge markup
// ===========================================================================
// Returns full HTML for the stale-badge span including data-fresh-* attrs
// per V-3 §II.3 (declarative tier + mechanism + scope on the element).
// Future PRs extend dom-mutation-discipline.test.js to grep for
// `.stale-badge` insertions outside this helper + the canonical writer in
// FRESH_SIGNAL_REGISTRY.STALE_ADVICE.singleWriter.

export const renderStaleBadge = ({
  tier,
  ageSec = null,
  reason = null,
  scope = 'Z2-action-bar',
  mechanism = FRESHNESS_MECHANISMS.TIMER_DRIVEN_AGING,
} = {}) => {
  if (!Object.values(FRESHNESS_TIERS).includes(tier)) {
    throw new Error(`freshness tier "${tier}" not in closed 5-tier register`);
  }
  if (!Object.values(FRESHNESS_MECHANISMS).includes(mechanism)) {
    throw new Error(`freshness mechanism "${mechanism}" not in closed registry`);
  }
  const text = getStaleBadgeText({ tier, ageSec, reason });
  return `<span class="stale-badge fresh-tier-${tier}"`
    + ` data-fresh-tier="${tier}"`
    + ` data-fresh-mechanism="${mechanism}"`
    + ` data-fresh-scope="${scope}"`
    + ` role="status" aria-live="polite">${text}</span>`;
};
