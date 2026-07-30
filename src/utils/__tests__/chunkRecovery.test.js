// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../swUpdate', () => ({
  hardRefresh: vi.fn(async () => {}),
}));

vi.mock('../errorHandler', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { hardRefresh } from '../swUpdate';
import { logger } from '../errorHandler';
import {
  isChunkLoadError,
  importWithRecovery,
  __resetChunkRecovery,
} from '../chunkRecovery';

// The recovery path never settles its promise (the page is navigating away), so
// every assertion on it races against a timer rather than awaiting the call.
const settledWithin = (promise, ms = 30) =>
  Promise.race([
    promise.then(() => 'settled', () => 'settled'),
    new Promise((resolve) => setTimeout(() => resolve('pending'), ms)),
  ]);

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://app.web.app/assets/x-a1b2.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
    'Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html".',
    'Unable to preload CSS for /assets/x-a1b2.css',
    'Loading chunk 42 failed.',
  ])('recognises %s', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
  });

  it('accepts a bare string', () => {
    expect(isChunkLoadError('Failed to fetch dynamically imported module: /x.js')).toBe(true);
  });

  it('does not claim ordinary render errors', () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined (reading 'seat')"))).toBe(false);
    expect(isChunkLoadError(new TypeError('players.map is not a function'))).toBe(false);
  });

  it('is safe on null / undefined / message-less values', () => {
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError({})).toBe(false);
  });
});

describe('importWithRecovery', () => {
  beforeEach(() => {
    sessionStorage.clear();
    __resetChunkRecovery();
    vi.clearAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('returns the module when the import succeeds', async () => {
    const mod = { PlayerFinderView: () => null };
    await expect(importWithRecovery(async () => mod, 'PlayerFinderView')).resolves.toBe(mod);
    expect(hardRefresh).not.toHaveBeenCalled();
  });

  it('re-throws a non-chunk error untouched', async () => {
    const boom = new Error('module-level throw');
    await expect(
      importWithRecovery(async () => { throw boom; }, 'StatsView')
    ).rejects.toBe(boom);
    expect(hardRefresh).not.toHaveBeenCalled();
  });

  it('hard-refreshes on the first chunk failure and never settles', async () => {
    const pending = importWithRecovery(async () => {
      throw new Error('Failed to fetch dynamically imported module: /assets/x-a1b2.js');
    }, 'PlayerFinderView');

    await expect(settledWithin(pending)).resolves.toBe('pending');
    expect(hardRefresh).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalled();
  });

  it('marks the attempt so a second failure cannot loop the refresh', async () => {
    const fail = () => importWithRecovery(async () => {
      throw new Error('Failed to fetch dynamically imported module: /assets/x-a1b2.js');
    }, 'PlayerFinderView');

    await settledWithin(fail());
    expect(hardRefresh).toHaveBeenCalledTimes(1);

    // Second failure in the same tab: report it instead of refreshing again.
    await expect(fail()).rejects.toThrow('Failed to fetch dynamically imported module');
    expect(hardRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh when sessionStorage is unavailable', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    await expect(
      importWithRecovery(async () => {
        throw new Error('Failed to fetch dynamically imported module: /assets/x-a1b2.js');
      }, 'PlayerFinderView')
    ).rejects.toThrow('Failed to fetch dynamically imported module');

    // No guard available means no way to stop a loop — fail closed.
    expect(hardRefresh).not.toHaveBeenCalled();
    getItem.mockRestore();
  });
});
