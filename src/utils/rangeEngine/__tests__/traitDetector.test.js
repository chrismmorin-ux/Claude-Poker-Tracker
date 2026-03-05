import { describe, it, expect } from 'vitest';
import { detectTraits } from '../traitDetector';
import { createEmptyProfile, RANGE_POSITIONS } from '../rangeProfile';
import { rangeIndex } from '../../exploitEngine/rangeMatrix';

const makeProfile = (overrides = {}) => {
  const profile = createEmptyProfile('test-player', 'test-user');
  return { ...profile, ...overrides };
};

describe('detectTraits', () => {
  describe('trapsPreflop', () => {
    it('returns low posterior with no showdown data', () => {
      const profile = makeProfile();
      const traits = detectTraits(profile);
      expect(traits.trapsPreflop.posterior).toBeLessThan(0.3);
      expect(traits.trapsPreflop.confirmed).toBe(false);
    });

    it('detects trapping when premium is in limp line', () => {
      const profile = makeProfile({
        showdownAnchors: [
          { position: 'LATE', action: 'limp', handIndex: rangeIndex(12, 12, false) }, // AA limped!
        ],
      });
      const traits = detectTraits(profile);
      expect(traits.trapsPreflop.posterior).toBeGreaterThan(0.3);
      expect(traits.trapsPreflop.confirmed).toBe(true);
      expect(traits.trapsPreflop.observations).toBe(1);
    });

    it('detects trapping when premium is in coldCall line', () => {
      const profile = makeProfile({
        showdownAnchors: [
          { position: 'MIDDLE', action: 'coldCall', handIndex: rangeIndex(11, 11, false) }, // KK cold-called
        ],
      });
      const traits = detectTraits(profile);
      expect(traits.trapsPreflop.confirmed).toBe(true);
    });

    it('detects trapping from limp-reraise sub-action data', () => {
      const profile = makeProfile();
      profile.subActionCounts.LATE.limpRaise = 1;
      const traits = detectTraits(profile);
      expect(traits.trapsPreflop.observations).toBe(1);
      expect(traits.trapsPreflop.confirmed).toBe(true);
    });

    it('does not confirm trapping for non-premium in passive line', () => {
      const profile = makeProfile({
        showdownAnchors: [
          { position: 'LATE', action: 'limp', handIndex: rangeIndex(2, 1, false) }, // 43o limped
          { position: 'LATE', action: 'limp', handIndex: rangeIndex(3, 2, true) },  // 54s limped
        ],
      });
      const traits = detectTraits(profile);
      expect(traits.trapsPreflop.confirmed).toBe(false);
    });

    it('ignores premiums in aggressive lines (open/threeBet)', () => {
      const profile = makeProfile({
        showdownAnchors: [
          { position: 'EARLY', action: 'open', handIndex: rangeIndex(12, 12, false) },    // AA opened — normal
          { position: 'EARLY', action: 'threeBet', handIndex: rangeIndex(11, 11, false) }, // KK 3-bet — normal
        ],
      });
      const traits = detectTraits(profile);
      expect(traits.trapsPreflop.observations).toBe(0);
      expect(traits.trapsPreflop.confirmed).toBe(false);
    });
  });

  describe('splitsRangePreflop', () => {
    it('returns zero with no showdowns', () => {
      const profile = makeProfile();
      const traits = detectTraits(profile);
      expect(traits.splitsRangePreflop.posterior).toBe(0);
      expect(traits.splitsRangePreflop.evidence).toHaveLength(0);
    });

    it('detects split when same hand appears in different action lines', () => {
      const aaIndex = rangeIndex(12, 12, false);
      const profile = makeProfile({
        showdownAnchors: [
          { position: 'EARLY', action: 'open', handIndex: aaIndex },
          { position: 'LATE', action: 'limp', handIndex: aaIndex },
        ],
      });
      const traits = detectTraits(profile);
      expect(traits.splitsRangePreflop.posterior).toBeGreaterThan(0);
      expect(traits.splitsRangePreflop.evidence).toHaveLength(1);
      expect(traits.splitsRangePreflop.evidence[0].handIndex).toBe(aaIndex);
      expect(traits.splitsRangePreflop.evidence[0].actions).toContain('open');
      expect(traits.splitsRangePreflop.evidence[0].actions).toContain('limp');
    });

    it('does not flag hands that always appear in same action line', () => {
      const profile = makeProfile({
        showdownAnchors: [
          { position: 'EARLY', action: 'open', handIndex: rangeIndex(12, 12, false) },
          { position: 'LATE', action: 'open', handIndex: rangeIndex(12, 12, false) },
        ],
      });
      const traits = detectTraits(profile);
      expect(traits.splitsRangePreflop.evidence).toHaveLength(0);
    });
  });

  describe('positionallyAware', () => {
    it('returns zero with insufficient data', () => {
      const profile = makeProfile();
      const traits = detectTraits(profile);
      expect(traits.positionallyAware.posterior).toBe(0);
      expect(traits.positionallyAware.earlyOpenPct).toBeNull();
    });

    it('detects positional awareness when LP opens much more than EP', () => {
      const profile = makeProfile();
      profile.opportunities.EARLY = { noRaiseFaced: 20, facedRaise: 0, total: 20 };
      profile.opportunities.LATE = { noRaiseFaced: 20, facedRaise: 0, total: 20 };
      profile.actionCounts.EARLY.open = 2;  // 10% EP open
      profile.actionCounts.LATE.open = 10;  // 50% LP open
      const traits = detectTraits(profile);
      expect(traits.positionallyAware.posterior).toBeGreaterThan(0);
      expect(traits.positionallyAware.earlyOpenPct).toBe(10);
      expect(traits.positionallyAware.lateOpenPct).toBe(50);
    });

    it('returns low posterior when EP and LP rates are similar', () => {
      const profile = makeProfile();
      profile.opportunities.EARLY = { noRaiseFaced: 20, facedRaise: 0, total: 20 };
      profile.opportunities.LATE = { noRaiseFaced: 20, facedRaise: 0, total: 20 };
      profile.actionCounts.EARLY.open = 5;  // 25%
      profile.actionCounts.LATE.open = 6;   // 30%
      const traits = detectTraits(profile);
      expect(traits.positionallyAware.posterior).toBe(0);
    });
  });
});
