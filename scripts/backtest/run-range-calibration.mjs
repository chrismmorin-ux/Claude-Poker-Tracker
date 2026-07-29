#!/usr/bin/env node
/**
 * run-range-calibration.mjs — read-only: are inferred ranges calibrated against the
 * hands players actually showed?
 *
 * USAGE
 *   node scripts/backtest/run-range-calibration.mjs \
 *     --stakes 50NLH --max-files 400 --max-players 600 --out out/range-calibration.json
 *
 *   Parameter sweeps (WS-291) — every arm is scored on the SAME decisions:
 *     --tau-sweep   0.08,0.15,0.25     logistic softness
 *     --floor-sweep 0.01,0.02,0.03,0.05,0.08   minimum P(action | combo)
 *     --support-sweep 0,0.05,0.15,0.40         preflop prior support weight (WS-302);
 *                                              lambda = 0 is the pre-WS-302 chart
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openLoader } from './loader.mjs';

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

const pct = (x) => (x == null ? '—' : `${(100 * x).toFixed(1)}%`);
const f3 = (x) => (x == null ? '—' : x.toFixed(3));

const row = (label, s) => s
  ? `  ${String(label).padEnd(14)} ${String(s.n).padStart(6)}  ${pct(s.coverage).padStart(8)}  ${pct(s.retainedFraction).padStart(9)}  ${f3(s.coverageLift).padStart(6)}  ${f3(s.deltaLogVsUniform).padStart(8)}  ${f3(s.deltaLogGivenCovered).padStart(9)}`
  : `  ${String(label).padEnd(14)} —`;

const table = (title, obj) => {
  const L = [`\n  ${title}`, '  ' + '─'.repeat(72),
    `  ${'slice'.padEnd(14)} ${'n'.padStart(6)}  ${'coverage'.padStart(8)}  ${'retained'.padStart(9)}  ${'lift'.padStart(6)}  ${'Δlog'.padStart(8)}  ${'Δlog|cov'.padStart(9)}`];
  for (const [k, v] of Object.entries(obj)) L.push(row(k, v));
  return L.join('\n');
};

const main = async () => {
  const args = parseArgs(process.argv);
  const loader = await openLoader(process.cwd());
  try {
    const { discoverCorpusFiles, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
    const { runRangeCalibrationProbe } = await loader.load('/scripts/backtest/rangeCalibrationProbe.mjs');

    let files = await discoverCorpusFiles({
      root: typeof args['corpus-root'] === 'string' ? args['corpus-root'] : DEFAULT_CORPUS_ROOT,
      sites: list(args.sites),
      stakes: list(args.stakes),
    });
    const maxFiles = int(args['max-files'], Infinity);
    if (Number.isFinite(maxFiles) && files.length > maxFiles) {
      console.log(`Corpus scan LIMITED to ${maxFiles} of ${files.length} matched file(s).`);
      files = files.slice(0, maxFiles);
    }
    if (files.length === 0) { console.error('No corpus files matched.'); process.exit(2); }

    const started = Date.now();
    const r = await runRangeCalibrationProbe({
      files,
      poolPct: int(args['pool-pct'], 50),
      maxPlayers: int(args['max-players'], Infinity),
      maxHandsPerPlayer: int(args['max-hands-per-player'], Infinity),
      tauSweep: list(args['tau-sweep'])?.map(Number) ?? null,
      floorSweep: list(args['floor-sweep'])?.map(Number) ?? null,
      supportSweep: list(args['support-sweep'])?.map(Number) ?? null,
      log: (m) => console.log(`  ${m}`),
    });

    console.log('\n' + '═'.repeat(76));
    console.log('  RANGE CALIBRATION — does the inferred range contain the hand actually held?');
    console.log('═'.repeat(76));
    console.log(`\n  scanned: ${r.scanned.decisions} postflop decisions, ${r.scanned.players} players, ${r.scanned.handsRead} hands`);
    console.log(`  revealed: acting seat ${r.scanned.revealedActing}, villain seat ${r.scanned.revealedVillain}`);
    console.log('\n  coverage = the true hand has NON-ZERO probability in the range.');
    console.log('  retained = share of all possible combos the range kept (the random-elimination baseline).');
    console.log('  lift     = coverage / retained. ~1.0 means the eliminations are effectively arbitrary.');
    console.log('  Δlog     = mean log P(true hand) minus uniform. POSITIVE = the range beats uniform.');

    console.log(table('ACTING SEAT — range tracked by decisionAccumulator', { overall: r.acting.all, ...r.acting.byStreet }));
    console.log(table('ACTING SEAT — by observed action', r.acting.byAction));
    console.log(table('ACTING SEAT — by revealed hand strength', r.acting.byStrength));
    console.log(table('ACTING SEAT — by site (robustness)', r.acting.bySite));
    console.log(table('VILLAIN SEAT — range the game tree consumes (gameTreeContext:219)', { overall: r.villain.all, ...r.villain.byStreet }));
    console.log(table('VILLAIN SEAT — by villain action', r.villain.byAction));
    console.log(table('CHAINED narrowing — as gameTreeDepth2 re-applies it', r.chained));
    if (r.tauSweep && Object.keys(r.tauSweep).length) {
      console.log(table('SOFTNESS SWEEP (villain side) — tauFraction', r.tauSweep));
    }
    if (r.floorSweep && Object.keys(r.floorSweep).length) {
      // Coverage is 100% for every positive floor, so it cannot rank the arms — Δlog does.
      console.log(table('FLOOR SWEEP (villain side) — min P(action|combo); rank by Δlog', r.floorSweep));
    }
    if (r.supportSweep && Object.keys(r.supportSweep).length) {
      // lambda = 0 is the pre-WS-302 prior, so this table contains its own control.
      console.log(table('PREFLOP SUPPORT SWEEP — prior lambda (0 = shipped chart); rank by Δlog', r.supportSweep));
    }

    console.log(`\n  runtime ${((Date.now() - started) / 1000).toFixed(1)}s`);
    console.log('═'.repeat(76));

    if (typeof args.out === 'string') {
      mkdirSync(dirname(args.out), { recursive: true });
      writeFileSync(args.out, JSON.stringify(r, null, 2));
      console.log(`\nWrote ${args.out}`);
    }
  } finally {
    await loader.close();
  }
};

main().catch((e) => { console.error(e?.stack || String(e)); process.exit(1); });
