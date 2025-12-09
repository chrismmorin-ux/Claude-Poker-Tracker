/**
 * reducerUtils.test.js - Tests for reducer validation utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateSchema, createValidatedReducer, SCHEMA_RULES } from '../reducerUtils';
import { logger } from '../errorHandler';

// Mock the errorHandler module
vi.mock('../errorHandler', () => ({
  DEBUG: true,
  logger: {
    action: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  AppError: class AppError extends Error {
    constructor(code, message, context) {
      super(message);
      this.code = code;
      this.context = context;
    }
  },
  ERROR_CODES: {
    STATE_CORRUPTION: 'E102',
    REDUCER_FAILED: 'E103',
  },
}));

describe('reducerUtils', () => {
  describe('validateSchema', () => {
    describe('type validation', () => {
      it('validates string type', () => {
        const schema = { name: { type: 'string' } };

        expect(validateSchema({ name: 'test' }, schema)).toEqual([]);
        expect(validateSchema({ name: 123 }, schema)).toEqual([
          'name should be string but was number'
        ]);
      });

      it('validates number type', () => {
        const schema = { count: { type: 'number' } };

        expect(validateSchema({ count: 42 }, schema)).toEqual([]);
        expect(validateSchema({ count: 'forty' }, schema)).toEqual([
          'count should be number but was string'
        ]);
      });

      it('validates boolean type', () => {
        const schema = { active: { type: 'boolean' } };

        expect(validateSchema({ active: true }, schema)).toEqual([]);
        expect(validateSchema({ active: false }, schema)).toEqual([]);
        expect(validateSchema({ active: 'yes' }, schema)).toEqual([
          'active should be boolean but was string'
        ]);
      });

      it('validates array type', () => {
        const schema = { items: { type: 'array' } };

        expect(validateSchema({ items: [1, 2, 3] }, schema)).toEqual([]);
        expect(validateSchema({ items: [] }, schema)).toEqual([]);
        expect(validateSchema({ items: 'not array' }, schema)).toEqual([
          'items should be array but was string'
        ]);
        expect(validateSchema({ items: { length: 3 } }, schema)).toEqual([
          'items should be array but was object'
        ]);
      });

      it('validates object type', () => {
        const schema = { data: { type: 'object' } };

        expect(validateSchema({ data: {} }, schema)).toEqual([]);
        expect(validateSchema({ data: { key: 'value' } }, schema)).toEqual([]);
      });
    });

    describe('required validation', () => {
      it('fails when required field is null', () => {
        const schema = { name: { type: 'string', required: true } };

        expect(validateSchema({ name: null }, schema)).toEqual([
          'name is required but was null'
        ]);
      });

      it('fails when required field is undefined', () => {
        const schema = { name: { type: 'string', required: true } };

        expect(validateSchema({}, schema)).toEqual([
          'name is required but was undefined'
        ]);
      });

      it('skips type checking when optional field is missing', () => {
        const schema = { name: { type: 'string', required: false } };

        expect(validateSchema({}, schema)).toEqual([]);
        expect(validateSchema({ name: null }, schema)).toEqual([]);
      });
    });

    describe('enum validation', () => {
      it('validates enum values', () => {
        const schema = {
          street: { type: 'string', enum: ['preflop', 'flop', 'turn', 'river'] }
        };

        expect(validateSchema({ street: 'preflop' }, schema)).toEqual([]);
        expect(validateSchema({ street: 'flop' }, schema)).toEqual([]);
        expect(validateSchema({ street: 'invalid' }, schema)).toEqual([
          'street should be one of [preflop, flop, turn, river] but was "invalid"'
        ]);
      });
    });

    describe('range validation', () => {
      it('validates minimum value', () => {
        const schema = { seat: { type: 'number', min: 1 } };

        expect(validateSchema({ seat: 1 }, schema)).toEqual([]);
        expect(validateSchema({ seat: 5 }, schema)).toEqual([]);
        expect(validateSchema({ seat: 0 }, schema)).toEqual([
          'seat should be >= 1 but was 0'
        ]);
        expect(validateSchema({ seat: -1 }, schema)).toEqual([
          'seat should be >= 1 but was -1'
        ]);
      });

      it('validates maximum value', () => {
        const schema = { seat: { type: 'number', max: 9 } };

        expect(validateSchema({ seat: 9 }, schema)).toEqual([]);
        expect(validateSchema({ seat: 1 }, schema)).toEqual([]);
        expect(validateSchema({ seat: 10 }, schema)).toEqual([
          'seat should be <= 9 but was 10'
        ]);
      });

      it('validates both min and max', () => {
        const schema = { seat: { type: 'number', min: 1, max: 9 } };

        expect(validateSchema({ seat: 5 }, schema)).toEqual([]);
        expect(validateSchema({ seat: 0 }, schema)).toEqual([
          'seat should be >= 1 but was 0'
        ]);
        expect(validateSchema({ seat: 10 }, schema)).toEqual([
          'seat should be <= 9 but was 10'
        ]);
      });
    });

    describe('array items validation', () => {
      it('validates array item types', () => {
        const schema = { seats: { type: 'array', items: 'number' } };

        expect(validateSchema({ seats: [1, 2, 3] }, schema)).toEqual([]);
        expect(validateSchema({ seats: [] }, schema)).toEqual([]);
        expect(validateSchema({ seats: [1, 'two', 3] }, schema)).toEqual([
          'seats[1] should be number but was string'
        ]);
      });
    });

    describe('length validation', () => {
      it('validates array length', () => {
        const schema = { cards: { type: 'array', length: 2 } };

        expect(validateSchema({ cards: ['A', 'K'] }, schema)).toEqual([]);
        expect(validateSchema({ cards: ['A'] }, schema)).toEqual([
          'cards should have length 2 but was 1'
        ]);
        expect(validateSchema({ cards: ['A', 'K', 'Q'] }, schema)).toEqual([
          'cards should have length 2 but was 3'
        ]);
      });

      it('validates string length', () => {
        const schema = { code: { type: 'string', length: 4 } };

        expect(validateSchema({ code: 'ABCD' }, schema)).toEqual([]);
        expect(validateSchema({ code: 'ABC' }, schema)).toEqual([
          'code should have length 4 but was 3'
        ]);
      });
    });

    describe('multiple field validation', () => {
      it('collects multiple errors', () => {
        const schema = {
          name: { type: 'string', required: true },
          age: { type: 'number', min: 0 },
          status: { type: 'string', enum: ['active', 'inactive'] },
        };

        const errors = validateSchema({
          name: null,
          age: -5,
          status: 'unknown',
        }, schema);

        expect(errors).toHaveLength(3);
        expect(errors).toContain('name is required but was null');
        expect(errors).toContain('age should be >= 0 but was -5');
        expect(errors).toContain('status should be one of [active, inactive] but was "unknown"');
      });
    });
  });

  describe('createValidatedReducer', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('calls the underlying reducer with state and action', () => {
      const mockReducer = vi.fn((state) => ({ ...state, updated: true }));
      const schema = {};
      const validatedReducer = createValidatedReducer(mockReducer, schema, 'TestReducer');

      const state = { value: 1 };
      const action = { type: 'UPDATE' };

      validatedReducer(state, action);

      expect(mockReducer).toHaveBeenCalledWith(state, action);
    });

    it('returns the new state from the reducer', () => {
      const mockReducer = (state, action) => {
        if (action.type === 'INCREMENT') {
          return { count: state.count + 1 };
        }
        return state;
      };
      const schema = { count: { type: 'number' } };
      const validatedReducer = createValidatedReducer(mockReducer, schema, 'TestReducer');

      const result = validatedReducer({ count: 0 }, { type: 'INCREMENT' });

      expect(result).toEqual({ count: 1 });
    });

    it('logs actions in debug mode', () => {
      const mockReducer = (state) => state;
      const validatedReducer = createValidatedReducer(mockReducer, {}, 'TestReducer');

      validatedReducer({ value: 1 }, { type: 'TEST_ACTION', payload: { data: 'test' } });

      expect(logger.action).toHaveBeenCalledWith(
        'TestReducer',
        'TEST_ACTION',
        { data: 'test' }
      );
    });

    it('returns previous state when reducer throws', () => {
      const mockReducer = () => {
        throw new Error('Reducer error');
      };
      const validatedReducer = createValidatedReducer(mockReducer, {}, 'TestReducer');

      const originalState = { value: 1 };
      const result = validatedReducer(originalState, { type: 'FAIL' });

      expect(result).toBe(originalState);
      expect(logger.error).toHaveBeenCalled();
    });

    it('returns previous state when validation fails', () => {
      const mockReducer = (state, action) => {
        if (action.type === 'SET_INVALID') {
          return { ...state, count: 'not a number' };
        }
        return state;
      };
      const schema = { count: { type: 'number' } };
      const validatedReducer = createValidatedReducer(mockReducer, schema, 'TestReducer');

      const originalState = { count: 5 };
      const result = validatedReducer(originalState, { type: 'SET_INVALID' });

      expect(result).toBe(originalState);
      expect(logger.error).toHaveBeenCalled();
    });

    it('passes valid state through', () => {
      const mockReducer = (state, action) => {
        if (action.type === 'SET_VALID') {
          return { count: 10 };
        }
        return state;
      };
      const schema = { count: { type: 'number' } };
      const validatedReducer = createValidatedReducer(mockReducer, schema, 'TestReducer');

      const result = validatedReducer({ count: 5 }, { type: 'SET_VALID' });

      expect(result).toEqual({ count: 10 });
    });
  });

  describe('SCHEMA_RULES', () => {
    it('provides seat rule (1-9)', () => {
      expect(SCHEMA_RULES.seat).toEqual({
        type: 'number',
        min: 1,
        max: 9,
      });
    });

    it('provides seatArray rule', () => {
      expect(SCHEMA_RULES.seatArray).toEqual({
        type: 'array',
        items: 'number',
      });
    });

    it('provides street rule with valid enum', () => {
      expect(SCHEMA_RULES.street.type).toBe('string');
      expect(SCHEMA_RULES.street.enum).toContain('preflop');
      expect(SCHEMA_RULES.street.enum).toContain('flop');
      expect(SCHEMA_RULES.street.enum).toContain('turn');
      expect(SCHEMA_RULES.street.enum).toContain('river');
      expect(SCHEMA_RULES.street.enum).toContain('showdown');
    });

    it('provides boolean rule', () => {
      expect(SCHEMA_RULES.boolean).toEqual({ type: 'boolean' });
    });

    it('provides optional string and number rules', () => {
      expect(SCHEMA_RULES.optionalString).toEqual({
        type: 'string',
        required: false,
      });
      expect(SCHEMA_RULES.optionalNumber).toEqual({
        type: 'number',
        required: false,
      });
    });

    it('provides object and array rules', () => {
      expect(SCHEMA_RULES.object).toEqual({ type: 'object' });
      expect(SCHEMA_RULES.array).toEqual({ type: 'array' });
    });
  });
});
