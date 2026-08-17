import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  LABEL_LEDGER,
  FOUNDATIONS,
  FOUNDATION_STATUSES,
  BOUND_METHODS,
  EXCLUSION_REASONS,
  buildLabelEntry,
  labelEntryProblems,
  buildMeasuredImpact,
  buildBoundedImpact,
  buildUnmeasuredReach,
  impactProblems,
  rankLabels,
  reachScore,
  ledgerSelfCheck,
  ledgerVersion,
  isLedgerVersionShape,
  resolveLabel,
} from '../labelLedger.js';

/** A minimal valid spec, so each test varies exactly one thing. */
const baseSpec = (over = {}) => ({
  labelId: 'LBL-test-row',
  title: 'A test row',
  site: { file: 'src/utils/exploitEngine/x.js', symbol: 'X_TABLE' },
  sites: ['src/utils/exploitEngine/x.js::X_TABLE'],
  keySpace: ['street'],
  foundation: 'founder-estimate',
  foundationStatus: 'undeclared',
  provenance: 'NO STATED PROVENANCE.',
  liveness: 'unconditional',
  impact: buildUnmeasuredReach({
    readSites: 2,
    cellCount: 9,
    primaryPath: true,
    instrument: { what: 'Ablate it and re-score.', ticket: 'WS-445' },
  }),
  ...over,
});

describe('an UNMEASURED row cannot carry an EV figure', () => {
  // This is WS-445's load-bearing mechanic and the thing its own decision_flags warned about:
  // "the ledger doesn't silently become a list of unmeasured guesses wearing EV units."
  // The guard is a SHAPE, not a rule, so these tests assert the shape.

  it('mints no EV key at all — undefined, not null', () => {
    const impact = buildUnmeasuredReach({
      readSites: 1, cellCount: 5, primaryPath: true,
      instrument: { what: 'x', ticket: 'WS-445' },
    });
    expect('absEvBB100' in impact).toBe(false);
    expect('boundBB100' in impact).toBe(false);
    expect(impact.absEvBB100).toBeUndefined();
  });

  it('rejects an EV key bolted on by hand', () => {
    const rogue = { ...buildUnmeasuredReach({
      readSites: 1, cellCount: 5, primaryPath: true,
      instrument: { what: 'x', ticket: 'WS-445' },
    }), absEvBB100: 0.42 };
    const problems = impactProblems(rogue);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join(' ')).toMatch(/unexpected key/i);
    expect(problems.join(' ')).toMatch(/carries EV/i);
  });

  it('refuses the whole entry when the impact carries a rogue EV key', () => {
    expect(() => buildLabelEntry(baseSpec({
      impact: { ...baseSpec().impact, evBB: 1.2 },
    }))).toThrow(/unexpected key/i);
  });

  it('derives the tier from the payload — there is no tier argument to disagree with', () => {
    const entry = buildLabelEntry(baseSpec());
    expect(entry.impact.tier).toBe('unmeasured');
    // A caller cannot assert a different tier: buildLabelEntry reads impact.tier only.
    const forced = buildLabelEntry(baseSpec({ tier: 'measured' }));
    expect(forced.impact.tier).toBe('unmeasured');
  });

  it('requires an instrument with a ticket — a gap with no owner is a complaint', () => {
    expect(impactProblems({
      tier: 'unmeasured', readSites: 1, cellCount: 2, primaryPath: true,
      instrument: { what: '', ticket: 'WS-1' },
    }).join(' ')).toMatch(/NAMES the instrument/i);

    expect(impactProblems({
      tier: 'unmeasured', readSites: 1, cellCount: 2, primaryPath: true,
      instrument: { what: 'do the thing', ticket: 'nope' },
    }).join(' ')).toMatch(/WS-NNN/);
  });
});

describe('MEASURED requires a real join, not a word', () => {
  it('rejects a measured impact with no Result Card id', () => {
    expect(impactProblems({
      tier: 'measured', absEvBB100: 0.5, ci: null, resultCardId: '', clusterUnit: 'players',
      method: 'ablation-delta',
    }).join(' ')).toMatch(/names the Result Card/i);
  });

  it('rejects hands as a cluster unit', () => {
    expect(impactProblems(buildMeasuredImpact({
      absEvBB100: 0.5, resultCardId: 'RC-x-1', clusterUnit: 'hands', method: 'ablation-delta',
    })).join(' ')).toMatch(/clusterUnit/);
  });

  it('rejects a foundationStatus that contradicts a MEASURED impact', () => {
    expect(() => buildLabelEntry(baseSpec({
      foundationStatus: 'undeclared',
      impact: buildMeasuredImpact({
        absEvBB100: 0.5, resultCardId: 'RC-x-1', clusterUnit: 'players', method: 'ablation-delta',
      }),
    }))).toThrow(/contradicts a MEASURED impact/i);
  });
});

describe('BOUNDED may not become a dumping ground', () => {
  it('requires a method from the closed set', () => {
    expect(impactProblems({
      tier: 'bounded', boundBB100: 1.0, boundDirection: '<=', method: 'vibes',
      derivation: 'it felt right',
    }).join(' ')).toMatch(/not in BOUND_METHODS/);
  });

  it('requires a direction glyph so a bound never reads as an estimate', () => {
    expect(impactProblems({
      tier: 'bounded', boundBB100: 1.0, boundDirection: '~', method: 'ablation-delta',
      derivation: 'x',
    }).join(' ')).toMatch(/boundDirection/);
  });

  it('requires prose derivation', () => {
    expect(impactProblems(buildBoundedImpact({
      boundBB100: 1.0, method: 'ablation-delta', derivation: '  ',
    })).join(' ')).toMatch(/derivation/);
  });
});

describe('rankLabels returns two arrays, never one', () => {
  it('never places an unmeasured row in the ranked list', () => {
    const { ranked } = rankLabels();
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((r) => r.entry.impact.tier !== 'unmeasured')).toBe(true);
  });

  it('sorts unmeasured rows by reach and shows every component', () => {
    const { unmeasured } = rankLabels();
    expect(unmeasured.length).toBeGreaterThan(0);
    for (const row of unmeasured) {
      expect(row).toHaveProperty('primaryPath');
      expect(row).toHaveProperty('readSites');
      expect(row).toHaveProperty('cellCount');
      expect(row.reach).toBe(reachScore(row.entry));
      // The rank axis is reach; no EV number may appear on an unmeasured rank row.
      expect(row).not.toHaveProperty('magnitude');
    }
    const reaches = unmeasured.map((r) => r.reach);
    expect([...reaches].sort((a, b) => b - a)).toEqual(reaches);
  });

  it('is deterministic — ties break on labelId', () => {
    const a = rankLabels().ranked.map((r) => r.labelId);
    const b = rankLabels().ranked.map((r) => r.labelId);
    expect(a).toEqual(b);
  });
});

describe('the ledger is held to its own standard', () => {
  it('every shipped row validates', () => {
    for (const entry of LABEL_LEDGER) {
      expect({ id: entry.labelId, problems: labelEntryProblems(entry) })
        .toEqual({ id: entry.labelId, problems: [] });
    }
  });

  it('label ids are unique', () => {
    const ids = LABEL_LEDGER.map((e) => e.labelId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('no row stores a line number', () => {
    // A stored line would move ledgerVersion() on every unrelated edit above a table, which is
    // exactly the meaninglessness registerVersion was designed to avoid.
    for (const entry of LABEL_LEDGER) {
      expect(Object.keys(entry.site).sort()).toEqual(['file', 'symbol']);
    }
  });

  it('vocabularies stay closed', () => {
    for (const e of LABEL_LEDGER) {
      expect(FOUNDATIONS).toContain(e.foundation);
      expect(FOUNDATION_STATUSES).toContain(e.foundationStatus);
    }
    expect(new Set(BOUND_METHODS).size).toBe(BOUND_METHODS.length);
    expect(new Set(EXCLUSION_REASONS).size).toBe(EXCLUSION_REASONS.length);
  });

  it('carries the FOLD_CURVE_STREET_MODS row as measured-refuted', () => {
    // The status that earns the five-value vocabulary. If this row ever reads `undeclared` the
    // measurement has been erased; if it reads `measured-supported` it has been laundered.
    const row = LABEL_LEDGER.find((e) => e.labelId === 'LBL-fold-curve-street-mods');
    expect(row).toBeDefined();
    expect(row.foundationStatus).toBe('measured-refuted');
  });

  it('mints a joinable version that moves when a row changes', async () => {
    const v1 = await ledgerVersion();
    expect(isLedgerVersionShape(v1)).toBe(true);

    const mutated = LABEL_LEDGER.map((e, i) => (i === 1
      ? buildLabelEntry({ ...e, title: `${e.title} (edited)` })
      : e));
    const v2 = await ledgerVersion(mutated);
    expect(v2).not.toBe(v1);
  });
});

describe('the blind-spot rule fires in the suspicious direction', () => {
  it('passes on the shipped ledger', () => {
    expect(ledgerSelfCheck().problems).toEqual([]);
  });

  it('FAILS when nothing is left unmeasured', () => {
    // The naive check ("fail if too few rows are measured") rewards relabelling. This is the
    // inversion: a ledger that ran out of things to be unsure about is in a blind spot.
    const allMeasured = LABEL_LEDGER
      .filter((e) => e.impact.tier !== 'unmeasured');
    const { problems } = ledgerSelfCheck(allMeasured);
    expect(problems.join(' ')).toMatch(/BS-1/);
    expect(problems.join(' ')).toMatch(/entire label surface is grounded/i);
  });

  it('FAILS when there are no open instrument gaps', () => {
    const noGaps = LABEL_LEDGER.map((e) => (e.impact.tier === 'unmeasured'
      ? buildLabelEntry({
        ...e,
        status: 'resolved',
        resolvedBy: { commit: 'x', evidence: ['e'], note: 'n' },
      })
      : e));
    const { problems } = ledgerSelfCheck(noGaps);
    expect(problems.join(' ')).toMatch(/BS-2/);
    expect(problems.join(' ')).toMatch(/stopped asking/i);
  });

  it('reports coverage rather than gating it', () => {
    const { notes } = ledgerSelfCheck();
    expect(notes.join(' ')).toMatch(/coverage: \d+ of \d+/);
  });
});

describe('the document and the module cannot drift apart', () => {
  // Copied wholesale from faultRegister.test.js:454-476, including its design rule: prose lives
  // in the doc, data lives in the module, and this is what stops the two becoming two sources of
  // truth. No generator — a generator would just move the drift.
  const DOC = join(process.cwd(), 'docs/standard-of-record/LABEL-AND-FOUNDATION-LEDGER.md');
  const doc = readFileSync(DOC, 'utf8');

  const between = (beginMarker, endMarker) => {
    const a = doc.indexOf(beginMarker);
    const b = doc.indexOf(endMarker);
    expect(a, `${beginMarker} missing from the doc`).toBeGreaterThan(-1);
    expect(b, `${endMarker} missing from the doc`).toBeGreaterThan(a);
    return doc.slice(a + beginMarker.length, b);
  };

  const idsIn = (section) => [...section.matchAll(/`(LBL-[a-z0-9-]+)`/g)].map((m) => m[1]);

  it('the §4 ranked table matches rankLabels().ranked in exact order', () => {
    const section = between('<!-- LABEL-LEDGER:BEGIN -->', '<!-- LABEL-LEDGER:END -->');
    expect(idsIn(section)).toEqual(rankLabels().ranked.map((r) => r.labelId));
  });

  it('the §5 unmeasured table matches rankLabels().unmeasured in exact order', () => {
    const section = between(
      '<!-- LABEL-LEDGER-UNMEASURED:BEGIN -->',
      '<!-- LABEL-LEDGER-UNMEASURED:END -->',
    );
    expect(idsIn(section)).toEqual(rankLabels().unmeasured.map((r) => r.labelId));
  });

  it('the §5 table has NO EV column, and never will', () => {
    // The doc-side mirror of the module-side impossibility. Cheap, and it stops the drift where
    // someone "helpfully" adds an estimate column six months from now.
    const section = between(
      '<!-- LABEL-LEDGER-UNMEASURED:BEGIN -->',
      '<!-- LABEL-LEDGER-UNMEASURED:END -->',
    );
    const header = section.split('\n').find((l) => l.trim().startsWith('| #'));
    expect(header).toBeDefined();
    expect(header).not.toMatch(/EV|bb\/100|impact/i);
  });

  it('every unmeasured row names its instrument ticket in the doc body', () => {
    for (const row of rankLabels().unmeasured) {
      expect(doc, `${row.labelId}'s instrument ticket is not mentioned in the doc`)
        .toContain(row.entry.impact.instrument.ticket);
    }
  });

  it('the doc opens with its honesty section and states the limit', () => {
    expect(doc).toMatch(/## 1\. What this ledger can honestly say today/);
    expect(doc).toMatch(/provably cannot/i);
    // The single largest known hole must stay named, not quietly dropped.
    expect(doc).toMatch(/SPR_BAND_EDGES/);
  });
});

describe('resolving a row requires recorded evidence', () => {
  it('refuses to resolve on assertion alone', () => {
    expect(() => resolveLabel({
      labelId: 'LBL-realization-table', commit: 'abc', evidence: [], note: 'done',
    })).toThrow(/evidence is required/i);
  });

  it('refuses to resolve without a note stating what is NOT covered', () => {
    expect(() => resolveLabel({
      labelId: 'LBL-realization-table', commit: 'abc', evidence: ['measured'], note: '',
    })).toThrow(/does NOT cover/i);
  });

  it('returns a new ledger and leaves the original frozen', () => {
    const next = resolveLabel({
      labelId: 'LBL-realization-table',
      commit: 'abc',
      evidence: ['RC-x measured the ablation at 0.2 bb/100'],
      note: 'Covers the SPR axis only; the players-remaining dimension (WS-498) is untouched.',
    });
    expect(next).not.toBe(LABEL_LEDGER);
    expect(LABEL_LEDGER.find((e) => e.labelId === 'LBL-realization-table').status).toBe('open');
    expect(next.find((e) => e.labelId === 'LBL-realization-table').status).toBe('resolved');
  });
});

/**
 * The module was reachable only by its own deep path when it shipped — every other module in
 * this directory is re-exported from index.js and this one was not. A capability behind an
 * import nobody makes is the shipped-but-inert pattern, and the gate would not have caught it:
 * check-label-ledger.mjs imports the deep path too, so both halves agreed with each other.
 */
describe('the barrel re-exports the ledger', () => {
  it('resolves the public surface through index.js', async () => {
    const sor = await import('../index.js');
    for (const name of [
      'LABEL_LEDGER', 'FOUNDATIONS', 'FOUNDATION_STATUSES', 'BOUND_METHODS',
      'EXCLUSION_REASONS', 'buildLabelEntry', 'labelEntryProblems', 'buildMeasuredImpact',
      'buildBoundedImpact', 'buildUnmeasuredReach', 'impactProblems', 'rankLabels',
      'reachScore', 'ledgerSelfCheck', 'ledgerVersion', 'isLedgerVersionShape', 'resolveLabel',
    ]) {
      expect(sor[name], `index.js does not re-export ${name}`).toBeDefined();
    }
    expect(sor.LABEL_LEDGER).toBe(LABEL_LEDGER);
  });
});
