import { describe, it, expect } from 'vitest';
import { synthesizeNodeFromAssumption, __TEST_ONLY__ } from '../baselineSynthesis';

const makeAssumption = (overrides = {}) => ({
  id: 'v42:foldToRiverBet@river',
  villainId: 'v42',
  claim: {
    predicate: 'foldToRiverBet',
    operator: '<=',
    threshold: 0.25,
    scope: {
      street: 'river',
      texture: 'wet',
      position: 'IP',
      sprRange: [2, 4],
      betSizeRange: [0.66, 1.0],
      playersToAct: 0,
    },
  },
  consequence: { deviationType: 'bluff-prune' },
  ...overrides,
});

describe('synthesizeNodeFromAssumption — basic shape', () => {
  it('returns a node with all required gameTree input fields', () => {
    const node = synthesizeNodeFromAssumption(makeAssumption(), { style: 'Fish' });
    expect(node).toHaveProperty('heroCards');
    expect(node).toHaveProperty('board');
    expect(node).toHaveProperty('villainRange');
    expect(node).toHaveProperty('potSize');
    expect(node).toHaveProperty('villainBet');
    expect(node).toHaveProperty('villainAction');
    expect(node).toHaveProperty('isIP');
    expect(node).toHaveProperty('effectiveStack');
    expect(node).toHaveProperty('street');
    expect(node).toHaveProperty('numOpponents', 1);
    expect(node).toHaveProperty('synthesized', true);
    expect(node).toHaveProperty('templateId');
    expect(node).toHaveProperty('display');
  });

  it('hero cards are 2 encoded integers in [0, 51]', () => {
    const node = synthesizeNodeFromAssumption(makeAssumption(), { style: 'Fish' });
    expect(node.heroCards).toHaveLength(2);
    for (const c of node.heroCards) {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(51);
    }
    // No duplicates
    expect(node.heroCards[0]).not.toBe(node.heroCards[1]);
  });

  it('board cards do not overlap with hero cards', () => {
    const node = synthesizeNodeFromAssumption(makeAssumption(), { style: 'Fish' });
    const boardSet = new Set(node.board);
    for (const heroCard of node.heroCards) {
      expect(boardSet.has(heroCard)).toBe(false);
    }
  });

  it('villainRange is a Float64Array of length 169', () => {
    const node = synthesizeNodeFromAssumption(makeAssumption(), { style: 'Fish' });
    expect(node.villainRange).toBeInstanceOf(Float64Array);
    expect(node.villainRange.length).toBe(169);
  });
});

describe('synthesizeNodeFromAssumption — street + texture handling', () => {
  it('river scope produces 5-card board', () => {
    const node = synthesizeNodeFromAssumption(makeAssumption({ claim: { ...makeAssumption().claim, scope: { ...makeAssumption().claim.scope, street: 'river' } } }), {});
    expect(node.board).toHaveLength(5);
    expect(node.street).toBe('river');
  });

  it('flop scope produces 3-card board', () => {
    const a = makeAssumption({ claim: { ...makeAssumption().claim, scope: { ...makeAssumption().claim.scope, street: 'flop' } } });
    const node = synthesizeNodeFromAssumption(a, {});
    expect(node.board).toHaveLength(3);
    expect(node.street).toBe('flop');
  });

  it('turn scope produces 4-card board', () => {
    const a = makeAssumption({ claim: { ...makeAssumption().claim, scope: { ...makeAssumption().claim.scope, street: 'turn' } } });
    const node = synthesizeNodeFromAssumption(a, {});
    expect(node.board).toHaveLength(4);
  });

  it('unknown street defaults to flop', () => {
    const a = makeAssumption({ claim: { ...makeAssumption().claim, scope: { ...makeAssumption().claim.scope, street: 'preflop' } } });
    const node = synthesizeNodeFromAssumption(a, {});
    expect(node.street).toBe('flop');
  });

  it('texture wet → wet template; texture dry → dry template', () => {
    const wet = synthesizeNodeFromAssumption(makeAssumption(), {});
    const a2 = makeAssumption({ claim: { ...makeAssumption().claim, scope: { ...makeAssumption().claim.scope, texture: 'dry' } } });
    const dry = synthesizeNodeFromAssumption(a2, {});
    // Different texture should produce different boards (wet T96 vs dry A72)
    expect(wet.display.texture).toBe('wet');
    expect(dry.display.texture).toBe('dry');
    expect(wet.display.board).not.toEqual(dry.display.board);
  });

  it('texture medium / unknown defaults to wet', () => {
    const a = makeAssumption({ claim: { ...makeAssumption().claim, scope: { ...makeAssumption().claim.scope, texture: 'medium' } } });
    const node = synthesizeNodeFromAssumption(a, {});
    expect(node.display.texture).toBe('wet');
  });
});

describe('synthesizeNodeFromAssumption — position + isIP', () => {
  it('IP scope sets isIP=true', () => {
    const node = synthesizeNodeFromAssumption(makeAssumption(), {});
    expect(node.isIP).toBe(true);
  });

  it('OOP scope sets isIP=false', () => {
    const a = makeAssumption({ claim: { ...makeAssumption().claim, scope: { ...makeAssumption().claim.scope, position: 'OOP' } } });
    const node = synthesizeNodeFromAssumption(a, {});
    expect(node.isIP).toBe(false);
  });
});

describe('synthesizeNodeFromAssumption — deviation-type → hero holding', () => {
  it.each([
    'bluff-prune',
    'value-expand',
    'range-bet',
    'sizing-shift',
    'spot-skip',
    'line-change',
  ])('produces a hero holding for deviationType=%s', (deviationType) => {
    const a = makeAssumption({ consequence: { deviationType } });
    const node = synthesizeNodeFromAssumption(a, {});
    expect(node.heroCards).toHaveLength(2);
    expect(node.templateId).toContain(deviationType);
  });

  it('unknown deviation type still produces a valid hero holding (default fallback)', () => {
    const a = makeAssumption({ consequence: { deviationType: 'never-heard-of-this' } });
    const node = synthesizeNodeFromAssumption(a, {});
    expect(node.heroCards).toHaveLength(2);
  });
});

describe('synthesizeNodeFromAssumption — style → villain range', () => {
  it.each(['Fish', 'Nit', 'LAG', 'TAG', 'Unknown'])('produces a villain range for style=%s', (style) => {
    const node = synthesizeNodeFromAssumption(makeAssumption(), { style });
    expect(node.villainRange).toBeInstanceOf(Float64Array);
    expect(node.villainRange.length).toBe(169);
    // Some non-zero cell should exist
    let nonzero = 0;
    for (let i = 0; i < 169; i++) if (node.villainRange[i] > 0) nonzero++;
    expect(nonzero).toBeGreaterThan(0);
  });

  it('Nit produces a tighter range than Fish', () => {
    const fish = synthesizeNodeFromAssumption(makeAssumption(), { style: 'Fish' });
    const nit = synthesizeNodeFromAssumption(makeAssumption(), { style: 'Nit' });
    let fishCount = 0;
    let nitCount = 0;
    for (let i = 0; i < 169; i++) {
      if (fish.villainRange[i] > 0) fishCount++;
      if (nit.villainRange[i] > 0) nitCount++;
    }
    expect(fishCount).toBeGreaterThan(nitCount);
  });
});

describe('synthesizeNodeFromAssumption — pot + bet derivation', () => {
  it('uses sprRange midpoint for effective stack', () => {
    const a = makeAssumption({
      claim: { ...makeAssumption().claim, scope: { ...makeAssumption().claim.scope, sprRange: [2, 6] } },
    });
    const node = synthesizeNodeFromAssumption(a, {});
    // sprMid=4, river → potSize=22, effective=22*4=88
    expect(node.effectiveStack).toBe(88);
  });

  it('uses betSizeRange midpoint for villainBet when villain bets', () => {
    const a = makeAssumption({
      consequence: { deviationType: 'line-change' }, // not aggressor → villain bets
      claim: { ...makeAssumption().claim, scope: { ...makeAssumption().claim.scope, betSizeRange: [0.5, 1.0] } },
    });
    const node = synthesizeNodeFromAssumption(a, {});
    expect(node.villainAction).toBe('bet');
    // betMid=0.75 × pot=22 = 16.5
    expect(node.villainBet).toBeCloseTo(16.5, 1);
  });

  it('hero-aggressor deviations produce villainAction=check + villainBet=0', () => {
    for (const deviationType of ['bluff-prune', 'value-expand', 'range-bet', 'sizing-shift']) {
      const a = makeAssumption({ consequence: { deviationType } });
      const node = synthesizeNodeFromAssumption(a, {});
      expect(node.villainAction).toBe('check');
      expect(node.villainBet).toBe(0);
    }
  });
});

describe('synthesizeNodeFromAssumption — display field for UI disclosure', () => {
  it('display includes street + texture + position + style + board strings', () => {
    const node = synthesizeNodeFromAssumption(makeAssumption(), { style: 'Fish' });
    expect(node.display).toEqual({
      board: expect.any(Array),
      texture: 'wet',
      position: 'IP',
      style: 'Fish',
      street: 'river',
    });
    expect(node.display.board.every((c) => typeof c === 'string')).toBe(true);
  });
});

describe('synthesizeNodeFromAssumption — error handling', () => {
  it('throws on null assumption', () => {
    expect(() => synthesizeNodeFromAssumption(null, {})).toThrow(/required/);
  });

  it('throws on missing claim.scope', () => {
    expect(() => synthesizeNodeFromAssumption({ id: 'x' }, {})).toThrow(/scope/);
  });
});

describe('__TEST_ONLY__ exports', () => {
  it('exposes BOARD_TEMPLATES + HERO_HOLDING_BY_DEVIATION + VILLAIN_RANGE_STRINGS for inspection', () => {
    expect(__TEST_ONLY__.BOARD_TEMPLATES).toBeDefined();
    expect(__TEST_ONLY__.BOARD_TEMPLATES.wet.flop).toBeDefined();
    expect(__TEST_ONLY__.BOARD_TEMPLATES.dry.river).toBeDefined();
    expect(__TEST_ONLY__.HERO_HOLDING_BY_DEVIATION['bluff-prune']).toBeDefined();
    expect(__TEST_ONLY__.VILLAIN_RANGE_STRINGS.Fish).toBeDefined();
  });
});
