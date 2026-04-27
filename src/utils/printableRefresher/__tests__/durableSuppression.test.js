// @vitest-environment jsdom
/**
 * durableSuppression.test.js — PRF-G5-DS test scaffold (writer-level integration).
 *
 * The canonical R-8.1 zero-data-loss proof at the writer/IDB boundary.
 * Mirrors `refresherSelectors.test.js` PRF-G5-SL-ROUNDTRIP-UNSUPPRESS test
 * which proves the SAME invariant at the selector boundary — together they
 * verify the round-trip is durable through the entire stack:
 *
 *   pin 3 cards (writeCardVisibility) → suppress class (writeSuppressedClass)
 *   → un-suppress class → all 3 cards STILL pinned in cardVisibility map.
 *
 * This is the load-bearing assertion for red line #13 (durable-suppression):
 * suppressing a class does NOT clear `cardVisibility[cardId]` entries; the
 * pinned/hidden state per individual card survives the class-level
 * suppress/un-suppress cycle.
 *
 * PRF Phase 5 — Session 15 (PRF-G5-DS).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getDB,
  closeDB,
  resetDBPool,
  DB_NAME,
} from '../../persistence/database';
import {
  writeCardVisibility,
  writeSuppressedClass,
  writeConfigPreferences,
} from '../writers';
import { getRefresherConfig } from '../../persistence/refresherStore';

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

const PINNED_CARDS = ['PRF-MATH-AUTO-PROFIT', 'PRF-MATH-POT-ODDS', 'PRF-PREFLOP-CO-OPEN'];

describe('PRF-G5-DS — durable-suppression at writer/IDB boundary (red line #13)', () => {
  it('pin 3 cards → suppress class → un-suppress class → all 3 still pinned', async () => {
    await getDB();

    // Step 1 — Pin 3 cards
    for (const cardId of PINNED_CARDS) {
      await writeCardVisibility({ cardId, visibility: 'pinned' });
    }
    let config = await getRefresherConfig();
    for (const cardId of PINNED_CARDS) {
      expect(config.cardVisibility[cardId]).toBe('pinned');
    }
    expect(config.suppressedClasses).toEqual([]);

    // Step 2 — Suppress 'math' class (with confirmed:true required by W-URC-2b)
    await writeSuppressedClass({ classId: 'math', suppress: true, confirmed: true });
    config = await getRefresherConfig();
    expect(config.suppressedClasses).toContain('math');
    // Critical: pinned state on individual cards is PRESERVED through suppress
    for (const cardId of PINNED_CARDS) {
      expect(config.cardVisibility[cardId]).toBe('pinned');
    }

    // Step 3 — Un-suppress 'math' class (with ownerInitiated:true required)
    await writeSuppressedClass({ classId: 'math', suppress: false, ownerInitiated: true });
    config = await getRefresherConfig();
    expect(config.suppressedClasses).not.toContain('math');
    // Canonical zero-data-loss proof: all 3 cards STILL pinned
    for (const cardId of PINNED_CARDS) {
      expect(config.cardVisibility[cardId]).toBe('pinned');
    }
  });

  it('hidden card visibility survives class-suppress + un-suppress', async () => {
    await getDB();

    await writeCardVisibility({ cardId: 'PRF-EXCEPTIONS-FISH-DEEP', visibility: 'hidden' });
    let config = await getRefresherConfig();
    expect(config.cardVisibility['PRF-EXCEPTIONS-FISH-DEEP']).toBe('hidden');

    await writeSuppressedClass({ classId: 'exceptions', suppress: true, confirmed: true });
    config = await getRefresherConfig();
    expect(config.cardVisibility['PRF-EXCEPTIONS-FISH-DEEP']).toBe('hidden'); // preserved through suppress

    await writeSuppressedClass({ classId: 'exceptions', suppress: false, ownerInitiated: true });
    config = await getRefresherConfig();
    expect(config.cardVisibility['PRF-EXCEPTIONS-FISH-DEEP']).toBe('hidden'); // preserved through un-suppress
  });

  it('mixed pinned + hidden cards across multiple classes survive sequence of suppress/un-suppress', async () => {
    await getDB();

    // Setup: 2 math cards pinned, 1 preflop card hidden, 1 exceptions card pinned
    await writeCardVisibility({ cardId: 'PRF-MATH-AUTO-PROFIT', visibility: 'pinned' });
    await writeCardVisibility({ cardId: 'PRF-MATH-POT-ODDS', visibility: 'pinned' });
    await writeCardVisibility({ cardId: 'PRF-PREFLOP-CO-OPEN', visibility: 'hidden' });
    await writeCardVisibility({ cardId: 'PRF-EXCEPTIONS-FISH-DEEP', visibility: 'pinned' });

    // Suppress math + exceptions sequentially
    await writeSuppressedClass({ classId: 'math', suppress: true, confirmed: true });
    await writeSuppressedClass({ classId: 'exceptions', suppress: true, confirmed: true });

    // Un-suppress in reverse order
    await writeSuppressedClass({ classId: 'exceptions', suppress: false, ownerInitiated: true });
    await writeSuppressedClass({ classId: 'math', suppress: false, ownerInitiated: true });

    const config = await getRefresherConfig();

    // All per-card visibility state preserved
    expect(config.cardVisibility['PRF-MATH-AUTO-PROFIT']).toBe('pinned');
    expect(config.cardVisibility['PRF-MATH-POT-ODDS']).toBe('pinned');
    expect(config.cardVisibility['PRF-PREFLOP-CO-OPEN']).toBe('hidden');
    expect(config.cardVisibility['PRF-EXCEPTIONS-FISH-DEEP']).toBe('pinned');
    expect(config.suppressedClasses).toEqual([]);
  });

  it('survives close+reopen IDB cycle (cross-session durability)', async () => {
    await getDB();

    await writeCardVisibility({ cardId: 'PRF-MATH-AUTO-PROFIT', visibility: 'pinned' });
    await writeSuppressedClass({ classId: 'exceptions', suppress: true, confirmed: true });

    // Close + re-open (simulates user closing app and reopening tomorrow)
    closeDB();
    resetDBPool();
    await getDB();

    const config = await getRefresherConfig();
    expect(config.cardVisibility['PRF-MATH-AUTO-PROFIT']).toBe('pinned');
    expect(config.suppressedClasses).toContain('exceptions');
  });

  it('writeConfigPreferences (W-URC-1) does not touch cardVisibility or suppressedClasses', async () => {
    await getDB();

    // Setup pinned + suppressed state
    await writeCardVisibility({ cardId: 'PRF-MATH-AUTO-PROFIT', visibility: 'pinned' });
    await writeSuppressedClass({ classId: 'exceptions', suppress: true, confirmed: true });

    // Patch config preferences (should NOT affect cardVisibility/suppressedClasses)
    await writeConfigPreferences({ printPreferences: { colorMode: 'bw' } });

    const config = await getRefresherConfig();
    // I-WR-3 field-ownership: W-URC-1 doesn't touch W-URC-2 fields
    expect(config.cardVisibility['PRF-MATH-AUTO-PROFIT']).toBe('pinned');
    expect(config.suppressedClasses).toContain('exceptions');
    // W-URC-1 field updated correctly
    expect(config.printPreferences.colorMode).toBe('bw');
  });
});
