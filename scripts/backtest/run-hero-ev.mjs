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

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
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

    const reportOpts = {
      foldShiftPp: num(args['fold-shift-pp'], 13),
      weightCap: num(args['weight-cap'], 20),
    };

    // ADR-009 / WS-322 — the Deal Book and the replication stamp.
    //
    // Built AFTER the --max-files slice, deliberately: the book must describe the hands the
    // run actually saw, not the ones that matched the filter. A book built before slicing
    // would hash a set the measurement never touched, which is a worse failure than no book
    // at all because it would look correct.
    const corpusRoot = typeof args['corpus-root'] === 'string' ? args['corpus-root'] : DEFAULT_CORPUS_ROOT;
    const { buildDealBook } = await loader.load('/scripts/backtest/dealBook.mjs');
    const { buildStampInput } = await loader.load('/scripts/backtest/replicationStamp.mjs');
    const { DEFAULT_BOOTSTRAP_SEED } = await loader.load('/scripts/backtest/ipsEstimator.mjs');

    const dealBook = await buildDealBook({
      files,
      root: corpusRoot,
      sliceSpec: {
        root: corpusRoot,
        sites: list(args.sites),
        stakes: list(args.stakes),
        maxFiles: Number.isFinite(maxFiles) ? maxFiles : null,
        maxPlayers: int(args['max-players'], null),
        maxHandsPerPlayer: int(args['max-hands-per-player'], null),
      },
      identity: args['hash-members'] ? 'content' : 'path+size',
    });
    console.log(`Deal Book ${dealBook.dealBookId} — ${dealBook.memberCount} file(s), ${dealBook.identity}, ${dealBook.contentHash.slice(0, 20)}…`);

    const replicationStamp = await buildStampInput({
      loader,
      seeds: { clusterBootstrap: DEFAULT_BOOTSTRAP_SEED },
      dealBookHash: dealBook.contentHash,
      fieldVersion: behaviorPolicy?.provenance?.partition
        ? `behavior-policy@${behaviorPolicy.provenance.partition}/${behaviorPolicy.provenance.observations ?? '?'}obs`
        : null,
      partition: `pool-train@${int(args['pool-pct'], 50)}`,
    });
    if (replicationStamp.engineDirty) {
      console.log('  WARNING: working tree is dirty — the stamped commit does not identify the code that ran.');
    }

    // Partial-snapshot writer. A full pass runs for hours; before this, the artifact was
    // written only on return, so an interrupted run yielded nothing at all regardless of
    // how far it got (observed 2026-07-31: killed at 275/3000, zero output).
    //
    // The partial file is written to a SEPARATE path and stamped `complete: false`, never
    // over `--out`. A half-finished estimate that lands at the filename a finished one
    // would use is exactly the confusion the provenance registry exists to prevent —
    // SRC-015 already records that a smoke figure must not be quotable as a validated one.
    const partialPath = typeof args.out === 'string' ? `${args.out}.partial` : null;
    let partialWrites = 0;
    const writePartial = (run) => {
      if (!partialPath) return;
      try {
        const report = buildHeroEvReport(run, reportOpts);

        // THE PARTIAL IS NOT A RANDOM SUBSAMPLE, and saying so is the whole point of this
        // stamp. The runner walks EVAL players sequentially, so an early snapshot contains
        // every decision of the first player(s) and none of anyone else's. Observed live on
        // the first run that used this: at 300 scored decisions the headline arm had
        // `players = 1` — one individual's result, carrying a perfectly confident-looking
        // edge of +16.06 bb and `ciLow: null`, because a cluster bootstrap over one cluster
        // is undefined (ipsEstimator.clusterBootstrapCI returns null below k=2).
        //
        // An edge without a CI, drawn from one player, is exactly the kind of number that
        // gets quoted. The artifact has to refuse that reading itself rather than rely on
        // whoever opens it.
        const contributingPlayers = report?.arms?.engineRaked?.players ?? 0;
        const partialStamp = {
          complete: false,
          decisionsScored: run.decisionsScored,
          contributingPlayers,
          ciAvailable: report?.gate?.heroEvCiLow !== null && report?.gate?.heroEvCiLow !== undefined,
          caveat:
            'PARTIAL SNAPSHOT — NOT a validated result and NOT a random subsample. EVAL '
            + 'players are processed sequentially, so this contains all decisions from the '
            + `first ${contributingPlayers} player(s) and none from the rest. The edge is `
            + 'therefore player-biased, and no confidence interval exists until at least 2 '
            + 'players have contributed (the CI is a cluster bootstrap over players). Do not '
            + 'quote the edge from this file; wait for the completed run.',
        };

        mkdirSync(dirname(partialPath), { recursive: true });
        writeFileSync(partialPath, JSON.stringify({ partial: partialStamp, report, run }, null, 2));
        partialWrites++;
      } catch (err) {
        // Never let snapshot bookkeeping kill a multi-hour run.
        console.log(`  (partial write skipped: ${err?.message || err})`);
      }
    };

    const started = Date.now();
    const run = await runHeroEv({
      files,
      reference,
      behaviorPolicy,
      onPartial: writePartial,
      poolPct: int(args['pool-pct'], 50),
      maxPlayers: int(args['max-players'], Infinity),
      maxHandsPerPlayer: int(args['max-hands-per-player'], Infinity),
      minTrainHands: int(args['min-train-hands'], 15),
      checkpointInterval: int(args['checkpoint-interval'], 10),
      maxDecisions: int(args['max-decisions'], Infinity),
      comboSamples: int(args['combo-samples'], 10),
      trials: int(args.trials, 200),
      rakeConfig,
      dealBook,
      replicationStamp,
      log: (m) => console.log(`  ${m}`),
    });
    run.runtimeMs = Date.now() - started;

    const report = buildHeroEvReport(run, reportOpts);
    console.log(renderHeroEvReport(report));

    if (typeof args.out === 'string') {
      mkdirSync(dirname(args.out), { recursive: true });
      writeFileSync(args.out, JSON.stringify({ report, run }, null, 2));
      console.log(`\nWrote ${args.out}`);
      if (partialWrites > 0) {
        // The completed artifact supersedes every snapshot; leaving the last partial on
        // disk beside it invites someone to read the wrong one.
        try {
          rmSync(partialPath, { force: true });
          console.log(`Removed ${partialPath} (${partialWrites} snapshot(s) written during the run)`);
        } catch { /* the completed file is what matters; a stale partial is not fatal */ }
      }
    }
  } finally {
    await loader.close();
  }
};

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
