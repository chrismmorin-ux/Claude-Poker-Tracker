/**
 * chrome-stub.js — minimal chrome.* runtime for loading side-panel.js under test.
 *
 * SR-1 replay harness. NOT for production use.
 *
 * Surface covered: runtime.connect (Port), runtime.sendMessage, runtime.getManifest,
 * runtime.lastError, storage.onChanged, storage.session.get, tabs.create.
 *
 * The stub exposes one inbound channel per port: `ports[name].inject(msg)` delivers
 * a message into side-panel.js's onMessage listener. Outbound port.postMessage calls
 * from side-panel are captured in `ports[name].outbound`.
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
