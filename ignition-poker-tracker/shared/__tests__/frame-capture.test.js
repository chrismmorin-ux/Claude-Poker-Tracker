/**
 * frame-capture.test.js — raw frame recorder + exporter.
 *
 * Covers the ring buffer, debounced flush, per-context keying, quota fallback,
 * and the options-page merge/export path. Pure DI — no browser.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  FRAME_CAPTURE_FLAG,
  FRAME_CAPTURE_PREFIX,
  isCaptureEnabled,
  setCaptureEnabled,
  observeCaptureFlag,
  createFrameRecorder,
  collectFrames,
  toJsonl,
  clearFrames,
} from '../frame-capture.js';

function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    store,
    async get(keys) {
      if (keys === null || keys === undefined) return { ...store };
      const ks = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const k of ks) if (k in store) out[k] = store[k];
      return out;
    },
    async set(obj) { Object.assign(store, obj); },
    async remove(keys) {
      for (const k of (Array.isArray(keys) ? keys : [keys])) delete store[k];
    },
  };
}

// Manual flush control: capture the scheduled callback instead of real timers.
function manualTimers() {
  let pending = null;
  return {
    setTimeoutFn: (cb) => { pending = cb; return 1; },
    clearTimeoutFn: () => { pending = null; },
    run: async () => { const cb = pending; pending = null; if (cb) await cb(); },
    get armed() { return pending !== null; },
  };
}

describe('frame-capture flag', () => {
  it('defaults to disabled', async () => {
    const storage = makeStorage();
    expect(await isCaptureEnabled(storage)).toBe(false);
  });

  it('round-trips the flag', async () => {
    const storage = makeStorage();
    await setCaptureEnabled(true, storage);
    expect(storage.store[FRAME_CAPTURE_FLAG]).toBe(true);
    expect(await isCaptureEnabled(storage)).toBe(true);
  });

  it('observeCaptureFlag fires only on the flag key in local area', () => {
    const listeners = [];
    const runtime = { storage: { onChanged: {
      addListener: (fn) => listeners.push(fn),
      removeListener: (fn) => listeners.splice(listeners.indexOf(fn), 1),
    } } };
    const cb = vi.fn();
    const off = observeCaptureFlag(cb, runtime);

    listeners[0]({ [FRAME_CAPTURE_FLAG]: { newValue: true } }, 'local');
    expect(cb).toHaveBeenCalledWith(true);

    listeners[0]({ 'unrelated': { newValue: 1 } }, 'local');
    listeners[0]({ [FRAME_CAPTURE_FLAG]: { newValue: false } }, 'session');
    expect(cb).toHaveBeenCalledTimes(1);

    off();
    expect(listeners).toHaveLength(0);
  });
});

describe('frame recorder', () => {
  it('requires a contextId', () => {
    expect(() => createFrameRecorder({ storage: makeStorage() })).toThrow(/contextId/);
  });

  it('drops records while disabled', async () => {
    const storage = makeStorage();
    const t = manualTimers();
    const rec = createFrameRecorder({ storage, contextId: 'a', now: () => 1, ...t });
    rec.record({ kind: 'msg', data: 'x' });
    expect(t.armed).toBe(false);
    expect(rec._state().length).toBe(0);
  });

  it('buffers when enabled and flushes to a per-context key', async () => {
    const storage = makeStorage();
    const t = manualTimers();
    const rec = createFrameRecorder({ storage, contextId: 'ctx1', now: () => 42, ...t });
    rec.setEnabled(true);
    rec.record({ kind: 'msg', connId: 7, data: 'hello' });
    expect(t.armed).toBe(true);
    await t.run();
    const key = FRAME_CAPTURE_PREFIX + 'ctx1';
    expect(storage.store[key]).toEqual([{ t: 42, kind: 'msg', connId: 7, data: 'hello' }]);
    // internal byte-accounting field must not be persisted
    expect(storage.store[key][0]).not.toHaveProperty('_b');
  });

  it('respects maxRecords ring (drops oldest)', async () => {
    const storage = makeStorage();
    const t = manualTimers();
    let n = 0;
    const rec = createFrameRecorder({ storage, contextId: 'c', now: () => ++n, maxRecords: 3, ...t });
    rec.setEnabled(true);
    for (let i = 0; i < 5; i++) rec.record({ kind: 'msg', data: String(i) });
    await t.run();
    const out = storage.store[FRAME_CAPTURE_PREFIX + 'c'];
    expect(out.map((r) => r.data)).toEqual(['2', '3', '4']);
  });

  it('survives a storage quota error by trimming and retrying', async () => {
    const storage = makeStorage();
    let calls = 0;
    storage.set = vi.fn(async (obj) => {
      calls += 1;
      if (calls === 1) throw new Error('QUOTA_BYTES quota exceeded');
      Object.assign(storage.store, obj);
    });
    const t = manualTimers();
    const rec = createFrameRecorder({ storage, contextId: 'q', now: () => 1, maxRecords: 10000, ...t });
    rec.setEnabled(true);
    for (let i = 0; i < 500; i++) rec.record({ kind: 'msg', data: 'x'.repeat(50) });
    await t.run();
    expect(storage.set).toHaveBeenCalledTimes(2); // failed once, retried with a trimmed buffer
    expect(Array.isArray(storage.store[FRAME_CAPTURE_PREFIX + 'q'])).toBe(true);
  });

  it('flushNow writes immediately and cancels the pending timer', async () => {
    const storage = makeStorage();
    const t = manualTimers();
    const rec = createFrameRecorder({ storage, contextId: 'now', now: () => 5, ...t });
    rec.setEnabled(true);
    rec.record({ kind: 'conn', event: 'opened', url: 'wss://x' });
    await rec.flushNow();
    expect(t.armed).toBe(false);
    expect(storage.store[FRAME_CAPTURE_PREFIX + 'now']).toHaveLength(1);
  });
});

describe('export / clear', () => {
  it('merges every context buffer and sorts chronologically', async () => {
    const storage = makeStorage({
      [FRAME_CAPTURE_PREFIX + 'a']: [{ t: 30, kind: 'msg' }, { t: 10, kind: 'msg' }],
      [FRAME_CAPTURE_PREFIX + 'b']: [{ t: 20, kind: 'conn' }],
      [FRAME_CAPTURE_FLAG]: true,
      'some_other_key': [{ t: 1 }],
    });
    const records = await collectFrames(storage);
    expect(records.map((r) => r.t)).toEqual([10, 20, 30]);
  });

  it('toJsonl emits one JSON object per line', () => {
    const text = toJsonl([{ t: 1, kind: 'msg' }, { t: 2, kind: 'conn' }]);
    const lines = text.split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).t).toBe(1);
    expect(JSON.parse(lines[1]).kind).toBe('conn');
  });

  it('clearFrames removes only capture buffers', async () => {
    const storage = makeStorage({
      [FRAME_CAPTURE_PREFIX + 'a']: [{ t: 1 }],
      [FRAME_CAPTURE_PREFIX + 'b']: [{ t: 2 }],
      [FRAME_CAPTURE_FLAG]: true,
      'keep_me': 1,
    });
    const n = await clearFrames(storage);
    expect(n).toBe(2);
    expect(storage.store).toEqual({ [FRAME_CAPTURE_FLAG]: true, 'keep_me': 1 });
  });
});
