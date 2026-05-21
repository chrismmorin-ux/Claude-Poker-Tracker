import { describe, test, expect } from 'vitest';
import {
  evaluate5,
  bestFiveFromSeven,
  handCategory,
  HAND_CATEGORIES,
  STRENGTH_BUCKETS,
  computeBoardStrengthTable,
  classifyVillainCombo,
} from '../handEvaluator';
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

    test('handles 6 cards (turn board) correctly', () => {
      // K♠ J♠ on board Q♣ 4♦ 7♥ 4♠ — should be pair of 4s, NOT two pair or flush
      const cards = makeHand(
        [11, 0], [9, 0],   // K♠ J♠
        [10, 3], [2, 2], [5, 1], [2, 0], // Q♣ 4♦ 7♥ 4♠
      );
      const score = bestFiveFromSeven(cards);
      const cat = (score >> 20) & 0xF;
      // Best hand is K-Q-J-4-4 = pair of 4s
      expect(cat).toBe(HAND_CATEGORIES.PAIR);
    });

    test('6-card turn: pocket pair on paired board = two pair (not trips)', () => {
      // 9♥ 9♦ on board Q♣ 4♦ 7♥ 4♠ — should be two pair (9s and 4s)
      const cards = makeHand(
        [7, 1], [7, 2],    // 9♥ 9♦
        [10, 3], [2, 2], [5, 1], [2, 0], // Q♣ 4♦ 7♥ 4♠
      );
      const score = bestFiveFromSeven(cards);
      const cat = (score >> 20) & 0xF;
      expect(cat).toBe(HAND_CATEGORIES.TWO_PAIR);
    });

    test('6-card turn: A2 on paired board is pair, not two pair', () => {
      // A♥ 2♥ on board Q♣ 4♦ 7♥ 4♠ — should be pair of 4s (not phantom two pair)
      const cards = makeHand(
        [12, 1], [0, 1],   // A♥ 2♥
        [10, 3], [2, 2], [5, 1], [2, 0], // Q♣ 4♦ 7♥ 4♠
      );
      const score = bestFiveFromSeven(cards);
      const cat = (score >> 20) & 0xF;
      // A2 does NOT pair anything except the board 4s — just one pair
      expect(cat).toBe(HAND_CATEGORIES.PAIR);
    });

    test('6-card turn: no phantom flush from undefined card', () => {
      // K♠ J♠ on board Q♠ 4♠ 7♥ 4♦ — only 2 spade hole + 2 spade board = 4 spades, no flush
      const cards = makeHand(
        [11, 0], [9, 0],   // K♠ J♠
        [10, 0], [2, 0], [5, 1], [2, 2], // Q♠ 4♠ 7♥ 4♦
      );
      const score = bestFiveFromSeven(cards);
      const cat = (score >> 20) & 0xF;
      // Without bug fix, phantom 2♠ would give 5 spades = flush
      // With fix, should be two pair (Qs and 4s) or pair
      // K♠J♠ pairing Q via board: best hand is K-Q-J-4-4 = pair or K-Q-4-4 with J = pair
      // Actually KJ on Q474: Q pairs nothing in hand. Board has pair of 4s.
      // Best: K-Q-J-7-4 with pair of 4s = pair. OR two pair? No, KJ doesn't pair Q or 7.
      // So it's just pair of 4s.
      expect(cat).toBe(HAND_CATEGORIES.PAIR);
      expect(cat).not.toBe(HAND_CATEGORIES.FLUSH);
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

  describe('STRENGTH_BUCKETS', () => {
    test('enum has 5 ordered tiers from strongest to weakest', () => {
      expect(STRENGTH_BUCKETS).toEqual([
        'nuts',
        'very-strong',
        'strong',
        'marginal',
        'weak-or-bluff',
      ]);
    });
  });

  describe('computeBoardStrengthTable', () => {
    test('returns empty Map for preflop (no board)', () => {
      expect(computeBoardStrengthTable([]).size).toBe(0);
      expect(computeBoardStrengthTable([encodeCard(12, 0), encodeCard(11, 0)]).size).toBe(0);
    });

    test('returns empty Map for board with more than 5 cards', () => {
      const sevenCards = [12, 11, 10, 9, 8, 7, 6].map((r) => encodeCard(r, 0));
      expect(computeBoardStrengthTable(sevenCards).size).toBe(0);
    });

    test('returns table covering every legal combo on a flop (3 cards)', () => {
      const board = [encodeCard(12, 0), encodeCard(11, 0), encodeCard(10, 0)]; // A♠ K♠ Q♠
      const table = computeBoardStrengthTable(board);
      // Combos excluding the 3 board cards: C(49, 2) = 1176
      expect(table.size).toBe(1176);
      // Every value is a valid bucket
      for (const bucket of table.values()) {
        expect(STRENGTH_BUCKETS).toContain(bucket);
      }
    });

    test('returns table for turn (4 cards): C(48, 2) = 1128', () => {
      const board = [
        encodeCard(12, 0), encodeCard(11, 0), encodeCard(10, 0), encodeCard(9, 0),
      ]; // A♠ K♠ Q♠ J♠
      const table = computeBoardStrengthTable(board);
      expect(table.size).toBe(1128);
    });

    test('returns table for river (5 cards): C(47, 2) = 1081', () => {
      const board = [
        encodeCard(12, 0), encodeCard(11, 0), encodeCard(10, 0),
        encodeCard(9, 0), encodeCard(8, 0),
      ]; // royal-flush board: A♠ K♠ Q♠ J♠ T♠
      const table = computeBoardStrengthTable(board);
      expect(table.size).toBe(1081);
    });

    test('top combos on dry rainbow board land in nuts (set of kings on K72r)', () => {
      // K♠ 7♦ 2♣ — sets are the top tier
      const board = [encodeCard(11, 0), encodeCard(5, 2), encodeCard(0, 1)];
      const table = computeBoardStrengthTable(board);
      // KK = set of kings
      const kk = classifyVillainCombo(encodeCard(11, 1), encodeCard(11, 2), board, table);
      expect(kk).toBe('nuts');
      // 77 = set of sevens (still nuts-tier on a low-card board)
      const sevens = classifyVillainCombo(encodeCard(5, 0), encodeCard(5, 1), board, table);
      expect(sevens).toBe('nuts');
    });

    test('bottom combos on a board land in weak-or-bluff (offsuit low cards on Ah7h2h)', () => {
      // monotone hearts board — non-heart low cards have nothing
      const board = [encodeCard(12, 1), encodeCard(5, 1), encodeCard(0, 1)]; // A♥ 7♥ 2♥
      const table = computeBoardStrengthTable(board);
      // 3♠ 4♣ — high card 4, no flush draw, no pair
      const trash = classifyVillainCombo(encodeCard(1, 0), encodeCard(2, 3), board, table);
      expect(trash).toBe('weak-or-bluff');
    });

    test('all five buckets appear on a dry rainbow flop', () => {
      const board = [encodeCard(11, 0), encodeCard(5, 2), encodeCard(0, 1)]; // K♠ 7♦ 2♣
      const table = computeBoardStrengthTable(board);
      const seen = new Set(table.values());
      for (const bucket of STRENGTH_BUCKETS) {
        expect(seen.has(bucket)).toBe(true);
      }
    });

    test('non-trivial spread: no bucket holds the whole table', () => {
      const board = [encodeCard(11, 0), encodeCard(5, 2), encodeCard(0, 1)]; // K72r
      const table = computeBoardStrengthTable(board);
      const counts = {};
      for (const bucket of table.values()) {
        counts[bucket] = (counts[bucket] || 0) + 1;
      }
      const total = table.size;
      // Each bucket should be at least 1% of the table (very loose floor).
      for (const bucket of STRENGTH_BUCKETS) {
        expect(counts[bucket] || 0).toBeGreaterThan(total * 0.01);
      }
    });

    test('board-adaptive: a pocket pair of kings lands in different tier on dry vs wet board', () => {
      // Dry rainbow K72r: KK = set of kings, top tier.
      // K♠ is on the dry board, so villain holds K♥ K♦ (suits 1+2).
      const dryBoard = [encodeCard(11, 0), encodeCard(5, 2), encodeCard(0, 1)]; // K♠ 7♦ 2♣
      const dryTable = computeBoardStrengthTable(dryBoard);
      const kkDry = classifyVillainCombo(encodeCard(11, 1), encodeCard(11, 2), dryBoard, dryTable);

      // Monotone hearts board Ah7h2h: same KK combo. K♥ is not on this board.
      // KK is just a pocket pair below the ace; many heart-flush combos
      // dominate it.
      const wetBoard = [encodeCard(12, 1), encodeCard(5, 1), encodeCard(0, 1)]; // A♥ 7♥ 2♥
      const wetTable = computeBoardStrengthTable(wetBoard);
      const kkWet = classifyVillainCombo(encodeCard(11, 1), encodeCard(11, 2), wetBoard, wetTable);

      expect(kkDry).toBe('nuts'); // set of kings on dry rainbow K-high
      expect(kkWet).not.toBe('nuts'); // flushes + AA dominate on monotone ace-high

      // Equivalent hand strength lands in different tiers depending on board.
      const tierIndex = (b) => STRENGTH_BUCKETS.indexOf(b);
      expect(tierIndex(kkDry)).toBeLessThan(tierIndex(kkWet)); // stronger on dry
    });

    test('ties on score share the same bucket', () => {
      // On A♠ K♠ Q♠ J♠ T♠ (royal flush on board), every villain combo plays
      // the board (5-card score is the royal flush regardless of hole cards).
      // All combos tie on score. They must all land in the same bucket.
      const board = [
        encodeCard(12, 0), encodeCard(11, 0), encodeCard(10, 0),
        encodeCard(9, 0), encodeCard(8, 0),
      ];
      const table = computeBoardStrengthTable(board);
      const buckets = new Set(table.values());
      // All combos tied → one bucket. Per the "ties get the higher bucket"
      // rule, the percentile of the first combo is 0 → 'nuts'.
      expect(buckets.size).toBe(1);
      expect(buckets.has('nuts')).toBe(true);
    });
  });

  describe('classifyVillainCombo', () => {
    test('returns null when a combo card collides with the board', () => {
      const board = [encodeCard(11, 0), encodeCard(5, 2), encodeCard(0, 1)]; // K♠ 7♦ 2♣
      // K♠ is on the board
      expect(classifyVillainCombo(encodeCard(11, 0), encodeCard(11, 1), board)).toBeNull();
      // 7♦ is on the board
      expect(classifyVillainCombo(encodeCard(12, 0), encodeCard(5, 2), board)).toBeNull();
    });

    test('returns null for invalid card1 === card2', () => {
      const board = [encodeCard(11, 0), encodeCard(5, 2), encodeCard(0, 1)];
      expect(classifyVillainCombo(encodeCard(12, 0), encodeCard(12, 0), board)).toBeNull();
    });

    test('returns null for boards outside 3..5 cards', () => {
      const c1 = encodeCard(12, 1);
      const c2 = encodeCard(11, 1);
      expect(classifyVillainCombo(c1, c2, [])).toBeNull();
      expect(classifyVillainCombo(c1, c2, [encodeCard(0, 0), encodeCard(1, 0)])).toBeNull();
      const sixCards = [12, 11, 10, 9, 8, 7].map((r) => encodeCard(r, 0));
      expect(classifyVillainCombo(c1, c2, sixCards)).toBeNull();
    });

    test('deterministic for same (combo, board): two calls return the same bucket', () => {
      const board = [encodeCard(11, 0), encodeCard(5, 2), encodeCard(0, 1)];
      const c1 = encodeCard(12, 1);
      const c2 = encodeCard(11, 1);
      const a = classifyVillainCombo(c1, c2, board);
      const b = classifyVillainCombo(c1, c2, board);
      expect(a).toBe(b);
    });

    test('order-independent: (c1, c2) and (c2, c1) yield the same bucket', () => {
      const board = [encodeCard(11, 0), encodeCard(5, 2), encodeCard(0, 1)];
      const c1 = encodeCard(12, 1);
      const c2 = encodeCard(11, 1);
      expect(classifyVillainCombo(c1, c2, board)).toBe(classifyVillainCombo(c2, c1, board));
    });

    test('passing a pre-computed table matches a fresh computation', () => {
      const board = [encodeCard(11, 0), encodeCard(5, 2), encodeCard(0, 1)];
      const table = computeBoardStrengthTable(board);
      const c1 = encodeCard(12, 1);
      const c2 = encodeCard(11, 1);
      expect(classifyVillainCombo(c1, c2, board, table))
        .toBe(classifyVillainCombo(c1, c2, board));
    });
  });
});
