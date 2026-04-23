/**
 * Shared helpers + constants used across BucketEVPanel's sub-components.
 * Extracted from `BucketEVPanel.jsx` during LSW-G4-IMPL Commit 1 (primitive
 * extraction, non-breaking). No behavior change from v1.
 */

export const formatEV = (ev) => {
  if (!Number.isFinite(ev)) return '—';
  const sign = ev >= 0 ? '+' : '';
  return `${sign}${ev.toFixed(2)}bb`;
};

export const actionLabel = (actionId, evEntry) => {
  if (!evEntry) return actionId;
  if (evEntry.kind === 'check') return 'check';
  if (evEntry.kind === 'bet' && typeof evEntry.sizing === 'number') {
    return `bet ${Math.round(evEntry.sizing * 100)}%`;
  }
  return actionId;
};

export const CAVEAT_LABELS = {
  'synthetic-range':    'synthetic range',
  'v1-simplified-ev':   'simplified EV',
  'low-sample-bucket':  'low sample',
  'empty-bucket':       'no combos',
  'time-budget-bailout': 'partial result',
};

export const RELATION_STYLE = {
  crushed:    { color: 'text-rose-300',    bg: 'bg-rose-950/30',    border: 'border-rose-800',    label: 'crushed' },
  dominated:  { color: 'text-orange-300',  bg: 'bg-orange-950/30',  border: 'border-orange-800',  label: 'dominated' },
  neutral:    { color: 'text-amber-300',   bg: 'bg-amber-950/30',   border: 'border-amber-800',   label: 'coin-flip' },
  favored:    { color: 'text-teal-300',    bg: 'bg-teal-950/30',    border: 'border-teal-800',    label: 'favored' },
  dominating: { color: 'text-emerald-300', bg: 'bg-emerald-950/30', border: 'border-emerald-800', label: 'dominating' },
};

/**
 * `sampleSize > 0` on a successfully-computed bucket result, with
 * `empty-bucket` caveat treated as not-applicable. Moved from
 * `BucketEVPanel.jsx` during Commit 1; re-exported from there for
 * backward-compat with existing tests.
 */
export const isRowApplicable = (entry) => {
  if (!entry) return false;
  if (entry.error) return false;
  if (!entry.result) return false;
  const caveats = entry.result.caveats || [];
  if (caveats.includes('empty-bucket')) return false;
  return (entry.result.sampleSize || 0) > 0;
};
