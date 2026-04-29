/**
 * shared/render-confidence.js — V-2 §III pure render module.
 *
 * Implements the closed 4-tier confidence register + canonical badge
 * markup resolved at SHC Gate 4 V-2 walkthrough (2026-04-27, doctrine v3
 * R-1.6) and implemented at Gate 5 PR-3 (2026-04-29). Closes the D-1
 * forensic — confidence rendered three incompatible ways at
 * render-orchestrator.js:150-151,169 + render-tiers.js:71-75.
 *
 * Shell-spec source: docs/design/surfaces/sidebar-shell-spec.md §III.
 * Doctrine source:   docs/SIDEBAR_DESIGN_PRINCIPLES.md §1 R-1.6.
 *
 * Per V-2 §III.5 scope boundary: confidence applies to engine model
 * outputs only (the `mq.overallSource` axis). Mathematically exact derived
 * values like equity / pot odds / SPR do NOT carry confidence — the prior
 * `cs-value.conf-{player,mixed,population}` opacity classes are deleted.
 */

// ===========================================================================
// CLOSED 4-TIER CONFIDENCE REGISTER (V-2 §III)
// ===========================================================================
// Adding a new tier requires a doctrine amendment per R-1.6 + §III.

export const CONFIDENCE_TIERS = Object.freeze({
  HIGH: 'high',         // engine model output, full sample (player_model)
  MEDIUM: 'mid',        // mixed model + population (mixed)
  LOW: 'low',           // population estimate only (population)
  UNKNOWN: 'unknown',   // model output absent / sample absent
});

// ===========================================================================
// mapModelSourceToTier — bridge from legacy `mq.overallSource` axis
// ===========================================================================
// The upstream `mq.overallSource` axis predates the V-2 4-tier register;
// it emits 'player_model' / 'mixed' / 'population' / null. This helper
// maps it onto the new ordinal tiers so consumers can switch over without
// upstream changes (per V-2: pure render-layer divergence; D-1 is
// resolvable downstream alone).

export const mapModelSourceToTier = (overallSource) => {
  if (overallSource === 'player_model') return CONFIDENCE_TIERS.HIGH;
  if (overallSource === 'mixed') return CONFIDENCE_TIERS.MEDIUM;
  if (overallSource === 'population') return CONFIDENCE_TIERS.LOW;
  return CONFIDENCE_TIERS.UNKNOWN;
};

// ===========================================================================
// Tier label helpers (for tooltips / aria-labels)
// ===========================================================================

export const TIER_LABELS = Object.freeze({
  high: 'Player model',
  mid: 'Mixed (model + population)',
  low: 'Population estimate',
  unknown: 'No model data',
});

// ===========================================================================
// renderConfidenceBadge — canonical confidence dot + optional sample label
// ===========================================================================
// Per V-2 §III.4 + INV-DENSITY-3: the `n=N` form is bound to the
// confidence-dot pairing (vs `Nh` for raw observation count standalone).
// Per V-2 §III.5: the badge applies to engine model outputs only — never
// to equity / pot odds / SPR.
//
//   renderConfidenceBadge({ tier: 'high' })             → dot only
//   renderConfidenceBadge({ tier: 'mid', sampleSize: 45 }) → dot + "n=45"
//   renderConfidenceBadge({ tier: 'low', title: '...' })   → dot with hover

export const renderConfidenceBadge = ({
  tier,
  sampleSize = null,
  title = null,
} = {}) => {
  if (!Object.values(CONFIDENCE_TIERS).includes(tier)) {
    throw new Error(`confidence tier "${tier}" not in closed 4-tier register`);
  }
  const titleAttr = title ? ` title="${title.replace(/"/g, '&quot;')}"` : '';
  const ariaLabel = title || TIER_LABELS[tier] || '';
  const ariaAttr = ariaLabel ? ` aria-label="${ariaLabel.replace(/"/g, '&quot;')}"` : '';
  let html = `<span class="confidence-dot conf-tier-${tier}"${titleAttr}${ariaAttr}></span>`;
  if (sampleSize != null && Number.isFinite(sampleSize)) {
    html += `<span class="confidence-label">n=${sampleSize}</span>`;
  }
  return html;
};
