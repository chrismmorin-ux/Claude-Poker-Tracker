/**
 * fragility.test.js — margin-to-flip and the flip register (founder directive 2026-08-03).
 *
 * The directive these enforce: a conclusion that reverses under new evidence is the system
 * working. A reversal that goes unrecorded is not. These tests assert the difference is kept.
 */

import { describe, it, expect } from 'vitest';
import {
  CONCLUSION_DIRECTIONS,
  buildMargin,
  buildFragility,
  buildFlipRegister,
  fragilityCaveat,
} from '../fragility.js';

describe('margin to flip', () => {
  it('computes the relative move needed to reverse the conclusion', () => {
    const m = buildMargin({ name: 'PRIOR_WEIGHT', value: 10, flipsAt: 11, sweptRange: [5, 20] });
    expect(m.relativeMove).toBeCloseTo(0.1);
  });

  it('REFUSES "does not flip" without a swept range', () => {
    expect(() => buildMargin({ name: 'ACTION_TAU_FRACTION', value: 0.3 }))
      .toThrow(/declares no swept range/);
  });

  it('explains that a narrow sweep reporting no flip is the shallow answer', () => {
    let msg = '';
    try { buildMargin({ name: 'X', value: 1 }); } catch (e) { msg = e.message; }
    expect(msg).toMatch(/where you looked/);
  });

  it('accepts no-flip when the swept range is declared', () => {
    const m = buildMargin({ name: 'MIN_CONTINUATION_WEIGHT', value: 0.05, sweptRange: [0.01, 0.2] });
    expect(m.flipsAt).toBeNull();
    expect(m.relativeMove).toBeNull();
  });

  it('requires a named input, so a reader can go look at it', () => {
    expect(() => buildMargin({ value: 1, sweptRange: [0, 2] })).toThrow(/must name its input/);
  });
});

describe('the fragility block', () => {
  it('flags a knife edge rather than leaving the reader to do arithmetic', () => {
    const f = buildFragility({
      margins: [
        buildMargin({ name: 'PRIOR_WEIGHT', value: 10, flipsAt: 10.5, sweptRange: [5, 20] }),
        buildMargin({ name: 'TAU', value: 0.3, flipsAt: 0.9, sweptRange: [0.1, 1] }),
      ],
    });
    expect(f.knifeEdge).toBe(true);
    expect(f.tightestInput).toBe('PRIOR_WEIGHT');
  });

  it('is not a knife edge when every input needs a large move', () => {
    const f = buildFragility({
      margins: [buildMargin({ name: 'A', value: 1, flipsAt: 3, sweptRange: [0, 5] })],
    });
    expect(f.knifeEdge).toBe(false);
  });

  it('names the inputs that were never swept to a flip point', () => {
    const f = buildFragility({
      margins: [buildMargin({ name: 'UNSWEPT', value: 1, sweptRange: [0.9, 1.1] })],
    });
    expect(f.unswept).toEqual(['UNSWEPT']);
  });

  it('does NOT collapse into a single confidence score', () => {
    const f = buildFragility({ margins: [] });
    expect(f).not.toHaveProperty('confidence');
    expect(f).not.toHaveProperty('score');
  });
});

describe('the flip register', () => {
  const prior = (direction, id) => ({ direction, resultCardId: id, at: '2026-01-01' });

  it('counts a reversal between two decided conclusions', () => {
    const r = buildFlipRegister({
      estimand: 'hero EV vs pool baseline',
      priorConclusions: [prior('supports', 'rc-1')],
      currentDirection: 'refutes',
    });
    expect(r.flipCount).toBe(1);
    expect(r.reversedThisRun).toBe(true);
  });

  it('counts repeated back-and-forth', () => {
    const r = buildFlipRegister({
      estimand: 'e',
      priorConclusions: [prior('supports', 'a'), prior('refutes', 'b'), prior('supports', 'c')],
      currentDirection: 'refutes',
    });
    expect(r.flipCount).toBe(3);
  });

  it('does NOT count an inconclusive run as a flip, and does not let it break the chain', () => {
    const r = buildFlipRegister({
      estimand: 'e',
      priorConclusions: [prior('supports', 'a'), prior('inconclusive', 'b')],
      currentDirection: 'supports',
    });
    expect(r.flipCount).toBe(0);
    expect(r.reversedThisRun).toBe(false);
    expect(r.inconclusiveRuns).toBe(1);
  });

  it('reports a stable conclusion as stable only after more than one decided run', () => {
    const first = buildFlipRegister({ estimand: 'e', priorConclusions: [], currentDirection: 'supports' });
    expect(first.everStable).toBe(false); // one run is not a track record

    const second = buildFlipRegister({
      estimand: 'e', priorConclusions: [prior('supports', 'a')], currentDirection: 'supports',
    });
    expect(second.everStable).toBe(true);
  });

  it('requires an estimand — a flip history only joins on what was measured', () => {
    expect(() => buildFlipRegister({ currentDirection: 'supports' })).toThrow(/estimand is required/);
  });

  it('refuses an unknown direction', () => {
    expect(() => buildFlipRegister({ estimand: 'e', currentDirection: 'probably' }))
      .toThrow(/must be one of/);
    expect(CONCLUSION_DIRECTIONS).toEqual(['supports', 'refutes', 'inconclusive']);
  });
});

describe('the caveat a report must print', () => {
  it('states the flip count so a fourth reversal cannot read like a first finding', () => {
    const r = buildFlipRegister({
      estimand: 'e',
      priorConclusions: [
        { direction: 'supports' }, { direction: 'refutes' }, { direction: 'supports' },
      ],
      currentDirection: 'refutes',
    });
    expect(fragilityCaveat(r, null)).toMatch(/REVERSED 3 time\(s\)/);
    expect(fragilityCaveat(r, null)).toMatch(/including this one/);
  });

  it('states a knife edge with the input named and the move quantified', () => {
    const f = buildFragility({
      margins: [buildMargin({ name: 'PRIOR_WEIGHT', value: 10, flipsAt: 10.2, sweptRange: [5, 20] })],
    });
    expect(fragilityCaveat(null, f)).toMatch(/knife edge/);
    expect(fragilityCaveat(null, f)).toMatch(/PRIOR_WEIGHT/);
  });

  it('names unswept inputs rather than implying they were checked', () => {
    const f = buildFragility({
      margins: [buildMargin({ name: 'NEVER_SWEPT', value: 1, sweptRange: [0.99, 1.01] })],
    });
    expect(fragilityCaveat(null, f)).toMatch(/no flip point is known for: NEVER_SWEPT/);
  });

  it('returns null when there is genuinely nothing to caveat', () => {
    const r = buildFlipRegister({ estimand: 'e', priorConclusions: [], currentDirection: 'supports' });
    const f = buildFragility({ margins: [buildMargin({ name: 'A', value: 1, flipsAt: 5, sweptRange: [0, 9] })] });
    expect(fragilityCaveat(r, f)).toBeNull();
  });
});
