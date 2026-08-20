#!/usr/bin/env node
/**
 * probe-showdown-propensity.mjs — WS-596 (B). Does conditioning pi_pool on the REVEALED
 * holding move the estimator's asymptotic bias?
 *
 * WHY THIS EXISTS. `probe-ess-scaling.mjs` established that 81-86% of the hero-EV estimator's
 * bias SURVIVES n -> infinity, so it is not the self-normalized finite-sample bias WS-596's
 * brief names. The replacement explanation is that `pi_pool` conditions on
 * [isAgg, isIP, texture, street, posCategory, sizeBucket] and on NOTHING about the acting
 * seat's holding — while the holding drives both the action and the realized outcome, which
 * makes it an unmeasured confounder and biases IPS at every n.
 *
 * Pre-registered in `ladder/holdingConfoundPrereg.json`, which this script reads, hashes and
 * refuses to run without.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * WHAT IT CANNOT DO, DECLARED BEFORE THE RUN RATHER THAN DISCOVERED AFTER IT
 * ══════════════════════════════════════════════════════════════════════════════════════════
 *
 * 1. IT FITS pi(a | s, h, REVEALED), NOT pi(a | s, h). Hands reach showdown conditionally on
 *    the action taken (`rangeCalibrationProbe.mjs:149-164`), so the revealed subset is
 *    selected and the fitted propensity carries that selection.
 * 2. THE FOLD BRANCH IS STRUCTURALLY UNIDENTIFIABLE. A folded hand is never revealed, so
 *    `pi(fold | s, h)` cannot be estimated from showdown data at ANY n. That is what WS-527's
 *    title means by "folds included".
 * 3. IT IS NOT A CORRECTED ESTIMATE. It shows whether the bias MOVES when the holding enters
 *    the conditional. It is the evidence that justifies WS-527, never a substitute for it.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * THE LEAKAGE TRAP, AND WHY THE SPLIT IS NOT OPTIONAL
 * ══════════════════════════════════════════════════════════════════════════════════════════
 *
 * The marginal `pi_pool` is mined on the pool-train HALF, so it is out-of-sample for the rows
 * it scores. A holding-conditional REFINEMENT fitted on the same revealed rows it then scores
 * would be in-sample — and overfitting a propensity to the observed actions drives every
 * weight toward 1, which drives |edge| toward zero. That is the SAME DIRECTION as the
 * prediction, so without a split a confirmation would be unfalsifiable.
 *
 * MEASURED, first valid run: in-sample halves every dominated arm's edge (46-58%) while
 * held-out moved 2.6-4.2%. The split is doing real work, not ceremony.
 *
 * **Only the held-out arm may be read as evidence.**
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THE CARVE IS HIERARCHICAL (and the first valid run's failure that forced it)
 * ══════════════════════════════════════════════════════════════════════════════════════════
 *
 * The first valid run carved the band refinement at the FULL seven-tuple context — the
 * deepest and thinnest cell available. Median cell held **1** observation and 41.5% were
 * empty, so at `shrinkWeight = 10` the conditional came back ~91% the parent and
 * "conditioning on the holding" conditioned on almost nothing. The 2.6-4.2% movement it
 * reported is what a no-op produces, and the run could not distinguish a small effect from
 * an absent fit.
 *
 * The marginal policy already solves this and this probe was not using its solution:
 * `behaviorPolicy.mjs` shrinks through a hierarchy, every broader level priming the next as
 * its prior, with no threshold anywhere. The band refinement now does the same — BAND ALONE
 * first (pooled over every context, where the counts are in the hundreds), then progressively
 * deeper context prefixes, each shrunk toward the level above it.
 *
 * That is DEC-025 Amd 1's carving rule applied properly: a subclass grid is carved from its
 * parent, never fitted independently, and a thin cell stays near the parent instead of
 * becoming noise.
 *
 * USAGE
 *   node scripts/backtest/probe-showdown-propensity.mjs --behavior-policy out/behavior-policy.json \
 *     --stakes 50NLH --max-files 600 --max-players 2000 --max-decisions 20000 --workers 16 \
 *     --cache out/ws596-rows.json --out out/showdown-propensity-ws596.json
 *
 * `--cache` writes the annotated rows after the heavy pipeline pass and reads them back on a
 * later run. The modelling half then iterates in seconds instead of re-running the corpus —
 * which is what makes fixing a fit defect cheap enough to actually do.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { openLoader } from './loader.mjs';
import { REFERENCE_DISABLED } from './leakageGuard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PREREG_PATH = join(HERE, 'ladder', 'holdingConfoundPrereg.json');

const parseArgs = (argv) => {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const k = t.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) args[k] = true;
    else { args[k] = n; i++; }
  }
  return args;
};
const list = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : null);
const int = (v, d) => (v === undefined ? d : Number.parseInt(v, 10));
const num = (v, d) => (v === undefined ? d : Number.parseFloat(v));

/**
 * THE UPSTREAM CLASSIFIER IS BROKEN AND THIS ONE DELIBERATELY DIVERGES FROM IT.
 *
 * `rangeCalibrationProbe.mjs:144` declares
 *     strengthBand = (pct) => pct >= 0.8 ? 'strong' : pct >= 0.5 ? 'medium' : 'weak'
 * and feeds it `comboStrengthPercentile` at :636 — which returns a percentile on 0..100
 * (`handEvaluator.js:421`), not 0..1. Every revealed hand therefore lands in 'strong' and the
 * `acting.byStrength` breakdown it surfaces at :896 is degenerate.
 *
 * MEASURED HERE, which is how it was found: 628 'strong', 0 'medium', 3 'weak' on 631 reveals
 * under the inherited thresholds; 347 / 162 / 122 under the corrected ones. Zero 'medium' is
 * the signature — on a 0..100 value the [0.5, 0.8) window is nearly unreachable.
 *
 * This file implements the INTENT of those bands on the correct scale. The upstream defect is
 * filed separately and is NOT fixed here — a fix belongs with the module that owns it.
 */
const strengthBand = (pct) => (pct == null ? 'unknown' : pct >= 80 ? 'strong' : pct >= 50 ? 'medium' : 'weak');

/** Deterministic FIT/SCORE assignment. Same player always lands on the same side. */
const splitSideFor = (playerId) => (
  createHash('sha1').update(String(playerId)).digest()[0] % 2 === 0 ? 'fit' : 'score'
);

/**
 * The context dimensions the propensity conditions on, BROADEST FIRST — the same six the
 * marginal `pi_pool` uses, plus the facing action that keys its response set.
 *
 * Order matters: the carve walks these as prefixes, so a dimension placed early is one the
 * refinement commits to sooner. This mirrors `POLICY_HIERARCHY` in `behaviorPolicy.mjs`
 * rather than inventing a second ordering.
 */
const CONTEXT_DIMS = (d) => [
  d.slices?.facingAction ?? 'unknown',
  d.isAgg ?? 'unknown',
  d.isIP ?? 'unknown',
  d.slices?.texture ?? 'unknown',
  d.slices?.street ?? 'unknown',
  d.slices?.posCategory ?? 'unknown',
  d.slices?.sizeBucket ?? 'unknown',
];

/**
 * The ladder of keys for one row: band alone, then band with progressively deeper context.
 * Level 0 pools over every context and is where the counts actually live.
 */
const bandKeysFor = (d) => {
  const dims = CONTEXT_DIMS(d);
  const keys = [`b:${d._band}`];
  for (let i = 1; i <= dims.length; i++) keys.push(`b:${d._band}|${dims.slice(0, i).join('|')}`);
  return keys;
};

/** One Dirichlet shrinkage step toward a parent distribution. */
const shrinkToward = (counts, parentPi, shrinkWeight) => {
  const out = {};
  let n = 0;
  for (const a of Object.keys(parentPi)) n += counts?.[a] || 0;
  for (const a of Object.keys(parentPi)) {
    out[a] = ((counts?.[a] || 0) + shrinkWeight * parentPi[a]) / (n + shrinkWeight);
  }
  return { pi: out, cellN: n };
};

/**
 * Carve pi(a | s, band) from pi(a | s) by walking the ladder, each level priming the next.
 *
 * Returns the deepest distribution AND the count at the deepest level that actually carried
 * evidence, so a delta produced by thin cells is visible rather than inferred.
 */
const carveHierarchical = (levels, keys, parentPi, shrinkWeight) => {
  let pi = parentPi;
  let deepestN = 0;
  let levelsWithEvidence = 0;
  for (let i = 0; i < keys.length; i++) {
    const counts = levels[i]?.get(keys[i]);
    const step = shrinkToward(counts, pi, shrinkWeight);
    pi = step.pi;
    if (step.cellN > 0) { deepestN = step.cellN; levelsWithEvidence++; }
  }
  // TOTAL-VARIATION SHIFT FROM THE PARENT - the honest "did conditioning do anything" metric.
  //
  // `deepestN` is a poor power diagnostic for a HIERARCHICAL carve: it reports the count in the
  // deepest cell that happened to carry evidence, which is thin by construction even when the
  // broad levels above it are dense. What matters is whether the resulting distribution MOVED,
  // and by how much. TV distance answers that directly and needs no threshold on any cell.
  let tv = 0;
  for (const a of Object.keys(parentPi)) tv += Math.abs((pi[a] || 0) - (parentPi[a] || 0));
  return { pi, deepestN, levelsWithEvidence, tvShift: tv / 2 };
};

/**
 * Pearson r. Present because WS-596's THIRD accept criterion is stated on it:
 *
 *   "The residual correlation between ESS share and the reported edge is measured and
 *    reported. Driving |r| toward zero is the actual objective; the sign flips are a
 *    symptom of it."
 *
 * The edge reduction in this probe's headline is necessary but NOT sufficient for that
 * criterion: an estimator could shrink every arm's edge by a constant and leave the
 * ESS relationship exactly where it was. Only |r| answers what the ticket asked.
 */
const pearson = (xs, ys) => {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return (dx > 0 && dy > 0) ? Number((num / Math.sqrt(dx * dy)).toFixed(4)) : null;
};

/** Two distributions equal to the last bit — detects POOL-FALLBACK rows. */
const sameDist = (a, b) => {
  if (!a || !b) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((x) => a[x] === b[x]);
};

const main = async () => {
  const args = parseArgs(process.argv);

  let preregRaw;
  try { preregRaw = readFileSync(PREREG_PATH, 'utf8'); }
  catch { console.error(`Refusing to run: pre-registration not found at ${PREREG_PATH}`); process.exit(2); }
  const prereg = JSON.parse(preregRaw);
  const preregHash = createHash('sha256').update(preregRaw).digest('hex').slice(0, 16);
  console.log(`\n  PREREG ${prereg.id}  sha256:${preregHash}`);
  console.log(`  PREDICTION: ${prereg.primaryPrediction}`);
  console.log(`  FALSIFIER : ${prereg.falsifier}\n`);

  const loader = await openLoader();
  const { estimateEdge } = await loader.load('/scripts/backtest/ipsEstimator.mjs');
  const { loadCalibrationArms } = await loader.load('/scripts/backtest/ladder/calibrationArms.mjs');
  // ALWAYS_FOLD is NOT in the calibration SPEC — `run-calibration.mjs:76-84` adds it from
  // `strategyArm.mjs` as the one arm with a prior measurement to reproduce. The first valid
  // run of this probe omitted it for exactly that reason and lost a dominated arm silently.
  const { ALWAYS_FOLD, withModuleDescriptor } = await loader.load('/scripts/backtest/strategyArm.mjs');

  const set = await loadCalibrationArms();
  const arms = [
    ...set.map((s) => s.arm),
    await withModuleDescriptor(ALWAYS_FOLD, { modulePath: './strategyArm.mjs', exportName: 'ALWAYS_FOLD' }),
  ];

  const weightCap = num(args['weight-cap'], 20);
  const shrinkWeight = num(args['shrink-weight'], prereg.shrinkage.shrinkWeight);
  const revealFloor = num(args['reveal-floor'], prereg.revealRateFloor.value);
  const cachePath = typeof args.cache === 'string' ? args.cache : null;

  let decisions;
  let coverage = {};

  if (cachePath && existsSync(cachePath) && !args['refresh-cache']) {
    console.log(`  loading cached rows from ${cachePath}`);
    const cached = JSON.parse(readFileSync(cachePath, 'utf8'));
    decisions = cached.rows;
    coverage = cached.coverage || {};
    console.log(`  ${decisions.length} rows (cached; pass --refresh-cache to rebuild)`);
  } else {
    const { runHeroEv } = await loader.load('/scripts/backtest/heroEvRunner.mjs');
    const corpusFiles = await loader.load('/scripts/backtest/corpusFiles.mjs');
    const { iterAppHands } = await loader.load('/scripts/backtest/phhAdapter.mjs');
    const { comboStrengthPercentile } = await loader.load('/src/utils/pokerCore/handEvaluator.js');
    const behaviorPolicy = JSON.parse(readFileSync(String(args['behavior-policy']), 'utf8'));

    let files = await corpusFiles.discoverCorpusFiles({
      root: typeof args['corpus-root'] === 'string' ? args['corpus-root'] : corpusFiles.DEFAULT_CORPUS_ROOT,
      sites: list(args.sites), stakes: list(args.stakes),
    });
    ({ files } = corpusFiles.applyFileCap(files, { maxFiles: int(args['max-files'], Infinity) }));
    if (files.length === 0) { console.error('No corpus files matched.'); process.exit(2); }

    console.log(`  pass 1/2 — hero-EV pipeline over ${files.length} file(s)`);
    const run = await runHeroEv({
      files,
      reference: REFERENCE_DISABLED,
      behaviorPolicy,
      poolPct: int(args['pool-pct'], 50),
      maxPlayers: int(args['max-players'], Infinity),
      minTrainHands: int(args['min-train-hands'], 15),
      checkpointInterval: int(args['checkpoint-interval'], 10),
      maxDecisions: int(args['max-decisions'], Infinity),
      comboSamples: int(args['combo-samples'], 10),
      trials: int(args.trials, 200),
      depthArms: arms.map((a) => ({ id: a.id, strategy: a, fallback: 'pool' })),
      primaryArmId: arms[0].id,
      workers: int(args.workers, 0),
      log: (m) => console.log(`    ${m}`),
    });
    coverage = run.strategyCoverage || {};

    console.log('  pass 2/2 — showdown reveals');
    const needed = new Set(run.decisions.map((d) => d.handId));
    const revealsByHand = new Map();
    for (const f of files) {
      for await (const hand of iterAppHands(f.path, { site: f.site, stakeLabel: f.stakeLabel })) {
        if (!needed.has(hand.handId)) continue;
        const sc = hand.gameState?.showdownCards;
        if (sc && Object.keys(sc).length) revealsByHand.set(hand.handId, sc);
      }
    }

    // Keep only the columns the modelling half reads. The full record carries engine
    // by-products (piPbrBySweep, evStats) that would bloat the cache by an order of magnitude.
    decisions = run.decisions.map((d) => {
      const sc = revealsByHand.get(d.handId);
      const hole = sc?.[d.heroSeat];
      const band = (Array.isArray(hole) && hole.length >= 2 && Array.isArray(d.board) && d.board.length >= 3)
        ? strengthBand(comboStrengthPercentile(hole[0], hole[1], d.board))
        : null;
      return {
        playerId: d.playerId, handId: d.handId, heroSeat: d.heroSeat,
        observedAction: d.observedAction, netBB: d.netBB,
        isAgg: d.isAgg, isIP: d.isIP, slices: d.slices,
        piPool: d.piPool, piOursByArm: d.piOursByArm,
        _band: band, _side: band ? splitSideFor(d.playerId) : null,
      };
    });

    if (cachePath) {
      mkdirSync(dirname(cachePath), { recursive: true });
      writeFileSync(cachePath, JSON.stringify({ rows: decisions, coverage }));
      console.log(`  cached ${decisions.length} rows -> ${cachePath}`);
    }
  }

  const bandCounts = {};
  let revealed = 0;
  for (const d of decisions) if (d._band) { bandCounts[d._band] = (bandCounts[d._band] || 0) + 1; revealed++; }

  const revealedRows = decisions.filter((d) => d._band);
  const fitPlayers = new Set(revealedRows.filter((d) => d._side === 'fit').map((d) => d.playerId));
  const scorePlayers = new Set(revealedRows.filter((d) => d._side === 'score').map((d) => d.playerId));

  /** Accumulate action counts at every level of the band ladder. */
  const fitLevels = (rows) => {
    const depth = CONTEXT_DIMS(rows[0] || {}).length + 1;
    const levels = Array.from({ length: depth }, () => new Map());
    for (const d of rows) {
      const keys = bandKeysFor(d);
      for (let i = 0; i < keys.length; i++) {
        let c = levels[i].get(keys[i]);
        if (!c) levels[i].set(keys[i], (c = {}));
        c[d.observedAction] = (c[d.observedAction] || 0) + 1;
      }
    }
    return levels;
  };

  const heldOutLevels = fitLevels(revealedRows.filter((d) => d._side === 'fit'));
  const inSampleLevels = fitLevels(revealedRows);

  const withConditional = (rows, levels) => rows.map((d) => {
    const { pi, deepestN, levelsWithEvidence, tvShift } = carveHierarchical(levels, bandKeysFor(d), d.piPool, shrinkWeight);
    // A pool-fallback row has pi_ours === pi_pool BY CONSTRUCTION, so changing only the
    // denominator manufactures a weight out of a change in the ESTIMATE rather than the
    // policy. It moved clone-the-pool off exactly zero before this was handled.
    const wasFallback = sameDist(d.piOurs, d.piPool);
    return { ...d, piPool: pi, piOurs: wasFallback ? pi : d.piOurs, _cellN: deepestN, _levels: levelsWithEvidence, _tv: tvShift };
  });

  const results = {};
  for (const arm of arms) {
    const all = decisions.filter((x) => x.piOursByArm?.[arm.id])
      .map((x) => ({ ...x, piOurs: x.piOursByArm[arm.id] }));
    if (!all.length) { results[arm.id] = { verdict: 'unexamined — no rows', fired: false }; continue; }

    const scoreRows = all.filter((d) => d._band && d._side === 'score');

    // ── AN ARM THAT NEVER FIRED HAS NO VERDICT, AND `edge === 0` DOES NOT DETECT IT ──
    // Under `fallback: 'pool'` a non-covering arm gets the pool policy verbatim, so every
    // weight is 1, ESS is 100% and the edge is exactly 0.0000 — clone-the-pool wearing a
    // dominated arm's name. `run-calibration.mjs:120-135` documents this precisely, and the
    // first valid run of this probe reproduced it anyway: call-every-large-bet and
    // fold-every-small-bet returned 0 and were AVERAGED IN, pulling the reported mean from
    // 0.2278 to 0.1708. Coverage is the discriminator, not the edge.
    const firedRows = scoreRows.filter((d) => !sameDist(d.piOurs, d.piPool));
    const cov = coverage[arm.id] ?? null;

    // `clone-the-pool` is DEFINED as pi_ours === pi_pool, so "never fired" is its correct
    // behaviour and not a reason to drop it. It is the identity control this run is judged by
    // -- the pre-registration's rejection condition is stated on it -- and an earlier cut of
    // this coverage check silently excluded it, which removed the control from the run
    // entirely while every other number carried on looking fine.
    const isIdentityControl = arm.requiresFallback === 'pool' || arm.id === 'clone-the-pool';

    if (!firedRows.length && !isIdentityControl) {
      results[arm.id] = {
        verdict: 'unexamined — arm never fired on the scored subset; every row is the POOL fallback',
        fired: false,
        coveredShare: cov?.coveredShare ?? null,
        scoreRows: scoreRows.length,
      };
      continue;
    }

    // ── AND THE SECOND DOOR INTO THE SAME TRAP: FIRED, BUT WITH NO SUPPORT ──
    //
    // An arm can fire and still carry zero evidence. `always-fold` and `fold-every-small-bet`
    // put their mass on FOLD, and a folded hand is never revealed -- so on the revealed subset
    // every row where they fired has pi_ours(observed) = 0 and therefore w = 0. What survives
    // is only their POOL-FALLBACK rows, where wisValue == poolValueOverSupport and the edge is
    // EXACTLY 0.0000. Reported as a number, that reads as "no effect" and averages like a
    // measurement; it is in fact the fold-branch limit (WS-527, "folds included") showing
    // itself, and it must be named as `unexamined`.
    //
    // Measured before this check existed: both arms returned 0.0 and dragged the mean held-out
    // reduction from 53.2% to 39.9%.
    const supportedFiredRows = firedRows.filter((d) => (d.piOurs?.[d.observedAction] ?? 0) > 0);
    if (!isIdentityControl && !supportedFiredRows.length) {
      results[arm.id] = {
        verdict: 'unexamined — the arm fired but carries NO SUPPORT on the revealed subset: every row it covers has pi_ours(observed) = 0',
        fired: true,
        hasSupport: false,
        reason: 'support is the fold branch, which is never revealed at showdown — the WS-527 "folds included" limit',
        coveredShare: cov?.coveredShare ?? null,
        firedRows: firedRows.length,
        scoreRows: scoreRows.length,
      };
      continue;
    }

    const support = all.filter((d) => (d.piOurs?.[d.observedAction] ?? 0) > 0);
    const supportRevealed = support.filter((d) => d._band);
    const revealRate = support.length ? supportRevealed.length / support.length : 0;

    if (revealRate < revealFloor || scoreRows.length < 2) {
      results[arm.id] = {
        verdict: `unexamined — support reveal rate ${(revealRate * 100).toFixed(1)}% below the pre-registered floor of ${(revealFloor * 100).toFixed(0)}%`,
        fired: true,
        reason: supportRevealed.length === 0
          ? 'support is entirely fold rows, which are never revealed — the WS-527 "folds included" limit'
          : 'thin reveal',
        supportN: support.length, supportRevealedN: supportRevealed.length, revealRate: Number(revealRate.toFixed(4)),
      };
      continue;
    }

    const marginal = estimateEdge(scoreRows, { weightCap, label: `${arm.id}/marginal` });
    const heldOutRows = withConditional(scoreRows, heldOutLevels);
    const heldOut = estimateEdge(heldOutRows, { weightCap, label: `${arm.id}/held-out` });
    const inSample = estimateEdge(withConditional(scoreRows, inSampleLevels), { weightCap, label: `${arm.id}/in-sample` });

    const eM = marginal.edgeBBSupportMatched;
    const eH = heldOut.edgeBBSupportMatched;
    const eI = inSample.edgeBBSupportMatched;
    const cellNs = heldOutRows.map((d) => d._cellN).sort((a, b) => a - b);
    const lvls = heldOutRows.map((d) => d._levels);
    const tvs = heldOutRows.map((d) => d._tv).sort((a, b) => a - b);

    results[arm.id] = {
      fired: true,
      hasSupport: true,
      isIdentityControl,
      firedRows: firedRows.length,
      coveredShare: cov?.coveredShare ?? null,
      supportN: support.length, supportRevealedN: supportRevealed.length,
      revealRate: Number(revealRate.toFixed(4)), scoreRows: scoreRows.length,
      edgeMarginal: eM,
      edgeHoldingConditionalHeldOut: eH,
      edgeHoldingConditionalInSample: eI,
      absReductionHeldOut: (eM === null || eH === null) ? null : Number((Math.abs(eM) - Math.abs(eH)).toFixed(4)),
      reductionShareHeldOut: (eM ? Number(((Math.abs(eM) - Math.abs(eH)) / Math.abs(eM)).toFixed(4)) : null),
      reductionShareInSample: (eM ? Number(((Math.abs(eM) - Math.abs(eI)) / Math.abs(eM)).toFixed(4)) : null),
      leakageMagnitude: (eH === null || eI === null) ? null : Number((eI - eH).toFixed(4)),
      ciMarginal: [marginal.edgeSupportCiLowBB, marginal.edgeSupportCiHighBB],
      ciHeldOut: [heldOut.edgeSupportCiLowBB, heldOut.edgeSupportCiHighBB],
      essShareMarginal: marginal.essShare, essShareHeldOut: heldOut.essShare,
      // POWER DIAGNOSTICS. The first valid run's whole failure was invisible without these.
      cellNMedian: cellNs[Math.floor(cellNs.length / 2)] ?? null,
      cellNZeroShare: cellNs.length ? Number((cellNs.filter((x) => x === 0).length / cellNs.length).toFixed(4)) : null,
      ladderLevelsWithEvidenceMedian: lvls.sort((a, b) => a - b)[Math.floor(lvls.length / 2)] ?? null,
      // THE POWER DIAGNOSTIC. Median total-variation distance between the holding-conditional
      // propensity and the marginal it was carved from. Near zero means the conditional IS the
      // prior, and no verdict is available at any effect size.
      tvShiftMedian: tvs.length ? Number((tvs[Math.floor(tvs.length / 2)]).toFixed(4)) : null,
    };
  }

  // ONLY arms that actually fired enter the mean.
  const scored = Object.entries(results).filter(([, r]) => r.fired && r.hasSupport && !r.isIdentityControl && typeof r.absReductionHeldOut === 'number');
  const meanReduction = scored.length ? scored.reduce((a, [, r]) => a + r.absReductionHeldOut, 0) / scored.length : null;
  const meanShare = scored.length ? scored.reduce((a, [, r]) => a + r.reductionShareHeldOut, 0) / scored.length : null;
  const medianCellN = scored.length ? scored.map(([, r]) => r.cellNMedian).sort((a, b) => a - b)[Math.floor(scored.length / 2)] : null;
  const medianTv = scored.length ? scored.map(([, r]) => r.tvShiftMedian).sort((a, b) => a - b)[Math.floor(scored.length / 2)] : null;

  // ── WS-596 ACCEPT CRITERION 3: does conditioning on the holding flatten the ESS relation? ──
  //
  // The ticket's localization is r(ESS share, edge) = -0.95 and its objective is |r| -> 0. A
  // reduction in every edge does not on its own achieve that: shrink all arms by a constant and
  // the correlation is untouched. This is the criterion as written, computed on the SAME six
  // arms under both propensities, using each arm's OWN ESS share under that propensity.
  const essMarg = scored.map(([, r]) => r.essShareMarginal);
  const essHeld = scored.map(([, r]) => r.essShareHeldOut);
  const edgeMarg = scored.map(([, r]) => r.edgeMarginal);
  const edgeHeld = scored.map(([, r]) => r.edgeHoldingConditionalHeldOut);
  const rMarginal = pearson(essMarg, edgeMarg);
  const rHeldOut = pearson(essHeld, edgeHeld);
  const essCriterion = {
    criterion: 'WS-596 accept criterion 3 — residual correlation between ESS share and reported edge; the objective is |r| -> 0',
    nArms: scored.length,
    rEssVsEdgeMarginal: rMarginal,
    rEssVsEdgeHoldingConditional: rHeldOut,
    absReduction: (rMarginal === null || rHeldOut === null) ? null
      : Number((Math.abs(rMarginal) - Math.abs(rHeldOut)).toFixed(4)),
    // Six arms from FOUR independent families (never-fold, raise-everything, and their mixed
    // variants). The ticket says the same of its own eight-arm r: read it with that n, not
    // with the arm count. A correlation over six points is a direction, not an estimate.
    caveat: 'six arms from four independent families; read as direction, not as an estimate',
  };

  // The identity control is CHECKED, never skipped. If it is absent from the results the run
  // has no control and cannot return a verdict at all.
  const clone = results['clone-the-pool'];
  const cloneScored = !!clone && typeof clone.edgeHoldingConditionalHeldOut === 'number';
  const cloneHeld = cloneScored
    && clone.edgeMarginal === 0
    && clone.edgeHoldingConditionalHeldOut === 0
    && clone.edgeHoldingConditionalInSample === 0;

  // POWER GATE. Added after the first valid run reported SUPPORTED off a fit whose median
  // cell held one observation. A verdict from an unfitted conditional is not a verdict.
  // POWER FLOOR, in TOTAL-VARIATION units: the conditional must move at least this much
  // probability mass away from the marginal before any reduction it produces means anything.
  // 0.02 = two percentage points. Declared before the run, not chosen after seeing the result.
  const POWER_FLOOR = num(args['power-floor'], 0.02);
  let verdict;
  if (!cloneScored) verdict = 'NO VERDICT — the identity control (clone-the-pool) was not scored, so nothing checks the rejection condition. Fix the probe before reading anything else here.';
  else if (!scored.length) verdict = 'UNEXAMINED — no dominated arm both fired and cleared the reveal floor.';
  else if (!cloneHeld) verdict = `REJECTED — clone-the-pool did not stay at exactly zero under all three propensities (marginal ${clone.edgeMarginal}, held-out ${clone.edgeHoldingConditionalHeldOut}, in-sample ${clone.edgeHoldingConditionalInSample}). The identity is broken and the candidate is rejected regardless of what else it repaired.`;
  else if (medianTv !== null && medianTv < POWER_FLOOR) {
    verdict = `INCONCLUSIVE — the holding-conditional propensity moved only ${medianTv} in total variation from the marginal it was carved from, below the power floor of ${POWER_FLOOR}. The conditional IS essentially its own prior, so a small reduction cannot be told from an absent fit. The reported ${meanReduction?.toFixed(4)} bb (${((meanShare ?? 0) * 100).toFixed(1)}%) is NOT evidence either way.`;
  } else if (meanReduction > 0) {
    verdict = `SUPPORTED — mean |edge| reduction ${meanReduction.toFixed(4)} bb (${((meanShare ?? 0) * 100).toFixed(1)}%) held out, with the conditional moving ${medianTv} TV from the marginal (median deepest cell n = ${medianCellN}).`;
  } else {
    verdict = `FALSIFIED — mean |edge| reduction ${meanReduction.toFixed(4)} bb held out is not positive, and the conditional DID move (${medianTv} TV, above the ${POWER_FLOOR} floor) so the fit is not the excuse. Holding-confounding is NOT the mechanism; section 6 of the research doc is wrong.`;
  }

  const out = {
    probe: 'PROBE-WS-596-HOLDING-CONFOUND',
    prereg: { id: prereg.id, sha256: preregHash },
    decisionsScored: decisions.length,
    revealedRows: revealed,
    revealRateOverall: decisions.length ? Number((revealed / decisions.length).toFixed(4)) : null,
    bandDistribution: bandCounts,
    split: { fitPlayers: fitPlayers.size, scorePlayers: scorePlayers.size },
    shrinkWeight, revealFloor, powerFloor: POWER_FLOOR,
    results,
    armsScored: scored.map(([id]) => id),
    armsUnexamined: Object.entries(results).filter(([, r]) => !r.fired || r.verdict).map(([id]) => id),
    meanAbsReductionHeldOut: meanReduction === null ? null : Number(meanReduction.toFixed(4)),
    meanReductionShareHeldOut: meanShare === null ? null : Number(meanShare.toFixed(4)),
    medianCellNAcrossScoredArms: medianCellN,
    medianTvShiftAcrossScoredArms: medianTv,
    essCriterion,
    verdict,
  };

  const outPath = typeof args.out === 'string' ? args.out : 'out/showdown-propensity-ws596.json';
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2));

  console.log(`\n  reveals ${revealed}/${decisions.length} (${((revealed / decisions.length) * 100).toFixed(1)}%)   bands ${JSON.stringify(bandCounts)}`);
  console.log(`  split ${fitPlayers.size} FIT / ${scorePlayers.size} SCORE players\n`);
  console.log('  ARM                          reveal%  scoreN   marginal   held-out  in-sample   red%(HO)  red%(IS)  cellN');
  for (const [id, r] of Object.entries(results)) {
    if (!r.fired || r.verdict) { console.log(`    ${id.padEnd(28)} ${r.verdict}`); continue; }
    console.log(`    ${id.padEnd(28)} ${String((r.revealRate * 100).toFixed(1)).padStart(6)}% ${String(r.scoreRows).padStart(7)} ${String(r.edgeMarginal).padStart(10)} ${String(r.edgeHoldingConditionalHeldOut).padStart(10)} ${String(r.edgeHoldingConditionalInSample).padStart(10)} ${String(((r.reductionShareHeldOut ?? 0) * 100).toFixed(1)).padStart(9)} ${String(((r.reductionShareInSample ?? 0) * 100).toFixed(1)).padStart(9)} ${String(r.cellNMedian).padStart(6)}`);
  }
  console.log(`\n  ACCEPT CRITERION 3 — r(ESS share, edge) over ${essCriterion.nArms} arms:`);
  console.log(`    marginal propensity            r = ${essCriterion.rEssVsEdgeMarginal}`);
  console.log(`    holding-conditional (held out) r = ${essCriterion.rEssVsEdgeHoldingConditional}`);
  console.log(`    |r| reduction                    = ${essCriterion.absReduction}   (objective: |r| -> 0)`);
  console.log(`    ${essCriterion.caveat}`);
  console.log(`\n  VERDICT: ${verdict}`);
  console.log(`  Wrote ${outPath}\n`);

  // ── CLOSE THE LOADER, OR THIS PROCESS NEVER EXITS ──
  //
  // `openLoader` stands up a SERVER (loader.mjs:28-42) and hands back a `close()`. Without it
  // the event loop stays alive after the last line runs, so the script finishes its work,
  // writes its output, prints its summary -- and then hangs until something kills it.
  //
  // MEASURED 2026-08-20: every run of this file completed, wrote its JSON, and was then
  // reported as `killed` by the harness ten minutes later. The compute was never the problem.
  // `run-hero-ev.mjs:575` has always done this; the probes did not, which is why an unattended
  // invocation of one looks like a timeout instead of a success.
  await loader.close();
};

main().catch((e) => { console.error(e); process.exit(1); });
