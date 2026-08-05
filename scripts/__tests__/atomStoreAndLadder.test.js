/**
 * atomStoreAndLadder.test.js — WS-328.
 *
 * Three mechanisms, each of which is only worth anything because it REFUSES:
 *
 *   atomStore        an atom set is append-only and content-addressed, and a Result Card whose
 *                    atoms are gone says so rather than resolving to an empty list — a missing
 *                    store and a run with no decisions must not produce the same confident zero.
 *   atomsSelfCheck   a captured field with no reader FAILS the check. This is the enforcement
 *                    of the anti-rot rule, and it is what stops the atom store becoming the
 *                    next predictionAudit.
 *   ladder           two cards on different Deal Books are two numbers about different hands,
 *                    and a fragmented ladder is visually indistinguishable from a sound one.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  openAtomWriter, resolveAtomSet, assertAtomsResolvable, readCompressed,
  RESOLVE_FAILURES, AtomStoreError,
} from '../backtest/atomStore.mjs';
import {
  atomsSelfCheck, assertAtomsSelfCheck, missingReaders, ATOM_READERS, MANIFEST_READERS,
} from '../backtest/atomsSelfCheck.mjs';
import {
  buildLadder, assertComparable, rebaseLadder, ladderProblems, LadderRefusal,
} from '../backtest/ladder.mjs';
import { buildDecisionAtom, buildAtomSetManifest } from '../../src/utils/standardOfRecord/decisionAtom.js';
import { SOR_SCHEMAS } from '../../src/utils/standardOfRecord/schemas.js';

let root;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'ws328-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

const atom = (i) => buildDecisionAtom({
  atomId: `H${i}#0@3`,
  situationKey: 'preflop:na:MIDDLE:false:false:none:na',
  carried: { source: 'SRC-012' },
  surfaceId: 'read:test',
  action: { fold: 0.4, call: 0.6 },
  ruleId: null,
  warrant: null,
  outcome: { observedAction: 'call' },
  seeds: { deal: i },
  actorSeat: 3,
  actorRole: 'villain',
});

const writeSet = async (atomSetId, n) => {
  const w = await openAtomWriter({ atomSetId, root, surfaceId: 'read:test', anchorGeneration: 1 });
  for (let i = 0; i < n; i += 1) await w.append(atom(i));
  return w.finalize({ seatOccupancy: [{ seat: 3, playerId: 'p', joinedAtHand: 1, leftAtHand: 9, handsSeated: 8 }] });
};

describe('atomStore — append-only, content-addressed, outside git', () => {
  it('resolves a finalized set by hash and round-trips the compressed sidecar', async () => {
    const m = await writeSet('set-a', 5);
    expect(m.atomSetHash).toMatch(/^sha256:/);

    const out = await resolveAtomSet(m.atomSetHash, { root });
    expect(out.resolved).toBe(true);
    expect(out.atoms).toHaveLength(5);
    expect(await readCompressed('set-a', { root })).toHaveLength(5);
  });

  it('refuses to reopen a finalized set — the hash a card recorded must keep describing it', async () => {
    await writeSet('set-b', 2);
    await expect(openAtomWriter({ atomSetId: 'set-b', root, surfaceId: 'x' }))
      .rejects.toThrow(/already finalized/);
  });

  it('refuses a duplicate atomId rather than double-counting a decision', async () => {
    const w = await openAtomWriter({ atomSetId: 'set-c', root, surfaceId: 'x' });
    await w.append(atom(1));
    await expect(w.append(atom(1))).rejects.toThrow(/duplicate atomId/);
  });

  it('reports WHY a hash did not resolve — never an empty list', async () => {
    const miss = await resolveAtomSet('sha256:deadbeef', { root });
    expect(miss.resolved).toBe(false);
    expect(miss.reason).toBe(RESOLVE_FAILURES.NOT_FOUND);
    expect(miss.atoms).toEqual([]);
  });

  it('detects a tampered set as a HASH MISMATCH rather than serving it', async () => {
    const m = await writeSet('set-d', 3);
    const path = join(root, 'set-d', 'atoms.ndjson');
    const text = await readFile(path, 'utf8');
    await writeFile(path, text.replace('"call":0.6', '"call":0.9'), 'utf8');

    const out = await resolveAtomSet(m.atomSetHash, { root });
    expect(out.resolved).toBe(false);
    expect(out.reason).toBe(RESOLVE_FAILURES.HASH_MISMATCH);
  });

  it('assertAtomsResolvable throws with the reason when a card outlives its atoms', async () => {
    const card = { resultCardId: 'RC-1', atomSetHash: 'sha256:gone', atomCount: 3 };
    await expect(assertAtomsResolvable(card, { root }))
      .rejects.toThrow(/did not resolve: atom-set-not-found/);
    // A card with NO hash is a different failure and says so: the card is still a valid
    // anchor, it just cannot be re-questioned.
    await expect(assertAtomsResolvable({ resultCardId: 'RC-2' }, { root }))
      .rejects.toThrow(/carries no atomSetHash/);
  });

  it('refuses a card whose declared atomCount disagrees with the store', async () => {
    const m = await writeSet('set-e', 4);
    await expect(assertAtomsResolvable(
      { resultCardId: 'RC-3', atomSetHash: m.atomSetHash, atomCount: 40 }, { root },
    )).rejects.toThrow(AtomStoreError);
  });
});

describe('atomsSelfCheck — a captured field without a reader FAILS', () => {
  it('has a reader for every field the Decision Atom schema declares', () => {
    expect(missingReaders()).toEqual([]);
  });

  it('fails when a field is added to the schema without a reader', () => {
    // Simulates the next author appending a field and forgetting the query. The check is a
    // schema DIFF, so this is detected mechanically rather than by anyone remembering.
    const smuggled = { name: 'newFieldNobodyReads', type: 'string|null', since: 3, required: false, note: 'x' };
    const atomSchema = [...SOR_SCHEMAS.decisionAtom, smuggled];

    expect(missingReaders({ atomSchema })).toEqual(['decisionAtom.newFieldNobodyReads']);
    expect(() => assertAtomsSelfCheck([], null, { atomSchema }))
      .toThrow(/captured fields with NO reader/);
    expect(atomsSelfCheck([], null, { atomSchema }).ok).toBe(false);
  });

  it('runs every reader and reports the depth mix rather than a boolean', async () => {
    const m = await writeSet('set-f', 6);
    const { atoms } = await resolveAtomSet(m.atomSetHash, { root });
    const setManifest = buildAtomSetManifest({
      atomSetId: 'set-f', surfaceId: 'read:test', atomCount: m.atomCount,
      seatOccupancy: m.seatOccupancy, anchorGeneration: 1,
    });
    const out = assertAtomsSelfCheck(atoms, setManifest);

    expect(out.ok).toBe(true);
    expect(out.reports).toHaveLength(ATOM_READERS.length + MANIFEST_READERS.length);
    expect(out.depthMix.inferential).toBeGreaterThan(0);
    expect(out.depthMix.descriptive).toBeGreaterThan(0);

    // The readers actually READ: an inferential one reports a real number, not a presence flag.
    const action = out.reports.find((r) => r.field === 'action');
    expect(action.value.scored).toBe(6);
    expect(action.value.conditional).toMatch(/P\(distribution emitted/);
    const occ = out.reports.find((r) => r.field === 'seatOccupancy');
    expect(occ.value.medianHandsSeated).toBe(8);
  });
});

describe('ladder — refuses across unrebased generations, rebases rather than resets', () => {
  const card = (id, generation, value, book, surfaceId = 'surface:A') => ({
    resultCardId: id,
    anchorGeneration: generation,
    match: { surfaceId, dealBookId: `db-${generation}`, fieldId: 'f' },
    metrics: { score: value },
    admissibility: { admissible: true },
    manifest: { dealBookHash: book, engineCommit: 'abc' },
  });

  it('REFUSES to compare two cards on different Deal Books', () => {
    expect(() => assertComparable(card('a', 1, 1, 'sha256:1'), card('b', 2, 2, 'sha256:2')))
      .toThrow(LadderRefusal);
  });

  it('refuses a card that does not name its generation — the refusal would be unenforceable', () => {
    const orphan = { ...card('c', 1, 1, 'sha256:1'), anchorGeneration: null };
    expect(() => assertComparable(orphan, card('a', 1, 1, 'sha256:1'))).toThrow(/anchorGeneration/);
  });

  it('refuses two cards claiming one generation but standing on different books', () => {
    expect(() => assertComparable(card('a', 1, 1, 'sha256:1'), card('b', 1, 2, 'sha256:9')))
      .toThrow(/generation number is a label; the hash is the fact/);
  });

  it('reports a RESET as a problem, and a REBASE as clean', async () => {
    const g1 = [card('a1', 1, 0.5, 'sha256:1'), card('b1', 1, 0.4, 'sha256:1', 'surface:B')];
    const ladder1 = buildLadder({ cards: g1, metricPath: 'metrics.score' });
    expect(ladder1.generations[0].ranked[0].rungId).toBe('surface:A');

    // A rebase that re-runs EVERY rung: the ladder keeps both rungs at generation 2.
    const rebased = await rebaseLadder({
      ladder: ladder1,
      toGeneration: 2,
      dealBookHash: 'sha256:2',
      cards: g1,
      rerun: async (rungId) => card(`${rungId}-g2`, 2, rungId === 'surface:A' ? 0.45 : 0.6, 'sha256:2', rungId),
    });
    expect(ladderProblems(rebased.ladder)).toEqual([]);
    expect(rebased.ladder.generations).toHaveLength(2);
    expect(rebased.ladder.generations[1].ranked.map((r) => r.rungId).sort())
      .toEqual(['surface:A', 'surface:B']);
    // Rebased, not reset — and the ORDER changed, which is the finding a rebase preserves the
    // ability to see. A reset would have destroyed the comparison instead.
    expect(rebased.ladder.generations[1].ranked[0].rungId).toBe('surface:B');

    // A rebase that skips a rung FRAGMENTS the ladder, and the problem is named.
    const partial = await rebaseLadder({
      ladder: ladder1,
      toGeneration: 2,
      dealBookHash: 'sha256:2',
      cards: g1,
      rerun: async (rungId) => {
        if (rungId === 'surface:B') throw new Error('re-run skipped');
        return card('a2', 2, 0.45, 'sha256:2', rungId);
      },
    });
    expect(partial.failures).toEqual([{ rungId: 'surface:B', error: 're-run skipped' }]);
    expect(partial.rebase.failedRungIds).toEqual(['surface:B']);
    expect(ladderProblems(partial.ladder).join(' ')).toMatch(/FRAGMENTS the Ladder/);
  });

  it('refuses a generation number that goes backwards or repeats', async () => {
    const ladder1 = buildLadder({ cards: [card('a1', 2, 0.5, 'sha256:1')], metricPath: 'metrics.score' });
    await expect(rebaseLadder({ ladder: ladder1, toGeneration: 2, dealBookHash: 'x', rerun: async () => null }))
      .rejects.toThrow(/must be above the current/);
  });
});
