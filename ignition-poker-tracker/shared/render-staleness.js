/**
 * shared/render-staleness.js — V-3 §II pure render module.
 *
 * Implements the closed 5-tier freshness register + mechanism declarations
 * resolved at SHC Gate 4 V-3 walkthrough (2026-04-27, doctrine v4 R-1.8 +
 * INV-FRESH-1..5).
 *
 * Gate 5 PR-4 (2026-04-29) shipped FRESHNESS_TIERS + FRESHNESS_MECHANISMS
 * + FRESH_SIGNAL_REGISTRY + mapAgeToTier + getStaleBadgeText + renderStaleBadge.
 *
 * Gate 5 PR-13 (2026-04-30) ships the composed classifier (`classifyFreshness`)
 * + AGING-tier dot helper (`renderFreshnessDot`) + V-2.4 carry-forward gate
 * (`renderConfidenceForFreshness`). Closes the V-3 §II module API contract
 * per shell-spec §II.7. PR-14 wires production callers; this PR is module
 * + tests only.
 *
 * Closes the D-3 forensic — staleness rendered with two incompatible patterns
 * + three disjoint clearing mechanisms across `render-orchestrator.js:1324-1342`
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

import {
  CONFIDENCE_TIERS,
  mapModelSourceToTier,
  renderConfidenceBadge,
} from './render-confidence.js';

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

// ===========================================================================
// classifyFreshness — composed pure classifier (V-3 §II.7 API contract)
// ===========================================================================
// Per shell-spec §II.1, the 5-tier register integrates several conditions:
//   • _receivedAt absent / age unknown                    → UNKNOWN
//   • SW-replay rejection / coordinator rejection event   → REJECTED
//   • street-mismatch (advice.currentStreet ≠ ctx)        → STALE
//   • staleContext flag set (60s phase fired)             → STALE
//   • else age-based: ≤agingMs LIVE / ≤staleMs AGING / else STALE
//
// Caller-defined thresholds via `opts.agingMs` + `opts.staleMs` (defaults
// match `mapAgeToTier`'s 10s/60s pair, which lines up with the existing
// `computeAdviceStaleness` semantics in side-panel.js — PR-14 will route
// computeAdviceStaleness through here).
//
// `coordState` is a lightweight projection of RenderCoordinator state; the
// fields read are `staleContext: bool` + (PR-14 may add) `lastRejectionAt`.
// Pure module discipline (per V-2 / V-color-tokens precedent): no
// `Date.now()` reads, no coordinator imports — `now` and state are injected.
//
// Spec §II.6 V-2.4 carry-forward: when this returns STALE / REJECTED /
// UNKNOWN, callers route confidence rendering through
// `renderConfidenceForFreshness` so a stale-but-confident badge can't
// mislead at glance time.

export const classifyFreshness = (advice, liveCtx, coordState = {}, now = Date.now(), opts = {}) => {
  // Hard rejection short-circuit. Per spec §II.1: "RT-68/69 SW-replay
  // rejection is observable to the coordinator via the rejection event."
  // Production wiring (PR-14) will set `rejected: true` on the advice
  // record OR a coordinator state slot when the SW drops a frame; here
  // we accept both surfaces so the contract is wiring-agnostic.
  if (advice && advice.rejected === true) return FRESHNESS_TIERS.REJECTED;
  if (coordState.rejected === true) return FRESHNESS_TIERS.REJECTED;

  // _receivedAt absent → UNKNOWN. Per §II.1: "cold-start, post-120s clear."
  // Same "silent-failure protection" rationale V-2 used to separate
  // CONFIDENCE_TIERS.UNKNOWN from LOW.
  if (!advice || advice._receivedAt == null) return FRESHNESS_TIERS.UNKNOWN;

  const ageMs = now - advice._receivedAt;

  // Street-mismatch is irrecoverable per §II.1: hard threshold treated as
  // STALE regardless of elapsed time. Mirrors the existing
  // computeAdviceStaleness `reason: 'street-mismatch'` short-circuit.
  const isStreetMismatch = !!(
    liveCtx
    && advice.currentStreet
    && liveCtx.currentStreet
    && advice.currentStreet !== liveCtx.currentStreet
  );
  if (isStreetMismatch) {
    return mapAgeToTier(ageMs, { ...opts, reason: 'street-mismatch' });
  }

  // staleContext 60s flag → STALE per spec §II.1. The flag itself is
  // owned by side-panel.js's two-phase staleContext timer; this module
  // only consumes the resolved boolean.
  if (coordState.staleContext === true) {
    return FRESHNESS_TIERS.STALE;
  }

  // Default age-based classification.
  return mapAgeToTier(ageMs, opts);
};

// ===========================================================================
// renderFreshnessDot — AGING / UNKNOWN / REJECTED tier dot emission
// ===========================================================================
// Per spec §II.1 the AGING tier is a dot (no counter, no text label) — this
// helper emits the canonical `.fresh-tier-{tier}` markup for tier-class
// signaling. STALE renders via `renderStaleBadge` because it carries the
// aging counter; LIVE renders nothing (absence is the signal).
//
// The dot is non-interactive (per shell-spec §IV ↔ §II boundary —
// freshness signals are NOT affordances); the ARIA live-region contract
// from §II.10 is mandatory.

export const renderFreshnessDot = ({
  tier,
  scope = 'Z2-action-bar',
  mechanism = FRESHNESS_MECHANISMS.TIMER_DRIVEN_AGING,
  ariaLabel = null,
} = {}) => {
  if (!Object.values(FRESHNESS_TIERS).includes(tier)) {
    throw new Error(`freshness tier "${tier}" not in closed 5-tier register`);
  }
  if (!Object.values(FRESHNESS_MECHANISMS).includes(mechanism)) {
    throw new Error(`freshness mechanism "${mechanism}" not in closed registry`);
  }
  // Spec §II.1: LIVE tier renders nothing — absence is the signal. Calling
  // with tier=LIVE returns the empty string so callers can compose without
  // a conditional check at every call site.
  if (tier === FRESHNESS_TIERS.LIVE) return '';
  const labelAttr = ariaLabel
    ? ` aria-label="${ariaLabel.replace(/"/g, '&quot;')}"`
    : '';
  return `<span class="freshness-dot fresh-tier-${tier}"`
    + ` data-fresh-tier="${tier}"`
    + ` data-fresh-mechanism="${mechanism}"`
    + ` data-fresh-scope="${scope}"`
    + ` role="status" aria-live="polite"${labelAttr}></span>`;
};

// ===========================================================================
// renderConfidenceForFreshness — V-2.4 carry-forward gate
// ===========================================================================
// Per shell-spec §II.6 (V-2.4 carry-forward, conditional gate resolution):
// when freshness ∈ { STALE, REJECTED, UNKNOWN } the underlying decision
// context has likely changed; the engine's prior confidence assertion is
// no longer applicable. The composed helper pre-clears modelQuality so the
// confidence badge renders as `conf-tier-unknown` (grey dot) regardless of
// the actual `mq.overallSource` value.
//
// AGING and LIVE tiers preserve the actual confidence — `aging` indicates
// elapsed time but data still likely valid (still on-street, recoverable).
//
// Single call site for the gate; prevents divergence between callers per
// failure-engineer roundtable Q4. Both modules import from `shared/`; the
// helper lives here because its conditional logic is freshness-driven.

const FRESHNESS_TIERS_THAT_CORRUPT_CONFIDENCE = Object.freeze(new Set([
  FRESHNESS_TIERS.STALE,
  FRESHNESS_TIERS.REJECTED,
  FRESHNESS_TIERS.UNKNOWN,
]));

export const renderConfidenceForFreshness = (advice, freshnessTier) => {
  if (!Object.values(FRESHNESS_TIERS).includes(freshnessTier)) {
    throw new Error(`freshness tier "${freshnessTier}" not in closed 5-tier register`);
  }
  if (FRESHNESS_TIERS_THAT_CORRUPT_CONFIDENCE.has(freshnessTier)) {
    // Force unknown — the engine's prior confidence assertion is no longer
    // applicable when freshness is STALE / REJECTED / UNKNOWN.
    return renderConfidenceBadge({ tier: CONFIDENCE_TIERS.UNKNOWN });
  }
  // LIVE / AGING — pass-through to the underlying confidence renderer.
  const mq = advice?.modelQuality;
  const tier = mapModelSourceToTier(mq?.overallSource);
  const sampleSize = (advice?.villainSampleSize != null && Number.isFinite(advice.villainSampleSize))
    ? advice.villainSampleSize
    : null;
  return renderConfidenceBadge({ tier, sampleSize });
};
