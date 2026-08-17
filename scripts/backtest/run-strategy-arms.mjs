#!/usr/bin/env node
/**
 * run-strategy-arms.mjs — score an externally-published strategy on the engine's own metric.
 *
 * *** PROTOTYPE (WS-425). Two TRIVIAL control arms, no published content yet. ***
 *
 * The point of this script at this stage is to demonstrate the plumbing end to end rather
 * than describe it: a policy that is not the engine, evaluated at the same decisions, through
 * the same importance-sampling estimator, producing a number in bb on the same axis as
 * `edgeBB`. The arms it ships with are `always-fold` and `uniform` — neither is poker content
 * and both have a sign known in advance, which is exactly what makes them a plumbing proof.
 *
 * USAGE — the same refusals as run-hero-ev.mjs, for the same reasons.
 *
 *   node scripts/backtest/run-strategy-arms.mjs \
 *     --reference none \
 *     --behavior-policy out/behavior-policy.json \
 *     --stakes 50NLH --max-files 4 --max-players 12 --max-decisions 60 \
 *     --out out/strategy-arms-smoke.json
 *
 * COST. Strategy arms are free — pure functions of the decision, no engine call. The whole
 * cost of a run is the ENGINE arm, which exists so there is something to compare against and
 * so that a strategy arm falling back at an uncovered decision has somewhere to fall back to.
 * `--refinement-ms 0` (the default here) runs the engine at depth-1, which is both the
 * cheapest configuration and the only one with no wall-clock dependence.
 *
 * WHAT THE THREE NUMBERS MEAN, in the order they print:
 *   - each arm's own `edgeBB` against the field, from `estimateEdge`;
 *   - the PAIRED delta of a strategy arm against the engine arm, from `pairedDelta`, which
 *     is the well-determined figure because the population term differences away;
 *   - `coveredShare` per strategy arm, without which neither of the above can be read: an
 *     arm that covers 30% of decisions and falls back to the engine on the rest has an
 *     edge diluted by construction, and the paired delta's `discordantN` is its honest n.
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

const bb = (v) => (v === null || v === undefined ? '   n/a' : `${v >= 0 ? '+' : ''}${v.toFixed(4)}`);

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
    console.error(
      'Refused: --behavior-policy is required. pi_pool is the denominator of every\n'
      + 'importance weight; an unstated propensity source would silently decide the result.',
    );
    process.exit(2);
  }
  const behaviorPolicy = JSON.parse(readFileSync(args['behavior-policy'], 'utf8'));

  let rakeConfig = { pct: 0.05, cap: 3, noFlopNoDrop: true };
  if (args.rake === 'none') rakeConfig = null;

  const loader = await openLoader(process.cwd());
  try {
    const { discoverCorpusFiles, applyFileCap, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
    const { runHeroEv } = await loader.load('/scripts/backtest/heroEvRunner.mjs');
    const { estimateEdge } = await loader.load('/scripts/backtest/ipsEstimator.mjs');
    const { pairedDelta } = await loader.load('/scripts/backtest/depthAblationReport.mjs');
    const { ALWAYS_FOLD, UNIFORM, fromStrategyCard } = await loader.load('/scripts/backtest/strategyArm.mjs');
    const { loadStrategyCard } = await loader.load('/src/utils/standardOfRecord/strategyCard.js');
    const { plumbingProofCard } = await loader.load('/scripts/backtest/fixtures/plumbingProof.card.js');

    // Through the REAL loader, not a hand-rolled parse: a card arm that bypassed validation
    // would be scoring an object the Standard of Record would have rejected.
    // ASYNC loader, not the sync one: only `loadStrategyCard` computes the content hash, and a
    // card arm without it produces a Result Card that cannot say WHICH version of the strategy
    // was scored. The sync loader is for callers that do not persist a claim.
    const card = await loadStrategyCard(plumbingProofCard);
    const cardArm = fromStrategyCard(card, {
      sourceRef: 'fixture:scripts/backtest/fixtures/plumbingProof.card.js — NOT published content',
    });
    console.log(`Card arm: ${cardArm.id} (${cardArm.cardTitle}) — handClass rules: ${cardArm.needsHand}`);

    let files = await discoverCorpusFiles({
      root: typeof args['corpus-root'] === 'string' ? args['corpus-root'] : DEFAULT_CORPUS_ROOT,
      sites: list(args.sites),
      stakes: list(args.stakes),
    });
    if (files.length === 0) {
      console.error('No corpus files matched. Check --corpus-root / --sites / --stakes.');
      process.exit(2);
    }
    const maxFiles = int(args['max-files'], Infinity);
    // WS-504: draws proportionally across directories; a sorted prefix read one site.
    ({ files } = applyFileCap(files, { maxFiles }));

    const weightCap = num(args['weight-cap'], 20);
    const refinementMs = int(args['refinement-ms'], 0);

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
      // The engine arm comes first and is the primary — it is what supplies perCombo and
      // evStats, which no strategy arm can. `always-fold` abstains wherever folding is not a
      // legal response and falls back to the engine there, so the decision set is IDENTICAL
      // to what a plain single-arm hero-EV run would have scored.
      depthArms: [
        { id: 'engine', refinementBudgetMs: refinementMs },
        { id: 'always-fold', strategy: ALWAYS_FOLD, fallback: 'engine' },
        { id: 'uniform', strategy: UNIFORM, fallback: 'engine' },
        // The Strategy Card arm. `fallback: 'pool'` on purpose, so the two abstention rulings
        // are BOTH exercised in one run and can be read against each other.
        { id: 'card', strategy: cardArm, fallback: 'pool' },
      ],
      primaryArmId: 'engine',
      log: (m) => console.log(`  ${m}`),
    });
    run.runtimeMs = Date.now() - started;

    const d = run.decisions;
    const armIds = ['engine', 'always-fold', 'uniform', 'card'];
    const edges = {};
    for (const id of armIds) {
      edges[id] = estimateEdge(
        d.filter((x) => x.piOursByArm?.[id]).map((x) => ({ ...x, piOurs: x.piOursByArm[id] })),
        { weightCap, label: `arm ${id}` },
      );
    }
    const deltas = {};
    for (const id of ['always-fold', 'uniform', 'card']) {
      deltas[id] = pairedDelta(d, { baseArm: 'engine', testArm: id, weightCap });
    }

    const out = {
      prototype: true,
      caveat:
        'PROTOTYPE (WS-425). The strategy arms here are TRIVIAL CONTROLS, not published '
        + 'poker content. The figures demonstrate that a non-engine policy scores end to end '
        + 'on the engine\'s own metric; they say nothing about poker.',
      runtimeMs: run.runtimeMs,
      decisionsScored: run.decisionsScored,
      config: run.config,
      strategyCoverage: run.strategyCoverage,
      counters: run.counters,
      edges,
      pairedDeltas: deltas,
    };

    console.log('\n═══ STRATEGY-ARM PROTOTYPE ═══════════════════════════════════');
    console.log(`  decisions scored : ${run.decisionsScored}   players: ${edges.engine.players}   runtime: ${(run.runtimeMs / 1000).toFixed(1)}s`);
    console.log('\n  ARM EDGES vs the field (bb per hand-at-decision)');
    for (const id of armIds) {
      const e = edges[id];
      console.log(`    ${id.padEnd(13)} edge ${bb(e.edgeBB)}  [${bb(e.edgeCiLowBB)}, ${bb(e.edgeCiHighBB)}]  n=${e.n} ESS=${e.ess} (${((e.essShare ?? 0) * 100).toFixed(1)}%)`);
    }
    console.log('\n  PAIRED DELTA vs the engine arm (the well-determined figure)');
    for (const id of ['always-fold', 'uniform', 'card']) {
      const p = deltas[id];
      console.log(`    ${id.padEnd(13)} delta ${bb(p.deltaBB)}  [${bb(p.deltaCiLowBB)}, ${bb(p.deltaCiHighBB)}]  n=${p.n} discordant=${p.discordantN} (${((p.discordantShare ?? 0) * 100).toFixed(1)}%)`);
    }
    console.log('\n  COVERAGE — without this neither figure above can be read');
    for (const [id, c] of Object.entries(run.strategyCoverage ?? {})) {
      if (!c) { console.log(`    ${id.padEnd(13)} no decisions`); continue; }
      console.log(`    ${id.padEnd(13)} covered ${(c.coveredShare * 100).toFixed(1)}% (${c.covered}/${c.n})  fellBackToEngine=${c.fellBackToEngine}  realisedMarginal=${JSON.stringify(c.realisedMarginal)}`);
    }
    console.log('\n  NO RESULT CARD IS PRODUCED. This is a prototype run against a truncated');
    console.log('  corpus slice with control arms; per ADR-009 it makes no comparative claim.');
    console.log('══════════════════════════════════════════════════════════════\n');

    if (typeof args.out === 'string') {
      mkdirSync(dirname(args.out), { recursive: true });
      writeFileSync(args.out, JSON.stringify(out, null, 2));
      console.log(`Wrote ${args.out}`);
    }
  } finally {
    await loader.close();
  }
};

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
