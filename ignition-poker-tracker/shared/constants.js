/**
 * shared/constants.js - Shared constants for the Ignition capture extension
 *
 * Message types, action mappings, and configuration shared between
 * content scripts, background service worker, and side panel.
 */

// Extension-internal message types (chrome.runtime.onMessage handlers in SW)
export const MSG = {
  // Popup / side-panel → SW queries
  GET_EXPLOITS: 'get_exploits',
  GET_LIVE_CONTEXT: 'get_live_context',
  GET_ACTION_ADVICE: 'get_action_advice',
  GET_PIPELINE_STATUS: 'get_pipeline_status',
  // LEGACY, and both are no-ops. They addressed a staging buffer that no longer exists;
  // GET_CAPTURED_HANDS returning an empty array is what made the popup's Export button
  // silently produce empty files. Use GET_JOURNAL_HANDS instead.
  GET_CAPTURED_HANDS: 'get_captured_hands',
  CLEAR_CAPTURED_HANDS: 'clear_captured_hands',
  // The durable journal — where completed hands actually live.
  GET_JOURNAL_HANDS: 'get_journal_hands',
  PING: 'ping',
  GET_DIAGNOSTIC_LOG: 'get_diagnostic_log',
  // App-bridge → SW (storage relay, replaces direct chrome.storage.session access)
  GET_QUEUED_HANDS: 'get_queued_hands_bridge',
  DEQUEUE_HANDS: 'dequeue_hands_bridge',
  WRITE_CONNECTION_STATE: 'write_connection_state_bridge',
};

// ---------------------------------------------------------------------------
// PORT MESSAGE PROTOCOL (chrome.runtime.Port, validated by message-schemas.js)
//
// Port "ignition-capture" → SW:
//   hand_saved, live_context, pipeline_status, pipeline_error, diagnostics
//
// Port "app-bridge" → SW:
//   sync_exploits, sync_action_advice, sync_tournament
//
// SW → Port "app-bridge":
//   status, __version_check
//
// SW → Port "side-panel":
//   push_pipeline_status, push_hands_updated, push_exploits,
//   push_action_advice, push_live_context, push_tournament, __version_check
//
// Hand delivery: chrome.storage.session (SESSION_KEYS.HAND_QUEUE), not ports.
// Hand ACK: window.postMessage (BRIDGE_MSG.ACK) from app → app-bridge.
// ---------------------------------------------------------------------------

// Storage keys used in chrome.storage.local (legacy — being migrated away)
export const STORAGE_KEYS = {
  CAPTURED_HANDS: 'ignition_captured_hands',
  // SR-7 cutover: the `SETTINGS_SIDEBAR_REBUILD` flag was deleted — the
  // rebuild is now the one and only sidebar. `DEBUG_DIAGNOSTICS` gates 0.7
  // diagnostics link (SR-6.10) and 4.3 model audit panel (SR-6.14).
  SETTINGS_DEBUG_DIAGNOSTICS: 'settings.debugDiagnostics',
  // Point the "launch app" path at the local dev server instead of prod.
  // Default false. Before WS-358 the target was inferred from manifest
  // `update_url`, which is absent on every unpacked install — so the link
  // always resolved to localhost:5173 and never worked for the founder.
  SETTINGS_USE_DEV_APP: 'settings.useDevApp',
  // Durable hand journal (chrome.storage.local — survives browser close).
  // The session queue is the delivery hot path; this is the crash/close
  // safety net that lets un-ACKed hands be replayed on next startup.
  HAND_JOURNAL: 'ignition_hand_journal',
  // Monotonic count of journal entries evicted by the cap without ever being
  // ACKed by the app — i.e. actual, permanent hand loss. Surfaced, not silent.
  HAND_JOURNAL_DROPPED: 'ignition_hand_journal_dropped',
  // Wall-clock ms of the last successful contact with the local session sink.
  // The journal keeps a hand for the sink only while the sink is DEMONSTRABLY in
  // use; without this, a founder who never runs the sink would accumulate 5000
  // undeliverable hands against a 10MB quota. See SINK_STALE_MS in storage-writer.
  SINK_LAST_SEEN_AT: 'ignition_sink_last_seen_at',
};

/**
 * Local session sink (scripts/sessionSink/serve.mjs) — the path that puts a played hand on
 * disk where the review runner can read it.
 *
 * Loopback only, and 8791 deliberately: 5173 is this repo's Vite dev server (already in
 * host_permissions), 8384 is Syncthing's UI, 8001 is the police-accountability tailnet service.
 *
 * NOTHING in the capture path may depend on this being up. It is a convenience on top of a
 * journal that is already durable — if the sink never runs, the founder loses a review, never
 * a hand.
 */
export const SESSION_SINK = Object.freeze({
  ORIGIN: 'http://127.0.0.1:8791',
  HAND: 'http://127.0.0.1:8791/hand',
  HANDS: 'http://127.0.0.1:8791/hands',
  HEALTH: 'http://127.0.0.1:8791/health',
  TIMEOUT_MS: 2000,
});

// Default values for settings keys. Single source of truth — options page
// and side-panel boot both read through this map.
export const SETTINGS_DEFAULTS = Object.freeze({
  [/* keep in sync with STORAGE_KEYS.SETTINGS_DEBUG_DIAGNOSTICS */ 'settings.debugDiagnostics']: false,
  [/* keep in sync with STORAGE_KEYS.SETTINGS_USE_DEV_APP */ 'settings.useDevApp']: false,
});

// Where the React app lives. Single source of truth — side panel and SW
// auto-open both resolve through APP_URLS + the SETTINGS_USE_DEV_APP flag.
export const APP_URLS = Object.freeze({
  PROD: 'https://poker-tracker-68b97.web.app',
  DEV: 'http://localhost:5173',
});

// Session storage keys — used for SW-independent hand delivery and state
export const SESSION_KEYS = {
  HAND_QUEUE: 'hand_delivery_queue',
  HAND_QUEUE_SEQ: 'hand_queue_seq',
  LIVE_CONTEXT: 'live_hand_context',
  CONNECTION_STATE: 'bridge_connection_state',
  SIDE_PANEL_HANDS: 'side_panel_hands',
  PIPELINE_DIAG: 'pipeline_diagnostics',
  // Set by SW onInstalled('update'); consumed + cleared by side-panel boot so
  // it can surface a one-shot "reload the Ignition tab" banner. Expected after
  // every extension reload because old content scripts can't rejoin the new SW.
  EXTENSION_JUST_UPDATED: 'extension_just_updated',
  // How many Ignition tabs the SW reloaded for itself on install/update.
  // Lets the side panel report "already fixed" instead of asking the founder
  // to click a repair button mid-hand.
  EXTENSION_TABS_AUTO_RELOADED: 'extension_tabs_auto_reloaded',
};

// Extension version — extracted here so all contexts can import without
// pulling in port-connect.js (which calls chrome.runtime.getManifest).
export const EXTENSION_VERSION = (() => {
  try { return chrome.runtime.getManifest?.()?.version || 'unknown'; } catch (_) { return 'unknown'; }
})();

// Build-time hash — injected by build.mjs via esbuild define, changes on every rebuild.
// Falls back to EXTENSION_VERSION in unbundled/test contexts.
export const BUILD_GUARD = typeof __BUILD_HASH__ !== 'undefined' ? __BUILD_HASH__ : EXTENSION_VERSION;

// Protocol version for extension ↔ app bridge messages (window.postMessage).
// Bump when the message schema changes so mismatches are detected, not silent.
export const PROTOCOL_VERSION = 2;

// Street rank ordering — used by advice-staleness guard and state invariants.
// Canonical single source of truth; do not duplicate elsewhere.
export const STREET_RANK = Object.freeze({ preflop: 0, flop: 1, turn: 2, river: 3 });

// Bridge message types — the ONLY message types used across the
// window.postMessage boundary between extension and main app.
// App-side mirror: src/utils/bridgeProtocol.js (must stay in sync).
export const BRIDGE_MSG = {
  // Extension → App
  HANDS:         'POKER_SYNC_HANDS',
  HAND_STATE:    'POKER_SYNC_HAND_STATE',
  STATUS:        'POKER_SYNC_STATUS',
  // App → Extension
  ACK:           'POKER_SYNC_ACK',
  EXPLOITS:      'POKER_SYNC_EXPLOITS',
  ACTION_ADVICE: 'POKER_SYNC_ACTION_ADVICE',
  TOURNAMENT:    'POKER_SYNC_TOURNAMENT',
  ERROR_REPORT:  'POKER_SYNC_ERROR',
};

