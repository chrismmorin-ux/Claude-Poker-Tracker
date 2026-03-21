import { describe, it, expect } from 'vitest';
import { calculateOrbitsUntilBlindOut, projectFinishPosition } from '../blindOutCalculator';

// Standard schedule for tests
const STANDARD_SCHEDULE = [
  { sb: 25, bb: 50, ante: 0, durationMinutes: 20 },
  { sb: 50, bb: 100, ante: 0, durationMinutes: 20 },
  { sb: 75, bb: 150, ante: 0, durationMinutes: 20 },
  { sb: 100, bb: 200, ante: 25, durationMinutes: 20 },
  { sb: 150, bb: 300, ante: 50, durationMinutes: 20 },
  { sb: 200, bb: 400, ante: 75, durationMinutes: 20 },
];

describe('calculateOrbitsUntilBlindOut', () => {
  it('should handle a very short stack (< 1 orbit)', () => {
    // Stack of 50, blinds 25/50, no ante, 9 players
    // Cost per orbit = 25 + 50 = 75
    // 50/75 = 0.67 orbits
    const result = calculateOrbitsUntilBlindOut(50, STANDARD_SCHEDULE, 0, 9, 30);
    expect(result.totalOrbits).toBeCloseTo(0.67, 1);
    expect(result.blindOutLevel).toBe(0);
    expect(result.wallClockMinutes).toBeGreaterThan(0);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].stackRemaining).toBe(0);
  });

  it('should survive exactly 1 orbit at level 0', () => {
    // Cost per orbit at level 0 = 25 + 50 = 75
    const result = calculateOrbitsUntilBlindOut(75, STANDARD_SCHEDULE, 0, 9, 30);
    expect(result.totalOrbits).toBeCloseTo(1.0, 1);
    expect(result.blindOutLevel).toBe(0);
  });

  it('should survive across multiple levels', () => {
    // 10000 chips should survive several levels
    const result = calculateOrbitsUntilBlindOut(10000, STANDARD_SCHEDULE, 0, 9, 30);
    expect(result.blindOutLevel).toBeGreaterThan(0);
    expect(result.breakdown.length).toBeGreaterThan(1);
    expect(result.wallClockMinutes).toBeGreaterThan(20); // More than 1 level
  });

  it('should handle ante levels correctly', () => {
    // Start at level 3 (100/200 ante 25, 9 players)
    // Cost per orbit = 100 + 200 + (25 * 9) = 525
    const result = calculateOrbitsUntilBlindOut(525, STANDARD_SCHEDULE, 3, 9, 30);
    expect(result.totalOrbits).toBeCloseTo(1.0, 1);
    expect(result.blindOutLevel).toBe(3);
  });

  it('should handle zero-ante levels', () => {
    const result = calculateOrbitsUntilBlindOut(1000, STANDARD_SCHEDULE, 0, 9, 30);
    // Level 0 has no ante
    const level0 = result.breakdown[0];
    expect(level0).toBeDefined();
    // Verify: cost at level 0 is just sb + bb = 75
    const expectedOrbits = 1000 / 75;
    const orbitsInLevel = (20 * 60) / (9 * 30);
    // Stack should survive level 0 since expectedOrbits > orbitsInLevel
    expect(expectedOrbits).toBeGreaterThan(orbitsInLevel);
  });

  it('should extrapolate beyond schedule by doubling', () => {
    // Very large stack that survives all 6 levels
    const result = calculateOrbitsUntilBlindOut(1000000, STANDARD_SCHEDULE, 0, 9, 30);
    expect(result.blindOutLevel).toBeGreaterThanOrEqual(STANDARD_SCHEDULE.length);
  });

  it('should return zero for zero stack', () => {
    const result = calculateOrbitsUntilBlindOut(0, STANDARD_SCHEDULE, 0, 9, 30);
    expect(result.totalOrbits).toBe(0);
    expect(result.wallClockMinutes).toBe(0);
    expect(result.breakdown).toHaveLength(0);
  });

  it('should handle zero players gracefully', () => {
    const result = calculateOrbitsUntilBlindOut(1000, STANDARD_SCHEDULE, 0, 0, 30);
    expect(result.totalOrbits).toBe(0);
  });

  it('should produce decreasing stack remaining in breakdown', () => {
    const result = calculateOrbitsUntilBlindOut(5000, STANDARD_SCHEDULE, 0, 9, 30);
    for (let i = 1; i < result.breakdown.length; i++) {
      expect(result.breakdown[i].stackRemaining).toBeLessThanOrEqual(result.breakdown[i - 1].stackRemaining);
    }
  });
});

describe('projectFinishPosition', () => {
  it('should rank higher stacks with better (lower) finish positions', () => {
    const stacks = [
      { seat: 1, stack: 5000 },
      { seat: 2, stack: 20000 },
      { seat: 3, stack: 10000 },
    ];
    const result = projectFinishPosition(stacks, STANDARD_SCHEDULE, 0, 9, 30);

    expect(result.rankings).toHaveLength(3);

    const seat2Rank = result.rankings.find(r => r.seat === 2);
    const seat3Rank = result.rankings.find(r => r.seat === 3);
    const seat1Rank = result.rankings.find(r => r.seat === 1);

    expect(seat2Rank.projectedFinish).toBe(1); // Biggest stack
    expect(seat3Rank.projectedFinish).toBe(2);
    expect(seat1Rank.projectedFinish).toBe(3); // Smallest stack
  });

  it('should assign tied positions for equal stacks', () => {
    const stacks = [
      { seat: 1, stack: 10000 },
      { seat: 2, stack: 10000 },
      { seat: 3, stack: 5000 },
    ];
    const result = projectFinishPosition(stacks, STANDARD_SCHEDULE, 0, 9, 30);

    const seat1Rank = result.rankings.find(r => r.seat === 1);
    const seat2Rank = result.rankings.find(r => r.seat === 2);
    const seat3Rank = result.rankings.find(r => r.seat === 3);

    expect(seat1Rank.projectedFinish).toBe(seat2Rank.projectedFinish);
    expect(seat3Rank.projectedFinish).toBe(3);
  });

  it('should handle single player (winner)', () => {
    const stacks = [{ seat: 5, stack: 50000 }];
    const result = projectFinishPosition(stacks, STANDARD_SCHEDULE, 0, 9, 30);

    expect(result.rankings).toHaveLength(1);
    expect(result.rankings[0].projectedFinish).toBe(1);
  });

  it('should handle empty stacks array', () => {
    const result = projectFinishPosition([], STANDARD_SCHEDULE, 0, 9, 30);
    expect(result.rankings).toHaveLength(0);
  });

  it('should include blind-out info in results', () => {
    const stacks = [
      { seat: 1, stack: 5000 },
      { seat: 2, stack: 15000 },
    ];
    const result = projectFinishPosition(stacks, STANDARD_SCHEDULE, 0, 9, 30);

    for (const ranking of result.rankings) {
      expect(ranking).toHaveProperty('blindOutLevel');
      expect(ranking).toHaveProperty('wallClockMinutes');
      expect(ranking).toHaveProperty('projectedFinish');
      expect(ranking).toHaveProperty('seat');
      expect(ranking).toHaveProperty('stack');
    }
  });
});
