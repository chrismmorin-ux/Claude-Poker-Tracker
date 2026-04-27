/**
 * designTokens.js - Single source of truth for all color tokens
 *
 * Every color used in the app flows from here. Components consume tokens
 * via helper functions that return inline style objects.
 */

// =============================================================================
// ACTION COLORS — the 5 primitives + 2 showdown states
// =============================================================================

export const ACTION_COLORS = {
  fold:   { base: '#dc2626', dark: '#b91c1c' },  // red-600/700
  check:  { base: '#0891b2', dark: '#0e7490' },  // cyan-600/700
  call:   { base: '#2563eb', dark: '#1d4ed8' },  // blue-600/700
  bet:    { base: '#16a34a', dark: '#15803d' },  // green-600/700
  raise:  { base: '#ea580c', dark: '#c2410c' },  // orange-600/700
  won:    { base: '#d4a847', dark: '#b8922e' },  // gold (custom)
  mucked: { base: '#6b7280', dark: '#4b5563' },  // gray-500/600
  blind:  { base: '#0891b2', dark: '#0e7490' },  // cyan-600/700 (visual only, same as check)
};

// Ring colors (lighter variant for seat rings)
const ACTION_RING_COLORS = {
  fold:  '#fca5a5',  // red-300
  check: '#67e8f9',  // cyan-300
  call:  '#93c5fd',  // blue-300
  bet:   '#86efac',  // green-300
  raise: '#fdba74',  // orange-300
  blind: '#67e8f9',  // cyan-300 (same as check)
};

// =============================================================================
// STYLE COLORS — player archetype badges (dark theme)
// =============================================================================

export const STYLE_COLORS = {
  Fish:    { bg: 'rgba(127, 29, 29, 0.5)', text: '#fca5a5' },  // red-900/50, red-300
  LAG:     { bg: 'rgba(124, 45, 18, 0.5)', text: '#fdba74' },  // orange-900/50, orange-300
  LP:      { bg: 'rgba(113, 63, 18, 0.5)', text: '#fde68a' },  // yellow-900/50, yellow-300
  Nit:     { bg: 'rgba(30, 58, 138, 0.5)', text: '#93c5fd' },  // blue-900/50, blue-300
  TAG:     { bg: 'rgba(20, 83, 45, 0.5)',  text: '#86efac' },  // green-900/50, green-300
  Reg:     { bg: 'rgba(88, 28, 135, 0.5)', text: '#d8b4fe' },  // purple-900/50, purple-300
  Unknown: { bg: '#374151',                 text: '#9ca3af' },  // gray-700, gray-400
};

// Light-context variants (for PlayerRow, TendencyStats)
export const STYLE_COLORS_LIGHT = {
  Fish: { bg: '#dcfce7', text: '#15803d' },  // green-100, green-700 (exploitable)
  LP:   { bg: '#dcfce7', text: '#15803d' },  // green-100, green-700 (exploitable)
  TAG:  { bg: '#fef9c3', text: '#a16207' },  // yellow-100, yellow-700 (reg)
  Reg:  { bg: '#fef9c3', text: '#a16207' },  // yellow-100, yellow-700 (reg)
  LAG:  { bg: '#fee2e2', text: '#b91c1c' },  // red-100, red-700 (dangerous)
  Nit:  { bg: '#fee2e2', text: '#b91c1c' },  // red-100, red-700 (dangerous)
  Unknown: { bg: '#f3f4f6', text: '#4b5563' },  // gray-100, gray-600
};

// =============================================================================
// OVERLAY COLORS — diagonal overlays in showdown
// =============================================================================

export const OVERLAY_COLORS = {
  folded: '#dc2626',  // red-600
  absent: '#4b5563',  // gray-600
  mucked: '#374151',  // gray-700
  won:    '#16a34a',  // green-600
};

// =============================================================================
// NAV COLORS — sidebar navigation buttons
// =============================================================================

export const NAV_COLORS = {
  stats:    { base: '#2563eb', hover: '#1d4ed8' },  // blue-600/700
  history:  { base: '#9333ea', hover: '#7e22ce' },  // purple-600/700
  sessions: { base: '#ea580c', hover: '#c2410c' },  // orange-600/700
  players:  { base: '#0d9488', hover: '#0f766e' },  // teal-600/700
  analysis:   { base: '#4f46e5', hover: '#4338ca' },  // indigo-600/700
  tournament: { base: '#ca8a04', hover: '#a16207' },  // yellow-600/700
  extension:  { base: '#059669', hover: '#047857' },  // emerald-600/700
  online:     { base: '#0284c7', hover: '#0369a1' },  // sky-600/700
  printableRefresher: { base: '#c05621', hover: '#9c4318' },  // burnt-orange (math card accent)
  settings:   { base: '#4b5563', hover: '#6b7280' },  // gray-600/500
};

// =============================================================================
// BATCH COLORS — batch action button gradients
// =============================================================================

export const BATCH_COLORS = {
  restFold:  { base: '#991b1b', dark: '#7f1d1d' },  // red-800/900
  foldCold:  { base: '#78350f', dark: '#5c2d0e' },  // amber-900 ish
  checkAll:  { base: '#1d4ed8', dark: '#1e3a8a' },  // blue-700/800
};

// =============================================================================
// EXPLOIT BADGE COLORS — exploit category badges
// =============================================================================

export const EXPLOIT_BADGE_COLORS = {
  weakness: { bg: '#ef4444', text: '#ffffff' },         // red-500
  strength: { bg: '#3b82f6', text: '#ffffff' },         // blue-500
  tendency: { bg: '#facc15', text: '#111827' },         // yellow-400, gray-900
  note:     { bg: '#9ca3af', text: '#ffffff' },         // gray-400
};

// =============================================================================
// EV VERDICT COLORS — used in replay action cards and coaching
// =============================================================================

export const EV_COLORS = {
  '+EV': { bg: '#166534', text: '#4ade80' },
  '-EV': { bg: '#7f1d1d', text: '#f87171' },
  'neutral': { bg: '#374151', text: '#9ca3af' },
};

// =============================================================================
// LUCKY/UNLUCKY COLORS — hindsight analysis badges
// =============================================================================

export const LUCKY_COLORS = {
  lucky: { bg: '#166534', text: '#4ade80', label: 'Lucky' },
  unlucky: { bg: '#7f1d1d', text: '#f87171', label: 'Unlucky' },
  neutral: { bg: '#374151', text: '#9ca3af', label: 'Neutral' },
};

// =============================================================================
// ADVICE COLORS — live action advice UI
// =============================================================================

export const MATURITY_COLORS = {
  deep:       { bg: '#166534', text: '#86efac' },
  individual: { bg: '#365314', text: '#a3e635' },
  typed:      { bg: '#854d0e', text: '#fde047' },
  coarse:     { bg: '#9a3412', text: '#fdba74' },
  unknown:    { bg: '#374151', text: '#9ca3af' },
};

export const ADVICE_COLORS = {
  evPositiveBg: '#166534', evPositiveText: '#4ade80',
  evNegativeBg: '#7f1d1d', evNegativeText: '#f87171',
  evNeutralBg: '#374151', evNeutralText: '#9ca3af',
  equityBarBg: '#374151',
  equityGood: '#22c55e',
  equityBad: '#ef4444',
  foldHighlight: '#f59e0b',
};

// =============================================================================
// TOURNAMENT M-RATIO — chip stack zone colors
// =============================================================================

export const TOURNAMENT_M_RATIO = {
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
};

// =============================================================================
// GOLD ACCENT — section headers, highlights
// =============================================================================

export const GOLD = '#d4a847';

// =============================================================================
// DATA QUALITY — tier classification and display config
// =============================================================================

export const QUALITY_CONFIG = {
  none:        { label: 'no data',    color: '#ef4444' },
  speculative: { label: 'early',      color: '#f97316' },
  developing:  { label: 'developing', color: '#eab308' },
  established: { label: 'solid',      color: '#22c55e' },
};

export const getQualityTier = (n) =>
  n === 0 ? 'none' : n < 10 ? 'speculative' : n < 30 ? 'developing' : 'established';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

import { isFoldAction } from './gameConstants';

/**
 * Returns a CSS linear-gradient string for action buttons.
 * @param {string} action - Primitive action or showdown action
 * @returns {string} CSS gradient value
 */
export const getActionGradient = (action) => {
  const key = isFoldAction(action) ? 'fold' : action;
  const colors = ACTION_COLORS[key];
  if (!colors) return '#4b5563';
  return `linear-gradient(180deg, ${colors.base} 0%, ${colors.dark} 100%)`;
};

/**
 * Returns inline style object for action badges.
 * @param {string} action - Action string
 * @returns {{ backgroundColor: string, color: string }}
 */
export const getActionBadgeStyle = (action) => {
  const key = isFoldAction(action) ? 'fold' : action;
  const colors = ACTION_COLORS[key];
  if (!colors) return { backgroundColor: '#e5e7eb', color: '#111827' };
  return { backgroundColor: colors.base, color: '#ffffff' };
};

/**
 * Returns hex colors for seat background and ring.
 * @param {string} action - Action string
 * @returns {{ bg: string, ring: string }}
 */
export const getActionSeatStyle = (action) => {
  const key = isFoldAction(action) ? 'fold' : action;
  const colors = ACTION_COLORS[key];
  const ring = ACTION_RING_COLORS[key];
  if (!colors) return { bg: '#16a34a', ring: '#86efac' };
  return { bg: colors.base, ring: ring || colors.base };
};
