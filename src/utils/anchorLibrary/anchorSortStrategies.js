/**
 * anchorSortStrategies.js — Sort enumeration for AnchorLibraryView.
 *
 * Per `docs/design/surfaces/anchor-library.md` §"Filter row — AnchorFilters":
 *   - 3 strategies: alphabetical (default) / last-fired (newest) / sample-size (largest)
 *   - EXPLICITLY NOT "biggest-edge" / "highest-confidence" (AP-01 leaderboard refusal)
 *
 * The enum here is the single source of truth. Adding a `biggest-edge` strategy
 * here is a CI-grep-detectable AP-01 violation; tests in
 * `__tests__/anchorSortStrategies.test.js` assert the absence of that strategy
 * key in the enum + comparator map.
 *
 * All comparators are stable for equal keys (return 0 → preserve input order
 * via Array.prototype.sort spec).
 *
 * EAL Phase 6 — Session 19 (S19).
 */

// ───────────────────────────────────────────────────────────────────────────
// Sort strategy keys (frozen — extension via PR + test-update only)
// ───────────────────────────────────────────────────────────────────────────

export const SORT_STRATEGIES = Object.freeze({
  ALPHABETICAL: 'alphabetical',
  LAST_FIRED: 'last-fired',
  SAMPLE_SIZE: 'sample-size',
});

export const VALID_SORT_STRATEGIES = Object.freeze([
  SORT_STRATEGIES.ALPHABETICAL,
  SORT_STRATEGIES.LAST_FIRED,
  SORT_STRATEGIES.SAMPLE_SIZE,
]);

export const DEFAULT_SORT_STRATEGY = SORT_STRATEGIES.ALPHABETICAL;

// ───────────────────────────────────────────────────────────────────────────
// Comparators
// ───────────────────────────────────────────────────────────────────────────

const safeName = (a) => (typeof a?.archetypeName === 'string' ? a.archetypeName : '');

/**
 * Alphabetical by archetypeName (case-insensitive). Empty/missing names sink.
 */
const compareAlphabetical = (a, b) => {
  const nameA = safeName(a).toLocaleLowerCase();
  const nameB = safeName(b).toLocaleLowerCase();
  // Empty names sink to end (deterministic, but does not promote them).
  if (!nameA && nameB) return 1;
  if (nameA && !nameB) return -1;
  return nameA.localeCompare(nameB);
};

/**
 * Last-fired (newest first). Reads `validation.lastFiredAt` (ISO string) with
 * fallback to `validation.lastFiringAt` then `lastFiredAt` top-level. Anchors
 * never fired sink to the bottom.
 */
const lastFiredTime = (a) => {
  const v =
    a?.validation?.lastFiredAt ||
    a?.validation?.lastFiringAt ||
    a?.lastFiredAt ||
    null;
  if (typeof v !== 'string' || v.length === 0) return -Infinity;
  const t = Date.parse(v);
  return Number.isNaN(t) ? -Infinity : t;
};

const compareLastFired = (a, b) => {
  const ta = lastFiredTime(a);
  const tb = lastFiredTime(b);
  // Newer first (descending).
  if (ta === tb) return compareAlphabetical(a, b); // stable tiebreak
  return tb - ta;
};

/**
 * Sample-size (largest first). Reads `evidence.sampleSize` with fallback to
 * `evidence.observationCount` (both per schema-delta §2.5). Missing/zero sinks.
 */
const sampleSize = (a) => {
  const s = a?.evidence?.sampleSize;
  if (typeof s === 'number' && Number.isFinite(s)) return s;
  const o = a?.evidence?.observationCount;
  if (typeof o === 'number' && Number.isFinite(o)) return o;
  return -Infinity;
};

const compareSampleSize = (a, b) => {
  const sa = sampleSize(a);
  const sb = sampleSize(b);
  if (sa === sb) return compareAlphabetical(a, b); // stable tiebreak
  return sb - sa;
};

// ───────────────────────────────────────────────────────────────────────────
// Strategy → comparator map
// ───────────────────────────────────────────────────────────────────────────

const COMPARATORS = Object.freeze({
  [SORT_STRATEGIES.ALPHABETICAL]: compareAlphabetical,
  [SORT_STRATEGIES.LAST_FIRED]: compareLastFired,
  [SORT_STRATEGIES.SAMPLE_SIZE]: compareSampleSize,
});

/**
 * Apply a sort strategy. Tolerant: unknown strategies fall back to the default
 * (alphabetical). Pure: returns a new array; never mutates input.
 *
 * @param {Array} anchors
 * @param {string} strategy
 * @returns {Array}
 */
export const applySortStrategy = (anchors, strategy) => {
  if (!Array.isArray(anchors)) return [];
  const cmp = COMPARATORS[strategy] || COMPARATORS[DEFAULT_SORT_STRATEGY];
  return [...anchors].sort(cmp);
};

/**
 * Display labels for the sort dropdown. Order is canonical (matches array
 * iteration in the dropdown).
 */
export const SORT_STRATEGY_LABELS = Object.freeze({
  [SORT_STRATEGIES.ALPHABETICAL]: 'A-Z (default)',
  [SORT_STRATEGIES.LAST_FIRED]: 'Last fired (newest)',
  [SORT_STRATEGIES.SAMPLE_SIZE]: 'Sample size (largest)',
});

export default SORT_STRATEGIES;
