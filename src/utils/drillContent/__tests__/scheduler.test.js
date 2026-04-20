import { describe, test, expect, vi } from 'vitest';
import { pickNextMatchup, scoreEstimate, scoreFrameworkSelection, scoreRecipe } from '../scheduler';

const lib = [
  { id: 'a', primary: 'race' },
  { id: 'b', primary: 'domination' },
  { id: 'c', primary: 'pair_over_pair' },
];

describe('scheduler — pickNextMatchup', () => {
  test('cold start samples uniformly ignoring framework accuracy', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const m = pickNextMatchup(lib, {}, []);
    expect(lib.map((x) => x.id)).toContain(m.id);
    Math.random.mockRestore();
  });

  test('weights weak frameworks higher after enough attempts', () => {
    // 10 attempts total, all domination nailed, all race missed.
    const acc = {
      race: { attempts: 5, correct: 0, accuracy: 0 },
      domination: { attempts: 5, correct: 5, accuracy: 1 },
    };
    // Run many trials and verify race is picked far more than domination.
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 500; i++) {
      const m = pickNextMatchup(lib, acc, []);
      counts[m.id]++;
    }
    expect(counts.a).toBeGreaterThan(counts.b);
  });

  test('recent matchups get penalized', () => {
    const acc = {
      race: { attempts: 10, correct: 5, accuracy: 0.5 },
      domination: { attempts: 10, correct: 5, accuracy: 0.5 },
      pair_over_pair: { attempts: 10, correct: 5, accuracy: 0.5 },
    };
    // If 'a' is recent, it should be picked less than 'b' and 'c'.
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 500; i++) {
      const m = pickNextMatchup(lib, acc, ['a']);
      counts[m.id]++;
    }
    expect(counts.a).toBeLessThan(counts.b);
    expect(counts.a).toBeLessThan(counts.c);
  });

  test('returns null for empty library', () => {
    expect(pickNextMatchup([], {}, [])).toBeNull();
    expect(pickNextMatchup(null, {}, [])).toBeNull();
  });
});

describe('scheduler — scoreEstimate', () => {
  test('delta and correctness within ±5%', () => {
    expect(scoreEstimate(0.60, 0.62)).toEqual({ delta: expect.closeTo(0.02), correct: true, stars: 2 });
    const r = scoreEstimate(0.60, 0.62);
    expect(Math.abs(r.delta - 0.02)).toBeLessThan(1e-9);
    expect(r.correct).toBe(true);
    expect(r.stars).toBe(2);
  });

  test('3-star rating for <2% delta', () => {
    expect(scoreEstimate(0.505, 0.500).stars).toBe(3);
  });

  test('1-star for 5-10% delta', () => {
    expect(scoreEstimate(0.55, 0.62).stars).toBe(1);
  });

  test('0 stars for wildly off guesses', () => {
    expect(scoreEstimate(0.30, 0.55).stars).toBe(0);
    expect(scoreEstimate(0.30, 0.55).correct).toBe(false);
  });
});

describe('scheduler — scoreFrameworkSelection', () => {
  test('exact match → correct and full F1', () => {
    const r = scoreFrameworkSelection(['race', 'decomposition'], ['race', 'decomposition']);
    expect(r.correct).toBe(true);
    expect(r.f1).toBe(1);
  });

  test('extra pick → incorrect, false positive recorded', () => {
    const r = scoreFrameworkSelection(['race', 'domination'], ['race']);
    expect(r.correct).toBe(false);
    expect(r.fp).toEqual(['domination']);
  });

  test('missed framework → incorrect, false negative recorded', () => {
    const r = scoreFrameworkSelection(['race'], ['race', 'straight_coverage']);
    expect(r.correct).toBe(false);
    expect(r.fn).toEqual(['straight_coverage']);
  });
});

describe('scheduler — scoreRecipe', () => {
  const truth = {
    trueShapeId: 'ax-suited',
    trueLaneId: 'vs-unpaired-no-shared',
    trueEquity: 0.62,
  };

  test('all three correct → 3 stars + correct', () => {
    const r = scoreRecipe({
      pickedShapeId: 'ax-suited',
      pickedLaneId: 'vs-unpaired-no-shared',
      pickedEquity: 0.60,
      ...truth,
    });
    expect(r.shapeCorrect).toBe(true);
    expect(r.laneCorrect).toBe(true);
    expect(r.equityCorrect).toBe(true);
    expect(r.stars).toBe(3);
    expect(r.correct).toBe(true);
  });

  test('wrong shape → lane auto-fails even if name matches', () => {
    const r = scoreRecipe({
      pickedShapeId: 'broadway-broadway',
      pickedLaneId: 'vs-unpaired-no-shared',
      pickedEquity: 0.62,
      ...truth,
    });
    expect(r.shapeCorrect).toBe(false);
    expect(r.laneCorrect).toBe(false); // can't get lane right without correct shape
    expect(r.equityCorrect).toBe(true);
    expect(r.stars).toBe(1);
    expect(r.correct).toBe(false);
  });

  test('right shape, wrong lane → 1 star (shape only)', () => {
    const r = scoreRecipe({
      pickedShapeId: 'ax-suited',
      pickedLaneId: 'vs-aa',
      pickedEquity: 0.50,
      ...truth,
    });
    expect(r.shapeCorrect).toBe(true);
    expect(r.laneCorrect).toBe(false);
    expect(r.equityCorrect).toBe(false);
    expect(r.stars).toBe(1);
  });

  test('equity off by more than tolerance → equity-incorrect', () => {
    const r = scoreRecipe({
      pickedShapeId: 'ax-suited',
      pickedLaneId: 'vs-unpaired-no-shared',
      pickedEquity: 0.40,
      ...truth,
    });
    expect(r.equityCorrect).toBe(false);
    expect(r.equityDelta).toBeCloseTo(0.22, 2);
    expect(r.stars).toBe(2);
  });

  test('respects custom equity tolerance', () => {
    const r = scoreRecipe({
      pickedShapeId: 'ax-suited',
      pickedLaneId: 'vs-unpaired-no-shared',
      pickedEquity: 0.55,
      ...truth,
      equityTolerance: 0.10,
    });
    expect(r.equityCorrect).toBe(true);
  });
});
