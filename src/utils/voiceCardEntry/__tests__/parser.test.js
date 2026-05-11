import { describe, it, expect } from 'vitest';
import { parseTranscript } from '../parser';

// Default options that pass R6 gate
const OK = { durationMs: 2000, confidence: 0.9, confidenceThreshold: 0.65 };

describe('voiceCardEntry/parser — R6 strict no-op gate', () => {
  it('returns null on empty transcript', () => {
    expect(parseTranscript('', OK)).toBeNull();
    expect(parseTranscript('   ', OK)).toBeNull();
  });

  it('returns null on non-string transcript', () => {
    expect(parseTranscript(null, OK)).toBeNull();
    expect(parseTranscript(undefined, OK)).toBeNull();
    expect(parseTranscript(42, OK)).toBeNull();
  });

  it('returns null when durationMs < 500', () => {
    expect(parseTranscript('ace of hearts', { ...OK, durationMs: 400 })).toBeNull();
    expect(parseTranscript('ace of hearts', { ...OK, durationMs: 0 })).toBeNull();
  });

  it('returns null when confidence < confidenceThreshold', () => {
    expect(parseTranscript('ace of hearts', { ...OK, confidence: 0.4 })).toBeNull();
    expect(parseTranscript('ace of hearts', { ...OK, confidence: 0.64, confidenceThreshold: 0.65 })).toBeNull();
  });

  it('returns null when no cards parse from transcript', () => {
    // All filler, no valid rank-suit pair
    expect(parseTranscript('um yeah whatever', OK)).toBeNull();
    expect(parseTranscript('ace hearts', OK)).not.toBeNull(); // 'ace hearts' is valid (glue is optional)
  });

  it('returns null when transcript has dangling rank only', () => {
    // 'ace' without a suit → 0 cards parsed → R6 null
    expect(parseTranscript('ace', OK)).toBeNull();
  });
});

describe('voiceCardEntry/parser — single-card parsing', () => {
  it('parses "ace of hearts" → A♥', () => {
    const r = parseTranscript('ace of hearts', OK);
    expect(r).not.toBeNull();
    expect(r.cards).toEqual(['A♥']);
    expect(r.villainAssignments.size).toBe(0);
    expect(r.warnings).toEqual([]);
  });

  it('parses without glue: "king clubs" → K♣', () => {
    const r = parseTranscript('king clubs', OK);
    expect(r).not.toBeNull();
    expect(r.cards).toEqual(['K♣']);
  });

  it('parses digit forms: "10 of diamonds" → T♦', () => {
    const r = parseTranscript('10 of diamonds', OK);
    expect(r.cards).toEqual(['T♦']);
  });

  it('handles phonetic mishearings: "queen of harts" → Q♥', () => {
    const r = parseTranscript('queen of harts', OK);
    expect(r.cards).toEqual(['Q♥']);
  });

  it('handles "deuce of spades" → 2♠', () => {
    const r = parseTranscript('deuce of spades', OK);
    expect(r.cards).toEqual(['2♠']);
  });
});

describe('voiceCardEntry/parser — multi-card parsing (board entry)', () => {
  it('parses 3-card flop in one utterance', () => {
    const r = parseTranscript('ace of hearts jack of spades ten of clubs', OK);
    expect(r.cards).toEqual(['A♥', 'J♠', 'T♣']);
  });

  it('parses 5-card stream (full board)', () => {
    const r = parseTranscript('ace of hearts jack of spades ten of clubs four of diamonds two of clubs', OK);
    expect(r.cards).toEqual(['A♥', 'J♠', 'T♣', '4♦', '2♣']);
  });

  it('parses without glue between every pair: "ace hearts jack spades"', () => {
    const r = parseTranscript('ace hearts jack spades', OK);
    expect(r.cards).toEqual(['A♥', 'J♠']);
  });
});

describe('voiceCardEntry/parser — R5 villain tokens (advisory per D-1)', () => {
  it('binds cards to villain when "player N" precedes them', () => {
    const r = parseTranscript('player three ace of clubs jack of diamonds', OK);
    expect(r.cards).toEqual(['A♣', 'J♦']);
    expect(r.villainAssignments.get(3)).toEqual(['A♣', 'J♦']);
  });

  it('handles two villains with "next player" separator', () => {
    const r = parseTranscript(
      'player three ace of clubs jack of diamonds next player king of clubs queen of diamonds',
      OK,
    );
    expect(r.cards).toEqual(['A♣', 'J♦', 'K♣', 'Q♦']);
    expect(r.villainAssignments.get(3)).toEqual(['A♣', 'J♦']);
    // Note: "next player" without an explicit number resets villain context.
    // The second pair therefore has no villain binding (currentVillain reset to null).
    expect(r.villainAssignments.has(5)).toBe(false);
  });

  it('handles two villains both explicitly numbered', () => {
    const r = parseTranscript(
      'player three ace of clubs jack of diamonds player five king of clubs queen of diamonds',
      OK,
    );
    expect(r.cards).toEqual(['A♣', 'J♦', 'K♣', 'Q♦']);
    expect(r.villainAssignments.get(3)).toEqual(['A♣', 'J♦']);
    expect(r.villainAssignments.get(5)).toEqual(['K♣', 'Q♦']);
  });

  it('handles "and then" as a separator', () => {
    const r = parseTranscript(
      'player two ace of hearts king of clubs and then player four queen of spades jack of clubs',
      OK,
    );
    expect(r.villainAssignments.get(2)).toEqual(['A♥', 'K♣']);
    expect(r.villainAssignments.get(4)).toEqual(['Q♠', 'J♣']);
  });

  it('villain assignments are empty when no "player N" appears', () => {
    const r = parseTranscript('ace of hearts jack of spades', OK);
    expect(r.villainAssignments.size).toBe(0);
  });
});

describe('voiceCardEntry/parser — R5 "ten" collision rule', () => {
  it('"ten of clubs" parses as rank T (not villain 10)', () => {
    const r = parseTranscript('ten of clubs', OK);
    expect(r.cards).toEqual(['T♣']);
    expect(r.villainAssignments.size).toBe(0);
  });

  it('"player ten" parses as villain designator (and not as rank)', () => {
    const r = parseTranscript('player ten ace of clubs jack of diamonds', OK);
    expect(r.cards).toEqual(['A♣', 'J♦']);
    expect(r.villainAssignments.get(10)).toEqual(['A♣', 'J♦']);
  });

  it('"ace of ten" is invalid (ten as a suit) — drops the ace, ten becomes a new rank', () => {
    // 'ace of' expects a suit; 'ten' is not a suit. Parser warns + drops the ace.
    // Then 'ten' enters AFTER_RANK state. No suit follows → R6 returns null.
    const r = parseTranscript('ace of ten', OK);
    expect(r).toBeNull();
  });
});

describe('voiceCardEntry/parser — partial / noisy input tolerance', () => {
  it('drops unknown filler tokens with a warning, parses valid cards', () => {
    const r = parseTranscript('um ace of hearts uh jack of spades', OK);
    expect(r.cards).toEqual(['A♥', 'J♠']);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('partial-board (interruption at "jack of"): produces 1 card from 3', () => {
    // Per Gate 2 SC-6: parser should produce N chips for N parseable cards.
    const r = parseTranscript('ace of hearts jack of', OK);
    expect(r.cards).toEqual(['A♥']);
    expect(r.warnings.some((w) => /jack/i.test(w) || /trailing/i.test(w))).toBe(true);
  });

  it('warns and drops bare suit without preceding rank', () => {
    const r = parseTranscript('hearts ace of spades', OK);
    expect(r.cards).toEqual(['A♠']);
    expect(r.warnings.some((w) => /hearts/i.test(w))).toBe(true);
  });

  it('warns and drops rank if followed by another rank with no suit', () => {
    const r = parseTranscript('ace king of spades', OK);
    expect(r.cards).toEqual(['K♠']);
    // Warning mentions the canonical rank 'A' (not spoken form 'ace') and
    // the rank that displaced it (K).
    expect(r.warnings.some((w) => /'A'/.test(w))).toBe(true);
  });

  it('warns when "of" is followed by something that is not a suit', () => {
    const r = parseTranscript('ace of king of spades', OK);
    // ace + of + (king is not a suit) → drop ace with warning. Then king of spades is valid.
    expect(r.cards).toEqual(['K♠']);
    expect(r.warnings.some((w) => /suit/i.test(w))).toBe(true);
  });

  it('warns when "player" is followed by a non-number', () => {
    const r = parseTranscript('player chips ace of hearts', OK);
    expect(r.cards).toEqual(['A♥']);
    expect(r.warnings.some((w) => /player/i.test(w) || /chips/i.test(w))).toBe(true);
    expect(r.villainAssignments.size).toBe(0);
  });
});

describe('voiceCardEntry/parser — full canonical (rank × suit) enumeration', () => {
  const PRIMARY_RANK_FORM = {
    A: 'ace', K: 'king', Q: 'queen', J: 'jack', T: 'ten',
    '9': 'nine', '8': 'eight', '7': 'seven', '6': 'six', '5': 'five',
    '4': 'four', '3': 'three', '2': 'two',
  };
  const PRIMARY_SUIT_FORM = {
    '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs',
  };

  for (const rank of Object.keys(PRIMARY_RANK_FORM)) {
    for (const suit of Object.keys(PRIMARY_SUIT_FORM)) {
      const phrase = `${PRIMARY_RANK_FORM[rank]} of ${PRIMARY_SUIT_FORM[suit]}`;
      it(`parses "${phrase}" to ${rank}${suit}`, () => {
        const r = parseTranscript(phrase, OK);
        expect(r).not.toBeNull();
        expect(r.cards).toEqual([`${rank}${suit}`]);
      });
    }
  }
});

describe('voiceCardEntry/parser — case insensitive + punctuation tolerant', () => {
  it('handles uppercase + commas + periods', () => {
    const r = parseTranscript('Ace of Hearts, Jack of Spades.', OK);
    expect(r.cards).toEqual(['A♥', 'J♠']);
  });
});

describe('voiceCardEntry/parser — return shape', () => {
  it('returns { cards, villainAssignments, warnings } shape', () => {
    const r = parseTranscript('ace of hearts', OK);
    expect(r).toHaveProperty('cards');
    expect(r).toHaveProperty('villainAssignments');
    expect(r).toHaveProperty('warnings');
    expect(Array.isArray(r.cards)).toBe(true);
    expect(r.villainAssignments instanceof Map).toBe(true);
    expect(Array.isArray(r.warnings)).toBe(true);
  });
});
