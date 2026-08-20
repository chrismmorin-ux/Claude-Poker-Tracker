/**
 * ladderRungs.test.js — WS-536. The guard that makes a dead rule impossible.
 *
 * THE BUG THIS EXISTS TO STOP, which actually happened while authoring these rungs on
 * 2026-08-17: R2 and R3 were written with `sBucket: 'small'` and `sBucket: 'large'`.
 * `sizeBucketFor` emits '0-33' | '33-66' | '66-100' | '100-150' | '150+' | 'unknown'.
 * Neither authored value is one this repo ever produces, so BOTH RULES WOULD HAVE NEVER
 * FIRED. R2 would have been behaviourally identical to R1, the ladder would have reported
 * that pricing buys nothing, and that conclusion — a direct answer to a founder question —
 * would have been an artifact of a typo.
 *
 * The Strategy Card loader cannot catch it: it validates that an AXIS is matchable, not that
 * a VALUE is one the axis takes. Nothing else in the pipeline would have either; a rule that
 * never matches is silently equivalent to a rule that is absent.
 *
 * So the enums are imported from their definition sites and every rung's every axis value is
 * checked against them. Adding a rung with a misspelt value now fails here rather than
 * producing a confident wrong number three hours into a corpus run.
 */

import { describe, it, expect } from 'vitest';
import { LADDER, ENTRY_RANGE } from '../backtest/ladder/rungs.card.js';
import { loadStrategyCard, MATCHABLE_AXES } from '../../src/utils/standardOfRecord/strategyCard.js';
import { SPR_ZONES } from '../../src/utils/pokerCore/sprBands.js';
import { sizeBucketFor } from '../backtest/decisionGeometry.mjs';

/** Every value `sizeBucketFor` can return, produced BY CALLING IT rather than transcribed. */
const S_BUCKETS = new Set([
  sizeBucketFor(0.1, 1), sizeBucketFor(0.5, 1), sizeBucketFor(0.8, 1),
  sizeBucketFor(1.2, 1), sizeBucketFor(2.0, 1), sizeBucketFor(NaN, 1),
]);

const SPR_BANDS = new Set([...Object.values(SPR_ZONES), 'unknown']);

/** Axis -> the closed set of values it can take. Absent axes are unconstrained here. */
const AXIS_VOCAB = {
  sBucket: S_BUCKETS,
  sprBand: SPR_BANDS,
  facingAction: new Set(['none', 'bet', 'raise']),
  street: new Set(['preflop', 'flop', 'turn', 'river']),
};

describe('ladder rungs — vocabulary guard', () => {
  it('the size-bucket enum is what the test thinks it is', () => {
    expect([...S_BUCKETS].sort()).toEqual(['0-33', '100-150', '150+', '33-66', '66-100', 'unknown']);
  });

  it('every rule keys only on matchable axes', () => {
    for (const card of LADDER) {
      for (const rule of card.rules) {
        for (const axis of Object.keys(rule.when)) {
          expect(MATCHABLE_AXES, `${card.cardId}/${rule.id}`).toContain(axis);
        }
      }
    }
  });

  it('NO RULE KEYS ON A VALUE ITS AXIS NEVER TAKES', () => {
    const dead = [];
    for (const card of LADDER) {
      for (const rule of card.rules) {
        for (const [axis, value] of Object.entries(rule.when)) {
          const vocab = AXIS_VOCAB[axis];
          if (!vocab) continue;
          for (const v of (Array.isArray(value) ? value : [value])) {
            if (!vocab.has(v)) dead.push(`${card.cardId}/${rule.id}: ${axis}="${v}"`);
          }
        }
      }
    }
    expect(dead).toEqual([]);
  });
});

describe('ladder rungs — structure', () => {
  it('every rung loads through the real Strategy Card validator', async () => {
    for (const card of LADDER) {
      const loaded = await loadStrategyCard(card);
      expect(loaded.contentHash).toMatch(/^sha256:/);
      expect(loaded.residual).toBeTruthy();
    }
  });

  it('rungs are ordered and each is at least as expressive as the one below', () => {
    for (let i = 1; i < LADDER.length; i++) {
      expect(LADDER[i].rules.length).toBeGreaterThanOrEqual(LADDER[i - 1].rules.length);
    }
  });

  it('every rule carries a warrant from the legal set', () => {
    for (const card of LADDER) {
      for (const rule of card.rules) {
        expect(['equity', 'structure', 'read', 'fear']).toContain(rule.warrant);
      }
    }
  });

  it('every action distribution sums to 1', () => {
    for (const card of LADDER) {
      for (const rule of card.rules) {
        const sum = Object.values(rule.do).reduce((a, b) => a + b, 0);
        expect(sum, `${card.cardId}/${rule.id}`).toBeCloseTo(1, 9);
      }
      const rsum = Object.values(card.residual.do).reduce((a, b) => a + b, 0);
      expect(rsum, `${card.cardId}/residual`).toBeCloseTo(1, 9);
    }
  });

  it('rungs have distinct content hashes — a rung identical to the one below measures nothing', async () => {
    const hashes = new Set();
    for (const card of LADDER) {
      const loaded = await loadStrategyCard(card);
      expect(hashes.has(loaded.contentHash), `${card.cardId} duplicates a lower rung`).toBe(false);
      hashes.add(loaded.contentHash);
    }
  });

  it('the entry range is ~20% of combos, matching the measured tight pole', () => {
    const combos = ENTRY_RANGE.reduce((n, c) => {
      if (c.length === 2) return n + 6;          // pair
      return n + (c.endsWith('s') ? 4 : 12);     // suited / offsuit
    }, 0);
    const pct = combos / 1326;
    expect(pct).toBeGreaterThan(0.15);
    expect(pct).toBeLessThan(0.25);
  });
});
