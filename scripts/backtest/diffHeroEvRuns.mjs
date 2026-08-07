/**
 * diffHeroEvRuns.mjs — the WS-433 determinism gate, as a tool.
 *
 * Loads two `--out` artifacts (the `{ report, run }` blobs `run-hero-ev.mjs` writes),
 * strips fields that describe HOW a run executed rather than WHAT it measured, and
 * compares sha256 of the canonicalized remainder. Exit 0 = identical measurement;
 * exit 1 = the runs differ; exit 2 = usage/read error.
 *
 * Template: ignition-poker-tracker/test/replay/replay-determinism.mjs (two-run hash gate).
 *
 * WHAT IS STRIPPED, and why each is legitimate to strip:
 *   - timing fields (`elapsed`, `atMs`, `computeMs`, `totalMs`, `runtimeMs`) — wall-clock
 *     observations, not measurements; the engine's OUTPUT must not read them (a diff that
 *     needed them stripped anywhere else would be a real difference).
 *   - `config.workers`, `config.chunkDir`, `config.resumedWaves`, `config.resumedEngineDirty`,
 *     and `replicationStamp.constants.HERO_EV_WORKERS` — execution transport. The
 *     bit-identity claim is precisely that these cannot reach the measurement. (For a
 *     REFINED run the worker count does reach the measurement — through contention — but
 *     there the stamped `unseededSources` differ too, which this tool does NOT strip, so
 *     a refined serial-vs-parallel pair still reports DIFFER on the claim itself.)
 *     (`config.waveSize` is NOT stripped: it shapes the admitted work set when a stop
 *     rule fires, so two runs at different wave sizes are only conditionally comparable
 *     and the tool must say so rather than hide it.)
 *   - `decisionRecordPath` / `decisionRecordRows` — sidecar bookkeeping.
 *
 * Usage: node scripts/backtest/diffHeroEvRuns.mjs <a.json> <b.json>
 */

import fs from 'node:fs';
import { createHash } from 'node:crypto';

const TIMING_KEYS = new Set(['elapsed', 'atMs', 'computeMs', 'totalMs', 'runtimeMs']);
const EXECUTION_CONFIG_KEYS = new Set(['workers', 'chunkDir', 'resumedWaves', 'resumedEngineDirty']);

const strip = (v, path = '') => {
  if (Array.isArray(v)) return v.map((x) => strip(x, path));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (TIMING_KEYS.has(k)) continue;
      if (path === '.run.config' && EXECUTION_CONFIG_KEYS.has(k)) continue;
      if (path === '.run' && (k === 'decisionRecordPath' || k === 'decisionRecordRows')) continue;
      if (path === '.run.replicationStamp.constants' && k === 'HERO_EV_WORKERS') continue;
      out[k] = strip(x, `${path}.${k}`);
    }
    return out;
  }
  return v;
};

const load = (p) => {
  const blob = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!blob.run) throw new Error(`${p} carries no run — is it a run-hero-ev --out artifact?`);
  return blob;
};

const main = () => {
  const [a, b] = process.argv.slice(2);
  if (!a || !b) {
    console.error('usage: node scripts/backtest/diffHeroEvRuns.mjs <a.json> <b.json>');
    process.exit(2);
  }
  const [A, B] = [load(a), load(b)];

  const wsA = A.run.config?.waveSize;
  const wsB = B.run.config?.waveSize;
  if (wsA !== wsB) {
    console.log(`NOTE: waveSize differs (${wsA} vs ${wsB}) — comparable only if no stop rule fired mid-enumeration.`);
  }

  const canonical = (blob) => JSON.stringify(strip({ run: blob.run }, ''));
  const hA = createHash('sha256').update(canonical(A)).digest('hex');
  const hB = createHash('sha256').update(canonical(B)).digest('hex');

  if (hA === hB) {
    console.log(`IDENTICAL (sha256 ${hA})`);
    process.exit(0);
  }

  console.log(`DIFFER\n  ${a}: ${hA}\n  ${b}: ${hB}`);
  // Locate the first divergence coarsely so the reader has somewhere to start.
  const oA = strip({ run: A.run }, '');
  const oB = strip({ run: B.run }, '');
  const sections = ['decisions', 'counters', 'integrity', 'config', 'fieldAnchor', 'strategyCoverage'];
  for (const s of sections) {
    const ja = JSON.stringify(oA.run?.[s] ?? null);
    const jb = JSON.stringify(oB.run?.[s] ?? null);
    if (ja !== jb) console.log(`  first differing section: run.${s}`);
  }
  process.exit(1);
};

main();
