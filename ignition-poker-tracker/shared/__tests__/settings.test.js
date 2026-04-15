/**
 * settings.test.js — settings flag plumbing.
 *
 * Covers (post-SR-7 cutover; sidebarRebuild flag deleted, debugDiagnostics
 * remains as the lone setting):
 *   1. Default when storage is empty (false).
 *   2. Read honors stored value.
 *   3. observeSettings fires on flip in `local` area only.
 *   4. Unrelated `local` keys do not fire the callback.
 *   5. writeSetting persists into the stub storage.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

function makeChromeStub() {
  const store = {};
  const listeners = [];
  return {
    storage: {
      local: {
        async get(keys) {
          const ks = Array.isArray(keys) ? keys : [keys];
          const out = {};
          for (const k of ks) if (k in store) out[k] = store[k];
          return out;
        },
        async set(obj) {
          const changes = {};
          for (const [k, v] of Object.entries(obj)) {
            changes[k] = { oldValue: store[k], newValue: v };
            store[k] = v;
          }
          for (const fn of listeners) fn(changes, 'local');
        },
      },
      onChanged: {
        addListener: (fn) => listeners.push(fn),
        removeListener: (fn) => {
          const i = listeners.indexOf(fn);
          if (i >= 0) listeners.splice(i, 1);
        },
        _fire: (changes, area) => {
          for (const fn of listeners) fn(changes, area);
        },
      },
    },
    _store: store,
  };
}

describe('shared/settings — debugDiagnostics flag', () => {
  let chromeStub;
  let settings;

  beforeEach(async () => {
    chromeStub = makeChromeStub();
    globalThis.chrome = chromeStub;
    vi.resetModules();
    settings = await import('../settings.js');
  });

  it('returns default when storage is empty', async () => {
    const s = await settings.loadSettings();
    expect(s).toEqual({ debugDiagnostics: false });
  });

  it('reads stored value when present', async () => {
    await chromeStub.storage.local.set({
      'settings.debugDiagnostics': true,
    });
    const s = await settings.loadSettings();
    expect(s).toEqual({ debugDiagnostics: true });
  });

  it('observeSettings fires on debugDiagnostics flip', async () => {
    const cb = vi.fn();
    settings.observeSettings(cb);
    await chromeStub.storage.local.set({ 'settings.debugDiagnostics': true });
    // observer is async — yield to the microtask queue
    await Promise.resolve(); await Promise.resolve();
    expect(cb).toHaveBeenCalledWith({ debugDiagnostics: true });
  });

  it('ignores unrelated local-storage changes', async () => {
    const cb = vi.fn();
    settings.observeSettings(cb);
    await chromeStub.storage.local.set({ 'some_unrelated_key': 42 });
    await Promise.resolve();
    expect(cb).not.toHaveBeenCalled();
  });

  it('ignores changes in non-local areas', async () => {
    const cb = vi.fn();
    settings.observeSettings(cb);
    chromeStub.storage.onChanged._fire(
      { 'settings.debugDiagnostics': { newValue: true } },
      'session',
    );
    await Promise.resolve();
    expect(cb).not.toHaveBeenCalled();
  });

  it('writeSetting persists the value', async () => {
    await settings.writeSetting('settings.debugDiagnostics', true);
    expect(chromeStub._store['settings.debugDiagnostics']).toBe(true);
    const s = await settings.loadSettings();
    expect(s.debugDiagnostics).toBe(true);
  });

  it('writeSetting rejects unknown keys', async () => {
    await expect(settings.writeSetting('not.a.setting', true)).rejects.toThrow(/unknown key/);
  });
});

describe('RenderCoordinator — settings slot', () => {
  it('includes settings in snapshot and bumps renderKey on flip', async () => {
    const { RenderCoordinator } = await import('../../side-panel/render-coordinator.js');
    const coord = new RenderCoordinator({
      renderFn: () => {},
      getTimestamp: () => 0,
      requestFrame: (cb) => cb(),
      setTimeout: (cb) => { cb(); return 0; },
      clearTimeout: () => {},
    });
    const snap1 = coord.buildSnapshot();
    expect(snap1.settings).toEqual({ debugDiagnostics: false });
    const key1 = coord.buildRenderKey(snap1);

    coord.set('settings', { debugDiagnostics: true });
    const snap2 = coord.buildSnapshot();
    const key2 = coord.buildRenderKey(snap2);
    expect(snap2.settings.debugDiagnostics).toBe(true);
    expect(key1).not.toBe(key2);
  });
});
