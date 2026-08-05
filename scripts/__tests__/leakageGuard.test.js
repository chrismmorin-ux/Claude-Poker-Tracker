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
  REFERENCE_FIELD_CORPUS,
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

describe('LeakageGuard — channel 2: walk-forward over a scored STAT WINDOW', () => {
  // WS-284. The stat-prior instrument scores a window of hands rather than a
  // single decision, and it is the ONLY scored output the reference table can
  // reach — so the ordering rule has to hold here too, or channel 1's whole
  // defence has a hole exactly where it finally matters.
  const guard = () => new LeakageGuard({ reference: cleanReference() });

  it('admits a window that starts at the end of the training prefix', () => {
    expect(guard().assertStatWindow({ playerId: evalPlayer, trainEndIdx: 15, handIdx: 15 }))
      .toBe(true);
  });

  it('REFUSES a window that overlaps the hands the belief was formed from', () => {
    expect(() => guard().assertStatWindow({ playerId: evalPlayer, trainEndIdx: 15, handIdx: 14 }))
      .toThrow(/had already seen/);
  });

  it('REFUSES non-integer indices rather than coercing them', () => {
    expect(() => guard().assertStatWindow({ playerId: evalPlayer, trainEndIdx: 15, handIdx: null }))
      .toThrow(/must be integers/);
  });

  it('counts stat windows SEPARATELY from decisions', () => {
    // Folding them into decisionsChecked would make the integrity report
    // overstate how many decisions the run actually scored.
    const g = guard();
    g.assertWalkForward({ playerId: evalPlayer, trainEndIdx: 15, handIdx: 20 });
    g.assertStatWindow({ playerId: evalPlayer, trainEndIdx: 15, handIdx: 15 });
    g.assertStatWindow({ playerId: evalPlayer, trainEndIdx: 25, handIdx: 25 });
    expect(g.summary().decisionsChecked).toBe(1);
    expect(g.summary().statWindowsChecked).toBe(2);
  });
});

describe('LeakageGuard — integrity report', () => {
  // WHICH CHANNEL DO THESE 19 TESTS GUARD? (WS-284 asked, and the honest answer
  // for WS-273's lifetime was "none that any reported number depended on" — the
  // villain-action scorecard was bit-identical with and without a reference
  // table.) They are RE-POINTED, not deleted: the reference table's live consumer
  // in this harness is now the WS-284 stat-prior scorecard, which moves when the
  // table changes and would move further if the table were mined from the players
  // it scores. `statPriorScore.assertReferenceTierLive` fails any run in which
  // that stops being true, so the guard cannot drift back into ceremony unnoticed.
  it('embeds enough to prove the run was clean', () => {
    const g = new LeakageGuard({ reference: cleanReference() });
    g.assertEvalPlayer(evalPlayer);
    g.assertWalkForward({ playerId: evalPlayer, trainEndIdx: 15, handIdx: 20 });
    g.assertStatWindow({ playerId: evalPlayer, trainEndIdx: 15, handIdx: 15 });
    expect(g.summary()).toEqual({
      poolPct: DEFAULT_POOL_PCT,
      referenceMode: 'pool-train',
      evalPlayersChecked: 1,
      decisionsChecked: 1,
      statWindowsChecked: 1,
      // WS-375: zero in a scoring run — this run consumed no all-corpus Field table.
      fieldSourceId: null,
      fieldRowsExposed: 0,
    });
  });
});

// =============================================================================
// WS-375 — the guard binds on the entry evaluator, structurally
// =============================================================================

/**
 * STATE THIS FIRST SO NOBODY READS IT AS A RETRACTION: there was no leak. The entry
 * evaluator scores no corpus hand and never did, so no published number was
 * contaminated, no Result Card needs re-stamping, and the fault register gains no
 * confirmed entry. What was wrong is that the safety rested on what the file happened
 * to do rather than on anything that could fail — and the extension that would break it
 * ("what did the field actually DO?") is the obvious next one.
 *
 * These tests are the bite: they assert the refusals, not the permission.
 */
describe('WS-375 — the all-corpus Field declaration', () => {
  const CORPUS_ROWS = [{ bb: 0.5, canonical: '0.25-0.5', minedLabel: '50NLH', buckets: {} }];

  it('is a distinct declaration from "no reference at all"', () => {
    // Collapsing the two would hide the one that needs watching.
    expect(validateReferenceTable(REFERENCE_FIELD_CORPUS).mode).toBe('field-corpus');
    expect(validateReferenceTable(REFERENCE_DISABLED).mode).toBe('disabled');
    expect(REFERENCE_FIELD_CORPUS).not.toBe(REFERENCE_DISABLED);
  });

  it('does NOT expose the corpus rows on the PRIOR channel', () => {
    // `referenceTable` is what a model shrinks toward. A Field is not that.
    const g = new LeakageGuard({ reference: REFERENCE_FIELD_CORPUS });
    expect(g.referenceTable).toBeNull();
  });

  it('hands out the corpus rows ONLY through fieldTable, and only under the declaration', () => {
    const g = new LeakageGuard({ reference: REFERENCE_FIELD_CORPUS });
    expect(g.fieldTable(CORPUS_ROWS, { sourceId: 'SRC-011' })).toHaveLength(1);
    expect(g.summary().fieldSourceId).toBe('SRC-011');
    expect(g.summary().fieldRowsExposed).toBe(1);

    for (const reference of [REFERENCE_DISABLED, cleanReference()]) {
      const other = new LeakageGuard({ reference });
      expect(() => other.fieldTable(CORPUS_ROWS)).toThrow(LeakageError);
      expect(() => other.fieldTable(CORPUS_ROWS)).toThrow(/only a run that declares/i);
    }
  });

  it('REFUSES every corpus-hand-scoring assertion under the declaration', () => {
    // THE BITE. A future change that starts scoring corpus hands writes one of these
    // three calls — every other scoring entry point in this directory does — and it
    // fails loudly instead of producing a scorecard indistinguishable from a clean one.
    const g = new LeakageGuard({ reference: REFERENCE_FIELD_CORPUS });
    expect(() => g.assertEvalPlayer(evalPlayer)).toThrow(LeakageError);
    expect(() => g.assertWalkForward({ playerId: evalPlayer, trainEndIdx: 0, handIdx: 5 }))
      .toThrow(/declared the SHIPPED all-corpus table as its Field/);
    expect(() => g.assertStatWindow({ playerId: evalPlayer, trainEndIdx: 0, handIdx: 5 }))
      .toThrow(/Re-declare with a POOL-partition table/);
    // And it stays refused for an EVAL player — the partition does not rescue it, because
    // the shipped table was mined from EVAL players too.
    expect(g.summary().decisionsChecked).toBe(0);
    expect(g.summary().statWindowsChecked).toBe(0);
  });

  it('an empty Field table is refused like any other', () => {
    const g = new LeakageGuard({ reference: REFERENCE_FIELD_CORPUS });
    expect(() => g.fieldTable([])).toThrow(/no stake rows/);
  });
});
