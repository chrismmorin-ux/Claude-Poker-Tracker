/**
 * populationPriors.js - Default "typical live 1/2 player" priors
 *
 * Defines population-level action frequencies and range grids per position.
 * These serve as Bayesian priors that are updated with observed data.
 * NOT GTO — models typical live 1/2 tendencies (looser, more passive).
 *
 * PROVENANCE (2026-06-19 · WS-235 / FIND-023 / docs/provenance registry SRC-009):
 *   FACED_RAISE_RATE / NO_RAISE_FREQUENCIES / FACED_RAISE_FREQUENCIES below are a FOUNDER
 *   ESTIMATE of the live 1/2 pool — informed judgment, NOT a measured dataset. Author-estimate
 *   trust (Field-frame prior). WS-235 Step 2 grounds them empirically from observed pool hands as
 *   data accumulates (hierarchical, self-weighted by sample). Do NOT cite as measured until then.
 *
 * KEY DESIGN: Preflop actions split into two independent decision trees:
 *   No raise faced:  fold | limp | open        (sums to 1.0)
 *   Facing a raise:  fold | coldCall | threeBet (sums to 1.0)
 *
 * A hand like AA can be 100% in "open" AND 100% in "threeBet" —
 * these are conditional on different game states, not competing.
 */

import { createRange, rangeIndex, decodeIndex, PREFLOP_CHARTS, averageCharts } from '../pokerCore/rangeMatrix';

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
// DERIVED LINE SUBCLASSES (POKER_THEORY §2.5 / DEC-025)
// =============================================================================

/**
 * Pseudocount strength for a subclass's shrinkage toward its parent posterior.
 * Held at PRIOR_WEIGHT for v1 — see AS-2 in DEC-025 for the falsification test.
 */
export const SUBCLASS_PRIOR_WEIGHT = 10;

/**
 * How a parent's frequency divides across its subclasses, per position.
 * Each position's fractions sum to 1.0 within a parent.
 *
 * PROVENANCE: FOUNDER ESTIMATE — informed judgment, NOT a measured dataset,
 * the same trust class as FACED_RAISE_FREQUENCIES above (author-estimate,
 * Field-frame). WS-264's HandHQ pass-2 position trees are the empirical
 * grounding path; per the WS-263 precedent these should eventually be MEASURED
 * from between-player overdispersion rather than assumed. Tracked as AS-1 in
 * DEC-025 with a 2026-10-25 revisit. Do NOT cite as measured.
 *
 * Shape reasoning (all derived from who acts when, not from position labels
 * as causes — §7.2):
 *  - squeeze share RISES with position: acting later means more chances that a
 *    raise AND a caller are already in front of you.
 *  - limpReraise share FALLS with position: it requires having limped first,
 *    and limping is an early/middle/SB habit.
 *  - BB cannot limp at all (rangeEngine/CLAUDE.md §5), so its limpReraise
 *    share is exactly 0 — the subclass grid stays empty by construction.
 *  - isoRaise share RISES with position for the same reason as squeeze:
 *    limpers must already be in front of you to raise over them.
 */
export const SUBCLASS_SPLIT = {
  threeBet: {
    EARLY:  { cold3Bet: 0.70, squeeze: 0.15, limpReraise: 0.15 },
    MIDDLE: { cold3Bet: 0.68, squeeze: 0.22, limpReraise: 0.10 },
    LATE:   { cold3Bet: 0.60, squeeze: 0.34, limpReraise: 0.06 },
    SB:     { cold3Bet: 0.66, squeeze: 0.26, limpReraise: 0.08 },
    BB:     { cold3Bet: 0.70, squeeze: 0.30, limpReraise: 0.00 },
  },
  open: {
    EARLY:  { openFirstIn: 0.95, isoRaise: 0.05 },
    MIDDLE: { openFirstIn: 0.80, isoRaise: 0.20 },
    LATE:   { openFirstIn: 0.68, isoRaise: 0.32 },
    SB:     { openFirstIn: 0.70, isoRaise: 0.30 },
    // Inert: BB has no voluntary no-raise scenario, so the open parent is 0.
    BB:     { openFirstIn: 0.70, isoRaise: 0.30 },
  },
};

/** Subclass groupings per scenario, for normalization and iteration. */
export const NO_RAISE_SUBCLASSES = ['openFirstIn', 'isoRaise'];
export const FACED_RAISE_SUBCLASSES = ['cold3Bet', 'squeeze', 'limpReraise'];

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

/** Is this grid cell a suited hand? Used by the polar bluff tails. */
const suitedAt = (idx) => decodeIndex(idx).suited;

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
      // ---- Derived subclasses (POKER_THEORY §2.5.2) --------------------
      // Position-conditioned PRIORS are explicitly sanctioned by §7.2
      // ("position labels can serve as priors in a Bayesian framework") and
      // follow the parent threeBet pattern above. No DECISION reads a label.
      case 'cold3Bet': {
        // Strongest and slightly polar. No money invested and players still to
        // act behind, so the live pool re-raises only real value plus a thin
        // suited bluff tail.
        //
        // SB/BB are the merged blind3Bet case (DEC-025): money is already
        // posted, the price to continue is discounted, so the range is WIDER
        // and MERGED — medium hands stay in, and there is no bluff tail
        // because the value region already extends down.
        const isBlind = position === 'SB' || position === 'BB';
        if (isBlind) {
          const threshold = 0.66;
          if (strength > threshold) {
            range[i] = Math.min(1.0, (strength - threshold) / (1.0 - threshold));
          }
        } else {
          const threshold = (position === 'LATE') ? 0.73 : 0.81;
          if (strength > threshold) {
            range[i] = Math.min(1.0, (strength - threshold) / (1.0 - threshold));
          } else if (suitedAt(i) && strength > 0.40 && strength < 0.60) {
            range[i] = 0.08; // thin polar bluff tail (§2.3: A5s, 76s)
          }
        }
        break;
      }
      case 'squeeze': {
        // Polar and leveraged. Dead money plus a capped caller range makes the
        // bluff side profitable, so the range splits: real value on top, MORE
        // bluffs than a cold 3-bet, medium region hollowed out (§2.4).
        const threshold = (position === 'LATE' || position === 'BB') ? 0.72 : 0.79;
        if (strength > threshold) {
          range[i] = Math.min(1.0, (strength - threshold) / (1.0 - threshold));
        } else if (suitedAt(i) && strength > 0.35 && strength < 0.62) {
          range[i] = 0.18; // wider bluff tail than cold3Bet — the leverage
        }
        break;
      }
      case 'limpReraise': {
        // UNCAPPED (§5.8). The passive line was chosen deliberately to trap,
        // so premiums carry full weight, plus the speculative residue of the
        // limp range that occasionally wakes up. Never a capped shape.
        if (strength > 0.82) {
          range[i] = 1.0; // premium traps — full weight, uncapped
        } else if (strength > 0.55) {
          range[i] = 0.25;
        } else if (strength > 0.20) {
          range[i] = 0.10; // limp-range residue
        }
        break;
      }
      case 'openFirstIn': {
        // Nobody has voluntarily entered — this is the classic open. Same
        // shape as the parent open, which was always predominantly first-in.
        if (inChart) {
          range[i] = baseChart[i];
        } else if (strength > 0.35) {
          range[i] = Math.min(0.5, (strength - 0.35) * 0.8);
        }
        break;
      }
      case 'isoRaise': {
        // Raising over limpers targets a known-weak capped range rather than
        // folding out the field (§5.7), so it correctly includes hands too
        // weak to open first-in — wider than openFirstIn, value-tilted.
        if (inChart) {
          range[i] = baseChart[i];
        } else if (strength > 0.28) {
          range[i] = Math.min(0.6, (strength - 0.28) * 0.9);
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
