/**
 * actionValidation.test.js - Tests for poker action sequence validation
 */

import { describe, it, expect } from 'vitest';
import {
  isTerminalAction,
  getLastAction,
  hasOpeningBet,
  hasCheck,
  hasCbet,
  validateActionSequence,
  getValidNextActions,
} from '../actionValidation';
import { ACTIONS, TERMINAL_ACTIONS } from '../../constants/gameConstants';

describe('isTerminalAction', () => {
  it('identifies fold as terminal', () => {
    expect(isTerminalAction(ACTIONS.FOLD)).toBe(true);
    expect(isTerminalAction(ACTIONS.FOLD_TO_CR)).toBe(true);
    expect(isTerminalAction(ACTIONS.FOLD_TO_CBET)).toBe(true);
  });

  it('identifies won as terminal', () => {
    expect(isTerminalAction(ACTIONS.WON)).toBe(true);
  });

  it('identifies non-terminal actions', () => {
    expect(isTerminalAction(ACTIONS.CALL)).toBe(false);
    expect(isTerminalAction(ACTIONS.CHECK)).toBe(false);
    expect(isTerminalAction(ACTIONS.OPEN)).toBe(false);
    expect(isTerminalAction(ACTIONS.MUCKED)).toBe(false);
  });
});

describe('getLastAction', () => {
  it('returns null for empty array', () => {
    expect(getLastAction([])).toBe(null);
  });

  it('returns null for undefined/null', () => {
    expect(getLastAction(undefined)).toBe(null);
    expect(getLastAction(null)).toBe(null);
  });

  it('returns last action from array', () => {
    expect(getLastAction([ACTIONS.OPEN])).toBe(ACTIONS.OPEN);
    expect(getLastAction([ACTIONS.LIMP, ACTIONS.CALL])).toBe(ACTIONS.CALL);
  });
});

describe('hasOpeningBet', () => {
  it('detects opening bet actions', () => {
    expect(hasOpeningBet([ACTIONS.OPEN], ACTIONS)).toBe(true);
    expect(hasOpeningBet([ACTIONS.THREE_BET], ACTIONS)).toBe(true);
    expect(hasOpeningBet([ACTIONS.FOUR_BET], ACTIONS)).toBe(true);
    expect(hasOpeningBet([ACTIONS.DONK], ACTIONS)).toBe(true);
    expect(hasOpeningBet([ACTIONS.STAB], ACTIONS)).toBe(true);
  });

  it('returns false for non-betting actions', () => {
    expect(hasOpeningBet([ACTIONS.CHECK], ACTIONS)).toBe(false);
    expect(hasOpeningBet([ACTIONS.CALL], ACTIONS)).toBe(false);
    expect(hasOpeningBet([ACTIONS.FOLD], ACTIONS)).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(hasOpeningBet([], ACTIONS)).toBe(false);
    expect(hasOpeningBet(null, ACTIONS)).toBe(false);
  });
});

describe('hasCheck', () => {
  it('detects check in action sequence', () => {
    expect(hasCheck([ACTIONS.CHECK], ACTIONS)).toBe(true);
    expect(hasCheck([ACTIONS.CHECK, ACTIONS.CHECK_RAISE], ACTIONS)).toBe(true);
  });

  it('returns false when no check', () => {
    expect(hasCheck([ACTIONS.CALL], ACTIONS)).toBe(false);
    expect(hasCheck([ACTIONS.OPEN], ACTIONS)).toBe(false);
    expect(hasCheck([], ACTIONS)).toBe(false);
  });
});

describe('hasCbet', () => {
  it('detects cbet actions', () => {
    expect(hasCbet([ACTIONS.CBET_IP_SMALL], ACTIONS)).toBe(true);
    expect(hasCbet([ACTIONS.CBET_IP_LARGE], ACTIONS)).toBe(true);
    expect(hasCbet([ACTIONS.CBET_OOP_SMALL], ACTIONS)).toBe(true);
    expect(hasCbet([ACTIONS.CBET_OOP_LARGE], ACTIONS)).toBe(true);
  });

  it('returns false for non-cbet actions', () => {
    expect(hasCbet([ACTIONS.OPEN], ACTIONS)).toBe(false);
    expect(hasCbet([ACTIONS.DONK], ACTIONS)).toBe(false);
    expect(hasCbet([], ACTIONS)).toBe(false);
  });
});

describe('validateActionSequence - preflop', () => {
  it('allows limp as first action', () => {
    const result = validateActionSequence([], ACTIONS.LIMP, 'preflop', ACTIONS);
    expect(result.valid).toBe(true);
  });

  it('rejects limp after previous action', () => {
    const result = validateActionSequence([ACTIONS.CALL], ACTIONS.LIMP, 'preflop', ACTIONS);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cannot limp');
  });

  it('allows open as first action', () => {
    const result = validateActionSequence([], ACTIONS.OPEN, 'preflop', ACTIONS);
    expect(result.valid).toBe(true);
  });

  it('rejects open after previous action', () => {
    const result = validateActionSequence([ACTIONS.LIMP], ACTIONS.OPEN, 'preflop', ACTIONS);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cannot open');
  });

  it('rejects call after limp', () => {
    const result = validateActionSequence([ACTIONS.LIMP], ACTIONS.CALL, 'preflop', ACTIONS);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cannot call after limp');
  });

  it('allows fold anytime', () => {
    expect(validateActionSequence([], ACTIONS.FOLD, 'preflop', ACTIONS).valid).toBe(true);
    expect(validateActionSequence([ACTIONS.CALL], ACTIONS.FOLD, 'preflop', ACTIONS).valid).toBe(true);
  });

  it('rejects action after terminal action', () => {
    const result = validateActionSequence([ACTIONS.FOLD], ACTIONS.CALL, 'preflop', ACTIONS);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cannot act after');
  });

  it('allows 3bet and 4bet', () => {
    expect(validateActionSequence([], ACTIONS.THREE_BET, 'preflop', ACTIONS).valid).toBe(true);
    expect(validateActionSequence([ACTIONS.CALL], ACTIONS.FOUR_BET, 'preflop', ACTIONS).valid).toBe(true);
  });
});

describe('validateActionSequence - postflop', () => {
  const postflopStreets = ['flop', 'turn', 'river'];

  postflopStreets.forEach(street => {
    describe(`on ${street}`, () => {
      it('allows check as first action', () => {
        const result = validateActionSequence([], ACTIONS.CHECK, street, ACTIONS);
        expect(result.valid).toBe(true);
      });

      it('rejects check after betting', () => {
        const result = validateActionSequence([ACTIONS.CBET_IP_SMALL], ACTIONS.CHECK, street, ACTIONS);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Cannot check after betting');
      });

      it('allows cbet as first action', () => {
        const result = validateActionSequence([], ACTIONS.CBET_IP_SMALL, street, ACTIONS);
        expect(result.valid).toBe(true);
      });

      it('rejects cbet after check', () => {
        const result = validateActionSequence([ACTIONS.CHECK], ACTIONS.CBET_IP_LARGE, street, ACTIONS);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Cannot cbet after checking');
      });

      it('rejects call without a bet', () => {
        const result = validateActionSequence([], ACTIONS.CALL, street, ACTIONS);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Cannot call without a bet');
      });

      it('allows call after bet', () => {
        const result = validateActionSequence([ACTIONS.CBET_IP_SMALL], ACTIONS.CALL, street, ACTIONS);
        expect(result.valid).toBe(true);
      });

      it('requires check before check-raise', () => {
        const result = validateActionSequence([], ACTIONS.CHECK_RAISE, street, ACTIONS);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Must check before check-raising');
      });

      it('allows check-raise after check', () => {
        const result = validateActionSequence([ACTIONS.CHECK], ACTIONS.CHECK_RAISE, street, ACTIONS);
        expect(result.valid).toBe(true);
      });

      it('allows donk/stab as first action only', () => {
        expect(validateActionSequence([], ACTIONS.DONK, street, ACTIONS).valid).toBe(true);
        expect(validateActionSequence([], ACTIONS.STAB, street, ACTIONS).valid).toBe(true);

        const donkResult = validateActionSequence([ACTIONS.CHECK], ACTIONS.DONK, street, ACTIONS);
        expect(donkResult.valid).toBe(false);
      });

      it('allows fold anytime', () => {
        expect(validateActionSequence([], ACTIONS.FOLD, street, ACTIONS).valid).toBe(true);
        expect(validateActionSequence([ACTIONS.CHECK], ACTIONS.FOLD_TO_CBET, street, ACTIONS).valid).toBe(true);
      });
    });
  });
});

describe('validateActionSequence - showdown', () => {
  it('allows mucked as first action', () => {
    const result = validateActionSequence([], ACTIONS.MUCKED, 'showdown', ACTIONS);
    expect(result.valid).toBe(true);
  });

  it('allows won as first action', () => {
    const result = validateActionSequence([], ACTIONS.WON, 'showdown', ACTIONS);
    expect(result.valid).toBe(true);
  });

  it('rejects second showdown action', () => {
    const result = validateActionSequence([ACTIONS.MUCKED], ACTIONS.WON, 'showdown', ACTIONS);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('one showdown action');
  });

  it('rejects non-showdown actions', () => {
    const result = validateActionSequence([], ACTIONS.CHECK, 'showdown', ACTIONS);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid showdown action');
  });
});

describe('validateActionSequence - edge cases', () => {
  it('rejects null action', () => {
    const result = validateActionSequence([], null, 'preflop', ACTIONS);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('No action specified');
  });

  it('rejects invalid street', () => {
    const result = validateActionSequence([], ACTIONS.FOLD, 'invalid_street', ACTIONS);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid street');
  });
});

describe('getValidNextActions', () => {
  it('returns valid preflop first actions', () => {
    const valid = getValidNextActions([], 'preflop', ACTIONS);
    expect(valid).toContain(ACTIONS.FOLD);
    expect(valid).toContain(ACTIONS.LIMP);
    expect(valid).toContain(ACTIONS.OPEN);
    expect(valid).not.toContain(ACTIONS.CHECK);
  });

  it('returns valid postflop first actions', () => {
    const valid = getValidNextActions([], 'flop', ACTIONS);
    expect(valid).toContain(ACTIONS.CHECK);
    expect(valid).toContain(ACTIONS.CBET_IP_SMALL);
    expect(valid).toContain(ACTIONS.DONK);
    expect(valid).not.toContain(ACTIONS.CALL); // Can't call without bet
    expect(valid).not.toContain(ACTIONS.CHECK_RAISE); // Need to check first
  });

  it('returns valid showdown actions', () => {
    const valid = getValidNextActions([], 'showdown', ACTIONS);
    expect(valid).toContain(ACTIONS.MUCKED);
    expect(valid).toContain(ACTIONS.WON);
    expect(valid.length).toBe(2);
  });

  it('returns empty after terminal action', () => {
    const valid = getValidNextActions([ACTIONS.FOLD], 'preflop', ACTIONS);
    // Fold is terminal, so fold types aren't valid (they check for terminal action)
    expect(valid).toEqual([]);
  });

  it('updates valid actions after check', () => {
    const valid = getValidNextActions([ACTIONS.CHECK], 'flop', ACTIONS);
    expect(valid).toContain(ACTIONS.CHECK_RAISE);
    expect(valid).not.toContain(ACTIONS.CBET_IP_SMALL); // Can't cbet after check
  });
});
