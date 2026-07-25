import { logger } from './errorHandler';

// Service-worker update plumbing. Workbox runs with skipWaiting + clientsClaim
// (vite.config.js), so a new worker activates and claims this page on its own.
// The page keeps executing the JS chunks it already loaded, so something has to
// drive the reload — that is what this module does.

let reloading = false;

// Reset point for tests; production never needs it.
export const __resetReloadGuard = () => {
  reloading = false;
};

const doReload = () => {
  if (reloading) return;
  reloading = true;
  window.location.reload();
};

/**
 * Reload the page when a newly installed worker takes control.
 *
 * `controllerchange` is fired by the ServiceWorkerContainer, not by a
 * ServiceWorkerRegistration. Binding it to a registration silently never fires,
 * which left the app running old chunks until the PWA was force-killed.
 *
 * Returns an unsubscribe function.
 */
export const registerUpdateReload = (nav = globalThis.navigator) => {
  const container = nav?.serviceWorker;
  if (!container) return () => {};

  // A page that loads with no controller gets claimed as soon as the first
  // worker installs. That claim is not an update, and reloading on it would
  // bounce every first-ever visit.
  const hadController = Boolean(container.controller);

  const onControllerChange = () => {
    if (!hadController) return;
    doReload();
  };

  container.addEventListener('controllerchange', onControllerChange);
  return () => container.removeEventListener('controllerchange', onControllerChange);
};

/**
 * Drop every Workbox cache and worker, then reload.
 *
 * A bare window.location.reload() is not enough to escape a stale build: the
 * active worker answers the navigation out of its own precache, so the old
 * shell comes back. Clearing the caches and unregistering first guarantees the
 * next load goes to the network.
 *
 * IndexedDB is untouched — sessions, hands and players live there.
 */
export const hardRefresh = async (nav = globalThis.navigator) => {
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    const container = nav?.serviceWorker;
    if (container) {
      const regs = await container.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch (err) {
    // Non-fatal: the reload below still gets us closer to current.
    logger.error('swUpdate:hardRefresh', err);
  } finally {
    doReload();
  }
};
