/**
 * handLinking.test.js — Pure retroactive seat↔player linking (PEO-1)
 *
 * No IDB required — linkPlayerToPriorSeatHands is pure over hands[].
 * Covers every edge case from plan §D3 + invariants I-PEO-2, I-PEO-3, I-PEO-4.
 */

import { describe, it, expect } from 'vitest';
import {
  linkPlayerToPriorSeatHands,
  buildUnlinkPlan,
  buildLinkPayload,
} from '../handLinking';

const makeHand = (overrides = {}) => ({
  handId: overrides.handId ?? 1,
  sessionId: overrides.sessionId ?? 1,
  timestamp: overrides.timestamp ?? 1000,
  seatPlayers: overrides.seatPlayers ?? {},
});

describe('linkPlayerToPriorSeatHands — boundary behavior', () => {
  it('returns empty plan on empty hands', () => {
    const r = linkPlayerToPriorSeatHands([], 3, 7, 1);
    expect(r.handIds).toEqual([]);
    expect(typeof r.undoToken).toBe('string');
    expect(r.skipped).toBe(0);
  });

  it('returns empty plan when sessionId is null', () => {
    const hands = [makeHand({ handId: 1, sessionId: 1 })];
    expect(linkPlayerToPriorSeatHands(hands, 3, 7, null).handIds).toEqual([]);
  });

  it('returns empty plan when sessionId is undefined', () => {
    const hands = [makeHand({ handId: 1, sessionId: 1 })];
    expect(linkPlayerToPriorSeatHands(hands, 3, 7, undefined).handIds).toEqual([]);
  });

  it('returns empty plan when seat or playerId is non-numeric', () => {
    const hands = [makeHand({ handId: 1, sessionId: 1 })];
    expect(linkPlayerToPriorSeatHands(hands, 'three', 7, 1).handIds).toEqual([]);
    expect(linkPlayerToPriorSeatHands(hands, 3, 'seven', 1).handIds).toEqual([]);
  });

  it('links a single hand with an empty seat', () => {
    const hands = [makeHand({ handId: 10, sessionId: 1, timestamp: 1000 })];
    const r = linkPlayerToPriorSeatHands(hands, 3, 7, 1);
    expect(r.handIds).toEqual([10]);
  });

  it('links multiple in-session hands with empty seats, newest-first order', () => {
    const hands = [
      makeHand({ handId: 3, sessionId: 1, timestamp: 3000 }),
      makeHand({ handId: 1, sessionId: 1, timestamp: 1000 }),
      makeHand({ handId: 2, sessionId: 1, timestamp: 2000 }),
    ];
    const r = linkPlayerToPriorSeatHands(hands, 3, 7, 1);
    expect(r.handIds).toEqual([3, 2, 1]);
  });
});

describe('linkPlayerToPriorSeatHands — session scope (I-PEO-2)', () => {
  it('excludes hands from other sessions', () => {
    const hands = [
      makeHand({ handId: 1, sessionId: 1, timestamp: 1000 }),
      makeHand({ handId: 2, sessionId: 2, timestamp: 2000 }),
      makeHand({ handId: 3, sessionId: 1, timestamp: 3000 }),
    ];
    const r = linkPlayerToPriorSeatHands(hands, 3, 7, 1);
    expect(r.handIds.sort()).toEqual([1, 3]);
  });

  it('never modifies cross-session hands even if they would match', () => {
    const hands = [
      makeHand({ handId: 1, sessionId: 99, timestamp: 1000, seatPlayers: {} }),
    ];
    expect(linkPlayerToPriorSeatHands(hands, 3, 7, 1).handIds).toEqual([]);
  });
});

describe('linkPlayerToPriorSeatHands — boundary stop on different player', () => {
  it('stops walking backward at the first hand where seat belongs to someone else', () => {
    // Hand order newest → oldest: 5, 4, 3, 2, 1
    // Seat 3 was player 99 at hand 3; we assign player 7 at hand 5.
    // Expect: hands 5, 4 linked; hands 3, 2, 1 left alone (boundary at 3).
    const hands = [
      makeHand({ handId: 5, sessionId: 1, timestamp: 5000 }),
      makeHand({ handId: 4, sessionId: 1, timestamp: 4000 }),
      makeHand({ handId: 3, sessionId: 1, timestamp: 3000, seatPlayers: { 3: 99 } }),
      makeHand({ handId: 2, sessionId: 1, timestamp: 2000 }),
      makeHand({ handId: 1, sessionId: 1, timestamp: 1000 }),
    ];
    const r = linkPlayerToPriorSeatHands(hands, 3, 7, 1);
    expect(r.handIds.sort()).toEqual([4, 5]);
  });

  it('treats "cleared seat" (null/absent) as linkable, not as boundary', () => {
    const hands = [
      makeHand({ handId: 3, sessionId: 1, timestamp: 3000, seatPlayers: { 3: null } }),
      makeHand({ handId: 2, sessionId: 1, timestamp: 2000, seatPlayers: {} }),
      makeHand({ handId: 1, sessionId: 1, timestamp: 1000 }),
    ];
    const r = linkPlayerToPriorSeatHands(hands, 3, 7, 1);
    expect(r.handIds.sort()).toEqual([1, 2, 3]);
  });

  it('boundary is only on the target seat, not other seats', () => {
    const hands = [
      makeHand({ handId: 2, sessionId: 1, timestamp: 2000, seatPlayers: { 5: 99 } }),
      makeHand({ handId: 1, sessionId: 1, timestamp: 1000 }),
    ];
    const r = linkPlayerToPriorSeatHands(hands, 3, 7, 1);
    expect(r.handIds.sort()).toEqual([1, 2]);
  });
});

describe('linkPlayerToPriorSeatHands — idempotence (I-PEO-3)', () => {
  it('hand already mapped to (seat, playerId) is not duplicated in plan', () => {
    const hands = [
      makeHand({ handId: 3, sessionId: 1, timestamp: 3000, seatPlayers: { 3: 7 } }),
      makeHand({ handId: 2, sessionId: 1, timestamp: 2000 }),
      makeHand({ handId: 1, sessionId: 1, timestamp: 1000 }),
    ];
    const r = linkPlayerToPriorSeatHands(hands, 3, 7, 1);
    expect(r.handIds.sort()).toEqual([1, 2]);
    expect(r.skipped).toBe(1);
  });

  it('re-running the same link twice on already-linked hands yields an empty plan', () => {
    const hands = [
      makeHand({ handId: 1, sessionId: 1, timestamp: 1000, seatPlayers: { 3: 7 } }),
      makeHand({ handId: 2, sessionId: 1, timestamp: 2000, seatPlayers: { 3: 7 } }),
    ];
    const r = linkPlayerToPriorSeatHands(hands, 3, 7, 1);
    expect(r.handIds).toEqual([]);
    expect(r.skipped).toBe(2);
  });

  it('skipped hands do not stop the walk (unlike different-player boundary)', () => {
    // Hand 3 already mapped to player 7 — continue walking past it.
    // Hand 2 has seat 3 mapped to player 99 — that's the stop boundary.
    // Hand 1 is never reached.
    const hands = [
      makeHand({ handId: 4, sessionId: 1, timestamp: 4000 }),
      makeHand({ handId: 3, sessionId: 1, timestamp: 3000, seatPlayers: { 3: 7 } }),
      makeHand({ handId: 2, sessionId: 1, timestamp: 2000, seatPlayers: { 3: 99 } }),
      makeHand({ handId: 1, sessionId: 1, timestamp: 1000 }),
    ];
    const r = linkPlayerToPriorSeatHands(hands, 3, 7, 1);
    expect(r.handIds).toEqual([4]);
    expect(r.skipped).toBe(1);
  });
});

describe('linkPlayerToPriorSeatHands — undo token (I-PEO-4)', () => {
  it('returns a unique-ish undoToken on every call', () => {
    const hands = [makeHand({ handId: 1, sessionId: 1 })];
    const r1 = linkPlayerToPriorSeatHands(hands, 3, 7, 1);
    const r2 = linkPlayerToPriorSeatHands(hands, 3, 7, 1);
    expect(r1.undoToken).not.toBe(r2.undoToken);
  });

  it('undoToken format encodes seat + playerId (for debug visibility)', () => {
    const { undoToken } = linkPlayerToPriorSeatHands([], 3, 7, 1);
    expect(undoToken).toMatch(/^retro-3-7-/);
  });
});

describe('buildLinkPayload', () => {
  it('maps each handId to a {handId, seat, playerId} update', () => {
    const linkResult = { handIds: [1, 2, 3] };
    expect(buildLinkPayload(linkResult, 3, 7)).toEqual([
      { handId: 1, seat: 3, playerId: 7 },
      { handId: 2, seat: 3, playerId: 7 },
      { handId: 3, seat: 3, playerId: 7 },
    ]);
  });

  it('returns empty array for null/empty input', () => {
    expect(buildLinkPayload(null, 3, 7)).toEqual([]);
    expect(buildLinkPayload({ handIds: [] }, 3, 7)).toEqual([]);
    expect(buildLinkPayload({}, 3, 7)).toEqual([]);
  });
});

describe('buildUnlinkPlan', () => {
  it('emits clear updates for each linked hand still carrying the player', () => {
    const linkResult = { handIds: [1, 2, 3] };
    const hands = [
      makeHand({ handId: 1, seatPlayers: { 3: 7 } }),
      makeHand({ handId: 2, seatPlayers: { 3: 7 } }),
      makeHand({ handId: 3, seatPlayers: { 3: 7 } }),
    ];
    expect(buildUnlinkPlan(linkResult, 3, 7, hands)).toEqual([
      { handId: 1, seat: 3, playerId: null },
      { handId: 2, seat: 3, playerId: null },
      { handId: 3, seat: 3, playerId: null },
    ]);
  });

  it('skips hands that were reassigned to a different player since the link', () => {
    const linkResult = { handIds: [1, 2] };
    const hands = [
      makeHand({ handId: 1, seatPlayers: { 3: 7 } }),
      makeHand({ handId: 2, seatPlayers: { 3: 99 } }),  // since-reassigned
    ];
    expect(buildUnlinkPlan(linkResult, 3, 7, hands)).toEqual([
      { handId: 1, seat: 3, playerId: null },
    ]);
  });

  it('emits best-effort clear for hands no longer in state', () => {
    const linkResult = { handIds: [1, 99] };
    const hands = [
      makeHand({ handId: 1, seatPlayers: { 3: 7 } }),
    ];
    expect(buildUnlinkPlan(linkResult, 3, 7, hands)).toEqual([
      { handId: 1, seat: 3, playerId: null },
      { handId: 99, seat: 3, playerId: null },
    ]);
  });

  it('returns empty array for null/empty input', () => {
    expect(buildUnlinkPlan(null, 3, 7, [])).toEqual([]);
    expect(buildUnlinkPlan({ handIds: [] }, 3, 7, [])).toEqual([]);
  });
});

describe('integration: link → unlink round trip', () => {
  it('produces equal and opposite payloads for a clean link', () => {
    const hands = [
      makeHand({ handId: 1, sessionId: 1, timestamp: 1000 }),
      makeHand({ handId: 2, sessionId: 1, timestamp: 2000 }),
    ];
    const linkResult = linkPlayerToPriorSeatHands(hands, 3, 7, 1);
    const linkPayload = buildLinkPayload(linkResult, 3, 7);
    // Apply the link to an in-memory copy
    const after = hands.map(h => {
      const update = linkPayload.find(u => u.handId === h.handId);
      return update ? { ...h, seatPlayers: { ...h.seatPlayers, [update.seat]: update.playerId } } : h;
    });
    const unlinkPayload = buildUnlinkPlan(linkResult, 3, 7, after);
    expect(unlinkPayload).toHaveLength(linkPayload.length);
    expect(unlinkPayload.every(u => u.playerId === null)).toBe(true);
  });
});
