#!/usr/bin/env node
/**
 * probe-foldcurve-reach.mjs — WS-481. Does the personalised fold curve REACH anything?
 *
 * WS-481 corrected the axis `personalizedFoldCurve` is fitted on. The paired
 * `probeFrequency` before/after came back at ZERO divergence over 130 decisions, which has
 * two very different explanations and they must not be confused:
 *
 *   (a) the correction is real but small enough to change no advice, or
 *   (b) the fitted curve is NEVER PRODUCED on this corpus, so the axis it is fitted on
 *       cannot matter and the null measures the harness, not the fix.
 *
 * This script decides between them by counting, per EVAL player: how many fold-curve
 * observations `accumulateDecisions` yields, how many distinct sizes they cover, and whether
 * `fitFoldCurveParams` returns a curve at all. `MIN_FOLD_CURVE_OBS` is 8 and
 * `MIN_DISTINCT_SIZES` is 2 — if players clear neither, `personalizedFoldCurve` is null
 * everywhere and the engine runs `POPULATION_CURVE` regardless of the training axis.
 *
 * USAGE
 *   node scripts/backtest/probe-foldcurve-reach.mjs [--max-files 300] [--max-players 300]
 *     [--max-hands-per-player 200]
 */

import { openLoader } from './loader.mjs';

const parseArgs = (argv) => {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const k = t.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) a[k] = true;
    else { a[k] = n; i++; }
  }
  return a;
};
const int = (v, d) => (v === undefined ? d : Number.parseInt(v, 10));

const main = async () => {
  const args = parseArgs(process.argv);
  const maxFiles = int(args['max-files'], 300);
  const maxPlayers = int(args['max-players'], 300);
  const maxHands = int(args['max-hands-per-player'], 200);

  const loader = await openLoader(process.cwd());
  try {
    const { discoverCorpusFiles, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
    const { indexEvalPlayers } = await loader.load('/scripts/backtest/runner.mjs');
    const { buildRangeProfile } = await loader.load('/src/utils/rangeEngine/index.js');
    const { accumulateDecisions } = await loader.load('/src/utils/exploitEngine/decisionAccumulator.js');
    const { fitFoldCurveParams } = await loader.load('/src/utils/exploitEngine/villainModelData.js');

    const files = (await discoverCorpusFiles({ root: DEFAULT_CORPUS_ROOT, stakes: ['50NLH'] })).slice(0, maxFiles);
    const { byPlayer } = await indexEvalPlayers({
      files, maxPlayers, maxHandsPerPlayer: maxHands,
      onProgress: (n) => { if (n % 100000 === 0) console.log(`  read ${n} hands`); },
    });
    console.log(`indexed ${byPlayer.size} EVAL players`);

    let players = 0, withAny = 0, fitted = 0;
    let totalSamples = 0, maxSamples = 0;
    const distinctHist = {};
    const skipTotals = { unknownBlinds: 0, estimatedPot: 0 };
    const sampleCounts = [];

    for (const [pid, hands] of byPlayer) {
      if (!Array.isArray(hands) || hands.length < 15) continue;
      players++;
      let summary;
      try {
        const profile = buildRangeProfile(pid, hands, 'foldcurvereach');
        summary = accumulateDecisions(pid, hands, profile, 'foldcurvereach');
      } catch { continue; }

      const data = summary?.foldCurveData || [];
      totalSamples += data.length;
      maxSamples = Math.max(maxSamples, data.length);
      sampleCounts.push(data.length);
      if (data.length) withAny++;

      const skips = summary?.sizingSampleSkips;
      if (skips) {
        skipTotals.unknownBlinds += skips.unknownBlinds || 0;
        skipTotals.estimatedPot += skips.estimatedPot || 0;
      }

      const distinct = new Set(data.map(d => Math.round(d.betFraction * 10) / 10)).size;
      distinctHist[distinct] = (distinctHist[distinct] || 0) + 1;

      if (fitFoldCurveParams(data)) fitted++;
    }

    sampleCounts.sort((a, b) => a - b);
    const q = (p) => (sampleCounts.length ? sampleCounts[Math.floor(p * (sampleCounts.length - 1))] : 0);

    console.log('\n=== WS-481: does personalizedFoldCurve reach the engine? ===');
    console.log(`players considered (>=15 hands)   ${players}`);
    console.log(`players with >=1 fold-curve obs   ${withAny}`);
    console.log(`players with a FITTED curve       ${fitted}  (${players ? (100 * fitted / players).toFixed(1) : 0}%)`);
    console.log(`fold-curve observations total     ${totalSamples}`);
    console.log(`per-player samples  p50=${q(0.5)}  p90=${q(0.9)}  max=${maxSamples}`);
    console.log(`distinct-size histogram (sizes -> players) ${JSON.stringify(distinctHist)}`);
    console.log(`dropped sizing samples            ${JSON.stringify(skipTotals)}`);
    console.log(`\ngates: MIN_FOLD_CURVE_OBS=8, MIN_DISTINCT_SIZES=2`);
  } finally {
    await loader.close();
  }
};

main().catch((e) => { console.error(e); process.exit(1); });
