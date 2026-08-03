/**
 * fringeMigration.mjs — WS-323. Watch the fringe move, and refuse to invent movement.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THIS INSTRUMENT IS FOR
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * The entry map's value is not the snapshot. It is that the SAME 169 × position × facing-action
 * cells can be recomputed under a later continuation policy and joined to the earlier run. Hands
 * migrating out of the fringe into clear-+EV is what "getting better" IS, stated on a fixed set
 * of cells instead of on a moving target. CP-1 undervalues unpaired hands because it cannot
 * barrel; a policy that can should show AKs, AQs and the suited connectors climbing out of
 * `clear-`, and this report is where that claim either appears or does not.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE THREE WAYS A MIGRATION REPORT LIES, AND WHAT IS DONE ABOUT EACH
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * 1. IT COMPARES DIFFERENT CELLS. If the enumeration changed between runs — a position category
 *    added, a hand class relabelled — a positional or partial join silently pairs cell N of one
 *    map with cell N of another and reports migration that never happened. So the join is on
 *    `cellId` and a mismatched cell SET is refused outright, not intersected. An intersection
 *    would quietly drop the cells the change was about.
 *
 * 2. A REPORTING PARAMETER MOVES THE BANDS. τ decides where `fringe-tight` ends and
 *    `unmeasured` begins. Read the stored bands from two files written at different τ and every
 *    borderline cell "migrates" — movement manufactured entirely by a presentational setting.
 *    So BOTH maps are re-banded at ONE τ from their stored intervals, via `loadEntryMap`.
 *
 * 3. NOISE IS READ AS PROGRESS. Every margin here is a Monte Carlo estimate with an interval.
 *    Two runs of IDENTICAL code produce different margins, and a report that prints those
 *    differences as deltas will show a policy improving when nothing changed at all. So every
 *    delta carries its OWN interval — the two half-widths in quadrature, independent draws —
 *    and a delta whose interval straddles zero is reported as `measurable: false`. It is still
 *    printed, because hiding it would be its own distortion; it just may not be counted as
 *    movement.
 *
 * The `replicate` comparison kind exists to make failure #3 testable rather than merely argued
 * about: run the same policy at the same commit twice and the honest output is a report with
 * essentially no MEASURABLE migration. If it shows some, the instrument is wrong.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY A POLICY CHANGE IS LABELLED, NOT REFUSED
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * `entryMap.mjs` warns that a map computed under a different continuation "must not be diffed
 * against this one as if it were a generation of the same thing" — and the operative words are
 * AS IF. Diffing across policies is the entire purpose; what is forbidden is doing it silently.
 * A policy change means the QUANTITY changed, not just its estimate, so the comparison is
 * stamped `policy-change` and both policy ids ride in the artifact. Reading a policy-change
 * report as "the engine got better at the same job" is then a mistake a reader has to make on
 * purpose.
 */

import { BANDS, DEFAULT_TAU_BB, EntryMapError, loadEntryMap } from './entryMap.mjs';

/** Schema version of the migration report. */
export const MIGRATION_SCHEMA_VERSION = 1;

/**
 * What kind of comparison two maps constitute.
 *
 *   replicate     — same policy, same commit. Any measurable migration is an instrument bug.
 *   generation    — same policy, different commit. The code implementing the policy changed.
 *   policy-change — different policy. A different quantity, legitimately compared but never
 *                   silently.
 */
export const COMPARISON_KINDS = Object.freeze({
  REPLICATE: 'replicate',
  GENERATION: 'generation',
  POLICY_CHANGE: 'policy-change',
});

/** Labels a cell can carry in a transition, including the two kinds of no-number. */
export const TRANSITION_LABELS = Object.freeze([
  BANDS.CLEAR_PLUS,
  BANDS.FRINGE_TIGHT,
  BANDS.UNMEASURED,
  BANDS.CLEAR_MINUS,
  'degenerate',
  'unreachable',
]);

const labelOf = (cell) => {
  if (cell.band) return cell.band;
  if (cell.reachable === false) return 'unreachable';
  return 'degenerate';
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * The delta between two estimates of the same cell, with its own interval.
 *
 * The half-widths combine in QUADRATURE because the two runs are independent draws — adding
 * them would overstate the delta's uncertainty and under-report real movement, which is the
 * opposite failure to the one this guards against but no more honest.
 *
 * `measurable` is `|delta| > halfWidth`, i.e. the delta's interval does not straddle zero. It
 * is deliberately the same test the map itself uses to decide whether a cell is `clear`: a
 * difference is real on the same terms a margin is.
 */
export const deltaOf = (before, after) => {
  if (!isNum(before?.margin) || !isNum(after?.margin)) return null;
  const delta = after.margin - before.margin;
  const halfWidth = Math.sqrt((before.halfWidth ?? 0) ** 2 + (after.halfWidth ?? 0) ** 2);
  return {
    delta,
    halfWidth,
    lower: delta - halfWidth,
    upper: delta + halfWidth,
    measurable: Math.abs(delta) > halfWidth,
  };
};

/**
 * Compare two entry maps.
 *
 * Both are re-banded at one τ. Neither map's stored band is read.
 *
 * @param {Object} rawBefore - a parsed entry-map artifact (the earlier generation)
 * @param {Object} rawAfter  - a parsed entry-map artifact (the later generation)
 * @param {Object} [opts]
 * @param {number} [opts.tauBB] - the common τ both maps are banded at
 */
export const compareEntryMaps = (rawBefore, rawAfter, { tauBB = DEFAULT_TAU_BB } = {}) => {
  const before = loadEntryMap(rawBefore, { tauBB });
  const after = loadEntryMap(rawAfter, { tauBB });

  // ── The join. Refused, never intersected ────────────────────────────────────────────────
  const beforeIds = new Set(before.cells.map((c) => c.cellId));
  const afterIds = new Set(after.cells.map((c) => c.cellId));
  const onlyBefore = [...beforeIds].filter((id) => !afterIds.has(id));
  const onlyAfter = [...afterIds].filter((id) => !beforeIds.has(id));
  if (onlyBefore.length || onlyAfter.length) {
    const sample = (xs) => xs.slice(0, 3).join(', ') + (xs.length > 3 ? `, …(${xs.length})` : '');
    throw new EntryMapError(
      'the two maps do not enumerate the same cells, so no migration between them is ' +
      'meaningful. Intersecting them would silently drop exactly the cells that changed.' +
      (onlyBefore.length ? `\n  only in the earlier map: ${sample(onlyBefore)}` : '') +
      (onlyAfter.length ? `\n  only in the later map:   ${sample(onlyAfter)}` : ''),
      { onlyBefore: onlyBefore.length, onlyAfter: onlyAfter.length },
    );
  }

  const kind = before.continuationPolicy.id !== after.continuationPolicy.id
    ? COMPARISON_KINDS.POLICY_CHANGE
    : before.engineCommit === after.engineCommit
      ? COMPARISON_KINDS.REPLICATE
      : COMPARISON_KINDS.GENERATION;

  const afterById = new Map(after.cells.map((c) => [c.cellId, c]));

  const transitions = {};
  const cells = [];
  let movedBand = 0;
  let measurableDeltas = 0;
  let unmeasurableDeltas = 0;

  for (const b of before.cells) {
    const a = afterById.get(b.cellId);
    const from = labelOf(b);
    const to = labelOf(a);
    const key = `${from}→${to}`;
    transitions[key] = (transitions[key] || 0) + 1;
    if (from !== to) movedBand++;

    const delta = deltaOf(b, a);
    if (delta) {
      if (delta.measurable) measurableDeltas++;
      else unmeasurableDeltas++;
    }

    cells.push({
      cellId: b.cellId,
      handClass: b.handClass,
      posCategory: b.posCategory,
      facingAction: b.facingAction,
      fromBand: from,
      toBand: to,
      marginBefore: isNum(b.margin) ? b.margin : null,
      marginAfter: isNum(a.margin) ? a.margin : null,
      actionBefore: b.bestAction ?? null,
      actionAfter: a.bestAction ?? null,
      ...(delta ?? { delta: null, halfWidth: null, lower: null, upper: null, measurable: null }),
    });
  }

  const countBy = (map) => map.cells.reduce((acc, c) => {
    const k = labelOf(c);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  /**
   * The headline numbers.
   *
   * `intoClearPlus` and `outOfClearMinus` are the two that answer "did the strategy get
   * better". They are counted from BAND transitions rather than from deltas because a hand
   * becoming profitable is a change of KIND — it crosses zero, the one anchor in this map that
   * needs no calibration — while a margin merely growing is a change of degree.
   *
   * `becameMeasurable` is the research-progress number, and it is a different achievement:
   * a cell leaving `unmeasured` means the evidence improved, whether or not the answer did.
   */
  const movedInto = (band) => before.cells.filter((b) => {
    const a = afterById.get(b.cellId);
    return labelOf(b) !== band && labelOf(a) === band;
  }).length;

  const headline = {
    cellsCompared: cells.length,
    movedBand,
    measurableDeltas,
    unmeasurableDeltas,
    intoClearPlus: movedInto(BANDS.CLEAR_PLUS),
    intoFringeTight: movedInto(BANDS.FRINGE_TIGHT),
    outOfClearMinus: before.cells.filter((b) => {
      const a = afterById.get(b.cellId);
      return labelOf(b) === BANDS.CLEAR_MINUS && labelOf(a) !== BANDS.CLEAR_MINUS;
    }).length,
    becameMeasurable: before.cells.filter((b) => {
      const a = afterById.get(b.cellId);
      return labelOf(b) === BANDS.UNMEASURED && labelOf(a) !== BANDS.UNMEASURED;
    }).length,
    becameUnmeasured: movedInto(BANDS.UNMEASURED),
  };

  const warnings = [
    ...before.warnings.map((w) => `earlier map: ${w}`),
    ...after.warnings.map((w) => `later map: ${w}`),
  ];
  if (kind === COMPARISON_KINDS.REPLICATE && measurableDeltas > 0) {
    warnings.push(
      `this is a REPLICATE comparison — same policy, same commit — yet ${measurableDeltas} cells ` +
      'show a delta larger than its own interval. That is an INSTRUMENT FAULT, not a result: ' +
      'either the intervals understate the run-to-run spread, or something outside the stamp ' +
      'changed. Do not read this as movement.',
    );
  }
  if (kind === COMPARISON_KINDS.POLICY_CHANGE) {
    warnings.push(
      `continuation policy changed (${before.continuationPolicy.id} → ${after.continuationPolicy.id}). ` +
      'These are different quantities: the cells are the same but what is being measured on them ' +
      'is not. Read as a re-answer, not as the same answer improving.',
    );
  }

  return {
    schemaVersion: MIGRATION_SCHEMA_VERSION,
    generatedBy: 'scripts/backtest/fringeMigration.mjs',
    comparison: {
      kind,
      tauBB,
      before: {
        policyId: before.continuationPolicy.id,
        engineCommit: before.engineCommit,
        engineDirty: Boolean(before.engineDirty),
        tauBBAsWritten: before.reporting.tauBBAsWritten,
      },
      after: {
        policyId: after.continuationPolicy.id,
        engineCommit: after.engineCommit,
        engineDirty: Boolean(after.engineDirty),
        tauBBAsWritten: after.reporting.tauBBAsWritten,
      },
    },
    bandCounts: { before: countBy(before), after: countBy(after) },
    transitions,
    headline,
    cells,
    warnings,
  };
};

/**
 * The cells worth a human's attention, in a stable order.
 *
 * A FILTERED VIEW OF A COMPLETE ARTIFACT, never a truncation of one. The report always carries
 * every cell; this picks the ones that moved band or moved measurably, so the console output
 * is readable. Callers that print it must say how many were left out — a list that silently
 * stops at N reads as "that was all of them".
 */
export const moversOf = (report) => report.cells
  .filter((c) => c.fromBand !== c.toBand || c.measurable === true)
  .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));
