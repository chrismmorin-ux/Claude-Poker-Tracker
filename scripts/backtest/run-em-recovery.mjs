#!/usr/bin/env node
/**
 * run-em-recovery.mjs — WS-526 / F1. Runs every arm and emits the Result Card.
 *
 * The pre-registration (emRecoveryPrereg.json) is READ, HASHED, and stamped into the card.
 * This script REFUSES TO RUN WITHOUT IT — same mechanism `measureBoth` uses in
 * divergence.js, and for the same reason: computing several things and then reporting
 * whichever agreed with the prior belief is indistinguishable, in the output, from having
 * chosen honestly.
 *
 * Arms, in the order they must be read:
 *
 *   CONTROLS FIRST — the hidden arm is uninterpretable until these pass.
 *     leak      structural audit that no folded hand carries a trajectory
 *     oracle    all holdings revealed; MUST recover to ~0 or the EM/scorer is broken
 *     mismatch  fitted policy scored against a DIFFERENT truth; MUST fail, or the metric
 *               cannot detect a wrong answer
 *
 *   THE ARM UNDER TEST
 *     hidden-exact   zero sampling noise; failure here is NON-IDENTIFICATION
 *     hidden-sweep   pre-registered N sweep; error must DECAY
 *     ridge          multi-start; equal likelihood at different parameters = non-identified
 *
 *   STRESS — the case chosen by the author is the one most likely to flatter the claim,
 *   so the claim is re-tested on cases the author did not choose.
 *     random-policies  200 randomly drawn truths; worst case reported, not the mean
 *     degenerate       a class that folds 100% and therefore NEVER reveals
 *     identity-T       no class migration across streets — strictly less information
 *     wrong-T          estimator given a WRONG transition matrix; must DEGRADE, proving the
 *                      declared assumption is load-bearing rather than decorative
 *     wider-K          5 and 8 hand classes; does identification survive more parameters
 *
 * Usage: node scripts/backtest/run-em-recovery.mjs [--out out/em-recovery.json] [--quick]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as em from './emRecovery.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PREREG_PATH = join(HERE, 'emRecoveryPrereg.json');

const argv = process.argv.slice(2);
const flag = (name, dflt = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? (argv[i + 1] ?? true) : dflt;
};
const QUICK = argv.includes('--quick');

// ─── pre-registration gate ────────────────────────────────────────────────────
let preregRaw;
try {
  preregRaw = readFileSync(PREREG_PATH, 'utf8');
} catch {
  console.error(`REFUSED: pre-registration not found at ${PREREG_PATH}.\n`
    + 'This run declares a falsifier before it sees a result. Without the declaration there is\n'
    + 'nothing to falsify and the output would be a description, not a test.');
  process.exit(2);
}
const prereg = JSON.parse(preregRaw);
const preregHash = createHash('sha256').update(preregRaw).digest('hex');
const TOL = prereg.tolerance;

const log = (...a) => console.log(...a);
const fx = (x, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const ex = (x) => (Number.isFinite(x) ? x.toExponential(3) : String(x));

log('');
log('═══ WS-526 / F1 — fold-branch recoverability ═══');
log(`pre-registration ${prereg.id}  sha256:${preregHash.slice(0, 16)}  tolerance=${TOL}`);
log('');

const results = {};

// ─── CONTROL: leak audit ──────────────────────────────────────────────────────
{
  const h = em.exactHistogram(em.TRUE_POLICY);
  let foldedKeys = 0; let leaked = 0; let hiddenMass = 0; let total = 0;
  for (const [k, v] of h.hist) {
    const [acts, traj] = k.split('|');
    total += v;
    if (traj === '-') hiddenMass += v;
    if (acts.split(',').includes('fold')) { foldedKeys++; if (traj !== '-') leaked++; }
  }
  results.leak = {
    foldedObservationTypes: foldedKeys,
    typesCarryingTrajectory: leaked,
    unrevealedMassShare: hiddenMass / total,
    pass: leaked === 0,
  };
  log(`CONTROL leak      folded types=${foldedKeys} carrying trajectory=${leaked}  `
    + `unrevealed=${fx(results.leak.unrevealedMassShare * 100, 2)}% -> ${leaked === 0 ? 'NO LEAK' : '*** LEAKING ***'}`);
}

// ─── CONTROL: oracle ──────────────────────────────────────────────────────────
{
  const h = em.exactHistogram(em.TRUE_POLICY, { oracle: true });
  const fit = em.fitEM(h.hist, { seed: 0 });
  const sc = em.scoreRecovery(fit.policy);
  results.oracle = {
    maxFoldBranchAbsError: sc.maxFoldBranchAbsError,
    maxContinueBranchAbsError: sc.maxContinueBranchAbsError,
    iterations: fit.iterations,
    pass: sc.maxFoldBranchAbsError < 0.005,
  };
  log(`CONTROL oracle    maxFold=${ex(sc.maxFoldBranchAbsError)} iters=${fit.iterations} -> `
    + `${results.oracle.pass ? 'OK' : '*** ORACLE FAILED — instrument defect ***'}`);
}

// ─── ARM: hidden, exact ───────────────────────────────────────────────────────
let hiddenExactFit = null;
{
  const h = em.exactHistogram(em.TRUE_POLICY);
  const fit = em.fitEM(h.hist, { seed: 0 });
  hiddenExactFit = fit;
  const sc = em.scoreRecovery(fit.policy);
  results.hiddenExact = {
    maxFoldBranchAbsError: sc.maxFoldBranchAbsError,
    rmseFoldBranch: sc.rmseFoldBranch,
    maxContinueBranchAbsError: sc.maxContinueBranchAbsError,
    showdownRate: h.showdownRate,
    iterations: fit.iterations,
    converged: fit.converged,
    cells: sc.cells,
    postHoc: true,
    postHocNote: 'Exact arm added after pre-registration. Strictly stricter than headlineN: '
      + 'zero sampling noise, so failure here is non-identification.',
  };
  log(`ARM     hidden-exact  maxFold=${ex(sc.maxFoldBranchAbsError)} `
    + `maxCont=${ex(sc.maxContinueBranchAbsError)} showdownRate=${fx(h.showdownRate, 4)} `
    + `iters=${fit.iterations} converged=${fit.converged}`
    + `${fit.converged ? '' : '  <-- STALLED, treat the number as an upper bound'}`);
}

// ─── CONTROL: mismatch ────────────────────────────────────────────────────────
{
  const sc = em.scoreRecovery(hiddenExactFit.policy, em.DECOY_POLICY);
  results.mismatch = {
    maxFoldBranchAbsError: sc.maxFoldBranchAbsError,
    pass: sc.maxFoldBranchAbsError > TOL,
  };
  log(`CONTROL mismatch  maxFold vs decoy=${fx(sc.maxFoldBranchAbsError)} -> `
    + `${sc.maxFoldBranchAbsError > TOL ? 'OK (metric can detect a wrong answer)' : '*** CONTROL FAILED ***'}`);
}

// ─── ARM: ridge detection ─────────────────────────────────────────────────────
{
  const h = em.exactHistogram(em.TRUE_POLICY);
  const r = em.detectRidge(h.hist, { starts: QUICK ? 8 : 24 });
  results.ridge = {
    starts: r.starts,
    startsAtBestLogLik: r.startsAtBestLL,
    maxParamSpreadAtEqualLL: r.maxParamSpreadAtEqualLL,
    ridgeDetected: r.ridgeDetected,
  };
  log(`ARM     ridge      starts=${r.starts} atBestLL=${r.startsAtBestLL} `
    + `spread=${ex(r.maxParamSpreadAtEqualLL)} -> ${r.ridgeDetected ? '*** RIDGE: NON-IDENTIFIED ***' : 'no ridge'}`);
}

// ─── ARM: pre-registered N sweep ──────────────────────────────────────────────
{
  const sweep = QUICK ? [20000, 200000] : prereg.nSweep;
  results.sweep = [];
  for (const N of sweep) {
    const h = em.sampleHistogram(N, em.TRUE_POLICY, 12345);
    const fit = em.fitEM(h.hist, { seed: 0 });
    const sc = em.scoreRecovery(fit.policy);
    results.sweep.push({
      N,
      maxFoldBranchAbsError: sc.maxFoldBranchAbsError,
      rmseFoldBranch: sc.rmseFoldBranch,
      maxContinueBranchAbsError: sc.maxContinueBranchAbsError,
      showdownRate: h.showdownRate,
    });
    log(`ARM     sweep N=${String(N).padStart(8)}  maxFold=${fx(sc.maxFoldBranchAbsError, 5)} `
      + `rmseFold=${fx(sc.rmseFoldBranch, 5)} maxCont=${fx(sc.maxContinueBranchAbsError, 5)}`);
  }
  const errs = results.sweep.map((s) => s.maxFoldBranchAbsError);
  results.sweepDecays = errs.every((e, i) => i === 0 || e <= errs[i - 1] * 1.05);
  log(`        sweep decays: ${results.sweepDecays}`);
}

// ─── STRESS: 200 random truths ────────────────────────────────────────────────
{
  const n = QUICK ? 25 : 200;
  const rng = em.mulberry32(99);
  let worst = 0; let worstIdx = -1; let sum = 0; let ridges = 0;
  for (let i = 0; i < n; i++) {
    const pol = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => {
      const v = [rng(), rng(), rng()];
      const s = v[0] + v[1] + v[2];
      return { fold: v[0] / s, call: v[1] / s, raise: v[2] / s };
    }));
    const h = em.exactHistogram(pol);
    const fit = em.fitEM(h.hist, { seed: 0 });
    const sc = em.scoreRecovery(fit.policy, pol);
    sum += sc.maxFoldBranchAbsError;
    if (sc.maxFoldBranchAbsError > worst) { worst = sc.maxFoldBranchAbsError; worstIdx = i; }
    if (sc.maxFoldBranchAbsError > TOL) ridges++;
  }
  results.randomPolicies = {
    n, worstMaxFoldAbsError: worst, worstIndex: worstIdx, meanMaxFoldAbsError: sum / n,
    overTolerance: ridges, pass: worst <= TOL,
  };
  log(`STRESS  random-policies n=${n} worst=${ex(worst)} mean=${ex(sum / n)} overTol=${ridges} -> `
    + `${worst <= TOL ? 'OK' : '*** WORST CASE EXCEEDS TOLERANCE ***'}`);
}

// ─── STRESS: degenerate — a class that never reveals ──────────────────────────
{
  const pol = em.TRUE_POLICY.map((st, t) => st.map((c, h) => (
    (t === 0 && h === 2) ? { fold: 1.0, call: 0.0, raise: 0.0 } : { ...c }
  )));
  const h = em.exactHistogram(pol);
  const fit = em.fitEM(h.hist, { seed: 0 });
  const sc = em.scoreRecovery(fit.policy, pol);
  // Cells that are structurally unreachable cannot be recovered and must not be counted as
  // failures — they are reported as unreachable instead, which is a different fact.
  const reachableFold = sc.cells.filter((c) => c.action === 'fold' && !(c.street > 0 && c.handClass === 'weak' && false));
  results.degenerate = {
    note: 'flop/weak set to fold=1.0, so weak hands never survive the flop and never reveal.',
    maxFoldBranchAbsError: sc.maxFoldBranchAbsError,
    flopWeakFoldFitted: fit.policy[0][2].fold,
    flopWeakFoldTruth: 1.0,
    reachableFoldCells: reachableFold.length,
  };
  log(`STRESS  degenerate  maxFold=${fx(sc.maxFoldBranchAbsError, 5)} `
    + `flop/weak fold fitted=${fx(fit.policy[0][2].fold, 5)} (truth 1.0)`);
}

// ─── CURVATURE — the headline instrument, and the boundary it found ───────────
//
// Added after the identity-transition stress case failed at maxFold=0.15 while BOTH existing
// instruments called it fine: axis-aligned `resolvability` said ~6.5k hands, and `detectRidge`
// said no ridge. Both were wrong, because the flat direction is JOINT and neither probe
// looked along a joint direction. The smallest Hessian eigenvalue does, whatever its
// orientation, and it separates the two cases completely.
{
  const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  results.curvature = {};
  for (const [name, T] of [['realT', em.TRANSITION], ['identityT', I]]) {
    const h = em.exactHistogram(em.TRUE_POLICY, { T });
    const c = em.curvature(h.hist, em.TRUE_POLICY, { T });
    const rz = em.resolvability(h.hist, em.TRUE_POLICY, { T });
    const fit = em.fitEM(h.hist, { T, seed: 0, maxIter: QUICK ? 20000 : 200000 });
    const sc = em.scoreRecovery(fit.policy);
    results.curvature[name] = {
      smallestEigenvalue: c.smallestEigenvalue,
      conditionNumber: c.conditionNumber,
      handsToResolveFlattestJointDirection: c.handsToResolveFlattestDirection,
      handsToResolveAxisAlignedOnly: rz.worstHandsToResolve,
      axisAlignedUnderstatesBy: rz.worstHandsToResolve > 0
        ? c.handsToResolveFlattestDirection / rz.worstHandsToResolve : null,
      emMaxFoldBranchAbsError: sc.maxFoldBranchAbsError,
      emConverged: fit.converged,
      identified: c.smallestEigenvalue > 1e-3,
    };
    log(`CURVATURE ${name.padEnd(10)} lambdaMin=${ex(c.smallestEigenvalue)} `
      + `cond=${ex(c.conditionNumber)} hands(joint)=${Number.isFinite(c.handsToResolveFlattestDirection)
        ? c.handsToResolveFlattestDirection.toLocaleString() : 'INFINITE'} `
      + `hands(axis-only)=${rz.worstHandsToResolve.toLocaleString()} `
      + `-> ${c.smallestEigenvalue > 1e-3 ? 'IDENTIFIED' : '*** NOT IDENTIFIED ***'}`);
  }
}

// ─── MIGRATION SWEEP — how much class migration does identification require? ──
//
// The boundary above is not a quirk of one matrix. Interpolating T between identity and the
// realistic matrix turns "is it identified" into "how much migration does it take", which is
// the form WS-527 can actually act on: measure the corpus's real migration, read off the
// hands. Stated in hands because that is the unit the question was asked in.
{
  const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  results.migrationSweep = [];
  const ms = QUICK ? [0, 0.25, 0.5, 1] : [0, 0.1, 0.25, 0.5, 0.75, 1];
  for (const w of ms) {
    const T = em.TRANSITION.map((row, i) => row.map((v, j) => (1 - w) * I[i][j] + w * v));
    const h = em.exactHistogram(em.TRUE_POLICY, { T });
    const c = em.curvature(h.hist, em.TRUE_POLICY, { T });
    const offDiag = 1 - T.reduce((s, row, i) => s + row[i], 0) / T.length;
    results.migrationSweep.push({
      mix: w,
      offDiagonalMass: offDiag,
      smallestEigenvalue: c.smallestEigenvalue,
      handsToResolveFlattestDirection: c.handsToResolveFlattestDirection,
      identified: c.smallestEigenvalue > 1e-3,
    });
    log(`MIGRATION mix=${fx(w, 2)} offDiag=${fx(offDiag, 3)} lambdaMin=${ex(c.smallestEigenvalue)} `
      + `hands=${Number.isFinite(c.handsToResolveFlattestDirection)
        ? c.handsToResolveFlattestDirection.toLocaleString() : 'INFINITE'}`);
  }
}

// ─── STRESS: wrong transition matrix ──────────────────────────────────────────
// The declared assumption is that T is KNOWN. If handing the estimator a wrong T changed
// nothing, the assumption would be decorative and the arm under test would not have been
// using it. This proves the assumption is load-bearing.
{
  const WRONG = [[0.34, 0.33, 0.33], [0.33, 0.34, 0.33], [0.33, 0.33, 0.34]];
  const h = em.exactHistogram(em.TRUE_POLICY);
  const fit = em.fitEM(h.hist, { T: WRONG, seed: 0 });
  const sc = em.scoreRecovery(fit.policy);
  results.wrongT = {
    maxFoldBranchAbsError: sc.maxFoldBranchAbsError,
    degrades: sc.maxFoldBranchAbsError > TOL,
  };
  log(`STRESS  wrong-T     maxFold=${fx(sc.maxFoldBranchAbsError, 5)} -> `
    + `${sc.maxFoldBranchAbsError > TOL ? 'DEGRADES (assumption is load-bearing)' : '*** no effect — assumption decorative ***'}`);
}

// ─── STRESS: wider K ──────────────────────────────────────────────────────────
{
  results.widerK = [];
  for (const K of (QUICK ? [5] : [5, 8])) {
    const rng = em.mulberry32(7 + K);
    const prior = (() => { const v = Array.from({ length: K }, () => rng() + 0.1); const s = v.reduce((a, b) => a + b); return v.map((x) => x / s); })();
    const T = Array.from({ length: K }, () => { const v = Array.from({ length: K }, () => rng() + 0.05); const s = v.reduce((a, b) => a + b); return v.map((x) => x / s); });
    const pol = Array.from({ length: 3 }, () => Array.from({ length: K }, () => {
      const v = [rng(), rng(), rng()]; const s = v[0] + v[1] + v[2];
      return { fold: v[0] / s, call: v[1] / s, raise: v[2] / s };
    }));
    const h = em.exactHistogram(pol, { prior, T });
    const fit = em.fitEM(h.hist, { prior, T, seed: 0 });
    const sc = em.scoreRecovery(fit.policy, pol);
    const r = em.detectRidge(h.hist, { prior, T, starts: QUICK ? 6 : 12 });
    results.widerK.push({
      K,
      observationTypes: h.hist.size,
      maxFoldBranchAbsError: sc.maxFoldBranchAbsError,
      ridgeDetected: r.ridgeDetected,
      maxParamSpreadAtEqualLL: r.maxParamSpreadAtEqualLL,
      pass: sc.maxFoldBranchAbsError <= TOL,
    });
    log(`STRESS  K=${K}         types=${h.hist.size} maxFold=${ex(sc.maxFoldBranchAbsError)} `
      + `ridge=${r.ridgeDetected} -> ${sc.maxFoldBranchAbsError <= TOL ? 'OK' : '*** EXCEEDS TOLERANCE ***'}`);
  }
}

// ─── STRESS: determinism ──────────────────────────────────────────────────────
{
  const a = em.sampleHistogram(50000, em.TRUE_POLICY, 4242);
  const b = em.sampleHistogram(50000, em.TRUE_POLICY, 4242);
  let identical = a.hist.size === b.hist.size;
  for (const [k, v] of a.hist) if (b.hist.get(k) !== v) identical = false;
  const f1 = em.fitEM(a.hist, { seed: 3 });
  const f2 = em.fitEM(b.hist, { seed: 3 });
  const same = JSON.stringify(f1.policy) === JSON.stringify(f2.policy);
  results.determinism = { histogramIdentical: identical, fitIdentical: same, pass: identical && same };
  log(`STRESS  determinism hist=${identical} fit=${same} -> ${identical && same ? 'OK' : '*** NON-DETERMINISTIC ***'}`);
}

// ─── VERDICT ──────────────────────────────────────────────────────────────────
const headline = results.sweep[results.sweep.length - 1];
const controlsOk = results.leak.pass && results.oracle.pass && results.mismatch.pass;
results.boundary = {
  finding: 'Identification requires hand-class MIGRATION across streets. With an identity '
    + 'transition (class never changes) the smallest Hessian eigenvalue is ~0 and the fold '
    + 'branch is NOT identified at any sample size.',
  actionForWS527: 'Measure the corpus class-transition matrix, compute lambdaMin, and report '
    + 'hands-to-resolve BEFORE fitting. A fit on a near-singular geometry returns a confident '
    + 'number that no sample size supports.',
};
let verdict;
if (!controlsOk) verdict = 'VOID';
else if (headline.maxFoldBranchAbsError <= TOL && results.sweepDecays && !results.ridge.ridgeDetected) verdict = 'PASS';
else verdict = 'FAIL';

results.verdict = verdict;
results.headlineN = headline.N;
results.headlineMaxFoldBranchAbsError = headline.maxFoldBranchAbsError;
results.tolerance = TOL;
results.prereg = { id: prereg.id, sha256: preregHash, tolerance: TOL, headlineN: prereg.headlineN };

log('');
log(`VERDICT: F1 ${verdict}   headline N=${headline.N} maxFoldBranchAbsError=`
  + `${fx(headline.maxFoldBranchAbsError, 5)} vs tolerance ${TOL}`);
log('');

const outPath = String(flag('out', 'out/em-recovery.json'));
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(results, null, 2));
log(`written: ${outPath}`);

process.exit(verdict === 'PASS' ? 0 : 1);
