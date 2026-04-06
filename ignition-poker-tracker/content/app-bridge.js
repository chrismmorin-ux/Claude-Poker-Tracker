/**
 * content/app-bridge.js — Port-based bridge between extension and main app
 *
 * Content script injected into the poker tracker app's page (isolated world).
 */

import { MSG, BRIDGE_MSG, PROTOCOL_VERSION, BUILD_GUARD } from '../shared/constants.js';
import { createPortConnection, EXTENSION_VERSION } from '../shared/port-connect.js';
import { validateMessage } from '../shared/message-schemas.js';
import { buildHandForRelay, buildLiveContext, buildStatus } from '../shared/wire-schemas.js';
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
        // Allow push_ messages from SW that may not have schemas yet
        if (!msg.type?.startsWith('push_')) {
          console.warn(`[Poker Bridge] Blocked ${msg.type} from SW:`, vErr);
          return;
        }
      }

      switch (msg.type) {
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

        // Hand delivery — pushed from SW when a hand is enqueued
        case 'push_hand': {
          if (msg.hand) {
            deliverHands([msg.hand]);
          }
          break;
        }

        // Live context — pushed from SW when capture sends hand state
        case 'push_live_context': {
          if (msg.context) {
            const ctx = buildLiveContext(msg.context);
            if (ctx) {
              window.postMessage({
                type: BRIDGE_MSG.HAND_STATE,
                ...ctx,
                _v: PROTOCOL_VERSION,
                timestamp: Date.now(),
              }, '*');
            }
          }
          break;
        }

        // Connection state — pushed from SW on capture port connect/disconnect
        case 'push_connection_state': {
          if (msg.state) {
            window.postMessage({
              type: BRIDGE_MSG.STATUS,
              ...buildStatus({
                connected: !!msg.state.captureAlive,
                protocolVersion: PROTOCOL_VERSION,
              }),
              _v: PROTOCOL_VERSION,
              timestamp: Date.now(),
            }, '*');
          }
          break;
        }
      }
    },

    onConnect: () => {
      console.log(
        '%c[Poker Bridge] Port connected (protocol v' + PROTOCOL_VERSION + ')',
        'color: #22c55e; font-weight: bold;'
      );
      chrome.runtime.sendMessage({ type: MSG.WRITE_CONNECTION_STATE, update: { appBridgeAlive: true } }).catch(() => {});
    },

    onDisconnect: () => {
      chrome.runtime.sendMessage({ type: MSG.WRITE_CONNECTION_STATE, update: { appBridgeAlive: false } }).catch(() => {});
      window.postMessage({
        type: BRIDGE_MSG.STATUS,
        ...buildStatus({ connected: false }),
        _v: PROTOCOL_VERSION,
        timestamp: Date.now(),
      }, '*');
    },

    onContextDead: () => {
      console.warn('[Poker Bridge] Extension context invalidated — bridge stopped');
      chrome.runtime.sendMessage({ type: MSG.WRITE_CONNECTION_STATE, update: { appBridgeAlive: false } }).catch(() => {});
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

    // ACK from React app — dequeue delivered hands via SW
    if (event.data?.type === BRIDGE_MSG.ACK) {
      const ids = event.data.captureIds;
      if (Array.isArray(ids) && ids.length > 0) {
        chrome.runtime.sendMessage({ type: MSG.DEQUEUE_HANDS, captureIds: ids }).catch(() => {});
      }
      return;
    }
  };
  window.addEventListener('message', outboundListener);

  // =========================================================================
  // HAND DELIVERY: SW pushes hands via port → app (via postMessage)
  //
  // SW receives hands from capture, enqueues in session storage, then pushes
  // to app-bridge via port. App-bridge forwards to React app.
  // =========================================================================

  /** Forward hands from the SW to the React app. */
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

    // Dequeue happens on ACK from React app (see outboundListener above)
  };

  // Cold-start drain: request any hands queued before this script loaded from SW.
  // Single attempt with a short delay to let React mount its listener.
  setTimeout(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: MSG.GET_QUEUED_HANDS });
      const queued = response?.hands || [];
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

  // Cold-start: request any fresh live context from SW
  chrome.runtime.sendMessage({ type: MSG.GET_LIVE_CONTEXT }).then(ctx => {
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
    conn.destroy();
  };
})();

