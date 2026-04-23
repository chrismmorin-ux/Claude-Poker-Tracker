import { describe, it, expect } from 'vitest';
import {
  validateScope,
  validateEvidence,
  validateStability,
  validateRecognizability,
  validateConsequence,
  validateCounterExploit,
  validateOperator,
  validateNarrative,
  validateEmotionalTrigger,
  validateQuality,
  validateClaim,
  validateAssumption,
  validateExtensionPayload,
  needsMigration,
} from '../validator';
import { canonicalAssumption } from './fixtures';

describe('validateAssumption (canonical fixture)', () => {
  it('accepts the canonical valid v1.1 assumption', () => {
    const result = validateAssumption(canonicalAssumption());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects null / undefined / non-object', () => {
    expect(validateAssumption(null).ok).toBe(false);
    expect(validateAssumption(undefined).ok).toBe(false);
    expect(validateAssumption('string').ok).toBe(false);
    expect(validateAssumption(42).ok).toBe(false);
  });

  it('rejects assumption with wrong schemaVersion', () => {
    const a = canonicalAssumption();
    a.schemaVersion = '0.9';
    const result = validateAssumption(a);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('schemaVersion'))).toBe(true);
  });

  it('rejects assumption with missing id', () => {
    const a = canonicalAssumption();
    delete a.id;
    const result = validateAssumption(a);
    expect(result.ok).toBe(false);
  });

  it('accepts hero-side sentinel villainId', () => {
    const a = canonicalAssumption();
    a.villainId = '_hero';
    a.operator.target = 'hero';
    const result = validateAssumption(a);
    expect(result.ok).toBe(true);
  });
});

describe('validateScope', () => {
  const validScope = () => canonicalAssumption().claim.scope;

  it('accepts canonical scope', () => {
    expect(validateScope(validScope()).ok).toBe(true);
  });

  it('rejects invalid street', () => {
    const s = validScope();
    s.street = 'preturn';
    expect(validateScope(s).ok).toBe(false);
  });

  it('rejects sprRange with min > max', () => {
    const s = validScope();
    s.sprRange = [10, 5];
    expect(validateScope(s).ok).toBe(false);
  });

  it('rejects negative sprRange', () => {
    const s = validScope();
    s.sprRange = [-1, 10];
    expect(validateScope(s).ok).toBe(false);
  });

  it('accepts undefined optional fields', () => {
    const s = validScope();
    delete s.heroLineType;
    delete s.activationFrequency;
    expect(validateScope(s).ok).toBe(true);
  });

  it('rejects out-of-range villainFearRange', () => {
    const s = validScope();
    s.villainFearRange = [0.2, 1.5];
    expect(validateScope(s).ok).toBe(false);
  });

  it('rejects out-of-range activationFrequency', () => {
    const s = validScope();
    s.activationFrequency = 1.5;
    expect(validateScope(s).ok).toBe(false);
  });
});

describe('validateEvidence', () => {
  const validEvidence = () => canonicalAssumption().evidence;

  it('accepts canonical evidence', () => {
    expect(validateEvidence(validEvidence()).ok).toBe(true);
  });

  it('rejects observationCount > sampleSize', () => {
    const e = validEvidence();
    e.observationCount = e.sampleSize + 1;
    expect(validateEvidence(e).ok).toBe(false);
  });

  it('rejects non-0.95 credible level', () => {
    const e = validEvidence();
    e.credibleInterval = { lower: 0.1, upper: 0.2, level: 0.90 };
    expect(validateEvidence(e).ok).toBe(false);
  });

  it('rejects credibleInterval with lower > upper', () => {
    const e = validEvidence();
    e.credibleInterval = { lower: 0.3, upper: 0.2, level: 0.95 };
    expect(validateEvidence(e).ok).toBe(false);
  });

  it('rejects prior with bad alpha/beta', () => {
    const e = validEvidence();
    e.prior = { type: 'style', alpha: 0, beta: -1 };
    expect(validateEvidence(e).ok).toBe(false);
  });

  it('rejects unknown prior.type', () => {
    const e = validEvidence();
    e.prior = { type: 'uniform', alpha: 1, beta: 1 };
    expect(validateEvidence(e).ok).toBe(false);
  });

  it('rejects non-positive decayHalfLife', () => {
    const e = validEvidence();
    e.decayHalfLife = 0;
    expect(validateEvidence(e).ok).toBe(false);
  });
});

describe('validateStability', () => {
  it('accepts all-4-subscores canonical', () => {
    expect(validateStability(canonicalAssumption().stability).ok).toBe(true);
  });

  it('accepts null subscores (scope-constrained dimensions)', () => {
    const s = canonicalAssumption().stability;
    s.acrossTextures = null;
    s.nonNullSubscoreCount = 3;
    expect(validateStability(s).ok).toBe(true);
  });

  it('rejects subscore out of [0, 1]', () => {
    const s = canonicalAssumption().stability;
    s.acrossSessions = 1.5;
    expect(validateStability(s).ok).toBe(false);
  });

  it('rejects invalid nonNullSubscoreCount', () => {
    const s = canonicalAssumption().stability;
    s.nonNullSubscoreCount = 5;
    expect(validateStability(s).ok).toBe(false);
  });

  it('accepts null compositeScore', () => {
    const s = canonicalAssumption().stability;
    s.compositeScore = null;
    expect(validateStability(s).ok).toBe(true);
  });
});

describe('validateRecognizability', () => {
  it('accepts canonical', () => {
    expect(validateRecognizability(canonicalAssumption().recognizability).ok).toBe(true);
  });

  it('rejects score > 1', () => {
    const r = canonicalAssumption().recognizability;
    r.score = 1.1;
    expect(validateRecognizability(r).ok).toBe(false);
  });

  it('rejects unknown cognitiveLoad', () => {
    const r = canonicalAssumption().recognizability;
    r.heroCognitiveLoad = 'extreme';
    expect(validateRecognizability(r).ok).toBe(false);
  });
});

describe('validateConsequence', () => {
  it('accepts canonical', () => {
    expect(validateConsequence(canonicalAssumption().consequence).ok).toBe(true);
  });

  it('rejects old v1.0 unit "bb/100"', () => {
    const c = canonicalAssumption().consequence;
    c.expectedDividend.unit = 'bb/100';
    expect(validateConsequence(c).ok).toBe(false);
  });

  it('rejects negative sd', () => {
    const c = canonicalAssumption().consequence;
    c.expectedDividend.sd = -0.1;
    expect(validateConsequence(c).ok).toBe(false);
  });

  it('rejects missing sharpe (v1.1 new field)', () => {
    const c = canonicalAssumption().consequence;
    delete c.expectedDividend.sharpe;
    expect(validateConsequence(c).ok).toBe(false);
  });

  it('rejects unknown deviationType', () => {
    const c = canonicalAssumption().consequence;
    c.deviationType = 'range-prune-and-bluff-through-the-night';
    expect(validateConsequence(c).ok).toBe(false);
  });
});

describe('validateCounterExploit', () => {
  it('accepts canonical', () => {
    expect(validateCounterExploit(canonicalAssumption().counterExploit).ok).toBe(true);
  });

  it('rejects missing resistanceConfidence (v1.1 new field)', () => {
    const ce = canonicalAssumption().counterExploit;
    delete ce.resistanceConfidence;
    expect(validateCounterExploit(ce).ok).toBe(false);
  });

  it('rejects resistanceSources missing observationCount', () => {
    const ce = canonicalAssumption().counterExploit;
    delete ce.resistanceSources[0].observationCount;
    expect(validateCounterExploit(ce).ok).toBe(false);
  });

  it('rejects negative adjustmentCost', () => {
    const ce = canonicalAssumption().counterExploit;
    ce.adjustmentCost = -0.1;
    expect(validateCounterExploit(ce).ok).toBe(false);
  });
});

describe('validateOperator', () => {
  it('accepts canonical', () => {
    expect(validateOperator(canonicalAssumption().operator).ok).toBe(true);
  });

  it('rejects dialFloor > dialCeiling', () => {
    const op = canonicalAssumption().operator;
    op.dialFloor = 0.9;
    op.dialCeiling = 0.3;
    expect(validateOperator(op).ok).toBe(false);
  });

  it('rejects missing suppresses (v1.1 new field)', () => {
    const op = canonicalAssumption().operator;
    delete op.suppresses;
    expect(validateOperator(op).ok).toBe(false);
  });

  it('rejects deltas that do not sum to 0', () => {
    const op = canonicalAssumption().operator;
    op.transform.actionDistributionDelta = { fold: 0.1, call: 0.0, raise: 0.0 };
    expect(validateOperator(op).ok).toBe(false);
  });

  it('accepts deltas that sum to 0 (with non-trivial values)', () => {
    const op = canonicalAssumption().operator;
    op.transform.actionDistributionDelta = { fold: 0.15, call: -0.12, raise: -0.03 };
    expect(validateOperator(op).ok).toBe(true);
  });

  it('rejects currentDial out of [0, 1]', () => {
    const op = canonicalAssumption().operator;
    op.currentDial = 1.5;
    expect(validateOperator(op).ok).toBe(false);
  });

  it('rejects suppresses with empty-string entry', () => {
    const op = canonicalAssumption().operator;
    op.suppresses = ['', 'valid-id'];
    expect(validateOperator(op).ok).toBe(false);
  });
});

describe('validateNarrative', () => {
  it('accepts canonical', () => {
    expect(validateNarrative(canonicalAssumption().narrative).ok).toBe(true);
  });

  it('rejects missing humanStatement', () => {
    const n = canonicalAssumption().narrative;
    n.humanStatement = '';
    expect(validateNarrative(n).ok).toBe(false);
  });
});

describe('validateEmotionalTrigger', () => {
  it('accepts undefined (optional field)', () => {
    expect(validateEmotionalTrigger(undefined).ok).toBe(true);
    expect(validateEmotionalTrigger(null).ok).toBe(true);
  });

  it('accepts valid trigger', () => {
    const t = {
      type: 'fear-exploit',
      condition: { minFearIndex: 0.5 },
      activationMultiplier: 1.3,
      citableReason: 'Villain is scared here',
    };
    expect(validateEmotionalTrigger(t).ok).toBe(true);
  });

  it('rejects unknown type', () => {
    const t = {
      type: 'chill-exploit',
      condition: {},
      activationMultiplier: 1.0,
      citableReason: 'X',
    };
    expect(validateEmotionalTrigger(t).ok).toBe(false);
  });

  it('rejects negative activationMultiplier', () => {
    const t = {
      type: 'fear-exploit',
      condition: {},
      activationMultiplier: -1,
      citableReason: 'X',
    };
    expect(validateEmotionalTrigger(t).ok).toBe(false);
  });
});

describe('validateQuality', () => {
  it('accepts canonical', () => {
    expect(validateQuality(canonicalAssumption().quality).ok).toBe(true);
  });

  it('rejects missing actionableInDrill (v1.1 required)', () => {
    const q = canonicalAssumption().quality;
    delete q.actionableInDrill;
    expect(validateQuality(q).ok).toBe(false);
  });

  it('rejects composite out of [0, 1]', () => {
    const q = canonicalAssumption().quality;
    q.composite = 1.5;
    expect(validateQuality(q).ok).toBe(false);
  });
});

describe('validateClaim', () => {
  it('accepts canonical', () => {
    expect(validateClaim(canonicalAssumption().claim).ok).toBe(true);
  });

  it('rejects unknown predicate', () => {
    const c = canonicalAssumption().claim;
    c.predicate = 'foldVsAlienInvasion';
    expect(validateClaim(c).ok).toBe(false);
  });

  it('rejects unknown operator', () => {
    const c = canonicalAssumption().claim;
    c.operator = '~=';
    expect(validateClaim(c).ok).toBe(false);
  });

  it('accepts in_range with valid [lo, hi] threshold', () => {
    const c = canonicalAssumption().claim;
    c.operator = 'in_range';
    c.threshold = [0.2, 0.5];
    expect(validateClaim(c).ok).toBe(true);
  });

  it('rejects in_range with non-array threshold', () => {
    const c = canonicalAssumption().claim;
    c.operator = 'in_range';
    c.threshold = 0.3;
    expect(validateClaim(c).ok).toBe(false);
  });
});

describe('validateExtensionPayload (boundary defense per R-10.1)', () => {
  const validPayload = () => ({
    villainId: 'v42',
    villainStyle: 'Fish',
    gameState: { street: 'river', spr: 4.5, nodeId: 'river_bet' },
    rangeWeights: new Float64Array(169),
  });

  it('accepts valid payload', () => {
    expect(validateExtensionPayload(validPayload()).ok).toBe(true);
  });

  it('accepts plain-array rangeWeights', () => {
    const p = validPayload();
    p.rangeWeights = new Array(169).fill(0);
    expect(validateExtensionPayload(p).ok).toBe(true);
  });

  it('rejects missing villainId', () => {
    const p = validPayload();
    delete p.villainId;
    expect(validateExtensionPayload(p).ok).toBe(false);
  });

  it('rejects malformed gameState.street', () => {
    const p = validPayload();
    p.gameState.street = 'postflop';
    expect(validateExtensionPayload(p).ok).toBe(false);
  });

  it('rejects negative SPR', () => {
    const p = validPayload();
    p.gameState.spr = -1;
    expect(validateExtensionPayload(p).ok).toBe(false);
  });

  it('rejects rangeWeights of wrong length', () => {
    const p = validPayload();
    p.rangeWeights = new Float64Array(42);
    expect(validateExtensionPayload(p).ok).toBe(false);
  });

  it('rejects non-Finite entries in plain-array rangeWeights', () => {
    const p = validPayload();
    p.rangeWeights = new Array(169).fill(0);
    p.rangeWeights[5] = NaN;
    expect(validateExtensionPayload(p).ok).toBe(false);
  });

  it('rejects unknown villainStyle', () => {
    const p = validPayload();
    p.villainStyle = 'Whale';
    expect(validateExtensionPayload(p).ok).toBe(false);
  });

  it('villainStyle is optional', () => {
    const p = validPayload();
    delete p.villainStyle;
    expect(validateExtensionPayload(p).ok).toBe(true);
  });
});

describe('validator never crashes on random / malformed input (fuzz)', () => {
  const fuzzInputs = [
    null, undefined, 0, -1, Infinity, NaN,
    '', 'string', [], [1, 2, 3],
    {}, { random: true }, { schemaVersion: 42 },
    { id: 'x', schemaVersion: '1.1' }, // partial
    new Float64Array(10),
    { claim: 'not-an-object' },
    { stability: null },
  ];

  it('validateAssumption returns boolean on all inputs', () => {
    for (const input of fuzzInputs) {
      const result = validateAssumption(input);
      expect(typeof result.ok).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
    }
  });

  it('validateExtensionPayload returns boolean on all inputs', () => {
    for (const input of fuzzInputs) {
      const result = validateExtensionPayload(input);
      expect(typeof result.ok).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
    }
  });

  it('all sub-validators return boolean on malformed input', () => {
    const bads = [null, undefined, 'string', 42, []];
    const validators = [
      validateScope, validateEvidence, validateStability, validateRecognizability,
      validateConsequence, validateCounterExploit, validateOperator, validateNarrative,
      validateQuality, validateClaim,
    ];
    for (const validator of validators) {
      for (const bad of bads) {
        const result = validator(bad);
        expect(typeof result.ok).toBe('boolean');
        expect(Array.isArray(result.errors)).toBe(true);
      }
    }
  });
});

describe('needsMigration', () => {
  it('returns false for current-version record', () => {
    expect(needsMigration(canonicalAssumption())).toBe(false);
  });

  it('returns true for v1.0 record', () => {
    expect(needsMigration({ schemaVersion: '1.0' })).toBe(true);
  });

  it('returns false for unknown / missing version', () => {
    expect(needsMigration({ schemaVersion: '9.9' })).toBe(false);
    expect(needsMigration({})).toBe(false);
    expect(needsMigration(null)).toBe(false);
    expect(needsMigration('string')).toBe(false);
  });
});
