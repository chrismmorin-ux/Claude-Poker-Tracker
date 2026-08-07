/**
 * beliefStatePacking.test.js — WS-430.
 *
 * The packed encodings are only worth anything because they refuse:
 *
 *   f32   lossless at float32 precision — a round-trip must reproduce every value to
 *         Math.fround exactly, not approximately.
 *   q8    lossy with a STATED bound (scale/510) — the test holds the implementation to the
 *         bound the docs promise, because an unbounded "small" error is a shape argument.
 *   both  refuse a class-order mismatch. Decoding under the wrong order permutes every
 *         probability onto the wrong hand class and never looks wrong downstream.
 */

import { describe, it, expect } from 'vitest';

import {
  packGridF32, unpackGridF32, packGridQ8, unpackGridQ8,
  packBeliefState, unpackBeliefState, classOrderHash, q8MaxAbsError,
  BELIEF_STATE_SCHEMAS, BeliefStatePackingError,
} from '../backtest/beliefStatePacking.mjs';

const GRID_SIZE = 169; // mirrors populationPriors.js:26 — the 169-class grid

// Deterministic realistic-ish grid: propensities in [0, 1), many small, a few near 1.
const mkGrid = (seed = 1) => {
  let h = seed >>> 0;
  const rnd = () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 2 ** 32;
  };
  return Array.from({ length: GRID_SIZE }, () => {
    const r = rnd();
    return r > 0.9 ? r : r * 0.15;
  });
};

const CLASS_ORDER = Array.from({ length: GRID_SIZE }, (_, i) => `class-${i}`);

const verbose = (nOpponents, seed = 7) => ({
  schema: BELIEF_STATE_SCHEMAS.verbose,
  opponents: Array.from({ length: nOpponents }, (_, o) => {
    const grid = mkGrid(seed + o);
    const classProbs = {};
    CLASS_ORDER.forEach((name, i) => { classProbs[name] = grid[i]; });
    return { seat: o + 1, classProbs };
  }),
});

describe('grid packing — f32 lossless, q8 bounded', () => {
  it('f32 round-trips every value to float32 precision exactly', () => {
    const grid = mkGrid(3);
    const out = unpackGridF32(packGridF32(grid));
    expect(out).toHaveLength(GRID_SIZE);
    out.forEach((v, i) => expect(v).toBe(Math.fround(grid[i])));
  });

  it('f32 payload is exactly 4 bytes per class before base64', () => {
    const b64 = packGridF32(mkGrid(4));
    expect(Buffer.from(b64, 'base64').byteLength).toBe(GRID_SIZE * 4); // 676
  });

  it('q8 round-trips within the documented bound of scale/510', () => {
    const grid = mkGrid(5);
    const packed = packGridQ8(grid);
    expect(Buffer.from(packed.grid, 'base64').byteLength).toBe(GRID_SIZE); // 169
    const out = unpackGridQ8(packed);
    const bound = q8MaxAbsError(packed.scale);
    out.forEach((v, i) => expect(Math.abs(v - grid[i])).toBeLessThanOrEqual(bound));
  });

  it('q8 packs an all-zero grid with scale 0 and unpacks it to zeros exactly', () => {
    const packed = packGridQ8(new Array(GRID_SIZE).fill(0));
    expect(packed.scale).toBe(0);
    expect(unpackGridQ8(packed)).toEqual(new Array(GRID_SIZE).fill(0));
  });

  it('refuses a non-finite or negative propensity rather than defaulting it', () => {
    const bad = mkGrid(6); bad[42] = NaN;
    expect(() => packGridF32(bad)).toThrow(BeliefStatePackingError);
    const neg = mkGrid(6); neg[3] = -0.1;
    expect(() => packGridQ8(neg)).toThrow(/negative/);
  });

  it('refuses a truncated f32 payload', () => {
    expect(() => unpackGridF32(Buffer.from([1, 2, 3]).toString('base64')))
      .toThrow(/not a multiple of 4/);
  });
});

describe('beliefState packing — class order injected, stamped, and enforced', () => {
  it.each(['f32', 'q8'])('%s round-trips a multi-opponent beliefState', (encoding) => {
    const v = verbose(3);
    const packed = packBeliefState(v, { encoding, classOrder: CLASS_ORDER });
    expect(packed.schema).toBe(BELIEF_STATE_SCHEMAS[encoding]);
    expect(packed.classCount).toBe(GRID_SIZE);
    expect(packed.classOrderHash).toBe(classOrderHash(CLASS_ORDER));
    expect(packed.opponents).toHaveLength(3);

    const back = unpackBeliefState(packed, { classOrder: CLASS_ORDER });
    expect(back.opponents.map((o) => o.seat)).toEqual([1, 2, 3]);
    const tolerance = encoding === 'f32' ? 1e-7 : 1 / 510 + 1e-12; // scale ≤ 1 here
    back.opponents.forEach((opp, o) => {
      CLASS_ORDER.forEach((name) => {
        expect(Math.abs(opp.classProbs[name] - v.opponents[o].classProbs[name]))
          .toBeLessThanOrEqual(tolerance);
      });
    });
  });

  it('REFUSES to unpack under a different class order — the permutation would never look wrong', () => {
    const packed = packBeliefState(verbose(1), { encoding: 'f32', classOrder: CLASS_ORDER });
    const reordered = [...CLASS_ORDER].reverse();
    expect(() => unpackBeliefState(packed, { classOrder: reordered }))
      .toThrow(/refusing to permute/);
  });

  it('refuses an opponent missing a class — "zero" and "never computed" must not alias', () => {
    const v = verbose(1);
    delete v.opponents[0].classProbs['class-100'];
    expect(() => packBeliefState(v, { encoding: 'q8', classOrder: CLASS_ORDER }))
      .toThrow(/missing class "class-100"/);
  });

  it('refuses an unknown encoding and an unknown schema', () => {
    expect(() => packBeliefState(verbose(1), { encoding: 'f64', classOrder: CLASS_ORDER }))
      .toThrow(/encoding must be/);
    expect(() => unpackBeliefState({ schema: 'beliefState.zstd.v9' }, { classOrder: CLASS_ORDER }))
      .toThrow(/unknown schema/);
  });

  it('passes a verbose beliefState through unpack unchanged', () => {
    const v = verbose(2);
    expect(unpackBeliefState(v, { classOrder: CLASS_ORDER })).toBe(v);
  });
});
