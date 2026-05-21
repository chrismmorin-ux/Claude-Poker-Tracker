/**
 * logMatcherFiring.test.js — W-AO-2 system-observation writer unit tests
 *
 * Covers:
 *   - Happy path produces a valid system-origin record
 *   - I-WR-5 enrollment gate (not-enrolled → null record, no errors)
 *   - Idempotent id construction (obs:<handId>:matcher:<anchorId>:<streetKey>)
 *   - origin = matcher-system stamping
 *   - firingMetrics.confidence pass-through
 *   - Validation rejection on missing/bad inputs
 */

import { describe, it, expect } from 'vitest';
import { logMatcherFiring } from '../logMatcherFiring';
import {
  ANCHOR_OBSERVATION_SCHEMA_VERSION,
  OBSERVATION_ORIGINS,
} from '../../../constants/anchorLibraryConstants';

const validInput = (overrides = {}) => ({
  anchorId: 'anchor:nit:river:overfold:4flush',
  handId: 'live:session-1:hand-3',
  streetKey: 'river',
  firingMetrics: { confidence: 0.78 },
  ...overrides,
});

const enrolledContext = (overrides = {}) => ({
  observation_enrollment_state: 'enrolled',
  nowFn: () => '2026-05-09T05:00:00Z',
  ...overrides,
});

const notEnrolledContext = (overrides = {}) => ({
  observation_enrollment_state: 'not-enrolled',
  nowFn: () => '2026-05-09T05:00:00Z',
  ...overrides,
});

describe('logMatcherFiring — happy path (enrolled)', () => {
  it('produces a record with origin=matcher-system', () => {
    const result = logMatcherFiring(validInput(), enrolledContext());
    expect(result.ok).toBe(true);
    expect(result.record).toMatchObject({
      origin: OBSERVATION_ORIGINS.MATCHER_SYSTEM,
      schemaVersion: ANCHOR_OBSERVATION_SCHEMA_VERSION,
      handId: 'live:session-1:hand-3',
      streetKey: 'river',
      anchorId: 'anchor:nit:river:overfold:4flush',
      contributesToCalibration: true,
      status: 'active',
      firingMetrics: { confidence: 0.78 },
    });
  });

  it('builds deterministic id with the matcher idempotence shape', () => {
    const result = logMatcherFiring(validInput(), enrolledContext());
    expect(result.record.id).toBe('obs:live:session-1:hand-3:matcher:anchor:nit:river:overfold:4flush:river');
  });

  it('uses context.nowFn() for createdAt when input has none', () => {
    const result = logMatcherFiring(validInput(), enrolledContext());
    expect(result.record.createdAt).toBe('2026-05-09T05:00:00Z');
  });

  it('honors explicit input.createdAt when present', () => {
    const result = logMatcherFiring(
      validInput({ createdAt: '2026-05-09T06:30:00Z' }),
      enrolledContext(),
    );
    expect(result.record.createdAt).toBe('2026-05-09T06:30:00Z');
  });

  it('matcher-system observations carry empty ownerTags', () => {
    const result = logMatcherFiring(validInput(), enrolledContext());
    expect(result.record.ownerTags).toEqual([]);
  });

  it('passes firingMetrics.confidence through; defaults to null when absent', () => {
    const r1 = logMatcherFiring(validInput({ firingMetrics: undefined }), enrolledContext());
    expect(r1.record.firingMetrics).toEqual({ confidence: null });

    const r2 = logMatcherFiring(validInput({ firingMetrics: {} }), enrolledContext());
    expect(r2.record.firingMetrics).toEqual({ confidence: null });
  });
});

describe('logMatcherFiring — I-WR-5 enrollment gate', () => {
  it('returns ok=true with record=null when not enrolled', () => {
    const result = logMatcherFiring(validInput(), notEnrolledContext());
    expect(result).toEqual({ ok: true, record: null });
  });

  it('does not produce a record (no IDB write) when not enrolled', () => {
    const result = logMatcherFiring(validInput(), notEnrolledContext());
    expect(result.record).toBeNull();
  });
});

describe('logMatcherFiring — input validation', () => {
  it('rejects missing anchorId', () => {
    const result = logMatcherFiring(validInput({ anchorId: '' }), enrolledContext());
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/anchorId/);
  });

  it('rejects missing handId', () => {
    const result = logMatcherFiring(validInput({ handId: undefined }), enrolledContext());
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/handId/);
  });

  it('rejects invalid streetKey', () => {
    const result = logMatcherFiring(validInput({ streetKey: 'showdown' }), enrolledContext());
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/streetKey/);
  });

  it('rejects malformed enrollment state', () => {
    const result = logMatcherFiring(validInput(), { observation_enrollment_state: 'bogus' });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/observation_enrollment_state/);
  });

  it('rejects null input', () => {
    const result = logMatcherFiring(null, enrolledContext());
    expect(result.ok).toBe(false);
  });

  it('rejects null context', () => {
    const result = logMatcherFiring(validInput(), null);
    expect(result.ok).toBe(false);
  });
});

describe('logMatcherFiring — idempotence behavior', () => {
  it('two identical fires produce identical record ids (caller dispatch dedups via reducer spread-merge)', () => {
    const r1 = logMatcherFiring(validInput(), enrolledContext());
    const r2 = logMatcherFiring(validInput(), enrolledContext());
    expect(r1.record.id).toBe(r2.record.id);
  });

  it('different streets produce different ids', () => {
    const r1 = logMatcherFiring(validInput({ streetKey: 'turn' }), enrolledContext());
    const r2 = logMatcherFiring(validInput({ streetKey: 'river' }), enrolledContext());
    expect(r1.record.id).not.toBe(r2.record.id);
  });

  it('different anchors produce different ids', () => {
    const r1 = logMatcherFiring(validInput({ anchorId: 'anchor:a' }), enrolledContext());
    const r2 = logMatcherFiring(validInput({ anchorId: 'anchor:b' }), enrolledContext());
    expect(r1.record.id).not.toBe(r2.record.id);
  });
});
