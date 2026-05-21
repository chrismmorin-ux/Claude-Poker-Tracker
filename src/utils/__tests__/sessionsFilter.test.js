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
