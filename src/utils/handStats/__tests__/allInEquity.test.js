/**
 * allInEquity.test.js — all-in EV adjustment.
 *
 * The adjustment's whole value rests on it being symmetric: it must correct
 * hero's suckouts exactly as hard as hero's bad beats. Several tests below check
 * that directly by running the same matchup with the winner swapped.
 *
 * Every ineligibility path is asserted by NAME rather than by "returns falsy",
 * because a silent null would make "couldn't compute" indistinguishable from
 * "nothing to correct" and the coverage count would lie.
 */

import { describe, it, expect } from 'vitest';
// Suits in this codebase are the unicode glyphs from gameConstants.SUITS
// (♠♥♦♣), not letters — fixtures must use them or nothing parses.
import {
  computeAllInAdjustment,
  computeSessionAdjustment,
  contestingSeats,
  findAllInEntry,
  toHandClass,
  INELIGIBLE,
} from '../allInEquity';
import { parseAndEncode } from '../../pokerCore/cardParser';
import { exactComboEquity } from '../../pokerCore/monteCarloEquity';

/**
 * A heads-up hand where hero (seat 5) and villain (seat 3) get it in on the flop.
 *
 * Pot is built purely from the action amounts so the expected numbers can be
 * worked by hand: villain bets 500 all-in, hero calls 500 → 1000 plus blinds.
 */
const handInOnFlop = ({
  heroCards = ['A♥', 'A♦'],
  villainCards = ['K♥', 'K♦'],
  board = ['7♣', '2♦', '9♠', '4♥', 'J♣'],
  street = 'flop',
} = {}) => ({
  gameState: {
    mySeat: 5,
    currentStreet: 'river',
    actionSequence: [
      { seat: 3, action: 'bet', street, order: 1, amount: 500, allIn: true },
      { seat: 5, action: 'call', street, order: 2, amount: 500 },
    ],
  },
  cardState: {
    communityCards: board,
    holeCards: heroCards,
    allPlayerCards: { 3: villainCards },
  },
});

describe('toHandClass', () => {
  const enc = (s) => parseAndEncode(s);
  it('names pairs, suited and offsuit holdings', () => {
    expect(toHandClass([enc('A♥'), enc('A♦')])).toBe('AA');
    expect(toHandClass([enc('A♥'), enc('K♥')])).toBe('AKs');
    expect(toHandClass([enc('A♥'), enc('K♦')])).toBe('AKo');
    expect(toHandClass([enc('9♣'), enc('T♠')])).toBe('T9o');
  });

  it('returns null for anything that is not two cards', () => {
    expect(toHandClass([enc('A♥')])).toBeNull();
    expect(toHandClass(null)).toBeNull();
  });
});

describe('contestingSeats', () => {
  it('drops any seat that folded, whenever it folded', () => {
    const seq = [
      { seat: 1, action: 'raise', street: 'preflop', order: 1 },
      { seat: 2, action: 'fold', street: 'preflop', order: 2 },
      { seat: 5, action: 'call', street: 'preflop', order: 3 },
      // A fold AFTER the shove still means that seat is not contesting it.
      { seat: 1, action: 'fold', street: 'flop', order: 4 },
    ];
    expect([...contestingSeats(seq)].sort()).toEqual([5]);
  });

  it('treats a muck as out', () => {
    const seq = [
      { seat: 3, action: 'call', street: 'preflop', order: 1 },
      { seat: 3, action: 'mucked', street: 'showdown', order: 2 },
      { seat: 5, action: 'call', street: 'preflop', order: 3 },
    ];
    expect([...contestingSeats(seq)]).toEqual([5]);
  });
});

describe('findAllInEntry', () => {
  it('finds the first committed-stack entry', () => {
    const seq = [
      { seat: 1, action: 'bet', street: 'flop', order: 1 },
      { seat: 3, action: 'raise', street: 'flop', order: 2, allIn: true },
      { seat: 5, action: 'call', street: 'flop', order: 3, allIn: true },
    ];
    expect(findAllInEntry(seq).seat).toBe(3);
  });

  it('returns null when nobody was all-in', () => {
    expect(findAllInEntry([{ seat: 1, action: 'bet', street: 'flop', order: 1 }])).toBeNull();
  });
});

describe('computeAllInAdjustment — eligibility', () => {
  const reasonFor = (hand) => computeAllInAdjustment(hand).reason;

  it('needs an all-in', () => {
    const hand = handInOnFlop();
    hand.gameState.actionSequence = hand.gameState.actionSequence.map(
      ({ allIn, ...rest }) => rest
    );
    expect(reasonFor(hand)).toBe(INELIGIBLE.NO_ALL_IN);
  });

  it('declines when hero folded', () => {
    const hand = handInOnFlop();
    hand.gameState.actionSequence.push({ seat: 5, action: 'fold', street: 'flop', order: 3 });
    expect(reasonFor(hand)).toBe(INELIGIBLE.HERO_FOLDED);
  });

  it('declines when hero never entered the hand', () => {
    const hand = handInOnFlop();
    hand.gameState.mySeat = 9;
    expect(reasonFor(hand)).toBe(INELIGIBLE.HERO_NOT_IN);
  });

  it('declines a multiway all-in rather than guessing at side pots', () => {
    const hand = handInOnFlop();
    hand.gameState.actionSequence.push({ seat: 7, action: 'call', street: 'flop', order: 3 });
    expect(reasonFor(hand)).toBe(INELIGIBLE.MULTIWAY);
  });

  it('declines when the villain never showed', () => {
    const hand = handInOnFlop();
    hand.cardState.allPlayerCards = {};
    expect(reasonFor(hand)).toBe(INELIGIBLE.VILLAIN_CARDS_UNKNOWN);
  });

  it('declines when hero cards are missing', () => {
    const hand = handInOnFlop();
    hand.cardState.holeCards = ['', ''];
    expect(reasonFor(hand)).toBe(INELIGIBLE.HERO_CARDS_UNKNOWN);
  });

  it('declines when the board never ran out', () => {
    const hand = handInOnFlop({ board: ['7♣', '2♦', '9♠'] });
    expect(reasonFor(hand)).toBe(INELIGIBLE.BOARD_INCOMPLETE);
  });

  it('declines an impossible matchup instead of scoring it zero', () => {
    // Villain holding a card already on the board is bad data, not a 0% spot.
    const hand = handInOnFlop({ villainCards: ['7♣', 'K♦'] });
    expect(reasonFor(hand)).toBe(INELIGIBLE.BAD_CARDS);
  });

  it('contributes no delta whenever it is ineligible', () => {
    const hand = handInOnFlop({ board: ['7♣', '2♦', '9♠'] });
    expect(computeAllInAdjustment(hand).delta).toBe(0);
  });
});

describe('computeAllInAdjustment — the arithmetic', () => {
  it('uses the board as it stood at the all-in, not the finished board', () => {
    // AA vs KK all-in on 7c2d9s. Equity must be computed on the 3-card flop.
    const hand = handInOnFlop();
    const result = computeAllInAdjustment(hand, { gameType: '1/3' });
    const expected = exactComboEquity(
      ['A♥', 'A♦'].map(parseAndEncode),
      ['K♥', 'K♦'].map(parseAndEncode),
      ['7♣', '2♦', '9♠'].map(parseAndEncode)
    );
    expect(result.eligible).toBe(true);
    expect(result.equity).toBeCloseTo(expected, 10);
    expect(result.equitySource).toBe('exact');
    expect(result.street).toBe('flop');
  });

  it('computes delta as (equity − realized) × pot', () => {
    const hand = handInOnFlop();
    const r = computeAllInAdjustment(hand, { gameType: '1/3' });
    expect(r.delta).toBeCloseTo((r.equity - r.realizedShare) * r.pot, 8);
  });

  it('reads a win as realized share 1 and a loss as 0', () => {
    // AA holds on a blank board → hero wins.
    const won = computeAllInAdjustment(handInOnFlop(), { gameType: '1/3' });
    expect(won.realizedShare).toBe(1);
    // Same spot, but villain rivers a king.
    const lost = computeAllInAdjustment(
      handInOnFlop({ board: ['7♣', '2♦', '9♠', '4♥', 'K♠'] }),
      { gameType: '1/3' }
    );
    expect(lost.realizedShare).toBe(0);
  });

  it('penalises a hero suckout as hard as it credits a hero bad beat', () => {
    // The whole point of doing this mechanically. Same matchup, opposite runouts.
    const heroWins = computeAllInAdjustment(handInOnFlop(), { gameType: '1/3' });
    const heroLoses = computeAllInAdjustment(
      handInOnFlop({ board: ['7♣', '2♦', '9♠', '4♥', 'K♠'] }),
      { gameType: '1/3' }
    );
    // Winning as the favourite gives back a little; losing as the favourite
    // credits a lot. Signs must be opposite.
    expect(heroWins.delta).toBeLessThan(0);
    expect(heroLoses.delta).toBeGreaterThan(0);
  });

  it('credits the underdog who lost, rather than only the favourite', () => {
    // Hero is behind with KK vs AA and loses — expected, so almost no correction
    // in hero's favour; the delta is small and positive (hero had some equity).
    const r = computeAllInAdjustment(
      handInOnFlop({ heroCards: ['K♥', 'K♦'], villainCards: ['A♥', 'A♦'] }),
      { gameType: '1/3' }
    );
    expect(r.realizedShare).toBe(0);
    expect(r.delta).toBeGreaterThan(0);
    expect(r.delta).toBeLessThan(r.pot * 0.25);
  });

  it('returns a zero-ish delta on a chop, and share 0.5', () => {
    // Both play the board: identical straights.
    const r = computeAllInAdjustment(
      handInOnFlop({
        heroCards: ['2♥', '3♦'],
        villainCards: ['2♣', '3♠'],
        board: ['T♠', 'J♥', 'Q♦', 'K♣', 'A♣'],
        street: 'river',
      }),
      { gameType: '1/3' }
    );
    expect(r.realizedShare).toBe(0.5);
    // Equity was also 0.5 at the river with the board already out.
    expect(r.delta).toBeCloseTo(0, 8);
  });

  it('marks a preflop shove as class-level, not exact', () => {
    const hand = handInOnFlop({ street: 'preflop' });
    const r = computeAllInAdjustment(hand, { gameType: '1/3' });
    expect(r.eligible).toBe(true);
    expect(r.equitySource).toBe('preflop-class');
    // AA vs KK preflop is roughly 80/20.
    expect(r.equity).toBeGreaterThan(0.78);
    expect(r.equity).toBeLessThan(0.84);
  });

  it('shrinks the pot by the rake when a rake config is supplied', () => {
    const hand = handInOnFlop();
    const raw = computeAllInAdjustment(hand, { gameType: '1/3' });
    const raked = computeAllInAdjustment(hand, {
      gameType: '1/3',
      rakeConfig: { pct: 0.1, cap: 10, noFlopNoDrop: true },
    });
    expect(raked.pot).toBeLessThan(raw.pot);
    expect(Math.abs(raked.delta)).toBeLessThan(Math.abs(raw.delta));
  });

  it('is stamped modelled', () => {
    expect(computeAllInAdjustment(handInOnFlop(), { gameType: '1/3' }).modelled).toBe(true);
  });

  it('survives a malformed hand record without throwing', () => {
    expect(computeAllInAdjustment(null).eligible).toBe(false);
    expect(computeAllInAdjustment({}).eligible).toBe(false);
    expect(computeAllInAdjustment({ gameState: {} }).eligible).toBe(false);
  });
});

describe('computeSessionAdjustment', () => {
  it('sums deltas and counts what it covered', () => {
    const hands = [
      handInOnFlop(),
      handInOnFlop({ board: ['7♣', '2♦', '9♠', '4♥', 'K♠'] }),
      handInOnFlop({ board: ['7♣', '2♦', '9♠'] }),  // never ran out
    ];
    const r = computeSessionAdjustment(hands, { gameType: '1/3' });
    expect(r.totalHands).toBe(3);
    expect(r.adjustedHands).toBe(2);
    expect(r.reasons[INELIGIBLE.BOARD_INCOMPLETE]).toBe(1);
    expect(r.modelled).toBe(true);
  });

  it('reports zero coverage rather than pretending on a session with no all-ins', () => {
    const plain = handInOnFlop();
    plain.gameState.actionSequence = plain.gameState.actionSequence.map(
      ({ allIn, ...rest }) => rest
    );
    const r = computeSessionAdjustment([plain, plain], { gameType: '1/3' });
    expect(r.adjustedHands).toBe(0);
    expect(r.delta).toBe(0);
    expect(r.reasons[INELIGIBLE.NO_ALL_IN]).toBe(2);
  });

  it('handles an empty hand list', () => {
    expect(computeSessionAdjustment([])).toEqual({
      delta: 0, adjustedHands: 0, totalHands: 0, reasons: {}, modelled: true,
    });
  });
});
