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
 * WS-368 SCOPE DECISION — SESSIONS DELIBERATELY LEFT ON THE NEGATION.
 *
 * WS-368 gave HAND records a positive provenance identity (`source` +
 * structured `provenance`, IDB v28) because "live" being the ABSENCE of a stamp
 * made the live subset unselectable. The same absence-as-identity shape exists
 * one level up, here: `mode === 'live'` is `source !== 'ignition'`, a negation.
 * The question was asked of the sessions store and answered NO for now, on
 * three grounds:
 *
 *   1. The thing hand provenance could not state — POPULATION identity, the
 *      rank-1 fault in the suspected-fault register — sessions already state
 *      positively. A session record carries `venue`, `gameType` and (online)
 *      `stakes` at construction. Only the channel discriminator is a negation,
 *      and that is the part that matters least: the hand stamp now carries
 *      venue and stake down onto each hand, which is where measurement reads.
 *   2. This predicate feeds UI filter pills, not a measurement selector. The
 *      failure it can cause is a mislabelled chip, not a wrong number. The hand
 *      selector could return an empty set on a full database; this cannot.
 *   3. Cost. A session channel would mean a second store migration in the same
 *      version bump plus changes across SessionCard, SessionDetailModal,
 *      SessionsView and OnlineSessionContext — UI-visible work that trips the
 *      Design Program gates, for a defect with no measurement consequence.
 *
 * What that leaves: a session with no `source` still reads as live here, and an
 * imported session is indistinguishable from a live one. File it with the
 * export/harness work WS-368's status_note sequences after this ticket, where
 * the shape of the session stamp is knowable because the hand stamp is settled.
 *
 * Pure util — extracted SPR-062 from inline filter for reusability +
 * verify-and-pin regression coverage.
 *
 * Phase 3 (Sessions View Improvement, 2026-06-06) adds sort / search / month-
 * grouping helpers for the past-sessions list.
 */

import { computeSessionPnl, computeSessionDurationMs } from './sessionStats/sessionAnalytics';

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

// ===========================================================================
// PHASE 3 — sort / search / month grouping
// ===========================================================================

/**
 * Valid sort keys for the past-sessions list.
 */
export const SESSION_SORT_KEYS = Object.freeze(['date', 'profit', 'duration']);

/**
 * Sort value for a session under a given key. In-progress sessions (no P&L /
 * no end time) sort as 0 for profit/duration so they sink sensibly.
 */
const sessionSortValue = (session, key) => {
  if (key === 'profit') return computeSessionPnl(session) ?? 0;
  if (key === 'duration') return computeSessionDurationMs(session);
  return session.startTime || 0; // 'date'
};

/**
 * Sort sessions by 'date' | 'profit' | 'duration'. Stable; non-mutating.
 *
 * @param {Object[]} sessions
 * @param {'date'|'profit'|'duration'} [key='date']
 * @param {'asc'|'desc'} [dir='desc']
 * @returns {Object[]}
 */
export const sortSessions = (sessions, key = 'date', dir = 'desc') => {
  if (!Array.isArray(sessions)) return [];
  const sortKey = SESSION_SORT_KEYS.includes(key) ? key : 'date';
  const factor = dir === 'asc' ? 1 : -1;
  return [...sessions].sort(
    (a, b) => factor * (sessionSortValue(a, sortKey) - sessionSortValue(b, sortKey))
  );
};

/**
 * Filter sessions by a free-text query against venue, game type, and goal
 * (case-insensitive substring). Empty query returns the list unchanged.
 *
 * @param {Object[]} sessions
 * @param {string} query
 * @returns {Object[]}
 */
export const searchSessions = (sessions, query) => {
  if (!Array.isArray(sessions)) return [];
  const q = (query || '').trim().toLowerCase();
  if (!q) return sessions;
  return sessions.filter((s) =>
    (s.venue || '').toLowerCase().includes(q) ||
    (s.gameType || '').toLowerCase().includes(q) ||
    (s.goal || '').toLowerCase().includes(q)
  );
};

/**
 * Group sessions into month buckets, preserving the input order both across
 * buckets (first-appearance) and within each bucket. Sort first, then group.
 *
 * @param {Object[]} sessions
 * @returns {Array<{key:string, label:string, sessions:Object[]}>}
 */
export const groupSessionsByMonth = (sessions) => {
  if (!Array.isArray(sessions)) return [];
  const groups = new Map();
  for (const s of sessions) {
    const d = new Date(s.startTime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        sessions: [],
      });
    }
    groups.get(key).sessions.push(s);
  }
  return Array.from(groups.values());
};

export default filterSessionsByMode;
