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
  // Monotonic count of journal writes that failed because storage was FULL.
  // Distinct from HAND_JOURNAL_DROPPED, which counts cap eviction: the cap is
  // a policy we chose, the quota is a wall we hit. Before WS-515 the quota
  // throw was caught and reported to `errors` only, so the failure that
  // actually happens was the one the loss counter could not see.
  HAND_JOURNAL_QUOTA_FAILURES: 'ignition_hand_journal_quota_failures',
  // Durable record of intervals during which capture was DEAD (chrome.storage.local).
  //
  // A capture that dies mid-session does not leave a visible gap — it leaves a
  // session that looks complete and shorter. Hands played after the death are
  // absent with no marker, so every downstream k/n over that session is silently
  // conditioned on "the part of the session where capture happened to be alive",
  // which is not a population anyone chose. A banner the founder dismissed leaves
  // no trace; this does.
  CAPTURE_GAPS: 'ignition_capture_gaps',
};

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

/**
 * Provenance of the loaded artifact — which branch, which commit, which
 * checkout, built when. Injected by build.mjs (see the BUILD STAMP block there
 * for why this exists).
 *
 * The fallback is deliberately conspicuous rather than plausible: an unbundled
 * or test context must NOT be able to masquerade as a real build. `sourceDir`
 * is the field that matters in practice — it distinguishes the main checkout
 * from a worktree, which is the confusion this exists to end.
 */
export const BUILD_STAMP = typeof __BUILD_STAMP__ !== 'undefined'
  ? __BUILD_STAMP__
  : { version: EXTENSION_VERSION, branch: 'UNBUILT', commit: 'UNBUILT', builtAt: null, sourceDir: 'UNBUILT' };

/**
 * One-line build identity for display. Short enough for a panel footer, and
 * carries the four things needed to tell two builds apart:
 *   0.9.0 · sidebar-table-identity@76956d5 · 12:21
 * `sourceDir` is prefixed when it differs from the branch, since a worktree
 * folder name and its branch name are usually — but not always — the same.
 */
export const buildStampLine = (stamp = BUILD_STAMP) => {
  const t = stamp?.builtAt ? new Date(stamp.builtAt) : null;
  const hhmm = t && !Number.isNaN(t.getTime())
    ? `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
    : '—';
  const where = stamp?.sourceDir && stamp.sourceDir !== stamp?.branch
    ? `${stamp.sourceDir}/${stamp.branch}`
    : (stamp?.branch || 'unknown');
  return `v${stamp?.version || '?'} · ${where}@${stamp?.commit || '?'} · built ${hhmm}`;
};

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

