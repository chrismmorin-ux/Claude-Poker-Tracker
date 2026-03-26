/**
 * actionUtils.test.js - Tests for action styling and display utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getActionDisplayName,
  getOverlayStatus,
  allCardsAssigned,
  getActionAbbreviation,
} from '../actionUtils';
import { getActionBadgeStyle, getActionSeatStyle } from '../../constants/designTokens';
import {
  ACTIONS,
  SEAT_STATUS,
  createEmptyPlayerCards,
} from '../../test/utils';

describe('getActionDisplayName', () => {
  describe('fold actions', () => {
    it('returns "fold" for fold action', () => {
      expect(getActionDisplayName('fold')).toBe('fold');
    });

    it('returns "fold" for fold_to_cbet action', () => {
      expect(getActionDisplayName('fold_to_cbet')).toBe('fold');
    });

    it('returns "fold" for fold_to_cr action', () => {
      expect(getActionDisplayName('fold_to_cr')).toBe('fold');
    });
  });

  describe('primitive actions', () => {
    it('returns "check" for check', () => {
      expect(getActionDisplayName('check')).toBe('check');
    });

    it('returns "call" for call', () => {
      expect(getActionDisplayName('call')).toBe('call');
    });

    it('returns "bet" for bet', () => {
      expect(getActionDisplayName('bet')).toBe('bet');
    });

    it('returns "raise" for raise', () => {
      expect(getActionDisplayName('raise')).toBe('raise');
    });
  });

  describe('showdown actions', () => {
    it('returns "muck" for mucked', () => {
      expect(getActionDisplayName('mucked')).toBe('muck');
    });

    it('returns "won" for won', () => {
      expect(getActionDisplayName('won')).toBe('won');
    });
  });

  describe('edge cases', () => {
    it('returns action as-is for unknown actions', () => {
      expect(getActionDisplayName('UNKNOWN')).toBe('UNKNOWN');
      expect(getActionDisplayName('custom_action')).toBe('custom_action');
    });

    it('returns empty string for null', () => {
      expect(getActionDisplayName(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(getActionDisplayName(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(getActionDisplayName('')).toBe('');
    });
  });
});

describe('getActionBadgeStyle', () => {
  describe('fold actions', () => {
    it('returns red style object for fold', () => {
      expect(getActionBadgeStyle('fold')).toEqual({ backgroundColor: '#dc2626', color: '#ffffff' });
    });

    it('returns red style object for fold_to_cbet', () => {
      expect(getActionBadgeStyle('fold_to_cbet')).toEqual({ backgroundColor: '#dc2626', color: '#ffffff' });
    });

    it('returns red style object for fold_to_cr', () => {
      expect(getActionBadgeStyle('fold_to_cr')).toEqual({ backgroundColor: '#dc2626', color: '#ffffff' });
    });
  });

  describe('action-specific colors', () => {
    it('returns cyan for check', () => {
      expect(getActionBadgeStyle('check')).toEqual({ backgroundColor: '#0891b2', color: '#ffffff' });
    });

    it('returns blue for call', () => {
      expect(getActionBadgeStyle('call')).toEqual({ backgroundColor: '#2563eb', color: '#ffffff' });
    });

    it('returns green for bet', () => {
      expect(getActionBadgeStyle('bet')).toEqual({ backgroundColor: '#16a34a', color: '#ffffff' });
    });

    it('returns orange for raise', () => {
      expect(getActionBadgeStyle('raise')).toEqual({ backgroundColor: '#ea580c', color: '#ffffff' });
    });

    it('returns gray for mucked', () => {
      expect(getActionBadgeStyle('mucked')).toEqual({ backgroundColor: '#6b7280', color: '#ffffff' });
    });

    it('returns gold for won', () => {
      expect(getActionBadgeStyle('won')).toEqual({ backgroundColor: '#d4a847', color: '#ffffff' });
    });
  });

  describe('default color', () => {
    it('returns default gray for unknown actions', () => {
      expect(getActionBadgeStyle('UNKNOWN')).toEqual({ backgroundColor: '#e5e7eb', color: '#111827' });
      expect(getActionBadgeStyle('custom')).toEqual({ backgroundColor: '#e5e7eb', color: '#111827' });
    });

    it('returns default gray for null', () => {
      expect(getActionBadgeStyle(null)).toEqual({ backgroundColor: '#e5e7eb', color: '#111827' });
    });

    it('returns default gray for undefined', () => {
      expect(getActionBadgeStyle(undefined)).toEqual({ backgroundColor: '#e5e7eb', color: '#111827' });
    });
  });
});

describe('getActionSeatStyle', () => {
  describe('fold actions', () => {
    it('returns red hex for fold', () => {
      expect(getActionSeatStyle('fold')).toEqual({ bg: '#dc2626', ring: '#fca5a5' });
    });

    it('returns red hex for fold_to_cbet', () => {
      expect(getActionSeatStyle('fold_to_cbet')).toEqual({ bg: '#dc2626', ring: '#fca5a5' });
    });

    it('returns red hex for fold_to_cr', () => {
      expect(getActionSeatStyle('fold_to_cr')).toEqual({ bg: '#dc2626', ring: '#fca5a5' });
    });
  });

  describe('primitive action styles', () => {
    it('returns cyan hex for check', () => {
      expect(getActionSeatStyle('check')).toEqual({ bg: '#0891b2', ring: '#67e8f9' });
    });

    it('returns blue hex for call', () => {
      expect(getActionSeatStyle('call')).toEqual({ bg: '#2563eb', ring: '#93c5fd' });
    });

    it('returns green hex for bet', () => {
      expect(getActionSeatStyle('bet')).toEqual({ bg: '#16a34a', ring: '#86efac' });
    });

    it('returns orange hex for raise', () => {
      expect(getActionSeatStyle('raise')).toEqual({ bg: '#ea580c', ring: '#fdba74' });
    });
  });

  describe('default style', () => {
    it('returns default green hex for unknown actions', () => {
      expect(getActionSeatStyle('UNKNOWN')).toEqual({ bg: '#16a34a', ring: '#86efac' });
    });

    it('returns default green hex for null', () => {
      expect(getActionSeatStyle(null)).toEqual({ bg: '#16a34a', ring: '#86efac' });
    });

    it('returns mucked hex for mucked', () => {
      expect(getActionSeatStyle('mucked')).toEqual({ bg: '#6b7280', ring: '#6b7280' });
    });

    it('returns won hex for won', () => {
      expect(getActionSeatStyle('won')).toEqual({ bg: '#d4a847', ring: '#d4a847' });
    });
  });
});

describe('getOverlayStatus', () => {
  it('returns FOLDED status when seat is folded', () => {
    expect(getOverlayStatus(SEAT_STATUS.FOLDED, false, false)).toBe(SEAT_STATUS.FOLDED);
  });

  it('returns ABSENT status when seat is absent', () => {
    expect(getOverlayStatus(SEAT_STATUS.ABSENT, false, false)).toBe(SEAT_STATUS.ABSENT);
  });

  it('returns "mucked" when seat is mucked', () => {
    expect(getOverlayStatus(null, true, false)).toBe('mucked');
  });

  it('returns "won" when seat has won', () => {
    expect(getOverlayStatus(null, false, true)).toBe('won');
  });

  it('returns null when no overlay needed', () => {
    expect(getOverlayStatus(null, false, false)).toBeNull();
  });

  it('prioritizes FOLDED over mucked', () => {
    expect(getOverlayStatus(SEAT_STATUS.FOLDED, true, false)).toBe(SEAT_STATUS.FOLDED);
  });

  it('prioritizes ABSENT over mucked', () => {
    expect(getOverlayStatus(SEAT_STATUS.ABSENT, true, false)).toBe(SEAT_STATUS.ABSENT);
  });

  it('prioritizes mucked over won', () => {
    expect(getOverlayStatus(null, true, true)).toBe('mucked');
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
      { seat: 2, action: 'mucked', street: 'showdown', order: 1 },
    ];

    const result = allCardsAssigned(
      2,
      () => null,
      actionSequence,
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
      { seat: 2, action: 'won', street: 'showdown', order: 1 },
    ];

    const result = allCardsAssigned(
      2,
      () => null,
      actionSequence,
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
      1,
      holeCards,
      allPlayerCards
    );
    expect(result).toBe(false);
  });
});

describe('getActionAbbreviation', () => {
  it('returns correct abbreviation for primitive actions', () => {
    expect(getActionAbbreviation('fold')).toBe('FLD');
    expect(getActionAbbreviation('check')).toBe('CHK');
    expect(getActionAbbreviation('call')).toBe('CAL');
    expect(getActionAbbreviation('bet')).toBe('BET');
    expect(getActionAbbreviation('raise')).toBe('RSE');
  });

  it('returns correct abbreviation for showdown actions', () => {
    expect(getActionAbbreviation('mucked')).toBe('MCK');
    expect(getActionAbbreviation('won')).toBe('WON');
  });

  it('returns correct abbreviation for legacy fold variants', () => {
    expect(getActionAbbreviation('fold_to_cbet')).toBe('F/C');
    expect(getActionAbbreviation('fold_to_cr')).toBe('F/CR');
  });

  it('returns first 3 uppercase chars for unknown actions', () => {
    expect(getActionAbbreviation('unknown_action')).toBe('UNK');
    expect(getActionAbbreviation('custom')).toBe('CUS');
  });

  it('returns ??? for null', () => {
    expect(getActionAbbreviation(null)).toBe('???');
  });

  it('returns ??? for undefined', () => {
    expect(getActionAbbreviation(undefined)).toBe('???');
  });

  it('returns ??? for empty string', () => {
    expect(getActionAbbreviation('')).toBe('???');
  });

  it('handles short strings (less than 3 chars)', () => {
    expect(getActionAbbreviation('ab')).toBe('AB');
    expect(getActionAbbreviation('x')).toBe('X');
  });
});
