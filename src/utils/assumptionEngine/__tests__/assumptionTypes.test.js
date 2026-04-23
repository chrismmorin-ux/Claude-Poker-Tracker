import { describe, it, expect } from 'vitest';
import {
  SCHEMA_VERSION,
  SCHEMA_VERSION_HISTORY,
  PREDICATE_KEYS,
  DEVIATION_TYPES,
  EMOTIONAL_TRIGGER_TYPES,
  ASSUMPTION_STATUS,
  STREETS,
  POSITIONS,
  TEXTURES,
  HERO_LINE_TYPES,
  VILLAIN_STYLES,
  SURFACES,
  OPERATOR_TARGETS,
  CLAIM_OPERATORS,
  PRIOR_TYPES,
  VILLAIN_SIDE_THRESHOLDS,
  HERO_SIDE_THRESHOLDS,
  DEFAULT_DECAY_HALFLIFE_DAYS,
  STABILITY_SUBSCORE_MIN_SAMPLE_SIZE,
  STABILITY_MIN_NON_NULL_SUBSCORES,
  DIAL_DEFAULTS,
  CALIBRATION_LADDER,
} from '../assumptionTypes';

describe('SCHEMA_VERSION', () => {
  it('is v1.1 matching current schema', () => {
    expect(SCHEMA_VERSION).toBe('1.1');
  });

  it('is present in SCHEMA_VERSION_HISTORY', () => {
    expect(SCHEMA_VERSION_HISTORY).toContain(SCHEMA_VERSION);
  });

  it('SCHEMA_VERSION_HISTORY is frozen', () => {
    expect(() => {
      SCHEMA_VERSION_HISTORY.push('9.9');
    }).toThrow();
  });
});

describe('PREDICATE_KEYS', () => {
  it('includes schema v1.1 predicates', () => {
    const required = [
      'foldToCbet', 'foldToTurnBarrel', 'foldToRiverBet',
      'checkRaiseFrequency', 'checkRaiseBluffFrequency',
      'cbetFrequency', 'threeBetFrequency', 'threeBetBluffFrequency', 'fourBetFrequency',
      'donkFrequency', 'thinValueFrequency', 'slowplayFrequency',
      'overbetFrequency', 'sizingVariance', 'leadRangePresence',
      'wtsd', 'foldVsOverbet', 'foldOnScareCard',
    ];
    for (const key of required) {
      expect(PREDICATE_KEYS).toContain(key);
    }
  });

  it('is frozen', () => {
    expect(() => {
      PREDICATE_KEYS.push('notARealPredicate');
    }).toThrow();
  });

  it('contains no duplicates', () => {
    expect(new Set(PREDICATE_KEYS).size).toBe(PREDICATE_KEYS.length);
  });
});

describe('DEVIATION_TYPES', () => {
  it('includes schema v1.1 deviation types', () => {
    expect(DEVIATION_TYPES).toEqual(expect.arrayContaining([
      'bluff-prune', 'value-expand', 'sizing-shift', 'range-bet', 'spot-skip', 'line-change',
    ]));
  });

  it('is frozen', () => {
    expect(() => DEVIATION_TYPES.push('fake')).toThrow();
  });
});

describe('EMOTIONAL_TRIGGER_TYPES', () => {
  it('includes the four schema §1.9 types', () => {
    expect(EMOTIONAL_TRIGGER_TYPES).toEqual(expect.arrayContaining([
      'fear-exploit', 'greed-exploit', 'fear-blind', 'greed-blind',
    ]));
  });

  it('is frozen', () => {
    expect(() => EMOTIONAL_TRIGGER_TYPES.push('fake')).toThrow();
  });
});

describe('ASSUMPTION_STATUS', () => {
  it('includes lifecycle states', () => {
    expect(ASSUMPTION_STATUS).toEqual(expect.arrayContaining([
      'candidate', 'active', 'expiring', 'retired',
    ]));
  });

  it('is frozen', () => {
    expect(() => ASSUMPTION_STATUS.push('fake')).toThrow();
  });
});

describe('scope enums', () => {
  it('STREETS is frozen with four values', () => {
    expect(STREETS).toEqual(['preflop', 'flop', 'turn', 'river']);
    expect(() => STREETS.push('fake')).toThrow();
  });

  it('POSITIONS includes IP/OOP/any', () => {
    expect(POSITIONS).toEqual(expect.arrayContaining(['IP', 'OOP', 'any']));
  });

  it('TEXTURES includes board-texture categories', () => {
    expect(TEXTURES).toEqual(expect.arrayContaining([
      'dry', 'wet', 'paired', 'monotone', 'flush-complete', 'straight-complete', 'any',
    ]));
  });

  it('HERO_LINE_TYPES includes barrel + non-barrel lines', () => {
    expect(HERO_LINE_TYPES).toEqual(expect.arrayContaining([
      'single-barrel', 'double-barrel', 'triple-barrel', 'donk', 'probe', 'check-raise', 'any',
    ]));
  });

  it('VILLAIN_STYLES includes the five categories', () => {
    expect(VILLAIN_STYLES).toEqual(expect.arrayContaining([
      'Fish', 'Nit', 'LAG', 'TAG', 'Unknown',
    ]));
  });
});

describe('SURFACES + OPERATOR_TARGETS + CLAIM_OPERATORS + PRIOR_TYPES', () => {
  it('SURFACES is [drill, live]', () => {
    expect(SURFACES).toEqual(['drill', 'live']);
  });

  it('OPERATOR_TARGETS is [villain, hero]', () => {
    expect(OPERATOR_TARGETS).toEqual(['villain', 'hero']);
  });

  it('CLAIM_OPERATORS matches schema §1.1', () => {
    expect(CLAIM_OPERATORS).toEqual(['<=', '>=', '==', 'in_range']);
  });

  it('PRIOR_TYPES matches schema §1.2', () => {
    expect(PRIOR_TYPES).toEqual(['population', 'style']);
  });
});

describe('VILLAIN_SIDE_THRESHOLDS (schema §7.1)', () => {
  it('matches the opinionated defaults', () => {
    expect(VILLAIN_SIDE_THRESHOLDS.confidence).toBe(0.80);
    expect(VILLAIN_SIDE_THRESHOLDS.stability).toBe(0.70);
    expect(VILLAIN_SIDE_THRESHOLDS.recognizabilityDrill).toBe(0.40);
    expect(VILLAIN_SIDE_THRESHOLDS.recognizabilityLive).toBe(0.60);
    expect(VILLAIN_SIDE_THRESHOLDS.asymmetricPayoff).toBe(0.30);
    expect(VILLAIN_SIDE_THRESHOLDS.sharpe).toBe(1.0);
  });

  it('is frozen', () => {
    expect(() => {
      VILLAIN_SIDE_THRESHOLDS.confidence = 0.99;
    }).toThrow();
  });
});

describe('HERO_SIDE_THRESHOLDS (schema §7.1 + CC-6)', () => {
  it('is relaxed relative to villain-side (except sharpe)', () => {
    expect(HERO_SIDE_THRESHOLDS.confidence).toBeLessThan(VILLAIN_SIDE_THRESHOLDS.confidence);
    expect(HERO_SIDE_THRESHOLDS.stability).toBeLessThan(VILLAIN_SIDE_THRESHOLDS.stability);
    expect(HERO_SIDE_THRESHOLDS.asymmetricPayoff).toBeLessThan(VILLAIN_SIDE_THRESHOLDS.asymmetricPayoff);
    expect(HERO_SIDE_THRESHOLDS.sharpe).toBe(VILLAIN_SIDE_THRESHOLDS.sharpe);
  });

  it('has no recognizabilityLive (hero-side never renders live)', () => {
    expect(HERO_SIDE_THRESHOLDS.recognizabilityLive).toBeUndefined();
  });

  it('is frozen', () => {
    expect(() => {
      HERO_SIDE_THRESHOLDS.confidence = 0.99;
    }).toThrow();
  });
});

describe('decay half-life defaults', () => {
  it('cash is 30 days, tournament is 7', () => {
    expect(DEFAULT_DECAY_HALFLIFE_DAYS.cash).toBe(30);
    expect(DEFAULT_DECAY_HALFLIFE_DAYS.tournament).toBe(7);
  });

  it('is frozen', () => {
    expect(() => {
      DEFAULT_DECAY_HALFLIFE_DAYS.cash = 999;
    }).toThrow();
  });
});

describe('stability rules', () => {
  it('subscore min sample size is 8 (Phase 2 Stage 1)', () => {
    expect(STABILITY_SUBSCORE_MIN_SAMPLE_SIZE).toBe(8);
  });

  it('min non-null subscores is 2 (Stage 2 resolution)', () => {
    expect(STABILITY_MIN_NON_NULL_SUBSCORES).toBe(2);
  });
});

describe('DIAL_DEFAULTS', () => {
  it('matches schema §6.1', () => {
    expect(DIAL_DEFAULTS.dialFloor).toBe(0.3);
    expect(DIAL_DEFAULTS.dialCeiling).toBe(0.9);
    expect(DIAL_DEFAULTS.sigmoidSteepness).toBe(8);
  });

  it('is frozen', () => {
    expect(() => {
      DIAL_DEFAULTS.dialFloor = 0.99;
    }).toThrow();
  });
});

describe('CALIBRATION_LADDER', () => {
  it('matches calibration.md §3.3', () => {
    expect(CALIBRATION_LADDER.wellCalibratedGap).toBe(0.20);
    expect(CALIBRATION_LADDER.conservativeCeilingTrigger).toBe(0.25);
    expect(CALIBRATION_LADDER.retirementTrigger).toBe(0.35);
    expect(CALIBRATION_LADDER.retirementConsecutiveSessions).toBe(10);
  });

  it('is frozen', () => {
    expect(() => {
      CALIBRATION_LADDER.retirementTrigger = 0.99;
    }).toThrow();
  });
});
