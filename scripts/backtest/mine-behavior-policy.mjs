#!/usr/bin/env node
/**
 * mine-behavior-policy.mjs — mine pi_pool from the POOL half of the corpus.
 *
 * pi_pool is the propensity with which the field takes each action at a decision node.
 * It sits in the DENOMINATOR of every importance weight the hero-EV instrument
 * computes, which makes it as load-bearing as the outcomes themselves and gives it the
 * same leakage exposure: fitting it on players the instrument scores would make the
 * weights a function of the evaluation set.
 *
 * So it is mined from POOL players only, stamped `pool-train`, and the scoring run
 * refuses to start without an explicitly supplied table — the same discipline
 * `run.mjs` applies to the reference table, for the same reason.
 *
 * USAGE
 *   node scripts/backtest/mine-behavior-policy.mjs \
 *     --stakes 50NLH --max-players 400 --max-hands-per-player 200 \
 *     --out out/behavior-policy.json
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

const main = async () => {
  const args = parseArgs(process.argv);
  const poolPct = int(args['pool-pct'], 50);
  const outPath = typeof args.out === 'string' ? args.out : 'out/behavior-policy.json';

  const loader = await openLoader(process.cwd());
  try {
    const { discoverCorpusFiles, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
    const { minePolicyObservations } = await loader.load('/scripts/backtest/behaviorPolicyMiner.mjs');

    const files = await discoverCorpusFiles({
      root: typeof args['corpus-root'] === 'string' ? args['corpus-root'] : DEFAULT_CORPUS_ROOT,
      sites: list(args.sites),
      stakes: list(args.stakes),
    });
    if (files.length === 0) {
      console.error('No corpus files matched. Check --corpus-root / --sites / --stakes.');
      process.exit(2);
    }
    console.log(`Mining behaviour policy from ${files.length} file(s), POOL half at ${poolPct}%…`);

    const table = await minePolicyObservations({
      files,
      poolPct,
      maxPlayers: int(args['max-players'], Infinity),
      maxHandsPerPlayer: int(args['max-hands-per-player'], Infinity),
      stakes: list(args.stakes) || ['*'],
      log: (m) => console.log(`  ${m}`),
    });

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(table));

    const p = table.provenance;
    console.log(`\nWrote ${outPath}`);
    console.log(`  partition   ${p.partition} @ poolPct=${p.poolPct}`);
    console.log(`  players     ${p.players}`);
    console.log(`  decisions   ${p.observations}`);
    console.log(`  skipped     ${JSON.stringify(p.skipped)}`);
    console.log(`  hierarchy   ${p.hierarchy.join(' > ')}`);
  } finally {
    await loader.close();
  }
};

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
