/**
 * leakageGuard.test.js — WS-273 acceptance gate.
 *
 * The ticket makes the leakage guard the acceptance criterion, not a note. These
 * tests are therefore adversarial: each one feeds the guard a run that IS leaking
 * and asserts it refuses. A guard that only passes clean input proves nothing.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  LeakageGuard,
  LeakageError,
  validateReferenceTable,
  REFERENCE_DISABLED,
  REQUIRED_PARTITION_STAMP,
} from '../backtest/leakageGuard.mjs';
import { partitionOf, GROUPS, DEFAULT_POOL_PCT } from '../backtest/partition.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(HERE, '..', 'backtest', 'fixtures', 'partition-vectors.json'), 'utf8'),
);

const evalPlayer = fixture.partitionVectors.find(v => v.group === GROUPS.EVAL).playerId;
const poolPlayer = fixture.partitionVectors.find(v => v.group === GROUPS.POOL).playerId;

const cleanReference = () => ({
  provenance: { partition: REQUIRED_PARTITION_STAMP, poolPct: DEFAULT_POOL_PCT },
  stakes: [{ bb: 1, canonical: '0.5-1', buckets: {} }],
});

describe('validateReferenceTable', () => {
  it('accepts a correctly stamped POOL-partition table', () => {
    const out = validateReferenceTable(cleanReference());
    expect(out.mode).toBe('pool-train');
    expect(out.table).toHaveLength(1);
  });

  it('accepts an explicit request to disable the reference tier', () => {
    expect(validateReferenceTable(REFERENCE_DISABLED).mode).toBe('disabled');
  });

  it('REFUSES a run with no reference specified', () => {
    // This is the poisoned default. Falling back to the shipped table would
    // silently score the corpus against priors mined from that same corpus.
    expect(() => validateReferenceTable(null)).toThrow(LeakageError);
    expect(() => validateReferenceTable(undefined)).toThrow(/no reference table supplied/);
  });

  it('REFUSES an unstamped table', () => {
    expect(() => validateReferenceTable({ stakes: [{ bb: 1 }] }))
      .toThrow(/not stamped/);
  });

  it('REFUSES a table stamped with the wrong partition', () => {
    const poisoned = { provenance: { partition: 'full-corpus', poolPct: 50 }, stakes: [{ bb: 1 }] };
    expect(() => validateReferenceTable(poisoned)).toThrow(/not stamped/);
  });

  it('REFUSES a table mined at a different split than the run uses', () => {
    // Subtle and dangerous: the stamp is right but the EVAL set for a 70%
    // partition is NOT disjoint from the players that trained a 50% table.
    const mismatched = {
      provenance: { partition: REQUIRED_PARTITION_STAMP, poolPct: 50 },
      stakes: [{ bb: 1 }],
    };
    expect(() => validateReferenceTable(mismatched, 70)).toThrow(/would not be/);
  });

  it('REFUSES a stamped but empty table', () => {
    const empty = { provenance: { partition: REQUIRED_PARTITION_STAMP, poolPct: 50 }, stakes: [] };
    expect(() => validateReferenceTable(empty)).toThrow(/no stake rows/);
  });
});

describe('LeakageGuard — construction', () => {
  it('cannot be constructed without a valid reference decision', () => {
    expect(() => new LeakageGuard({})).toThrow(LeakageError);
  });

  it('records which reference mode the run used', () => {
    expect(new LeakageGuard({ reference: cleanReference() }).summary().referenceMode)
      .toBe('pool-train');
    expect(new LeakageGuard({ reference: REFERENCE_DISABLED }).summary().referenceMode)
      .toBe('disabled');
  });
});

describe('LeakageGuard — channel 1/3: partition', () => {
  const guard = () => new LeakageGuard({ reference: cleanReference() });

  it('admits an EVAL player', () => {
    expect(guard().assertEvalPlayer(evalPlayer)).toBe(true);
  });

  it('REFUSES to score a POOL player', () => {
    // The poisoned case: this player's hands trained the reference priors, so
    // scoring them measures memorisation.
    expect(() => guard().assertEvalPlayer(poolPlayer))
      .toThrow(/is in the pool partition/);
  });

  it('re-derives the group rather than trusting the caller', () => {
    // Guard must not accept an upstream claim about which group a player is in;
    // partition drift between the miner and the runner is its own leak channel.
    const g = guard();
    expect(partitionOf(poolPlayer)).toBe(GROUPS.POOL);
    expect(() => g.assertEvalPlayer(poolPlayer)).toThrow(LeakageError);
  });

  it('counts distinct players checked', () => {
    const g = guard();
    g.assertEvalPlayer(evalPlayer);
    g.assertEvalPlayer(evalPlayer);
    expect(g.summary().evalPlayersChecked).toBe(1);
  });
});

describe('LeakageGuard — channel 2: walk-forward', () => {
  const guard = () => new LeakageGuard({ reference: cleanReference() });

  it('admits a decision from a hand after the training prefix', () => {
    expect(guard().assertWalkForward({ playerId: evalPlayer, trainEndIdx: 15, handIdx: 15 }))
      .toBe(true);
    expect(guard().assertWalkForward({ playerId: evalPlayer, trainEndIdx: 15, handIdx: 40 }))
      .toBe(true);
  });

  it('REFUSES a decision from a hand the model already trained on', () => {
    // The poisoned case: predicting hand 10 with a model that saw hands 0-14.
    expect(() => guard().assertWalkForward({ playerId: evalPlayer, trainEndIdx: 15, handIdx: 10 }))
      .toThrow(/had already seen/);
  });

  it('REFUSES the boundary-off-by-one case', () => {
    // trainEndIdx is exclusive, so index 14 IS inside [0, 15) and must be rejected.
    expect(() => guard().assertWalkForward({ playerId: evalPlayer, trainEndIdx: 15, handIdx: 14 }))
      .toThrow(LeakageError);
  });

  it('REFUSES non-integer indices rather than coercing them', () => {
    expect(() => guard().assertWalkForward({ playerId: evalPlayer, trainEndIdx: '15', handIdx: 20 }))
      .toThrow(/must be integers/);
  });

  it('counts decisions checked', () => {
    const g = guard();
    for (let i = 20; i < 25; i++) {
      g.assertWalkForward({ playerId: evalPlayer, trainEndIdx: 15, handIdx: i });
    }
    expect(g.summary().decisionsChecked).toBe(5);
  });
});

describe('LeakageGuard — integrity report', () => {
  it('embeds enough to prove the run was clean', () => {
    const g = new LeakageGuard({ reference: cleanReference() });
    g.assertEvalPlayer(evalPlayer);
    g.assertWalkForward({ playerId: evalPlayer, trainEndIdx: 15, handIdx: 20 });
    expect(g.summary()).toEqual({
      poolPct: DEFAULT_POOL_PCT,
      referenceMode: 'pool-train',
      evalPlayersChecked: 1,
      decisionsChecked: 1,
    });
  });
});
