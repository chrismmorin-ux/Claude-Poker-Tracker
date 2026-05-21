/**
 * sessionRollupSelectors.test.js — per-session anchor activity aggregation.
 *
 * Per SPR-061 / WS-171.
 */

import { describe, it, expect } from 'vitest';
import { selectAnchorActivityForSession } from '../sessionRollupSelectors';
import { OBSERVATION_ORIGINS } from '../../../constants/anchorLibraryConstants';

const SESSION_ID = 'session:test:1';
const SESSION_START_MS = Date.parse('2026-05-09T08:00:00.000Z');
const SESSION_END_MS = Date.parse('2026-05-09T11:00:00.000Z');

const buildHand = (handId, sessionId = SESSION_ID) => ({ handId, sessionId });

const buildMatcherObs = (handId, anchorId) => ({
  id: `obs:${handId}:matcher:${anchorId}:flop`,
  handId,
  anchorId,
  origin: OBSERVATION_ORIGINS.MATCHER_SYSTEM,
  createdAt: '2026-05-09T09:00:00.000Z',
});

const buildOwnerObs = (handId, idx = 0) => ({
  id: `obs:${handId}:${idx}`,
  handId,
  origin: OBSERVATION_ORIGINS.OWNER_CAPTURED,
  ownerTags: [{ kind: 'fixed', value: 'mistake' }],
  createdAt: '2026-05-09T09:30:00.000Z',
});

const buildAutoRetiredAnchor = (id, lastOverrideAt) => ({
  id,
  archetypeName: id,
  status: 'retired',
  operator: {
    lastOverrideBy: 'system',
    overrideReason: 'auto-retire',
    lastOverrideAt,
  },
});

describe('selectAnchorActivityForSession', () => {
  describe('empty / invalid input', () => {
    it('returns empty bundle when called with no args', () => {
      const result = selectAnchorActivityForSession();
      expect(result).toEqual({
        matcherFired: [],
        ownerCaptured: [],
        distinctAnchorIds: [],
        autoRetired: [],
      });
    });

    it('returns empty bundle when hands array is empty (no session hands → no observations match)', () => {
      const result = selectAnchorActivityForSession({
        sessionId: SESSION_ID,
        sessionStart: SESSION_START_MS,
        sessionEnd: SESSION_END_MS,
        hands: [],
        observations: [buildOwnerObs('hand-X')],
        anchors: [],
      });
      expect(result.matcherFired).toEqual([]);
      expect(result.ownerCaptured).toEqual([]);
    });

    it('tolerates non-array inputs', () => {
      const result = selectAnchorActivityForSession({
        sessionId: SESSION_ID,
        sessionStart: SESSION_START_MS,
        sessionEnd: SESSION_END_MS,
        hands: null,
        observations: undefined,
        anchors: 'bad',
      });
      expect(result).toEqual({
        matcherFired: [],
        ownerCaptured: [],
        distinctAnchorIds: [],
        autoRetired: [],
      });
    });

    it('tolerates malformed hand entries', () => {
      const result = selectAnchorActivityForSession({
        sessionId: SESSION_ID,
        sessionStart: SESSION_START_MS,
        sessionEnd: SESSION_END_MS,
        hands: [null, undefined, {}, { handId: 'h:1' }],
        observations: [buildOwnerObs('h:1')],
        anchors: [],
      });
      expect(result.ownerCaptured).toHaveLength(1);
    });
  });

  describe('observation filtering by handId set', () => {
    it('keeps observations whose handId is in the session hand set', () => {
      const hands = [buildHand('h:1'), buildHand('h:2')];
      const observations = [
        buildOwnerObs('h:1', 0),
        buildOwnerObs('h:99', 0), // not in session
        buildOwnerObs('h:2', 0),
      ];
      const result = selectAnchorActivityForSession({
        sessionId: SESSION_ID,
        sessionStart: SESSION_START_MS,
        sessionEnd: SESSION_END_MS,
        hands,
        observations,
        anchors: [],
      });
      expect(result.ownerCaptured).toHaveLength(2);
      expect(result.ownerCaptured.map((o) => o.handId).sort()).toEqual(['h:1', 'h:2']);
    });

    it('coerces handId types (number vs string) for tolerance', () => {
      const hands = [{ handId: 42 }];
      const observations = [{ ...buildOwnerObs('42'), handId: 42 }];
      const result = selectAnchorActivityForSession({
        sessionId: SESSION_ID,
        sessionStart: SESSION_START_MS,
        sessionEnd: SESSION_END_MS,
        hands,
        observations,
        anchors: [],
      });
      expect(result.ownerCaptured).toHaveLength(1);
    });
  });

  describe('AP-08 signal separation invariant', () => {
    it('matcher-system + owner-captured observations end up in SEPARATE arrays', () => {
      const hands = [buildHand('h:1')];
      const observations = [
        buildMatcherObs('h:1', 'anchor:nit-overfold'),
        buildOwnerObs('h:1', 0),
        buildMatcherObs('h:1', 'anchor:fish-overcall'),
        buildOwnerObs('h:1', 1),
      ];
      const result = selectAnchorActivityForSession({
        sessionId: SESSION_ID,
        sessionStart: SESSION_START_MS,
        sessionEnd: SESSION_END_MS,
        hands,
        observations,
        anchors: [],
      });
      expect(result.matcherFired).toHaveLength(2);
      expect(result.ownerCaptured).toHaveLength(2);
      // Critically — never combined.
      for (const obs of result.matcherFired) {
        expect(obs.origin).toBe(OBSERVATION_ORIGINS.MATCHER_SYSTEM);
      }
      for (const obs of result.ownerCaptured) {
        expect(obs.origin).toBe(OBSERVATION_ORIGINS.OWNER_CAPTURED);
      }
    });

    it('observations with unknown origin are silently dropped (forward-compat)', () => {
      const hands = [buildHand('h:1')];
      const observations = [
        { id: 'obs:weird', handId: 'h:1', origin: 'future-origin-class' },
      ];
      const result = selectAnchorActivityForSession({
        sessionId: SESSION_ID,
        sessionStart: SESSION_START_MS,
        sessionEnd: SESSION_END_MS,
        hands,
        observations,
        anchors: [],
      });
      expect(result.matcherFired).toEqual([]);
      expect(result.ownerCaptured).toEqual([]);
    });
  });

  describe('distinctAnchorIds aggregation', () => {
    it('returns sorted, deduped anchor ids from matcher-fired observations', () => {
      const hands = [buildHand('h:1'), buildHand('h:2')];
      const observations = [
        buildMatcherObs('h:1', 'anchor:b'),
        buildMatcherObs('h:2', 'anchor:a'),
        buildMatcherObs('h:1', 'anchor:b'), // dup
        buildMatcherObs('h:2', 'anchor:c'),
      ];
      const result = selectAnchorActivityForSession({
        sessionId: SESSION_ID,
        sessionStart: SESSION_START_MS,
        sessionEnd: SESSION_END_MS,
        hands,
        observations,
        anchors: [],
      });
      expect(result.distinctAnchorIds).toEqual(['anchor:a', 'anchor:b', 'anchor:c']);
    });

    it('owner-captured observations without anchorId are excluded from distinctAnchorIds', () => {
      const hands = [buildHand('h:1')];
      const observations = [buildOwnerObs('h:1')];
      const result = selectAnchorActivityForSession({
        sessionId: SESSION_ID,
        sessionStart: SESSION_START_MS,
        sessionEnd: SESSION_END_MS,
        hands,
        observations,
        anchors: [],
      });
      expect(result.distinctAnchorIds).toEqual([]);
    });
  });

  describe('autoRetired window filter', () => {
    it('includes anchors whose lastOverrideAt is within [start, end]', () => {
      const inside = buildAutoRetiredAnchor('a:1', '2026-05-09T10:30:00.000Z');
      const result = selectAnchorActivityForSession({
        sessionId: SESSION_ID,
        sessionStart: SESSION_START_MS,
        sessionEnd: SESSION_END_MS,
        hands: [],
        observations: [],
        anchors: [inside],
      });
      expect(result.autoRetired).toHaveLength(1);
      expect(result.autoRetired[0].id).toBe('a:1');
    });

    it('excludes anchors retired BEFORE the session start', () => {
      const before = buildAutoRetiredAnchor('a:before', '2026-05-09T07:30:00.000Z');
      const result = selectAnchorActivityForSession({
        sessionId: SESSION_ID,
        sessionStart: SESSION_START_MS,
        sessionEnd: SESSION_END_MS,
        hands: [],
        observations: [],
        anchors: [before],
      });
      expect(result.autoRetired).toEqual([]);
    });

    it('excludes anchors retired AFTER the session end', () => {
      const after = buildAutoRetiredAnchor('a:after', '2026-05-09T12:30:00.000Z');
      const result = selectAnchorActivityForSession({
        sessionId: SESSION_ID,
        sessionStart: SESSION_START_MS,
        sessionEnd: SESSION_END_MS,
        hands: [],
        observations: [],
        anchors: [after],
      });
      expect(result.autoRetired).toEqual([]);
    });

    it('excludes anchors retired by owner (not auto-retire)', () => {
      const manual = {
        id: 'a:manual',
        operator: {
          lastOverrideBy: 'owner',
          overrideReason: 'manual-retire',
          lastOverrideAt: '2026-05-09T10:30:00.000Z',
        },
      };
      const result = selectAnchorActivityForSession({
        sessionId: SESSION_ID,
        sessionStart: SESSION_START_MS,
        sessionEnd: SESSION_END_MS,
        hands: [],
        observations: [],
        anchors: [manual],
      });
      expect(result.autoRetired).toEqual([]);
    });

    it('handles open session (no end time) — bound is +Infinity', () => {
      const recent = buildAutoRetiredAnchor('a:recent', '2026-05-09T10:30:00.000Z');
      const future = buildAutoRetiredAnchor('a:future', '2026-12-31T23:59:59.000Z');
      const result = selectAnchorActivityForSession({
        sessionId: SESSION_ID,
        sessionStart: SESSION_START_MS,
        sessionEnd: null,
        hands: [],
        observations: [],
        anchors: [recent, future],
      });
      expect(result.autoRetired).toHaveLength(2);
    });

    it('boundary: anchor retired exactly at sessionStart is INCLUDED', () => {
      const startBoundary = buildAutoRetiredAnchor('a:start', new Date(SESSION_START_MS).toISOString());
      const result = selectAnchorActivityForSession({
        sessionId: SESSION_ID,
        sessionStart: SESSION_START_MS,
        sessionEnd: SESSION_END_MS,
        hands: [],
        observations: [],
        anchors: [startBoundary],
      });
      expect(result.autoRetired).toHaveLength(1);
    });

    it('boundary: anchor retired exactly at sessionEnd is INCLUDED', () => {
      const endBoundary = buildAutoRetiredAnchor('a:end', new Date(SESSION_END_MS).toISOString());
      const result = selectAnchorActivityForSession({
        sessionId: SESSION_ID,
        sessionStart: SESSION_START_MS,
        sessionEnd: SESSION_END_MS,
        hands: [],
        observations: [],
        anchors: [endBoundary],
      });
      expect(result.autoRetired).toHaveLength(1);
    });

    it('handles malformed lastOverrideAt timestamps gracefully', () => {
      const bad = {
        id: 'a:bad',
        operator: {
          lastOverrideBy: 'system',
          overrideReason: 'auto-retire',
          lastOverrideAt: 'not-a-date',
        },
      };
      const result = selectAnchorActivityForSession({
        sessionId: SESSION_ID,
        sessionStart: SESSION_START_MS,
        sessionEnd: SESSION_END_MS,
        hands: [],
        observations: [],
        anchors: [bad],
      });
      expect(result.autoRetired).toEqual([]);
    });
  });

  describe('full integration scenario', () => {
    it('mixed session: 2 matcher-fires + 1 owner-capture + 1 auto-retire', () => {
      const hands = [buildHand('h:1'), buildHand('h:2'), buildHand('h:3')];
      const observations = [
        buildMatcherObs('h:1', 'anchor:nit-overfold'),
        buildMatcherObs('h:2', 'anchor:nit-overfold'), // same anchor, different hand
        buildOwnerObs('h:3', 0),
      ];
      const anchors = [
        buildAutoRetiredAnchor('anchor:fish-overcall', '2026-05-09T10:30:00.000Z'),
        // un-related anchor not in window
        buildAutoRetiredAnchor('anchor:lag-bluff', '2026-05-08T10:30:00.000Z'),
      ];
      const result = selectAnchorActivityForSession({
        sessionId: SESSION_ID,
        sessionStart: SESSION_START_MS,
        sessionEnd: SESSION_END_MS,
        hands,
        observations,
        anchors,
      });
      expect(result.matcherFired).toHaveLength(2);
      expect(result.ownerCaptured).toHaveLength(1);
      expect(result.distinctAnchorIds).toEqual(['anchor:nit-overfold']);
      expect(result.autoRetired).toHaveLength(1);
      expect(result.autoRetired[0].id).toBe('anchor:fish-overcall');
    });
  });
});
