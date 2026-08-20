#!/usr/bin/env node
/**
 * probe-ess-scaling.mjs — WS-596. Is the residual bias FINITE-SAMPLE or ASYMPTOTIC?
 *
 * WHY THIS EXISTS. WS-596 localizes the surviving estimator defect to effective sample
 * size: r(ESS share, support-matched edge) = -0.95 across eight arms, and names the
 * mechanism as "self-normalized IPS finite-sample bias". That naming is load-bearing --
 * it is the whole argument for building a doubly-robust estimator with an outcome model,
 * which carries a leakage question and a Q-function that does not exist yet.
 *
 * IT IS ALSO TESTABLE, AND CHEAPLY. The two candidate mechanisms differ in exactly one
 * observable way:
 *
 *   H_A  SNIS FINITE-SAMPLE BIAS.  bias ~ (1/n)[V*Var(w)/mu_w^2 - Cov(w,R)/mu_w], which
 *        is O(1/n) at a FIXED weight distribution. Shrink n and the bias GROWS in
 *        proportion. Quartering n roughly quadruples it.
 *
 *   H_B  ASYMPTOTIC BIAS.  A misspecified behaviour policy pi_pool biases IPS by an
 *        amount that does NOT vanish with n. It scales with how far the target policy
 *        sits from the behaviour policy -- i.e. with weight concentration -- but it is a
 *        POPULATION quantity. Shrink n and the point estimate is unchanged; only the
 *        interval widens.
 *
 * THE SEPARATOR IS THE SCALE-FREEDOM OF THE PREDICTOR, AND THE EXISTING DATA ALREADY
 * LEANS. Fitted on the eight real arms of out/calibration-ws546.json (clone-the-pool and
 * the never-fired call-every-large-bet excluded):
 *
 *     r(ESS/nSupport, edge) = -0.985     <- a SHARE. scale-free. H_B's shape.
 *     r(1/ESS       , edge) = +0.879     <- the reciprocal. H_A's shape. R^2 = 0.77
 *
 * A share fitting better than a reciprocal is H_B's signature, but over a 4x range with
 * only four independent arm families that is suggestive and not decisive. This probe makes
 * it decisive by MOVING n directly.
 *
 * METHOD. One pass of the ordinary hero-EV pipeline, then the identical scored rows are
 * subsampled AT THE CLUSTER (player) LEVEL to 50% and 25%. Player-level subsampling is what
 * keeps the weight distribution fixed: it removes whole players, so the per-row weights and
 * their concentration are untouched while n and ESS fall in proportion. Row-level
 * subsampling would not do this -- it would also thin the within-player correlation
 * structure and change what the bootstrap is resampling.
 *
 * PRE-REGISTERED, BEFORE THE RUN (WS-596, 2026-08-20):
 *   PREDICTION: H_B. The edge at 25% sits inside the 100% run's bootstrap interval.
 *   FALSIFIER : if |edge(25%) - edge(100%)| exceeds the 100% run's CI HALF-WIDTH, H_B is
 *               refuted, the bias is finite-sample, and WS-596's brief stands as written.
 *
 * WHAT EACH OUTCOME MEANS FOR WHAT GETS BUILT. Recorded here so the reading cannot be
 * chosen after the fact:
 *   H_A confirmed -> the doubly-robust outcome model is the critical path, and a
 *                    bias-corrected SNIS is the cheap arm to run beside it.
 *   H_B confirmed -> pi_pool is the suspect. An outcome model still helps (DR is
 *                    consistent if EITHER model is right) but propensity calibration
 *                    becomes the FIRST measurement, and the accept criteria change:
 *                    driving |r| to zero by correcting a finite-sample term cannot work on
 *                    a bias that does not have one.
 *
 * USAGE (same corpus slice as the WS-546 calibration run):
 *   node scripts/backtest/probe-ess-scaling.mjs --behavior-policy out/behavior-policy.json \
 *     --stakes 50NLH --max-files 200 --max-players 500 --max-decisions 2500 --workers 16 \
 *     --out out/ess-scaling-ws596.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openLoader } from './loader.mjs';
import { REFERENCE_DISABLED } from './leakageGuard.mjs';

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

/** Same LCG as ipsEstimator's bootstrap, for the same reason: the probe must replicate. */
const lcg = (seed) => {
  let state = seed >>> 0;
  return (mod) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return Math.floor((state / 0x100000000) * mod);
  };
};

/** Keep a deterministic random SHARE of whole players. */
const subsamplePlayers = (rows, share, seed) => {
  if (share >= 1) return rows;
  const ids = [...new Set(rows.map((r) => r.playerId))].sort();
  const next = lcg(seed);
  const shuffled = ids.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = next(i + 1);
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  const keepCount = Math.max(2, Math.ceil(share * ids.length));
  const keep = new Set(shuffled.slice(0, keepCount));
  return rows.filter((r) => keep.has(r.playerId));
};

const main = async () => {
  const args = parseArgs(process.argv);
  const loader = await openLoader();
  const { estimateEdge } = await loader.load('/scripts/backtest/ipsEstimator.mjs');
  const { runHeroEv } = await loader.load('/scripts/backtest/heroEvRunner.mjs');
  const corpusFiles = await loader.load('/scripts/backtest/corpusFiles.mjs');
  const { loadCalibrationArms } = await loader.load('/scripts/backtest/ladder/calibrationArms.mjs');

  const set = await loadCalibrationArms();
  const arms = set.map((s) => s.arm);
  const behaviorPolicy = JSON.parse(readFileSync(String(args['behavior-policy']), 'utf8'));

  let files = await corpusFiles.discoverCorpusFiles({
    root: typeof args['corpus-root'] === 'string' ? args['corpus-root'] : corpusFiles.DEFAULT_CORPUS_ROOT,
    sites: list(args.sites),
    stakes: list(args.stakes),
  });
  ({ files } = corpusFiles.applyFileCap(files, { maxFiles: int(args['max-files'], Infinity) }));
  if (files.length === 0) { console.error('No corpus files matched.'); process.exit(2); }

  const weightCap = num(args['weight-cap'], 20);
  const SHARES = [1, 0.75, 0.5, 0.25];
  const SEED = 0x5eed596;
  // ── WHY MANY DRAWS PER SHARE, AND NOT ONE ──
  // The first cut of this probe took ONE subsample per share and compared point estimates.
  // That measures the edge for one particular subset of players, and at 25% (117 clusters)
  // its sampling error is the same size as the effect being hunted -- the 50% draw came in
  // ABOVE the full sample and the 25% draw came in near zero, which is noise wearing the
  // shape of a trend. The bias theory is a claim about E[edge | n], so the estimator of
  // E[edge | n] has to be a MEAN OVER DRAWS. The spread across draws is then the honest
  // uncertainty on it, and it needs no bootstrap of its own.
  const DRAWS = int(args.draws, 12);

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
    log: (m) => console.log(`  ${m}`),
  });

  const d = run.decisions;
  const results = {};

  for (const arm of arms) {
    const all = d.filter((x) => x.piOursByArm && x.piOursByArm[arm.id])
      .map((x) => ({ ...x, piOurs: x.piOursByArm[arm.id] }));
    if (!all.length) { results[arm.id] = { note: 'no rows' }; continue; }
    const byShare = {};
    for (const share of SHARES) {
      const draws = share >= 1 ? 1 : DRAWS;
      const edges = [];
      const ns = [];
      const essShares = [];
      let e = null;
      for (let r = 0; r < draws; r++) {
        // A DIFFERENT seed per draw. Same seed every draw would return the same subset
        // `draws` times and report its spread as zero.
        const rows = subsamplePlayers(all, share, (SEED + r * 0x9e3779b9) >>> 0);
        const ei = estimateEdge(rows, {
          weightCap,
          label: `${arm.id}@${share}#${r}`,
          // The across-draw spread is the uncertainty here, so the per-draw bootstrap is
          // only kept alive enough to satisfy the estimator's own contract.
          resamples: share >= 1 ? undefined : 50,
        });
        if (ei.edgeBBSupportMatched !== null) edges.push(ei.edgeBBSupportMatched);
        ns.push(ei.n);
        essShares.push(ei.essShare);
        if (r === 0) e = ei;
      }
      const mean = edges.length ? edges.reduce((x, y) => x + y, 0) / edges.length : null;
      const sd = edges.length > 1
        ? Math.sqrt(edges.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / (edges.length - 1))
        : 0;
      byShare[String(share)] = {
        draws,
        edgeMeanOverDraws: mean === null ? null : Number(mean.toFixed(4)),
        edgeSdOverDraws: Number(sd.toFixed(4)),
        edgeSeOfMean: edges.length ? Number((sd / Math.sqrt(edges.length)).toFixed(4)) : null,
        nMean: Number((ns.reduce((x, y) => x + y, 0) / ns.length).toFixed(1)),
        essShareMean: Number((essShares.reduce((x, y) => x + y, 0) / essShares.length).toFixed(4)),
        n: e.n,
        clusters: e.clusters,
        ess: e.ess,
        essShare: e.essShare,
        supportN: e.supportN,
        supportShare: e.supportShare,
        essOverSupport: e.supportN ? Number((e.ess / e.supportN).toFixed(4)) : null,
        edgeBB: e.edgeBB,
        edgeBBSupportMatched: e.edgeBBSupportMatched,
        ciLo: e.edgeSupportCiLowBB,
        ciHi: e.edgeSupportCiHighBB,
        meanWeight: e.meanWeight,
        clippedShare: e.clippedShare,
      };
    }
    const base = byShare['1'];
    const quarter = byShare['0.25'];

    // ── THE TEST IS SIGNED, AND THE FIRST CUT OF THIS PROBE GOT THAT WRONG ──
    // It compared |drift| against a CI half-width and labelled any excess "FINITE-SAMPLE".
    // That is not a test of H_A. H_A predicts a SPECIFIC SIGN: shrink n at a fixed weight
    // distribution and a finite-sample bias GROWS. An edge that moves by more than the
    // interval but moves TOWARD ZERO refutes H_A rather than confirming it, and the
    // sign-blind classifier reported exactly that case as H_A five times.
    const drift = (quarter.edgeMeanOverDraws !== null && base.edgeMeanOverDraws !== null)
      ? Number((quarter.edgeMeanOverDraws - base.edgeMeanOverDraws).toFixed(4)) : null;
    // H_A: bias ∝ 1/n, so quartering n roughly quadruples it — a drift of ~3x the base,
    // carrying the SAME SIGN as the base edge.
    const predictedIfFiniteSample = base.edgeMeanOverDraws === null ? null
      : Number((base.edgeMeanOverDraws * 3).toFixed(4));
    // Slope of edge against 1/n across every share, from the multi-draw means. H_A wants a
    // large positive slope in the direction of the base sign; H_B wants zero.
    const pts = SHARES.map((sh) => byShare[String(sh)])
      .filter((b) => b && b.edgeMeanOverDraws !== null && b.nMean > 0)
      .map((b) => [1 / b.nMean, b.edgeMeanOverDraws]);
    let slope = null;
    if (pts.length >= 2) {
      const mx = pts.reduce((a, q) => a + q[0], 0) / pts.length;
      const my = pts.reduce((a, q) => a + q[1], 0) / pts.length;
      const den = pts.reduce((a, q) => a + (q[0] - mx) * (q[0] - mx), 0);
      slope = den > 0 ? Number((pts.reduce((a, q) => a + (q[0] - mx) * (q[1] - my), 0) / den).toFixed(1)) : null;
    }
    // The uncertainty on the drift is the across-draw SE, not a bootstrap interval.
    const se = quarter.edgeSeOfMean;
    const baseSign = base.edgeMeanOverDraws === null ? 0 : Math.sign(base.edgeMeanOverDraws);
    let verdict;
    if (drift === null || se === null || base.edgeMeanOverDraws === 0) {
      verdict = 'unexamined - no signed edge to scale';
    } else if (Math.abs(drift) <= 2 * se) {
      verdict = 'H_B - E[edge] flat in n: ASYMPTOTIC';
    } else if (Math.sign(drift) === baseSign) {
      verdict = 'H_A - E[edge] grows as n shrinks, correct sign: FINITE-SAMPLE';
    } else {
      verdict = 'NEITHER - E[edge] moves TOWARD ZERO as n shrinks; H_A sign refuted';
    }
    results[arm.id] = {
      byShare,
      driftAt25pct: drift,
      seAt25pct: se,
      slopeEdgeVsInvN: slope,
      predictedDriftIfFiniteSample: predictedIfFiniteSample,
      verdict,
    };
  }

  const out = {
    probe: 'PROBE-WS-596-ESS-SCALING',
    prereg: {
      prediction: 'H_B - asymptotic. edge(25%) sits inside the 100% run bootstrap interval.',
      falsifier: 'edge(25%) - edge(100%) exceeding the 100% CI half-width refutes H_B.',
      declaredAt: '2026-08-20',
    },
    shares: SHARES,
    seed: SEED,
    decisionsScored: d.length,
    results,
  };
  const outPath = typeof args.out === 'string' ? args.out : 'out/ess-scaling-ws596.json';
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2));

  console.log('\n  ARM                          share      n  clusters   ESS%  ESS/nSup    edgeSM       CI');
  for (const [id, r] of Object.entries(results)) {
    if (!r.byShare) continue;
    for (const s of SHARES) {
      const b = r.byShare[String(s)];
      console.log(`    ${id.padEnd(28)} ${String(s).padEnd(5)} ${String(b.n).padStart(6)} ${String(b.clusters).padStart(9)} ${String(Math.round((b.essShare || 0) * 100)).padStart(5)}% ${String(b.essOverSupport).padStart(9)} ${String(b.edgeBBSupportMatched).padStart(9)}  [${b.ciLo},${b.ciHi}]`);
    }
    console.log(`    ${''.padEnd(28)} drift@25% ${String(r.driftAt25pct).padStart(8)}  vs CI half-width ${String(r.ciHalfWidthAt100pct).padStart(8)}  (finite-sample predicts ~${r.predictedDriftIfFiniteSample})  => ${r.verdict}\n`);
  }
  console.log(`  Wrote ${outPath}`);

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
