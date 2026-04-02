/**
 * panelTokens.js — Design tokens for the extension side panel
 *
 * Mirrors the CSS custom properties from sidebar-prototype.html.
 * Used as inline style constants across all panel components.
 */

// ─── Surfaces ────────────────────────────────────────────────────────────────
export const SURFACE = {
  body:     '#1a1a2e',
  card:     '#16213e',
  inset:    '#0d1117',
  elevated: '#1e2642',
  glass:    'rgba(22, 33, 62, 0.85)',
};

// ─── Borders ─────────────────────────────────────────────────────────────────
export const BORDER = {
  default: '#2a2a4a',
  subtle:  '#374151',
};

// ─── Text ────────────────────────────────────────────────────────────────────
export const TEXT = {
  primary:   '#e0e0e0',
  secondary: '#9ca3af',
  muted:     '#6b7280',
  faint:     '#4b5563',
};

// ─── Gold accent ─────────────────────────────────────────────────────────────
export const GOLD = {
  base:   '#d4a847',
  glow:   'rgba(212, 168, 71, 0.15)',
  dim:    '#b8922e',
  bright: '#e8c462',
};

// ─── Action colors ───────────────────────────────────────────────────────────
export const ACTION = {
  fold:  { bg: '#7f1d1d', text: '#fca5a5' },
  check: { bg: '#1e3a5f', text: '#93c5fd' },
  call:  { bg: '#1e3a8a', text: '#93c5fd' },
  bet:   { bg: '#14532d', text: '#86efac' },
  raise: { bg: '#7c2d12', text: '#fdba74' },
};

export const EV = {
  pos:   '#4ade80',
  posBg: '#166534',
  neg:   '#f87171',
  negBg: '#7f1d1d',
};

// ─── Semantic ────────────────────────────────────────────────────────────────
export const COLOR = {
  green:  '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red:    '#ef4444',
  cyan:   '#22d3ee',
  purple: '#a78bfa',
};

// ─── Bucket colors ───────────────────────────────────────────────────────────
export const BUCKET = {
  nuts:     '#ef4444',
  strong:   '#f97316',
  marginal: '#eab308',
  draw:     '#22d3ee',
  air:      '#6b7280',
};

// ─── Typography ──────────────────────────────────────────────────────────────
export const FONT = {
  display: "'Outfit', sans-serif",
  mono:    "'IBM Plex Mono', 'Consolas', monospace",
};

// ─── Spacing / Radius ────────────────────────────────────────────────────────
export const SP = { 1: 4, 2: 8, 3: 12, 4: 16 };
export const R = { sm: 3, md: 5, lg: 8, xl: 12 };

// ─── Confidence tier mapping ─────────────────────────────────────────────────
export const CONF_COLOR = {
  high:       COLOR.green,
  developing: COLOR.yellow,
  low:        COLOR.orange,
  none:       TEXT.faint,
};
