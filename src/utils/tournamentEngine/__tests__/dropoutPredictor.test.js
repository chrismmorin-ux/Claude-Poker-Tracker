import { describe, it, expect } from 'vitest';
import { computeDropoutRate, projectMilestones } from '../dropoutPredictor';

const STANDARD_SCHEDULE = [
  { sb: 25, bb: 50, ante: 0, durationMinutes: 20 },
  { sb: 50, bb: 100, ante: 0, durationMinutes: 20 },
  { sb: 75, bb: 150, ante: 0, durationMinutes: 20 },
  { sb: 100, bb: 200, ante: 25, durationMinutes: 20 },
  { sb: 150, bb: 300, ante: 50, durationMinutes: 20 },
  { sb: 200, bb: 400, ante: 75, durationMinutes: 20 },
];

describe('computeDropoutRate', () => {
  it('should compute a steady rate from evenly spaced eliminations', () => {
    // 1 elimination every 5 minutes
    const eliminations = [
      { timestamp: 0 },
      { timestamp: 300000 },  // 5 min
      { timestamp: 600000 },  // 10 min
      { timestamp: 900000 },  // 15 min
      { timestamp: 1200000 }, // 20 min
    ];
    const result = computeDropoutRate(eliminations);

    expect(result).not.toBeNull();
    expect(result.ratePerMinute).toBeCloseTo(0.2, 1); // 1 per 5 min
    expect(result.confidence).toBe('medium');
  });

  it('should return low confidence with < 3 data points', () => {
    const eliminations = [
      { timestamp: 0 },
      { timestamp: 300000 },
    ];
    const result = computeDropoutRate(eliminations);

    expect(result).not.toBeNull();
    expect(result.confidence).toBe('low');
  });

  it('should return high confidence with 8+ data points', () => {
    const eliminations = Array.from({ length: 10 }, (_, i) => ({
      timestamp: i * 300000,
    }));
    const result = computeDropoutRate(eliminations);

    expect(result.confidence).toBe('high');
  });

  it('should return null for no eliminations', () => {
    expect(computeDropoutRate([])).toBeNull();
    expect(computeDropoutRate(null)).toBeNull();
  });

  it('should return low confidence for single elimination', () => {
    const result = computeDropoutRate([{ timestamp: 100000 }]);
    expect(result).not.toBeNull();
    expect(result.ratePerMinute).toBe(0);
    expect(result.confidence).toBe('low');
  });

  it('should weight recent eliminations more heavily', () => {
    // First 3 slow (10 min apart), then 3 fast (2 min apart)
    const eliminations = [
      { timestamp: 0 },
      { timestamp: 600000 },  // 10 min
      { timestamp: 1200000 }, // 10 min
      { timestamp: 1320000 }, // 2 min
      { timestamp: 1440000 }, // 2 min
      { timestamp: 1560000 }, // 2 min
    ];
    const result = computeDropoutRate(eliminations);

    // Rate should be closer to 1/2 min = 0.5 than 1/10 min = 0.1
    expect(result.ratePerMinute).toBeGreaterThan(0.2);
  });
});

describe('projectMilestones', () => {
  it('should project milestones for a standard tournament', () => {
    const result = projectMilestones(
      50,   // playersRemaining
      120,  // totalEntrants
      15,   // payoutSlots
      0.2,  // ratePerMinute (1 every 5 min)
      STANDARD_SCHEDULE,
      0     // currentLevelIndex
    );

    // Should include final_table, bubble, heads_up, winner
    const milestoneNames = result.map(m => m.milestone);
    expect(milestoneNames).toContain('final_table');
    expect(milestoneNames).toContain('bubble');
    expect(milestoneNames).toContain('heads_up');
    expect(milestoneNames).toContain('winner');

    // Final table should come before heads up
    const ftIdx = result.findIndex(m => m.milestone === 'final_table');
    const huIdx = result.findIndex(m => m.milestone === 'heads_up');
    expect(result[ftIdx].estimatedMinutes).toBeLessThan(result[huIdx].estimatedMinutes);
  });

  it('should exclude milestones already reached', () => {
    // Already at final table (9 players)
    const result = projectMilestones(
      9, 120, 15, 0.2, STANDARD_SCHEDULE, 0
    );

    const milestoneNames = result.map(m => m.milestone);
    expect(milestoneNames).not.toContain('final_table');
    expect(milestoneNames).toContain('heads_up');
    expect(milestoneNames).toContain('winner');
  });

  it('should return empty array for zero dropout rate', () => {
    const result = projectMilestones(50, 120, 15, 0, STANDARD_SCHEDULE, 0);
    expect(result).toEqual([]);
  });

  it('should return empty array for 1 player remaining', () => {
    const result = projectMilestones(1, 120, 15, 0.2, STANDARD_SCHEDULE, 0);
    expect(result).toEqual([]);
  });

  it('should handle no payout slots (null)', () => {
    const result = projectMilestones(50, 120, null, 0.2, STANDARD_SCHEDULE, 0);

    const milestoneNames = result.map(m => m.milestone);
    expect(milestoneNames).not.toContain('bubble');
    expect(milestoneNames).toContain('final_table');
  });

  it('should produce increasing estimated minutes for later milestones', () => {
    const result = projectMilestones(50, 120, 15, 0.2, STANDARD_SCHEDULE, 0);

    for (let i = 1; i < result.length; i++) {
      expect(result[i].estimatedMinutes).toBeGreaterThanOrEqual(result[i - 1].estimatedMinutes);
    }
  });
});
