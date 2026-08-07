/**
 * sheetImport.test.js — normalisation of the founder's bankroll sheet.
 *
 * Several tests assert against the REAL sheet (src/data/strategySheetSessions.js)
 * rather than fixtures. That is deliberate: the defects being corrected here are
 * specific to that data (three year typos, nine rows with no P&L, one undated
 * row, four overnight sessions), and a fixture-only suite would pass while the
 * actual import stayed broken.
 */

import { describe, it, expect } from 'vitest';
import {
  parseMoney,
  parseClockToMinutes,
  computeDurationHours,
  parseSheetDate,
  classifySession,
  buildImportKey,
  toSessionRecord,
  buildSessionRecords,
} from '../sheetImport';
import { STRATEGY_SHEET_SESSIONS } from '../../../data/strategySheetSessions';

const iso = (t) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const pnlOf = (r) =>
  r.cashOut === null
    ? null
    : r.cashOut - (r.buyIn || 0) - r.rebuyTransactions.reduce((s, t) => s + t.amount, 0);

describe('parseMoney', () => {
  it('parses the sheet money formats', () => {
    expect(parseMoney('$1,401')).toBe(1401);
    expect(parseMoney('$0')).toBe(0);
    expect(parseMoney('500')).toBe(500);
    expect(parseMoney('$20.34')).toBe(20.34);
  });

  it('returns null for empty and error cells rather than 0', () => {
    // Load-bearing: a blank cash-out means "unknown", not "busted for zero".
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('   ')).toBeNull();
    expect(parseMoney(undefined)).toBeNull();
    expect(parseMoney('#DIV/0!')).toBeNull();
    expect(parseMoney('n/a')).toBeNull();
  });
});

describe('parseClockToMinutes', () => {
  it('parses HHMM including dropped leading zeros', () => {
    expect(parseClockToMinutes('1630')).toBe(16 * 60 + 30);
    expect(parseClockToMinutes('845')).toBe(8 * 60 + 45);
    expect(parseClockToMinutes('2')).toBe(2);
    expect(parseClockToMinutes('0')).toBe(0);
  });

  it('rejects nonsense clocks instead of rolling them over', () => {
    expect(parseClockToMinutes('1290')).toBeNull(); // minute 90
    expect(parseClockToMinutes('2500')).toBeNull(); // hour 25
    expect(parseClockToMinutes('')).toBeNull();
    expect(parseClockToMinutes('abc')).toBeNull();
  });
});

describe('computeDurationHours', () => {
  it('computes a same-day session length', () => {
    expect(computeDurationHours('1630', '2130')).toBe(5);
    expect(computeDurationHours('1321', '1630')).toBeCloseTo(3.15, 5);
  });

  it('wraps past midnight instead of returning a negative span', () => {
    // 23 May 25: in 2200, out 0345 — the sheet renders this as -44520:00:00.
    expect(computeDurationHours('2200', '345')).toBeCloseTo(5.75, 5);
    // 4 Oct 25: in 1730, out 0200.
    expect(computeDurationHours('1730', '200')).toBeCloseTo(8.5, 5);
  });

  it('returns null when either endpoint is missing', () => {
    expect(computeDurationHours('1630', '')).toBeNull();
    expect(computeDurationHours('', '2130')).toBeNull();
  });
});

describe('parseSheetDate', () => {
  it('parses the formats the sheet actually uses', () => {
    expect(iso(parseSheetDate('26 Nov 24'))).toBe('2024-11-26');
    expect(iso(parseSheetDate('3 Jun 2026'))).toBe('2026-06-03');
    // Misspelled month.
    expect(iso(parseSheetDate('14 Apri 2026'))).toBe('2026-04-14');
  });

  it('infers a missing year from the previous row', () => {
    expect(iso(parseSheetDate('18 Dec', new Date(2025, 9, 4)))).toBe('2025-12-18');
    expect(iso(parseSheetDate('3 June', new Date(2026, 5, 3)))).toBe('2026-06-03');
  });

  it('rolls the inferred year forward across a December boundary', () => {
    expect(iso(parseSheetDate('7 Jan', new Date(2024, 11, 30)))).toBe('2025-01-07');
  });

  it('corrects a year typo that leaps ahead of the surrounding rows', () => {
    // "2 Dec 25" sits between 26 Nov 2024 and 20 Dec 2024 in the sheet.
    expect(iso(parseSheetDate('2 Dec 25', new Date(2024, 10, 26)))).toBe('2024-12-02');
    expect(iso(parseSheetDate('30 Dec 25', new Date(2024, 11, 22)))).toBe('2024-12-30');
  });

  it('leaves genuine multi-month gaps alone', () => {
    // 6 Feb 26 → 14 Apr 26 is a real two-month gap, not a typo.
    expect(iso(parseSheetDate('14 Apri 2026', new Date(2026, 1, 6)))).toBe('2026-04-14');
    // A real year gap is preserved when nothing suggests a typo.
    expect(iso(parseSheetDate('7 Jan 25', new Date(2024, 11, 30)))).toBe('2025-01-07');
  });

  it('returns null for unparseable cells', () => {
    expect(parseSheetDate('')).toBeNull();
    expect(parseSheetDate('later')).toBeNull();
    expect(parseSheetDate('18 Dec')).toBeNull(); // no year, no previous row
  });
});

describe('classifySession', () => {
  it('treats a finish position as a tournament', () => {
    expect(classifySession({ gameType: '', rank: '14 of 62' })).toBe('tournament');
    expect(classifySession({ gameType: '', rank: '34th of 296' })).toBe('tournament');
    expect(classifySession({ gameType: '', rank: '1' })).toBe('tournament');
  });

  it('does NOT treat a free-text Rank note as a tournament', () => {
    // Regression: a 1/3 cash session whose Rank cell holds a promo note. Misfiling
    // it would pull a routine cash result out of the variance sample.
    expect(
      classifySession({
        gameType: '1/3',
        rank: "promotional high hands +100 from quad 7's",
      })
    ).toBe('cash');
  });

  it('recognises tournament vocabulary and entry+rake prices', () => {
    expect(classifySession({ gameType: 'In Person Tourney x 2', rank: 'n/a' })).toBe('tournament');
    expect(classifySession({ gameType: '85 uber tournament', rank: '' })).toBe('tournament');
    expect(classifySession({ gameType: '10+1, 3k Guarenteed', rank: '' })).toBe('tournament');
    expect(classifySession({ gameType: '15+1.5', rank: '' })).toBe('tournament');
    expect(classifySession({ gameType: '325, 100 bounty', rank: '' })).toBe('tournament');
    expect(classifySession({ gameType: '80 buy in', rank: '' })).toBe('tournament');
  });

  it('reads bare stakes and blank game types as cash', () => {
    expect(classifySession({ gameType: '1/3', rank: '' })).toBe('cash');
    expect(classifySession({ gameType: '2/5', rank: '' })).toBe('cash');
    expect(classifySession({ gameType: '', rank: '' })).toBe('cash');
  });
});

describe('buildImportKey', () => {
  it('is deterministic and disambiguates same-day, same-venue rows', () => {
    const d = new Date(2026, 6, 30);
    expect(buildImportKey(d, 'wind creek', 72)).toBe('strategy-2026-07-30-wind-creek-72');
    expect(buildImportKey(d, 'wind creek', 72)).toBe(buildImportKey(d, 'wind creek', 72));
    expect(buildImportKey(d, 'wind creek', 71)).not.toBe(buildImportKey(d, 'wind creek', 72));
  });
});

describe('toSessionRecord', () => {
  const row = {
    date: '5 Aug 26', venue: 'wind creek', gameType: '1/3',
    bankWithdrawal: '500', buyIn: '$500', rebuys: '',
    timeIn: '1730', cashOut: '$1,401', timeOut: '2100', rank: '',
  };

  it('produces a record in the shape createSession writes', () => {
    const r = toSessionRecord(row, 77);
    expect(r.isActive).toBe(false);
    expect(r.venue).toBe('wind creek');
    expect(r.gameType).toBe('1/3');
    expect(r.buyIn).toBe(500);
    expect(r.cashOut).toBe(1401);
    expect(r.handCount).toBe(0);
    expect(Array.isArray(r.rebuyTransactions)).toBe(true);
    expect(r.origin).toBe('sheet-import');
    expect(r.sessionKind).toBe('cash');
    expect(r.bankWithdrawal).toBe(500);
  });

  it('sets start/end from the clock columns', () => {
    const r = toSessionRecord(row, 77);
    expect(new Date(r.startTime).getHours()).toBe(17);
    expect(new Date(r.startTime).getMinutes()).toBe(30);
    expect(r.durationHours).toBeCloseTo(3.5, 5);
    expect(r.endTime - r.startTime).toBe(3.5 * 3600000);
  });

  it('turns a rebuy cell into a rebuy transaction', () => {
    const r = toSessionRecord({ ...row, rebuys: '$400' }, 77);
    expect(r.rebuyTransactions).toHaveLength(1);
    expect(r.rebuyTransactions[0].amount).toBe(400);
    expect(typeof r.rebuyTransactions[0].timestamp).toBe('number');
  });

  it('leaves durationHours null when a clock is missing, so rate math can exclude it', () => {
    const r = toSessionRecord({ ...row, timeOut: '' }, 77);
    expect(r.durationHours).toBeNull();
    expect(r.endTime).toBe(r.startTime);
  });
});

describe('buildSessionRecords — against the real sheet', () => {
  const { records, skipped } = buildSessionRecords(STRATEGY_SHEET_SESSIONS);

  it('imports every row without dropping any', () => {
    expect(STRATEGY_SHEET_SESSIONS).toHaveLength(78);
    expect(records).toHaveLength(78);
    expect(skipped).toHaveLength(0);
  });

  it('resolves the three year typos into the December 2024 run', () => {
    expect(records.slice(0, 7).map((r) => iso(r.startTime))).toEqual([
      '2024-11-26',
      '2024-12-02', // sheet says "2 Dec 25"
      '2024-12-04', // sheet says "4 Dec 25"
      '2024-12-20',
      '2024-12-22',
      '2024-12-30', // sheet says "30 Dec 25"
      '2025-01-07',
    ]);
  });

  it('keeps the whole import in chronological order by date', () => {
    const days = records.map((r) => iso(r.startTime));
    expect([...days].sort()).toEqual(days);
  });

  it('never infers a year beyond the sheet range', () => {
    // Regression: consecutive undated rows ("3 June" … "15 Jul") previously
    // compounded a year each, walking the last rows out to 2030.
    const years = records.map((r) => new Date(r.startTime).getFullYear());
    expect(Math.min(...years)).toBe(2024);
    expect(Math.max(...years)).toBe(2026);
  });

  it('recovers P&L for the nine rows the sheet left blank', () => {
    const last9 = records.slice(-9);
    expect(last9.map(pnlOf)).toEqual([486, 393, 1308, -800, 107, -140, 682, -550, 901]);
  });

  it('computes the true lifetime P&L, not the sheet total', () => {
    const total = records.filter((r) => pnlOf(r) !== null).reduce((s, r) => s + pnlOf(r), 0);
    // The sheet's own total row reads -6175 because it sums a column with the
    // nine blanks above still in it. The odd cents come from a single $20.34
    // online tournament cash-out.
    expect(total).toBeCloseTo(-1693.66, 2);
    expect(total).not.toBe(-6175);
  });

  it('separates tournaments from cash games', () => {
    const cash = records.filter((r) => r.sessionKind === 'cash');
    const tourneys = records.filter((r) => r.sessionKind === 'tournament');
    expect(tourneys).toHaveLength(11);
    expect(cash).toHaveLength(67);
    // The promo-note 1/3 session stays in the cash sample.
    const promo = records.find((r) => r.finishRank?.includes('promotional'));
    expect(promo.sessionKind).toBe('cash');
  });

  it('resolves the four overnight sessions to positive durations', () => {
    const overnight = records.filter((r) => r.durationHours !== null && r.durationHours > 0);
    expect(overnight.every((r) => r.durationHours > 0)).toBe(true);
    // 23 May 25: 2200 → 0345.
    const may23 = records.find((r) => iso(r.startTime) === '2025-05-23');
    expect(may23.durationHours).toBeCloseTo(5.75, 5);
  });

  it('assigns a unique import key to every row', () => {
    const keys = new Set(records.map((r) => r.importKey));
    expect(keys.size).toBe(records.length);
  });

  it('flags the one undated row rather than dropping its loss', () => {
    const inferred = records.filter((r) => r.dateInferred);
    expect(inferred).toHaveLength(1);
    expect(pnlOf(inferred[0])).toBe(-900);
  });
});
