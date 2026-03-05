import { describe, it, expect } from 'vitest';
import { extractSubAction, extractAllSubActions } from '../subActionExtractor';

// Helper to build a hand with actionSequence
const makeHand = (playerId, seat, dealerSeat, actions, cards = null) => {
  const seatPlayers = { [String(seat)]: String(playerId) };
  const hand = {
    handId: `test-${Date.now()}-${Math.random()}`,
    seatPlayers,
    gameState: {
      dealerButtonSeat: dealerSeat,
      actionSequence: actions.map((a, i) => ({
        order: i + 1,
        seat: String(a.seat),
        action: a.action,
        street: 'preflop',
      })),
    },
    cardState: {},
  };
  if (cards) {
    hand.cardState.allPlayerCards = { [String(seat)]: cards };
  }
  return hand;
};

describe('extractSubAction', () => {
  it('returns null when player did not limp', () => {
    const hand = makeHand(1, 3, 1, [
      { seat: 3, action: 'raise' }, // open raise, not a limp
    ]);
    expect(extractSubAction(1, hand)).toBeNull();
  });

  it('returns null when player cold-called (faced raise before calling)', () => {
    const hand = makeHand(1, 5, 1, [
      { seat: 3, action: 'raise' }, // someone opens
      { seat: 5, action: 'call' },  // player calls = cold call, not limp
    ]);
    expect(extractSubAction(1, hand)).toBeNull();
  });

  it('detects limpNoRaise when no one raises after limp', () => {
    const hand = makeHand(1, 3, 1, [
      { seat: 3, action: 'call' }, // limp
      { seat: 4, action: 'call' }, // another limper
      { seat: 5, action: 'call' }, // another limper
    ]);
    const result = extractSubAction(1, hand);
    expect(result).not.toBeNull();
    expect(result.subAction).toBe('limpNoRaise');
    expect(result.position).toBeDefined();
  });

  it('detects limpFold when player limps then folds to raise', () => {
    const hand = makeHand(1, 3, 1, [
      { seat: 3, action: 'call' },  // limp
      { seat: 5, action: 'raise' }, // someone raises
      { seat: 3, action: 'fold' },  // player folds
    ]);
    const result = extractSubAction(1, hand);
    expect(result).not.toBeNull();
    expect(result.subAction).toBe('limpFold');
  });

  it('detects limpCall when player limps then calls a raise', () => {
    const hand = makeHand(1, 3, 1, [
      { seat: 3, action: 'call' },  // limp
      { seat: 5, action: 'raise' }, // someone raises
      { seat: 3, action: 'call' },  // player calls
    ]);
    const result = extractSubAction(1, hand);
    expect(result).not.toBeNull();
    expect(result.subAction).toBe('limpCall');
  });

  it('detects limpRaise (limp-reraise trap)', () => {
    const hand = makeHand(1, 3, 1, [
      { seat: 3, action: 'call' },  // limp
      { seat: 5, action: 'raise' }, // someone raises
      { seat: 3, action: 'raise' }, // player re-raises!
    ]);
    const result = extractSubAction(1, hand);
    expect(result).not.toBeNull();
    expect(result.subAction).toBe('limpRaise');
  });

  it('treats missing second action as limpFold', () => {
    const hand = makeHand(1, 3, 1, [
      { seat: 3, action: 'call' },  // limp
      { seat: 5, action: 'raise' }, // someone raises
      // no second action from player
    ]);
    const result = extractSubAction(1, hand);
    expect(result).not.toBeNull();
    expect(result.subAction).toBe('limpFold');
  });

  it('returns null when player is not in the hand', () => {
    const hand = makeHand(1, 3, 1, [
      { seat: 4, action: 'call' },
    ]);
    expect(extractSubAction(99, hand)).toBeNull();
  });

  it('includes showdown index when cards are available', () => {
    const hand = makeHand(1, 3, 1, [
      { seat: 3, action: 'call' },
    ], ['A♥', 'K♥']);
    const result = extractSubAction(1, hand);
    expect(result).not.toBeNull();
    expect(result.subAction).toBe('limpNoRaise');
    expect(result.showdownIndex).toBeTypeOf('number');
    expect(result.showdownIndex).toBeGreaterThanOrEqual(0);
    expect(result.showdownIndex).toBeLessThan(169);
  });
});

describe('extractAllSubActions', () => {
  it('returns only hands where player limped', () => {
    const hands = [
      // Hand 1: player limps
      makeHand(1, 3, 1, [
        { seat: 3, action: 'call' },
        { seat: 5, action: 'raise' },
        { seat: 3, action: 'fold' },
      ]),
      // Hand 2: player opens (no limp)
      makeHand(1, 3, 1, [
        { seat: 3, action: 'raise' },
      ]),
      // Hand 3: player limps again
      makeHand(1, 3, 1, [
        { seat: 3, action: 'call' },
      ]),
    ];
    const results = extractAllSubActions(1, hands);
    expect(results).toHaveLength(2);
    expect(results[0].subAction).toBe('limpFold');
    expect(results[1].subAction).toBe('limpNoRaise');
  });

  it('returns empty array when player never limps', () => {
    const hands = [
      makeHand(1, 3, 1, [{ seat: 3, action: 'raise' }]),
      makeHand(1, 3, 1, [{ seat: 3, action: 'fold' }]),
    ];
    expect(extractAllSubActions(1, hands)).toHaveLength(0);
  });
});
