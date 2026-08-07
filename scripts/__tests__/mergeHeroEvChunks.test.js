import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  buildChunkStamp, stampMismatches, chunkPath, writeChunk, loadChunk, scanChunkCoverage,
  HERO_EV_CHUNK_SCHEMA, MUST_MATCH,
} from '../backtest/mergeHeroEvChunks.mjs';
import { REFINEMENT_CLOCK_VERSION } from '../../src/utils/exploitEngine/refinementWork.js';

// WS-433. The refusal conditions are the merge — a chunk store that seeds from the wrong
// measurement is worse than no chunk store (mergeEntryMap doctrine, transferred).

const DIR = path.join(os.tmpdir(), `ws433-chunk-test-${process.pid}`);

const stampInput = () => ({
  enumerationHash: 'sha256:aaaa',
  dealBookHash: 'sha256:bbbb',
  engineCommit: 'deadbeef',
  engineDirty: false,
  playerKeyScheme: 'site-pseudo-v1',
  seedScheme: 'ws433-v1',
  equitySeed: 42,
  refinementClock: 'wall',
  config: { poolPct: 50, waveSize: 4 },
  behaviorPolicy: { partition: 'pool-train', poolPct: 50, observations: 100, players: 10 },
});

const fragment = (playerIndex) => ({
  playerIndex,
  playerKey: `PS:p${playerIndex}`,
  playerId: `p${playerIndex}`,
  decisions: [],
  counters: {},
  ledger: {},
  coverageByArm: {},
  contributed: false,
  walkForwardChecked: 0,
});

beforeEach(() => {
  fs.rmSync(DIR, { recursive: true, force: true });
});
afterAll(() => {
  fs.rmSync(DIR, { recursive: true, force: true });
});

describe('buildChunkStamp / stampMismatches', () => {
  test('identical inputs ⇒ no mismatches; schemaVersion is stamped', () => {
    const a = buildChunkStamp(stampInput());
    const b = buildChunkStamp(stampInput());
    expect(a.schemaVersion).toBe(HERO_EV_CHUNK_SCHEMA);
    expect(stampMismatches(a, b)).toEqual([]);
  });

  test('every MUST_MATCH field is actually load-bearing', () => {
    const base = buildChunkStamp(stampInput());
    const variants = {
      enumerationHash: { ...stampInput(), enumerationHash: 'sha256:XXXX' },
      dealBookHash: { ...stampInput(), dealBookHash: 'sha256:XXXX' },
      engineCommit: { ...stampInput(), engineCommit: 'cafebabe' },
      playerKeyScheme: { ...stampInput(), playerKeyScheme: 'bare-v0' },
      seedScheme: { ...stampInput(), seedScheme: 'other' },
      equitySeed: { ...stampInput(), equitySeed: 43 },
      refinementClock: { ...stampInput(), refinementClock: 'logical-v1' },
      config: { ...stampInput(), config: { poolPct: 50, waveSize: 8 } },
      behaviorPolicy: { ...stampInput(), behaviorPolicy: { partition: 'pool-train', poolPct: 50, observations: 999, players: 10 } },
    };
    for (const [field, input] of Object.entries(variants)) {
      expect(stampMismatches(base, buildChunkStamp(input))).toContain(field);
    }
    // engineDirty is deliberately NOT refused — OR-ed and surfaced instead.
    const dirty = buildChunkStamp({ ...stampInput(), engineDirty: true });
    expect(stampMismatches(base, dirty)).toEqual([]);
    expect(MUST_MATCH).not.toContain('engineDirty');
  });
});

describe('writeChunk / loadChunk', () => {
  test('round-trips a wave and validates slice + ofTotal', () => {
    const stamp = buildChunkStamp(stampInput());
    const frags = [fragment(0), fragment(1)];
    writeChunk(DIR, { from: 0, to: 2, ofTotal: 10, stamp, fragments: frags, failures: [] });

    const hit = loadChunk(DIR, { from: 0, to: 2, ofTotal: 10, stamp });
    expect(hit.fragments).toEqual(frags);
    expect(hit.failures).toEqual([]);
    expect(hit.engineDirty).toBe(false);
  });

  test('missing chunk ⇒ null (not an error)', () => {
    const stamp = buildChunkStamp(stampInput());
    expect(loadChunk(DIR, { from: 4, to: 8, ofTotal: 10, stamp })).toBeNull();
  });

  test('REFUSES a stamp mismatch, naming the fields', () => {
    const stamp = buildChunkStamp(stampInput());
    writeChunk(DIR, { from: 0, to: 2, ofTotal: 10, stamp, fragments: [fragment(0)], failures: [] });
    const other = buildChunkStamp({ ...stampInput(), equitySeed: 7, engineCommit: 'cafebabe' });
    expect(() => loadChunk(DIR, { from: 0, to: 2, ofTotal: 10, stamp: other }))
      .toThrow(/resume refused.*(equitySeed|engineCommit)/s);
  });

  test('REFUSES an ofTotal mismatch — the enumeration changed under the chunks', () => {
    const stamp = buildChunkStamp(stampInput());
    writeChunk(DIR, { from: 0, to: 2, ofTotal: 10, stamp, fragments: [fragment(0)], failures: [] });
    expect(() => loadChunk(DIR, { from: 0, to: 2, ofTotal: 11, stamp }))
      .toThrow(/enumeration changed/);
  });

  test('REFUSES an unreadable chunk file', () => {
    const stamp = buildChunkStamp(stampInput());
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(chunkPath(DIR, 0, 2), 'not json{');
    expect(() => loadChunk(DIR, { from: 0, to: 2, ofTotal: 10, stamp }))
      .toThrow(/unreadable/);
  });

  test('write is atomic — no .tmp file remains', () => {
    const stamp = buildChunkStamp(stampInput());
    writeChunk(DIR, { from: 0, to: 2, ofTotal: 10, stamp, fragments: [fragment(0)], failures: [] });
    expect(fs.readdirSync(DIR).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });
});

describe('WS-432 — the refinement clock in the chunk stamp', () => {
  test('the engine clock is logical-v1, and a run under it REFUSES an old wall chunk', () => {
    expect(REFINEMENT_CLOCK_VERSION).toBe('logical-v1');

    // A chunk persisted by a pre-WS-432 run (refinementClock: 'wall') must never be
    // seeded into a logical-clock run: under the wall clock, WHICH stages completed
    // depended on machine load, so its rows are a different measurement.
    const wallStamp = buildChunkStamp(stampInput()); // fixture stamps 'wall'
    writeChunk(DIR, { from: 0, to: 2, ofTotal: 10, stamp: wallStamp, fragments: [fragment(0)], failures: [] });

    const logicalStamp = buildChunkStamp({ ...stampInput(), refinementClock: REFINEMENT_CLOCK_VERSION });
    expect(() => loadChunk(DIR, { from: 0, to: 2, ofTotal: 10, stamp: logicalStamp }))
      .toThrow(/resume refused.*refinementClock/s);
  });

  test('the runner stamps the IMPORTED clock version, not a literal', () => {
    // Producer-side binding, asserted rather than described (the engine CLAUDE.md rule):
    // heroEvRunner must derive its stamp from refinementWork.js so the stamp cannot
    // drift from the engine. A source-text check is the cheapest honest form — the
    // runner's stamp is not observable without executing a full corpus run.
    const src = fs.readFileSync(new URL('../backtest/heroEvRunner.mjs', import.meta.url), 'utf8');
    expect(src).toMatch(/refinementClock:\s*REFINEMENT_CLOCK_VERSION/);
    expect(src).not.toMatch(/refinementClock:\s*'wall'/);
    expect(src).toMatch(/from '\.\.\/\.\.\/src\/utils\/exploitEngine\/refinementWork\.js'/);
  });
});

describe('scanChunkCoverage', () => {
  test('reports present and missing waves', () => {
    const stamp = buildChunkStamp(stampInput());
    writeChunk(DIR, { from: 0, to: 4, ofTotal: 10, stamp, fragments: [], failures: [] });
    writeChunk(DIR, { from: 8, to: 10, ofTotal: 10, stamp, fragments: [], failures: [] });
    const waves = [{ from: 0, to: 4 }, { from: 4, to: 8 }, { from: 8, to: 10 }];
    const { present, missing } = scanChunkCoverage(DIR, waves);
    expect(present).toEqual([{ from: 0, to: 4 }, { from: 8, to: 10 }]);
    expect(missing).toEqual([{ from: 4, to: 8 }]);
  });
});
