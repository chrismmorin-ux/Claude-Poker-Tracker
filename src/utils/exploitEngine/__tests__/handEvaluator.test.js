import { describe, test, expect } from 'vitest';
import { evaluate5, bestFiveFromSeven, handCategory, HAND_CATEGORIES } from '../handEvaluator';
import { encodeCard } from '../cardParser';

// Helper: create 5 cards from rank/suit pairs
const makeHand = (...pairs) => pairs.map(([r, s]) => encodeCard(r, s));

describe('handEvaluator', () => {
  describe('evaluate5', () => {
    test('royal flush beats straight flush', () => {
      const royal = makeHand([12, 0], [11, 0], [10, 0], [9, 0], [8, 0]); // A-K-Q-J-T spades
      const sf = makeHand([11, 1], [10, 1], [9, 1], [8, 1], [7, 1]); // K-Q-J-T-9 hearts
      expect(evaluate5(royal)).toBeGreaterThan(evaluate5(sf));
    });

    test('straight flush beats four of a kind', () => {
      const sf = makeHand([7, 0], [6, 0], [5, 0], [4, 0], [3, 0]); // 9-8-7-6-5 spades
      const quads = makeHand([12, 0], [12, 1], [12, 2], [12, 3], [11, 0]); // AAAA K
      expect(evaluate5(sf)).toBeGreaterThan(evaluate5(quads));
    });

    test('four of a kind beats full house', () => {
      const quads = makeHand([10, 0], [10, 1], [10, 2], [10, 3], [5, 0]); // QQQQ 7
      const fh = makeHand([12, 0], [12, 1], [12, 2], [11, 0], [11, 1]); // AAA KK
      expect(evaluate5(quads)).toBeGreaterThan(evaluate5(fh));
    });

    test('full house beats flush', () => {
      const fh = makeHand([8, 0], [8, 1], [8, 2], [3, 0], [3, 1]); // TTT 55
      const flush = makeHand([12, 0], [10, 0], [7, 0], [5, 0], [2, 0]); // A Q 9 7 4 spades
      expect(evaluate5(fh)).toBeGreaterThan(evaluate5(flush));
    });

    test('flush beats straight', () => {
      const flush = makeHand([12, 0], [10, 0], [7, 0], [5, 0], [2, 0]);
      const straight = makeHand([8, 0], [7, 1], [6, 2], [5, 3], [4, 0]); // T-9-8-7-6
      expect(evaluate5(flush)).toBeGreaterThan(evaluate5(straight));
    });

    test('straight beats three of a kind', () => {
      const straight = makeHand([8, 0], [7, 1], [6, 2], [5, 3], [4, 0]);
      const trips = makeHand([11, 0], [11, 1], [11, 2], [6, 0], [3, 1]); // KKK 8 5
      expect(evaluate5(straight)).toBeGreaterThan(evaluate5(trips));
    });

    test('three of a kind beats two pair', () => {
      const trips = makeHand([5, 0], [5, 1], [5, 2], [12, 0], [11, 1]);
      const twoPair = makeHand([12, 0], [12, 1], [11, 0], [11, 1], [10, 0]); // AA KK Q
      expect(evaluate5(trips)).toBeGreaterThan(evaluate5(twoPair));
    });

    test('two pair beats pair', () => {
      const twoPair = makeHand([12, 0], [12, 1], [11, 0], [11, 1], [10, 0]);
      const pair = makeHand([12, 0], [12, 1], [11, 0], [10, 0], [9, 0]); // AA K Q J
      expect(evaluate5(twoPair)).toBeGreaterThan(evaluate5(pair));
    });

    test('pair beats high card', () => {
      const pair = makeHand([5, 0], [5, 1], [12, 0], [11, 0], [10, 0]);
      const highCard = makeHand([12, 0], [11, 1], [10, 2], [8, 3], [6, 0]);
      expect(evaluate5(pair)).toBeGreaterThan(evaluate5(highCard));
    });

    test('wheel straight is detected', () => {
      const wheel = makeHand([12, 0], [0, 1], [1, 2], [2, 3], [3, 0]); // A-2-3-4-5
      const score = evaluate5(wheel);
      expect(handCategory(score)).toBe('Straight');
    });

    test('higher pair beats lower pair', () => {
      const aces = makeHand([12, 0], [12, 1], [10, 0], [8, 0], [6, 0]);
      const kings = makeHand([11, 0], [11, 1], [10, 0], [8, 0], [6, 0]);
      expect(evaluate5(aces)).toBeGreaterThan(evaluate5(kings));
    });
  });

  describe('bestFiveFromSeven', () => {
    test('finds the best hand from 7 cards', () => {
      // 7 cards containing a flush
      const cards = makeHand(
        [12, 0], [10, 0], [7, 0], [5, 0], [2, 0], // flush in spades
        [11, 1], [9, 2] // non-spade cards
      );
      const score = bestFiveFromSeven(cards);
      expect(handCategory(score)).toBe('Flush');
    });

    test('handles exactly 5 cards', () => {
      const cards = makeHand([12, 0], [12, 1], [12, 2], [11, 0], [11, 1]);
      expect(bestFiveFromSeven(cards)).toBe(evaluate5(cards));
    });
  });

  describe('kicker comparison', () => {
    test('same pair, different kicker: AK vs AQ', () => {
      const pairAK = makeHand([12, 0], [12, 1], [11, 0], [8, 0], [5, 0]); // AA K 9 7
      const pairAQ = makeHand([12, 2], [12, 3], [10, 0], [8, 1], [5, 1]); // AA Q 9 7
      expect(evaluate5(pairAK)).toBeGreaterThan(evaluate5(pairAQ));
    });

    test('same two pair, different kicker', () => {
      const tpK = makeHand([12, 0], [12, 1], [11, 0], [11, 1], [10, 0]); // AA KK Q
      const tpJ = makeHand([12, 2], [12, 3], [11, 2], [11, 3], [9, 0]); // AA KK J
      expect(evaluate5(tpK)).toBeGreaterThan(evaluate5(tpJ));
    });

    test('same trips, different kickers', () => {
      const tripsAK = makeHand([8, 0], [8, 1], [8, 2], [12, 0], [11, 0]); // TTT A K
      const tripsAQ = makeHand([8, 0], [8, 1], [8, 2], [12, 1], [10, 0]); // TTT A Q
      expect(evaluate5(tripsAK)).toBeGreaterThan(evaluate5(tripsAQ));
    });

    test('high card A-K-Q-J-9 vs A-K-Q-J-8', () => {
      const hc1 = makeHand([12, 0], [11, 1], [10, 2], [9, 3], [7, 0]); // A K Q J 9
      const hc2 = makeHand([12, 1], [11, 2], [10, 3], [9, 0], [6, 1]); // A K Q J 8
      expect(evaluate5(hc1)).toBeGreaterThan(evaluate5(hc2));
    });

    test('two pair kicker: AAKKQ beats AAKK5', () => {
      // AA KK Q kicker vs AA KK 5 kicker
      const aakkq = makeHand([12, 0], [12, 1], [11, 0], [11, 1], [10, 0]); // AA KK Q
      const aakk5 = makeHand([12, 2], [12, 3], [11, 2], [11, 3], [3, 0]);  // AA KK 5
      expect(evaluate5(aakkq)).toBeGreaterThan(evaluate5(aakk5));
    });

    test('AK vs AQ on A-high board using bestFiveFromSeven', () => {
      // Hero 1: A♥ K♠ + board A♠ 7♥ 2♦ + fillers 5♣ 3♣
      const heroAK = [
        encodeCard(12, 1), encodeCard(11, 0), // A♥ K♠
        encodeCard(12, 0), encodeCard(5, 1), encodeCard(0, 2), // A♠ 7♥ 2♦
        encodeCard(3, 3), encodeCard(1, 3),   // 5♣ 3♣
      ];
      // Hero 2: A♦ Q♠ + same board
      const heroAQ = [
        encodeCard(12, 2), encodeCard(10, 0), // A♦ Q♠
        encodeCard(12, 0), encodeCard(5, 1), encodeCard(0, 2), // A♠ 7♥ 2♦
        encodeCard(3, 3), encodeCard(1, 3),   // 5♣ 3♣
      ];
      // AK makes two pair (AA KK) with better kicker than AQ (AA QQ)
      // Actually both make top pair with different kickers; AK kicker beats AQ kicker
      expect(bestFiveFromSeven(heroAK)).toBeGreaterThan(bestFiveFromSeven(heroAQ));
    });

    test('flush kicker: A-high flush beats K-high flush', () => {
      // A-high flush in spades
      const aFlush = makeHand([12, 0], [10, 0], [7, 0], [5, 0], [2, 0]); // A Q 9 7 4 spades
      // K-high flush in spades
      const kFlush = makeHand([11, 0], [10, 0], [7, 0], [5, 0], [2, 0]); // K Q 9 7 4 spades
      expect(evaluate5(aFlush)).toBeGreaterThan(evaluate5(kFlush));
    });
  });

  describe('handCategory', () => {
    test('returns correct category names', () => {
      const pair = makeHand([5, 0], [5, 1], [12, 0], [11, 0], [10, 0]);
      expect(handCategory(evaluate5(pair))).toBe('Pair');

      const flush = makeHand([12, 0], [10, 0], [7, 0], [5, 0], [2, 0]);
      expect(handCategory(evaluate5(flush))).toBe('Flush');
    });
  });
});
