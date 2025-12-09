/**
 * displayUtils.test.js - Tests for display and formatting utilities
 */

import { describe, it, expect } from 'vitest';
import {
  isRedCard,
  isRedSuit,
  getCardAbbreviation,
  getHandAbbreviation,
  formatTime12Hour,
  formatDateTime,
  calculateTotalRebuy,
} from '../displayUtils';

describe('isRedCard', () => {
  it('returns true for hearts cards', () => {
    expect(isRedCard('A♥')).toBe(true);
    expect(isRedCard('K♥')).toBe(true);
    expect(isRedCard('2♥')).toBe(true);
  });

  it('returns true for diamonds cards', () => {
    expect(isRedCard('A♦')).toBe(true);
    expect(isRedCard('K♦')).toBe(true);
    expect(isRedCard('2♦')).toBe(true);
  });

  it('returns false for spades cards', () => {
    expect(isRedCard('A♠')).toBe(false);
    expect(isRedCard('K♠')).toBe(false);
  });

  it('returns false for clubs cards', () => {
    expect(isRedCard('A♣')).toBe(false);
    expect(isRedCard('K♣')).toBe(false);
  });

  it('handles null and undefined inputs', () => {
    expect(isRedCard(null)).toBeFalsy();
    expect(isRedCard(undefined)).toBeFalsy();
  });

  it('handles empty string', () => {
    expect(isRedCard('')).toBeFalsy();
  });

  it('handles invalid card strings', () => {
    expect(isRedCard('invalid')).toBe(false);
    expect(isRedCard('Ah')).toBe(false);
  });
});

describe('isRedSuit', () => {
  it('returns true for hearts', () => {
    expect(isRedSuit('♥')).toBe(true);
  });

  it('returns true for diamonds', () => {
    expect(isRedSuit('♦')).toBe(true);
  });

  it('returns false for spades', () => {
    expect(isRedSuit('♠')).toBe(false);
  });

  it('returns false for clubs', () => {
    expect(isRedSuit('♣')).toBe(false);
  });

  it('returns false for invalid suits', () => {
    expect(isRedSuit('h')).toBe(false);
    expect(isRedSuit('d')).toBe(false);
    expect(isRedSuit('')).toBe(false);
    expect(isRedSuit(null)).toBe(false);
  });
});

describe('getCardAbbreviation', () => {
  it('converts hearts cards correctly', () => {
    expect(getCardAbbreviation('A♥')).toBe('Ah');
    expect(getCardAbbreviation('K♥')).toBe('Kh');
    expect(getCardAbbreviation('Q♥')).toBe('Qh');
  });

  it('converts diamonds cards correctly', () => {
    expect(getCardAbbreviation('A♦')).toBe('Ad');
    expect(getCardAbbreviation('K♦')).toBe('Kd');
    expect(getCardAbbreviation('Q♦')).toBe('Qd');
  });

  it('converts clubs cards correctly', () => {
    expect(getCardAbbreviation('A♣')).toBe('Ac');
    expect(getCardAbbreviation('K♣')).toBe('Kc');
    expect(getCardAbbreviation('Q♣')).toBe('Qc');
  });

  it('converts spades cards correctly', () => {
    expect(getCardAbbreviation('A♠')).toBe('As');
    expect(getCardAbbreviation('K♠')).toBe('Ks');
    expect(getCardAbbreviation('Q♠')).toBe('Qs');
  });

  it('converts all ranks correctly', () => {
    expect(getCardAbbreviation('A♠')).toBe('As');
    expect(getCardAbbreviation('K♠')).toBe('Ks');
    expect(getCardAbbreviation('Q♠')).toBe('Qs');
    expect(getCardAbbreviation('J♠')).toBe('Js');
    expect(getCardAbbreviation('T♠')).toBe('Ts');
    expect(getCardAbbreviation('9♠')).toBe('9s');
    expect(getCardAbbreviation('8♠')).toBe('8s');
    expect(getCardAbbreviation('7♠')).toBe('7s');
    expect(getCardAbbreviation('6♠')).toBe('6s');
    expect(getCardAbbreviation('5♠')).toBe('5s');
    expect(getCardAbbreviation('4♠')).toBe('4s');
    expect(getCardAbbreviation('3♠')).toBe('3s');
    expect(getCardAbbreviation('2♠')).toBe('2s');
  });

  it('returns empty string for null or undefined', () => {
    expect(getCardAbbreviation(null)).toBe('');
    expect(getCardAbbreviation(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(getCardAbbreviation('')).toBe('');
  });

  it('respects custom suitAbbrev parameter', () => {
    const customAbbrev = { '♥': 'H', '♦': 'D', '♣': 'C', '♠': 'S' };
    expect(getCardAbbreviation('A♥', customAbbrev)).toBe('AH');
    expect(getCardAbbreviation('K♠', customAbbrev)).toBe('KS');
  });
});

describe('getHandAbbreviation', () => {
  it('converts two-card hands correctly', () => {
    expect(getHandAbbreviation(['A♥', 'K♠'])).toBe('AhKs');
    expect(getHandAbbreviation(['Q♦', 'J♣'])).toBe('QdJc');
    expect(getHandAbbreviation(['T♠', '9♥'])).toBe('Ts9h');
  });

  it('handles pocket pairs', () => {
    expect(getHandAbbreviation(['A♠', 'A♥'])).toBe('AsAh');
    expect(getHandAbbreviation(['K♦', 'K♣'])).toBe('KdKc');
  });

  it('returns empty string for null or undefined', () => {
    expect(getHandAbbreviation(null)).toBe('');
    expect(getHandAbbreviation(undefined)).toBe('');
  });

  it('returns empty string for arrays with wrong length', () => {
    expect(getHandAbbreviation([])).toBe('');
    expect(getHandAbbreviation(['A♠'])).toBe('');
    expect(getHandAbbreviation(['A♠', 'K♥', 'Q♦'])).toBe('');
  });

  it('returns empty string if either card is invalid', () => {
    expect(getHandAbbreviation(['', 'K♥'])).toBe('');
    expect(getHandAbbreviation(['A♠', ''])).toBe('');
    expect(getHandAbbreviation(['', ''])).toBe('');
    expect(getHandAbbreviation([null, 'K♥'])).toBe('');
    expect(getHandAbbreviation(['A♠', null])).toBe('');
  });

  it('respects custom suitAbbrev parameter', () => {
    const customAbbrev = { '♥': 'H', '♦': 'D', '♣': 'C', '♠': 'S' };
    expect(getHandAbbreviation(['A♥', 'K♠'], customAbbrev)).toBe('AHKS');
  });
});

describe('formatTime12Hour', () => {
  it('formats times with correct structure', () => {
    // Use fixed timestamp
    const timestamp = new Date('2025-01-01T15:30:00Z').getTime();
    const result = formatTime12Hour(timestamp);
    // Result should be in 12-hour format with AM/PM
    expect(result).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
    expect(result).toBeTruthy();
  });

  it('includes minutes in output', () => {
    const timestamp = new Date('2025-01-01T14:45:00Z').getTime();
    const result = formatTime12Hour(timestamp);
    // Should have :45 in the output
    expect(result).toMatch(/45/);
  });

  it('formats different times consistently', () => {
    const morning = new Date('2025-01-01T08:00:00').getTime();
    const afternoon = new Date('2025-01-01T16:00:00').getTime();

    const morningResult = formatTime12Hour(morning);
    const afternoonResult = formatTime12Hour(afternoon);

    expect(morningResult).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
    expect(afternoonResult).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
  });

  it('returns empty string for null or undefined', () => {
    expect(formatTime12Hour(null)).toBe('');
    expect(formatTime12Hour(undefined)).toBe('');
  });

  it('returns empty string for zero timestamp', () => {
    expect(formatTime12Hour(0)).toBe('');
  });

  it('handles valid timestamp format', () => {
    const timestamp = Date.now();
    const result = formatTime12Hour(timestamp);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
  });
});

describe('formatDateTime', () => {
  it('formats date and time together', () => {
    // January 15, 2025, 2:30 PM UTC
    const timestamp = new Date('2025-01-15T14:30:00Z').getTime();
    const result = formatDateTime(timestamp);
    // Result will vary by timezone but should contain date elements
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result).toMatch(/Jan/);
  });

  it('returns empty string for null or undefined', () => {
    expect(formatDateTime(null)).toBe('');
    expect(formatDateTime(undefined)).toBe('');
  });

  it('returns empty string for zero timestamp', () => {
    expect(formatDateTime(0)).toBe('');
  });

  it('handles valid timestamp format', () => {
    const timestamp = Date.now();
    const result = formatDateTime(timestamp);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    // Should contain month abbreviation and time
    expect(result).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
  });
});

describe('calculateTotalRebuy', () => {
  it('calculates sum of rebuy amounts', () => {
    const rebuys = [
      { timestamp: 1234567890, amount: 100 },
      { timestamp: 1234567891, amount: 200 },
      { timestamp: 1234567892, amount: 50 },
    ];
    expect(calculateTotalRebuy(rebuys)).toBe(350);
  });

  it('handles empty array', () => {
    expect(calculateTotalRebuy([])).toBe(0);
  });

  it('handles undefined input with default parameter', () => {
    expect(calculateTotalRebuy()).toBe(0);
  });

  it('handles null input', () => {
    expect(calculateTotalRebuy(null)).toBe(0);
  });

  it('handles non-array input', () => {
    expect(calculateTotalRebuy('invalid')).toBe(0);
    expect(calculateTotalRebuy(123)).toBe(0);
    expect(calculateTotalRebuy({})).toBe(0);
  });

  it('handles transactions with missing amount field', () => {
    const rebuys = [
      { timestamp: 1234567890, amount: 100 },
      { timestamp: 1234567891 }, // missing amount
      { timestamp: 1234567892, amount: 50 },
    ];
    expect(calculateTotalRebuy(rebuys)).toBe(150);
  });

  it('handles transactions with null or undefined amounts', () => {
    const rebuys = [
      { timestamp: 1234567890, amount: 100 },
      { timestamp: 1234567891, amount: null },
      { timestamp: 1234567892, amount: undefined },
      { timestamp: 1234567893, amount: 50 },
    ];
    expect(calculateTotalRebuy(rebuys)).toBe(150);
  });

  it('handles zero amounts', () => {
    const rebuys = [
      { timestamp: 1234567890, amount: 0 },
      { timestamp: 1234567891, amount: 100 },
      { timestamp: 1234567892, amount: 0 },
    ];
    expect(calculateTotalRebuy(rebuys)).toBe(100);
  });

  it('handles negative amounts (refunds)', () => {
    const rebuys = [
      { timestamp: 1234567890, amount: 100 },
      { timestamp: 1234567891, amount: -20 },
      { timestamp: 1234567892, amount: 50 },
    ];
    expect(calculateTotalRebuy(rebuys)).toBe(130);
  });

  it('handles decimal amounts', () => {
    const rebuys = [
      { timestamp: 1234567890, amount: 100.50 },
      { timestamp: 1234567891, amount: 75.25 },
    ];
    expect(calculateTotalRebuy(rebuys)).toBe(175.75);
  });

  it('handles single rebuy transaction', () => {
    const rebuys = [
      { timestamp: 1234567890, amount: 500 },
    ];
    expect(calculateTotalRebuy(rebuys)).toBe(500);
  });
});
