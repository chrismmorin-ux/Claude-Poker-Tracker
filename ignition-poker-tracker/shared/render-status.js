/**
 * shared/render-status.js — V-status §I pure render module.
 *
 * Implements the 3-axis status decomposition (connection-state /
 * app-bridge-state / pipeline-stage-health) resolved at SHC Gate 4
 * V-status walkthrough (2026-04-28, doctrine v7 R-1.11 + INV-STATUS-1..5)
 * and partially implemented at Gate 5 PR-5 (2026-04-29) — connection-state
 * axis only; app-bridge + pipeline-stage axes deferred to follow-up PRs.
 *
 * Shell-spec source: docs/design/surfaces/sidebar-shell-spec.md §I.
 * Doctrine source:   docs/SIDEBAR_DESIGN_PRINCIPLES.md §1 R-1.11.
 *
 * Closes the canonical layer of the V-status §I axis-1 vocabulary;
 * INV-STATUS-1 (single-writer per slot), INV-STATUS-2 (severity
 * monotonicity within frame), INV-STATUS-3 (no-lying-status / every cause
 * value emits defined class) covered at the helper layer. Currently-
 * shipping bugs FM-STATUS-1 (silent severity downgrade at
 * side-panel.js:1893-1894) and FM-STATUS-2 (versionMismatch silent
 * persistence at :225-227) closed in this PR via callers using these
 * helpers.
 */

// ===========================================================================
// CLOSED 4-TIER CONNECTION-STATE REGISTER (V-status §I axis-1)
// ===========================================================================
// Adding a new tier requires a doctrine amendment per R-1.11 + §I.

export const STATUS_TIERS = Object.freeze({
  LIVE: 'live',                 // connected, traffic flowing
  DEGRADED: 'degraded',         // connected-waiting / version-mismatch / partial
  DISCONNECTED: 'disconnected', // port disconnected; recoverable
  FATAL: 'fatal',               // contextDead / SW context invalidated
});

// ===========================================================================
// SEVERITY ORDERING (INV-STATUS-2)
// ===========================================================================
// Higher value = more severe. A writer publishing tier X must NOT downgrade
// the visible state from a tier with severity > X within the same render
// frame — `applyMonotonicTier()` enforces this.

export const STATUS_SEVERITY = Object.freeze({
  live: 0,
  disconnected: 1,
  degraded: 2,
  fatal: 3,
});

// ===========================================================================
// mapConnStateToTier — bridge from existing connState shape
// ===========================================================================
// The upstream `connState` slot uses `{ connected: bool, cause: string,
// text: string }`. INV-STATUS-3 (no-lying-status) requires every defined
// `cause` value emits a tier — unknown causes default to DEGRADED so the
// dot always paints, never silently persists a stale class.

export const mapConnStateToTier = (connState) => {
  if (!connState) return STATUS_TIERS.DEGRADED;
  if (connState.connected) return STATUS_TIERS.LIVE;
  switch (connState.cause) {
    case 'contextDead':     return STATUS_TIERS.FATAL;
    case 'disconnect':      return STATUS_TIERS.DISCONNECTED;
    case 'versionMismatch': return STATUS_TIERS.DEGRADED;
    default:                return STATUS_TIERS.DEGRADED;
  }
};

// ===========================================================================
// Legacy class ↔ tier bridge (for backward-compat reads on the dot)
// ===========================================================================
// The legacy color-literal classes .green/.yellow/.red predate this register
// (see side-panel.html .status-dot.green at :52-57). The bridge lets
// applyMonotonicTier() inspect the dot's current class and resolve its
// severity even when an unmigrated writer (#2 updateStatusBar / #4
// updateStatusFromDiag / #5 harness.js) wrote it. Future PRs migrate those
// writers to canonical .conn-* classes, at which point this bridge becomes
// the only legacy-shim consumer and can be deleted.

const LEGACY_CLASS_TO_TIER = Object.freeze({
  green: STATUS_TIERS.LIVE,
  yellow: STATUS_TIERS.DEGRADED,
  red: STATUS_TIERS.FATAL,
});

const tierFromElementClassName = (el) => {
  if (!el || !el.classList) return null;
  // Prefer canonical attr if present (writer used the new vocabulary)
  const attrTier = el.getAttribute && el.getAttribute('data-status-tier');
  if (attrTier && Object.values(STATUS_TIERS).includes(attrTier)) return attrTier;
  // Fall back to canonical .conn-* class
  for (const tier of Object.values(STATUS_TIERS)) {
    if (el.classList.contains(`conn-${tier}`)) return tier;
  }
  // Fall back to legacy .green/.yellow/.red
  for (const [legacy, tier] of Object.entries(LEGACY_CLASS_TO_TIER)) {
    if (el.classList.contains(legacy)) return tier;
  }
  return null;
};

// ===========================================================================
// applyMonotonicTier — INV-STATUS-2 monotonicity-respecting writer
// ===========================================================================
// Inspects the dot's current tier (via canonical attr / class / legacy
// class) and writes the new tier only if `newTier` severity ≥ current
// severity. Returns the tier actually applied (may equal current if the
// write was rejected for monotonicity).
//
//   const applied = applyMonotonicTier(dotEl, STATUS_TIERS.DEGRADED);
//   // if dot was already FATAL, applied === FATAL (no downgrade)

export const applyMonotonicTier = (dotEl, newTier) => {
  if (!dotEl) return null;
  if (!Object.values(STATUS_TIERS).includes(newTier)) {
    throw new Error(`status tier "${newTier}" not in closed 4-tier register`);
  }
  const currentTier = tierFromElementClassName(dotEl);
  if (currentTier && STATUS_SEVERITY[currentTier] > STATUS_SEVERITY[newTier]) {
    // Monotonicity refusal — keep the more severe state.
    return currentTier;
  }
  writeStatusDot(dotEl, newTier);
  return newTier;
};

// ===========================================================================
// writeStatusDot — direct-write helper (bypasses monotonicity check)
// ===========================================================================
// Use this for the canonical writer (renderConnectionStatus) where the
// connState change is authoritative. Other writers should prefer
// applyMonotonicTier so they can't silently downgrade severity.

const LEGACY_TIER_TO_CLASS = Object.freeze({
  live: 'green',
  disconnected: 'yellow',
  degraded: 'yellow',
  fatal: 'red',
});

export const writeStatusDot = (dotEl, tier) => {
  if (!dotEl) return;
  if (!Object.values(STATUS_TIERS).includes(tier)) {
    throw new Error(`status tier "${tier}" not in closed 4-tier register`);
  }
  // Canonical declaration via data-status-tier attribute (matches
  // PR-2's data-affordance pattern).
  dotEl.setAttribute('data-status-tier', tier);
  // Emit BOTH the canonical .conn-* class AND the legacy color-literal
  // class so unmigrated CSS selectors keep working until PR-6 deletes the
  // legacy rules. Concept-class isolation per INV-TOKEN-2 is preserved at
  // the canonical-class layer.
  const legacy = LEGACY_TIER_TO_CLASS[tier];
  // status-dot stays as the structural class; tier classes layer on top.
  dotEl.className = `status-dot conn-${tier} ${legacy}`;
};
