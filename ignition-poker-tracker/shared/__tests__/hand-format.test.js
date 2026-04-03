/**
 * Tests for shared/hand-format.js
 *
 * Covers: createActionEntry, normalizeCard, buildHandRecord,
 *         validateHandRecord, SUIT_MAP, RANK_MAP.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createActionEntry,
  normalizeCard,
  buildHandRecord,
  validateHandRecord,
  SUIT_MAP,
  RANK_MAP,
} from '../hand-format.js';

// ===========================================================================
// CONSTANTS
// ===========================================================================

describe('SUIT_MAP', () => {
  it('maps Unicode suit characters to themselves', () => {
    expect(SUIT_MAP['♥']).toBe('♥');
    expect(SUIT_MAP['♦']).toBe('♦');
    expect(SUIT_MAP['♣']).toBe('♣');
    expect(SUIT_MAP['♠']).toBe('♠');
  });

  it('maps lowercase single-letter suit codes to Unicode', () => {
    expect(SUIT_MAP['h']).toBe('♥');
    expect(SUIT_MAP['d']).toBe('♦');
    expect(SUIT_MAP['c']).toBe('♣');
    expect(SUIT_MAP['s']).toBe('♠');
  });

  it('maps uppercase single-letter suit codes to Unicode', () => {
    expect(SUIT_MAP['H']).toBe('♥');
    expect(SUIT_MAP['D']).toBe('♦');
    expect(SUIT_MAP['C']).toBe('♣');
    expect(SUIT_MAP['S']).toBe('♠');
  });
});

describe('RANK_MAP', () => {
  it('maps "10" to T', () => {
    expect(RANK_MAP['10']).toBe('T');
  });

  it('maps "ten" to T', () => {
    expect(RANK_MAP['ten']).toBe('T');
  });

  it('maps face card words to single characters', () => {
    expect(RANK_MAP['jack']).toBe('J');
    expect(RANK_MAP['queen']).toBe('Q');
    expect(RANK_MAP['king']).toBe('K');
    expect(RANK_MAP['ace']).toBe('A');
  });

  it('maps uppercase letter ranks to themselves', () => {
    expect(RANK_MAP['T']).toBe('T');
    expect(RANK_MAP['J']).toBe('J');
    expect(RANK_MAP['Q']).toBe('Q');
    expect(RANK_MAP['K']).toBe('K');
    expect(RANK_MAP['A']).toBe('A');
  });

  it('maps lowercase letter ranks to uppercase', () => {
    expect(RANK_MAP['t']).toBe('T');
    expect(RANK_MAP['j']).toBe('J');
    expect(RANK_MAP['q']).toBe('Q');
    expect(RANK_MAP['k']).toBe('K');
    expect(RANK_MAP['a']).toBe('A');
  });
});

// ===========================================================================
// createActionEntry
// ===========================================================================

describe('createActionEntry', () => {
  it('creates a basic entry with required fields', () => {
    const entry = createActionEntry({ seat: 3, action: 'fold', street: 'preflop', order: 1 });
    expect(entry.seat).toBe(3);
    expect(entry.action).toBe('fold');
    expect(entry.street).toBe('preflop');
    expect(entry.order).toBe(1);
  });

  it('includes amount when provided', () => {
    const entry = createActionEntry({ seat: 5, action: 'bet', street: 'flop', order: 3, amount: 200 });
    expect(entry.amount).toBe(200);
  });

  it('omits amount when not provided', () => {
    const entry = createActionEntry({ seat: 1, action: 'check', street: 'turn', order: 2 });
    expect(entry).not.toHaveProperty('amount');
  });

  it('omits amount when explicitly null', () => {
    const entry = createActionEntry({ seat: 1, action: 'fold', street: 'preflop', order: 1, amount: null });
    expect(entry).not.toHaveProperty('amount');
  });

  it('omits amount when explicitly undefined', () => {
    const entry = createActionEntry({ seat: 1, action: 'fold', street: 'preflop', order: 1, amount: undefined });
    expect(entry).not.toHaveProperty('amount');
  });

  it('creates a check entry (no amount expected)', () => {
    const entry = createActionEntry({ seat: 3, action: 'check', street: 'flop', order: 1 });
    expect(entry.action).toBe('check');
    expect(entry).not.toHaveProperty('amount');
  });

  it('creates a raise entry with an amount', () => {
    const entry = createActionEntry({ seat: 9, action: 'raise', street: 'preflop', order: 4, amount: 300 });
    expect(entry.action).toBe('raise');
    expect(entry.amount).toBe(300);
  });

  it('creates a call entry with an amount', () => {
    const entry = createActionEntry({ seat: 7, action: 'call', street: 'preflop', order: 3, amount: 100 });
    expect(entry.action).toBe('call');
    expect(entry.amount).toBe(100);
  });

  it('creates a fold entry (no amount)', () => {
    const entry = createActionEntry({ seat: 1, action: 'fold', street: 'preflop', order: 1 });
    expect(entry.action).toBe('fold');
    expect(entry).not.toHaveProperty('amount');
  });

  it('allows amount of 0 (e.g., a check recorded with amount field)', () => {
    const entry = createActionEntry({ seat: 3, action: 'check', street: 'river', order: 5, amount: 0 });
    // amount: 0 is neither undefined nor null — the spec includes it
    expect(entry.amount).toBe(0);
  });

  it('does not add extra keys beyond seat/action/street/order/amount', () => {
    const entry = createActionEntry({ seat: 1, action: 'fold', street: 'preflop', order: 1 });
    expect(Object.keys(entry).sort()).toEqual(['action', 'order', 'seat', 'street']);
  });
});

// ===========================================================================
// normalizeCard
// ===========================================================================

describe('normalizeCard', () => {
  describe('Unicode passthrough (already normalized)', () => {
    it('passes through A♥ unchanged', () => {
      expect(normalizeCard('A♥')).toBe('A♥');
    });

    it('passes through T♦ unchanged', () => {
      expect(normalizeCard('T♦')).toBe('T♦');
    });

    it('passes through 2♣ unchanged', () => {
      expect(normalizeCard('2♣')).toBe('2♣');
    });

    it('passes through K♠ unchanged', () => {
      expect(normalizeCard('K♠')).toBe('K♠');
    });

    it('passes through 9♥ unchanged', () => {
      expect(normalizeCard('9♥')).toBe('9♥');
    });
  });

  describe('lowercase suit letter format (e.g., Ah, Td)', () => {
    it('converts Ah to A♥', () => {
      expect(normalizeCard('Ah')).toBe('A♥');
    });

    it('converts Td to T♦', () => {
      expect(normalizeCard('Td')).toBe('T♦');
    });

    it('converts 2c to 2♣', () => {
      expect(normalizeCard('2c')).toBe('2♣');
    });

    it('converts Ks to K♠', () => {
      expect(normalizeCard('Ks')).toBe('K♠');
    });

    it('converts 9d to 9♦', () => {
      expect(normalizeCard('9d')).toBe('9♦');
    });

    it('converts Jh to J♥', () => {
      expect(normalizeCard('Jh')).toBe('J♥');
    });

    it('converts Qc to Q♣', () => {
      expect(normalizeCard('Qc')).toBe('Q♣');
    });
  });

  describe('10 rank normalization', () => {
    it('converts 10♠ to T♠', () => {
      expect(normalizeCard('10♠')).toBe('T♠');
    });

    it('converts 10h to T♥', () => {
      expect(normalizeCard('10h')).toBe('T♥');
    });

    it('converts 10d to T♦', () => {
      expect(normalizeCard('10d')).toBe('T♦');
    });

    it('converts 10c to T♣', () => {
      expect(normalizeCard('10c')).toBe('T♣');
    });
  });

  describe('text / long-form format (e.g., "Ace of hearts")', () => {
    it('converts "Ace of hearts" to A♥', () => {
      expect(normalizeCard('Ace of hearts')).toBe('A♥');
    });

    it('converts "King of spades" to K♠', () => {
      expect(normalizeCard('King of spades')).toBe('K♠');
    });

    it('converts "jack of clubs" (lowercase) to J♣', () => {
      expect(normalizeCard('jack of clubs')).toBe('J♣');
    });

    it('converts "queen of diamonds" to Q♦', () => {
      expect(normalizeCard('queen of diamonds')).toBe('Q♦');
    });
  });

  describe('whitespace handling', () => {
    it('trims leading and trailing whitespace before parsing', () => {
      expect(normalizeCard('  Ah  ')).toBe('A♥');
    });
  });

  describe('invalid / unparseable input', () => {
    it('returns empty string for empty string', () => {
      expect(normalizeCard('')).toBe('');
    });

    it('returns empty string for null', () => {
      expect(normalizeCard(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(normalizeCard(undefined)).toBe('');
    });

    it('returns empty string for a number', () => {
      expect(normalizeCard(42)).toBe('');
    });

    it('returns empty string for a gibberish string', () => {
      expect(normalizeCard('xyz')).toBe('');
    });

    it('returns empty string for only a rank with no suit', () => {
      expect(normalizeCard('A')).toBe('');
    });

    it('returns empty string for only a suit with no rank', () => {
      expect(normalizeCard('♥')).toBe('');
    });
  });
});

// ===========================================================================
// buildHandRecord
// ===========================================================================

describe('buildHandRecord', () => {
  const baseInput = {
    currentStreet: 'river',
    dealerButtonSeat: 5,
    mySeat: 5,
    actionSequence: [],
    absentSeats: [],
    communityCards: ['As', '9d', 'Ad', '2c', 'Ks'],
    holeCards: ['8d', 'Kh'],
    allPlayerCards: {},
    seatPlayers: { 5: 'Hero' },
    tableId: 'table-001',
    ignitionMeta: { handNumber: '12345' },
  };

  it('returns an object with a numeric timestamp', () => {
    const record = buildHandRecord(baseInput);
    expect(typeof record.timestamp).toBe('number');
    expect(record.timestamp).toBeGreaterThan(0);
  });

  it('sets source to "ignition"', () => {
    const record = buildHandRecord(baseInput);
    expect(record.source).toBe('ignition');
  });

  it('sets version to "1.3.0"', () => {
    const record = buildHandRecord(baseInput);
    expect(record.version).toBe('1.3.0');
  });

  it('includes the provided tableId', () => {
    const record = buildHandRecord(baseInput);
    expect(record.tableId).toBe('table-001');
  });

  describe('gameState', () => {
    it('includes currentStreet', () => {
      const record = buildHandRecord(baseInput);
      expect(record.gameState.currentStreet).toBe('river');
    });

    it('includes dealerButtonSeat', () => {
      const record = buildHandRecord(baseInput);
      expect(record.gameState.dealerButtonSeat).toBe(5);
    });

    it('includes mySeat', () => {
      const record = buildHandRecord(baseInput);
      expect(record.gameState.mySeat).toBe(5);
    });

    it('includes actionSequence', () => {
      const seq = [{ seat: 1, action: 'fold', street: 'preflop', order: 1 }];
      const record = buildHandRecord({ ...baseInput, actionSequence: seq });
      expect(record.gameState.actionSequence).toEqual(seq);
    });

    it('includes absentSeats', () => {
      const record = buildHandRecord({ ...baseInput, absentSeats: [2, 4] });
      expect(record.gameState.absentSeats).toEqual([2, 4]);
    });

    it('defaults actionSequence to [] when not provided', () => {
      const { actionSequence: _, ...withoutSeq } = baseInput;
      const record = buildHandRecord(withoutSeq);
      expect(record.gameState.actionSequence).toEqual([]);
    });

    it('defaults absentSeats to [] when not provided', () => {
      const { absentSeats: _, ...withoutAbsent } = baseInput;
      const record = buildHandRecord(withoutAbsent);
      expect(record.gameState.absentSeats).toEqual([]);
    });
  });

  describe('cardState', () => {
    it('normalizes community cards from letter-suit to Unicode', () => {
      const record = buildHandRecord(baseInput);
      expect(record.cardState.communityCards).toEqual(['A♠', '9♦', 'A♦', '2♣', 'K♠']);
    });

    it('normalizes hole cards from letter-suit to Unicode', () => {
      const record = buildHandRecord(baseInput);
      expect(record.cardState.holeCards).toEqual(['8♦', 'K♥']);
    });

    it('pads community cards to exactly 5 with empty strings', () => {
      const record = buildHandRecord({ ...baseInput, communityCards: ['As', '9d', 'Ad'] });
      expect(record.cardState.communityCards).toHaveLength(5);
      expect(record.cardState.communityCards[3]).toBe('');
      expect(record.cardState.communityCards[4]).toBe('');
    });

    it('pads empty community cards to 5 empty strings', () => {
      const record = buildHandRecord({ ...baseInput, communityCards: [] });
      expect(record.cardState.communityCards).toEqual(['', '', '', '', '']);
    });

    it('defaults holeCards to ["", ""] when not provided', () => {
      const { holeCards: _, ...withoutHole } = baseInput;
      const record = buildHandRecord(withoutHole);
      expect(record.cardState.holeCards).toEqual(['', '']);
    });

    it('sets holeCardsVisible to true when both hole cards are non-empty', () => {
      const record = buildHandRecord(baseInput);
      expect(record.cardState.holeCardsVisible).toBe(true);
    });

    it('sets holeCardsVisible to false when hole cards are empty', () => {
      const record = buildHandRecord({ ...baseInput, holeCards: ['', ''] });
      expect(record.cardState.holeCardsVisible).toBe(false);
    });

    it('sets holeCardsVisible to false when first hole card is empty', () => {
      const record = buildHandRecord({ ...baseInput, holeCards: ['', 'Kh'] });
      expect(record.cardState.holeCardsVisible).toBe(false);
    });

    it('normalizes allPlayerCards through normalizeCard', () => {
      const record = buildHandRecord({
        ...baseInput,
        allPlayerCards: { 9: ['Ks', 'Jh'] },
      });
      expect(record.cardState.allPlayerCards['9']).toEqual(['K♠', 'J♥']);
    });

    it('ignores non-array values in allPlayerCards', () => {
      const record = buildHandRecord({
        ...baseInput,
        allPlayerCards: { 9: ['Ks', 'Jh'], bad: 'notarray' },
      });
      expect(record.cardState.allPlayerCards['bad']).toBeUndefined();
    });

    it('defaults allPlayerCards to empty object when not provided', () => {
      const { allPlayerCards: _, ...withoutCards } = baseInput;
      const record = buildHandRecord(withoutCards);
      expect(record.cardState.allPlayerCards).toEqual({});
    });
  });

  describe('seatPlayers', () => {
    it('passes seatPlayers through directly', () => {
      const record = buildHandRecord(baseInput);
      expect(record.seatPlayers).toEqual({ 5: 'Hero' });
    });

    it('defaults seatPlayers to empty object when not provided', () => {
      const { seatPlayers: _, ...withoutPlayers } = baseInput;
      const record = buildHandRecord(withoutPlayers);
      expect(record.seatPlayers).toEqual({});
    });
  });

  describe('ignitionMeta', () => {
    it('includes capturedAt (numeric timestamp) in ignitionMeta', () => {
      const record = buildHandRecord(baseInput);
      expect(typeof record.ignitionMeta.capturedAt).toBe('number');
      expect(record.ignitionMeta.capturedAt).toBeGreaterThan(0);
    });

    it('merges provided ignitionMeta fields', () => {
      const record = buildHandRecord(baseInput);
      expect(record.ignitionMeta.handNumber).toBe('12345');
    });

    it('defaults ignitionMeta to only capturedAt when not provided', () => {
      const { ignitionMeta: _, ...withoutMeta } = baseInput;
      const record = buildHandRecord(withoutMeta);
      expect(record.ignitionMeta).toHaveProperty('capturedAt');
      expect(Object.keys(record.ignitionMeta)).toEqual(['capturedAt']);
    });
  });
});

// ===========================================================================
// validateHandRecord
// ===========================================================================

describe('validateHandRecord', () => {
  /** Helper: build a minimal fully-valid hand record for mutation testing. */
  const buildValid = () => buildHandRecord({
    currentStreet: 'preflop',
    dealerButtonSeat: 1,
    mySeat: 5,
    actionSequence: [],
    communityCards: ['', '', '', '', ''],
    holeCards: ['Ah', 'Kh'],
  });

  describe('valid record', () => {
    it('returns valid: true and empty errors for a well-formed record', () => {
      const result = validateHandRecord(buildValid());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('top-level type check', () => {
    it('fails for null', () => {
      const result = validateHandRecord(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Hand record must be an object');
    });

    it('fails for a string', () => {
      const result = validateHandRecord('{}');
      expect(result.valid).toBe(false);
    });

    it('fails for a number', () => {
      const result = validateHandRecord(42);
      expect(result.valid).toBe(false);
    });

    it('fails for undefined', () => {
      const result = validateHandRecord(undefined);
      expect(result.valid).toBe(false);
    });
  });

  describe('timestamp validation', () => {
    it('fails when timestamp is missing', () => {
      const record = buildValid();
      delete record.timestamp;
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('timestamp'))).toBe(true);
    });

    it('fails when timestamp is a string', () => {
      const record = buildValid();
      record.timestamp = '2026-01-01';
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
    });

    it('fails when timestamp is 0 (falsy)', () => {
      const record = buildValid();
      record.timestamp = 0;
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
    });
  });

  describe('gameState validation', () => {
    it('fails when gameState is missing', () => {
      const record = buildValid();
      delete record.gameState;
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('gameState'))).toBe(true);
    });

    it('fails when currentStreet is not a string', () => {
      const record = buildValid();
      record.gameState.currentStreet = 8;
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('currentStreet'))).toBe(true);
    });

    it('fails when dealerButtonSeat is 0', () => {
      const record = buildValid();
      record.gameState.dealerButtonSeat = 0;
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('dealerButtonSeat'))).toBe(true);
    });

    it('fails when dealerButtonSeat is negative', () => {
      const record = buildValid();
      record.gameState.dealerButtonSeat = -1;
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
    });

    it('fails when dealerButtonSeat is a string', () => {
      const record = buildValid();
      record.gameState.dealerButtonSeat = '5';
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
    });

    it('fails when mySeat is 0', () => {
      const record = buildValid();
      record.gameState.mySeat = 0;
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('mySeat'))).toBe(true);
    });

    it('fails when mySeat is negative', () => {
      const record = buildValid();
      record.gameState.mySeat = -3;
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
    });

    it('fails when actionSequence is not an array', () => {
      const record = buildValid();
      record.gameState.actionSequence = {};
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('actionSequence'))).toBe(true);
    });
  });

  describe('cardState validation', () => {
    it('fails when cardState is missing', () => {
      const record = buildValid();
      delete record.cardState;
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('cardState'))).toBe(true);
    });

    it('fails when communityCards has fewer than 5 elements', () => {
      const record = buildValid();
      record.cardState.communityCards = ['A♥', 'K♦', 'Q♣'];
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('communityCards'))).toBe(true);
    });

    it('fails when communityCards has more than 5 elements', () => {
      const record = buildValid();
      record.cardState.communityCards = ['A♥', 'K♦', 'Q♣', 'J♠', 'T♥', '9♦'];
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
    });

    it('fails when communityCards is not an array', () => {
      const record = buildValid();
      record.cardState.communityCards = 'AKQJT';
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
    });

    it('fails when holeCards has fewer than 2 elements', () => {
      const record = buildValid();
      record.cardState.holeCards = ['A♥'];
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('holeCards'))).toBe(true);
    });

    it('fails when holeCards has more than 2 elements', () => {
      const record = buildValid();
      record.cardState.holeCards = ['A♥', 'K♦', 'Q♣'];
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
    });

    it('fails when holeCards is not an array', () => {
      const record = buildValid();
      record.cardState.holeCards = null;
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
    });
  });

  describe('multiple errors accumulate', () => {
    it('collects multiple errors in the errors array rather than stopping at first', () => {
      const record = buildValid();
      record.gameState.dealerButtonSeat = 0;
      record.gameState.mySeat = 0;
      const result = validateHandRecord(record);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});
