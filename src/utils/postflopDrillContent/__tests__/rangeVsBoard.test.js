import { describe, test, expect } from 'vitest';
import { nutAdvantage, whiffRate, rangeVsRangeEquity } from '../rangeVsBoard';
import { parseRangeString } from '../../pokerCore/rangeMatrix';
import { parseBoard } from '../../pokerCore/cardParser';
import { archetypeRangeFor } from '../archetypeRanges';

const flop = (...cards) => parseBoard(cards);

describe('rangeVsBoard — nutAdvantage', () => {
  test('BTN open vs BB call on AK7 rainbow — BTN has real nut advantage', () => {
    const btn = archetypeRangeFor({ position: 'BTN', action: 'open' });
    const bb  = archetypeRangeFor({ position: 'BB',  action: 'call', vs: 'BTN' });
    const nut = nutAdvantage(btn, bb, flop('A♠', 'K♥', '7♦'));
    expect(nut.favored).toBe('A'); // BTN
    expect(nut.delta).toBeGreaterThan(0);
  });

  test('narrow AA vs wide call on 762 — AA is overpair (topPair), wide has sets → favors wide', () => {
    const aa   = parseRangeString('AA');
    const wide = parseRangeString('22-66,76s,65s,54s');
    const nut  = nutAdvantage(aa, wide, flop('7♥', '6♦', '2♣'));
    // Pedagogical: AA = 100% topPair (0% nuts+strong). Wide range has 66 (set
    // = nuts), 22 (set = nuts), 76s (two pair = strong), plus draws. Delta
    // should clearly favor B.
    expect(nut.favored).toBe('B');
  });
});

describe('rangeVsBoard — whiffRate', () => {
  test('UTG open on 654r has a LOW pedagogical whiff rate (tight range connects well)', () => {
    const utg = archetypeRangeFor({ position: 'UTG', action: 'open' });
    const w = whiffRate(utg, flop('6♣', '5♥', '4♦'));
    // UTG is broadway-heavy but every combo has overcards to pair → pedagogical
    // weakDraw. Pedagogical air is near zero for this tight range on this flop.
    // The real structural problem is NUT advantage, not whiff rate.
    expect(w).toBeLessThan(0.15);
  });

  test('BTN open on KQ9 has a moderate whiff rate', () => {
    const btn = archetypeRangeFor({ position: 'BTN', action: 'open' });
    const w = whiffRate(btn, flop('K♥', 'Q♦', '9♠'));
    // BTN is wide; KQ9 connects pairs but leaves small-A hands / low suited
    // connectors as pedagogical air or weakDraw. Pedagogical air is strictly
    // less than engine's raw air (we promote gutshots/overcards to weakDraw).
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThan(0.55);
  });
});

describe('rangeVsBoard — rangeVsRangeEquity', () => {
  test('AA vs KK on 2-3-4 rainbow — AA ≈ 83%', async () => {
    const aa = parseRangeString('AA');
    const kk = parseRangeString('KK');
    const { aEq } = await rangeVsRangeEquity(aa, kk, flop('2♠', '3♥', '4♦'), { trials: 2000 });
    expect(aEq).toBeGreaterThan(0.75);
    expect(aEq).toBeLessThan(0.92);
  }, 10000);

  test('AA vs 72o on 2-7-T → AA far behind (72 is two pair)', async () => {
    const aa = parseRangeString('AA');
    const sevenTwo = parseRangeString('72o');
    const { aEq } = await rangeVsRangeEquity(aa, sevenTwo, flop('2♠', '7♥', 'T♦'), { trials: 1500 });
    // AA would need to spike an A and avoid a 7 or 2 on later streets — ~25-30%.
    expect(aEq).toBeLessThan(0.4);
  }, 10000);
});
