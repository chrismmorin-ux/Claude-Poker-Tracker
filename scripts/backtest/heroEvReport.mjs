/**
 * heroEvReport.mjs — assemble and render the hero-EV result.
 *
 * Three rules this module enforces structurally rather than by convention:
 *
 *   1. NO FIGURE WITHOUT ITS TREATMENT. The ticket is explicit — "never report a number
 *      without the treatment named". `renderHeroEvReport` throws rather than print an
 *      arm whose `treatment` is missing.
 *   2. THE CONTROL MUST COME OUT AT ZERO. Scoring the behaviour policy against itself
 *      has to yield an edge of exactly zero. It is printed every run, because if it
 *      ever drifts the instrument is manufacturing signal and no other row on the page
 *      means anything.
 *   3. RAKE BOTH WAYS. An edge that survives unraked and vanishes under rake is a
 *      vanished edge, and the run says so rather than quoting the flattering arm.
 */

import {
  estimateEdge, TREATMENT, DEFAULT_BOOTSTRAP_SEED,
  weightFor, wisValue, poolValue, clusterBootstrapCI,
} from './ipsEstimator.mjs';
import { applyFoldShift } from './behaviorPolicy.mjs';
import { buildResultCard, resultCardProblems } from '../../src/utils/standardOfRecord/resultCard.js';
import { buildReplicationManifest } from '../../src/utils/standardOfRecord/manifest.js';
import { PBR_SHRINK_SWEEP, PBR_WARNING, PBR_SCOPE } from './poolBestResponse.mjs';
import { exploitationPremium } from './equilibriumPost.mjs';
import { buildPositions, exploitationEfficiency } from './strategyPosition.mjs';
import { composeOverallEv, renderOverallEvLines } from './overallEv.mjs';
import { sampleAdmissibility } from './sampleAdmissibility.mjs';

const CORPUS_CAVEAT =
  'HandHQ online cash, July 2009, numeric stakes (SRC-011). Measures advice against THAT ' +
  'population. Live 1/2 generalisation is an assumption, not a result.';

/**
 * Schema version of the emitted report. Bump on any breaking change to the shape.
 * Consumers should refuse a version they do not understand rather than duck-type it.
 *
 * v2 (WS-322) — ADDITIVE. The report gained a `resultCard` block conforming to the ADR-009
 * Standard of Record. Every pre-existing field is unchanged and in the same place, so
 * `model-readiness.mjs` and `scorecard-history.yaml` read exactly what they read before.
 *
 * v3 (WS-331) — ADDITIVE. The report gained the two pier posts: a `pbr` arm (the ceiling of
 * exploitation), `pbrSweep` (its shrinkage curve), `positions` (every strategy as a 2D
 * location rather than a scalar), and `premium` (which reports an honest ABSENCE until the
 * Equilibrium post SRC-013 exists). Every pre-existing field is unchanged and in place.
 *
 * v4 (WS-295) — ADDITIVE. The report gained a `curse` block: the optimizer's curse measured as a
 * SHAPE (edge by posterior-width stratum and by top-two-margin stratum). On a run that predates
 * the stated-EV capture the block reports `available: false` WITH ITS REASON rather than being
 * absent — an absent block reads as "not applicable", a false one reads as "measured, found
 * nothing", and the truth is "this artifact cannot answer it". Every pre-existing field is
 * unchanged and in place.
 *
 * v5 (WS-428) — ADDITIVE. The report gained `overallEv`: the §3.3 headline
 * `edgeBB × opportunitiesPerHand × 100`, with BOTH factors carried inseparably beside the
 * product (WS-410 Stage 2) and the second factor sourced from the coverage census over the
 * Deal Book — never from n/handsRepresented on the scored subset. `null` on a run that
 * supplied no opportunity census. Every pre-existing field is unchanged and in place.
 */
// v6 (WS-431): the Result Card carries `decisionRecord` {contentHash, rowCount,
// schemaVersion} — the by-hash reference to the per-decision JSONL record the headline
// was computed from. v5 (WS-428) added overallEv metrics.
// v7 (WS-435) — ADDITIVE. The report gained `preflight` (the pre-run MDE gate result, when
// the runner performed one; null on runs that predate the power ledger), and the card
// metrics gained mdeDetectBB / mdePower80BB. Every pre-existing field is unchanged.
export const HERO_EV_SCHEMA_VERSION = 7;

/**
 * The estimand, stated in words.
 *
 * ADR-009's AS-710 turns on two instruments measuring THE SAME QUANTITY — corpus substitution
 * at a one-decision horizon, and the population simulator over a full hand. Their agreement is
 * what licenses a total-EV claim, and agreement is meaningless unless both name what they are
 * estimating. The units subtlety is load-bearing and already documented in `renderHeroEvReport`:
 * the outcome attached to a decision is the WHOLE HAND's net for hero, so these are hand-scale
 * magnitudes, and reading them as a winrate overstates them by the decisions-per-hand factor.
 */
const HERO_EV_ESTIMAND =
  'Expected hand value for hero in bb, attributed at the decision level, relative to '
  + 'population-typical play on the same decision. NOT a per-decision increment and NOT a winrate.';

/**
 * Minimum contributing PLAYERS before a confidence interval may be believed.
 *
 * The CI is a cluster bootstrap over players (`ipsEstimator.clusterBootstrapCI`), which is
 * the right design — decisions inside one player are not independent. But a bootstrap can
 * only resample the clusters it has. With k=3, 2000 resamples explore about ten distinct
 * multisets, so the bootstrap distribution is severely under-dispersed and the interval
 * comes out narrow because the sample is small, not because the estimate is precise.
 *
 * Observed live 2026-07-31: an interrupted run with THREE contributing players reported
 * edge +16.72 bb, CI [7.52, 23.42], and `c3Passes: true` — on a gate that decides whether
 * the founder stops building and starts studying. Nothing was wrong with the arithmetic;
 * the sample simply could not support the claim, and nothing in the artifact said so.
 *
 * 30 follows the ordinary convention for cluster-robust inference (below roughly 30-50
 * clusters, asymptotic and naive-bootstrap intervals under-cover and corrections are
 * expected). It is a JUDGEMENT CALL, deliberately named, exported, and stamped into every
 * report as `minClustersForCI` so a consumer can see which bar was applied. Moving it is a
 * `/decide`, not an edit.
 */
export const MIN_CLUSTERS_FOR_CI = 30;

/** The control is scored against itself; anything but zero means manufactured signal. */
const CONTROL_TOLERANCE_BB = 1e-6;

/**
 * Decide whether this report may be QUOTED, and say why not when it may not.
 *
 * Computed once here so that every consumer — the readiness gate, a dashboard, a future
 * FSA surface — inherits one verdict instead of each re-deriving the rules and one of them
 * getting it wrong. This is the same principle the promoted data-source registry applies to
 * every other number in the repo: an artifact states its own scope and limits.
 */
const assessAdmissibility = (run, arms) => {
  const clusters = arms.engineRaked.players ?? 0;
  const blockers = [];
  const warnings = [];

  if (run.complete === false) {
    blockers.push({
      code: 'INCOMPLETE_RUN',
      detail: `Run did not finish (${run.decisionsScored ?? arms.engineRaked.n} decisions scored). `
        + 'EVAL players are processed sequentially, so a partial is a biased subsample of the '
        + 'first players, not a random one.',
    });
  }

  if (!arms.engineRaked.n) {
    blockers.push({ code: 'NO_DECISIONS', detail: 'No decisions were scored; every figure is vacuous.' });
  }

  if (clusters < 2) {
    blockers.push({
      code: 'NO_CI_POSSIBLE',
      detail: `Only ${clusters} contributing player(s). A cluster bootstrap needs at least 2 and returns null below that.`,
    });
  } else if (clusters < MIN_CLUSTERS_FOR_CI) {
    blockers.push({
      code: 'TOO_FEW_CLUSTERS',
      detail: `${clusters} contributing players is below the ${MIN_CLUSTERS_FOR_CI}-cluster bar. `
        + 'The bootstrap cannot represent between-player variance at this k, so a narrow CI '
        + 'reflects sample size rather than precision. Between-player variance is the dominant '
        + 'term in this estimate — it is what moved the edge across earlier runs at fixed n.',
    });
  }

  const ctrl = arms.populationControl;
  if (ctrl.n && (ctrl.edgeBB === null || Math.abs(ctrl.edgeBB) >= CONTROL_TOLERANCE_BB)) {
    blockers.push({
      code: 'CONTROL_DRIFT',
      detail: `Control scored ${ctrl.edgeBB} bb against itself; it must be 0. The estimator is `
        + 'manufacturing signal and no figure in this report means anything.',
    });
  }

  if (arms.engineRaked.n && arms.engineRaked.essShare !== null && arms.engineRaked.essShare < 0.2) {
    warnings.push({
      code: 'LOW_ESS',
      detail: `Effective sample is ${arms.engineRaked.ess} (${(arms.engineRaked.essShare * 100).toFixed(1)}% of n). `
        + 'Importance weights are concentrated; the interval is wider than n suggests.',
    });
  }

  // WS-504 — does this sample describe the population the invocation asked for? The rules
  // live in sampleAdmissibility.mjs because five other reports share this verdict shape and
  // must inherit one answer rather than each re-deriving it.
  const sample = sampleAdmissibility(run.replicationStamp ?? null, run.config ?? {});
  blockers.push(...sample.blockers);
  warnings.push(...sample.warnings);

  return {
    admissible: blockers.length === 0,
    blockers,
    warnings,
    clusters,
    minClustersForCI: MIN_CLUSTERS_FOR_CI,
    complete: run.complete !== false,
    sampleComposition: sample.sampleComposition,
  };
};

/** Deterministic always-fold/check policy — one of the two required baselines. */
const passivePolicy = (piOurs) => {
  const out = {};
  for (const a of Object.keys(piOurs)) out[a] = 0;
  if ('fold' in out) out.fold = 1;          // facing a bet: fold
  else if ('check' in out) out.check = 1;   // first to act / checked to: check
  return out;
};

const withNet = (decisions, field) => decisions.map((d) => ({ ...d, netBB: d[field] }));

/**
 * Map this run onto a Result Card (ADR-009).
 *
 * Almost nothing here is new information — `treatment`, `admissibility` and the arms already
 * existed and were already the right objects. What the Result Card adds is the MATCH (which
 * surface, against which Deal Book, against which Field) and the replication manifest, which
 * is what lets this figure be compared to another one and re-derived later.
 *
 * Returns `{ resultCard, resultCardProblems }` rather than throwing. A run that produced a
 * real measurement must still write its artifact when the stamp is incomplete — a smoke run
 * with no Deal Book is a legitimate thing to do — and the problems list says exactly why the
 * card is not quotable. That mirrors how `admissibility` already works: compute the verdict,
 * state the blockers, never silently suppress the arithmetic.
 */
const buildCardFor = (run, arms, headline, pbr = null, overallEv = null) => {
  const stamp = run.replicationStamp ?? null;
  if (!stamp) {
    return {
      resultCard: null,
      resultCardProblems: [
        'no replication stamp on the run — this figure cannot be replicated and must not be '
        + 'quoted. Pass a Deal Book and stamp via run-hero-ev.mjs to produce a Result Card.',
      ],
    };
  }

  const efficiency = exploitationEfficiency(headline.edgeBB, pbr?.edgeBB ?? null);

  try {
    const manifest = buildReplicationManifest(stamp);
    const resultCard = buildResultCard({
      resultCardId: `RC-hero-ev-${stamp.dealBookHash.replace('sha256:', '').slice(0, 8)}-${stamp.engineCommit.slice(0, 8)}`,
      match: {
        surfaceId: run.surfaceId ?? 'engine-read',
        dealBookId: run.dealBook?.dealBookId ?? null,
        fieldId: run.fieldId ?? 'pool-mined-behavior-policy',
      },
      estimand: HERO_EV_ESTIMAND,
      treatment: TREATMENT,
      metrics: {
        kind: 'hero-ev', // WS-434: dispatches metricsProblems to SOR_SCHEMAS['metrics.hero-ev']
        edgeBB: headline.edgeBB,
        edgeCiLowBB: headline.edgeCiLowBB,
        edgeCiHighBB: headline.edgeCiHighBB,
        n: headline.n,
        ess: headline.ess,
        players: headline.players,
        controlEdgeBB: arms.populationControl.edgeBB,
        liveShiftedCiLowBB: arms.liveShifted.edgeCiLowBB,
        // WS-331 — a STANDARD Result Card field, so any two cards can be compared on the
        // fraction of available edge captured rather than on raw bb, which is not comparable
        // across Deal Books. Null carries its reason; a bare null would read as "not
        // measured" when it may mean "the ceiling itself was not resolvable on this run".
        pbrEdgeBB: pbr?.edgeBB ?? null,
        exploitationEfficiency: efficiency.value,
        exploitationEfficiencyUnavailableReason: efficiency.reason,
        // WS-428 — the §3.3 headline, WITH both factors on the card (WS-410 Stage 2: a
        // reader must see edge and opportunity count separately, never only the product).
        // `edgeBB` above is factor 1; `opportunitiesPerHand` is factor 2, from the coverage
        // census over the Deal Book — structurally refused if derived from the scored
        // subset (see coverageCensus.attachOpportunityCount). Null when the run supplied no
        // opportunity census. Population per HC-011 travels on the composed object.
        overallEvBB100: overallEv?.overallEvBB100 ?? null,
        opportunitiesPerHand: overallEv?.factors?.opportunitiesPerHand ?? null,
        // WS-435 — a null without its MDE is not a result. The smallest edge THIS run
        // could have resolved, on the same bb scale as edgeBB above.
        mdeDetectBB: headline.mdeDetectBB ?? null,
        mdePower80BB: headline.mdePower80BB ?? null,
      },
      // PLAYERS, not hands. The CI is a cluster bootstrap over players because decisions
      // inside one player are not independent (POKER_THEORY 14.3).
      clusterUnit: 'players',
      admissibility: assessAdmissibility(run, arms),
      manifest,
      // WS-431: the by-hash reference to the decision record (set by run-hero-ev.mjs
      // BEFORE this builder runs). The card points at the record it was computed from;
      // the inversion test rederives the headline from that record alone.
      decisionRecord: run.decisionRecord ?? null,
      // WS-431: hero-EV cards stop carrying atomSetHash: null — the atom set is projected
      // from the record (decisionRecordAtoms.mjs), id derived from its contentHash.
      atomSetHash: run.atomSet?.atomSetHash ?? null,
      atomCount: run.atomSet?.atomCount ?? null,
      anchorGeneration: run.atomSet?.anchorGeneration ?? null,
    });
    return { resultCard, resultCardProblems: [] };
  } catch (err) {
    // The card could not be built. Say why, in the artifact, rather than omitting it.
    const partial = { ...stamp };
    return {
      resultCard: null,
      resultCardProblems: [err?.message || String(err), ...resultCardProblems({ manifest: partial })],
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════════════════════
// WS-295 — THE OPTIMIZER'S CURSE, MEASURED AS A SHAPE
//
// THE UNIT TRAP, AND HOW THIS AVOIDS IT. The engine's stated EV (`evStats.statedEvMean`) is a
// PER-DECISION quantity in the engine's internal chips. The realized outcome attached to a
// decision (`netBB`) is the WHOLE HAND's net in bb, counted once per decision the hand contains.
// A predicted-minus-realized difference between them is unit-mismatched and would produce a
// confident wrong number — `ipsEstimator`'s header says so explicitly. NOTHING BELOW SUBTRACTS
// THE TWO. They never meet in an expression.
//
// WHAT IS DONE INSTEAD. The decisions are STRATIFIED by two node-level covariates the curse
// makes predictions about, and the IPS edge is measured WITHIN each stratum by the same
// `weightFor` / `wisValue` / `poolValue` the headline arm uses. The curse then makes two
// monotone predictions about how the edge moves ACROSS strata:
//
//   1. POSTERIOR WIDTH (`statedEvSd`): the wider the posterior at a node, the more the argmax
//      is selecting on favourable error, so the LESS of its stated value the advice delivers.
//      Predicted: edge DECREASES as width increases.
//   2. TOP-TWO MARGIN (`topTwoMarginMean`): the further ahead the winner is, the less noise can
//      dislodge it, so the less optimism there is to lose.
//      Predicted: edge INCREASES as margin increases.
//
// Both are claims about the SIGN OF A DIFFERENCE BETWEEN STRATA, which is invariant to the unit
// of either axis — that is precisely why the shape survives a mismatch the level does not.
//
// A FLAT RELATIONSHIP IS A REFUTATION and is reported as one, in the verdict word, never buried.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/** Terciles by a covariate. Equal-count, so a skewed covariate cannot empty a stratum. */
const tercileSplit = (rows, keyOf) => {
  const withKey = rows.filter((r) => Number.isFinite(keyOf(r)));
  if (withKey.length < 6) return null;
  const sorted = [...withKey].sort((a, b) => keyOf(a) - keyOf(b));
  const third = Math.floor(sorted.length / 3);
  return {
    low: sorted.slice(0, third),
    mid: sorted.slice(third, sorted.length - third),
    high: sorted.slice(sorted.length - third),
  };
};

/**
 * Score one stratum with the SAME estimator the headline arm uses.
 *
 * `estimateEdge` is not called directly because the between-stratum CI below needs the scored
 * records themselves (tagged by stratum) to resample players across both strata at once. The
 * arithmetic is `weightFor` + `wisValue` - `poolValue`, i.e. exactly `estimateEdge`'s, reusing
 * its exported pieces rather than restating them. ADR-009 forbids a SECOND COMPARISON PATH; this
 * is the same path with a filter in front of it.
 */
const scoreStratum = (rows, weightCap) => {
  const scored = [];
  let clipped = 0;
  const skipped = {};
  for (const d of rows) {
    const r = weightFor(d, { weightCap });
    if (!r.ok) { skipped[r.reason] = (skipped[r.reason] || 0) + 1; continue; }
    if (r.clipped) clipped++;
    scored.push({ w: r.w, net: r.net, playerId: d.playerId });
  }
  if (!scored.length) return null;

  let sw = 0, sw2 = 0;
  for (const s of scored) { sw += s.w; sw2 += s.w * s.w; }
  const ess = sw2 > 0 ? (sw * sw) / sw2 : 0;
  const vOurs = wisValue(scored);
  const vPool = poolValue(scored);

  return {
    n: scored.length,
    players: new Set(scored.map((s) => s.playerId)).size,
    // ESS and clipped share travel with EVERY figure — the estimator's own standing
    // requirement, and a stratum is exactly where a small effective sample hides.
    ess: Number(ess.toFixed(1)),
    essShare: Number((ess / scored.length).toFixed(4)),
    clippedShare: Number((clipped / scored.length).toFixed(4)),
    edgeBB: (vOurs !== null && vPool !== null) ? Number((vOurs - vPool).toFixed(4)) : null,
    skipped,
    scored,
  };
};

/**
 * One covariate's shape test: the high-stratum edge minus the low-stratum edge, with a cluster
 * bootstrap over PLAYERS on the difference itself.
 *
 * The CI is taken on the DIFFERENCE, for the same reason the headline arm takes it on the edge
 * rather than on the two values: the same players feed both strata, so the contrast is far
 * better determined than either level, and the prediction is about the difference.
 */
const shapeAxis = ({ rows, keyOf, weightCap, label, covariate, predictedSign, seed }) => {
  const split = tercileSplit(rows, keyOf);
  if (!split) {
    return {
      label, covariate, predictedSign,
      verdict: 'UNDETERMINED',
      detail: `fewer than 6 decisions carry ${covariate}; no tercile split is possible`,
      strata: null,
    };
  }

  const strata = {
    low: scoreStratum(split.low, weightCap),
    mid: scoreStratum(split.mid, weightCap),
    high: scoreStratum(split.high, weightCap),
  };
  for (const k of ['low', 'mid', 'high']) {
    if (strata[k]) {
      const vals = split[k].map(keyOf);
      strata[k].covariateMin = Math.min(...vals);
      strata[k].covariateMax = Math.max(...vals);
      strata[k].covariateMean = vals.reduce((s, v) => s + v, 0) / vals.length;
    }
  }
  if (!strata.low || !strata.high) {
    return { label, covariate, predictedSign, verdict: 'UNDETERMINED', detail: 'a stratum had no scorable decision', strata };
  }

  // Resample players across BOTH extreme strata together, tagging each scored record with the
  // stratum it came from, so a drawn player carries its decisions from each.
  const byPlayer = new Map();
  const tag = (recs, which) => {
    for (const r of recs) {
      if (!byPlayer.has(r.playerId)) byPlayer.set(r.playerId, []);
      byPlayer.get(r.playerId).push({ ...r, stratum: which });
    }
  };
  tag(strata.low.scored, 'low');
  tag(strata.high.scored, 'high');

  const diffStat = (chunk) => {
    const lo = chunk.filter((c) => c.stratum === 'low');
    const hi = chunk.filter((c) => c.stratum === 'high');
    if (!lo.length || !hi.length) return null;
    const eLo = wisValue(lo) - poolValue(lo);
    const eHi = wisValue(hi) - poolValue(hi);
    return eHi - eLo;
  };
  const ci = clusterBootstrapCI(byPlayer, diffStat, { seed });

  const diff = strata.high.edgeBB - strata.low.edgeBB;
  const contributingPlayers = byPlayer.size;
  const directionMatches = (diff > 0 ? 'positive' : 'negative') === predictedSign;

  let verdict, detail;
  if (!ci) {
    verdict = 'UNDETERMINED';
    detail = 'cluster bootstrap returned no interval (fewer than 2 contributing players)';
  } else if (contributingPlayers < MIN_CLUSTERS_FOR_CI) {
    // POWER BEFORE VERDICT, and the bar is the one this module ALREADY declares for believing
    // any cluster-bootstrap interval — not a second bar invented for this block. Below roughly
    // 30 clusters the bootstrap cannot represent between-player variance, so a straddling
    // interval reflects the sample size and NOT the absence of the effect.
    //
    // Calling that "REFUTED" would be the precise mistake `MIN_CLUSTERS_FOR_CI`'s own docblock
    // was written to prevent, one level up: there, a narrow CI was read as precision; here, a
    // wide one would be read as a null. Both are the cluster count talking.
    verdict = directionMatches ? 'UNDERPOWERED-DIRECTION-CONSISTENT' : 'UNDERPOWERED';
    detail = `${contributingPlayers} contributing players is below the ${MIN_CLUSTERS_FOR_CI}-cluster bar. `
      + `high-minus-low edge ${diff.toFixed(3)} bb, CI [${ci.lo.toFixed(3)}, ${ci.hi.toFixed(3)}]. `
      + (directionMatches
        ? `The sign runs in the predicted ${predictedSign} direction, but this sample could not `
          + 'have refuted the null either, so it is a hint and not a result.'
        : `The sign runs against the predicted ${predictedSign} direction. `)
      + 'This is NOT a refutation — raise the decision and player count and re-run.';
  } else if (ci.lo <= 0 && ci.hi >= 0) {
    // THE REFUTATION BRANCH, and it is a first-class outcome. WS-295 states plainly that a null
    // is publishable and that a flat relationship must not be buried.
    verdict = 'REFUTED-FLAT';
    detail = `high-minus-low edge ${diff.toFixed(3)} bb, CI [${ci.lo.toFixed(3)}, ${ci.hi.toFixed(3)}] `
      + `straddles zero. The curse predicts a ${predictedSign} difference; this sample does not show one.`;
  } else if ((diff > 0 ? 'positive' : 'negative') !== predictedSign) {
    verdict = 'REFUTED-WRONG-SIGN';
    detail = `high-minus-low edge ${diff.toFixed(3)} bb, CI [${ci.lo.toFixed(3)}, ${ci.hi.toFixed(3)}] `
      + `excludes zero but runs OPPOSITE to the predicted ${predictedSign} direction.`;
  } else {
    verdict = 'CONFIRMED';
    detail = `high-minus-low edge ${diff.toFixed(3)} bb, CI [${ci.lo.toFixed(3)}, ${ci.hi.toFixed(3)}] `
      + `excludes zero in the predicted ${predictedSign} direction.`;
  }

  return {
    label, covariate, predictedSign, highMinusLowBB: Number(diff.toFixed(4)),
    ci, contributingPlayers, minClustersForCI: MIN_CLUSTERS_FOR_CI,
    directionMatchesPrediction: directionMatches, verdict, detail, strata,
  };
};

/**
 * The WS-295 block. Returns an honest ABSENCE on a run that predates the `evStats` capture,
 * rather than an empty shape that would read as "measured, found nothing".
 */
export const buildCurseReport = (decisions, { weightCap = 20, seed = DEFAULT_BOOTSTRAP_SEED } = {}) => {
  const rows = (decisions || []).filter((d) => d?.evStats);

  const unitNote =
    'STATED EV IS PER-DECISION IN ENGINE CHIPS; REALIZED OUTCOME IS THE WHOLE HAND\'S NET IN bb, '
    + 'counted once per decision the hand contains. The two are NEVER differenced here. Every '
    + 'figure below is an edge measured WITHIN a stratum by the headline estimator, and every '
    + 'claim is about the SIGN OF A DIFFERENCE BETWEEN strata, which the unit mismatch does not '
    + 'touch. No headline figure depends on the two being on the same scale.';

  const liveTransfer =
    'A magnitude here is mined from HandHQ online cash, July 2009. It is evidence about the '
    + 'ESTIMATOR\'S SHAPE, never a live 1/2-1/3 constant; the founder\'s game is live 9-handed and '
    + 'any value carried across is TRANSFERRED, not measured.';

  if (rows.length === 0) {
    return {
      available: false,
      reason: (decisions || []).length
        ? 'this run predates the WS-295 stated-EV capture — no decision row carries `evStats`. '
          + 'Re-run the pass to measure the curse; it cannot be recovered from this artifact.'
        : 'no decisions were scored',
      unitNote,
      liveTransfer,
      n: 0,
    };
  }

  return {
    available: true,
    n: rows.length,
    nWithoutEvStats: (decisions || []).length - rows.length,
    unitNote,
    liveTransfer,
    // The villain is held at POPULATION BASELINE for the whole pass, so villain-model posterior
    // width is constant and CANNOT be the covariate here. The width that varies — and the one
    // actually tested — is hero's RANGE posterior expressed in EV units. Stated in the artifact
    // because a reader who assumes the other one would credit this run with a channel it never
    // varied.
    posteriorWidthMeans: 'hero range posterior (villain held at population baseline — that width is constant by design)',
    vsPosteriorWidth: shapeAxis({
      rows, keyOf: (d) => d.evStats.statedEvSd, weightCap, seed,
      label: 'edge vs POSTERIOR WIDTH at the node',
      covariate: 'evStats.statedEvSd',
      predictedSign: 'negative',
    }),
    vsTopTwoMargin: shapeAxis({
      rows, keyOf: (d) => d.evStats.topTwoMarginMean, weightCap, seed,
      label: 'edge vs TOP-TWO EV MARGIN',
      covariate: 'evStats.topTwoMarginMean',
      predictedSign: 'positive',
    }),
    vsActionCount: shapeAxis({
      rows, keyOf: (d) => d.evStats.nActionsMean, weightCap, seed,
      label: 'edge vs NUMBER OF ACTIONS COMPARED',
      covariate: 'evStats.nActionsMean',
      predictedSign: 'negative',
    }),
  };
};

export const buildHeroEvReport = (run, { foldShiftPp = 13, weightCap = 20, opportunityCensus = null } = {}) => {
  const d = run.decisions;
  const opts = { weightCap };

  const arms = {
    // Headline: the engine's advice, rake-inclusive.
    engineRaked: estimateEdge(d, { ...opts, label: 'engine advice (rake modelled)' }),

    // Same advice, rake removed from the ledger only.
    engineUnraked: estimateEdge(
      withNet(d.filter((x) => Number.isFinite(x.netBBUnraked)), 'netBBUnraked'),
      { ...opts, label: 'engine advice (no rake)' },
    ),

    // Baseline 1 — always fold / always check.
    passive: estimateEdge(
      d.map((x) => ({ ...x, piOurs: passivePolicy(x.piOurs) })),
      { ...opts, label: 'baseline: always fold/check' },
    ),

    // Baseline 2 / CONTROL — population-typical play. Scoring the behaviour policy
    // against itself must give exactly zero. See rule 2 in the header.
    populationControl: estimateEdge(
      d.map((x) => ({ ...x, piOurs: x.piPool })),
      { ...opts, label: 'control: population-typical (must be 0)' },
    ),

    // Sensitivity — the field folds `foldShiftPp` points more often. Founder decision
    // 2026-07-28: certify structure, stress-test the value. C3 passes only if the edge
    // holds here too.
    liveShifted: estimateEdge(
      d.map((x) => ({ ...x, piPool: applyFoldShift(x.piPool, foldShiftPp) })),
      { ...opts, label: `sensitivity: field folds +${foldShiftPp}pp` },
    ),
  };

  // ─────────────────────────────────────────────────────────────────────────────────────
  // WS-331 — THE UPPER POST.
  //
  // PBR enters as one more `piOurs` remap through the SAME `estimateEdge` every other arm
  // uses. That is not a convenience: ADR-009 guarantees the Declared surface is scored by the
  // same instrument as the other four kinds and that no second comparison path is permitted.
  // A bespoke PBR estimator would have been that second path.
  //
  // `null` when the run predates WS-331 or when no decision produced a ceiling — the arm is
  // then absent rather than zero, because a ceiling of zero and no ceiling at all are
  // different claims and `exploitationEfficiency` treats them differently.
  // ─────────────────────────────────────────────────────────────────────────────────────
  const pbrDecisions = d.filter((x) => x.piPbr);
  const pbr = pbrDecisions.length
    ? estimateEdge(
      pbrDecisions.map((x) => ({ ...x, piOurs: x.piPbr })),
      { ...opts, label: 'PBR ceiling (NEVER PLAY)' },
    )
    : null;
  if (pbr) arms.pbr = pbr;

  // THE SHRINKAGE CURVE, not a point. A best response to a MEASURED model exploits that
  // model's estimation noise as readily as its real tendencies, so an uncorrected ceiling is
  // inflated and every strategy scored against it looks worse than it is. Regularizing the
  // population model harder must shrink PBR's edge; HOW FAST is the measurement of how much
  // of the ceiling was ever real. Each point is scored through `estimateEdge` like any other
  // arm, so the curve is directly comparable to the headline.
  const pbrSweep = PBR_SHRINK_SWEEP.map((w) => {
    const rows = d.filter((x) => x.piPbrBySweep?.[w]);
    if (!rows.length) return { shrinkWeight: w, arm: null };
    return {
      shrinkWeight: w,
      arm: estimateEdge(
        rows.map((x) => ({ ...x, piOurs: x.piPbrBySweep[w] })),
        { ...opts, label: `PBR @ shrink=${w}` },
      ),
    };
  }).filter((r) => r.arm !== null);

  const headline = arms.engineRaked;
  const admissibility = assessAdmissibility(run, arms);

  const gate = {
    // C3 bar: edge positive with a 95% CI excluding zero, in BOTH the corpus arm and
    // the live-shifted arm (founder decision 2026-07-28).
    heroEvEdge: headline.edgeBB,
    heroEvCiLow: headline.edgeCiLowBB,
    corpusArmPasses: headline.edgeCiLowBB !== null && headline.edgeCiLowBB > 0,
    liveShiftedArmPasses: arms.liveShifted.edgeCiLowBB !== null && arms.liveShifted.edgeCiLowBB > 0,
  };

  // ADMISSIBILITY GATES THE VERDICT, not just the commentary. Before this, `c3Passes` was
  // computed purely from the two CI signs, so an interrupted 3-player run reported PASS on
  // the criterion that decides whether the founder stops building. A consumer reading
  // `c3Passes` must never have to ALSO know to check the player count — that is precisely
  // the knowledge that fails to travel.
  gate.c3Passes = admissibility.admissible && gate.corpusArmPasses && gate.liveShiftedArmPasses;
  gate.admissible = admissibility.admissible;
  gate.blockedBy = admissibility.blockers.map((b) => b.code);
  // Preserved so the underlying arithmetic is still visible when admissibility blocks it —
  // suppressing the number entirely would hide a trend that is worth watching across runs.
  gate.armsWouldPass = gate.corpusArmPasses && gate.liveShiftedArmPasses;

  // WS-428 — the §3.3 headline. Composed only from a census carrying a Deal-Book-structure
  // opportunity count; `composeOverallEv` throws on any other basis, so a scored-subset
  // substitution cannot reach this field. Null (not zero) when no census was supplied.
  const overallEv = opportunityCensus
    ? composeOverallEv({ edgeBB: headline.edgeBB, census: opportunityCensus })
    : null;

  const card = buildCardFor(run, arms, headline, pbr, overallEv);

  // EVERY STRATEGY AS A POSITION, NEVER A SCALAR. The builder refuses a bare number, so this
  // is the shape enforced rather than a shape recommended. One coordinate — own
  // exploitability — is honestly null for everything but the field, whose exploitability IS
  // PBR's edge by construction.
  const positions = buildPositions(arms, pbr);

  // THE PREMIUM, AND WHY IT IS NULL. EV(PBR) - EV(Equilibrium) is the number that would say
  // how much money exists specifically because the pool is bad, as opposed to because hero
  // plays solid poker. The lower post does not exist (SRC-013), so the premium is reported as
  // an absence with its reason. `exploitationPremium` also REFUSES chart-derived substitutes,
  // which is the one way this could quietly start returning a number that means something
  // else.
  const premium = exploitationPremium({ pbrEdgeBB: pbr?.edgeBB ?? null });

  return {
    schemaVersion: HERO_EV_SCHEMA_VERSION,
    caveat: CORPUS_CAVEAT,
    treatment: TREATMENT,
    // WS-435 — additive. The pre-run MDE gate result the runner stamped on the run, or
    // null on a run that predates the power ledger (an absent gate is stated, not implied).
    preflight: run.preflight ?? null,
    // WS-428 — additive. Null on a run with no opportunity census; carries both factors,
    // the opportunity provenance, and the HC-011 population statement when present.
    overallEv,
    admissibility,
    // WS-295 — the optimizer's curse, as a shape. Reports its own unavailability with a reason
    // on a run that predates the stated-EV capture.
    curse: buildCurseReport(run.decisions, { weightCap }),
    // WS-331 — the pier posts. Additive; everything that predates this is unchanged.
    pbrSweep,
    positions,
    premium,
    pbrWarning: PBR_WARNING,
    pbrScope: PBR_SCOPE,
    // ADR-009 Standard of Record (WS-322). Additive — everything below this line predates it
    // and is unchanged.
    resultCard: card.resultCard,
    resultCardProblems: card.resultCardProblems,
    // Provenance, stamped so a downstream consumer can trace this artifact without
    // re-deriving it. Source ids are the promoted registry's (docs/provenance/).
    provenance: {
      sources: ['SRC-012', 'SRC-015'],
      corpus: 'HandHQ online cash, July 2009, numeric stakes',
      reference: run.integrity?.reference ?? null,
      partition: run.integrity?.behaviorPolicy?.partition ?? null,
      behaviorPolicyObservations: run.integrity?.behaviorPolicy?.observations ?? null,
      behaviorPolicyPlayers: run.integrity?.behaviorPolicy?.players ?? null,
      rakeModelled: run.config?.rakeIsModelled ?? null,
      complete: run.complete !== false,
    },
    generatedFrom: {
      config: run.config,
      counters: run.counters,
      integrity: run.integrity,
      runtimeMs: run.runtimeMs ?? null,
    },
    // WS-433 — the contention instrument. Under a wall-clock refinement budget, worker
    // contention systematically lowers the depth the engine reaches per decision; this
    // histogram is what makes that MEASURED rather than assumed. `depthReachedMax` is the
    // primary arm's per-decision maximum over its sampled combos; a parallel refined run
    // whose distribution sits below a serial run's is the bias, made visible.
    depthReached: (() => {
      const hist = {};
      let absent = 0;
      for (const d of run.decisions) {
        const v = d.evStats?.depthReachedMax;
        if (Number.isFinite(v)) hist[v] = (hist[v] || 0) + 1; else absent++;
      }
      return { hist, absent };
    })(),
    // WS-432 — does the logical refinement budget BIND at this configuration? Aggregated
    // over decisions from the primary arm's `evStats.budgetBoundAny`. At a nonzero budget
    // a uniformly-false column is the tell that the gate has been disabled rather than made
    // deterministic (WS-432 accept criteria); at budget 0 uniformly false is correct.
    budgetBound: (() => {
      let bound = 0; let notBound = 0; let absent = 0;
      for (const d of run.decisions) {
        const v = d.evStats?.budgetBoundAny;
        if (v === true) bound++; else if (v === false) notBound++; else absent++;
      }
      return { bound, notBound, absent };
    })(),
    arms,
    gate,
    foldShiftPp,
  };
};

const pct = (x) => (x === null || x === undefined ? '—' : `${(x * 100).toFixed(1)}%`);
const bb = (x) => (x === null || x === undefined ? '—' : x.toFixed(3));

const renderArm = (a) => {
  if (!a.treatment) {
    throw new Error(`hero-EV arm "${a.label}" has no treatment — refusing to render it`);
  }
  if (!a.n) return `  ${String(a.label).padEnd(42)} no scorable decisions`;
  const ci = (a.edgeCiLowBB === null)
    ? 'CI —'
    : `[${bb(a.edgeCiLowBB)}, ${bb(a.edgeCiHighBB)}]`;
  return `  ${String(a.label).padEnd(42)} ${bb(a.edgeBB).padStart(8)} bb   ${ci.padStart(20)}   n=${String(a.n).padStart(5)}  ESS=${String(a.ess).padStart(7)}`;
};

const eff = (x) => (x === null || x === undefined ? '—' : `${(x * 100).toFixed(1)}%`);

/**
 * The pier-post block (WS-331).
 *
 * Ordered so the reader meets the WARNING before the ceiling's number. A ceiling printed
 * first and disclaimed second is a ceiling that gets quoted without its disclaimer, and PBR
 * is maximally exploitable by construction — reading it as advice is the one misreading that
 * costs real money.
 *
 * Absent on a pre-WS-331 artifact, and absent rather than zeroed on a run that produced no
 * ceiling: "no ceiling was resolvable" and "the ceiling is zero" are different claims.
 */
const renderPiers = (r) => {
  const L = [];
  if (!r.arms?.pbr && !(r.pbrSweep ?? []).length) return L;

  L.push('  PIER POSTS — where does this strategy SIT? (WS-331)');
  L.push('  ' + '─'.repeat(90));
  L.push(`    !! ${r.pbrWarning}`);
  L.push(`    scope: ${r.pbrScope}`);
  L.push('');

  for (const p of (r.positions ?? [])) {
    L.push(`    ${String(p.label).padEnd(34)} edge ${bb(p.edgeBB).padStart(8)} bb   `
      + `captured ${eff(p.exploitationEfficiency).padStart(7)}   `
      + `exploitability ${bb(p.ownExploitabilityBB).padStart(8)}`);
    // The reasons are printed, not merely stored. A null coordinate a reader can SEE is a
    // different object from one that was never mentioned — that difference is the whole
    // reason this is a position rather than a number.
    if (p.efficiencyUnavailableReason) L.push(`      · x: ${p.efficiencyUnavailableReason}`);
    if (p.exploitabilityUnavailableReason) L.push(`      · y: ${p.exploitabilityUnavailableReason}`);
  }
  L.push('');

  const prem = r.premium;
  if (prem) {
    L.push('    EXPLOITATION PREMIUM — money that exists BECAUSE the pool is bad');
    if (prem.value === null) {
      L.push(`      NOT AVAILABLE — ${prem.reason}`);
      L.push(`      upper post ${bb(prem.upperBB)} bb, lower post — (${prem.sourceId})`);
    } else {
      L.push(`      ${bb(prem.value)} bb  =  PBR ${bb(prem.upperBB)} − Equilibrium ${bb(prem.lowerBB)}`);
    }
    L.push('');
  }

  const sweep = r.pbrSweep ?? [];
  if (sweep.length) {
    L.push('    SHRINKAGE SWEEP — how much of the ceiling is SIGNAL vs FITTED NOISE');
    L.push('    A ceiling that decays as the population model is regularized was fitted to');
    L.push('    noise. One that holds is real. Read the curve, never one point.');
    for (const s of sweep) {
      const a = s.arm;
      if (!a.n) {
        L.push(`      shrink ${String(s.shrinkWeight).padStart(4)}   no scorable decisions`);
        continue;
      }
      const ci = a.edgeCiLowBB === null ? 'CI —' : `[${bb(a.edgeCiLowBB)}, ${bb(a.edgeCiHighBB)}]`;
      L.push(`      shrink ${String(s.shrinkWeight).padStart(4)}   edge ${bb(a.edgeBB).padStart(8)} bb   `
        + `${ci.padStart(20)}   n=${String(a.n).padStart(5)}  ESS=${String(a.ess).padStart(7)}`);
    }
    L.push('');
  }
  return L;
};

/**
 * The WS-295 block (optimizer's curse).
 *
 * The unit note is printed BEFORE any number, not after. A caveat that follows the figure is a
 * caveat that gets separated from it the first time someone quotes the figure — the same
 * argument `renderPiers` makes for putting the PBR warning above the ceiling.
 */
const renderCurse = (r) => {
  const c = r.curse;
  const L = [];
  if (!c) return L;

  L.push('  OPTIMIZER\'S CURSE — is stated EV above what the advice delivers? (WS-295)');
  L.push('  ' + '─'.repeat(90));
  L.push(`    UNITS: ${c.unitNote}`);
  L.push('');

  if (!c.available) {
    L.push(`    NOT MEASURED — ${c.reason}`);
    L.push('');
    return L;
  }

  L.push(`    decisions carrying stated EV: ${c.n}` + (c.nWithoutEvStats ? `  (${c.nWithoutEvStats} without)` : ''));
  L.push(`    posterior width means: ${c.posteriorWidthMeans}`);
  L.push('');

  for (const axis of [c.vsPosteriorWidth, c.vsTopTwoMargin, c.vsActionCount]) {
    if (!axis) continue;
    L.push(`    ${axis.label}`);
    L.push(`      predicts: a ${axis.predictedSign} high-minus-low difference`);
    if (axis.strata) {
      for (const k of ['low', 'mid', 'high']) {
        const s = axis.strata[k];
        if (!s) { L.push(`      ${k.padEnd(5)} no scorable decisions`); continue; }
        L.push(`      ${k.padEnd(5)} ${axis.covariate.split('.').pop()} `
          + `${s.covariateMean.toFixed(3).padStart(9)}  edge ${bb(s.edgeBB).padStart(8)} bb  `
          + `n=${String(s.n).padStart(4)}  ESS=${String(s.ess).padStart(7)} (${pct(s.essShare)})  `
          + `clipped ${pct(s.clippedShare)}`);
      }
    }
    L.push(`      ${axis.verdict}: ${axis.detail}`);
    L.push('');
  }

  L.push(`    ${c.liveTransfer}`);
  L.push('');
  return L;
};

export const renderHeroEvReport = (r) => {
  const L = [];
  L.push('');
  L.push('═'.repeat(94));
  L.push('  HERO-EV — does the engine\'s ADVICE make money?');
  L.push('═'.repeat(94));
  L.push('');
  L.push(`  TREATMENT: ${r.treatment}`);
  L.push('  Read as: "take our advice at this ONE decision, then the hand plays on as it actually did."');
  L.push('');
  // UNITS, stated precisely: the outcome attached to a decision is the whole HAND's
  // net for hero, so the estimand is expected hand value, evaluated at the decision
  // level — not a per-decision increment. A hand with a 30bb swing contributes ±30 to
  // every decision it contains, which is why these magnitudes are hand-scale. Reading
  // them as a winrate would overstate them by roughly the decisions-per-hand factor.
  L.push('  EDGE vs population-typical play — bb per HAND, attributed at the decision level');
  L.push('  ' + '─'.repeat(90));
  for (const key of ['engineRaked', 'engineUnraked', 'passive', 'liveShifted', 'populationControl']) {
    L.push(renderArm(r.arms[key]));
  }
  if (r.arms.pbr) L.push(renderArm(r.arms.pbr));
  L.push('');

  // WS-428 — both factors first, product second, population inline (HC-011).
  if (r.overallEv) L.push(...renderOverallEvLines(r.overallEv));

  L.push(...renderPiers(r));

  L.push(...renderCurse(r));

  const h = r.arms.engineRaked;
  L.push('  WEIGHT DIAGNOSTICS (headline arm)');
  L.push('  ' + '─'.repeat(90));
  if (!h.n) {
    L.push('    No decisions were scored. Everything below is vacuous — see INTEGRITY for why.');
  } else {
    L.push(`    decisions ${h.n}   players ${h.players}   effective sample ${h.ess} (${pct(h.essShare)} of n)`);
    L.push(`    mean weight ${h.meanWeight}   clipped at ${h.weightCap}: ${pct(h.clippedShare)}`);
    L.push(`    plain IPS ${bb(h.valueOursPlainIpsBB)} bb vs self-normalized ${bb(h.valueOursBB)} bb`);
    if (Object.keys(h.skipped || {}).length) L.push(`    unscorable: ${JSON.stringify(h.skipped)}`);
  }
  L.push('');

  // The control is only meaningful once something was scored; an empty run must not
  // print a scary failure banner for a condition it never tested.
  const ctrl = r.arms.populationControl;
  if (ctrl.n) {
    const ctrlOk = ctrl.edgeBB !== null && Math.abs(ctrl.edgeBB) < 1e-6;
    L.push(`  CONTROL ${ctrlOk ? 'OK' : '*** FAILED ***'} — population-typical scored against itself: edge ${bb(ctrl.edgeBB)} bb`);
    if (!ctrlOk) {
      L.push('    The control must be exactly zero. It is not, so the estimator is producing');
      L.push('    signal from nothing and NO figure above is trustworthy.');
    }
  } else {
    L.push('  CONTROL NOT RUN — no decisions were scored.');
  }
  L.push('');

  L.push('  GATE C3');
  L.push('  ' + '─'.repeat(90));
  L.push(`    corpus arm        edge ${bb(r.gate.heroEvEdge)} bb, CI low ${bb(r.gate.heroEvCiLow)}  →  ${r.gate.corpusArmPasses ? 'PASS' : 'FAIL'}`);
  L.push(`    live-shifted arm  CI low ${bb(r.arms.liveShifted.edgeCiLowBB)}  →  ${r.gate.liveShiftedArmPasses ? 'PASS' : 'FAIL'}`);
  // WS-435: the MDE prints ALWAYS, not only on a null — a pass needs its resolution stated
  // as much as a null needs its excuse examined.
  const hl = r.arms.engineRaked;
  if (hl?.mdeDetectBB !== null && hl?.mdeDetectBB !== undefined) {
    const target = r.preflight?.targetEffectBB;
    L.push(`    min detectable effect (this run): detect ${bb(hl.mdeDetectBB)} bb · 80% power ${bb(hl.mdePower80BB)} bb`
      + (target !== undefined && target !== null ? `  (targeted effect: ${bb(target)} bb)` : ''));
    const straddles = hl.edgeCiLowBB !== null && hl.edgeCiLowBB <= 0 && hl.edgeCiHighBB >= 0;
    if (straddles) {
      L.push(`    NULL RESULT — this instrument could not resolve effects smaller than ${bb(hl.mdePower80BB)} bb`);
      L.push('    (80% power). A smaller real effect and no effect print identically here;');
      L.push('    the separator is POWER, not sample size.');
    }
  }

  const adm = r.admissibility;
  if (adm && !adm.admissible) {
    // The arithmetic verdict is shown, then explicitly overruled. Printing a bare FAIL
    // would hide a positive trend; printing a bare PASS would licence quoting a number the
    // sample cannot support. Say both, in that order.
    L.push('');
    L.push(`    *** NOT ADMISSIBLE — C3 CANNOT PASS FROM THIS RUN ***`);
    L.push(`    (the two arms above would${adm && r.gate.armsWouldPass ? '' : ' not'} pass on CI sign alone; that is not sufficient)`);
    for (const b of adm.blockers) L.push(`      - ${b.code}: ${b.detail}`);
    L.push(`    contributing players ${adm.clusters} (bar: ${adm.minClustersForCI})`);
    L.push(`    C3: FAIL (inadmissible)`);
  } else {
    L.push(`    contributing players ${adm ? adm.clusters : '—'} (bar: ${adm ? adm.minClustersForCI : '—'})`);
    L.push(`    C3: ${r.gate.c3Passes ? 'PASS' : 'FAIL'}`);
  }
  for (const w of (adm?.warnings ?? [])) L.push(`      ! ${w.code}: ${w.detail}`);
  L.push('');

  const c = r.generatedFrom.counters;
  L.push('  INTEGRITY');
  L.push('  ' + '─'.repeat(90));
  L.push(`    eval players ${c.evalPlayers}, hands read ${c.handsRead}, checkpoints ${c.checkpoints}`);
  // WS-433 AC3/AC4 — the power ledger. `n` alone invites the assumption that power scaled
  // with it; it did not — the cluster bootstrap resamples PLAYERS, so contributing players
  // is the power figure, and qualifying players is the supply ceiling behind it.
  if (c.qualifyingPlayers !== undefined) {
    L.push(`    player supply: ${c.qualifyingPlayers} qualifying → ${c.plannedPlayers} planned → `
      + `${c.contributingPlayers} contributing (power lever is --max-players; --max-decisions is a ceiling)`);
    if (c.playerTaskErrors > 0) L.push(`    ! ${c.playerTaskErrors} player task(s) failed and were skipped`);
  }
  // WS-504 — WHICH corpus directories this sample actually came from. Printed unconditionally
  // when known, not only on collapse: a reader who has to go looking for the composition is
  // the reader who quoted `handhq-allsites-50NLH-1c560bcc` for months without noticing it was
  // 300 of 300 Full Tilt files.
  if (adm?.sampleComposition) {
    L.push(`    realised corpus composition: ${JSON.stringify(adm.sampleComposition)}`
      + ` [file selection: ${r.generatedFrom.config?.fileSelection ?? r.generatedFrom.replicationStamp?.fileSelection?.strategy ?? '—'}`
      + `, player selection: ${r.generatedFrom.config?.playerSelection ?? '—'}]`);
  }
  // WS-435 — what the pre-flight gate predicted and decided, beside what the run delivered.
  if (r.preflight) {
    const pf = r.preflight;
    L.push(`    pre-flight MDE: predicted 80%-power ${bb(pf.mdePower80BB)} bb at ${pf.plannedPlayers} planned players `
      + `vs target ${bb(pf.targetEffectBB)} bb → ${pf.resolvable ? 'resolvable' : 'NOT resolvable'}`
      + (pf.overrideReason ? ` (OVERRIDDEN: ${pf.overrideReason})` : ''));
    if (pf.basis) L.push(`      basis: ${pf.basis.players} players, ${pf.basis.file ?? 'ledger entry'}`);
    const fl = Object.entries(pf.flags ?? {}).filter(([, v]) => v === true).map(([k]) => k);
    if (fl.length) L.push(`      ! preflight flags: ${fl.join(', ')}`);
  }
  L.push(`    behaviour policy: ${r.generatedFrom.integrity.behaviorPolicy.observations} pool decisions from ` +
         `${r.generatedFrom.integrity.behaviorPolicy.players} POOL players (${r.generatedFrom.integrity.behaviorPolicy.partition})`);
  L.push(`    walk-forward assertions: ${r.generatedFrom.integrity.decisionsChecked ?? '—'}`);
  if (Object.keys(c.outcomeUnresolved || {}).length) L.push(`    outcomes unresolved: ${JSON.stringify(c.outcomeUnresolved)}`);
  if (Object.keys(c.policySkips || {}).length) L.push(`    policy skips: ${JSON.stringify(c.policySkips)}`);
  // Read, not merely captured. A ceiling scored on FEWER decisions than the engine arm is a
  // biased comparison — `exploitationEfficiency` would be a ratio over two different decision
  // sets — so the count that would reveal it has to reach the page.
  if (Object.keys(c.pbrSkips || {}).length) L.push(`    PBR skips: ${JSON.stringify(c.pbrSkips)}`);
  if (r.integrity?.pbr || r.generatedFrom.integrity?.pbr) {
    const p = r.generatedFrom.integrity.pbr;
    L.push(`    PBR: ${p.surfaceId} fit on ${p.fitPartition}, evaluated on ${p.evaluatedOn} `
      + `(held out: ${p.heldOut}, poolPct ${p.poolPct})`);
  }
  if (r.depthReached && Object.keys(r.depthReached.hist).length) {
    const parts = Object.entries(r.depthReached.hist)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([depth, n]) => `depth ${depth}: ${n}`);
    // WS-432: the budget-bound share travels beside the depth histogram — the two together
    // say how deep the engine got AND whether the budget was what stopped it.
    const bb = r.budgetBound ?? { bound: 0, notBound: 0, absent: 0 };
    const bbKnown = bb.bound + bb.notBound;
    const bbNote = bbKnown > 0
      ? ` · budget-bound: ${bb.bound}/${bbKnown} (${(100 * bb.bound / bbKnown).toFixed(1)}%)`
      : '';
    L.push(`    depth reached (primary arm, per decision): ${parts.join(', ')}`
      + `${r.depthReached.absent ? ` (no evStats: ${r.depthReached.absent})` : ''}${bbNote}`);
  }
  L.push(`    rake: ${r.generatedFrom.config.rakeConfig ? JSON.stringify(r.generatedFrom.config.rakeConfig) + ' (MODELLED — corpus records none)' : 'none'}`);
  L.push(`    runtime ${((r.generatedFrom.runtimeMs ?? 0) / 1000).toFixed(1)}s`);
  L.push('  STANDARD OF RECORD (ADR-009)');
  L.push('  ' + '─'.repeat(90));
  if (r.resultCard) {
    const m = r.resultCard.manifest;
    L.push(`    Result Card ${r.resultCard.resultCardId}`);
    L.push(`    engine ${m.engineCommit.slice(0, 12)}${m.engineDirty ? ' (DIRTY TREE — the commit does not identify the code that ran)' : ''}`);
    L.push(`    deal book ${r.resultCard.match.dealBookId} ${m.dealBookHash.slice(0, 20)}…`);
    L.push(`    cluster unit ${r.resultCard.clusterUnit}   seeds ${JSON.stringify(m.seeds)}`);
    if (m.unseededSources.length) {
      L.push(`    NOT bit-reproducible — ${m.unseededSources.length} unseeded source(s):`);
      for (const s of m.unseededSources) L.push(`      - ${s.source} (${s.mechanism})`);
    }
  } else {
    L.push('    *** NO RESULT CARD — this figure is not replicable and must not be quoted ***');
    for (const p of (r.resultCardProblems ?? [])) L.push(`      - ${p}`);
  }
  L.push('');
  L.push('─'.repeat(94));
  L.push('  ' + r.caveat);
  L.push('═'.repeat(94));
  return L.join('\n');
};
