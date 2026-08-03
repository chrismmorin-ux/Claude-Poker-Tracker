/**
 * fragility.js — how close a conclusion is to reversing, and how often it already has.
 *
 * FOUNDER DIRECTIVE 2026-08-03: "I am a little scared that we're going to generate data that
 * supports a certain conclusion, only to discover an original theory wasn't modeled properly,
 * or a particular type of comparison wasn't made... there is an overconfidence bias... I think
 * this will happen many more times, which is a good thing if it's rooted to the absolute EV
 * line, but I worry we take too shallow a look in many places."
 *
 * That last clause sets the design. A conclusion that reverses under new evidence is the
 * system WORKING — it is what being rooted to the EV line looks like from the inside. The
 * danger is not the reversal; it is the reversal going UNRECORDED, so that the fourth flip on
 * a node reads with exactly the same confidence as a first-time finding.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * TWO DIFFERENT QUESTIONS, DELIBERATELY NOT MERGED.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 *   MARGIN TO FLIP  — how far would a load-bearing input have to move for this conclusion to
 *                     reverse? A property of THIS run. Answers "is this a knife edge?"
 *   FLIP REGISTER   — how many times has the conclusion on this estimand actually reversed
 *                     across runs? A property of the HISTORY. Answers "has this ever been
 *                     stable?"
 *
 * They are not the same and must not be collapsed into one confidence number. A result can be
 * robust this run (wide margin) on a question that has flipped three times (unstable history),
 * and that combination is the most interesting one there is — it says the instability lives in
 * something other than the noise this run happened to see.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE REFUSES TO DO.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * It does not compute a single "confidence score". Collapsing margin, flip history, sample
 * size, and admissibility into one number is precisely the move that produces overconfidence:
 * the collapse hides which input was weak, and a reader cannot recover it. The repo already
 * has the honest pattern — `heroEvReport.assessAdmissibility` reports a verdict WITH its
 * reasons rather than a score — and this follows it.
 */

import { StandardOfRecordError } from './schemas.js';

/** Which direction a conclusion pointed. `null` is a real answer: no admissible verdict. */
export const CONCLUSION_DIRECTIONS = Object.freeze(['supports', 'refutes', 'inconclusive']);

/**
 * One load-bearing input and how far it would have to move to reverse the conclusion.
 *
 * @param {Object} params
 * @param {string} params.name - the constant or assumption, at its DEFINITION site name
 *   (PRIOR_WEIGHT, ACTION_TAU_FRACTION, MIN_CONTINUATION_WEIGHT, ...). Named so a reader can
 *   go and look at it, which is the whole point.
 * @param {number} params.value - what it was during this run.
 * @param {number|null} params.flipsAt - the value at which the conclusion reverses, or null
 *   when it does not reverse anywhere in the swept range.
 * @param {[number, number]|null} params.sweptRange - the range actually explored. REQUIRED
 *   context for a null `flipsAt`: "does not flip" means nothing without knowing where you
 *   looked, and a narrow sweep reporting no flip is the shallow answer the directive warns
 *   about.
 */
export const buildMargin = ({ name, value, flipsAt = null, sweptRange = null, note = null } = {}) => {
  if (!name) throw new StandardOfRecordError('fragility: a margin must name its input');
  if (flipsAt === null && sweptRange === null) {
    throw new StandardOfRecordError(
      `fragility: margin "${name}" claims no flip but declares no swept range. "Does not `
      + 'flip" is unreadable without knowing where you looked — a narrow sweep reporting no '
      + 'flip is exactly the shallow answer this object exists to prevent.',
      { name },
    );
  }
  const relative = (flipsAt !== null && value !== 0)
    ? Math.abs((flipsAt - value) / value)
    : null;
  return Object.freeze({ name, value, flipsAt, sweptRange, relativeMove: relative, note });
};

/**
 * Assemble the fragility block for a Result Card.
 *
 * `knifeEdge` is surfaced as a flag rather than left to the reader's arithmetic, because the
 * failure mode is a reader skimming past a number they did not convert into a proportion.
 */
export const buildFragility = ({ margins = [], knifeEdgeThreshold = 0.1 } = {}) => {
  const withMove = margins.filter((m) => m.relativeMove !== null);
  const tightest = withMove.length
    ? withMove.reduce((a, b) => (a.relativeMove <= b.relativeMove ? a : b))
    : null;
  return Object.freeze({
    margins: Object.freeze([...margins]),
    tightestInput: tightest ? tightest.name : null,
    tightestRelativeMove: tightest ? tightest.relativeMove : null,
    knifeEdge: tightest ? tightest.relativeMove < knifeEdgeThreshold : false,
    knifeEdgeThreshold,
    unswept: Object.freeze(margins.filter((m) => m.flipsAt === null).map((m) => m.name)),
  });
};

/**
 * Build the flip register for an estimand, given the prior conclusions on it in time order.
 *
 * @param {Object} params
 * @param {string} params.estimand - WHAT was measured. The join key: two cards only share a
 *   flip history if they measured the same thing (AS-710).
 * @param {Array} params.priorConclusions - [{direction, resultCardId, at}], oldest first.
 * @param {string} params.currentDirection - this run's conclusion.
 */
export const buildFlipRegister = ({ estimand, priorConclusions = [], currentDirection } = {}) => {
  if (!estimand) throw new StandardOfRecordError('flipRegister: estimand is required');
  if (!CONCLUSION_DIRECTIONS.includes(currentDirection)) {
    throw new StandardOfRecordError(
      `flipRegister: direction must be one of ${CONCLUSION_DIRECTIONS.join(' | ')}, got "${currentDirection}"`,
      { estimand, currentDirection },
    );
  }

  const chain = [...priorConclusions.map((c) => c.direction), currentDirection];

  // A flip is a change between two DECIDED conclusions. An `inconclusive` run in between does
  // not break the chain and does not itself count as a flip — treating "we could not tell"
  // as a reversal would inflate the count with runs that made no claim, and the count is only
  // worth carrying if it means what it says.
  const decided = chain.filter((d) => d !== 'inconclusive');
  let flipCount = 0;
  for (let i = 1; i < decided.length; i += 1) {
    if (decided[i] !== decided[i - 1]) flipCount += 1;
  }

  const priorDecided = decided.slice(0, -1);
  const reversedThisRun = currentDirection !== 'inconclusive'
    && priorDecided.length > 0
    && priorDecided[priorDecided.length - 1] !== currentDirection;

  return Object.freeze({
    estimand,
    currentDirection,
    flipCount,
    reversedThisRun,
    runsOnRecord: chain.length,
    inconclusiveRuns: chain.length - decided.length,
    history: Object.freeze(priorConclusions.map((c) => Object.freeze({ ...c }))),
    everStable: flipCount === 0 && decided.length > 1,
  });
};

/**
 * The sentence a report must print when quoting a flipped conclusion.
 *
 * Exists as a function so the wording cannot drift between surfaces, and so "this has flipped
 * before" is impossible to render as a footnote nobody reads.
 */
export const fragilityCaveat = (flipRegister, fragility) => {
  const parts = [];
  if (flipRegister?.flipCount > 0) {
    parts.push(
      `This conclusion has REVERSED ${flipRegister.flipCount} time(s) across `
      + `${flipRegister.runsOnRecord} run(s) on this estimand`
      + (flipRegister.reversedThisRun ? ', including this one' : '')
      + '.',
    );
  }
  if (fragility?.knifeEdge) {
    parts.push(
      `It is a knife edge: "${fragility.tightestInput}" need move only `
      + `${(fragility.tightestRelativeMove * 100).toFixed(1)}% to reverse it.`,
    );
  }
  if (fragility?.unswept?.length) {
    parts.push(
      `Not swept, so no flip point is known for: ${fragility.unswept.join(', ')}.`,
    );
  }
  return parts.length ? parts.join(' ') : null;
};
