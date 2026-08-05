#!/usr/bin/env node
/**
 * run-teachable-arms.mjs — read-only: how close does a human-memorable narrowing rule get
 * to the shipped engine's `narrowByBoard`, scored on the same villain decisions?
 *
 * Five arms (A0 no narrowing, A1 engine as shipped, A2 legacy bucket-multiplier table, A3
 * measured 3-class likelihood ratio, A4 A3 + check-position split). A3/A4 are estimated on
 * POOL players and scored on EVAL players only — see teachableArmsProbe.mjs for the full
 * leakage-control rationale.
 *
 * USAGE
 *   node scripts/backtest/run-teachable-arms.mjs \
 *     --sites FTP --max-files 250 --max-players 350 --out out/teachable-arms-ftp.json
 *
 *   --sites            comma-separated corpus site codes (e.g. FTP,PS)
 *   --stakes           comma-separated stake labels (default: all)
 *   --corpus-root      override the corpus root (else $HANDHQ_CORPUS_ROOT, else G16 path)
 *   --max-files        cap on corpus files scanned
 *   --max-players      cap on players indexed PER GROUP (POOL and EVAL each get up to this
 *                       many — not a shared budget)
 *   --pool-pct         percent of players routed to POOL (default 50)
 *   --max-hands-per-player
 *   --out              write full JSON (arms summary + mined likelihood tables) here
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

const armsTable = (arms) => {
  const L = ['\n  ARMS — deltaLogVsUniform (higher = better; A0 is the floor, A1 is the reference ceiling)',
    '  ' + '─'.repeat(78),
    `  ${'arm'.padEnd(6)} ${'n'.padStart(6)}  ${'coverage'.padStart(8)}  ${'retained'.padStart(9)}  ${'lift'.padStart(6)}  ${'Δlog'.padStart(8)}`];
  for (const k of ['A0', 'A1', 'A2', 'A3', 'A4']) {
    const s = arms[k];
    L.push(s
      ? `  ${k.padEnd(6)} ${String(s.n).padStart(6)}  ${pct(s.coverage).padStart(8)}  ${pct(s.retainedFraction).padStart(9)}  ${f3(s.coverageLift).padStart(6)}  ${f3(s.deltaLogVsUniform).padStart(8)}`
      : `  ${k.padEnd(6)} —`);
  }
  return L.join('\n');
};

const likelihoodTable = (title, t, actions) => {
  const L = [`\n  ${title}`, '  ' + '─'.repeat(78),
    `  ${'action'.padEnd(12)} ${'class'.padEnd(8)} ${'n'.padStart(6)} ${'classN'.padStart(7)}  ${'P(a|c)'.padStart(7)}  ${'baseRate'.padStart(8)}  ${'ratio'.padStart(6)}  ${'OR'.padStart(6)}`];
  for (const a of actions) {
    for (const c of ['strong', 'medium', 'weak']) {
      const cell = t.table[a][c];
      L.push(`  ${a.padEnd(12)} ${c.padEnd(8)} ${String(cell.n).padStart(6)} ${String(cell.classTotal).padStart(7)}  ${pct(cell.p).padStart(7)}  ${pct(cell.baseRate).padStart(8)}  ${f3(cell.ratioToBase).padStart(6)}  ${f3(cell.oddsRatio).padStart(6)}`);
    }
  }
  return L.join('\n');
};

const main = async () => {
  const args = parseArgs(process.argv);
  const loader = await openLoader(process.cwd());
  try {
    const { discoverCorpusFiles } = await loader.load('/scripts/backtest/corpusFiles.mjs');
    const { runTeachableArmsProbe } = await loader.load('/scripts/backtest/teachableArmsProbe.mjs');

    let files = await discoverCorpusFiles({
      root: typeof args['corpus-root'] === 'string' ? args['corpus-root'] : undefined,  // WS-321
      sites: list(args.sites),
      stakes: list(args.stakes),
    });
    const maxFiles = int(args['max-files'], Infinity);
    if (Number.isFinite(maxFiles) && files.length > maxFiles) {
      console.log(`Corpus scan LIMITED to ${maxFiles} of ${files.length} matched file(s).`);
      files = files.slice(0, maxFiles);
    }
    if (files.length === 0) { console.error('No corpus files matched.'); process.exit(2); }

    const maxPlayers = int(args['max-players'], Infinity);
    const started = Date.now();
    const r = await runTeachableArmsProbe({
      files,
      poolPct: int(args['pool-pct'], 50),
      maxPlayersPool: maxPlayers,
      maxPlayersEval: maxPlayers,
      maxHandsPerPlayer: int(args['max-hands-per-player'], Infinity),
      log: (m) => console.log(`  ${m}`),
    });

    console.log('\n' + '═'.repeat(80));
    console.log(`  TEACHABLE ARMS — sites=${list(args.sites) ?? 'all'} stakes=${list(args.stakes) ?? 'all'}`);
    console.log('═'.repeat(80));
    console.log(`\n  hands read: ${r.handsRead}`);
    console.log(`  players — POOL: ${r.nPlayersPool}   EVAL: ${r.nPlayersEval}`);
    console.log(`  POOL decisions mined for A3/A4 tables: ${r.nMinedDecisions}`);
    console.log(`  EVAL decisions scored (all 5 arms, paired): ${r.nScoredDecisions}`);

    console.log(armsTable(r.arms));
    console.log(likelihoodTable('A3 LIKELIHOOD TABLE (POOL-mined) — P(action | class), 4 actions x 3 classes', r.a3Table, ['raise', 'call', 'check', 'bet']));
    console.log(likelihoodTable('A4 LIKELIHOOD TABLE (POOL-mined) — P(action | class), 5 actions x 3 classes', r.a4Table, ['raise', 'call', 'check-back', 'check-OOP', 'bet']));

    console.log(`\n  runtime ${((Date.now() - started) / 1000).toFixed(1)}s`);
    console.log('═'.repeat(80));

    if (typeof args.out === 'string') {
      mkdirSync(dirname(args.out), { recursive: true });
      writeFileSync(args.out, JSON.stringify(r, null, 2));
      console.log(`\nWrote ${args.out}`);
    }
  } finally {
    await loader.close();
  }
};

main().catch((e) => { console.error(e?.stack || String(e)); process.exit(1); });
