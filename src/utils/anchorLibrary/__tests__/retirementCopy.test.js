/**
 * retirementCopy.test.js — copy generator + AP-06 forbidden-pattern coverage.
 *
 * EAL Phase 6 — Session 21 (S21).
 */

import { describe, it, expect } from 'vitest';
import {
  buildRetirementCopy,
  validateRetirementCopy,
  validateRetirementCopyBundle,
  isKnownRetirementAction,
  RETIREMENT_ACTIONS,
  FORBIDDEN_PATTERNS,
} from '../retirementCopy';

const sampleAnchor = {
  id: 'anchor:test:1',
  archetypeName: 'Nit Over-Fold to River Overbet on 4-Flush Scare',
  status: 'active',
};

describe('retirementCopy — module exports', () => {
  it('RETIREMENT_ACTIONS lists the 4 primary actions (S23 added re-enable)', () => {
    expect(RETIREMENT_ACTIONS).toEqual(
      expect.arrayContaining(['retire', 'suppress', 'reset', 're-enable']),
    );
    expect(RETIREMENT_ACTIONS.length).toBe(4);
  });

  it('isKnownRetirementAction recognizes the 4 primary actions', () => {
    expect(isKnownRetirementAction('retire')).toBe(true);
    expect(isKnownRetirementAction('suppress')).toBe(true);
    expect(isKnownRetirementAction('reset')).toBe(true);
    expect(isKnownRetirementAction('re-enable')).toBe(true);
    expect(isKnownRetirementAction('UNRETIRE')).toBe(false);
    expect(isKnownRetirementAction('')).toBe(false);
    expect(isKnownRetirementAction(null)).toBe(false);
  });

  it('FORBIDDEN_PATTERNS includes the AP-06 forbidden phrases', () => {
    const sources = FORBIDDEN_PATTERNS.map((p) => String(p));
    expect(sources.some((s) => s.includes('your accuracy'))).toBe(true);
    expect(sources.some((s) => s.includes('grade your'))).toBe(true);
    expect(sources.some((s) => s.includes('score your'))).toBe(true);
  });
});

describe('buildRetirementCopy — Retire variation', () => {
  it('returns title + subText + confirm/cancel labels', () => {
    const c = buildRetirementCopy('retire', sampleAnchor);
    expect(c.title).toContain('Retire');
    expect(c.title).toContain(sampleAnchor.archetypeName);
    expect(c.subText).toContain('Retired anchors');
    expect(c.confirmLabel).toBe('Retire');
    expect(c.cancelLabel).toBe('Cancel');
  });

  it('exposes overrideReason + targetStatus for the writer', () => {
    const c = buildRetirementCopy('retire', sampleAnchor);
    expect(c.overrideReason).toBe('manual-retire');
    expect(c.targetStatus).toBe('retired');
  });

  it('marks destructive=false', () => {
    expect(buildRetirementCopy('retire', sampleAnchor).destructive).toBe(false);
  });

  it('omits destructiveCheckboxLabel for non-destructive action', () => {
    expect(buildRetirementCopy('retire', sampleAnchor).destructiveCheckboxLabel).toBeNull();
  });

  it('builds success + undone toast strings with archetype name', () => {
    const c = buildRetirementCopy('retire', sampleAnchor);
    expect(c.successToast).toContain(sampleAnchor.archetypeName);
    expect(c.undoneToast).toContain(sampleAnchor.archetypeName);
  });
});

describe('buildRetirementCopy — Suppress variation', () => {
  it('renders Suppress copy distinct from Retire', () => {
    const r = buildRetirementCopy('retire', sampleAnchor);
    const s = buildRetirementCopy('suppress', sampleAnchor);
    expect(s.title).not.toBe(r.title);
    expect(s.confirmLabel).toBe('Suppress');
    expect(s.subText).toContain('un-suppress');
  });

  it('exposes overrideReason="manual-suppress" + targetStatus="suppressed"', () => {
    const c = buildRetirementCopy('suppress', sampleAnchor);
    expect(c.overrideReason).toBe('manual-suppress');
    expect(c.targetStatus).toBe('suppressed');
  });
});

describe('buildRetirementCopy — Reset variation (destructive)', () => {
  it('marks destructive=true', () => {
    expect(buildRetirementCopy('reset', sampleAnchor).destructive).toBe(true);
  });

  it('exposes destructiveCheckboxLabel for 2-tap confirm', () => {
    const c = buildRetirementCopy('reset', sampleAnchor);
    expect(c.destructiveCheckboxLabel).toBeTruthy();
    expect(c.destructiveCheckboxLabel).toContain('I understand');
  });

  it('subText warns about cannot-be-auto-undone after 12s', () => {
    const c = buildRetirementCopy('reset', sampleAnchor);
    expect(c.subText).toContain('cannot be auto-undone');
  });

  it('exposes overrideReason="manual-reset" + targetStatus=null (status unchanged)', () => {
    const c = buildRetirementCopy('reset', sampleAnchor);
    expect(c.overrideReason).toBe('manual-reset');
    expect(c.targetStatus).toBeNull();
  });
});

describe('buildRetirementCopy — Re-enable variation (S23)', () => {
  it('renders Re-enable copy distinct from Retire/Suppress/Reset', () => {
    const c = buildRetirementCopy('re-enable', sampleAnchor);
    expect(c.title).toContain('Re-enable');
    expect(c.title).toContain(sampleAnchor.archetypeName);
    expect(c.subText).toContain('Re-enabling resumes Tier 2 calibration');
    expect(c.confirmLabel).toBe('Re-enable');
  });

  it('exposes overrideReason="owner-un-retire" + targetStatus="active"', () => {
    const c = buildRetirementCopy('re-enable', sampleAnchor);
    expect(c.overrideReason).toBe('owner-un-retire');
    expect(c.targetStatus).toBe('active');
  });

  it('marks destructive=true for 2-tap confirm gate', () => {
    expect(buildRetirementCopy('re-enable', sampleAnchor).destructive).toBe(true);
  });

  it('exposes destructiveCheckboxLabel for 2-tap confirm', () => {
    const c = buildRetirementCopy('re-enable', sampleAnchor);
    expect(c.destructiveCheckboxLabel).toBeTruthy();
    expect(c.destructiveCheckboxLabel).toMatch(/fire on live surfaces/);
  });

  it('builds success + undone toast strings with archetype name', () => {
    const c = buildRetirementCopy('re-enable', sampleAnchor);
    expect(c.successToast).toContain(sampleAnchor.archetypeName);
    expect(c.successToast).toContain('re-enabled');
    expect(c.undoneToast).toContain(sampleAnchor.archetypeName);
  });
});

describe('buildRetirementCopy — defensive paths', () => {
  it('returns null for unknown action', () => {
    expect(buildRetirementCopy('unretire', sampleAnchor)).toBeNull();
    expect(buildRetirementCopy('', sampleAnchor)).toBeNull();
    expect(buildRetirementCopy(null, sampleAnchor)).toBeNull();
  });

  it('falls back to "this anchor" when archetypeName missing', () => {
    const c = buildRetirementCopy('retire', { id: 'a:1' });
    expect(c.title).toContain('this anchor');
    expect(c.successToast).toContain('this anchor');
  });

  it('falls back to "this anchor" when anchor object empty', () => {
    const c = buildRetirementCopy('retire', null);
    expect(c.title).toContain('this anchor');
  });

  it('produces empty string anchorId when anchor.id missing', () => {
    expect(buildRetirementCopy('retire', { archetypeName: 'X' }).anchorId).toBe('');
  });
});

describe('validateRetirementCopy — AP-06 forbidden-pattern enforcement', () => {
  it('returns valid=true for clean strings', () => {
    expect(validateRetirementCopy('Retire this anchor.').valid).toBe(true);
  });

  it('flags "your accuracy"', () => {
    const r = validateRetirementCopy('Your accuracy on this anchor was low.');
    expect(r.valid).toBe(false);
    expect(r.violations.some((v) => /your accuracy/i.test(v.match))).toBe(true);
  });

  it('flags "grade your"', () => {
    expect(validateRetirementCopy('Grade your decisions.').valid).toBe(false);
  });

  it('flags "score your"', () => {
    expect(validateRetirementCopy('Score your read.').valid).toBe(false);
  });

  it('flags "you were off"', () => {
    expect(validateRetirementCopy('Looks like you were off here.').valid).toBe(false);
  });

  it('flags "you misjudged"', () => {
    expect(validateRetirementCopy('You misjudged the spot.').valid).toBe(false);
  });

  it('flags "did you nail"', () => {
    expect(validateRetirementCopy('Did you nail this one?').valid).toBe(false);
  });

  it('flags "this anchor underperformed"', () => {
    expect(validateRetirementCopy('This anchor underperformed.').valid).toBe(false);
  });

  it('flags "giving up on this"', () => {
    expect(validateRetirementCopy('Giving up on this exploit?').valid).toBe(false);
  });

  it('handles non-string input gracefully', () => {
    expect(validateRetirementCopy(null).valid).toBe(true);
    expect(validateRetirementCopy(undefined).valid).toBe(true);
    expect(validateRetirementCopy(42).valid).toBe(true);
  });
});

describe('validateRetirementCopyBundle — full-bundle enforcement', () => {
  it('returns valid=true for the shipped Retire bundle', () => {
    const bundle = buildRetirementCopy('retire', sampleAnchor);
    expect(validateRetirementCopyBundle(bundle).valid).toBe(true);
  });

  it('returns valid=true for the shipped Suppress bundle', () => {
    const bundle = buildRetirementCopy('suppress', sampleAnchor);
    expect(validateRetirementCopyBundle(bundle).valid).toBe(true);
  });

  it('returns valid=true for the shipped Reset bundle', () => {
    const bundle = buildRetirementCopy('reset', sampleAnchor);
    expect(validateRetirementCopyBundle(bundle).valid).toBe(true);
  });

  it('returns valid=true for the shipped Re-enable bundle (S23)', () => {
    const bundle = buildRetirementCopy('re-enable', sampleAnchor);
    expect(validateRetirementCopyBundle(bundle).valid).toBe(true);
  });

  it('returns valid=true for null/undefined bundle (defensive)', () => {
    expect(validateRetirementCopyBundle(null).valid).toBe(true);
    expect(validateRetirementCopyBundle(undefined).valid).toBe(true);
  });

  it('flags forbidden patterns when injected into a bundle field', () => {
    const bundle = buildRetirementCopy('retire', sampleAnchor);
    bundle.subText = 'Your accuracy on this anchor was low.';
    const r = validateRetirementCopyBundle(bundle);
    expect(r.valid).toBe(false);
    expect(r.violations.length).toBeGreaterThan(0);
  });
});
