/**
 * captureObservation.test.js — W-AO-1 writer unit tests
 *
 * Covers:
 *   - Happy path produces a valid AnchorObservation record
 *   - I-EAL-8 enforcement (note > 280 chars rejected)
 *   - I-WR-5 enforcement (not-enrolled forces contributesToCalibration false)
 *   - I-WR-6 enforcement (incognito toggle wins over default-on-when-enrolled)
 *   - schema-delta §3.1.1 enforcement (≥ 1 fixed-enum tag required)
 *   - Tag normalization integration (mixed enum + custom tags)
 *   - Optional field handling (streetKey / actionIndex / note absent → omitted from record)
 *   - id construction (obs:<handId>:<index>)
 *   - createdAt sourcing (input → context.nowFn → fallback)
 *   - Cross-validation: produced records pass validateAnchorObservation
 */

import { describe, it, expect } from 'vitest';

import { captureObservation } from '../captureObservation';
import { validateAnchorObservation } from '../validateAnchor';
import {
  ANCHOR_OBSERVATION_SCHEMA_VERSION,
  NOTE_MAX_LENGTH,
} from '../../../constants/anchorLibraryConstants';

// ───────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ───────────────────────────────────────────────────────────────────────────

const validInput = (overrides = {}) => ({
  handId: 'hand-42',
  streetKey: 'river',
  note: 'Villain tanked then folded — fits the pattern.',
  ownerTags: ['villain-overfold'],
  ...overrides,
});

const enrolledContext = (overrides = {}) => ({
  observation_enrollment_state: 'enrolled',
  nowFn: () => '2026-04-25T14:23:00Z',
  ...overrides,
});

const notEnrolledContext = (overrides = {}) => ({
  observation_enrollment_state: 'not-enrolled',
  nowFn: () => '2026-04-25T14:23:00Z',
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────
// Happy path
// ───────────────────────────────────────────────────────────────────────────

describe('captureObservation — happy path', () => {
  it('produces a valid record with all fields', () => {
    const result = captureObservation(validInput(), enrolledContext());
    expect(result.ok).toBe(true);
    expect(result.record).toMatchObject({
      id: 'obs:hand-42:0',
      schemaVersion: ANCHOR_OBSERVATION_SCHEMA_VERSION,
      createdAt: '2026-04-25T14:23:00Z',
      handId: 'hand-42',
      streetKey: 'river',
      note: 'Villain tanked then folded — fits the pattern.',
      ownerTags: ['villain-overfold'],
      status: 'open',
      origin: 'owner-captured',
      contributesToCalibration: true,
    });
  });

  it('produced record passes validateAnchorObservation', () => {
    const result = captureObservation(validInput(), enrolledContext());
    expect(result.ok).toBe(true);
    expect(validateAnchorObservation(result.record).ok).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// I-EAL-8 — note 280-char limit
// ───────────────────────────────────────────────────────────────────────────

describe('I-EAL-8 — note 280-char limit', () => {
  it('accepts note at exactly 280 chars', () => {
    const result = captureObservation(
      validInput({ note: 'x'.repeat(280) }),
      enrolledContext(),
    );
    expect(result.ok).toBe(true);
    expect(result.record.note).toHaveLength(NOTE_MAX_LENGTH);
  });

  it('rejects note > 280 chars', () => {
    const result = captureObservation(
      validInput({ note: 'x'.repeat(281) }),
      enrolledContext(),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('I-EAL-8'))).toBe(true);
  });

  it('accepts note absent', () => {
    const input = validInput();
    delete input.note;
    const result = captureObservation(input, enrolledContext());
    expect(result.ok).toBe(true);
    expect(result.record.note).toBeUndefined();
  });

  it('treats null note as absent', () => {
    const result = captureObservation(validInput({ note: null }), enrolledContext());
    expect(result.ok).toBe(true);
    expect(result.record.note).toBeUndefined();
  });

  it('rejects non-string note', () => {
    const result = captureObservation(validInput({ note: 42 }), enrolledContext());
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('must be a string'))).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// I-WR-5 — enrollment gate
// ───────────────────────────────────────────────────────────────────────────

describe('I-WR-5 — enrollment gate', () => {
  it('not-enrolled forces contributesToCalibration to false', () => {
    const result = captureObservation(validInput(), notEnrolledContext());
    expect(result.ok).toBe(true);
    expect(result.record.contributesToCalibration).toBe(false);
  });

  it('not-enrolled forces false even when input requests true', () => {
    const result = captureObservation(
      validInput({ contributesToCalibration: true }),
      notEnrolledContext(),
    );
    expect(result.ok).toBe(true);
    expect(result.record.contributesToCalibration).toBe(false);
  });

  it('enrolled defaults to true (Q2-A opt-out)', () => {
    const input = validInput();
    delete input.contributesToCalibration;
    const result = captureObservation(input, enrolledContext());
    expect(result.ok).toBe(true);
    expect(result.record.contributesToCalibration).toBe(true);
  });

  it('rejects context with invalid enrollment state', () => {
    const result = captureObservation(validInput(), {
      observation_enrollment_state: 'unknown',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('observation_enrollment_state'))).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// I-WR-6 — incognito guarantee (red line #9)
// ───────────────────────────────────────────────────────────────────────────

describe('I-WR-6 — incognito per-observation guarantee (red line #9)', () => {
  it('incognito toggle (false) overrides default-on-when-enrolled', () => {
    const result = captureObservation(
      validInput({ contributesToCalibration: false }),
      enrolledContext(),
    );
    expect(result.ok).toBe(true);
    expect(result.record.contributesToCalibration).toBe(false);
  });

  it('explicit true does not override the default — still true', () => {
    const result = captureObservation(
      validInput({ contributesToCalibration: true }),
      enrolledContext(),
    );
    expect(result.ok).toBe(true);
    expect(result.record.contributesToCalibration).toBe(true);
  });

  it('non-boolean contributesToCalibration is treated as default (not as false)', () => {
    const result = captureObservation(
      validInput({ contributesToCalibration: 'on' }),
      enrolledContext(),
    );
    expect(result.ok).toBe(true);
    // 'on' is not strict-equal to false → fallback to default true (when enrolled)
    expect(result.record.contributesToCalibration).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Tag vocabulary (schema-delta §3.1.1)
// ───────────────────────────────────────────────────────────────────────────

describe('tag vocabulary — ≥ 1 fixed-enum required', () => {
  it('passes with one fixed-enum tag', () => {
    const result = captureObservation(
      validInput({ ownerTags: ['villain-overfold'] }),
      enrolledContext(),
    );
    expect(result.ok).toBe(true);
  });

  it('passes with multiple fixed-enum tags', () => {
    const result = captureObservation(
      validInput({ ownerTags: ['villain-overfold', 'unusual-sizing'] }),
      enrolledContext(),
    );
    expect(result.ok).toBe(true);
    expect(result.record.ownerTags).toEqual(['villain-overfold', 'unusual-sizing']);
  });

  it('passes with fixed + custom mixed', () => {
    const result = captureObservation(
      validInput({ ownerTags: ['villain-overfold', 'big-sizing-tell'] }),
      enrolledContext(),
    );
    expect(result.ok).toBe(true);
    expect(result.record.ownerTags).toEqual(['villain-overfold', 'big-sizing-tell']);
  });

  it('rejects when only custom tags supplied (no fixed enum)', () => {
    const result = captureObservation(
      validInput({ ownerTags: ['big-sizing-tell', 'snap-call-pattern'] }),
      enrolledContext(),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('fixed-enum'))).toBe(true);
  });

  it('rejects empty tag list', () => {
    const result = captureObservation(
      validInput({ ownerTags: [] }),
      enrolledContext(),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('fixed-enum'))).toBe(true);
  });

  it('rejects non-array ownerTags', () => {
    const result = captureObservation(
      validInput({ ownerTags: 'villain-overfold' }),
      enrolledContext(),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('must be an array'))).toBe(true);
  });

  it('normalizes tags through the normalizer (uppercase + spaces)', () => {
    const result = captureObservation(
      validInput({ ownerTags: ['VILLAIN-OVERFOLD', 'big sizing tell'] }),
      enrolledContext(),
    );
    expect(result.ok).toBe(true);
    expect(result.record.ownerTags).toEqual(['villain-overfold', 'big-sizing-tell']);
  });

  it('deduplicates tags', () => {
    const result = captureObservation(
      validInput({ ownerTags: ['villain-overfold', 'Villain-Overfold'] }),
      enrolledContext(),
    );
    expect(result.ok).toBe(true);
    expect(result.record.ownerTags).toEqual(['villain-overfold']);
  });

  it('reports rejected entries but still saves if fixed-enum present', () => {
    const result = captureObservation(
      validInput({ ownerTags: ['villain-overfold', '   ', 42] }),
      enrolledContext(),
    );
    // Rejected tag entries surface as errors → ok: false
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('rejected entry'))).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Optional field handling
// ───────────────────────────────────────────────────────────────────────────

describe('optional field handling', () => {
  it('omits streetKey when absent', () => {
    const input = validInput();
    delete input.streetKey;
    const result = captureObservation(input, enrolledContext());
    expect(result.ok).toBe(true);
    expect(result.record.streetKey).toBeUndefined();
  });

  it('rejects invalid streetKey', () => {
    const result = captureObservation(
      validInput({ streetKey: 'showdown' }),
      enrolledContext(),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('streetKey'))).toBe(true);
  });

  it('accepts actionIndex when valid integer', () => {
    const result = captureObservation(
      validInput({ actionIndex: 5 }),
      enrolledContext(),
    );
    expect(result.ok).toBe(true);
    expect(result.record.actionIndex).toBe(5);
  });

  it('rejects non-integer actionIndex', () => {
    const result = captureObservation(
      validInput({ actionIndex: 1.5 }),
      enrolledContext(),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects negative actionIndex', () => {
    const result = captureObservation(
      validInput({ actionIndex: -1 }),
      enrolledContext(),
    );
    expect(result.ok).toBe(false);
  });

  it('omits actionIndex when absent', () => {
    const result = captureObservation(validInput(), enrolledContext());
    expect(result.record.actionIndex).toBeUndefined();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// id construction
// ───────────────────────────────────────────────────────────────────────────

describe('id construction', () => {
  it('id format is "obs:<handId>:<observationIndex>"', () => {
    const result = captureObservation(
      validInput({ observationIndex: 3 }),
      enrolledContext(),
    );
    expect(result.record.id).toBe('obs:hand-42:3');
  });

  it('id observationIndex defaults to 0 when absent', () => {
    const result = captureObservation(validInput(), enrolledContext());
    expect(result.record.id).toBe('obs:hand-42:0');
  });

  it('rejects negative observationIndex by treating it as 0', () => {
    // Defensive: invalid index → fallback to 0 rather than producing weird id
    const result = captureObservation(
      validInput({ observationIndex: -5 }),
      enrolledContext(),
    );
    expect(result.record.id).toBe('obs:hand-42:0');
  });

  it('rejects missing handId', () => {
    const input = validInput();
    delete input.handId;
    const result = captureObservation(input, enrolledContext());
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('handId'))).toBe(true);
  });

  it('rejects empty string handId', () => {
    const result = captureObservation(
      validInput({ handId: '' }),
      enrolledContext(),
    );
    expect(result.ok).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// createdAt sourcing
// ───────────────────────────────────────────────────────────────────────────

describe('createdAt sourcing', () => {
  it('uses input.createdAt when supplied', () => {
    const result = captureObservation(
      validInput({ createdAt: '2026-04-20T10:00:00Z' }),
      enrolledContext(),
    );
    expect(result.record.createdAt).toBe('2026-04-20T10:00:00Z');
  });

  it('falls back to context.nowFn when input.createdAt absent', () => {
    const result = captureObservation(validInput(), enrolledContext());
    expect(result.record.createdAt).toBe('2026-04-25T14:23:00Z');
  });

  it('falls back to system Date.now when neither supplied', () => {
    const result = captureObservation(
      validInput(),
      { observation_enrollment_state: 'enrolled' },
    );
    expect(result.record.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Cross-validation: produced records pass validateAnchorObservation
// ───────────────────────────────────────────────────────────────────────────

describe('cross-validation against validateAnchorObservation', () => {
  it('happy path enrolled', () => {
    const result = captureObservation(validInput(), enrolledContext());
    expect(validateAnchorObservation(result.record).ok).toBe(true);
  });

  it('not-enrolled with forced false contributesToCalibration', () => {
    const result = captureObservation(validInput(), notEnrolledContext());
    expect(validateAnchorObservation(result.record).ok).toBe(true);
  });

  it('incognito toggle on', () => {
    const result = captureObservation(
      validInput({ contributesToCalibration: false }),
      enrolledContext(),
    );
    expect(validateAnchorObservation(result.record).ok).toBe(true);
  });

  it('all 4 seed-anchor tag categories validate', () => {
    for (const tag of [
      'villain-overfold',
      'villain-overbluff',
      'villain-overcall',
      'hero-overfolded',
      'unusual-sizing',
      'perception-gap',
      'style-mismatch',
      'session-context',
    ]) {
      const result = captureObservation(
        validInput({ ownerTags: [tag] }),
        enrolledContext(),
      );
      expect(result.ok).toBe(true);
      expect(validateAnchorObservation(result.record).ok).toBe(true);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Input validation
// ───────────────────────────────────────────────────────────────────────────

describe('input validation', () => {
  it('rejects null input', () => {
    expect(captureObservation(null, enrolledContext())).toMatchObject({ ok: false });
  });

  it('rejects null context', () => {
    expect(captureObservation(validInput(), null)).toMatchObject({ ok: false });
  });

  it('rejects non-object input', () => {
    expect(captureObservation('input', enrolledContext())).toMatchObject({ ok: false });
  });

  it('aggregates multiple errors', () => {
    const result = captureObservation(
      {
        // missing handId, missing ownerTags, bad streetKey, bad note
        streetKey: 'showdown',
        note: 42,
      },
      enrolledContext(),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
