/**
 * content/capture-websocket-probe.js — WebSocket interception
 *
 * RUNS IN MAIN WORLD (page context) via manifest "world": "MAIN"
 * Injected at document_start to intercept WebSocket BEFORE site code runs.
 *
 * Posts captured messages via window.postMessage → content script bridge
 * → service worker pipeline.
 */

(() => {
  'use strict';

  const PROBE_BUILD = '%%BUILD_HASH%%';
  const CHANNEL = '%%CHANNEL_ID%%';

  // Message type codes (build-time injected, opaque to page JS)
  const T_LC  = %%T_LC%%;
  const T_MSG = %%T_MSG%%;
  const T_RDY = %%T_RDY%%;
  const T_PRE = %%T_PRE%%;
  const T_BFC = %%T_BFC%%;

  // Private symbols — closure-scoped, undiscoverable by page JS
  const PATCHED = Symbol();
  const CLEANUP = Symbol();

  // Already patched by this or previous version? Skip.
  if (window.WebSocket[PATCHED]) return;

  // Cleanup previous version's timer if present
  if (typeof window.WebSocket[CLEANUP] === 'function') {
    try { window.WebSocket[CLEANUP](); } catch (_) {}
  }

  let connectionCounter = 0;
  const baseId = Date.now() * 1000;

  // Save originals before any site code can wrap them
  const OriginalWebSocket = window.WebSocket;
  const origAddEventListener = EventTarget.prototype.addEventListener;
  const nativeToString = Function.prototype.toString;
  const nativeString = nativeToString.call(OriginalWebSocket);

  // =========================================================================
  // POST TO CONTENT SCRIPT
  // =========================================================================
  const targetOrigin = window.location.origin;
  const post = (data) => {
    try {
      window.postMessage({ channel: CHANNEL, ...data }, targetOrigin);
    } catch (e) {
      try {
        window.postMessage({
          channel: CHANNEL,
          type: data.type,
          fallback: JSON.stringify(data),
        }, targetOrigin);
      } catch (_) {}
    }
  };

  // =========================================================================
  // EXTRACT MESSAGE DATA
  // =========================================================================
  const extractMessageData = (data) => {
    if (typeof data === 'string') {
      return { dataType: 'string', size: data.length, preview: data.substring(0, 16000) };
    }
    if (data instanceof ArrayBuffer) {
      return { dataType: 'binary', size: data.byteLength };
    }
    if (data instanceof Blob) {
      return { dataType: 'blob', size: data.size };
    }
    return { dataType: 'unknown' };
  };

  // =========================================================================
  // STEALTH WEBSOCKET PROXY
  // =========================================================================
  window.WebSocket = new Proxy(OriginalWebSocket, {
    construct(target, args) {
      const [url, protocols] = args;
      const connId = baseId + (++connectionCounter);
      const ws = protocols ? new target(url, protocols) : new target(url);

      post({
        type: T_LC,
        event: 'creating',
        connId,
        url: typeof url === 'string' ? url : String(url),
        timestamp: Date.now(),
      });

      origAddEventListener.call(ws, 'message', (event) => {
        post({
          type: T_MSG,
          direction: 'incoming',
          connId,
          url: ws.url,
          timestamp: Date.now(),
          ...extractMessageData(event.data),
        });
      });

      origAddEventListener.call(ws, 'open', () => {
        post({ type: T_LC, event: 'opened', connId, url: ws.url, timestamp: Date.now() });
      });

      origAddEventListener.call(ws, 'close', (event) => {
        post({
          type: T_LC, event: 'closed', connId, url: ws.url,
          code: event.code, reason: event.reason, wasClean: event.wasClean,
          timestamp: Date.now(),
        });
      });

      origAddEventListener.call(ws, 'error', () => {
        post({ type: T_LC, event: 'error', connId, url: ws.url, timestamp: Date.now() });
      });

      return ws;
    },

    get(target, prop, receiver) {
      if (prop === 'toString') {
        return function toString() { return nativeString; };
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  // Mark as patched via private symbols (invisible to page JS enumeration)
  Object.defineProperty(window.WebSocket, PATCHED, { value: true });

  // Ready signal + single randomized retry
  post({ type: T_RDY, timestamp: Date.now() });
  const retryDelay = 100 + Math.random() * 200;
  const retryTimer = setTimeout(() => {
    post({ type: T_RDY, timestamp: Date.now() });
  }, retryDelay);

  // Store cleanup via private symbol
  Object.defineProperty(window.WebSocket, CLEANUP, {
    value: () => clearTimeout(retryTimer),
    configurable: true,
  });

  // =========================================================================
  // PRE-EXISTING WEBSOCKET DISCOVERY (bfcache only)
  // =========================================================================
  const discoverPreExisting = () => {
    try {
      const entries = performance.getEntriesByType('resource')
        .filter(e => e.name && (e.name.startsWith('wss://') || e.name.startsWith('ws://')));

      const gameEntries = entries.filter(e =>
        e.name.includes('poker-games/rgs') ||
        (e.name.includes('pkscb.ignitioncasino') && e.name.includes('/ws-gateway/'))
      );

      if (gameEntries.length > 0 && connectionCounter === 0) {
        post({
          type: T_PRE,
          urls: gameEntries.map(e => e.name),
          count: gameEntries.length,
          timestamp: Date.now(),
        });
      }
    } catch (_) {}
  };

  // Only check on bfcache restore — document_start guarantees we patch before any page JS
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      post({ type: T_BFC, timestamp: Date.now() });
      setTimeout(discoverPreExisting, 500);
    }
  });
})();
