/**
 * calibrationCopy.js — deterministic copy generator for the Calibration Dashboard.
 *
 * Per `docs/design/surfaces/calibration-dashboard.md` §AnchorCalibrationPanel
 * "Expanded detail layout" + AP-06 (graded-work-trap) refusal:
 *   - Generator is deterministic from (anchor, calibration); no free-form LLM at runtime.
 *   - CI-grep target for forbidden-string violations (FORBIDDEN_PATTERNS export).
 *   - Mirrors `retirementCopy.js` pattern exactly.
 *
 * **Model-accuracy framing — load-bearing.** Every prose template evaluates
 * the MODEL's prediction; never grades the observer. AP-06 ladder strictly:
 *
 *   ✓ "The model predicts this archetype 68% of the time. Observed 74% (±10%)
 *      across 34 firings. Prediction falls within the credible interval —
 *      model is well-calibrated for this anchor."
 *
 *   ✗ "Your observations match the model's prediction 76% of the time."
 *      (grades the observer — AP-06 refusal)
 *   ✗ "You have observed this 34 times — good data accumulation."
 *      (engagement-pressure coded as praise)
 *
 * Output shape per call: a single string (the prose). Validators expose
 * forbidden-pattern checks for CI + DOM-assertion test consumption.
 *
 * EAL Phase 6 — WS-169 / SPR-066.
 */

// ───────────────────────────────────────────────────────────────────────────
// Forbidden patterns (AP-06 — graded-work trap)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Patterns that MUST NOT appear in any generated calibration prose. CI-grep
 * target. Aligned with `retirementCopy.FORBIDDEN_PATTERNS` — both surfaces share
 * the same AP-06 contract; copy generators differ in shape but enforce the
 * same forbidden surface.
 *
 * Scoped to avoid false-positive on technical strings (e.g., "your accuracy"
 * is forbidden but "anchor's accuracy" is fine — phrasing test).
 */
export const FORBIDDEN_PATTERNS = Object.freeze([
  /your accuracy/i,
  /your observation/i,
  /you were off/i,
  /you misjudged/i,
  /grade your/i,
  /score your/i,
  /how did you/i,
  /did you nail/i,
  /your confidence (in|was|may|might)/i,
  /this anchor underperformed/i,
  /giving up on this/i,
  /\breconsider\b.*\bretired\b/i,  // "reconsider retired" nudge — AP-05
  /you have observed/i,
  /good data accumulation/i,
  /well done/i,
  /great work/i,
  /you nailed/i,
  /you got it (right|wrong)/i,
]);

/**
 * Validate a generated string against forbidden patterns. Pure helper used
 * by tests + CI-lint script.
 *
 * @param {string} text
 * @returns {{ valid: boolean, violations: Array<{ pattern: string, match: string }> }}
 */
export const validateCalibrationProse = (text) => {
  if (typeof text !== 'string') return { valid: true, violations: [] };
  const violations = [];
  for (const pattern of FORBIDDEN_PATTERNS) {
    const m = text.match(pattern);
    if (m) violations.push({ pattern: String(pattern), match: m[0] });
  }
  return { valid: violations.length === 0, violations };
};

// ───────────────────────────────────────────────────────────────────────────
// Public API — model-accuracy prose generator
// ───────────────────────────────────────────────────────────────────────────

/**
 * Build the model-accuracy prose for an anchor's expanded detail panel.
 *
 * Returns a single string (2–3 sentences) following the AP-06 ladder. Caller
 * renders verbatim.
 *
 * Three template branches based on calibration state:
 *   1. **collecting-data** — sample size below MIN_TREND_SAMPLE_SIZE; observed
 *      rate present but trend cannot be determined. Prose names the seed prior
 *      + observed rate without making a calibration claim.
 *   2. **well-calibrated** — predicted rate falls within the credible interval.
 *      Prose names predicted, observed, CI, n, and concludes "model is
 *      well-calibrated for this anchor."
 *   3. **mis-calibrated** — predicted rate falls OUTSIDE the credible interval.
 *      Prose names predicted, observed, CI, n, direction (above/below CI), and
 *      concludes "model is mis-calibrated for this anchor."
 *
 * **No graded copy emitted in any branch.** Forbidden patterns are CI-checked
 * over every emitted string at build time + via FORBIDDEN_PATTERNS test.
 *
 * @param {Object} anchor                            — ExploitAnchor record
 * @param {Object} calibration                       — selectAnchorCalibration(anchor) output
 * @returns {string} prose (or '' for invalid input)
 */
export const buildCalibrationProse = (anchor, calibration) => {
  if (!anchor || !calibration || typeof calibration !== 'object') return '';

  const archetypeName = nameOrFallback(anchor.archetypeName);
  const { predictedRate, observedRate, credibleInterval, sampleSize, predictionInCi } = calibration;

  // Insufficient data branch — observed/predicted may be present but n is too low
  // to render a calibration verdict. Use neutral seed-prior framing.
  if (typeof sampleSize !== 'number' || sampleSize < 10) {
    if (typeof observedRate === 'number' && typeof predictedRate === 'number') {
      return (
        `The model predicts ${pct(predictedRate)} for ${archetypeName}. `
        + `${capitalize(sampleSize === 0 || sampleSize === null ? 'no observations recorded yet' : `observed ${pct(observedRate)} across ${sampleSize} firing${pluralS(sampleSize)}`)}. `
        + `Sample size is below the trend threshold (n < 10) — calibration verdict deferred until more data accrues.`
      );
    }
    return (
      `The model has not accumulated enough observations of ${archetypeName} to render a calibration verdict. `
      + `Calibration data accrues as the anchor fires in matched hands.`
    );
  }

  // Sufficient data branch — render the model-accuracy ladder.
  if (typeof predictedRate !== 'number' || typeof observedRate !== 'number') {
    return (
      `The model predicts ${typeof predictedRate === 'number' ? pct(predictedRate) : 'unknown rate'} for ${archetypeName}. `
      + `Observed data is incomplete; calibration verdict cannot be rendered.`
    );
  }

  const predictedStr = pct(predictedRate);
  const observedStr = pct(observedRate);
  const ciStr = isValidCi(credibleInterval) ? `(${pctRange(credibleInterval.lower, credibleInterval.upper)})` : '';
  const nStr = `${sampleSize} firing${pluralS(sampleSize)}`;

  if (predictionInCi) {
    return (
      `The model predicts ${archetypeName} ${predictedStr} of the time. `
      + `Observed ${observedStr} ${ciStr ? ciStr + ' ' : ''}across ${nStr}. `
      + `Prediction falls within the credible interval — model is well-calibrated for this anchor.`
    ).replace(/\s+/g, ' ').trim();
  }

  // Mis-calibrated: figure out direction (predicted above CI vs below CI).
  let direction = '';
  if (isValidCi(credibleInterval)) {
    if (predictedRate < credibleInterval.lower) direction = 'below the credible interval';
    else if (predictedRate > credibleInterval.upper) direction = 'above the credible interval';
  }

  return (
    `The model predicts ${archetypeName} ${predictedStr} of the time. `
    + `Observed ${observedStr} ${ciStr ? ciStr + ' ' : ''}across ${nStr}. `
    + `Prediction falls ${direction ? direction + ' ' : 'outside the credible interval '}— model is mis-calibrated for this anchor.`
  ).replace(/\s+/g, ' ').trim();
};

/**
 * Build the empty-state copy for the Anchors tab when no firings have accumulated.
 *
 * Per Gate 4 spec §Known behavior notes line 316: factual, no engagement-pressure
 * nudge.
 *
 * @returns {string}
 */
export const buildAnchorsEmptyStateCopy = () =>
  'No anchor firings yet. Calibration data accrues as anchors fire in matched hands.';

/**
 * Build the empty-state copy for the Predicates tab (v1 — exploit-deviation
 * predicate-calibration not yet shipped).
 *
 * Per Gate 4 spec amendment 2026-05-09 §PredicateCalibrationPanel (v1
 * empty-state).
 *
 * @returns {string}
 */
export const buildPredicatesEmptyStateCopy = () =>
  'Predicate calibration ships with the exploit-deviation project. Anchors and primitives use independent infrastructure and are live above.';

/**
 * Build the enrollment banner copy. Renders only when
 * `observation_enrollment_state === 'not-enrolled'`. Single-render per visit;
 * no nag (per spec line 156-160).
 *
 * @returns {{ message: string, ctaLabel: string }}
 */
export const buildEnrollmentBannerCopy = () => ({
  message: 'Enrollment off — dashboard shows the model\'s seed priors + Tier 1 simulator results. Observation-driven calibration data accrues when enrolled.',
  ctaLabel: 'Open Settings',
});

/**
 * Build the insufficient-sparkline-data copy used inside an anchor row when
 * matcher firings < MIN_SPARKLINE_SAMPLE_SIZE (per spec line 317).
 *
 * @param {number} sampleSize
 * @returns {string}
 */
export const buildInsufficientSparklineCopy = (sampleSize) => {
  const n = typeof sampleSize === 'number' && Number.isFinite(sampleSize) && sampleSize >= 0 ? sampleSize : 0;
  return `Insufficient data for sparkline (n=${n})`;
};

/**
 * Build the collecting-data trend copy used inside an anchor row when
 * sampleSize < MIN_TREND_SAMPLE_SIZE (per spec line 318).
 *
 * @returns {string}
 */
export const buildCollectingDataTrendCopy = () => '(collecting data)';

/**
 * Convenience — runs validateCalibrationProse across a single string. Used in
 * tests + (Phase 5+) CI-lint script `scripts/check-calibration-copy.sh`.
 *
 * @param {string} text
 * @returns {{ valid: boolean, violations: Array<{ pattern: string, match: string }> }}
 */
export const validateCalibrationCopyText = validateCalibrationProse;

// ───────────────────────────────────────────────────────────────────────────
// Internal helpers
// ───────────────────────────────────────────────────────────────────────────

const nameOrFallback = (s) => (typeof s === 'string' && s.length > 0 ? s : 'this anchor');

const pct = (n) => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '?%';
  return `${Math.round(n * 100)}%`;
};

const pctRange = (lower, upper) => {
  if (typeof lower !== 'number' || typeof upper !== 'number') return '';
  return `${pct(lower)}–${pct(upper)}`;
};

const pluralS = (n) => (typeof n === 'number' && n === 1 ? '' : 's');

const capitalize = (s) => (typeof s === 'string' && s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const isValidCi = (ci) => (
  ci !== null
  && typeof ci === 'object'
  && typeof ci.lower === 'number'
  && typeof ci.upper === 'number'
  && Number.isFinite(ci.lower)
  && Number.isFinite(ci.upper)
);

export default buildCalibrationProse;
