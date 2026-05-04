// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  writeReloadFlag,
  readReloadFlag,
  clearReloadFlag,
  writeDismissedFlag,
  readDismissedFlag,
  clearDismissedFlag,
} from '../versionMismatchStorage';

const KEY = 'versionMismatchReload';
const DISMISS_KEY = 'versionMismatchDismissed';

describe('versionMismatchStorage (WS-076)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('round-trips a snapshot through write → read', () => {
    writeReloadFlag({
      extProtocolVersion: 2,
      extManifestVersion: '0.9.0',
      appProtocolVersion: 3,
    });

    const flag = readReloadFlag();
    expect(flag).not.toBeNull();
    expect(flag.fromExtProtocolVersion).toBe(2);
    expect(flag.fromExtManifestVersion).toBe('0.9.0');
    expect(flag.fromAppProtocolVersion).toBe(3);
    expect(typeof flag.ts).toBe('number');
  });

  it('returns null when no flag has been written', () => {
    expect(readReloadFlag()).toBeNull();
  });

  it('coerces missing extension fields to null (older builds may not send them)', () => {
    writeReloadFlag({
      extProtocolVersion: undefined,
      extManifestVersion: undefined,
      appProtocolVersion: 3,
    });

    const flag = readReloadFlag();
    expect(flag.fromExtProtocolVersion).toBeNull();
    expect(flag.fromExtManifestVersion).toBeNull();
    expect(flag.fromAppProtocolVersion).toBe(3);
  });

  it('expires entries older than 60s and removes them as a side-effect', () => {
    const stalePayload = {
      ts: Date.now() - 61_000,
      fromExtProtocolVersion: 2,
      fromExtManifestVersion: '0.9.0',
      fromAppProtocolVersion: 3,
    };
    sessionStorage.setItem(KEY, JSON.stringify(stalePayload));

    expect(readReloadFlag()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('keeps entries written within the 60s window', () => {
    const freshPayload = {
      ts: Date.now() - 30_000,
      fromExtProtocolVersion: 2,
      fromExtManifestVersion: '0.9.0',
      fromAppProtocolVersion: 3,
    };
    sessionStorage.setItem(KEY, JSON.stringify(freshPayload));

    expect(readReloadFlag()).not.toBeNull();
  });

  it('treats malformed JSON as absence (returns null without throwing)', () => {
    sessionStorage.setItem(KEY, '{ not valid json }');
    expect(readReloadFlag()).toBeNull();
  });

  it('treats missing ts field as malformed (removes the entry)', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ noTimestamp: true }));
    expect(readReloadFlag()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('clearReloadFlag removes the entry', () => {
    writeReloadFlag({ extProtocolVersion: 2, extManifestVersion: '0.9.0', appProtocolVersion: 3 });
    expect(sessionStorage.getItem(KEY)).not.toBeNull();
    clearReloadFlag();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('write swallows sessionStorage failures (e.g. storage full)', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() =>
      writeReloadFlag({ extProtocolVersion: 2, extManifestVersion: '0.9.0', appProtocolVersion: 3 })
    ).not.toThrow();
    setItemSpy.mockRestore();
  });

  it('clear swallows sessionStorage failures', () => {
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('locked');
    });
    expect(() => clearReloadFlag()).not.toThrow();
    removeItemSpy.mockRestore();
  });
});

describe('versionMismatchStorage dismiss flag (WS-077)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('writes and reads true after dismissal', () => {
    expect(readDismissedFlag()).toBe(false);
    writeDismissedFlag();
    expect(readDismissedFlag()).toBe(true);
  });

  it('returns false when no dismiss flag has been written', () => {
    expect(readDismissedFlag()).toBe(false);
  });

  it('clearDismissedFlag removes the entry', () => {
    writeDismissedFlag();
    expect(sessionStorage.getItem(DISMISS_KEY)).not.toBeNull();
    clearDismissedFlag();
    expect(sessionStorage.getItem(DISMISS_KEY)).toBeNull();
    expect(readDismissedFlag()).toBe(false);
  });

  it('treats malformed dismiss JSON as absence (returns false without throwing)', () => {
    sessionStorage.setItem(DISMISS_KEY, '{ broken json }');
    expect(readDismissedFlag()).toBe(false);
  });

  it('treats missing ts field as absence', () => {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify({ noTimestamp: true }));
    expect(readDismissedFlag()).toBe(false);
  });

  it('writeDismissedFlag swallows sessionStorage failures', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => writeDismissedFlag()).not.toThrow();
    setItemSpy.mockRestore();
  });

  it('reload-flag and dismiss-flag use independent keys (no cross-talk)', () => {
    writeReloadFlag({
      extProtocolVersion: 2,
      extManifestVersion: '0.9.0',
      appProtocolVersion: 3,
    });
    expect(readDismissedFlag()).toBe(false);  // reload flag does NOT imply dismissed

    writeDismissedFlag();
    expect(readReloadFlag()).not.toBeNull();   // dismiss flag does NOT clear reload flag
    expect(readDismissedFlag()).toBe(true);

    clearDismissedFlag();
    expect(readReloadFlag()).not.toBeNull();   // clearing one does NOT clear the other
    expect(readDismissedFlag()).toBe(false);
  });
});
