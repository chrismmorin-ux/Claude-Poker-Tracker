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
import { softContinuationWeights, MIN_CONTINUATION_WEIGHT } from '../pokerCore/softWeights';
import { EQUITY_VS_OPEN } from '../pokerCore/preflopEquityTable';

const GRID_SIZE = 169;
const TOTAL_COMBOS = 1326;

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

// =============================================================================
// SUPPORT EVERYWHERE (WS-302)
// =============================================================================

/**
 * How much of each prior's mass is carried by the smooth equity-ranked support grid
 * rather than by the positional chart. A shrinkage weight in the same family as
 * `PRIOR_WEIGHT` and `SUBCLASS_PRIOR_WEIGHT`; 0 reproduces the pre-WS-302 grids exactly.
 *
 * MEASURED, NOT PICKED (WS-302, 2026-07-29). Swept through the WS-293 calibration probe
 * against revealed showdown hands, every arm scored on the SAME decisions so the arms are
 * differenced per decision. Coverage reaches 100% at ANY positive lambda, so it cannot
 * rank the arms — DISCRIMINATION does (mean log P of the hand actually held, vs uniform):
 *
 *     lambda    0       0.40    0.60    0.80    1.00
 *     FTP    -1.545   +0.391  +0.438  +0.456  +0.438   (n=2520)
 *     PS     -1.646   +0.323  +0.373  +0.391  +0.370   (n=2426)
 *
 * 0.80 is the argmax on BOTH sites, and the curve turns over at 1.00 on both — so this is
 * an interior optimum, not a grid that failed to bracket one.
 *
 * Swept twice. The first pass ranked support by a raw equity ramp and put the argmax in
 * the same place (FTP +0.462, PS +0.402), but that construction inverted `fold` and
 * `limp` — see `smoothedShape`. The table above is the corrected support, and the fix
 * cost under 0.01 nats, so the conclusion is the construction's, not the artifact's.
 *
 * READ WHAT THAT SAYS, BECAUSE IT IS UNCOMFORTABLE. At the optimum the hand-built
 * positional charts carry 20% of the prior's shape and a smooth ranking by per-combo
 * preflop equity carries 80% — and switching the charts off entirely (lambda = 1) costs
 * only ~0.01 nats. This is the third time in this engine that an elaborate hand-built
 * mechanism, once measured, lost to the trivial alternative (WS-285's HIERARCHY_ORDER,
 * WS-291's tau). The charts are not worthless — lambda = 0 is catastrophic because of the
 * zeros, and the 0.15-to-0.80 climb is real — but their SHAPE was doing far less work
 * than its provenance implied.
 *
 * THE HONEST CAVEAT. The probe scores the UNOBSERVED-SEAT prior (no VPIP, no observations)
 * against SHOWDOWN hands, which are not a uniform sample of held hands. And raw all-in
 * equity does not encode equity REALIZATION (§1.4) — suited and connected hands play
 * better than their all-in equity suggests, which is exactly the information a chart is
 * supposed to add. The measurement says that information is worth less than assumed; it
 * does not say it is worth nothing.
 *
 * FALSIFICATION TEST. Re-run the sweep against a non-showdown ground truth (the WS-292
 * holding-knowledge join, when it lands) and against a hero-EV metric rather than log
 * loss. If the optimum moves sharply toward 0 under either, the shape information is real
 * and this metric was the wrong instrument. Re-run the sweep — do not re-reason it.
 */
export const PRIOR_SUPPORT_LAMBDA = 0.8;

/** Floor handed to the logistic. Self-limits to 90% of a narrow grid's own width. */
export const PRIOR_SUPPORT_FLOOR = MIN_CONTINUATION_WEIGHT;

/** Combos per grid cell — pairs 6, suited 4, offsuit 12. */
const COMBOS_AT = new Uint8Array(GRID_SIZE);
for (let i = 0; i < GRID_SIZE; i++) {
  const { isPair, suited } = decodeIndex(i);
  COMBOS_AT[i] = isPair ? 6 : suited ? 4 : 12;
}

/**
 * A grid's RANGE WIDTH: the fraction of all 1326 starting combos it holds. This is the
 * quantity the support blend must not move — a rate derived from observation would
 * otherwise be silently rescaled by a change that was only supposed to fill in holes.
 */
const comboWeightedMean = (grid) => {
  let s = 0;
  for (let i = 0; i < GRID_SIZE; i++) s += grid[i] * COMBOS_AT[i];
  return s / TOTAL_COMBOS;
};

/** Per-position expansion of the equity table into one score per COMBO. Built once. */
const scoreCache = {};
const comboScores = (position) => {
  if (scoreCache[position]) return scoreCache[position];
  // Ranking only — the table is keyed by the position whose opening range the hand is
  // measured against, and the ORDER barely moves between keys. An unrecognized category
  // falls back rather than throwing, matching `getBaseChart`.
  const src = EQUITY_VS_OPEN[position] || EQUITY_VS_OPEN.LATE;
  const equity = Float64Array.from(src, (bp) => bp / 10000); // basis points -> fraction
  const cellOf = new Uint16Array(TOTAL_COMBOS);
  let k = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let c = 0; c < COMBOS_AT[i]; c++) cellOf[k++] = i;
  }
  scoreCache[position] = { equity, cellOf };
  return scoreCache[position];
};

/**
 * Smoothing bandwidth, as a fraction of the equity spread across the 169 cells.
 *
 * Wide enough that a hole is filled by its genuine neighbours, narrow enough that a
 * range's shape is not flattened into its own average.
 */
const SUPPORT_BANDWIDTH = 0.12;

/**
 * The prior's own shape, smoothed over equity — this is the SCORE the support ranks by.
 *
 * WHY NOT A PLAIN EQUITY RAMP. The obvious construction is "rank every hand by equity and
 * lay a logistic over it", and it is wrong for most of these grids, because not every
 * preflop action is "stronger hand, more likely":
 *
 *   open        rises with strength          a ramp fits (r = 0.81)
 *   fold        FALLS with strength          a ramp fits, mirrored (r = -0.85)
 *   limp        peaks in the MIDDLE (2.2)    no monotone ramp can fit it (r = -0.53)
 *
 * An ascending ramp on `fold` claims the hand most likely to be folded is aces. A
 * descending one on `limp` claims the modal limp is 32o, when 2.2 says limp ranges are
 * small pairs, suited connectors and suited aces. Both are the same error: forcing a
 * monotone model onto a distribution that is not monotone.
 *
 * The grid ALREADY encodes its own direction and shape. Smoothing it in equity space and
 * ranking by the result gets all three cases right with no orientation flag, no
 * per-action table, and nothing for a future action to be forgotten by. A hole is filled
 * by what its equity-neighbours do, which is exactly the inference being made: a hand the
 * chart omitted is about as likely as the hands either side of it that the chart kept.
 *
 * Nadaraya-Watson with a Gaussian kernel, combo-weighted so a pair (6 combos) does not
 * pull as hard as an offsuit class (12).
 */
const smoothedShape = (grid, eq) => {
  const out = new Float64Array(GRID_SIZE);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < GRID_SIZE; i++) {
    const e = eq[i];
    if (e < lo) lo = e;
    if (e > hi) hi = e;
  }
  const h = Math.max(1e-9, (hi - lo) * SUPPORT_BANDWIDTH);

  for (let i = 0; i < GRID_SIZE; i++) {
    let num = 0, den = 0;
    for (let j = 0; j < GRID_SIZE; j++) {
      const d = (eq[i] - eq[j]) / h;
      const k = Math.exp(-0.5 * d * d) * COMBOS_AT[j];
      num += k * grid[j];
      den += k;
    }
    out[i] = den > 0 ? num / den : 0;
  }
  return out;
};

/**
 * Give a prior grid support on every cell, ranked by the grid's own smoothed shape.
 *
 * THE DEFECT THIS CLOSES (WS-302). A prior of exactly zero is not "unlikely", it is
 * "impossible" — and `bayesianUpdater` updates ranges as `prior[i] * ratio`, a pure
 * multiplication, so a cell that starts at zero can NEVER be moved off zero by any
 * amount of frequency evidence. The positional charts zeroed 30-37% of the grid, which
 * is exactly the region a live 9-handed player strays into off-chart: a limped 84s from
 * early position, a defended K3o in the blinds. When one got turned over, the model was
 * never in the running. POKER_THEORY 2.1 demotes these charts to the UNOBSERVED-SEAT
 * PRIOR, and a starting belief is not allowed to be unfalsifiable.
 *
 * STRUCTURAL ZERO vs EPISTEMIC ZERO — the distinction this function turns on. A grid
 * that is IDENTICALLY zero describes a scenario that cannot occur, not a range with
 * holes: BB has no voluntary no-raise action, so it cannot limp, and its `limp` grid is
 * empty by construction (see CLAUDE.md 5 — "do not attempt to 'fix' it"). That one passes
 * through untouched. Every grid with any mass in it gets support.
 *
 * The support is `softContinuationWeights` (WS-291's primitive, reused not re-derived)
 * over the grid's OWN shape smoothed in equity space (`smoothedShape` — read its comment
 * for why NOT raw equity), with its mean pinned to the grid's own width. Blending two
 * grids of equal mean preserves that mean by construction — no rescaling step and no
 * artifact. The narrow grids protect themselves: the primitive caps its floor at 90% of
 * the target mean, so a 1%-wide `threeBet` prior takes a floor near 0.009, not 0.05, and
 * POKER_THEORY 2.3's "a live 3-bet is almost always a monster" read survives intact.
 *
 * @param {Float64Array} grid - the doctrine shape
 * @param {string} position - EARLY | MIDDLE | LATE | SB | BB
 * @param {number} lambda - shrinkage weight toward support
 * @returns {Float64Array} same grid when structurally empty, otherwise the blend
 */
export const withEquitySupport = (grid, position, lambda = PRIOR_SUPPORT_LAMBDA) => {
  if (!(lambda > 0)) return grid;

  const width = comboWeightedMean(grid);
  if (!(width > 0)) return grid; // structural impossibility — leave it alone

  const { cellOf, equity } = comboScores(position);
  // Rank by the grid's OWN smoothed shape, not by raw equity — see `smoothedShape`.
  const shape = smoothedShape(grid, equity);
  const scores = Float64Array.from(cellOf, (i) => shape[i]);
  const w = softContinuationWeights(scores, width, { floor: PRIOR_SUPPORT_FLOOR });

  const out = createRange();
  // Every combo in a cell carries the same score, so it receives the same weight; the
  // last write per cell is the cell's support value.
  for (let k = 0; k < w.length; k++) out[cellOf[k]] = w[k];
  for (let i = 0; i < GRID_SIZE; i++) out[i] = (1 - lambda) * grid[i] + lambda * out[i];
  return out;
};

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
const buildActionPrior = (position, action, lambda = PRIOR_SUPPORT_LAMBDA) => {
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

  // No prior assigns exactly zero to a hand a player could actually be holding (WS-302).
  // Applied here, at the single point every prior is constructed, so the guarantee cannot
  // be reintroduced by a new `case` forgetting about it.
  return withEquitySupport(range, position, lambda);
};

// Cache built priors
const priorCache = {};

/**
 * Get the population prior range for a position + action.
 *
 * @param {string} position - EARLY, MIDDLE, LATE, SB, BB
 * @param {string} action - fold, limp, open, coldCall, threeBet (+ WS-256 subclasses)
 * @param {{ supportLambda?: number }} [opts] - override the support shrinkage weight.
 *        Exposed so the WS-293 calibration probe can SWEEP it rather than have it
 *        asserted here; production never passes it.
 * @returns {Float64Array} 169-cell weight grid (copy, safe to mutate)
 */
export const getPopulationPrior = (position, action, opts = {}) => {
  const lambda = Number.isFinite(opts.supportLambda) ? opts.supportLambda : PRIOR_SUPPORT_LAMBDA;
  const key = lambda === PRIOR_SUPPORT_LAMBDA
    ? `${position}_${action}`
    : `${position}_${action}_L${lambda}`;
  if (!priorCache[key]) {
    priorCache[key] = buildActionPrior(position, action, lambda);
  }
  return new Float64Array(priorCache[key]);
};
