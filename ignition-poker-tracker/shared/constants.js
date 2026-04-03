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
  GET_CAPTURED_HANDS: 'get_captured_hands',
  CLEAR_CAPTURED_HANDS: 'clear_captured_hands',
  PING: 'ping',
  GET_DIAGNOSTIC_LOG: 'get_diagnostic_log',
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
};

// Session storage keys — used for SW-independent hand delivery and state
export const SESSION_KEYS = {
  HAND_QUEUE: 'hand_delivery_queue',
  HAND_QUEUE_SEQ: 'hand_queue_seq',
  LIVE_CONTEXT: 'live_hand_context',
  CONNECTION_STATE: 'bridge_connection_state',
  SIDE_PANEL_HANDS: 'side_panel_hands',
  PIPELINE_DIAG: 'pipeline_diagnostics',
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

