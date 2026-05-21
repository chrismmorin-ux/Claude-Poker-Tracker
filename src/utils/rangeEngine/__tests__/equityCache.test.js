import { describe, test, expect } from 'vitest';
import { createEquityCache, comboIndex, NUM_COMBOS } from '../equityCache';
import { exactComboEquity } from '../../pokerCore/monteCarloEquity';
import { encodeCard } from '../../pokerCore/cardParser';

// Letter-notation card builder ("As", "Th", "2c") → encoded int.
// cardParser's parseAndEncode expects unicode suit glyphs; tests use letters.
const RANK_VALUE = { A: 12, K: 11, Q: 10, J: 9, T: 8, 9: 7, 8: 6, 7: 5, 6: 4, 5: 3, 4: 2, 3: 1, 2: 0 };
const SUIT_VALUE = { s: 0, h: 1, d: 2, c: 3 };
const card = (s) => encodeCard(RANK_VALUE[s[0]], SUIT_VALUE[s[1]]);
const cards = (str) => str.trim().split(/\s+/).map(card);
const combo = (str, weight = 1) => {
  const [card1, card2] = cards(str);
  return { card1, card2, weight };
};

describe('comboIndex — canonical [0, 1326) addressing', () => {
  test('is bijective onto [0, 1326)', () => {
    const seen = new Set();
    let min = Infinity, max = -Infinity;
    for (let a = 0; a < 52; a++) {
      for (let b = a + 1; b < 52; b++) {
        const idx = comboIndex(a, b);
        expect(seen.has(idx)).toBe(false);
        seen.add(idx);
        if (idx < min) min = idx;
        if (idx > max) max = idx;
      }
    }
    expect(seen.size).toBe(NUM_COMBOS);
    expect(min).toBe(0);
    expect(max).toBe(NUM_COMBOS - 1);
  });

  test('is order-independent', () => {
    expect(comboIndex(3, 40)).toBe(comboIndex(40, 3));
    expect(comboIndex(0, 51)).toBe(comboIndex(51, 0));
  });
});

describe('equityCache — precompute + lookup', () => {
  const hero = cards('Ac Ad');
  const flop = cards('2c 7d Th');
  const villainCombos = [combo('Ks Kh'), combo('Qs Qd'), combo('Js Tc'), combo('5h 5s')];

  test('cached equity matches a direct exactComboEquity call', () => {
    const cache = createEquityCache();
    const entry = cache.precomputeAtFlop({ heroCards: hero, villainCombos, flop, archetype: 'tag-open' });
    for (const { card1, card2 } of villainCombos) {
      const cached = cache.equityForCombo(entry, card1, card2);
      const direct = exactComboEquity(hero, [card1, card2], flop);
      expect(cached).toBeCloseTo(direct, 12);
    }
  });

  test('returns the same entry object on a repeat precompute (cache hit)', () => {
    const cache = createEquityCache();
    const args = { heroCards: hero, villainCombos, flop, archetype: 'tag-open' };
    const first = cache.precomputeAtFlop(args);
    const second = cache.precomputeAtFlop(args);
    expect(second).toBe(first);
    expect(cache.size()).toBe(1);
  });

  test('different hero hand is a distinct cache entry', () => {
    const cache = createEquityCache();
    cache.precomputeAtFlop({ heroCards: hero, villainCombos, flop, archetype: 'tag-open' });
    cache.precomputeAtFlop({ heroCards: cards('Kd Kc'), villainCombos, flop, archetype: 'tag-open' });
    expect(cache.size()).toBe(2);
  });

  test('combos that collide with hero or board are NaN', () => {
    const cache = createEquityCache();
    const withDead = [combo('Ac Kd'), combo('2c 3d'), combo('Ks Kh')]; // Ac=hero, 2c=board
    const entry = cache.precomputeAtFlop({ heroCards: hero, villainCombos: withDead, flop, archetype: 'x' });
    expect(Number.isNaN(cache.equityForCombo(entry, ...cards('Ac Kd')))).toBe(true);
    expect(Number.isNaN(cache.equityForCombo(entry, ...cards('2c 3d')))).toBe(true);
    expect(Number.isNaN(cache.equityForCombo(entry, ...cards('Ks Kh')))).toBe(false);
  });

  test('negligible-weight combos are skipped (NaN)', () => {
    const cache = createEquityCache();
    const entry = cache.precomputeAtFlop({
      heroCards: hero,
      villainCombos: [combo('Ks Kh', 0), combo('Qs Qd', 1)],
      flop,
      archetype: 'x',
    });
    expect(Number.isNaN(cache.equityForCombo(entry, ...cards('Ks Kh')))).toBe(true);
    expect(Number.isNaN(cache.equityForCombo(entry, ...cards('Qs Qd')))).toBe(false);
  });

  test('rejects a non-3-card flop', () => {
    const cache = createEquityCache();
    expect(() => cache.precomputeAtFlop({ heroCards: hero, villainCombos, flop: cards('2c 7d') }))
      .toThrow(RangeError);
  });
});

describe('equityCache — INV-RL-DETERMINISM', () => {
  test('two independent precomputes produce identical equity arrays', () => {
    const hero = cards('As Ks');
    const flop = cards('Js Td 3c');
    const villainCombos = [combo('Qd Qc'), combo('Ah Kh'), combo('9s 8s'), combo('2h 2d')];

    const a = createEquityCache().precomputeAtFlop({ heroCards: hero, villainCombos, flop });
    const b = createEquityCache().precomputeAtFlop({ heroCards: hero, villainCombos, flop });

    expect(a.equities.length).toBe(b.equities.length);
    for (let i = 0; i < a.equities.length; i++) {
      const x = a.equities[i], y = b.equities[i];
      if (Number.isNaN(x)) expect(Number.isNaN(y)).toBe(true);
      else expect(y).toBe(x); // bit-identical, not just close — no RNG
    }
  });
});

describe('equityCache — street narrowing', () => {
  const hero = cards('Ac Ad');
  const flop = cards('2c 7d Th');
  const villainCombos = [combo('Ks Kh'), combo('Qs Qd'), combo('Js Tc'), combo('9h 9s')];

  test('turn narrowing drops board-colliding combos and recomputes survivors', () => {
    const cache = createEquityCache();
    const flopEntry = cache.precomputeAtFlop({ heroCards: hero, villainCombos, flop, archetype: 'x' });
    const turnCard = card('Tc'); // collides with Js Tc
    const turnEntry = cache.narrow(flopEntry, turnCard);

    expect(turnEntry.street).toBe('turn');
    expect(turnEntry.board).toHaveLength(4);
    // Js Tc now collides with the turn card → NaN.
    expect(Number.isNaN(cache.equityForCombo(turnEntry, ...cards('Js Tc')))).toBe(true);
    // Survivor equity equals a direct exact turn computation.
    const board4 = [...flop, turnCard];
    expect(cache.equityForCombo(turnEntry, ...cards('Ks Kh')))
      .toBeCloseTo(exactComboEquity(hero, cards('Ks Kh'), board4), 12);
  });

  test('narrow result is memoized per full board', () => {
    const cache = createEquityCache();
    const flopEntry = cache.precomputeAtFlop({ heroCards: hero, villainCombos, flop, archetype: 'x' });
    const turn = card('3d');
    const sizeAfterFlop = cache.size();
    const t1 = cache.narrow(flopEntry, turn);
    expect(cache.size()).toBe(sizeAfterFlop + 1);
    const t2 = cache.narrow(flopEntry, turn);
    expect(t2).toBe(t1);
    expect(cache.size()).toBe(sizeAfterFlop + 1);
  });

  test('flop → turn → river yields binary river equities', () => {
    const cache = createEquityCache();
    const flopEntry = cache.precomputeAtFlop({ heroCards: hero, villainCombos, flop, archetype: 'x' });
    const turnEntry = cache.narrow(flopEntry, card('3d'));
    const riverEntry = cache.narrow(turnEntry, card('4s'));

    expect(riverEntry.street).toBe('river');
    expect(riverEntry.board).toHaveLength(5);
    const eq = cache.equityForCombo(riverEntry, ...cards('Ks Kh'));
    expect([0, 0.5, 1]).toContain(eq);
  });

  test('narrowing past the river throws', () => {
    const cache = createEquityCache();
    const flopEntry = cache.precomputeAtFlop({ heroCards: hero, villainCombos, flop });
    const turnEntry = cache.narrow(flopEntry, card('3d'));
    const riverEntry = cache.narrow(turnEntry, card('4s'));
    expect(() => cache.narrow(riverEntry, card('5c'))).toThrow(RangeError);
  });

  test('narrowing with a card already on the board throws', () => {
    const cache = createEquityCache();
    const flopEntry = cache.precomputeAtFlop({ heroCards: hero, villainCombos, flop });
    expect(() => cache.narrow(flopEntry, card('7d'))).toThrow(RangeError);
  });
});

describe('equityCache — clear', () => {
  test('clear() drops all entries', () => {
    const cache = createEquityCache();
    cache.precomputeAtFlop({ heroCards: cards('Ac Ad'), villainCombos: [combo('Ks Kh')], flop: cards('2c 7d Th') });
    expect(cache.size()).toBe(1);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
