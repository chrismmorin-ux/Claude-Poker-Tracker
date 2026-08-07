/**
 * SessionLogForm.jsx — log a session you already played, or edit one you logged.
 *
 * One form for both jobs, because the fields are identical and two forms would
 * drift. `session` prop absent → logging a new past session; present → editing
 * that one.
 *
 * The field order deliberately mirrors the spreadsheet row the founder used for
 * two years — date, venue, stake, in/out times, buy-in, rebuys, cash-out — so
 * the muscle memory carries over and the app is at least as quick as the sheet.
 *
 * Parsing, midnight wrap and validation live in
 * `src/utils/sessionStats/sessionLogFields.js` so they can be tested without
 * rendering.
 */

import React, { useMemo, useState } from 'react';
import { useSettings } from '../../contexts';
import {
  sessionToFormValues,
  formValuesToSessionData,
  resolveSessionTimes,
  formatDuration,
} from '../../utils/sessionStats/sessionLogFields';

/** Today in `YYYY-MM-DD`, local. */
const todayValue = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const EMPTY_VALUES = {
  date: '', timeIn: '', timeOut: '', venue: '', gameType: '',
  buyIn: '', rebuys: '', cashOut: '', tipAmount: '', notes: '',
};

const Field = ({ label, error, children, hint }) => (
  <div>
    <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
    {children}
    {hint && !error && <p className="text-gray-500 text-xs mt-1">{hint}</p>}
    {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
  </div>
);

const inputClass = (hasError) =>
  `w-full px-3 min-h-[44px] bg-gray-700 text-gray-200 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    hasError ? 'border-red-500' : 'border-gray-600'
  }`;

/**
 * @param {Object} props
 * @param {Object} [props.session] — existing session to edit; omit to log a new one
 * @param {Function} props.onSubmit — (sessionData) => Promise|void
 * @param {Function} props.onCancel
 * @param {Function} [props.onDelete] — shown only when editing
 */
export const SessionLogForm = ({ session = null, onSubmit, onCancel }) => {
  const { allVenues, allGameTypes, allGameTypeKeys, getVenueNote } = useSettings();
  const isEdit = !!session;

  const initial = useMemo(
    () => (session
      ? sessionToFormValues(session)
      : { ...EMPTY_VALUES, date: todayValue() }),
    [session]
  );

  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});

  const set = (key) => (e) => {
    const v = e.target.value;
    setValues((prev) => ({ ...prev, [key]: v }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // Live duration echo — a mistyped clock should be visible before saving, not
  // discovered later as a wrong $/hr.
  const { durationHours } = resolveSessionTimes(values.date, values.timeIn, values.timeOut);
  const durationLabel = formatDuration(durationHours);
  const crossesMidnight =
    durationHours !== null && values.timeOut !== '' && values.timeOut < values.timeIn;

  // Dirty-state backdrop guard, matching SessionForm (AUDIT-2026-04-21-SV F6):
  // a miss-tap outside must not discard typed work.
  const isDirty = Object.keys(values).some((k) => values[k] !== initial[k]);
  const handleBackdropClick = () => {
    if (isDirty) return;
    onCancel();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const result = formValuesToSessionData(values);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    onSubmit(result.data);
  };

  const stakeOptions = allGameTypeKeys
    .map((key) => allGameTypes[key]?.label)
    .filter(Boolean);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="session-log-form"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">
            {isEdit ? 'Edit session' : 'Log a session'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-200 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {!isEdit && (
          <p className="text-xs text-gray-400 mb-4 leading-relaxed">
            For a session you already played. Profit is worked out from buy-in,
            rebuys and cash-out — no need to compute it yourself.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Date" error={errors.date}>
            <input
              type="date"
              value={values.date}
              onChange={set('date')}
              className={inputClass(errors.date)}
              data-testid="log-date"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Time in" error={errors.timeIn}>
              <input
                type="time"
                value={values.timeIn}
                onChange={set('timeIn')}
                className={inputClass(errors.timeIn)}
                data-testid="log-time-in"
              />
            </Field>
            <Field label="Time out" error={errors.timeOut}>
              <input
                type="time"
                value={values.timeOut}
                onChange={set('timeOut')}
                className={inputClass(errors.timeOut)}
                data-testid="log-time-out"
              />
            </Field>
          </div>

          {durationLabel && (
            <p className="-mt-2 text-xs text-gray-400" data-testid="log-duration">
              Session length: <span className="text-gray-200 font-medium">{durationLabel}</span>
              {crossesMidnight && <span className="text-gray-500"> · ran past midnight</span>}
            </p>
          )}

          <Field label="Venue" error={errors.venue}>
            <select
              value={values.venue}
              onChange={set('venue')}
              className={inputClass(errors.venue)}
              data-testid="log-venue"
            >
              <option value="">Select venue…</option>
              {allVenues.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
              {/* An imported or hand-typed venue that is not in settings must
                  still round-trip on edit rather than silently resetting. */}
              {values.venue && !allVenues.includes(values.venue) && (
                <option value={values.venue}>{values.venue}</option>
              )}
            </select>
            {values.venue && getVenueNote && getVenueNote(values.venue) && (
              <p className="mt-1 text-xs text-gray-400 italic whitespace-pre-wrap">
                {getVenueNote(values.venue)}
              </p>
            )}
          </Field>

          <Field label="Stake" error={errors.gameType}>
            <select
              value={values.gameType}
              onChange={set('gameType')}
              className={inputClass(errors.gameType)}
              data-testid="log-game-type"
            >
              <option value="">Select stake…</option>
              {stakeOptions.map((label) => (
                <option key={label} value={label}>{label}</option>
              ))}
              {values.gameType && !stakeOptions.includes(values.gameType) && (
                <option value={values.gameType}>{values.gameType}</option>
              )}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Buy-in" error={errors.buyIn}>
              <input
                type="number"
                inputMode="decimal"
                value={values.buyIn}
                onChange={set('buyIn')}
                placeholder="500"
                className={inputClass(errors.buyIn)}
                data-testid="log-buy-in"
              />
            </Field>
            <Field label="Rebuys" error={errors.rebuys}>
              <input
                type="number"
                inputMode="decimal"
                value={values.rebuys}
                onChange={set('rebuys')}
                placeholder="0"
                className={inputClass(errors.rebuys)}
                data-testid="log-rebuys"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Cash-out"
              error={errors.cashOut}
              hint="Leave blank if unknown; 0 means busted"
            >
              <input
                type="number"
                inputMode="decimal"
                value={values.cashOut}
                onChange={set('cashOut')}
                placeholder="1401"
                className={inputClass(errors.cashOut)}
                data-testid="log-cash-out"
              />
            </Field>
            <Field label="Tip" error={errors.tipAmount}>
              <input
                type="number"
                inputMode="decimal"
                value={values.tipAmount}
                onChange={set('tipAmount')}
                placeholder="0"
                className={inputClass(errors.tipAmount)}
                data-testid="log-tip"
              />
            </Field>
          </div>

          <Field label="Notes (optional)">
            <textarea
              value={values.notes}
              onChange={set('notes')}
              rows={2}
              placeholder="How it went, who was at the table…"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              data-testid="log-notes"
            />
          </Field>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 min-h-[44px] text-gray-200 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 min-h-[44px] text-white bg-green-600 rounded hover:bg-green-700 transition-colors font-medium"
              data-testid="log-submit"
            >
              {isEdit ? 'Save changes' : 'Log session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SessionLogForm;
