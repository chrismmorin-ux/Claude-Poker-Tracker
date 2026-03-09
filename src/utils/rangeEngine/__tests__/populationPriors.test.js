import { describe, it, expect } from 'vitest';
import {
  getPopulationPrior,
  NO_RAISE_FREQUENCIES,
  FACED_RAISE_FREQUENCIES,
  NO_RAISE_ACTIONS,
  FACED_RAISE_ACTIONS,
} from '../populationPriors';
import { RANGE_POSITIONS } from '../rangeProfile';
import { rangeIndex } from '../../pokerCore/rangeMatrix';

const GRID_SIZE = 169;

describe('populationPriors', () => {
  describe('frequency tables', () => {
    it('no-raise frequencies sum to 1.0 per position', () => {
      for (const pos of RANGE_POSITIONS) {
        const freqs = NO_RAISE_FREQUENCIES[pos];
        const sum = NO_RAISE_ACTIONS.reduce((s, a) => s + freqs[a], 0);
        // BB is all zeros (check, not voluntary)
        if (pos === 'BB') {
          expect(sum).toBe(0);
        } else {
          expect(sum).toBeCloseTo(1.0, 5);
        }
      }
    });

    it('faced-raise frequencies sum to 1.0 per position', () => {
      for (const pos of RANGE_POSITIONS) {
        const freqs = FACED_RAISE_FREQUENCIES[pos];
        const sum = FACED_RAISE_ACTIONS.reduce((s, a) => s + freqs[a], 0);
        expect(sum).toBeCloseTo(1.0, 5);
      }
    });

    it('covers all 5 positions', () => {
      for (const pos of RANGE_POSITIONS) {
        expect(NO_RAISE_FREQUENCIES[pos]).toBeDefined();
        expect(FACED_RAISE_FREQUENCIES[pos]).toBeDefined();
      }
    });
  });

  describe('getPopulationPrior', () => {
    it('returns Float64Array of length 169', () => {
      const prior = getPopulationPrior('EARLY', 'open');
      expect(prior).toBeInstanceOf(Float64Array);
      expect(prior.length).toBe(GRID_SIZE);
    });

    it('values are in [0, 1]', () => {
      for (const pos of RANGE_POSITIONS) {
        for (const action of [...NO_RAISE_ACTIONS, ...FACED_RAISE_ACTIONS]) {
          const prior = getPopulationPrior(pos, action);
          for (let i = 0; i < GRID_SIZE; i++) {
            expect(prior[i]).toBeGreaterThanOrEqual(0);
            expect(prior[i]).toBeLessThanOrEqual(1.0);
          }
        }
      }
    });

    it('returns a copy (safe to mutate)', () => {
      const a = getPopulationPrior('LATE', 'open');
      const b = getPopulationPrior('LATE', 'open');
      a[0] = 999;
      expect(b[0]).not.toBe(999);
    });

    it('open prior is heavy on premiums', () => {
      const prior = getPopulationPrior('EARLY', 'open');
      const aaIdx = rangeIndex(12, 12, false); // AA
      const kkIdx = rangeIndex(11, 11, false); // KK
      const _72oIdx = rangeIndex(5, 0, false); // 72o
      expect(prior[aaIdx]).toBeGreaterThan(prior[_72oIdx]);
      expect(prior[kkIdx]).toBeGreaterThan(prior[_72oIdx]);
    });

    it('limp prior is on speculative hands, not premiums', () => {
      const prior = getPopulationPrior('LATE', 'limp');
      // Speculative hands should have weight
      const _55idx = rangeIndex(3, 3, false); // 55
      expect(prior[_55idx]).toBeGreaterThan(0);
    });

    it('BB limp prior is all zeros (BB checks, does not limp)', () => {
      const prior = getPopulationPrior('BB', 'limp');
      let sum = 0;
      for (let i = 0; i < GRID_SIZE; i++) sum += prior[i];
      expect(sum).toBe(0);
    });

    it('fold prior weights weakest hands highest', () => {
      const prior = getPopulationPrior('EARLY', 'fold');
      const aaIdx = rangeIndex(12, 12, false);
      const _72oIdx = rangeIndex(5, 0, false);
      expect(prior[_72oIdx]).toBeGreaterThan(prior[aaIdx]);
    });

    it('threeBet prior concentrates on strongest hands', () => {
      const prior = getPopulationPrior('EARLY', 'threeBet');
      const aaIdx = rangeIndex(12, 12, false);
      const _54sIdx = rangeIndex(3, 2, true);
      expect(prior[aaIdx]).toBeGreaterThan(prior[_54sIdx]);
    });
  });
});
