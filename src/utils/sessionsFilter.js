/**
 * sessionsFilter.js — pure-util filter predicate for the SessionsView SV-F7
 * past-sessions Live/Online filter pills.
 *
 * Per `SessionsView.jsx:464-465` (SV-F7 audit, AUDIT-2026-04-21-SV F7):
 *   - `live`   → only sessions whose `source !== 'ignition'`
 *   - `online` → only sessions whose `source === 'ignition'`
 *   - `all`    → no source filter applied
 *
 * Extension-imported sessions land via `useSyncBridge.js:101` →
 * `getOrCreateOnlineSession` → `sessionsStorage.js:688` which sets
 * `source: 'ignition'` at the writer boundary. Filter classification is
 * therefore correct by construction (verified WS-080 / SPR-062 — no bug).
 *
 * Pure util — extracted SPR-062 from inline filter for reusability +
 * verify-and-pin regression coverage.
 */

/**
 * Predicate returning true if `session` matches the given `mode`.
 *
 * @param {Object} session — session record with optional `source` field
 * @param {'all' | 'live' | 'online' | string} mode — filter mode
 * @returns {boolean}
 */
export const matchesSessionsFilter = (session, mode) => {
  if (!session || typeof session !== 'object') return false;
  if (mode === 'live') return session.source !== 'ignition';
  if (mode === 'online') return session.source === 'ignition';
  // Any other mode (including 'all', null, undefined, unknown) → no filter.
  return true;
};

/**
 * Filter an array of sessions by mode. Tolerates non-array input.
 *
 * @param {Object[]} sessions
 * @param {'all' | 'live' | 'online' | string} mode
 * @returns {Object[]}
 */
export const filterSessionsByMode = (sessions, mode) => {
  if (!Array.isArray(sessions)) return [];
  return sessions.filter((s) => matchesSessionsFilter(s, mode));
};

/**
 * Valid SV-F7 filter modes (UI chip values).
 */
export const SESSIONS_FILTER_MODES = Object.freeze(['all', 'live', 'online']);

export default filterSessionsByMode;
