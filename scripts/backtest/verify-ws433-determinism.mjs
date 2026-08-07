/**
 * verify-ws433-determinism.mjs — the WS-433 determinism gates, as a committed tool.
 *
 * Three gates, each a falsifier for a property the parallel harness claims:
 *   1. SERIAL SELF-IDENTITY  — two seeded serial runs (budget 0) are bit-identical.
 *      (False before WS-433: unseeded Math.random MC made serial differ from itself.)
 *   2. PARALLEL BIT-IDENTITY — workers=N output equals workers=0 output exactly.
 *      (The claim that transport cannot reach the measurement.)
 *   3. RESUME IDENTITY       — a run reassembled from chunks equals an uninterrupted
 *      run, and a tampered chunk stamp is REFUSED.
 *
 * Timing fields and execution-transport config are stripped before hashing — the same
 * exclusions `diffHeroEvRuns.mjs` documents.
 *
 * Usage:
 *   node scripts/backtest/verify-ws433-determinism.mjs [--files N] [--players N]
 *        [--decisions N] [--workers N] [--seed N]
 * Defaults are sized for a ~2-minute check. All gates run at refinementBudgetMs 0 —
 * refined-run determinism is WS-432's acceptance, not this tool's.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { discoverCorpusFiles } from './corpusFiles.mjs';
import { runHeroEv } from './heroEvRunner.mjs';
import { REFERENCE_DISABLED } from './leakageGuard.mjs';
import { chunkPath } from './mergeHeroEvChunks.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const t = process.argv[i];
  if (t.startsWith('--')) { args[t.slice(2)] = process.argv[i + 1]; i++; }
}
const int = (v, d) => (v === undefined ? d : Number.parseInt(v, 10));

const N_FILES = int(args.files, 3);
const N_PLAYERS = int(args.players, 12);
const N_DECISIONS = int(args.decisions, 40);
const N_WORKERS = int(args.workers, Math.max(2, Math.min(4, os.availableParallelism() - 1)));
const SEED = int(args.seed, 20260806);
const WAVE = 4;

const TIMING_KEYS = new Set(['elapsed', 'atMs', 'computeMs', 'totalMs', 'runtimeMs']);
const stripTiming = (v) => {
  if (Array.isArray(v)) return v.map(stripTiming);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (TIMING_KEYS.has(k)) continue;
      out[k] = stripTiming(x);
    }
    return out;
  }
  return v;
};

const hashRun = (res) => createHash('sha256').update(JSON.stringify(stripTiming({
  decisions: res.decisions,
  counters: res.counters,
  fieldAnchor: res.fieldAnchor,
  integrity: res.integrity,
  config: { ...res.config, workers: null, chunkDir: null, resumedWaves: null, resumedEngineDirty: null },
}))).digest('hex');

const behaviorPolicy = JSON.parse(fs.readFileSync(new URL('../../out/behavior-policy.json', import.meta.url), 'utf8'));
const files = (await discoverCorpusFiles({})).slice(0, N_FILES);
const CHUNK_DIR = path.join(os.tmpdir(), `ws433-verify-${process.pid}`);
fs.rmSync(CHUNK_DIR, { recursive: true, force: true });

const runOnce = async (label, overrides = {}) => {
  const t0 = Date.now();
  const res = await runHeroEv({
    files,
    reference: REFERENCE_DISABLED,
    behaviorPolicy,
    maxPlayers: N_PLAYERS,
    maxDecisions: N_DECISIONS,
    depthArms: [{ id: 'depth1', refinementBudgetMs: 0 }],
    equitySeed: SEED,
    workers: 0,
    waveSize: WAVE,
    log: () => {},
    ...overrides,
  });
  const h = hashRun(res);
  console.log(`  ${label}: ${res.decisionsScored} decisions, ${res.counters.contributingPlayers}/${res.counters.plannedPlayers} contributing, ${((Date.now() - t0) / 1000).toFixed(1)}s, ${h.slice(0, 16)}`);
  return { res, h };
};

let failed = false;
const gate = (name, ok) => {
  console.log(`GATE ${name}: ${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) failed = true;
};

console.log(`corpus slice: ${files.length} files · players ${N_PLAYERS} · decisions ${N_DECISIONS} · workers ${N_WORKERS} · seed ${SEED}\n`);

console.log('1. serial self-identity');
const s1 = await runOnce('serial A');
const s2 = await runOnce('serial B');
gate('serial-self-identity', s1.h === s2.h);

console.log('\n2. parallel bit-identity');
const p1 = await runOnce(`parallel x${N_WORKERS}`, { workers: N_WORKERS });
gate('parallel-bit-identity', p1.h === s1.h);

console.log('\n3. resume identity');
const c1 = await runOnce('fresh+chunks', { workers: N_WORKERS, chunkDir: CHUNK_DIR });
const chunks = fs.readdirSync(CHUNK_DIR).filter((f) => f.endsWith('.json'));
const r1 = await runOnce('full resume ', { workers: N_WORKERS, chunkDir: CHUNK_DIR, resume: true });
const resumedAll = r1.res.config.resumedWaves === chunks.length;
fs.rmSync(path.join(CHUNK_DIR, chunks[chunks.length - 1]));
const r2 = await runOnce('1-wave redo ', { workers: N_WORKERS, chunkDir: CHUNK_DIR, resume: true });
const target = chunkPath(CHUNK_DIR, 0, Math.min(WAVE, N_PLAYERS));
const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
parsed.stamp.equitySeed = SEED + 1;
fs.writeFileSync(target, JSON.stringify(parsed));
let refused = false;
try {
  await runOnce('tampered    ', { workers: N_WORKERS, chunkDir: CHUNK_DIR, resume: true });
} catch (err) {
  refused = /resume refused/.test(err.message);
  console.log('  tampered    : refused, as required');
}
gate('resume-identity', c1.h === s1.h && r1.h === s1.h && resumedAll && r2.h === s1.h && refused);

fs.rmSync(CHUNK_DIR, { recursive: true, force: true });
console.log(failed ? '\nWS-433 DETERMINISM: FAILED' : '\nWS-433 DETERMINISM: ALL GATES PASS');
process.exit(failed ? 1 : 0);
