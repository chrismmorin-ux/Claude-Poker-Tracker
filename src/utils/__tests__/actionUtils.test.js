/**
 * actionUtils.test.js - Tests for action styling and display utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getActionDisplayName,
  getActionColor,
  getSeatActionStyle,
  getOverlayStatus,
  getSeatActionSummary,
  allCardsAssigned,
  getActionAbbreviation,
  getLastAction,
  normalizeActionData,
  getActionSequenceDisplay,
} from '../actionUtils';
import {
  ACTIONS,
  ACTION_ABBREV,
  SEAT_STATUS,
  STREETS,
  isFoldAction,
} from '../../test/utils';
import {
  createEmptyPlayerCards,
  createMockIsSeatInactive,
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

describe('getSeatActionSummary', () => {
  const mockGetActionDisplayName = (action) => getActionDisplayName(action, isFoldAction, ACTIONS);
  const mockGetHandAbbreviation = (cards) => {
    if (!cards || cards.length !== 2 || !cards[0] || !cards[1]) return '';
    return `${cards[0]}${cards[1]}`;
  };

  it('returns empty array when no actions', () => {
    const result = getSeatActionSummary(
      1,
      STREETS,
      {},
      mockGetActionDisplayName,
      mockGetHandAbbreviation,
      5,
      ['', ''],
      createEmptyPlayerCards(),
      ACTIONS
    );
    expect(result).toEqual([]);
  });

  it('formats single action on single street', () => {
    const seatActions = {
      preflop: { 1: [ACTIONS.FOLD] }
    };
    const result = getSeatActionSummary(
      1,
      STREETS,
      seatActions,
      mockGetActionDisplayName,
      mockGetHandAbbreviation,
      5,
      ['', ''],
      createEmptyPlayerCards(),
      ACTIONS
    );
    expect(result).toEqual(['preflop fold']);
  });

  it('formats multiple actions on single street', () => {
    const seatActions = {
      preflop: { 1: [ACTIONS.OPEN, ACTIONS.CALL] }
    };
    const result = getSeatActionSummary(
      1,
      STREETS,
      seatActions,
      mockGetActionDisplayName,
      mockGetHandAbbreviation,
      5,
      ['', ''],
      createEmptyPlayerCards(),
      ACTIONS
    );
    expect(result).toEqual(['preflop open', 'preflop call']);
  });

  it('formats actions across multiple streets', () => {
    const seatActions = {
      preflop: { 1: [ACTIONS.OPEN] },
      flop: { 1: [ACTIONS.CHECK] },
      turn: { 1: [ACTIONS.CALL] }
    };
    const result = getSeatActionSummary(
      1,
      STREETS,
      seatActions,
      mockGetActionDisplayName,
      mockGetHandAbbreviation,
      5,
      ['', ''],
      createEmptyPlayerCards(),
      ACTIONS
    );
    expect(result).toEqual(['preflop open', 'flop check', 'turn call']);
  });

  it('formats showdown action with cards for my seat', () => {
    const seatActions = {
      showdown: { 5: [ACTIONS.WON] }
    };
    const result = getSeatActionSummary(
      5,
      STREETS,
      seatActions,
      mockGetActionDisplayName,
      mockGetHandAbbreviation,
      5,
      ['A♠', 'K♠'],
      createEmptyPlayerCards(),
      ACTIONS
    );
    expect(result).toEqual(['showdown show A♠K♠']);
  });

  it('formats showdown action with cards for other seat', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[3] = ['Q♥', 'Q♦'];
    const seatActions = {
      showdown: { 3: [ACTIONS.WON] }
    };
    const result = getSeatActionSummary(
      3,
      STREETS,
      seatActions,
      mockGetActionDisplayName,
      mockGetHandAbbreviation,
      5,
      ['', ''],
      allPlayerCards,
      ACTIONS
    );
    expect(result).toEqual(['showdown show Q♥Q♦']);
  });

  it('formats showdown action without cards as "show"', () => {
    const seatActions = {
      showdown: { 3: [ACTIONS.WON] }
    };
    const result = getSeatActionSummary(
      3,
      STREETS,
      seatActions,
      mockGetActionDisplayName,
      mockGetHandAbbreviation,
      5,
      ['', ''],
      createEmptyPlayerCards(),
      ACTIONS
    );
    expect(result).toEqual(['showdown show']);
  });

  it('formats showdown MUCKED action as "muck" not "show"', () => {
    const seatActions = {
      showdown: { 3: [ACTIONS.MUCKED] }
    };
    const result = getSeatActionSummary(
      3,
      STREETS,
      seatActions,
      mockGetActionDisplayName,
      mockGetHandAbbreviation,
      5,
      ['', ''],
      createEmptyPlayerCards(),
      ACTIONS
    );
    expect(result).toEqual(['showdown muck']);
  });

  it('handles old format (single value instead of array)', () => {
    const seatActions = {
      preflop: { 1: ACTIONS.FOLD } // Old format: single value
    };
    const result = getSeatActionSummary(
      1,
      STREETS,
      seatActions,
      mockGetActionDisplayName,
      mockGetHandAbbreviation,
      5,
      ['', ''],
      createEmptyPlayerCards(),
      ACTIONS
    );
    expect(result).toEqual(['preflop fold']);
  });

  it('skips seats with no actions on a street', () => {
    const seatActions = {
      preflop: { 2: [ACTIONS.FOLD] }, // Different seat
      flop: {} // No actions on flop
    };
    const result = getSeatActionSummary(
      1,
      STREETS,
      seatActions,
      mockGetActionDisplayName,
      mockGetHandAbbreviation,
      5,
      ['', ''],
      createEmptyPlayerCards(),
      ACTIONS
    );
    expect(result).toEqual([]);
  });
});

describe('allCardsAssigned', () => {
  const mockIsSeatInactive = createMockIsSeatInactive([]);

  it('returns true when all active seats have cards', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[1] = ['A♠', 'K♠'];
    allPlayerCards[2] = ['Q♥', 'J♥'];

    const seatActions = {};
    const result = allCardsAssigned(
      2, // only 2 seats
      () => null, // no inactive seats
      seatActions,
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
    allPlayerCards[2] = ['', '']; // Missing cards

    const seatActions = {};
    const result = allCardsAssigned(
      2,
      () => null,
      seatActions,
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
    // Seat 2 is folded and has no cards - should be skipped

    const seatActions = {};
    const mockIsSeatInactiveFolded = (seat) => seat === 2 ? SEAT_STATUS.FOLDED : null;

    const result = allCardsAssigned(
      2,
      mockIsSeatInactiveFolded,
      seatActions,
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
    // Seat 2 is absent and has no cards - should be skipped

    const seatActions = {};
    const mockIsSeatInactiveAbsent = (seat) => seat === 2 ? SEAT_STATUS.ABSENT : null;

    const result = allCardsAssigned(
      2,
      mockIsSeatInactiveAbsent,
      seatActions,
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
    // Seat 2 is mucked and has no cards - should be skipped

    const seatActions = {
      showdown: { 2: [ACTIONS.MUCKED] }
    };

    const result = allCardsAssigned(
      2,
      () => null,
      seatActions,
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
    // Seat 2 won and has no cards - should be skipped

    const seatActions = {
      showdown: { 2: [ACTIONS.WON] }
    };

    const result = allCardsAssigned(
      2,
      () => null,
      seatActions,
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

    const seatActions = {};
    const result = allCardsAssigned(
      1,
      () => null,
      seatActions,
      ACTIONS,
      SEAT_STATUS,
      1, // mySeat
      holeCards,
      allPlayerCards
    );
    expect(result).toBe(true);
  });

  it('returns false when mySeat missing hole cards', () => {
    const allPlayerCards = createEmptyPlayerCards();
    const holeCards = ['', ''];

    const seatActions = {};
    const result = allCardsAssigned(
      1,
      () => null,
      seatActions,
      ACTIONS,
      SEAT_STATUS,
      1, // mySeat
      holeCards,
      allPlayerCards
    );
    expect(result).toBe(false);
  });

  it('handles old format showdown actions (single value)', () => {
    const allPlayerCards = createEmptyPlayerCards();
    allPlayerCards[1] = ['A♠', 'K♠'];

    const seatActions = {
      showdown: { 2: ACTIONS.MUCKED } // Old format: single value
    };

    const result = allCardsAssigned(
      2,
      () => null,
      seatActions,
      ACTIONS,
      SEAT_STATUS,
      1,
      ['A♠', 'K♠'],
      allPlayerCards
    );
    expect(result).toBe(true);
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

describe('getLastAction', () => {
  it('returns last action from array', () => {
    expect(getLastAction([ACTIONS.OPEN, ACTIONS.CALL, ACTIONS.FOLD])).toBe(ACTIONS.FOLD);
  });

  it('returns single action from single-element array', () => {
    expect(getLastAction([ACTIONS.FOLD])).toBe(ACTIONS.FOLD);
  });

  it('returns null for empty array', () => {
    expect(getLastAction([])).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(getLastAction(undefined)).toBeNull();
  });

  it('returns null for null', () => {
    expect(getLastAction(null)).toBeNull();
  });

  it('returns null for non-array input', () => {
    expect(getLastAction('not-an-array')).toBeNull();
    expect(getLastAction(123)).toBeNull();
    expect(getLastAction({})).toBeNull();
  });
});

describe('normalizeActionData', () => {
  it('converts string to array', () => {
    expect(normalizeActionData(ACTIONS.FOLD)).toEqual([ACTIONS.FOLD]);
    expect(normalizeActionData('custom')).toEqual(['custom']);
  });

  it('returns array as-is', () => {
    expect(normalizeActionData([ACTIONS.FOLD])).toEqual([ACTIONS.FOLD]);
    expect(normalizeActionData([ACTIONS.OPEN, ACTIONS.CALL])).toEqual([ACTIONS.OPEN, ACTIONS.CALL]);
  });

  it('returns empty array for undefined', () => {
    expect(normalizeActionData(undefined)).toEqual([]);
  });

  it('returns empty array for null', () => {
    expect(normalizeActionData(null)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(normalizeActionData('')).toEqual([]);
  });

  it('returns empty array for non-string non-array inputs', () => {
    expect(normalizeActionData(123)).toEqual([]);
    expect(normalizeActionData({})).toEqual([]);
    expect(normalizeActionData(true)).toEqual([]);
  });
});

describe('getActionSequenceDisplay', () => {
  const mockGetActionDisplayName = (action) => getActionDisplayName(action, isFoldAction, ACTIONS);

  it('formats single action', () => {
    expect(getActionSequenceDisplay([ACTIONS.FOLD], mockGetActionDisplayName)).toBe('fold');
  });

  it('formats multiple actions with arrow separator', () => {
    const actions = [ACTIONS.OPEN, ACTIONS.THREE_BET, ACTIONS.CALL];
    expect(getActionSequenceDisplay(actions, mockGetActionDisplayName)).toBe('open → 3bet → call');
  });

  it('returns empty string for empty array', () => {
    expect(getActionSequenceDisplay([], mockGetActionDisplayName)).toBe('');
  });

  it('returns empty string for null', () => {
    expect(getActionSequenceDisplay(null, mockGetActionDisplayName)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(getActionSequenceDisplay(undefined, mockGetActionDisplayName)).toBe('');
  });

  it('handles complex action sequences', () => {
    const actions = [ACTIONS.OPEN, ACTIONS.THREE_BET, ACTIONS.FOUR_BET, ACTIONS.CALL];
    expect(getActionSequenceDisplay(actions, mockGetActionDisplayName)).toBe('open → 3bet → 4bet → call');
  });
});
