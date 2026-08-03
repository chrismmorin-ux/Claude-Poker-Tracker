/**
 * fringeMigration.test.js — WS-323. The instrument must not manufacture movement.
 *
 * A migration report is the instrument that will be used to claim the engine got better. Every
 * test here is about a way it could produce that claim WITHOUT the engine having got better:
 * by joining different cells, by re-banding at a different τ, or by reading Monte Carlo noise
 * as a delta. A report that can do any of those is not conservative-but-usable — it is an
 * instrument that says yes when asked nicely, which is worse than no instrument.
 */

import { describe, it, expect } from 'vitest';

import { BANDS, EntryMapError } from '../backtest/entryMap.mjs';
import { COMPARISON_KINDS, compareEntryMaps, deltaOf, moversOf } from '../backtest/fringeMigration.mjs';

const cellAt = (cellId, margin, halfWidth) => {
  const [handClass, posCategory, facingAction] = cellId.split('|');
  return {
    cellId, handClass, posCategory, facingAction,
    reachable: true, degenerate: false, bestAction: 'bet',
    margin, halfWidth, mcError: halfWidth / 2, modelError: halfWidth / 2,
    lower: margin - halfWidth, upper: margin + halfWidth,
  };
};

const mapOf = (cells, over = {}) => ({
  schemaVersion: 1,
  continuationPolicy: { id: 'cp-test-v1' },
  engineCommit: 'aaaaaaaaaaaa',
  engineDirty: false,
  reporting: { tauBB: 0.25 },
  domain: { gameType: 'cash', seats: [6, 9], stackDepthBB: [80, 200] },
  cells,
  ...over,
});

describe('the join refuses rather than intersects', () => {
  it('refuses two maps that do not enumerate the same cells', () => {
    // An intersection would quietly drop exactly the cells the enumeration change was about,
    // and report migration over whatever happened to survive.
    const before = mapOf([cellAt('AA|EARLY|none', 1, 0.1), cellAt('KK|EARLY|none', 1, 0.1)]);
    const after = mapOf([cellAt('AA|EARLY|none', 1, 0.1)]);
    expect(() => compareEntryMaps(before, after)).toThrow(EntryMapError);
    expect(() => compareEntryMaps(before, after)).toThrow(/same cells/);
  });

  it('names which side the missing cells were on', () => {
    const before = mapOf([cellAt('AA|EARLY|none', 1, 0.1)]);
    const after = mapOf([cellAt('AA|EARLY|none', 1, 0.1), cellAt('QQ|LATE|none', 1, 0.1)]);
    expect(() => compareEntryMaps(before, after)).toThrow(/only in the later map/);
  });

  it('joins on identity, not on position in the array', () => {
    const a = cellAt('AA|EARLY|none', 1.0, 0.1);
    const b = cellAt('72o|EARLY|none', -1.0, 0.1);
    const report = compareEntryMaps(mapOf([a, b]), mapOf([b, a]));
    expect(report.headline.movedBand).toBe(0);
    expect(report.headline.measurableDeltas).toBe(0);
  });
});

describe('a reporting parameter cannot fake a migration', () => {
  it('produces zero migration when only τ differs between the two files', () => {
    // Both maps hold identical margins; one merely declares a different τ. Reading the stored
    // bands would show every borderline cell moving.
    const cells = [cellAt('76s|LATE|raise', 0, 0.4), cellAt('AA|EARLY|none', 1.5, 0.1)];
    const before = mapOf(cells, { reporting: { tauBB: 0.25 } });
    const after = mapOf(cells, { reporting: { tauBB: 0.9 } });

    const report = compareEntryMaps(before, after, { tauBB: 0.25 });
    expect(report.headline.movedBand).toBe(0);
    expect(report.headline.measurableDeltas).toBe(0);
  });

  it('bands BOTH maps at the caller\'s τ, not at each file\'s own', () => {
    const cells = [cellAt('76s|LATE|raise', 0, 0.4)];
    const report = compareEntryMaps(
      mapOf(cells, { reporting: { tauBB: 0.25 } }),
      mapOf(cells, { reporting: { tauBB: 0.9 } }),
      { tauBB: 0.5 },
    );
    expect(report.transitions[`${BANDS.FRINGE_TIGHT}→${BANDS.FRINGE_TIGHT}`]).toBe(1);
  });
});

describe('noise is not read as progress', () => {
  it('reports a delta smaller than its own interval as not measurable', () => {
    const d = deltaOf(
      { margin: 0.00, halfWidth: 0.30 },
      { margin: 0.20, halfWidth: 0.30 },
    );
    expect(d.delta).toBeCloseTo(0.2, 6);
    expect(d.halfWidth).toBeCloseTo(Math.sqrt(0.18), 6);
    expect(d.measurable).toBe(false);
  });

  it('reports a delta beyond its own interval as measurable', () => {
    const d = deltaOf(
      { margin: 0.0, halfWidth: 0.05 },
      { margin: 1.0, halfWidth: 0.05 },
    );
    expect(d.measurable).toBe(true);
  });

  it('combines the two half-widths in quadrature, not by addition', () => {
    // Adding independent errors would overstate the delta's uncertainty and under-report real
    // movement — the opposite failure, and no more honest.
    const d = deltaOf({ margin: 0, halfWidth: 3 }, { margin: 0, halfWidth: 4 });
    expect(d.halfWidth).toBeCloseTo(5, 6);
  });

  it('counts unmeasurable deltas rather than hiding them', () => {
    const before = mapOf([cellAt('AA|EARLY|none', 1.0, 0.5)]);
    const after = mapOf([cellAt('AA|EARLY|none', 1.2, 0.5)], { engineCommit: 'bbbbbbbbbbbb' });
    const report = compareEntryMaps(before, after);
    expect(report.headline.measurableDeltas).toBe(0);
    expect(report.headline.unmeasurableDeltas).toBe(1);
    // Still present in the artifact — hiding it would be its own distortion.
    expect(report.cells[0].delta).toBeCloseTo(0.2, 6);
  });
});

describe('the comparison says what kind of comparison it is', () => {
  it('same policy and same commit is a REPLICATE — where migration would be a bug', () => {
    const cells = [cellAt('AA|EARLY|none', 1, 0.1)];
    const report = compareEntryMaps(mapOf(cells), mapOf(cells));
    expect(report.comparison.kind).toBe(COMPARISON_KINDS.REPLICATE);
  });

  it('same policy, different commit is a GENERATION', () => {
    const cells = [cellAt('AA|EARLY|none', 1, 0.1)];
    const report = compareEntryMaps(mapOf(cells), mapOf(cells, { engineCommit: 'bbbbbbbbbbbb' }));
    expect(report.comparison.kind).toBe(COMPARISON_KINDS.GENERATION);
  });

  it('a different policy is a POLICY CHANGE, allowed but never silent', () => {
    // Diffing across policies is the entire purpose; what is forbidden is doing it as though
    // the same quantity had merely been re-estimated.
    const cells = [cellAt('AA|EARLY|none', 1, 0.1)];
    const report = compareEntryMaps(mapOf(cells), mapOf(cells, {
      continuationPolicy: { id: 'cp-can-barrel-v2' },
    }));
    expect(report.comparison.kind).toBe(COMPARISON_KINDS.POLICY_CHANGE);
    expect(report.warnings.join(' ')).toMatch(/different quantities/);
  });

  it('warns when a REPLICATE shows measurable movement — that is an instrument fault', () => {
    const report = compareEntryMaps(
      mapOf([cellAt('AA|EARLY|none', 0.0, 0.01)]),
      mapOf([cellAt('AA|EARLY|none', 2.0, 0.01)]),
    );
    expect(report.comparison.kind).toBe(COMPARISON_KINDS.REPLICATE);
    expect(report.warnings.join(' ')).toMatch(/instrument/i);
  });

  it('carries both maps\' dirty flags forward instead of averaging them away', () => {
    const cells = [cellAt('AA|EARLY|none', 1, 0.1)];
    const report = compareEntryMaps(mapOf(cells, { engineDirty: true }), mapOf(cells));
    expect(report.comparison.before.engineDirty).toBe(true);
    expect(report.warnings.join(' ')).toMatch(/earlier map:.*not replicable/);
  });
});

describe('what the headline counts', () => {
  const before = mapOf([
    cellAt('AKs|EARLY|none', -1.0, 0.1),   // clear-  → clear+   (the money question)
    cellAt('76s|LATE|raise', 0.0, 3.0),    // unmeasured → fringe-tight (the evidence question)
    cellAt('AA|EARLY|none', 1.5, 0.1),     // stays clear+
    cellAt('72o|EARLY|none', -1.5, 0.1),   // stays clear-
  ]);
  const after = mapOf([
    cellAt('AKs|EARLY|none', 1.0, 0.1),
    cellAt('76s|LATE|raise', 0.0, 0.05),
    cellAt('AA|EARLY|none', 1.5, 0.1),
    cellAt('72o|EARLY|none', -1.5, 0.1),
  ], { continuationPolicy: { id: 'cp-can-barrel-v2' } });

  const report = compareEntryMaps(before, after);

  it('counts hands that became worth playing', () => {
    expect(report.headline.intoClearPlus).toBe(1);
    expect(report.headline.outOfClearMinus).toBe(1);
  });

  it('counts becoming measurable separately — better evidence is not a better answer', () => {
    expect(report.headline.becameMeasurable).toBe(1);
    expect(report.headline.becameUnmeasured).toBe(0);
  });

  it('records the transitions by name, so the matrix can be read directly', () => {
    expect(report.transitions[`${BANDS.CLEAR_MINUS}→${BANDS.CLEAR_PLUS}`]).toBe(1);
    expect(report.transitions[`${BANDS.UNMEASURED}→${BANDS.FRINGE_TIGHT}`]).toBe(1);
    expect(report.transitions[`${BANDS.CLEAR_PLUS}→${BANDS.CLEAR_PLUS}`]).toBe(1);
  });

  it('keeps every cell in the artifact and only FILTERS for the console view', () => {
    expect(report.cells).toHaveLength(4);
    // Two moved band; the two that stayed put also had no measurable delta.
    expect(moversOf(report)).toHaveLength(2);
  });

  it('sorts movers by the size of the move', () => {
    const movers = moversOf(report);
    expect(movers[0].cellId).toBe('AKs|EARLY|none');
  });
});
