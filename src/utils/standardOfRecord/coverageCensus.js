/**
 * coverageCensus.js — the coverage record, INCLUDING the contexts hit zero times (WS-328).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE ONE THING THIS OBJECT EXISTS TO PREVENT.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * `calibrationMetrics.aggregateBySlice` groups OBSERVED rows only, so a context with no rows
 * never appears in its output. Six months later "did we test 4-bet pots?" is answerable only
 * from the absence of a row — and an absence cannot distinguish:
 *
 *     "we looked and found none"        (the spot was in scope and never came up)
 *     "we never looked"                 (the run's scope never covered it)
 *     "a bug dropped them"              (the run reached it and threw the rows away)
 *
 * Those three license completely different conclusions. The first says the spot is rare. The
 * second says nothing at all. The third says the instrument is broken. Collapsed together,
 * a coverage GAP reads as a measured ABSENCE, which is the strongest possible misreading.
 *
 * So this census emits ONE ROW PER CONTEXT IN THE DECLARED DOMAIN, each carrying a status from
 * a closed enum. A never-looked cell is a `unexamined` row with a reason on it — never a
 * missing row. That is the same failure shape as the repo's recorded absence-as-identity defect
 * (WS-368: "live" was the ABSENCE of a source marker, so the live subset could not be selected
 * and therefore could not be measured), and it gets the same remedy: positive identity.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY EXAMINATION IS DECLARED AND NEVER INFERRED.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * The tempting implementation reads the hit map and calls everything else a zero. That
 * implementation cannot ever produce `unexamined`, because absence from the hit map is exactly
 * what it treats as evidence of looking. The distinction would be structurally unrepresentable
 * — present in the docblock and absent from the data.
 *
 * `buildCoverageCensus` therefore REFUSES to run without an explicit `examination` declaration
 * and there is no default. `{mode:'exhaustive'}` is a POSITIVE CLAIM that the run's scope
 * covered the whole reachable domain, in the same spirit as `manifest.unseededSources: []`
 * being a positive claim of bit-reproducibility rather than an omission.
 *
 * The same argument decides the reason field: an `unexamined` cell without a reason would be
 * back to "we do not know why this is empty", one level down. So a reason is required, from a
 * closed enum, with a mandatory default in `enumerated` mode.
 */

import {
  SOR_SCHEMAS,
  SOR_SCHEMA_VERSIONS,
  StandardOfRecordError,
  checkAgainstSchema,
} from './schemas.js';

/**
 * What a census cell can be. Closed, because an open set would let a producer invent a status
 * whose meaning a reader has to guess — and guessing is what this object removes.
 */
export const CELL_STATUSES = Object.freeze({
  /** Examined, and it happened. n > 0. */
  HIT: 'hit',
  /** Examined, and it genuinely never came up. WE LOOKED AND FOUND NONE. */
  OBSERVED_ZERO: 'observed-zero',
  /** NOT examined. WE NEVER LOOKED. Carries a reason; never inferable from an absent row. */
  UNEXAMINED: 'unexamined',
  /** Examined and reached, then discarded — a skip, a throw, a filter. THE BUG CASE. */
  DROPPED: 'dropped',
  /** Cannot occur by construction (UTG facing a raise). Excluded from coverage denominators. */
  UNREACHABLE: 'unreachable',
  /** Occurred but cannot be assigned to this cell (masked hole cards). `entryCensus` precedent. */
  UNATTRIBUTABLE: 'unattributable',
});

const ALL_STATUSES = Object.freeze(Object.values(CELL_STATUSES));

/**
 * Why a context was never examined. Closed for the same reason the statuses are.
 *
 * These are NOT interchangeable: `out-of-run-scope` is a decision someone made and can undo,
 * `run-incomplete` means the number in front of you is from a truncated run, and
 * `instrument-cannot-evaluate` is a permanent property of the measurement.
 */
export const UNEXAMINED_REASONS = Object.freeze({
  /** The run's filters excluded it deliberately (--stakes, --sites, a partition). */
  OUT_OF_RUN_SCOPE: 'out-of-run-scope',
  /** The run stopped early — a cap, a crash, a timeout. The census is of a PARTIAL run. */
  RUN_INCOMPLETE: 'run-incomplete',
  /** The instrument has no way to evaluate this context at all. */
  INSTRUMENT_CANNOT_EVALUATE: 'instrument-cannot-evaluate',
  /** The context is in the domain and the run simply never enumerated it. */
  NEVER_ENUMERATED: 'never-enumerated',
});

const UNEXAMINED_REASON_VALUES = Object.freeze(Object.values(UNEXAMINED_REASONS));

/** How the examined set was established. */
export const EXAMINATION_MODES = Object.freeze(['enumerated', 'exhaustive']);

/** The separator for a composite context key. Chosen to be illegal inside an axis level. */
export const CONTEXT_KEY_SEP = '|';

/**
 * Enumerate every context in a declared domain.
 *
 * The domain is an ORDERED list of axes, each with its levels. Ordered because the context key
 * is positional and two censuses whose axes were declared in different orders must not be
 * silently unioned — the same argument `comparisonCensus.axis` makes one level up.
 *
 * @param {Array<{name: string, levels: Array<string|number>}>} axes
 * @returns {Array<{contextKey: string, coords: Object}>}
 */
export const enumerateContexts = (axes = []) => {
  if (!Array.isArray(axes) || axes.length === 0) {
    throw new StandardOfRecordError(
      'coverageCensus: a domain with no axes has no contexts, so a census over it cannot say '
      + 'what "zero" means. Declare the axes.',
    );
  }
  for (const axis of axes) {
    if (!axis?.name || !Array.isArray(axis.levels) || axis.levels.length === 0) {
      throw new StandardOfRecordError(
        `coverageCensus: axis "${axis?.name}" must declare a non-empty levels array`,
        { axis: axis?.name },
      );
    }
    for (const level of axis.levels) {
      if (String(level).includes(CONTEXT_KEY_SEP)) {
        throw new StandardOfRecordError(
          `coverageCensus: axis level "${level}" contains the key separator "${CONTEXT_KEY_SEP}" `
          + '— two different contexts would collide on one key',
          { axis: axis.name, level },
        );
      }
    }
  }

  let rows = [{ parts: [], coords: {} }];
  for (const axis of axes) {
    const next = [];
    for (const row of rows) {
      for (const level of axis.levels) {
        next.push({
          parts: [...row.parts, String(level)],
          coords: { ...row.coords, [axis.name]: level },
        });
      }
    }
    rows = next;
  }
  return rows.map((r) => ({ contextKey: r.parts.join(CONTEXT_KEY_SEP), coords: r.coords }));
};

/**
 * Declare what the run actually examined.
 *
 * @param {Object} params
 * @param {string} params.mode - 'enumerated' | 'exhaustive'
 * @param {string[]} [params.contexts] - required in 'enumerated' mode: the exact examined set
 * @param {string} [params.unexaminedReason] - required in 'enumerated' mode: why everything
 *   else was not looked at. There is no default, because a default is how "we never looked"
 *   turns back into "nothing to report".
 * @param {string} [params.basis] - prose: HOW the run knows it examined what it claims
 */
export const declareExamination = ({
  mode,
  contexts = null,
  unexaminedReason = null,
  basis = null,
} = {}) => {
  if (!EXAMINATION_MODES.includes(mode)) {
    throw new StandardOfRecordError(
      `coverageCensus: examination.mode must be one of ${EXAMINATION_MODES.join(' | ')}, got `
      + `"${mode}". There is no default: inferring examination from observation is exactly the `
      + 'collapse this object exists to prevent — it makes "we never looked" unrepresentable.',
      { mode },
    );
  }
  if (mode === 'exhaustive') {
    return Object.freeze({ mode, contexts: null, unexaminedReason: null, basis });
  }
  if (!Array.isArray(contexts)) {
    throw new StandardOfRecordError(
      'coverageCensus: examination.mode "enumerated" requires the examined context list. '
      + 'Claim "exhaustive" only when the run\'s scope genuinely covered the reachable domain — '
      + 'it is a positive claim, like an empty manifest.unseededSources.',
    );
  }
  if (!UNEXAMINED_REASON_VALUES.includes(unexaminedReason)) {
    throw new StandardOfRecordError(
      'coverageCensus: examination.unexaminedReason is required in "enumerated" mode and must '
      + `be one of ${UNEXAMINED_REASON_VALUES.join(' | ')}, got "${unexaminedReason}". An `
      + 'unexamined cell without a reason is "we do not know why this is empty" one level down.',
      { unexaminedReason },
    );
  }
  return Object.freeze({
    mode,
    contexts: Object.freeze([...contexts]),
    unexaminedReason,
    basis,
  });
};

/**
 * Build a Coverage Census over a declared domain.
 *
 * @param {Object} params
 * @param {Object} params.domain - declared scope; free-form, but it is what "zero" is relative to
 * @param {Array}  params.axes - ordered axes, per `enumerateContexts`
 * @param {Object} params.hits - {contextKey: count}. Counts, not presence.
 * @param {Object} params.examination - from `declareExamination`. REQUIRED.
 * @param {Object} [params.dropped] - {contextKey: skipReason}. Reached, then discarded.
 * @param {Object} [params.droppedCounts] - {contextKey: n}. HOW MANY were discarded. Separate
 *   from `hits` because a cell can be PARTLY dropped, and collapsing the two would let a cell
 *   that scored 400 decisions and lost 3 look identical to one that lost everything.
 * @param {Object} [params.unreachable] - {contextKey: reason}. Cannot occur by construction.
 * @param {Object} [params.unattributable] - {contextKey: count}. Happened, unassignable.
 * @param {Object} [params.unexaminedReasons] - per-context override of the default reason
 * @param {number} [params.abstentions] - decisions where the surface declared itself out of domain
 */
export const buildCoverageCensus = ({
  domain,
  axes,
  hits = {},
  examination,
  dropped = {},
  droppedCounts = {},
  unreachable = {},
  unattributable = {},
  unexaminedReasons = {},
  abstentions = 0,
} = {}) => {
  if (!examination || typeof examination !== 'object') {
    throw new StandardOfRecordError(
      'coverageCensus: `examination` is required. Without it the builder would have to infer '
      + '"we looked" from "we found something", and a never-looked context could then only be '
      + 'represented by its absence — which is the defect, not the design.',
    );
  }
  if (!EXAMINATION_MODES.includes(examination.mode)) {
    throw new StandardOfRecordError(
      `coverageCensus: unknown examination.mode "${examination.mode}"`, { mode: examination.mode },
    );
  }

  const contexts = enumerateContexts(axes);
  const known = new Set(contexts.map((c) => c.contextKey));

  // The numerator must live inside the denominator. Same refusal comparisonCensus makes.
  for (const key of Object.keys(hits)) {
    if (!known.has(key)) {
      throw new StandardOfRecordError(
        `coverageCensus: hits recorded for "${key}", which is not a context in the declared `
        + 'domain — the numerator and the denominator disagree, so one of them is wrong.',
        { contextKey: key },
      );
    }
  }
  for (const key of Object.keys(dropped)) {
    if (!known.has(key)) {
      throw new StandardOfRecordError(
        `coverageCensus: a drop was recorded for "${key}", which is not in the declared domain`,
        { contextKey: key },
      );
    }
  }

  const examinedSet = examination.mode === 'exhaustive'
    ? known
    : new Set(examination.contexts ?? []);

  // A hit on a context nobody examined is a contradiction, not a rounding issue: either the
  // examination declaration is wrong or the hits are. Both readings poison the census, so it
  // refuses rather than picking one.
  for (const [key, count] of Object.entries(hits)) {
    if (count > 0 && !examinedSet.has(key)) {
      throw new StandardOfRecordError(
        `coverageCensus: "${key}" carries ${count} hits but is not in the examined set. You `
        + 'cannot hit a context you never looked at — the examination declaration and the hit '
        + 'map contradict each other.',
        { contextKey: key, count },
      );
    }
  }

  const cells = contexts.map(({ contextKey, coords }) => {
    const droppedCount = droppedCounts[contextKey]
      ?? (dropped[contextKey] !== undefined ? 1 : 0);
    const base = { contextKey, coords, hits: 0, droppedCount, status: null, reason: null };

    if (unreachable[contextKey] !== undefined) {
      return Object.freeze({
        ...base,
        droppedCount: 0,
        status: CELL_STATUSES.UNREACHABLE,
        reason: String(unreachable[contextKey]),
      });
    }
    if (!examinedSet.has(contextKey)) {
      const reason = unexaminedReasons[contextKey] ?? examination.unexaminedReason;
      if (!UNEXAMINED_REASON_VALUES.includes(reason)) {
        throw new StandardOfRecordError(
          `coverageCensus: "${contextKey}" was not examined and carries no valid reason. `
          + `Expected one of ${UNEXAMINED_REASON_VALUES.join(' | ')}.`,
          { contextKey, reason },
        );
      }
      return Object.freeze({ ...base, status: CELL_STATUSES.UNEXAMINED, reason });
    }
    if (unattributable[contextKey] > 0) {
      return Object.freeze({
        ...base,
        hits: hits[contextKey] ?? 0,
        status: CELL_STATUSES.UNATTRIBUTABLE,
        reason: `${unattributable[contextKey]} decisions occurred but could not be attributed`,
      });
    }
    const n = hits[contextKey] ?? 0;
    if (n > 0) {
      // Scored AND possibly partly dropped. `droppedCount` rides along so a cell that lost 3
      // of 400 decisions is not read as clean, and is not read as lost either.
      return Object.freeze({
        ...base,
        hits: n,
        status: CELL_STATUSES.HIT,
        reason: droppedCount > 0 ? `partially dropped: ${dropped[contextKey]}` : null,
      });
    }
    if (droppedCount > 0) {
      // Reached, and EVERYTHING was discarded. A bug signature. Emphatically not a zero: a
      // zero says the spot is rare, this says the instrument failed on it.
      return Object.freeze({
        ...base,
        status: CELL_STATUSES.DROPPED,
        reason: String(dropped[contextKey] ?? 'dropped'),
      });
    }
    return Object.freeze({
      ...base,
      hits: 0,
      status: CELL_STATUSES.OBSERVED_ZERO,
      // Stated rather than left implicit: this cell is empty BECAUSE nothing happened in it,
      // not because nobody looked. That sentence is the whole point of the object.
      reason: 'examined; no observation',
    });
  });

  const statusCounts = {};
  for (const s of ALL_STATUSES) statusCounts[s] = 0;
  for (const cell of cells) statusCounts[cell.status] += 1;

  const census = {
    schemaVersion: SOR_SCHEMA_VERSIONS.coverageCensus,
    domain,
    cells,
    totalContexts: cells.length,
    hitContexts: statusCounts[CELL_STATUSES.HIT],
    abstentions,
    // ── v2 (WS-328) ────────────────────────────────────────────────────────────────────
    examination: {
      mode: examination.mode,
      examinedContexts: examinedSet.size,
      unexaminedReason: examination.unexaminedReason ?? null,
      basis: examination.basis ?? null,
    },
    statusCounts,
    axes: axes.map((a) => ({ name: a.name, levels: [...a.levels] })),
  };

  const problems = coverageCensusProblems(census);
  if (problems.length > 0) {
    throw new StandardOfRecordError(
      `coverageCensus is not well-formed: ${problems.join('; ')}`, { problems },
    );
  }
  return Object.freeze(census);
};

/**
 * Problems with a census, as strings. Empty means valid.
 *
 * Exported separately from the builder for the reason `manifestProblems` and
 * `resultCardProblems` are: a scanner has to be able to check an artifact it did not build,
 * and a check that can disagree with its constructor is worse than no check.
 */
export const coverageCensusProblems = (census) => {
  const problems = checkAgainstSchema(census, SOR_SCHEMAS.coverageCensus, { label: 'coverageCensus' });
  if (problems.length) return problems;

  if (!Array.isArray(census.cells)) return ['coverageCensus.cells must be an array'];
  if (census.totalContexts !== census.cells.length) {
    problems.push(
      `coverageCensus.totalContexts (${census.totalContexts}) disagrees with cells.length `
      + `(${census.cells.length}) — a truncated cell list must not read as a small domain`,
    );
  }

  for (const cell of census.cells) {
    if (!ALL_STATUSES.includes(cell?.status)) {
      problems.push(`coverageCensus cell "${cell?.contextKey}" has unknown status "${cell?.status}"`);
    }
    if (cell?.status === CELL_STATUSES.UNEXAMINED
      && !UNEXAMINED_REASON_VALUES.includes(cell.reason)) {
      problems.push(
        `coverageCensus cell "${cell.contextKey}" is unexamined with no valid reason — `
        + '"we never looked" must say why, or it is indistinguishable from "nothing happened"',
      );
    }
    if (cell?.status === CELL_STATUSES.OBSERVED_ZERO && cell.hits !== 0) {
      problems.push(`coverageCensus cell "${cell.contextKey}" is observed-zero with ${cell.hits} hits`);
    }
    if (cell?.status === CELL_STATUSES.HIT && !(cell.hits > 0)) {
      problems.push(`coverageCensus cell "${cell.contextKey}" is a hit with ${cell.hits} hits`);
    }
  }

  if (!census.examination || !EXAMINATION_MODES.includes(census.examination.mode)) {
    problems.push(
      'coverageCensus.examination is missing or invalid — without it, an empty cell cannot be '
      + 'read as "we looked and found none" rather than "we never looked"',
    );
  }
  return problems;
};

/**
 * The headline figures, each with the conditioning set it is conditional ON.
 *
 * DELIBERATELY NOT ONE PERCENTAGE. A single "coverage: 62%" would have to choose a
 * denominator, and every available choice hides one of the three absences apart. So the
 * summary reports each k/n with its conditional attached, per the repo rule that numbers carry
 * their conditional — and reports the INVERSE conditional where one exists.
 */
export const censusCoverage = (census) => {
  const c = census.statusCounts ?? {};
  const total = census.totalContexts;
  const unreachable = c[CELL_STATUSES.UNREACHABLE] ?? 0;
  const reachable = total - unreachable;
  const examined = (c[CELL_STATUSES.HIT] ?? 0)
    + (c[CELL_STATUSES.OBSERVED_ZERO] ?? 0)
    + (c[CELL_STATUSES.UNATTRIBUTABLE] ?? 0)
    + (c[CELL_STATUSES.DROPPED] ?? 0);
  const hit = c[CELL_STATUSES.HIT] ?? 0;
  const unexamined = c[CELL_STATUSES.UNEXAMINED] ?? 0;
  const observedZero = c[CELL_STATUSES.OBSERVED_ZERO] ?? 0;

  const rate = (k, n) => (n === 0 ? null : k / n);

  return Object.freeze({
    /** P(hit | examined and reachable) — of what we looked at, how much happened. */
    hitGivenExamined: Object.freeze({
      k: hit, n: examined, rate: rate(hit, examined),
      conditional: 'P(context occurred | the run examined it)',
    }),
    /** The inverse: of the empty cells we looked at, all of them are genuine zeros. */
    observedZeroGivenExamined: Object.freeze({
      k: observedZero, n: examined, rate: rate(observedZero, examined),
      conditional: 'P(context never occurred | the run examined it) — WE LOOKED AND FOUND NONE',
    }),
    /** THE NUMBER A REPORT MUST PRINT. How much of the domain was never looked at. */
    neverLookedGivenReachable: Object.freeze({
      k: unexamined, n: reachable, rate: rate(unexamined, reachable),
      conditional: 'P(the run never examined it | the context can occur at all) — WE NEVER LOOKED',
    }),
    /** Reached and thrown away. A bug signature, never a zero. */
    droppedGivenReachable: Object.freeze({
      k: c[CELL_STATUSES.DROPPED] ?? 0, n: reachable, rate: rate(c[CELL_STATUSES.DROPPED] ?? 0, reachable),
      conditional: 'P(reached then discarded | the context can occur at all)',
    }),
    unreachableGivenDomain: Object.freeze({
      k: unreachable, n: total, rate: rate(unreachable, total),
      conditional: 'P(cannot occur by construction | context is in the declared domain)',
    }),
    /** DECISION-level, not cell-level: how many individual decisions were discarded. */
    droppedDecisions: census.cells.reduce((n, c) => n + (c.droppedCount ?? 0), 0),
    partiallyDroppedCells: census.cells.filter(
      (c) => c.status === CELL_STATUSES.HIT && (c.droppedCount ?? 0) > 0,
    ).length,
    abstentions: census.abstentions,
    examinationMode: census.examination?.mode ?? null,
  });
};

/**
 * The never-looked cells, named.
 *
 * A count is not enough. "17 contexts unexamined" tells a reader that a gap exists; the list
 * tells them whether the gap is the one that matters for the claim they are about to make.
 */
export const neverLooked = (census) => Object.freeze(
  census.cells
    .filter((c) => c.status === CELL_STATUSES.UNEXAMINED)
    .map((c) => Object.freeze({ contextKey: c.contextKey, coords: c.coords, reason: c.reason })),
);

/**
 * The genuine zeros, named. The complement of `neverLooked`, and the pair is the whole claim.
 */
export const observedZeros = (census) => Object.freeze(
  census.cells
    .filter((c) => c.status === CELL_STATUSES.OBSERVED_ZERO)
    .map((c) => Object.freeze({ contextKey: c.contextKey, coords: c.coords })),
);

// ═══════════════════════════════════════════════════════════════════════════════════════════
// WS-428 — `opportunitiesPerHand`: the second factor of the headline figure.
//
// SCORED-READOUT-SPEC §3.3 defines the optimizable figure as
//
//     overallEvBB100 = edgeBB × opportunitiesPerHand × 100
//
// and sources the second factor from "the COVERAGE CENSUS over the Deal Book — NOT from
// n/handsRepresented on the scored subset". This block is what makes that refusal STRUCTURAL
// rather than prose.
//
// THE FAILURE THIS PREVENTS. `n / handsRepresented` computed on the scored subset looks like
// the same number and is not: it conditions on the hands the HARNESS managed to score, so it
// inherits every sampling limit of the instrument — `--max-decisions`, walk-forward training
// minimums, engine skips, geometry-resolution failures. The two quantities diverge exactly
// when the harness is under-powered, which is precisely when someone is most tempted to quote
// the headline anyway. `opportunitiesPerHand` is a property of the GAME — how many decisions
// a hand presents to a seat — and its only legitimate source is a walk of the Deal Book's own
// hand structure.
//
// HOW THE REFUSAL IS ENFORCED, in three layers:
//   1. `attachOpportunityCount` accepts exactly one basis (`deal-book-structure`) from a
//      closed enum, and names the forbidden derivations in its error message.
//   2. It requires the census's examination mode to be `exhaustive` — a positive claim that
//      every hand record in the Deal Book was walked. An `enumerated` census is a census of a
//      SCOPED walk, and a count over a scoped walk is a harness property again.
//   3. The opportunity total is derived from the census's own cells, never accepted as a
//      caller-supplied number — the count cannot disagree with the record it rides on.
//
// SCHEMA NOTE (deferred, deliberately): `opportunities` is not yet declared in
// `schemas.js` COVERAGE_CENSUS_FIELDS. It is legal today because `checkAgainstSchema`
// ignores unknown fields, and it validates here via `attachOpportunityCount`'s own checks.
// The descriptor `{ name: 'opportunities', type: 'object', since: 3 }` plus the
// `SOR_SCHEMA_VERSIONS.coverageCensus` bump to 3 belongs in schemas.js — it was NOT added in
// WS-428 because schemas.js was under concurrent edit by another work item the same night.
// Append it (additive-only, `check-sor-additive.sh` guards) at the next touch of schemas.js.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/**
 * The one legitimate basis for an opportunity count. Closed enum of size one, deliberately:
 * the point is not to offer choices, it is to make the illegitimate derivations nameable and
 * refusable.
 */
export const OPPORTUNITY_BASIS = Object.freeze({
  /** Counted by walking every hand record in the Deal Book. The only admissible basis. */
  DEAL_BOOK_STRUCTURE: 'deal-book-structure',
});

/**
 * The derivations §3.3 refuses by name. Kept as data so the error message and any future
 * scanner agree on what the forbidden thing is called.
 */
export const FORBIDDEN_OPPORTUNITY_BASES = Object.freeze([
  'scored-subset',
  'n-over-hands-represented',
  'harness-throughput',
]);

/**
 * Attach a decision-opportunity count to a census built over a Deal Book.
 *
 * The census's cells carry the opportunity counts (hits per context — e.g. per street); this
 * attaches the per-hand DENOMINATOR and the provenance that makes the ratio quotable.
 *
 * `seatHands`, not hands: POKER_THEORY §14.1 and the Hole Map's RULE 7a-adjacent seat-hands
 * rule. A hand at a 9-handed table is nine players' hands; dividing one seat's opportunities
 * by table-hands would deflate the rate ~9×. One seat-hand = one player dealt into one hand.
 *
 * @param {Object} census - from `buildCoverageCensus`, examination mode `exhaustive`
 * @param {Object} params
 * @param {string} params.basis - must be OPPORTUNITY_BASIS.DEAL_BOOK_STRUCTURE
 * @param {number} params.seatHands - count of (player, hand) participations in the Deal Book
 * @param {string} [params.dealBookHash] - the book the walk covered, so the count travels
 *   with the identity of the hand set it is a property of
 * @param {string} [params.note] - prose provenance (what counted as an opportunity)
 * @returns {Object} a new frozen census carrying `opportunities`
 */
export const attachOpportunityCount = (census, {
  basis,
  seatHands,
  dealBookHash = null,
  note = null,
} = {}) => {
  const problems = coverageCensusProblems(census);
  if (problems.length > 0) {
    throw new StandardOfRecordError(
      `attachOpportunityCount: refusing to attach to an invalid census: ${problems.join('; ')}`,
      { problems },
    );
  }
  if (FORBIDDEN_OPPORTUNITY_BASES.includes(basis)) {
    throw new StandardOfRecordError(
      `attachOpportunityCount: basis "${basis}" is REFUSED. opportunitiesPerHand is a property `
      + 'of the GAME (how many decisions a hand presents to a seat), never of how many '
      + 'decisions the harness scored. n/handsRepresented on the scored subset inherits every '
      + 'sampling limit of the instrument — --max-decisions, walk-forward minimums, engine '
      + 'skips — and diverges from the game quantity exactly when the harness is under-powered '
      + '(SCORED-READOUT-SPEC §3.3). Count from Deal Book hand structure instead.',
      { basis },
    );
  }
  if (basis !== OPPORTUNITY_BASIS.DEAL_BOOK_STRUCTURE) {
    throw new StandardOfRecordError(
      `attachOpportunityCount: unknown basis "${basis}". The only admissible basis is `
      + `"${OPPORTUNITY_BASIS.DEAL_BOOK_STRUCTURE}".`,
      { basis },
    );
  }
  if (census.examination?.mode !== 'exhaustive') {
    throw new StandardOfRecordError(
      'attachOpportunityCount: the census must claim examination mode "exhaustive" — a '
      + 'positive claim that every hand record in the Deal Book was walked. An "enumerated" '
      + 'census describes a SCOPED walk, and an opportunity count over a scoped walk is a '
      + 'property of the run\'s scope, which is the harness dependence this factor exists to '
      + 'not have.',
      { mode: census.examination?.mode ?? null },
    );
  }
  if (!Number.isInteger(seatHands) || seatHands <= 0) {
    throw new StandardOfRecordError(
      `attachOpportunityCount: seatHands must be a positive integer, got ${seatHands}. A `
      + 'count over zero seat-hands has no denominator, and a fractional one was derived '
      + 'rather than counted.',
      { seatHands },
    );
  }

  // Derived from the census's own cells, never accepted from the caller: the total cannot
  // disagree with the record it rides on. Raw parts are stored; the ratio is computed by the
  // reader (raw over derived — derived can be recomputed, raw cannot be recovered).
  const decisionOpportunities = census.cells.reduce((n, c) => n + (c.hits ?? 0), 0);

  return Object.freeze({
    ...census,
    opportunities: Object.freeze({
      basis,
      seatHands,
      decisionOpportunities,
      dealBookHash,
      note,
    }),
  });
};

/**
 * THE SECOND FACTOR of `overallEvBB100`, read off a census that carries an opportunity count.
 *
 * Throws — rather than returning null — on a census with no attached count, because the
 * caller reaching for this is about to multiply it into the headline figure, and the tempting
 * fallback in that position is exactly the scored-subset substitution §3.3 forbids. An error
 * that names the correct path is safer than a null that invites the wrong one.
 *
 * @param {Object} census - a census that went through `attachOpportunityCount`
 * @returns {{perHand: number, decisionOpportunities: number, seatHands: number,
 *   basis: string, dealBookHash: string|null, conditional: string}}
 */
export const opportunitiesPerHand = (census) => {
  const opp = census?.opportunities;
  if (!opp) {
    throw new StandardOfRecordError(
      'opportunitiesPerHand: this census carries no opportunity count. Attach one with '
      + '`attachOpportunityCount` from a walk of the Deal Book\'s hand structure. Do NOT '
      + 'substitute n/handsRepresented from the scored subset — that number inherits every '
      + 'sampling limit of the harness and is refused by name (SCORED-READOUT-SPEC §3.3).',
    );
  }
  if (opp.basis !== OPPORTUNITY_BASIS.DEAL_BOOK_STRUCTURE) {
    // Re-checked at read time: an artifact can be edited between write and read, and the
    // reader is the last line before the number enters a headline.
    throw new StandardOfRecordError(
      `opportunitiesPerHand: basis "${opp.basis}" is not "${OPPORTUNITY_BASIS.DEAL_BOOK_STRUCTURE}" `
      + '— refusing to lift a harness-dependent count into the headline factor.',
      { basis: opp.basis },
    );
  }
  if (!Number.isInteger(opp.seatHands) || opp.seatHands <= 0) {
    throw new StandardOfRecordError(
      `opportunitiesPerHand: seatHands is ${opp.seatHands}; the ratio has no denominator.`,
      { seatHands: opp.seatHands },
    );
  }
  return Object.freeze({
    perHand: opp.decisionOpportunities / opp.seatHands,
    decisionOpportunities: opp.decisionOpportunities,
    seatHands: opp.seatHands,
    basis: opp.basis,
    dealBookHash: opp.dealBookHash ?? null,
    // Numbers carry their conditional (repo rule): this is per SEAT-HAND in the Deal Book,
    // unconditional on reaching the flop or on the harness scoring anything.
    conditional: 'decision opportunities per seat-hand in the Deal Book, from hand structure '
      + '— invariant to --max-decisions and every other harness limit by construction',
  });
};
