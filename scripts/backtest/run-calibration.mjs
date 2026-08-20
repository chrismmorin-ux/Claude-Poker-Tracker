#!/usr/bin/env node
/**
 * run-calibration.mjs — WS-543. Measure the instrument, not the poker.
 *
 * Every arm carries a sign fixed BEFORE the run, in `ladder/calibrationPrereg.json`, which this
 * script reads, hashes and stamps — and refuses to run without. Same mechanism as
 * `run-em-recovery.mjs`, for the same reason: computing several things and reporting whichever
 * agreed with the prior belief is indistinguishable, in the output, from having chosen honestly.
 *
 * THE HEADLINE ARM IS `clone-the-pool`, AND ITS EXPECTED VALUE IS AN IDENTITY. It abstains
 * everywhere with `fallback: 'pool'`, so pi_ours = pi_pool, every weight is exactly 1, and
 * `edge = wisValue - poolValue` must be EXACTLY ZERO. Any deviation is pure instrument error and
 * becomes the floor every other figure in this harness is read against.
 *
 * THE SECOND PRODUCT IS THE CLUSTER CORRECTION. `ipsEstimator.mjs`'s own header records that
 * "a hand belongs to exactly one scored player ... is false by construction -- measured at 2.91
 * EVAL players per hand -- and the cluster bootstrap's independence assumption does not hold."
 * Every interval this harness has ever produced is too narrow by an unmeasured factor. This run
 * computes each arm's interval under BOTH cluster units and reports the width ratio, which is
 * that factor — or at least a lower bound on it, since sessions and tables correlate too.
 *
 * USAGE
 *   node scripts/backtest/run-calibration.mjs --behavior-policy out/behavior-policy.json \
 *     --stakes 50NLH --max-files 200 --max-players 500 --max-decisions 2500 --workers 16 \
 *     --out out/calibration-v1.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { openLoader } from './loader.mjs';
import { REFERENCE_DISABLED } from './leakageGuard.mjs';
import { pairedDelta } from './depthAblationReport.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PREREG_PATH = join(HERE, 'ladder', 'calibrationPrereg.json');

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
const bb = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '    n/a' : `${v >= 0 ? '+' : ''}${v.toFixed(4)}`);

const main = async () => {
  const args = parseArgs(process.argv);

  let preregRaw;
  try {
    preregRaw = readFileSync(PREREG_PATH, 'utf8');
  } catch {
    console.error(`REFUSED: pre-registration not found at ${PREREG_PATH}.\n`
      + 'These arms exist to be judged against a prediction. Without the prediction the output\n'
      + 'is a description of some numbers, not a calibration.');
    process.exit(2);
  }
  const prereg = JSON.parse(preregRaw);
  const preregHash = createHash('sha256').update(preregRaw).digest('hex');

  const loader = await openLoader(process.cwd());
  try {
    const { discoverCorpusFiles, applyFileCap, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
    const { runHeroEv } = await loader.load('/scripts/backtest/heroEvRunner.mjs');
    const { estimateEdge } = await loader.load('/scripts/backtest/ipsEstimator.mjs');
    const { ALWAYS_FOLD, withModuleDescriptor } = await loader.load('/scripts/backtest/strategyArm.mjs');
    const { loadCalibrationArms } = await loader.load('/scripts/backtest/ladder/calibrationArms.mjs');

    const set = [
      ...(await loadCalibrationArms()),
      {
        arm: await withModuleDescriptor(ALWAYS_FOLD, {
          modulePath: './strategyArm.mjs', exportName: 'ALWAYS_FOLD',
        }),
        expect: 'negative',
      },
    ];

    // An arm that declares `requiresFallback` gets it ASSERTED, not assumed. `clone-the-pool`
    // under fallback 'engine' would silently measure the engine while wearing this arm's name.
    for (const { arm } of set) {
      if (arm.requiresFallback && arm.requiresFallback !== 'pool') {
        throw new Error(`calibration arm ${arm.id} requires fallback ${arm.requiresFallback}`);
      }
    }

    console.log('\n═══ WS-543 INSTRUMENT CALIBRATION ═══');
    console.log(`pre-registration ${prereg.id}  sha256:${preregHash.slice(0, 16)}`);
    for (const { arm, expect, tolerance } of set) {
      console.log(`  ${arm.id.padEnd(22)} expect ${expect}${tolerance ? ` (±${tolerance})` : ''}`);
    }

    const behaviorPolicy = JSON.parse(readFileSync(String(args['behavior-policy']), 'utf8'));

    let files = await discoverCorpusFiles({
      root: typeof args['corpus-root'] === 'string' ? args['corpus-root'] : DEFAULT_CORPUS_ROOT,
      sites: list(args.sites),
      stakes: list(args.stakes),
    });
    if (files.length === 0) { console.error('No corpus files matched.'); process.exit(2); }
    ({ files } = applyFileCap(files, { maxFiles: int(args['max-files'], Infinity) }));

    const weightCap = num(args['weight-cap'], 20);
    const started = Date.now();

    const run = await runHeroEv({
      files,
      reference: REFERENCE_DISABLED,
      behaviorPolicy,
      poolPct: int(args['pool-pct'], 50),
      maxPlayers: int(args['max-players'], Infinity),
      maxHandsPerPlayer: int(args['max-hands-per-player'], Infinity),
      minTrainHands: int(args['min-train-hands'], 15),
      checkpointInterval: int(args['checkpoint-interval'], 10),
      maxDecisions: int(args['max-decisions'], Infinity),
      comboSamples: int(args['combo-samples'], 10),
      trials: int(args.trials, 200),
      depthArms: set.map(({ arm }) => ({ id: arm.id, strategy: arm, fallback: 'pool' })),
      primaryArmId: set[0].arm.id,
      workers: int(args.workers, 0),
      log: (m) => console.log(`  ${m}`),
    });

    const runtimeMs = Date.now() - started;
    const d = run.decisions;

    const results = {};
    for (const { arm, expect, tolerance } of set) {
      const rows = d.filter((x) => x.piOursByArm?.[arm.id])
        .map((x) => ({ ...x, piOurs: x.piOursByArm[arm.id] }));
      const byPlayer = estimateEdge(rows, { weightCap, label: `${arm.id}/player` });
      const byHand = estimateEdge(rows, { weightCap, label: `${arm.id}/hand`, clusterBy: 'hand' });

      const wP = (byPlayer.edgeCiHighBB ?? 0) - (byPlayer.edgeCiLowBB ?? 0);
      const wH = (byHand.edgeCiHighBB ?? 0) - (byHand.edgeCiLowBB ?? 0);
      const ratio = wP > 0 ? wH / wP : null;

      // ── WS-546: AN ARM THAT NEVER FIRED HAS NO VERDICT ──
      //
      // AND `n === 0` DOES NOT DETECT IT. Under `fallback: 'pool'` an arm that returns
      // `covered: false` at every decision has the POOL policy substituted verbatim, so it
      // produces a full 2,155 rows, every weight exactly 1, ESS 100%, support 100%, and an edge
      // of exactly 0.0000. In other words it becomes `clone-the-pool` wearing a dominated arm's
      // name, and prints as "sign not resolved" — which scans as a near-miss rather than as an
      // absence of evidence.
      //
      // That is what `call-every-large-bet` did in WS-543 AND again in the WS-546 run: identical
      // to clone-the-pool on every field. The pre-registration has always required "the share of
      // decisions each arm actually covered" in `reportedRegardlessOfVerdict`; the runner never
      // reported it, so nothing contradicted the near-miss reading.
      //
      // `strategyCoverage` is already computed by the runner (heroEvRunner.mjs:716) and was
      // simply not being read. An observed zero and an unexamined cell are different facts
      // (.claude/rules/sparsity-refuse-or-shrink.md) and this is where they were collapsing.
      const cov = run.strategyCoverage?.[arm.id] ?? null;
      const coveredShare = cov?.coveredShare ?? null;
      // `call-every-large-bet` produced no rows at all in WS-543 and was printed with a blank
      // edge, which reads as a pass to anyone scanning the column. An arm the corpus never
      // exercised is `unexamined`, and the distinction between an observed zero and an
      // unexamined cell is exactly the one `.claude/rules/sparsity-refuse-or-shrink.md` refuses
      // to let collapse.
      let verdict;
      if (byPlayer.n === 0) {
        verdict = 'unexamined — no scorable decisions';
      } else if (cov && cov.covered === 0 && arm.requiresFallback !== 'pool') {
        // The exemption is not cosmetic: `clone-the-pool` covers NOTHING BY DESIGN. Its
        // `policyAt` returns `{covered: false}` unconditionally and `requiresFallback: 'pool'`
        // makes the pool policy the substitute, which is exactly how pi_ours becomes pi_pool
        // and the edge becomes an algebraic identity. Zero coverage is its mechanism, not its
        // failure — so the marker for "designed to abstain" is the declared fallback, and an
        // arm without that declaration reaching zero coverage genuinely never fired.
        verdict = 'unexamined — arm never fired; every row is the POOL fallback';
      } else if (expect === 'zero') {
        // The identity must hold under BOTH estimands. Under `clone-the-pool` every weight is
        // exactly 1, so the support set is every row and the two must agree to the last digit;
        // a candidate that breaks that has traded one bias for another (WS-546 criterion 2).
        const offAll = Math.abs(byPlayer.edgeBB) > (tolerance ?? 0.01);
        const offSupport = Math.abs(byPlayer.edgeBBSupportMatched ?? 0) > (tolerance ?? 0.01);
        verdict = (offAll || offSupport) ? '*** DEVIATES FROM ZERO ***' : 'AS PREDICTED';
      } else {
        // A dominated arm only CONTRADICTS its prediction if it is positive with power to say
        // so. WS-546 judges this on the SUPPORT-MATCHED estimand, because that is the one whose
        // two terms are over a single population — but the all-rows verdict is kept beside it
        // so the fix can be seen working rather than asserted.
        const eSup = byPlayer.edgeBBSupportMatched;
        const positiveAndResolved = eSup > 0 && (byHand.edgeSupportCiLowBB ?? -1) > 0;
        verdict = positiveAndResolved ? '*** CONTRADICTS PREDICTION ***'
          : (eSup < 0 ? 'AS PREDICTED' : 'sign not resolved');
      }
      const verdictAllRows = (byPlayer.n === 0 || expect === 'zero')
        ? verdict
        : (byPlayer.edgeBB > 0 && (byHand.edgeCiLowBB ?? -1) > 0 ? 'CONTRADICTS'
          : (byPlayer.edgeBB < 0 ? 'as predicted' : 'unresolved'));

      results[arm.id] = {
        expect, tolerance: tolerance ?? null, verdict,
        // WS-546. BOTH estimands ship, and so does the delta between them, per
        // `.claude/rules/unmeasured-constants.md`. `edgeBB` keeps its historical meaning so a
        // prior figure can be re-read; `edgeBBSupportMatched` is a DIFFERENT quantity carrying
        // its own conditioning set; the delta is the bias the all-rows baseline was holding at
        // this arm's support, and a delta of exactly zero is a finding rather than an absence.
        verdictAllRows,
        // Prereg `reportedRegardlessOfVerdict`: "the share of decisions each arm actually
        // covered". Required since WS-543 and not reported until now.
        coveredShare,
        coveredDecisions: cov?.covered ?? null,
        fellBackToPool: cov?.fellBackToPool ?? null,
        edgeBBSupportMatched: byPlayer.edgeBBSupportMatched,
        edgeBBSupportDelta: byPlayer.edgeBBSupportDelta,
        supportMatchedConditioningSet: byPlayer.supportMatchedConditioningSet,
        supportN: byPlayer.supportN,
        supportShare: byPlayer.supportShare,
        supportCi: {
          player: { lo: byPlayer.edgeSupportCiLowBB, hi: byPlayer.edgeSupportCiHighBB },
          hand: { lo: byHand.edgeSupportCiLowBB, hi: byHand.edgeSupportCiHighBB },
        },
        edgeBB: byPlayer.edgeBB, n: byPlayer.n, ess: byPlayer.ess,
        clippedShare: byPlayer.clippedShare, meanWeight: byPlayer.meanWeight,
        playerClustered: { clusters: byPlayer.clusters, ciLowBB: byPlayer.edgeCiLowBB, ciHighBB: byPlayer.edgeCiHighBB, width: wP, mdeDetectBB: byPlayer.mdeDetectBB },
        handClustered: { clusters: byHand.clusters, ciLowBB: byHand.edgeCiLowBB, ciHighBB: byHand.edgeCiHighBB, width: wH, mdeDetectBB: byHand.mdeDetectBB },
        intervalWideningRatio: ratio,
      };
    }

    console.log(`\n  decisions scored : ${run.decisionsScored}   runtime: ${(runtimeMs / 1000).toFixed(1)}s`);
    // Both estimands side by side. The point of the run is the COMPARISON, so a layout that
    // showed only the one we now prefer would hide whether the fix did anything.
    console.log('\n  ARM                       all-rows  support-matched     delta   ESS%   supp%   cov%   verdict (support-matched)');
    for (const { arm } of set) {
      const r = results[arm.id];
      const essPct = r.n > 0 ? `${((r.ess / r.n) * 100).toFixed(0)}%` : '  -';
      const supPct = r.supportShare === null || r.supportShare === undefined
        ? '  -' : `${(r.supportShare * 100).toFixed(0)}%`;
      const covPct = r.coveredShare === null || r.coveredShare === undefined
        ? '  -' : `${(r.coveredShare * 100).toFixed(0)}%`;
      console.log(`    ${arm.id.padEnd(26)} ${bb(r.edgeBB)}   ${bb(r.edgeBBSupportMatched)}   `
        + `${bb(r.edgeBBSupportDelta)}  ${essPct.padStart(5)}  ${supPct.padStart(5)}  ${covPct.padStart(5)}   ${r.verdict}`);
    }
    console.log('\n  intervals (support-matched estimand)');
    for (const { arm } of set) {
      const r = results[arm.id];
      console.log(`    ${arm.id.padEnd(26)} player [${bb(r.supportCi.player.lo)},${bb(r.supportCi.player.hi)}]  `
        + `hand [${bb(r.supportCi.hand.lo)},${bb(r.supportCi.hand.hi)}]  `
        + `widen ${r.intervalWideningRatio === null ? 'n/a' : `${r.intervalWideningRatio.toFixed(2)}x`}  `
        + `| all-rows verdict: ${r.verdictAllRows}`);
    }

    const clone = results['clone-the-pool'];
    const contradictions = Object.entries(results).filter(([, r]) => r.verdict.includes('CONTRADICTS'));
    const ratios = Object.values(results).map((r) => r.intervalWideningRatio).filter((x) => Number.isFinite(x));
    const medianRatio = ratios.length
      ? ratios.sort((a, b) => a - b)[Math.floor(ratios.length / 2)] : null;

    // WS-546's verdict enum, from the pre-registration. The clone identity is checked FIRST
    // and under both estimands: a candidate that breaks it is rejected regardless of what else
    // it repaired, so it cannot be masked by every dominated arm happening to come back right.
    const cloneBroken = clone
      && (Math.abs(clone.edgeBB) > (clone.tolerance ?? 0.01)
        || Math.abs(clone.edgeBBSupportMatched ?? 0) > (clone.tolerance ?? 0.01));
    let overall;
    if (cloneBroken) overall = 'FIX_REJECTED';
    else if (contradictions.length) overall = 'FIX_INSUFFICIENT';
    else overall = 'FIX_CONFIRMED';

    // ══════════════════════════════════════════════════════════════════════════════════════
    // WS-546 ACCEPT CRITERION 5 — THE PAIRED-DELTA CONSTRUCTION GETS ITS OWN DOMINATED CHECK
    // ══════════════════════════════════════════════════════════════════════════════════════
    //
    // `pairedDelta` was ASSUMED to survive the support problem and that assumption was never
    // tested. It differences two WEIGHTED means, so it does not carry the weighted-vs-unweighted
    // mismatch `estimateEdge` had — but it has a distinct exposure: vA averages over the rows
    // arm A has support on and vB over the rows arm B has support on, so when the supports
    // differ the difference is still cross-population.
    //
    // Pairing each dominated arm against `clone-the-pool` fixes the sign by the same domination
    // that fixes it in isolation, and clone's support is every row, so the comparison is as
    // clean as this harness can make it. A POSITIVE paired delta is an instrument defect.
    //
    // It is also the sharpest available test of the ESS hypothesis: if the level bias is a
    // function of weight concentration, PAIRING SHOULD CANCEL MUCH OF IT, because both sides
    // are resampled together inside one bootstrap draw and share the denominator's behaviour.
    const paired = {};
    const CLONE = 'clone-the-pool';
    for (const { arm, expect } of set) {
      if (arm.id === CLONE || expect === 'zero') continue;
      const rows = d.filter((x) => x.piOursByArm?.[arm.id] && x.piOursByArm?.[CLONE]);
      if (rows.length === 0) { paired[arm.id] = { note: 'no paired rows' }; continue; }
      const pd = pairedDelta(rows, { baseArm: CLONE, testArm: arm.id, weightCap });
      paired[arm.id] = {
        deltaBB: pd.deltaBB,
        ciLowBB: pd.deltaCiLowBB,
        ciHighBB: pd.deltaCiHighBB,
        n: pd.n,
        discordantShare: pd.discordantShare,
        // Same rule as the isolated arms: positive AND resolved is a contradiction; positive
        // but straddling zero is unresolved, which is a statement about power, not about sign.
        verdict: (pd.deltaBB > 0 && (pd.deltaCiLowBB ?? -1) > 0) ? '*** CONTRADICTS ***'
          : (pd.deltaBB < 0 ? 'as predicted' : 'sign not resolved'),
      };
    }
    console.log('\n  PAIRED DELTA vs clone-the-pool (accept criterion 5)');
    console.log('    arm                          delta        CI                  discordant   verdict');
    for (const [id, v] of Object.entries(paired)) {
      if (v.note) { console.log(`    ${id.padEnd(28)} ${v.note}`); continue; }
      console.log(`    ${id.padEnd(28)} ${bb(v.deltaBB)}  [${bb(v.ciLowBB)},${bb(v.ciHighBB)}]  `
        + `${((v.discordantShare ?? 0) * 100).toFixed(0)}%`.padStart(10) + `   ${v.verdict}`);
    }

    console.log(`\n  clone-the-pool  all-rows ${bb(clone?.edgeBB)}  support-matched ${bb(clone?.edgeBBSupportMatched)}`
      + '   (the identity says EXACTLY 0 under both)');
    const unexamined = Object.entries(results).filter(([, r]) => String(r.verdict).startsWith('unexamined'));
    if (unexamined.length) {
      console.log(`  unexamined (arm never fired): ${unexamined.map(([k]) => k).join(', ')}`
        + '  — no verdict, NOT a pass');
    }
    console.log(`  median interval widening under hand-clustering: ${medianRatio === null ? 'n/a' : `${medianRatio.toFixed(2)}x`}`);
    console.log(`\n  VERDICT: ${overall}`);
    if (overall !== 'FIX_CONFIRMED') {
      console.log('  Every ladder figure must be re-reported against this. See calibrationPrereg.json.');
    }
    console.log('═════════════════════════════════════\n');

    const outPath = String(args.out ?? 'out/calibration.json');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify({
      prereg: { id: prereg.id, sha256: preregHash },
      pairedVsClone: paired,
      caveat: 'Corpus is HandHQ online cash July 2009 50NL. These figures characterise the '
        + 'INSTRUMENT on that corpus; they are not claims about poker.',
      runtimeMs, decisionsScored: run.decisionsScored, config: run.config,
      results, medianIntervalWideningRatio: medianRatio, verdict: overall,
    }, null, 2));
    console.log(`Wrote ${outPath}`);
    process.exit(overall === 'INSTRUMENT_OK' ? 0 : 1);
  } finally {
    await loader.close?.();
  }
};

main().catch((e) => { console.error(e); process.exit(1); });
