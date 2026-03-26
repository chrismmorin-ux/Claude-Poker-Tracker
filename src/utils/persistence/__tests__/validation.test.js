/**
 * validation.test.js - Tests for persistence layer validators
 *
 * Pure logic tests — no IndexedDB required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../errorHandler', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  DEBUG: false,
}));

import {
  validateHandRecord,
  validateSessionRecord,
  validatePlayerRecord,
  logValidationErrors,
  validateWithLogging,
} from '../validation';
import { logger } from '../../errorHandler';

// =============================================================================
// HELPERS
// =============================================================================

const makeValidHand = () => ({
  timestamp: Date.now(),
  gameState: {
    currentStreet: 'flop',
    dealerButtonSeat: 1,
    mySeat: 3,
  },
  cardState: {
    communityCards: ['Ah', 'Kd', '2c', null, null],
    holeCards: ['Js', 'Ts'],
  },
});

const makeValidSession = () => ({
  startTime: Date.now(),
  rebuyTransactions: [],
});

const makeValidPlayer = () => ({
  name: 'Alice',
});

// =============================================================================
// validateHandRecord
// =============================================================================

describe('validateHandRecord', () => {
  describe('valid records', () => {
    it('returns valid: true and empty errors for a well-formed record', () => {
      const result = validateHandRecord(makeValidHand());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('accepts an optional seatPlayers object', () => {
      const hand = { ...makeValidHand(), seatPlayers: { 1: 'Bob', 2: 'Alice' } };
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(true);
    });

    it('accepts seatPlayers as null', () => {
      const hand = { ...makeValidHand(), seatPlayers: null };
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(true);
    });

    it('accepts seatPlayers as undefined (field omitted)', () => {
      const hand = makeValidHand();
      delete hand.seatPlayers;
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(true);
    });
  });

  describe('null / undefined input', () => {
    it('returns invalid with descriptive error for null', () => {
      const result = validateHandRecord(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Hand record must be an object');
    });

    it('returns invalid for undefined', () => {
      const result = validateHandRecord(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Hand record must be an object');
    });

    it('returns invalid for a non-object primitive', () => {
      const result = validateHandRecord(42);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Hand record must be an object');
    });
  });

  describe('timestamp field', () => {
    it('returns error when timestamp is missing', () => {
      const hand = makeValidHand();
      delete hand.timestamp;
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid timestamp');
    });

    it('returns error when timestamp is a string', () => {
      const hand = { ...makeValidHand(), timestamp: '2024-01-01' };
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid timestamp');
    });

    it('returns error when timestamp is 0 (falsy)', () => {
      const hand = { ...makeValidHand(), timestamp: 0 };
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid timestamp');
    });
  });

  describe('gameState field', () => {
    it('returns error when gameState is missing', () => {
      const hand = makeValidHand();
      delete hand.gameState;
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing gameState');
    });

    it('returns error when gameState is not an object', () => {
      const hand = { ...makeValidHand(), gameState: 'preflop' };
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('gameState must be an object');
    });

    it('returns error when currentStreet is not a string', () => {
      const hand = makeValidHand();
      hand.gameState.currentStreet = 3;
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('gameState.currentStreet must be string');
    });

    it('returns error when dealerButtonSeat is not a number', () => {
      const hand = makeValidHand();
      hand.gameState.dealerButtonSeat = '1';
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('gameState.dealerButtonSeat must be number');
    });

    it('returns error when mySeat is not a number', () => {
      const hand = makeValidHand();
      hand.gameState.mySeat = null;
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('gameState.mySeat must be number');
    });
  });

  describe('cardState field', () => {
    it('returns error when cardState is missing', () => {
      const hand = makeValidHand();
      delete hand.cardState;
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing cardState');
    });

    it('returns error when cardState is not an object', () => {
      const hand = { ...makeValidHand(), cardState: true };
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cardState must be an object');
    });

    it('returns error when communityCards is not an array', () => {
      const hand = makeValidHand();
      hand.cardState.communityCards = 'Ah Kd 2c';
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cardState.communityCards must be array');
    });

    it('returns error when communityCards has fewer than 5 elements', () => {
      const hand = makeValidHand();
      hand.cardState.communityCards = ['Ah', 'Kd', '2c'];
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cardState.communityCards must have exactly 5 elements');
    });

    it('returns error when communityCards has more than 5 elements', () => {
      const hand = makeValidHand();
      hand.cardState.communityCards = ['Ah', 'Kd', '2c', '5h', '7s', 'Qs'];
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cardState.communityCards must have exactly 5 elements');
    });

    it('returns error when holeCards is not an array', () => {
      const hand = makeValidHand();
      hand.cardState.holeCards = null;
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cardState.holeCards must be array');
    });

    it('returns error when holeCards has only 1 element', () => {
      const hand = makeValidHand();
      hand.cardState.holeCards = ['As'];
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cardState.holeCards must have exactly 2 elements');
    });

    it('returns error when holeCards has 3 elements', () => {
      const hand = makeValidHand();
      hand.cardState.holeCards = ['As', 'Kh', 'Qd'];
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cardState.holeCards must have exactly 2 elements');
    });
  });

  describe('seatPlayers field', () => {
    it('returns error when seatPlayers is a non-object non-null value', () => {
      const hand = { ...makeValidHand(), seatPlayers: 'invalid' };
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('seatPlayers must be an object');
    });
  });

  describe('multiple errors', () => {
    it('accumulates errors for multiple invalid fields', () => {
      const hand = {
        timestamp: 'bad',
        gameState: { currentStreet: 1, dealerButtonSeat: '1', mySeat: '2' },
        cardState: {
          communityCards: ['Ah'],
          holeCards: [],
        },
      };
      const result = validateHandRecord(hand);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });
});

// =============================================================================
// validateSessionRecord
// =============================================================================

describe('validateSessionRecord', () => {
  describe('valid records', () => {
    it('returns valid: true for a minimal valid record', () => {
      const result = validateSessionRecord(makeValidSession());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('accepts a fully-populated valid record', () => {
      const session = {
        startTime: 1_000_000,
        buyIn: 200,
        cashOut: 350,
        rebuyTransactions: [{ amount: 100, timestamp: 1_000_500 }],
        handCount: 42,
      };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('accepts null buyIn', () => {
      const session = { ...makeValidSession(), buyIn: null };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(true);
    });

    it('accepts null cashOut', () => {
      const session = { ...makeValidSession(), cashOut: null };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(true);
    });

    it('accepts 0 as a valid buyIn', () => {
      const session = { ...makeValidSession(), buyIn: 0 };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(true);
    });
  });

  describe('null / undefined input', () => {
    it('returns invalid for null', () => {
      const result = validateSessionRecord(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Session record must be an object');
    });

    it('returns invalid for undefined', () => {
      const result = validateSessionRecord(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Session record must be an object');
    });
  });

  describe('startTime field', () => {
    it('returns error when startTime is missing', () => {
      const session = makeValidSession();
      delete session.startTime;
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid startTime');
    });

    it('returns error when startTime is a string', () => {
      const session = { ...makeValidSession(), startTime: '2024-01-01' };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid startTime');
    });

    it('returns error when startTime is 0 (falsy)', () => {
      const session = { ...makeValidSession(), startTime: 0 };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid startTime');
    });
  });

  describe('buyIn field', () => {
    it('returns error when buyIn is a string', () => {
      const session = { ...makeValidSession(), buyIn: '200' };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('buyIn must be null or number');
    });

    it('returns error when buyIn is negative', () => {
      const session = { ...makeValidSession(), buyIn: -50 };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('buyIn must be non-negative');
    });
  });

  describe('cashOut field', () => {
    it('returns error when cashOut is a non-number', () => {
      const session = { ...makeValidSession(), cashOut: true };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cashOut must be null or number');
    });

    it('returns error when cashOut is negative', () => {
      const session = { ...makeValidSession(), cashOut: -1 };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cashOut must be non-negative');
    });
  });

  describe('rebuyTransactions field', () => {
    it('returns error when rebuyTransactions is missing', () => {
      const session = makeValidSession();
      delete session.rebuyTransactions;
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('rebuyTransactions must be array');
    });

    it('returns error when rebuyTransactions is not an array', () => {
      const session = { ...makeValidSession(), rebuyTransactions: {} };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('rebuyTransactions must be array');
    });

    it('returns error when a transaction item is not an object', () => {
      const session = { ...makeValidSession(), rebuyTransactions: [42] };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('rebuyTransactions[0] must be an object');
    });

    it('returns error when a transaction item is null', () => {
      const session = { ...makeValidSession(), rebuyTransactions: [null] };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('rebuyTransactions[0] must be an object');
    });

    it('returns error when transaction amount is not a number', () => {
      const session = {
        ...makeValidSession(),
        rebuyTransactions: [{ amount: '100', timestamp: 1_000_000 }],
      };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('rebuyTransactions[0].amount must be number');
    });

    it('returns error when transaction amount is negative', () => {
      const session = {
        ...makeValidSession(),
        rebuyTransactions: [{ amount: -50, timestamp: 1_000_000 }],
      };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('rebuyTransactions[0].amount must be non-negative');
    });

    it('returns error when transaction timestamp is not a number', () => {
      const session = {
        ...makeValidSession(),
        rebuyTransactions: [{ amount: 100, timestamp: null }],
      };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('rebuyTransactions[0].timestamp must be number');
    });

    it('indexes errors correctly for multiple invalid transactions', () => {
      const session = {
        ...makeValidSession(),
        rebuyTransactions: [
          { amount: 100, timestamp: 1_000_000 },
          { amount: 'bad', timestamp: 'bad' },
        ],
      };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('[1]'))).toBe(true);
    });

    it('accepts an empty rebuyTransactions array', () => {
      const session = { ...makeValidSession(), rebuyTransactions: [] };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(true);
    });
  });

  describe('handCount field', () => {
    it('accepts a valid integer handCount', () => {
      const session = { ...makeValidSession(), handCount: 10 };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(true);
    });

    it('accepts 0 as a valid handCount', () => {
      const session = { ...makeValidSession(), handCount: 0 };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(true);
    });

    it('returns error when handCount is not a number', () => {
      const session = { ...makeValidSession(), handCount: '10' };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('handCount must be a number');
    });

    it('returns error when handCount is a float', () => {
      const session = { ...makeValidSession(), handCount: 5.5 };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('handCount must be a non-negative integer');
    });

    it('returns error when handCount is negative', () => {
      const session = { ...makeValidSession(), handCount: -1 };
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('handCount must be a non-negative integer');
    });

    it('does not error when handCount is undefined (field omitted)', () => {
      const session = makeValidSession();
      delete session.handCount;
      const result = validateSessionRecord(session);
      expect(result.valid).toBe(true);
    });
  });
});

// =============================================================================
// validatePlayerRecord
// =============================================================================

describe('validatePlayerRecord', () => {
  describe('valid records', () => {
    it('returns valid: true for a minimal record with only name', () => {
      const result = validatePlayerRecord(makeValidPlayer());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('accepts a fully-populated valid record', () => {
      const player = {
        name: 'Bob',
        nickname: 'Shark',
        ethnicity: 'unknown',
        build: 'heavy',
        gender: 'male',
        facialHair: 'beard',
        notes: 'Calls too wide',
        avatar: 'img.png',
        hat: true,
        sunglasses: false,
        styleTags: ['TAG', 'aggressive'],
        createdAt: 1_000_000,
        lastSeenAt: 2_000_000,
        handCount: 50,
      };
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('null / undefined input', () => {
    it('returns invalid for null', () => {
      const result = validatePlayerRecord(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Player record must be an object');
    });

    it('returns invalid for undefined', () => {
      const result = validatePlayerRecord(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Player record must be an object');
    });
  });

  describe('name field', () => {
    it('returns error when name is missing', () => {
      const player = {};
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name is required and must be a string');
    });

    it('returns error when name is a number', () => {
      const player = { name: 42 };
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name is required and must be a string');
    });

    it('returns error when name is null', () => {
      const player = { name: null };
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name is required and must be a string');
    });

    it('returns error when name is an empty string', () => {
      const player = { name: '' };
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name is required and must be a string');
    });

    it('returns error when name is a whitespace-only string', () => {
      const player = { name: '   ' };
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name cannot be empty');
    });
  });

  describe('optional string fields', () => {
    const optionalStringFields = ['nickname', 'ethnicity', 'build', 'gender', 'facialHair', 'notes', 'avatar'];

    optionalStringFields.forEach(field => {
      it(`returns error when ${field} is a number`, () => {
        const player = { ...makeValidPlayer(), [field]: 123 };
        const result = validatePlayerRecord(player);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(`${field} must be a string`);
      });

      it(`accepts null for ${field}`, () => {
        const player = { ...makeValidPlayer(), [field]: null };
        const result = validatePlayerRecord(player);
        expect(result.valid).toBe(true);
      });

      it(`accepts undefined (omitted) for ${field}`, () => {
        const player = makeValidPlayer();
        delete player[field];
        const result = validatePlayerRecord(player);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('boolean fields (hat, sunglasses)', () => {
    ['hat', 'sunglasses'].forEach(field => {
      it(`returns error when ${field} is a string`, () => {
        const player = { ...makeValidPlayer(), [field]: 'yes' };
        const result = validatePlayerRecord(player);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(`${field} must be a boolean`);
      });

      it(`returns error when ${field} is 1 (number, not boolean)`, () => {
        const player = { ...makeValidPlayer(), [field]: 1 };
        const result = validatePlayerRecord(player);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(`${field} must be a boolean`);
      });

      it(`accepts null for ${field}`, () => {
        const player = { ...makeValidPlayer(), [field]: null };
        const result = validatePlayerRecord(player);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('styleTags field', () => {
    it('accepts a valid string array', () => {
      const player = { ...makeValidPlayer(), styleTags: ['TAG', 'nit'] };
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(true);
    });

    it('accepts an empty array', () => {
      const player = { ...makeValidPlayer(), styleTags: [] };
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(true);
    });

    it('returns error when styleTags is not an array', () => {
      const player = { ...makeValidPlayer(), styleTags: 'TAG' };
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('styleTags must be an array');
    });

    it('returns error when styleTags contains a non-string item', () => {
      const player = { ...makeValidPlayer(), styleTags: ['TAG', 42] };
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('styleTags must contain only strings');
    });

    it('accepts null styleTags', () => {
      const player = { ...makeValidPlayer(), styleTags: null };
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(true);
    });
  });

  describe('timestamp fields (createdAt, lastSeenAt)', () => {
    it('returns error when createdAt is a string', () => {
      const player = { ...makeValidPlayer(), createdAt: '2024-01-01' };
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('createdAt must be a number');
    });

    it('returns error when lastSeenAt is a boolean', () => {
      const player = { ...makeValidPlayer(), lastSeenAt: true };
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('lastSeenAt must be a number');
    });

    it('accepts undefined createdAt (field omitted)', () => {
      const player = makeValidPlayer();
      delete player.createdAt;
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(true);
    });
  });

  describe('handCount field', () => {
    it('accepts a valid non-negative number', () => {
      const player = { ...makeValidPlayer(), handCount: 100 };
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(true);
    });

    it('accepts 0', () => {
      const player = { ...makeValidPlayer(), handCount: 0 };
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(true);
    });

    it('returns error when handCount is negative', () => {
      const player = { ...makeValidPlayer(), handCount: -1 };
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('handCount must be a non-negative number');
    });

    it('returns error when handCount is a string', () => {
      const player = { ...makeValidPlayer(), handCount: '10' };
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('handCount must be a non-negative number');
    });

    it('does not error when handCount is undefined (field omitted)', () => {
      const player = makeValidPlayer();
      delete player.handCount;
      const result = validatePlayerRecord(player);
      expect(result.valid).toBe(true);
    });
  });
});

// =============================================================================
// logValidationErrors
// =============================================================================

describe('logValidationErrors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls logger.warn once per error', () => {
    logValidationErrors('saveHand', ['error one', 'error two']);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('includes the context string in each warn call', () => {
    logValidationErrors('createSession', ['bad field']);
    expect(logger.warn).toHaveBeenCalledWith(
      'persistence/validation',
      'createSession: bad field',
    );
  });

  it('does not call logger.warn when errors array is empty', () => {
    logValidationErrors('saveHand', []);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('formats each error message with context prefix', () => {
    logValidationErrors('ctx', ['err A', 'err B']);
    const calls = logger.warn.mock.calls;
    expect(calls[0][1]).toBe('ctx: err A');
    expect(calls[1][1]).toBe('ctx: err B');
  });
});

// =============================================================================
// validateWithLogging
// =============================================================================

describe('validateWithLogging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the validator result unchanged when valid', () => {
    const result = validateWithLogging(makeValidPlayer(), validatePlayerRecord, 'test');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('returns the validator result unchanged when invalid', () => {
    const result = validateWithLogging({ name: '' }, validatePlayerRecord, 'test');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('does not call logger.warn when the record is valid', () => {
    validateWithLogging(makeValidPlayer(), validatePlayerRecord, 'test');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('calls logger.warn for each error when the record is invalid', () => {
    const invalidPlayer = { name: '   ' };
    const validationResult = validatePlayerRecord(invalidPlayer);
    validateWithLogging(invalidPlayer, validatePlayerRecord, 'ctx');
    expect(logger.warn).toHaveBeenCalledTimes(validationResult.errors.length);
  });

  it('includes the context in warn messages', () => {
    validateWithLogging({ name: '' }, validatePlayerRecord, 'myContext');
    const calls = logger.warn.mock.calls;
    expect(calls.every(([, msg]) => msg.startsWith('myContext:'))).toBe(true);
  });

  it('works with validateHandRecord as the validator', () => {
    const result = validateWithLogging(makeValidHand(), validateHandRecord, 'saveHand');
    expect(result.valid).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('works with validateSessionRecord as the validator', () => {
    const result = validateWithLogging(makeValidSession(), validateSessionRecord, 'saveSession');
    expect(result.valid).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('calls the provided validator function with the record', () => {
    const mockValidator = vi.fn(() => ({ valid: true, errors: [] }));
    const record = { name: 'Alice' };
    validateWithLogging(record, mockValidator, 'ctx');
    expect(mockValidator).toHaveBeenCalledWith(record);
  });
});
