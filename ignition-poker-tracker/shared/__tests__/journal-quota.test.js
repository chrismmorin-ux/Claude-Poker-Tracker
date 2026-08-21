/**
 * journal-quota.test.js — WS-515.
 *
 * The journal's binding ceiling was never MAX_JOURNAL. `chrome.storage.local`
 * has a 10MB default quota and the extension did not request
 * `unlimitedStorage`, so `set` threw long before 5,000 records. That throw was
 * caught and reported to `errors` only: it did NOT increment the loss counter
 * (which lives in the eviction branch, which never runs), and `enqueueHand`
 * went on to return `success: true` for a hand whose only durable copy had just
 * been lost.
 *
 * Both assertions below fail against the pre-fix code.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enqueueHand, isQuotaError, getJournalStorageHealth } from '../storage-writer.js';
import { STORAGE_KEYS } from '../constants.js';

const QUOTA_MSG = 'Resource::kQuotaBytes quota exceeded';

function install({ localSetThrows = null, manifestPermissions = ['storage'] } = {}) {
  const local = {};
  const session = {};
  globalThis.chrome = {
    storage: {
      local: {
        get: vi.fn(async (keys) => {
          const list = keys === null ? Object.keys(local) : (Array.isArray(keys) ? keys : [keys]);
          const out = {};
          for (const k of list) if (k in local) out[k] = local[k];
          return out;
        }),
        set: vi.fn(async (obj) => {
          if (localSetThrows) throw new Error(localSetThrows);
          Object.assign(local, obj);
        }),
        remove: vi.fn(async (k) => { delete local[k]; }),
        getBytesInUse: vi.fn(async () => JSON.stringify(local).length),
      },
      session: {
        get: vi.fn(async (keys) => {
          const list = Array.isArray(keys) ? keys : [keys];
          const out = {};
          for (const k of list) if (k in session) out[k] = session[k];
          return out;
        }),
        set: vi.fn(async (obj) => { Object.assign(session, obj); }),
      },
    },
    runtime: {
      lastError: null,
      getManifest: () => ({ permissions: manifestPermissions }),
    },
  };
  vi.stubGlobal('navigator', { locks: { request: async (_n, fn) => fn() } });
  return { local, session };
}

const hand = (n) => ({
  timestamp: Date.now(), version: 1, source: 'ignition', tableId: 't1',
  gameState: { handNumber: `h${n}` }, cardState: {}, seatPlayers: {},
  ignitionMeta: { handNumber: `h${n}` },
});

describe('WS-515 — a full journal is loud, not silent', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('does NOT report unqualified success when the durable write hit the quota', async () => {
    install({ localSetThrows: QUOTA_MSG });
    const res = await enqueueHand(hand(1));

    // The live delivery path still succeeded — that part was always correct.
    expect(res.success).toBe(true);
    // ...but the caller must be told the durable copy is gone.
    expect(res.journalled).toBe(false);
    expect(res.journalFailure).toBe('quota');
  });

  it('increments a dedicated quota-failure counter', async () => {
    const { local } = install({ localSetThrows: null });
    // Let the counter write succeed while the journal write fails.
    let failJournal = true;
    chrome.storage.local.set = vi.fn(async (obj) => {
      if (failJournal && STORAGE_KEYS.HAND_JOURNAL in obj) throw new Error(QUOTA_MSG);
      Object.assign(local, obj);
    });

    await enqueueHand(hand(1));
    expect(local[STORAGE_KEYS.HAND_JOURNAL_QUOTA_FAILURES]).toBe(1);

    await enqueueHand(hand(2));
    expect(local[STORAGE_KEYS.HAND_JOURNAL_QUOTA_FAILURES]).toBe(2);

    // Once there is room again, success is unqualified once more.
    failJournal = false;
    const ok = await enqueueHand(hand(3));
    expect(ok.journalled).toBe(true);
    expect(ok.journalFailure).toBeUndefined();
  });

  it('reports journalled: true on the healthy path', async () => {
    install();
    const res = await enqueueHand(hand(1));
    expect(res.success).toBe(true);
    expect(res.journalled).toBe(true);
  });

  it('distinguishes a quota failure from any other storage error', async () => {
    install({ localSetThrows: 'something else went wrong' });
    const res = await enqueueHand(hand(1));
    expect(res.journalled).toBe(false);
    expect(res.journalFailure).toBe('error');
  });

  describe('isQuotaError', () => {
    it('recognises the shapes Chrome actually throws', () => {
      expect(isQuotaError(new Error('Resource::kQuotaBytes quota exceeded'))).toBe(true);
      expect(isQuotaError(new Error('QUOTA_BYTES quota exceeded'))).toBe(true);
      expect(isQuotaError(new Error('The storage quota has been exceeded'))).toBe(true);
    });

    it('does not claim unrelated errors are quota failures', () => {
      expect(isQuotaError(new Error('Extension context invalidated'))).toBe(false);
      expect(isQuotaError(null)).toBe(false);
    });
  });

  describe('observable headroom', () => {
    it('reports bytes in use, entries and failure counts', async () => {
      install();
      await enqueueHand(hand(1));
      const health = await getJournalStorageHealth();
      expect(health.entries).toBe(1);
      expect(health.bytesInUse).toBeGreaterThan(0);
      expect(health.quotaFailures).toBe(0);
    });

    it('estimates remaining hands only while a quota actually applies', async () => {
      install({ manifestPermissions: ['storage'] });
      await enqueueHand(hand(1));
      const limited = await getJournalStorageHealth();
      expect(limited.unlimited).toBe(false);
      expect(limited.estRemainingHands).toBeGreaterThan(0);

      install({ manifestPermissions: ['storage', 'unlimitedStorage'] });
      await enqueueHand(hand(1));
      const unlimited = await getJournalStorageHealth();
      expect(unlimited.unlimited).toBe(true);
      expect(unlimited.estRemainingHands).toBeNull();
    });

    it('surfaces the quota-failure count it recorded', async () => {
      const { local } = install();
      local[STORAGE_KEYS.HAND_JOURNAL_QUOTA_FAILURES] = 7;
      const health = await getJournalStorageHealth();
      expect(health.quotaFailures).toBe(7);
    });
  });
});

describe('WS-515 — the manifest removes the ceiling rather than budgeting under it', () => {
  it('requests unlimitedStorage', async () => {
    const manifest = await import('../../manifest.json', { with: { type: 'json' } })
      .then(m => m.default)
      .catch(async () => {
        const { readFileSync } = await import('node:fs');
        const { fileURLToPath } = await import('node:url');
        const { dirname, resolve } = await import('node:path');
        const here = dirname(fileURLToPath(import.meta.url));
        return JSON.parse(readFileSync(resolve(here, '../../manifest.json'), 'utf8'));
      });
    expect(manifest.permissions).toContain('unlimitedStorage');
  });
});
