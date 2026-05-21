/**
 * anchorCalibrationSelectors.js — per-anchor + per-primitive calibration rollup
 * for the Calibration Dashboard study surface.
 *
 * Pure selector layer. Bridges anchor schema's `evidence` (Beta posterior) +
 * `gtoBaseline.referenceRate` (predicted rate) into the per-row data shape the
 * dashboard's Anchors panel renders, plus the per-origin evidence split
 * required by AP-08 for the AnchorDetailPanel deep-dive.
 *
 * **AP-08 invariant:** matcher-system observations and owner-captured
 * observations are returned in **separate arrays** + **separate aggregates**.
 * They are never summed, blended, or rendered as a unified count at the
 * selector layer. Mirrors `sessionRollupSelectors.js` line 67-86 origin-split
 * pattern. The caller (CalibrationDashboardView's AnchorDetailPanel) renders
 * the evidence list as stacked cards mixed by origin, with a leading origin
 * badge per row (locked at SPR-066, Gate 4 spec amendment 2026-05-09).
 *
 * **Authoritative rate source.** `anchor.evidence.pointEstimate` is the
 * authoritative observed rate (Beta posterior). `anchor.gtoBaseline.referenceRate`
 * is the authoritative predicted rate. The selectors do NOT recompute either
 * from raw observations — that would re-derive what the writer pipeline already
 * produces and risk drift. Observations are exposed only for the evidence-list
 * render surface, not for re-aggregation.
 *
 * Pure module — no IO, no React. Caller supplies all inputs.
 *
 * Per `docs/design/surfaces/calibration-dashboard.md` §AnchorCalibrationPanel
 * (v1.1, 2026-05-09 amendment) + EAL `CLAUDE.md` core principle 7 (signal
 * separation — AP-08 invariant) + File Responsibilities table (Commit 8).
 *
 * EAL Phase 6 — WS-169 / SPR-066.
 */

import { OBSERVATION_ORIGINS } from '../../constants/anchorLibraryConstants';
import { evaluatePrimitiveStatus, PRIMITIVE_LOAD_BEARING_THRESHOLD } from './primitiveValidity';

// ───────────────────────────────────────────────────────────────────────────
// Constants — sample-size thresholds (per Gate 4 spec §Known behavior notes)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Minimum sample size before sparkline renders. Below this, the surface shows
 * "Insufficient data for sparkline (n=X)" instead of attempting render with
 * too few points (per spec line 317).
 */
export const MIN_SPARKLINE_SAMPLE_SIZE = 5;

/**
 * Minimum sample size before trend computation runs. Below this, the surface
 * shows "(collecting data)" (per spec line 318). At/above this, the trend
 * compares recent-window observed rate to overall observed rate.
 */
export const MIN_TREND_SAMPLE_SIZE = 10;

/**
 * Recent-window size for trend computation. Per spec: "Trend: stable
 * (since last 10 firings)".
 */
export const TREND_RECENT_WINDOW = 10;

/**
 * Trend stability band — within ±5 percentage points of overall mean is "stable".
 * Above the band = "improving" (matcher's predictions getting more accurate);
 * below the band = "drifting" (matcher's predictions getting less accurate).
 *
 * Note: "improving"/"drifting" describe MODEL CALIBRATION direction — never
 * "your accuracy" (AP-06 model-accuracy framing). Words are neutral per spec
 * line 171.
 */
export const TREND_STABILITY_BAND = 0.05;

// ───────────────────────────────────────────────────────────────────────────
// Public API — per-anchor calibration
// ───────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} AnchorCalibration
 * @property {string} anchorId
 * @property {string} archetypeName
 * @property {string} status                            — anchor status (active/retired/suppressed/candidate)
 * @property {number|null} predictedRate                — anchor.gtoBaseline.referenceRate
 * @property {number|null} observedRate                 — anchor.evidence.pointEstimate (Beta posterior)
 * @property {{lower: number, upper: number, level: number}|null} credibleInterval
 * @property {number|null} sampleSize                   — anchor.evidence.sampleSize ?? observationCount
 * @property {number|null} delta                        — observed − predicted (in percentage points × 1)
 * @property {boolean} predictionInCi                   — predicted within credible interval (well-calibrated)
 * @property {{status: 'collecting-data'|'stable'|'improving'|'drifting', recentRate: number|null}} trend
 * @property {{status: 'insufficient-data'|'available', points: number[]}} sparkline
 * @property {Object[]} matcherFired                    — observations with origin=matcher-system (AP-08)
 * @property {Object[]} ownerCaptured                   — observations with origin=owner-captured (AP-08)
 * @property {number} sampleSizeMatcher                 — count of matcherFired (NEVER summed with ownerCaptured count)
 * @property {number} sampleSizeOwner                   — count of ownerCaptured (NEVER summed with matcherFired count)
 */

/**
 * Compute per-anchor calibration data for one anchor.
 *
 * @param {Object} anchor                       — ExploitAnchor record
 * @param {Object[]} [observations=[]]          — flat array of all observations (caller passes all; we filter by anchorId)
 * @returns {AnchorCalibration|null}            — null when anchor is invalid
 */
export const selectAnchorCalibration = (anchor, observations = []) => {
  if (!anchor || typeof anchor !== 'object' || typeof anchor.id !== 'string') return null;

  const evidence = anchor.evidence || {};
  const gtoBaseline = anchor.gtoBaseline || {};

  const observedRate = numberOrNull(evidence.pointEstimate);
  const predictedRate = numberOrNull(gtoBaseline.referenceRate);
  const credibleInterval = isValidCi(evidence.credibleInterval) ? evidence.credibleInterval : null;
  const sampleSize = numberOrNull(evidence.sampleSize) ?? numberOrNull(evidence.observationCount);

  const delta = (observedRate !== null && predictedRate !== null)
    ? observedRate - predictedRate
    : null;

  const predictionInCi = (predictedRate !== null && credibleInterval !== null)
    ? predictedRate >= credibleInterval.lower && predictedRate <= credibleInterval.upper
    : false;

  // AP-08: split observations by origin into separate arrays.
  // Never push to a unified array; arrays are constructed separately.
  const matcherFired = [];
  const ownerCaptured = [];

  if (Array.isArray(observations)) {
    for (const obs of observations) {
      if (!obs || typeof obs !== 'object') continue;
      if (obs.anchorId !== anchor.id) continue;
      if (obs.origin === OBSERVATION_ORIGINS.MATCHER_SYSTEM) {
        matcherFired.push(obs);
      } else if (obs.origin === OBSERVATION_ORIGINS.OWNER_CAPTURED) {
        ownerCaptured.push(obs);
      }
      // Unknown origin: dropped silently (forward-compat with future origin enums).
    }
  }

  // Sort each origin array by createdAt ascending (chronological for evidence list).
  matcherFired.sort(byCreatedAtAsc);
  ownerCaptured.sort(byCreatedAtAsc);

  const trend = computeTrend({ observedRate, sampleSize, matcherFired });
  const sparkline = computeSparkline({ matcherFired });

  return {
    anchorId: anchor.id,
    archetypeName: typeof anchor.archetypeName === 'string' ? anchor.archetypeName : '',
    status: typeof anchor.status === 'string' ? anchor.status : 'active',
    predictedRate,
    observedRate,
    credibleInterval,
    sampleSize,
    delta,
    predictionInCi,
    trend,
    sparkline,
    matcherFired,
    ownerCaptured,
    sampleSizeMatcher: matcherFired.length,
    sampleSizeOwner: ownerCaptured.length,
  };
};

/**
 * Compute calibration data for an array of anchors. Returns one row per anchor.
 *
 * @param {Object[]} anchors
 * @param {Object[]} observations
 * @returns {AnchorCalibration[]}
 */
export const selectAllAnchorCalibrations = (anchors, observations = []) => {
  if (!Array.isArray(anchors)) return [];
  return anchors
    .map((anchor) => selectAnchorCalibration(anchor, observations))
    .filter((row) => row !== null);
};

// ───────────────────────────────────────────────────────────────────────────
// Public API — per-primitive validity
// ───────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} PrimitiveCalibration
 * @property {string} primitiveId
 * @property {string} name
 * @property {number|null} posterior                 — primitive.validityScore.pointEstimate
 * @property {{lower: number, upper: number, level: number}|null} credibleInterval
 * @property {number} dependentAnchorCount
 * @property {'load-bearing'|'at-risk'|'invalidated'} status
 * @property {boolean} isInvalidated                  — convenience flag (status === 'invalidated')
 */

/**
 * Compute calibration data for one perception primitive.
 *
 * @param {Object} primitive — PerceptionPrimitive record
 * @returns {PrimitiveCalibration|null}
 */
export const selectPrimitiveValidity = (primitive) => {
  if (!primitive || typeof primitive !== 'object' || typeof primitive.id !== 'string') return null;

  const validity = primitive.validityScore || {};
  const evaluation = evaluatePrimitiveStatus(primitive);

  return {
    primitiveId: primitive.id,
    name: typeof primitive.name === 'string' ? primitive.name : '',
    posterior: numberOrNull(validity.pointEstimate),
    credibleInterval: isValidCi(validity.credibleInterval) ? validity.credibleInterval : null,
    dependentAnchorCount: typeof validity.dependentAnchorCount === 'number' ? validity.dependentAnchorCount : 0,
    status: evaluation.status,
    isInvalidated: evaluation.status === 'invalidated',
  };
};

/**
 * Compute primitive calibration for an array of primitives.
 *
 * @param {Object[]} primitives
 * @returns {PrimitiveCalibration[]}
 */
export const selectAllPrimitiveValidities = (primitives) => {
  if (!Array.isArray(primitives)) return [];
  return primitives
    .map((p) => selectPrimitiveValidity(p))
    .filter((row) => row !== null);
};

// ───────────────────────────────────────────────────────────────────────────
// Internal — trend + sparkline computation
// ───────────────────────────────────────────────────────────────────────────

const computeTrend = ({ observedRate, sampleSize, matcherFired }) => {
  if (typeof sampleSize !== 'number' || sampleSize < MIN_TREND_SAMPLE_SIZE) {
    return { status: 'collecting-data', recentRate: null };
  }
  if (typeof observedRate !== 'number') {
    return { status: 'collecting-data', recentRate: null };
  }
  // Recent-window rate from matcher firings: last TREND_RECENT_WINDOW firings,
  // proportion that supported the predicted action (the firing's `supportsClaim`
  // boolean, when stored). Fall back to overall rate when supportsClaim isn't
  // populated on observations (early-stage data; treat as no signal → stable).
  const recent = matcherFired.slice(-TREND_RECENT_WINDOW);
  if (recent.length < MIN_TREND_SAMPLE_SIZE) {
    // Not enough matcher firings stored; rate may still be meaningful from prior
    // (e.g., synthetic-villain seed evidence). Trend status defaults to stable.
    return { status: 'stable', recentRate: null };
  }
  const supportingCount = recent.filter((obs) => obs && obs.supportsClaim === true).length;
  const recentRate = supportingCount / recent.length;
  const drift = recentRate - observedRate;

  if (Math.abs(drift) <= TREND_STABILITY_BAND) {
    return { status: 'stable', recentRate };
  }
  if (drift > 0) {
    return { status: 'improving', recentRate };
  }
  return { status: 'drifting', recentRate };
};

const computeSparkline = ({ matcherFired }) => {
  if (!Array.isArray(matcherFired) || matcherFired.length < MIN_SPARKLINE_SAMPLE_SIZE) {
    return { status: 'insufficient-data', points: [] };
  }
  // Cumulative observed-rate trace: at firing k, what fraction of firings 1..k
  // supported the claim. Non-supporting firings (fold predicted, villain called)
  // contribute 0; supporting contribute 1; observations missing supportsClaim
  // contribute 0 (conservative).
  let supports = 0;
  const points = matcherFired.map((obs, idx) => {
    if (obs && obs.supportsClaim === true) supports += 1;
    return supports / (idx + 1);
  });
  return { status: 'available', points };
};

// ───────────────────────────────────────────────────────────────────────────
// Internal — small helpers
// ───────────────────────────────────────────────────────────────────────────

const numberOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const isValidCi = (ci) => (
  ci !== null
  && typeof ci === 'object'
  && typeof ci.lower === 'number'
  && typeof ci.upper === 'number'
  && Number.isFinite(ci.lower)
  && Number.isFinite(ci.upper)
);

const byCreatedAtAsc = (a, b) => {
  const aMs = a && typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : 0;
  const bMs = b && typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : 0;
  return aMs - bMs;
};

// Re-export the primitive load-bearing threshold for callers that want to render
// the threshold value (e.g., "validity below 0.5 = invalidated").
export { PRIMITIVE_LOAD_BEARING_THRESHOLD };
