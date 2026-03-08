/**
 * populationPriors.js - Default "typical live 1/2 player" priors
 *
 * Defines population-level action frequencies and range grids per position.
 * These serve as Bayesian priors that are updated with observed data.
 * NOT GTO — models typical live 1/2 tendencies (looser, more passive).
 *
 * KEY DESIGN: Preflop actions split into two independent decision trees:
 *   No raise faced:  fold | limp | open        (sums to 1.0)
 *   Facing a raise:  fold | coldCall | threeBet (sums to 1.0)
 *
 * A hand like AA can be 100% in "open" AND 100% in "threeBet" —
 * these are conditional on different game states, not competing.
 */

import { createRange, rangeIndex, decodeIndex, PREFLOP_CHARTS, averageCharts } from '../exploitEngine/rangeMatrix';

const GRID_SIZE = 169;

/**
 * How often does a player in this position face a raise before acting?
 * Table-dependent; these are reasonable live 1/2 defaults.
 */
export const FACED_RAISE_RATE = {
  EARLY:  0.15, // UTG/UTG+1 rarely face a raise (act early)
  MIDDLE: 0.25,
  LATE:   0.35,
  SB:     0.40,
  BB:     0.50, // BB faces a raise ~half the time
};

/**
 * Action frequencies when NO raise has been seen.
 * fold + limp + open = 1.0 per position.
 */
export const NO_RAISE_FREQUENCIES = {
  EARLY:  { fold: 0.83, limp: 0.05, open: 0.12 },
  MIDDLE: { fold: 0.76, limp: 0.08, open: 0.16 },
  LATE:   { fold: 0.62, limp: 0.06, open: 0.32 },
  SB:     { fold: 0.64, limp: 0.12, open: 0.24 },
  BB:     { fold: 0.00, limp: 0.00, open: 0.00 }, // BB checks when no raise — not a voluntary action
};

/**
 * Action frequencies when FACING a raise.
 * fold + coldCall + threeBet = 1.0 per position.
 */
export const FACED_RAISE_FREQUENCIES = {
  EARLY:  { fold: 0.82, coldCall: 0.12, threeBet: 0.06 },
  MIDDLE: { fold: 0.75, coldCall: 0.17, threeBet: 0.08 },
  LATE:   { fold: 0.62, coldCall: 0.26, threeBet: 0.12 },
  SB:     { fold: 0.60, coldCall: 0.28, threeBet: 0.12 },
  BB:     { fold: 0.48, coldCall: 0.40, threeBet: 0.12 },
};

/** Pseudocount strength — how many "virtual observations" the prior represents */
export const PRIOR_WEIGHT = 10;

/** Action groupings by scenario */
export const NO_RAISE_ACTIONS = ['fold', 'limp', 'open'];
export const FACED_RAISE_ACTIONS = ['fold', 'coldCall', 'threeBet'];

// =============================================================================
// RANGE CONSTRUCTION HELPERS
// =============================================================================

/**
 * Compute hand strength tier (0.0-1.0) from grid index.
 * Higher = stronger hand.
 */
const handStrengthTier = (idx) => {
  const { rank1, rank2, isPair, suited } = decodeIndex(idx);
  const raw = rank1 + rank2 + (isPair ? 8 : 0) + (suited ? 2 : 0);
  const max = 12 + 12 + 8; // AA = 32
  return raw / max;
};

/**
 * Get the base GTO chart for a 5-category position.
 */
const getBaseChart = (position) => {
  const keys = { EARLY: ['UTG', 'UTG+1'], MIDDLE: ['MP1', 'MP2'], LATE: ['HJ', 'CO', 'BTN'], SB: ['SB'], BB: ['BB'] }[position];
  if (!keys) return createRange();
  return keys.length === 1 ? PREFLOP_CHARTS[keys[0]] : averageCharts(...keys);
};

/**
 * Build a prior range grid for a specific position + action.
 * Each grid cell is P(hand | action, position) — the likelihood
 * of holding this hand given you took this action.
 */
const buildActionPrior = (position, action) => {
  const range = createRange();
  const baseChart = getBaseChart(position);

  for (let i = 0; i < GRID_SIZE; i++) {
    const strength = handStrengthTier(i);
    const inChart = baseChart[i] > 0;

    switch (action) {
      case 'open': {
        // Widen GTO charts ~20% for live 1/2
        if (inChart) {
          range[i] = baseChart[i];
        } else if (strength > 0.35) {
          range[i] = Math.min(0.5, (strength - 0.35) * 0.8);
        }
        break;
      }
      case 'threeBet': {
        // Top 3-5%: QQ+, AK heavy; widen for LATE/BB
        const threshold = (position === 'LATE' || position === 'BB') ? 0.70 : 0.78;
        if (strength > threshold) {
          range[i] = Math.min(1.0, (strength - threshold) / (1.0 - threshold));
        }
        break;
      }
      case 'coldCall': {
        // Medium hands: suited connectors, medium pairs, suited broadways
        if (strength > 0.30 && strength < 0.78) {
          range[i] = inChart ? 0.6 : 0.3;
        } else if (strength >= 0.78) {
          range[i] = 0.2; // strong hands that might flat
        }
        break;
      }
      case 'limp': {
        // Speculative hands: small pairs, suited connectors, weak suited aces
        if (position === 'BB') break; // BB doesn't limp
        if (strength > 0.15 && strength < 0.55) {
          range[i] = 0.4;
        } else if (strength >= 0.55 && strength < 0.70) {
          range[i] = 0.15;
        }
        break;
      }
      case 'fold': {
        // Fold prior — weakest hands fold most
        range[i] = Math.max(0, 1.0 - strength * 1.2);
        break;
      }
    }
  }

  return range;
};

// Cache built priors
const priorCache = {};

/**
 * Get the population prior range for a position + action.
 * @param {string} position - EARLY, MIDDLE, LATE, SB, BB
 * @param {string} action - fold, limp, open, coldCall, threeBet
 * @returns {Float64Array} 169-cell weight grid (copy, safe to mutate)
 */
export const getPopulationPrior = (position, action) => {
  const key = `${position}_${action}`;
  if (!priorCache[key]) {
    priorCache[key] = buildActionPrior(position, action);
  }
  return new Float64Array(priorCache[key]);
};
