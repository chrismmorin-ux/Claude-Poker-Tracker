/**
 * comparisonCensus.js — the contrasts that COULD have been drawn, and which actually were.
 *
 * FOUNDER DIRECTIVE 2026-08-03: the worry is generating data that supports a conclusion and
 * only later discovering "a particular type of comparison wasn't made".
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A DIFFERENT OBJECT FROM THE COVERAGE CENSUS.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * The Coverage Census answers "which SITUATIONS did we never reach". It works by emitting a
 * row for every context in the declared domain, including the zeros — so an untested context
 * is a visible zero rather than a missing row.
 *
 * An unmade COMPARISON has no such row. It leaves no trace at all. If two surfaces were never
 * contrasted, there is no artifact anywhere that is shaped like the absence — nothing to
 * notice, nothing to count, nothing that looks wrong. That asymmetry is precisely why a
 * conclusion can sit unchallenged: the challenge that was never run does not appear in the
 * output it would have contradicted.
 *
 * So the denominator has to be ENUMERATED rather than counted. `possible` lists every contrast
 * the available artifacts make drawable; `drawn` lists the ones with a Result Card behind them;
 * `notDrawn` is stored rather than derived, so it survives into any report that quotes the
 * census instead of evaporating at the first summarisation.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * CANNOT-BE-DRAWN vs WAS-NOT-DRAWN.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * These have OPPOSITE implications for a conclusion and the census refuses to conflate them:
 *
 *   blocked      the contrast is impossible with what exists — no shared Deal Book, or the
 *                generations have not been rebased. Not a gap in diligence; a gap in the
 *                artifacts, and the fix is a different piece of work.
 *   notAttempted the contrast was drawable and nobody drew it. THIS is the one the directive
 *                is about, and it is the number a report should have to print.
 */

import { SOR_SCHEMAS, SOR_SCHEMA_VERSIONS, StandardOfRecordError, checkAgainstSchema } from './schemas.js';

/** What kind of thing is being contrasted. Two censuses on different axes never union. */
export const COMPARISON_AXES = Object.freeze(['surface', 'layer', 'generation', 'field']);

/** Why a possible contrast was not drawn. */
export const BLOCK_REASONS = Object.freeze({
  NO_SHARED_DEAL_BOOK: 'no-shared-deal-book',
  GENERATIONS_NOT_REBASED: 'generations-not-rebased',
  NO_GROUND_TRUTH: 'no-ground-truth',
  NOT_ATTEMPTED: 'not-attempted',
});

/**
 * Reasons that mean "impossible", as opposed to "nobody did it".
 * `NOT_ATTEMPTED` is deliberately absent — that is the whole point of the distinction.
 */
const BLOCKING = new Set([
  BLOCK_REASONS.NO_SHARED_DEAL_BOOK,
  BLOCK_REASONS.GENERATIONS_NOT_REBASED,
  BLOCK_REASONS.NO_GROUND_TRUTH,
]);

/** A stable key for an unordered pair — contrast(A,B) is contrast(B,A). */
export const contrastKey = (a, b) => [a, b].sort().join(' vs ');

/**
 * Enumerate every pairwise contrast among a set of members.
 *
 * Pairwise and unordered, because "did we compare A to B" is symmetric and counting it twice
 * would make the denominator lie about how much was left undone.
 */
export const enumeratePossible = (members = []) => {
  const out = [];
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      out.push(contrastKey(members[i], members[j]));
    }
  }
  return out;
};

/**
 * Build a Comparison Census.
 *
 * @param {Object} params
 * @param {string} params.axis - one of COMPARISON_AXES
 * @param {string[]} params.members - the things that could be contrasted on this axis
 * @param {Array} params.drawn - [{contrast, resultCardId}]. A contrast claimed WITHOUT a
 *   Result Card id is not drawn — that is the same bar ADR-009 sets for every other
 *   comparative claim, applied to the claim that a comparison happened at all.
 * @param {Object} params.blockedReasons - {contrastKey: reason}
 */
export const buildComparisonCensus = ({
  axis,
  members = [],
  drawn = [],
  blockedReasons = {},
} = {}) => {
  if (!COMPARISON_AXES.includes(axis)) {
    throw new StandardOfRecordError(
      `comparisonCensus: axis must be one of ${COMPARISON_AXES.join(' | ')}, got "${axis}"`,
      { axis },
    );
  }

  const possible = enumeratePossible(members);
  const possibleSet = new Set(possible);

  const drawnClean = [];
  for (const d of drawn) {
    if (!d?.resultCardId) {
      throw new StandardOfRecordError(
        `comparisonCensus: contrast "${d?.contrast}" is listed as drawn but names no `
        + 'resultCardId. A comparison claimed without a card is not a comparison that happened.',
        { contrast: d?.contrast },
      );
    }
    if (!possibleSet.has(d.contrast)) {
      throw new StandardOfRecordError(
        `comparisonCensus: contrast "${d.contrast}" was drawn but is not among the possible `
        + 'contrasts for these members — the denominator and the numerator disagree, which '
        + 'means one of them is wrong.',
        { contrast: d.contrast },
      );
    }
    drawnClean.push(Object.freeze({ ...d }));
  }

  const drawnSet = new Set(drawnClean.map((d) => d.contrast));
  const notDrawn = possible
    .filter((c) => !drawnSet.has(c))
    .map((c) => Object.freeze({
      contrast: c,
      reason: blockedReasons[c] ?? BLOCK_REASONS.NOT_ATTEMPTED,
      blocked: BLOCKING.has(blockedReasons[c]),
    }));

  const census = {
    schemaVersion: SOR_SCHEMA_VERSIONS.comparisonCensus,
    axis,
    possible,
    drawn: drawnClean,
    notDrawn,
    blockedReasons: { ...blockedReasons },
  };

  const problems = checkAgainstSchema(census, SOR_SCHEMAS.comparisonCensus, { label: 'comparisonCensus' });
  if (problems.length > 0) {
    throw new StandardOfRecordError(
      `comparisonCensus is not well-formed: ${problems.join('; ')}`,
      { problems },
    );
  }
  return Object.freeze(census);
};

/**
 * The headline numbers, separated the way the header insists.
 *
 * `notAttempted` is reported on its own rather than folded into a coverage percentage,
 * because a census that is 60% drawn tells you nothing about whether the missing 40% was
 * impossible or merely skipped — and those call for entirely different responses.
 */
export const censusSummary = (census) => {
  const blocked = census.notDrawn.filter((n) => n.blocked);
  const notAttempted = census.notDrawn.filter((n) => !n.blocked);
  return Object.freeze({
    axis: census.axis,
    possible: census.possible.length,
    drawn: census.drawn.length,
    blocked: blocked.length,
    notAttempted: notAttempted.length,
    notAttemptedContrasts: Object.freeze(notAttempted.map((n) => n.contrast)),
    // The fraction of DRAWABLE contrasts actually drawn. Blocked ones are excluded from the
    // denominator: counting an impossible contrast as a miss would let a run look negligent
    // for a gap in the artifacts, and would let real negligence hide behind that noise.
    drawableCoverage: (census.possible.length - blocked.length) === 0
      ? null
      : census.drawn.length / (census.possible.length - blocked.length),
  });
};
