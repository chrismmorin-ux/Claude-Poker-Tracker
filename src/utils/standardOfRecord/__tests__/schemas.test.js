/**
 * schemas.test.js — the additive-only guard.
 *
 * WS-322 was asked for schemas "versioned ADDITIVE-ONLY (same discipline as the IDB rule,
 * which has a check script)". The IDB rule is enforced by two different mechanisms on purpose
 * — `scripts/check-idb-additive.sh` catches the source-code primitive (a `deleteObjectStore`
 * call) and `migrationRegistry.test.js` catches the data-shape primitive (`storesRemoved` must
 * stay `[]`). "Different failure modes; both required."
 *
 * This file is the data-shape half. The CI grep gate is WS-329's, which is where the standard
 * becomes binding; shipping the grep here would gate a rule the repo cannot yet satisfy.
 *
 * The guard works by pinning a BASELINE of every field that has shipped. Removing a field or
 * changing its type fails. Adding one does not — that is the whole point of additive-only, and
 * a guard that flagged additions would just get disabled.
 */

import { describe, it, expect } from 'vitest';

import {
  SOR_SCHEMAS, MANIFEST_SCHEMA, SOR_SCHEMA_VERSIONS, checkAgainstSchema,
  DECISION_RECORD_META_SCHEMA, DECISION_RECORD_SUMMARY_SCHEMA,
} from '../schemas.js';

/**
 * BASELINE — every field shipped so far, as `objectType.fieldName: type`.
 *
 * APPEND to this when you add a field. NEVER delete a line, and never change the type on an
 * existing line: that is precisely the change this test exists to stop. If a field becomes
 * obsolete, mark it `deprecated` in schemas.js and leave both the descriptor and this line in
 * place, so a reader that still looks for it gets null rather than a crash.
 */
const SHIPPED_FIELDS = {
  strategyCard: {
    cardId: 'string', schemaVersion: 'number', title: 'string', rationale: 'string',
    domain: 'object', rules: 'array', residual: 'object',
    contentHash: 'string|null', surfaceKind: 'string',
  },
  decisionAtom: {
    schemaVersion: 'number', atomId: 'string', situationKey: 'string', carried: 'object',
    surfaceId: 'string', action: 'object', ruleId: 'string|null', warrant: 'string|null',
    layers: 'array', outcome: 'object|null', skipReason: 'string|null',
    // v2 (WS-328)
    alternativeScores: 'object|null', rulesMatchedAndLost: 'array', beliefState: 'object|null',
    truth: 'object|null', seeds: 'object', actorSeat: 'number|null', actorRole: 'string|null',
    wallTimeMs: 'number|null', tokens: 'number|null',
    // v3 (WS-431) — atomId's parts kept, run coordinates, omission discriminator
    playerId: 'string|null', handId: 'string|number|null', order: 'number|null',
    stable: 'object|null', omissions: 'object|null',
  },
  coverageCensus: {
    schemaVersion: 'number', domain: 'object', cells: 'array',
    totalContexts: 'number', hitContexts: 'number', abstentions: 'number',
  },
  comparisonCensus: {
    schemaVersion: 'number', axis: 'string', possible: 'array', drawn: 'array',
    notDrawn: 'array', blockedReasons: 'object',
  },
  dealBookManifest: {
    schemaVersion: 'number', dealBookId: 'string', kind: 'string', sliceSpec: 'object',
    members: 'array', memberCount: 'number', seeds: 'object', contentHash: 'string',
  },
  fieldManifest: {
    schemaVersion: 'number', fieldId: 'string', surfaceKind: 'string', sources: 'array',
    partition: 'string|null', responsive: 'boolean',
    observations: 'number|null', version: 'string|null',
  },
  resultCard: {
    schemaVersion: 'number', resultCardId: 'string', match: 'object', estimand: 'string',
    treatment: 'string', metrics: 'object', clusterUnit: 'string', admissibility: 'object',
    manifest: 'object', census: 'object|null', warrantAttribution: 'object|null',
    // v2 (WS-328)
    atomSetHash: 'string|null', atomCount: 'number|null', anchorGeneration: 'number|null',
    // v2 anti-shallowness (founder directive 2026-08-03)
    fragility: 'object|null', flipRegister: 'object|null', comparisonCensus: 'object|null',
    // v3 (WS-431)
    decisionRecord: 'object|null',
  },
  faultEntry: {
    faultId: 'string', title: 'string', site: 'string', mechanism: 'string',
    contaminates: 'string', matches: 'function', falsifier: 'string',
    probability: 'number', probabilityBasis: 'string', priorBreadth: 'number',
    status: 'string', evidence: 'array',
  },
  // WS-431 — the per-decision JSONL record (scripts/backtest/decisionRecord.mjs), governed.
  decisionRecord: {
    schemaVersion: 'number', playerId: 'string', handId: 'string|number', order: 'number',
    observedAction: 'string', observedAmount: 'number|null',
    netBB: 'number', netBBUnraked: 'number|null', street: 'string',
    heroSeat: 'string|number|null', buttonSeat: 'string|number|null', opponentSeat: 'string|number|null',
    board: 'array|null', boardLabels: 'array|null',
    situationKey: 'string|null', contextAction: 'string|null',
    isAgg: 'boolean|null', isIP: 'boolean|null', rangeEquityPct: 'number|null',
    segmentation: 'object|null', geometry: 'object|null',
    piOurs: 'object', evStats: 'object|null', piOursByArm: 'object',
    piPool: 'object', poolEvidenceN: 'number|null',
    piPbr: 'object|null', piPbrBySweep: 'object|array|null', slices: 'object',
    pPoolObserved: 'number|null', pOursObservedByArm: 'object', wRawByArm: 'object',
    heroTruth: 'object', evStatsByArm: 'object', combosByArm: 'object',
    policyDiagByArm: 'object', pbrSkipReason: 'string|null',
    // v2 (WS-431)
    stable: 'object|null', omitted: 'object|null',
  },
  // ── WS-434 — the Result Card metrics union. Two shared leaf shapes + one variant per
  // producer, each transcribed from the producer's literal at HEAD. Same append-only rule
  // as every block above.
  'metrics.shared.conditioned-rate': {
    k: 'number', n: 'number', rate: 'number|null', conditional: 'string',
  },
  'metrics.shared.divergence-pair': {
    preRegistration: 'object', comparableByMagnitude: 'boolean', klDirection: 'string',
    weightingReported: 'string', bySurface: 'object', ranking: 'object', klFloorSweep: 'object',
  },
  'metrics.hero-ev': {
    kind: 'string', edgeBB: 'number|null', edgeCiLowBB: 'number|null', edgeCiHighBB: 'number|null',
    n: 'number', ess: 'number|null', players: 'number', controlEdgeBB: 'number|null',
    liveShiftedCiLowBB: 'number|null', pbrEdgeBB: 'number|null',
    exploitationEfficiency: 'number|null', exploitationEfficiencyUnavailableReason: 'string|null',
    overallEvBB100: 'number|null', opportunitiesPerHand: 'number|null',
  },
  'metrics.depth-ablation': {
    kind: 'string', depthDeltaBB: 'number|null', depthDeltaCiLowBB: 'number|null',
    depthDeltaCiHighBB: 'number|null', depthDeltaExcludesZero: 'boolean|null',
    edgeBaseArmBB: 'number|null', edgeTestArmBB: 'number|null', topActionFlipShare: 'number|null',
    flipShareByStreet: 'object', flipCountByStreet: 'object', flipDirections: 'object',
    meanTotalVariation: 'number|null', maxTotalVariation: 'number|null', identicalShare: 'number|null',
    n: 'number', discordantN: 'number|null', players: 'number', divergenceN: 'number',
    controlEdgeBB: 'number|null', notAVerdict: 'boolean',
  },
  'metrics.deviation-map': {
    kind: 'string', deviationVolume: 'number', totalDecisions: 'number',
    wellSampledCells: 'number', thinCells: 'number', minCellN: 'number', topCells: 'array',
  },
  'metrics.layer-divergence': {
    kind: 'string', divergence: 'object', attribution: 'object', counters: 'object',
    notAnEdge: 'boolean',
  },
  'metrics.per-player-width': {
    kind: 'string', perPlayerMinusPopulationNatsPerDecision: 'number|null', headlineSe: 'number|null',
    headlineArm: 'string', unshrunkPerPlayerMinusPopulationNatsPerDecision: 'number|null',
    unshrunkSe: 'number|null', unshrunkPlayersMovedOffPopulation: 'number',
    headlineCiLow: 'number|null', headlineCiHigh: 'number|null', verdict: 'string',
    populationWidthMultiplier: 'number|null', populationWidthN: 'number',
    populationNarrowingWorthNats: 'number|null', populationNarrowingWorthSe: 'number|null',
    chosenShrinkageK: 'number|string',
    playersSignal: 'number', playersNegativeSignal: 'number', playersNoSignalObservedZero: 'number',
    playersUnderpoweredCannotTell: 'number', playersTotal: 'number',
    heldoutPlayers: 'number', heldoutPlayersScored: 'number', heldoutTestDecisions: 'number',
    heldoutPlayersMovedOffPopulation: 'number',
    poolRevealedDecisions: 'number', evalRevealedDecisions: 'number',
    rawWidthMedian: 'number|null', rawWidthP25: 'number|null', rawWidthP75: 'number|null',
    rawWidthPlayersWithEstimate: 'number', rawWidthPlayersNoEstimate: 'number',
    rawWidthEdgePinned: 'number', rawWidthEdgePinnedShare: 'number|null',
    medianRevealedPerPlayer: 'number|null', showdownConditional: 'boolean', foldRevealRate: 'number',
  },
  'metrics.range-calibration': {
    kind: 'string', villainDeltaLogVsUniform: 'number|null', actingDeltaLogVsUniform: 'number|null',
    chainDepth3DeltaLogVsUniform: 'number|null',
    villainCoverage: 'number|null', villainRetainedFraction: 'number|null', villainCoverageLift: 'number|null',
    actingCoverage: 'number|null', actingRetainedFraction: 'number|null', actingCoverageLift: 'number|null',
    villainRevealRate: 'number|null', villainCoverageBoundLow: 'number|null',
    villainCoverageBoundHigh: 'number|null', villainCoverageBoundWidth: 'number|null',
    actingRevealRate: 'number|null', actingCoverageBoundLow: 'number|null',
    actingCoverageBoundHigh: 'number|null', actingCoverageBoundWidth: 'number|null',
    villainN: 'number|null', actingN: 'number|null', players: 'number|null',
    handsRead: 'number|null', decisionsSeen: 'number|null',
    coverageSaturated: 'boolean', discriminatingMetric: 'string', showdownConditional: 'boolean',
  },
  'metrics.atoms-instrument': {
    kind: 'string', scoredShare: 'number|null', scoredGivenModeled: 'object', modeledNodes: 'number',
    neverLookedGivenReachable: 'object', observedZeroGivenExamined: 'object',
    droppedGivenReachable: 'object', predictionAuditDivergence: 'object', skipReasons: 'object',
    droppedDecisions: 'number', partiallyDroppedCells: 'number', partitionExcludedDecisions: 'number',
    leakage: 'object',
  },
  'metrics.river-flip-replicate': {
    kind: 'string', systematicFlipShare: 'number', systematicFlipCiLow: 'number|null',
    systematicFlipCiHigh: 'number|null', systematicFlipCiLowBinomialOverDecisions: 'number',
    systematicFlipCiHighBinomialOverDecisions: 'number', seedDependentShare: 'number',
    singleEvaluationFlipShare: 'number', n: 'number', players: 'number', replicates: 'number',
    flipDirections: 'object', perArmArgmaxStability: 'object', notAVerdict: 'boolean',
  },
  'metrics.study-ladder': {
    kind: 'string', handsSeen: 'number', primaryMinN: 'number', priorWeight: 'number',
    controlAxis: 'string', axes: 'object', correlations: 'array', ordering: 'object',
    leakage: 'object',
  },
  'metrics.style-collapse': {
    kind: 'string', villainPrediction: 'object', advicePath: 'object', absoluteEV: 'object',
    determinism: 'object',
  },
  'metrics.teachable-arms': {
    kind: 'string', arms: 'object', shareOfEngineEdge: 'object',
    handsRead: 'number|null', nPlayersPool: 'number|null', nPlayersEval: 'number|null',
    nMinedDecisions: 'number|null', nScoredDecisions: 'number|null',
    a3Table: 'object|null', a4Table: 'object|null',
  },
  'metrics.fold-curve-shape': {
    kind: 'string', fit: 'object', holdOut: 'object', holdOutBySizeBucket: 'array',
    inverseConditional: 'object', facingRaiseHeldOutSeparately: 'object', holdOutByStreet: 'array',
    fittedCurve: 'object', previousCurve: 'object', nullResults: 'object',
    residualNotRemoved: 'string',
  },
};

const DECISION_RECORD_META_SHIPPED_FIELDS = {
  kind: 'string', schemaVersion: 'number', writtenAt: 'string', run: 'string',
  dealBookId: 'string|null', dealBookHash: 'string|null',
  engineCommit: 'string|null', engineDirty: 'boolean|null',
  arms: 'array', constants: 'object', caveat: 'string',
  // v2 (WS-431)
  estimator: 'object',
};

const DECISION_RECORD_SUMMARY_SHIPPED_FIELDS = {
  kind: 'string', schemaVersion: 'number', rowCount: 'number',
  contentHash: 'string|null', canonicalOrder: 'string',
};

const MANIFEST_SHIPPED_FIELDS = {
  engineCommit: 'string', engineDirty: 'boolean', dealBookHash: 'string',
  fieldVersion: 'string|null', partition: 'string|null', seeds: 'object',
  unseededSources: 'array', constants: 'object',
  disclaimerRegisterVersion: 'string|null', knownDivergences: 'array',
};

const byName = (fields) => Object.fromEntries(fields.map((f) => [f.name, f]));

describe('additive-only schema guard', () => {
  it('registers every object type the baseline knows about', () => {
    expect(Object.keys(SOR_SCHEMAS).sort()).toEqual(Object.keys(SHIPPED_FIELDS).sort());
  });

  for (const [objectType, expectedFields] of Object.entries(SHIPPED_FIELDS)) {
    describe(objectType, () => {
      it('has never dropped a shipped field', () => {
        const present = byName(SOR_SCHEMAS[objectType]);
        for (const name of Object.keys(expectedFields)) {
          expect(
            present[name],
            `${objectType}.${name} was removed. Fields are append-only — mark it deprecated in ` +
            'schemas.js and leave it in place, so existing readers get null rather than a crash.',
          ).toBeDefined();
        }
      });

      it('has never retyped a shipped field', () => {
        const present = byName(SOR_SCHEMAS[objectType]);
        for (const [name, type] of Object.entries(expectedFields)) {
          if (!present[name]) continue; // reported by the test above
          expect(
            present[name].type,
            `${objectType}.${name} changed type. A retype breaks every artifact already written.`,
          ).toBe(type);
        }
      });

      it('declares a version, and every field shipped at or before it', () => {
        const version = SOR_SCHEMA_VERSIONS[objectType];
        expect(version).toBeGreaterThanOrEqual(1);
        for (const field of SOR_SCHEMAS[objectType]) {
          expect(field.since).toBeLessThanOrEqual(version);
        }
      });

      it('explains every field — a field nobody can explain is a field nobody should trust', () => {
        for (const field of SOR_SCHEMAS[objectType]) {
          expect(field.note, `${objectType}.${field.name} has no note`).toBeTruthy();
          expect(typeof field.required).toBe('boolean');
        }
      });
    });
  }

  // WS-434: the metrics variants carry two attributes the base descriptor does not require.
  describe('metrics-variant declaration discipline (WS-434)', () => {
    const metricsEntries = Object.entries(SOR_SCHEMAS).filter(([name]) => name.startsWith('metrics.'));

    it('registers at least the twelve variants and two shared shapes', () => {
      expect(metricsEntries.length).toBeGreaterThanOrEqual(14);
    });

    it('every metrics field states its unit — a figure without a unit is not checkable', () => {
      for (const [name, fields] of metricsEntries) {
        for (const field of fields) {
          expect(
            typeof field.unit === 'string' && field.unit.length > 0,
            `${name}.${field.name} has no unit. Every figure carries its units (WS-434 AC4); ` +
            'a unit change later is a retype in disguise, so it must be declared at birth.',
          ).toBe(true);
        }
      }
    });

    it('every declared shape names a registered SOR_SCHEMAS entry', () => {
      for (const [name, fields] of metricsEntries) {
        for (const field of fields) {
          if (!field.shape) continue;
          expect(
            SOR_SCHEMAS[field.shape],
            `${name}.${field.name} declares shape "${field.shape}" which is not registered — ` +
            'an unlinked sub-schema silently stops validating every leaf under it.',
          ).toBeDefined();
        }
      }
    });
  });

  describe('replication manifest', () => {
    it('has never dropped or retyped a shipped field', () => {
      const present = byName(MANIFEST_SCHEMA);
      for (const [name, type] of Object.entries(MANIFEST_SHIPPED_FIELDS)) {
        expect(present[name], `manifest.${name} was removed`).toBeDefined();
        expect(present[name].type, `manifest.${name} changed type`).toBe(type);
      }
    });
  });

  describe('decision-record meta + summary lines (WS-431)', () => {
    it('has never dropped or retyped a shipped meta field', () => {
      const present = byName(DECISION_RECORD_META_SCHEMA);
      for (const [name, type] of Object.entries(DECISION_RECORD_META_SHIPPED_FIELDS)) {
        expect(present[name], `decisionRecord meta.${name} was removed`).toBeDefined();
        expect(present[name].type, `decisionRecord meta.${name} changed type`).toBe(type);
      }
    });

    it('has never dropped or retyped a shipped summary field', () => {
      const present = byName(DECISION_RECORD_SUMMARY_SCHEMA);
      for (const [name, type] of Object.entries(DECISION_RECORD_SUMMARY_SHIPPED_FIELDS)) {
        expect(present[name], `decisionRecord summary.${name} was removed`).toBeDefined();
        expect(present[name].type, `decisionRecord summary.${name} changed type`).toBe(type);
      }
    });

    it('explains every meta/summary field', () => {
      for (const field of [...DECISION_RECORD_META_SCHEMA, ...DECISION_RECORD_SUMMARY_SCHEMA]) {
        expect(field.note, `${field.name} has no note`).toBeTruthy();
      }
    });
  });
});

describe('checkAgainstSchema', () => {
  const fields = [
    { name: 'a', type: 'string', since: 1, required: true, note: 'x' },
    { name: 'b', type: 'number|null', since: 1, required: false, note: 'x' },
  ];

  it('reports a missing required field', () => {
    expect(checkAgainstSchema({}, fields)).toEqual([expect.stringContaining('a is required')]);
  });

  it('accepts a null where the type permits it', () => {
    expect(checkAgainstSchema({ a: 'x', b: null }, fields)).toEqual([]);
  });

  it('rejects a wrong type', () => {
    expect(checkAgainstSchema({ a: 5 }, fields)).toEqual([expect.stringContaining('must be string')]);
  });

  it('ALLOWS unknown extra fields — a newer producer must not break an older reader', () => {
    expect(checkAgainstSchema({ a: 'x', futureField: 1 }, fields)).toEqual([]);
  });

  it('distinguishes an array from an object', () => {
    const arrayFields = [{ name: 'xs', type: 'array', since: 1, required: true, note: 'x' }];
    expect(checkAgainstSchema({ xs: [] }, arrayFields)).toEqual([]);
    expect(checkAgainstSchema({ xs: {} }, arrayFields)).toHaveLength(1);
  });
});
