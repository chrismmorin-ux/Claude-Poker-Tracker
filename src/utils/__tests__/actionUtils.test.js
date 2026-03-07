/**
 * actionUtils.test.js - Tests for action styling and display utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getActionDisplayName,
  getActionColor,
  getSeatActionStyle,
  getOverlayStatus,
  allCardsAssigned,
  getActionAbbreviation,
} from '../actionUtils';
import {
  ACTIONS,
  ACTION_ABBREV,
  SEAT_STATUS,
  isFoldAction,
  createEmptyPlayerCards,
} from '../../test/utils';

describe('getActionDisplayName', () => {
  describe('fold actions', () => {
    it('returns "fold" for FOLD action', () => {
      expect(getActionDisplayName(ACTIONS.FOLD, isFoldAction, ACTIONS)).toBe('fold');
    });

    it('returns "fold" for FOLD_TO_CBET action', () => {
      expect(getActionDisplayName(ACTIONS.FOLD_TO_CBET, isFoldAction, ACTIONS)).toBe('fold');
    });

    it('returns "fold" for FOLD_TO_CR action', () => {
      expect(getActionDisplayName(ACTIONS.FOLD_TO_CR, isFoldAction, ACTIONS)).toBe('fold');
    });
  });

  describe('preflop actions', () => {
    it('returns "limp" for LIMP action', () => {
      expect(getActionDisplayName(ACTIONS.LIMP, isFoldAction, ACTIONS)).toBe('limp');
    });

    it('returns "call" for CALL action', () => {
      expect(getActionDisplayName(ACTIONS.CALL, isFoldAction, ACTIONS)).toBe('call');
    });

    it('returns "open" for OPEN action', () => {
      expect(getActionDisplayName(ACTIONS.OPEN, isFoldAction, ACTIONS)).toBe('open');
    });

    it('returns "3bet" for THREE_BET action', () => {
      expect(getActionDisplayName(ACTIONS.THREE_BET, isFoldAction, ACTIONS)).toBe('3bet');
    });

    it('returns "4bet" for FOUR_BET action', () => {
      expect(getActionDisplayName(ACTIONS.FOUR_BET, isFoldAction, ACTIONS)).toBe('4bet');
    });
  });

  describe('postflop cbet actions', () => {
    it('returns "cbet IP (S)" for CBET_IP_SMALL', () => {
      expect(getActionDisplayName(ACTIONS.CBET_IP_SMALL, isFoldAction, ACTIONS)).toBe('cbet IP (S)');
    });

    it('returns "cbet IP (L)" for CBET_IP_LARGE', () => {
      expect(getActionDisplayName(ACTIONS.CBET_IP_LARGE, isFoldAction, ACTIONS)).toBe('cbet IP (L)');
    });

    it('returns "cbet OOP (S)" for CBET_OOP_SMALL', () => {
      expect(getActionDisplayName(ACTIONS.CBET_OOP_SMALL, isFoldAction, ACTIONS)).toBe('cbet OOP (S)');
    });

    it('returns "cbet OOP (L)" for CBET_OOP_LARGE', () => {
      expect(getActionDisplayName(ACTIONS.CBET_OOP_LARGE, isFoldAction, ACTIONS)).toBe('cbet OOP (L)');
    });
  });

  describe('postflop other actions', () => {
    it('returns "check" for CHECK action', () => {
      expect(getActionDisplayName(ACTIONS.CHECK, isFoldAction, ACTIONS)).toBe('check');
    });

    it('returns "check-raise" for CHECK_RAISE action', () => {
      expect(getActionDisplayName(ACTIONS.CHECK_RAISE, isFoldAction, ACTIONS)).toBe('check-raise');
    });

    it('returns "donk" for DONK action', () => {
      expect(getActionDisplayName(ACTIONS.DONK, isFoldAction, ACTIONS)).toBe('donk');
    });

    it('returns "stab" for STAB action', () => {
      expect(getActionDisplayName(ACTIONS.STAB, isFoldAction, ACTIONS)).toBe('stab');
    });
  });

  describe('showdown actions', () => {
    it('returns "muck" for MUCKED action', () => {
      expect(getActionDisplayName(ACTIONS.MUCKED, isFoldAction, ACTIONS)).toBe('muck');
    });

    it('returns "won" for WON action', () => {
      expect(getActionDisplayName(ACTIONS.WON, isFoldAction, ACTIONS)).toBe('won');
    });
  });

  describe('edge cases', () => {
    it('returns action as-is for unknown actions', () => {
      expect(getActionDisplayName('UNKNOWN', isFoldAction, ACTIONS)).toBe('UNKNOWN');
      expect(getActionDisplayName('custom_action', isFoldAction, ACTIONS)).toBe('custom_action');
    });

    it('returns empty string for null', () => {
      expect(getActionDisplayName(null, isFoldAction, ACTIONS)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(getActionDisplayName(undefined, isFoldAction, ACTIONS)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(getActionDisplayName('', isFoldAction, ACTIONS)).toBe('');
    });
  });
});

describe('getActionColor', () => {
  describe('fold actions', () => {
    it('returns red background for FOLD', () => {
      const result = getActionColor(ACTIONS.FOLD, isFoldAction, ACTIONS);
      expect(result).toBe('bg-red-300 text-red-900');
    });

    it('returns red background for FOLD_TO_CBET', () => {
      const result = getActionColor(ACTIONS.FOLD_TO_CBET, isFoldAction, ACTIONS);
      expect(result).toBe('bg-red-300 text-red-900');
    });

    it('returns red background for FOLD_TO_CR', () => {
      const result = getActionColor(ACTIONS.FOLD_TO_CR, isFoldAction, ACTIONS);
      expect(result).toBe('bg-red-300 text-red-900');
    });
  });

  describe('action-specific colors', () => {
    it('returns gray for LIMP', () => {
      expect(getActionColor(ACTIONS.LIMP, isFoldAction, ACTIONS)).toBe('bg-gray-300 text-gray-900');
    });

    it('returns blue for CALL', () => {
      expect(getActionColor(ACTIONS.CALL, isFoldAction, ACTIONS)).toBe('bg-blue-200 text-blue-900');
    });

    it('returns blue for CHECK', () => {
      expect(getActionColor(ACTIONS.CHECK, isFoldAction, ACTIONS)).toBe('bg-blue-200 text-blue-900');
    });

    it('returns green for OPEN', () => {
      expect(getActionColor(ACTIONS.OPEN, isFoldAction, ACTIONS)).toBe('bg-green-300 text-green-900');
    });

    it('returns yellow for THREE_BET', () => {
      expect(getActionColor(ACTIONS.THREE_BET, isFoldAction, ACTIONS)).toBe('bg-yellow-300 text-yellow-900');
    });

    it('returns yellow for STAB', () => {
      expect(getActionColor(ACTIONS.STAB, isFoldAction, ACTIONS)).toBe('bg-yellow-300 text-yellow-900');
    });

    it('returns orange for FOUR_BET', () => {
      expect(getActionColor(ACTIONS.FOUR_BET, isFoldAction, ACTIONS)).toBe('bg-orange-300 text-orange-900');
    });

    it('returns orange for DONK', () => {
      expect(getActionColor(ACTIONS.DONK, isFoldAction, ACTIONS)).toBe('bg-orange-300 text-orange-900');
    });

    it('returns orange for CHECK_RAISE', () => {
      expect(getActionColor(ACTIONS.CHECK_RAISE, isFoldAction, ACTIONS)).toBe('bg-orange-300 text-orange-900');
    });

    it('returns light green for CBET_IP_SMALL', () => {
      expect(getActionColor(ACTIONS.CBET_IP_SMALL, isFoldAction, ACTIONS)).toBe('bg-green-200 text-green-900');
    });

    it('returns light green for CBET_IP_LARGE', () => {
      expect(getActionColor(ACTIONS.CBET_IP_LARGE, isFoldAction, ACTIONS)).toBe('bg-green-200 text-green-900');
    });

    it('returns light green for CBET_OOP_SMALL', () => {
      expect(getActionColor(ACTIONS.CBET_OOP_SMALL, isFoldAction, ACTIONS)).toBe('bg-green-200 text-green-900');
    });

    it('returns light green for CBET_OOP_LARGE', () => {
      expect(getActionColor(ACTIONS.CBET_OOP_LARGE, isFoldAction, ACTIONS)).toBe('bg-green-200 text-green-900');
    });

    it('returns dark gray for MUCKED', () => {
      expect(getActionColor(ACTIONS.MUCKED, isFoldAction, ACTIONS)).toBe('bg-gray-400 text-gray-900');
    });

    it('returns green for WON', () => {
      expect(getActionColor(ACTIONS.WON, isFoldAction, ACTIONS)).toBe('bg-green-400 text-green-900');
    });
  });

  describe('default color', () => {
    it('returns default gray for unknown actions', () => {
      expect(getActionColor('UNKNOWN', isFoldAction, ACTIONS)).toBe('bg-gray-100 text-gray-900');
      expect(getActionColor('custom', isFoldAction, ACTIONS)).toBe('bg-gray-100 text-gray-900');
    });

    it('returns default gray for null', () => {
      expect(getActionColor(null, isFoldAction, ACTIONS)).toBe('bg-gray-100 text-gray-900');
    });

    it('returns default gray for undefined', () => {
      expect(getActionColor(undefined, isFoldAction, ACTIONS)).toBe('bg-gray-100 text-gray-900');
    });
  });
});

describe('getSeatActionStyle', () => {
  describe('fold actions', () => {
    it('returns red style for FOLD', () => {
      const result = getSeatActionStyle(ACTIONS.FOLD, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-red-400', ring: 'ring-red-300' });
    });

    it('returns red style for FOLD_TO_CBET', () => {
      const result = getSeatActionStyle(ACTIONS.FOLD_TO_CBET, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-red-400', ring: 'ring-red-300' });
    });

    it('returns red style for FOLD_TO_CR', () => {
      const result = getSeatActionStyle(ACTIONS.FOLD_TO_CR, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-red-400', ring: 'ring-red-300' });
    });
  });

  describe('action-specific styles', () => {
    it('returns gray style for LIMP', () => {
      const result = getSeatActionStyle(ACTIONS.LIMP, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-gray-400', ring: 'ring-gray-300' });
    });

    it('returns blue style for CALL', () => {
      const result = getSeatActionStyle(ACTIONS.CALL, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-blue-300', ring: 'ring-blue-200' });
    });

    it('returns blue style for CHECK', () => {
      const result = getSeatActionStyle(ACTIONS.CHECK, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-blue-300', ring: 'ring-blue-200' });
    });

    it('returns green style for OPEN', () => {
      const result = getSeatActionStyle(ACTIONS.OPEN, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-green-400', ring: 'ring-green-300' });
    });

    it('returns yellow style for THREE_BET', () => {
      const result = getSeatActionStyle(ACTIONS.THREE_BET, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-yellow-400', ring: 'ring-yellow-300' });
    });

    it('returns yellow style for STAB', () => {
      const result = getSeatActionStyle(ACTIONS.STAB, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-yellow-400', ring: 'ring-yellow-300' });
    });

    it('returns orange style for FOUR_BET', () => {
      const result = getSeatActionStyle(ACTIONS.FOUR_BET, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-orange-400', ring: 'ring-orange-300' });
    });

    it('returns orange style for DONK', () => {
      const result = getSeatActionStyle(ACTIONS.DONK, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-orange-400', ring: 'ring-orange-300' });
    });

    it('returns orange style for CHECK_RAISE', () => {
      const result = getSeatActionStyle(ACTIONS.CHECK_RAISE, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-orange-400', ring: 'ring-orange-300' });
    });

    it('returns dark green style for CBET_IP_SMALL', () => {
      const result = getSeatActionStyle(ACTIONS.CBET_IP_SMALL, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-green-500', ring: 'ring-green-300' });
    });

    it('returns dark green style for CBET_IP_LARGE', () => {
      const result = getSeatActionStyle(ACTIONS.CBET_IP_LARGE, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-green-500', ring: 'ring-green-300' });
    });

    it('returns dark green style for CBET_OOP_SMALL', () => {
      const result = getSeatActionStyle(ACTIONS.CBET_OOP_SMALL, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-green-500', ring: 'ring-green-300' });
    });

    it('returns dark green style for CBET_OOP_LARGE', () => {
      const result = getSeatActionStyle(ACTIONS.CBET_OOP_LARGE, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-green-500', ring: 'ring-green-300' });
    });
  });

  describe('default style', () => {
    it('returns default green style for unknown actions', () => {
      const result = getSeatActionStyle('UNKNOWN', isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-green-500', ring: 'ring-green-300' });
    });

    it('returns default green style for null', () => {
      const result = getSeatActionStyle(null, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-green-500', ring: 'ring-green-300' });
    });

    it('returns default green style for MUCKED', () => {
      const result = getSeatActionStyle(ACTIONS.MUCKED, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-green-500', ring: 'ring-green-300' });
    });

    it('returns default green style for WON', () => {
      const result = getSeatActionStyle(ACTIONS.WON, isFoldAction, ACTIONS);
      expect(result).toEqual({ bg: 'bg-green-500', ring: 'ring-green-300' });
    });
  });
});

describe('getOverlayStatus', () => {
  it('returns FOLDED status when seat is folded', () => {
    const result = getOverlayStatus(SEAT_STATUS.FOLDED, false, false, SEAT_STATUS);
    expect(result).toBe(SEAT_STATUS.FOLDED);
  });

  it('returns ABSENT status when seat is absent', () => {
    const result = getOverlayStatus(SEAT_STATUS.ABSENT, false, false, SEAT_STATUS);
    expect(result).toBe(SEAT_STATUS.ABSENT);
  });

  it('returns "mucked" when seat is mucked', () => {
    const result = getOverlayStatus(null, true, false, SEAT_STATUS);
    expect(result).toBe('mucked');
  });

  it('returns "won" when seat has won', () => {
    const result = getOverlayStatus(null, false, true, SEAT_STATUS);
    expect(result).toBe('won');
  });

  it('returns null when no overlay needed', () => {
    const result = getOverlayStatus(null, false, false, SEAT_STATUS);
    expect(result).toBeNull();
  });

  it('prioritizes FOLDED over mucked', () => {
    const result = getOverlayStatus(SEAT_STATUS.FOLDED, true, false, SEAT_STATUS);
    expect(result).toBe(SEAT_STATUS.FOLDED);
  });

  it('prioritizes ABSENT over mucked', () => {
    const result = getOverlayStatus(SEAT_STATUS.ABSENT, true, false, SEAT_STATUS);
    expect(result).toBe(SEAT_STATUS.ABSENT);
  });

  it('prioritizes mucked over won', () => {
    const result = getOverlayStatus(null, true, true, SEAT_STATUS);
    expect(result).toBe('mucked');
  });
});

describe('allCardsAssigned', () => {
  it('returns true when all active seats have cards', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[1] = ['A♠', 'K♠'];
    allPlayerCards[2] = ['Q♥', 'J♥'];

    const result = allCardsAssigned(
      2,
      () => null,
      [], // empty actionSequence
      ACTIONS,
      SEAT_STATUS,
      1,
      ['A♠', 'K♠'],
      allPlayerCards
    );
    expect(result).toBe(true);
  });

  it('returns false when any active seat missing cards', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[1] = ['A♠', 'K♠'];
    allPlayerCards[2] = ['', ''];

    const result = allCardsAssigned(
      2,
      () => null,
      [],
      ACTIONS,
      SEAT_STATUS,
      1,
      ['A♠', 'K♠'],
      allPlayerCards
    );
    expect(result).toBe(false);
  });

  it('skips folded seats', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[1] = ['A♠', 'K♠'];

    const result = allCardsAssigned(
      2,
      (seat) => seat === 2 ? SEAT_STATUS.FOLDED : null,
      [],
      ACTIONS,
      SEAT_STATUS,
      1,
      ['A♠', 'K♠'],
      allPlayerCards
    );
    expect(result).toBe(true);
  });

  it('skips absent seats', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[1] = ['A♠', 'K♠'];

    const result = allCardsAssigned(
      2,
      (seat) => seat === 2 ? SEAT_STATUS.ABSENT : null,
      [],
      ACTIONS,
      SEAT_STATUS,
      1,
      ['A♠', 'K♠'],
      allPlayerCards
    );
    expect(result).toBe(true);
  });

  it('skips mucked seats', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[1] = ['A♠', 'K♠'];

    const actionSequence = [
      { seat: 2, action: ACTIONS.MUCKED, street: 'showdown', order: 1 },
    ];

    const result = allCardsAssigned(
      2,
      () => null,
      actionSequence,
      ACTIONS,
      SEAT_STATUS,
      1,
      ['A♠', 'K♠'],
      allPlayerCards
    );
    expect(result).toBe(true);
  });

  it('skips won seats', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[1] = ['A♠', 'K♠'];

    const actionSequence = [
      { seat: 2, action: ACTIONS.WON, street: 'showdown', order: 1 },
    ];

    const result = allCardsAssigned(
      2,
      () => null,
      actionSequence,
      ACTIONS,
      SEAT_STATUS,
      1,
      ['A♠', 'K♠'],
      allPlayerCards
    );
    expect(result).toBe(true);
  });

  it('uses mySeat hole cards for my seat', () => {
    const allPlayerCards = createEmptyPlayerCards();
    const holeCards = ['A♠', 'K♠'];

    const result = allCardsAssigned(
      1,
      () => null,
      [],
      ACTIONS,
      SEAT_STATUS,
      1,
      holeCards,
      allPlayerCards
    );
    expect(result).toBe(true);
  });

  it('returns false when mySeat missing hole cards', () => {
    const allPlayerCards = createEmptyPlayerCards();
    const holeCards = ['', ''];

    const result = allCardsAssigned(
      1,
      () => null,
      [],
      ACTIONS,
      SEAT_STATUS,
      1,
      holeCards,
      allPlayerCards
    );
    expect(result).toBe(false);
  });
});

describe('getActionAbbreviation', () => {
  it('returns correct abbreviation for all ACTIONS', () => {
    expect(getActionAbbreviation(ACTIONS.FOLD, ACTION_ABBREV)).toBe('FLD');
    expect(getActionAbbreviation(ACTIONS.LIMP, ACTION_ABBREV)).toBe('LMP');
    expect(getActionAbbreviation(ACTIONS.CALL, ACTION_ABBREV)).toBe('CAL');
    expect(getActionAbbreviation(ACTIONS.OPEN, ACTION_ABBREV)).toBe('OPN');
    expect(getActionAbbreviation(ACTIONS.THREE_BET, ACTION_ABBREV)).toBe('3BT');
    expect(getActionAbbreviation(ACTIONS.FOUR_BET, ACTION_ABBREV)).toBe('4BT');
    expect(getActionAbbreviation(ACTIONS.CBET_IP_SMALL, ACTION_ABBREV)).toBe('C-S');
    expect(getActionAbbreviation(ACTIONS.CBET_IP_LARGE, ACTION_ABBREV)).toBe('C-L');
    expect(getActionAbbreviation(ACTIONS.CBET_OOP_SMALL, ACTION_ABBREV)).toBe('CO-S');
    expect(getActionAbbreviation(ACTIONS.CBET_OOP_LARGE, ACTION_ABBREV)).toBe('CO-L');
    expect(getActionAbbreviation(ACTIONS.CHECK, ACTION_ABBREV)).toBe('CHK');
    expect(getActionAbbreviation(ACTIONS.CHECK_RAISE, ACTION_ABBREV)).toBe('C/R');
    expect(getActionAbbreviation(ACTIONS.DONK, ACTION_ABBREV)).toBe('DNK');
    expect(getActionAbbreviation(ACTIONS.STAB, ACTION_ABBREV)).toBe('STB');
    expect(getActionAbbreviation(ACTIONS.FOLD_TO_CBET, ACTION_ABBREV)).toBe('F/C');
    expect(getActionAbbreviation(ACTIONS.FOLD_TO_CR, ACTION_ABBREV)).toBe('F/CR');
    expect(getActionAbbreviation(ACTIONS.MUCKED, ACTION_ABBREV)).toBe('MCK');
    expect(getActionAbbreviation(ACTIONS.WON, ACTION_ABBREV)).toBe('WON');
  });

  it('returns first 3 uppercase chars for unknown actions', () => {
    expect(getActionAbbreviation('unknown_action', ACTION_ABBREV)).toBe('UNK');
    expect(getActionAbbreviation('custom', ACTION_ABBREV)).toBe('CUS');
  });

  it('returns ??? for null', () => {
    expect(getActionAbbreviation(null, ACTION_ABBREV)).toBe('???');
  });

  it('returns ??? for undefined', () => {
    expect(getActionAbbreviation(undefined, ACTION_ABBREV)).toBe('???');
  });

  it('returns ??? for empty string', () => {
    expect(getActionAbbreviation('', ACTION_ABBREV)).toBe('???');
  });

  it('handles short strings (less than 3 chars)', () => {
    expect(getActionAbbreviation('ab', ACTION_ABBREV)).toBe('AB');
    expect(getActionAbbreviation('x', ACTION_ABBREV)).toBe('X');
  });
});

