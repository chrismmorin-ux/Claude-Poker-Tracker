#!/usr/bin/env node
/**
 * run-hero-ev.mjs — does the engine's ADVICE make money? (WS-287, gate criterion C3)
 *
 * Everything else this repo measures scores VILLAIN ACTION PREDICTION. This scores the
 * recommendation itself, against the chips the hands actually produced.
 *
 * USAGE
 *   node scripts/backtest/run-hero-ev.mjs \
 *     --reference none \
 *     --behavior-policy out/behavior-policy.json \
 *     --stakes 50NLH --max-players 60 --max-decisions 400 \
 *     --out out/hero-ev.json
 *
 * Like run.mjs, `--reference` has NO default and must be stated explicitly.
 * `--behavior-policy` is likewise mandatory: it is the denominator of every importance
 * weight, so an implicit one would silently decide the result.
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

const readReference = (args) => {
  const ref = args.reference;
  if (ref === undefined) {
    console.error(
      'Refused: --reference is required. Pass a POOL-partition table path, or the\n' +
      `explicit "${REFERENCE_DISABLED}" sentinel. The SHIPPED reference table was mined\n` +
      'from the entire corpus and must never be used to score it.',
    );
    process.exit(2);
  }
  if (ref === REFERENCE_DISABLED) return REFERENCE_DISABLED;
  return JSON.parse(readFileSync(ref, 'utf8'));
};

const main = async () => {
  const args = parseArgs(process.argv);
  const reference = readReference(args);

  if (typeof args['behavior-policy'] !== 'string') {
    console.error(
      'Refused: --behavior-policy is required. pi_pool is the denominator of every\n' +
      'importance weight; an unstated propensity source would silently decide the\n' +
      'result. Mine one with scripts/backtest/mine-behavior-policy.mjs.',
    );
    process.exit(2);
  }
  const behaviorPolicy = JSON.parse(readFileSync(args['behavior-policy'], 'utf8'));

  // Rake is MODELLED — the corpus records none. `--rake none` reports the unraked view
  // as the headline instead, but both are always computed.
  let rakeConfig = { pct: 0.05, cap: 3, noFlopNoDrop: true };
  if (args.rake === 'none') rakeConfig = null;
  else if (typeof args.rake === 'string') {
    const [pct, cap] = args.rake.split(',').map(Number);
    rakeConfig = { pct, cap: Number.isFinite(cap) ? cap : Infinity, noFlopNoDrop: true };
  }

  const loader = await openLoader(process.cwd());
  try {
    const { discoverCorpusFiles, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
    const { runHeroEv } = await loader.load('/scripts/backtest/heroEvRunner.mjs');
    const { buildHeroEvReport, renderHeroEvReport } = await loader.load('/scripts/backtest/heroEvReport.mjs');

    let files = await discoverCorpusFiles({
      root: typeof args['corpus-root'] === 'string' ? args['corpus-root'] : DEFAULT_CORPUS_ROOT,
      sites: list(args.sites),
      stakes: list(args.stakes),
    });
    if (files.length === 0) {
      console.error('No corpus files matched. Check --corpus-root / --sites / --stakes.');
      process.exit(2);
    }
    // Player caps do NOT bound ingest cost: indexing streams every matched file to keep
    // filling hands for the players it already has. `--max-files` is the lever that
    // actually bounds a smoke run, and it is reported so a truncated scan is never
    // mistaken for a full one.
    const maxFiles = int(args['max-files'], Infinity);
    if (Number.isFinite(maxFiles) && files.length > maxFiles) {
      console.log(`Corpus scan LIMITED to ${maxFiles} of ${files.length} matched file(s).`);
      files = files.slice(0, maxFiles);
    }

    const started = Date.now();
    const run = await runHeroEv({
      files,
      reference,
      behaviorPolicy,
      poolPct: int(args['pool-pct'], 50),
      maxPlayers: int(args['max-players'], Infinity),
      maxHandsPerPlayer: int(args['max-hands-per-player'], Infinity),
      minTrainHands: int(args['min-train-hands'], 15),
      checkpointInterval: int(args['checkpoint-interval'], 10),
      maxDecisions: int(args['max-decisions'], Infinity),
      comboSamples: int(args['combo-samples'], 10),
      trials: int(args.trials, 200),
      rakeConfig,
      log: (m) => console.log(`  ${m}`),
    });
    run.runtimeMs = Date.now() - started;

    const report = buildHeroEvReport(run, {
      foldShiftPp: num(args['fold-shift-pp'], 13),
      weightCap: num(args['weight-cap'], 20),
    });
    console.log(renderHeroEvReport(report));

    if (typeof args.out === 'string') {
      mkdirSync(dirname(args.out), { recursive: true });
      writeFileSync(args.out, JSON.stringify({ report, run }, null, 2));
      console.log(`\nWrote ${args.out}`);
    }
  } finally {
    await loader.close();
  }
};

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
