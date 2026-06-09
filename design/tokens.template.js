/**
 * tokens.template.js — CWOS design tokens starter
 *
 * Extracted from Claude-Poker-Tracker's production designTokens.js.
 * Lifts to prog-design end-user surface L2+ (tokens present, reusable primitives).
 * Framework-agnostic: works with any JS/TS frontend. See operator-dashboard-pattern.md
 * for how tokens feed dashboards.
 *
 * USAGE:
 *   1. Copy this file to src/constants/designTokens.js (or equivalent)
 *   2. Replace the example SEMANTIC_ACTIONS with your domain's actions
 *      (e.g., for a SaaS: create/read/update/delete/archive; for a CRM: contact/deal/task)
 *   3. Keep the base/dark variant pattern — dark-mode support comes free
 *   4. Add helper functions per domain (see getActionBadgeStyle at bottom)
 *
 * DESIGN PRINCIPLES (from CWOS prog-design rubric):
 *   - Every color the app renders flows from this file (single source of truth)
 *   - Semantic names, not hex codes, in components (fold:red-600 not #dc2626 inline)
 *   - Base + dark variants for every token (dark-mode support at L3)
 *   - Light-context variants for tokens used in light surfaces (L3+)
 *   - Helper functions return inline style objects — components never build gradients manually
 */

// =============================================================================
// SEMANTIC_ACTIONS — replace with your domain's primary action types
// =============================================================================

export const SEMANTIC_ACTIONS = {
  // Replace these with your domain's actions. Keep the base/dark shape.
  create:  { base: '#16a34a', dark: '#15803d' },  // green-600/700
  read:    { base: '#2563eb', dark: '#1d4ed8' },  // blue-600/700
  update:  { base: '#ea580c', dark: '#c2410c' },  // orange-600/700
  delete:  { base: '#dc2626', dark: '#b91c1c' },  // red-600/700
  archive: { base: '#6b7280', dark: '#4b5563' },  // gray-500/600
};

// =============================================================================
// ENTITY_STYLES — color-code domain entities (replace with your entities)
// =============================================================================

export const ENTITY_STYLES = {
  // Example: for a SaaS with users, teams, organizations:
  //   user: { bg: 'rgba(30,58,138,0.5)', text: '#93c5fd' },
  //   team: { bg: 'rgba(20,83,45,0.5)', text: '#86efac' },
  //   organization: { bg: 'rgba(88,28,135,0.5)', text: '#d8b4fe' },
  Primary:   { bg: 'rgba(30, 58, 138, 0.5)', text: '#93c5fd' },  // blue-900/50, blue-300
  Secondary: { bg: 'rgba(20, 83, 45, 0.5)',  text: '#86efac' },  // green-900/50, green-300
  Tertiary:  { bg: 'rgba(124, 45, 18, 0.5)', text: '#fdba74' },  // orange-900/50, orange-300
  Unknown:   { bg: '#374151',                 text: '#9ca3af' },  // gray-700, gray-400
};

// Light-context variants for ENTITY_STYLES (for light surfaces)
export const ENTITY_STYLES_LIGHT = {
  Primary:   { bg: '#dbeafe', text: '#1d4ed8' },  // blue-100, blue-700
  Secondary: { bg: '#dcfce7', text: '#15803d' },  // green-100, green-700
  Tertiary:  { bg: '#ffedd5', text: '#c2410c' },  // orange-100, orange-700
  Unknown:   { bg: '#f3f4f6', text: '#6b7280' },  // gray-100, gray-500
};

// =============================================================================
// STATUS_COLORS — universal status indicators (green/yellow/red)
// =============================================================================

export const STATUS_COLORS = {
  healthy:  { base: '#16a34a', dark: '#15803d', text: '#86efac' },  // green
  warning:  { base: '#eab308', dark: '#ca8a04', text: '#fde047' },  // yellow
  critical: { base: '#dc2626', dark: '#b91c1c', text: '#fca5a5' },  // red
  neutral:  { base: '#6b7280', dark: '#4b5563', text: '#9ca3af' },  // gray
};

// =============================================================================
// QUALITY_CONFIG — data quality / confidence tiers
// (useful for data-platform and research archetypes)
// =============================================================================

export const QUALITY_CONFIG = {
  high:     { color: '#16a34a', label: 'High confidence',    threshold: 0.9 },
  medium:   { color: '#eab308', label: 'Medium confidence',  threshold: 0.6 },
  low:      { color: '#ea580c', label: 'Low confidence',     threshold: 0.3 },
  untrusted:{ color: '#dc2626', label: 'Untrusted',           threshold: 0.0 },
};

// =============================================================================
// HELPER FUNCTIONS — components call these, not the raw tokens
// =============================================================================

/**
 * Return inline style for an action badge.
 * @param {string} action - key from SEMANTIC_ACTIONS
 * @param {boolean} isDark - use dark variant
 */
export function getActionBadgeStyle(action, isDark = false) {
  const token = SEMANTIC_ACTIONS[action];
  if (!token) return { backgroundColor: STATUS_COLORS.neutral.base, color: '#fff' };
  return {
    backgroundColor: isDark ? token.dark : token.base,
    color: '#fff',
  };
}

/**
 * Return entity badge style (with or without light-mode fallback).
 */
export function getEntityBadgeStyle(entityType, isLight = false) {
  const tokens = isLight ? ENTITY_STYLES_LIGHT : ENTITY_STYLES;
  return tokens[entityType] || tokens.Unknown;
}

/**
 * Return status indicator style.
 */
export function getStatusStyle(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.neutral;
}

/**
 * Map a numeric confidence score (0-1) to a quality tier.
 */
export function getQualityTier(confidence) {
  for (const [tier, config] of Object.entries(QUALITY_CONFIG)) {
    if (confidence >= config.threshold) return { tier, ...config };
  }
  return { tier: 'untrusted', ...QUALITY_CONFIG.untrusted };
}

// =============================================================================
// TYPOGRAPHY — compact set; extend per repo needs
// =============================================================================

export const TYPOGRAPHY = {
  // Scale based on 1.25 ratio, rooted at 14px
  xs:   { size: '0.75rem',  lineHeight: '1rem',    weight: 400 },
  sm:   { size: '0.875rem', lineHeight: '1.25rem', weight: 400 },
  base: { size: '1rem',     lineHeight: '1.5rem',  weight: 400 },
  lg:   { size: '1.125rem', lineHeight: '1.75rem', weight: 500 },
  xl:   { size: '1.25rem',  lineHeight: '1.75rem', weight: 600 },
  '2xl':{ size: '1.5rem',   lineHeight: '2rem',    weight: 700 },
  '3xl':{ size: '1.875rem', lineHeight: '2.25rem', weight: 700 },
};

// =============================================================================
// SPACING — 4px baseline grid
// =============================================================================

export const SPACING = {
  '0': '0',
  '1': '0.25rem',  // 4px
  '2': '0.5rem',   // 8px
  '3': '0.75rem',  // 12px
  '4': '1rem',     // 16px
  '6': '1.5rem',   // 24px
  '8': '2rem',     // 32px
  '12':'3rem',     // 48px
  '16':'4rem',     // 64px
};
