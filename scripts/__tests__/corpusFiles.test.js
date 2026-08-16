/**
 * corpusFiles.test.js — WS-321.
 *
 * The module had no tests. Its corpus root was a hardcoded G16 Windows path, so every
 * corpus consumer — backtest harness, mining, hero-EV, calibration — failed at discovery
 * on any other machine. Nothing caught it because no corpus job had ever been attempted
 * off the G16.
 *
 * These tests are about RESOLUTION and the shape of the failure, not about reading a
 * corpus: the real one lives outside the repo and is not present in CI.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveCorpusRoot, discoverCorpusFiles, parseCorpusDir,
  CORPUS_ROOT_ENV, G16_CORPUS_ROOT, DEFAULT_CORPUS_ROOT,
} from '../backtest/corpusFiles.mjs';

const STAKE_DIR = 'PS-2009-07-01_2009-07-23_200NLH_OBFU';

describe('resolveCorpusRoot — WS-321', () => {
  let saved;
  beforeEach(() => { saved = process.env[CORPUS_ROOT_ENV]; delete process.env[CORPUS_ROOT_ENV]; });
  afterEach(() => {
    if (saved === undefined) delete process.env[CORPUS_ROOT_ENV];
    else process.env[CORPUS_ROOT_ENV] = saved;
  });

  it('falls back to the G16 path when nothing is set', () => {
    expect(resolveCorpusRoot()).toBe(G16_CORPUS_ROOT);
  });

  it('prefers the environment over the built-in default', () => {
    process.env[CORPUS_ROOT_ENV] = '/srv/handhq';
    expect(resolveCorpusRoot()).toBe('/srv/handhq');
  });

  it('prefers an explicit argument over the environment', () => {
    process.env[CORPUS_ROOT_ENV] = '/srv/handhq';
    expect(resolveCorpusRoot('/other/place')).toBe('/other/place');
  });

  it('ignores an empty explicit value and an empty env var', () => {
    // A CLI flag parsed as '' must not silently resolve to an empty path.
    process.env[CORPUS_ROOT_ENV] = '';
    expect(resolveCorpusRoot('')).toBe(G16_CORPUS_ROOT);
  });

  it('reads the environment at CALL time, not at import time', () => {
    // The whole point: a scheduled job on another node sets this in its own environment,
    // and a module-load-time read would have already baked in the G16 path.
    expect(resolveCorpusRoot()).toBe(G16_CORPUS_ROOT);
    process.env[CORPUS_ROOT_ENV] = '/late/binding';
    expect(resolveCorpusRoot()).toBe('/late/binding');
  });

  it('DEFAULT_CORPUS_ROOT remains the G16 constant for the six importers', () => {
    expect(DEFAULT_CORPUS_ROOT).toBe(G16_CORPUS_ROOT);
  });
});

describe('discoverCorpusFiles — failure shape', () => {
  let saved;
  beforeEach(() => { saved = process.env[CORPUS_ROOT_ENV]; delete process.env[CORPUS_ROOT_ENV]; });
  afterEach(() => {
    if (saved === undefined) delete process.env[CORPUS_ROOT_ENV];
    else process.env[CORPUS_ROOT_ENV] = saved;
  });

  it('throws rather than returning an empty list when the root is missing', async () => {
    // A harness that reports "0 hands, all good" is worse than one that fails — this is
    // the measurement code, so a silent zero is a false green.
    await expect(discoverCorpusFiles({ root: '/definitely/not/here' })).rejects.toThrow(
      /Corpus root not found/,
    );
  });

  it('names the env var and the flag so the reader can fix it', async () => {
    await expect(discoverCorpusFiles({ root: '/definitely/not/here' })).rejects.toThrow(
      new RegExp(`${CORPUS_ROOT_ENV}[\\s\\S]*--corpus-root|--corpus-root[\\s\\S]*${CORPUS_ROOT_ENV}`),
    );
  });

  it('names the path it actually tried', async () => {
    await expect(discoverCorpusFiles({ root: '/definitely/not/here' })).rejects.toThrow(
      /\/definitely\/not\/here/,
    );
  });

  it('derives the re-materialise hint from the failing root, not a baked-in path', async () => {
    // Previously the hint always said "cd C:/Users/chris/data/phh-dataset" no matter which
    // root failed — useless advice on any machine that hit the error.
    await expect(discoverCorpusFiles({ root: '/srv/corpus/data/handhq' })).rejects.toThrow(
      /cd \/srv\/corpus/,
    );
  });

  it('a root that resolves from the ENV still fails loudly, and says so', async () => {
    process.env[CORPUS_ROOT_ENV] = '/env/provided/missing';
    await expect(discoverCorpusFiles()).rejects.toThrow(/\/env\/provided\/missing/);
  });
});

describe('discoverCorpusFiles — real directory', () => {
  let dir;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'ws321-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('discovers .phhs files under a non-default root', async () => {
    // The acceptance criterion: one discovery on a root that is not the G16 path.
    await mkdir(join(dir, STAKE_DIR), { recursive: true });
    await writeFile(join(dir, STAKE_DIR, 'a.phhs'), '');
    await writeFile(join(dir, STAKE_DIR, 'b.phhs'), '');
    await writeFile(join(dir, STAKE_DIR, 'notes.txt'), '');

    const files = await discoverCorpusFiles({ root: dir });
    expect(files).toHaveLength(2);
    expect(files.every(f => f.site === 'PS' && f.stakeLabel === '200NLH')).toBe(true);
  });

  it('resolves through the ENV with no argument at all — the node1 case', async () => {
    await mkdir(join(dir, STAKE_DIR), { recursive: true });
    await writeFile(join(dir, STAKE_DIR, 'a.phhs'), '');

    const saved = process.env[CORPUS_ROOT_ENV];
    process.env[CORPUS_ROOT_ENV] = dir;
    try {
      const files = await discoverCorpusFiles();
      expect(files).toHaveLength(1);
    } finally {
      if (saved === undefined) delete process.env[CORPUS_ROOT_ENV];
      else process.env[CORPUS_ROOT_ENV] = saved;
    }
  });

  it('throws when the root exists but holds no corpus directories', async () => {
    await expect(discoverCorpusFiles({ root: dir })).rejects.toThrow(/No \.phhs files found/);
  });

  it('site and stake filters narrow the result', async () => {
    await mkdir(join(dir, STAKE_DIR), { recursive: true });
    await writeFile(join(dir, STAKE_DIR, 'a.phhs'), '');
    await expect(discoverCorpusFiles({ root: dir, sites: ['FTP'] })).rejects.toThrow(/No \.phhs/);
    await expect(discoverCorpusFiles({ root: dir, sites: ['PS'] })).resolves.toHaveLength(1);
  });
});

describe('parseCorpusDir', () => {
  it('extracts site and stake', () => {
    expect(parseCorpusDir(STAKE_DIR)).toEqual({ site: 'PS', stakeLabel: '200NLH' });
  });

  it('returns null for anything not matching the corpus naming', () => {
    expect(parseCorpusDir('random-folder')).toBeNull();
    expect(parseCorpusDir('.git')).toBeNull();
  });
});
