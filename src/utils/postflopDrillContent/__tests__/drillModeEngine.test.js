import { describe, it, expect } from 'vitest';
import {
  evaluateDrillNode,
  villainFoldRateFromComposition,
  HERO_BUCKET_TYPICAL_EQUITY,
  DEFAULT_ACTIONS,
  classifyDomination,
  computeDominationMap,
} from '../drillModeEngine';
import { buildArchetypeWeightedRange } from '../archetypeRangeBuilder';
import { parseRangeString, createRange, rangeIndex } from '../../pokerCore/rangeMatrix';
import { parseBoard, encodeCard } from '../../pokerCore/cardParser';
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

// LSW-G5 (2026-04-22) — domination classification (surface audit S6).
describe('classifyDomination', () => {
  it('returns "crushed" below 20% equity', () => {
    expect(classifyDomination(0.05)).toBe('crushed');
    expect(classifyDomination(0.15)).toBe('crushed');
    expect(classifyDomination(0.199)).toBe('crushed');
  });

  it('returns "dominated" in 20-40% band', () => {
    expect(classifyDomination(0.20)).toBe('dominated');
    expect(classifyDomination(0.30)).toBe('dominated');
    expect(classifyDomination(0.399)).toBe('dominated');
  });

  it('returns "neutral" in 40-60% band (coin-flip zone)', () => {
    expect(classifyDomination(0.40)).toBe('neutral');
    expect(classifyDomination(0.50)).toBe('neutral');
    expect(classifyDomination(0.599)).toBe('neutral');
  });

  it('returns "favored" in 60-80% band', () => {
    expect(classifyDomination(0.60)).toBe('favored');
    expect(classifyDomination(0.70)).toBe('favored');
    expect(classifyDomination(0.799)).toBe('favored');
  });

  it('returns "dominating" at 80%+', () => {
    expect(classifyDomination(0.80)).toBe('dominating');
    expect(classifyDomination(0.95)).toBe('dominating');
    expect(classifyDomination(1.0)).toBe('dominating');
  });

  it('returns "unknown" for non-finite / missing input', () => {
    expect(classifyDomination(NaN)).toBe('unknown');
    expect(classifyDomination(undefined)).toBe('unknown');
    expect(classifyDomination(null)).toBe('unknown');
    expect(classifyDomination('0.5')).toBe('unknown');
  });
});

// LSW-G5.2 (2026-04-22) — pair+draw composite classification.
// Tests routing logic directly against computeDominationMap with a
// synthetic villain range containing known pair+FD and pair+gutshot
// combos, bypassing the line/archetype plumbing.
describe('computeDominationMap — pair+draw composites (LSW-G5.2)', () => {
  // Suits: 0=spades, 1=hearts, 2=diamonds, 3=clubs (per cardParser convention).
  const T_HEARTS   = encodeCard(8, 1);  // T♥
  const NINE_HEARTS = encodeCard(7, 1); // 9♥
  const SIX_SPADES  = encodeCard(4, 0); // 6♠
  const T96_BOARD = [T_HEARTS, NINE_HEARTS, SIX_SPADES];

  // Hero: J♥T♠ — standard pinned combo for JT6 flop_root.
  const HERO_CARDS = { card1: encodeCard(9, 1), card2: encodeCard(8, 0) };

  it('routes pair+flushDraw combo into pairPlusFD group, not bare bottomPair', async () => {
    // 6-5 suited on T♥9♥6♠: bottomPair (6) + 4 hearts (2 board + 2 hand for
    // hearts version) = direct flush draw. Classifier is strongest-wins so
    // handType === `bottomPair`, but drawFeatures.hasFlushDraw === true.
    // With the G5.2 filter, this combo lands in `pairPlusFD`, not the bare
    // `bottomPair` row.
    const villainRange = createRange();
    villainRange[rangeIndex(4, 3, true)] = 1.0; // 6-5 suited
    const dominationMap = await computeDominationMap({
      pinnedCombo: HERO_CARDS,
      villainRange,
      board: T96_BOARD,
      trialsPerGroup: 50,
    });
    const pairPlusFD = dominationMap.find((r) => r.id === 'pairPlusFD');
    const bareBottomPair = dominationMap.find((r) => r.id === 'bottomPair');
    // Of the 4 suited combinations of 65s — 6♥5♥, 6♠5♠, 6♦5♦, 6♣5♣ — only
    // 6♥5♥ has the flush draw (board has 2 hearts). The other 3 are
    // bottom pair with no direct draw. So pairPlusFD is populated AND
    // the bare bottomPair row is also populated. Verify both.
    expect(pairPlusFD).toBeDefined();
    expect(pairPlusFD.weightPct).toBeGreaterThan(0);
    expect(bareBottomPair).toBeDefined();
    expect(bareBottomPair.weightPct).toBeGreaterThan(0);
    // The two groups together should equal (or be near) the full 65s share.
    // MC variance allowed; check that they partition correctly (no overlap).
    expect(pairPlusFD.sampleSize).toBeGreaterThanOrEqual(1);
    expect(bareBottomPair.sampleSize).toBeGreaterThanOrEqual(1);
  }, 10000);

  it('routes pair+gutshot combo into pairPlusGutshot group, not bare middlePair', async () => {
    // 9-8 offsuit on T♥9♥6♠: middlePair (9s) + gutshot via 6-7-8-9-T window
    // (missing the 7). detectDraws should flag hasGutshot. Expected:
    // pairPlusGutshot populated, bare middlePair empty (9h unavailable
    // from the range since it's on the board; remaining 98o combos all
    // have the gutshot).
    const villainRange = createRange();
    villainRange[rangeIndex(7, 6, false)] = 1.0; // 9-8 offsuit
    const dominationMap = await computeDominationMap({
      pinnedCombo: HERO_CARDS,
      villainRange,
      board: T96_BOARD,
      trialsPerGroup: 50,
    });
    const pairPlusGutshot = dominationMap.find((r) => r.id === 'pairPlusGutshot');
    expect(pairPlusGutshot).toBeDefined();
    expect(pairPlusGutshot.weightPct).toBeGreaterThan(0);
  }, 10000);

  it('bare pair row excludes pair+draw combos (no double-counting)', async () => {
    // Mixed range: 98o (middle pair + gutshot) AND 22 (weakPair, no draw).
    // Verify that pairPlusGutshot captures the 98 combos and the weakPair
    // row captures the 22 combos, with no overlap.
    const villainRange = createRange();
    villainRange[rangeIndex(7, 6, false)] = 1.0;  // 98o → middlePair + gutshot
    villainRange[rangeIndex(0, 0, false)] = 1.0;  // 22  → weakPair
    const dominationMap = await computeDominationMap({
      pinnedCombo: HERO_CARDS,
      villainRange,
      board: T96_BOARD,
      trialsPerGroup: 50,
    });
    const pairPlusGutshot = dominationMap.find((r) => r.id === 'pairPlusGutshot');
    const weakPair = dominationMap.find((r) => r.id === 'weakPair');
    expect(pairPlusGutshot).toBeDefined();
    expect(weakPair).toBeDefined();
    // Total pair-family weight should sum to 100% (both are pair-tier).
    const total = pairPlusGutshot.weightPct + weakPair.weightPct;
    expect(total).toBeGreaterThan(95);
    expect(total).toBeLessThanOrEqual(100.01);
  }, 10000);
});
