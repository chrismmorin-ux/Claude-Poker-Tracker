/**
 * calibrationAccumulator.js — Tier-2 rolling calibration metric accumulator
 *
 * Part of the assumptionEngine module. See `CLAUDE.md` for rules.
 *
 * Tier-2 (real-data backtest) per calibration.md §3 measures the gap between
 * predicted and realized dividends as real hand-history accrues. Commit 5 ships
 * the in-memory accumulator API + shape; IDB persistence lands in Commit 7.
 *
 * Metric storage keyed by `(predicateKey, style, street)`, with a sentinel "ALL"
 * for pooled aggregation. Per calibration.md §5.3 sample-size planning, pooled
 * slices accrue meaningful n faster than per-villain slices.
 *
 * Calibration ladder per calibration.md §3.3:
 *   ≤ 0.20 → well-calibrated
 *   0.20 – 0.25 → target zone (flag for dashboard)
 *   0.25 – 0.35 → conservative-ceiling (scale down emotional transform coefficients)
 *   > 0.35 for 10 consecutive sessions → retirement (status: expiring → retired)
 *
 * Retirement state: each predicate tracks consecutiveSessionsOverRetirementTrigger.
 * Reset to 0 when any session brings gap back below trigger.
 *
 * Pure module — imports only `./assumptionTypes`.
 */

import { CALIBRATION_LADDER } from '../assumptionTypes';

// ───────────────────────────────────────────────────────────────────────────
// Types (documented shape; JS does not enforce)
// ───────────────────────────────────────────────────────────────────────────

/**
 * CalibrationMetric — rolling metric for a single (predicate, style, street) slice.
 *
 * @typedef {Object} CalibrationMetric
 * @property {string} predicateKey
 * @property {string} style                    — VillainStyle or "ALL"
 * @property {string} street                   — Street or "ALL"
 * @property {number} predictedDividendSum    — Σ predicted-dividend per firing
 * @property {number} realizedDividendSum     — Σ realized-dividend per firing
 * @property {number} firings                  — number of firings recorded
 * @property {number} overrides                — number of hero silent overrides
 * @property {number} consecutiveSessionsOverRetirementTrigger
 * @property {string|null} lastUpdated         — ISO8601
 */

// ───────────────────────────────────────────────────────────────────────────
// Accumulator factory
// ───────────────────────────────────────────────────────────────────────────

/**
 * Create an in-memory calibration accumulator. Each instance holds its own
 * metric table; tests should construct fresh instances.
 *
 * Commit 7 will add IDB-backed persistence; the API shape is stable regardless.
 */
export const createCalibrationAccumulator = () => {
  const metrics = new Map();

  const keyOf = (predicateKey, style, street) =>
    `${predicateKey}|${style || 'ALL'}|${street || 'ALL'}`;

  const getOrCreate = (predicateKey, style, street) => {
    const k = keyOf(predicateKey, style, street);
    let m = metrics.get(k);
    if (!m) {
      m = {
        predicateKey,
        style: style || 'ALL',
        street: street || 'ALL',
        predictedDividendSum: 0,
        realizedDividendSum: 0,
        firings: 0,
        overrides: 0,
        consecutiveSessionsOverRetirementTrigger: 0,
        lastUpdated: null,
      };
      metrics.set(k, m);
    }
    return m;
  };

  /**
   * Record a single CitedDecision firing's predicted vs realized dividend.
   *
   * Updates both the per-slice metric AND the pooled "ALL" metrics (pooled-by-style
   * + pooled-by-street + fully-pooled) per calibration.md §5.3.
   *
   * @param {Object} firing
   * @param {string} firing.predicateKey
   * @param {string} firing.style
   * @param {string} firing.street
   * @param {number} firing.predictedDividend   — bb per 100 trigger firings
   * @param {number} firing.realizedDividend
   * @param {boolean} [firing.wasOverride=false] — hero silently overrode recommendation
   * @param {string} [firing.timestamp]           — ISO8601; defaults to now
   */
  const recordCitedDecision = (firing) => {
    if (!firing || typeof firing.predicateKey !== 'string') return;
    if (!Number.isFinite(firing.predictedDividend)) return;
    if (!Number.isFinite(firing.realizedDividend)) return;

    const now = firing.timestamp || new Date().toISOString();
    const { predicateKey, style, street, predictedDividend, realizedDividend, wasOverride } = firing;

    // Per-slice
    const m = getOrCreate(predicateKey, style, street);
    m.predictedDividendSum += predictedDividend;
    m.realizedDividendSum += realizedDividend;
    m.firings += 1;
    if (wasOverride) m.overrides += 1;
    m.lastUpdated = now;

    // Pooled-by-style (street = ALL)
    if (street && street !== 'ALL') {
      const pooled = getOrCreate(predicateKey, style, 'ALL');
      pooled.predictedDividendSum += predictedDividend;
      pooled.realizedDividendSum += realizedDividend;
      pooled.firings += 1;
      if (wasOverride) pooled.overrides += 1;
      pooled.lastUpdated = now;
    }

    // Pooled-by-street (style = ALL)
    if (style && style !== 'ALL') {
      const pooled = getOrCreate(predicateKey, 'ALL', street);
      pooled.predictedDividendSum += predictedDividend;
      pooled.realizedDividendSum += realizedDividend;
      pooled.firings += 1;
      if (wasOverride) pooled.overrides += 1;
      pooled.lastUpdated = now;
    }

    // Fully pooled (ALL, ALL) — only if we haven't already bumped it
    if ((street && street !== 'ALL') && (style && style !== 'ALL')) {
      const pooled = getOrCreate(predicateKey, 'ALL', 'ALL');
      pooled.predictedDividendSum += predictedDividend;
      pooled.realizedDividendSum += realizedDividend;
      pooled.firings += 1;
      if (wasOverride) pooled.overrides += 1;
      pooled.lastUpdated = now;
    }
  };

  /**
   * Compute the calibration gap for a specific slice, or null if insufficient sample.
   *
   * Gap formula per calibration.md §3.2:
   *   |predicted − realized| / |predicted|  averaged per firing
   *
   * Returns null when fewer than 20 firings have accrued (under-measured).
   *
   * @param {string} predicateKey
   * @param {string} [style='ALL']
   * @param {string} [street='ALL']
   * @returns {{gap, firings, classification, sufficient}}
   */
  const computeCalibrationGap = (predicateKey, style = 'ALL', street = 'ALL') => {
    const m = metrics.get(keyOf(predicateKey, style, street));
    if (!m || m.firings === 0) {
      return { gap: null, firings: 0, classification: 'no-data', sufficient: false };
    }

    const sufficient = m.firings >= 20;
    const avgPredicted = m.predictedDividendSum / m.firings;
    const avgRealized = m.realizedDividendSum / m.firings;

    let gap = null;
    if (Math.abs(avgPredicted) > 0.001) {
      gap = Math.abs(avgPredicted - avgRealized) / Math.abs(avgPredicted);
    } else {
      // Predicted ≈ 0 — gap is undefined-ish; use absolute error
      gap = Math.abs(avgPredicted - avgRealized);
    }

    return {
      gap,
      firings: m.firings,
      classification: classifyGap(gap),
      sufficient,
    };
  };

  /**
   * Record end-of-session consecutive-tracking for retirement ladder.
   * Called by the session-close handler in Commit 7.
   *
   * @param {string} predicateKey
   * @param {string} style
   * @param {string} street
   */
  const recordSessionClose = (predicateKey, style, street) => {
    const m = metrics.get(keyOf(predicateKey, style, street));
    if (!m) return;
    const { gap } = computeCalibrationGap(predicateKey, style, street);
    if (gap !== null && gap > CALIBRATION_LADDER.retirementTrigger) {
      m.consecutiveSessionsOverRetirementTrigger += 1;
    } else {
      m.consecutiveSessionsOverRetirementTrigger = 0;
    }
  };

  /**
   * Check if a predicate should be retired based on the calibration ladder.
   * Returns 'retire' when consecutive sessions over retirement trigger exceeds
   * CALIBRATION_LADDER.retirementConsecutiveSessions (default 10).
   *
   * @param {string} predicateKey
   * @param {string} [style='ALL']
   * @param {string} [street='ALL']
   * @returns {'retire' | 'expiring' | 'conservative-ceiling' | 'target-zone' | 'well-calibrated' | 'no-data'}
   */
  const checkRetirementLadder = (predicateKey, style = 'ALL', street = 'ALL') => {
    const m = metrics.get(keyOf(predicateKey, style, street));
    if (!m || m.firings === 0) return 'no-data';

    if (m.consecutiveSessionsOverRetirementTrigger >= CALIBRATION_LADDER.retirementConsecutiveSessions) {
      return 'retire';
    }

    const { gap } = computeCalibrationGap(predicateKey, style, street);
    return classifyGap(gap);
  };

  /**
   * Export current metric state (for persistence / diagnostics).
   * Returns a plain-object snapshot — safe for JSON serialization.
   */
  const snapshot = () => Array.from(metrics.values()).map((m) => ({ ...m }));

  /**
   * Reset a specific slice (or all slices if no key provided).
   * Used by test harness + explicit admin-reset flow.
   */
  const reset = (predicateKey, style, street) => {
    if (!predicateKey) {
      metrics.clear();
      return;
    }
    const k = keyOf(predicateKey, style, street);
    metrics.delete(k);
  };

  return {
    recordCitedDecision,
    computeCalibrationGap,
    recordSessionClose,
    checkRetirementLadder,
    snapshot,
    reset,
  };
};

// ───────────────────────────────────────────────────────────────────────────
// Classification helper (exposed for direct use)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Classify a calibration gap against the ladder thresholds (calibration.md §3.3).
 *
 * @param {number|null} gap
 * @returns {'no-data' | 'well-calibrated' | 'target-zone' | 'conservative-ceiling' | 'expiring'}
 */
export const classifyGap = (gap) => {
  if (gap === null || !Number.isFinite(gap)) return 'no-data';
  if (gap <= CALIBRATION_LADDER.wellCalibratedGap) return 'well-calibrated';
  if (gap <= CALIBRATION_LADDER.targetZone) return 'target-zone';
  if (gap <= CALIBRATION_LADDER.retirementTrigger) return 'conservative-ceiling';
  return 'expiring';
};

/**
 * Get the per-predicate transform scale factor per the conservative-ceiling rule.
 * When calibration gap exceeds 0.25, emotional-tilt coefficients scale down
 * proportionally to bring the gap back into the target zone.
 *
 * Linear interpolation for v1: gap 0.25 → scale 1.0, gap 0.35 → scale 0.6.
 * Tier-2 tuning refines in Phase 8.
 *
 * @param {number|null} gap
 * @returns {number} Scale factor in [0.4, 1.0]
 */
export const computeTransformScale = (gap) => {
  if (gap === null || !Number.isFinite(gap) || gap <= CALIBRATION_LADDER.conservativeCeilingTrigger) {
    return 1.0;
  }
  if (gap >= CALIBRATION_LADDER.retirementTrigger) {
    return 0.6; // most aggressive v1 scale-down; further intervention = retirement
  }
  // Linear interp between trigger (0.25 → 1.0) and retirement (0.35 → 0.6)
  const range = CALIBRATION_LADDER.retirementTrigger - CALIBRATION_LADDER.conservativeCeilingTrigger;
  const over = gap - CALIBRATION_LADDER.conservativeCeilingTrigger;
  return 1.0 - (over / range) * 0.4;
};
