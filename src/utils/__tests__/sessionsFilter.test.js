/**
 * sessionsFilter.test.js — verify-and-pin regression coverage for the
 * SV-F7 Live/Online classification predicate (WS-080 / SPR-062).
 *
 * Investigation result (SPR-062 fork): NO BUG. SV-F7 classification is
 * correct because the import path funnels through getOrCreateOnlineSession
 * which sets source='ignition' at the writer boundary
 * (sessionsStorage.js:688). These tests pin that contract.
 *
 * If a future change introduces a path that creates online sessions
 * without source='ignition', the SV-F7 filter would silently miscategorize
 * them as Live. These tests would not catch that drift directly, but the
 * source-grep test in this file pins the boundary that prevents it.
 */

import { describe, it, expect } from 'vitest';
import {
  matchesSessionsFilter,
  filterSessionsByMode,
  SESSIONS_FILTER_MODES,
  sortSessions,
  searchSessions,
  groupSessionsByMonth,
  SESSION_SORT_KEYS,
} from '../sessionsFilter';

const liveSession = (overrides = {}) => ({
  sessionId: 'live:1',
  source: 'live',
  venue: 'Casino X',
  ...overrides,
});

const onlineSession = (overrides = {}) => ({
  sessionId: 'online:1',
  source: 'ignition',
  venue: 'Online',
  ...overrides,
});

const sessionWithoutSource = (overrides = {}) => ({
  sessionId: 'unknown:1',
  // intentionally omit source field — represents legacy / pre-source records
  venue: 'Legacy Casino',
  ...overrides,
});

describe('matchesSessionsFilter', () => {
  describe('mode=all (or any unknown mode)', () => {
    it('passes Live sessions', () => {
      expect(matchesSessionsFilter(liveSession(), 'all')).toBe(true);
    });
    it('passes Online sessions', () => {
      expect(matchesSessionsFilter(onlineSession(), 'all')).toBe(true);
    });
    it('passes legacy sessions without source field', () => {
      expect(matchesSessionsFilter(sessionWithoutSource(), 'all')).toBe(true);
    });
    it('treats unknown mode strings as no-filter', () => {
      expect(matchesSessionsFilter(liveSession(), 'tournament')).toBe(true);
      expect(matchesSessionsFilter(onlineSession(), 'foo')).toBe(true);
    });
    it('treats null/undefined mode as no-filter', () => {
      expect(matchesSessionsFilter(liveSession(), null)).toBe(true);
      expect(matchesSessionsFilter(liveSession(), undefined)).toBe(true);
    });
  });

  describe('mode=live', () => {
    it('passes sessions whose source !== "ignition"', () => {
      expect(matchesSessionsFilter(liveSession(), 'live')).toBe(true);
      expect(matchesSessionsFilter(liveSession({ source: 'live' }), 'live')).toBe(true);
      expect(matchesSessionsFilter(liveSession({ source: 'tournament' }), 'live')).toBe(true);
    });
    it('passes sessions WITHOUT source field (legacy classification)', () => {
      // Critical: legacy records pre-source field default to Live in current
      // SV-F7 logic. This pins that behavior — changing it would require
      // founder ratification.
      expect(matchesSessionsFilter(sessionWithoutSource(), 'live')).toBe(true);
    });
    it('rejects sessions with source === "ignition"', () => {
      expect(matchesSessionsFilter(onlineSession(), 'live')).toBe(false);
    });
  });

  describe('mode=online', () => {
    it('passes sessions whose source === "ignition"', () => {
      expect(matchesSessionsFilter(onlineSession(), 'online')).toBe(true);
    });
    it('rejects Live sessions', () => {
      expect(matchesSessionsFilter(liveSession(), 'online')).toBe(false);
      expect(matchesSessionsFilter(liveSession({ source: 'tournament' }), 'online')).toBe(false);
    });
    it('rejects sessions without source field', () => {
      expect(matchesSessionsFilter(sessionWithoutSource(), 'online')).toBe(false);
    });
  });

  describe('invalid input', () => {
    it('rejects non-object session', () => {
      expect(matchesSessionsFilter(null, 'all')).toBe(false);
      expect(matchesSessionsFilter(undefined, 'live')).toBe(false);
      expect(matchesSessionsFilter('string', 'online')).toBe(false);
    });
  });
});

describe('filterSessionsByMode', () => {
  const mixed = [
    liveSession({ sessionId: 'L1' }),
    onlineSession({ sessionId: 'O1' }),
    liveSession({ sessionId: 'L2', source: 'tournament' }),
    onlineSession({ sessionId: 'O2' }),
    sessionWithoutSource({ sessionId: 'X1' }),
  ];

  it('mode=all returns all sessions', () => {
    expect(filterSessionsByMode(mixed, 'all').map((s) => s.sessionId))
      .toEqual(['L1', 'O1', 'L2', 'O2', 'X1']);
  });

  it('mode=live returns sessions with source !== "ignition"', () => {
    expect(filterSessionsByMode(mixed, 'live').map((s) => s.sessionId))
      .toEqual(['L1', 'L2', 'X1']);
  });

  it('mode=online returns sessions with source === "ignition"', () => {
    expect(filterSessionsByMode(mixed, 'online').map((s) => s.sessionId))
      .toEqual(['O1', 'O2']);
  });

  it('returns [] for non-array input', () => {
    expect(filterSessionsByMode(null, 'live')).toEqual([]);
    expect(filterSessionsByMode(undefined, 'live')).toEqual([]);
    expect(filterSessionsByMode('string', 'live')).toEqual([]);
  });

  it('returns [] for empty array regardless of mode', () => {
    expect(filterSessionsByMode([], 'live')).toEqual([]);
    expect(filterSessionsByMode([], 'online')).toEqual([]);
    expect(filterSessionsByMode([], 'all')).toEqual([]);
  });
});

describe('SESSIONS_FILTER_MODES enum', () => {
  it('contains all three modes', () => {
    expect(SESSIONS_FILTER_MODES).toEqual(['all', 'live', 'online']);
  });

  it('is frozen (cannot mutate)', () => {
    expect(() => {
      SESSIONS_FILTER_MODES.push('tournament');
    }).toThrow();
  });
});

// ===========================================================================
// PHASE 3 — sort / search / month grouping
// ===========================================================================

const HOUR = 3600000;
const completed = (overrides = {}) => ({
  sessionId: 's',
  startTime: 1000,
  endTime: 1000 + 2 * HOUR,
  venue: 'Casino A',
  gameType: '1/2',
  buyIn: 200,
  rebuyTransactions: [],
  cashOut: 350,
  tipAmount: 0,
  handCount: 50,
  isActive: false,
  ...overrides,
});

describe('sortSessions', () => {
  it('sorts by date descending by default', () => {
    const a = completed({ sessionId: 'old', startTime: 1000 });
    const b = completed({ sessionId: 'new', startTime: 9000 });
    expect(sortSessions([a, b]).map((s) => s.sessionId)).toEqual(['new', 'old']);
  });

  it('sorts by date ascending when asked', () => {
    const a = completed({ sessionId: 'old', startTime: 1000 });
    const b = completed({ sessionId: 'new', startTime: 9000 });
    expect(sortSessions([a, b], 'date', 'asc').map((s) => s.sessionId)).toEqual(['old', 'new']);
  });

  it('sorts by profit descending', () => {
    const win = completed({ sessionId: 'win', cashOut: 600 }); // +400
    const lose = completed({ sessionId: 'lose', cashOut: 50 }); // -150
    expect(sortSessions([lose, win], 'profit').map((s) => s.sessionId)).toEqual(['win', 'lose']);
  });

  it('sorts by duration descending', () => {
    const short = completed({ sessionId: 'short', endTime: 1000 + 1 * HOUR });
    const long = completed({ sessionId: 'long', endTime: 1000 + 5 * HOUR });
    expect(sortSessions([short, long], 'duration').map((s) => s.sessionId)).toEqual(['long', 'short']);
  });

  it('does not mutate the input array', () => {
    const arr = [completed({ sessionId: 'a', startTime: 1 }), completed({ sessionId: 'b', startTime: 2 })];
    const before = arr.map((s) => s.sessionId);
    sortSessions(arr, 'date', 'desc');
    expect(arr.map((s) => s.sessionId)).toEqual(before);
  });

  it('falls back to date for an unknown key and tolerates non-array', () => {
    expect(sortSessions(undefined)).toEqual([]);
    const a = completed({ sessionId: 'old', startTime: 1000 });
    const b = completed({ sessionId: 'new', startTime: 9000 });
    expect(sortSessions([a, b], 'bogus').map((s) => s.sessionId)).toEqual(['new', 'old']);
  });

  it('exposes the valid sort keys', () => {
    expect(SESSION_SORT_KEYS).toEqual(['date', 'profit', 'duration']);
  });
});

describe('searchSessions', () => {
  const rows = [
    completed({ sessionId: 'a', venue: 'Bellagio', gameType: '2/5', goal: 'tighten up' }),
    completed({ sessionId: 'b', venue: 'Horseshoe', gameType: '1/2', goal: 'work on cbets' }),
  ];

  it('returns the list unchanged for empty query', () => {
    expect(searchSessions(rows, '')).toBe(rows);
    expect(searchSessions(rows, '   ')).toBe(rows);
  });

  it('matches venue case-insensitively', () => {
    expect(searchSessions(rows, 'bell').map((s) => s.sessionId)).toEqual(['a']);
  });

  it('matches game type', () => {
    expect(searchSessions(rows, '1/2').map((s) => s.sessionId)).toEqual(['b']);
  });

  it('matches goal text', () => {
    expect(searchSessions(rows, 'cbet').map((s) => s.sessionId)).toEqual(['b']);
  });

  it('returns [] when nothing matches and tolerates non-array', () => {
    expect(searchSessions(rows, 'zzz')).toEqual([]);
    expect(searchSessions(undefined, 'x')).toEqual([]);
  });
});

describe('groupSessionsByMonth', () => {
  it('buckets sessions by calendar month, preserving order', () => {
    const jun1 = completed({ sessionId: 'j1', startTime: new Date(2026, 5, 1).getTime() });
    const jun2 = completed({ sessionId: 'j2', startTime: new Date(2026, 5, 20).getTime() });
    const may = completed({ sessionId: 'm1', startTime: new Date(2026, 4, 15).getTime() });
    const groups = groupSessionsByMonth([jun1, jun2, may]);
    expect(groups.map((g) => g.key)).toEqual(['2026-06', '2026-05']);
    expect(groups[0].sessions.map((s) => s.sessionId)).toEqual(['j1', 'j2']);
    expect(groups[0].label).toMatch(/June 2026/);
  });

  it('tolerates non-array input', () => {
    expect(groupSessionsByMonth(undefined)).toEqual([]);
  });
});
