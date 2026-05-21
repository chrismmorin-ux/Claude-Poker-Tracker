/**
 * autoRetireBannerCopy.test.js — copy generator + AP-06 forbidden-pattern guards
 * for the AutoRetireBanner shipped in SPR-060 / WS-170.
 *
 * Validates the deterministic generator from `docs/design/journeys/anchor-retirement.md`
 * Variation D step 3s.
 */

import { describe, it, expect } from 'vitest';
import {
  buildAutoRetireBannerCopy,
  validateAutoRetireBannerCopyBundle,
} from '../autoRetireBannerCopy';
import {
  FORBIDDEN_PATTERNS,
  validateRetirementCopy,
} from '../retirementCopy';

describe('buildAutoRetireBannerCopy', () => {
  describe('valid count', () => {
    it('returns singular noun for count=1', () => {
      const bundle = buildAutoRetireBannerCopy({ count: 1 });
      expect(bundle).toEqual({
        message: '1 anchor auto-retired since you last looked.',
        reviewLabel: 'Review',
        dismissLabel: 'Dismiss',
        dismissAria: 'Dismiss banner',
      });
    });

    it('returns plural noun for count=2', () => {
      const bundle = buildAutoRetireBannerCopy({ count: 2 });
      expect(bundle.message).toBe('2 anchors auto-retired since you last looked.');
    });

    it('returns plural noun for count=N>1', () => {
      const bundle = buildAutoRetireBannerCopy({ count: 7 });
      expect(bundle.message).toBe('7 anchors auto-retired since you last looked.');
    });

    it('is deterministic — same input produces identical output across calls', () => {
      const a = buildAutoRetireBannerCopy({ count: 3 });
      const b = buildAutoRetireBannerCopy({ count: 3 });
      expect(a).toEqual(b);
    });
  });

  describe('invalid count', () => {
    it('returns null for count=0', () => {
      expect(buildAutoRetireBannerCopy({ count: 0 })).toBeNull();
    });

    it('returns null for negative count', () => {
      expect(buildAutoRetireBannerCopy({ count: -1 })).toBeNull();
    });

    it('returns null for non-integer count', () => {
      expect(buildAutoRetireBannerCopy({ count: 1.5 })).toBeNull();
    });

    it('returns null for missing count', () => {
      expect(buildAutoRetireBannerCopy({})).toBeNull();
    });

    it('returns null for missing args', () => {
      expect(buildAutoRetireBannerCopy()).toBeNull();
    });

    it('returns null for non-numeric count', () => {
      expect(buildAutoRetireBannerCopy({ count: '5' })).toBeNull();
      expect(buildAutoRetireBannerCopy({ count: null })).toBeNull();
      expect(buildAutoRetireBannerCopy({ count: undefined })).toBeNull();
    });
  });

  describe('AP-06 forbidden-pattern absence (graded-work-trap)', () => {
    it('count=1 bundle has zero forbidden-pattern matches', () => {
      const bundle = buildAutoRetireBannerCopy({ count: 1 });
      const result = validateAutoRetireBannerCopyBundle(bundle);
      expect(result.valid).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it('count=42 bundle has zero forbidden-pattern matches', () => {
      const bundle = buildAutoRetireBannerCopy({ count: 42 });
      const result = validateAutoRetireBannerCopyBundle(bundle);
      expect(result.valid).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it('forbidden patterns absent in message text directly', () => {
      const bundle = buildAutoRetireBannerCopy({ count: 5 });
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(bundle.message).not.toMatch(pattern);
      }
    });

    it('forbidden patterns absent in action labels', () => {
      const bundle = buildAutoRetireBannerCopy({ count: 5 });
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(bundle.reviewLabel).not.toMatch(pattern);
        expect(bundle.dismissLabel).not.toMatch(pattern);
        expect(bundle.dismissAria).not.toMatch(pattern);
      }
    });

    it('does not contain "your" + grading word combinations', () => {
      const bundle = buildAutoRetireBannerCopy({ count: 5 });
      // Generic "you" is permitted ("since you last looked"); the grading
      // patterns target "your accuracy / observation / confidence" etc.
      expect(bundle.message).not.toMatch(/your accuracy/i);
      expect(bundle.message).not.toMatch(/your observation/i);
      expect(bundle.message).not.toMatch(/your confidence/i);
    });

    it('does not contain reconsider-retired AP-05 nudge', () => {
      const bundle = buildAutoRetireBannerCopy({ count: 5 });
      expect(bundle.message).not.toMatch(/\breconsider\b.*\bretired\b/i);
    });
  });

  describe('every count from 1..50 passes AP-06', () => {
    for (let count = 1; count <= 50; count += 1) {
      it(`count=${count} passes`, () => {
        const bundle = buildAutoRetireBannerCopy({ count });
        const result = validateAutoRetireBannerCopyBundle(bundle);
        expect(result.valid).toBe(true);
      });
    }
  });
});

describe('validateAutoRetireBannerCopyBundle', () => {
  it('returns valid=true for null/undefined bundle', () => {
    expect(validateAutoRetireBannerCopyBundle(null).valid).toBe(true);
    expect(validateAutoRetireBannerCopyBundle(undefined).valid).toBe(true);
  });

  it('returns valid=true for non-object bundle', () => {
    expect(validateAutoRetireBannerCopyBundle('string').valid).toBe(true);
    expect(validateAutoRetireBannerCopyBundle(42).valid).toBe(true);
  });

  it('detects forbidden patterns injected into a bundle', () => {
    const bundle = buildAutoRetireBannerCopy({ count: 1 });
    const tampered = { ...bundle, message: 'Your accuracy was off by 3 anchors.' };
    const result = validateAutoRetireBannerCopyBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('aggregates violations from multiple fields', () => {
    const tampered = {
      message: 'Your observation drift across these anchors.',
      reviewLabel: 'Reconsider retired anchors',
      dismissLabel: 'Dismiss',
      dismissAria: 'Dismiss banner',
    };
    const result = validateAutoRetireBannerCopyBundle(tampered);
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
  });
});

describe('integration with retirementCopy validator', () => {
  it('every output text passes single-string validateRetirementCopy', () => {
    const bundle = buildAutoRetireBannerCopy({ count: 99 });
    expect(validateRetirementCopy(bundle.message).valid).toBe(true);
    expect(validateRetirementCopy(bundle.reviewLabel).valid).toBe(true);
    expect(validateRetirementCopy(bundle.dismissLabel).valid).toBe(true);
    expect(validateRetirementCopy(bundle.dismissAria).valid).toBe(true);
  });
});
