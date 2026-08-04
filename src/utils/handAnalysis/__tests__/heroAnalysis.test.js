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

// FIXTURES CORRECTED 2026-07-31 (WS-317). These previously used FOUR-axis keys —
// 'flop:dry:EP:call' — and a real situation key has SEVEN axes (villain) or EIGHT (hero):
//
//     street : texture : posCategory : isAgg : isIP : facingAction : contextAction [: pfa]
//
// In a 4-axis string, index 3 happens to be an action ('call'), which is what the old
// positional destructure `[street, , , actionType]` was written to read. In a REAL key,
// index 3 is `isAgg` ('agg'/'def'). So these tests were asserting the INTENDED semantic
// against inputs that never occur in production, while production silently matched on
// aggressor-status instead. The unrepresentative fixture is precisely why the defect
// survived — the suite agreed with the author rather than with the data.
//
// The fixtures below are real 7-axis keys and assert what the code ACTUALLY does today.
// Whether that behaviour is right is WS-318's question, deliberately not settled here:
// WS-317's acceptance is bit-identical behaviour, so a semantic fix belongs in its own
// change with its own measurement.
const KEY = ({ street = 'flop', texture = 'dry', pos = 'LATE', isAgg = 'def',
  isIP = 'ip', facing = 'bet', ctx = 'vsBet' } = {}) =>
  `${street}:${texture}:${pos}:${isAgg}:${isIP}:${facing}:${ctx}`;

describe('matchHeroWeakness', () => {
  it('returns null for null/empty inputs', () => {
    expect(matchHeroWeakness(null, [])).toBeNull();
    expect(matchHeroWeakness(KEY(), null)).toBeNull();
    expect(matchHeroWeakness(KEY(), [])).toBeNull();
  });

  it('returns null for a malformed key rather than throwing', () => {
    // The pre-WS-317 code never threw; a display helper must not crash its callers.
    expect(matchHeroWeakness('flop:dry:EP:call', [
      { label: 'x', situationKeys: [KEY()], sampleSize: 1 },
    ])).toBeNull();
  });

  it('matches on street + role + action, across differing texture/position', () => {
    // WS-318 rule (c). Texture and position are deliberately NOT match axes — a leak is
    // about the spot's role and the action, not the exact board or seat.
    const weaknesses = [{
      label: 'Calling station on flop',
      situationKeys: [KEY({ texture: 'wet', pos: 'MIDDLE' }), KEY({ pos: 'EARLY' })],
      sampleSize: 5,
    }];
    const result = matchHeroWeakness(KEY({ texture: 'unknown', pos: 'EARLY' }), weaknesses);
    expect(result).not.toBeNull();
    expect(result.weakness.label).toBe('Calling station on flop');
    expect(result.matchCount).toBe(5);
    expect(result.message).toContain('flop');
  });

  it('WS-318 THE NEAR-MISS: same street and role, DIFFERENT action → no match', () => {
    // This single case is the whole difference between the rules the ticket weighed.
    // Under the old behaviour (street + isAgg) a weakness recorded on a river CHECK matched
    // a river BET. Under rule (c) it must not: the leak is about what hero DID.
    const weaknesses = [{
      label: 'Gives up on the river',
      situationKeys: [KEY({ street: 'river', isAgg: 'agg', facing: 'none', ctx: 'check' })],
      sampleSize: 4,
    }];
    const riverBet = KEY({ street: 'river', isAgg: 'agg', facing: 'none', ctx: 'bet' });
    expect(matchHeroWeakness(riverBet, weaknesses)).toBeNull();

    // ...and the SAME action on the same street with the same role still matches, so the
    // rule has narrowed the match rather than broken it.
    const riverCheck = KEY({ street: 'river', isAgg: 'agg', facing: 'none', ctx: 'check' });
    expect(matchHeroWeakness(riverCheck, weaknesses)).not.toBeNull();
  });

  it('WS-318: the user-visible message names the role and action, not raw axis values', () => {
    // Was: "in flop agg spots" — not a phrase a poker player uses, and it was on screen.
    const weaknesses = [{
      label: 'Over-cbets',
      situationKeys: [KEY({ street: 'flop', isAgg: 'agg', facing: 'none', ctx: 'bet' })],
      sampleSize: 7,
    }];
    const result = matchHeroWeakness(
      KEY({ street: 'flop', isAgg: 'agg', facing: 'none', ctx: 'bet' }), weaknesses,
    );
    expect(result).not.toBeNull();
    expect(result.message).toContain('as the aggressor on the flop, betting');
    expect(result.message).not.toContain(' agg spots');
  });

  it('returns null when the street differs', () => {
    const weaknesses = [{
      label: 'River bluff',
      situationKeys: [KEY({ street: 'river', isAgg: 'agg', facing: 'check', ctx: 'bet' })],
      sampleSize: 3,
    }];
    expect(matchHeroWeakness(KEY(), weaknesses)).toBeNull();
  });

  it('returns null when aggressor-status differs on the same street', () => {
    const weaknesses = [{
      label: 'Aggressor leak',
      situationKeys: [KEY({ isAgg: 'agg' })],
      sampleSize: 3,
    }];
    expect(matchHeroWeakness(KEY({ isAgg: 'def' }), weaknesses)).toBeNull();
  });

  it('does NOT match when the action differs — the WS-318 assertion, now flipped', () => {
    // WS-317 wrote this to pin the old behaviour and said explicitly: "If WS-318 moves the
    // semantic to contextAction, THIS is the assertion that must flip." Founder chose rule
    // (c) — street + isAgg + contextAction — on 2026-08-03, so it has flipped.
    //
    // Same street, same isAgg, DIFFERENT contextAction. Matched before; must not now.
    const weaknesses = [{
      label: 'Different action, same role',
      situationKeys: [KEY({ ctx: 'vsRaise', facing: 'raise' })],
      sampleSize: 7,
    }];
    expect(matchHeroWeakness(KEY({ ctx: 'vsBet', facing: 'bet' }), weaknesses)).toBeNull();
  });

  it('skips weaknesses with no situationKeys', () => {
    const weaknesses = [
      { label: 'No keys', situationKeys: [], sampleSize: 1 },
      { label: 'Has keys', situationKeys: [KEY({ street: 'turn', texture: 'wet' })], sampleSize: 2 },
    ];
    const result = matchHeroWeakness(KEY({ street: 'turn' }), weaknesses);
    expect(result.weakness.label).toBe('Has keys');
  });

  it('returns first matching weakness (priority order)', () => {
    const weaknesses = [
      { label: 'First', situationKeys: [KEY()], sampleSize: 4 },
      { label: 'Second', situationKeys: [KEY({ texture: 'wet' })], sampleSize: 2 },
    ];
    const result = matchHeroWeakness(KEY({ texture: 'unknown' }), weaknesses);
    expect(result.weakness.label).toBe('First');
  });
});
