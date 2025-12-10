/**
 * Tests for primitiveActionValidation.js
 */

import { describe, it, expect } from 'vitest';
import {
  validatePrimitiveAction,
  getValidActions,
  isOpeningAction,
  isAggressiveAction,
  isPassiveAction,
} from '../primitiveActionValidation';
import { PRIMITIVE_ACTIONS } from '../../constants/primitiveActions';

describe('validatePrimitiveAction', () => {
  describe('when no bet to call (betToCall = 0)', () => {
    const state = { betToCall: 0 };

    it('CHECK is valid', () => {
      const result = validatePrimitiveAction(PRIMITIVE_ACTIONS.CHECK, state);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('BET is valid', () => {
      const result = validatePrimitiveAction(PRIMITIVE_ACTIONS.BET, state);
      expect(result.valid).toBe(true);
    });

    it('CALL is invalid', () => {
      const result = validatePrimitiveAction(PRIMITIVE_ACTIONS.CALL, state);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Nothing to call');
    });

    it('RAISE is invalid', () => {
      const result = validatePrimitiveAction(PRIMITIVE_ACTIONS.RAISE, state);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Nothing to raise (use bet)');
    });

    it('FOLD is valid with warning', () => {
      const result = validatePrimitiveAction(PRIMITIVE_ACTIONS.FOLD, state);
      expect(result.valid).toBe(true);
      expect(result.warning).toBe('Folding when you could check');
    });
  });

  describe('when facing a bet (betToCall > 0)', () => {
    const state = { betToCall: 50 };

    it('CHECK is invalid', () => {
      const result = validatePrimitiveAction(PRIMITIVE_ACTIONS.CHECK, state);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cannot check when facing a bet');
    });

    it('BET is invalid', () => {
      const result = validatePrimitiveAction(PRIMITIVE_ACTIONS.BET, state);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cannot bet when facing a bet (use raise)');
    });

    it('CALL is valid', () => {
      const result = validatePrimitiveAction(PRIMITIVE_ACTIONS.CALL, state);
      expect(result.valid).toBe(true);
    });

    it('RAISE is valid', () => {
      const result = validatePrimitiveAction(PRIMITIVE_ACTIONS.RAISE, state);
      expect(result.valid).toBe(true);
    });

    it('FOLD is valid', () => {
      const result = validatePrimitiveAction(PRIMITIVE_ACTIONS.FOLD, state);
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });
  });

  describe('invalid actions', () => {
    it('rejects non-primitive actions', () => {
      const result = validatePrimitiveAction('3bet', { betToCall: 0 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid action: 3bet');
    });

    it('rejects unknown actions', () => {
      const result = validatePrimitiveAction('invalid', { betToCall: 0 });
      expect(result.valid).toBe(false);
    });
  });

  describe('default state values', () => {
    it('defaults betToCall to 0', () => {
      const result = validatePrimitiveAction(PRIMITIVE_ACTIONS.CHECK, {});
      expect(result.valid).toBe(true);
    });
  });
});

describe('getValidActions', () => {
  it('returns check, bet, fold when no bet to call', () => {
    const actions = getValidActions({ betToCall: 0 });
    expect(actions).toContain(PRIMITIVE_ACTIONS.CHECK);
    expect(actions).toContain(PRIMITIVE_ACTIONS.BET);
    expect(actions).toContain(PRIMITIVE_ACTIONS.FOLD);
    expect(actions).not.toContain(PRIMITIVE_ACTIONS.CALL);
    expect(actions).not.toContain(PRIMITIVE_ACTIONS.RAISE);
  });

  it('returns call, raise, fold when facing a bet', () => {
    const actions = getValidActions({ betToCall: 100 });
    expect(actions).toContain(PRIMITIVE_ACTIONS.CALL);
    expect(actions).toContain(PRIMITIVE_ACTIONS.RAISE);
    expect(actions).toContain(PRIMITIVE_ACTIONS.FOLD);
    expect(actions).not.toContain(PRIMITIVE_ACTIONS.CHECK);
    expect(actions).not.toContain(PRIMITIVE_ACTIONS.BET);
  });

  it('defaults to no bet when state is empty', () => {
    const actions = getValidActions({});
    expect(actions).toContain(PRIMITIVE_ACTIONS.CHECK);
    expect(actions).toContain(PRIMITIVE_ACTIONS.BET);
  });
});

describe('isOpeningAction', () => {
  it('returns true for BET when no bet to call', () => {
    expect(isOpeningAction(PRIMITIVE_ACTIONS.BET, 0)).toBe(true);
  });

  it('returns false for BET when facing a bet', () => {
    expect(isOpeningAction(PRIMITIVE_ACTIONS.BET, 50)).toBe(false);
  });

  it('returns false for non-BET actions', () => {
    expect(isOpeningAction(PRIMITIVE_ACTIONS.RAISE, 0)).toBe(false);
    expect(isOpeningAction(PRIMITIVE_ACTIONS.CHECK, 0)).toBe(false);
    expect(isOpeningAction(PRIMITIVE_ACTIONS.CALL, 50)).toBe(false);
  });
});

describe('isAggressiveAction', () => {
  it('returns true for BET and RAISE', () => {
    expect(isAggressiveAction(PRIMITIVE_ACTIONS.BET)).toBe(true);
    expect(isAggressiveAction(PRIMITIVE_ACTIONS.RAISE)).toBe(true);
  });

  it('returns false for passive actions', () => {
    expect(isAggressiveAction(PRIMITIVE_ACTIONS.CHECK)).toBe(false);
    expect(isAggressiveAction(PRIMITIVE_ACTIONS.CALL)).toBe(false);
    expect(isAggressiveAction(PRIMITIVE_ACTIONS.FOLD)).toBe(false);
  });
});

describe('isPassiveAction', () => {
  it('returns true for CHECK and CALL', () => {
    expect(isPassiveAction(PRIMITIVE_ACTIONS.CHECK)).toBe(true);
    expect(isPassiveAction(PRIMITIVE_ACTIONS.CALL)).toBe(true);
  });

  it('returns false for aggressive actions', () => {
    expect(isPassiveAction(PRIMITIVE_ACTIONS.BET)).toBe(false);
    expect(isPassiveAction(PRIMITIVE_ACTIONS.RAISE)).toBe(false);
  });

  it('returns false for FOLD', () => {
    expect(isPassiveAction(PRIMITIVE_ACTIONS.FOLD)).toBe(false);
  });
});
