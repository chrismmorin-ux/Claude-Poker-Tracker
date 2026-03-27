import { describe, it, expect } from 'vitest';
import { getBlindLevel } from '../blindLevelUtils';

const SCHEDULE = [
  { sb: 25, bb: 50, ante: 0, durationMinutes: 20 },
  { sb: 50, bb: 100, ante: 0, durationMinutes: 20 },
  { sb: 100, bb: 200, ante: 25, durationMinutes: 15 },
];

describe('getBlindLevel', () => {
  describe('returns exact schedule entry when index is within bounds', () => {
    it('returns the first level at index 0', () => {
      expect(getBlindLevel(SCHEDULE, 0)).toBe(SCHEDULE[0]);
    });

    it('returns the second level at index 1', () => {
      expect(getBlindLevel(SCHEDULE, 1)).toBe(SCHEDULE[1]);
    });

    it('returns the last level at index 2 (schedule.length - 1)', () => {
      expect(getBlindLevel(SCHEDULE, 2)).toBe(SCHEDULE[2]);
    });
  });

  describe('extrapolates by doubling last level values when index is beyond schedule', () => {
    it('extrapolates one level beyond schedule (index 3) with multiplier 2x', () => {
      const result = getBlindLevel(SCHEDULE, 3);
      expect(result.sb).toBe(200);   // 100 * 2
      expect(result.bb).toBe(400);   // 200 * 2
      expect(result.ante).toBe(50);  // 25  * 2
    });

    it('extrapolates two levels beyond schedule (index 4) with multiplier 4x', () => {
      const result = getBlindLevel(SCHEDULE, 4);
      expect(result.sb).toBe(400);   // 100 * 4
      expect(result.bb).toBe(800);   // 200 * 4
      expect(result.ante).toBe(100); // 25  * 4
    });

    it('extrapolates three levels beyond schedule (index 5) with multiplier 8x', () => {
      const result = getBlindLevel(SCHEDULE, 5);
      expect(result.sb).toBe(800);   // 100 * 8
      expect(result.bb).toBe(1600);  // 200 * 8
      expect(result.ante).toBe(200); // 25  * 8
    });
  });

  describe('duration handling during extrapolation', () => {
    it('preserves the last schedule level durationMinutes (not doubled) at index 3', () => {
      const result = getBlindLevel(SCHEDULE, 3);
      expect(result.durationMinutes).toBe(15);
    });

    it('preserves the last schedule level durationMinutes (not doubled) at index 5', () => {
      const result = getBlindLevel(SCHEDULE, 5);
      expect(result.durationMinutes).toBe(15);
    });
  });

  describe('ante extrapolation edge case: ante: 0 stays 0', () => {
    const scheduleNoAnte = [
      { sb: 25, bb: 50, ante: 0, durationMinutes: 20 },
      { sb: 50, bb: 100, ante: 0, durationMinutes: 20 },
    ];

    it('keeps ante at 0 when last level ante is 0 and extrapolating one level beyond', () => {
      const result = getBlindLevel(scheduleNoAnte, 2);
      expect(result.ante).toBe(0);
    });

    it('keeps ante at 0 when last level ante is 0 and extrapolating two levels beyond', () => {
      const result = getBlindLevel(scheduleNoAnte, 3);
      expect(result.ante).toBe(0);
    });

    it('still doubles sb and bb correctly when ante is 0', () => {
      const result = getBlindLevel(scheduleNoAnte, 2);
      expect(result.sb).toBe(100);  // 50 * 2
      expect(result.bb).toBe(200);  // 100 * 2
    });
  });

  describe('single-level schedule', () => {
    const singleLevel = [
      { sb: 50, bb: 100, ante: 10, durationMinutes: 30 },
    ];

    it('returns the only entry when index is 0', () => {
      expect(getBlindLevel(singleLevel, 0)).toBe(singleLevel[0]);
    });

    it('extrapolates first level beyond single-entry schedule with multiplier 2x', () => {
      const result = getBlindLevel(singleLevel, 1);
      expect(result.sb).toBe(100);
      expect(result.bb).toBe(200);
      expect(result.ante).toBe(20);
      expect(result.durationMinutes).toBe(30);
    });

    it('extrapolates second level beyond single-entry schedule with multiplier 4x', () => {
      const result = getBlindLevel(singleLevel, 2);
      expect(result.sb).toBe(200);
      expect(result.bb).toBe(400);
      expect(result.ante).toBe(40);
      expect(result.durationMinutes).toBe(30);
    });
  });

  describe('returned object shape during extrapolation', () => {
    it('returns an object with exactly the four expected keys', () => {
      const result = getBlindLevel(SCHEDULE, 3);
      expect(Object.keys(result).sort()).toEqual(
        ['ante', 'bb', 'durationMinutes', 'sb']
      );
    });

    it('returns a new object (not the original schedule entry) when extrapolating', () => {
      const result = getBlindLevel(SCHEDULE, 3);
      expect(result).not.toBe(SCHEDULE[2]);
    });
  });
});
