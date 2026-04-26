// @coherence-exempt: data-layer name list for the lessons UI calculator registry — no decision-relevant output.
/**
 * calculatorRegistry.js — pure list of calculator names referenced by lessons.
 *
 * The `CALCULATORS` object (maps name → React component) lives in
 * `src/components/views/PreflopDrillsView/LessonCalculators.jsx` because the
 * values are UI. This file is the data-layer surface: just the names.
 *
 * Rationale (RT-95): lessons data files reference calculators by string key
 * in `{ kind: 'compute', calculator: <name> }` sections. The lesson integrity
 * test needs to verify those keys resolve, but utils/ must not import from
 * views/ (INV-08). By keeping the authoritative name list here, the test can
 * import it from a peer utils module, and LessonCalculators.jsx imports from
 * here too (invariant: every name here has a matching React component).
 *
 * Adding a new calculator:
 *   1. Add its name to CALCULATOR_NAMES below.
 *   2. Add its React component to CALCULATORS in LessonCalculators.jsx.
 *   3. Reference it in a lesson's `{ kind: 'compute', calculator: <name> }`.
 *
 * Removing a calculator:
 *   1. Remove its name here.
 *   2. Remove its component in LessonCalculators.jsx.
 *   3. Remove any lesson reference.
 */

export const CALCULATOR_NAMES = Object.freeze([
  'flopPair',
  'flushOuts',
  'straightRuns',
  'potOdds',
  'runouts',
]);

const NAME_SET = new Set(CALCULATOR_NAMES);

export const isKnownCalculator = (name) => NAME_SET.has(name);
