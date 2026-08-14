#!/usr/bin/env node
/**
 * backfill-power-ledger.mjs — seed the power ledger from a COMPLETED run artifact (WS-435).
 *
 * WHY THIS EXISTS. The ledger is normally appended by the runners on completion, but the
 * gate would otherwise have no basis until the next multi-hour run finishes — and a real
 * 278-player completed run already sits in `out/`. Backfilling it means the gate opens with
 * a measured basis instead of a one-point extrapolation, on day one.
 *
 * USAGE
 *   node scripts/backtest/backfill-power-ledger.mjs --run out/hero-ev-300p.json --kind hero-ev
 *   node scripts/backtest/backfill-power-ledger.mjs --run out/depth-ablation-X.json --kind depth-ablation \
 *     [--base depth1 --test depth2] [--dir docs/standard-of-record/power]
 *
 * Refuses an incomplete artifact — the same rule `appendLedgerEntry` enforces: a partial
 * basis would understate variance for every future gate.
 */

import { readFileSync } from 'node:fs';
import {
  extractPowerRows, buildLedgerEntry, appendLedgerEntry, POWER_LEDGER_DIR,
} from './powerLedger.mjs';

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

const main = () => {
  const args = parseArgs(process.argv);
  if (typeof args.run !== 'string' || (args.kind !== 'hero-ev' && args.kind !== 'depth-ablation')) {
    console.error('Usage: backfill-power-ledger.mjs --run <artifact.json> --kind hero-ev|depth-ablation [--base <armId> --test <armId>] [--dir <ledger dir>]');
    process.exit(2);
  }
  const artifact = JSON.parse(readFileSync(args.run, 'utf8'));
  const run = artifact.run ?? artifact;
  if (!Array.isArray(run.decisions)) {
    console.error(`Refused: ${args.run} carries no run.decisions — nothing to extract a basis from.`);
    process.exit(2);
  }
  if (run.complete === false) {
    console.error(`Refused: ${args.run} is stamped incomplete — a partial basis would understate variance for every future gate.`);
    process.exit(2);
  }

  const arms = args.kind === 'depth-ablation'
    ? { base: typeof args.base === 'string' ? args.base : 'depth1', test: typeof args.test === 'string' ? args.test : 'depth2' }
    : null;
  const extracted = extractPowerRows(run.decisions, { arms });
  const weightCap = run.replicationStamp?.constants?.IPS_WEIGHT_CAP;
  const entry = buildLedgerEntry({
    run, kind: args.kind, extracted,
    ...(Number.isFinite(weightCap) ? { weightCap } : {}),
  });
  const dir = typeof args.dir === 'string' ? args.dir : POWER_LEDGER_DIR;
  const wrote = appendLedgerEntry({ dir, entry, complete: run.complete !== false });
  if (!wrote.written) {
    console.error(`NOT written — ${wrote.reason}`);
    process.exit(1);
  }
  console.log(`Power ledger: wrote ${wrote.path}`);
  console.log(`  ${entry.players} players, ${entry.decisions} decisions, kind ${entry.kind}`);
  console.log(`  basis: dealBook ${entry.dealBookHash?.slice(0, 20) ?? '—'}… engine ${entry.engineCommit?.slice(0, 8) ?? '—'}${entry.engineDirty ? ' (DIRTY)' : ''}`);
  if (Object.keys(entry.skipped ?? {}).length) console.log(`  unscorable rows skipped: ${JSON.stringify(entry.skipped)}`);
};

main();
