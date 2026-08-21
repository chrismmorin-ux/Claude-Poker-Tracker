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

import { MSG, STORAGE_KEYS, SESSION_KEYS, SESSION_KEYS as STORAGE_KEYS_SESSION, PROTOCOL_VERSION, EXTENSION_VERSION, APP_URLS, SESSION_SINK } from '../shared/constants.js';
import * as errors from '../shared/error-reporter.js';
import { enqueueHand, appendSidePanelHand, writeLiveContext, getQueueLength, writeConnectionState, getQueuedHands, dequeueHands, restoreJournalToQueue, journalAckSink, journalPendingForSink, getJournalStatus, getJournalHands } from '../shared/storage-writer.js';
import { validateMessage } from '../shared/message-schemas.js';
import { validateHandForRelay } from '../shared/wire-schemas.js';
import { deepFreeze } from '../shared/freeze-utils.js';

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
/**
 * EVERY port kind is a Set. There is no single-current-port anywhere.
 *
 * `capturePorts` was always a Set; the other two were single slots, and both the
 * slot model and its unguarded teardown were wrong (2026-08-21):
 *
 *   - MULTIPLE APP BRIDGES ARE NORMAL. The worker opens an app tab itself
 *     (`ensureAppTabOpen`), so any tab the founder opens by hand is a second one.
 *     `saveOnlineHand` in the app already made its dedup atomic for exactly this
 *     reason — the storage layer modelled two live bridges while this file
 *     modelled one, and the disagreement is what produced the bugs.
 *   - MULTIPLE PANELS ARE NORMAL. Chrome allows one side panel per window.
 *   - A single slot silently DEMOTED the older client: the newest connection took
 *     the slot and every earlier tab or panel stopped receiving pushes while still
 *     appearing connected from its own side. Nothing recovers from that on its own
 *     — `port-connect.js` reconnects on disconnect, and no disconnect ever
 *     happens to a port that was merely displaced.
 *
 * A Set removes the failure class rather than guarding it: there is no "current"
 * port to lose, membership is by identity, and teardown is `delete(port)` — which
 * cannot clobber a different live client no matter what order Chrome fires events
 * in. That ordering (old port's `onDisconnect` arriving AFTER its replacement's
 * `onConnect`, on every reload) is what broke the guarded single-slot version.
 */
const capturePorts = new Set();

/**
 * Pipeline status PER CAPTURE PORT — one port per frame, and the content script
 * is injected into all frames.
 *
 * Keyed by the port object itself so a frame's contribution dies with its port;
 * there is no frame id available here that survives a reload.
 */
const perPortPipelineStatus = new Map();

/**
 * Union every frame's view into one.
 *
 * `tables` is keyed by connId, which is minted per socket and therefore unique
 * across frames, so a plain merge cannot collide. `completedHands` sums because
 * each frame's TableManager counts only its own. The result is "what this tab
 * can see", which is the question the side panel is actually asking — no single
 * frame can answer it.
 */
function mergePipelineStatus() {
  const tables = {};
  let completedHands = 0;
  for (const status of perPortPipelineStatus.values()) {
    if (!status) continue;
    Object.assign(tables, status.tables || {});
    completedHands += status.completedHands || 0;
  }
  return { tables, tableCount: Object.keys(tables).length, completedHands };
}
const appBridgePorts = new Set();
const sidePanelPorts = new Set();
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

/**
 * Post to one port, dropping it from its Set if the channel is already gone.
 *
 * A throw here means the far end died without its `onDisconnect` reaching us, so
 * the eviction is by identity and touches no other client. Deleting the current
 * element during Set iteration is well-defined in JS, so callers can loop safely.
 */
const postTo = (port, msg, ports, label) => {
  try {
    port.postMessage(msg);
  } catch (e) {
    console.warn(`[SW] ${label} push failed:`, e.message);
    ports.delete(port);
  }
};

const pushToSidePanel = (msg) => {
  for (const port of sidePanelPorts) postTo(port, msg, sidePanelPorts, 'Side panel');
};

const pushToAppBridge = (msg) => {
  for (const port of appBridgePorts) postTo(port, msg, appBridgePorts, 'App bridge');
};

/** True when at least one app tab is bridged — the `appConnected` wire field. */
const isAppConnected = () => appBridgePorts.size > 0;

/**
 * Full state replay. Targets ONE panel when given a port — a panel that just
 * connected or just asked to be resynced needs the backlog, and the panels that
 * are already up to date should not be made to re-render for it.
 */
const pushFullStateToSidePanel = async (target = null) => {
  if (!target && sidePanelPorts.size === 0) return;
  const send = target
    ? (msg) => postTo(target, msg, sidePanelPorts, 'Side panel')
    : pushToSidePanel;
  try {
    const queueLength = await getQueueLength();
    send({
      type: 'push_pipeline_status',
      tables: lastPipelineStatus.tables,
      tableCount: lastPipelineStatus.tableCount,
      completedHands: lastPipelineStatus.completedHands,
      storedHands: totalHandsSaved,
      queueLength,
      appConnected: isAppConnected(),
      liveContext: null,
      errorCount: errors.getCount(),
      diagnosticData: cachedDiagnostics,
    });
    if (cachedExploits) {
      send({ type: 'push_exploits', seats: cachedExploits.seats, appConnected: isAppConnected() });
    }
    // RT-68: Before replaying cached advice, check for fresh live context in
    // session storage. On SW reanimation the previous hand's advice may
    // otherwise be promoted via _pendingAdvice into a new hand whose street
    // happens to match. Reuse the 30s staleness guard from GET_LIVE_CONTEXT.
    let freshContext = null;
    try {
      const stored = await chrome.storage.session?.get('live_hand_context');
      const ctx = stored?.live_hand_context;
      if (ctx && ctx._persistedAt && (Date.now() - ctx._persistedAt) <= 30000) {
        freshContext = ctx;
      }
    } catch (_) { /* missing storage is non-fatal */ }
    if (freshContext) {
      send({ type: 'push_live_context', context: freshContext });
      if (cachedActionAdvice) {
        send({ type: 'push_action_advice', ...cachedActionAdvice });
      }
    }
    // If no fresh live context, drop the cached advice replay — the capture
    // pipeline will push fresh advice once a real context push resumes.
    // Holding stale advice at the SW layer duplicates the side-panel's
    // _pendingAdvice buffer and is the root of the S2/S3 cross-hand display.
    if (cachedTournament) {
      send({ type: 'push_tournament', ...cachedTournament });
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
// LOCAL SESSION SINK (scripts/sessionSink/serve.mjs)
// ===========================================================================
//
// Puts each completed hand on disk on this machine, where the review runner can
// read it. Without this the hands live only in browser storage and no node-side
// instrument can ever see them — which is the entire reason a session could not
// be reviewed automatically.
//
// THE CONTRACT, AND IT IS ONE-WAY: nothing here may block, slow, or fail the
// capture path. Every call is fire-and-forget with a short timeout, every error
// is swallowed to a counter, and a sink that is missing is indistinguishable to
// the founder from one that is present. A hand the sink never receives stays
// flagged in the journal and goes out on the next backfill.

let sinkState = { reachable: false, lastOkAt: 0, lastErrorAt: 0, sent: 0, failed: 0, backfilled: 0 };

/** POST with a hard timeout — an unreachable port must fail fast, not hang the worker. */
const sinkFetch = async (url, body) => {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), SESSION_SINK.TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`sink responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
};

const deliverHandToSink = async (hand) => {
  try {
    const out = await sinkFetch(SESSION_SINK.HAND, { hand });
    if (out?.ok && out.captureId) {
      // ACK releases the journal's hold for the SINK only. The app's hold is separate,
      // and the entry survives until both are satisfied.
      await journalAckSink([out.captureId]);
      sinkState = { ...sinkState, reachable: true, lastOkAt: Date.now(), sent: sinkState.sent + 1 };
    } else {
      sinkState = { ...sinkState, failed: sinkState.failed + 1, lastErrorAt: Date.now() };
    }
  } catch (_) {
    // Expected and unremarkable whenever the sink is not running. Not reported as an error:
    // an optional local service being absent is not a fault, and reporting it would train the
    // founder to ignore the error channel.
    sinkState = { ...sinkState, reachable: false, failed: sinkState.failed + 1, lastErrorAt: Date.now() };
  }
};

/**
 * Push everything the sink has not confirmed. Runs on startup and on a slow alarm, so a
 * session played while the sink was down lands the moment it comes back.
 */
const backfillSink = async () => {
  try {
    const pending = await journalPendingForSink(250);
    if (pending.length === 0) return { sent: 0 };
    const out = await sinkFetch(SESSION_SINK.HANDS, { hands: pending });
    if (out?.ok && Array.isArray(out.ackCaptureIds) && out.ackCaptureIds.length) {
      await journalAckSink(out.ackCaptureIds);
      sinkState = {
        ...sinkState,
        reachable: true,
        lastOkAt: Date.now(),
        backfilled: sinkState.backfilled + out.ackCaptureIds.length,
      };
      console.log(`[SW] sink backfill: ${out.ackCaptureIds.length}/${pending.length} hands`);
      return { sent: out.ackCaptureIds.length };
    }
    return { sent: 0 };
  } catch (_) {
    sinkState = { ...sinkState, reachable: false };
    return { sent: 0 };
  }
};

// ===========================================================================
// PORT MANAGEMENT
// ===========================================================================

chrome.runtime.onConnect.addListener((port) => {
  // RT-21: Reject connections from other extensions
  if (port.sender?.id !== chrome.runtime.id) {
    port.disconnect();
    return;
  }

  // --- CAPTURE PORT (content script → SW) ---
  if (port.name === 'ignition-capture') {
    capturePorts.add(port);
    try { port.postMessage({ type: '__version_check', version: SW_VERSION }); } catch (e) { console.warn('[SW] Version check failed:', e.message); }

    port.onMessage.addListener((msg) => {
      const vErr = validateMessage(msg.type, msg);
      if (vErr) {
        errors.report('validation', `Blocked ${msg.type}: ${vErr}`, { port: 'ignition-capture' });
        return; // Drop invalid messages before handler dispatch
      }
      switch (msg.type) {
        case 'hand_complete': {
          // Content scripts can't access chrome.storage.session — SW handles storage
          const hand = msg.hand;
          if (!hand) break;
          (async () => {
            try {
              const result = await enqueueHand(hand);
              if (result.success) {
                await appendSidePanelHand(hand);
                totalHandsSaved++;
                updateBadge(totalHandsSaved);
                chrome.storage.session.set({ total_hands_saved: totalHandsSaved }).catch(() => {});
                pushToSidePanel({ type: 'push_hands_updated', totalHands: totalHandsSaved });
                pushToAppBridge({ type: 'push_hand', hand });
                // Deliberately NOT awaited: the local session sink is a convenience on top of a
                // journal that is already durable, and the live path must never wait on it or
                // fail because of it. A hand the sink misses stays in the journal and backfills.
                deliverHandToSink(hand);
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
            // WS-103: freeze the validated payload before any consumer
            // sees it. Pairs with the validateMessage gate (WS-105):
            // validate → freeze → forward. Prevents post-validation
            // mutation as the same reference fans out to storage,
            // app-bridge, the throttle queue, and side-panel.
            deepFreeze(msg.context);
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
            // The content script is injected with `all_frames: true`, so EVERY
            // frame on the Ignition page runs its own pipeline host with its own
            // TableManager — and every non-game frame (lobby, chrome, ads) holds
            // zero tables and pushes `tables: {}` on the 30s interval.
            //
            // This used to be `lastPipelineStatus = msg.status` — a single
            // global, last-writer-wins. So the game frame published the real
            // table, a lobby frame published emptiness seconds later, and the
            // side panel saw tableCount 0, ran out its 5s grace, and rendered
            // "No active table detected" over a live hand. The next game-frame
            // push restored it, the next lobby push killed it again. That is the
            // flapping the founder reported: seatmap -> no-table -> "Analyzing…"
            // (advice having been wiped by the table-switch clear) -> repeat.
            //
            // The SW is the only place that sees all frames, so it is the place
            // that has to AGGREGATE rather than overwrite. A frame with no
            // tables now contributes nothing instead of erasing everyone else.
            perPortPipelineStatus.set(port, msg.status);
            lastPipelineStatus = mergePipelineStatus();
            chrome.storage.session.set({ pipeline_status_cache: lastPipelineStatus }).catch(() => {});
            msg = { ...msg, status: lastPipelineStatus };
            // A table is live and nothing is draining the hand queue. Open the
            // app ourselves (background tab, no focus steal) — buffered hands
            // are on a 500-deep cap and the founder should never have to think
            // about that while in a hand.
            if (msg.status.tableCount > 0 && !isAppConnected()) ensureAppTabOpen();
            // Forward to side panel so it tracks active tables in real time
            pushToSidePanel({
              type: 'push_pipeline_status',
              tables: msg.status.tables,
              tableCount: msg.status.tableCount,
              completedHands: msg.status.completedHands,
              storedHands: totalHandsSaved,
              appConnected: isAppConnected(),
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
            // WS-516: "capture never started" and "capture stopped mid-session"
            // are different problems with different actions. This relay rebuilds
            // the message field-by-field, so a field omitted here is dropped
            // silently — which is how the panel ends up unable to tell them apart.
            captureEverStarted: !!msg.captureEverStarted,
          });
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      capturePorts.delete(port);
      // Drop this frame's contribution, or a closed tab would pin its table in
      // the merged view forever — the mirror of the clobber this map fixes.
      // Then republish so the panel learns immediately rather than waiting out
      // the 30s interval of whichever frame happens to push next.
      if (perPortPipelineStatus.delete(port)) {
        lastPipelineStatus = mergePipelineStatus();
        chrome.storage.session.set({ pipeline_status_cache: lastPipelineStatus }).catch(() => {});
        pushToSidePanel({
          type: 'push_pipeline_status',
          tables: lastPipelineStatus.tables,
          tableCount: lastPipelineStatus.tableCount,
          completedHands: lastPipelineStatus.completedHands,
          storedHands: totalHandsSaved,
          appConnected: isAppConnected(),
        });
      }
      pushToAppBridge({ type: 'push_connection_state', state: { captureAlive: capturePorts.size > 0 } });
    });
    // Notify app-bridge that a capture port connected
    pushToAppBridge({ type: 'push_connection_state', state: { captureAlive: true } });
    return;
  }

  // --- SIDE PANEL PORT ---
  if (port.name === 'side-panel') {
    sidePanelPorts.add(port);
    try { port.postMessage({ type: '__version_check', version: SW_VERSION }); } catch (e) { console.warn('[SW] Version check failed:', e.message); }
    // Backlog goes to the panel that just connected, not to every open panel.
    pushFullStateToSidePanel(port);
    port.onMessage.addListener((msg) => {
      const vErr = validateMessage(msg.type, msg);
      if (vErr) {
        errors.report('validation', `Blocked ${msg.type}: ${vErr}`, { port: 'side-panel' });
        return; // Drop invalid messages before handler dispatch
      }
      if (msg.type === 'request_full_state') {
        /**
         * Re-admit the sending port before replying. The Set makes losing a live
         * panel far harder than the old single slot did, but this stays as the
         * refresh button's repair path — ⟳ must be able to recover the panel from
         * ANY state where it stopped receiving pushes, not only the ones we
         * predicted.
         *
         * That mattered because nothing else recovers on its own: a panel whose
         * pushes stop is not disconnected, so `port-connect.js` — which is
         * disconnect-driven, not silence-driven — schedules no reconnect, there is
         * no client watchdog, and `push_silence_alert`, the one signal meant to
         * surface a dead pipeline, travels the dead channel itself. Before this,
         * ⟳ called `pushFullStateToSidePanel`, which early-returned on the same
         * null that had broken everything else. The button was decorative in the
         * one state that most needed it.
         *
         * A message arriving on this port proves the port is alive, which makes it
         * the one trustworthy moment to re-admit it.
         */
        sidePanelPorts.add(port);
        pushFullStateToSidePanel(port);
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
    /**
     * Removes only ITSELF. Every other panel keeps receiving pushes.
     *
     * The single-slot version did `sidePanelPort = null` unconditionally, and
     * Chrome fires the old port's `onDisconnect` AFTER its replacement's
     * `onConnect` on a reload — so panel A reloading nulled panel B. B then sat
     * connected from its own side while `pushToSidePanel` returned early forever:
     * advice stopped arriving, the context aged into staleness, and the
     * connection indicator went wrong — while capture kept saving hands normally,
     * because capture was already a Set and was never affected. That asymmetry is
     * what makes the failure present as "the sidebar is broken but hands are
     * fine" rather than as a connection fault.
     *
     * Reloads are not an edge case: every `npm run build` + extension reload
     * forces one, and so does opening the panel in a second window.
     */
    port.onDisconnect.addListener(() => {
      sidePanelPorts.delete(port);
    });
    return;
  }

  // --- APP BRIDGE PORT ---
  if (port.name !== 'app-bridge') return;

  appBridgePorts.add(port);
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

  /**
   * Removes only ITSELF, exactly as the side-panel Set above does.
   *
   * Two live app bridges is the NORMAL case, not a corner: the SW opens an app
   * tab itself (`ensureAppTabOpen`), so any tab the founder opens by hand is a
   * second one — `saveOnlineHand` in the app already documents this and made its
   * dedup atomic because of it. The storage layer modelled two bridges while this
   * file modelled one.
   *
   * Under the old single slot the newest tab took the pushes and the older tab
   * went silent while still appearing connected; then the older tab's disconnect
   * nulled the newer tab's slot, and `appConnected` read false with a working app
   * sitting right there on screen. Both halves of that are gone with a Set: every
   * bridged tab receives every push, and one closing cannot silence another.
   *
   * Observed 2026-08-21: a diagnostic tab opened against prod took the slot from
   * an existing tab, and closing it cleared the slot outright.
   */
  port.onDisconnect.addListener(() => {
    appBridgePorts.delete(port);
  });
});

// ===========================================================================
// MESSAGE HANDLER (popup / side-panel queries)
// ===========================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // RT-21: Reject messages from other extensions
  if (sender.id !== chrome.runtime.id) return false;

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
            appConnected: isAppConnected(),
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
        ? { ...cachedExploits, appConnected: isAppConnected() }
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
      // Legacy: return empty — hands now flow through session storage queue.
      // Kept only so an old client does not throw; every caller in this repo now uses
      // GET_JOURNAL_HANDS, because an empty array here reads as "no hands were captured"
      // when the truth is "this message is obsolete".
      sendResponse({ hands: [], legacy: true, use: MSG.GET_JOURNAL_HANDS });
      return false;
    }

    case MSG.GET_JOURNAL_HANDS: {
      (async () => {
        try {
          const [hands, status] = await Promise.all([getJournalHands(), getJournalStatus()]);
          sendResponse({ hands, ...status });
        } catch (e) {
          errors.report('storage', e, { op: 'get_journal_hands' });
          sendResponse({ hands: [], pending: 0, pendingSink: 0, dropped: 0, error: e.message });
        }
      })();
      return true; // async response
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
// SEAMLESS STARTUP (WS-358)
// ===========================================================================
//
// Everything here exists to remove manual steps from table time. The founder
// plays real money; any action the extension can take for itself must not be
// delegated to a human mid-hand. Diagnostics are for the developer, not for
// the player, and must never sit on the critical path.

const IGNITION_TAB_PATTERNS = [
  'https://*.ignitioncasino.eu/*',
  'https://*.ignitioncasino.net/*',
];

/** Resolve the app origin, honouring the explicit dev-server opt-in. */
const resolveAppBase = async () => {
  try {
    const r = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS_USE_DEV_APP);
    return r?.[STORAGE_KEYS.SETTINGS_USE_DEV_APP] === true ? APP_URLS.DEV : APP_URLS.PROD;
  } catch (_) {
    return APP_URLS.PROD;
  }
};

// One auto-open per SW lifetime per app base. Without this guard a flapping
// bridge port would spawn a tab on every pipeline_status tick.
let _appTabOpenAttempted = false;

/**
 * Ensure the React app is open in some tab, opening it in the background if
 * not. The app is what drains the hand queue — without it, capture buffers
 * and eventually evicts. It is therefore infrastructure, not an optional
 * companion, and the extension should not ask a human to launch it mid-hand.
 */
const ensureAppTabOpen = async () => {
  if (_appTabOpenAttempted) return;
  _appTabOpenAttempted = true;
  try {
    const base = await resolveAppBase();
    const existing = await chrome.tabs.query({ url: `${base}/*` });
    if (existing.length > 0) return;
    // active:false — never steal focus from the table. The app works fine
    // in a background tab; the bridge content script runs regardless.
    await chrome.tabs.create({ url: `${base}#online`, active: false });
    console.log('[SW] Auto-opened app tab (background):', base);
  } catch (e) {
    // Non-fatal: the side panel still offers a manual launch link.
    _appTabOpenAttempted = false;
    errors.report('startup', e, { op: 'ensureAppTabOpen' });
  }
};

/**
 * Reload any open Ignition tab after an extension install/update.
 *
 * Content scripts attached before the reload are orphaned — their ports are
 * dead and capture is silently stopped until the tab reloads. Previously this
 * surfaced as a banner asking the founder to click "Reload Ignition Page",
 * i.e. the extension detected its own broken state and delegated the repair
 * to a human who might be in a hand. It can just fix itself.
 */
const reloadOrphanedIgnitionTabs = async () => {
  try {
    const tabs = await chrome.tabs.query({ url: IGNITION_TAB_PATTERNS });
    for (const tab of tabs) {
      try {
        await chrome.tabs.reload(tab.id, { bypassCache: false });
      } catch (e) {
        errors.report('startup', e, { op: 'reloadIgnitionTab', tabId: tab.id });
      }
    }
    if (tabs.length > 0) console.log(`[SW] Reloaded ${tabs.length} orphaned Ignition tab(s)`);
    return tabs.length;
  } catch (e) {
    errors.report('startup', e, { op: 'reloadOrphanedIgnitionTabs' });
    return 0;
  }
};

/** One click on the toolbar icon opens the HUD — no popup, no right-click hunt. */
const wireSidePanelBehavior = () => {
  try {
    chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true })
      .catch(e => errors.report('startup', e, { op: 'setPanelBehavior' }));
  } catch (e) {
    errors.report('startup', e, { op: 'setPanelBehavior' });
  }
};

/** Replay any un-ACKed hands the journal is holding from a previous browser session. */
const replayJournal = async () => {
  try {
    const { restored, dropped } = await restoreJournalToQueue();
    if (restored > 0) {
      console.log(`[SW] Restored ${restored} un-synced hand(s) from durable journal`);
      // Queue is non-empty and un-synced — the app needs to be open to drain it.
      ensureAppTabOpen();
    }
    if (dropped > 0) {
      errors.report('storage', new Error(`${dropped} hand(s) permanently lost to journal cap`), {
        op: 'replayJournal', dropped,
      });
    }
  } catch (e) {
    errors.report('startup', e, { op: 'replayJournal' });
  }
};

wireSidePanelBehavior();
replayJournal();
backfillSink();

chrome.runtime.onStartup.addListener(() => {
  wireSidePanelBehavior();
  replayJournal();
  backfillSink();
});

// A slow heartbeat so a sink that comes up mid-session catches everything it missed without
// waiting for a browser restart. `chrome.alarms` rather than setInterval: MV3 suspends the
// service worker aggressively, and a timer does not survive that. 5 minutes is well inside the
// journal's 3-day sink-retention window and costs nothing when the sink is absent.
try {
  chrome.alarms?.create('sink-backfill', { periodInMinutes: 5 });
  chrome.alarms?.onAlarm.addListener((alarm) => {
    if (alarm.name === 'sink-backfill') backfillSink();
  });
} catch (e) {
  errors.report('startup', e, { op: 'sink_backfill_alarm' });
}

// ===========================================================================
// LIFECYCLE
// ===========================================================================

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[SW] Poker Session Notes installed:', details.reason);

  wireSidePanelBehavior();

  if (details.reason === 'update' || details.reason === 'install') {
    // Self-repair the orphaned-content-script state rather than asking the
    // founder to. The side panel still consumes EXTENSION_JUST_UPDATED, but
    // only to explain what happened — the reload has already been done.
    const reloaded = await reloadOrphanedIgnitionTabs();
    try {
      await chrome.storage.session?.set({
        [SESSION_KEYS.EXTENSION_JUST_UPDATED]: Date.now(),
        [SESSION_KEYS.EXTENSION_TABS_AUTO_RELOADED]: reloaded,
      });
    } catch (e) {
      errors.report('storage', e, { op: 'set_extension_just_updated' });
    }
  }

  if (details.reason === 'update') {
    // Migrate any hands from legacy chrome.storage.local to session queue
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.CAPTURED_HANDS);
      const legacyHands = result[STORAGE_KEYS.CAPTURED_HANDS] || [];
      if (legacyHands.length > 0) {
        // Import legacy hands into the new session queue.
        // WS-109: legacy hands were captured under an older schema and MUST pass
        // validateHandForRelay before entering the queue — the same gate the live
        // capture path enforces (content/ignition-capture.js onHandComplete).
        // enqueueHand assumes a pre-validated record; bypassing the gate here let
        // malformed legacy hands relay to the app unvalidated. Drop + report
        // invalid ones rather than enqueue them.
        const { enqueueHand } = await import('../shared/storage-writer.js');
        let migrated = 0;
        let skipped = 0;
        for (const hand of legacyHands) {
          const validation = validateHandForRelay(hand);
          if (!validation.valid) {
            skipped++;
            console.warn('[SW] Legacy hand failed validation, not migrated:', validation.errors);
            errors.report(
              'validation',
              `Legacy migration: hand failed validateHandForRelay: ${validation.errors.join(', ')}`,
              { op: 'update_migration', handNumber: hand?.ignitionMeta?.handNumber }
            );
            continue;
          }
          await enqueueHand(hand);
          migrated++;
        }
        console.log(
          `[SW] Migrated ${migrated} legacy hand(s) to session queue` +
          (skipped > 0 ? `; skipped ${skipped} invalid` : '')
        );
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
