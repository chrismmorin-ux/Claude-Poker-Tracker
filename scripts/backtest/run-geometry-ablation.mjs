#!/usr/bin/env node
/**
 * run-geometry-ablation.mjs — WS-333 Part D / AS-711.
 *
 * USAGE
 *   node scripts/backtest/run-geometry-ablation.mjs \
 *     --stakes 50NLH --max-files 8 --max-players 80 --out out/ws333-geometry.json
 *
 * Builds every ladder from the POOL half and scores all of them on the EVAL half, paired on
 * the same decisions. The partition is the existing `partition.mjs` player split, so a
 * player never appears on both sides — the same structural leakage guard the rest of the
 * harness runs under.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openLoader } from './loader.mjs';
import { GROUPS } from './partition.mjs';

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

const main = async () => {
  const args = parseArgs(process.argv);
  const loader = await openLoader(process.cwd());
  try {
    const { discoverCorpusFiles, applyFileCap, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
    const { minePolicyObservations } = await loader.load('/scripts/backtest/behaviorPolicyMiner.mjs');
    const { runGeometryAblation, renderGeometryAblation } = await loader.load('/scripts/backtest/geometryAblation.mjs');

    let files = await discoverCorpusFiles({
      root: typeof args['corpus-root'] === 'string' ? args['corpus-root'] : DEFAULT_CORPUS_ROOT,
      sites: list(args.sites),
      stakes: list(args.stakes),
    });
    const maxFiles = int(args['max-files'], Infinity);
    // WS-504: draws proportionally across directories; a sorted prefix read one site.
    ({ files } = applyFileCap(files, { maxFiles }));

    const common = {
      files,
      poolPct: int(args['pool-pct'], 50),
      maxPlayers: int(args['max-players'], Infinity),
      maxHandsPerPlayer: int(args['max-hands-per-player'], Infinity),
      rawObservations: true,
      log: (m) => console.log(`  ${m}`),
    };

    console.log('Mining POOL half (ladders are BUILT from this)...');
    const trainObs = await minePolicyObservations({ ...common, group: GROUPS.POOL });
    console.log('Mining EVAL half (every ladder is SCORED on this)...');
    const evalObs = await minePolicyObservations({ ...common, group: GROUPS.EVAL });

    if (!trainObs.length || !evalObs.length) {
      console.error(`Refused: need both halves (pool=${trainObs.length}, eval=${evalObs.length}). `
        + 'Widen --max-files / --max-players.');
      process.exit(2);
    }

    const report = runGeometryAblation({ trainObs, evalObs });
    console.log(renderGeometryAblation(report));

    if (typeof args.out === 'string') {
      mkdirSync(dirname(args.out), { recursive: true });
      writeFileSync(args.out, JSON.stringify({
        report,
        provenance: {
          trainObservations: trainObs.length,
          evalObservations: evalObs.length,
          poolPct: common.poolPct,
          sites: list(args.sites),
          stakes: list(args.stakes),
          maxFiles: Number.isFinite(maxFiles) ? maxFiles : null,
        },
      }, null, 2));
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
