import { describe, it, expect } from 'vitest';
import {
  evaluateDrillNode,
  villainFoldRateFromComposition,
  HERO_BUCKET_TYPICAL_EQUITY,
  DEFAULT_ACTIONS,
} from '../drillModeEngine';
import { buildArchetypeWeightedRange } from '../archetypeRangeBuilder';
import { parseRangeString } from '../../pokerCore/rangeMatrix';
import { parseBoard } from '../../pokerCore/cardParser';
import { archetypeRangeFor } from '../archetypeRanges';

const flop = (...cards) => parseBoard(cards);

describe('HERO_BUCKET_TYPICAL_EQUITY', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(HERO_BUCKET_TYPICAL_EQUITY)).toBe(true);
  });
  it('covers the canonical RT-110 buckets (tptk, set, flushDraw, air)', () => {
    for (const k of ['tptk', 'set', 'flushDraw', 'air']) {
      expect(typeof HERO_BUCKET_TYPICAL_EQUITY[k]).toBe('number');
      expect(HERO_BUCKET_TYPICAL_EQUITY[k]).toBeGreaterThanOrEqual(0);
      expect(HERO_BUCKET_TYPICAL_EQUITY[k]).toBeLessThanOrEqual(1);
    }
  });
  it('set > tptk > topPair > air (coarse monotonicity)', () => {
    expect(HERO_BUCKET_TYPICAL_EQUITY.set).toBeGreaterThan(HERO_BUCKET_TYPICAL_EQUITY.tptk);
    expect(HERO_BUCKET_TYPICAL_EQUITY.tptk).toBeGreaterThan(HERO_BUCKET_TYPICAL_EQUITY.topPair);
    expect(HERO_BUCKET_TYPICAL_EQUITY.topPair).toBeGreaterThan(HERO_BUCKET_TYPICAL_EQUITY.air);
  });
});

describe('DEFAULT_ACTIONS', () => {
  it('is frozen and contains check + 3 bet sizings', () => {
    expect(Object.isFrozen(DEFAULT_ACTIONS)).toBe(true);
    const kinds = DEFAULT_ACTIONS.map((a) => a.kind);
    expect(kinds).toContain('check');
    expect(kinds.filter((k) => k === 'bet').length).toBe(3);
  });
});

describe('villainFoldRateFromComposition', () => {
  it('returns 0 for an empty weighted range', () => {
    expect(villainFoldRateFromComposition({ totalWeight: 0, combos: [] })).toBe(0);
  });

  it('fish-reweighted range folds less than reg-reweighted same range', () => {
    const range = archetypeRangeFor({ position: 'BTN', action: 'open' });
    const board = flop('K♠', '7♥', '2♦');
    const fish = buildArchetypeWeightedRange({ archetype: 'fish', baseRange: range, board });
    const reg  = buildArchetypeWeightedRange({ archetype: 'reg',  baseRange: range, board });
    const fishFold = villainFoldRateFromComposition(fish);
    const regFold  = villainFoldRateFromComposition(reg);
    // Fish up-weights marginal/strong → more calls → lower fold rate.
    expect(fishFold).toBeLessThan(regFold);
  });

  it('bounded in [0, 1]', () => {
    const range = archetypeRangeFor({ position: 'BTN', action: 'open' });
    const board = flop('T♥', '9♥', '6♠');
    for (const archetype of ['fish', 'reg', 'pro']) {
      const w = buildArchetypeWeightedRange({ archetype, baseRange: range, board });
      const f = villainFoldRateFromComposition(w);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });
});

describe('evaluateDrillNode — input validation', () => {
  const basic = (overrides = {}) => ({
    bucketId: 'tptk',
    archetype: 'reg',
    heroRange: archetypeRangeFor({ position: 'BTN', action: 'open' }),
    villainRange: archetypeRangeFor({ position: 'BB', action: 'call', vs: 'BTN' }),
    board: flop('T♥', '9♥', '6♠'),
    pot: 10,
    ...overrides,
  });

  it('throws on missing bucketId', async () => {
    await expect(evaluateDrillNode(basic({ bucketId: '' }))).rejects.toThrow(/bucketId required/);
  });

  it('throws on unknown archetype', async () => {
    await expect(evaluateDrillNode(basic({ archetype: 'whale' }))).rejects.toThrow(/unknown archetype/);
  });

  it('throws on unknown bucketId', async () => {
    await expect(evaluateDrillNode(basic({ bucketId: 'not-a-bucket' }))).rejects.toThrow(/unknown bucketId/);
  });

  it('throws on invalid board', async () => {
    await expect(evaluateDrillNode(basic({ board: [] }))).rejects.toThrow(/3-5 encoded cards/);
  });

  it('throws on negative pot', async () => {
    await expect(evaluateDrillNode(basic({ pot: -1 }))).rejects.toThrow(/non-negative number/);
  });

  it('throws on empty actions array', async () => {
    await expect(evaluateDrillNode(basic({ actions: [] }))).rejects.toThrow(/non-empty array/);
  });
});

describe('evaluateDrillNode — output shape', () => {
  const basic = {
    bucketId: 'tptk',
    archetype: 'reg',
    heroRange: archetypeRangeFor({ position: 'BTN', action: 'open' }),
    villainRange: archetypeRangeFor({ position: 'BB', action: 'call', vs: 'BTN' }),
    board: flop('T♥', '9♥', '6♠'),
    pot: 10,
  };

  it('returns the full documented shape', async () => {
    const out = await evaluateDrillNode(basic);
    expect(out).toHaveProperty('bucketId', 'tptk');
    expect(out).toHaveProperty('archetype', 'reg');
    expect(out).toHaveProperty('sampleSize');
    expect(out).toHaveProperty('evs');
    expect(out).toHaveProperty('ranking');
    expect(out).toHaveProperty('bailedOut', false);
    expect(Array.isArray(out.caveats)).toBe(true);
  });

  it('evs map has an entry per default action', async () => {
    const out = await evaluateDrillNode(basic);
    for (const a of DEFAULT_ACTIONS) {
      expect(out.evs[a.id]).toBeDefined();
      expect(typeof out.evs[a.id].ev).toBe('number');
    }
  });

  it('ranking orders action IDs by EV descending', async () => {
    const out = await evaluateDrillNode(basic);
    for (let i = 0; i < out.ranking.length - 1; i += 1) {
      const higher = out.evs[out.ranking[i]].ev;
      const lower  = out.evs[out.ranking[i + 1]].ev;
      expect(higher).toBeGreaterThanOrEqual(lower);
    }
  });

  it('ranking length equals actions length', async () => {
    const out = await evaluateDrillNode(basic);
    expect(out.ranking.length).toBe(DEFAULT_ACTIONS.length);
  });

  it('evs uses prototype-free map (NEV-12)', async () => {
    const out = await evaluateDrillNode(basic);
    expect(Object.getPrototypeOf(out.evs)).toBeNull();
  });
});

describe('evaluateDrillNode — caveats', () => {
  const basic = (overrides = {}) => ({
    bucketId: 'tptk',
    archetype: 'reg',
    heroRange: archetypeRangeFor({ position: 'BTN', action: 'open' }),
    villainRange: archetypeRangeFor({ position: 'BB', action: 'call', vs: 'BTN' }),
    board: flop('T♥', '9♥', '6♠'),
    pot: 10,
    ...overrides,
  });

  it('always includes synthetic-range caveat (per owner Q2)', async () => {
    const out = await evaluateDrillNode(basic());
    expect(out.caveats).toContain('synthetic-range');
  });

  it('always includes v1-simplified-ev caveat when depth2Eval not provided', async () => {
    const out = await evaluateDrillNode(basic());
    expect(out.caveats).toContain('v1-simplified-ev');
  });

  it('omits v1-simplified-ev when depth2Eval injection is provided', async () => {
    const depth2Eval = { wasBailout: () => false };
    const out = await evaluateDrillNode(basic({ depth2Eval }));
    expect(out.caveats).not.toContain('v1-simplified-ev');
  });

  it('includes time-budget-bailout when depth2Eval.wasBailout() returns true', async () => {
    const depth2Eval = { wasBailout: () => true };
    const out = await evaluateDrillNode(basic({ depth2Eval }));
    expect(out.bailedOut).toBe(true);
    expect(out.caveats).toContain('time-budget-bailout');
  });

  it('adds empty-bucket when sampleSize === 0', async () => {
    // Force a bucket with zero live combos: hero has AA range (6 combos) —
    // zero combos classify as nutFlushDraw on a rainbow board.
    const out = await evaluateDrillNode(basic({
      bucketId: 'nutFlushDraw',
      heroRange: parseRangeString('AA'),
      board: flop('K♠', '7♥', '2♦'),
    }));
    expect(out.sampleSize).toBe(0);
    expect(out.caveats).toContain('empty-bucket');
    expect(out.caveats).not.toContain('low-sample-bucket');
  });

  it('adds low-sample-bucket when 0 < sampleSize < MIN_COMBO_SAMPLE', async () => {
    // QQ on Q♠Q♥2♦ → only Q♣Q♦ survives (1 combo).
    const out = await evaluateDrillNode(basic({
      bucketId: 'quads',
      heroRange: parseRangeString('QQ'),
      board: flop('Q♠', 'Q♥', '2♦'),
    }));
    expect(out.sampleSize).toBe(1);
    expect(out.caveats).toContain('low-sample-bucket');
    expect(out.caveats).not.toContain('empty-bucket');
  });

  it('omits low-sample-bucket when sampleSize ≥ 3', async () => {
    const out = await evaluateDrillNode(basic());
    expect(out.sampleSize).toBeGreaterThanOrEqual(3);
    expect(out.caveats).not.toContain('low-sample-bucket');
    expect(out.caveats).not.toContain('empty-bucket');
  });
});

describe('evaluateDrillNode — archetype responsiveness', () => {
  const basic = (archetype) => ({
    bucketId: 'tptk',
    archetype,
    heroRange: archetypeRangeFor({ position: 'BTN', action: 'open' }),
    villainRange: archetypeRangeFor({ position: 'BB', action: 'call', vs: 'BTN' }),
    board: flop('T♥', '9♥', '6♠'),
    pot: 10,
  });

  it('fish archetype produces different bet EVs than reg (fold rate shifts)', async () => {
    const fish = await evaluateDrillNode(basic('fish'));
    const reg  = await evaluateDrillNode(basic('reg'));
    // Different archetype → different weighted bucket mix → different fold rate
    // → different bet EV. Can't predict direction without knowing specifics;
    // just assert they diverge (the bet_75 EV should differ).
    expect(fish.evs.bet_75.ev).not.toBe(reg.evs.bet_75.ev);
  });

  it('check EV is same across archetypes (v1 simplification)', async () => {
    // Check in v1 is heroEq × pot — doesn't depend on archetype composition.
    // This is a known v1 limitation; depth-2 integration will introduce
    // archetype-dependent betting behavior on future streets.
    const fish = await evaluateDrillNode(basic('fish'));
    const reg  = await evaluateDrillNode(basic('reg'));
    expect(fish.evs.check.ev).toBe(reg.evs.check.ev);
  });
});
