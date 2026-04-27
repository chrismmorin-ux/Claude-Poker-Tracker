// @vitest-environment jsdom
/**
 * anchorLibraryWrappers.test.js
 *
 * CRUD wrapper tests for the 4 EAL persistence modules:
 *   - anchorObservationsStore.js
 *   - anchorObservationDraftsStore.js
 *   - perceptionPrimitivesStore.js
 *   - exploitAnchorsStore.js
 *
 * Mirrors `subscriptionStore.test.js` pattern: round-trip CRUD + index queries
 * + missing-record handling + input validation.
 *
 * EAL Phase 6 Stream D B3 — Session 12 (2026-04-25).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getObservation,
  getObservationsByHandId,
  getAllObservations,
  putObservation,
  deleteObservation,
} from '../anchorObservationsStore';
import {
  getDraft,
  putDraft,
  deleteDraft,
  getAllDrafts,
} from '../anchorObservationDraftsStore';
import {
  getPrimitive,
  getAllPrimitives,
  getPrimitivesByStyle,
  putPrimitive,
} from '../perceptionPrimitivesStore';
import {
  getAnchor,
  getAllAnchors,
  getAnchorsByStatus,
  getAnchorsByVillain,
  putAnchor,
  deleteAnchor,
} from '../exploitAnchorsStore';
import { closeDB, resetDBPool, DB_NAME } from '../database';

// ───────────────────────────────────────────────────────────────────────────
// Test setup — wipe IDB between tests for clean migration runs
// ───────────────────────────────────────────────────────────────────────────

const deleteEntireDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.deleteDatabase(DB_NAME);
  req.onsuccess = () => resolve();
  req.onerror = (e) => reject(e.target.error);
  req.onblocked = () => resolve();
});

beforeEach(async () => {
  closeDB();
  resetDBPool();
  await deleteEntireDB();
});

afterEach(async () => {
  closeDB();
  resetDBPool();
});

// ───────────────────────────────────────────────────────────────────────────
// anchorObservationsStore
// ───────────────────────────────────────────────────────────────────────────

describe('anchorObservationsStore — round-trip CRUD', () => {
  const sampleObs = (overrides = {}) => ({
    id: 'obs:hand-42:0',
    schemaVersion: 'anchor-obs-v1.0',
    createdAt: '2026-04-25T14:00:00Z',
    handId: 'hand-42',
    streetKey: 'river',
    note: 'Villain tanked then folded.',
    ownerTags: ['villain-overfold'],
    status: 'open',
    origin: 'owner-captured',
    contributesToCalibration: true,
    ...overrides,
  });

  it('putObservation + getObservation round-trips', async () => {
    const record = sampleObs();
    await putObservation(record);
    const fetched = await getObservation(record.id);
    expect(fetched).toEqual(record);
  });

  it('getObservation returns null for missing id', async () => {
    const fetched = await getObservation('obs:does-not-exist:0');
    expect(fetched).toBeNull();
  });

  it('putObservation overwrites on conflicting id', async () => {
    await putObservation(sampleObs());
    const updated = sampleObs({ note: 'Updated note' });
    await putObservation(updated);
    const fetched = await getObservation('obs:hand-42:0');
    expect(fetched.note).toBe('Updated note');
  });

  it('deleteObservation removes the record', async () => {
    await putObservation(sampleObs());
    await deleteObservation('obs:hand-42:0');
    expect(await getObservation('obs:hand-42:0')).toBeNull();
  });

  it('getObservationsByHandId returns only matching records', async () => {
    await putObservation(sampleObs({ id: 'obs:hand-42:0' }));
    await putObservation(sampleObs({ id: 'obs:hand-42:1', note: 'Second observation' }));
    await putObservation(sampleObs({ id: 'obs:hand-99:0', handId: 'hand-99', note: 'Different hand' }));

    const handFortyTwo = await getObservationsByHandId('hand-42');
    expect(handFortyTwo).toHaveLength(2);
    expect(handFortyTwo.map((r) => r.id).sort()).toEqual(['obs:hand-42:0', 'obs:hand-42:1']);

    const handNinetyNine = await getObservationsByHandId('hand-99');
    expect(handNinetyNine).toHaveLength(1);
    expect(handNinetyNine[0].id).toBe('obs:hand-99:0');
  });

  it('getObservationsByHandId returns empty array when no matches', async () => {
    const result = await getObservationsByHandId('hand-with-nothing');
    expect(result).toEqual([]);
  });

  it('getAllObservations returns the full set', async () => {
    await putObservation(sampleObs({ id: 'obs:a:0', handId: 'a' }));
    await putObservation(sampleObs({ id: 'obs:b:0', handId: 'b' }));
    await putObservation(sampleObs({ id: 'obs:c:0', handId: 'c' }));

    const all = await getAllObservations();
    expect(all).toHaveLength(3);
  });

  it('getAllObservations returns empty array on fresh install', async () => {
    expect(await getAllObservations()).toEqual([]);
  });
});

describe('anchorObservationsStore — input validation', () => {
  it('getObservation throws on empty id', async () => {
    await expect(getObservation('')).rejects.toThrow(/non-empty/);
  });

  it('getObservation throws on non-string id', async () => {
    await expect(getObservation(null)).rejects.toThrow(/non-empty string/);
  });

  it('putObservation throws when record missing id', async () => {
    await expect(putObservation({ handId: 'hand-1' })).rejects.toThrow(/id/);
  });

  it('putObservation throws on null record', async () => {
    await expect(putObservation(null)).rejects.toThrow(/id/);
  });

  it('deleteObservation throws on empty id', async () => {
    await expect(deleteObservation('')).rejects.toThrow(/non-empty/);
  });

  it('getObservationsByHandId throws on empty handId', async () => {
    await expect(getObservationsByHandId('')).rejects.toThrow(/non-empty/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// anchorObservationDraftsStore
// ───────────────────────────────────────────────────────────────────────────

describe('anchorObservationDraftsStore — round-trip CRUD', () => {
  const sampleDraft = (overrides = {}) => ({
    handId: 'hand-42',
    updatedAt: '2026-04-25T14:00:00Z',
    selectedTags: ['villain-overfold'],
    note: 'Draft in progress',
    ...overrides,
  });

  it('putDraft auto-attaches deterministic id from handId', async () => {
    const draft = sampleDraft();
    await putDraft(draft);
    const fetched = await getDraft('hand-42');
    expect(fetched.id).toBe('draft:hand-42');
    expect(fetched.handId).toBe('hand-42');
    expect(fetched.note).toBe('Draft in progress');
  });

  it('putDraft + getDraft round-trip', async () => {
    await putDraft(sampleDraft());
    const fetched = await getDraft('hand-42');
    expect(fetched.note).toBe('Draft in progress');
  });

  it('getDraft returns null for hand without a draft', async () => {
    expect(await getDraft('hand-99')).toBeNull();
  });

  it('putDraft overwrites previous draft for same hand', async () => {
    await putDraft(sampleDraft({ note: 'First' }));
    await putDraft(sampleDraft({ note: 'Second' }));
    const fetched = await getDraft('hand-42');
    expect(fetched.note).toBe('Second');
  });

  it('deleteDraft removes the draft', async () => {
    await putDraft(sampleDraft());
    await deleteDraft('hand-42');
    expect(await getDraft('hand-42')).toBeNull();
  });

  it('multiple drafts for different hands coexist', async () => {
    await putDraft(sampleDraft({ handId: 'hand-1' }));
    await putDraft(sampleDraft({ handId: 'hand-2' }));
    await putDraft(sampleDraft({ handId: 'hand-3' }));
    expect((await getAllDrafts())).toHaveLength(3);
  });

  it('getAllDrafts returns empty array on fresh install', async () => {
    expect(await getAllDrafts()).toEqual([]);
  });
});

describe('anchorObservationDraftsStore — input validation', () => {
  it('getDraft throws on empty handId', async () => {
    await expect(getDraft('')).rejects.toThrow(/non-empty/);
  });

  it('putDraft throws on missing handId', async () => {
    await expect(putDraft({ note: 'orphan' })).rejects.toThrow(/handId/);
  });

  it('putDraft throws on mismatched id', async () => {
    await expect(putDraft({
      id: 'draft:hand-99', // wrong
      handId: 'hand-42',
    })).rejects.toThrow(/does not match expected/);
  });

  it('putDraft accepts matching id', async () => {
    await expect(putDraft({
      id: 'draft:hand-42',
      handId: 'hand-42',
      updatedAt: '2026-04-25T14:00:00Z',
    })).resolves.not.toThrow();
  });

  it('deleteDraft throws on empty handId', async () => {
    await expect(deleteDraft('')).rejects.toThrow(/non-empty/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// perceptionPrimitivesStore — uses seed data from migrateV19
// ───────────────────────────────────────────────────────────────────────────

describe('perceptionPrimitivesStore — read seed data', () => {
  it('getAllPrimitives returns 8 seeded records (PP-01..PP-08)', async () => {
    const records = await getAllPrimitives();
    expect(records).toHaveLength(8);
    const ids = records.map((r) => r.id).sort();
    expect(ids).toEqual([
      'PP-01', 'PP-02', 'PP-03', 'PP-04',
      'PP-05', 'PP-06', 'PP-07', 'PP-08',
    ]);
  });

  it('getPrimitive returns specific seeded primitive', async () => {
    const pp01 = await getPrimitive('PP-01');
    expect(pp01).not.toBeNull();
    expect(pp01.name).toMatch(/Nit re-weights/);
  });

  it('getPrimitive returns null for missing id', async () => {
    expect(await getPrimitive('PP-99')).toBeNull();
  });

  it('getPrimitivesByStyle("Nit") returns all Nit-applicable primitives', async () => {
    const nitPrimitives = await getPrimitivesByStyle('Nit');
    const ids = nitPrimitives.map((r) => r.id).sort();
    // Per perception-primitives.md: Nit appears in PP-01, PP-04, PP-07, PP-08
    expect(ids).toContain('PP-01');
    expect(ids).toContain('PP-04');
    expect(ids).toContain('PP-07');
    expect(ids).toContain('PP-08');
  });

  it('getPrimitivesByStyle("Fish") returns Fish-applicable primitives', async () => {
    const fishPrimitives = await getPrimitivesByStyle('Fish');
    const ids = fishPrimitives.map((r) => r.id).sort();
    // Per markdown: Fish in PP-03, PP-05, PP-06, PP-08
    expect(ids).toContain('PP-03');
    expect(ids).toContain('PP-05');
    expect(ids).toContain('PP-06');
    expect(ids).toContain('PP-08');
  });

  it('getPrimitivesByStyle returns empty array for unknown style', async () => {
    expect(await getPrimitivesByStyle('UnknownStyle')).toEqual([]);
  });
});

describe('perceptionPrimitivesStore — putPrimitive (Tier-2 update path)', () => {
  it('putPrimitive overwrites a seeded primitive (W-PP-2 update)', async () => {
    const original = await getPrimitive('PP-01');
    const updated = {
      ...original,
      validityScore: {
        ...original.validityScore,
        sampleSize: 10,
        supportsCount: 7,
        pointEstimate: 0.7,
      },
    };
    await putPrimitive(updated);
    const fetched = await getPrimitive('PP-01');
    expect(fetched.validityScore.sampleSize).toBe(10);
    expect(fetched.validityScore.pointEstimate).toBeCloseTo(0.7, 3);
  });

  it('putPrimitive throws on record missing id', async () => {
    await expect(putPrimitive({ name: 'Orphan' })).rejects.toThrow(/id/);
  });
});

describe('perceptionPrimitivesStore — input validation', () => {
  it('getPrimitive throws on empty id', async () => {
    await expect(getPrimitive('')).rejects.toThrow(/non-empty/);
  });

  it('getPrimitivesByStyle throws on empty style', async () => {
    await expect(getPrimitivesByStyle('')).rejects.toThrow(/non-empty/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// exploitAnchorsStore
// ───────────────────────────────────────────────────────────────────────────

describe('exploitAnchorsStore — round-trip CRUD', () => {
  const sampleAnchor = (overrides = {}) => ({
    id: 'anchor:nit:river:overfold:4flush',
    schemaVersion: '1.1-anchor-v1.0',
    archetypeName: 'Nit Over-Fold to River Overbet on 4-Flush Scare',
    polarity: 'overfold',
    tier: 2,
    villainId: null,
    status: 'active',
    perceptionPrimitiveIds: ['PP-01'],
    quality: { composite: 0.78 },
    evidence: {
      pointEstimate: 0.72,
      lastUpdated: '2026-04-25T14:00:00Z',
    },
    ...overrides,
  });

  it('putAnchor + getAnchor round-trip', async () => {
    const record = sampleAnchor();
    await putAnchor(record);
    const fetched = await getAnchor(record.id);
    expect(fetched.archetypeName).toBe(record.archetypeName);
  });

  it('getAnchor returns null for missing id', async () => {
    expect(await getAnchor('anchor:does-not-exist')).toBeNull();
  });

  it('putAnchor overwrites on conflicting id', async () => {
    await putAnchor(sampleAnchor());
    await putAnchor(sampleAnchor({ status: 'expiring' }));
    const fetched = await getAnchor('anchor:nit:river:overfold:4flush');
    expect(fetched.status).toBe('expiring');
  });

  it('deleteAnchor removes the record', async () => {
    await putAnchor(sampleAnchor());
    await deleteAnchor('anchor:nit:river:overfold:4flush');
    expect(await getAnchor('anchor:nit:river:overfold:4flush')).toBeNull();
  });

  it('getAllAnchors returns full set', async () => {
    await putAnchor(sampleAnchor({ id: 'anchor:a' }));
    await putAnchor(sampleAnchor({ id: 'anchor:b' }));
    expect((await getAllAnchors())).toHaveLength(2);
  });

  it('getAllAnchors returns empty array on fresh install (no W-EA-1 seed yet)', async () => {
    expect(await getAllAnchors()).toEqual([]);
  });

  it('getAnchorsByStatus("active") returns only active', async () => {
    await putAnchor(sampleAnchor({ id: 'anchor:a', status: 'active' }));
    await putAnchor(sampleAnchor({ id: 'anchor:b', status: 'expiring' }));
    await putAnchor(sampleAnchor({ id: 'anchor:c', status: 'retired' }));
    await putAnchor(sampleAnchor({ id: 'anchor:d', status: 'active' }));

    const active = await getAnchorsByStatus('active');
    expect(active.map((r) => r.id).sort()).toEqual(['anchor:a', 'anchor:d']);
  });

  it('getAnchorsByStatus returns empty array for unused status', async () => {
    await putAnchor(sampleAnchor({ status: 'active' }));
    expect(await getAnchorsByStatus('candidate')).toEqual([]);
  });

  it('getAnchorsByVillain filters by villainId index', async () => {
    await putAnchor(sampleAnchor({ id: 'anchor:a', villainId: 'v-1' }));
    await putAnchor(sampleAnchor({ id: 'anchor:b', villainId: 'v-1' }));
    await putAnchor(sampleAnchor({ id: 'anchor:c', villainId: 'v-2' }));

    const v1Anchors = await getAnchorsByVillain('v-1');
    expect(v1Anchors).toHaveLength(2);
  });
});

describe('exploitAnchorsStore — input validation', () => {
  it('getAnchor throws on empty id', async () => {
    await expect(getAnchor('')).rejects.toThrow(/non-empty/);
  });

  it('putAnchor throws on missing id', async () => {
    await expect(putAnchor({ archetypeName: 'Orphan' })).rejects.toThrow(/id/);
  });

  it('deleteAnchor throws on empty id', async () => {
    await expect(deleteAnchor('')).rejects.toThrow(/non-empty/);
  });

  it('getAnchorsByStatus throws on empty status', async () => {
    await expect(getAnchorsByStatus('')).rejects.toThrow(/non-empty/);
  });

  it('getAnchorsByVillain throws on empty villainId', async () => {
    await expect(getAnchorsByVillain('')).rejects.toThrow(/non-empty/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Cross-wrapper integration — capture flow uses both observations + drafts
// ───────────────────────────────────────────────────────────────────────────

describe('cross-wrapper — capture flow', () => {
  it('capture lifecycle: draft → save → delete draft', async () => {
    const handId = 'hand-42';

    // 1. User opens modal → no draft yet
    expect(await getDraft(handId)).toBeNull();

    // 2. User edits → draft persisted
    await putDraft({
      handId,
      updatedAt: '2026-04-25T14:00:00Z',
      selectedTags: ['villain-overfold'],
      note: 'In-progress',
    });
    expect((await getDraft(handId)).note).toBe('In-progress');

    // 3. User clicks Save → canonical observation written + draft deleted
    const observation = {
      id: `obs:${handId}:0`,
      schemaVersion: 'anchor-obs-v1.0',
      createdAt: '2026-04-25T14:05:00Z',
      handId,
      ownerTags: ['villain-overfold'],
      note: 'Final note',
      status: 'open',
      origin: 'owner-captured',
      contributesToCalibration: true,
    };
    await putObservation(observation);
    await deleteDraft(handId);

    // Canonical persisted; draft cleared
    expect(await getObservation(observation.id)).toEqual(observation);
    expect(await getDraft(handId)).toBeNull();
  });

  it('capture lifecycle: draft → discard (no save)', async () => {
    const handId = 'hand-42';
    await putDraft({ handId, updatedAt: '2026-04-25T14:00:00Z', note: 'will-discard' });
    await deleteDraft(handId);
    expect(await getDraft(handId)).toBeNull();
    // Confirm no observation created
    expect((await getObservationsByHandId(handId))).toEqual([]);
  });
});
