import { describe, test, expect } from 'vitest';
import { generateEstimateQuestion, TIER_QUESTIONS } from '../questionGenerators';
import { SCENARIOS } from '../scenarioLibrary';

describe('questionGenerators — generateEstimateQuestion', () => {
  test('returns the required shape', () => {
    const q = generateEstimateQuestion(SCENARIOS[0], 12345);
    expect(q).toMatchObject({
      scenarioId: SCENARIOS[0].id,
      questionId: expect.any(String),
      prompt: expect.any(String),
      label: expect.any(String),
      truth: expect.any(Number),
      ctx: expect.objectContaining({ position: expect.any(String), action: expect.any(String) }),
      rangeLabel: expect.any(String),
      board: expect.any(Array),
      scenario: SCENARIOS[0],
    });
    expect(q.truth).toBeGreaterThanOrEqual(0);
    expect(q.truth).toBeLessThanOrEqual(1);
  });

  test('is deterministic for a given seed', () => {
    const q1 = generateEstimateQuestion(SCENARIOS[2], 98765);
    const q2 = generateEstimateQuestion(SCENARIOS[2], 98765);
    expect(q1.questionId).toBe(q2.questionId);
    expect(q1.truth).toBe(q2.truth);
    expect(q1.ctx.position).toBe(q2.ctx.position);
  });

  test('picks the opposing context when scenario has one (over enough seeds)', () => {
    const withOpposing = SCENARIOS.find((s) => s.opposingContext);
    expect(withOpposing).toBeDefined();
    const sides = new Set();
    for (let seed = 1; seed <= 30; seed++) {
      const q = generateEstimateQuestion(withOpposing, seed);
      sides.add(q.ctx.position);
    }
    expect(sides.size).toBeGreaterThanOrEqual(2);
  });

  test('every scenario produces valid questions across multiple seeds', () => {
    for (const s of SCENARIOS) {
      for (let seed = 1; seed <= 3; seed++) {
        const q = generateEstimateQuestion(s, seed);
        expect(Number.isFinite(q.truth)).toBe(true);
        expect(q.truth).toBeGreaterThanOrEqual(0);
        expect(q.truth).toBeLessThanOrEqual(1);
      }
    }
  });

  test('question type is drawn from TIER_QUESTIONS', () => {
    const ids = new Set(TIER_QUESTIONS.map((q) => q.id));
    for (let seed = 1; seed <= 30; seed++) {
      const q = generateEstimateQuestion(SCENARIOS[0], seed);
      expect(ids.has(q.questionId)).toBe(true);
    }
  });
});
