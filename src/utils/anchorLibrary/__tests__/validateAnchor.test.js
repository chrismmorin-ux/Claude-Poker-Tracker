/**
 * validateAnchor.test.js — Validator unit tests
 *
 * Covers:
 *   - parseSchemaVersion (compound semver parsing)
 *   - validateAnchor (anchor-specific fields + invariants I-EAL-2, I-EAL-5)
 *   - validateAnchorObservation (§3.1 + I-EAL-8 280-char cap)
 *   - validatePerceptionPrimitive (§3.3 + I-EAL-9 dependent count)
 */

import { describe, it, expect } from 'vitest';

import {
  validateAnchor,
  validateAnchorObservation,
  validatePerceptionPrimitive,
  parseSchemaVersion,
  ANCHOR_SCHEMA_VERSION,
  ANCHOR_EXTENSION_VERSION,
  SUPPORTED_BASE_VERSIONS,
} from '../validateAnchor';

// ───────────────────────────────────────────────────────────────────────────
// Fixtures — valid minimal records to clone for negative tests
// ───────────────────────────────────────────────────────────────────────────

const validAnchor = () => ({
  schemaVersion: ANCHOR_SCHEMA_VERSION,
  archetypeName: 'Nit Over-Fold to River Overbet on 4-Flush Scare',
  polarity: 'overfold',
  tier: 2,
  lineSequence: [
    { street: 'flop' },
    { street: 'turn' },
    { street: 'river' },
  ],
  perceptionPrimitiveIds: ['PP-01'],
  gtoBaseline: {
    method: 'MDF',
    referenceRate: 0.52,
    referenceEv: 0.04,
    notes: 'MDF at 1.2× pot ≈ 54.5%',
  },
  evDecomposition: {
    statAttributable: 0.35,
    perceptionAttributable: 0.65,
  },
  retirementCondition: {
    method: 'credible-interval-overlap',
    params: { level: 0.95 },
  },
  origin: {
    source: 'ai-authored',
    authoredAt: '2026-04-24T12:00:00Z',
    authoredBy: 'session-1',
  },
});

const validObservation = () => ({
  id: 'obs:hand-42:0',
  schemaVersion: 'anchor-obs-v1.0',
  createdAt: '2026-04-24T14:23:00Z',
  handId: 'hand-42',
  streetKey: 'river',
  note: 'Villain tanked then folded — fits the pattern.',
  ownerTags: ['villain-overfold'],
  status: 'open',
  origin: 'owner-captured',
  contributesToCalibration: true,
});

const validPrimitive = () => ({
  id: 'PP-01',
  name: 'Nit re-weights aggressively on scare cards',
  description: 'Nits over-fold on flush- or straight-completing rivers due to perceptual range collapse.',
  appliesToStyles: ['Nit', 'TAG'],
  cognitiveStep: 'range-reweighting',
  validityScore: {
    pointEstimate: 0.78,
    credibleInterval: { lower: 0.62, upper: 0.91, level: 0.95 },
    dependentAnchorCount: 1,
  },
});

// ───────────────────────────────────────────────────────────────────────────
// parseSchemaVersion
// ───────────────────────────────────────────────────────────────────────────

describe('parseSchemaVersion', () => {
  it('parses a valid compound semver', () => {
    expect(parseSchemaVersion('1.1-anchor-v1.0')).toEqual({
      baseVersion: '1.1',
      extensionVersion: '1.0',
    });
  });

  it('parses future bump combinations', () => {
    expect(parseSchemaVersion('1.2-anchor-v1.1')).toEqual({
      baseVersion: '1.2',
      extensionVersion: '1.1',
    });
  });

  it('returns null on malformed input', () => {
    expect(parseSchemaVersion('')).toBeNull();
    expect(parseSchemaVersion('1.1')).toBeNull(); // missing -anchor-v
    expect(parseSchemaVersion('anchor-v1.0')).toBeNull(); // missing base
    expect(parseSchemaVersion('1.1-anchor-1.0')).toBeNull(); // missing v prefix
    expect(parseSchemaVersion('1.1-assumption-v1.0')).toBeNull(); // wrong middle token
    expect(parseSchemaVersion(null)).toBeNull();
    expect(parseSchemaVersion(undefined)).toBeNull();
    expect(parseSchemaVersion(42)).toBeNull();
  });

  it('exports version constants matching the semver', () => {
    const parsed = parseSchemaVersion(ANCHOR_SCHEMA_VERSION);
    expect(parsed).not.toBeNull();
    expect(parsed.extensionVersion).toBe(ANCHOR_EXTENSION_VERSION);
    expect(SUPPORTED_BASE_VERSIONS).toContain(parsed.baseVersion);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// validateAnchor — happy path
// ───────────────────────────────────────────────────────────────────────────

describe('validateAnchor — happy path', () => {
  it('accepts a valid minimal anchor', () => {
    const result = validateAnchor(validAnchor());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts all valid polarities', () => {
    for (const polarity of ['overfold', 'overbluff', 'overcall', 'over-raise', 'under-defend']) {
      const anchor = { ...validAnchor(), polarity };
      expect(validateAnchor(anchor).ok).toBe(true);
    }
  });

  it('accepts all valid GTO methods', () => {
    for (const method of ['MDF', 'pot-odds-equilibrium', 'hand-down-equity', 'range-balance']) {
      const anchor = {
        ...validAnchor(),
        gtoBaseline: { method, referenceRate: 0.5, referenceEv: 0.0 },
      };
      expect(validateAnchor(anchor).ok).toBe(true);
    }
  });

  it('accepts optional origin.sourceObservationIds', () => {
    const anchor = validAnchor();
    anchor.origin.sourceObservationIds = ['obs:1', 'obs:2'];
    expect(validateAnchor(anchor).ok).toBe(true);
  });

  it('accepts tiers 0, 1, 2', () => {
    for (const tier of [0, 1, 2]) {
      const anchor = { ...validAnchor(), tier };
      expect(validateAnchor(anchor).ok).toBe(true);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// validateAnchor — schemaVersion failures
// ───────────────────────────────────────────────────────────────────────────

describe('validateAnchor — schemaVersion', () => {
  it('rejects malformed compound semver', () => {
    const anchor = { ...validAnchor(), schemaVersion: '1.1' };
    const result = validateAnchor(anchor);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('schemaVersion'))).toBe(true);
  });

  it('rejects unsupported base version', () => {
    const anchor = { ...validAnchor(), schemaVersion: '2.0-anchor-v1.0' };
    const result = validateAnchor(anchor);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('baseVersion'))).toBe(true);
  });

  it('rejects future extension version', () => {
    const anchor = { ...validAnchor(), schemaVersion: '1.1-anchor-v99.0' };
    const result = validateAnchor(anchor);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('extensionVersion'))).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// validateAnchor — field-level failures
// ───────────────────────────────────────────────────────────────────────────

describe('validateAnchor — required fields', () => {
  it('rejects non-object input', () => {
    expect(validateAnchor(null).ok).toBe(false);
    expect(validateAnchor(undefined).ok).toBe(false);
    expect(validateAnchor('string').ok).toBe(false);
    expect(validateAnchor(42).ok).toBe(false);
    expect(validateAnchor([]).ok).toBe(false);
  });

  it('rejects missing archetypeName', () => {
    const anchor = validAnchor();
    delete anchor.archetypeName;
    expect(validateAnchor(anchor).ok).toBe(false);
  });

  it('rejects short archetypeName', () => {
    const anchor = { ...validAnchor(), archetypeName: 'ab' };
    expect(validateAnchor(anchor).ok).toBe(false);
  });

  it('rejects invalid polarity', () => {
    const anchor = { ...validAnchor(), polarity: 'under-call' };
    expect(validateAnchor(anchor).ok).toBe(false);
  });

  it('rejects invalid tier', () => {
    const anchor = { ...validAnchor(), tier: 3 };
    expect(validateAnchor(anchor).ok).toBe(false);
  });

  it('rejects empty lineSequence', () => {
    const anchor = { ...validAnchor(), lineSequence: [] };
    expect(validateAnchor(anchor).ok).toBe(false);
  });

  it('rejects > 3 lineSequence steps', () => {
    const anchor = {
      ...validAnchor(),
      lineSequence: [
        { street: 'preflop' },
        { street: 'flop' },
        { street: 'turn' },
        { street: 'river' },
      ],
    };
    expect(validateAnchor(anchor).ok).toBe(false);
  });

  it('rejects invalid street in lineSequence', () => {
    const anchor = {
      ...validAnchor(),
      lineSequence: [{ street: 'showdown' }],
    };
    expect(validateAnchor(anchor).ok).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// validateAnchor — I-EAL invariants
// ───────────────────────────────────────────────────────────────────────────

describe('validateAnchor — I-EAL invariants', () => {
  it('I-EAL-2: perceptionPrimitiveIds must have ≥ 1 entry', () => {
    const anchor = { ...validAnchor(), perceptionPrimitiveIds: [] };
    const result = validateAnchor(anchor);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('I-EAL-2'))).toBe(true);
  });

  it('I-EAL-5: evDecomposition must sum to 1.0 (±0.01)', () => {
    const bad = {
      ...validAnchor(),
      evDecomposition: { statAttributable: 0.5, perceptionAttributable: 0.3 }, // sum 0.8
    };
    const result = validateAnchor(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('sum'))).toBe(true);
  });

  it('I-EAL-5: accepts sum within tolerance', () => {
    // 0.349 + 0.651 = 1.000 exact
    const ok = {
      ...validAnchor(),
      evDecomposition: { statAttributable: 0.349, perceptionAttributable: 0.651 },
    };
    expect(validateAnchor(ok).ok).toBe(true);

    // 0.35 + 0.65 = 1.00 exact
    const ok2 = {
      ...validAnchor(),
      evDecomposition: { statAttributable: 0.35, perceptionAttributable: 0.65 },
    };
    expect(validateAnchor(ok2).ok).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// validateAnchor — gtoBaseline
// ───────────────────────────────────────────────────────────────────────────

describe('validateAnchor — gtoBaseline', () => {
  it('rejects out-of-range referenceRate', () => {
    const anchor = {
      ...validAnchor(),
      gtoBaseline: { method: 'MDF', referenceRate: 1.5, referenceEv: 0 },
    };
    expect(validateAnchor(anchor).ok).toBe(false);
  });

  it('rejects non-finite referenceEv', () => {
    const anchor = {
      ...validAnchor(),
      gtoBaseline: { method: 'MDF', referenceRate: 0.5, referenceEv: NaN },
    };
    expect(validateAnchor(anchor).ok).toBe(false);
  });

  it('rejects invalid method', () => {
    const anchor = {
      ...validAnchor(),
      gtoBaseline: { method: 'exploit-based', referenceRate: 0.5, referenceEv: 0 },
    };
    expect(validateAnchor(anchor).ok).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// validateAnchorObservation
// ───────────────────────────────────────────────────────────────────────────

describe('validateAnchorObservation', () => {
  it('accepts a valid owner-captured observation', () => {
    const result = validateAnchorObservation(validObservation());
    expect(result.ok).toBe(true);
  });

  it('accepts a matcher-system observation with null note', () => {
    const obs = {
      ...validObservation(),
      origin: 'matcher-system',
      note: null,
      ownerTags: [],
    };
    expect(validateAnchorObservation(obs).ok).toBe(true);
  });

  it('I-EAL-8: rejects note > 280 chars', () => {
    const obs = { ...validObservation(), note: 'x'.repeat(281) };
    const result = validateAnchorObservation(obs);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('I-EAL-8'))).toBe(true);
  });

  it('accepts note at exactly 280 chars', () => {
    const obs = { ...validObservation(), note: 'x'.repeat(280) };
    expect(validateAnchorObservation(obs).ok).toBe(true);
  });

  it('rejects invalid origin', () => {
    const obs = { ...validObservation(), origin: 'admin-import' };
    expect(validateAnchorObservation(obs).ok).toBe(false);
  });

  it('rejects invalid schemaVersion', () => {
    const obs = { ...validObservation(), schemaVersion: 'anchor-obs-v2.0' };
    expect(validateAnchorObservation(obs).ok).toBe(false);
  });

  it('rejects non-boolean contributesToCalibration', () => {
    const obs = { ...validObservation(), contributesToCalibration: 1 };
    expect(validateAnchorObservation(obs).ok).toBe(false);
  });

  it('rejects invalid streetKey', () => {
    const obs = { ...validObservation(), streetKey: 'showdown' };
    expect(validateAnchorObservation(obs).ok).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// validatePerceptionPrimitive
// ───────────────────────────────────────────────────────────────────────────

describe('validatePerceptionPrimitive', () => {
  it('accepts a valid primitive', () => {
    const result = validatePerceptionPrimitive(validPrimitive());
    expect(result.ok).toBe(true);
  });

  it('rejects id not matching PP-NN format', () => {
    const prim = { ...validPrimitive(), id: 'primitive-01' };
    expect(validatePerceptionPrimitive(prim).ok).toBe(false);
  });

  it('accepts id with 3+ digits', () => {
    const prim = { ...validPrimitive(), id: 'PP-100' };
    expect(validatePerceptionPrimitive(prim).ok).toBe(true);
  });

  it('rejects inverted credible interval', () => {
    const prim = {
      ...validPrimitive(),
      validityScore: {
        pointEstimate: 0.5,
        credibleInterval: { lower: 0.9, upper: 0.3, level: 0.95 },
        dependentAnchorCount: 0,
      },
    };
    expect(validatePerceptionPrimitive(prim).ok).toBe(false);
  });

  it('rejects negative dependentAnchorCount', () => {
    const prim = {
      ...validPrimitive(),
      validityScore: {
        pointEstimate: 0.5,
        credibleInterval: { lower: 0.3, upper: 0.7, level: 0.95 },
        dependentAnchorCount: -1,
      },
    };
    expect(validatePerceptionPrimitive(prim).ok).toBe(false);
  });

  it('accepts zero dependentAnchorCount (unreferenced primitive)', () => {
    const prim = {
      ...validPrimitive(),
      validityScore: {
        pointEstimate: 0.5,
        credibleInterval: { lower: 0.3, upper: 0.7, level: 0.95 },
        dependentAnchorCount: 0,
      },
    };
    expect(validatePerceptionPrimitive(prim).ok).toBe(true);
  });

  it('rejects short description', () => {
    const prim = { ...validPrimitive(), description: 'too short' };
    expect(validatePerceptionPrimitive(prim).ok).toBe(false);
  });
});
