/**
 * Tests for engineCache.js (LSW-D2 — EV cache + engineVersion stamp).
 *
 * Covers:
 *  - Cache hit (compute called once across two calls with same key)
 *  - Cache miss across kinds (different `kind` namespaces don't collide)
 *  - Cache miss across keyParts (different keys → different entries)
 *  - engineVersion bump invalidates cache (NEV-12 forward requirement)
 *  - In-flight dedup: simultaneous calls share one Promise
 *  - errorState results NOT cached (transient failure path)
 *  - clearEngineCache() empties everything
 *  - hasCached() reports presence without invoking compute
 *  - keyParts=null bypasses cache entirely (caller opt-out)
 *  - NEV-12 compliance: keys don't collide via prototype-pollution payloads
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getOrCompute,
  clearEngineCache,
  engineCacheStats,
  hasCached,
  getEngineVersion,
  __setEngineVersionForTests,
  __resetEngineVersionForTests,
} from '../engineCache';

beforeEach(() => {
  clearEngineCache();
  __resetEngineVersionForTests();
});

describe('engineCache — basic hit/miss semantics', () => {
  it('caches a successful compute result and returns it on subsequent calls', async () => {
    const compute = vi.fn(() => Promise.resolve({ value: 42 }));
    const r1 = await getOrCompute('test', 'k1', compute);
    const r2 = await getOrCompute('test', 'k1', compute);
    expect(r1).toEqual({ value: 42 });
    expect(r2).toBe(r1); // same reference (Map stores result, not copy)
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('different keys → different compute calls', async () => {
    const compute = vi.fn((x) => Promise.resolve({ x }));
    await getOrCompute('test', 'k1', () => compute('a'));
    await getOrCompute('test', 'k2', () => compute('b'));
    expect(compute).toHaveBeenCalledTimes(2);
    expect(engineCacheStats().size).toBe(2);
  });

  it('different kinds → different namespaces', async () => {
    const compute = vi.fn(() => Promise.resolve({ value: 'x' }));
    await getOrCompute('depth2Plan', 'shared-key', compute);
    await getOrCompute('bucketEVsV2', 'shared-key', compute);
    expect(compute).toHaveBeenCalledTimes(2);
    expect(engineCacheStats().size).toBe(2);
  });

  it('JSON-serialized object keyParts are stable across calls', async () => {
    const compute = vi.fn(() => Promise.resolve({ value: 1 }));
    await getOrCompute('test', { a: 1, b: 2 }, compute);
    await getOrCompute('test', { a: 1, b: 2 }, compute);
    expect(compute).toHaveBeenCalledTimes(1);
  });
});

describe('engineCache — engineVersion invalidation (NEV-12 forward requirement)', () => {
  it('bumping engineVersion produces fresh cache entries; old keys unreachable', async () => {
    const compute = vi.fn(() => Promise.resolve({ value: 1 }));
    await getOrCompute('test', 'k1', compute);
    expect(compute).toHaveBeenCalledTimes(1);

    // Bump version — same keyParts now resolves to a different key, so
    // the next call misses cache and recomputes.
    __setEngineVersionForTests('v999');
    await getOrCompute('test', 'k1', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('reverting engineVersion makes the original cached entry visible again', async () => {
    const compute = vi.fn(() => Promise.resolve({ value: 1 }));
    await getOrCompute('test', 'k1', compute);
    __setEngineVersionForTests('v999');
    await getOrCompute('test', 'k1', compute);
    expect(compute).toHaveBeenCalledTimes(2);
    __resetEngineVersionForTests();
    // v123 (default) entry is still in the Map; reverting unblocks it.
    await getOrCompute('test', 'k1', compute);
    expect(compute).toHaveBeenCalledTimes(2); // no new compute
  });

  it('engineCacheStats.engineVersion reflects test override', () => {
    expect(engineCacheStats().engineVersion).toBe(getEngineVersion());
    __setEngineVersionForTests('v999');
    expect(engineCacheStats().engineVersion).toBe('v999');
  });

  it('__setEngineVersionForTests rejects empty / non-string input', () => {
    expect(() => __setEngineVersionForTests('')).toThrow();
    expect(() => __setEngineVersionForTests(null)).toThrow();
    expect(() => __setEngineVersionForTests(123)).toThrow();
  });
});

describe('engineCache — in-flight promise dedup', () => {
  it('concurrent calls for the same key share a single Promise', async () => {
    let resolveCompute;
    const compute = vi.fn(() => new Promise((res) => { resolveCompute = res; }));
    const p1 = getOrCompute('test', 'k1', compute);
    const p2 = getOrCompute('test', 'k1', compute);
    // Both calls should hit the same in-flight promise; compute called once.
    expect(compute).toHaveBeenCalledTimes(1);
    expect(engineCacheStats().inflight).toBe(1);
    resolveCompute({ value: 1 });
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual({ value: 1 });
    expect(r2).toBe(r1);
    expect(engineCacheStats().inflight).toBe(0);
  });

  it('rejected in-flight promise frees the slot (next call retries)', async () => {
    let rejectCompute;
    const compute = vi.fn(() => new Promise((_, rej) => { rejectCompute = rej; }));
    const p = getOrCompute('test', 'k1', compute);
    rejectCompute(new Error('test failure'));
    await expect(p).rejects.toThrow('test failure');
    expect(engineCacheStats().inflight).toBe(0);
    // Next call retries (compute called again).
    const compute2 = vi.fn(() => Promise.resolve({ value: 2 }));
    const r = await getOrCompute('test', 'k1', compute2);
    expect(r).toEqual({ value: 2 });
    expect(compute2).toHaveBeenCalledTimes(1);
  });
});

describe('engineCache — errorState handling', () => {
  it('compute returning errorState is NOT cached (transient failure)', async () => {
    const compute = vi.fn(() => Promise.resolve({
      perAction: [],
      errorState: { kind: 'engine-internal', userMessage: 'fail' },
    }));
    await getOrCompute('test', 'k1', compute);
    await getOrCompute('test', 'k1', compute);
    // Both calls re-ran compute since errorState wasn't cached.
    expect(compute).toHaveBeenCalledTimes(2);
    expect(engineCacheStats().size).toBe(0);
  });

  it('compute returning success after errorState fix DOES cache', async () => {
    const compute = vi.fn()
      .mockResolvedValueOnce({ errorState: { kind: 'transient' } })
      .mockResolvedValueOnce({ value: 'ok', errorState: null });
    await getOrCompute('test', 'k1', compute);
    expect(engineCacheStats().size).toBe(0);
    await getOrCompute('test', 'k1', compute);
    expect(engineCacheStats().size).toBe(1);
    // Third call hits cache.
    await getOrCompute('test', 'k1', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });
});

describe('engineCache — clearEngineCache + hasCached', () => {
  it('clearEngineCache empties cache + in-flight maps', async () => {
    const compute = vi.fn(() => Promise.resolve({ value: 1 }));
    await getOrCompute('test', 'k1', compute);
    expect(engineCacheStats().size).toBe(1);
    clearEngineCache();
    expect(engineCacheStats().size).toBe(0);
    expect(engineCacheStats().inflight).toBe(0);
    // Subsequent call recomputes.
    await getOrCompute('test', 'k1', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('hasCached reflects entry presence without invoking compute', async () => {
    expect(hasCached('test', 'k1')).toBe(false);
    const compute = vi.fn(() => Promise.resolve({ value: 1 }));
    await getOrCompute('test', 'k1', compute);
    expect(hasCached('test', 'k1')).toBe(true);
    expect(hasCached('test', 'k2')).toBe(false);
    expect(hasCached('other-kind', 'k1')).toBe(false);
  });

  it('hasCached returns false for null keyParts', () => {
    expect(hasCached('test', null)).toBe(false);
    expect(hasCached('test', undefined)).toBe(false);
  });
});

describe('engineCache — caller opt-out', () => {
  it('keyParts=null bypasses cache entirely (compute called every time)', async () => {
    const compute = vi.fn(() => Promise.resolve({ value: 1 }));
    await getOrCompute('test', null, compute);
    await getOrCompute('test', null, compute);
    expect(compute).toHaveBeenCalledTimes(2);
    expect(engineCacheStats().size).toBe(0);
  });

  it('keyParts=undefined bypasses cache', async () => {
    const compute = vi.fn(() => Promise.resolve({ value: 1 }));
    await getOrCompute('test', undefined, compute);
    expect(engineCacheStats().size).toBe(0);
    expect(compute).toHaveBeenCalledTimes(1);
  });
});

describe('engineCache — input validation', () => {
  it('rejects empty kind', async () => {
    await expect(
      getOrCompute('', 'k1', () => Promise.resolve({})),
    ).rejects.toThrow();
  });

  it('rejects non-string kind', async () => {
    await expect(
      getOrCompute(null, 'k1', () => Promise.resolve({})),
    ).rejects.toThrow();
  });
});

describe('engineCache — NEV-12 prototype-pollution resistance', () => {
  it('keys built from objects with __proto__ / constructor names do not collide', async () => {
    const compute = vi.fn().mockResolvedValueOnce({ v: 'A' }).mockResolvedValueOnce({ v: 'B' });
    await getOrCompute('test', { __proto__: 'malicious' }, compute);
    await getOrCompute('test', 'k1', compute);
    expect(compute).toHaveBeenCalledTimes(2);
    expect(engineCacheStats().size).toBe(2);
    // Map storage means the runtime prototype was never touched.
    expect(Object.prototype).not.toHaveProperty('malicious');
  });

  it('underlying storage is Map-based (no prototype-keyed object)', async () => {
    const compute = vi.fn(() => Promise.resolve({ value: 1 }));
    await getOrCompute('test', 'constructor', compute);
    await getOrCompute('test', '__proto__', compute);
    await getOrCompute('test', 'prototype', compute);
    expect(engineCacheStats().size).toBe(3);
    expect(compute).toHaveBeenCalledTimes(3);
  });
});
