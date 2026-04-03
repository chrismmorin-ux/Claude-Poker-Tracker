/**
 * content/ignition-capture.js — Pipeline host (ISOLATED world)
 *
 * Runs the hand-tracking pipeline (TableManager + HandStateMachine) directly
 * in the content script. Content scripts live as long as the page, so MV3
 * service worker suspension cannot interrupt hand capture.
 *
 * The SW is now a thin relay: storage writes, badge updates, side-panel forwarding.
 *
 * Flow: Probe (MAIN world) → window.postMessage → THIS SCRIPT (pipeline)
 *       → chrome.runtime.Port → SW (relay) → app-bridge / side-panel
 */

import { createPortConnection, EXTENSION_VERSION } from '../shared/port-connect.js';
import { BUILD_GUARD, SESSION_KEYS } from '../shared/constants.js';
import { TableManager } from '../shared/table-manager.js';
import { validateMessage } from '../shared/message-schemas.js';
import { clearLiveContextTimer } from '../shared/storage-writer.js';
import { validateHandForRelay } from '../shared/wire-schemas.js';
import { isGameWsUrl } from '../shared/protocol.js';

(() => {
  'use strict';

  // Build-stamped guard: allows re-initialization after extension updates
  // or dev rebuilds without requiring a page reload.
  const GUARD_KEY = '__POKER_CAPTURE_' + BUILD_GUARD;
  console.log('[Poker Capture] Script loaded on', window.location.href, '| guard:', GUARD_KEY);
  if (window[GUARD_KEY]) {
    console.log('[Poker Capture] Guard key already set — skipping re-init');
    return;
  }

  // Teardown previous version's listeners if present
  if (typeof window.__POKER_CAPTURE_CLEANUP === 'function') {
    try { window.__POKER_CAPTURE_CLEANUP(); } catch (e) { console.warn('[Poker Capture] Cleanup error:', e.message); }
  }

  window[GUARD_KEY] = true;

  const CHANNEL = '__poker_ext_ws';
  let wsMessageCount = 0;
  let probeReady = false;

  // =========================================================================
  // PIPELINE DIAGNOSTICS — written to session storage for side panel health strip
  // =========================================================================

  let probeReadyAt = null;
  let gameWsMessageCount = 0;
  let nonGameWsMessageCount = 0;
  let firstWsMessageAt = null;
  let lastWsMessageAt = null;
  let capturePortConnected = false;
  let capturePortConnectCount = 0;
  const seenWsUrls = new Set();
  const captureStartedAt = Date.now();
  let diagTimer = null;

  const DIAG_KEY = SESSION_KEYS.PIPELINE_DIAG;

  const buildDiagPayload = () => ({
    probeReady,
    probeReadyAt,
    wsMessageCount,
    gameWsMessageCount,
    nonGameWsMessageCount,
    firstWsMessageAt,
    lastWsMessageAt,
    capturePortConnected,
    capturePortConnectCount,
    tableCount: tableManager?.getTableCount() || 0,
    completedHands: tableManager?.getCompletedHandCount() || 0,
    seenWsUrls: [...seenWsUrls].slice(0, 20),
    captureStartedAt,
    pageUrl: window.location.href,
    batchedFrameCount: tableManager?.batchedFrameCount || 0,
    totalParsedMessages: tableManager?.totalParsedMessages || 0,
    pidCounts: tableManager?.pidCounts ? { ...tableManager.pidCounts } : {},
    _updatedAt: Date.now(),
  });

  const writeDiagnostics = () => {
    if (diagTimer) return; // throttle: max once per 2s
    diagTimer = setTimeout(() => {
      diagTimer = null;
      conn.send({ type: 'pipeline_diagnostics', data: buildDiagPayload() });
    }, 2000);
  };

  /** Force-write diagnostics immediately (for critical state transitions). */
  const writeDiagnosticsNow = () => {
    if (diagTimer) { clearTimeout(diagTimer); diagTimer = null; }
    conn.send({ type: 'pipeline_diagnostics', data: buildDiagPayload() });
  };

  // =========================================================================
  // PIPELINE — runs locally in content script
  // =========================================================================

  const onHandComplete = async (handRecord) => {
    // Validate before sending to SW for storage
    const validation = validateHandForRelay(handRecord);
    if (!validation.valid) {
      console.warn('[Poker Capture] Hand failed validation, not enqueued:', validation.errors);
      onPipelineError(
        new Error(`Hand validation failed: ${validation.errors.join(', ')}`),
        { handNumber: handRecord?.ignitionMeta?.handNumber }
      );
      return;
    }

    // Send hand to SW for storage (content scripts can't access chrome.storage.session)
    handRecord.capturedAt = Date.now();
    conn.send({ type: 'hand_complete', hand: handRecord });
    pushPipelineStatus();
  };

  const onPipelineError = (error, context) => {
    conn.send({
      type: 'pipeline_error',
      message: error?.message || String(error),
      context,
    });
  };

  const tableManager = new TableManager(onHandComplete, onPipelineError);

  // =========================================================================
  // LIVE CONTEXT — state-change-gated, throttled push to SW
  // =========================================================================

  let _prevLiveStateKey = null;
  let _liveContextThrottle = null;
  let _pendingLiveContext = null;

  const pushLiveContext = (hsm) => {
    if (!hsm?.getLiveHandContext) return;
    const ctx = hsm.getLiveHandContext();

    // Only push when state actually changed (key fields fingerprint)
    const stateKey = `${ctx.state}|${ctx.currentStreet}|${(ctx.activeSeatNumbers || []).length}|${(ctx.foldedSeats || []).length}|${(ctx.actionSequence || []).length}|${ctx.pot || 0}`;
    if (stateKey === _prevLiveStateKey) return; // No change — skip
    _prevLiveStateKey = stateKey;

    // Trailing-edge throttle: send immediately on first change, then
    // coalesce rapid subsequent changes into one push every 200ms
    _pendingLiveContext = ctx;
    if (!_liveContextThrottle) {
      // Immediate first push
      conn.send({ type: 'live_context', context: ctx });
      _pendingLiveContext = null;
      _liveContextThrottle = setTimeout(() => {
        _liveContextThrottle = null;
        // Flush any pending context that arrived during throttle window
        if (_pendingLiveContext) {
          conn.send({ type: 'live_context', context: _pendingLiveContext });
          _pendingLiveContext = null;
        }
      }, 200);
    }
  };

  // =========================================================================
  // PIPELINE STATUS — periodic push so SW can serve popup/side-panel queries
  // =========================================================================

  const pushPipelineStatus = () => {
    conn.send({
      type: 'pipeline_status',
      status: {
        tables: tableManager.getTableStates(),
        tableCount: tableManager.getTableCount(),
        completedHands: tableManager.getCompletedHandCount(),
      },
    });
  };

  // Push status every 30s + refresh diagnostics
  const statusInterval = setInterval(() => {
    pushPipelineStatus();
    writeDiagnostics();
  }, 30000);

  // Prune stale HSMs every 60s (5min idle threshold)
  const pruneInterval = setInterval(() => {
    const pruned = tableManager.pruneStale(300_000);
    if (pruned > 0) {
      console.log(`[Poker Capture] Pruned ${pruned} stale table(s)`);
      pushPipelineStatus();
    }
  }, 60_000);

  // =========================================================================
  // PROBE MESSAGE HANDLER — processes WS messages through the local pipeline
  // =========================================================================

  const handleProbeMessage = (data) => {
    if (data.type === 'ws_probe_health_warning') {
      onPipelineError('WebSocket probe not detected — interception may have failed', {
        probeReady: data.probeReady,
      });
      writeDiagnosticsNow();
      return;
    }

    // Pre-existing WebSocket detected by probe's PerformanceAPI scan
    if (data.type === 'ws_preexisting_detected') {
      console.warn('[Poker Capture] Pre-existing game WebSocket detected:', data.urls);
      conn.send({
        type: 'recovery_needed',
        reason: 'preexisting_ws',
        urls: data.urls || [],
        message: 'Game WebSocket was opened before the extension loaded. Reload the Ignition page to start capturing.',
      });
      writeDiagnosticsNow();
      return;
    }

    // bfcache restore — page was restored with live WS connections
    if (data.type === 'ws_bfcache_restore') {
      console.warn('[Poker Capture] Page restored from bfcache');
      conn.send({
        type: 'recovery_needed',
        reason: 'bfcache_restore',
        message: 'Page was restored from cache with existing connections. Reload to start capturing.',
      });
      writeDiagnosticsNow();
      return;
    }

    if (data.type === 'ws_lifecycle') {
      if (data.event === 'creating' || data.event === 'opened') {
        // Track all WS URLs for diagnostics (URL mismatch detection)
        if (data.url) seenWsUrls.add(data.url);
        tableManager.registerConnection(data.connId, data.url);
      }
      if (data.event === 'closed') {
        tableManager.handleConnectionClosed(data.connId);
      }
    } else if (data.type === 'ws_message' && data.direction === 'incoming' && data.preview) {
      // Track game vs non-game message counts for filter-stage diagnostics
      const msgUrl = data.url || '';
      if (isGameWsUrl(msgUrl)) {
        gameWsMessageCount++;
      } else {
        nonGameWsMessageCount++;
      }

      tableManager.routeMessage(data.connId, data.preview, data.url);

      // Push live context on state changes
      const hsm = tableManager.getHSM?.(data.connId);
      if (hsm) {
        pushLiveContext(hsm);
      }
    }

    // Throttled diagnostics write (every 50 messages or on lifecycle events)
    if (data.type === 'ws_lifecycle' || wsMessageCount % 50 === 0) {
      writeDiagnostics();
    }
  };

  // =========================================================================
  // PORT CONNECTION — to SW for storage, badge, side-panel/app-bridge relay
  // =========================================================================

  const conn = createPortConnection({
    name: 'ignition-capture',
    initialDelay: 1000,
    maxDelay: 30000,

    onConnect: () => {
      console.log('%c[Poker Capture] Port connected', 'color: #00ff00; font-weight: bold;');
      capturePortConnected = true;
      capturePortConnectCount++;
      pushPipelineStatus();
      writeDiagnosticsNow();
    },

    onMessage: (msg) => {
      // SW may forward diagnostics requests
      if (msg.type === 'request_diagnostics') {
        conn.send({
          type: 'diagnostics',
          data: tableManager.getDiagnosticData(),
        });
      }
    },

    onDisconnect: () => {
      capturePortConnected = false;
      writeDiagnostics();
    },

    onContextDead: () => {
      console.warn('[Poker Capture] Extension context invalidated — stopping all activity');
      clearInterval(statusInterval);
      clearInterval(pruneInterval);
      if (typeof silenceCheckInterval !== 'undefined') clearInterval(silenceCheckInterval);
      if (diagTimer) { clearTimeout(diagTimer); diagTimer = null; }
      clearLiveContextTimer();
    },

    onVersionMismatch: (swVersion) => {
      console.warn(
        `%c[Poker Capture] Version mismatch — content script: ${EXTENSION_VERSION}, SW: ${swVersion}. Reload the page.`,
        'color: #ff6600; font-weight: bold;'
      );
    },
  });

  // =========================================================================
  // BRIDGE: MAIN world (postMessage) → local pipeline
  // =========================================================================

  const probeMessageListener = (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.channel !== CHANNEL) return;

    const { channel, ...data } = event.data;

    if (data.type === 'ws_probe_ready') {
      if (!probeReady) {
        probeReady = true;
        probeReadyAt = Date.now();
        console.log('%c[Poker Bridge] Probe ready signal received', 'color: #00ff00;');
        writeDiagnosticsNow();
      }
      return;
    }

    wsMessageCount++;
    if (!firstWsMessageAt) firstWsMessageAt = Date.now();
    lastWsMessageAt = Date.now();
    handleProbeMessage(data);

    if (wsMessageCount <= 5) {
      console.log(
        `%c[Poker Bridge] WS ${data.type} #${wsMessageCount}`,
        'color: #00ccff; font-weight: bold;'
      );
    } else if (wsMessageCount === 6) {
      console.log(
        '%c[Poker Bridge] Bridge active — suppressing further logs',
        'color: #00ccff;'
      );
    }
  };
  window.addEventListener('message', probeMessageListener);

  // =========================================================================
  // INIT + PROBE HEALTH CHECK
  // =========================================================================

  console.log(
    '%c[Poker Capture] Pipeline initialized on ' + window.location.pathname,
    'color: #ff6600; font-weight: bold;'
  );

  // Write initial diagnostics so side panel has data immediately
  console.log('[Poker Capture] Writing initial diagnostics...');
  writeDiagnosticsNow();
  console.log('[Poker Capture] Initial diagnostics written');

  // Only run silence detection in game frames — lobby/widget iframes don't need it
  const isGameFrame = window.location.pathname.includes('/poker-game/') ||
                      window.location.pathname.includes('/static/poker-game/');

  // =========================================================================
  // CONTINUOUS SILENCE DETECTION — replaces one-shot 5s health check
  // Escalating thresholds detect probe failures and pre-existing connections
  // =========================================================================

  const SILENCE_THRESHOLDS = [
    { afterMs: 5000,   level: 'info',    message: 'Probe active but no WS messages yet' },
    { afterMs: 15000,  level: 'warning', message: 'No WS traffic after 15s — is a table open?' },
    { afterMs: 60000,  level: 'stale',   message: 'No game traffic for 60s — connection may be pre-existing' },
    { afterMs: 300000, level: 'dead',    message: 'No game traffic for 5min — page reload recommended' },
  ];

  let silenceLevel = null;

  const silenceCheckInterval = isGameFrame ? setInterval(() => {
    // Probe not ready — warn once
    if (!probeReady) {
      if (Date.now() - captureStartedAt > 5000 && silenceLevel !== 'no_probe') {
        silenceLevel = 'no_probe';
        handleProbeMessage({ type: 'ws_probe_health_warning', probeReady: false, timestamp: Date.now() });
      }
      return;
    }

    // If we have game WS messages, traffic is flowing — reset
    if (gameWsMessageCount > 0) {
      if (silenceLevel !== null) {
        silenceLevel = null;
        // Clear any recovery banner
        conn.send({ type: 'recovery_cleared' });
      }
      return;
    }

    // Determine silence duration since probe became ready
    const lastActivity = lastWsMessageAt || probeReadyAt || captureStartedAt;
    const silenceMs = Date.now() - lastActivity;

    // Find highest threshold crossed
    let newLevel = null;
    let newMessage = null;
    for (const t of SILENCE_THRESHOLDS) {
      if (silenceMs >= t.afterMs) {
        newLevel = t.level;
        newMessage = t.message;
      }
    }

    // Only send if level escalated
    if (newLevel && newLevel !== silenceLevel) {
      silenceLevel = newLevel;
      conn.send({
        type: 'silence_alert',
        level: newLevel,
        silenceMs,
        message: newMessage,
        gameWsMessageCount,
        wsMessageCount,
      });

      // At stale/dead: trigger recovery banner
      if (newLevel === 'stale' || newLevel === 'dead') {
        conn.send({
          type: 'recovery_needed',
          reason: 'silence_timeout',
          message: newMessage,
        });
      }

      writeDiagnosticsNow();
    }
  }, 5000) : null;

  // Register cleanup for version-upgrade re-initialization
  window.__POKER_CAPTURE_CLEANUP = () => {
    window.removeEventListener('message', probeMessageListener);
    clearInterval(statusInterval);
    clearInterval(pruneInterval);
    if (silenceCheckInterval) clearInterval(silenceCheckInterval);
    clearLiveContextTimer();
    conn.destroy();
  };
})();
