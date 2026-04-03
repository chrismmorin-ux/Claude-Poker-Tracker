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
  // Surfaces
  'surface-body':     '#1a1a2e',
  'surface-card':     '#16213e',
  'surface-inset':    '#0d1117',
  'surface-elevated': '#1e2642',

  // Borders
  'border-default': '#2a2a4a',
  'border-subtle':  '#374151',

  // Text hierarchy
  'text-primary':   '#e0e0e0',
  'text-secondary': '#9ca3af',
  'text-muted':     '#6b7280',
  'text-faint':     '#4b5563',

  // Gold accent
  'gold':      '#d4a847',
  'gold-glow': 'rgba(212, 168, 71, 0.15)',
  'gold-dim':  '#b8922e',

  // Action badge colors (bg / text / base) — aligned to main app
  'action-fold-bg':    '#7f1d1d',
  'action-fold-text':  '#fca5a5',
  'action-fold-base':  '#dc2626',
  'action-check-bg':   '#1e3a5f',
  'action-check-text': '#93c5fd',
  'action-check-base': '#0891b2',
  'action-call-bg':    '#1e3a8a',
  'action-call-text':  '#93c5fd',
  'action-call-base':  '#2563eb',
  'action-bet-bg':     '#14532d',
  'action-bet-text':   '#86efac',
  'action-bet-base':   '#16a34a',
  'action-raise-bg':   '#7c2d12',
  'action-raise-text': '#fdba74',
  'action-raise-base': '#ea580c',

  // Priority / severity
  'priority-high-bg':     '#7f1d1d',
  'priority-high-text':   '#fca5a5',
  'priority-high-border': '#ef4444',
  'priority-med-bg':      '#713f12',
  'priority-med-text':    '#fde68a',
  'priority-med-border':  '#eab308',
  'priority-low-bg':      '#374151',
  'priority-low-text':    '#9ca3af',
  'priority-low-border':  '#6b7280',

  // EV verdict
  'ev-pos-bg':   '#166534',
  'ev-pos-text': '#4ade80',
  'ev-neg-bg':   '#7f1d1d',
  'ev-neg-text': '#f87171',
  'ev-neu-bg':   '#374151',
  'ev-neu-text': '#9ca3af',

  // M-ratio zones
  'm-green':  '#22c55e',
  'm-yellow': '#eab308',
  'm-orange': '#f97316',
  'm-red':    '#ef4444',

  // Tournament
  'tournament-accent': '#7c3aed',

  // Observation
  'obs-accent': '#3b82f6',
  'obs-light':  '#60a5fa',

  // Briefing
  'briefing-accent': '#22c55e',

  // Typography scale
  'font-xs':  '9px',
  'font-sm':  '10px',
  'font-base': '11px',
  'font-md':  '13px',
  'font-lg':  '16px',

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
  fish:    { bg: 'rgba(127, 29, 29, 0.5)', text: '#fca5a5' },
  lag:     { bg: 'rgba(124, 45, 18, 0.5)', text: '#fdba74' },
  tag:     { bg: 'rgba(20, 83, 45, 0.5)',  text: '#86efac' },
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

  const el = document.createElement('style');
  el.id = 'poker-design-tokens';
  el.textContent = css;
  (document.head || document.documentElement).appendChild(el);
};
