// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerUpdateReload, hardRefresh, requestSwUpdate, __resetReloadGuard } from '../swUpdate';

vi.mock('../errorHandler', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

// Minimal ServiceWorkerContainer stand-in — jsdom ships no service worker.
const makeContainer = ({ controller = null } = {}) => {
  const listeners = new Map();
  return {
    controller,
    registrations: [],
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener: (type, fn) => listeners.get(type)?.delete(fn),
    getRegistrations: vi.fn(async function () { return this.registrations; }),
    emit: (type) => listeners.get(type)?.forEach((fn) => fn()),
    listenerCount: (type) => listeners.get(type)?.size ?? 0,
  };
};

let reload;

beforeEach(() => {
  __resetReloadGuard();
  reload = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.caches;
});

describe('registerUpdateReload', () => {
  it('reloads when a new worker takes control of an already-controlled page', () => {
    const container = makeContainer({ controller: {} });
    registerUpdateReload({ serviceWorker: container });

    container.emit('controllerchange');

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('subscribes on the container, not on a registration', () => {
    // The original bug: the listener was attached to a ServiceWorkerRegistration,
    // which never emits controllerchange, so updates never landed.
    const container = makeContainer({ controller: {} });
    registerUpdateReload({ serviceWorker: container });

    expect(container.listenerCount('controllerchange')).toBe(1);
  });

  it('does not reload on the first-ever claim (no prior controller)', () => {
    const container = makeContainer({ controller: null });
    registerUpdateReload({ serviceWorker: container });

    container.emit('controllerchange');

    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads at most once across repeated controllerchange events', () => {
    const container = makeContainer({ controller: {} });
    registerUpdateReload({ serviceWorker: container });

    container.emit('controllerchange');
    container.emit('controllerchange');
    container.emit('controllerchange');

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes cleanly', () => {
    const container = makeContainer({ controller: {} });
    const off = registerUpdateReload({ serviceWorker: container });

    off();
    container.emit('controllerchange');

    expect(reload).not.toHaveBeenCalled();
  });

  it('no-ops where service workers are unavailable', () => {
    expect(() => registerUpdateReload({})).not.toThrow();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('hardRefresh', () => {
  it('deletes every cache and unregisters every worker before reloading', async () => {
    const del = vi.fn(async () => true);
    globalThis.caches = { keys: async () => ['precache-v1', 'asset-cache'], delete: del };

    const unregister = vi.fn(async () => true);
    const container = makeContainer({ controller: {} });
    container.registrations = [{ unregister }, { unregister }];

    await hardRefresh({ serviceWorker: container });

    expect(del).toHaveBeenCalledWith('precache-v1');
    expect(del).toHaveBeenCalledWith('asset-cache');
    expect(unregister).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('still reloads when cache teardown throws', async () => {
    globalThis.caches = {
      keys: async () => { throw new Error('storage denied'); },
      delete: vi.fn(),
    };

    await hardRefresh({ serviceWorker: makeContainer() });

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads even with no caches and no service worker', async () => {
    await hardRefresh({});
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

// Nothing else in the app asks the browser to re-check sw.js. Left to its own
// schedule the browser may not look for days on an installed PWA that gets
// resumed rather than reloaded — so the app can know a new build exists while
// the new worker has never been fetched.
describe('requestSwUpdate', () => {
  const makeRegistration = () => ({ update: vi.fn(async () => {}) });

  it('calls update() on the active registration', async () => {
    const registration = makeRegistration();
    const container = makeContainer();
    container.getRegistration = vi.fn(async () => registration);

    await expect(requestSwUpdate({ serviceWorker: container })).resolves.toBe(true);
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('reports false when there is no registration yet', async () => {
    const container = makeContainer();
    container.getRegistration = vi.fn(async () => undefined);

    await expect(requestSwUpdate({ serviceWorker: container })).resolves.toBe(false);
  });

  it('reports false when service workers are unavailable', async () => {
    await expect(requestSwUpdate({})).resolves.toBe(false);
    await expect(requestSwUpdate(undefined)).resolves.toBe(false);
  });

  it('swallows an update() failure — offline is not actionable', async () => {
    const registration = { update: vi.fn(async () => { throw new Error('offline'); }) };
    const container = makeContainer();
    container.getRegistration = vi.fn(async () => registration);

    await expect(requestSwUpdate({ serviceWorker: container })).resolves.toBe(false);
  });
});
