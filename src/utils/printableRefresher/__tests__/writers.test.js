// @vitest-environment jsdom
/**
 * writers.test.js — coverage for the 3 PRF writers (W-URC-1/2/3) per WRITERS.md.
 *
 * Validates each writer's:
 *   - Field-ownership reject cases (I-WR-3 segregation)
 *   - Required-options guards (red line #13 + AP-PRF-05 + AP-PRF-09)
 *   - Round-trip via refresherStore primitives
 *   - Cross-writer side effect (W-URC-3 → W-URC-1 lastExportAt update)
 *
 * PRF Phase 5 — Session 13 (PRF-G5-WR).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getDB,
  closeDB,
  resetDBPool,
  DB_NAME,
} from '../../persistence/database';
import {
  writeConfigPreferences,
  writeCardVisibility,
  writeSuppressedClass,
  writePrintBatch,
} from '../writers';
import {
  getRefresherConfig,
  getAllPrintBatches,
} from '../../persistence/refresherStore';
import { buildDefaultRefresherConfig } from '../../persistence/refresherDefaults';

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

const validBatchPayload = (overrides = {}) => ({
  printedAt: '2026-04-26T00:00:00Z',
  label: 'test batch',
  cardIds: ['PRF-MATH-AUTO-PROFIT'],
  engineVersion: 'v4.7.2',
  appVersion: 'v123',
  perCardSnapshots: {
    'PRF-MATH-AUTO-PROFIT': { contentHash: 'sha256:abc', version: 'v1.0' },
  },
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────
// W-URC-1 — writeConfigPreferences
// ───────────────────────────────────────────────────────────────────────────

describe('W-URC-1 writeConfigPreferences — happy path', () => {
  it('round-trips printPreferences patch (single field)', async () => {
    await getDB();
    await writeConfigPreferences({ printPreferences: { colorMode: 'bw' } });
    const after = await getRefresherConfig();
    expect(after.printPreferences.colorMode).toBe('bw');
    // Other prefs preserved
    expect(after.printPreferences.cardsPerSheet).toBe(12);
    expect(after.printPreferences.includeLineage).toBe(true);
  });

  it('round-trips printPreferences patch (multiple fields)', async () => {
    await getDB();
    await writeConfigPreferences({ printPreferences: { colorMode: 'bw', cardsPerSheet: 6 } });
    const after = await getRefresherConfig();
    expect(after.printPreferences.colorMode).toBe('bw');
    expect(after.printPreferences.cardsPerSheet).toBe(6);
  });

  it('round-trips notifications.staleness toggle', async () => {
    await getDB();
    await writeConfigPreferences({ notifications: { staleness: true } });
    const after = await getRefresherConfig();
    expect(after.notifications.staleness).toBe(true);
  });

  it('round-trips lastExportAt update', async () => {
    await getDB();
    await writeConfigPreferences({ lastExportAt: '2026-04-26T12:00:00Z' });
    const after = await getRefresherConfig();
    expect(after.lastExportAt).toBe('2026-04-26T12:00:00Z');
  });

  it('preserves singleton id through the merge', async () => {
    await getDB();
    await writeConfigPreferences({ printPreferences: { colorMode: 'bw' } });
    const after = await getRefresherConfig();
    expect(after.id).toBe('singleton');
  });

  it('returns the merged singleton record', async () => {
    await getDB();
    const result = await writeConfigPreferences({ printPreferences: { colorMode: 'bw' } });
    expect(result.id).toBe('singleton');
    expect(result.printPreferences.colorMode).toBe('bw');
  });
});

describe('W-URC-1 writeConfigPreferences — I-WR-3 field-ownership rejects', () => {
  it('rejects cardVisibility patch (W-URC-2 territory)', async () => {
    await getDB();
    await expect(
      writeConfigPreferences({ cardVisibility: { 'PRF-X': 'hidden' } })
    ).rejects.toThrow(/W-URC-1 does not own field 'cardVisibility'/);
  });

  it('rejects suppressedClasses patch (W-URC-2 territory)', async () => {
    await getDB();
    await expect(
      writeConfigPreferences({ suppressedClasses: ['math'] })
    ).rejects.toThrow(/W-URC-1 does not own field 'suppressedClasses'/);
  });

  it('rejects unknown top-level keys', async () => {
    await getDB();
    await expect(
      writeConfigPreferences({ randomField: 'bogus' })
    ).rejects.toThrow(/W-URC-1 does not own field 'randomField'/);
  });

  it('rejects unknown printPreferences nested keys', async () => {
    await getDB();
    await expect(
      writeConfigPreferences({ printPreferences: { unknownKey: 'foo' } })
    ).rejects.toThrow(/printPreferences contains unknown key 'unknownKey'/);
  });

  it('rejects unknown notifications nested keys', async () => {
    await getDB();
    await expect(
      writeConfigPreferences({ notifications: { unknownKey: true } })
    ).rejects.toThrow(/notifications contains unknown key 'unknownKey'/);
  });
});

describe('W-URC-1 writeConfigPreferences — AP-PRF-09 includeCodex Phase 1 refusal', () => {
  it('rejects includeCodex:true (red line #16)', async () => {
    await getDB();
    await expect(
      writeConfigPreferences({ printPreferences: { includeCodex: true } })
    ).rejects.toThrow(/AP-PRF-09|Phase 1|red line #16/);
  });

  it('accepts includeCodex:false (default; explicit re-affirm)', async () => {
    await getDB();
    await writeConfigPreferences({ printPreferences: { includeCodex: false } });
    const after = await getRefresherConfig();
    expect(after.printPreferences.includeCodex).toBe(false);
  });
});

describe('W-URC-1 writeConfigPreferences — input shape rejects', () => {
  it('rejects null patch', async () => {
    await getDB();
    await expect(writeConfigPreferences(null)).rejects.toThrow(/non-null object/);
  });

  it('rejects array patch', async () => {
    await getDB();
    await expect(writeConfigPreferences([])).rejects.toThrow(/non-null object/);
  });

  it('rejects null printPreferences', async () => {
    await getDB();
    await expect(
      writeConfigPreferences({ printPreferences: null })
    ).rejects.toThrow(/printPreferences must be a non-null object/);
  });

  it('rejects non-string lastExportAt that is not null', async () => {
    await getDB();
    await expect(
      writeConfigPreferences({ lastExportAt: 12345 })
    ).rejects.toThrow(/lastExportAt must be ISO8601/);
  });

  it('accepts lastExportAt: null', async () => {
    await getDB();
    await writeConfigPreferences({ lastExportAt: null });
    const after = await getRefresherConfig();
    expect(after.lastExportAt).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// W-URC-2a — writeCardVisibility
// ───────────────────────────────────────────────────────────────────────────

describe('W-URC-2a writeCardVisibility — happy path', () => {
  it('pins a card', async () => {
    await getDB();
    await writeCardVisibility({ cardId: 'PRF-MATH-AUTO-PROFIT', visibility: 'pinned' });
    const after = await getRefresherConfig();
    expect(after.cardVisibility['PRF-MATH-AUTO-PROFIT']).toBe('pinned');
  });

  it('hides a card', async () => {
    await getDB();
    await writeCardVisibility({ cardId: 'PRF-MATH-AUTO-PROFIT', visibility: 'hidden' });
    const after = await getRefresherConfig();
    expect(after.cardVisibility['PRF-MATH-AUTO-PROFIT']).toBe('hidden');
  });

  it("'default' visibility removes the entry from cardVisibility map", async () => {
    await getDB();
    await writeCardVisibility({ cardId: 'PRF-X', visibility: 'pinned' });
    let after = await getRefresherConfig();
    expect(after.cardVisibility['PRF-X']).toBe('pinned');

    await writeCardVisibility({ cardId: 'PRF-X', visibility: 'default' });
    after = await getRefresherConfig();
    expect(after.cardVisibility['PRF-X']).toBeUndefined();
  });

  it('hide-then-pin overwrites (last-write-wins enum)', async () => {
    await getDB();
    await writeCardVisibility({ cardId: 'PRF-X', visibility: 'hidden' });
    await writeCardVisibility({ cardId: 'PRF-X', visibility: 'pinned' });
    const after = await getRefresherConfig();
    expect(after.cardVisibility['PRF-X']).toBe('pinned');
  });

  it('preserves other cards visibility through write', async () => {
    await getDB();
    await writeCardVisibility({ cardId: 'PRF-A', visibility: 'pinned' });
    await writeCardVisibility({ cardId: 'PRF-B', visibility: 'hidden' });
    const after = await getRefresherConfig();
    expect(after.cardVisibility['PRF-A']).toBe('pinned');
    expect(after.cardVisibility['PRF-B']).toBe('hidden');
  });
});

describe('W-URC-2a writeCardVisibility — input rejects', () => {
  it('rejects empty cardId', async () => {
    await getDB();
    await expect(writeCardVisibility({ cardId: '', visibility: 'pinned' })).rejects.toThrow(/cardId/);
  });

  it('rejects missing cardId', async () => {
    await getDB();
    await expect(writeCardVisibility({ visibility: 'pinned' })).rejects.toThrow(/cardId/);
  });

  it('rejects invalid visibility value', async () => {
    await getDB();
    await expect(
      writeCardVisibility({ cardId: 'PRF-X', visibility: 'whatever' })
    ).rejects.toThrow(/visibility ∈ \{default, hidden, pinned\}/);
  });

  it('rejects no-args call', async () => {
    await getDB();
    await expect(writeCardVisibility()).rejects.toThrow(/cardId/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// W-URC-2b — writeSuppressedClass
// ───────────────────────────────────────────────────────────────────────────

describe('W-URC-2b writeSuppressedClass — happy path', () => {
  it('suppresses a class with confirmed:true', async () => {
    await getDB();
    await writeSuppressedClass({ classId: 'math', suppress: true, confirmed: true });
    const after = await getRefresherConfig();
    expect(after.suppressedClasses).toContain('math');
  });

  it('un-suppresses a class with ownerInitiated:true', async () => {
    await getDB();
    await writeSuppressedClass({ classId: 'math', suppress: true, confirmed: true });
    await writeSuppressedClass({ classId: 'math', suppress: false, ownerInitiated: true });
    const after = await getRefresherConfig();
    expect(after.suppressedClasses).not.toContain('math');
  });

  it('idempotent — suppressing already-suppressed class does not duplicate', async () => {
    await getDB();
    await writeSuppressedClass({ classId: 'math', suppress: true, confirmed: true });
    await writeSuppressedClass({ classId: 'math', suppress: true, confirmed: true });
    const after = await getRefresherConfig();
    expect(after.suppressedClasses.filter((c) => c === 'math')).toHaveLength(1);
  });

  it('un-suppressing not-suppressed class is a no-op', async () => {
    await getDB();
    await writeSuppressedClass({ classId: 'math', suppress: false, ownerInitiated: true });
    const after = await getRefresherConfig();
    expect(after.suppressedClasses).not.toContain('math');
  });

  it('preserves other suppressed classes through write', async () => {
    await getDB();
    await writeSuppressedClass({ classId: 'math', suppress: true, confirmed: true });
    await writeSuppressedClass({ classId: 'exceptions', suppress: true, confirmed: true });
    const after = await getRefresherConfig();
    expect(after.suppressedClasses.sort()).toEqual(['exceptions', 'math']);
  });
});

describe('W-URC-2b writeSuppressedClass — confirm + ownerInitiated guards', () => {
  it('rejects suppress:true without confirmed:true (red line #13 deliberate-suppression)', async () => {
    await getDB();
    await expect(
      writeSuppressedClass({ classId: 'math', suppress: true })
    ).rejects.toThrow(/confirmed === true|red line #13/);
  });

  it('rejects suppress:true with confirmed:false', async () => {
    await getDB();
    await expect(
      writeSuppressedClass({ classId: 'math', suppress: true, confirmed: false })
    ).rejects.toThrow(/confirmed === true/);
  });

  it('rejects suppress:false without ownerInitiated:true (AP-PRF-05 no-programmatic-un-suppress)', async () => {
    await getDB();
    await expect(
      writeSuppressedClass({ classId: 'math', suppress: false })
    ).rejects.toThrow(/ownerInitiated === true|AP-PRF-05/);
  });

  it('rejects suppress:false with ownerInitiated:false', async () => {
    await getDB();
    await expect(
      writeSuppressedClass({ classId: 'math', suppress: false, ownerInitiated: false })
    ).rejects.toThrow(/ownerInitiated === true/);
  });
});

describe('W-URC-2b writeSuppressedClass — input rejects', () => {
  it('rejects empty classId', async () => {
    await getDB();
    await expect(
      writeSuppressedClass({ classId: '', suppress: true, confirmed: true })
    ).rejects.toThrow(/classId/);
  });

  it('rejects non-boolean suppress', async () => {
    await getDB();
    await expect(
      writeSuppressedClass({ classId: 'math', suppress: 'yes', confirmed: true })
    ).rejects.toThrow(/boolean suppress/);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// W-URC-3 — writePrintBatch (red line #15 + I-WR-6)
// ───────────────────────────────────────────────────────────────────────────

describe('W-URC-3 writePrintBatch — happy path', () => {
  it('writes a complete batch with auto-generated batchId', async () => {
    await getDB();
    const { batchId, record } = await writePrintBatch(validBatchPayload());
    expect(typeof batchId).toBe('string');
    expect(batchId.length).toBeGreaterThan(0);
    expect(record.batchId).toBe(batchId);
    expect(record.printedAt).toBe('2026-04-26T00:00:00Z');
    expect(record.cardIds).toEqual(['PRF-MATH-AUTO-PROFIT']);
    expect(record.schemaVersion).toBe(1);
  });

  it('persists the batch to printBatches store', async () => {
    await getDB();
    await writePrintBatch(validBatchPayload());
    const all = await getAllPrintBatches();
    expect(all).toHaveLength(1);
    expect(all[0].cardIds).toEqual(['PRF-MATH-AUTO-PROFIT']);
  });

  it('multiple batches generate distinct batchIds', async () => {
    await getDB();
    const { batchId: a } = await writePrintBatch(validBatchPayload({ printedAt: '2026-04-26T01:00:00Z' }));
    const { batchId: b } = await writePrintBatch(validBatchPayload({ printedAt: '2026-04-26T02:00:00Z' }));
    expect(a).not.toBe(b);
    const all = await getAllPrintBatches();
    expect(all).toHaveLength(2);
  });

  it('post-write side effect: lastExportAt updated to printedAt via W-URC-1', async () => {
    await getDB();
    await writePrintBatch(validBatchPayload({ printedAt: '2026-05-01T12:00:00Z' }));
    const config = await getRefresherConfig();
    expect(config.lastExportAt).toBe('2026-05-01T12:00:00Z');
  });

  it('preserves the buildDefaultRefresherConfig defaults across W-URC-3 lastExportAt update', async () => {
    await getDB();
    const before = await getRefresherConfig();
    expect(before).toEqual(buildDefaultRefresherConfig());

    await writePrintBatch(validBatchPayload({ printedAt: '2026-05-01T12:00:00Z' }));

    const after = await getRefresherConfig();
    // Only lastExportAt should have changed
    expect(after.printPreferences).toEqual(before.printPreferences);
    expect(after.notifications).toEqual(before.notifications);
    expect(after.cardVisibility).toEqual(before.cardVisibility);
    expect(after.suppressedClasses).toEqual(before.suppressedClasses);
    expect(after.lastExportAt).toBe('2026-05-01T12:00:00Z');
  });
});

describe('W-URC-3 writePrintBatch — I-WR-6 perCardSnapshots completeness', () => {
  it('rejects when cardIds and perCardSnapshots have different sizes', async () => {
    await getDB();
    await expect(
      writePrintBatch(validBatchPayload({
        cardIds: ['A', 'B'],
        perCardSnapshots: { A: { contentHash: 'sha256:a', version: 'v1' } }, // missing B
      }))
    ).rejects.toThrow(/I-WR-6|perCardSnapshots completeness|2 entries.*1/);
  });

  it('rejects when perCardSnapshots has key not in cardIds', async () => {
    await getDB();
    await expect(
      writePrintBatch(validBatchPayload({
        cardIds: ['A'],
        perCardSnapshots: {
          A: { contentHash: 'sha256:a', version: 'v1' },
          B: { contentHash: 'sha256:b', version: 'v1' }, // not in cardIds
        },
      }))
    ).rejects.toThrow(/I-WR-6|completeness/);
  });

  it('rejects when snapshot is missing contentHash', async () => {
    await getDB();
    await expect(
      writePrintBatch(validBatchPayload({
        cardIds: ['A'],
        perCardSnapshots: { A: { version: 'v1' } },
      }))
    ).rejects.toThrow(/contentHash/);
  });

  it('rejects when snapshot is missing version', async () => {
    await getDB();
    await expect(
      writePrintBatch(validBatchPayload({
        cardIds: ['A'],
        perCardSnapshots: { A: { contentHash: 'sha256:a' } },
      }))
    ).rejects.toThrow(/version/);
  });
});

describe('W-URC-3 writePrintBatch — input rejects', () => {
  it('rejects empty cardIds', async () => {
    await getDB();
    await expect(
      writePrintBatch(validBatchPayload({ cardIds: [], perCardSnapshots: {} }))
    ).rejects.toThrow(/non-empty cardIds/);
  });

  it('rejects empty printedAt', async () => {
    await getDB();
    await expect(
      writePrintBatch(validBatchPayload({ printedAt: '' }))
    ).rejects.toThrow(/printedAt/);
  });

  it('rejects empty engineVersion', async () => {
    await getDB();
    await expect(
      writePrintBatch(validBatchPayload({ engineVersion: '' }))
    ).rejects.toThrow(/engineVersion/);
  });

  it('rejects empty appVersion', async () => {
    await getDB();
    await expect(
      writePrintBatch(validBatchPayload({ appVersion: '' }))
    ).rejects.toThrow(/appVersion/);
  });

  it('rejects null perCardSnapshots', async () => {
    await getDB();
    await expect(
      writePrintBatch(validBatchPayload({ perCardSnapshots: null }))
    ).rejects.toThrow(/perCardSnapshots/);
  });

  it('rejects non-string label that is not null', async () => {
    await getDB();
    await expect(
      writePrintBatch(validBatchPayload({ label: 12345 }))
    ).rejects.toThrow(/label must be string or null/);
  });

  it('accepts label: null', async () => {
    await getDB();
    const { record } = await writePrintBatch(validBatchPayload({ label: null }));
    expect(record.label).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Integration — multi-writer round-trip
// ───────────────────────────────────────────────────────────────────────────

describe('Writers integration — full lifecycle', () => {
  it('config-pref + visibility + suppression + print-batch all coexist', async () => {
    await getDB();
    await writeConfigPreferences({ printPreferences: { colorMode: 'bw' } });
    await writeCardVisibility({ cardId: 'PRF-A', visibility: 'pinned' });
    await writeSuppressedClass({ classId: 'exceptions', suppress: true, confirmed: true });
    await writePrintBatch(validBatchPayload());

    const config = await getRefresherConfig();
    const batches = await getAllPrintBatches();

    expect(config.printPreferences.colorMode).toBe('bw');
    expect(config.cardVisibility['PRF-A']).toBe('pinned');
    expect(config.suppressedClasses).toContain('exceptions');
    expect(config.lastExportAt).toBe('2026-04-26T00:00:00Z'); // W-URC-3 → W-URC-1 side effect
    expect(batches).toHaveLength(1);
  });
});
