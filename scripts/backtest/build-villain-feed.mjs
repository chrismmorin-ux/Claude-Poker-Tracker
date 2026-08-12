#!/usr/bin/env node
/**
 * build-villain-feed.mjs — build the WS-436 B2 styled-villain feed artifact.
 *
 * USAGE
 *   node scripts/backtest/build-villain-feed.mjs --reference out/pool-reference.json \
 *     [--out out/villain-feed.json] [--max-villains 5000] [--max-hands-per-villain 200] \
 *     [--pool-pct 50] [--stakes 50NLH]
 *
 * `--reference` is required (pass `none` to fall back to the founder-estimate
 * tier) for the same reason the runner requires it: a feed whose priors have an
 * undeclared basis cannot say what its shrunk posteriors shrink toward.
 *
 * See villainFeed.mjs for the partition discipline (POOL only) and the
 * oracle-prefix semantics the artifact carries.
 */

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { openLoader } from './loader.mjs';
import { REFERENCE_DISABLED } from './leakageGuard.mjs';
import { discoverCorpusFiles, DEFAULT_CORPUS_ROOT } from './corpusFiles.mjs';

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
const int = (v, d) => (v === undefined ? d : Number.parseInt(v, 10));
const list = (v) => (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : null);

const main = async () => {
  const args = parseArgs(process.argv);
  if (args.reference === undefined) {
    throw new Error('Missing --reference. Pass a POOL table path or `--reference none`.');
  }
  const referenceTable = (args.reference === 'none' || args.reference === true)
    ? null
    : JSON.parse(readFileSync(args.reference, 'utf8'));
  // Reuse the guard's validation of a stamped table when one is supplied.
  if (referenceTable) {
    const { LeakageGuard } = await import('./leakageGuard.mjs');
    void new LeakageGuard({ poolPct: int(args['pool-pct'], 50), reference: referenceTable });
  } else {
    void REFERENCE_DISABLED;
  }

  const files = await discoverCorpusFiles({
    root: args['corpus-root'] || DEFAULT_CORPUS_ROOT,
    stakes: list(args.stakes) || ['50NLH'],
  });
  console.log(`corpus: ${files.length} file(s)`);

  const loader = await openLoader(process.cwd());
  try {
    const { buildVillainFeed } = await loader.load('/scripts/backtest/villainFeed.mjs');
    const feed = await buildVillainFeed({
      files,
      referenceTable,
      poolPct: int(args['pool-pct'], 50),
      maxVillains: int(args['max-villains'], Infinity),
      maxHandsPerVillain: int(args['max-hands-per-villain'], 200),
      log: (m) => console.log(m),
    });
    const out = typeof args.out === 'string' ? args.out : 'out/villain-feed.json';
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(feed));
    console.log(`Wrote ${out} — ${Object.keys(feed.players).length} POOL villains.`);
  } finally {
    await loader.close();
  }
};

main().catch((e) => { console.error(`\n${e.message}\n`); process.exit(1); });
