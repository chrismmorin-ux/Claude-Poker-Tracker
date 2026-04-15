/**
 * chrome-stub.js — minimal chrome.* runtime for loading side-panel.js in-browser.
 *
 * SR-3 Panel Inventory harness. NOT for production use.
 *
 * Mirrors `test/replay/chrome-stub.js` 1:1 — browser-safe (plain JS, no node APIs).
 * Keep in sync manually; any divergence is a bug.
 *
 * Surface covered: runtime.connect (Port), runtime.sendMessage, runtime.getManifest,
 * runtime.lastError, storage.onChanged, storage.session.get/set, tabs.create.
 */

export function installChromeStub(globalTarget) {
  const ports = Object.create(null);
  const storageListeners = [];
  const sessionStore = Object.create(null);
  let contextAlive = true;

  function makePort(name) {
    const listeners = { message: [], disconnect: [] };
    const outbound = [];
    const port = {
      name,
      postMessage: (msg) => { outbound.push(msg); },
      disconnect: () => {
        listeners.disconnect.slice().forEach((fn) => { try { fn(); } catch (_) {} });
      },
      onMessage: { addListener: (fn) => listeners.message.push(fn) },
      onDisconnect: { addListener: (fn) => listeners.disconnect.push(fn) },
    };
    const handle = {
      port,
      outbound,
      inject: (msg) => {
        listeners.message.slice().forEach((fn) => fn(msg));
      },
      disconnect: () => port.disconnect(),
    };
    ports[name] = handle;
    return port;
  }

  const chrome = {
    runtime: {
      connect: ({ name }) => {
        if (!contextAlive) throw new Error('Extension context invalidated');
        return makePort(name);
      },
      sendMessage: async (_msg) => ({}),
      getManifest: () => ({ version: '0.9.0' }),
      get lastError() { return undefined; },
    },
    storage: {
      session: {
        get: async (keys) => {
          if (typeof keys === 'string') return { [keys]: sessionStore[keys] };
          if (Array.isArray(keys)) {
            const out = {};
            keys.forEach((k) => { out[k] = sessionStore[k]; });
            return out;
          }
          return { ...sessionStore };
        },
        set: async (obj) => {
          Object.assign(sessionStore, obj);
          const changes = {};
          for (const k of Object.keys(obj)) changes[k] = { newValue: obj[k] };
          storageListeners.forEach((fn) => { try { fn(changes, 'session'); } catch (_) {} });
        },
      },
      onChanged: { addListener: (fn) => storageListeners.push(fn) },
    },
    tabs: { create: (_o) => {} },
  };

  globalTarget.chrome = chrome;

  return {
    ports,
    sessionStore,
    dropContext: () => { contextAlive = false; },
  };
}
