import { describe, it, expect } from 'vitest';
import { computeEmotionalState } from '../emotionalStateComputer';
import { rangeIndex } from '../../pokerCore/rangeMatrix';

const makeRange = () => new Float64Array(169);
const setCell = (range, rank1, rank2, suited, weight) => {
  range[rangeIndex(rank1, rank2, suited)] = weight;
  return range;
};

describe('computeEmotionalState — schema shape', () => {
  it('returns all schema-required fields', () => {
    const state = computeEmotionalState(makeRange(), {}, {});
    expect(state).toHaveProperty('fearIndex');
    expect(state).toHaveProperty('greedIndex');
    expect(state).toHaveProperty('netTilt');
    expect(state).toHaveProperty('joint');
    expect(state).toHaveProperty('sources');
    expect(state).toHaveProperty('computedAt');
    expect(state).toHaveProperty('nodeId');
  });

  it('joint tuple matches [fearIndex, greedIndex] (owner directive 2026-04-23 preservation)', () => {
    const r = makeRange();
    setCell(r, 12, 12, false, 1.0);
    const state = computeEmotionalState(r, { spr: 1 }, { villainBBDelta: 500 });
    expect(state.joint).toEqual([state.fearIndex, state.greedIndex]);
  });

  it('netTilt is derived as greed − fear', () => {
    const r = makeRange();
    setCell(r, 12, 12, false, 1.0);
    const state = computeEmotionalState(r, { spr: 1 }, { villainBBDelta: 500 });
    expect(state.netTilt).toBeCloseTo(state.greedIndex - state.fearIndex, 6);
  });

  it('threads nodeId through from gameState', () => {
    const state = computeEmotionalState(makeRange(), { nodeId: 'flop_root' }, {});
    expect(state.nodeId).toBe('flop_root');
  });

  it('defaults nodeId to null when absent', () => {
    const state = computeEmotionalState(makeRange(), {}, {});
    expect(state.nodeId).toBeNull();
  });

  it('computedAt is a valid ISO string', () => {
    const state = computeEmotionalState(makeRange(), {}, {});
    expect(() => new Date(state.computedAt).toISOString()).not.toThrow();
    expect(new Date(state.computedAt).toISOString()).toBe(state.computedAt);
  });
});

describe('computeEmotionalState — quadrant populations', () => {
  const topRange = () => {
    const r = makeRange();
    setCell(r, 12, 12, false, 1.0); // AA
    setCell(r, 11, 11, false, 1.0); // KK
    return r;
  };

  const bottomRange = () => {
    const r = makeRange();
    setCell(r, 5, 0, false, 1.0); // 72o
    setCell(r, 6, 1, false, 1.0); // 83o
    return r;
  };

  it('top-heavy range + heater + low SPR lands in high-greed low-fear quadrant', () => {
    const state = computeEmotionalState(topRange(), { spr: 1 }, { villainBBDelta: 500 });
    expect(state.greedIndex).toBeGreaterThan(0.7);
    expect(state.fearIndex).toBe(0); // no bottom share, no SPR fear, not stuck
    expect(state.joint[1] - state.joint[0]).toBeGreaterThan(0.5);
  });

  it('bottom-heavy range + stuck + deep SPR lands in high-fear low-greed quadrant', () => {
    const state = computeEmotionalState(bottomRange(), { spr: 12 }, { villainBBDelta: -500 });
    expect(state.fearIndex).toBeGreaterThan(0.7);
    expect(state.greedIndex).toBe(0);
    expect(state.joint[0] - state.joint[1]).toBeGreaterThan(0.5);
  });

  it('empty-data case yields zero-zero quadrant', () => {
    const state = computeEmotionalState(makeRange(), {}, {});
    expect(state.fearIndex).toBe(0);
    expect(state.greedIndex).toBe(0);
    expect(state.netTilt).toBe(0);
  });

  it('bottom-heavy range + heater populates (high fear, high greed) quadrant — the interesting one', () => {
    // This tests the schema §6 "fourth quadrant" — the scenario owner explicitly called out.
    // Villain has a lot of weak hands but is on a heater (winning all session).
    const state = computeEmotionalState(bottomRange(), { spr: 12 }, { villainBBDelta: 500 });
    expect(state.fearIndex).toBeGreaterThan(0.5);
    expect(state.greedIndex).toBeGreaterThan(0.15); // heaterGreed contributes 0.2 weight
  });
});

describe('computeEmotionalState — input resolution', () => {
  it('accepts Float64Array directly', () => {
    const state = computeEmotionalState(new Float64Array(169), {}, {});
    expect(state.fearIndex).toBe(0);
  });

  it('accepts array of length 169', () => {
    const arr = new Array(169).fill(0);
    const state = computeEmotionalState(arr, {}, {});
    expect(state.fearIndex).toBe(0);
  });

  it('accepts { weights: Float64Array }', () => {
    const state = computeEmotionalState({ weights: new Float64Array(169) }, {}, {});
    expect(state.fearIndex).toBe(0);
  });

  it('accepts options.activeRangeWeights override', () => {
    const explicit = new Float64Array(169);
    explicit[rangeIndex(12, 12, false)] = 1.0;
    const state = computeEmotionalState({ unrelated: true }, { spr: 1 }, { villainBBDelta: 500 }, {
      activeRangeWeights: explicit,
    });
    expect(state.greedIndex).toBeGreaterThan(0);
  });

  it('returns zero state for unrecognized input shape', () => {
    const state = computeEmotionalState({ unrecognized: true }, {}, {});
    expect(state.fearIndex).toBe(0);
    expect(state.greedIndex).toBe(0);
  });
});
