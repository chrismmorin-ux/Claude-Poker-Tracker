/**
 * resultCard.test.js — a Result Card missing any element of its manifest is not a Result Card.
 *
 * Each case below is a real omission that would produce an artifact looking complete and
 * being unreplicable. The engine-commit case is the one that actually happened: NOTHING in
 * `scripts/backtest/` or `scripts/readiness/` captured a commit SHA before WS-322, so every
 * figure the repo has published so far names the code that produced it only by implication.
 */

import { describe, it, expect } from 'vitest';

import {
  buildResultCard, resultCardProblems, isValidResultCard, CLUSTER_UNITS,
  cardCaveat, needsCaveat,
} from '../resultCard.js';
import { buildFlipRegister, buildFragility, buildMargin } from '../fragility.js';
import { buildComparisonCensus, censusSummary, contrastKey } from '../comparisonCensus.js';
import { buildReplicationManifest, manifestProblems, knownDivergence, REQUIRED_CONSTANTS } from '../manifest.js';
import { StandardOfRecordError } from '../schemas.js';

const manifestInput = () => ({
  engineCommit: '89c1266aa0f1e2d3c4b5a69788990011223344556',
  engineDirty: false,
  dealBookHash: 'sha256:' + 'a'.repeat(64),
  fieldVersion: 'behavior-policy-2026-07-31',
  partition: 'pool-train@50',
  seeds: { clusterBootstrap: 0x9e3779b9 },
  unseededSources: [],
  constants: { PRIOR_WEIGHT: 10, ACTION_TAU_FRACTION: 0.3, MIN_CONTINUATION_WEIGHT: 0.05 },
  // A literal rather than `await registerVersion()`, so this fixture stays synchronous and does
  // not re-pin itself every time an entry is edited. The real stamp is asserted where it
  // matters — `faultRegister.test.js` checks the version is content-derived, and
  // `replicationStamp` is the production caller.
  disclaimerRegisterVersion: 'FR-1+000000000000',
});

const cardInput = () => ({
  resultCardId: 'RC-hero-ev-2026-08-02',
  match: { surfaceId: 'engine-read-v123', dealBookId: 'handhq-200NLH-2026-08', fieldId: 'pool-mined-v1' },
  estimand: 'Expected hand value in bb, attributed at the decision level, vs population-typical play',
  treatment: 'per-decision IPS · one-decision horizon · pool continuation · range-marginalized policy',
  metrics: { edgeBB: 0.42, edgeCiLowBB: 0.11, edgeCiHighBB: 0.78, n: 4210 },
  clusterUnit: 'players',
  admissibility: { admissible: true, blockers: [], warnings: [], clusters: 44 },
  manifest: buildReplicationManifest(manifestInput()),
});

describe('buildReplicationManifest', () => {
  it('builds a complete manifest', () => {
    expect(manifestProblems(buildReplicationManifest(manifestInput()))).toEqual([]);
  });

  it('refuses a manifest with no engine commit', () => {
    const input = { ...manifestInput(), engineCommit: '' };
    expect(() => buildReplicationManifest(input)).toThrow(StandardOfRecordError);
    expect(() => buildReplicationManifest(input)).toThrow(/engineCommit/);
  });

  it('refuses a corpus identified by a path rather than a content hash', () => {
    const input = { ...manifestInput(), dealBookHash: 'C:/Users/chris/data/phh-dataset' };
    expect(() => buildReplicationManifest(input)).toThrow(/must be a sha256 content hash/);
  });

  it.each(REQUIRED_CONSTANTS)('refuses a manifest missing %s', (name) => {
    const input = manifestInput();
    delete input.constants[name];
    expect(() => buildReplicationManifest(input)).toThrow(new RegExp(`constants\\.${name} is missing`));
  });

  it('refuses absent seeds but accepts an explicitly empty set', () => {
    const noSeeds = { ...manifestInput() };
    delete noSeeds.seeds;
    expect(() => buildReplicationManifest(noSeeds)).toThrow(/seeds/);
    expect(() => buildReplicationManifest({ ...manifestInput(), seeds: {} })).not.toThrow();
  });

  it('records a dirty tree, because a dirty commit does not identify the code that ran', () => {
    const m = buildReplicationManifest({ ...manifestInput(), engineDirty: true });
    expect(m.engineDirty).toBe(true);
  });

  it('refuses an ABSENT unseededSources, so bit-reproducibility is never claimed by accident', () => {
    const input = { ...manifestInput() };
    delete input.unseededSources;
    expect(() => buildReplicationManifest(input)).toThrow(/POSITIVE CLAIM/);
  });

  it('carries a declared unseeded source through', () => {
    // The live case: gameTreeEvaluator -> handVsRange -> Math.random().
    const m = buildReplicationManifest({
      ...manifestInput(),
      unseededSources: [{ source: 'src/utils/pokerCore/monteCarloEquity.js', mechanism: 'Math.random()' }],
    });
    expect(m.unseededSources).toHaveLength(1);
  });
});

describe('knownDivergence', () => {
  it('records agreement today so a future drift has somewhere to show up', () => {
    // foldEquityCalculator.js:563 shadows populationPriors.js:66. Same value today.
    const d = knownDivergence({
      name: 'PRIOR_WEIGHT',
      canonical: 10,
      shadowAt: 'src/utils/exploitEngine/foldEquityCalculator.js:563',
      shadowValue: 10,
    });
    expect(d.agrees).toBe(true);
  });

  it('flags a real divergence', () => {
    const d = knownDivergence({
      name: 'PRIOR_WEIGHT', canonical: 10,
      shadowAt: 'somewhere.js:1', shadowValue: 12,
    });
    expect(d.agrees).toBe(false);
  });

  it('reports UNKNOWN rather than disagreement when the shadow cannot be read', () => {
    // The live case: foldEquityCalculator's copy is module-local and not exported, so its
    // value cannot be read from outside. Reporting `false` would assert a disagreement
    // nobody observed.
    const d = knownDivergence({
      name: 'PRIOR_WEIGHT', canonical: 10,
      shadowAt: 'src/utils/exploitEngine/foldEquityCalculator.js:563', shadowValue: null,
    });
    expect(d.agrees).toBeNull();
  });
});

describe('buildResultCard', () => {
  it('builds a valid card', () => {
    expect(isValidResultCard(buildResultCard(cardInput()))).toBe(true);
  });

  it.each(['surfaceId', 'dealBookId', 'fieldId'])(
    'refuses a Match missing %s — a result that cannot name all three is uncomparable',
    (key) => {
      const input = cardInput();
      delete input.match[key];
      expect(() => buildResultCard(input)).toThrow(new RegExp(`match\\.${key} is missing`));
    },
  );

  it('refuses hands as a cluster unit', () => {
    // POKER_THEORY 14.3 — hands are not independent within a session.
    expect(() => buildResultCard({ ...cardInput(), clusterUnit: 'hands' }))
      .toThrow(/clusterUnit must be one of sessions \| players/);
  });

  it.each(CLUSTER_UNITS)('accepts %s as a cluster unit', (unit) => {
    expect(() => buildResultCard({ ...cardInput(), clusterUnit: unit })).not.toThrow();
  });

  it('refuses a card with no stated estimand', () => {
    expect(() => buildResultCard({ ...cardInput(), estimand: '' })).toThrow(/estimand/);
  });

  it('refuses a card whose manifest is incomplete, surfacing the manifest problem', () => {
    const input = cardInput();
    input.manifest = { ...input.manifest, engineCommit: '' };
    expect(() => buildResultCard(input)).toThrow(/engineCommit/);
  });

  it('reports every problem at once rather than one at a time', () => {
    const problems = resultCardProblems({ schemaVersion: 1 });
    expect(problems.length).toBeGreaterThan(3);
  });

  it('leaves census and warrantAttribution null until their tickets land', () => {
    const card = buildResultCard(cardInput());
    // WS-327 computes warrant attribution. The slot exists now so the schema does not change
    // when it does.
    expect(card.census).toBeNull();
    expect(card.warrantAttribution).toBeNull();
  });
});

/**
 * The anti-shallowness fields, and their READER (founder directive 2026-08-03).
 *
 * A flip count stored but never rendered would reproduce, inside the mechanism built to
 * prevent overconfidence, the exact failure it exists to prevent. So the reader is tested
 * alongside the field.
 */
describe('fragility, flip register, and the caveat that reads them', () => {
  it('carries the atom set by hash and the anchor generation', () => {
    const card = buildResultCard({
      ...cardInput(),
      atomSetHash: 'sha256:' + 'b'.repeat(64),
      atomCount: 41823,
      anchorGeneration: 2,
    });
    expect(card.atomSetHash).toMatch(/^sha256:/);
    expect(card.atomCount).toBe(41823);
    expect(card.anchorGeneration).toBe(2);
  });

  it('refuses a flip register whose estimand does not match the card', () => {
    const problems = resultCardProblems({
      ...buildResultCard(cardInput()),
      flipRegister: buildFlipRegister({ estimand: 'something else', currentDirection: 'supports' }),
    });
    expect(problems.some((p) => /does not match/.test(p))).toBe(true);
  });

  it('accepts a flip register on the same estimand', () => {
    const input = cardInput();
    const card = buildResultCard({
      ...input,
      flipRegister: buildFlipRegister({ estimand: input.estimand, currentDirection: 'supports' }),
    });
    expect(isValidResultCard(card)).toBe(true);
  });

  it('RENDERS a caveat when the conclusion has reversed before', () => {
    const input = cardInput();
    const card = buildResultCard({
      ...input,
      flipRegister: buildFlipRegister({
        estimand: input.estimand,
        priorConclusions: [{ direction: 'supports' }, { direction: 'refutes' }],
        currentDirection: 'supports',
      }),
    });
    expect(needsCaveat(card)).toBe(true);
    expect(cardCaveat(card)).toMatch(/REVERSED 2 time\(s\)/);
  });

  it('RENDERS a caveat when the result is a knife edge', () => {
    const input = cardInput();
    const card = buildResultCard({
      ...input,
      fragility: buildFragility({
        margins: [buildMargin({ name: 'PRIOR_WEIGHT', value: 10, flipsAt: 10.3, sweptRange: [5, 20] })],
      }),
    });
    expect(cardCaveat(card)).toMatch(/knife edge/);
    expect(cardCaveat(card)).toMatch(/PRIOR_WEIGHT/);
  });

  it('needs no caveat for a stable, robust result', () => {
    const input = cardInput();
    const card = buildResultCard({
      ...input,
      flipRegister: buildFlipRegister({ estimand: input.estimand, currentDirection: 'supports' }),
      fragility: buildFragility({
        margins: [buildMargin({ name: 'PRIOR_WEIGHT', value: 10, flipsAt: 40, sweptRange: [5, 60] })],
      }),
    });
    expect(needsCaveat(card)).toBe(false);
    expect(cardCaveat(card)).toBeNull();
  });

  it('carries a comparison census naming the contrasts nobody drew', () => {
    const card = buildResultCard({
      ...cardInput(),
      comparisonCensus: buildComparisonCensus({
        axis: 'surface',
        members: ['srf-A', 'srf-B', 'srf-C'],
        drawn: [{ contrast: contrastKey('srf-A', 'srf-B'), resultCardId: 'RC-1' }],
      }),
    });
    expect(censusSummary(card.comparisonCensus).notAttempted).toBe(2);
  });
});
