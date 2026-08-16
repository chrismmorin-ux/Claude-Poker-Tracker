/**
 * sessionLogFields.js — pure conversions between a session record and the
 * date/clock/money fields the log-and-edit form works in.
 *
 * Kept out of the component so the awkward parts — midnight wrap, "what does a
 * blank cash-out mean" — are testable without rendering anything.
 *
 * The founder logged sessions in a spreadsheet for two years as
 * `date | time in | time out | $ in | rebuys | $ out`. The form mirrors those
 * fields, so these helpers are the bridge between that shape and the session
 * record the app stores.
 */

const MS_PER_MINUTE = 60000;
const MINUTES_PER_DAY = 24 * 60;

/** Two-digit pad for date/time input values. */
const pad = (n) => String(n).padStart(2, '0');

/**
 * Epoch ms → `YYYY-MM-DD` in LOCAL time, for an `<input type="date">`.
 *
 * Local, not UTC: a session that started at 20:30 on the 5th must not display as
 * the 6th for anyone west of Greenwich.
 *
 * @param {number} ts
 * @returns {string}
 */
export const toDateInputValue = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Epoch ms → `HH:MM` in LOCAL time, for an `<input type="time">`.
 * @param {number} ts
 * @returns {string}
 */
export const toTimeInputValue = (ts) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Parse `HH:MM` into minutes since midnight.
 * @param {string} value
 * @returns {number|null} null when absent or malformed
 */
export const parseTimeInput = (value) => {
  if (!value || typeof value !== 'string') return null;
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

/**
 * Combine a `YYYY-MM-DD` date field and an `HH:MM` clock field into epoch ms.
 * @param {string} dateValue
 * @param {string} timeValue
 * @returns {number|null}
 */
export const toTimestamp = (dateValue, timeValue) => {
  if (!dateValue) return null;
  const dm = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) return null;
  const minutes = parseTimeInput(timeValue);
  if (minutes === null) return null;
  return new Date(
    Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]),
    Math.floor(minutes / 60), minutes % 60, 0, 0
  ).getTime();
};

/**
 * Resolve the start/end timestamps for a session from a date and two clocks.
 *
 * **Midnight wrap:** when the end clock reads earlier than the start clock the
 * session ran past midnight, so the end lands on the following day. Without this
 * a 22:00 → 03:45 session records as negative — exactly the defect that made
 * every `$/hr` in the founder's spreadsheet wrong.
 *
 * @param {string} dateValue - `YYYY-MM-DD`
 * @param {string} timeIn - `HH:MM`
 * @param {string} timeOut - `HH:MM`, optional
 * @returns {{startTime:number|null, endTime:number|null, durationHours:number|null}}
 */
export const resolveSessionTimes = (dateValue, timeIn, timeOut) => {
  const startTime = toTimestamp(dateValue, timeIn);
  if (startTime === null) return { startTime: null, endTime: null, durationHours: null };

  const startMinutes = parseTimeInput(timeIn);
  const endMinutes = parseTimeInput(timeOut);
  if (endMinutes === null) return { startTime, endTime: null, durationHours: null };

  let span = endMinutes - startMinutes;
  if (span < 0) span += MINUTES_PER_DAY;   // crossed midnight

  return {
    startTime,
    endTime: startTime + span * MS_PER_MINUTE,
    durationHours: span / 60,
  };
};

/**
 * Human duration for the live echo under the time fields, e.g. "3h 30m".
 * Shown while typing so a mistyped clock is visible before saving.
 *
 * @param {number|null} hours
 * @returns {string|null}
 */
export const formatDuration = (hours) => {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return null;
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

/**
 * Parse a money field.
 *
 * Blank returns null, NOT 0 — the distinction is load-bearing. A blank cash-out
 * means "I haven't recorded what I left with", which keeps the session out of
 * P&L entirely; a cash-out of 0 means "I busted", which is a −(buy-in) result.
 * Collapsing the two would silently invent losses.
 *
 * @param {string} value
 * @returns {number|null}
 */
export const parseMoneyField = (value) => {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/**
 * Session record → the form's field values.
 * @param {Object} session
 * @returns {Object} form values
 */
export const sessionToFormValues = (session) => {
  const start = session?.startTime ?? Date.now();
  const rebuyTotal = Array.isArray(session?.rebuyTransactions)
    ? session.rebuyTransactions.reduce((sum, t) => sum + (t?.amount || 0), 0)
    : 0;

  return {
    date: toDateInputValue(start),
    timeIn: toTimeInputValue(start),
    timeOut: session?.endTime ? toTimeInputValue(session.endTime) : '',
    venue: session?.venue || '',
    gameType: session?.gameType || '',
    buyIn: session?.buyIn != null ? String(session.buyIn) : '',
    rebuys: rebuyTotal > 0 ? String(rebuyTotal) : '',
    cashOut: session?.cashOut != null ? String(session.cashOut) : '',
    tipAmount: session?.tipAmount != null ? String(session.tipAmount) : '',
    notes: session?.notes || '',
  };
};

/**
 * Form values → the fields a session record needs.
 *
 * Rebuys arrive as one total (that is how the founder thinks about them when
 * logging after the fact) and become a single transaction stamped at the session
 * start, matching the shape `calculateTotalRebuy` and the reducer already expect.
 *
 * @param {Object} values - form values
 * @returns {{valid:boolean, errors:Object, data:Object|null}}
 */
export const formValuesToSessionData = (values) => {
  const errors = {};

  if (!values.date) errors.date = 'Date is required';
  if (!values.timeIn) errors.timeIn = 'Start time is required';

  const { startTime, endTime, durationHours } = resolveSessionTimes(
    values.date, values.timeIn, values.timeOut
  );
  if (values.date && values.timeIn && startTime === null) {
    errors.timeIn = 'Enter a time as HH:MM';
  }
  if (values.timeOut && endTime === null) {
    errors.timeOut = 'Enter a time as HH:MM';
  }

  const buyIn = parseMoneyField(values.buyIn);
  const cashOut = parseMoneyField(values.cashOut);
  const rebuys = parseMoneyField(values.rebuys);
  const tip = parseMoneyField(values.tipAmount);

  if (values.buyIn && buyIn === null) errors.buyIn = 'Enter a number';
  if (buyIn !== null && buyIn < 0) errors.buyIn = 'Buy-in cannot be negative';
  if (values.cashOut && cashOut === null) errors.cashOut = 'Enter a number';
  if (cashOut !== null && cashOut < 0) errors.cashOut = 'Cash-out cannot be negative';
  if (values.rebuys && rebuys === null) errors.rebuys = 'Enter a number';
  if (rebuys !== null && rebuys < 0) errors.rebuys = 'Rebuys cannot be negative';
  if (values.tipAmount && tip === null) errors.tipAmount = 'Enter a number';

  if (Object.keys(errors).length > 0) return { valid: false, errors, data: null };

  return {
    valid: true,
    errors: {},
    data: {
      startTime,
      endTime,
      durationHours,
      venue: values.venue || null,
      gameType: values.gameType || null,
      buyIn,
      cashOut,
      tipAmount: tip,
      rebuyTransactions: rebuys && rebuys > 0
        ? [{ timestamp: startTime, amount: rebuys }]
        : [],
      notes: values.notes || null,
    },
  };
};
