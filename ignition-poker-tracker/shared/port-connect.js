/**
 * shared/port-connect.js — Reusable port connection with resilience
 *
 * Provides:
 *   - Exponential backoff reconnection (configurable delays)
 *   - Extension context invalidation detection (stops retrying)
 *   - Outbound message queuing while disconnected
 *   - Version handshake on connect (detects stale content scripts)
 *   - Observable connection state for diagnostics
 */

import { EXTENSION_VERSION } from './constants.js';
export { EXTENSION_VERSION };

// Error messages that indicate the extension context is gone — stop retrying
const CONTEXT_DEAD_PATTERNS = [
  'Extension context invalidated',
  'Cannot access a chrome',
  'Extension has been disabled',
  'Extension does not exist',
];

export const isContextDead = (error) => {
  const msg = error?.message || String(error);
  return CONTEXT_DEAD_PATTERNS.some(p => msg.includes(p));
};

/**
 * Create a managed port connection with automatic reconnection.
 *
 * @param {Object} opts
 * @param {string} opts.name - Port name (e.g., 'ignition-capture', 'app-bridge', 'side-panel')
 * @param {function} [opts.onMessage] - Handler for incoming messages: (msg) => void
 * @param {function} [opts.onConnect] - Called on each successful connection: (port) => void
 * @param {function} [opts.onDisconnect] - Called on each disconnection: () => void
 * @param {function} [opts.onContextDead] - Called when extension context is irrecoverably dead
 * @param {function} [opts.onVersionMismatch] - Called when SW version differs: (swVersion) => void
 * @param {number} [opts.initialDelay=1000] - Initial reconnect delay (ms)
 * @param {number} [opts.maxDelay=30000] - Maximum reconnect delay (ms)
 * @param {number} [opts.maxPending=10] - Max queued outbound messages
 * @returns {Object} Connection handle with send(), destroy(), getState() methods
 */
export const createPortConnection = (opts) => {
  const {
    name,
    onMessage,
    onConnect,
    onDisconnect,
    onContextDead,
    onVersionMismatch,
    initialDelay = 1000,
    maxDelay = 30000,
    maxPending = 10,
  } = opts;

  let port = null;
  let reconnectTimer = null;
  let destroyed = false;
  let contextDead = false;
  let connectCount = 0;
  let lastDisconnectTime = null;
  let swVersion = null;
  const pendingOutbound = [];

  /** Send a message, or queue it if disconnected. */
  const send = (msg) => {
    if (destroyed || contextDead) return false;
    if (port) {
      try {
        port.postMessage(msg);
        return true;
      } catch (e) {
        if (isContextDead(e)) {
          handleContextDead();
          return false;
        }
        port = null;
      }
    }
    // Queue for later delivery
    if (pendingOutbound.length >= maxPending) pendingOutbound.shift();
    pendingOutbound.push(msg);
    return false;
  };

  /** Drain pending outbound messages after reconnect. */
  const drainPending = () => {
    while (pendingOutbound.length > 0) {
      try {
        port.postMessage(pendingOutbound.shift());
      } catch (e) {
        if (isContextDead(e)) {
          handleContextDead();
          return;
        }
        break; // Port died during drain — remaining stay queued
      }
    }
  };

  const handleContextDead = () => {
    contextDead = true;
    port = null;
    clearReconnectTimer();
    onContextDead?.();
  };

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = (delay) => {
    if (destroyed || contextDead || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    if (destroyed || contextDead) return;

    try {
      port = chrome.runtime.connect({ name });
      connectCount++;

      // Drain queued messages
      drainPending();

      // Listen for incoming messages
      port.onMessage.addListener((msg) => {
        // Handle version handshake from SW
        if (msg.type === '__version_check') {
          swVersion = msg.version;
          if (swVersion !== EXTENSION_VERSION) {
            onVersionMismatch?.(swVersion);
          }
          return;
        }
        onMessage?.(msg);
      });

      // Handle disconnection
      port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError;
        port = null;
        lastDisconnectTime = Date.now();

        if (error && isContextDead(error)) {
          handleContextDead();
          return;
        }

        onDisconnect?.();

        // Exponential backoff
        const attempt = Math.min(connectCount, 10);
        const delay = Math.min(initialDelay * Math.pow(1.5, attempt - 1), maxDelay);
        scheduleReconnect(delay);
      });

      onConnect?.(port);
    } catch (e) {
      if (isContextDead(e)) {
        handleContextDead();
        return;
      }
      // Transient failure — schedule retry
      const delay = Math.min(initialDelay * Math.pow(1.5, connectCount), maxDelay);
      scheduleReconnect(delay);
    }
  };

  /** Permanently tear down this connection. */
  const destroy = () => {
    destroyed = true;
    clearReconnectTimer();
    if (port) {
      try { port.disconnect(); } catch (_) {}
      port = null;
    }
    pendingOutbound.length = 0;
  };

  /** Get observable connection state for diagnostics. */
  const getState = () => ({
    connected: !!port,
    contextDead,
    destroyed,
    connectCount,
    pendingMessages: pendingOutbound.length,
    lastDisconnectTime,
    swVersion,
    extensionVersion: EXTENSION_VERSION,
  });

  // Auto-connect
  connect();

  return { send, destroy, getState, get connected() { return !!port; } };
};
