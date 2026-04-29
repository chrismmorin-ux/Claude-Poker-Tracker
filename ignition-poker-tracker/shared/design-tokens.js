/**
 * shared/design-tokens.js — CSS custom properties + JS color constants
 *
 * Mirrors the main app's src/constants/designTokens.js for visual consistency.
 * Call injectTokens() once on page load to write :root CSS vars.
 */

// ===========================================================================
// COLOR TOKENS (aligned to main app designTokens.js)
// ===========================================================================

export const TOKENS = {
  // Surfaces (spec: #111 body, #1a1a2e cards)
  'surface-body':     '#111111',
  'surface-card':     '#1a1a2e',
  'surface-inset':    '#0d1117',
  'surface-elevated': '#222244',

  // Borders
  'border-default': '#2a2a4a',
  'border-subtle':  '#374151',

  // Text hierarchy
  'text-primary':   '#e0e0e0',
  'text-secondary': '#9ca3af',
  'text-muted':     '#6b7280',
  'text-faint':     '#4b5563',

  // Trust colors (3 semantic colors — the only non-gray colors)
  'trust-value':    '#4ade80',   // green — confident value / clear +EV
  'trust-marginal': '#fbbf24',   // yellow — marginal / mixed / judgment call
  'trust-negative': '#f87171',   // red — fold / high-risk / -EV

  // Gold accent (demoted to gray — spec removes decorative accents)
  'gold':      '#9ca3af',
  'gold-glow': 'rgba(156, 163, 175, 0.15)',
  'gold-dim':  '#6b7280',

  // Action badge colors — trust-based (bet/raise=value, call=marginal, check=neutral, fold=negative)
  'action-fold-bg':    'rgba(248, 113, 113, 0.15)',
  'action-fold-text':  '#f87171',
  'action-fold-base':  '#f87171',
  'action-check-bg':   'rgba(107, 114, 128, 0.15)',
  'action-check-text': '#9ca3af',
  'action-check-base': '#9ca3af',
  'action-call-bg':    'rgba(251, 191, 36, 0.15)',
  'action-call-text':  '#fbbf24',
  'action-call-base':  '#fbbf24',
  'action-bet-bg':     'rgba(74, 222, 128, 0.15)',
  'action-bet-text':   '#4ade80',
  'action-bet-base':   '#4ade80',
  'action-raise-bg':   'rgba(74, 222, 128, 0.15)',
  'action-raise-text': '#4ade80',
  'action-raise-base': '#4ade80',

  // Priority / severity
  'priority-high-bg':     'rgba(248, 113, 113, 0.15)',
  'priority-high-text':   '#f87171',
  'priority-high-border': '#f87171',
  'priority-med-bg':      'rgba(251, 191, 36, 0.15)',
  'priority-med-text':    '#fbbf24',
  'priority-med-border':  '#fbbf24',
  'priority-low-bg':      '#374151',
  'priority-low-text':    '#9ca3af',
  'priority-low-border':  '#6b7280',

  // EV verdict
  'ev-pos-bg':   'rgba(74, 222, 128, 0.15)',
  'ev-pos-text': '#4ade80',
  'ev-neg-bg':   'rgba(248, 113, 113, 0.15)',
  'ev-neg-text': '#f87171',
  'ev-neu-bg':   '#374151',
  'ev-neu-text': '#9ca3af',

  // M-ratio zones (keep — functional, not decorative)
  'm-green':  '#4ade80',
  'm-yellow': '#fbbf24',
  'm-orange': '#f97316',
  'm-red':    '#f87171',

  // Confidence tier (V-2 §III + R-1.6 — engine model outputs only;
  // concept-class-isolated from --m-* per INV-TOKEN-2). Visual hex matches
  // existing M-zone hues so behavior is preserved across the migration;
  // the concept-class isolation is at the token-name layer.
  'conf-tier-high':    '#4ade80',  // player_model — full confidence
  'conf-tier-mid':     '#fbbf24',  // mixed model + population
  'conf-tier-low':     '#f87171',  // population estimate only
  'conf-tier-unknown': '#6b7280',  // model output absent / sample absent

  // Freshness tier (V-3 §II + R-1.8 — closed 5-tier register; concept-
  // class-isolated from --conf-tier-* and --m-* per INV-TOKEN-2). Per
  // shell-spec §II tiers map to: LIVE=fresh signal, AGING=10–60s,
  // STALE=>60s, UNKNOWN=signal-absent, REJECTED=SW-replay-rejection. The
  // existing `.stale-badge` (#eab308 yellow) is preserved as the AGING
  // hue; LIVE / UNKNOWN / REJECTED are introduced for forthcoming
  // signal sites.
  'fresh-tier-live':     '#4ade80',  // signal current (within agingMs threshold)
  'fresh-tier-aging':    '#eab308',  // matches existing .stale-badge yellow
  'fresh-tier-stale':    '#f87171',  // age beyond stale floor
  'fresh-tier-unknown':  '#6b7280',  // signal absent / source missing
  'fresh-tier-rejected': '#dc2626',  // SW replay rejection / explicit rejection

  // Connection status tier (V-status §I axis-1 + R-1.11 — closed 4-tier
  // register; concept-class-isolated from --m-* / --conf-tier-* /
  // --fresh-tier-* per INV-TOKEN-2). Visual hex matches existing M-zone
  // hues so behavior is preserved across the migration; PR-6+ will delete
  // the legacy .status-dot.green/.yellow/.red rules and rely solely on
  // the canonical .conn-* classes wired below.
  'status-conn-live':         '#4ade80',  // connected, traffic flowing
  'status-conn-degraded':     '#fbbf24',  // connected-waiting / version-mismatch
  'status-conn-disconnected': '#f97316',  // port disconnected; recoverable
  'status-conn-fatal':        '#f87171',  // contextDead / SW context invalidated

  // Tournament (demoted to neutral)
  'tournament-accent': '#6b7280',

  // Observation (demoted to neutral)
  'obs-accent': '#9ca3af',
  'obs-light':  '#9ca3af',

  // Briefing (aligned to trust-value)
  'briefing-accent': '#4ade80',

  // Semantic signal roles
  'color-danger':     '#f87171',
  'color-danger-dim': 'rgba(248, 113, 113, 0.15)',
  'color-warning':    '#fbbf24',
  'color-positive':   '#4ade80',
  'color-info':       '#9ca3af',
  'color-neutral':    '#6b7280',

  // Common structural colors
  'divider-subtle':  'rgba(42, 42, 74, 0.3)',
  'divider-medium':  'rgba(42, 42, 74, 0.4)',
  'shadow-inset':    'rgba(0, 0, 0, 0.3)',

  // Typography scale (3 sizes: 24px hardcoded for action word, 14px numbers/prose, 11px labels)
  'font-micro': '11px',
  'font-xs':  '11px',
  'font-sm':  '11px',
  'font-base': '11px',
  'font-md':  '14px',
  'font-lg':  '14px',

  // Typography ladder (Doctrine v8 R-1.12 + INV-DENSITY-1..5 — 3-tier role-based,
  // rem units mandatory). Per shell-spec §VI.6 attention-budget map: --type-display
  // for primary action words, --type-body for numerics + prose, --type-meta-stat
  // for labels + sample counts + stale badges. Future PRs migrate inline px font
  // literals (~132 sites) onto this ladder; this PR introduces the tokens + the
  // FM-DENSITY-1 stale-badge fix only.
  'type-display':   '1.5rem',     // 24px equivalent
  'type-body':      '0.875rem',   // 14px equivalent
  'type-meta-stat': '0.6875rem',  // 11px equivalent (was 9px on stale-badge — sub-WCAG)

  // Font weights
  'weight-normal':  '400',
  'weight-medium':  '500',
  'weight-bold':    '700',

  // Spacing
  'sp-1': '4px',
  'sp-2': '8px',
  'sp-3': '12px',
  'sp-4': '16px',
  'sp-5': '20px',
  'sp-6': '24px',

  // Radius
  'radius-sm': '3px',
  'radius-md': '4px',
  'radius-lg': '6px',

  // Transitions
  'ease-fast': '150ms',
  'ease-base': '200ms',
  'ease-slow': '300ms',
};

// Style badge colors (dark context — matches main app STYLE_COLORS)
export const STYLE_TOKENS = {
  fish:    { bg: 'rgba(194, 65, 12, 0.5)',  text: '#fb923c' },
  lag:     { bg: 'rgba(124, 45, 18, 0.5)', text: '#fdba74' },
  tag:     { bg: 'rgba(13, 148, 136, 0.4)', text: '#5eead4' },
  nit:     { bg: 'rgba(30, 58, 138, 0.5)', text: '#93c5fd' },
  lp:      { bg: 'rgba(113, 63, 18, 0.5)', text: '#fde68a' },
  reg:     { bg: 'rgba(88, 28, 135, 0.5)', text: '#d8b4fe' },
  unknown: { bg: '#374151',                 text: '#9ca3af' },
};

// ===========================================================================
// INJECT INTO :root
// ===========================================================================

let injected = false;

export const injectTokens = () => {
  if (injected) return;
  injected = true;

  let css = ':root {\n';
  for (const [key, value] of Object.entries(TOKENS)) {
    css += `  --${key}: ${value};\n`;
  }
  // Style badge tokens
  for (const [style, colors] of Object.entries(STYLE_TOKENS)) {
    css += `  --style-${style}-bg: ${colors.bg};\n`;
    css += `  --style-${style}-text: ${colors.text};\n`;
  }
  css += '}\n';

  // Doctrine v8 R-1.12 V-density.2 — tabular-nums modifier class. Future PRs
  // migrate inline `font-variant-numeric: tabular-nums` declarations onto this
  // class; introduced here as the migration target.
  css += '.tabular-nums { font-variant-numeric: tabular-nums; }\n';

  const el = document.createElement('style');
  el.id = 'poker-design-tokens';
  el.textContent = css;
  (document.head || document.documentElement).appendChild(el);
};
