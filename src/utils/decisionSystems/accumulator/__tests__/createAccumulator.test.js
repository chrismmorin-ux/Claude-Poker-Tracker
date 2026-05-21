import { describe, it, expect } from 'vitest';
import { createAccumulator } from '../createAccumulator';

describe('createAccumulator', () => {
  it('throws if opts is missing', () => {
    expect(() => createAccumulator()).toThrow(TypeError);
  });

  it('throws if reduce is not a function', () => {
    expect(() => createAccumulator({ initialState: 0 })).toThrow(TypeError);
  });

  it('throws if initialState is missing', () => {
    expect(() => createAccumulator({ reduce: (s) => s })).toThrow(TypeError);
  });

  describe('fold', () => {
    it('reduces a sequence of observations', () => {
      const acc = createAccumulator({
        initialState: 0,
        reduce: (sum, n) => sum + n,
      });
      expect(acc.fold([1, 2, 3, 4])).toBe(10);
    });

    it('returns initial state for empty array', () => {
      const acc = createAccumulator({
        initialState: 'seed',
        reduce: (s) => s + 'x',
      });
      expect(acc.fold([])).toBe('seed');
    });

    it('accepts an override start state', () => {
      const acc = createAccumulator({
        initialState: 0,
        reduce: (sum, n) => sum + n,
      });
      expect(acc.fold([1, 2, 3], 100)).toBe(106);
    });

    it('throws on non-array observations', () => {
      const acc = createAccumulator({ initialState: 0, reduce: (s) => s });
      expect(() => acc.fold(null)).toThrow(TypeError);
      expect(() => acc.fold('not-array')).toThrow(TypeError);
    });
  });

  describe('step', () => {
    it('applies one observation', () => {
      const acc = createAccumulator({
        initialState: 0,
        reduce: (sum, n) => sum + n,
      });
      expect(acc.step(10, 5)).toBe(15);
    });
  });

  describe('validate hook', () => {
    it('skips observations that fail validation', () => {
      const acc = createAccumulator({
        initialState: 0,
        reduce: (sum, n) => sum + n,
        validate: (n) => typeof n === 'number' && n >= 0,
      });
      expect(acc.fold([1, 2, -3, 4, 'x'])).toBe(7);
    });

    it('treats non-function validate as no-op', () => {
      const acc = createAccumulator({
        initialState: 0,
        reduce: (sum, n) => sum + n,
        validate: 'not-a-function',
      });
      expect(acc.fold([1, 2, 3])).toBe(6);
    });
  });

  describe('finalize hook', () => {
    it('defaults to identity', () => {
      const acc = createAccumulator({
        initialState: 0,
        reduce: (sum, n) => sum + n,
      });
      const folded = acc.fold([1, 2, 3]);
      expect(acc.finalize(folded)).toBe(folded);
    });

    it('applies a finalize transform', () => {
      const acc = createAccumulator({
        initialState: 0,
        reduce: (sum, n) => sum + n,
        finalize: (sum) => ({ total: sum, double: sum * 2 }),
      });
      const folded = acc.fold([1, 2, 3]);
      expect(acc.finalize(folded)).toEqual({ total: 6, double: 12 });
    });
  });

  describe('integration: matches primitiveValidity.applyFiringBatch shape', () => {
    // Synthetic mini-version of primitiveValidity.updatePrimitiveValidity:
    // accumulates supportsCount + sampleSize.
    const update = (state, event) => ({
      sampleSize: state.sampleSize + 1,
      supportsCount: state.supportsCount + (event.supportsClaim ? 1 : 0),
    });

    it('folds a batch in order', () => {
      const acc = createAccumulator({
        initialState: { sampleSize: 0, supportsCount: 0 },
        reduce: update,
      });
      const events = [
        { supportsClaim: true },
        { supportsClaim: false },
        { supportsClaim: true },
        { supportsClaim: true },
      ];
      const result = acc.fold(events);
      expect(result).toEqual({ sampleSize: 4, supportsCount: 3 });
    });

    it('matches the existing events.reduce(...) shape exactly', () => {
      const initialState = { sampleSize: 0, supportsCount: 0 };
      const events = [
        { supportsClaim: true },
        { supportsClaim: false },
        { supportsClaim: true },
      ];
      const accResult = createAccumulator({ initialState, reduce: update }).fold(events);
      const reduceResult = events.reduce(update, initialState);
      expect(accResult).toEqual(reduceResult);
    });
  });
});
