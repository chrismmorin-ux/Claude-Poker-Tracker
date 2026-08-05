/**
 * studyLadderReport.mjs — WS-320. Assemble the separability analysis and its Result Card.
 *
 * "Axis X separates" is a comparative claim someone would act on by building a channel, so
 * ADR-009 binds it: it resolves to a registered Result Card against a versioned Deal Book with
 * a complete replication manifest and a `disclaimerRegisterVersion` stamp. This module is the
 * boundary where a pile of statistics becomes a quotable claim, and it is deliberately the
 * only place in WS-320 that can produce one.
 *
 * THE PARTITION, AND WHY A DESCRIPTIVE MEASUREMENT STILL NEEDS ONE. There is no trained model
 * here, so the obvious reading is that leakage cannot occur. It can, in two ways:
 *
 *   1. The common rate the χ² tests against is a POPULATION PARAMETER. Estimating it from the
 *      same players it then scores spends a degree of freedom and, more importantly, guarantees
 *      the residuals sum to zero — the statistic can no longer see a mean shift. The POOL half
 *      supplies it instead, so the EVAL half is scored against a rate no EVAL player helped set.
 *      (The in-sample variant is reported beside it as a sensitivity, never instead of it.)
 *   2. The shrinkage prior. A prior containing the player it shrinks pulls each player toward a
 *      mean they set, manufacturing agreement. Leave-one-out closes this structurally, and the
 *      repo has the rule written twice already.
 *
 * WALK-FORWARD takes the form the estimand admits: each player's observations are split at
 * their own temporal midpoint and the halves are correlated. That is both the ordering guard
 * and — more importantly — the only check here that can tell "players differ from each other"
 * apart from "a player differs from himself", which is the difference between a channel that
 * works and one that fits noise.
 *
 * THE TRANSFER CAVEAT IS NOT DECORATION. The corpus is online 2009 50NL; the founder's game is
 * live 9-handed 1/2–1/3. That is the TOP-RANKED entry in the suspected-fault register. Any live
 * reading of these numbers is TRANSFERRED, not measured, and the card says so in the estimand
 * itself rather than in a footnote a quoter can drop.
 */

import { buildReplicationManifest } from '../../src/utils/standardOfRecord/manifest.js';
import { buildResultCard } from '../../src/utils/standardOfRecord/resultCard.js';
import { GROUPS, partitionOf } from './partition.mjs';
import {
  AXES,
  AXIS_IDS,
  CONTROL_AXIS,
  LADDER_RUNGS,
} from './ladderAxes.mjs';
import {
  DEFAULT_PRIOR_WEIGHT,
  OBS_FOR_MOVEABLE_ESTIMATE,
  acquiredFlags,
  coOccurrence,
  crossAxisCorrelation,
  ladderNesting,
  overdispersion,
  separabilityVerdict,
  shrinkRates,
  splitHalfReliability,
} from './separability.mjs';

/** Minimum-observation floors the χ² is reported at. The primary is the middle one. */
export const DEFAULT_MIN_N_SWEEP = Object.freeze([5, 20, 50]);
export const DEFAULT_PRIMARY_MIN_N = 20;

const rateOf = (rows) => {
  const N = rows.reduce((s, r) => s + r.n, 0);
  return N > 0 ? rows.reduce((s, r) => s + r.k, 0) / N : null;
};

/**
 * Run the full separability analysis over a `LadderTally`.
 *
 * @param {Object} input
 * @param {Object} input.tally - a LadderTally (or anything exposing `rows()` and `handsSeen`)
 * @param {number} [input.poolPct]
 * @param {number} [input.priorWeight]
 * @param {number} [input.primaryMinN]
 * @param {number[]} [input.minNSweep]
 * @param {Object|null} [input.guard] - LeakageGuard; every scored player is asserted EVAL
 */
export const analyseLadder = ({
  tally,
  poolPct = 50,
  priorWeight = DEFAULT_PRIOR_WEIGHT,
  primaryMinN = DEFAULT_PRIMARY_MIN_N,
  minNSweep = DEFAULT_MIN_N_SWEEP,
  guard = null,
} = {}) => {
  const allRows = tally.rows();

  const axes = {};
  const shrunkByAxis = {};

  for (const axisId of AXIS_IDS) {
    const rows = allRows[axisId] ?? [];
    const poolRows = rows.filter((r) => r.n > 0 && partitionOf(r.playerKey, poolPct) === GROUPS.POOL);
    const evalRows = rows.filter((r) => r.n > 0 && partitionOf(r.playerKey, poolPct) === GROUPS.EVAL);

    // Channel 3 + 1. Re-checked here rather than trusted from the filter above, which is the
    // posture `leakageGuard` asks for: a guard that trusts its caller guards nothing.
    if (guard) for (const r of evalRows) guard.assertEvalPlayer(r.playerKey);

    const poolRate = rateOf(poolRows);
    const evalRate = rateOf(evalRows);

    const sweep = {};
    for (const minN of minNSweep) {
      const kept = evalRows.filter((r) => r.n >= minN);
      sweep[minN] = {
        minN,
        // PRIMARY: leakage-free. p̄ comes from POOL players, who are disjoint from these.
        poolAnchored: overdispersion({
          rows: kept, commonRate: poolRate, rateEstimatedInSample: false,
        }),
        // SENSITIVITY: the conventional in-sample form, so this run can be compared to §11.8,
        // which did not partition. Reported beside, never instead.
        inSample: overdispersion({
          rows: kept, commonRate: rateOf(kept), rateEstimatedInSample: true,
        }),
      };
    }

    const primary = sweep[primaryMinN] ?? sweep[minNSweep[0]];

    // Split-half reliability over the WHOLE eval set, not the minN-filtered one: the filter's
    // job is to make a χ² interpretable, and applying it here would throw away exactly the
    // thin players whose instability the reliability figure exists to expose.
    const reliability = splitHalfReliability(evalRows, { minHalfN: 5, guard });

    const shrunk = shrinkRates(evalRows.filter((r) => r.n >= primaryMinN), { priorWeight });
    shrunkByAxis[axisId] = new Map(shrunk.map((r) => [r.playerKey, r.shrunkRate]));

    axes[axisId] = {
      ...AXES[axisId],
      poolPlayers: poolRows.length,
      evalPlayers: evalRows.length,
      poolRate,
      evalRate,
      // k/n at the population level, so every rate in this report can be read with its
      // numerator and denominator rather than as a bare proportion.
      evalK: evalRows.reduce((s, r) => s + r.k, 0),
      evalN: evalRows.reduce((s, r) => s + r.n, 0),
      primaryMinN,
      sweep,
      primary,
      reliability,
      shrunkPlayers: shrunk.length,
    };
  }

  // ── verdicts, read against the control FROM THIS RUN ──
  const controlStats = axes[CONTROL_AXIS].primary.poolAnchored;
  for (const axisId of AXIS_IDS) {
    axes[axisId].verdict = separabilityVerdict({
      stats: axes[axisId].primary.poolAnchored,
      controlStats,
      obsThreshold: OBS_FOR_MOVEABLE_ESTIMATE,
    });
  }

  // ── cross-axis correlation, every pair ──
  const correlations = [];
  for (let i = 0; i < AXIS_IDS.length; i++) {
    for (let j = i + 1; j < AXIS_IDS.length; j++) {
      const a = AXIS_IDS[i];
      const b = AXIS_IDS[j];
      correlations.push({
        a,
        b,
        // Stated on the row itself: `cbetRate` is a strict subset of `flopBetFreq`, so their
        // correlation is guaranteed by construction and must not be read as evidence of a
        // shared trait. The disjoint control exists to give that pair an honest counterpart.
        overlapping: (a === 'cbetRate' && b === 'flopBetFreq') || (a === 'flopBetFreq' && b === 'cbetRate'),
        ...crossAxisCorrelation({
          a: shrunkByAxis[a],
          b: shrunkByAxis[b],
          reliabilityA: axes[a].reliability.reliability,
          reliabilityB: axes[b].reliability.reliability,
        }),
      });
    }
  }

  // ── ordering: is it a ladder, or independent habits wearing a ladder's name? ──
  const flagSets = LADDER_RUNGS.map((id) => ({
    id,
    ...acquiredFlags(shrunkByAxis[id], AXES[id].studiedDirection),
  }));

  const pairwise = [];
  for (let i = 0; i < flagSets.length; i++) {
    for (let j = i + 1; j < flagSets.length; j++) {
      pairwise.push(coOccurrence({
        flagsA: flagSets[i].flags,
        flagsB: flagSets[j].flags,
        labelA: flagSets[i].id,
        labelB: flagSets[j].id,
      }));
    }
  }

  const nesting = ladderNesting({
    orderedFlagMaps: flagSets.map((f) => f.flags),
    labels: LADDER_RUNGS,
  });

  return {
    handsSeen: tally.handsSeen,
    poolPct,
    priorWeight,
    primaryMinN,
    minNSweep: [...minNSweep],
    controlAxis: CONTROL_AXIS,
    axes,
    correlations,
    ordering: {
      thresholds: flagSets.map((f) => ({ axis: f.id, threshold: f.threshold, direction: f.direction })),
      pairwise,
      nesting,
    },
    guardSummary: guard ? guard.summary() : null,
  };
};

/**
 * The estimand, written out. It carries the transfer caveat INSIDE the sentence rather than
 * beside it, because a caveat in a separate field is a caveat that gets dropped when the
 * number is quoted.
 */
export const LADDER_ESTIMAND =
  'Between-player heterogeneity (Pearson χ²/df over players, against the binomial expectation '
  + "implied by each player's own n) in three study-ladder rungs — limp rate, 3-bet rate, c-bet "
  + 'rate — measured against flop bet frequency as a control axis in the SAME run. A statement '
  + 'about whether an axis carries real between-player variation, NOT an EV figure and NOT a '
  + 'claim that any archetype is profitable to exploit. POPULATION: online 2009 50NL '
  + "(SRC-012). The founder's game is LIVE 9-handed 1/2–1/3 — any live reading of these "
  + 'figures is TRANSFERRED, not measured.';

/**
 * Wrap the analysis in a Result Card.
 *
 * ADMISSIBILITY IS DRIVEN BY POWER, not by whether the answer was interesting. §11.8's headline
 * failure was that a weak-power null read like a negative finding, so a run whose median
 * observations-per-player cannot support a verdict is marked inadmissible for the separability
 * claim even when its χ² is perfectly well-formed.
 */
export const ladderResultCard = ({
  analysis, stamp, dealBookId, fieldId, surfaceId = 'handhq-observed-field-ws320',
}) => {
  const manifest = buildReplicationManifest(stamp);
  const control = analysis.axes[analysis.controlAxis];

  const controlSeparates = control.verdict.verdict === 'separates';
  const underpowered = LADDER_RUNGS.filter((id) => analysis.axes[id].verdict.verdict === 'underpowered');

  const blockers = [];
  if (!controlSeparates) {
    // Without a working control the whole run is uninterpretable: a null on a candidate axis
    // could equally mean the instrument is broken. This is the single most important gate here.
    blockers.push({
      code: 'CONTROL_DID_NOT_SEPARATE',
      detail:
        `The control axis (${control.label}) returned χ²/df = ${control.primary.poolAnchored.chi2PerDf?.toFixed(3)} `
        + `(z = ${control.primary.poolAnchored.z?.toFixed(1)}). §11.8 measured 1.859 / z = +15.5 on this same `
        + 'axis. A control that does not separate means the instrument cannot be shown to detect '
        + 'heterogeneity in this sample, so NO null on a candidate axis is interpretable.',
    });
  }

  const warnings = [];
  if (underpowered.length) {
    warnings.push({
      code: 'UNDERPOWERED_AXES',
      detail:
        `${underpowered.join(', ')} did not reach the ~${OBS_FOR_MOVEABLE_ESTIMATE} observations per `
        + 'player a shrunk estimate needs. Their nulls are weak-power nulls and must not be quoted '
        + 'as evidence of absence (§11.8).',
    });
  }
  for (const axisId of LADDER_RUNGS) {
    const rel = analysis.axes[axisId].reliability;
    if (rel.reliability !== null && rel.reliability < 0.4) {
      warnings.push({
        code: 'LOW_SPLIT_HALF_RELIABILITY',
        detail:
          `${axisId} split-half reliability is ${rel.reliability.toFixed(3)} over ${rel.players} players. `
          + 'Whatever between-player variance the χ² sees, it does not re-measure on the same player '
          + 'across time — so it is not yet a trait a per-villain channel could read.',
      });
    }
  }
  warnings.push({
    code: 'ONLINE_2009_NOT_LIVE',
    detail:
      'Top-ranked suspected-fault entry. Corpus is online 2009 50NL (SRC-012); the founder plays '
      + 'live 9-handed 1/2–1/3 (SRC-014). Limping in particular is far more common live, so the '
      + 'limp axis is the one most likely to behave differently there. No live sample was '
      + 'available to this run — SRC-014 lives in the app\'s IndexedDB and is not reachable from a '
      + 'node script — so the live half of the accept criterion is UNMET, not answered.',
  });

  const metrics = {
    handsSeen: analysis.handsSeen,
    primaryMinN: analysis.primaryMinN,
    priorWeight: analysis.priorWeight,
    controlAxis: analysis.controlAxis,
    axes: Object.fromEntries(AXIS_IDS.map((id) => {
      const a = analysis.axes[id];
      const s = a.primary.poolAnchored;
      return [id, {
        label: a.label,
        role: a.role,
        conditioning: a.conditioning,
        numerator: a.numerator,
        evalK: a.evalK,
        evalN: a.evalN,
        evalRate: a.evalRate,
        poolRate: a.poolRate,
        players: s.players,
        obsPerPlayerMedian: s.obsPerPlayerMedian,
        obsPerPlayerMean: s.obsPerPlayerMean,
        chi2PerDf: s.chi2PerDf,
        z: s.z,
        df: s.df,
        betweenPlayerSd: s.betweenPlayerSd,
        chi2PerDfInSample: a.primary.inSample.chi2PerDf,
        splitHalfReliability: a.reliability.reliability,
        splitHalfPlayers: a.reliability.players,
        verdict: a.verdict.verdict,
        verdictReason: a.verdict.reason,
        sweep: Object.fromEntries(Object.entries(a.sweep).map(([k, v]) => [k, {
          players: v.poolAnchored.players,
          chi2PerDf: v.poolAnchored.chi2PerDf,
          z: v.poolAnchored.z,
        }])),
      }];
    })),
    correlations: analysis.correlations,
    ordering: analysis.ordering,
    leakage: analysis.guardSummary,
  };

  return buildResultCard({
    resultCardId: `RC-study-ladder-${String(stamp.dealBookHash).replace('sha256:', '').slice(0, 8)}`,
    match: {
      surfaceId,
      dealBookId,
      fieldId,
      // The Surface and the Field coincide here BY CONSTRUCTION and saying so matters: this is
      // a measurement OF the population, not of a strategy played against it. A reader who
      // assumed the usual strategy-vs-field reading would misinterpret every number.
    },
    estimand: LADDER_ESTIMAND,
    treatment:
      'per-player (k, n) over EVAL-half players · Pearson χ² against a POOL-mined common rate '
      + '(leakage-free, df = m) with the in-sample variant reported beside it · Beta-Binomial '
      + `shrinkage, leave-one-out prior, pseudocount ${analysis.priorWeight} · temporal split-half `
      + 'reliability per player · control axis measured in the same run · NO EV claim',
    metrics,
    // Players, never hands. Every figure here is a between-player statistic and the decisions
    // inside one player are not independent.
    clusterUnit: 'players',
    admissibility: {
      admissible: blockers.length === 0,
      blockers,
      warnings,
      clusters: control.primary.poolAnchored.players,
    },
    manifest,
  });
};
