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
  selectCorpusFiles, corpusComposition,
  CORPUS_ROOT_ENV, G16_CORPUS_ROOT, DEFAULT_CORPUS_ROOT,
} from '../backtest/corpusFiles.mjs';
import { stratifiedSelect, stratifiedOrder } from '../backtest/stratifiedSelect.mjs';

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

/**
 * ── WS-504: a cap must draw ACROSS directories, not down the sorted list ──────────────
 *
 * `discoverCorpusFiles` sorts by path and every caller used to cap with
 * `files.slice(0, maxFiles)`. Directory names lead with the site code, so a sorted PREFIX is
 * ONE directory until the cap exceeds that directory's size. Measured on the real corpus
 * 2026-08-17: sites [FTP,PS] stakes [50NLH] returns 1756 files — FTP 525 then PS 1231, first
 * PS file at index 525. So any `--max-files <= 525` was 100% FTP while the Deal Book named
 * itself `allsites`. `out/hero-ev-c3-20260816.json` was produced exactly that way: 60 members,
 * 60 of them FTP.
 *
 * This is not a smaller version of the corpus. WS-492 measured a monotone stake gradient across
 * these directories (6-max 3-bet +57% from 25NLH to 1000NLH), so the strata are not
 * exchangeable and a prefix sample is a DIFFERENT POPULATION reported under the corpus's name.
 *
 * Every corpus test above this line builds exactly ONE directory, which is part of why the
 * defect survived: a single-directory fixture cannot express cross-directory distribution.
 */
describe('selectCorpusFiles — stratified corpus selection (WS-504)', () => {
  // Deliberately UNEQUAL, so proportional and round-robin give different answers and the test
  // can tell which one ran. 10 / 30 / 60 over 100 files makes the arithmetic checkable by eye.
  const DIRS = [
    { name: 'FTP-2009-07-01_2009-07-23_50NLH_OBFU', count: 10 },
    { name: 'PS-2009-07-01_2009-07-23_50NLH_OBFU', count: 30 },
    { name: 'PS-2009-07-01_2009-07-23_200NLH_OBFU', count: 60 },
  ];
  const FTP50 = 'FTP-2009-07-01_2009-07-23_50NLH_OBFU';
  const PS50 = 'PS-2009-07-01_2009-07-23_50NLH_OBFU';
  const PS200 = 'PS-2009-07-01_2009-07-23_200NLH_OBFU';
  let dir;
  let files;
  let saved;

  beforeEach(async () => {
    saved = process.env[CORPUS_ROOT_ENV];
    delete process.env[CORPUS_ROOT_ENV];
    dir = await mkdtemp(join(tmpdir(), 'ws504-'));
    for (const d of DIRS) {
      await mkdir(join(dir, d.name), { recursive: true });
      for (let i = 0; i < d.count; i++) {
        // Zero-padded so path order is stable and independent of the filesystem.
        await writeFile(join(dir, d.name, `h${String(i).padStart(3, '0')}.phhs`), '');
      }
    }
    files = await discoverCorpusFiles({ root: dir });
  });
  afterEach(async () => {
    if (saved === undefined) delete process.env[CORPUS_ROOT_ENV];
    else process.env[CORPUS_ROOT_ENV] = saved;
    await rm(dir, { recursive: true, force: true });
  });

  it('tags every discovered file with the directory it came from — the stratum', () => {
    expect(files).toHaveLength(100);
    // Directory, NOT site+stake: two of these three share a site, and two share a stake.
    // Collapsing on either would merge distinct samples into one bucket.
    expect(corpusComposition(files)).toEqual({ [FTP50]: 10, [PS200]: 60, [PS50]: 30 });
  });

  it('THE DEFECT: a sorted prefix reads one directory — reproduced via strategy "prefix"', () => {
    const { selection } = selectCorpusFiles(files, { maxFiles: 10, strategy: 'prefix' });
    // All 10 come from the directory that happens to sort first. This is what every capped run
    // did before WS-504, and it is retained ONLY so a published card can be replicated.
    expect(selection.realised.perDirectory).toEqual({ [FTP50]: 10 });
    expect(selection.collapsed).toBe(true);
    expect(selection.missingDirectories).toHaveLength(2);
  });

  it('draws proportionally across every directory, by largest remainder', () => {
    const { files: chosen, selection } = selectCorpusFiles(files, { maxFiles: 10 });
    expect(chosen).toHaveLength(10);
    // 10/100, 30/100, 60/100 of a cap of 10 — exact, with no rounding slack to argue about.
    expect(selection.realised.perDirectory).toEqual({ [FTP50]: 1, [PS200]: 6, [PS50]: 3 });
    expect(selection.collapsed).toBe(false);
    expect(selection.missingDirectories).toEqual([]);
  });

  it('reports what was DISCOVERED alongside what was REALISED', () => {
    const { selection } = selectCorpusFiles(files, { maxFiles: 10 });
    expect(selection.discovered.total).toBe(100);
    expect(selection.realised.total).toBe(10);
    expect(selection.capped).toBe(true);
    expect(selection.strategy).toBe('proportional');
    expect(selection.version).toBe('strat-v1');
  });

  it('is deterministic — the same request twice yields the identical file list', () => {
    const a = selectCorpusFiles(files, { maxFiles: 37 }).files.map((f) => f.path);
    const b = selectCorpusFiles(files, { maxFiles: 37 }).files.map((f) => f.path);
    expect(a).toEqual(b);
  });

  it('keeps EVERY PREFIX proportional, so a downstream early-stop cannot re-bias the sample', () => {
    // Defence in depth. `runner.mjs` stops admitting players at `byPlayer.size >= maxPlayers`,
    // consuming files in order; a directory-blocked list would hand it a single-site prefix and
    // recreate the defect one layer down.
    const { files: chosen } = selectCorpusFiles(files, { maxFiles: 20 });
    const quotas = { [FTP50]: 2, [PS50]: 6, [PS200]: 12 };
    for (let k = 1; k <= chosen.length; k++) {
      const counts = corpusComposition(chosen.slice(0, k));
      for (const [d, quota] of Object.entries(quotas)) {
        expect(Math.abs((counts[d] ?? 0) - (k * quota) / 20)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('never drops a directory to zero through rounding alone', () => {
    // The smallest directory is 10% of the corpus, so a naive floor would zero it at any cap
    // below 10. The floor-of-one keeps it present for every cap that can cover all three.
    for (const cap of [3, 4, 5, 7, 9]) {
      const { selection } = selectCorpusFiles(files, { maxFiles: cap });
      expect(Object.keys(selection.realised.perDirectory)).toHaveLength(3);
      expect(selection.collapsed).toBe(false);
    }
  });

  it('REPORTS a collapse it cannot avoid, rather than leaving the reader to notice', () => {
    // Fewer files than directories: covering all three is arithmetically impossible. The
    // artifact says which one was dropped instead of quietly presenting a partial sample.
    const { selection } = selectCorpusFiles(files, { maxFiles: 2 });
    expect(selection.realised.total).toBe(2);
    expect(selection.collapsed).toBe(true);
    expect(selection.missingDirectories).toHaveLength(1);
  });

  it('passes an uncapped request through untouched — same array, same order', () => {
    // AC5. A run that reads the whole matched corpus must be byte-identical to one from before
    // this change, Deal Book content hash included.
    const { files: chosen, selection } = selectCorpusFiles(files, {});
    expect(chosen).toBe(files);
    expect(selection.capped).toBe(false);
    expect(selectCorpusFiles(files, { maxFiles: 100000 }).files).toBe(files);
  });

  it('refuses an unrecognised strategy instead of silently falling back to prefix', () => {
    // A typo quietly reverting to the biased selection is the exact failure this ticket exists
    // to prevent, so the refusal is part of the fix rather than input hygiene.
    expect(() => selectCorpusFiles(files, { maxFiles: 5, strategy: 'proportinal' }))
      .toThrow(/Unknown selection strategy/);
  });
});

/**
 * ── WS-504: the PLAYER cap is the binding one ────────────────────────────────────────
 *
 * Stratifying files alone does not fix a capped run. Players are keyed `${site}:${pid}`
 * (`runner.mjs`) and `buildEnumeration` sorts raw code-unit, so 'FTP:zzz' < 'PS:abc' and the old
 * `enumeration.players.slice(0, maxPlayers)` exhausted every FTP player before reaching a PS
 * one — re-imposing the single-site sample one layer below the file selection.
 */
describe('player-cap stratification (WS-504)', () => {
  // The real imbalance on this machine: 525 FTP players, 1231 PS players.
  const players = [
    ...Array.from({ length: 525 }, (_, i) => ({ playerId: `FTP:p${String(i).padStart(5, '0')}` })),
    ...Array.from({ length: 1231 }, (_, i) => ({ playerId: `PS:p${String(i).padStart(5, '0')}` })),
  ].sort((a, b) => (a.playerId < b.playerId ? -1 : 1));
  const keyOf = (p) => p.playerId.slice(0, p.playerId.indexOf(':'));
  const count = (list) => {
    const out = {};
    for (const p of list) out[keyOf(p)] = (out[keyOf(p)] ?? 0) + 1;
    return out;
  };

  it('THE DEFECT: the lexicographic prefix is one site', () => {
    expect(count(players.slice(0, 300))).toEqual({ FTP: 300 });
  });

  it('a capped plan draws proportionally across sites', () => {
    // 525/1756 = 29.9% -> 90 of 300.
    expect(count(stratifiedSelect(players, { max: 300, keyOf }).items)).toEqual({ FTP: 90, PS: 210 });
  });

  it('an UNCAPPED plan is still reordered, because the stop rule truncates it later', () => {
    // `targetContributingPlayers` truncates nothing — it stops at a wave boundary partway down
    // an untruncated list. Selection alone therefore cannot fix it; the ORDER has to carry the
    // proportion. WS-503 runs `--target-contributing-players 1200`.
    const ordered = stratifiedOrder(players, keyOf);
    expect(ordered).toHaveLength(players.length);
    expect(new Set(ordered.map((p) => p.playerId)).size).toBe(players.length);
    expect(count(ordered.slice(0, 300))).toEqual({ FTP: 90, PS: 210 });
    expect(count(ordered.slice(0, 1200))).toEqual({ FTP: 359, PS: 841 });
  });

  it('stratifiedOrder is idempotent, so re-planning an ordered list is stable', () => {
    const once = stratifiedOrder(players, keyOf).map((p) => p.playerId);
    const twice = stratifiedOrder(stratifiedOrder(players, keyOf), keyOf).map((p) => p.playerId);
    expect(twice).toEqual(once);
  });

  it('leaves a single-stratum plan exactly as it was', () => {
    const onlyFtp = players.filter((p) => keyOf(p) === 'FTP');
    expect(stratifiedOrder(onlyFtp, keyOf)).toBe(onlyFtp);
  });
});

/**
 * WS-504 accept criterion 5, locked in CI.
 *
 * AC5 as originally written asked that "WS-503's pinned invocation still reproduces the
 * identical two-directory 50NLH sample". That sample HAS NEVER EXISTED — the site pin selects
 * which directories are DISCOVERED, and the sorted prefix then decided which were READ, so
 * every pinned run before 2026-08-17 was one directory. The criterion is therefore split into
 * the two invariants it was reaching for, and both are asserted here.
 *
 * The counts are the real G16 imbalance, not invented: `discoverCorpusFiles({stakes:['50NLH']})`
 * returns 1756 records — 525 Full Tilt, then 1231 PokerStars. Measured against the corpus on
 * 2026-08-17, a 300-file `prefix` draw reproduces the published Deal Book contentHash
 * `sha256:1c560bcc8ba77…` BIT-IDENTICALLY (only the NAME moves, from
 * `handhq-allsites-50NLH-1c560bcc` to `handhq-FTP-50NLH-1c560bcc`), while `proportional`
 * yields `handhq-FTP+PS-50NLH-ae2172f5` — the 90/210 split docs/runbooks/baseline-ev-run.md
 * now states.
 *
 * In-memory rather than 1756 files under mkdtemp, matching the player-cap block above: the
 * selection primitive operates on the record array, so the filesystem adds cost and no signal.
 */
describe('AC5 — the pinned 300-file draw, at the real corpus imbalance (WS-504)', () => {
  const FTP50 = 'FTP-2009-07-01_2009-07-23_50NLH_OBFU';
  const PS50 = 'PS-2009-07-01_2009-07-23_50NLH_OBFU';
  const files = [
    ...Array.from({ length: 525 }, (_, i) => ({ dir: FTP50, site: 'FTP', stakeLabel: '50NLH', path: `${FTP50}/h${String(i).padStart(4, '0')}.phhs` })),
    ...Array.from({ length: 1231 }, (_, i) => ({ dir: PS50, site: 'PS', stakeLabel: '50NLH', path: `${PS50}/h${String(i).padStart(4, '0')}.phhs` })),
  ].sort((a, b) => (a.path < b.path ? -1 : 1));

  it('AC5a: an uncapped draw returns the same array, so nothing pre-WS-504 moves', () => {
    expect(selectCorpusFiles(files, { maxFiles: Infinity }).files).toBe(files);
    expect(selectCorpusFiles(files, { maxFiles: 1756 }).files).toBe(files);
  });

  it('AC5b: prefix still reads 300 Full Tilt and zero PokerStars — the published sample', () => {
    const { files: chosen, selection } = selectCorpusFiles(files, { maxFiles: 300, strategy: 'prefix' });
    expect(selection.realised.perDirectory).toEqual({ [FTP50]: 300 });
    expect(selection.collapsed).toBe(true);
    expect(selection.missingDirectories).toEqual([PS50]);
    // Bit-identical to the pre-WS-504 behaviour: the first 300 of the sorted list.
    expect(chosen.map((f) => f.path)).toEqual(files.slice(0, 300).map((f) => f.path));
  });

  it('AC5b: proportional draws 90 / 210 — the numbers the runbook now quotes', () => {
    const { selection } = selectCorpusFiles(files, { maxFiles: 300 });
    expect(selection.realised.perDirectory).toEqual({ [FTP50]: 90, [PS50]: 210 });
    expect(selection.collapsed).toBe(false);
    expect(selection.missingDirectories).toEqual([]);
    // 525/1756 × 300 = 89.68 → 90, and the two must still total the cap exactly.
    expect(selection.realised.total).toBe(300);
  });

  it('AC5b: the discovered side is recorded too, so the artifact can state what it MISSED', () => {
    const { selection } = selectCorpusFiles(files, { maxFiles: 300, strategy: 'prefix' });
    expect(selection.discovered.perDirectory).toEqual({ [FTP50]: 525, [PS50]: 1231 });
    expect(selection.discovered.total).toBe(1756);
  });

  it('no cap below the FTP block size can yield a two-site sample under prefix', () => {
    // The sentence in WS-504 that reads as reassurance and is false: a --sites filter upstream
    // of a prefix cannot correct the prefix. There is no value of --max-files that helps.
    for (const cap of [1, 60, 100, 300, 525]) {
      expect(Object.keys(selectCorpusFiles(files, { maxFiles: cap, strategy: 'prefix' }).selection.realised.perDirectory))
        .toEqual([FTP50]);
    }
  });
});
