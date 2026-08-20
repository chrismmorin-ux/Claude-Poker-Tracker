/**
 * strategyArmWorkerTransport.test.js — WS-540.
 *
 * A strategy arm's `policyAt` is a closure and cannot cross a worker boundary, so every run
 * containing one used to throw and fall back to `workers: 0` — one core of twenty. The fix is
 * that the ARM does not travel; its INPUTS do. `fromStrategyCard` is a pure function of
 * (card, opts), a loaded card is plain data, and the worker rebuilds the arm on its own side.
 *
 * These tests pin the three properties that make that safe:
 *
 *   1. The descriptor actually survives structuredClone — the real transport mechanism, not a
 *      JSON round-trip that would hide a non-cloneable field.
 *   2. A rebuilt arm is IDENTICAL to the original, so parallel and serial are the same
 *      measurement rather than two similar ones.
 *   3. A descriptor whose content hash does not match REFUSES. This is the one that matters:
 *      a worker rebuilding a different card than the main thread would produce internally
 *      consistent, entirely plausible, wrong numbers, and nothing downstream could detect it.
 *
 * Measured on the ladder when this landed: 217.3 s -> 33.7 s at 8 workers, with every rung
 * edge, every paired delta and the coverage block bit-identical to the serial run.
 */

import { describe, it, expect } from 'vitest';
import { fromStrategyCard, rehydrateStrategy } from '../backtest/strategyArm.mjs';
import { loadStrategyCard, evaluateCard } from '../../src/utils/standardOfRecord/strategyCard.js';
import { LADDER } from '../backtest/ladder/rungs.card.js';

const armFor = async (i) => {
  const card = await loadStrategyCard(LADDER[i]);
  return fromStrategyCard(card, { sourceRef: `test:${card.cardId}` });
};

describe('strategy arm worker transport', () => {
  it('every arm carries a descriptor with its content hash', async () => {
    for (let i = 0; i < LADDER.length; i++) {
      const arm = await armFor(i);
      expect(arm.descriptor).toBeTruthy();
      expect(arm.descriptor.kind).toBe('strategy-card');
      expect(arm.descriptor.contentHash).toMatch(/^sha256:/);
      expect(arm.descriptor.contentHash).toBe(arm.descriptor.card.contentHash);
    }
  });

  it('the descriptor survives structuredClone — the actual transport, not a JSON proxy', async () => {
    const arm = await armFor(2);
    const cloned = structuredClone(arm.descriptor);
    expect(cloned.contentHash).toBe(arm.descriptor.contentHash);
    expect(cloned.card.rules).toHaveLength(arm.descriptor.card.rules.length);
  });

  it('a rebuilt arm is identical to the original', async () => {
    for (let i = 0; i < LADDER.length; i++) {
      const arm = await armFor(i);
      const rebuilt = await rehydrateStrategy(structuredClone(arm.descriptor), { armId: arm.id });
      expect(rebuilt.id).toBe(arm.id);
      expect(rebuilt.version).toBe(arm.version);
      expect(rebuilt.encoding).toBe(arm.encoding);
      expect(rebuilt.sourceRef).toBe(arm.sourceRef);
      expect(rebuilt.needsHand).toBe(arm.needsHand);
      expect(rebuilt.descriptor.contentHash).toBe(arm.descriptor.contentHash);
    }
  });

  it('REFUSES a descriptor whose content hash does not match the rebuild', async () => {
    const arm = await armFor(2);
    const tampered = { ...structuredClone(arm.descriptor), contentHash: 'sha256:deadbeefdeadbeef' };
    await expect(rehydrateStrategy(tampered, { armId: 'r2' })).rejects.toThrow(/REHYDRATION HASH MISMATCH/);
  });

  it('REFUSES a descriptor whose CARD was altered in transit', async () => {
    const arm = await armFor(2);
    const tampered = structuredClone(arm.descriptor);
    tampered.card.rules.pop();            // lose a rule, keep the advertised hash
    await expect(rehydrateStrategy(tampered, { armId: 'r2' })).rejects.toThrow(/REHYDRATION HASH MISMATCH/);
  });

  it('refuses a descriptor of unknown kind rather than guessing', async () => {
    await expect(rehydrateStrategy({ kind: 'something-else' }, { armId: 'x' }))
      .rejects.toThrow(/unknown kind/);
    await expect(rehydrateStrategy(null, { armId: 'x' })).rejects.toThrow(/descriptor missing/);
  });

  it('a rebuilt arm abstains identically where the original abstains', async () => {
    // Every ladder rung has a `handClass` rule, so `needsHand` is true and `policyAt` takes
    // the range-marginalisation path — which correctly abstains without `rangeBefore`/`board`.
    // That abstention is a real branch and the rebuilt arm must take it identically.
    const arm = await armFor(3);
    const rebuilt = await rehydrateStrategy(structuredClone(arm.descriptor), { armId: arm.id });
    const ctx = {
      street: 'flop', texture: 'dry', posCategory: 'BTN', isAgg: 'agg', isIP: 'ip',
      facingAction: 'bet', contextAction: null,
    };
    const geo = { sprBand: 'medium', closesAction: 'false', sBucket: '33-66', stackBB: 100 };
    const hand = { seatPlayers: { 1: 'a', 2: 'b' } };
    expect(arm.needsHand).toBe(true);
    const a = arm.policyAt({ ctx, hand, geo });
    const b = rebuilt.policyAt({ ctx, hand, geo });
    expect(b).toEqual(a);
    expect(a.covered).toBe(false);
  });

  it('the rebuilt CARD decides a covered situation identically', async () => {
    // The covered path, without building a range fixture: both cards are evaluated directly
    // on a full situation. If transport altered a rule, this is where it shows.
    const original = await loadStrategyCard(LADDER[3]);
    const arm = fromStrategyCard(original, { sourceRef: 'test' });
    const rebuilt = await rehydrateStrategy(structuredClone(arm.descriptor), { armId: arm.id });
    const situation = {
      street: 'flop', texture: 'dry', posCategory: 'BTN', isAgg: 'agg', isIP: 'ip',
      facingAction: 'bet', contextAction: null, preflopAggressor: true,
      sprBand: 'medium', closesAction: 'false', sBucket: '33-66',
      gameType: 'cash', seats: 2, stackDepthBB: 100,
    };
    const a = evaluateCard(original, situation);
    const b = evaluateCard(rebuilt.descriptor.card, situation);
    expect(a.abstained).toBe(false);
    expect(a.ruleId).toBe('r2-size-33-66');
    expect(b).toEqual(a);
  });
});
