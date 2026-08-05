/**
 * entryEvaluatorGuard.test.js — WS-375.
 *
 * `entryEvaluator.mjs` loaded the SHIPPED, ALL-CORPUS reference table outside any
 * `LeakageGuard`, while the five other scoring entry points in `scripts/backtest/`
 * each construct one. THERE WAS NO LEAK: the evaluator scores no corpus hand, so no
 * published number was contaminated and no Result Card needs re-stamping. The defect
 * was that the safety was circumstantial — clean because of what the file happened to
 * do, with nothing in it that a future change could trip.
 *
 * Two things are asserted here, and they are different:
 *
 *   1. The evaluator REFUSES to open without an explicit reference declaration. This
 *      fails against HEAD, where `openEntryEvaluator` took no such argument.
 *   2. The SWEEP: no module under `scripts/backtest/` may reach the corpus-derived
 *      artifacts directly unless it is on an explicit, reasoned list. That is the half
 *      that generalises — a guard you can walk around is not a guard, and the list is
 *      the map the ticket asked for rather than a promise that someone looked.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { openEntryEvaluator } from '../backtest/entryEvaluator.mjs';
import { LeakageError, REFERENCE_DISABLED } from '../backtest/leakageGuard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BACKTEST = join(HERE, '..', 'backtest');

describe('WS-375 — the entry evaluator cannot open without declaring its reference', () => {
  // The guard is constructed BEFORE the Vite loader, so these reject without loading
  // any engine module — the refusal is the first thing that happens, as it must be.

  it('REFUSES an absent declaration', async () => {
    // FAILS AGAINST HEAD: `openEntryEvaluator` had no `reference` parameter at all, so
    // this call opened a fully working evaluator over the all-corpus table.
    await expect(openEntryEvaluator({
      stakeBB: 0.5, seatBucket: '6max', flopSamples: 1, mcReplicates: 1,
    })).rejects.toThrow(LeakageError);
  });

  it('REFUSES an unstamped table passed as the declaration', async () => {
    await expect(openEntryEvaluator({
      stakeBB: 0.5, seatBucket: '6max', flopSamples: 1, mcReplicates: 1,
      reference: { stakes: [{ bb: 0.5 }] },
    })).rejects.toThrow(/not stamped/);
  });

  it('REFUSES "none" — it needs the corpus Field, and must say so rather than deny it', async () => {
    // The tempting shortcut. REFERENCE_DISABLED would construct fine and then fail at
    // `fieldTable`, which is the correct order: a run cannot claim to use no reference
    // and then read the corpus-wide aggregates.
    await expect(openEntryEvaluator({
      stakeBB: 0.5, seatBucket: '6max', flopSamples: 1, mcReplicates: 1,
      reference: REFERENCE_DISABLED,
    })).rejects.toThrow(/only a run that declares/i);
    // Explicit timeout: this case is the one that actually loads the corpus table before
    // refusing, ~3.3s in isolation. That is 65% of the 5000ms default, so it tips over
    // under full-suite load and reads as a regression it isn't (the WS-379 pattern).
  }, 30000);
});

// =============================================================================
// THE SWEEP — every reach for a corpus-derived artifact, named
// =============================================================================

/**
 * The corpus-derived modules. Reaching for either of these from a backtest script is
 * the access pattern the guard exists to mediate.
 */
const CORPUS_ARTIFACTS = ['handhqReferencePool.js', 'poolBaseline.js'];

/**
 * Modules permitted to reach a corpus artifact directly, each with what it does with it
 * and whether a guard binds. Adding a module here is a deliberate, reviewable edit; NOT
 * adding it makes the test fail. That is the enforcement — something a future change
 * trips, rather than something a future author recalls.
 */
const ALLOWED = {
  'entryEvaluator.mjs':
    'Field only. Obtains the rows through guard.fieldTable() under REFERENCE_FIELD_CORPUS; '
    + 'scores no corpus hand, and every scoring assertion on that guard refuses. GUARDED.',
  'runner.mjs':
    'Imports canonicalStakeLabel only — a pure string function, no corpus data. '
    + 'Scores corpus hands, and constructs a LeakageGuard at :485. GUARDED.',
  'statPriorScore.mjs':
    'Imports STAT_COUNT_FIELDS and resolveStatPriors — logic, not data. The reference '
    + 'table it resolves against is passed in by runner.mjs from guard.referenceTable. GUARDED.',
  'run-strategy-profile.mjs':
    'Reads HANDHQ_REFERENCE_STAKES for pool VPIP/PFR to compare a declared strategy '
    + 'against. Scores NO corpus hands — it reads an entry-map artifact. UNGUARDED: same '
    + 'shape as the WS-375 defect, filed rather than fixed here to stay in scope.',
};

describe('WS-375 sweep — direct reaches for corpus-derived artifacts are enumerated', () => {
  const files = readdirSync(BACKTEST).filter(f => f.endsWith('.mjs'));

  const reachers = files.filter((f) => {
    const src = readFileSync(join(BACKTEST, f), 'utf8');
    // Real reaches only: an ESM import or a loader.load of the module path. Prose
    // mentions in comments (leakageGuard, partition, mine-pool-reference) are not access.
    return CORPUS_ARTIFACTS.some(a => new RegExp(
      `(from\\s+['"][^'"]*${a.replace('.', '\\.')}['"]|load\\(\\s*['"][^'"]*${a.replace('.', '\\.')}['"])`,
    ).test(src));
  });

  it('every module reaching a corpus artifact is on the list, with its reason', () => {
    const unlisted = reachers.filter(f => !ALLOWED[f]);
    expect(unlisted).toEqual([]);
  });

  it('the list has no stale entries — a module that stopped reaching must be removed', () => {
    const stale = Object.keys(ALLOWED).filter(f => !reachers.includes(f));
    expect(stale).toEqual([]);
  });

  it('the entry evaluator now references the guard, which was the whole finding', () => {
    const src = readFileSync(join(BACKTEST, 'entryEvaluator.mjs'), 'utf8');
    expect(src).toContain('LeakageGuard');
    expect(src).toContain('guard.fieldTable(');
  });

  it('both entry-map runners declare a reference mode', () => {
    for (const f of ['run-entry-map.mjs', 'run-entry-suit-pass.mjs']) {
      expect(readFileSync(join(BACKTEST, f), 'utf8')).toContain('REFERENCE_FIELD_CORPUS');
    }
  });
});
