/**
 * calibrationCopy.test.js — copy generator + AP-06 forbidden-pattern guards
 * for the Calibration Dashboard (WS-169 / SPR-066).
 *
 * Pins:
 *   - AP-06 model-accuracy ladder enforcement: every emitted prose passes
 *     FORBIDDEN_PATTERNS check
 *   - Three-branch logic (collecting-data / well-calibrated / mis-calibrated)
 *   - Direction language for mis-calibrated case (above/below CI)
 *   - Empty-state copy variants (anchors / predicates / enrollment)
 *   - Helper copy generators (sparkline / trend collecting-data)
 *   - Determinism (same input → identical output)
 */

import { describe, it, expect } from 'vitest';
import {
  buildCalibrationProse,
  buildAnchorsEmptyStateCopy,
  buildPredicatesEmptyStateCopy,
  buildEnrollmentBannerCopy,
  buildInsufficientSparklineCopy,
  buildCollectingDataTrendCopy,
  validateCalibrationProse,
  validateCalibrationCopyText,
  FORBIDDEN_PATTERNS,
} from '../calibrationCopy';

const buildAnchor = (overrides = {}) => ({
  id: 'eal:test-1',
  archetypeName: 'Nit Over-Fold to River Overbet (4-Flush)',
  ...overrides,
});

const buildCalibration = (overrides = {}) => ({
  predictedRate: 0.68,
  observedRate: 0.74,
  credibleInterval: { lower: 0.62, upper: 0.84, level: 0.95 },
  sampleSize: 34,
  predictionInCi: true,
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────
// FORBIDDEN_PATTERNS — every pattern is non-empty and a regex
// ───────────────────────────────────────────────────────────────────────────

describe('FORBIDDEN_PATTERNS', () => {
  it('is a non-empty frozen array', () => {
    expect(Array.isArray(FORBIDDEN_PATTERNS)).toBe(true);
    expect(FORBIDDEN_PATTERNS.length).toBeGreaterThan(10);
    expect(Object.isFrozen(FORBIDDEN_PATTERNS)).toBe(true);
  });
  it('every entry is a RegExp', () => {
    for (const p of FORBIDDEN_PATTERNS) {
      expect(p).toBeInstanceOf(RegExp);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// validateCalibrationProse — coverage of every forbidden phrase
// ───────────────────────────────────────────────────────────────────────────

describe('validateCalibrationProse — explicit forbidden-pattern coverage', () => {
  // Each phrase below MUST violate at least one forbidden pattern. If this list
  // shrinks (a phrase is removed from forbidden list), the test fails — forcing
  // a Gate-level review of the AP-06 contract.
  const forbiddenPhrases = [
    'Your accuracy on this anchor is 76%.',
    'Your observation last night matched the model.',
    'You were off by 6 percentage points.',
    'You misjudged this spot.',
    'We grade your calibration weekly.',
    'We score your observations.',
    'How did you do on this anchor?',
    'Did you nail the prediction?',
    'Your confidence in this anchor was high.',
    'This anchor underperformed your expectations.',
    'Maybe consider giving up on this one.',
    'You should reconsider this retired anchor.',
    'You have observed this 34 times.',
    'Good data accumulation, friend!',
    'Well done on this calibration!',
    'Great work — keep it up!',
    'You nailed it.',
    'You got it right.',
    'You got it wrong.',
  ];

  for (const phrase of forbiddenPhrases) {
    it(`flags forbidden phrase: "${phrase}"`, () => {
      const result = validateCalibrationProse(phrase);
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(1);
    });
  }

  it('passes neutral model-accuracy phrasing', () => {
    const acceptable = [
      'The model predicts this archetype 68% of the time.',
      'Observed 74% (62%–84%) across 34 firings.',
      'Prediction falls within the credible interval — model is well-calibrated for this anchor.',
      'Sample size is below the trend threshold (n < 10) — calibration verdict deferred until more data accrues.',
    ];
    for (const phrase of acceptable) {
      const result = validateCalibrationProse(phrase);
      expect(result.valid).toBe(true);
      expect(result.violations).toEqual([]);
    }
  });

  it('returns valid=true for non-string input (no false positives)', () => {
    expect(validateCalibrationProse(null)).toEqual({ valid: true, violations: [] });
    expect(validateCalibrationProse(undefined)).toEqual({ valid: true, violations: [] });
    expect(validateCalibrationProse(42)).toEqual({ valid: true, violations: [] });
  });

  it('exposes violation match for debugging', () => {
    const result = validateCalibrationProse('Your accuracy is 50%.');
    expect(result.valid).toBe(false);
    expect(result.violations[0]).toHaveProperty('pattern');
    expect(result.violations[0]).toHaveProperty('match');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// buildCalibrationProse — three-branch logic
// ───────────────────────────────────────────────────────────────────────────

describe('buildCalibrationProse — well-calibrated branch', () => {
  it('emits the AP-06 ladder when prediction in CI', () => {
    const prose = buildCalibrationProse(buildAnchor(), buildCalibration({ predictionInCi: true }));
    expect(prose).toContain('predicts');
    expect(prose).toContain('Observed');
    expect(prose).toContain('credible interval');
    expect(prose).toContain('well-calibrated');
    expect(prose).not.toContain('mis-calibrated');
  });

  it('passes AP-06 forbidden-pattern check', () => {
    const prose = buildCalibrationProse(buildAnchor(), buildCalibration({ predictionInCi: true }));
    expect(validateCalibrationProse(prose).valid).toBe(true);
  });

  it('renders predicted percentage rounded', () => {
    const prose = buildCalibrationProse(buildAnchor(), buildCalibration({
      predictedRate: 0.683,
      observedRate: 0.74,
      predictionInCi: true,
    }));
    expect(prose).toContain('68%');
  });

  it('renders observed + CI bounds rounded as percentages', () => {
    const prose = buildCalibrationProse(buildAnchor(), buildCalibration({
      observedRate: 0.7423,
      credibleInterval: { lower: 0.62, upper: 0.84, level: 0.95 },
      predictionInCi: true,
    }));
    expect(prose).toContain('74%');
    expect(prose).toContain('62%–84%');
  });

  it('uses singular "firing" for n=1, plural otherwise', () => {
    const proseSingular = buildCalibrationProse(buildAnchor(), buildCalibration({ sampleSize: 1, predictionInCi: true }));
    // Note: n=1 is below threshold (n<10) → falls into collecting-data branch.
    // Verify singular grammar in that branch instead.
    expect(proseSingular).toContain('1 firing');
    expect(proseSingular).not.toContain('1 firings');

    const prosePlural = buildCalibrationProse(buildAnchor(), buildCalibration({ sampleSize: 34, predictionInCi: true }));
    expect(prosePlural).toContain('34 firings');
  });

  it('substitutes "this anchor" when archetypeName missing', () => {
    const prose = buildCalibrationProse({ id: 'a:1' }, buildCalibration({ predictionInCi: true }));
    expect(prose).toContain('this anchor');
  });
});

describe('buildCalibrationProse — mis-calibrated branch', () => {
  it('renders "above the credible interval" when predicted > upper bound', () => {
    const prose = buildCalibrationProse(buildAnchor(), buildCalibration({
      predictedRate: 0.92,
      observedRate: 0.74,
      credibleInterval: { lower: 0.62, upper: 0.84, level: 0.95 },
      sampleSize: 34,
      predictionInCi: false,
    }));
    expect(prose).toContain('above the credible interval');
    expect(prose).toContain('mis-calibrated');
  });

  it('renders "below the credible interval" when predicted < lower bound', () => {
    const prose = buildCalibrationProse(buildAnchor(), buildCalibration({
      predictedRate: 0.45,
      observedRate: 0.74,
      credibleInterval: { lower: 0.62, upper: 0.84, level: 0.95 },
      sampleSize: 34,
      predictionInCi: false,
    }));
    expect(prose).toContain('below the credible interval');
    expect(prose).toContain('mis-calibrated');
  });

  it('falls back to neutral "outside the credible interval" when CI missing', () => {
    const prose = buildCalibrationProse(buildAnchor(), buildCalibration({
      predictedRate: 0.92,
      observedRate: 0.74,
      credibleInterval: null,
      sampleSize: 34,
      predictionInCi: false,
    }));
    expect(prose).toContain('outside the credible interval');
  });

  it('passes AP-06 forbidden-pattern check (mis-calibrated direction)', () => {
    const prose = buildCalibrationProse(buildAnchor(), buildCalibration({
      predictedRate: 0.92,
      observedRate: 0.74,
      predictionInCi: false,
    }));
    expect(validateCalibrationProse(prose).valid).toBe(true);
  });
});

describe('buildCalibrationProse — collecting-data branch', () => {
  it('renders neutral framing when sampleSize < 10', () => {
    const prose = buildCalibrationProse(buildAnchor(), buildCalibration({
      sampleSize: 5,
      predictionInCi: true,
    }));
    expect(prose).toContain('Sample size is below the trend threshold');
    expect(prose).not.toContain('well-calibrated');
    expect(prose).not.toContain('mis-calibrated');
  });

  it('renders "no observations recorded yet" when sampleSize is 0 or null but rates present', () => {
    const proseZero = buildCalibrationProse(buildAnchor(), buildCalibration({ sampleSize: 0, observedRate: 0, predictionInCi: false }));
    expect(proseZero).toContain('No observations recorded yet');

    const proseNull = buildCalibrationProse(buildAnchor(), buildCalibration({ sampleSize: null, observedRate: 0.5, predictionInCi: false }));
    expect(proseNull).toContain('No observations recorded yet');
  });

  it('renders "not accumulated enough observations" when rates absent AND sampleSize too low', () => {
    const prose = buildCalibrationProse(buildAnchor(), {
      predictedRate: null,
      observedRate: null,
      credibleInterval: null,
      sampleSize: null,
      predictionInCi: false,
    });
    expect(prose).toContain('not accumulated enough observations');
  });

  it('passes AP-06 forbidden-pattern check (collecting-data)', () => {
    const prose = buildCalibrationProse(buildAnchor(), buildCalibration({ sampleSize: 5 }));
    expect(validateCalibrationProse(prose).valid).toBe(true);
  });
});

describe('buildCalibrationProse — invalid input', () => {
  it('returns "" for null anchor', () => {
    expect(buildCalibrationProse(null, buildCalibration())).toBe('');
  });
  it('returns "" for null calibration', () => {
    expect(buildCalibrationProse(buildAnchor(), null)).toBe('');
  });
  it('returns "" for non-object calibration', () => {
    expect(buildCalibrationProse(buildAnchor(), 'string')).toBe('');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Determinism
// ───────────────────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('same input produces identical output across calls', () => {
    const a = buildCalibrationProse(buildAnchor(), buildCalibration());
    const b = buildCalibrationProse(buildAnchor(), buildCalibration());
    expect(a).toBe(b);
  });

  it('mis-calibrated branch determinism', () => {
    const a = buildCalibrationProse(buildAnchor(), buildCalibration({ predictionInCi: false, predictedRate: 0.92 }));
    const b = buildCalibrationProse(buildAnchor(), buildCalibration({ predictionInCi: false, predictedRate: 0.92 }));
    expect(a).toBe(b);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Empty-state generators
// ───────────────────────────────────────────────────────────────────────────

describe('buildAnchorsEmptyStateCopy', () => {
  it('returns the spec-locked empty-state copy', () => {
    expect(buildAnchorsEmptyStateCopy()).toBe(
      'No anchor firings yet. Calibration data accrues as anchors fire in matched hands.',
    );
  });
  it('passes AP-06 forbidden-pattern check', () => {
    expect(validateCalibrationProse(buildAnchorsEmptyStateCopy()).valid).toBe(true);
  });
});

describe('buildPredicatesEmptyStateCopy', () => {
  it('returns the v1 empty-state copy ratified at SPR-066 plan-mode', () => {
    expect(buildPredicatesEmptyStateCopy()).toBe(
      'Predicate calibration ships with the exploit-deviation project. Anchors and primitives use independent infrastructure and are live above.',
    );
  });
  it('passes AP-06 forbidden-pattern check', () => {
    expect(validateCalibrationProse(buildPredicatesEmptyStateCopy()).valid).toBe(true);
  });
});

describe('buildEnrollmentBannerCopy', () => {
  it('returns message + ctaLabel object', () => {
    const result = buildEnrollmentBannerCopy();
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('ctaLabel');
    expect(result.ctaLabel).toBe('Open Settings');
  });
  it('message passes AP-06 forbidden-pattern check', () => {
    const { message } = buildEnrollmentBannerCopy();
    expect(validateCalibrationProse(message).valid).toBe(true);
  });
  it('message references seed priors + Tier 1 simulator (factual, no urgency)', () => {
    const { message } = buildEnrollmentBannerCopy();
    expect(message).toContain('seed priors');
    expect(message).toContain('Tier 1 simulator');
    // No nag language
    expect(message).not.toMatch(/enable now|please enroll|don't miss|enroll now/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Helper copy generators
// ───────────────────────────────────────────────────────────────────────────

describe('buildInsufficientSparklineCopy', () => {
  it('renders "Insufficient data for sparkline (n=X)" with given count', () => {
    expect(buildInsufficientSparklineCopy(3)).toBe('Insufficient data for sparkline (n=3)');
    expect(buildInsufficientSparklineCopy(0)).toBe('Insufficient data for sparkline (n=0)');
  });
  it('clamps invalid input to n=0', () => {
    expect(buildInsufficientSparklineCopy(null)).toBe('Insufficient data for sparkline (n=0)');
    expect(buildInsufficientSparklineCopy(-5)).toBe('Insufficient data for sparkline (n=0)');
    expect(buildInsufficientSparklineCopy('three')).toBe('Insufficient data for sparkline (n=0)');
  });
  it('passes AP-06 forbidden-pattern check', () => {
    expect(validateCalibrationProse(buildInsufficientSparklineCopy(3)).valid).toBe(true);
  });
});

describe('buildCollectingDataTrendCopy', () => {
  it('returns spec-locked "(collecting data)" string', () => {
    expect(buildCollectingDataTrendCopy()).toBe('(collecting data)');
  });
  it('passes AP-06 forbidden-pattern check', () => {
    expect(validateCalibrationProse(buildCollectingDataTrendCopy()).valid).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// API alias
// ───────────────────────────────────────────────────────────────────────────

describe('validateCalibrationCopyText alias', () => {
  it('is alias for validateCalibrationProse', () => {
    expect(validateCalibrationCopyText('Your accuracy is 50%.').valid).toBe(false);
    expect(validateCalibrationCopyText('The model predicts 68%.').valid).toBe(true);
  });
});
