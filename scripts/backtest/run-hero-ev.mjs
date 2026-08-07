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

    // WS-393 — the depth-2/3 refinement budget, made statable on the single-arm runner.
    //
    // WHY THIS FLAG HAD TO EXIST BEFORE THE BASELINE RUN. `refinementBudgetMs` was reachable
    // only through `run-depth-ablation.mjs`, which necessarily runs BOTH arms and therefore
    // costs roughly twice the wall clock. There was no way to run the depth-1 configuration
    // alone — and depth-1 is the configuration that actually shipped for the life of the
    // project (WS-334 measured zero depth-2 calls on a live evaluation) AND the only one with
    // no wall-clock dependence in `gameTreeEvaluator.isTimeBudgetExceeded`.
    //
    // Omitted = the engine's own default, and the key stays ABSENT at the engine call, so a
    // run without this flag is byte-identical to every run before it.
    const refinementMs = args['refinement-ms'] === undefined
      ? undefined
      : int(args['refinement-ms'], undefined);
    if (refinementMs !== undefined && !(refinementMs >= 0)) {
      console.error('Refused: --refinement-ms must be >= 0 (0 means refine nothing — the depth-1 arm).');
      process.exit(2);
    }
    const comboSamples = int(args['combo-samples'], 10);
    const trials = int(args.trials, 200);

    // ── WS-433: seeding, workers, waves, chunks ────────────────────────────────────
    const { DEFAULT_EQUITY_SEED } = await loader.load('/scripts/backtest/seededEquity.mjs');
    const equitySeed = args['equity-seed'] === 'none'
      ? null
      : int(args['equity-seed'], DEFAULT_EQUITY_SEED);
    const os = await import('node:os');
    const workers = args.workers === 'auto'
      ? Math.max(1, os.availableParallelism() - 1)
      : int(args.workers, 0);
    const waveSizeArg = int(args['wave-size'], null);
    const maxDecisionsPerPlayer = int(args['max-decisions-per-player'], null);
    const targetContributingPlayers = int(args['target-contributing-players'], null);
    const chunkDir = typeof args['chunk-dir'] === 'string'
      ? args['chunk-dir']
      : (typeof args.out === 'string' ? `${args.out}.chunks` : null);
    const resume = Boolean(args.resume);
    if (resume && !chunkDir) {
      console.error('Refused: --resume needs a chunk dir (--chunk-dir, or --out to derive one).');
      process.exit(2);
    }

    // ADR-009 / WS-322 — the Deal Book and the replication stamp.
    //
    // Built AFTER the --max-files slice, deliberately: the book must describe the hands the
    // run actually saw, not the ones that matched the filter. A book built before slicing
    // would hash a set the measurement never touched, which is a worse failure than no book
    // at all because it would look correct.
    const corpusRoot = typeof args['corpus-root'] === 'string' ? args['corpus-root'] : DEFAULT_CORPUS_ROOT;
    const { buildDealBook } = await loader.load('/scripts/backtest/dealBook.mjs');
    const {
      buildStampInput, HERO_EV_UNSEEDED_SOURCES,
    } = await loader.load('/scripts/backtest/replicationStamp.mjs');
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
      seeds: {
        clusterBootstrap: DEFAULT_BOOTSTRAP_SEED,
        // WS-433. The run-level equity seed; every engine call derives its stream from it
        // via stable work coordinates (heroEvEnumeration.seedForCombo).
        ...(equitySeed !== null ? { equityMc: equitySeed } : {}),
      },
      dealBookHash: dealBook.contentHash,
      fieldVersion: behaviorPolicy?.provenance?.partition
        ? `behavior-policy@${behaviorPolicy.provenance.partition}/${behaviorPolicy.provenance.observations ?? '?'}obs`
        : null,
      partition: `pool-train@${int(args['pool-pct'], 50)}`,
      // WS-393/WS-433/WS-432. `unseededSources` is a positive claim, assembled from what
      // is actually live in THIS configuration:
      //   - Monte Carlo entry: present only when the run is UNSEEDED (--equity-seed none).
      //   - Refinement clock + worker contention: RETIRED by WS-432 — the logical
      //     work-unit clock (refinementWork.js, 'logical-v1') makes stage completion a
      //     pure function of the inputs at ANY budget and ANY worker count.
      // At the default seed this is [] — bit-reproducibility at every budget, verified by
      // the parallel-vs-serial identity gate.
      unseededSources: [
        ...(equitySeed === null ? HERO_EV_UNSEEDED_SOURCES : []),
      ],
    });
    // WS-393. The settings that DEFINE this configuration, stamped ON TOP of the minimum set
    // — the same argument run-depth-ablation.mjs makes: a card that does not name the
    // refinement budget names a configuration nobody can reconstruct, and after WS-334 the
    // budget is the difference between two materially different engines.
    replicationStamp.constants = {
      ...replicationStamp.constants,
      REFINEMENT_BUDGET_MS: refinementMs === undefined ? 'engine-default' : refinementMs,
      HERO_POLICY_COMBO_SAMPLES: comboSamples,
      HERO_POLICY_TRIALS: trials,
      IPS_WEIGHT_CAP: reportOpts.weightCap,
      HERO_EV_WORKERS: workers,
    };
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

        // THE PARTIAL IS NOT A VALIDATED RESULT, and saying so is the whole point of this
        // stamp. Since WS-433 the runner admits players in canonical-enumeration WAVES with
        // a per-player decision cap, so an early snapshot is a canonical PREFIX of the
        // planned players — no longer the old sequential-walk pathology where one heavy
        // player monopolized 300 decisions (`players = 1`, edge +16.06 bb, `ciLow: null`).
        // A prefix of a deterministic enumeration is still not the completed run: the CI
        // needs clusters, and the admissibility gate needs the full player set.
        const contributingPlayers = report?.arms?.engineRaked?.players ?? 0;
        const partialStamp = {
          complete: false,
          decisionsScored: run.decisionsScored,
          contributingPlayers,
          ciAvailable: report?.gate?.heroEvCiLow !== null && report?.gate?.heroEvCiLow !== undefined,
          caveat:
            'PARTIAL SNAPSHOT — NOT a validated result. It contains the completed waves '
            + `so far (${contributingPlayers} contributing player(s), a canonical prefix of `
            + 'the planned enumeration), not the full planned player set. Do not quote the '
            + 'edge from this file; wait for the completed run, or resume it with --resume '
            + '(chunks in the --chunk-dir survive a kill).',
        };

        mkdirSync(dirname(partialPath), { recursive: true });
        writeFileSync(partialPath, JSON.stringify({ partial: partialStamp, report, run }, null, 2));
        partialWrites++;
      } catch (err) {
        // Never let snapshot bookkeeping kill a multi-hour run.
        console.log(`  (partial write skipped: ${err?.message || err})`);
      }
    };

    // WS-393 — the decision-level sidecar. See decisionRecord.mjs.
    const { openDecisionSink } = await loader.load('/scripts/backtest/decisionRecord.mjs');
    const sink = typeof args['decisions-out'] === 'string'
      ? openDecisionSink(args['decisions-out'], {
        run: 'hero-ev',
        dealBookId: dealBook.dealBookId,
        dealBookHash: dealBook.contentHash,
        engineCommit: replicationStamp.engineCommit ?? null,
        engineDirty: replicationStamp.engineDirty ?? null,
        arms: [{ id: 'default', refinementBudgetMs: refinementMs ?? 'engine-default' }],
        constants: replicationStamp.constants,
      })
      : null;
    if (sink) console.log(`Decision-level record streaming to ${sink.path}`);

    const started = Date.now();
    const run = await runHeroEv({
      files,
      reference,
      behaviorPolicy,
      onPartial: writePartial,
      onDecisionRecord: sink ? (rec) => sink.write(rec) : null,
      poolPct: int(args['pool-pct'], 50),
      maxPlayers: int(args['max-players'], Infinity),
      maxHandsPerPlayer: int(args['max-hands-per-player'], Infinity),
      minTrainHands: int(args['min-train-hands'], 15),
      checkpointInterval: int(args['checkpoint-interval'], 10),
      maxDecisions: int(args['max-decisions'], Infinity),
      comboSamples,
      trials,
      rakeConfig,
      dealBook,
      replicationStamp,
      // WS-433 — seeding, worker pool, wave admission, chunk persistence + resume.
      equitySeed,
      workers,
      waveSize: waveSizeArg,
      maxDecisionsPerPlayer,
      targetContributingPlayers,
      chunkDir,
      resume,
      // Spread, so an unstated budget leaves `depthArms` absent and the engine's own default
      // applies — the pre-WS-393 path, unchanged.
      ...(refinementMs === undefined
        ? {}
        : { depthArms: [{ id: 'default', refinementBudgetMs: refinementMs }] }),
      log: (m) => console.log(`  ${m}`),
    });
    run.runtimeMs = Date.now() - started;

    // WS-433 AC4 — the supply line. `qualifying` is the count that had never been shown
    // (players with >= minTrainHands + 1 hands, i.e. at least one train/test window);
    // 2,300 contributing players is WS-410's MDE target for a 0.20 bb effect.
    console.log(
      `\nPlayer supply: ${run.counters.evalPlayers} EVAL indexed · `
      + `${run.counters.qualifyingPlayers} qualifying (>= ${int(args['min-train-hands'], 15) + 1} hands) · `
      + `planned ${run.counters.plannedPlayers} · contributing ${run.counters.contributingPlayers} `
      + '(power target for 0.20bb MDE: ~2,300 contributing — WS-410)',
    );
    if (run.counters.playerTaskErrors > 0) {
      console.log(`  WARNING: ${run.counters.playerTaskErrors} player task(s) failed and were skipped — see log lines above.`);
    }
    if (run.config.resumedWaves > 0) {
      console.log(`  Resumed ${run.config.resumedWaves} wave(s) from ${chunkDir}${run.config.resumedEngineDirty ? ' (some chunks were produced on a DIRTY tree)' : ''}`);
    }
    if (sink) {
      sink.close();
      console.log(`Decision-level record: ${sink.count} row(s) in ${sink.path}`);
      run.decisionRecordPath = sink.path;
      run.decisionRecordRows = sink.count;
    }

    const report = buildHeroEvReport(run, reportOpts);
    console.log(renderHeroEvReport(report));

    if (typeof args.out === 'string') {
      mkdirSync(dirname(args.out), { recursive: true });
      writeFileSync(args.out, JSON.stringify({ report, run }, null, 2));
      console.log(`\nWrote ${args.out}`);
      // WS-393. `buildHeroEvReport` has produced a Result Card since WS-322 and this script
      // has never written it anywhere — it existed only nested inside the `--out` blob, which
      // is not a place a Ladder or a fault-register sweep can find it. Same flag, same
      // semantics as run-depth-ablation.mjs.
      if (typeof args.card === 'string' && report.resultCard) {
        mkdirSync(dirname(args.card), { recursive: true });
        writeFileSync(args.card, JSON.stringify(report.resultCard, null, 2));
        console.log(`Wrote ${args.card}`);
      } else if (typeof args.card === 'string') {
        console.log(`No Result Card written — ${(report.resultCardProblems ?? ['unknown reason']).join('; ')}`);
      }
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
