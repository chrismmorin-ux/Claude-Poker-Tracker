import { describe, it, expect } from 'vitest';

import {
  harvest,
  vacuityProblems,
  ROOTS,
  PATH_FLOORS,
  CORPUS_FLOOR,
} from '../standardOfRecord/harvestLabelConstructs.mjs';

/**
 * The detector is the load-bearing half of WS-445: a construct it cannot see is a ledger row
 * nobody ever writes, and unlike a false positive that failure is silent. Each fixture below is
 * drawn from a REAL site the survey named, so a regression here is a regression against
 * something known to exist rather than against an invented shape.
 */
describe('the three harvest forms detect what the survey found', () => {
  // These run against the REAL repo rather than fixtures, because the point is not "does the
  // regex work" — it is "does this still find the constructs WS-445 was written about". A
  // fixture invented to demonstrate a detector is not evidence the detector finds real code;
  // exploitEngine/CLAUDE.md records that exact failure ("59 green unit tests that hand-fed a
  // number the engine cannot produce").
  const result = harvest(ROOTS);
  const bySymbol = new Map(result.rows.map((r) => [r.symbol, r]));

  it('parses every file in scope — a file that cannot be parsed HIDES', () => {
    expect(result.parseFailures).toEqual([]);
    expect(result.files).toBeGreaterThan(400);
  });

  it.each([
    ['REALIZATION_TABLE', 'keyed-numeric-table', 3],
    ['FOLD_CURVE_STREET_MODS', 'keyed-numeric-table', 2],
    ['BUCKET_MIDPOINT', 'keyed-numeric-table', 1],
    ['POP_CALLING_RATES', 'keyed-numeric-table', 1],
    ['SUBCLASS_SPLIT', 'keyed-numeric-table', 3],
  ])('finds %s as a %s at key depth %i', (symbol, kind, depth) => {
    const row = bySymbol.get(symbol);
    expect(row, `${symbol} vanished from the harvest`).toBeDefined();
    expect(row.kind).toBe(kind);
    expect(row.keyPaths.length).toBe(depth);
  });

  it('finds a table whose values are mostly IDENTIFIERS, not literals', () => {
    // ACTION_TAU_FRACTION is {check: 1.0, bet: TAU_FRACTION, call: TAU_FRACTION, raise: ...}.
    // A detector requiring two numeric LITERALS missed it — and it is the single
    // best-measured table in the engine, so that miss mattered more than any false positive.
    const row = bySymbol.get('ACTION_TAU_FRACTION');
    expect(row).toBeDefined();
    expect(row.refLeaves).toBeGreaterThan(0);
  });

  it('finds a table whose values are numeric ARRAYS', () => {
    // PREFLOP_RAISE_SIZES maps ten labels to [3.0, 3.5] sizing pairs, and is module-private.
    const row = bySymbol.get('PREFLOP_RAISE_SIZES');
    expect(row).toBeDefined();
    expect(row.exported).toBe(false);
    expect(row.cellCount).toBeGreaterThan(10);
  });

  it('finds a table carrying cosmetic string fields beside its thresholds', () => {
    // M_RATIO_ZONES is {GREEN: {min: 20, color: …, label: 'Comfortable'}}. An earlier
    // `no string leaves` rule made it invisible.
    expect(bySymbol.get('M_RATIO_ZONES')).toBeDefined();
  });

  it('finds label-switch and label-ternary forms', () => {
    const switches = result.rows.filter((r) => r.kind === 'label-switch');
    const ternaries = result.rows.filter((r) => r.kind === 'label-ternary');
    expect(switches.length).toBeGreaterThan(0);
    expect(ternaries.length).toBeGreaterThan(0);
    // Both named in the survey; both must stay found.
    expect(result.rows.some((r) => r.symbol === 'buildActionPrior')).toBe(true);
    expect(result.rows.some((r) => r.symbol === 'bucketRaiseFraction')).toBe(true);
  });

  it('does NOT harvest label->string display maps', () => {
    // STYLE_DESCRIPTIONS is display. Display labels are outside what POKER_THEORY §7.1 governs,
    // and sweeping them in would drown the ledger in rows with no decision to make.
    expect(bySymbol.has('STYLE_DESCRIPTIONS')).toBe(false);
  });

  it('does NOT harvest objects built inside a function', () => {
    // Module scope is the discriminator between a table code READS and a value under
    // construction. 27 `const card = {...}` / `const out = {...}` locals were swept in before it.
    for (const row of result.rows.filter((r) => r.kind === 'keyed-numeric-table')) {
      expect(row.symbol).not.toMatch(/^(out|census|briefing|riverBet|riverCheck)$/);
    }
  });

  it('records module-private tables, which an export-keyed gate would miss', () => {
    const tables = result.rows.filter((r) => r.kind === 'keyed-numeric-table');
    const priv = tables.filter((r) => !r.exported);
    expect(priv.length / tables.length).toBeGreaterThan(0.2);
  });

  it('stores no line number on the harvest KEY', () => {
    // Line numbers ride along for reporting, but the key must be structural — a baseline keyed
    // on file:line diffs on every edit above a construct, which teaches everyone to --update
    // without reading.
    for (const row of result.rows) expect(row.key).not.toMatch(/:\d+$/);
  });
});

describe('the vacuity guards catch a sweep that stopped seeing things', () => {
  const healthy = harvest(ROOTS);

  it('passes on the real repo', () => {
    expect(vacuityProblems(healthy)).toEqual([]);
  });

  it('fails when an AREA goes silent behind a healthy total', () => {
    // The failure a corpus-only floor cannot catch: losing all of exploitEngine still leaves
    // ~100 of 145 rows.
    const gutted = {
      ...healthy,
      rows: healthy.rows.filter((r) => !r.file.startsWith('src/utils/exploitEngine/')),
    };
    const problems = vacuityProblems(gutted);
    expect(problems.join(' ')).toMatch(/HARVEST VACUOUS in src\/utils\/exploitEngine/);
  });

  it('fails when one DETECTOR goes silent behind a healthy total', () => {
    const noTernaries = {
      ...healthy,
      rows: healthy.rows.filter((r) => r.kind !== 'label-ternary'),
    };
    expect(vacuityProblems(noTernaries).join(' ')).toMatch(/"label-ternary" detector produced ZERO/);
  });

  it('fails when the globs themselves go vacuous', () => {
    expect(vacuityProblems({ rows: [], files: 0 }).join(' ')).toMatch(/only 0 files scanned/);
  });

  it('keeps floors below measured reality so they are guards, not ratchets', () => {
    expect(healthy.rows.length).toBeGreaterThan(CORPUS_FLOOR);
    for (const [prefix, floor] of Object.entries(PATH_FLOORS)) {
      const n = healthy.rows.filter((r) => r.file.startsWith(`${prefix}/`)).length;
      expect(n, `${prefix} is at or below its own floor`).toBeGreaterThan(floor);
    }
  });
});
