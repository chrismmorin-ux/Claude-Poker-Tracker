import { describe, it, expect } from 'vitest';
import { deepFreeze } from '../freeze-utils.js';

describe('freeze-utils — deepFreeze (WS-103)', () => {
  it('freezes the top-level object and reports as frozen', () => {
    const obj = { a: 1, b: 2 };
    deepFreeze(obj);
    expect(Object.isFrozen(obj)).toBe(true);
  });

  it('throws on top-level mutation in strict mode', () => {
    'use strict';
    const obj = deepFreeze({ a: 1 });
    expect(() => { obj.a = 2; }).toThrow();
    expect(() => { obj.b = 'new'; }).toThrow();
    expect(() => { delete obj.a; }).toThrow();
  });

  it('freezes nested objects so nested mutation also throws', () => {
    'use strict';
    const obj = deepFreeze({ outer: { inner: { value: 1 } } });
    expect(Object.isFrozen(obj.outer)).toBe(true);
    expect(Object.isFrozen(obj.outer.inner)).toBe(true);
    expect(() => { obj.outer.inner.value = 2; }).toThrow();
    expect(() => { obj.outer.newKey = 'x'; }).toThrow();
  });

  it('freezes arrays and their elements', () => {
    'use strict';
    const obj = deepFreeze({ list: [{ x: 1 }, { x: 2 }] });
    expect(Object.isFrozen(obj.list)).toBe(true);
    expect(Object.isFrozen(obj.list[0])).toBe(true);
    expect(() => { obj.list.push({ x: 3 }); }).toThrow();
    expect(() => { obj.list[0].x = 99; }).toThrow();
  });

  it('returns the same reference (mutates in place)', () => {
    const obj = { a: 1 };
    const out = deepFreeze(obj);
    expect(out).toBe(obj);
  });

  it('is idempotent on already-frozen objects', () => {
    const obj = deepFreeze({ a: { b: 1 } });
    expect(() => deepFreeze(obj)).not.toThrow();
    expect(Object.isFrozen(obj)).toBe(true);
    expect(Object.isFrozen(obj.a)).toBe(true);
  });

  it('is a no-op on null and primitives', () => {
    expect(deepFreeze(null)).toBe(null);
    expect(deepFreeze(undefined)).toBe(undefined);
    expect(deepFreeze(42)).toBe(42);
    expect(deepFreeze('str')).toBe('str');
    expect(deepFreeze(true)).toBe(true);
  });

  it('frozen object survives structured-clone (postMessage / storage compat)', () => {
    const ctx = deepFreeze({ tableId: 't1', seats: [{ seat: 1, stack: 100 }] });
    // structuredClone is the same algorithm the SW boundary uses for
    // postMessage and chrome.storage.set — verify the receiver gets a
    // mutable, equivalent copy (so freezing the sender does not break
    // downstream writers like writeLiveContext).
    const clone = structuredClone(ctx);
    expect(clone).toEqual(ctx);
    expect(clone).not.toBe(ctx);
    expect(Object.isFrozen(clone)).toBe(false);
    clone.tableId = 'mutated';
    expect(clone.tableId).toBe('mutated');
    expect(ctx.tableId).toBe('t1');
  });

  it('shaped like a live_context payload — full graph is immutable', () => {
    'use strict';
    const ctx = deepFreeze({
      tableId: 't1',
      street: 'flop',
      board: ['Ah', 'Kd', '7c'],
      seats: [
        { seat: 1, stack: 100, hole: ['Js', 'Jd'] },
        { seat: 2, stack: 200, hole: null },
      ],
      pot: 42,
      meta: { handId: 'h1', dealtAt: 123 },
    });
    expect(() => { ctx.tableId = 'evil'; }).toThrow();
    expect(() => { ctx.board[0] = '2s'; }).toThrow();
    expect(() => { ctx.seats[0].stack = 0; }).toThrow();
    expect(() => { ctx.seats[0].hole[0] = '4c'; }).toThrow();
    expect(() => { ctx.meta.handId = 'h2'; }).toThrow();
  });
});
