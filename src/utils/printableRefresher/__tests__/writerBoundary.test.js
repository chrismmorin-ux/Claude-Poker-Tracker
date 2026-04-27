// @vitest-environment jsdom
/**
 * writerBoundary.test.js — PRF-G5-RI test scaffold.
 *
 * Verifies I-WR-2 (reference-mode write-silence) at the writer boundary:
 * each PRF writer (W-URC-1/2a/2b/3) calls ONLY refresherStore primitives.
 * Zero calls to skill-state stores (anchorObservationsStore /
 * exploitAnchorsStore / perceptionPrimitivesStore / subscriptionStore /
 * settingsStorage / sessionsStorage / handsStorage / playersStorage / etc.).
 *
 * If a future writer accidentally imports a non-PRF store wrapper + calls
 * its put/delete, this test fails — the writer must be re-classified per
 * WRITERS.md amendment rule.
 *
 * PRF Phase 5 — Session 15 (PRF-G5-RI).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all skill-state-store wrappers + the PRF refresher store.
// Mock factories must be self-contained (Vitest hoists them above imports).
vi.mock('../../persistence/refresherStore', () => ({
  getRefresherConfig: vi.fn(),
  putRefresherConfig: vi.fn(),
  putPrintBatch: vi.fn(),
  getPrintBatch: vi.fn(),
  getAllPrintBatches: vi.fn(),
  getPrintBatchesForCard: vi.fn(),
}));

vi.mock('../../persistence/anchorObservationsStore', () => ({
  getObservation: vi.fn(),
  putObservation: vi.fn(),
  deleteObservation: vi.fn(),
  getAllObservations: vi.fn(),
  getObservationsByHandId: vi.fn(),
}));

vi.mock('../../persistence/exploitAnchorsStore', () => ({
  getAnchor: vi.fn(),
  putAnchor: vi.fn(),
  deleteAnchor: vi.fn(),
  getAllAnchors: vi.fn(),
  getAnchorsByStatus: vi.fn(),
  getAnchorsByVillain: vi.fn(),
}));

vi.mock('../../persistence/perceptionPrimitivesStore', () => ({
  getPrimitive: vi.fn(),
  putPrimitive: vi.fn(),
  getAllPrimitives: vi.fn(),
  getPrimitivesByStyle: vi.fn(),
}));

vi.mock('../../persistence/anchorObservationDraftsStore', () => ({
  getDraft: vi.fn(),
  putDraft: vi.fn(),
  deleteDraft: vi.fn(),
  getAllDrafts: vi.fn(),
}));

vi.mock('../../persistence/subscriptionStore', () => ({
  getSubscription: vi.fn(),
  putSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
}));

import {
  writeConfigPreferences,
  writeCardVisibility,
  writeSuppressedClass,
  writePrintBatch,
} from '../writers';
import {
  getRefresherConfig,
  putRefresherConfig,
  putPrintBatch,
} from '../../persistence/refresherStore';
import { buildDefaultRefresherConfig } from '../../persistence/refresherDefaults';

// Skill-state mocks for assertion
import * as anchorObservationsStore from '../../persistence/anchorObservationsStore';
import * as exploitAnchorsStore from '../../persistence/exploitAnchorsStore';
import * as perceptionPrimitivesStore from '../../persistence/perceptionPrimitivesStore';
import * as anchorObservationDraftsStore from '../../persistence/anchorObservationDraftsStore';
import * as subscriptionStore from '../../persistence/subscriptionStore';

const SKILL_STATE_MODULES = [
  ['anchorObservationsStore', anchorObservationsStore],
  ['exploitAnchorsStore', exploitAnchorsStore],
  ['perceptionPrimitivesStore', perceptionPrimitivesStore],
  ['anchorObservationDraftsStore', anchorObservationDraftsStore],
  ['subscriptionStore', subscriptionStore],
];

beforeEach(() => {
  vi.clearAllMocks();
  // Ensure getRefresherConfig returns a valid baseline so writers don't crash
  getRefresherConfig.mockResolvedValue(buildDefaultRefresherConfig());
  putRefresherConfig.mockResolvedValue(undefined);
  putPrintBatch.mockResolvedValue(undefined);
});

const assertNoSkillStateStoreCalls = () => {
  for (const [name, mod] of SKILL_STATE_MODULES) {
    for (const [fnName, fn] of Object.entries(mod)) {
      if (vi.isMockFunction(fn)) {
        expect(fn, `${name}.${fnName} must NOT be called from a PRF writer`).not.toHaveBeenCalled();
      }
    }
  }
};

// ───────────────────────────────────────────────────────────────────────────
// W-URC-1 — writeConfigPreferences
// ───────────────────────────────────────────────────────────────────────────

describe('PRF-G5-RI — W-URC-1 writeConfigPreferences (writer boundary)', () => {
  it('only calls refresherStore primitives (no skill-state-store calls)', async () => {
    await writeConfigPreferences({ printPreferences: { colorMode: 'bw' } });

    // PRF stores called
    expect(getRefresherConfig).toHaveBeenCalled();
    expect(putRefresherConfig).toHaveBeenCalled();
    // No skill-state stores called
    assertNoSkillStateStoreCalls();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// W-URC-2a — writeCardVisibility
// ───────────────────────────────────────────────────────────────────────────

describe('PRF-G5-RI — W-URC-2a writeCardVisibility (writer boundary)', () => {
  it('only calls refresherStore primitives (no skill-state-store calls)', async () => {
    await writeCardVisibility({ cardId: 'PRF-X', visibility: 'pinned' });

    expect(getRefresherConfig).toHaveBeenCalled();
    expect(putRefresherConfig).toHaveBeenCalled();
    assertNoSkillStateStoreCalls();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// W-URC-2b — writeSuppressedClass
// ───────────────────────────────────────────────────────────────────────────

describe('PRF-G5-RI — W-URC-2b writeSuppressedClass (writer boundary)', () => {
  it('suppress=true only calls refresherStore primitives', async () => {
    await writeSuppressedClass({ classId: 'math', suppress: true, confirmed: true });

    expect(getRefresherConfig).toHaveBeenCalled();
    expect(putRefresherConfig).toHaveBeenCalled();
    assertNoSkillStateStoreCalls();
  });

  it('suppress=false only calls refresherStore primitives', async () => {
    await writeSuppressedClass({ classId: 'math', suppress: false, ownerInitiated: true });

    expect(getRefresherConfig).toHaveBeenCalled();
    expect(putRefresherConfig).toHaveBeenCalled();
    assertNoSkillStateStoreCalls();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// W-URC-3 — writePrintBatch
// ───────────────────────────────────────────────────────────────────────────

describe('PRF-G5-RI — W-URC-3 writePrintBatch (writer boundary)', () => {
  it('only calls refresherStore primitives (putPrintBatch + W-URC-1 lastExportAt update)', async () => {
    await writePrintBatch({
      printedAt: '2026-04-26T00:00:00Z',
      label: null,
      cardIds: ['PRF-MATH-AUTO-PROFIT'],
      engineVersion: 'v4.7.2',
      appVersion: 'v123',
      perCardSnapshots: {
        'PRF-MATH-AUTO-PROFIT': { contentHash: 'sha256:abc', version: 'v1.0' },
      },
    });

    // putPrintBatch + getRefresherConfig + putRefresherConfig (lastExportAt update)
    expect(putPrintBatch).toHaveBeenCalled();
    expect(getRefresherConfig).toHaveBeenCalled();
    expect(putRefresherConfig).toHaveBeenCalled();
    assertNoSkillStateStoreCalls();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// I-WR-2 meta — explicit declarative coverage
// ───────────────────────────────────────────────────────────────────────────

describe('PRF-G5-RI — I-WR-2 reference-mode write-silence (meta)', () => {
  it('all 4 writers in sequence cause zero skill-state mutations', async () => {
    await writeConfigPreferences({ printPreferences: { colorMode: 'bw' } });
    await writeCardVisibility({ cardId: 'PRF-X', visibility: 'pinned' });
    await writeSuppressedClass({ classId: 'math', suppress: true, confirmed: true });
    await writePrintBatch({
      printedAt: '2026-04-26T00:00:00Z',
      label: null,
      cardIds: ['PRF-MATH-AUTO-PROFIT'],
      engineVersion: 'v4.7.2',
      appVersion: 'v123',
      perCardSnapshots: {
        'PRF-MATH-AUTO-PROFIT': { contentHash: 'sha256:abc', version: 'v1.0' },
      },
    });

    assertNoSkillStateStoreCalls();
  });
});
