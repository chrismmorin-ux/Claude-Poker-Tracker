// @vitest-environment jsdom
/**
 * VillainRangeDecomposition.test.jsx — partition-display invariant.
 *
 * WS-185 / SPR-083 — every villain-range row weightPct displays as part of
 * a partition that sums to exactly 100% via largest-remainder rounding.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VillainRangeDecomposition } from '../VillainRangeDecomposition';

const makeDecomposition = (rows) =>
  rows.map((r, i) => ({
    groupId: r.id ?? `g${i}`,
    groupLabel: r.label ?? `Group ${i}`,
    weightPct: r.weightPct,
    heroEquity: r.heroEquity ?? 0.5,
    relation: r.relation ?? 'neutral',
    comboCount: r.comboCount ?? 3,
  }));

const sumPcts = (testIds) =>
  testIds.reduce(
    (s, id) => s + parseFloat(screen.getByTestId(id).textContent),
    0,
  );

describe('VillainRangeDecomposition — partition invariant (WS-185)', () => {
  it('renders the partition label', () => {
    const decomp = makeDecomposition([
      { id: 'a', weightPct: 33.4 },
      { id: 'b', weightPct: 33.4 },
      { id: 'c', weightPct: 33.2 },
    ]);
    render(<VillainRangeDecomposition decomposition={decomp} decisionKind="standard" />);
    expect(screen.getByText(/sums to 100%/i)).toBeInTheDocument();
  });

  it('standard mode: three-way 1/3 row weights sum to exactly 100', () => {
    const decomp = makeDecomposition([
      { id: 'a', weightPct: 33.33 },
      { id: 'b', weightPct: 33.33 },
      { id: 'c', weightPct: 33.34 },
    ]);
    render(<VillainRangeDecomposition decomposition={decomp} decisionKind="standard" />);
    const sum = sumPcts(['vrd-weight-pct-a', 'vrd-weight-pct-b', 'vrd-weight-pct-c']);
    expect(sum).toBeCloseTo(100, 9);
  });

  it('standard mode: 5-way asymmetric partition sums to exactly 100', () => {
    const decomp = makeDecomposition([
      { id: 'a', weightPct: 41.234 },
      { id: 'b', weightPct: 22.555 },
      { id: 'c', weightPct: 18.111 },
      { id: 'd', weightPct: 11.999 },
      { id: 'e', weightPct: 6.101 },
    ]);
    render(<VillainRangeDecomposition decomposition={decomp} decisionKind="standard" />);
    const sum = sumPcts(['vrd-weight-pct-a', 'vrd-weight-pct-b', 'vrd-weight-pct-c', 'vrd-weight-pct-d', 'vrd-weight-pct-e']);
    expect(sum).toBeCloseTo(100, 9);
  });

  it('polar (bluff-catch) subtotals sum to exactly 100', () => {
    const decomp = makeDecomposition([
      { id: 'v1', weightPct: 23.4, relation: 'crushed' },
      { id: 'v2', weightPct: 18.6, relation: 'dominated' },
      { id: 'b1', weightPct: 27.1, relation: 'favored' },
      { id: 'b2', weightPct: 14.9, relation: 'dominating' },
      { id: 'n1', weightPct: 16.0, relation: 'neutral' },
    ]);
    render(<VillainRangeDecomposition decomposition={decomp} decisionKind="bluff-catch" />);
    const sum =
      parseFloat(screen.getByTestId('vrd-subtotal-value').textContent) +
      parseFloat(screen.getByTestId('vrd-subtotal-bluff').textContent) +
      parseFloat(screen.getByTestId('vrd-subtotal-neutral').textContent);
    expect(sum).toBeCloseTo(100, 9);
  });

  it('polar (thin-value) subtotals sum to exactly 100 (no neutral category)', () => {
    const decomp = makeDecomposition([
      { id: 'v1', weightPct: 60.0, relation: 'crushed' },
      { id: 'b1', weightPct: 40.0, relation: 'favored' },
    ]);
    render(<VillainRangeDecomposition decomposition={decomp} decisionKind="thin-value" />);
    const sum =
      parseFloat(screen.getByTestId('vrd-subtotal-value').textContent) +
      parseFloat(screen.getByTestId('vrd-subtotal-bluff').textContent);
    expect(sum).toBeCloseTo(100, 9);
  });

  it('returns empty-state safely for empty decomposition', () => {
    render(<VillainRangeDecomposition decomposition={[]} decisionKind="standard" />);
    expect(screen.getByText(/No villain-range decomposition available/i)).toBeInTheDocument();
  });
});
