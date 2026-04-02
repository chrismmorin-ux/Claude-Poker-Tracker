/**
 * onlineConstants.js — Style maps and display constants for OnlineView
 *
 * STYLE_COLORS here uses solid backgrounds + white text for online seat badges.
 * designTokens.js STYLE_COLORS uses semi-transparent backgrounds + pastel text
 * for dark overlay badges. These are intentionally different for different UI contexts.
 */

// Re-export shared quality tier logic from designTokens (single source of truth)
export { QUALITY_CONFIG, getQualityTier } from '../../../constants/designTokens';

// Style colors matching the extension's stats-engine (solid variant — see header comment)
export const STYLE_COLORS = {
  Fish: { bg: '#dc2626', text: '#fff' },
  LAG:  { bg: '#ea580c', text: '#fff' },
  TAG:  { bg: '#2563eb', text: '#fff' },
  Nit:  { bg: '#6b7280', text: '#fff' },
  LP:   { bg: '#d97706', text: '#fff' },
  Reg:  { bg: '#7c3aed', text: '#fff' },
  Unknown: { bg: '#374151', text: '#9ca3af' },
};

// Maturity badge colors — single source in designTokens
export { MATURITY_COLORS } from '../../../constants/designTokens';

// Confidence tier dot colors
export const TIER_DOT = {
  confirmed:   '#22c55e',  // green
  supported:   '#eab308',  // yellow
  speculative: '#6b7280',  // gray
};

// Data quality explanations for recommendation reliability
export const QUALITY_DETAIL = {
  none:        'No player data — using population defaults only',
  speculative: 'Very early — play standard, reads may be noise',
  developing:  'Building profile — core stats reliable, exploits may shift',
  established: 'Solid read — exploits and recommendations are calibrated',
};

// Board texture pill colors
export const TEXTURE_PILLS = {
  wet:       { bg: '#1e3a5f', color: '#60a5fa' },
  dry:       { bg: '#3b2f1a', color: '#d4a847' },
  medium:    { bg: '#1a2e2e', color: '#6ee7b7' },
  paired:    { bg: '#3b2a1a', color: '#fb923c' },
  flushDraw: { bg: '#1a2e3b', color: '#67e8f9' },
  monotone:  { bg: '#1a1a3b', color: '#a78bfa' },
};

// Prediction source → human label
export const PRED_SOURCE_LABEL = {
  'level-1': 'exact match',
  'level-2': 'street match',
  'level-3': 'broad match',
  'level-4': 'broad match',
  'level-5': 'broad match',
  'level-6': 'general',
  prior: 'population estimate',
};

// Short variant for compact displays (replay, badges)
export const PRED_SOURCE_SHORT = {
  'level-1': 'exact',
  'level-2': 'street',
  'level-3': 'broad',
  'level-4': 'broad',
  'level-5': 'broad',
  'level-6': 'general',
  prior: 'population',
};

// Fold estimate source display config
export const FOLD_SOURCE_CONFIG = {
  'model+observed': { label: 'observed+model', color: '#22c55e', bg: '#166534' },
  observed:         { label: 'observed',       color: '#22c55e', bg: '#166534' },
  model:            { label: 'model',          color: '#eab308', bg: '#854d0e' },
  population:       { label: 'population est.', color: '#6b7280', bg: '#374151' },
};

// Fold adjustment factor labels
export const FOLD_ADJ_LABEL = {
  af:        'Aggression',
  vpip:      'Looseness',
  position:  'Position',
  ip:        'Positional adv.',
  advantage: 'Range advantage',
  blockers:  'Blockers',
  sizing:    'Sizing tells',
};
