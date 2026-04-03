/**
 * content/capture-websocket-probe.js — WebSocket interception
 *
 * RUNS IN MAIN WORLD (page context) via manifest "world": "MAIN"
 * Injected at document_start to patch WebSocket BEFORE Ignition's code runs.
 *
 * Posts captured messages via window.postMessage → content script bridge
 * → service worker pipeline.
 */

(() => {
  'use strict';

  // Build-stamped guard: allows re-patching after extension reload/update.
  // %%BUILD_HASH%% is replaced by build.mjs with a unique per-build hash.
  const PROBE_BUILD = '%%BUILD_HASH%%';
  const PROBE_GUARD = '__POKER_WS_PROBE_' + PROBE_BUILD;

  if (window[PROBE_GUARD]) return;

  // Cleanup previous probe version's heartbeat timer if present
  if (typeof window.__POKER_WS_PROBE_CLEANUP === 'function') {
    try { window.__POKER_WS_PROBE_CLEANUP(); } catch (_) {}
  }

  window[PROBE_GUARD] = true;

  const CHANNEL = '__poker_ext_ws';
  // Monotonic IDs: high-res base + increment prevents collision when
  // multiple WebSockets are created in the same millisecond.
  let connectionCounter = 0;
  const baseId = Date.now() * 1000;

  // =========================================================================
  // POST TO CONTENT SCRIPT
  // =========================================================================
  const post = (data) => {
    try {
      window.postMessage({ channel: CHANNEL, ...data }, '*');
    } catch (e) {
      try {
        window.postMessage({
          channel: CHANNEL,
          type: data.type,
          fallback: JSON.stringify(data),
        }, '*');
      } catch (e2) {
        console.warn('[WS Probe] postMessage fallback failed:', e2.message);
      }
    }
  };

  // =========================================================================
  // EXTRACT MESSAGE DATA (minimal — just what the pipeline needs)
  // =========================================================================
  const extractMessageData = (data) => {
    if (typeof data === 'string') {
      return {
        dataType: 'string',
        size: data.length,
        preview: data.substring(0, 16000),
      };
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
  // MONKEY-PATCH WEBSOCKET
  // =========================================================================
  const OriginalWebSocket = window.WebSocket;

  const PatchedWebSocket = function (url, protocols) {
    const connId = baseId + (++connectionCounter);
    const ws = protocols
      ? new OriginalWebSocket(url, protocols)
      : new OriginalWebSocket(url);

    post({
      type: 'ws_lifecycle',
      event: 'creating',
      connId,
      url: typeof url === 'string' ? url : String(url),
      timestamp: Date.now(),
    });

    // Only intercept incoming — outgoing messages are not used by the pipeline
    // and forwarding them doubled traffic through the entire capture chain.
    ws.addEventListener('message', (event) => {
      post({
        type: 'ws_message',
        direction: 'incoming',
        connId,
        url: ws.url,
        timestamp: Date.now(),
        ...extractMessageData(event.data),
      });
    });

    // Lifecycle
    ws.addEventListener('open', () => {
      post({ type: 'ws_lifecycle', event: 'opened', connId, url: ws.url, timestamp: Date.now() });
    });

    ws.addEventListener('close', (event) => {
      post({
        type: 'ws_lifecycle', event: 'closed', connId, url: ws.url,
        code: event.code, reason: event.reason, wasClean: event.wasClean,
        timestamp: Date.now(),
      });
    });

    ws.addEventListener('error', () => {
      post({ type: 'ws_lifecycle', event: 'error', connId, url: ws.url, timestamp: Date.now() });
    });

    return ws;
  };

  // Preserve WebSocket API surface
  PatchedWebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  PatchedWebSocket.OPEN = OriginalWebSocket.OPEN;
  PatchedWebSocket.CLOSING = OriginalWebSocket.CLOSING;
  PatchedWebSocket.CLOSED = OriginalWebSocket.CLOSED;
  PatchedWebSocket.prototype = OriginalWebSocket.prototype;

  window.WebSocket = PatchedWebSocket;

  // Health signal — lets capture bridge (and diagnostics) verify the probe is active
  window.__POKER_WS_PROBE_HEALTH = {
    active: true,
    patchedAt: Date.now(),
    connectionCount: () => connectionCounter,
  };
  // Backward-compat flag for capture scripts that check the boolean
  window.__POKER_WS_PROBE_ACTIVE = true;

  // Post probe-ready event so capture bridge knows patching succeeded
  post({ type: 'ws_probe_ready', timestamp: Date.now() });

  // Heartbeat: re-send probe_ready for 60s to handle late-starting capture scripts
  let heartbeatCount = 0;
  const heartbeatTimer = setInterval(() => {
    if (++heartbeatCount >= 6) { clearInterval(heartbeatTimer); return; }
    post({ type: 'ws_probe_ready', timestamp: Date.now(), heartbeat: true });
  }, 10000);

  // Register cleanup so future probe versions can teardown this one's timer
  window.__POKER_WS_PROBE_CLEANUP = () => {
    clearInterval(heartbeatTimer);
  };

  // =========================================================================
  // PRE-EXISTING WEBSOCKET DISCOVERY
  // =========================================================================
  // Detect game WebSocket URLs opened BEFORE the probe patched the constructor.
  // Uses Performance API to find WebSocket resource entries.

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
          type: 'ws_preexisting_detected',
          urls: gameEntries.map(e => e.name),
          count: gameEntries.length,
          timestamp: Date.now(),
        });
      }
    } catch (_) {
      // PerformanceObserver/getEntriesByType not available — degrade gracefully
    }
  };

  // Check immediately + after 2s (for bfcache restore timing)
  discoverPreExisting();
  setTimeout(discoverPreExisting, 2000);

  // bfcache restoration: page restored with live WS connections
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      post({ type: 'ws_bfcache_restore', timestamp: Date.now() });
      setTimeout(discoverPreExisting, 500);
    }
  });

  console.log('%c[Poker WS Probe] Active (build: ' + PROBE_BUILD + ')', 'color: #00ff00; font-weight: bold;');
})();
