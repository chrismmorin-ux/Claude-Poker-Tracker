// @vitest-environment jsdom
/**
 * WeightedTotalTable.test.jsx — partition-display invariant.
 *
 * WS-185 / SPR-083 — DetailTable header partition (top-N selected + Other)
 * and AggregatedTable header partition (beats + pays + other) must each
 * sum to exactly 100%.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Stub the breakpoint module BEFORE importing the component under test.
// Returning 'detail-5' forces the DetailTable branch to render in jsdom.
vi.mock('../useResponsiveBreakpoint', () => ({
  useResponsiveBreakpoint: () => 'lg',
  p2ColumnModeForBreakpoint: () => 'detail-5',
}));

import { WeightedTotalTable } from '../WeightedTotalTable';
import { formatPercentGroup } from '../../../../../utils/pokerCore/percentGroup';

const makeDecomposition = (entries) =>
  entries.map((e, i) => ({
    groupId: e.id ?? `g${i}`,
    groupLabel: e.label ?? `Group ${i}`,
    weightPct: e.weightPct,
    heroEquity: e.heroEquity ?? 0.5,
    relation: e.relation ?? 'neutral',
    comboCount: e.comboCount ?? 3,
  }));

const makeActionEVs = () => [
  {
    actionLabel: 'Bet',
    totalEV: 1.5,
    isBest: true,
    unsupported: false,
    perGroupContribution: [],
  },
];

describe('WeightedTotalTable — DetailTable partition invariant (WS-185)', () => {
  it('top-4 selected + Other sums to exactly 100', () => {
    // 6 groups, top-4 selected + 2 in Other bucket.
    const decomp = makeDecomposition([
      { id: 'a', weightPct: 28.111 },
      { id: 'b', weightPct: 22.222 },
      { id: 'c', weightPct: 17.333 },
      { id: 'd', weightPct: 13.999 },
      { id: 'e', weightPct: 11.555 },
      { id: 'f', weightPct: 6.78 },
    ]);
    render(<WeightedTotalTable decomposition={decomp} actionEVs={makeActionEVs()} />);

    const selectedPctCells = ['a', 'b', 'c', 'd']
      .map((id) => parseFloat(screen.getByTestId(`wtt-detail-pct-${id}`).textContent));
    const otherPct = parseFloat(screen.getByTestId('wtt-detail-pct-other').textContent);
    const sum = selectedPctCells.reduce((s, v) => s + v, 0) + otherPct;
    expect(sum).toBeCloseTo(100, 9);
  });

  it('renders the partition label on DetailTable', () => {
    const decomp = makeDecomposition([
      { id: 'a', weightPct: 50 },
      { id: 'b', weightPct: 50 },
    ]);
    render(<WeightedTotalTable decomposition={decomp} actionEVs={makeActionEVs()} />);
    expect(screen.getAllByText(/sums to 100%/i).length).toBeGreaterThanOrEqual(1);
  });

  it('uniform 1/3 split across 3 groups sums to exactly 100', () => {
    const decomp = makeDecomposition([
      { id: 'a', weightPct: 33.33 },
      { id: 'b', weightPct: 33.33 },
      { id: 'c', weightPct: 33.34 },
    ]);
    render(<WeightedTotalTable decomposition={decomp} actionEVs={makeActionEVs()} />);
    const selectedPctCells = ['a', 'b', 'c']
      .map((id) => parseFloat(screen.getByTestId(`wtt-detail-pct-${id}`).textContent));
    expect(selectedPctCells.reduce((s, v) => s + v, 0)).toBeCloseTo(100, 9);
  });
});

describe('WeightedTotalTable — AggregatedTable partition math (WS-185)', () => {
  // AggregatedTable rendering requires the 'aggregated-3' mode which conflicts
  // with the DetailTable mock above. Test the partition math at the data-flow
  // boundary directly — that's what the component threads through
  // formatPercentGroup.
  it('beats + pays + other (3-way) sums to exactly 100 via formatPercentGroup', () => {
    // Realistic decomposition with all 3 relation classes present.
    const decomp = makeDecomposition([
      { id: 'beat1', weightPct: 30.1, relation: 'crushed' },
      { id: 'beat2', weightPct: 22.2, relation: 'dominated' },
      { id: 'pay1', weightPct: 25.3, relation: 'favored' },
      { id: 'pay2', weightPct: 14.4, relation: 'dominating' },
      { id: 'other', weightPct: 8.0, relation: 'neutral' },
    ]);
    const VALUE_RELATIONS = new Set(['crushed', 'dominated']);
    const BLUFF_RELATIONS = new Set(['favored', 'dominating']);
    const beats = decomp.filter((d) => VALUE_RELATIONS.has(d.relation)).reduce((s, d) => s + d.weightPct, 0);
    const pays = decomp.filter((d) => BLUFF_RELATIONS.has(d.relation)).reduce((s, d) => s + d.weightPct, 0);
    const other = decomp.filter((d) => !VALUE_RELATIONS.has(d.relation) && !BLUFF_RELATIONS.has(d.relation))
      .reduce((s, d) => s + d.weightPct, 0);
    const [bPct, pPct, oPct] = formatPercentGroup([beats, pays, other], 1);
    const sum = parseFloat(bPct) + parseFloat(pPct) + parseFloat(oPct);
    expect(sum).toBeCloseTo(100, 9);
  });

  it('asymmetric 3-way partition (90/5/5) sums to exactly 100', () => {
    const [a, b, c] = formatPercentGroup([90.123, 5.234, 4.643], 1);
    const sum = parseFloat(a) + parseFloat(b) + parseFloat(c);
    expect(sum).toBeCloseTo(100, 9);
  });
});
