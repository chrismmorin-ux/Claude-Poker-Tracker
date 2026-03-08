import { describe, it, expect } from 'vitest';
import { analyzeDecisionPoint, getAvailableStreets } from '../handReviewAnalyzer';

// Helper to build a timeline entry
const entry = (order, seat, action, street) => ({ order, seat: String(seat), action, street });

// Minimal hand record
const makeHand = (overrides = {}) => ({
  gameState: {
    dealerButtonSeat: 5,
    mySeat: 3,
    actionSequence: [],
    ...overrides.gameState,
  },
  seatPlayers: { 3: 100, 7: 200, 1: 300, ...overrides.seatPlayers },
  cardState: { communityCards: ['', '', '', '', ''], ...overrides.cardState },
  ...overrides,
});

describe('getAvailableStreets', () => {
  it('returns empty for empty timeline', () => {
    expect(getAvailableStreets([])).toEqual([]);
  });

  it('returns only streets present in timeline', () => {
    const timeline = [
      entry(1, 3, 'raise', 'preflop'),
      entry(2, 7, 'call', 'preflop'),
      entry(3, 3, 'bet', 'flop'),
    ];
    expect(getAvailableStreets(timeline)).toEqual(['preflop', 'flop']);
  });

  it('returns all four streets when present', () => {
    const timeline = [
      entry(1, 3, 'raise', 'preflop'),
      entry(2, 3, 'bet', 'flop'),
      entry(3, 3, 'bet', 'turn'),
      entry(4, 3, 'bet', 'river'),
    ];
    expect(getAvailableStreets(timeline)).toEqual(['preflop', 'flop', 'turn', 'river']);
  });
});

describe('analyzeDecisionPoint', () => {
  it('returns null when no focused action', () => {
    const result = analyzeDecisionPoint({
      timeline: [], focusedAction: null, heroSeat: 3,
      hand: makeHand(), tendencyMap: {}, boardCards: [],
    });
    expect(result).toBeNull();
  });

  it('returns situation description for a preflop action', () => {
    const timeline = [
      entry(1, 7, 'raise', 'preflop'),
      entry(2, 3, 'call', 'preflop'),
    ];
    const result = analyzeDecisionPoint({
      timeline,
      focusedAction: timeline[1], // Hero calls
      heroSeat: 3,
      hand: makeHand(),
      tendencyMap: {},
      boardCards: ['', '', '', '', ''],
    });

    expect(result).not.toBeNull();
    expect(result.situation).toContain('Preflop');
    expect(result.situation).toContain('Hero');
  });

  it('detects calling tight raiser', () => {
    const timeline = [
      entry(1, 7, 'raise', 'preflop'),
      entry(2, 3, 'call', 'preflop'),
    ];
    const tendencyMap = {
      200: { vpip: 12, pfr: 10, af: 2.0, threeBet: 3, style: 'Nit', name: 'Nit Guy' },
    };
    const result = analyzeDecisionPoint({
      timeline,
      focusedAction: timeline[1],
      heroSeat: 3,
      hand: makeHand(),
      tendencyMap,
      boardCards: ['', '', '', '', ''],
    });

    expect(result.observations.some(o => o.id === 'calling-tight-raiser')).toBe(true);
    expect(result.mistakeFlag).not.toBeNull();
  });

  it('detects limping in position', () => {
    // Hero is seat 3, button is seat 5
    // Seat 3 relative to button 5: offset = (3-5+9)%9 = 7 => HJ
    // Actually let's set button=2 so seat 3 is SB (offset=1). No — we want late position.
    // Button=4: seat 3 offset = (3-4+9)%9 = 8 => CO. Good.
    const hand = makeHand({ gameState: { dealerButtonSeat: 4, mySeat: 3 } });
    const timeline = [
      entry(1, 3, 'call', 'preflop'), // Hero limps from CO
    ];
    const result = analyzeDecisionPoint({
      timeline,
      focusedAction: timeline[0],
      heroSeat: 3,
      hand,
      tendencyMap: {},
      boardCards: ['', '', '', '', ''],
    });

    expect(result.observations.some(o => o.id === 'limp-in-position')).toBe(true);
  });

  it('detects bluffing a station postflop', () => {
    const timeline = [
      entry(1, 7, 'call', 'preflop'),
      entry(2, 3, 'raise', 'preflop'),
      entry(3, 3, 'bet', 'flop'),
      entry(4, 7, 'call', 'flop'),
    ];
    const tendencyMap = {
      200: { vpip: 55, pfr: 5, af: 0.8, style: 'Fish', name: 'Fishy' },
    };
    const hand = makeHand({
      cardState: { communityCards: ['A♠', 'K♦', '7♣', '', ''] },
    });
    const result = analyzeDecisionPoint({
      timeline,
      focusedAction: timeline[2], // Hero bets flop
      heroSeat: 3,
      hand,
      tendencyMap,
      boardCards: ['A♠', 'K♦', '7♣', '', ''],
    });

    expect(result.observations.some(o => o.id === 'bluffing-station')).toBe(true);
  });

  it('includes board texture for postflop actions', () => {
    const timeline = [
      entry(1, 3, 'bet', 'flop'),
    ];
    const result = analyzeDecisionPoint({
      timeline,
      focusedAction: timeline[0],
      heroSeat: 3,
      hand: makeHand(),
      tendencyMap: {},
      boardCards: ['A♠', 'K♦', '7♣', '', ''],
    });

    expect(result.boardDescription).not.toBeNull();
    expect(result.boardDescription.length).toBeGreaterThan(0);
  });

  it('includes position note for postflop actions with villain', () => {
    const timeline = [
      entry(1, 7, 'bet', 'flop'),
      entry(2, 3, 'call', 'flop'),
    ];
    const result = analyzeDecisionPoint({
      timeline,
      focusedAction: timeline[1],
      heroSeat: 3,
      hand: makeHand(),
      tendencyMap: {},
      boardCards: ['A♠', 'K♦', '7♣', '', ''],
    });

    expect(result.positionNote).not.toBeNull();
    expect(result.positionNote).toMatch(/IP|OOP/);
  });

  it('includes villain profile when stats available', () => {
    const timeline = [
      entry(1, 7, 'raise', 'preflop'),
      entry(2, 3, 'call', 'preflop'),
    ];
    const tendencyMap = {
      200: { vpip: 25, pfr: 18, af: 2.5, style: 'TAG', name: 'TAG Player' },
    };
    const result = analyzeDecisionPoint({
      timeline,
      focusedAction: timeline[1],
      heroSeat: 3,
      hand: makeHand(),
      tendencyMap,
      boardCards: ['', '', '', '', ''],
    });

    expect(result.villainProfile).toContain('VPIP 25%');
    expect(result.villainProfile).toContain('TAG');
  });

  it('returns no observations for neutral action', () => {
    // Hero raises from EP — no special flags
    const hand = makeHand({ gameState: { dealerButtonSeat: 1, mySeat: 3 } });
    // Seat 3, button 1: offset = (3-1+9)%9 = 2 => BB. Let's use seat 5, button 1 => offset 4 => UTG+1
    const hand2 = makeHand({ gameState: { dealerButtonSeat: 1, mySeat: 5 } });
    const timeline = [
      entry(1, 5, 'raise', 'preflop'),
    ];
    const result = analyzeDecisionPoint({
      timeline,
      focusedAction: timeline[0],
      heroSeat: 5,
      hand: hand2,
      tendencyMap: {},
      boardCards: ['', '', '', '', ''],
    });

    expect(result.observations).toEqual([]);
    expect(result.mistakeFlag).toBeNull();
  });

  it('detects missed value bet vs passive villain', () => {
    const timeline = [
      entry(1, 7, 'check', 'flop'),
      entry(2, 3, 'check', 'flop'),
    ];
    const tendencyMap = {
      200: { vpip: 45, pfr: 5, af: 0.5, style: 'Fish', name: 'Passive Fish' },
    };
    const hand = makeHand({
      cardState: { communityCards: ['A♠', '7♦', '2♣', '', ''] },
    });
    const result = analyzeDecisionPoint({
      timeline,
      focusedAction: timeline[0],
      heroSeat: 3,
      hand,
      tendencyMap,
      boardCards: ['A♠', '7♦', '2♣', '', ''],
    });

    expect(result.observations.some(o => o.id === 'missed-value')).toBe(true);
  });
});
