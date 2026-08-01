/**
 * replaySnapshot.test.js — VRN state binding at the replay cursor.
 *
 * The binding rule under test (Gate 1 observation 2): a field the app does not
 * track comes back `null`, NEVER inferred. A grader that checks a claim against
 * a guessed value is worse than no grader, so `stacks` and `spr` must stay null
 * until something actually tracks them.
 *
 * Surface spec: docs/design/surfaces/voice-reasoning-notes.md
 */

import { describe, it, expect } from 'vitest';
import { buildReplaySnapshot, isSameReplayPoint } from '../replaySnapshot';

const seatStates = () =>
  new Map([
    [3, { lastAction: 'CALL', hasFolded: false, totalBet: 40 }],
    [5, { lastAction: 'FOLD', hasFolded: true, totalBet: 10 }],
    [7, { lastAction: 'BET', hasFolded: false, totalBet: 80 }],
  ]);

const replayState = (overrides = {}) => ({
  currentActionIndex: 8,
  currentStreet: 'turn',
  communityCardsAtPoint: ['A♥', 'J♠', 'T♣', '8♦'],
  potAtPoint: 240,
  currentActionEntry: { seat: 7, action: 'BET', amount: 80, street: 'turn' },
  visibleActions: [{}, {}, {}],
  seatStates: seatStates(),
  timelineLength: 14,
  ...overrides,
});

const hand = (overrides = {}) => ({
  gameState: { mySeat: 3 },
  cardState: { allPlayerCards: { 3: ['K♠', 'Q♠'] } },
  ...overrides,
});

describe('buildReplaySnapshot — cursor binding', () => {
  it('captures where in the hand the words were spoken', () => {
    const snap = buildReplaySnapshot(replayState(), hand());
    expect(snap.street).toBe('turn');
    expect(snap.actionIndex).toBe(8);
    expect(snap.timelineLength).toBe(14);
  });

  it('captures the board visible at that point', () => {
    const snap = buildReplaySnapshot(replayState(), hand());
    expect(snap.board).toEqual(['A♥', 'J♠', 'T♣', '8♦']);
  });

  it('copies the board rather than aliasing the source array', () => {
    const rs = replayState();
    const snap = buildReplaySnapshot(rs, hand());
    rs.communityCardsAtPoint.push('2♣');
    expect(snap.board).toHaveLength(4);
  });

  it('captures pot at that point', () => {
    expect(buildReplaySnapshot(replayState(), hand()).pot).toBe(240);
  });

  it('captures the immediate action context', () => {
    const snap = buildReplaySnapshot(replayState(), hand());
    expect(snap.currentAction).toEqual({ seat: 7, action: 'BET', amount: 80, street: 'turn' });
  });
});

describe('buildReplaySnapshot — never infers untracked fields', () => {
  it('returns null stacks — per-seat stacks are not tracked in the live cash path', () => {
    expect(buildReplaySnapshot(replayState(), hand()).stacks).toBeNull();
  });

  it('returns null spr — derived from stacks, so equally unavailable', () => {
    expect(buildReplaySnapshot(replayState(), hand()).spr).toBeNull();
  });

  it('returns null heroCards when only one hole card is entered (no partial hands)', () => {
    const h = hand({ cardState: { allPlayerCards: { 3: ['K♠', ''] } } });
    expect(buildReplaySnapshot(replayState(), h).heroCards).toBeNull();
  });

  it('returns null heroCards when the hero seat is unknown', () => {
    const h = hand({ gameState: { mySeat: null } });
    expect(buildReplaySnapshot(replayState(), h).heroCards).toBeNull();
  });

  it('returns hero cards when both slots are filled', () => {
    expect(buildReplaySnapshot(replayState(), hand()).heroCards).toEqual(['K♠', 'Q♠']);
  });
});

describe('buildReplaySnapshot — seat serialization', () => {
  it('excludes folded seats from seatsLive', () => {
    const snap = buildReplaySnapshot(replayState(), hand());
    expect(snap.seatsLive).toEqual([3, 7]);
    expect(snap.playersLive).toBe(2);
  });

  it('serializes the seatStates Map to a plain object (IDB-safe)', () => {
    const snap = buildReplaySnapshot(replayState(), hand());
    expect(snap.seats).toEqual({
      3: { lastAction: 'CALL', hasFolded: false, totalBet: 40 },
      5: { lastAction: 'FOLD', hasFolded: true, totalBet: 10 },
      7: { lastAction: 'BET', hasFolded: false, totalBet: 80 },
    });
  });

  it('produces a JSON-serializable snapshot with no Map/Set/undefined', () => {
    const snap = buildReplaySnapshot(replayState(), hand());
    expect(() => JSON.stringify(snap)).not.toThrow();
    const round = JSON.parse(JSON.stringify(snap));
    expect(round.seatsLive).toEqual([3, 7]);
    expect(round.stacks).toBeNull();
  });
});

describe('buildReplaySnapshot — degenerate inputs', () => {
  it('survives an empty replay state', () => {
    const snap = buildReplaySnapshot({}, null);
    expect(snap.street).toBe('preflop');
    expect(snap.actionIndex).toBe(-1);
    expect(snap.board).toEqual([]);
    expect(snap.seatsLive).toEqual([]);
    expect(snap.currentAction).toBeNull();
  });

  it('survives no arguments at all', () => {
    expect(() => buildReplaySnapshot()).not.toThrow();
  });

  it('survives a missing seatStates Map', () => {
    const snap = buildReplaySnapshot(replayState({ seatStates: null }), hand());
    expect(snap.seats).toEqual({});
    expect(snap.seatsLive).toEqual([]);
  });
});

describe('isSameReplayPoint', () => {
  it('is true for the same cursor', () => {
    const a = buildReplaySnapshot(replayState(), hand());
    const b = buildReplaySnapshot(replayState(), hand());
    expect(isSameReplayPoint(a, b)).toBe(true);
  });

  it('is false after stepping to a new action', () => {
    const a = buildReplaySnapshot(replayState(), hand());
    const b = buildReplaySnapshot(replayState({ currentActionIndex: 9 }), hand());
    expect(isSameReplayPoint(a, b)).toBe(false);
  });

  it('is false across a street change', () => {
    const a = buildReplaySnapshot(replayState(), hand());
    const b = buildReplaySnapshot(replayState({ currentStreet: 'river' }), hand());
    expect(isSameReplayPoint(a, b)).toBe(false);
  });

  it('handles nulls', () => {
    expect(isSameReplayPoint(null, null)).toBe(true);
    expect(isSameReplayPoint(null, {})).toBe(false);
  });
});
