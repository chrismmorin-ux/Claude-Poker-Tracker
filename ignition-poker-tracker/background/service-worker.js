/**
 * background/service-worker.js — Badge, cache, and diagnostic hub
 *
 * Hand delivery now bypasses the SW entirely (chrome.storage.session queue).
 * This SW handles:
 *   - Badge updates (hand count)
 *   - Caching exploit/advice/tournament data from the app
 *   - Relaying live context to side-panel (lossy, low-latency)
 *   - Serving popup/side-panel queries
 */

import { MSG, STORAGE_KEYS, SESSION_KEYS as STORAGE_KEYS_SESSION, PROTOCOL_VERSION, EXTENSION_VERSION } from '../shared/constants.js';
import * as errors from '../shared/error-reporter.js';
import { enqueueHand, appendSidePanelHand, writeLiveContext, getQueueLength, writeConnectionState, getQueuedHands, dequeueHands } from '../shared/storage-writer.js';
import { validateMessage } from '../shared/message-schemas.js';

const SW_VERSION = EXTENSION_VERSION;

// chrome.storage.session defaults to TRUSTED_CONTEXTS only.
// Content scripts (including app-bridge) receive data via port pushes, not direct storage access.
// This prevents casino page scripts from reading hand/exploit/context data.

// ===========================================================================
// STATE
// ===========================================================================

let cachedExploits = null;
let cachedActionAdvice = null;
let cachedTournament = null;
let appBridgePort = null;
const capturePorts = new Set();
let sidePanelPort = null;
const swStartTime = Date.now();

// Cached pipeline status from content script (for popup/side-panel queries)
let lastPipelineStatus = { tables: {}, tableCount: 0, completedHands: 0 };
// Live context throttle for side-panel forwarding (max ~5/sec)
let _liveCtxTimer = null;
let _pendingLiveCtx = null;
// Cached diagnostics from content script
let cachedDiagnostics = null;
// Running hand count for badge (incremented on hand_saved notifications)
let totalHandsSaved = 0;

// Restore caches on worker startup
(async () => {
  try {
    const result = await chrome.storage.session?.get([
      'exploit_cache', 'action_advice_cache', 'tournament_cache',
      'pipeline_status_cache', 'total_hands_saved',
    ]);
    if (result?.exploit_cache) cachedExploits = result.exploit_cache;
    if (result?.action_advice_cache) cachedActionAdvice = result.action_advice_cache;
    if (result?.tournament_cache) cachedTournament = result.tournament_cache;
    if (result?.pipeline_status_cache) lastPipelineStatus = result.pipeline_status_cache;
    if (result?.total_hands_saved) totalHandsSaved = result.total_hands_saved;
  } catch (e) {
    errors.report('storage', e, { op: 'restore_caches' });
  }
})();

// ===========================================================================
// HELPERS
// ===========================================================================

const pushToSidePanel = (msg) => {
  if (!sidePanelPort) return;
  try { sidePanelPort.postMessage(msg); } catch (e) { console.warn('[SW] Side panel push failed:', e.message); sidePanelPort = null; }
};

const pushToAppBridge = (msg) => {
  if (!appBridgePort) return;
  try { appBridgePort.postMessage(msg); } catch (e) { console.warn('[SW] App bridge push failed:', e.message); appBridgePort = null; }
};

const pushFullStateToSidePanel = async () => {
  if (!sidePanelPort) return;
  try {
    const queueLength = await getQueueLength();
    pushToSidePanel({
      type: 'push_pipeline_status',
      tables: lastPipelineStatus.tables,
      tableCount: lastPipelineStatus.tableCount,
      completedHands: lastPipelineStatus.completedHands,
      storedHands: totalHandsSaved,
      queueLength,
      appConnected: !!appBridgePort,
      liveContext: null,
      errorCount: errors.getCount(),
      diagnosticData: cachedDiagnostics,
    });
    if (cachedExploits) {
      pushToSidePanel({ type: 'push_exploits', seats: cachedExploits.seats, appConnected: !!appBridgePort });
    }
    if (cachedActionAdvice) {
      pushToSidePanel({ type: 'push_action_advice', ...cachedActionAdvice });
    }
    if (cachedTournament) {
      pushToSidePanel({ type: 'push_tournament', ...cachedTournament });
    }
  } catch (e) {
    errors.report('messaging', e, { op: 'push_full_state' });
  }
};

// ===========================================================================
// BADGE
// ===========================================================================

const updateBadge = (count) => {
  try {
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#d4a847' });
  } catch (e) {
    errors.report('messaging', e, { op: 'badge_update' });
  }
};

// ===========================================================================
// PORT MANAGEMENT
// ===========================================================================

chrome.runtime.onConnect.addListener((port) => {
  // --- CAPTURE PORT (content script → SW) ---
  if (port.name === 'ignition-capture') {
    capturePorts.add(port);
    try { port.postMessage({ type: '__version_check', version: SW_VERSION }); } catch (e) { console.warn('[SW] Version check failed:', e.message); }

    port.onMessage.addListener((msg) => {
      switch (msg.type) {
        case 'hand_complete': {
          // Content scripts can't access chrome.storage.session — SW handles storage
          const hand = msg.hand;
          if (!hand) break;
          (async () => {
            try {
              const result = await enqueueHand(hand);
              if (result.success) {
                appendSidePanelHand(hand);
                totalHandsSaved++;
                updateBadge(totalHandsSaved);
                chrome.storage.session.set({ total_hands_saved: totalHandsSaved }).catch(() => {});
                pushToSidePanel({ type: 'push_hands_updated', totalHands: totalHandsSaved });
                pushToAppBridge({ type: 'push_hand', hand });
              } else {
                console.warn('[SW] Failed to enqueue hand');
              }
            } catch (e) {
              errors.report('storage', e, { op: 'hand_complete' });
            }
          })();
          break;
        }

        case 'hand_saved':
          // Legacy: badge update only (hand already stored)
          totalHandsSaved++;
          updateBadge(totalHandsSaved);
          chrome.storage.session.set({ total_hands_saved: totalHandsSaved }).catch(() => {});
          pushToSidePanel({ type: 'push_hands_updated', totalHands: totalHandsSaved });
          break;

        case 'live_context':
          if (msg.context) {
            // Write to session storage (SW has access)
            writeLiveContext(msg.context);
            // Push to app-bridge (replaces storage.onChanged for content scripts)
            pushToAppBridge({ type: 'push_live_context', context: msg.context });
            // Throttled forward to side panel (max ~5/sec)
            _pendingLiveCtx = msg.context;
            if (!_liveCtxTimer) {
              pushToSidePanel({ type: 'push_live_context', context: msg.context });
              _pendingLiveCtx = null;
              _liveCtxTimer = setTimeout(() => {
                _liveCtxTimer = null;
                if (_pendingLiveCtx) {
                  pushToSidePanel({ type: 'push_live_context', context: _pendingLiveCtx });
                  _pendingLiveCtx = null;
                }
              }, 200);
            }
          }
          break;

        case 'pipeline_status':
          if (msg.status) {
            lastPipelineStatus = msg.status;
            chrome.storage.session.set({ pipeline_status_cache: msg.status }).catch(() => {});
            // Forward to side panel so it tracks active tables in real time
            pushToSidePanel({
              type: 'push_pipeline_status',
              tables: msg.status.tables,
              tableCount: msg.status.tableCount,
              completedHands: msg.status.completedHands,
              storedHands: totalHandsSaved,
              appConnected: !!appBridgePort,
            });
          }
          break;

        case 'pipeline_diagnostics':
          // Write to session storage (SW has access, content scripts don't)
          // and forward to side panel via port push
          if (msg.data) {
            chrome.storage.session.set({ [STORAGE_KEYS_SESSION.PIPELINE_DIAG]: msg.data }).catch(() => {});
            pushToSidePanel({ type: 'push_pipeline_diagnostics', data: msg.data });
          }
          break;

        case 'pipeline_error':
          errors.report('pipeline', msg.message || 'Unknown pipeline error', msg.context);
          break;

        case 'diagnostics':
          cachedDiagnostics = msg.data || null;
          break;

        case 'recovery_needed':
          pushToSidePanel({
            type: 'push_recovery_needed',
            reason: msg.reason,
            message: msg.message,
            urls: msg.urls || [],
          });
          break;

        case 'recovery_cleared':
          pushToSidePanel({ type: 'push_recovery_cleared' });
          break;

        case 'silence_alert':
          pushToSidePanel({
            type: 'push_silence_alert',
            level: msg.level,
            silenceMs: msg.silenceMs,
            message: msg.message,
          });
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      capturePorts.delete(port);
      pushToAppBridge({ type: 'push_connection_state', state: { captureAlive: capturePorts.size > 0 } });
    });
    // Notify app-bridge that a capture port connected
    pushToAppBridge({ type: 'push_connection_state', state: { captureAlive: true } });
    return;
  }

  // --- SIDE PANEL PORT ---
  if (port.name === 'side-panel') {
    sidePanelPort = port;
    try { port.postMessage({ type: '__version_check', version: SW_VERSION }); } catch (e) { console.warn('[SW] Version check failed:', e.message); }
    pushFullStateToSidePanel();
    port.onMessage.addListener((msg) => {
      if (msg.type === 'request_full_state') {
        pushFullStateToSidePanel();
      }
      if (msg.type === 'reload_ignition_tabs') {
        chrome.tabs.query({
          url: ['https://*.ignitioncasino.eu/*', 'https://*.ignitioncasino.net/*'],
        }).then(tabs => {
          for (const tab of tabs) {
            chrome.tabs.reload(tab.id);
          }
          pushToSidePanel({ type: 'push_recovery_cleared' });
        }).catch(e => errors.report('tabs', e, { op: 'reload_ignition_tabs' }));
      }
    });
    port.onDisconnect.addListener(() => { sidePanelPort = null; });
    return;
  }

  // --- APP BRIDGE PORT ---
  if (port.name !== 'app-bridge') return;

  appBridgePort = port;
  try { port.postMessage({ type: '__version_check', version: SW_VERSION }); } catch (e) { console.warn('[SW] Version check failed:', e.message); }
  port.postMessage({ type: 'status', connected: true, protocolVersion: PROTOCOL_VERSION });

  port.onMessage.addListener((msg) => {
    const vErr = validateMessage(msg.type, msg);
    if (vErr) {
      errors.report('validation', `Blocked ${msg.type}: ${vErr}`, { port: 'app-bridge' });
      return; // Do not process invalid messages
    }

    switch (msg.type) {
      case 'sync_exploits': {
        cachedExploits = {
          seats: msg.seats || [],
          handCount: msg.handCount || 0,
          timestamp: msg.timestamp || Date.now(),
        };
        try {
          chrome.storage.session?.set({ exploit_cache: cachedExploits });
          pushToSidePanel({ type: 'push_exploits', seats: cachedExploits.seats, appConnected: true });
        } catch (e) {
          errors.report('storage', e, { op: 'cache_exploits_port' });
        }
        break;
      }
      case 'sync_action_advice': {
        cachedActionAdvice = {
          advice: msg.advice || null,
          timestamp: msg.timestamp || Date.now(),
        };
        try {
          chrome.storage.session?.set({ action_advice_cache: cachedActionAdvice });
          pushToSidePanel({ type: 'push_action_advice', ...cachedActionAdvice });
        } catch (e) {
          errors.report('storage', e, { op: 'cache_action_advice' });
        }
        break;
      }
      case 'sync_tournament': {
        cachedTournament = {
          tournament: msg.tournament || null,
          timestamp: msg.timestamp || Date.now(),
        };
        try {
          chrome.storage.session?.set({ tournament_cache: cachedTournament });
          pushToSidePanel({ type: 'push_tournament', ...cachedTournament });
        } catch (e) {
          errors.report('storage', e, { op: 'cache_tournament' });
        }
        break;
      }
      case 'error_report': {
        // App-side error forwarded for aggregation — add to error reporter
        const r = msg.report;
        if (r) {
          errors.report(r.category || 'app', r.message || 'unknown', {
            source: 'app',
            captureId: r.correlationId,
          });
        }
        break;
      }
    }
  });

  port.onDisconnect.addListener(() => {
    appBridgePort = null;
  });
});

// ===========================================================================
// MESSAGE HANDLER (popup / side-panel queries)
// ===========================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case MSG.GET_PIPELINE_STATUS: {
      (async () => {
        try {
          const queueLength = await getQueueLength();
          let liveContext = null;
          try {
            const stored = await chrome.storage.session?.get('live_hand_context');
            const ctx = stored?.live_hand_context;
            if (ctx && ctx._persistedAt && (Date.now() - ctx._persistedAt < 30000)) {
              liveContext = ctx;
            }
          } catch (e) {
            errors.report('storage', e, { op: 'readLiveContext' });
          }
          sendResponse({
            tables: lastPipelineStatus.tables,
            tableCount: lastPipelineStatus.tableCount,
            completedHands: lastPipelineStatus.completedHands,
            storedHands: totalHandsSaved,
            queueLength,
            appConnected: !!appBridgePort,
            liveContext,
            errorCount: errors.getCount(),
          });
        } catch (e) {
          errors.report('storage', e, { op: 'get_pipeline_status' });
          sendResponse({ tables: {}, tableCount: 0, completedHands: 0, storedHands: 0, appConnected: false, liveContext: null, errorCount: errors.getCount() });
        }
      })();
      return true;
    }

    case MSG.GET_EXPLOITS: {
      sendResponse(cachedExploits
        ? { ...cachedExploits, appConnected: !!appBridgePort }
        : { seats: [], appConnected: false });
      return false;
    }

    case MSG.GET_LIVE_CONTEXT: {
      (async () => {
        try {
          const stored = await chrome.storage.session?.get('live_hand_context');
          const ctx = stored?.live_hand_context;
          if (ctx && ctx._persistedAt && (Date.now() - ctx._persistedAt > 30000)) {
            sendResponse(null);
          } else {
            sendResponse(ctx || null);
          }
        } catch (_) {
          sendResponse(null);
        }
      })();
      return true;
    }

    case MSG.GET_ACTION_ADVICE: {
      sendResponse(cachedActionAdvice || { advice: null });
      return false;
    }

    case MSG.GET_CAPTURED_HANDS: {
      // Legacy: return empty — hands now flow through session storage queue
      sendResponse({ hands: [] });
      return false;
    }

    case MSG.CLEAR_CAPTURED_HANDS: {
      // Legacy: no-op — staging buffer no longer exists
      updateBadge(0);
      totalHandsSaved = 0;
      sendResponse({ cleared: true });
      return false;
    }

    case MSG.GET_DIAGNOSTIC_LOG: {
      if (cachedDiagnostics) {
        sendResponse({ ready: true, ...cachedDiagnostics });
        return false;
      }
      for (const port of capturePorts) {
        try {
          port.postMessage({ type: 'request_diagnostics' });
        } catch (e) {
          errors.report('messaging', e, { op: 'requestDiagnostics' });
        }
      }
      sendResponse({ ready: false, hsmLogs: {}, lobbyMessages: [], tableConfigs: {} });
      return false;
    }

    case MSG.PING: {
      sendResponse({
        alive: true,
        version: SW_VERSION,
        uptime: Date.now() - swStartTime,
        tableCount: lastPipelineStatus.tableCount,
        capturePorts: capturePorts.size,
        hasCachedExploits: !!cachedExploits,
        hasCachedAdvice: !!cachedActionAdvice,
        errorCount: errors.getCount(),
      });
      return false;
    }

    // App-bridge storage relay handlers (replaces direct chrome.storage.session access)
    case MSG.GET_QUEUED_HANDS: {
      getQueuedHands()
        .then(hands => sendResponse({ hands }))
        .catch(() => sendResponse({ hands: [] }));
      return true;
    }

    case MSG.DEQUEUE_HANDS: {
      const ids = message.captureIds;
      if (Array.isArray(ids) && ids.length > 0) {
        dequeueHands(ids)
          .then(count => sendResponse({ count }))
          .catch(() => sendResponse({ count: 0 }));
      } else {
        sendResponse({ count: 0 });
      }
      return true;
    }

    case MSG.WRITE_CONNECTION_STATE: {
      if (message.update) {
        writeConnectionState(message.update).catch(() => {});
      }
      sendResponse({ ok: true });
      return false;
    }
  }
});

// ===========================================================================
// LIFECYCLE
// ===========================================================================

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[SW] Poker Session Notes installed:', details.reason);

  if (details.reason === 'update') {
    // Migrate any hands from legacy chrome.storage.local to session queue
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.CAPTURED_HANDS);
      const legacyHands = result[STORAGE_KEYS.CAPTURED_HANDS] || [];
      if (legacyHands.length > 0) {
        // Import legacy hands into the new session queue
        const { enqueueHand } = await import('../shared/storage-writer.js');
        for (const hand of legacyHands) {
          await enqueueHand(hand);
        }
        console.log(`[SW] Migrated ${legacyHands.length} legacy hand(s) to session queue`);
      }
      // Clear legacy storage
      await chrome.storage.local.remove([STORAGE_KEYS.CAPTURED_HANDS, 'ignition_hand_count', 'ignition_acked_ids']);
      updateBadge(0);
    } catch (e) {
      errors.report('storage', e, { op: 'update_migration' });
    }
  }
});

// Heartbeat — keep SW alive indicator for diagnostics
setInterval(async () => {
  try {
    chrome.storage.session?.set({ sw_heartbeat: Date.now() });
  } catch (e) {
    errors.report('storage', e, { op: 'swHeartbeat' });
  }
}, 30000);

// Restore badge on SW startup (persisted count preferred, queue length as fallback)
(async () => {
  const result = await chrome.storage.session.get('total_hands_saved').catch(() => ({}));
  if (result?.total_hands_saved) {
    totalHandsSaved = result.total_hands_saved;
  } else {
    totalHandsSaved = await getQueueLength();
  }
  updateBadge(totalHandsSaved);
})();

console.log('[SW] Active');
