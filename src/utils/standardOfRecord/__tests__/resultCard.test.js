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
import {
  buildReplicationManifest, manifestProblems, knownDivergence, REQUIRED_CONSTANTS,
  MANIFEST_DEFAULTS,
} from '../manifest.js';
import { registerVersion } from '../faultRegister.js';
import { StandardOfRecordError, MANIFEST_SCHEMA } from '../schemas.js';

const manifestInput = () => ({
  engineCommit: '89c1266aa0f1e2d3c4b5a69788990011223344556',
  engineDirty: false,
  dealBookHash: 'sha256:' + 'a'.repeat(64),
  fieldVersion: 'behavior-policy-2026-07-31',
  partition: 'pool-train@50',
  seeds: { clusterBootstrap: 0x9e3779b9 },
  unseededSources: [],
  constants: {
    PRIOR_WEIGHT: 10,
    ACTION_TAU_FRACTION: 0.3,
    MIN_CONTINUATION_WEIGHT: 0.05,
    // WS-432: the refinement configuration joined the minimum set — see manifest.js.
    REFINEMENT_BUDGET_MS: 0,
    MAX_STAGE_SHARE: 0.4,
    REFINEMENT_UNITS_PER_MS: 300,
    // FIND-090: documented-as-stamped since WS-336, enforced since WS-432.
    KL_FLOOR: 1e-6,
  },
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
  // WS-434: a complete hero-ev metrics block — the kind dispatches metricsProblems, and the
  // fixture carries every declared field so it stays valid under the strict-key publish check.
  metrics: {
    kind: 'hero-ev',
    edgeBB: 0.42, edgeCiLowBB: 0.11, edgeCiHighBB: 0.78,
    n: 4210, ess: 812, players: 44,
    controlEdgeBB: 0.0000004, liveShiftedCiLowBB: 0.02, pbrEdgeBB: 1.9,
    exploitationEfficiency: 0.22, exploitationEfficiencyUnavailableReason: null,
    overallEvBB100: 0.42 * 2.1 * 100, opportunitiesPerHand: 2.1,
  },
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

  // ── WS-504: the builder may not disagree with the registry. ─────────────────────────────
  //
  // THE REGRESSION THESE LOCK. `fileSelection` shipped in schemas.js, in schema-baseline.json
  // and in schemas.test.js — and the builder's hand-maintained destructure dropped it on the
  // floor, so the Result Card that IS the claim under ADR-009 carried no record of how its
  // sample was drawn. Nothing failed; the field simply was not there.
  it('emits every field MANIFEST_SCHEMA registers — a registered field cannot be silently dropped', () => {
    const m = buildReplicationManifest({ ...manifestInput(), fileSelection: { strategy: 'proportional' } });
    for (const f of MANIFEST_SCHEMA) {
      expect(Object.prototype.hasOwnProperty.call(m, f.name), `manifest.${f.name} was dropped by the builder`).toBe(true);
    }
  });

  it('declares a default for every registered field, so adding one fails at authoring time', () => {
    expect(Object.keys(MANIFEST_DEFAULTS).sort()).toEqual(MANIFEST_SCHEMA.map((f) => f.name).sort());
  });

  it('carries fileSelection through, and defaults it to null when the caller omits it', () => {
    const sel = { strategy: 'prefix', version: 'strat-v1', capped: true, collapsed: true };
    expect(buildReplicationManifest({ ...manifestInput(), fileSelection: sel }).fileSelection).toEqual(sel);
    expect(buildReplicationManifest(manifestInput()).fileSelection).toBeNull();
  });

  // The reason the fix iterates the schema rather than spreading `{...input}`: unknown extra
  // fields are deliberately allowed by checkAgainstSchema so a newer producer cannot break an
  // older reader, and manifestProblems adds no key-set check — so a passthrough would let a
  // typo into a published artifact with nothing anywhere to catch it.
  it('does not admit an unregistered key — a typo must not reach a published artifact', () => {
    const m = buildReplicationManifest({ ...manifestInput(), fileSelectoin: { strategy: 'prefix' } });
    expect(m).not.toHaveProperty('fileSelectoin');
  });

  it('does not share a mutable default between two manifests built in one process', () => {
    const a = buildReplicationManifest(manifestInput());
    const b = buildReplicationManifest(manifestInput());
    a.knownDivergences.push('x');
    expect(b.knownDivergences).toEqual([]);
  });

  it('emits the ten pre-WS-504 fields in their original order, so no content hash moves', () => {
    expect(Object.keys(buildReplicationManifest(manifestInput())).slice(0, 10)).toEqual([
      'engineCommit', 'engineDirty', 'dealBookHash', 'fieldVersion', 'partition',
      'seeds', 'unseededSources', 'constants', 'disclaimerRegisterVersion', 'knownDivergences',
    ]);
  });

  it('WS-432 raised the constant floor — the refinement configuration is in the minimum set', () => {
    // Pinned by name so removing one from REQUIRED_CONSTANTS is a visible test change, not
    // a silent narrowing of what a card must carry. The it.each above is what proves each
    // one is actually ENFORCED.
    for (const name of ['REFINEMENT_BUDGET_MS', 'MAX_STAGE_SHARE', 'REFINEMENT_UNITS_PER_MS', 'KL_FLOOR']) {
      expect(REQUIRED_CONSTANTS).toContain(name);
    }
  });

  it('refuses absent seeds but accepts an explicitly empty set', () => {
    const noSeeds = { ...manifestInput() };
    delete noSeeds.seeds;
    expect(() => buildReplicationManifest(noSeeds)).toThrow(/seeds/);
    expect(() => buildReplicationManifest({ ...manifestInput(), seeds: {} })).not.toThrow();
  });

  // ── the disclaimer stamp, and the hole in the check that guarded it (WS-353 follow-up) ──────────
  //
  // WS-353 flagged `RC-hero-ev-2d765568-c56405ee` (out/hero-ev-pbr.json) as carrying
  // `disclaimerRegisterVersion: null` while `manifestProblems` was supposed to reject that,
  // and read it as an enforcement hole. It is not: that artifact was produced 2026-08-04
  // 00:14 from engine commit c56405ee, and WS-330 — which added BOTH the requirement and the
  // stamp — landed at 11:42 the same day. Re-run `resultCardProblems` on that card today and
  // it is rejected. What the card actually preserves is a stale verdict: its stored
  // `resultCardProblems: []` was computed under the old rules and nothing rechecks it.
  //
  // The REAL hole is one line below the presence check: `!version` accepts any non-empty
  // string. That is the case that matters, because the stamp exists only to be JOINED back to
  // a register version, and an unjoinable string is worse than `null` — `null` says the card
  // cannot name its register, `'unknown'` claims it can.
  it('refuses a NULL register stamp — the presence check, pinned as a regression', () => {
    const input = { ...manifestInput(), disclaimerRegisterVersion: null };
    expect(() => buildReplicationManifest(input)).toThrow(/disclaimerRegisterVersion is missing/);
  });

  it('refuses an ABSENT register stamp, which the builder defaults to null', () => {
    const input = { ...manifestInput() };
    delete input.disclaimerRegisterVersion;
    expect(() => buildReplicationManifest(input)).toThrow(/disclaimerRegisterVersion is missing/);
  });

  it('refuses an UNDEFINED register stamp on a manifest checked rather than built', () => {
    // A hand-assembled manifest reaches `manifestProblems` without passing the builder's
    // default, so `undefined` has to be caught on its own account.
    const problems = manifestProblems({ ...manifestInput(), disclaimerRegisterVersion: undefined });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join(' ')).toMatch(/disclaimerRegisterVersion/);
  });

  it('refuses an EMPTY-STRING register stamp', () => {
    expect(() => buildReplicationManifest({ ...manifestInput(), disclaimerRegisterVersion: '' }))
      .toThrow(/disclaimerRegisterVersion is missing/);
  });

  // THE FAILING CASE. Every value here is non-empty and passed the old truthiness check.
  it.each([
    ['a placeholder somebody meant to replace', 'unknown'],
    ['a hand-typed version', 'v1'],
    ['the epoch with no hash', 'FR-1'],
    ['the epoch with an empty hash', 'FR-1+'],
    ['a hash that is too short', 'FR-1+e3867c10fc2'],
    ['a hash that is too long', 'FR-1+e3867c10fc2ab'],
    ['a hash that is not lowercase hex', 'FR-1+ABCDEF012345'],
    ['a hash that is not hex at all', 'FR-1+zzzzzzzzzzzz'],
    ['the wrong register family', 'SOR-1+e3867c10fc2a'],
  ])('refuses %s (%s) — a stamp that cannot be joined is worse than none', (_label, value) => {
    expect(() => buildReplicationManifest({ ...manifestInput(), disclaimerRegisterVersion: value }))
      .toThrow(/is not a register version/);
  });

  it('accepts a future epoch, because bumping the epoch is a legal change', () => {
    // A validator pinned to `FR-1` would reject every card minted the day after an epoch bump.
    expect(manifestProblems(buildReplicationManifest({
      ...manifestInput(), disclaimerRegisterVersion: 'FR-12+8c4e65578ca2',
    }))).toEqual([]);
  });

  it('accepts what registerVersion() actually mints, so checker and producer cannot drift', async () => {
    const version = await registerVersion();
    expect(manifestProblems(buildReplicationManifest({
      ...manifestInput(), disclaimerRegisterVersion: version,
    }))).toEqual([]);
  });

  it('rejects the WS-353 card SHAPE at the card level, not just the manifest level', () => {
    // The shape of `RC-hero-ev-2d765568-c56405ee`: a complete card whose only defect is the
    // null stamp. `resultCardProblems` must surface it, because the scanner checks cards it
    // did not build and that is the path an existing artifact arrives on.
    const card = { ...cardInput(), manifest: { ...manifestInput(), disclaimerRegisterVersion: null } };
    const problems = resultCardProblems({ ...card, schemaVersion: 2 });
    expect(problems.join(' ')).toMatch(/disclaimerRegisterVersion is missing/);
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
