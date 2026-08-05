/**
 * rangeCalibrationReport.mjs — range calibration as a STANDING metric (WS-293).
 *
 * `rangeCalibrationProbe.mjs` answers the question. This module makes the answer quotable: it
 * turns a probe run into a Result Card against a versioned Deal Book with a complete
 * replication manifest, and into an append-only history row so drift is visible across runs.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS BEING MEASURED, IN THE VOCABULARY THAT ALREADY EXISTS.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * This is a **Layer Probe** of the `range` layer — the first layer of the engine-read Stack —
 * scored against that layer's own declared ground truth, `LAYER_GROUND_TRUTH.range` =
 * `revealedHolding`. It is deliberately NOT named as anything new: `docs/standard-of-record/
 * VOCABULARY.md` already defines Layer Probe as "scores ONE layer against its own ground
 * truth, independent of downstream recommendation quality", and that is exactly this.
 *
 * The layer-local framing is the whole value. WS-291 was a falsified range model whose
 * SYMPTOMS were at the action layer (bad advice) and whose FAULT was at the range layer. Only
 * a probe that ignores everything downstream can say "the range itself is wrong", because a
 * good action can be reached through a wrong range and a bad one through a right range.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY IT MUST BE STANDING, AND WHAT THE INSTRUMENT HAS TO SURVIVE.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * WS-291 and WS-302 both raised coverage by construction: any positive probability floor
 * guarantees the true hand is "covered", and after WS-302's preflop support weight coverage
 * measured 100.0%. **A metric that cannot fail is not evidence** — that is
 * `FAULT-degenerate-signal` in the Suspected-Fault Register, and coverage now has exactly that
 * defect. So this module:
 *
 *   1. REFUSES to emit coverage without its retained baseline (`sealCalibration`). Coverage
 *      alone is a number that improves by doing nothing — keep every combo and it is 100%.
 *      The refusal is structural, not a convention someone remembers: the triple is built by
 *      one function that throws, and the Result Card's metrics can only be built through it.
 *   2. DETECTS the saturation and says so as DATA (`coverageDegeneracy`), so a future run
 *      cannot report 100% coverage as a success on the metric the fix was designed to satisfy.
 *      Once saturated, `deltaLogVsUniform` is the metric that carries the run, and the report
 *      says which one is load-bearing rather than leaving a reader to notice.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE SELECTION TERM IS PART OF THE METRIC, NOT A CAVEAT ATTACHED TO IT.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Every number here is conditioned on the holding having been revealed, and revealed hands are
 * not a random sample: hands reach showdown conditionally on the action, and which hands get
 * shown is strategy-dependent. That is `FAULT-showdown-selection`, register entry #12, status
 * `untested`. It is NOT corrected away — the counterfactual holding on decisions where nothing
 * was shown is exactly what the corpus does not record. Instead the probe factors it
 * (POKER_THEORY §14.1) and this module carries the factors onto the card itself: the reveal
 * rate, the assumption-free bounds it implies over all scoreable decisions, and the
 * composition shift that names which slices the filter selects for.
 *
 * The bounds are the honest part. `coverageBoundLow/High` bracket coverage over ALL scoreable
 * decisions without assuming anything about the unrevealed ones, and their width is exactly
 * `1 − revealRate`. They go in `metrics`, where a reader reaching for the headline meets them,
 * rather than in prose in a document nobody opens.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * AND THE POPULATION IT WAS MEASURED ON.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * The corpus is online 6-max and full-ring, July 2009. The founder's game is live 9-handed
 * 1/2–1/3. Those are distinct populations and this repo's standing rule is that they are never
 * merged, so any live claim anchored on this number is TRANSFERRED, not measured. That is the
 * top-ranked entry of the Suspected-Fault Register and it is stated in the treatment string,
 * on the card, and in the rendered output — three places, because it is the one a reader is
 * most likely to skip.
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs';

import { buildResultCard, resultCardProblems } from '../../src/utils/standardOfRecord/resultCard.js';
import { buildReplicationManifest } from '../../src/utils/standardOfRecord/manifest.js';
import { LAYER_GROUND_TRUTH } from '../../src/utils/standardOfRecord/stack.js';

export const RANGE_CALIBRATION_SCHEMA_VERSION = 1;

/**
 * The estimand. Two instruments only corroborate each other if they name the same quantity,
 * and `resultCardProblems` refuses a card that cannot state one.
 *
 * Note what it does NOT claim: it is a conditional rate, not a population rate. The
 * conditioning set is named in the estimand itself so it cannot be dropped in quotation.
 */
export const RANGE_CALIBRATION_ESTIMAND =
  'Calibration of the engine\'s inferred range against the holding actually revealed at '
  + `showdown — a Layer Probe of the \`range\` layer against its ground truth \`${LAYER_GROUND_TRUTH.range}\`, `
  + 'reported as mean log P(true holding) minus log uniform-over-live-combos (nats per '
  + 'decision), together with coverage against its retained-combo baseline. CONDITIONAL ON THE '
  + 'HOLDING BEING REVEALED; not a population rate.';

/**
 * How to read the number. Reusable verbatim; deliberately states the population mismatch and
 * the selection conditioning rather than leaving them to a footnote.
 */
export const RANGE_CALIBRATION_TREATMENT =
  'read-only layer probe · no substitution and no counterfactual · scored per decision on '
  + 'revealed holdings only (showdown-conditional, see selection bounds) · villain arm '
  + 'reconstructs the range gameTreeContext consumes from a population baseline narrowed by '
  + 'the villain\'s observed action, using DEFAULT continuation rates rather than the '
  + 'model-derived rate the live path passes · population is online 6-max/full-ring July 2009, '
  + 'so any claim about live 9-handed 1/2-1/3 is TRANSFERRED, not measured.';

export const RANGE_CALIBRATION_SCOPE = Object.freeze([
  'The `range` layer only. Says nothing about whether the advice downstream of it was good.',
  'Villain-arm continuation rates are population defaults, not the runtime model-derived rate.',
  'Showdown-conditional. The selection bounds, not the point estimate, are the population claim.',
]);

/**
 * Randomness this instrument does not have.
 *
 * An `unseededSources: []` is a POSITIVE claim of bit-reproducibility, so it must be true. It
 * is, here, and that is worth stating rather than assuming: the probe uses no RNG at all —
 * `buildRangeProfile`, `accumulateDecisions`, `narrowByBoard`, `buildBaselineRange` and
 * `scoreCoverage` are deterministic, and `rangeEquityPercentile` enumerates rather than
 * samples. Unlike the hero-EV arm, two runs over the same Deal Book agree EXACTLY.
 */
export const RANGE_CALIBRATION_UNSEEDED_SOURCES = Object.freeze([]);

/** Below this many distinct EVAL players the acting-seat arm is one table, not a population. */
export const MIN_PLAYERS_FOR_QUOTE = 30;

/** Below this many scored decisions an arm is not quotable at all. */
export const MIN_DECISIONS_FOR_QUOTE = 200;

/**
 * Above this bound width the showdown filter is withholding more of the answer than the
 * measurement contains, and the point estimate must not be read as a population figure.
 * 0.5 means: even knowing coverage among revealed hands exactly, coverage over all scoreable
 * decisions could still be anywhere in a 50-point window.
 */
export const MAX_SELECTION_BOUND_WIDTH = 0.5;

/**
 * THE STRUCTURAL REFUSAL (WS-293 accept criterion).
 *
 * Coverage may never leave this module without its retained baseline. A wide range scores high
 * coverage for free — keep every combo and coverage is 100% — so a coverage figure without the
 * retained fraction it should be read against is a number that improves by doing nothing.
 *
 * This throws rather than warning, and every path that puts coverage on a Result Card or in a
 * history row goes through it. That is the difference between a rule and a habit: the WS-291
 * post-mortem's lesson is that nothing forced two numbers onto the same axis, so a wrong number
 * never had to meet a right one.
 *
 * @param {Object|null} summary - a `summarize()` output from the probe
 * @param {string} label - names the arm, for the thrown message
 * @returns {Object|null} frozen {n, coverage, retainedFraction, coverageLift, deltaLogVsUniform, deltaLogGivenCovered}
 */
export const sealCalibration = (summary, label = 'arm') => {
  if (summary == null) return null;
  const has = (k) => Number.isFinite(summary[k]);
  if (!has('coverage')) {
    throw new Error(`[${label}] calibration summary carries no coverage — nothing to seal.`);
  }
  if (!has('retainedFraction')) {
    throw new Error(
      `[${label}] REFUSED: coverage (${summary.coverage}) without its retained baseline. `
      + 'Coverage alone is a number that improves by doing nothing — a range that keeps every '
      + 'combo scores 100%. Report retainedFraction and coverageLift with it, or report neither.',
    );
  }
  if (!has('coverageLift')) {
    throw new Error(
      `[${label}] REFUSED: coverage and retained present but coverageLift missing. The lift is `
      + 'the comparison that makes the pair mean anything; omitting it re-opens the same hole.',
    );
  }
  return Object.freeze({
    n: summary.n,
    coverage: summary.coverage,
    retainedFraction: summary.retainedFraction,
    coverageLift: summary.coverageLift,
    deltaLogVsUniform: summary.deltaLogVsUniform ?? null,
    deltaLogGivenCovered: summary.deltaLogGivenCovered ?? null,
  });
};

/** Seal a whole `{key: summary}` map, dropping nulls. */
export const sealMap = (obj, label) => Object.fromEntries(
  Object.entries(obj || {})
    .map(([k, v]) => [k, sealCalibration(v, `${label}.${k}`)])
    .filter(([, v]) => v),
);

/**
 * Is coverage still capable of failing? (`FAULT-degenerate-signal`)
 *
 * After WS-291's floor and WS-302's preflop support weight, every live combo carries positive
 * weight by construction, so coverage saturates at 1.0 and stops discriminating between a good
 * range model and a bad one. The ticket that commissioned this metric predicted exactly that,
 * and the reason it wanted a STANDING instrument is that a saturated metric would let the fix
 * look like a total success on the number it was designed to satisfy.
 *
 * So saturation is detected and reported, and the report names which metric is actually
 * carrying the run. `deltaLogVsUniform` cannot saturate — it is unbounded below and a range
 * that spends its mass in the wrong place scores negative however complete its support.
 *
 * @returns {{saturated, coverage, discriminatingMetric, note}}
 */
export const coverageDegeneracy = (sealed, { epsilon = 1e-9 } = {}) => {
  const coverage = sealed?.coverage ?? null;
  const saturated = coverage != null && coverage >= 1 - epsilon;
  return {
    saturated,
    coverage,
    discriminatingMetric: saturated ? 'deltaLogVsUniform' : 'coverage+deltaLogVsUniform',
    note: saturated
      ? 'Coverage is saturated at 1.0 BY CONSTRUCTION (every live combo carries a positive '
        + 'floor since WS-291/WS-302). It can no longer distinguish a good range model from a '
        + 'bad one and must not be quoted as evidence that this run went well. deltaLogVsUniform '
        + 'is the metric carrying this run.'
      : 'Coverage is below saturation and still discriminates; read it with its retained baseline.',
  };
};

/**
 * Attach the showdown-selection term to a sealed arm.
 *
 * Returns the point estimate AND the assumption-free bracket it implies over all scoreable
 * decisions. Both go on the card. The width is `1 − revealRate` and is the honest measure of
 * how much of the population answer the showdown filter is withholding.
 */
export const withSelection = (sealed, selectionSummary) => {
  const revealRate = selectionSummary?.revealRate ?? null;
  if (sealed == null) return null;
  if (!Number.isFinite(revealRate)) {
    return { ...sealed, selection: null };
  }
  const lower = sealed.coverage * revealRate;
  return {
    ...sealed,
    selection: {
      revealRate,
      scoreable: selectionSummary.scoreable,
      revealed: selectionSummary.revealed,
      notRevealed: selectionSummary.notRevealed,
      refused: selectionSummary.refused,
      refusedByReason: selectionSummary.refusedByReason,
      // Manski-style worst-case bounds: no assumption about the unrevealed decisions at all.
      coverageBoundLow: lower,
      coverageBoundHigh: lower + (1 - revealRate),
      coverageBoundWidth: 1 - revealRate,
    },
  };
};

/**
 * Admissibility — what would stop this run being quoted.
 *
 * Blockers make the figure unquotable. Warnings are things a reader must know but which do not
 * invalidate the measurement. The villain-arm partition asymmetry and the corpus-mined prior
 * are WARNINGS rather than blockers because they are structural properties of this instrument
 * that were true of every previous run too — recording them is what makes them visible; calling
 * them blockers would make the instrument unable to report anything, which is how a caveat gets
 * deleted rather than fixed.
 */
export const assessRangeCalibrationAdmissibility = (probe, { villainArm, actingArm, poolPct }) => {
  const blockers = [];
  const warnings = [];

  // THE COLLAPSE GUARD (WS-293). A run that scored nothing must not produce a quotable card of
  // nulls. This is not hypothetical: during WS-293's development a concurrently-edited engine
  // module made `accumulateDecisions` throw for every player, the probe's per-player catch
  // swallowed all 40 failures, and the run returned a well-formed result with zero decisions —
  // which then built a Result Card whose every metric was null and appended a history row.
  // `FAULT-degenerate-signal`: an instrument that cannot tell "nothing to say" from "I broke"
  // is not evidence.
  const scanned = probe?.scanned ?? {};
  const failed = (scanned.playersFailedProfile ?? 0) + (scanned.playersFailedAccumulate ?? 0);
  if (!(scanned.decisions > 0)) {
    blockers.push(
      `the scan collected ZERO decisions from ${scanned.handsRead ?? 0} hands and `
      + `${scanned.players ?? 0} players (${failed} player(s) failed`
      + `${scanned.firstFailure ? `; first failure: ${scanned.firstFailure}` : ''}). `
      + 'This is a collapsed run, not a null result.',
    );
  }
  if (failed > 0) {
    warnings.push(
      `${failed} of ${scanned.players ?? 0} players were dropped by the probe's per-player `
      + `catch${scanned.firstFailure ? ` (first: ${scanned.firstFailure})` : ''}. Dropped players `
      + 'are not a random subsample.',
    );
  }

  const players = probe?.scanned?.players ?? 0;
  if (players < MIN_PLAYERS_FOR_QUOTE) {
    blockers.push(
      `only ${players} EVAL player-clusters (< ${MIN_PLAYERS_FOR_QUOTE}). Hands are not `
      + 'independent within a player, so a player-clustered figure at this count is a few '
      + 'people rather than a population.',
    );
  }
  if ((villainArm?.n ?? 0) < MIN_DECISIONS_FOR_QUOTE) {
    blockers.push(`villain arm scored ${villainArm?.n ?? 0} decisions (< ${MIN_DECISIONS_FOR_QUOTE}).`);
  }

  for (const [name, arm] of [['villain', villainArm], ['acting', actingArm]]) {
    const w = arm?.selection?.coverageBoundWidth;
    if (Number.isFinite(w) && w > MAX_SELECTION_BOUND_WIDTH) {
      warnings.push(
        `${name} arm: showdown-selection bound width ${w.toFixed(3)} exceeds `
        + `${MAX_SELECTION_BOUND_WIDTH} (reveal rate ${(arm.selection.revealRate * 100).toFixed(1)}%). `
        + 'The point estimate is P(covered | revealed); over all scoreable decisions coverage is '
        + `only bracketed to [${arm.selection.coverageBoundLow.toFixed(3)}, `
        + `${arm.selection.coverageBoundHigh.toFixed(3)}]. Quote the bracket, not the point.`,
      );
    }
  }

  const deg = coverageDegeneracy(villainArm);
  if (deg.saturated) {
    warnings.push(`villain arm: ${deg.note}`);
  }

  warnings.push(
    'PARTITION ASYMMETRY: the acting-seat arm is scored on EVAL players only '
    + `(poolPct=${poolPct}), but the villain-seat arm is keyed by SEAT and is never resolved to `
    + 'a player id, so it mixes POOL and EVAL. Benign today because the villain range is a '
    + 'population chart with no per-player fit — NOT benign the moment any player-conditioned '
    + 'villain model is introduced.',
  );
  warnings.push(
    'CORPUS-MINED PRIOR: the villain baseline range is built from populationPriors, which were '
    + 'mined from this corpus. A corpus-mined prior scored against the same corpus is '
    + '`FAULT-leakage-unclosed-channel` by construction; it inflates the villain arm in an '
    + 'unknown direction and the acting arm through buildRangeProfile.',
  );
  warnings.push(
    'POPULATION: online 6-max/full-ring, July 2009. The founder\'s game is live 9-handed '
    + '1/2-1/3. Any live claim anchored on this figure is TRANSFERRED, not measured.',
  );

  return {
    admissible: blockers.length === 0,
    blockers,
    warnings,
    clusters: players,
    clusterUnit: 'players',
  };
};

/**
 * Build the report and its Result Card.
 *
 * Mirrors `depthAblationReport.buildDepthAblationReport`: returns `{resultCard,
 * resultCardProblems}` rather than throwing, so a run that produced a real measurement still
 * writes its artifact when the stamp is incomplete, and the problems list says exactly why the
 * figure is not quotable.
 */
export const buildRangeCalibrationReport = (probe, {
  replicationStamp = null,
  dealBook = null,
  surfaceId = 'engine-read',
  fieldId = 'population-chart-baseline',
  poolPct = 50,
} = {}) => {
  // Every coverage figure in the report goes through the seal. If the probe ever emits coverage
  // without retained, the run fails here rather than publishing half a comparison.
  const villainSealed = sealCalibration(probe?.villain?.all, 'villain.all');
  const actingSealed = sealCalibration(probe?.acting?.all, 'acting.all');

  const villainArm = withSelection(villainSealed, probe?.selection?.villain?.all);
  const actingArm = withSelection(actingSealed, probe?.selection?.acting?.all);

  const arms = {
    villain: {
      all: villainArm,
      byStreet: sealMap(probe?.villain?.byStreet, 'villain.byStreet'),
      byAction: sealMap(probe?.villain?.byAction, 'villain.byAction'),
    },
    acting: {
      all: actingArm,
      byStreet: sealMap(probe?.acting?.byStreet, 'acting.byStreet'),
      byAction: sealMap(probe?.acting?.byAction, 'acting.byAction'),
      bySite: sealMap(probe?.acting?.bySite, 'acting.bySite'),
    },
    chained: sealMap(probe?.chained, 'chained'),
  };

  const degeneracy = coverageDegeneracy(villainArm);
  const admissibility = assessRangeCalibrationAdmissibility(probe, { villainArm, actingArm, poolPct });

  let card = {
    resultCard: null,
    resultCardProblems: ['no replication stamp on the run — this figure cannot be replicated and must not be quoted.'],
  };
  if (replicationStamp) {
    try {
      const manifest = buildReplicationManifest(replicationStamp);
      const resultCard = buildResultCard({
        resultCardId: `RC-range-calibration-${String(replicationStamp.dealBookHash).replace('sha256:', '').slice(0, 8)}-${String(replicationStamp.engineCommit).slice(0, 8)}`,
        match: {
          surfaceId,
          dealBookId: dealBook?.dealBookId ?? null,
          fieldId,
        },
        estimand: RANGE_CALIBRATION_ESTIMAND,
        treatment: RANGE_CALIBRATION_TREATMENT,
        metrics: {
          // ── the headline, on ONE scale: nats of log-likelihood of the true holding,
          //    relative to uniform over the combos live on the board ─────────────────────
          villainDeltaLogVsUniform: villainArm?.deltaLogVsUniform ?? null,
          actingDeltaLogVsUniform: actingArm?.deltaLogVsUniform ?? null,
          chainDepth3DeltaLogVsUniform: arms.chained?.['3']?.deltaLogVsUniform ?? null,
          // ── coverage, which may only appear alongside its baseline (sealCalibration) ──
          villainCoverage: villainArm?.coverage ?? null,
          villainRetainedFraction: villainArm?.retainedFraction ?? null,
          villainCoverageLift: villainArm?.coverageLift ?? null,
          actingCoverage: actingArm?.coverage ?? null,
          actingRetainedFraction: actingArm?.retainedFraction ?? null,
          actingCoverageLift: actingArm?.coverageLift ?? null,
          // ── the showdown-selection term, as DATA. The bounds are the population claim;
          //    the coverage figures above are conditional on the reveal. ─────────────────
          villainRevealRate: villainArm?.selection?.revealRate ?? null,
          villainCoverageBoundLow: villainArm?.selection?.coverageBoundLow ?? null,
          villainCoverageBoundHigh: villainArm?.selection?.coverageBoundHigh ?? null,
          villainCoverageBoundWidth: villainArm?.selection?.coverageBoundWidth ?? null,
          actingRevealRate: actingArm?.selection?.revealRate ?? null,
          actingCoverageBoundLow: actingArm?.selection?.coverageBoundLow ?? null,
          actingCoverageBoundHigh: actingArm?.selection?.coverageBoundHigh ?? null,
          actingCoverageBoundWidth: actingArm?.selection?.coverageBoundWidth ?? null,
          // ── denominators ────────────────────────────────────────────────────────────
          villainN: villainArm?.n ?? null,
          actingN: actingArm?.n ?? null,
          players: probe?.scanned?.players ?? null,
          handsRead: probe?.scanned?.handsRead ?? null,
          decisionsSeen: probe?.scanned?.decisions ?? null,
          // ── the card carries its own refusal, so a reader who reaches for coverage out
          //    of context still meets the reason it cannot carry the run ────────────────
          coverageSaturated: degeneracy.saturated,
          discriminatingMetric: degeneracy.discriminatingMetric,
          showdownConditional: true,
        },
        clusterUnit: 'players',
        admissibility,
        manifest,
      });
      card = { resultCard, resultCardProblems: [] };
    } catch (err) {
      card = {
        resultCard: null,
        resultCardProblems: [
          err?.message || String(err),
          ...resultCardProblems({ manifest: { ...replicationStamp } }),
        ],
      };
    }
  }

  return {
    schemaVersion: RANGE_CALIBRATION_SCHEMA_VERSION,
    estimand: RANGE_CALIBRATION_ESTIMAND,
    treatment: RANGE_CALIBRATION_TREATMENT,
    scope: [...RANGE_CALIBRATION_SCOPE],
    arms,
    selection: probe?.selection ?? null,
    degeneracy,
    admissibility,
    scanned: probe?.scanned ?? null,
    resultCard: card.resultCard,
    resultCardProblems: card.resultCardProblems,
    provenance: { sources: ['SRC-011', 'SRC-012'] },
  };
};

// ─── history ─────────────────────────────────────────────────────────────────
//
// Same shape and same mechanics as `docs/domain/readiness/scorecard-history.yaml`: flat
// scalars, one block per run, appended by string concatenation and never parse-modify-serialize.
// `scripts/readiness/model-readiness.mjs` states the constraint that buys — the reader is a
// hand-rolled regex, so the FILES must stay simple. Values are `JSON.stringify`d for the same
// reason they are there.
//
// It is a SEPARATE file from scorecard-history.yaml on purpose. That file's rows carry the
// readiness gate's fixed metric set (accuracy / logLoss / lift / worstCalibrationError /
// heroEv*), C6 reads the last three of them, and `lift` there means villain-prediction lift.
// Writing a coverage-lift into a column named `lift` would collide two different quantities in
// one series — the precise incommensurability POKER_THEORY §14 is about.

export const HISTORY_PATH = 'docs/domain/readiness/range-calibration-history.yaml';

const yamlScalar = (x) => {
  if (x === null || x === undefined || x === 'null') return 'null';
  if (typeof x === 'number') return Number.isFinite(x) ? String(x) : 'null';
  if (typeof x === 'boolean') return String(x);
  return JSON.stringify(String(x));
};

const round = (x, dp = 5) => (Number.isFinite(x) ? Number(x.toFixed(dp)) : null);

/**
 * Render one history row.
 *
 * Coverage never appears without retained and lift beside it — the row is built from the
 * SEALED arms, so the structural refusal covers the history file too and not only the card.
 */
export const historyRow = (report, {
  date = new Date().toISOString().slice(0, 10),
  label,
  source,
  arm = 'range-calibration',
  corpus = 'HandHQ online cash, July 2009, 50NL',
  notes = null,
} = {}) => {
  if (!label) throw new Error('historyRow: --label is required. A row nobody can identify is not evidence.');
  if (!source) throw new Error('historyRow: --source is required. A row without a source is not admissible evidence.');

  const v = report?.arms?.villain?.all ?? null;
  const a = report?.arms?.acting?.all ?? null;
  const c3 = report?.arms?.chained?.['3'] ?? null;

  // A row of nulls is not a data point, and appending one to an append-only series is worse
  // than appending nothing: it looks like a run that measured something and found zero. See the
  // collapse guard in `assessRangeCalibrationAdmissibility` for how this arises in practice.
  if (v == null && a == null) {
    throw new Error(
      'historyRow: REFUSED — both arms are empty, so every metric on this row would be null. '
      + 'A collapsed run must not enter the series looking like a measured one.',
    );
  }

  const L = [];
  L.push('');
  L.push(`  - date: ${yamlScalar(date)}`);
  L.push(`    label: ${yamlScalar(label)}`);
  L.push(`    source: ${yamlScalar(source)}`);
  L.push(`    arm: ${yamlScalar(arm)}`);
  L.push(`    corpus: ${yamlScalar(corpus)}`);
  L.push(`    engine_commit: ${yamlScalar(report?.resultCard?.manifest?.engineCommit ?? null)}`);
  // A dirty tree means the commit does NOT identify the code that ran. A row that recorded the
  // SHA without this flag would assert replicability it cannot deliver.
  L.push(`    engine_dirty: ${yamlScalar(report?.resultCard?.manifest?.engineDirty ?? null)}`);
  L.push(`    deal_book_hash: ${yamlScalar(report?.resultCard?.manifest?.dealBookHash ?? null)}`);
  L.push(`    result_card_id: ${yamlScalar(report?.resultCard?.resultCardId ?? null)}`);
  L.push(`    disclaimer_register_version: ${yamlScalar(report?.resultCard?.manifest?.disclaimerRegisterVersion ?? null)}`);
  L.push(`    admissible: ${yamlScalar(report?.admissibility?.admissible ?? null)}`);
  L.push('    metrics:');
  L.push(`      villainDeltaLog: ${yamlScalar(round(v?.deltaLogVsUniform))}`);
  L.push(`      villainCoverage: ${yamlScalar(round(v?.coverage))}`);
  L.push(`      villainRetained: ${yamlScalar(round(v?.retainedFraction))}`);
  L.push(`      villainCoverageLift: ${yamlScalar(round(v?.coverageLift))}`);
  L.push(`      villainN: ${yamlScalar(v?.n ?? null)}`);
  L.push(`      actingDeltaLog: ${yamlScalar(round(a?.deltaLogVsUniform))}`);
  L.push(`      actingCoverage: ${yamlScalar(round(a?.coverage))}`);
  L.push(`      actingRetained: ${yamlScalar(round(a?.retainedFraction))}`);
  L.push(`      actingCoverageLift: ${yamlScalar(round(a?.coverageLift))}`);
  L.push(`      actingN: ${yamlScalar(a?.n ?? null)}`);
  L.push(`      chainDepth3DeltaLog: ${yamlScalar(round(c3?.deltaLogVsUniform))}`);
  L.push(`      players: ${yamlScalar(report?.scanned?.players ?? null)}`);
  // The selection term travels WITH the metrics in the series, so drift in the reveal rate is
  // visible as drift — a coverage move that is really a change in who showed down looks like a
  // model improvement unless this column is beside it.
  L.push(`      villainRevealRate: ${yamlScalar(round(v?.selection?.revealRate))}`);
  L.push(`      villainCoverageBoundLow: ${yamlScalar(round(v?.selection?.coverageBoundLow))}`);
  L.push(`      villainCoverageBoundHigh: ${yamlScalar(round(v?.selection?.coverageBoundHigh))}`);
  L.push(`      actingRevealRate: ${yamlScalar(round(a?.selection?.revealRate))}`);
  L.push(`      actingCoverageBoundLow: ${yamlScalar(round(a?.selection?.coverageBoundLow))}`);
  L.push(`      actingCoverageBoundHigh: ${yamlScalar(round(a?.selection?.coverageBoundHigh))}`);
  L.push(`      coverageSaturated: ${yamlScalar(report?.degeneracy?.saturated ?? null)}`);
  L.push(`      discriminatingMetric: ${yamlScalar(report?.degeneracy?.discriminatingMetric ?? null)}`);
  L.push('    notes: >');
  const body = notes || `Treatment: ${RANGE_CALIBRATION_TREATMENT}`;
  for (const line of String(body).match(/.{1,92}(\s|$)/g) || [body]) {
    L.push(`      ${line.trim()}`);
  }
  return L.join('\n') + '\n';
};

/** Append a row. Append-only by construction — this never reads and rewrites the file. */
export const appendHistoryRow = (path, row) => {
  if (!existsSync(path)) {
    throw new Error(
      `appendHistoryRow: ${path} does not exist. The history file carries the baseline row and `
      + 'its header; creating it implicitly here would produce a series with no origin.',
    );
  }
  appendFileSync(path, row);
  return path;
};

/** Count rows already in the history file, for the "drift across runs" readout. */
export const historyRunCount = (path) => {
  if (!existsSync(path)) return 0;
  return (readFileSync(path, 'utf8').match(/^\s*-\s+date:/gm) || []).length;
};

// ─── rendering ───────────────────────────────────────────────────────────────

const pct = (x) => (Number.isFinite(x) ? `${(100 * x).toFixed(1)}%` : '—');
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : '—');

export const renderRangeCalibrationReport = (r) => {
  const L = [];
  L.push('');
  L.push('═'.repeat(84));
  L.push('  RANGE CALIBRATION — standing metric (WS-293)');
  L.push('═'.repeat(84));
  L.push(`  ESTIMAND:  ${r.estimand}`);
  L.push(`  TREATMENT: ${r.treatment}`);
  L.push('');

  const armLine = (name, a) => {
    if (!a) return `  ${name.padEnd(9)} —`;
    return `  ${name.padEnd(9)} n=${String(a.n).padStart(6)}  Δlog ${f3(a.deltaLogVsUniform).padStart(7)}  `
      + `coverage ${pct(a.coverage).padStart(7)}  retained ${pct(a.retainedFraction).padStart(7)}  lift ${f3(a.coverageLift).padStart(6)}`;
  };
  L.push('  HEADLINE — Δlog is nats of log P(true holding) above uniform-over-live-combos.');
  L.push(armLine('villain', r.arms?.villain?.all));
  L.push(armLine('acting', r.arms?.acting?.all));
  L.push(armLine('chain×3', r.arms?.chained?.['3']));
  L.push('');

  L.push('  SHOWDOWN SELECTION — every number above is P(· | revealed).');
  for (const [name, a] of [['villain', r.arms?.villain?.all], ['acting', r.arms?.acting?.all]]) {
    const s = a?.selection;
    if (!s) { L.push(`  ${name.padEnd(9)} no selection term`); continue; }
    L.push(
      `  ${name.padEnd(9)} reveal rate ${pct(s.revealRate)} (${s.revealed}/${s.scoreable})  →  `
      + `coverage over ALL scoreable decisions is only bracketed to `
      + `[${f3(s.coverageBoundLow)}, ${f3(s.coverageBoundHigh)}]  (width ${f3(s.coverageBoundWidth)})`,
    );
    if (s.refused) L.push(`  ${' '.repeat(9)} refused ${s.refused}: ${JSON.stringify(s.refusedByReason)}`);
  }
  L.push('  These bounds assume NOTHING about the unrevealed decisions. They are the population');
  L.push('  claim; the point estimates above are conditional on the hand having been shown.');
  L.push('');

  const comp = r.selection?.villain?.compositionByAction;
  if (comp && Object.keys(comp).length) {
    L.push('  INVERSE CONDITIONAL — which actions the showdown filter selects FOR (villain arm).');
    L.push(`  ${'action'.padEnd(10)} ${'P(act|revealed)'.padStart(16)} ${'P(act|scoreable)'.padStart(17)} ${'ratio'.padStart(7)} ${'revealRate'.padStart(11)}`);
    for (const [k, v] of Object.entries(comp)) {
      L.push(
        `  ${k.padEnd(10)} ${pct(v.shareOfRevealed).padStart(16)} ${pct(v.shareOfScoreable).padStart(17)} `
        + `${f3(v.selectionRatio).padStart(7)} ${pct(v.revealRate).padStart(11)}`,
      );
    }
    L.push('  ratio > 1 = over-represented among revealed hands; that slice\'s calibration number is');
    L.push('  the most selection-contaminated on the page.');
    L.push('');
  }

  L.push(`  DEGENERACY: ${r.degeneracy?.note}`);
  L.push(`  Metric carrying this run: ${r.degeneracy?.discriminatingMetric}`);
  L.push('');

  L.push(`  ADMISSIBLE: ${r.admissibility?.admissible ? 'yes' : 'NO'}   clusters ${r.admissibility?.clusters} ${r.admissibility?.clusterUnit}`);
  for (const b of (r.admissibility?.blockers ?? [])) L.push(`    BLOCKER  - ${b}`);
  for (const w of (r.admissibility?.warnings ?? [])) L.push(`    warning  - ${w}`);
  L.push('');

  if (r.resultCard) {
    const m = r.resultCard.manifest;
    L.push(`  Result Card ${r.resultCard.resultCardId}`);
    L.push(`    engine ${String(m.engineCommit).slice(0, 12)}${m.engineDirty ? ' (DIRTY — the commit does not identify the code that ran)' : ''}`);
    L.push(`    deal book ${r.resultCard.match.dealBookId}  ${String(m.dealBookHash).slice(0, 24)}…`);
    L.push(`    partition ${m.partition}`);
    L.push(`    register ${m.disclaimerRegisterVersion}   cluster unit ${r.resultCard.clusterUnit}`);
  } else {
    L.push('  NO RESULT CARD — this figure is not quotable:');
    for (const p of (r.resultCardProblems ?? [])) L.push(`      - ${p}`);
  }
  L.push('═'.repeat(84));
  return L.join('\n');
};
