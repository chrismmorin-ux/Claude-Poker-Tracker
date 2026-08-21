/**
 * capture-gap-ledger.test.js — WS-516 durable capture-gap ledger.
 *
 * A banner the founder dismissed leaves no trace. What poisons the corpus is
 * that a session with an unrecorded hole is indistinguishable from a genuinely
 * short one, so any k/n over it is silently conditioned on the interval where
 * capture happened to be alive. These tests pin that the hole becomes a fact in
 * the data.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordCaptureGap,
  getCaptureGaps,
  clearCaptureGaps,
  MAX_CAPTURE_GAPS,
} from '../storage-writer.js';

// Minimal chrome.storage.local + navigator.locks doubles.
function installChromeLocal() {
  const store = {};
  globalThis.chrome = {
    storage: {
      local: {
        get: vi.fn(async (keys) => {
          const list = Array.isArray(keys) ? keys : [keys];
          const out = {};
          for (const k of list) if (k in store) out[k] = store[k];
          return out;
        }),
        set: vi.fn(async (obj) => { Object.assign(store, obj); }),
        remove: vi.fn(async (k) => { delete store[k]; }),
      },
      session: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => {}),
      },
    },
    runtime: { lastError: null },
  };
  // jsdom exposes navigator as a getter-only property — stubGlobal handles it.
  vi.stubGlobal('navigator', { locks: { request: async (_name, fn) => fn() } });
  return store;
}

describe('WS-516 — capture gap ledger', () => {
  beforeEach(() => {
    installChromeLocal();
  });

  it('records a gap with its duration', async () => {
    await recordCaptureGap({ from: 1000, to: 61000, reason: 'silence_timeout', resumed: true });
    const gaps = await getCaptureGaps();
    expect(gaps).toHaveLength(1);
    expect(gaps[0].from).toBe(1000);
    expect(gaps[0].to).toBe(61000);
    expect(gaps[0].ms).toBe(60000);
    expect(gaps[0].reason).toBe('silence_timeout');
    expect(gaps[0].resumed).toBe(true);
  });

  it('stamps the stable tableKey, never a connId', async () => {
    await recordCaptureGap({
      from: 1000, to: 61000, reason: 'silence_timeout',
      tableKey: 'table:wss://pkscb.ignitioncasino.eu/poker-games/rgs',
    });
    const [gap] = await getCaptureGaps();
    expect(gap.tableKey).toBe('table:wss://pkscb.ignitioncasino.eu/poker-games/rgs');
  });

  it('records a gap with no table seated — it is still a real gap', async () => {
    await recordCaptureGap({ from: 1000, to: 61000, reason: 'silence_timeout' });
    const [gap] = await getCaptureGaps();
    expect(gap.tableKey).toBeNull();
  });

  it('collapses repeated observations of the SAME ongoing gap, keeping the longest', async () => {
    // The detector sees an ongoing gap on consecutive ticks. Those are one hole
    // seen repeatedly, not many holes.
    await recordCaptureGap({ from: 1000, to: 61000, reason: 'silence_timeout', resumed: false });
    await recordCaptureGap({ from: 1000, to: 121000, reason: 'silence_timeout', resumed: false });
    await recordCaptureGap({ from: 1000, to: 301000, reason: 'silence_timeout', resumed: true });

    const gaps = await getCaptureGaps();
    expect(gaps).toHaveLength(1);
    expect(gaps[0].to).toBe(301000);
    expect(gaps[0].ms).toBe(300000);
    expect(gaps[0].resumed).toBe(true);
  });

  it('never shortens a gap already recorded', async () => {
    await recordCaptureGap({ from: 1000, to: 301000, resumed: true });
    await recordCaptureGap({ from: 1000, to: 61000, resumed: false });
    const [gap] = await getCaptureGaps();
    expect(gap.to).toBe(301000);
  });

  it('keeps distinct gaps distinct', async () => {
    await recordCaptureGap({ from: 1000, to: 61000 });
    await recordCaptureGap({ from: 500000, to: 600000 });
    const gaps = await getCaptureGaps();
    expect(gaps).toHaveLength(2);
    expect(gaps.map(g => g.from)).toEqual([1000, 500000]);
  });

  it('refuses a zero or negative interval — every entry must mean something', async () => {
    await recordCaptureGap({ from: 1000, to: 1000 });
    await recordCaptureGap({ from: 5000, to: 1000 });
    expect(await getCaptureGaps()).toHaveLength(0);
  });

  it('refuses a malformed gap without throwing', async () => {
    await expect(recordCaptureGap(null)).resolves.toBeUndefined();
    await expect(recordCaptureGap({})).resolves.toBeUndefined();
    await expect(recordCaptureGap({ from: 'x', to: 5 })).resolves.toBeUndefined();
    expect(await getCaptureGaps()).toHaveLength(0);
  });

  it('survives storage being unavailable rather than breaking capture', async () => {
    delete globalThis.chrome.storage.local;
    await expect(recordCaptureGap({ from: 1, to: 2 })).resolves.toBeUndefined();
    expect(await getCaptureGaps()).toEqual([]);
  });

  it('caps the ledger and reports the eviction', async () => {
    for (let i = 0; i < MAX_CAPTURE_GAPS + 3; i++) {
      await recordCaptureGap({ from: i * 1000 + 1, to: i * 1000 + 500 });
    }
    const gaps = await getCaptureGaps();
    expect(gaps).toHaveLength(MAX_CAPTURE_GAPS);
    // Oldest evicted, newest retained.
    expect(gaps[gaps.length - 1].from).toBe((MAX_CAPTURE_GAPS + 2) * 1000 + 1);
  });

  it('clearCaptureGaps empties the ledger', async () => {
    await recordCaptureGap({ from: 1000, to: 61000 });
    await clearCaptureGaps();
    expect(await getCaptureGaps()).toHaveLength(0);
  });
});
