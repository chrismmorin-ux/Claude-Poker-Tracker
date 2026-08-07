#!/usr/bin/env node
/**
 * run-beliefstate-size.mjs — WS-430: measure what `beliefState` actually costs, per encoding,
 * per playersRemaining, through the REAL atom writer path.
 *
 * Usage:
 *   node scripts/backtest/run-beliefstate-size.mjs [--atoms 256]
 *
 * WHAT THIS RUN IS. An engineering size measurement, not a strategy claim — no Result Card.
 * As of WS-430 no producer writes `beliefState` (verified: 97,454/97,454 atoms in the WS-328
 * gen-1 store carry `beliefState: null`), so the grids here are CONSTRUCTED — real
 * `getPopulationPrior` grids (169 classes, realistic float values), one per live opponent,
 * with small deterministic per-atom perturbation so gzip cannot exploit identical lines the
 * way it never could against real evolving posteriors.
 *
 * Atoms are written through the actual `openAtomWriter` / `append` / `finalize` path into a
 * THROWAWAY temp directory — never into the real sor-atoms store — so the numbers include the
 * real NDJSON + gzip-sidecar behavior, and the per-atom delta is measured against a control
 * set whose `beliefState` is null.
 *
 * EVERY src MODULE LOADS THROUGH THE VITE SSR LOADER (extensionless imports) — the
 * `run-hero-ev.mjs` / `run-atoms.mjs` pattern.
 */

import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { openLoader } from './loader.mjs';
import { openAtomWriter } from './atomStore.mjs';
import { packBeliefState, BELIEF_STATE_SCHEMAS } from './beliefStatePacking.mjs';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };

const N_ATOMS = Number(flag('atoms', 256));
const PLAYERS_REMAINING = [1, 3, 5, 8];

// Corpus projection constants — provenance, so the projection is checkable:
//   97,454 atoms over 20,800 hands = 4.6853 atoms/hand, measured on the WS-328 gen-1
//   manifest (atomCount + seatOccupancy span count). 1,070,493 hands is the full HandHQ
//   corpus (docs/research/engine-backtest-baseline-2026-07-26.md).
const MEASURED_ATOMS = 97454;
const MEASURED_HANDS = 20800;
const CORPUS_HANDS = 1070493;
const PROJECTED_ATOMS = Math.round((MEASURED_ATOMS / MEASURED_HANDS) * CORPUS_HANDS);

/** Deterministic PRNG — a Math.random() here would make two runs disagree about a size. */
const mulberry32 = (seed) => () => {
  let t = (seed += 0x6D2B79F5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const RANK_CHARS = '23456789TJQKA';

const main = async () => {
  const loader = await openLoader();
  const { getPopulationPrior } = await loader.load('/src/utils/rangeEngine/populationPriors.js');
  const { decodeIndex } = await loader.load('/src/utils/pokerCore/rangeMatrix.js');

  // The canonical 169-class order: rangeMatrix grid index order, named via decodeIndex.
  const classOrder = Array.from({ length: 169 }, (_, i) => {
    const { rank1, rank2, suited, isPair } = decodeIndex(i);
    return `${RANK_CHARS[rank1]}${RANK_CHARS[rank2]}${isPair ? '' : suited ? 's' : 'o'}`;
  });

  // Realistic per-opponent base grids: real population-prior propensities, varied contexts.
  const OPPONENT_CONTEXTS = [
    ['LATE', 'open'], ['MIDDLE', 'coldCall'], ['EARLY', 'open'], ['SB', 'limp'],
    ['BB', 'coldCall'], ['LATE', 'threeBet'], ['MIDDLE', 'open'], ['EARLY', 'coldCall'],
  ];
  const baseGrids = OPPONENT_CONTEXTS.map(([pos, act]) => getPopulationPrior(pos, act));

  /** One opponent's evolved belief at one decision: real grid + small deterministic drift. */
  const opponentBelief = (oppIdx, atomIdx, players) => {
    const rnd = mulberry32(atomIdx * 131 + oppIdx * 7 + players);
    const base = baseGrids[oppIdx % baseGrids.length];
    const classProbs = {};
    for (let i = 0; i < 169; i += 1) {
      classProbs[classOrder[i]] = base[i] * (1 + 0.1 * (rnd() - 0.5));
    }
    return { seat: oppIdx + 1, classProbs };
  };

  const verboseBeliefState = (atomIdx, players) => ({
    schema: BELIEF_STATE_SCHEMAS.verbose,
    opponents: Array.from({ length: players }, (_, o) => opponentBelief(o, atomIdx, players)),
  });

  /** The atom shell mirrors the real WS-328 store rows, so the delta is against real ballast. */
  const atomShell = (i) => ({
    schemaVersion: 2,
    atomId: `WS430:${i}#1@3`,
    situationKey: 'preflop:na:LATE:false:false:none:na',
    carried: {
      actorRole: 'villain', street: 'preflop', posCategory: 'LATE',
      facingAction: 'none', source: 'SRC-012', pool: 'FTP:50NLH',
    },
    surfaceId: 'read:ws430-size-measure',
    action: { open: 0.3108295565982653, coldCall: 0.35583711006840146, threeBet: 1 / 3 },
    ruleId: 'range-4+engine-v123',
    warrant: null,
    layers: [],
    outcome: { observedAction: 'raise', sizing: 1.5, street: 'preflop' },
    skipReason: null,
    alternativeScores: {
      scores: { open: 0.3108295565982653, coldCall: 0.35583711006840146, threeBet: 1 / 3 },
      best: 'coldCall', runnerUp: 'threeBet', margin: 0.02250377673506815, alternativeCount: 3,
    },
    rulesMatchedAndLost: [],
    beliefState: null,
    truth: null,
    seeds: { deal: `WS430:${i}` },
    actorSeat: 3,
    actorRole: 'villain',
    wallTimeMs: null,
    tokens: null,
  });

  const root = await mkdtemp(join(tmpdir(), 'ws430-beliefstate-'));
  console.log(`throwaway store: ${root}\n`);

  /** Write one set through the real writer path; return per-atom raw/gz store bytes. */
  const measureSet = async (setId, beliefStateFor) => {
    const w = await openAtomWriter({
      atomSetId: setId, root, surfaceId: 'read:ws430-size-measure', fullSampleRate: 1,
    });
    let fieldRaw = 0;
    let fieldGz = 0;
    for (let i = 0; i < N_ATOMS; i += 1) {
      const bs = beliefStateFor(i);
      const json = JSON.stringify(bs);
      fieldRaw += Buffer.byteLength(json);
      fieldGz += gzipSync(Buffer.from(json)).byteLength;
      await w.append({ ...atomShell(i), beliefState: bs });
    }
    await w.finalize({ notes: 'WS-430 size measurement — throwaway' });
    const raw = (await stat(join(root, setId, 'atoms.ndjson'))).size;
    const gz = (await stat(join(root, setId, 'atoms.ndjson.gz'))).size;
    return {
      storeRawPerAtom: raw / N_ATOMS,
      storeGzPerAtom: gz / N_ATOMS,
      fieldRawPerAtom: fieldRaw / N_ATOMS,
      fieldGzPerAtom: fieldGz / N_ATOMS,
    };
  };

  const control = await measureSet('control-null', () => null);
  console.log(`control (beliefState:null): ${control.storeRawPerAtom.toFixed(1)} B/atom raw, `
    + `${control.storeGzPerAtom.toFixed(1)} B/atom gz (store level)\n`);

  const rows = [];
  for (const players of PLAYERS_REMAINING) {
    const encodings = {
      verbose: (i) => verboseBeliefState(i, players),
      f32: (i) => packBeliefState(verboseBeliefState(i, players), { encoding: 'f32', classOrder }),
      q8: (i) => packBeliefState(verboseBeliefState(i, players), { encoding: 'q8', classOrder }),
    };
    for (const [name, fn] of Object.entries(encodings)) {
      const m = await measureSet(`k${players}-${name}`, fn);
      rows.push({
        players,
        encoding: name,
        fieldRaw: m.fieldRawPerAtom,
        fieldGz: m.fieldGzPerAtom,
        deltaRaw: m.storeRawPerAtom - control.storeRawPerAtom,
        deltaGz: m.storeGzPerAtom - control.storeGzPerAtom,
      });
    }
  }

  console.log('Per-atom beliefState cost (field = serialized JSON value alone; standalone-field');
  console.log('gzip carries ~20 B of gzip header, so store-level delta is the honest gz number):\n');
  console.log('| players | encoding | field raw B | field gz B | store Δraw B/atom | store Δgz B/atom |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rows) {
    console.log(`| ${r.players} | ${r.encoding} | ${r.fieldRaw.toFixed(0)} | ${r.fieldGz.toFixed(0)} `
      + `| ${r.deltaRaw.toFixed(0)} | ${r.deltaGz.toFixed(0)} |`);
  }

  console.log(`\nRatios vs verbose (store-level delta, raw → gz), per players:`);
  for (const players of PLAYERS_REMAINING) {
    const v = rows.find((r) => r.players === players && r.encoding === 'verbose');
    for (const enc of ['f32', 'q8']) {
      const e = rows.find((r) => r.players === players && r.encoding === enc);
      console.log(`  k=${players} ${enc}: ${(v.deltaRaw / e.deltaRaw).toFixed(1)}x raw, `
        + `${(v.deltaGz / e.deltaGz).toFixed(1)}x gz`);
    }
  }

  console.log(`\nFull-corpus projection — ${PROJECTED_ATOMS.toLocaleString()} atoms `
    + `(${(MEASURED_ATOMS / MEASURED_HANDS).toFixed(4)} atoms/hand × ${CORPUS_HANDS.toLocaleString()} hands),`);
  console.log('store-level delta, if EVERY atom carried beliefState at that opponent count:\n');
  console.log('| avg live opponents | encoding | full-corpus raw | full-corpus gz |');
  console.log('|---|---|---|---|');
  const gb = (b) => `${(b / 2 ** 30).toFixed(2)} GB`;
  for (const r of rows) {
    console.log(`| ${r.players} | ${r.encoding} | ${gb(r.deltaRaw * PROJECTED_ATOMS)} | ${gb(r.deltaGz * PROJECTED_ATOMS)} |`);
  }

  await rm(root, { recursive: true, force: true });
  await loader.close();
};

main().catch((err) => { console.error(err); process.exit(1); });
