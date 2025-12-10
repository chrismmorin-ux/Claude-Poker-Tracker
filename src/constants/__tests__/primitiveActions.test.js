/**
 * Tests for primitiveActions.js
 */

import { describe, it, expect } from 'vitest';
import {
  PRIMITIVE_ACTIONS,
  LEGACY_TO_PRIMITIVE,
  PRIMITIVE_ACTION_VALUES,
  isPrimitiveAction,
  toPrimitive,
} from '../primitiveActions';

describe('PRIMITIVE_ACTIONS', () => {
  it('has exactly 5 primitive actions', () => {
    expect(Object.keys(PRIMITIVE_ACTIONS)).toHaveLength(5);
  });

  it('contains check, bet, call, raise, fold', () => {
    expect(PRIMITIVE_ACTIONS.CHECK).toBe('check');
    expect(PRIMITIVE_ACTIONS.BET).toBe('bet');
    expect(PRIMITIVE_ACTIONS.CALL).toBe('call');
    expect(PRIMITIVE_ACTIONS.RAISE).toBe('raise');
    expect(PRIMITIVE_ACTIONS.FOLD).toBe('fold');
  });

  it('values are all lowercase strings', () => {
    Object.values(PRIMITIVE_ACTIONS).forEach(value => {
      expect(typeof value).toBe('string');
      expect(value).toBe(value.toLowerCase());
    });
  });
});

describe('LEGACY_TO_PRIMITIVE', () => {
  it('maps all 18 legacy actions', () => {
    // 16 betting actions + 2 showdown states = 18
    expect(Object.keys(LEGACY_TO_PRIMITIVE)).toHaveLength(18);
  });

  describe('fold actions', () => {
    it('maps fold to FOLD', () => {
      expect(LEGACY_TO_PRIMITIVE['fold']).toBe(PRIMITIVE_ACTIONS.FOLD);
    });

    it('maps fold_to_cr to FOLD', () => {
      expect(LEGACY_TO_PRIMITIVE['fold_to_cr']).toBe(PRIMITIVE_ACTIONS.FOLD);
    });

    it('maps fold_to_cbet to FOLD', () => {
      expect(LEGACY_TO_PRIMITIVE['fold_to_cbet']).toBe(PRIMITIVE_ACTIONS.FOLD);
    });
  });

  describe('call actions', () => {
    it('maps limp to CALL', () => {
      expect(LEGACY_TO_PRIMITIVE['limp']).toBe(PRIMITIVE_ACTIONS.CALL);
    });

    it('maps call to CALL', () => {
      expect(LEGACY_TO_PRIMITIVE['call']).toBe(PRIMITIVE_ACTIONS.CALL);
    });
  });

  describe('raise actions', () => {
    it('maps open to RAISE', () => {
      expect(LEGACY_TO_PRIMITIVE['open']).toBe(PRIMITIVE_ACTIONS.RAISE);
    });

    it('maps 3bet to RAISE', () => {
      expect(LEGACY_TO_PRIMITIVE['3bet']).toBe(PRIMITIVE_ACTIONS.RAISE);
    });

    it('maps 4bet to RAISE', () => {
      expect(LEGACY_TO_PRIMITIVE['4bet']).toBe(PRIMITIVE_ACTIONS.RAISE);
    });

    it('maps check_raise to RAISE', () => {
      expect(LEGACY_TO_PRIMITIVE['check_raise']).toBe(PRIMITIVE_ACTIONS.RAISE);
    });
  });

  describe('bet actions', () => {
    it('maps cbet variants to BET', () => {
      expect(LEGACY_TO_PRIMITIVE['cbet_ip_small']).toBe(PRIMITIVE_ACTIONS.BET);
      expect(LEGACY_TO_PRIMITIVE['cbet_ip_large']).toBe(PRIMITIVE_ACTIONS.BET);
      expect(LEGACY_TO_PRIMITIVE['cbet_oop_small']).toBe(PRIMITIVE_ACTIONS.BET);
      expect(LEGACY_TO_PRIMITIVE['cbet_oop_large']).toBe(PRIMITIVE_ACTIONS.BET);
    });

    it('maps donk to BET', () => {
      expect(LEGACY_TO_PRIMITIVE['donk']).toBe(PRIMITIVE_ACTIONS.BET);
    });

    it('maps stab to BET', () => {
      expect(LEGACY_TO_PRIMITIVE['stab']).toBe(PRIMITIVE_ACTIONS.BET);
    });
  });

  describe('check action', () => {
    it('maps check to CHECK', () => {
      expect(LEGACY_TO_PRIMITIVE['check']).toBe(PRIMITIVE_ACTIONS.CHECK);
    });
  });

  describe('showdown states', () => {
    it('maps mucked to null', () => {
      expect(LEGACY_TO_PRIMITIVE['mucked']).toBeNull();
    });

    it('maps won to null', () => {
      expect(LEGACY_TO_PRIMITIVE['won']).toBeNull();
    });
  });
});

describe('PRIMITIVE_ACTION_VALUES', () => {
  it('is an array of 5 values', () => {
    expect(Array.isArray(PRIMITIVE_ACTION_VALUES)).toBe(true);
    expect(PRIMITIVE_ACTION_VALUES).toHaveLength(5);
  });

  it('contains all primitive actions', () => {
    expect(PRIMITIVE_ACTION_VALUES).toContain('check');
    expect(PRIMITIVE_ACTION_VALUES).toContain('bet');
    expect(PRIMITIVE_ACTION_VALUES).toContain('call');
    expect(PRIMITIVE_ACTION_VALUES).toContain('raise');
    expect(PRIMITIVE_ACTION_VALUES).toContain('fold');
  });
});

describe('isPrimitiveAction', () => {
  it('returns true for primitive actions', () => {
    expect(isPrimitiveAction('check')).toBe(true);
    expect(isPrimitiveAction('bet')).toBe(true);
    expect(isPrimitiveAction('call')).toBe(true);
    expect(isPrimitiveAction('raise')).toBe(true);
    expect(isPrimitiveAction('fold')).toBe(true);
  });

  it('returns false for legacy actions', () => {
    expect(isPrimitiveAction('limp')).toBe(false);
    expect(isPrimitiveAction('open')).toBe(false);
    expect(isPrimitiveAction('3bet')).toBe(false);
    expect(isPrimitiveAction('cbet_ip_small')).toBe(false);
  });

  it('returns false for invalid values', () => {
    expect(isPrimitiveAction('')).toBe(false);
    expect(isPrimitiveAction(null)).toBe(false);
    expect(isPrimitiveAction(undefined)).toBe(false);
    expect(isPrimitiveAction('invalid')).toBe(false);
  });
});

describe('toPrimitive', () => {
  it('converts legacy actions to primitives', () => {
    expect(toPrimitive('limp')).toBe('call');
    expect(toPrimitive('open')).toBe('raise');
    expect(toPrimitive('3bet')).toBe('raise');
    expect(toPrimitive('cbet_ip_small')).toBe('bet');
    expect(toPrimitive('fold_to_cbet')).toBe('fold');
  });

  it('returns null for showdown states', () => {
    expect(toPrimitive('mucked')).toBeNull();
    expect(toPrimitive('won')).toBeNull();
  });

  it('returns null for unknown actions', () => {
    expect(toPrimitive('unknown')).toBeNull();
    expect(toPrimitive('')).toBeNull();
  });

  it('passes through primitive actions', () => {
    // Primitives aren't in LEGACY_TO_PRIMITIVE, so they return null
    // This is intentional - use isPrimitiveAction to check first
    expect(toPrimitive('check')).toBe('check');
  });
});
