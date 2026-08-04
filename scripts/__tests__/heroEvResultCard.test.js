/**
 * heroEvResultCard.test.js — the WS-322 retrofit, checked against the real instrument.
 *
 * Two things are verified here and they are different claims:
 *
 *   1. THE DEAL BOOK HASH IS DETERMINISTIC. Same slice, same hash, every time and on every
 *      machine. WS-326 leans on this to prove two arms received identical deals, and it is
 *      the property most likely to be quietly broken by something incidental — directory
 *      iteration order, an absolute path, a timestamp.
 *   2. THE REPORT STILL EMITS EVERYTHING IT USED TO. The retrofit was required to be
 *      additive, because `model-readiness.mjs` and `scorecard-history.yaml` read this shape.
 *      A test that only checked the new block would not notice the old ones going missing.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildDealBook, deriveDealBookId, IDENTITY_MODES } from '../backtest/dealBook.mjs';
import { hashObjectSync, hashStringSync } from '../backtest/contentHashNode.mjs';
import { hashUtil, stableStringify } from '../../src/utils/contentHash.js';
import { buildHeroEvReport, HERO_EV_SCHEMA_VERSION } from '../backtest/heroEvReport.mjs';
import { DEFAULT_BOOTSTRAP_SEED } from '../backtest/ipsEstimator.mjs';
import { isValidResultCard } from '../../src/utils/standardOfRecord/resultCard.js';
import { REQUIRED_CONSTANTS } from '../../src/utils/standardOfRecord/manifest.js';

let root;
const corpusFiles = () => ([
  { path: join(root, 'PS-200NLH', 'a.phhs'), site: 'PS', stakeLabel: '200NLH' },
  { path: join(root, 'PS-200NLH', 'b.phhs'), site: 'PS', stakeLabel: '200NLH' },
]);

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'sor-dealbook-'));
  mkdirSync(join(root, 'PS-200NLH'), { recursive: true });
  writeFileSync(join(root, 'PS-200NLH', 'a.phhs'), 'hand one\n');
  writeFileSync(join(root, 'PS-200NLH', 'b.phhs'), 'hand two, longer\n');
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('contentHashNode — one algorithm, two entry points', () => {
  it('agrees byte-for-byte with the async shared primitive', async () => {
    const value = { b: 2, a: [1, { z: 'x' }] };
    expect(hashObjectSync(value)).toBe(await hashUtil(stableStringify(value)));
  });

  it('is insensitive to key insertion order', () => {
    expect(hashObjectSync({ a: 1, b: 2 })).toBe(hashObjectSync({ b: 2, a: 1 }));
  });

  it('prefixes sha256:', () => {
    expect(hashStringSync('x').startsWith('sha256:')).toBe(true);
  });
});

describe('buildDealBook', () => {
  const sliceSpec = { sites: ['PS'], stakes: ['200NLH'], maxFiles: null };

  it('produces the same hash for the same slice, twice', async () => {
    const a = await buildDealBook({ files: corpusFiles(), root, sliceSpec });
    const b = await buildDealBook({ files: corpusFiles(), root, sliceSpec });
    expect(a.contentHash).toBe(b.contentHash);
  });

  it('is insensitive to the order files were discovered in', async () => {
    const a = await buildDealBook({ files: corpusFiles(), root, sliceSpec });
    const b = await buildDealBook({ files: corpusFiles().reverse(), root, sliceSpec });
    // Directory iteration order is a filesystem detail, not a property of the hand set.
    expect(a.contentHash).toBe(b.contentHash);
  });

  it('stores paths relative to the corpus root, so the hash is not machine-specific', async () => {
    const book = await buildDealBook({ files: corpusFiles(), root, sliceSpec });
    for (const m of book.members) {
      expect(m.path.includes(root)).toBe(false);
      expect(m.path).toMatch(/^PS-200NLH\//);
    }
  });

  it('changes when a member file changes size', async () => {
    const before = await buildDealBook({ files: corpusFiles(), root, sliceSpec });
    writeFileSync(join(root, 'PS-200NLH', 'a.phhs'), 'hand one, now much longer than before\n');
    const after = await buildDealBook({ files: corpusFiles(), root, sliceSpec });
    expect(after.contentHash).not.toBe(before.contentHash);
    writeFileSync(join(root, 'PS-200NLH', 'a.phhs'), 'hand one\n'); // restore
  });

  it('changes when the slice spec changes, even over identical files', async () => {
    const a = await buildDealBook({ files: corpusFiles(), root, sliceSpec });
    const b = await buildDealBook({ files: corpusFiles(), root, sliceSpec: { ...sliceSpec, maxFiles: 1 } });
    expect(a.contentHash).not.toBe(b.contentHash);
  });

  it('records which identity mode was used, so a reader knows the strength of the guarantee', async () => {
    const weak = await buildDealBook({ files: corpusFiles(), root, sliceSpec });
    const strong = await buildDealBook({ files: corpusFiles(), root, sliceSpec, identity: 'content' });
    expect(weak.identity).toBe('path+size');
    expect(strong.identity).toBe('content');
    expect(strong.members[0].contentHash.startsWith('sha256:')).toBe(true);
    // Different evidence about the same files must not collide.
    expect(weak.contentHash).not.toBe(strong.contentHash);
  });

  it('detects a same-size edit ONLY in content mode — the documented limit of the default', async () => {
    const beforeWeak = await buildDealBook({ files: corpusFiles(), root, sliceSpec });
    const beforeStrong = await buildDealBook({ files: corpusFiles(), root, sliceSpec, identity: 'content' });
    writeFileSync(join(root, 'PS-200NLH', 'a.phhs'), 'HAND ONE\n'); // same byte length
    const afterWeak = await buildDealBook({ files: corpusFiles(), root, sliceSpec });
    const afterStrong = await buildDealBook({ files: corpusFiles(), root, sliceSpec, identity: 'content' });
    expect(afterWeak.contentHash).toBe(beforeWeak.contentHash);      // the stated blind spot
    expect(afterStrong.contentHash).not.toBe(beforeStrong.contentHash);
    writeFileSync(join(root, 'PS-200NLH', 'a.phhs'), 'hand one\n');
  });

  it('refuses to build a book over zero files', async () => {
    await expect(buildDealBook({ files: [], root, sliceSpec })).rejects.toThrow(/zero files/);
  });

  it('rejects an unknown identity mode', async () => {
    await expect(buildDealBook({ files: corpusFiles(), root, sliceSpec, identity: 'vibes' }))
      .rejects.toThrow(`identity must be one of ${IDENTITY_MODES.join(' | ')}`);
  });

  it('derives an id that changes with content even when the filters match', () => {
    const spec = { sites: ['PS'], stakes: ['200NLH'] };
    expect(deriveDealBookId(spec, 'sha256:aaaaaaaabbbb'))
      .not.toBe(deriveDealBookId(spec, 'sha256:ccccccccdddd'));
  });
});

/**
 * A minimal run object. Real runs come from `runHeroEv`; this is the shape
 * `buildHeroEvReport` consumes, built by hand so the report can be tested without a corpus.
 */
const runFixture = (overrides = {}) => ({
  complete: true,
  decisionsScored: 2,
  decisions: [
    {
      playerId: 'p1', handId: 'h1', observedAction: 'call', netBB: 3, netBBUnraked: 3.2,
      piOurs: { call: 1, fold: 0 }, piPool: { call: 0.5, fold: 0.5 },
    },
    {
      playerId: 'p2', handId: 'h2', observedAction: 'fold', netBB: -1, netBBUnraked: -1,
      piOurs: { call: 0, fold: 1 }, piPool: { call: 0.5, fold: 0.5 },
    },
  ],
  integrity: {
    poolPct: 50, referenceMode: 'none', evalPlayersChecked: 2, decisionsChecked: 2,
    behaviorPolicy: { partition: 'pool-train', poolPct: 50, observations: 1000, players: 40, hierarchy: [] },
  },
  counters: { checkpoints: 2, handsRead: 10, evalPlayers: 2, adapterSkips: {}, policySkips: {}, outcomeUnresolved: {} },
  config: { poolPct: 50, rakeConfig: null, rakeIsModelled: true },
  runtimeMs: 5,
  ...overrides,
});

const stampFixture = () => ({
  engineCommit: 'a'.repeat(40),
  engineDirty: false,
  dealBookHash: 'sha256:' + 'b'.repeat(64),
  fieldVersion: 'behavior-policy@pool-train/1000obs',
  partition: 'pool-train@50',
  seeds: { clusterBootstrap: DEFAULT_BOOTSTRAP_SEED },
  unseededSources: [{ source: 'src/utils/pokerCore/monteCarloEquity.js', mechanism: 'Math.random()' }],
  constants: { PRIOR_WEIGHT: 10, ACTION_TAU_FRACTION: { check: 1 }, MIN_CONTINUATION_WEIGHT: 0.05 },
  // WS-330: a Result Card must name the register version it stood under, so a fault confirmed
  // later can find the results that depended on it. A literal keeps this fixture stable across
  // register edits; `replicationStamp.buildStampInput` supplies the real value in production.
  disclaimerRegisterVersion: 'FR-1+000000000000',
  knownDivergences: [],
});

describe('buildHeroEvReport — the Standard of Record retrofit', () => {
  it('bumped its schema version', () => {
    // v2 = WS-322 (Result Card), v3 = WS-331 (pier posts). Both additive; the assertion
    // below is the one that guards the additive property.
    expect(HERO_EV_SCHEMA_VERSION).toBe(3);
  });

  it('STILL emits every field it emitted before — the retrofit is additive', () => {
    const report = buildHeroEvReport(runFixture());
    for (const key of ['schemaVersion', 'caveat', 'treatment', 'admissibility', 'provenance',
      'generatedFrom', 'arms', 'gate', 'foldShiftPp']) {
      expect(report, `pre-existing field "${key}" disappeared`).toHaveProperty(key);
    }
    expect(report.generatedFrom).toHaveProperty('config');
    expect(report.generatedFrom).toHaveProperty('integrity');
    expect(report.gate).toHaveProperty('c3Passes');
  });

  it('emits a valid Result Card when the run carries a replication stamp', () => {
    const report = buildHeroEvReport(runFixture({
      replicationStamp: stampFixture(),
      dealBook: { dealBookId: 'handhq-PS-200NLH-deadbeef' },
    }));
    expect(report.resultCardProblems).toEqual([]);
    expect(isValidResultCard(report.resultCard)).toBe(true);
  });

  it('stamps a real commit, a Deal Book hash, and every required constant', () => {
    const report = buildHeroEvReport(runFixture({
      replicationStamp: stampFixture(),
      dealBook: { dealBookId: 'handhq-PS-200NLH-deadbeef' },
    }));
    const m = report.resultCard.manifest;
    expect(m.engineCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(m.dealBookHash.startsWith('sha256:')).toBe(true);
    expect(m.seeds.clusterBootstrap).toBe(DEFAULT_BOOTSTRAP_SEED);
    for (const name of REQUIRED_CONSTANTS) {
      expect(m.constants, `manifest is missing ${name}`).toHaveProperty(name);
    }
  });

  it('carries the unseeded Monte Carlo source rather than claiming bit-reproducibility', () => {
    const report = buildHeroEvReport(runFixture({
      replicationStamp: stampFixture(),
      dealBook: { dealBookId: 'x' },
    }));
    expect(report.resultCard.manifest.unseededSources.length).toBeGreaterThan(0);
  });

  it('clusters on players, never hands', () => {
    const report = buildHeroEvReport(runFixture({
      replicationStamp: stampFixture(), dealBook: { dealBookId: 'x' },
    }));
    expect(report.resultCard.clusterUnit).toBe('players');
  });

  it('emits NO Result Card, and says why, when the run has no stamp', () => {
    const report = buildHeroEvReport(runFixture());
    expect(report.resultCard).toBeNull();
    expect(report.resultCardProblems.join(' ')).toMatch(/must not be quoted/);
  });

  it('does not throw when the stamp is incomplete — it reports the problem instead', () => {
    const bad = stampFixture();
    delete bad.constants.PRIOR_WEIGHT;
    const report = buildHeroEvReport(runFixture({ replicationStamp: bad, dealBook: { dealBookId: 'x' } }));
    expect(report.resultCard).toBeNull();
    expect(report.resultCardProblems.join(' ')).toMatch(/PRIOR_WEIGHT/);
  });
});
