/**
 * content/app-bridge.js — Port-based bridge between extension and main app
 *
 * Content script injected into the poker tracker app's page (isolated world).
 */

import { MSG, BRIDGE_MSG, PROTOCOL_VERSION, SESSION_KEYS, BUILD_GUARD } from '../shared/constants.js';
import { createPortConnection, EXTENSION_VERSION } from '../shared/port-connect.js';
import { validateMessage } from '../shared/message-schemas.js';
import { buildHandForRelay, buildLiveContext, buildStatus } from '../shared/wire-schemas.js';
import { getQueuedHands, dequeueHands, readLiveContext, writeConnectionState } from '../shared/storage-writer.js';
import * as errors from '../shared/error-reporter.js';

(() => {
  'use strict';

  // Build-stamped guard: allows re-initialization after extension updates or dev rebuilds
  const GUARD_KEY = '__POKER_APP_BRIDGE_' + BUILD_GUARD;
  if (window[GUARD_KEY]) return;

  // Teardown previous version's listeners if present
  if (typeof window.__POKER_APP_BRIDGE_CLEANUP === 'function') {
    try { window.__POKER_APP_BRIDGE_CLEANUP(); } catch (_) {}
  }

  window[GUARD_KEY] = true;

  const extensionVersion = EXTENSION_VERSION;

  // =========================================================================
  // PORT CONNECTION
  // =========================================================================

  const conn = createPortConnection({
    name: 'app-bridge',
    initialDelay: 2000,
    maxDelay: 30000,

    onMessage: (msg) => {
      const vErr = validateMessage(msg.type, msg);
      if (vErr) {
        console.warn(`[Poker Bridge] Blocked ${msg.type} from SW:`, vErr);
        return; // Do not process invalid messages
      }

      switch (msg.type) {
        // Hand delivery uses chrome.storage.session (see storage listener below)
        // Live context uses chrome.storage.session (see storage listener below)
        // Port only carries status from SW

        case 'status': {
          const status = buildStatus({
            connected: true,
            protocolVersion: msg.protocolVersion || PROTOCOL_VERSION,
          });
          window.postMessage({
            type: BRIDGE_MSG.STATUS,
            ...status,
            _v: PROTOCOL_VERSION,
            timestamp: Date.now(),
          }, '*');
          break;
        }
      }
    },

    onConnect: () => {
      console.log(
        '%c[Poker Bridge] Port connected (protocol v' + PROTOCOL_VERSION + ')',
        'color: #22c55e; font-weight: bold;'
      );
      writeConnectionState({ appBridgeAlive: true });
    },

    onDisconnect: () => {
      writeConnectionState({ appBridgeAlive: false });
      window.postMessage({
        type: BRIDGE_MSG.STATUS,
        ...buildStatus({ connected: false }),
        _v: PROTOCOL_VERSION,
        timestamp: Date.now(),
      }, '*');
    },

    onContextDead: () => {
      console.warn('[Poker Bridge] Extension context invalidated — bridge stopped');
      writeConnectionState({ appBridgeAlive: false });
      window.postMessage({
        type: BRIDGE_MSG.STATUS,
        ...buildStatus({ connected: false, contextDead: true }),
        _v: PROTOCOL_VERSION,
        timestamp: Date.now(),
      }, '*');
    },

    onVersionMismatch: (swVersion) => {
      console.warn(
        `%c[Poker Bridge] Version mismatch — content script: ${extensionVersion}, SW: ${swVersion}. Reload the page.`,
        'color: #ff6600; font-weight: bold;'
      );
    },
  });

  // =========================================================================
  // OUTBOUND: APP -> SERVICE WORKER (via Port)
  // =========================================================================

  const outboundListener = (event) => {
    if (event.source !== window) return;

    if (event.data?.type === BRIDGE_MSG.STATUS && event.data?.request === true) {
      window.postMessage({
        type: BRIDGE_MSG.STATUS,
        ...buildStatus({ connected: conn.connected, protocolVersion: PROTOCOL_VERSION }),
        _v: PROTOCOL_VERSION,
        timestamp: Date.now(),
      }, '*');
      return;
    }

    if (event.data?.type === BRIDGE_MSG.EXPLOITS) {
      conn.send({
        type: 'sync_exploits',
        seats: event.data.seats,
        handCount: event.data.handCount,
        timestamp: event.data.timestamp,
      });
      return;
    }

    if (event.data?.type === BRIDGE_MSG.ACTION_ADVICE) {
      conn.send({
        type: 'sync_action_advice',
        advice: event.data.advice,
        timestamp: event.data.timestamp,
      });
      return;
    }

    if (event.data?.type === BRIDGE_MSG.TOURNAMENT) {
      conn.send({
        type: 'sync_tournament',
        tournament: event.data.tournament,
        timestamp: event.data.timestamp,
      });
      return;
    }

    // Error reports from React app — forward to SW for aggregation
    if (event.data?.type === BRIDGE_MSG.ERROR_REPORT) {
      conn.send({
        type: 'error_report',
        report: event.data.report,
      });
      return;
    }

    // ACK from React app — dequeue delivered hands from session storage
    if (event.data?.type === BRIDGE_MSG.ACK) {
      const ids = event.data.captureIds;
      if (Array.isArray(ids) && ids.length > 0) {
        dequeueHands(ids).catch(() => {});
      }
      return;
    }
  };
  window.addEventListener('message', outboundListener);

  // =========================================================================
  // HAND DELIVERY: chrome.storage.session queue → app (via postMessage)
  //
  // ignition-capture.js writes hands to SESSION_KEYS.HAND_QUEUE.
  // We listen for changes, forward new entries to the React app, then dequeue.
  // This path is completely independent of the SW — survives SW suspension.
  // =========================================================================

  /** Forward hands from the session storage queue to the React app. */
  const deliverHands = (hands) => {
    if (!hands || hands.length === 0) return;
    const wireHands = hands.map(h => buildHandForRelay(h)).filter(Boolean);
    if (wireHands.length === 0) return;

    window.postMessage({
      type: BRIDGE_MSG.HANDS,
      hands: wireHands,
      _v: PROTOCOL_VERSION,
      meta: { extensionVersion, timestamp: Date.now() },
    }, '*');

    // Dequeue happens on ACK from React app (see outboundListener below)
  };

  // Listen for session storage changes — hand queue + live context
  const storageListener = (changes, area) => {
    if (area !== 'session') return;

    // Hand queue changes — fires when ignition-capture enqueues a hand
    const queueChange = changes[SESSION_KEYS.HAND_QUEUE];
    if (queueChange) {
      const newQueue = queueChange.newValue || [];
      const oldQueue = queueChange.oldValue || [];
      const oldIds = new Set(oldQueue.map(h => h.captureId));
      const newHands = newQueue.filter(h => !oldIds.has(h.captureId));
      deliverHands(newHands);
    }

    // Live context changes — fires when ignition-capture writes hand state
    const ctxChange = changes[SESSION_KEYS.LIVE_CONTEXT];
    if (ctxChange?.newValue) {
      const ctx = buildLiveContext(ctxChange.newValue);
      if (ctx) {
        window.postMessage({
          type: BRIDGE_MSG.HAND_STATE,
          ...ctx,
          _v: PROTOCOL_VERSION,
          timestamp: Date.now(),
        }, '*');
      }
    }

    // Connection state changes — forward capture-alive status to app
    const connChange = changes[SESSION_KEYS.CONNECTION_STATE];
    if (connChange?.newValue) {
      const state = connChange.newValue;
      window.postMessage({
        type: BRIDGE_MSG.STATUS,
        ...buildStatus({
          connected: !!(state.captureAlive && state.appBridgeAlive),
          protocolVersion: PROTOCOL_VERSION,
        }),
        _v: PROTOCOL_VERSION,
        timestamp: Date.now(),
      }, '*');
    }
  };
  chrome.storage.onChanged.addListener(storageListener);

  // Cold-start drain: deliver any hands queued before this script loaded.
  // Single attempt with a short delay to let React mount its listener.
  // If React isn't ready, hands stay in queue — the next enqueueHand()
  // fires storage.onChanged which re-delivers them.
  setTimeout(async () => {
    try {
      const queued = await getQueuedHands();
      if (queued.length > 0) {
        console.log(
          `%c[Poker Bridge] Cold-start drain: ${queued.length} hand(s)`,
          'color: #00ccff;'
        );
        deliverHands(queued);
      }
    } catch (e) {
      errors.report('bridge', e, { op: 'coldStartDrain' });
    }
  }, 500);

  // Cold-start: forward any fresh live context from session storage
  readLiveContext().then(ctx => {
    if (ctx) {
      const wireCtx = buildLiveContext(ctx);
      if (wireCtx) {
        window.postMessage({
          type: BRIDGE_MSG.HAND_STATE,
          ...wireCtx,
          _v: PROTOCOL_VERSION,
          timestamp: Date.now(),
        }, '*');
      }
    }
  }).catch(() => {});

  // Register cleanup for version-upgrade re-initialization
  window.__POKER_APP_BRIDGE_CLEANUP = () => {
    window.removeEventListener('message', outboundListener);
    chrome.storage.onChanged.removeListener(storageListener);
    conn.destroy();
  };
})();

