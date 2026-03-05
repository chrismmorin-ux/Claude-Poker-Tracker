import { describe, it, expect } from 'vitest';
import { buildSessionStats } from '../sessionStats';

const makeHand = (handId, seatPlayers, seatActions) => ({
  handId,
  sessionId: 'session-1',
  seatPlayers,
  gameState: {
    currentStreet: 'showdown',
    dealerButtonSeat: 1,
    mySeat: 5,
    seatActions,
    absentSeats: [],
  },
});

describe('buildSessionStats', () => {
  it('returns empty object for no hands', () => {
    expect(buildSessionStats([], { 1: 'p1' })).toEqual({});
  });

  it('returns empty object for null inputs', () => {
    expect(buildSessionStats(null, null)).toEqual({});
  });

  it('computes stats for a seat with a player who raised preflop', () => {
    const hands = [
      makeHand('h1', { '1': 'p1', '2': 'p2' }, {
        preflop: { '1': ['raise'], '2': ['call'] },
      }),
    ];
    const seatPlayers = { '1': 'p1', '2': 'p2' };
    const result = buildSessionStats(hands, seatPlayers);

    expect(result['1']).toBeDefined();
    expect(result['1'].vpip).toBe(100);
    expect(result['1'].pfr).toBe(100);
    expect(result['1'].handCount).toBe(1);

    expect(result['2']).toBeDefined();
    expect(result['2'].vpip).toBe(100);
    expect(result['2'].pfr).toBe(0);
  });

  it('skips seats with no playerId', () => {
    const hands = [
      makeHand('h1', { '1': 'p1' }, {
        preflop: { '1': ['call'] },
      }),
    ];
    const seatPlayers = { '1': 'p1', '2': null };
    const result = buildSessionStats(hands, seatPlayers);

    expect(result['1']).toBeDefined();
    expect(result['2']).toBeUndefined();
  });

  it('computes limp percentage', () => {
    const hands = [
      makeHand('h1', { '1': 'p1', '2': 'p2' }, {
        preflop: { '1': ['call'], '2': ['fold'] },
      }),
      makeHand('h2', { '1': 'p1', '2': 'p2' }, {
        preflop: { '1': ['raise'], '2': ['fold'] },
      }),
    ];
    const seatPlayers = { '1': 'p1' };
    const result = buildSessionStats(hands, seatPlayers);

    // 1 limp out of 2 opportunities = 50%
    expect(result['1'].limpPct).toBe(50);
  });

  it('returns null limpPct when no limp opportunities', () => {
    const hands = [
      makeHand('h1', { '3': 'p3' }, {
        preflop: {},
      }),
    ];
    const seatPlayers = { '3': 'p3' };
    const result = buildSessionStats(hands, seatPlayers);

    expect(result['3'].limpPct).toBeNull();
  });
});
