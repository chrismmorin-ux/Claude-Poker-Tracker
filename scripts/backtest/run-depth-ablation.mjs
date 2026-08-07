#!/usr/bin/env node
/**
 * run-depth-ablation.mjs — WS-334 AC5. Depth-1-only advice vs depth-2/3-enabled advice,
 * scored through the hero-EV arm of the WS-273 harness onto ONE scale, with a Result Card.
 *
 * *** INFORMATION ONLY. NOT a keep/delete verdict on depth-2. ***
 * The delete option was taken off the table by the founder on 2026-08-03 (WS-334
 * decision_flags). See depthAblationReport.mjs for the full framing.
 *
 * USAGE — identical surface to run-hero-ev.mjs, because it IS run-hero-ev with two arms:
 *
 *   node scripts/backtest/run-depth-ablation.mjs \
 *     --reference none \
 *     --behavior-policy out/behavior-policy.json \
 *     --stakes 50NLH --max-files 40 --max-players 60 --max-decisions 200 \
 *     --out out/depth-ablation.json
 *
 * `--reference` and `--behavior-policy` have NO defaults, for the same reasons run-hero-ev
 * refuses to default them: the shipped reference table was mined from the whole corpus, and
 * pi_pool is the denominator of every importance weight.
 *
 * COST. Each decision costs `--combo-samples` engine calls PER ARM. The depth-2 arm is the
 * expensive one by construction — that is the subsystem under measurement — so budget roughly
 * `combo-samples x (depth1 cost + depth2 cost)` per decision and size `--max-decisions`
 * against the wall clock you have. `--refinement-ms` lets the depth-2 arm be run at a smaller
 * budget than production's 2000ms; it is STAMPED into the card, because a run at a different
 * budget is measuring a different configuration and must not be compared as if it were not.
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

const main = async () => {
  const args = parseArgs(process.argv);

  if (args.reference === undefined) {
    console.error(
      'Refused: --reference is required. Pass a POOL-partition table path, or the\n'
      + `explicit "${REFERENCE_DISABLED}" sentinel.`,
    );
    process.exit(2);
  }
  const reference = args.reference === REFERENCE_DISABLED
    ? REFERENCE_DISABLED
    : JSON.parse(readFileSync(args.reference, 'utf8'));

  if (typeof args['behavior-policy'] !== 'string') {
    console.error('Refused: --behavior-policy is required. pi_pool is the denominator of every importance weight.');
    process.exit(2);
  }
  const behaviorPolicy = JSON.parse(readFileSync(args['behavior-policy'], 'utf8'));

  let rakeConfig = { pct: 0.05, cap: 3, noFlopNoDrop: true };
  if (args.rake === 'none') rakeConfig = null;

  // The depth-2 arm's budget. Production default is 2000ms (gameTreeEvaluator.js:701).
  const refinementMs = int(args['refinement-ms'], 2000);
  if (!(refinementMs > 0)) {
    console.error('Refused: --refinement-ms must be > 0. A zero budget would make both arms depth-1 and the contrast vacuous.');
    process.exit(2);
  }

  const loader = await openLoader(process.cwd());
  try {
    const { discoverCorpusFiles, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
    const { runHeroEv } = await loader.load('/scripts/backtest/heroEvRunner.mjs');
    const { buildDepthAblationReport, renderDepthAblationReport, DEPTH_ABLATION_UNSEEDED_SOURCES } =
      await loader.load('/scripts/backtest/depthAblationReport.mjs');
    const { buildDealBook } = await loader.load('/scripts/backtest/dealBook.mjs');
    const { buildStampInput, HERO_EV_UNSEEDED_SOURCES } = await loader.load('/scripts/backtest/replicationStamp.mjs');
    const {
      DEFAULT_BOOTSTRAP_SEED, DEFAULT_WEIGHT_CAP, DEFAULT_BOOTSTRAP_RESAMPLES, DEFAULT_BOOTSTRAP_ALPHA,
    } = await loader.load('/scripts/backtest/ipsEstimator.mjs');

    const corpusRoot = typeof args['corpus-root'] === 'string' ? args['corpus-root'] : DEFAULT_CORPUS_ROOT;
    let files = await discoverCorpusFiles({
      root: corpusRoot,
      sites: list(args.sites),
      stakes: list(args.stakes),
    });
    if (files.length === 0) {
      console.error('No corpus files matched. Check --corpus-root / --sites / --stakes.');
      process.exit(2);
    }
    const maxFiles = int(args['max-files'], Infinity);
    if (Number.isFinite(maxFiles) && files.length > maxFiles) {
      console.log(`Corpus scan LIMITED to ${maxFiles} of ${files.length} matched file(s).`);
      files = files.slice(0, maxFiles);
    }

    // Built AFTER the slice, for the reason run-hero-ev states: the book must describe the
    // hands the run actually saw, not the ones that matched the filter.
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

    const comboSamples = int(args['combo-samples'], 10);
    const trials = int(args.trials, 200);
    const weightCap = num(args['weight-cap'], 20);

    // WS-433 — worker pass-through. WS-432's logical work-unit clock made the depth-2 arm
    // contention-independent: a parallel ablation at the same seeds is the same
    // measurement as a serial one, so the old WORKER_CONTENTION_SOURCE stamp is retired.
    const { DEFAULT_EQUITY_SEED } = await loader.load('/scripts/backtest/seededEquity.mjs');
    const equitySeed = args['equity-seed'] === 'none'
      ? null
      : int(args['equity-seed'], DEFAULT_EQUITY_SEED);
    const osMod = await import('node:os');
    const workers = args.workers === 'auto'
      ? Math.max(1, osMod.availableParallelism() - 1)
      : int(args.workers, 0);

    const replicationStamp = await buildStampInput({
      loader,
      seeds: {
        clusterBootstrap: DEFAULT_BOOTSTRAP_SEED,
        ...(equitySeed !== null ? { equityMc: equitySeed } : {}),
      },
      // EVERYTHING live in this configuration. The Monte Carlo entry is present only when
      // unseeded. The depth-2 arm's wall-clock and worker-contention entries were RETIRED
      // by WS-432's logical clock; DEPTH_ABLATION_UNSEEDED_SOURCES is kept in the spread
      // because it is the depth-2 arm's own declaration surface — if that arm ever grows a
      // new unseedable source, it lands there and every ablation card inherits it.
      // An `unseededSources` array is a positive claim about reproducibility, so it has to
      // carry everything or it is asserting something false.
      unseededSources: [
        ...(equitySeed === null ? HERO_EV_UNSEEDED_SOURCES : []),
        ...DEPTH_ABLATION_UNSEEDED_SOURCES,
      ],
      dealBookHash: dealBook.contentHash,
      fieldVersion: behaviorPolicy?.provenance?.partition
        ? `behavior-policy@${behaviorPolicy.provenance.partition}/${behaviorPolicy.provenance.observations ?? '?'}obs`
        : null,
      partition: `pool-train@${int(args['pool-pct'], 50)}`,
    });

    // The ablation's own load-bearing constants, stamped ON TOP of the minimum set. These are
    // the settings that DEFINE the two arms — a card without them names a contrast nobody can
    // reconstruct. `constants` is explicitly a floor, not a schema (manifest.js).
    replicationStamp.constants = {
      ...replicationStamp.constants,
      // WS-432: ONE canonical key, an object keyed by arm id. The old suffixed keys
      // (REFINEMENT_BUDGET_MS_DEPTH1/_DEPTH2 here, _FAST/_FULL on the layer-divergence
      // card) were a naming collision the manifest floor could not see through.
      REFINEMENT_BUDGET_MS: { depth1: 0, depth2: refinementMs },
      HERO_POLICY_COMBO_SAMPLES: comboSamples,
      HERO_POLICY_TRIALS: trials,
      IPS_WEIGHT_CAP: weightCap,
    };
    if (replicationStamp.engineDirty) {
      console.log('  WARNING: working tree is dirty — the stamped commit does not identify the code that ran.');
    }

    const reportOpts = { baseArm: 'depth1', testArm: 'depth2', weightCap };

    const partialPath = typeof args.out === 'string' ? `${args.out}.partial` : null;
    let partialWrites = 0;
    const writePartial = (run) => {
      if (!partialPath) return;
      try {
        const report = buildDepthAblationReport(run, reportOpts);
        mkdirSync(dirname(partialPath), { recursive: true });
        writeFileSync(partialPath, JSON.stringify({
          partial: {
            complete: false,
            decisionsScored: run.decisionsScored,
            caveat: 'PARTIAL SNAPSHOT — NOT a validated result and NOT a random subsample. EVAL '
              + 'players are processed sequentially, so this holds every decision of the first '
              + 'players and none of the rest. Do not quote it.',
          },
          report,
          run,
        }, null, 2));
        partialWrites++;
      } catch (err) {
        console.log(`  (partial write skipped: ${err?.message || err})`);
      }
    };

    // WS-393 — the decision-level sidecar. See decisionRecord.mjs for why a run that costs
    // hours must leave behind a record whose shape admits questions nobody asked yet.
    const { openDecisionSink, DECISION_RECORD_SCHEMA_VERSION } = await loader.load('/scripts/backtest/decisionRecord.mjs');
    const sink = typeof args['decisions-out'] === 'string'
      ? openDecisionSink(args['decisions-out'], {
        run: 'depth-ablation',
        dealBookId: dealBook.dealBookId,
        dealBookHash: dealBook.contentHash,
        engineCommit: replicationStamp.engineCommit ?? null,
        engineDirty: replicationStamp.engineDirty ?? null,
        arms: [{ id: 'depth1', refinementBudgetMs: 0 }, { id: 'depth2', refinementBudgetMs: refinementMs }],
        constants: replicationStamp.constants,
        // WS-431 (v2): estimator parameters, imported — see run-hero-ev.mjs.
        estimator: {
          weightCap: DEFAULT_WEIGHT_CAP,
          bootstrapSeed: DEFAULT_BOOTSTRAP_SEED,
          bootstrapResamples: DEFAULT_BOOTSTRAP_RESAMPLES,
          bootstrapAlpha: DEFAULT_BOOTSTRAP_ALPHA,
        },
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
      // THE ABLATION. depth1 is the configuration that actually shipped for the life of the
      // project (WS-334 measured zero depth-2 calls on a live evaluation), so this contrast is
      // between two real configurations, not between production and a hypothetical.
      depthArms: [
        { id: 'depth1', refinementBudgetMs: 0 },
        { id: 'depth2', refinementBudgetMs: refinementMs },
      ],
      primaryArmId: 'depth2',
      // WS-433 pass-through. Since WS-432's logical clock, a parallel ablation at the
      // same seeds is replication-grade — contention no longer changes which stages run.
      equitySeed,
      workers,
      log: (m) => console.log(`  ${m}`),
    });
    run.runtimeMs = Date.now() - started;
    if (sink) {
      const recordRef = sink.close();
      console.log(
        `Decision-level record: ${recordRef?.rowCount ?? sink.count} row(s) in ${sink.path}`
        + (recordRef?.contentHash ? ` (${recordRef.contentHash.slice(0, 19)}…)` : ''),
      );
      if (recordRef?.error) {
        console.log(`  WARNING: record summary/hash failed (${recordRef.error}) — rows on disk are intact, but the card cannot reference this record by hash.`);
      }
      run.decisionRecordPath = sink.path;
      run.decisionRecordRows = recordRef?.rowCount ?? sink.count;
      run.decisionRecord = {
        contentHash: recordRef?.contentHash ?? null,
        rowCount: recordRef?.rowCount ?? sink.count,
        schemaVersion: DECISION_RECORD_SCHEMA_VERSION,
        ...(recordRef?.error ? { error: recordRef.error } : {}),
      };
    }

    const report = buildDepthAblationReport(run, reportOpts);
    console.log(renderDepthAblationReport(report));

    if (typeof args.out === 'string') {
      mkdirSync(dirname(args.out), { recursive: true });
      writeFileSync(args.out, JSON.stringify({ report, run }, null, 2));
      console.log(`\nWrote ${args.out}`);
      if (typeof args.card === 'string' && report.resultCard) {
        mkdirSync(dirname(args.card), { recursive: true });
        writeFileSync(args.card, JSON.stringify(report.resultCard, null, 2));
        console.log(`Wrote ${args.card}`);
      }
      if (partialWrites > 0) {
        try { rmSync(partialPath, { force: true }); } catch { /* the completed file is what matters */ }
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
