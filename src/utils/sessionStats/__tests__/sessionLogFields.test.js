/**
 * sessionLogFields.test.js — conversions between a session record and the
 * log/edit form's fields.
 *
 * The two behaviours worth guarding hardest: midnight wrap (getting this wrong
 * is what made every $/hr in the founder's spreadsheet useless) and blank-vs-zero
 * on money fields (collapsing them would invent losses).
 */

import { describe, it, expect } from 'vitest';
import {
  toDateInputValue,
  toTimeInputValue,
  parseTimeInput,
  toTimestamp,
  resolveSessionTimes,
  formatDuration,
  parseMoneyField,
  sessionToFormValues,
  formValuesToSessionData,
} from '../sessionLogFields';

describe('toDateInputValue / toTimeInputValue', () => {
  it('formats in local time, not UTC', () => {
    // A 20:30 local start must never display as the next day.
    const ts = new Date(2026, 7, 5, 20, 30).getTime();
    expect(toDateInputValue(ts)).toBe('2026-08-05');
    expect(toTimeInputValue(ts)).toBe('20:30');
  });

  it('zero-pads single-digit months, days and clock parts', () => {
    const ts = new Date(2026, 0, 3, 9, 5).getTime();
    expect(toDateInputValue(ts)).toBe('2026-01-03');
    expect(toTimeInputValue(ts)).toBe('09:05');
  });
});

describe('parseTimeInput', () => {
  it('parses HH:MM', () => {
    expect(parseTimeInput('17:30')).toBe(17 * 60 + 30);
    expect(parseTimeInput('00:00')).toBe(0);
    expect(parseTimeInput('23:59')).toBe(23 * 60 + 59);
  });

  it('rejects malformed or out-of-range clocks', () => {
    expect(parseTimeInput('')).toBeNull();
    expect(parseTimeInput('24:00')).toBeNull();
    expect(parseTimeInput('12:60')).toBeNull();
    expect(parseTimeInput('1730')).toBeNull();
    expect(parseTimeInput(null)).toBeNull();
  });
});

describe('toTimestamp', () => {
  it('combines a date field and clock field', () => {
    expect(toTimestamp('2026-08-05', '17:30')).toBe(new Date(2026, 7, 5, 17, 30).getTime());
  });

  it('returns null when either half is missing or malformed', () => {
    expect(toTimestamp('', '17:30')).toBeNull();
    expect(toTimestamp('2026-08-05', '')).toBeNull();
    expect(toTimestamp('05/08/2026', '17:30')).toBeNull();
  });
});

describe('resolveSessionTimes', () => {
  it('computes a same-day session', () => {
    const r = resolveSessionTimes('2026-08-05', '17:30', '21:00');
    expect(r.durationHours).toBeCloseTo(3.5, 6);
    expect(r.endTime - r.startTime).toBe(3.5 * 3600000);
  });

  it('wraps past midnight instead of going negative', () => {
    // 22:00 → 03:45. The spreadsheet rendered this as -44520:00:00.
    const r = resolveSessionTimes('2026-05-23', '22:00', '03:45');
    expect(r.durationHours).toBeCloseTo(5.75, 6);
    expect(r.endTime).toBeGreaterThan(r.startTime);
    expect(new Date(r.endTime).getDate()).toBe(24);
  });

  it('handles a session ending exactly at midnight', () => {
    const r = resolveSessionTimes('2026-08-05', '20:00', '00:00');
    expect(r.durationHours).toBeCloseTo(4, 6);
  });

  it('leaves the end open when no out-time is given', () => {
    const r = resolveSessionTimes('2026-08-05', '17:30', '');
    expect(r.startTime).not.toBeNull();
    expect(r.endTime).toBeNull();
    expect(r.durationHours).toBeNull();
  });

  it('returns all nulls without a start', () => {
    expect(resolveSessionTimes('', '', '')).toEqual({
      startTime: null, endTime: null, durationHours: null,
    });
  });
});

describe('formatDuration', () => {
  it('formats hours and minutes', () => {
    expect(formatDuration(3.5)).toBe('3h 30m');
    expect(formatDuration(4)).toBe('4h');
    expect(formatDuration(0.75)).toBe('45m');
  });

  it('returns null for a missing duration', () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(undefined)).toBeNull();
    expect(formatDuration(NaN)).toBeNull();
  });
});

describe('parseMoneyField', () => {
  it('parses plain and formatted amounts', () => {
    expect(parseMoneyField('1401')).toBe(1401);
    expect(parseMoneyField('$1,401')).toBe(1401);
    expect(parseMoneyField('20.34')).toBe(20.34);
  });

  it('distinguishes blank from zero', () => {
    // Load-bearing: blank cash-out = "not recorded" (excluded from P&L);
    // zero = "busted" (a full buy-in loss). Collapsing them invents losses.
    expect(parseMoneyField('')).toBeNull();
    expect(parseMoneyField('   ')).toBeNull();
    expect(parseMoneyField('0')).toBe(0);
  });

  it('returns null for junk', () => {
    expect(parseMoneyField('abc')).toBeNull();
  });
});

describe('sessionToFormValues', () => {
  const session = {
    startTime: new Date(2026, 7, 5, 17, 30).getTime(),
    endTime: new Date(2026, 7, 5, 21, 0).getTime(),
    venue: 'Wind Creek',
    gameType: '1/3',
    buyIn: 500,
    rebuyTransactions: [{ timestamp: 1, amount: 200 }, { timestamp: 2, amount: 100 }],
    cashOut: 1401,
    tipAmount: 20,
    notes: 'ran hot',
  };

  it('round-trips a session into form fields', () => {
    expect(sessionToFormValues(session)).toEqual({
      date: '2026-08-05',
      timeIn: '17:30',
      timeOut: '21:00',
      venue: 'Wind Creek',
      gameType: '1/3',
      buyIn: '500',
      rebuys: '300',   // summed across transactions
      cashOut: '1401',
      tipAmount: '20',
      notes: 'ran hot',
    });
  });

  it('shows a zero cash-out as "0", not blank', () => {
    expect(sessionToFormValues({ ...session, cashOut: 0 }).cashOut).toBe('0');
  });

  it('leaves an unrecorded cash-out blank', () => {
    expect(sessionToFormValues({ ...session, cashOut: null }).cashOut).toBe('');
  });

  it('leaves time-out blank on a session that never ended', () => {
    expect(sessionToFormValues({ ...session, endTime: null }).timeOut).toBe('');
  });
});

describe('formValuesToSessionData', () => {
  const valid = {
    date: '2026-08-05', timeIn: '17:30', timeOut: '21:00',
    venue: 'Wind Creek', gameType: '1/3',
    buyIn: '500', rebuys: '', cashOut: '1401', tipAmount: '', notes: '',
  };

  it('builds session data from valid values', () => {
    const { valid: ok, data } = formValuesToSessionData(valid);
    expect(ok).toBe(true);
    expect(data.buyIn).toBe(500);
    expect(data.cashOut).toBe(1401);
    expect(data.durationHours).toBeCloseTo(3.5, 6);
    expect(data.rebuyTransactions).toEqual([]);
  });

  it('turns a rebuy total into one transaction stamped at the start', () => {
    const { data } = formValuesToSessionData({ ...valid, rebuys: '400' });
    expect(data.rebuyTransactions).toEqual([{ timestamp: data.startTime, amount: 400 }]);
  });

  it('requires a date and a start time', () => {
    const r = formValuesToSessionData({ ...valid, date: '', timeIn: '' });
    expect(r.valid).toBe(false);
    expect(r.errors.date).toBeTruthy();
    expect(r.errors.timeIn).toBeTruthy();
  });

  it('rejects negative money', () => {
    expect(formValuesToSessionData({ ...valid, buyIn: '-5' }).errors.buyIn).toBeTruthy();
    expect(formValuesToSessionData({ ...valid, cashOut: '-5' }).errors.cashOut).toBeTruthy();
  });

  it('rejects non-numeric money', () => {
    expect(formValuesToSessionData({ ...valid, cashOut: 'lots' }).errors.cashOut).toBeTruthy();
  });

  it('accepts a blank cash-out — an unfinished log is still worth saving', () => {
    const r = formValuesToSessionData({ ...valid, cashOut: '' });
    expect(r.valid).toBe(true);
    expect(r.data.cashOut).toBeNull();
  });

  it('accepts a zero cash-out as a real busted result', () => {
    const r = formValuesToSessionData({ ...valid, cashOut: '0' });
    expect(r.valid).toBe(true);
    expect(r.data.cashOut).toBe(0);
  });

  it('carries the midnight wrap through to the record', () => {
    const r = formValuesToSessionData({ ...valid, timeIn: '22:00', timeOut: '03:45' });
    expect(r.data.durationHours).toBeCloseTo(5.75, 6);
    expect(r.data.endTime).toBeGreaterThan(r.data.startTime);
  });
});
