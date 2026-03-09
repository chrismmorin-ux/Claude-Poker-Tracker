import { describe, it, expect } from 'vitest';
import {
  buildRangeProfile,
  getRangeWidthSummary,
  getSubActionSummary,
  createEmptyProfile,
  RANGE_POSITIONS,
  RANGE_ACTIONS,
} from '../index';

describe('rangeEngine public API', () => {
  describe('getRangeWidthSummary', () => {
    it('returns expected shape for valid profile', () => {
      const profile = createEmptyProfile('p1', 'u1');
      // Set some weights to avoid all-zero
      for (const pos of RANGE_POSITIONS) {
        profile.ranges[pos].open[0] = 0.8;
        profile.opportunities[pos].total = 5;
        profile.opportunities[pos].noRaiseFaced = 3;
        profile.opportunities[pos].facedRaise = 2;
        profile.actionCounts[pos].open = 2;
        profile.actionCounts[pos].coldCall = 1;
      }

      const summary = getRangeWidthSummary(profile);

      for (const pos of RANGE_POSITIONS) {
        expect(summary[pos]).toBeDefined();
        expect(summary[pos]).toHaveProperty('noRaise');
        expect(summary[pos]).toHaveProperty('facedRaise');
        expect(summary[pos]).toHaveProperty('noRaiseFreqs');
        expect(summary[pos]).toHaveProperty('facedRaiseFreqs');
        expect(summary[pos]).toHaveProperty('hands');
        expect(summary[pos].noRaise).toHaveProperty('limp');
        expect(summary[pos].noRaise).toHaveProperty('open');
        expect(summary[pos].facedRaise).toHaveProperty('coldCall');
        expect(summary[pos].facedRaise).toHaveProperty('threeBet');
      }
    });

    it('range widths are numbers', () => {
      const profile = createEmptyProfile('p1', 'u1');
      const summary = getRangeWidthSummary(profile);

      for (const pos of RANGE_POSITIONS) {
        expect(typeof summary[pos].noRaise.open).toBe('number');
        expect(typeof summary[pos].facedRaise.coldCall).toBe('number');
      }
    });

    it('frequencies are null when no observations', () => {
      const profile = createEmptyProfile('p1', 'u1');
      const summary = getRangeWidthSummary(profile);

      for (const pos of RANGE_POSITIONS) {
        expect(summary[pos].noRaiseFreqs.fold).toBeNull();
        expect(summary[pos].facedRaiseFreqs.fold).toBeNull();
      }
    });
  });

  describe('getSubActionSummary', () => {
    it('returns correct counts', () => {
      const profile = createEmptyProfile('p1', 'u1');
      profile.subActionCounts.LATE.limpFold = 3;
      profile.subActionCounts.LATE.limpCall = 2;
      profile.subActionCounts.LATE.limpRaise = 1;
      profile.subActionCounts.LATE.limpNoRaise = 4;

      const summary = getSubActionSummary(profile);

      expect(summary.LATE.totalLimpsFacedRaise).toBe(6);
      expect(summary.LATE.limpFoldPct).toBe(50);
      expect(summary.LATE.limpCallPct).toBe(33);
      expect(summary.LATE.limpRaisePct).toBe(17);
      expect(summary.LATE.totalLimps).toBe(10);
    });

    it('returns null percentages when no limps faced raise', () => {
      const profile = createEmptyProfile('p1', 'u1');
      const summary = getSubActionSummary(profile);

      for (const pos of RANGE_POSITIONS) {
        expect(summary[pos].limpFoldPct).toBeNull();
        expect(summary[pos].totalLimpsFacedRaise).toBe(0);
      }
    });

    it('returns null for missing profile', () => {
      expect(getSubActionSummary(null)).toBeNull();
      expect(getSubActionSummary(undefined)).toBeNull();
    });
  });

  describe('buildRangeProfile', () => {
    it('returns serializable profile from empty hands', () => {
      const profile = buildRangeProfile('p1', [], 'u1');

      expect(profile.playerId).toBe('p1');
      expect(profile.userId).toBe('u1');
      expect(profile.handsProcessed).toBe(0);
      expect(profile.lastUpdatedAt).toBeGreaterThan(0);
      expect(profile.traits).toBeDefined();
      expect(profile.showdownAnchors).toEqual([]);

      // Ranges should be Float64Arrays
      for (const pos of RANGE_POSITIONS) {
        for (const action of RANGE_ACTIONS) {
          expect(profile.ranges[pos][action]).toBeInstanceOf(Float64Array);
          expect(profile.ranges[pos][action].length).toBe(169);
        }
      }
    });

    it('profile is JSON-serializable after conversion', () => {
      const profile = buildRangeProfile('p1', [], 'u1');
      // Convert Float64Arrays to plain arrays for JSON
      const plain = JSON.parse(JSON.stringify(profile, (_, v) =>
        v instanceof Float64Array ? Array.from(v) : v
      ));
      expect(plain.playerId).toBe('p1');
      expect(plain.ranges.EARLY.open).toHaveLength(169);
    });
  });
});
