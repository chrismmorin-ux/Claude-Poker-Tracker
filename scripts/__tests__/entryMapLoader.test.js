/**
 * entryMapLoader.test.js — WS-323. What the loader refuses, and what it recomputes.
 *
 * Two distinct claims are checked here and they fail in opposite directions:
 *
 *   REFUSAL — a map that does not name the quantity it measured is not a slightly-worse map,
 *     it is a grid of numbers with unknown units. Entry EV is conditional on the continuation
 *     policy, so an unstamped map cannot be compared to a stamped one, and the way that goes
 *     wrong is that somebody compares them anyway and reads the difference as progress.
 *
 *   RECOMPUTATION — τ is a REPORTING parameter. If the loader trusted the band written in the
 *     file, two maps written at different τ would show every borderline cell "migrating",
 *     movement manufactured entirely by a presentational setting.
 */

import { describe, it, expect } from 'vitest';

import {
  BANDS,
  EntryMapError,
  loadEntryMap,
  tCritical,
  combineInterval,
} from '../backtest/entryMap.mjs';

/** A cell with a real interval. `halfWidth` drives lower/upper so they cannot disagree. */
const cellAt = (cellId, margin, halfWidth, over = {}) => {
  const [handClass, posCategory, facingAction] = cellId.split('|');
  return {
    cellId, handClass, posCategory, facingAction,
    reachable: true, degenerate: false, bestAction: 'bet',
    margin, halfWidth, mcError: halfWidth / 2, modelError: halfWidth / 2,
    lower: margin - halfWidth, upper: margin + halfWidth,
    band: 'STALE-BAND-FROM-FILE',
    ...over,
  };
};

const mapOf = (cells, over = {}) => ({
  schemaVersion: 1,
  continuationPolicy: { id: 'cp-test-v1' },
  engineCommit: 'abcdef1234567890',
  engineDirty: false,
  reporting: { tauBB: 0.25 },
  domain: { gameType: 'cash', seats: [6, 9], stackDepthBB: [80, 200] },
  counts: { byBand: { 'nonsense-from-file': 99 } },
  cells,
  ...over,
});

describe('the loader refuses a map that names no quantity', () => {
  it('refuses a map with no continuation policy', () => {
    const map = mapOf([cellAt('AA|EARLY|none', 1, 0.1)]);
    delete map.continuationPolicy;
    expect(() => loadEntryMap(map)).toThrow(EntryMapError);
    expect(() => loadEntryMap(map)).toThrow(/continuation policy/i);
  });

  it('refuses a policy stamp with no id — an object is not a name', () => {
    const map = mapOf([cellAt('AA|EARLY|none', 1, 0.1)], { continuationPolicy: { module: 'x.js' } });
    expect(() => loadEntryMap(map)).toThrow(/continuation policy/i);
  });

  it('refuses a map with no engine commit', () => {
    // The policy id names WHICH strategy; the commit names the code that implemented it, and
    // two generations of the same policy are told apart by nothing else.
    const map = mapOf([cellAt('AA|EARLY|none', 1, 0.1)], { engineCommit: '' });
    expect(() => loadEntryMap(map)).toThrow(/engine commit/i);
  });

  it('refuses a map that does not record the τ its bands were written at', () => {
    const map = mapOf([cellAt('AA|EARLY|none', 1, 0.1)], { reporting: {} });
    expect(() => loadEntryMap(map)).toThrow(/τ/);
  });

  it('refuses a schema version it does not understand rather than duck-typing it', () => {
    const map = mapOf([cellAt('AA|EARLY|none', 1, 0.1)], { schemaVersion: 99 });
    expect(() => loadEntryMap(map)).toThrow(/schemaVersion 99/);
  });

  it('refuses a cell carrying a bare point estimate', () => {
    // "Near zero" and "we cannot tell" are different facts and only the interval separates
    // them, so a margin without one is not a weaker cell — it is an unanswerable one.
    const bare = cellAt('AA|EARLY|none', 0.4, 0.1);
    delete bare.halfWidth;
    expect(() => loadEntryMap(mapOf([bare]))).toThrow(/halfWidth/);
  });

  it('refuses a cell with no cellId, because the migration report joins on it', () => {
    const anon = cellAt('AA|EARLY|none', 0.4, 0.1);
    delete anon.cellId;
    expect(() => loadEntryMap(mapOf([anon]))).toThrow(/cellId/);
  });

  it('refuses an empty map', () => {
    expect(() => loadEntryMap(mapOf([]))).toThrow(/no cells/);
  });
});

describe('cells that legitimately carry no number are let through', () => {
  it('accepts unreachable cells without an interval, and bands them null', () => {
    // UTG facing a raise cannot occur. It is enumerated so the denominator stays honest, not
    // so it can be read — demanding an interval would force the map to fabricate one.
    const unreachable = {
      cellId: 'AA|EARLY|raise', handClass: 'AA', posCategory: 'EARLY', facingAction: 'raise',
      reachable: false, unreachableReason: 'utg-acts-first', margin: null,
    };
    const out = loadEntryMap(mapOf([unreachable, cellAt('AA|LATE|none', 1, 0.1)]));
    expect(out.cells[0].band).toBeNull();
    expect(out.counts.byBand.unreachable).toBe(1);
  });

  it('accepts a degenerate cell — no entry action is a real state, not an EV of zero', () => {
    const degenerate = {
      cellId: '32o|SB|raise', handClass: '32o', posCategory: 'SB', facingAction: 'raise',
      reachable: true, degenerate: true, margin: null,
    };
    const out = loadEntryMap(mapOf([degenerate, cellAt('AA|LATE|none', 1, 0.1)]));
    expect(out.cells[0].band).toBeNull();
    expect(out.counts.byBand.degenerate).toBe(1);
  });
});

describe('bands are recomputed, never read from the file', () => {
  it('ignores the band written in the artifact', () => {
    const out = loadEntryMap(mapOf([cellAt('AA|EARLY|none', 1.5, 0.1)]));
    expect(out.cells[0].band).toBe(BANDS.CLEAR_PLUS);
    expect(out.cells[0].band).not.toBe('STALE-BAND-FROM-FILE');
  });

  it('moving τ moves the band and leaves the margin untouched', () => {
    const straddling = cellAt('76s|LATE|raise', 0.0, 0.4);
    const tight = loadEntryMap(mapOf([straddling]), { tauBB: 0.5 });
    const wide = loadEntryMap(mapOf([straddling]), { tauBB: 0.25 });

    expect(tight.cells[0].band).toBe(BANDS.FRINGE_TIGHT);
    expect(wide.cells[0].band).toBe(BANDS.UNMEASURED);
    // The number itself is a measurement; only the label is a reporting choice.
    expect(tight.cells[0].margin).toBe(wide.cells[0].margin);
  });

  it('defaults to the map\'s own τ so a caller cannot silently re-band by omission', () => {
    const out = loadEntryMap(mapOf([cellAt('76s|LATE|raise', 0, 0.4)], { reporting: { tauBB: 0.5 } }));
    expect(out.reporting.tauBB).toBe(0.5);
    expect(out.cells[0].band).toBe(BANDS.FRINGE_TIGHT);
  });

  it('recomputes counts.byBand so the map cannot contradict itself', () => {
    const out = loadEntryMap(mapOf([
      cellAt('AA|EARLY|none', 1.5, 0.1),
      cellAt('72o|EARLY|none', -1.5, 0.1),
      cellAt('76s|LATE|raise', 0, 0.05),
    ]));
    expect(out.counts.byBand).toEqual({
      [BANDS.CLEAR_PLUS]: 1, [BANDS.CLEAR_MINUS]: 1, [BANDS.FRINGE_TIGHT]: 1,
    });
    expect(out.counts.byBand['nonsense-from-file']).toBeUndefined();
  });

  it('records the τ the artifact was written at alongside the one it was banded at', () => {
    const out = loadEntryMap(mapOf([cellAt('AA|EARLY|none', 1, 0.1)]), { tauBB: 0.9 });
    expect(out.reporting.tauBB).toBe(0.9);
    expect(out.reporting.tauBBAsWritten).toBe(0.25);
    expect(out.warnings.join(' ')).toMatch(/recomputed at τ=0.9/);
  });
});

describe('a dirty tree is a warning, not a refusal', () => {
  it('loads, and says the map is not replicable', () => {
    const out = loadEntryMap(mapOf([cellAt('AA|EARLY|none', 1, 0.1)], { engineDirty: true }));
    expect(out.cells).toHaveLength(1);
    expect(out.warnings.join(' ')).toMatch(/not replicable/);
  });

  it('says nothing when the tree was clean', () => {
    const out = loadEntryMap(mapOf([cellAt('AA|EARLY|none', 1, 0.1)]));
    expect(out.warnings).toEqual([]);
  });
});

describe('the interval corrects for an sd estimated from very few replicates', () => {
  it('uses Student-t on the MC term, so 4 replicates do not claim a known sd\'s precision', () => {
    // An sd from 4 draws is itself wildly uncertain and is small by luck a real fraction of the
    // time. Multiplying it by z = 1.96 produced cells whose interval was near-zero-width by
    // accident, which the loader then labelled `clear+` — a confident rule resting on nothing,
    // in exactly the band this map exists to keep honest.
    expect(tCritical(3)).toBeCloseTo(3.182, 3);
    expect(tCritical(3)).toBeGreaterThan(1.96);
  });

  it('converges on the normal multiplier once the sd is actually well estimated', () => {
    expect(tCritical(500)).toBe(1.96);
  });

  it('widens the MC contribution but leaves the sweep at z', () => {
    // The Field quantiles are three deliberately chosen points, not a sample whose sd is being
    // estimated. Applying t to them would borrow the arithmetic without the argument.
    const sweepOnly = combineInterval([1, 1, 1, 1], [-1, 0, 1]);
    expect(sweepOnly.mcError).toBe(0);
    expect(sweepOnly.halfWidth).toBeCloseTo(1.96, 6);

    const mcOnly = combineInterval([0, 2], [0.5]);
    // sd = √2, n = 2 → mcError = 1; df = 1 → t = 12.706
    expect(mcOnly.mcError).toBeCloseTo(1, 6);
    expect(mcOnly.halfWidth).toBeCloseTo(12.706, 3);
  });
});
