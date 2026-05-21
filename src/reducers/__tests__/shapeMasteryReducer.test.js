/**
 * shapeMasteryReducer.test.js — SLS Stream D reducer invariants.
 *
 * Tests the 3 active writers (HYDRATED / ENROLL / DISENROLL) and the
 * read-side I-SM invariant family that this sprint enforces.
 *
 * Per `docs/design/contracts/shape-mastery.md` §Invariants:
 *   - I-SM-1: separation of signals (declared + posterior never fused).
 *   - I-SM-2: no decay-write action exists.
 *   - I-SM-3: reference-mode no-op (stub — see test note).
 *   - I-SM-7: posterior bounds α≥1, β≥1.
 *   - I-SM-8: schemaVersion per-record + tolerant load.
 *   - I-SM-9: no engagement-pressure fields in shape.
 *
 * Deferred I-SM-4/5/6 enforcement is the fast-follow WS scope.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import { shapeMasteryReducer } from '../shapeMasteryReducer';
import {
  SHAPE_MASTERY_ACTIONS,
  SHAPE_MASTERY_ACTIVE_WRITERS,
  SHAPE_DESCRIPTOR_IDS,
  SHAPE_DESCRIPTOR_CATALOG,
  USER_MUTE_STATES,
  FORBIDDEN_MASTERY_FIELDS,
  FORBIDDEN_FUSED_FIELDS,
  DESCRIPTOR_MASTERY_SCHEMA_VERSION,
  SHAPE_MASTERY_SCHEMA_VERSION,
  initialShapeMasteryState,
  buildDefaultDescriptorsDict,
} from '../../constants/shapeMasteryConstants';

const __filename = url.fileURLToPath(import.meta.url);
const REDUCER_PATH = path.resolve(__filename, '..', '..', 'shapeMasteryReducer.js');
const CONSTANTS_PATH = path.resolve(__filename, '..', '..', '..', 'constants', 'shapeMasteryConstants.js');

describe('shapeMasteryReducer — active writers', () => {
  // ─── SHAPE_MASTERY_HYDRATED ────────────────────────────────────────────
  describe('SHAPE_MASTERY_HYDRATED', () => {
    it('first-launch (no IDB record) seeds all 10 descriptors with charter defaults', () => {
      const next = shapeMasteryReducer(initialShapeMasteryState, {
        type: SHAPE_MASTERY_ACTIONS.SHAPE_MASTERY_HYDRATED,
        payload: { record: null },
      });
      expect(next.enrolled).toBe(false);
      expect(next.enrolledAt).toBeNull();
      expect(Object.keys(next.descriptors).sort()).toEqual([...SHAPE_DESCRIPTOR_IDS].sort());
      for (const id of SHAPE_DESCRIPTOR_IDS) {
        const d = next.descriptors[id];
        expect(d.posterior).toEqual({ alpha: 1, beta: 1 });
        expect(d.declaredLevel).toBeNull();
        expect(d.userMuteState).toBe(USER_MUTE_STATES.NONE);
        expect(d.schemaVersion).toBe(DESCRIPTOR_MASTERY_SCHEMA_VERSION);
      }
    });

    it('hydrates from a real IDB record, preserving fields', () => {
      const record = {
        userId: 'guest',
        enrolled: true,
        enrolledAt: 1715600000000,
        descriptors: {
          silhouette: {
            posterior: { alpha: 8, beta: 2 },
            declaredLevel: 'known',
            userMuteState: USER_MUTE_STATES.ALREADY_KNOWN,
            mutedAt: 1715600000000,
            lastValidatedAt: 1715600000000,
            lastInteractedAt: 1715600000000,
            schemaVersion: DESCRIPTOR_MASTERY_SCHEMA_VERSION,
          },
        },
        schemaVersion: SHAPE_MASTERY_SCHEMA_VERSION,
      };
      const next = shapeMasteryReducer(initialShapeMasteryState, {
        type: SHAPE_MASTERY_ACTIONS.SHAPE_MASTERY_HYDRATED,
        payload: { record },
      });
      expect(next.enrolled).toBe(true);
      expect(next.enrolledAt).toBe(1715600000000);
      expect(next.descriptors.silhouette.posterior).toEqual({ alpha: 8, beta: 2 });
      expect(next.descriptors.silhouette.declaredLevel).toBe('known');
      // Missing descriptors backfilled with defaults (tolerant load per I-SM-8).
      expect(next.descriptors.saddle.posterior).toEqual({ alpha: 1, beta: 1 });
    });

    it('drops unknown descriptor ids forward (tolerant load)', () => {
      const record = {
        descriptors: {
          'not-a-real-descriptor': { posterior: { alpha: 99, beta: 99 } },
          silhouette: { posterior: { alpha: 3, beta: 5 } },
        },
      };
      const next = shapeMasteryReducer(initialShapeMasteryState, {
        type: SHAPE_MASTERY_ACTIONS.SHAPE_MASTERY_HYDRATED,
        payload: { record },
      });
      expect(next.descriptors['not-a-real-descriptor']).toBeUndefined();
      expect(next.descriptors.silhouette.posterior).toEqual({ alpha: 3, beta: 5 });
    });
  });

  // ─── ENROLL_SHAPE_MASTERY ──────────────────────────────────────────────
  describe('ENROLL_SHAPE_MASTERY', () => {
    it('flips enrolled=true + sets enrolledAt + seeds defaults on first enroll', () => {
      const next = shapeMasteryReducer(initialShapeMasteryState, {
        type: SHAPE_MASTERY_ACTIONS.ENROLL_SHAPE_MASTERY,
        payload: { now: 1715600000000 },
      });
      expect(next.enrolled).toBe(true);
      expect(next.enrolledAt).toBe(1715600000000);
      expect(Object.keys(next.descriptors).length).toBe(SHAPE_DESCRIPTOR_IDS.length);
    });

    it('preserves existing descriptors on re-enroll (I-SM-6 Variation A default)', () => {
      const hydrated = shapeMasteryReducer(initialShapeMasteryState, {
        type: SHAPE_MASTERY_ACTIONS.SHAPE_MASTERY_HYDRATED,
        payload: { record: null },
      });
      const customized = {
        ...hydrated,
        descriptors: {
          ...hydrated.descriptors,
          silhouette: {
            ...hydrated.descriptors.silhouette,
            posterior: { alpha: 7, beta: 3 },
          },
        },
      };
      const enrolled = shapeMasteryReducer(customized, {
        type: SHAPE_MASTERY_ACTIONS.ENROLL_SHAPE_MASTERY,
        payload: { now: 1715600000000 },
      });
      expect(enrolled.descriptors.silhouette.posterior).toEqual({ alpha: 7, beta: 3 });
    });

    it('defaults `now` to Date.now() if not provided in payload', () => {
      const before = Date.now();
      const next = shapeMasteryReducer(initialShapeMasteryState, {
        type: SHAPE_MASTERY_ACTIONS.ENROLL_SHAPE_MASTERY,
      });
      const after = Date.now();
      expect(next.enrolledAt).toBeGreaterThanOrEqual(before);
      expect(next.enrolledAt).toBeLessThanOrEqual(after);
    });
  });

  // ─── DISENROLL_SHAPE_MASTERY ───────────────────────────────────────────
  describe('DISENROLL_SHAPE_MASTERY', () => {
    it('flips enrolled=false + clears enrolledAt; preserves descriptors (I-SM-6)', () => {
      const enrolled = shapeMasteryReducer(initialShapeMasteryState, {
        type: SHAPE_MASTERY_ACTIONS.ENROLL_SHAPE_MASTERY,
        payload: { now: 1715600000000 },
      });
      const customized = {
        ...enrolled,
        descriptors: {
          ...enrolled.descriptors,
          saddle: { ...enrolled.descriptors.saddle, posterior: { alpha: 4, beta: 6 } },
        },
      };
      const disenrolled = shapeMasteryReducer(customized, {
        type: SHAPE_MASTERY_ACTIONS.DISENROLL_SHAPE_MASTERY,
      });
      expect(disenrolled.enrolled).toBe(false);
      expect(disenrolled.enrolledAt).toBeNull();
      expect(disenrolled.descriptors.saddle.posterior).toEqual({ alpha: 4, beta: 6 });
    });
  });

  // ─── Deferred writers (no-op this sprint) ───────────────────────────────
  describe('deferred writers (fast-follow WS) — no-op semantics', () => {
    const deferred = [
      SHAPE_MASTERY_ACTIONS.SEED_DESCRIPTOR_DECLARATION,
      SHAPE_MASTERY_ACTIONS.RECORD_DRILL_OUTCOME,
      SHAPE_MASTERY_ACTIONS.MUTE_DESCRIPTOR,
      SHAPE_MASTERY_ACTIONS.RECORD_SKIP_DISAMBIGUATION,
      SHAPE_MASTERY_ACTIONS.UNMUTE_DESCRIPTOR,
      SHAPE_MASTERY_ACTIONS.RECALIBRATE_DESCRIPTOR,
      SHAPE_MASTERY_ACTIONS.RESET_SHAPE_MASTERY,
      SHAPE_MASTERY_ACTIONS.TOGGLE_SESSION_INCOGNITO,
    ];
    it.each(deferred)('%s returns state unchanged', (type) => {
      const next = shapeMasteryReducer(initialShapeMasteryState, { type });
      expect(next).toBe(initialShapeMasteryState);
    });
  });

  // ─── Unknown actions ────────────────────────────────────────────────────
  it('returns state unchanged for unknown action types', () => {
    const next = shapeMasteryReducer(initialShapeMasteryState, {
      type: 'TOTALLY_UNRELATED_ACTION',
    });
    expect(next).toBe(initialShapeMasteryState);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// I-SM Invariant Family — read-side enforcement
// ═════════════════════════════════════════════════════════════════════════════

describe('I-SM-1 — separation of signals', () => {
  it('default DescriptorMastery has independent declared + posterior fields (no fused score)', () => {
    const defaults = buildDefaultDescriptorsDict();
    for (const id of Object.keys(defaults)) {
      const d = defaults[id];
      expect(d).toHaveProperty('declaredLevel');
      expect(d).toHaveProperty('posterior');
      for (const forbidden of FORBIDDEN_FUSED_FIELDS) {
        expect(d).not.toHaveProperty(forbidden);
      }
    }
  });

  it('reducer source contains no fused-score field references', () => {
    const src = fs.readFileSync(REDUCER_PATH, 'utf8');
    for (const forbidden of FORBIDDEN_FUSED_FIELDS) {
      expect(src).not.toMatch(new RegExp(`\\b${forbidden}\\b`));
    }
  });
});

describe('I-SM-2 — no decay-write action', () => {
  it('SHAPE_MASTERY_ACTIONS does not contain APPLY_DECAY or any decay writer', () => {
    const allActions = Object.values(SHAPE_MASTERY_ACTIONS);
    expect(allActions).not.toContain('APPLY_DECAY');
    for (const action of allActions) {
      expect(action).not.toMatch(/DECAY/i);
    }
  });

  it('reducer source has no APPLY_DECAY case or dispatch pattern', () => {
    const src = fs.readFileSync(REDUCER_PATH, 'utf8');
    expect(src).not.toMatch(/APPLY_DECAY/);
    expect(src).not.toMatch(/case\s+['"][A-Z_]*DECAY[A-Z_]*['"]/);
  });
});

describe('I-SM-3 — reference-mode no-op short-circuit (STUB)', () => {
  // Full enforcement deferred: requires reading studyHomeReducer.currentIntent
  // which doesn't ship until SCF Gate 5 study-home reducer ships. This test
  // documents the contract for the fast-follow WS to flip from stub to real.
  it('TODO(WS-NEXT): assert no-op when injected currentIntent === reference', () => {
    expect(SHAPE_MASTERY_ACTIVE_WRITERS.length).toBe(3);
  });
});

describe('I-SM-7 — posterior bounds α≥1, β≥1', () => {
  it('charter-default posterior is at the lower bound (α=1, β=1)', () => {
    const defaults = buildDefaultDescriptorsDict();
    for (const id of Object.keys(defaults)) {
      const { alpha, beta } = defaults[id].posterior;
      expect(alpha).toBeGreaterThanOrEqual(1);
      expect(beta).toBeGreaterThanOrEqual(1);
    }
  });

  it('HYDRATED never produces α<1 or β<1 across 1000 random valid records', () => {
    for (let i = 0; i < 1000; i++) {
      const alpha = 1 + Math.floor(Math.random() * 100);
      const beta = 1 + Math.floor(Math.random() * 100);
      const next = shapeMasteryReducer(initialShapeMasteryState, {
        type: SHAPE_MASTERY_ACTIONS.SHAPE_MASTERY_HYDRATED,
        payload: {
          record: {
            descriptors: { silhouette: { posterior: { alpha, beta } } },
          },
        },
      });
      expect(next.descriptors.silhouette.posterior.alpha).toBeGreaterThanOrEqual(1);
      expect(next.descriptors.silhouette.posterior.beta).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('I-SM-8 — per-record schemaVersion + tolerant load', () => {
  it('every default DescriptorMastery carries a schemaVersion', () => {
    const defaults = buildDefaultDescriptorsDict();
    for (const id of Object.keys(defaults)) {
      expect(typeof defaults[id].schemaVersion).toBe('number');
      expect(defaults[id].schemaVersion).toBe(DESCRIPTOR_MASTERY_SCHEMA_VERSION);
    }
  });

  it('HYDRATED tolerates records missing schemaVersion (recoverable migration)', () => {
    const record = {
      enrolled: true,
      enrolledAt: 1715600000000,
      descriptors: { silhouette: { posterior: { alpha: 5, beta: 5 } } },
      // no top-level schemaVersion
    };
    const next = shapeMasteryReducer(initialShapeMasteryState, {
      type: SHAPE_MASTERY_ACTIONS.SHAPE_MASTERY_HYDRATED,
      payload: { record },
    });
    expect(next.schemaVersion).toBe(SHAPE_MASTERY_SCHEMA_VERSION);
    expect(next.descriptors.silhouette.posterior).toEqual({ alpha: 5, beta: 5 });
  });
});

describe('I-SM-9 — no engagement-pressure fields', () => {
  it('default DescriptorMastery contains no streak/days-active fields', () => {
    const defaults = buildDefaultDescriptorsDict();
    for (const id of Object.keys(defaults)) {
      for (const forbidden of FORBIDDEN_MASTERY_FIELDS) {
        expect(defaults[id]).not.toHaveProperty(forbidden);
      }
    }
  });

  it('constants source contains no engagement-pressure field declarations', () => {
    const src = fs.readFileSync(CONSTANTS_PATH, 'utf8');
    // We expect FORBIDDEN_MASTERY_FIELDS itself to mention the strings (it's the
    // banlist), so we look for assignments like `currentStreak:` inside
    // record-builder functions and reject those specifically.
    for (const forbidden of FORBIDDEN_MASTERY_FIELDS) {
      const assignment = new RegExp(`${forbidden}\\s*:`);
      expect(src).not.toMatch(assignment);
    }
  });
});

describe('catalog integrity', () => {
  it('SHAPE_DESCRIPTOR_CATALOG has exactly 10 entries', () => {
    expect(SHAPE_DESCRIPTOR_CATALOG.length).toBe(10);
  });

  it('all descriptor ids are kebab-case-lowercase', () => {
    for (const { id } of SHAPE_DESCRIPTOR_CATALOG) {
      expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  it('all descriptor ids are unique', () => {
    const ids = SHAPE_DESCRIPTOR_CATALOG.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
