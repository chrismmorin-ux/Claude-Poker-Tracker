import { describe, it, expect } from 'vitest';
import { detectTraits } from '../traitDetector';
import { createEmptyProfile, RANGE_POSITIONS } from '../rangeProfile';
import { rangeIndex } from '../../pokerCore/rangeMatrix';

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
      // 30% is not 1.5x of 25% — well below the >0.5 detection gate.
      expect(traits.positionallyAware.posterior).toBeLessThan(0.5);
    });

    // Regression for FIND-011: the old frequentist ratio fired the trait on tiny
    // samples (n=5), where one extra open swings the raw rate 20 percentage points.
    // The Beta-posterior + firm prior must NOT fire on small noisy samples, and the
    // verdict must be stable across a single added observation.
    it('does not fire on a small noisy sample (FIND-011)', () => {
      const small = (epOpens, lpOpens) => {
        const profile = makeProfile();
        profile.opportunities.EARLY = { noRaiseFaced: 5, facedRaise: 0, total: 5 };
        profile.opportunities.LATE = { noRaiseFaced: 5, facedRaise: 0, total: 5 };
        profile.actionCounts.EARLY.open = epOpens;
        profile.actionCounts.LATE.open = lpOpens;
        return detectTraits(profile).positionallyAware.posterior;
      };
      // 1/5 (20%) EP vs 4/5 (80%) LP — extreme raw ratio, but only 5 hands each.
      expect(small(1, 4)).toBeLessThan(0.5);
      // 2/5 (40%) vs 4/5 (80%) — also must stay below the gate.
      expect(small(2, 4)).toBeLessThan(0.5);
      // Stability: removing one LP open (4→3) must not flip the verdict across 0.5.
      expect(small(1, 3)).toBeLessThan(0.5);
    });

    it('fires on a sustained positional spread over a real sample', () => {
      const profile = makeProfile();
      profile.opportunities.EARLY = { noRaiseFaced: 20, facedRaise: 0, total: 20 };
      profile.opportunities.LATE = { noRaiseFaced: 20, facedRaise: 0, total: 20 };
      profile.actionCounts.EARLY.open = 2;   // 10%
      profile.actionCounts.LATE.open = 10;   // 50%
      const traits = detectTraits(profile);
      // Same 10%-vs-50% spread as the n=5 noise case, but over 20 hands each —
      // now it clears the detection gate.
      expect(traits.positionallyAware.posterior).toBeGreaterThan(0.6);
    });
  });
});
