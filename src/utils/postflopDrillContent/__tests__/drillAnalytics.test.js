import { describe, it, expect } from 'vitest';
import {
  aggregateByArchetype,
  aggregateByBucket,
  aggregateByBucketArchetype,
} from '../drillAnalytics';

const attempt = (overrides = {}) => ({
  drillId: 1,
  userId: 'u',
  drillType: 'line',
  scenarioKey: 'test:node',
  context: { position: 'BTN', action: 'open' },
  opposingContext: null,
  board: 'T♥ 9♥ 6♠',
  userAnswer: {},
  truth: { frameworks: [] },
  correct: true,
  delta: null,
  timestamp: 0,
  ...overrides,
});

describe('aggregateByArchetype', () => {
  it('counts attempts and correctness per valid archetypeId', () => {
    const drills = [
      attempt({ archetypeId: 'fish', correct: true }),
      attempt({ archetypeId: 'fish', correct: false }),
      attempt({ archetypeId: 'fish', correct: true }),
      attempt({ archetypeId: 'reg',  correct: true }),
      attempt({ archetypeId: 'pro',  correct: false }),
    ];
    const { byArchetype, droppedUnknown } = aggregateByArchetype(drills);
    expect(byArchetype.fish).toEqual({ attempts: 3, correct: 2, accuracy: 2 / 3 });
    expect(byArchetype.reg).toEqual({ attempts: 1, correct: 1, accuracy: 1 });
    expect(byArchetype.pro).toEqual({ attempts: 1, correct: 0, accuracy: 0 });
    expect(droppedUnknown).toBe(0);
  });

  it('drops records with unknown archetypeId', () => {
    const drills = [
      attempt({ archetypeId: 'fish' }),
      attempt({ archetypeId: 'whale' }),      // unknown
      attempt({ archetypeId: '__proto__' }),   // tampered
      attempt({ archetypeId: undefined }),      // legacy record
      attempt({}),                              // legacy — no archetypeId at all
    ];
    const { byArchetype, droppedUnknown } = aggregateByArchetype(drills);
    expect(byArchetype.fish).toEqual({ attempts: 1, correct: 1, accuracy: 1 });
    expect(byArchetype).not.toHaveProperty('whale');
    expect(byArchetype).not.toHaveProperty('__proto__');
    expect(droppedUnknown).toBe(4);
  });

  it('handles empty/null input', () => {
    expect(aggregateByArchetype([])).toEqual({ byArchetype: expect.any(Object), droppedUnknown: 0 });
    expect(aggregateByArchetype(null)).toEqual({ byArchetype: expect.any(Object), droppedUnknown: 0 });
  });

  it('uses prototype-free map (no __proto__ pollution risk)', () => {
    const drills = [attempt({ archetypeId: 'fish' })];
    const { byArchetype } = aggregateByArchetype(drills);
    expect(Object.getPrototypeOf(byArchetype)).toBeNull();
  });
});

describe('aggregateByBucket', () => {
  it('counts attempts and correctness per valid bucketId', () => {
    const drills = [
      attempt({ bucketId: 'set',    correct: true }),
      attempt({ bucketId: 'tptk',      correct: true }),
      attempt({ bucketId: 'tptk',      correct: false }),
      attempt({ bucketId: 'flushDraw', correct: true }),
      attempt({ bucketId: 'air',       correct: false }),
    ];
    const { byBucket, droppedUnknown } = aggregateByBucket(drills);
    expect(byBucket.set).toEqual({ attempts: 1, correct: 1, accuracy: 1 });
    expect(byBucket.tptk).toEqual({ attempts: 2, correct: 1, accuracy: 0.5 });
    expect(byBucket.flushDraw).toEqual({ attempts: 1, correct: 1, accuracy: 1 });
    expect(byBucket.air).toEqual({ attempts: 1, correct: 0, accuracy: 0 });
    expect(droppedUnknown).toBe(0);
  });

  it('drops records with unknown bucketId', () => {
    const drills = [
      attempt({ bucketId: 'set' }),
      attempt({ bucketId: 'invented' }),
      attempt({ bucketId: undefined }),
    ];
    const { byBucket, droppedUnknown } = aggregateByBucket(drills);
    expect(byBucket.set).toBeDefined();
    expect(byBucket).not.toHaveProperty('invented');
    expect(droppedUnknown).toBe(2);
  });

  it('prototype-free map', () => {
    const { byBucket } = aggregateByBucket([attempt({ bucketId: 'air' })]);
    expect(Object.getPrototypeOf(byBucket)).toBeNull();
  });
});

describe('aggregateByBucketArchetype — 2D cross-tab', () => {
  it('counts attempts per (bucket, archetype) pair', () => {
    const drills = [
      attempt({ bucketId: 'set', archetypeId: 'fish', correct: true }),
      attempt({ bucketId: 'set', archetypeId: 'fish', correct: false }),
      attempt({ bucketId: 'set', archetypeId: 'pro',  correct: true }),
      attempt({ bucketId: 'tptk',   archetypeId: 'reg',  correct: true }),
    ];
    const { byBucketArchetype, droppedUnknown } = aggregateByBucketArchetype(drills);
    expect(byBucketArchetype.set.fish).toEqual({ attempts: 2, correct: 1, accuracy: 0.5 });
    expect(byBucketArchetype.set.pro).toEqual({ attempts: 1, correct: 1, accuracy: 1 });
    expect(byBucketArchetype.tptk.reg).toEqual({ attempts: 1, correct: 1, accuracy: 1 });
    expect(droppedUnknown).toBe(0);
  });

  it('drops if EITHER bucketId or archetypeId is unknown', () => {
    const drills = [
      attempt({ bucketId: 'set', archetypeId: 'fish' }),         // valid
      attempt({ bucketId: 'bogus',  archetypeId: 'fish' }),         // unknown bucket
      attempt({ bucketId: 'set', archetypeId: 'whale' }),        // unknown archetype
      attempt({ bucketId: undefined, archetypeId: 'fish' }),        // legacy
    ];
    const { byBucketArchetype, droppedUnknown } = aggregateByBucketArchetype(drills);
    expect(byBucketArchetype.set.fish).toEqual({ attempts: 1, correct: 1, accuracy: 1 });
    expect(droppedUnknown).toBe(3);
  });

  it('nested map has prototype-free parents and children', () => {
    const drills = [attempt({ bucketId: 'air', archetypeId: 'pro' })];
    const { byBucketArchetype } = aggregateByBucketArchetype(drills);
    expect(Object.getPrototypeOf(byBucketArchetype)).toBeNull();
    expect(Object.getPrototypeOf(byBucketArchetype.air)).toBeNull();
  });
});
