/**
 * rehydrationHash.test.js — WS-573 DEFECT-1 RESIDUAL
 *
 * A regression test for the rehydration hash check that verifies:
 * 1. The hash check compares against an INDEPENDENTLY-DERIVED hash, not a second
 *    read of the same field (the defect that motivated this test).
 * 2. A mutated card body changes the derived hash but not the advertised hash.
 * 3. A card with no advertised hash passes silently (soft spot in rederiveFromRecord).
 *
 * The original defect: descriptor.contentHash was compared against
 * arm.descriptor.contentHash — both copied off the same field, so the check
 * could only compare a value to itself and could never fail. This test ensures
 * that the fix (comparing advertised vs independently-derived) stays in place.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { fromStrategyCard, rehydrateStrategy } from '../backtest/strategyArm.mjs';
import { loadStrategyCard } from '../../src/utils/standardOfRecord/strategyCard.js';
import { hashObject } from '../../src/utils/contentHash.js';
import { canonicalCardBody } from '../../src/utils/standardOfRecord/strategyCard.js';
import { LADDER } from '../backtest/ladder/rungs.card.js';
import { readDecisionRecord } from '../backtest/rederiveFromRecord.mjs';

describe('rehydration hash check (WS-573 DEFECT-1)', () => {
  let testCard;
  let testArm;

  beforeEach(async () => {
    // Load a real strategy card from the ladder.
    testCard = await loadStrategyCard(LADDER[0]);
    testArm = fromStrategyCard(testCard, { sourceRef: 'test' });
  });

  describe('strategyArm.mjs rehydration', () => {
    it('accepts a descriptor whose advertised contentHash matches the derived hash', async () => {
      // This descriptor is fresh from the loaded card, so both hashes should match.
      const descriptor = testArm.descriptor;
      expect(descriptor.contentHash).toBeTruthy();

      // Rehydrating with the correct hash should not throw.
      const rebuilt = await rehydrateStrategy(descriptor, { armId: 'test-id' });
      expect(rebuilt).toBeTruthy();
      expect(rebuilt.descriptor.contentHash).toBe(descriptor.contentHash);
    });

    it('rejects when advertised hash does not match derived hash', async () => {
      const descriptor = structuredClone(testArm.descriptor);
      const wrongHash = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';

      // Tamper with the advertised hash only (card body unchanged).
      descriptor.contentHash = wrongHash;

      await expect(
        rehydrateStrategy(descriptor, { armId: 'test-id' })
      ).rejects.toThrow(/REHYDRATION HASH MISMATCH/);
    });

    it('proves advertised and derived come from INDEPENDENT sources', async () => {
      const descriptor = structuredClone(testArm.descriptor);
      const originalAdvertised = descriptor.contentHash;
      const originalDerived = await hashObject(canonicalCardBody(descriptor.card));

      // Verify they match initially.
      expect(originalAdvertised).toBe(originalDerived);

      // Now mutate the CARD BODY but keep the advertised hash.
      descriptor.card.rules.pop(); // Remove a rule — this changes the card body.
      descriptor.contentHash = originalAdvertised; // Keep the old advertised hash.

      // The rehydration should now fail because:
      // - advertised is still the original hash (unchanged)
      // - derived is computed fresh from the mutated card body (changed)
      // This proves the two sources are truly independent.
      await expect(
        rehydrateStrategy(descriptor, { armId: 'test-id' })
      ).rejects.toThrow(/REHYDRATION HASH MISMATCH/);
    });

    it('fails if anyone rewires the two sides to the same field again', async () => {
      // This is the regression guard. If a future maintainer changes the code from:
      //   const advertised = descriptor.contentHash;
      //   const derived = await hashObject(canonicalCardBody(descriptor.card));
      // back to something vacuous like:
      //   const advertised = descriptor.contentHash;
      //   const derived = descriptor.contentHash;  // WRONG: same field
      // then this test will catch it because:
      const descriptor = structuredClone(testArm.descriptor);
      descriptor.card.rules.pop(); // Mutate the card.
      descriptor.contentHash = 'sha256:something-stale'; // Advertised is stale.

      // If the check is correctly independent, it will fail.
      // If the check is vacuous (same field), it will pass (BUG).
      await expect(
        rehydrateStrategy(descriptor, { armId: 'test-id' })
      ).rejects.toThrow(/REHYDRATION HASH MISMATCH/);
    });

    it('refuses unknown descriptor kinds rather than guessing', async () => {
      await expect(rehydrateStrategy({ kind: 'unknown' }, { armId: 'x' }))
        .rejects.toThrow(/unknown kind/);
    });
  });

  describe('rederiveFromRecord.mjs soft spot: record with no contentHash', () => {
    it('passes silently when summary has no contentHash field (current soft spot)', () => {
      // Construct a minimal decision record with NO contentHash in the summary.
      // This represents a record written before the hash was added to the schema.
      const metaLine = JSON.stringify({
        kind: 'meta',
        engine: {},
        estimator: { weightCap: 1000, bootstrapSeed: 0, bootstrapResamples: 1000, bootstrapAlpha: 0.05 },
      });
      const decisionLine = JSON.stringify({
        kind: 'decision',
        piPool: 0.5,
        piOurs: 0.6,
        observedAction: 'call',
        netBB: 10,
      });
      const summaryLine = JSON.stringify({
        kind: 'summary',
        rowCount: 1,
        schemaVersion: 2,
        // NOTE: no contentHash field — this is the soft spot
      });

      const recordText = `${metaLine}\n${decisionLine}\n${summaryLine}`;

      // readDecisionRecord currently passes silently when contentHash is missing.
      // This is a KNOWN GAP per WS-573 acceptance criteria.
      // Behavior: no error is thrown, the record is accepted.
      const result = readDecisionRecord(recordText);
      expect(result).toBeTruthy();
      expect(result.summary.contentHash).toBeUndefined();
      // DOCUMENTED SOFT SPOT: A record with NO hash passes silently.
      // This means a record could be modified after creation and the modification
      // would not be detected (because there was no baseline hash to compare against).
      // Future work: emit a warning, or require hashes on all new records.
    });

    it('throws when summary HAS contentHash and it does not match the computed hash', () => {
      // Construct a record WITH a contentHash that will NOT match.
      const wrongHash = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
      const metaLine = JSON.stringify({
        kind: 'meta',
        engine: {},
        estimator: { weightCap: 1000, bootstrapSeed: 0, bootstrapResamples: 1000, bootstrapAlpha: 0.05 },
      });
      const decisionLine = JSON.stringify({
        kind: 'decision',
        piPool: 0.5,
        piOurs: 0.6,
        observedAction: 'call',
        netBB: 10,
      });
      const summaryLine = JSON.stringify({
        kind: 'summary',
        rowCount: 1,
        schemaVersion: 2,
        contentHash: wrongHash,
      });

      const recordText = `${metaLine}\n${decisionLine}\n${summaryLine}`;

      expect(() => readDecisionRecord(recordText))
        .toThrow(/contentHash does not recompute/);
    });

    it('accepts when summary contentHash is computed correctly', () => {
      // Build a record and compute its actual hash.
      const schemaVersion = 2;
      const metaLine = JSON.stringify({
        kind: 'meta',
        engine: {},
        estimator: { weightCap: 1000, bootstrapSeed: 0, bootstrapResamples: 1000, bootstrapAlpha: 0.05 },
      });
      const decisionLine = JSON.stringify({
        kind: 'decision',
        piPool: 0.5,
        piOurs: 0.6,
        observedAction: 'call',
        netBB: 10,
      });

      // Compute the hash exactly as rederiveFromRecord does:
      const h = createHash('sha256');
      h.update(`decision-record-v${schemaVersion}\n`);
      h.update(decisionLine);
      h.update('\n');
      const computedHash = `sha256:${h.digest('hex')}`;

      const summaryLine = JSON.stringify({
        kind: 'summary',
        rowCount: 1,
        schemaVersion,
        contentHash: computedHash,
      });

      const recordText = `${metaLine}\n${decisionLine}\n${summaryLine}`;

      const result = readDecisionRecord(recordText);
      expect(result).toBeTruthy();
      expect(result.summary.contentHash).toBe(computedHash);
    });
  });
});
