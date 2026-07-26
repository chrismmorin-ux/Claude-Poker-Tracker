#!/usr/bin/env node
/**
 * run.mjs — WS-273 backtest CLI.
 *
 * Thin bootstrap. Opens the Vite SSR loader (so the harness can import the real
 * engine) and hands off to `runner.mjs`.
 *
 * USAGE
 *   node scripts/backtest/run.mjs --reference none --stakes 200NLH --max-players 50
 *   node scripts/backtest/run.mjs --reference out/pool-reference.json --sweep
 *
 * REQUIRED
 *   --reference <path|none>   POOL-partition reference table, or the explicit
 *                             `none` sentinel to run with the Reference tier off.
 *                             There is no default: the SHIPPED table was mined
 *                             from the whole corpus and using it here would leak
 *                             into every scored hand. Produce a POOL table with
 *                             scripts/backtest/mine-pool-reference.py.
 *
 * OPTIONS
 *   --corpus-root <path>      default C:/Users/chris/data/phh-dataset/data/handhq
 *   --sites PS,FTP            filter by site
 *   --stakes 200NLH,400NLH    filter by stake
 *   --max-players N           cap eval players (cost is quadratic per player)
 *   --max-hands-per-player N  cap hands per player
 *   --min-train-hands N       default 15
 *   --checkpoint-interval N   default 10
 *   --hierarchy <variant>     shipped | texture-last | flat | min-n-1
 *   --sweep                   run every hierarchy variant and report deltas
 *   --pool-pct N              default 50
 *   --out <path>              write the scorecard JSON here
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openLoader } from './loader.mjs';
import { REFERENCE_DISABLED } from './leakageGuard.mjs';
import {
  ALL_VARIANTS,
  HIERARCHY_VARIANTS,
  buildAblationArms,
  DIMENSION_LABELS,
} from './hierarchyVariants.mjs';
import { discoverCorpusFiles, DEFAULT_CORPUS_ROOT } from './corpusFiles.mjs';

const parseArgs = (argv) => {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
};

const list = (v) => (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : null);
const int = (v, fallback) => (v === undefined ? fallback : Number.parseInt(v, 10));

const loadReference = (spec) => {
  if (spec === undefined) {
    throw new Error(
      'Missing --reference. Pass a POOL-partition table path, or `--reference none`\n' +
      'to run with the Reference tier disabled. There is deliberately no default:\n' +
      'the shipped reference table was mined from the entire corpus, so using it to\n' +
      'score that corpus would measure memorisation (WS-273 acceptance gate).',
    );
  }
  if (spec === REFERENCE_DISABLED || spec === true) return REFERENCE_DISABLED;
  return JSON.parse(readFileSync(spec, 'utf8'));
};

const main = async () => {
  const args = parseArgs(process.argv);
  const log = (msg) => console.log(msg);

  const reference = loadReference(args.reference);

  const files = await discoverCorpusFiles({
    root: args['corpus-root'] || DEFAULT_CORPUS_ROOT,
    sites: list(args.sites),
    stakes: list(args.stakes),
  });
  log(`Discovered ${files.length} corpus file(s).`);

  const loader = await openLoader(process.cwd());
  try {
    const { runBacktest } = await loader.load('/scripts/backtest/runner.mjs');
    const { buildScorecard, renderScorecard, compareScorecards, buildAblationReport, renderAblation } =
      await loader.load('/scripts/backtest/reporter.mjs');

    const baseOpts = {
      files,
      reference,
      poolPct: int(args['pool-pct'], 50),
      maxPlayers: int(args['max-players'], Infinity),
      maxHandsPerPlayer: int(args['max-hands-per-player'], Infinity),
      minTrainHands: int(args['min-train-hands'], 15),
      checkpointInterval: int(args['checkpoint-interval'], 10),
      log,
    };

    // --ablate answers "what should I be paying attention to at the table":
    // every dimension scored alone and scored-by-omission, in ONE pass over the
    // corpus (all arms share the model and the decision contexts).
    if (args.ablate) {
      const arms = buildAblationArms();
      log(`\n── ablation: ${arms.length} arms in a single pass ──`);
      const run = await runBacktest({ ...baseOpts, arms });

      const ablation = buildAblationReport(run);
      console.log(renderAblation(ablation, DIMENSION_LABELS));

      // Full scorecard for the shipped arm, so the run also yields a baseline.
      const shippedCard = buildScorecard({ ...run, records: run.recordsByArm.shipped ?? run.records });
      console.log(renderScorecard(shippedCard));

      const perArm = Object.fromEntries(
        run.arms.map(a => {
          const recs = run.recordsByArm[a.name] || [];
          const card = buildScorecard({ ...run, records: recs });
          return [a.name, { overall: card.overall, fallbackQuality: card.fallbackQuality }];
        }),
      );

      const out = { ablation, shippedScorecard: shippedCard, perArm };
      if (typeof args.out === 'string') {
        mkdirSync(dirname(args.out), { recursive: true });
        writeFileSync(args.out, JSON.stringify(out, null, 1));
        log(`Wrote ${args.out}`);
      }
      return;
    }

    const variants = args.sweep
      ? ALL_VARIANTS
      : [args.hierarchy || HIERARCHY_VARIANTS.SHIPPED];

    const cards = [];
    for (const variant of variants) {
      log(`\n── hierarchy variant: ${variant} ──`);
      const run = await runBacktest({ ...baseOpts, hierarchyVariant: variant });
      const card = buildScorecard(run);
      cards.push(card);
      console.log(renderScorecard(card));
    }

    const output = {
      scorecards: cards,
      comparisons: cards.length > 1
        ? cards.slice(1).map(c => compareScorecards(cards[0], c))
        : [],
    };

    if (typeof args.out === 'string') {
      mkdirSync(dirname(args.out), { recursive: true });
      writeFileSync(args.out, JSON.stringify(output, null, 1));
      log(`Wrote ${args.out}`);
    }
  } finally {
    await loader.close();
  }
};

main().catch((err) => {
  console.error(`\n${err.message}\n`);
  process.exitCode = 1;
});
