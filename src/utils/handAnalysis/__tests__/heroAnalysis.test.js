import { describe, it, expect } from 'vitest';
import { assessHeroEV, suggestOptimalPlay, matchHeroWeakness } from '../heroAnalysis';
import { PRIMITIVE_ACTIONS } from '../../../constants/primitiveActions';

// ─── assessHeroEV ───────────────────────────────────────────────────────────

describe('assessHeroEV', () => {
  it('returns null for null/undefined equity', () => {
    expect(assessHeroEV(null, PRIMITIVE_ACTIONS.CALL, 100, 50)).toBeNull();
    expect(assessHeroEV(undefined, PRIMITIVE_ACTIONS.CALL, 100, 50)).toBeNull();
  });

  // CALL scenarios
  describe('CALL', () => {
    it('returns null if betSize is 0', () => {
      expect(assessHeroEV(0.5, PRIMITIVE_ACTIONS.CALL, 100, 0)).toBeNull();
    });

    it('+EV comfortable call when equity >> needed', () => {
      // Need 50/(100+50) = 33%, have 60% → comfortable
      const result = assessHeroEV(0.60, PRIMITIVE_ACTIONS.CALL, 100, 50);
      expect(result.verdict).toBe('+EV');
      expect(result.reason).toContain('Comfortable');
      expect(result.equityNeeded).toBeCloseTo(1 / 3, 2);
      expect(result.actualEquity).toBe(0.60);
    });

    it('+EV close call when equity just above needed', () => {
      // Need 33%, have 37% → close but profitable
      const result = assessHeroEV(0.37, PRIMITIVE_ACTIONS.CALL, 100, 50);
      expect(result.verdict).toBe('+EV');
      expect(result.reason).toContain('Close');
    });

    it('-EV call when equity below needed', () => {
      // Need 33%, have 25%
      const result = assessHeroEV(0.25, PRIMITIVE_ACTIONS.CALL, 100, 50);
      expect(result.verdict).toBe('-EV');
      expect(result.reason).toContain('insufficient');
    });
  });

  // BET/RAISE scenarios
  describe('BET/RAISE', () => {
    it('+EV when equity > 50%', () => {
      const result = assessHeroEV(0.65, PRIMITIVE_ACTIONS.BET, 100, 50);
      expect(result.verdict).toBe('+EV');
      expect(result.reason).toContain('value');
    });

    it('neutral semi-bluff when equity 30-50%', () => {
      const result = assessHeroEV(0.35, PRIMITIVE_ACTIONS.RAISE, 100, 50);
      expect(result.verdict).toBe('neutral');
      expect(result.reason).toContain('Semi-bluff');
    });

    it('-EV pure bluff when equity < 30%', () => {
      const result = assessHeroEV(0.15, PRIMITIVE_ACTIONS.BET, 100, 50);
      expect(result.verdict).toBe('-EV');
      expect(result.reason).toContain('Pure bluff');
    });
  });

  // CHECK scenarios
  describe('CHECK', () => {
    it('neutral with high equity (missed value)', () => {
      const result = assessHeroEV(0.70, PRIMITIVE_ACTIONS.CHECK, 100, 0);
      expect(result.verdict).toBe('neutral');
      expect(result.reason).toContain('betting for value');
    });

    it('+EV correct check with low equity', () => {
      const result = assessHeroEV(0.20, PRIMITIVE_ACTIONS.CHECK, 100, 0);
      expect(result.verdict).toBe('+EV');
      expect(result.reason).toContain('Correct check');
    });

    it('neutral for medium equity', () => {
      const result = assessHeroEV(0.50, PRIMITIVE_ACTIONS.CHECK, 100, 0);
      expect(result.verdict).toBe('neutral');
    });
  });

  // FOLD scenarios
  describe('FOLD', () => {
    it('-EV fold when hero had enough equity to call', () => {
      // Need 33%, had 50%
      const result = assessHeroEV(0.50, PRIMITIVE_ACTIONS.FOLD, 100, 50);
      expect(result.verdict).toBe('-EV');
      expect(result.reason).toContain('Folded with');
    });

    it('+EV correct fold when equity below needed', () => {
      // Need 33%, had 20%
      const result = assessHeroEV(0.20, PRIMITIVE_ACTIONS.FOLD, 100, 50);
      expect(result.verdict).toBe('+EV');
      expect(result.reason).toContain('Correct fold');
    });

    it('returns null for fold with no pot/bet context', () => {
      expect(assessHeroEV(0.50, PRIMITIVE_ACTIONS.FOLD, 0, 0)).toBeNull();
    });
  });

  it('returns null for unknown action', () => {
    expect(assessHeroEV(0.50, 'unknown_action', 100, 50)).toBeNull();
  });
});

// ─── suggestOptimalPlay ─────────────────────────────────────────────────────

describe('suggestOptimalPlay', () => {
  it('returns null for null/undefined equity', () => {
    expect(suggestOptimalPlay(null, null, null, true, 100)).toBeNull();
    expect(suggestOptimalPlay(undefined, null, null, true, 100)).toBeNull();
  });

  it('suggests value bet when equity high + villain capped', () => {
    const seg = { buckets: { nuts: { pct: 5 }, strong: { pct: 8 }, air: { pct: 30 } } };
    const result = suggestOptimalPlay(0.70, seg, null, true, 100);
    expect(result.suggestedAction).toBe('Bet for value');
    expect(result.reason).toContain('capped');
  });

  it('suggests betting on dry board with good equity', () => {
    const bt = { texture: 'dry' };
    const result = suggestOptimalPlay(0.55, null, bt, true, 100);
    expect(result.suggestedAction).toBe('Consider betting');
  });

  it('suggests folding with very low equity', () => {
    const result = suggestOptimalPlay(0.15, null, null, false, 100);
    expect(result.suggestedAction).toBe('Consider folding');
  });

  it('suggests check on wet board with medium equity', () => {
    const bt = { texture: 'wet' };
    const result = suggestOptimalPlay(0.40, null, bt, false, 100);
    expect(result.suggestedAction).toBe('Check is reasonable');
  });

  it('warns against bluffing into strong range', () => {
    const seg = { buckets: { nuts: { pct: 20 }, strong: { pct: 15 }, air: { pct: 10 } } };
    const result = suggestOptimalPlay(0.25, seg, null, false, 100);
    expect(result.suggestedAction).toBe('Avoid bluffing');
  });

  it('returns null when no rule matches', () => {
    // 26% equity, no specific board, no segmentation that triggers rules
    const result = suggestOptimalPlay(0.26, null, null, true, 100);
    expect(result).toBeNull();
  });
});

// ─── matchHeroWeakness ──────────────────────────────────────────────────────

describe('matchHeroWeakness', () => {
  it('returns null for null/empty inputs', () => {
    expect(matchHeroWeakness(null, [])).toBeNull();
    expect(matchHeroWeakness('flop:dry:EP:call', null)).toBeNull();
    expect(matchHeroWeakness('flop:dry:EP:call', [])).toBeNull();
  });

  it('matches weakness by street + action type', () => {
    const weaknesses = [{
      label: 'Calling station on flop',
      situationKeys: ['flop:wet:MP:call', 'flop:dry:EP:call'],
      sampleSize: 5,
    }];
    const result = matchHeroWeakness('flop:unknown:EP:call', weaknesses);
    expect(result).not.toBeNull();
    expect(result.weakness.label).toBe('Calling station on flop');
    expect(result.matchCount).toBe(5);
    expect(result.message).toContain('flop');
  });

  it('returns null when no weakness matches', () => {
    const weaknesses = [{
      label: 'River bluff',
      situationKeys: ['river:dry:LP:bet'],
      sampleSize: 3,
    }];
    const result = matchHeroWeakness('flop:dry:EP:call', weaknesses);
    expect(result).toBeNull();
  });

  it('skips weaknesses with no situationKeys', () => {
    const weaknesses = [
      { label: 'No keys', situationKeys: [], sampleSize: 1 },
      { label: 'Has keys', situationKeys: ['turn:wet:LP:raise'], sampleSize: 2 },
    ];
    const result = matchHeroWeakness('turn:dry:LP:raise', weaknesses);
    expect(result.weakness.label).toBe('Has keys');
  });

  it('returns first matching weakness (priority order)', () => {
    const weaknesses = [
      { label: 'First', situationKeys: ['flop:dry:EP:bet'], sampleSize: 4 },
      { label: 'Second', situationKeys: ['flop:wet:EP:bet'], sampleSize: 2 },
    ];
    const result = matchHeroWeakness('flop:unknown:EP:bet', weaknesses);
    expect(result.weakness.label).toBe('First');
  });
});
