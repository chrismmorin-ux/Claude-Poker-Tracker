#!/usr/bin/env node
/**
 * run-range-calibration.mjs — read-only: are inferred ranges calibrated against the
 * hands players actually showed?
 *
 * USAGE
 *   node scripts/backtest/run-range-calibration.mjs \
 *     --stakes 50NLH --max-files 400 --max-players 600 --out out/range-calibration.json
 *
 *   STANDING METRIC (WS-293) — Result Card + append-only history:
 *     --card out/range-calibration-card.json   write the Result Card beside --out
 *     --record --label "<what changed>"        append a row to the history file. Requires
 *                                              --out (the row must name its evidence file) and
 *                                              refuses an inadmissible run unless
 *                                              --record-inadmissible is passed explicitly.
 *     --history <path>                         override the default history file
 *     --date / --notes                         override the row's date / notes
 *
 *   Parameter sweeps (WS-291) — every arm is scored on the SAME decisions:
 *     --tau-sweep   0.08,0.15,0.25     logistic softness
 *     --floor-sweep 0.01,0.02,0.03,0.05,0.08   minimum P(action | combo)
 *     --support-sweep 0,0.05,0.15,0.40         preflop prior support weight (WS-302);
 *                                              lambda = 0 is the pre-WS-302 chart
 *     --action-tau-sweep 0.3,0.6,1.0,2.0,5.0,20   per-action softness (bucketed by vAction)
 *     --depth-tau-sweep  1.0,1.5,2.0,3.0           depth-tempered chaining; kappa=1.0
 *                                                  reproduces the `chained` numbers exactly
 *     --strength-quintiles                        (WS-303) bucket villain decisions by
 *                                                  where the true hand sits in villain's
 *                                                  pre-narrowing range equity distribution,
 *                                                  split by action, at tau 0.3/1.0/20
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
    const { buildDealBook } = await loader.load('/scripts/backtest/dealBook.mjs');
    const { buildStampInput } = await loader.load('/scripts/backtest/replicationStamp.mjs');
    const {
      buildRangeCalibrationReport, renderRangeCalibrationReport,
      historyRow, appendHistoryRow, historyRunCount, HISTORY_PATH,
      RANGE_CALIBRATION_UNSEEDED_SOURCES,
    } = await loader.load('/scripts/backtest/rangeCalibrationReport.mjs');

    const corpusRoot = typeof args['corpus-root'] === 'string' ? args['corpus-root'] : DEFAULT_CORPUS_ROOT;
    let files = await discoverCorpusFiles({
      root: corpusRoot,
      sites: list(args.sites),
      stakes: list(args.stakes),
    });
    const maxFiles = int(args['max-files'], Infinity);
    if (Number.isFinite(maxFiles) && files.length > maxFiles) {
      console.log(`Corpus scan LIMITED to ${maxFiles} of ${files.length} matched file(s).`);
      files = files.slice(0, maxFiles);
    }
    if (files.length === 0) { console.error('No corpus files matched.'); process.exit(2); }

    const poolPct = int(args['pool-pct'], 50);

    // WS-293: built AFTER the slice, for the reason run-hero-ev states — the book must describe
    // the hands the run actually saw, not the ones that matched the filter.
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
        poolPct,
      },
      identity: args['hash-members'] ? 'content' : 'path+size',
    });
    console.log(`Deal Book ${dealBook.dealBookId} — ${dealBook.memberCount} file(s), ${dealBook.identity}, ${dealBook.contentHash.slice(0, 20)}…`);

    const replicationStamp = await buildStampInput({
      loader,
      // This probe uses NO randomness at all — no Monte Carlo, no sampling, no shuffle. An
      // empty `seeds` with an empty `unseededSources` is therefore a true positive claim of
      // bit-reproducibility, which is exactly what those two fields are for. Do not copy the
      // hero-EV list in here: it names Monte Carlo sources this instrument never reaches.
      seeds: {},
      unseededSources: RANGE_CALIBRATION_UNSEEDED_SOURCES,
      dealBookHash: dealBook.contentHash,
      fieldVersion: 'population-chart-baseline (buildBaselineRange, DEFAULT_CONTINUATION_RATES)',
      // Stated asymmetrically because it IS asymmetric: the acting arm is EVAL-partitioned and
      // the villain arm is keyed by seat and never resolved to a player. A single
      // `pool-train@50` here would assert a discipline only half the run has.
      partition: `acting:eval@poolPct=${poolPct}; villain:seat-keyed-unpartitioned`,
    });
    if (replicationStamp.engineDirty) {
      console.log('  WARNING: working tree is dirty — the stamped commit does not identify the code that ran.');
    }

    const started = Date.now();
    const r = await runRangeCalibrationProbe({
      files,
      poolPct,
      maxPlayers: int(args['max-players'], Infinity),
      maxHandsPerPlayer: int(args['max-hands-per-player'], Infinity),
      tauSweep: list(args['tau-sweep'])?.map(Number) ?? null,
      floorSweep: list(args['floor-sweep'])?.map(Number) ?? null,
      supportSweep: list(args['support-sweep'])?.map(Number) ?? null,
      actionTauSweep: list(args['action-tau-sweep'])?.map(Number) ?? null,
      depthTauSweep: list(args['depth-tau-sweep'])?.map(Number) ?? null,
      strengthQuintiles: Boolean(args['strength-quintiles']),
      log: (m) => console.log(`  ${m}`),
    });

    console.log('\n' + '═'.repeat(76));
    console.log('  RANGE CALIBRATION — does the inferred range contain the hand actually held?');
    console.log('═'.repeat(76));
    console.log(`\n  scanned: ${r.scanned.decisions} postflop decisions, ${r.scanned.players} players, ${r.scanned.handsRead} hands`);
    console.log(`  revealed: acting seat ${r.scanned.revealedActing}, villain seat ${r.scanned.revealedVillain}`);
    if (r.scanned.byTableSize) {
      const bt = r.scanned.byTableSize;
      // Derived from the object's own keys rather than a hardcoded stratum list. The strata
      // changed once already — `hu` was removed when it turned out to be unreachable — and the
      // hardcoded version then printed `hu=undefined` for a stratum that no longer existed.
      const parts = Object.keys(bt).map((k) => `${k}=${bt[k]}`).join('  ');
      console.log(`  villain-seat decisions by table size (WS-311): ${parts}`);
      console.log('    (2-seat hands are skipped upstream at phhAdapter.mjs:268 — they never reach this probe)');
    }
    console.log('\n  coverage = the true hand has NON-ZERO probability in the range.');
    console.log('  retained = share of all possible combos the range kept (the random-elimination baseline).');
    console.log('  lift     = coverage / retained. ~1.0 means the eliminations are effectively arbitrary.');
    console.log('  Δlog     = mean log P(true hand) minus uniform. POSITIVE = the range beats uniform.');

    console.log(table('ACTING SEAT — range tracked by decisionAccumulator', { overall: r.acting.all, ...r.acting.byStreet }));
    console.log(table('ACTING SEAT — by observed action', r.acting.byAction));
    console.log(table('ACTING SEAT — by revealed hand strength', r.acting.byStrength));
    console.log(table('ACTING SEAT — by site (robustness)', r.acting.bySite));
    // WS-292: per-player acting-seat calibration, worst-discriminated first.
    if (Array.isArray(r.actingByPlayer) && r.actingByPlayer.length > 0) {
      const worst = r.actingByPlayer.slice(0, 15);
      console.log(table(
        `ACTING SEAT — by player, worst Δlog first (n≥5; ${r.actingByPlayer.length} players qualify)`,
        Object.fromEntries(worst.map((p) => [p.playerId.slice(0, 12), p])),
      ));
      console.log('  A player near or below Δlog 0 is one whose ACTIONS carry no equity signal for us —');
      console.log('  the range we inferred gave the hand they showed no more weight than a flat range would.');
      console.log('  Read as INPUT to a per-player width fit, not as a fitted parameter: n is small per');
      console.log('  player, and choosing a softness off this table without a sweep is what WS-291/303 undid.');
    }

    console.log(table('VILLAIN SEAT — range the game tree consumes (gameTreeContext:219)', { overall: r.villain.all, ...r.villain.byStreet }));
    console.log(table('VILLAIN SEAT — by villain action', r.villain.byAction));
    if (r.byTableSize) {
      // WS-311: same baseline as above, split by actual dealt-in seat count.
      for (const st of Object.keys(r.byTableSize)) {
        const slice = r.byTableSize[st];
        if (!slice || !Object.keys(slice.byAction || {}).length) continue;
        console.log(table(`VILLAIN SEAT — by action, table size = ${st} (n=${slice.n})`, slice.byAction));
      }
      for (const st of Object.keys(r.byTableSize)) {
        const sweep = r.byTableSize[st]?.actionTauSweep;
        if (!sweep) continue;
        for (const [t, byAction] of Object.entries(sweep)) {
          if (!Object.keys(byAction).length) continue;
          console.log(table(`ACTION TAU SWEEP — table size = ${st}, tau=${t}`, byAction));
        }
      }
    }
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
    if (r.strengthQuintileSweep && Object.keys(r.strengthQuintileSweep).length) {
      // WS-303: does the check branch's discrimination deficit concentrate in the middle
      // quintiles (q2-q4), or spread evenly / sit at a tail?
      for (const [t, byAction] of Object.entries(r.strengthQuintileSweep)) {
        for (const [act, byQuintile] of Object.entries(byAction)) {
          if (!Object.keys(byQuintile).length) continue;
          console.log(table(`STRENGTH QUINTILE (WS-303) — tau=${t} action=${act}`, byQuintile));
        }
      }
    }

    console.log(`\n  runtime ${((Date.now() - started) / 1000).toFixed(1)}s`);
    console.log('═'.repeat(76));

    // ── WS-293: the standing metric. Result Card + history row. ────────────────────────
    const report = buildRangeCalibrationReport(r, {
      replicationStamp, dealBook, poolPct,
    });
    console.log(renderRangeCalibrationReport(report));

    if (typeof args.out === 'string') {
      mkdirSync(dirname(args.out), { recursive: true });
      writeFileSync(args.out, JSON.stringify({ report, probe: r }, null, 2));
      console.log(`\nWrote ${args.out}`);
      if (typeof args.card === 'string' && report.resultCard) {
        mkdirSync(dirname(args.card), { recursive: true });
        writeFileSync(args.card, JSON.stringify(report.resultCard, null, 2));
        console.log(`Wrote ${args.card}`);
      }
    }

    if (args.record) {
      // A row must name the evidence file it was read from, so --record requires --out. The
      // rule is inherited from scorecard-history.yaml's header: "A row without a source is not
      // admissible evidence."
      if (typeof args.out !== 'string') {
        console.error('Refused: --record requires --out. A history row must name the evidence file its metrics were read from.');
        process.exit(2);
      }
      if (typeof args.label !== 'string') {
        console.error('Refused: --record requires --label. A row nobody can identify is not evidence.');
        process.exit(2);
      }
      if (!report.admissibility.admissible && !args['record-inadmissible']) {
        // Deliberately not overridable by accident. `run-hero-ev`'s --from refuses an
        // inadmissible report outright; this keeps the same bar while leaving an explicit,
        // named escape for recording a smoke run AS a smoke run.
        console.error('Refused: the run is NOT admissible and would enter the series as if it were.');
        for (const b of report.admissibility.blockers) console.error(`  BLOCKER - ${b}`);
        console.error('Pass --record-inadmissible to record it anyway; the row carries admissible: false.');
        process.exit(2);
      }
      const historyPath = typeof args.history === 'string' ? args.history : HISTORY_PATH;
      const row = historyRow(report, {
        label: args.label,
        source: args.out,
        date: typeof args.date === 'string' ? args.date : undefined,
        notes: typeof args.notes === 'string' ? args.notes : undefined,
      });
      appendHistoryRow(historyPath, row);
      console.log(`\nAppended run ${historyRunCount(historyPath)} to ${historyPath}`);
    }
  } finally {
    await loader.close();
  }
};

main().catch((e) => { console.error(e?.stack || String(e)); process.exit(1); });
