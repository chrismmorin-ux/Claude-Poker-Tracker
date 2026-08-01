/**
 * handReviewSnapshot.test.js — VRN state binding on the Hand Review walkthrough.
 *
 * The distinguishing concern versus the replay sibling: this surface steps
 * STREET-by-street, so "the pot" is ambiguous unless the snapshot says what the
 * number is conditioned on. Every snapshot carries `potBasis`, and these tests
 * pin that it is correct in both modes.
 *
 * Same binding rule as the sibling: untracked fields are null, never inferred.
 *
 * Surface spec: docs/design/surfaces/voice-reasoning-notes.md
 */

import { describe, it, expect } from 'vitest';
import { buildHandReviewSnapshot, isSameReviewPoint, potFromEntries } from '../handReviewSnapshot';

// preflop: 20 in, flop: 60 in, turn: 100 in
const timeline = () => [
  { seat: 3, action: 'CALL', amount: 10, street: 'preflop' },
  { seat: 5, action: 'CALL', amount: 10, street: 'preflop' },
  { seat: 3, action: 'BET', amount: 20, street: 'flop' },
  { seat: 5, action: 'CALL', amount: 20, street: 'flop' },
  { seat: 7, action: 'CALL', amount: 20, street: 'flop' },
  { seat: 3, action: 'BET', amount: 50, street: 'turn' },
  { seat: 5, action: 'CALL', amount: 50, street: 'turn' },
];

const hand = (overrides = {}) => ({
  gameState: { mySeat: 3, blindsPosted: { sb: 1, bb: 2 } },
  cardState: { allPlayerCards: { 3: ['K♠', 'Q♠'] } },
  ...overrides,
});

const reviewState = (overrides = {}) => ({
  currentStreet: 'turn',
  availableStreets: ['preflop', 'flop', 'turn', 'river'],
  timeline: timeline(),
  streetActions: [timeline()[5], timeline()[6]],
  communityCardsForStreet: ['A♥', 'J♠', 'T♣', '8♦'],
  focusedAction: null,
  focusedActionIndex: null,
  heroSeat: 3,
  ...overrides,
});

describe('potFromEntries', () => {
  it('sums blinds plus the amounts in scope (mirrors useReplayState potAtPoint)', () => {
    expect(potFromEntries(timeline().slice(0, 2), hand())).toBe(3 + 20);
  });

  it('returns just the blinds for an empty scope', () => {
    expect(potFromEntries([], hand())).toBe(3);
  });

  it('returns 0 when no blinds were recorded', () => {
    expect(potFromEntries([], { gameState: {} })).toBe(0);
  });
});

describe('buildHandReviewSnapshot — pot carries its conditional', () => {
  it('with no action focused, pot is the street-start pot and says so', () => {
    const snap = buildHandReviewSnapshot(reviewState(), hand());
    // blinds 3 + preflop 20 + flop 60 = 83; turn action NOT counted
    expect(snap.pot).toBe(83);
    expect(snap.potBasis).toBe('street-start');
  });

  it('with an action focused, pot is exact through that action and says so', () => {
    const snap = buildHandReviewSnapshot(
      reviewState({ focusedActionIndex: 5, focusedAction: timeline()[5] }),
      hand(),
    );
    // blinds 3 + preflop 20 + flop 60 + the focused turn bet 50 = 133
    expect(snap.pot).toBe(133);
    expect(snap.potBasis).toBe('action');
  });

  it('street-start pot on the first street is just the blinds', () => {
    const snap = buildHandReviewSnapshot(reviewState({ currentStreet: 'preflop' }), hand());
    expect(snap.pot).toBe(3);
    expect(snap.potBasis).toBe('street-start');
  });

  it('never reports a pot without a basis', () => {
    const withFocus = buildHandReviewSnapshot(
      reviewState({ focusedActionIndex: 2, focusedAction: timeline()[2] }), hand(),
    );
    const without = buildHandReviewSnapshot(reviewState(), hand());
    expect(withFocus.potBasis).toBeTruthy();
    expect(without.potBasis).toBeTruthy();
  });
});

describe('buildHandReviewSnapshot — cursor', () => {
  it('captures the street being reviewed', () => {
    expect(buildHandReviewSnapshot(reviewState(), hand()).street).toBe('turn');
  });

  it('reports a null actionIndex when nothing is focused (street granularity)', () => {
    expect(buildHandReviewSnapshot(reviewState(), hand()).actionIndex).toBeNull();
  });

  it('reports the focused action index when one is selected', () => {
    const snap = buildHandReviewSnapshot(
      reviewState({ focusedActionIndex: 5, focusedAction: timeline()[5] }), hand(),
    );
    expect(snap.actionIndex).toBe(5);
    expect(snap.currentAction).toEqual({ seat: 3, action: 'BET', amount: 50, street: 'turn' });
  });

  it('captures the board for the street', () => {
    expect(buildHandReviewSnapshot(reviewState(), hand()).board)
      .toEqual(['A♥', 'J♠', 'T♣', '8♦']);
  });

  it('uses the surface\'s own street ordering rather than an assumed one', () => {
    // A hand that ended on the flop exposes only two streets; "prior streets"
    // must follow that list, not a hardcoded four-street order.
    const snap = buildHandReviewSnapshot(
      reviewState({ currentStreet: 'flop', availableStreets: ['preflop', 'flop'] }),
      hand(),
    );
    expect(snap.pot).toBe(23); // blinds 3 + preflop 20 only
  });
});

describe('buildHandReviewSnapshot — never infers untracked fields', () => {
  it('returns null stacks and spr', () => {
    const snap = buildHandReviewSnapshot(reviewState(), hand());
    expect(snap.stacks).toBeNull();
    expect(snap.spr).toBeNull();
  });

  it('returns null seat state — this surface does not derive per-seat running state', () => {
    const snap = buildHandReviewSnapshot(reviewState(), hand());
    expect(snap.seats).toBeNull();
    expect(snap.playersLive).toBeNull();
  });

  it('returns null heroCards on a partial hand', () => {
    const snap = buildHandReviewSnapshot(
      reviewState(), hand({ cardState: { allPlayerCards: { 3: ['K♠', ''] } } }),
    );
    expect(snap.heroCards).toBeNull();
  });

  it('returns hero cards when both are known', () => {
    expect(buildHandReviewSnapshot(reviewState(), hand()).heroCards).toEqual(['K♠', 'Q♠']);
  });
});

describe('buildHandReviewSnapshot — serialization + degenerate inputs', () => {
  it('is JSON-serializable', () => {
    const snap = buildHandReviewSnapshot(reviewState(), hand());
    expect(() => JSON.stringify(snap)).not.toThrow();
    expect(JSON.parse(JSON.stringify(snap)).potBasis).toBe('street-start');
  });

  it('survives empty input', () => {
    const snap = buildHandReviewSnapshot({}, null);
    expect(snap.street).toBe('preflop');
    expect(snap.actionIndex).toBeNull();
    expect(snap.board).toEqual([]);
    expect(snap.currentAction).toBeNull();
  });

  it('survives no arguments', () => {
    expect(() => buildHandReviewSnapshot()).not.toThrow();
  });

  it('copies the board rather than aliasing it', () => {
    const rs = reviewState();
    const snap = buildHandReviewSnapshot(rs, hand());
    rs.communityCardsForStreet.push('2♣');
    expect(snap.board).toHaveLength(4);
  });
});

describe('isSameReviewPoint', () => {
  it('is true for the same street with nothing focused', () => {
    const a = buildHandReviewSnapshot(reviewState(), hand());
    const b = buildHandReviewSnapshot(reviewState(), hand());
    expect(isSameReviewPoint(a, b)).toBe(true);
  });

  it('is false across a street change', () => {
    const a = buildHandReviewSnapshot(reviewState(), hand());
    const b = buildHandReviewSnapshot(reviewState({ currentStreet: 'flop' }), hand());
    expect(isSameReviewPoint(a, b)).toBe(false);
  });

  it('is false once an action is focused on the same street', () => {
    const a = buildHandReviewSnapshot(reviewState(), hand());
    const b = buildHandReviewSnapshot(
      reviewState({ focusedActionIndex: 5, focusedAction: timeline()[5] }), hand(),
    );
    expect(isSameReviewPoint(a, b)).toBe(false);
  });
});
