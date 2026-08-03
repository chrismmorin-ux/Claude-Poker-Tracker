/**
 * entryCard.test.js — WS-323. The map, as a Declared surface that actually loads.
 *
 * The card is what makes the map comparable — ADR-009's guarantee is that a Declared surface is
 * scored by the SAME instrument as the observed and fitted ones, so until the map loads as a
 * Card it cannot be compared to anything, and a number nobody can compare is a number nobody
 * can be wrong about.
 *
 * Two properties get most of the attention here:
 *
 *   ENCLOSURE — every state in the declared domain reaches a rule or the residual. Not
 *     asserted; demonstrated by putting the whole domain through `evaluateCard`.
 *   THE FRINGE IS NAMED — the marginal and unmeasured cells are their own rules rather than
 *     residual fallout, so "we decided to fold this", "we could not tell" and "we never reached
 *     it" stay three different facts. Collapsing them is the exact conflation the Coverage
 *     Census exists to prevent, and it would reappear here one artifact later.
 */

import { describe, it, expect } from 'vitest';

import { BANDS, loadEntryMap } from '../backtest/entryMap.mjs';
import { buildEntryCard, buildEntryCardArtifact, entryActionOf } from '../backtest/entryCard.mjs';
import { summarizeCombos, straddlingCells, formatCard } from '../backtest/suitPass.mjs';
import {
  loadStrategyCard,
  loadStrategyCardSync,
  evaluateCard,
} from '../../src/utils/standardOfRecord/strategyCard.js';

const cellAt = (cellId, margin, halfWidth, bestAction) => {
  const [handClass, posCategory, facingAction] = cellId.split('|');
  return {
    cellId, handClass, posCategory, facingAction,
    reachable: true, degenerate: false, bestAction,
    margin, halfWidth, mcError: halfWidth / 2, modelError: halfWidth / 2,
    lower: margin - halfWidth, upper: margin + halfWidth,
  };
};

const MAP = {
  schemaVersion: 1,
  continuationPolicy: { id: 'cp-test-v1' },
  engineCommit: 'aaaaaaaaaaaaaaaa',
  engineDirty: false,
  reporting: { tauBB: 0.25 },
  domain: { gameType: 'cash', seats: [6, 9], stackDepthBB: [80, 200] },
  cells: [
    cellAt('AA|EARLY|none', 1.5, 0.1, 'bet'),      // clear+      → enter/open
    cellAt('99|EARLY|none', 0.4, 0.1, 'check'),    // clear+      → enter/limp
    cellAt('AKs|LATE|raise', 0.9, 0.1, 'raise'),   // clear+      → enter/3bet
    cellAt('KQs|LATE|raise', 0.5, 0.1, 'call'),    // clear+      → enter/call
    cellAt('76s|LATE|raise', 0.0, 0.05, 'call'),   // fringe-tight
    cellAt('J8o|MIDDLE|none', 0.0, 3.0, 'check'),  // unmeasured
    cellAt('72o|EARLY|none', -1.5, 0.1, 'check'),  // clear-      → residual
    {
      cellId: 'AA|EARLY|raise', handClass: 'AA', posCategory: 'EARLY', facingAction: 'raise',
      reachable: false, unreachableReason: 'utg-acts-first', margin: null,
    },
  ],
};

const loaded = loadEntryMap(MAP);
const card = loadStrategyCardSync(buildEntryCard(loaded));

const situationFor = (cell) => ({
  street: 'preflop', gameType: 'cash', seats: 9, stackDepthBB: 100,
  handClass: cell.handClass, posCategory: cell.posCategory, facingAction: cell.facingAction,
});

describe('the map loads as a valid Strategy Card', () => {
  it('passes the real loader, residual and warrants included', () => {
    expect(card.surfaceKind).toBe('Declared');
    expect(card.residual.action).toEqual({ fold: 1 });
    expect(card.rules.every((r) => r.warrant.class === 'equity')).toBe(true);
    // A `read` warrant without a claim would warn; nothing here claims a population number.
    expect(card.warnings).toEqual([]);
  });

  it('keys rules only on axes the keystone already defines', () => {
    // An axis outside MATCHABLE_AXES is a sixth ad-hoc coordinate system, which makes the card
    // uncomparable — the loader would have thrown, so reaching here is the assertion.
    for (const rule of card.rules) {
      expect(Object.keys(rule.when).sort()).toEqual(['facingAction', 'handClass', 'posCategory']);
    }
  });

  it('stamps a content hash the card could not have asserted for itself', async () => {
    const hashed = await loadStrategyCard(buildEntryCard(loaded));
    expect(hashed.contentHash).toMatch(/^sha256:/);
  });
});

describe('enclosure is demonstrated, not asserted', () => {
  it('every cell of the declared domain reaches a rule or the residual', () => {
    for (const cell of loaded.cells) {
      const out = evaluateCard(card, situationFor(cell));
      expect(out.abstained).toBe(false);
      expect(out.action).not.toBeNull();
    }
  });

  it('abstains EXPLICITLY outside its domain rather than guessing', () => {
    const out = evaluateCard(card, { ...situationFor(loaded.cells[0]), street: 'flop' });
    expect(out.abstained).toBe(true);
    expect(out.reason).toBe('out-of-domain');
  });

  it('abstains when the query cannot show it is inside the domain', () => {
    const { seats, ...withoutSeats } = situationFor(loaded.cells[0]);
    const out = evaluateCard(card, withoutSeats);
    expect(out.abstained).toBe(true);
    expect(out.reason).toBe('domain-unknown');
  });
});

describe('the fringe is named, not left to the residual', () => {
  it('gives the genuinely-marginal cell its own rule', () => {
    const out = evaluateCard(card, situationFor(loaded.cells.find((c) => c.cellId === '76s|LATE|raise')));
    expect(out.residual).toBe(false);
    expect(out.ruleId).toBe('fringe/76s|LATE|raise');
    expect(out.action).toEqual({ fold: 1 });
  });

  it('gives the unmeasured cell its own rule, and says no sign was established', () => {
    const out = evaluateCard(card, situationFor(loaded.cells.find((c) => c.cellId === 'J8o|MIDDLE|none')));
    expect(out.ruleId).toBe('unmeasured/J8o|MIDDLE|none');
    expect(out.warrant.claim).toMatch(/NO SIGN ESTABLISHED/);
  });

  it('sends only the arithmetic-rejected cells to the residual', () => {
    const out = evaluateCard(card, situationFor(loaded.cells.find((c) => c.cellId === '72o|EARLY|none')));
    expect(out.residual).toBe(true);
    expect(out.ruleId).toBeNull();
  });

  it('distinguishes the three kinds of fold in the rule id, not just in prose', () => {
    const groups = card.rules.reduce((acc, r) => {
      acc[r.id.split('/')[0]] = (acc[r.id.split('/')[0]] || 0) + 1;
      return acc;
    }, {});
    expect(groups).toEqual({ enter: 4, fringe: 1, unmeasured: 1 });
  });
});

describe('the advisor\'s generic action is resolved to a legal preflop action', () => {
  it('resolves the first-in branch\'s "check" to a limp', () => {
    // `preflopAdvisor` labels the limped-pot branch `check` after computing a limpCost. A card
    // that copied it verbatim would tell a player to check from UTG, which is not a legal
    // action — and an unexecutable card is not a strategy.
    expect(entryActionOf('none', 'check')).toBe('limp');
    expect(entryActionOf('none', 'bet')).toBe('open');
    expect(entryActionOf('raise', 'call')).toBe('call');
    expect(entryActionOf('raise', 'raise')).toBe('3bet');
  });

  it('throws on a pair it does not recognise rather than guessing', () => {
    expect(() => entryActionOf('raise', 'bet', { cellId: 'AA|LATE|raise' }))
      .toThrow(/action set has changed/);
  });

  it('carries the resolved action into the rule', () => {
    const open = evaluateCard(card, situationFor(loaded.cells.find((c) => c.cellId === 'AA|EARLY|none')));
    const limp = evaluateCard(card, situationFor(loaded.cells.find((c) => c.cellId === '99|EARLY|none')));
    expect(open.action).toEqual({ open: 1 });
    expect(limp.action).toEqual({ limp: 1 });
  });
});

describe('provenance rides inside the hash, where it cannot be stripped', () => {
  it('names the policy, the commit and τ in the rationale', () => {
    expect(card.rationale).toMatch(/cp-test-v1/);
    expect(card.rationale).toMatch(/aaaaaaaaaaaaaaaa/);
    expect(card.rationale).toMatch(/τ=0.25bb/);
  });

  it('makes a card from a different engine commit a DIFFERENT card', async () => {
    // `loadStrategyCardSync` returns a normalized card built from named fields, so a top-level
    // provenance block would be dropped on load — the file and the card would disagree. Putting
    // it in `rationale`, which is hashed, is what makes this test possible at all.
    const a = await loadStrategyCard(buildEntryCard(loaded));
    const b = await loadStrategyCard(buildEntryCard(loadEntryMap({ ...MAP, engineCommit: 'bbbbbbbbbbbbbbbb' })));
    expect(a.contentHash).not.toBe(b.contentHash);
  });

  it('says outright that the artifact\'s provenance block is only a convenience copy', () => {
    const artifact = buildEntryCardArtifact(loaded);
    expect(artifact.provenanceNote).toMatch(/NOT part of the Strategy Card/);
    expect(artifact.provenance.continuationPolicy.id).toBe('cp-test-v1');
  });

  it('admits a dirty tree in the rationale, so an unreplicable card says so', () => {
    const dirty = buildEntryCard(loadEntryMap({ ...MAP, engineDirty: true }));
    expect(dirty.rationale).toMatch(/DIRTY TREE/);
  });
});

describe('the suit pass targets only cells whose answer is in doubt', () => {
  it('selects exactly the bands whose interval straddles zero', () => {
    const targets = straddlingCells(loaded).map((c) => c.cellId);
    expect(targets).toEqual(['76s|LATE|raise', 'J8o|MIDDLE|none']);
  });

  it('separates a point-estimate sign flip from one the intervals establish', () => {
    // Near zero, point estimates change sign from sampling noise alone. Calling that a finding
    // would manufacture heterogeneity out of Monte Carlo error.
    const noisy = summarizeCombos([
      { margin: -0.02, lower: -0.30, upper: 0.26, halfWidth: 0.28 },
      { margin: 0.03, lower: -0.25, upper: 0.31, halfWidth: 0.28 },
    ], 0.25);
    expect(noisy.pointSignSplit).toBe(true);
    expect(noisy.signSplit).toBe(false);

    const real = summarizeCombos([
      { margin: -0.5, lower: -0.6, upper: -0.4, halfWidth: 0.1 },
      { margin: 0.5, lower: 0.4, upper: 0.6, halfWidth: 0.1 },
    ], 0.25);
    expect(real.signSplit).toBe(true);
  });

  it('reports the within-class spread against τ', () => {
    const s = summarizeCombos([
      { margin: 0.0, lower: -0.1, upper: 0.1, halfWidth: 0.1 },
      { margin: 0.4, lower: 0.3, upper: 0.5, halfWidth: 0.1 },
    ], 0.25);
    expect(s.spread).toBeCloseTo(0.4, 6);
    expect(s.spreadExceedsTau).toBe(true);
  });

  it('counts degenerate combos instead of averaging them away', () => {
    const s = summarizeCombos([
      { margin: 0.1, lower: 0, upper: 0.2, halfWidth: 0.1 },
      { margin: null, degenerate: true },
    ], 0.25);
    expect(s.pricedCount).toBe(1);
    expect(s.degenerateCount).toBe(1);
    expect(s.meanMargin).toBeCloseTo(0.1, 6);
  });

  it('renders an encoded card with letters, because the artifact gets grepped', () => {
    // cardParser encodes rank*4 + suit, rank 0 = deuce, suits ['♠','♥','♦','♣'].
    expect(formatCard(12 * 4 + 0)).toBe('As');
    expect(formatCard(0 * 4 + 3)).toBe('2c');
  });
});

describe('the band the map reports is the one the card is built from', () => {
  it('re-banding at a wider τ moves cells between the named groups', () => {
    // τ is presentational, so this must change the CARD's grouping without changing any margin.
    const wide = buildEntryCard(loadEntryMap(MAP, { tauBB: 5 }));
    const ids = wide.rules.map((r) => r.id);
    expect(ids).toContain('fringe/J8o|MIDDLE|none');
    expect(ids).not.toContain('unmeasured/J8o|MIDDLE|none');
    expect(wide.rules.find((r) => r.id === 'enter/AA|EARLY|none')).toBeTruthy();
  });

  it('leaves clear cells alone no matter what τ says', () => {
    const wide = loadEntryMap(MAP, { tauBB: 99 });
    expect(wide.cells.find((c) => c.cellId === 'AA|EARLY|none').band).toBe(BANDS.CLEAR_PLUS);
  });
});
