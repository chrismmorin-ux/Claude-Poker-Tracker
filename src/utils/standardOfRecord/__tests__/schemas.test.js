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
    heroSeat: 'number|null', buttonSeat: 'number|null', opponentSeat: 'number|null',
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
