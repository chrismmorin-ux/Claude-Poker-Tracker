// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubrangeFilter } from '../SubrangeFilter';

// byGroup fixture mirroring handTypeBreakdown(...).byGroup shape (only fields the
// component reads). topPair + draws have combos; air does not.
const byGroup = {
  topPair: { id: 'topPair', label: 'Top Pair', totalCount: 4, totalPct: 0.4, totalWeight: 4, types: [] },
  draws: { id: 'draws', label: 'Draws', totalCount: 6, totalPct: 0.35, totalWeight: 6, types: [] },
  air: { id: 'air', label: 'Air', totalCount: 0, totalPct: 0, totalWeight: 0, types: [] },
};

const renderFilter = (value = new Set(), onChange = vi.fn()) => {
  render(<SubrangeFilter byGroup={byGroup} value={value} onChange={onChange} />);
  return onChange;
};

describe('SubrangeFilter', () => {
  it('renders a chip only for groups with combos, labelled with weighted %', () => {
    renderFilter();
    expect(screen.getByRole('button', { name: /Top Pair\s*40%/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Draws\s*35%/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Air/ })).not.toBeInTheDocument();
  });

  it('renders nothing when no group has combos', () => {
    const { container } = render(
      <SubrangeFilter byGroup={{ air: { ...byGroup.air } }} value={new Set()} onChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('toggling a chip adds its id to the selection', () => {
    const onChange = renderFilter();
    fireEvent.click(screen.getByRole('button', { name: /Draws/ }));
    const next = onChange.mock.calls[0][0];
    expect(next).toBeInstanceOf(Set);
    expect([...next]).toEqual(['draws']);
  });

  it('toggling a selected chip removes it', () => {
    const onChange = renderFilter(new Set(['draws', 'topPair']));
    fireEvent.click(screen.getByRole('button', { name: /Draws/ }));
    expect([...onChange.mock.calls[0][0]].sort()).toEqual(['topPair']);
  });

  it('selected chip is aria-pressed', () => {
    renderFilter(new Set(['topPair']));
    expect(screen.getByRole('button', { name: /Top Pair/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Draws/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('"All hands" clears the selection', () => {
    const onChange = renderFilter(new Set(['draws']));
    fireEvent.click(screen.getByRole('button', { name: 'All hands' }));
    expect([...onChange.mock.calls[0][0]]).toEqual([]);
  });
});
