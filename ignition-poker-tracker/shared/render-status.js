/**
 * shared/render-status.js — V-status §I pure render module.
 *
 * Implements the 3-axis status decomposition (connection-state /
 * app-bridge-state / pipeline-stage-health) resolved at SHC Gate 4
 * V-status walkthrough (2026-04-28, doctrine v7 R-1.11 + INV-STATUS-1..5).
 *
 *   - Gate 5 PR-5 shipped the canonical connection-state writer (axis-1)
 *     alongside a legacy-class bridge.
 *   - Gate 5 PR-6 migrated the remaining 4 axis-1 writers and deleted
 *     the bridge — all #status-dot paints flow through writeStatusDot /
 *     applyMonotonicTier and emit canonical .conn-* classes only.
 *   - Gate 5 PR-7 ships the app-bridge axis-2 vocabulary (closed 2-tier
 *     register: synced / absent) + writeAppStatusBadge canonical writer
 *     + 2 production writer migrations (updateAppStatus + harness app-
 *     badge writer). Axis-2 is binary and authoritative — no monotonicity
 *     helper required.
 *   - Gate 5 PR-8 (this revision) ships the pipeline-stage axis-3
 *     vocabulary (closed 4-tier register: ok / warn / fail / unknown)
 *     + writePipelineStageDot canonical writer + renderPipelineHealth
 *     setDot migration. The shell-spec outline declared a binary
 *     {nominal, failed} shape; PR-8 promotes it to the 4-tier register
 *     reflecting the codebase's actual operator-distinguishable states,
 *     since `unknown` and `warn` each carry distinct actionable
 *     information.
 *
 * Shell-spec source: docs/design/surfaces/sidebar-shell-spec.md §I.
 * Doctrine source:   docs/SIDEBAR_DESIGN_PRINCIPLES.md §1 R-1.11.
 *
 * Closes the canonical layer of all 3 V-status §I axes;
 * INV-STATUS-1 (single-writer per slot), INV-STATUS-2 (severity
 * monotonicity within frame — applies to axis-1 only), INV-STATUS-3
 * (no-lying-status / every cause value emits defined class) covered at
 * the helper layer. Currently-shipping bugs FM-STATUS-1 + FM-STATUS-2
 * closed at PR-5.
 *
 * Pipeline visibility-gating, INV-STATUS-4 (connected-waiting 30s timer),
 * INV-STATUS-5 (lastGoodExploits clearing-path) are deferred to follow-up
 * PRs.
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
// tierFromElementClassName — read current tier from a status-dot element
// ===========================================================================
// Consumed by applyMonotonicTier to decide whether to honor or refuse a
// new write per INV-STATUS-2. Reads the canonical data-status-tier attr
// first (set by writeStatusDot), then falls back to a .conn-* class scan.
// The legacy .green/.yellow/.red read-fallback was removed at Gate 5 PR-6
// once all writers stopped emitting legacy color-literal classes.

const tierFromElementClassName = (el) => {
  if (!el || !el.classList) return null;
  const attrTier = el.getAttribute && el.getAttribute('data-status-tier');
  if (attrTier && Object.values(STATUS_TIERS).includes(attrTier)) return attrTier;
  for (const tier of Object.values(STATUS_TIERS)) {
    if (el.classList.contains(`conn-${tier}`)) return tier;
  }
  return null;
};

// ===========================================================================
// applyMonotonicTier — INV-STATUS-2 monotonicity-respecting writer
// ===========================================================================
// Inspects the dot's current tier (via canonical attr / class) and writes
// the new tier only if `newTier` severity ≥ current severity. Returns the
// tier actually applied (may equal current if the write was rejected for
// monotonicity).
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
// Use this for canonical writers (renderConnectionStatus, harness fixture
// re-paint) where the new state is authoritative. Other writers should
// prefer applyMonotonicTier so they can't silently downgrade severity.

export const writeStatusDot = (dotEl, tier) => {
  if (!dotEl) return;
  if (!Object.values(STATUS_TIERS).includes(tier)) {
    throw new Error(`status tier "${tier}" not in closed 4-tier register`);
  }
  // Canonical declaration: data-status-tier attribute (machine-readable
  // single source of tier truth, mirrors PR-2's data-affordance pattern)
  // + .conn-{tier} class (CSS paint binding to --status-conn-* tokens).
  dotEl.setAttribute('data-status-tier', tier);
  dotEl.className = `status-dot conn-${tier}`;
};

// ===========================================================================
// AXIS-2 — APP-BRIDGE-STATE (V-status §I axis-2)
// ===========================================================================
// Closed 2-tier binary register. The app-bridge state describes whether
// the main poker-tracker app is open + receiving exploit pushes from the
// extension. There is no severity ordering — both states are valid;
// "absent" is not a degraded form of "synced" but a different operational
// mode. Adding a new tier requires a doctrine amendment per R-1.11 + §I.

export const STATUS_APP_TIERS = Object.freeze({
  SYNCED: 'synced', // app open, receiving exploit pushes
  ABSENT: 'absent', // app not open / not receiving pushes
});

// ===========================================================================
// mapAppConnectedToTier — bridge from existing appConnected boolean
// ===========================================================================
// Upstream slot: `lastGoodExploits.appConnected` (exploit-push driven,
// reduced to a boolean by the service worker before reaching the panel).
// INV-STATUS-3 (no-lying-status): the boolean is total — every input
// emits a defined tier.

export const mapAppConnectedToTier = (appConnected) => (
  appConnected ? STATUS_APP_TIERS.SYNCED : STATUS_APP_TIERS.ABSENT
);

// ===========================================================================
// writeAppStatusBadge — canonical writer for #app-status
// ===========================================================================
// INV-STATUS-1 (single canonical writer per slot): both production
// (updateAppStatus, snap.appConnected driven) and the harness (fixture-
// driven) reach #app-status through this helper. The badge text is owned
// by the helper too — text and tier are paired so a stale "App synced"
// label can never coexist with an absent tier (the FM-STATUS-2 analog
// for axis-2; defense in depth, no shipping bug surfaced here).

const APP_TIER_TEXT = Object.freeze({
  synced: 'App synced',
  absent: 'App not open',
});

export const writeAppStatusBadge = (badgeEl, tier) => {
  if (!badgeEl) return;
  if (!Object.values(STATUS_APP_TIERS).includes(tier)) {
    throw new Error(`app-status tier "${tier}" not in closed 2-tier register`);
  }
  badgeEl.setAttribute('data-app-status-tier', tier);
  badgeEl.className = `app-status app-${tier}`;
  badgeEl.textContent = APP_TIER_TEXT[tier];
};

// ===========================================================================
// AXIS-3 — PIPELINE-STAGE-HEALTH (V-status §I axis-3)
// ===========================================================================
// Closed 4-tier register. Each of the 5 capture-pipeline stages (probe /
// bridge / filter / port / panel) reports its own state independently;
// the strip composes 5 dots. The shell-spec outline declared a binary
// {nominal, failed} shape — Gate 5 PR-8 promotes this to the 4-tier
// vocabulary that matches the codebase's actual operator-distinguishable
// states, since `unknown` (no signal yet) and `warn` (late but recoverable)
// each carry distinct actionable information that collapsing to binary
// would lose. Adding a new tier requires a doctrine amendment per R-1.11.

export const STATUS_PIPELINE_TIERS = Object.freeze({
  OK:      'ok',      // stage healthy
  WARN:    'warn',    // late / reconnecting / recoverable
  FAIL:    'fail',    // stage broken / unrecoverable
  UNKNOWN: 'unknown', // no signal yet / boot-race
});

// ===========================================================================
// writePipelineStageDot — canonical writer for #stage-dot-* slots
// ===========================================================================
// INV-STATUS-1 (single canonical writer per slot): renderPipelineHealth's
// setDot is the sole production caller; the harness only toggles the
// strip's container visibility, not individual stage dots. Each per-stage
// computation in renderPipelineHealth is independently authoritative —
// no monotonicity helper required (the stages don't write each other).

export const writePipelineStageDot = (dotEl, tier) => {
  if (!dotEl) return;
  if (!Object.values(STATUS_PIPELINE_TIERS).includes(tier)) {
    throw new Error(`pipeline-stage tier "${tier}" not in closed 4-tier register`);
  }
  dotEl.setAttribute('data-pipeline-tier', tier);
  dotEl.className = `stage-dot pipeline-${tier}`;
};
