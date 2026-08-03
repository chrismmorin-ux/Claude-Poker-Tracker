/**
 * mergeEntryMap.test.js — WS-323. A merged map must be whole, or refuse to exist.
 *
 * Chunking exists because the map takes ~20 minutes and long processes are not always
 * survivable. The risk it introduces is specific: a merged file LOOKS whole. A gap in a chunked
 * run produces an artifact with a plausible cell count, a valid stamp, and a quietly smaller
 * denominator — and nothing downstream can distinguish cells that were never attempted from
 * cells that were computed and found unanswerable. That is the same conflation the Coverage
 * Census was built to prevent, arriving through the back door of a merge.
 *
 * So every check here is a refusal, and each one covers a way the merge could produce a map
 * that reads as complete when it is not.
 */

import { describe, it, expect } from 'vitest';

import { EntryMapError, BANDS } from '../backtest/entryMap.mjs';
import { mergeEntryMaps } from '../backtest/mergeEntryMap.mjs';

const cellAt = (i, margin = 1, halfWidth = 0.1) => ({
  cellId: `H${i}|EARLY|none`, handClass: `H${i}`, posCategory: 'EARLY', facingAction: 'none',
  reachable: true, degenerate: false, bestAction: 'bet',
  margin, halfWidth, mcError: 0.05, modelError: 0.05,
  lower: margin - halfWidth, upper: margin + halfWidth,
  band: margin - halfWidth > 0 ? BANDS.CLEAR_PLUS : BANDS.CLEAR_MINUS,
});

/** A chunk covering [from, to) of a `ofTotal`-cell enumeration. */
const chunk = (from, to, ofTotal = 6, over = {}) => ({
  schemaVersion: 1,
  continuationPolicy: { id: 'cp-test-v1' },
  engineCommit: 'aaaaaaaaaaaa',
  engineDirty: false,
  reporting: { tauBB: 0.25, mcReplicates: 6, flopSamplesPerArchetype: 6 },
  domain: { gameType: 'cash', seats: [6, 9], stackDepthBB: [80, 200] },
  slice: { from, to, ofTotal },
  cells: Array.from({ length: to - from }, (_, k) => cellAt(from + k)),
  ...over,
});

describe('a chunked map is reassembled or refused, never patched', () => {
  it('merges contiguous chunks into the whole enumeration', () => {
    const merged = mergeEntryMaps([chunk(0, 3), chunk(3, 6)]);
    expect(merged.cells).toHaveLength(6);
    expect(merged.cells.map((c) => c.cellId)).toEqual(['H0', 'H1', 'H2', 'H3', 'H4', 'H5'].map((h) => `${h}|EARLY|none`));
    expect(merged.counts.cells).toBe(6);
  });

  it('does not care what order the chunks arrive in', () => {
    const merged = mergeEntryMaps([chunk(3, 6), chunk(0, 3)]);
    expect(merged.cells[0].cellId).toBe('H0|EARLY|none');
  });

  it('drops the slice marker, because the merged file is not a fragment', () => {
    const merged = mergeEntryMaps([chunk(0, 3), chunk(3, 6)]);
    expect(merged.slice).toBeUndefined();
    expect(merged.mergedFrom).toEqual([{ from: 0, to: 3 }, { from: 3, to: 6 }]);
  });

  it('recomputes the band counts from the merged cells', () => {
    const merged = mergeEntryMaps([chunk(0, 3), chunk(3, 6)]);
    expect(merged.counts.byBand[BANDS.CLEAR_PLUS]).toBe(6);
  });
});

describe('what the merge refuses', () => {
  it('refuses a gap — the failure that reads as a complete map', () => {
    expect(() => mergeEntryMaps([chunk(0, 2), chunk(4, 6)])).toThrow(EntryMapError);
    expect(() => mergeEntryMaps([chunk(0, 2), chunk(4, 6)])).toThrow(/\[2, 4\) are missing/);
  });

  it('refuses an overlap — one chunk must be from a different run', () => {
    expect(() => mergeEntryMaps([chunk(0, 4), chunk(2, 6)])).toThrow(/appear in more than one chunk/);
  });

  it('refuses a run that stopped early rather than presenting it as whole', () => {
    expect(() => mergeEntryMaps([chunk(0, 3)])).toThrow(/covers 3 of 6/);
  });

  it('refuses chunks from different engine commits', () => {
    // A stamp true of only some of a map's cells is the same as being false.
    expect(() => mergeEntryMaps([chunk(0, 3), chunk(3, 6, 6, { engineCommit: 'bbbbbbbbbbbb' })]))
      .toThrow(/engineCommit/);
  });

  it('refuses chunks computed under different continuation policies', () => {
    expect(() => mergeEntryMaps([chunk(0, 3), chunk(3, 6, 6, { continuationPolicy: { id: 'cp-other' } })]))
      .toThrow(/continuationPolicy.id/);
  });

  it('refuses chunks computed at different MC depth or τ', () => {
    expect(() => mergeEntryMaps([
      chunk(0, 3),
      chunk(3, 6, 6, { reporting: { tauBB: 0.25, mcReplicates: 2, flopSamplesPerArchetype: 6 } }),
    ])).toThrow(/mcReplicates/);
  });

  it('refuses chunks that enumerate different domains', () => {
    expect(() => mergeEntryMaps([chunk(0, 3, 6), chunk(3, 6, 9)])).toThrow(/domain itself changed/);
  });

  it('refuses a chunk carrying a different number of cells than it claims', () => {
    const short = chunk(3, 6);
    short.cells = short.cells.slice(0, 2);
    expect(() => mergeEntryMaps([chunk(0, 3), short])).toThrow(/claims cells \[3, 6\) but carries 2/);
  });

  it('refuses a chunk that does not say which slice it holds', () => {
    const anon = chunk(0, 6);
    delete anon.slice;
    expect(() => mergeEntryMaps([anon])).toThrow(/which slice/);
  });
});

describe('a dirty chunk makes the whole map dirty', () => {
  it('ORs the dirty flags rather than taking the first', () => {
    // One chunk of unstamped code is enough to make the map unreplicable; recording only the
    // first chunk's flag would let a mid-run edit vanish.
    const merged = mergeEntryMaps([chunk(0, 3), chunk(3, 6, 6, { engineDirty: true })]);
    expect(merged.engineDirty).toBe(true);
  });

  it('stays clean when every chunk was clean', () => {
    expect(mergeEntryMaps([chunk(0, 3), chunk(3, 6)]).engineDirty).toBe(false);
  });
});
