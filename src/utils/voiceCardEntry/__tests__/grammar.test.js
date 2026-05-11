import { describe, it, expect } from 'vitest';
import {
  RANK_TOKENS,
  SUIT_TOKENS,
  GLUE_TOKENS,
  VILLAIN_NUMBER_TOKENS,
  VILLAIN_PREFIX_TOKEN,
  SEPARATOR_PHRASES,
  CANONICAL_RANKS,
  CANONICAL_SUITS,
  tokenize,
  matchSeparatorAt,
  rankFor,
  suitFor,
  villainNumberFor,
  isGlue,
} from '../grammar';

describe('voiceCardEntry/grammar — coverage', () => {
  it('RANK_TOKENS covers every canonical rank from gameConstants', () => {
    const covered = new Set(Object.values(RANK_TOKENS));
    for (const r of CANONICAL_RANKS) {
      expect(covered.has(r)).toBe(true);
    }
  });

  it('SUIT_TOKENS covers every canonical suit from gameConstants', () => {
    const covered = new Set(Object.values(SUIT_TOKENS));
    for (const s of CANONICAL_SUITS) {
      expect(covered.has(s)).toBe(true);
    }
  });

  it('VILLAIN_NUMBER_TOKENS spans 1..10 inclusive', () => {
    const covered = new Set(Object.values(VILLAIN_NUMBER_TOKENS));
    for (let n = 1; n <= 10; n++) {
      expect(covered.has(n)).toBe(true);
    }
  });

  it('SEPARATOR_PHRASES contains both R5 phrases', () => {
    expect(SEPARATOR_PHRASES).toEqual(
      expect.arrayContaining([
        ['next', 'player'],
        ['and', 'then'],
      ]),
    );
  });

  it('GLUE_TOKENS contains "of"', () => {
    expect(GLUE_TOKENS.has('of')).toBe(true);
    expect(GLUE_TOKENS.size).toBe(1);
  });
});

describe('voiceCardEntry/grammar — rankFor', () => {
  it('maps canonical rank names', () => {
    expect(rankFor('ace')).toBe('A');
    expect(rankFor('king')).toBe('K');
    expect(rankFor('queen')).toBe('Q');
    expect(rankFor('jack')).toBe('J');
    expect(rankFor('ten')).toBe('T');
    expect(rankFor('nine')).toBe('9');
    expect(rankFor('eight')).toBe('8');
    expect(rankFor('seven')).toBe('7');
    expect(rankFor('six')).toBe('6');
    expect(rankFor('five')).toBe('5');
    expect(rankFor('four')).toBe('4');
    expect(rankFor('three')).toBe('3');
    expect(rankFor('two')).toBe('2');
  });

  it('maps phonetic variants', () => {
    expect(rankFor('harts')).toBe(null); // suit, not rank
    expect(rankFor('tree')).toBe('3');
    expect(rankFor('deuce')).toBe('2');
    expect(rankFor('ate')).toBe('8');
    expect(rankFor('sicks')).toBe('6');
    expect(rankFor('for')).toBe('4');
    expect(rankFor('fore')).toBe('4');
    expect(rankFor('too')).toBe('2');
  });

  it('maps digit forms', () => {
    expect(rankFor('10')).toBe('T');
    expect(rankFor('9')).toBe('9');
    expect(rankFor('2')).toBe('2');
  });

  it('returns null for non-rank tokens', () => {
    expect(rankFor('player')).toBe(null);
    expect(rankFor('of')).toBe(null);
    expect(rankFor('clubs')).toBe(null);
    expect(rankFor('flop')).toBe(null);
    expect(rankFor('')).toBe(null);
  });
});

describe('voiceCardEntry/grammar — suitFor', () => {
  it('maps canonical suit names', () => {
    expect(suitFor('spades')).toBe('♠');
    expect(suitFor('hearts')).toBe('♥');
    expect(suitFor('diamonds')).toBe('♦');
    expect(suitFor('clubs')).toBe('♣');
  });

  it('maps singular forms', () => {
    expect(suitFor('spade')).toBe('♠');
    expect(suitFor('heart')).toBe('♥');
    expect(suitFor('diamond')).toBe('♦');
    expect(suitFor('club')).toBe('♣');
  });

  it('maps phonetic mishearings', () => {
    expect(suitFor('harts')).toBe('♥');
    expect(suitFor('spaids')).toBe('♠');
    expect(suitFor('dimonds')).toBe('♦');
    expect(suitFor('cloves')).toBe('♣');
  });

  it('returns null for non-suit tokens', () => {
    expect(suitFor('ace')).toBe(null);
    expect(suitFor('player')).toBe(null);
    expect(suitFor('flop')).toBe(null);
    expect(suitFor('of')).toBe(null);
  });
});

describe('voiceCardEntry/grammar — villainNumberFor', () => {
  it('maps numeric word forms 1-10', () => {
    expect(villainNumberFor('one')).toBe(1);
    expect(villainNumberFor('two')).toBe(2);
    expect(villainNumberFor('three')).toBe(3);
    expect(villainNumberFor('four')).toBe(4);
    expect(villainNumberFor('five')).toBe(5);
    expect(villainNumberFor('six')).toBe(6);
    expect(villainNumberFor('seven')).toBe(7);
    expect(villainNumberFor('eight')).toBe(8);
    expect(villainNumberFor('nine')).toBe(9);
    expect(villainNumberFor('ten')).toBe(10);
  });

  it('maps phonetic variants', () => {
    expect(villainNumberFor('tree')).toBe(3);
    expect(villainNumberFor('ate')).toBe(8);
    expect(villainNumberFor('too')).toBe(2);
    expect(villainNumberFor('to')).toBe(2);
    expect(villainNumberFor('fore')).toBe(4);
    expect(villainNumberFor('sicks')).toBe(6);
  });

  it('returns null for non-numeric tokens', () => {
    expect(villainNumberFor('player')).toBe(null);
    expect(villainNumberFor('ace')).toBe(null);
  });
});

describe('voiceCardEntry/grammar — isGlue', () => {
  it('matches "of"', () => {
    expect(isGlue('of')).toBe(true);
  });
  it('does not match anything else', () => {
    expect(isGlue('and')).toBe(false);
    expect(isGlue('the')).toBe(false);
    expect(isGlue('')).toBe(false);
  });
});

describe('voiceCardEntry/grammar — tokenize', () => {
  it('lowercases', () => {
    expect(tokenize('Ace OF Hearts')).toEqual(['ace', 'of', 'hearts']);
  });

  it('strips punctuation', () => {
    expect(tokenize('ace of hearts, jack of spades.')).toEqual([
      'ace', 'of', 'hearts', 'jack', 'of', 'spades',
    ]);
  });

  it('collapses whitespace', () => {
    expect(tokenize('  ace   of    hearts  ')).toEqual(['ace', 'of', 'hearts']);
  });

  it('keeps digits', () => {
    expect(tokenize('10 of clubs')).toEqual(['10', 'of', 'clubs']);
  });

  it('returns empty array for empty input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });

  it('returns empty array for non-string input', () => {
    expect(tokenize(null)).toEqual([]);
    expect(tokenize(undefined)).toEqual([]);
    expect(tokenize(42)).toEqual([]);
  });
});

describe('voiceCardEntry/grammar — matchSeparatorAt', () => {
  it('matches "next player"', () => {
    const tokens = ['ace', 'of', 'hearts', 'next', 'player', 'king'];
    expect(matchSeparatorAt(tokens, 3)).toEqual({ matched: true, length: 2 });
  });

  it('matches "and then"', () => {
    const tokens = ['ace', 'and', 'then', 'king'];
    expect(matchSeparatorAt(tokens, 1)).toEqual({ matched: true, length: 2 });
  });

  it('does not match within rank-suit pair', () => {
    const tokens = ['ace', 'of', 'hearts'];
    expect(matchSeparatorAt(tokens, 0)).toEqual({ matched: false, length: 0 });
  });

  it('does not match a partial separator at end of stream', () => {
    const tokens = ['ace', 'of', 'hearts', 'next'];
    expect(matchSeparatorAt(tokens, 3)).toEqual({ matched: false, length: 0 });
  });
});

describe('voiceCardEntry/grammar — full canonical rank × suit enumeration', () => {
  // For every canonical (rank, suit) pair, the primary spoken form
  // tokenizes back to recognizable rank + suit tokens.
  const PRIMARY_RANK_FORM = {
    A: 'ace',
    K: 'king',
    Q: 'queen',
    J: 'jack',
    T: 'ten',
    '9': 'nine',
    '8': 'eight',
    '7': 'seven',
    '6': 'six',
    '5': 'five',
    '4': 'four',
    '3': 'three',
    '2': 'two',
  };
  const PRIMARY_SUIT_FORM = {
    '♠': 'spades',
    '♥': 'hearts',
    '♦': 'diamonds',
    '♣': 'clubs',
  };

  for (const rank of CANONICAL_RANKS) {
    for (const suit of CANONICAL_SUITS) {
      const phrase = `${PRIMARY_RANK_FORM[rank]} of ${PRIMARY_SUIT_FORM[suit]}`;
      it(`tokenizes "${phrase}" to rank ${rank} + suit ${suit}`, () => {
        const tokens = tokenize(phrase);
        expect(tokens).toHaveLength(3);
        expect(rankFor(tokens[0])).toBe(rank);
        expect(isGlue(tokens[1])).toBe(true);
        expect(suitFor(tokens[2])).toBe(suit);
      });
    }
  }
});
