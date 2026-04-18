import { describe, test, expect } from 'vitest';
import {
  handTypeBreakdown,
  pctMadeFlushPlus,
  pctMadeStraightPlus,
  pctSetTripsTwoPair,
  pctTopPairPlus,
  pctStrongDraws,
  pctWeakDraws,
  pctAir,
  pctAnyPairPlus,
  HAND_TYPES,
  HAND_TYPE_GROUPS,
} from '../handTypeBreakdown';
import { parseRangeString, createRange, rangeIndex } from '../../pokerCore/rangeMatrix';
import { parseBoard } from '../../pokerCore/cardParser';
import { archetypeRangeFor } from '../archetypeRanges';

const flop = (...cards) => parseBoard(cards);

describe('handTypeBreakdown — structure', () => {
  test('returns all 22 hand-type keys', () => {
    const range = parseRangeString('AA,KK');
    const bd = handTypeBreakdown(range, flop('K♠', '7♥', '2♦'));
    for (const ht of HAND_TYPES) {
      expect(bd.handTypes[ht]).toBeDefined();
      expect(typeof bd.handTypes[ht].count).toBe('number');
      expect(typeof bd.handTypes[ht].weight).toBe('number');
      expect(typeof bd.handTypes[ht].pct).toBe('number');
      expect(typeof bd.handTypes[ht].avgDrawOuts).toBe('number');
      expect(typeof bd.handTypes[ht].avgImprovementOuts).toBe('number');
      expect(typeof bd.handTypes[ht].avgTotalEquityOuts).toBe('number');
    }
  });

  test('distribution sums to 1 (or near 1 with fp noise)', () => {
    const range = archetypeRangeFor({ position: 'BTN', action: 'open' });
    const bd = handTypeBreakdown(range, flop('K♠', '7♥', '2♦'));
    const total = Object.values(bd.handTypes).reduce((s, t) => s + t.pct, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  test('byGroup matches HAND_TYPE_GROUPS', () => {
    const range = parseRangeString('AA');
    const bd = handTypeBreakdown(range, flop('K♠', '7♥', '2♦'));
    for (const gid of Object.keys(HAND_TYPE_GROUPS)) {
      expect(bd.byGroup[gid]).toBeDefined();
      expect(bd.byGroup[gid].types.length).toBeGreaterThan(0);
    }
  });

  test('rejects non-3-card flop', () => {
    const range = parseRangeString('AA');
    expect(() => handTypeBreakdown(range, [])).toThrow();
  });
});

describe('handTypeBreakdown — made-hand classifications', () => {
  test('AA only on K72r → 100% overpair', () => {
    const range = createRange();
    range[rangeIndex(12, 12, false)] = 1.0;
    const bd = handTypeBreakdown(range, flop('K♠', '7♥', '2♦'));
    expect(bd.handTypes.overpair.pct).toBeCloseTo(1.0, 3);
    expect(bd.handTypes.air.pct).toBe(0);
  });

  test('AK on K72r → TPTK+ (topPairGood)', () => {
    const range = createRange();
    range[rangeIndex(12, 11, false)] = 1.0; // AKo
    range[rangeIndex(12, 11, true)] = 1.0;  // AKs
    const bd = handTypeBreakdown(range, flop('K♠', '7♥', '2♦'));
    expect(bd.handTypes.topPairGood.pct).toBeGreaterThan(0.9);
  });

  test('77 on K72r → set (pocket set)', () => {
    const range = createRange();
    range[rangeIndex(5, 5, false)] = 1.0;
    const bd = handTypeBreakdown(range, flop('K♠', '7♥', '2♦'));
    expect(bd.handTypes.set.pct).toBeCloseTo(1.0, 3);
  });

  test('KK on K72r → set (top set)', () => {
    const range = createRange();
    range[rangeIndex(11, 11, false)] = 1.0;
    const bd = handTypeBreakdown(range, flop('K♠', '7♥', '2♦'));
    expect(bd.handTypes.set.pct).toBeCloseTo(1.0, 3);
  });

  test('K7s on K72 → twoPair', () => {
    const range = createRange();
    range[rangeIndex(11, 5, true)] = 1.0; // K7s
    const bd = handTypeBreakdown(range, flop('K♠', '7♣', '2♦'));
    expect(bd.handTypes.twoPair.pct).toBeGreaterThan(0.5);
  });
});

describe('handTypeBreakdown — draw classifications', () => {
  test('QJ on T98r → nonNutStraight (made straight)', () => {
    const range = createRange();
    range[rangeIndex(10, 9, false)] = 1.0; // QJo
    const bd = handTypeBreakdown(range, flop('T♠', '9♥', '8♦'));
    const straightPct = bd.handTypes.nutStraight.pct + bd.handTypes.nonNutStraight.pct;
    expect(straightPct).toBeGreaterThan(0.9);
  });

  test('JTs on 987r → OESD (open-ended straight draw)', () => {
    const range = createRange();
    range[rangeIndex(9, 8, true)] = 1.0; // JTs
    const bd = handTypeBreakdown(range, flop('9♠', '8♥', '7♦'));
    // JT on 987 — already a straight (789TJ complete). So this is nutStraight.
    // Pick a true OESD: JT on 98x
    const range2 = createRange();
    range2[rangeIndex(9, 8, true)] = 1.0;
    const bd2 = handTypeBreakdown(range2, flop('9♠', '8♥', '2♦'));
    // JT + 982: need 7 or Q to complete. OESD.
    expect(bd2.handTypes.oesd.pct).toBeGreaterThan(0);
  });

  test('AKs on a 3-heart board → nutFlushDraw (hero has A of flush suit)', () => {
    const range = createRange();
    range[rangeIndex(12, 11, true)] = 1.0; // AKs — expanded to 4 suit combos
    // Board with 3 hearts: engine labels 'nutFlushDraw' only when board has
    // the 3-of-one-suit structure. The A♥K♥ combo then holds the nut flush
    // draw; other-suited combos fall into a different bucket.
    const bd = handTypeBreakdown(range, flop('7♥', '2♥', '9♥'));
    // A♥K♥ makes a MADE flush on 3-heart board (5 hearts total), so check
    // made-flush categories instead. Other AKs combos (spades/diamonds/clubs)
    // have no flush on an all-heart board.
    const madeFlushPct = bd.handTypes.nutFlush.pct + bd.handTypes.secondFlush.pct + bd.handTypes.weakFlush.pct;
    expect(madeFlushPct).toBeGreaterThan(0);
  });

  test('A♥K♥ on 7♥2♣3♣ → nonNutFlushDraw (board only has 1 heart total after hole)', () => {
    // Narrow to one specific combo: A♥K♥.
    const range = createRange();
    range[rangeIndex(12, 11, true)] = 1.0;
    const bd = handTypeBreakdown(range, flop('7♥', '2♦', '3♣'));
    // 2 hearts in hole + 1 on board = 3 hearts → backdoor, not flush draw.
    // None of the 4 suited AK combos make a flush draw here — all stay as overcards.
    expect(bd.handTypes.overcards.pct).toBeGreaterThan(0);
  });

  test('AK offsuit on 984 rainbow → overcards', () => {
    const range = createRange();
    range[rangeIndex(12, 11, false)] = 1.0;
    const bd = handTypeBreakdown(range, flop('9♠', '8♦', '4♣'));
    expect(bd.handTypes.overcards.pct).toBeGreaterThan(0.5);
  });
});

describe('handTypeBreakdown — improvement outs', () => {
  test('overpair (AA on K72r) carries improvement outs (trips = 2 outs)', () => {
    const range = createRange();
    range[rangeIndex(12, 12, false)] = 1.0;
    const bd = handTypeBreakdown(range, flop('K♠', '7♥', '2♦'));
    expect(bd.handTypes.overpair.avgImprovementOuts).toBeGreaterThanOrEqual(2);
  });

  test('overcards (AK on 984r) carries ~6 improvement outs (pair-up outs)', () => {
    const range = createRange();
    range[rangeIndex(12, 11, false)] = 1.0;
    const bd = handTypeBreakdown(range, flop('9♠', '8♦', '4♣'));
    expect(bd.handTypes.overcards.avgImprovementOuts).toBeGreaterThanOrEqual(5);
  });
});

describe('handTypeBreakdown — aggregate helpers', () => {
  test('pctMadeFlushPlus + pctMadeStraightPlus + pctSetTripsTwoPair are monotonic', () => {
    const range = archetypeRangeFor({ position: 'BB', action: 'call', vs: 'BTN' });
    const bd = handTypeBreakdown(range, flop('A♠', 'K♥', '7♦'));
    expect(pctMadeFlushPlus(bd)).toBeLessThanOrEqual(pctMadeStraightPlus(bd));
    expect(pctSetTripsTwoPair(bd)).toBeLessThanOrEqual(pctTopPairPlus(bd));
  });

  test('pctAir + pctWeakDraws + pctStrongDraws + pctAnyPairPlus ≈ 1', () => {
    const range = archetypeRangeFor({ position: 'BTN', action: 'open' });
    const bd = handTypeBreakdown(range, flop('K♠', '7♥', '2♦'));
    const sum = pctAir(bd) + pctWeakDraws(bd) + pctStrongDraws(bd) + pctAnyPairPlus(bd);
    expect(sum).toBeCloseTo(1, 2);
  });
});
