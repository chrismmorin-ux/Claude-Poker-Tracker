/**
 * sheetImport.js — normalise the founder's Google Sheet bankroll rows into
 * session records the app can store.
 *
 * Pure: no persistence, no React, no clock reads beyond what callers pass in.
 * Input is `STRATEGY_SHEET_SESSIONS` (src/data/strategySheetSessions.js), which
 * holds every cell as the raw string the sheet contains — mistakes included.
 * All correction happens here so it is testable.
 *
 * The sheet is a crude tool and it lies in four specific ways. Each is handled
 * explicitly rather than papered over:
 *
 *  1. `Profit / Loss` is blank for the last 9 rows. We never read that column;
 *     P&L is always `cashOut - buyIn - rebuys`, matching `computeSessionPnl` in
 *     sessionAnalytics.js so the imported rows agree with app-tracked ones.
 *  2. The `hours` column is garbage (Google parsed HHMM clock values as
 *     durations — "4800:00:00"). Durations recompute from timeIn/timeOut.
 *  3. Dates are inconsistent and three carry a year typo. See `parseSheetDate`.
 *  4. Tournaments are mixed in with cash games under a free-text `gameType`.
 *     `classifySession` separates them; variance math must exclude tournaments.
 *
 * @see src/data/strategySheetSessions.js
 * @see src/utils/sessionStats/bankrollVariance.js
 */

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const MINUTES_PER_DAY = 24 * 60;
const MS_PER_MINUTE = 60000;

/**
 * Parse a money cell into a number.
 * Handles "$1,401", "500", "$0", "" and the sheet's "#DIV/0!" artifacts.
 *
 * @param {string} raw
 * @returns {number|null} null when the cell is empty or unparseable
 */
export const parseMoney = (raw) => {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).replace(/[$,\s]/g, '');
  if (cleaned === '' || cleaned === '#DIV/0!') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
};

/**
 * Parse an HHMM clock cell ("1630", "845", "2") into minutes since midnight.
 *
 * The sheet drops leading zeros, so "845" is 08:45. Values whose minute part
 * exceeds 59 are rejected rather than silently rolled over — a nonsense clock
 * should surface as a missing duration, not a plausible wrong one.
 *
 * @param {string} raw
 * @returns {number|null} minutes since midnight, or null if unparseable
 */
export const parseClockToMinutes = (raw) => {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).trim();
  if (cleaned === '' || !/^\d{1,4}$/.test(cleaned)) return null;
  const value = Number(cleaned);
  const hours = Math.floor(value / 100);
  const minutes = value % 100;
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

/**
 * Session length in hours from two HHMM clock cells.
 *
 * Wraps past midnight when the end clock is earlier than the start — four rows
 * in the sheet are overnight sessions (23 May 25, 4 Oct 25, 6 Feb 26,
 * 28 Jun 26), and the sheet renders those as negative durations.
 *
 * @param {string} rawIn
 * @param {string} rawOut
 * @returns {number|null} hours, or null when either endpoint is missing
 */
export const computeDurationHours = (rawIn, rawOut) => {
  const start = parseClockToMinutes(rawIn);
  const end = parseClockToMinutes(rawOut);
  if (start === null || end === null) return null;
  let span = end - start;
  if (span < 0) span += MINUTES_PER_DAY;
  return span / 60;
};

/**
 * Parse one of the sheet's date cells.
 *
 * The column is free text and arrives in several shapes:
 *   "26 Nov 24"    day month two-digit-year
 *   "3 Jun 2026"   day month four-digit-year
 *   "18 Dec"       no year at all
 *   "14 Apri 2026" misspelled month
 *
 * Three rows also carry a year typo — "2 Dec 25", "4 Dec 25" and "30 Dec 25"
 * sit inside a December *2024* run (the rows on either side are dated 2024).
 * Rows are in chronological order in the sheet, so `previousDate` disambiguates
 * both problems: a missing year is inferred from the prior row, and a year that
 * leaps implausibly far ahead of the prior row is stepped back.
 *
 * The typo direction matters. These rows read one year too HIGH, so correction
 * subtracts a year; it only fires when doing so still leaves the row at or after
 * its predecessor, which keeps genuine multi-month gaps (4 Oct 25 → 18 Dec 25,
 * 6 Feb 26 → 14 Apr 26) untouched.
 *
 * @param {string} raw
 * @param {Date|null} previousDate — the resolved date of the preceding row
 * @returns {Date|null}
 */
export const parseSheetDate = (raw, previousDate = null) => {
  if (!raw) return null;
  const cleaned = String(raw).trim().replace(/,/g, '');
  const match = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s*(\d{2,4})?$/);
  if (!match) return null;

  const day = Number(match[1]);
  const monthKey = match[2].slice(0, 3).toLowerCase();
  if (!(monthKey in MONTHS)) return null;
  const month = MONTHS[monthKey];

  let year;
  if (match[3]) {
    const rawYear = Number(match[3]);
    year = rawYear < 100 ? 2000 + rawYear : rawYear;
  } else if (previousDate) {
    // No year given — assume the same year as the previous row, rolling forward
    // if that would place this row before it (a December → January boundary).
    year = previousDate.getFullYear();
    const candidate = new Date(year, month, day);
    if (candidate < previousDate) year += 1;
  } else {
    return null;
  }

  let resolved = new Date(year, month, day);

  // Year-typo correction, for explicit years only — an inferred year is already
  // ordered correctly by construction above.
  //
  // Threshold is 180 days: comfortably above the largest genuine gap in the
  // sheet (~2.5 months, 4 Oct 25 → 18 Dec 25) and far below the ~12-month leap a
  // year typo produces.
  if (match[3] && previousDate) {
    const JUMP_DAYS = 180;
    const jumpMs = JUMP_DAYS * 24 * 60 * MS_PER_MINUTE;
    if (resolved.getTime() - previousDate.getTime() > jumpMs) {
      const steppedBack = new Date(year - 1, month, day);
      // Only accept the correction if it keeps the sheet's chronological order.
      if (steppedBack.getTime() >= previousDate.getTime()) {
        resolved = steppedBack;
      }
    }
  }

  return resolved;
};

/** Free-text markers that identify a tournament row in the `gameType` column. */
const TOURNAMENT_PATTERNS = [
  'tourney', 'tournament', 'bounty', 'gtd', 'guarenteed', 'guaranteed',
  'monsterstack', 'turbo', 'uber', 'buy in', 'winning:',
];

/**
 * A finish position: "1", "1st", "34th of 296", "89 of 296", "7 of 43".
 *
 * Deliberately strict. The founder also uses the Rank column for free-text
 * notes — one 1/3 cash session carries "promotional high hands +100 from quad
 * 7's" — and treating any non-empty Rank as a tournament would misfile that
 * session, pulling a routine cash result out of the variance sample.
 */
const FINISH_RANK = /^\d+\s*(st|nd|rd|th)?(\s+of\s+\d+)?$/i;

/**
 * Classify a row as cash game or tournament.
 *
 * Tournaments must be excluded from cash-game variance: the payout structure
 * gives them a heavy right tail, so pooling them would inflate the standard
 * deviation and understate the win rate in a way that makes every downstream
 * bankroll figure wrong.
 *
 * Evidence, in order: a finish position in `rank`, then tournament vocabulary in
 * the free-text `gameType`, then an entry-plus-rake price like "15+1.5". A bare
 * "N/M" stake, or a blank gameType, reads as cash.
 *
 * @param {Object} row — raw sheet row
 * @returns {'cash'|'tournament'}
 */
export const classifySession = (row) => {
  if (!row) return 'cash';
  if (FINISH_RANK.test(String(row.rank || '').trim())) return 'tournament';
  const gameType = String(row.gameType || '').toLowerCase();
  if (TOURNAMENT_PATTERNS.some((pattern) => gameType.includes(pattern))) return 'tournament';
  // A "+" price like "$2+1" or "15+1.5" is a tournament entry + rake.
  if (/\d\s*\+\s*\d/.test(gameType)) return 'tournament';
  return 'cash';
};

/**
 * Build a stable, deterministic key for one imported row.
 *
 * Idempotency depends on this: re-running the import skips rows whose key is
 * already stored. The index disambiguates the several same-day, same-venue
 * pairs in the sheet (two sessions at wind creek on 30 Jul 26, for instance).
 *
 * @param {Date} date
 * @param {string} venue
 * @param {number} index — row position in the source sheet
 * @returns {string}
 */
export const buildImportKey = (date, venue, index) => {
  const iso = date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    : 'undated';
  const slug = String(venue || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
  return `strategy-${iso}-${slug}-${index}`;
};

/**
 * Convert one raw sheet row into a session record.
 *
 * Shape matches what `createSession` writes (src/utils/persistence/sessionsStorage.js)
 * so imported sessions are indistinguishable from tracked ones to every reader —
 * the Insights band, the bankroll chart, the row list — plus provenance fields.
 *
 * Session start is the row's date at its `timeIn` clock; end is start + duration.
 * When either clock is missing (7 cash rows), the session is timed at midday and
 * `durationHours` is null, which keeps it OUT of every rate calculation while
 * still counting toward net P&L. That distinction is load-bearing: a session
 * with unknown length must not silently contribute 0 hours to a $/hr figure.
 *
 * @param {Object} row — raw sheet row
 * @param {number} index — row position in the source sheet
 * @param {Date|null} previousDate — resolved date of the preceding row
 * @returns {Object|null} session record, or null when the date cannot be parsed
 */
export const toSessionRecord = (row, index, previousDate = null) => {
  if (!row) return null;

  // One row ("Greg's range", -$900) has a blank date cell but real money in it.
  // Dropping it would quietly understate lifetime P&L by $900, so it inherits
  // the preceding row's date and is stamped `dateInferred` — a placed session
  // with a flagged date beats a silently missing loss.
  const parsed = parseSheetDate(row.date, previousDate);
  const dateInferred = !parsed && !!previousDate;
  const date = parsed || (dateInferred ? new Date(previousDate) : null);
  if (!date) return null;

  const startMinutes = parseClockToMinutes(row.timeIn);
  const durationHours = computeDurationHours(row.timeIn, row.timeOut);

  const start = new Date(date);
  start.setHours(0, startMinutes === null ? 12 * 60 : startMinutes, 0, 0);
  const startTime = start.getTime();
  const endTime = durationHours === null
    ? startTime
    : startTime + Math.round(durationHours * 60) * MS_PER_MINUTE;

  const buyIn = parseMoney(row.buyIn);
  const rebuyAmount = parseMoney(row.rebuys);
  const cashOut = parseMoney(row.cashOut);

  return {
    startTime,
    endTime,
    isActive: false,
    venue: String(row.venue || '').trim() || 'Unknown',
    gameType: String(row.gameType || '').trim() || null,
    buyIn: buyIn === null ? null : Math.max(0, buyIn),
    // Rebuys are a single sheet cell with no timestamp of their own; attribute
    // them to the session start so the record stays schema-valid.
    rebuyTransactions: rebuyAmount === null || rebuyAmount === 0
      ? []
      : [{ timestamp: startTime, amount: Math.max(0, rebuyAmount) }],
    cashOut: cashOut === null ? null : Math.max(0, cashOut),
    tipAmount: null,
    reUp: 0,
    goal: null,
    notes: null,
    straddle: null,
    handCount: 0,
    // --- provenance / sheet-specific fields (additive, all optional) ---
    origin: 'sheet-import',
    importKey: buildImportKey(date, row.venue, index),
    sessionKind: classifySession(row),
    durationHours,
    bankWithdrawal: parseMoney(row.bankWithdrawal),
    finishRank: String(row.rank || '').trim() || null,
    dateInferred,
  };
};

/**
 * Convert the full sheet into session records, in chronological order.
 *
 * Dates are resolved sequentially because year-typo correction and missing-year
 * inference both depend on the previous row.
 *
 * `previousDate` is carried at MIDNIGHT, not at the previous session's start
 * time. Comparing a midnight candidate against a previous row's 13:00 start
 * would make a same-day row read as "earlier", bumping its inferred year — and
 * because the sheet has long runs of undated rows ("3 June" … "15 Jul"), that
 * error compounds one year per row.
 *
 * @param {Array<Object>} rows — raw sheet rows in sheet order
 * @returns {{records: Array<Object>, skipped: Array<{index:number, row:Object, reason:string}>}}
 */
export const buildSessionRecords = (rows = []) => {
  const records = [];
  const skipped = [];
  let previousDate = null;

  rows.forEach((row, index) => {
    const record = toSessionRecord(row, index, previousDate);
    if (!record) {
      skipped.push({ index, row, reason: 'unparseable date' });
      return;
    }
    const started = new Date(record.startTime);
    previousDate = new Date(started.getFullYear(), started.getMonth(), started.getDate());
    records.push(record);
  });

  return { records, skipped };
};

export default buildSessionRecords;
