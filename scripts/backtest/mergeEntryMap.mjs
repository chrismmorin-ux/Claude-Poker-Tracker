/**
 * mergeEntryMap.mjs — WS-323. Reassemble a chunked map, and refuse a map with a hole in it.
 *
 * The map takes ~20 minutes to compute and long-running processes are not always survivable, so
 * `run-entry-map.mjs` accepts `--from`/`--to` and writes a slice. Because every cell's seeds
 * come from its index in the STABLE enumeration rather than from a counter of work done, a
 * chunk boundary changes no INPUT to any cell — a chunked map is the same measurement as a
 * single-pass one, differing only by the Monte Carlo noise that two single passes would differ
 * by anyway, and which every cell's interval already reports. It is NOT a claim that the two
 * files are identical; `monteCarloEquity` calls `Math.random()` and nothing here pretends
 * otherwise.
 *
 * What this module enforces is the part that CAN be checked: that the chunks are slices of one
 * run, and that together they cover the domain exactly once.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHAT THE MERGE REFUSES, AND WHY EACH ONE IS A REFUSAL RATHER THAN A WARNING
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * A GAP. If chunk 2 ends at cell 800 and chunk 3 starts at 850, the merged map is missing 50
 * cells — and nothing downstream can tell that from 50 cells that were computed and found
 * unanswerable. A coverage record whose denominator quietly excludes what it never attempted is
 * the precise failure the Coverage Census was built to prevent; letting it in through the back
 * door of a merge would be worse, because the merged file looks whole.
 *
 * AN OVERLAP. Two chunks claiming the same cell means one of them is from a different run, and
 * silently keeping either would produce a map that is a blend of two generations while
 * presenting as one.
 *
 * A STAMP MISMATCH. Chunks from different engine commits, policies, τ or MC depth are not
 * slices of one map at all. Merging them would produce an artifact whose stamp is true of some
 * of its cells — which is the same as being false.
 */

import { EntryMapError } from './entryMap.mjs';

/**
 * Fields every chunk must agree on for the merged file's stamp to mean anything.
 *
 * `engineDirty` is deliberately NOT here: a dirty flag differing across chunks would mean the
 * tree changed mid-run, which the OR below records rather than rejects — the merged map is
 * dirty if any chunk was, because one chunk of unstamped code is enough to make the whole map
 * unreplicable.
 */
const MUST_MATCH = [
  ['continuationPolicy.id', (m) => m.continuationPolicy?.id],
  ['engineCommit', (m) => m.engineCommit],
  ['reporting.tauBB', (m) => m.reporting?.tauBB],
  ['reporting.mcReplicates', (m) => m.reporting?.mcReplicates],
  ['reporting.flopSamplesPerArchetype', (m) => m.reporting?.flopSamplesPerArchetype],
];

export const mergeEntryMaps = (chunks) => {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new EntryMapError('nothing to merge');
  }

  const [head] = chunks;

  for (const [label, read] of MUST_MATCH) {
    const expected = read(head);
    for (const chunk of chunks) {
      if (read(chunk) !== expected) {
        throw new EntryMapError(
          `chunks disagree on ${label} (${String(expected)} vs ${String(read(chunk))}). These are ` +
          'not slices of one map; a merged stamp would be true of only some of its cells, which ' +
          'is the same as being false.',
          { field: label },
        );
      }
    }
  }

  const ofTotal = head.slice?.ofTotal;
  if (typeof ofTotal !== 'number') {
    throw new EntryMapError(
      'a chunk does not record which slice of the enumeration it holds, so completeness cannot ' +
      'be checked. Re-run it with a build that stamps `slice`.',
    );
  }

  // ── Completeness: every index covered exactly once ────────────────────────────────────────
  const ordered = [...chunks].sort((a, b) => (a.slice?.from ?? 0) - (b.slice?.from ?? 0));
  let cursor = 0;
  for (const chunk of ordered) {
    const { from, to, ofTotal: chunkTotal } = chunk.slice ?? {};
    if (chunkTotal !== ofTotal) {
      throw new EntryMapError(
        `a chunk enumerates ${chunkTotal} cells and another enumerates ${ofTotal}. The domain ` +
        'itself changed between runs, so these chunks describe different maps.',
      );
    }
    if (from > cursor) {
      throw new EntryMapError(
        `cells [${cursor}, ${from}) are missing from the merge. A map with a hole in it reads ` +
        'as one whose absent cells had no answer, and those are different facts — the same ' +
        'conflation the Coverage Census exists to prevent.',
        { missingFrom: cursor, missingTo: from },
      );
    }
    if (from < cursor) {
      throw new EntryMapError(
        `cells [${from}, ${cursor}) appear in more than one chunk. One of them is from a ` +
        'different run, and keeping either would blend two generations into one artifact.',
        { overlapFrom: from, overlapTo: cursor },
      );
    }
    if (to - from !== chunk.cells.length) {
      throw new EntryMapError(
        `a chunk claims cells [${from}, ${to}) but carries ${chunk.cells.length} of them.`,
      );
    }
    cursor = to;
  }
  if (cursor !== ofTotal) {
    throw new EntryMapError(
      `the merge covers ${cursor} of ${ofTotal} cells. Cells [${cursor}, ${ofTotal}) were never ` +
      'attempted, and a map that stopped early must not present as a complete one.',
      { covered: cursor, ofTotal },
    );
  }

  const cells = ordered.flatMap((c) => c.cells);

  const seen = new Set();
  for (const cell of cells) {
    if (seen.has(cell.cellId)) {
      throw new EntryMapError(`cell "${cell.cellId}" appears twice in the merge`, { cellId: cell.cellId });
    }
    seen.add(cell.cellId);
  }

  const unreachable = cells.filter((c) => c.reachable === false).length;
  const degenerate = cells.filter((c) => c.degenerate === true).length;

  return {
    ...head,
    generatedBy: 'scripts/backtest/mergeEntryMap.mjs',
    engineDirty: chunks.some((c) => c.engineDirty),
    // The merged file is whole, so it carries no slice. Leaving a stale one would say it was a
    // fragment of something larger.
    slice: undefined,
    mergedFrom: ordered.map((c) => ({ from: c.slice.from, to: c.slice.to })),
    counts: {
      cells: cells.length,
      unreachable,
      degenerate,
      evaluated: cells.length - unreachable - degenerate,
      byBand: cells.reduce((acc, c) => {
        const k = c.band ?? (c.reachable === false ? 'unreachable' : 'degenerate');
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {}),
    },
    cells,
  };
};
