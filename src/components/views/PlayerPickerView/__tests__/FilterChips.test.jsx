// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterChips from '../FilterChips';

describe('<FilterChips />', () => {
  it('renders all category chips', () => {
    render(<FilterChips featureFilters={{}} onFilterChange={vi.fn()} onClearAll={vi.fn()} />);
    expect(screen.getByTestId('filter-chip-skin')).toBeTruthy();
    expect(screen.getByTestId('filter-chip-hair')).toBeTruthy();
    expect(screen.getByTestId('filter-chip-beard')).toBeTruthy();
    expect(screen.getByTestId('filter-chip-glasses')).toBeTruthy();
    expect(screen.getByTestId('filter-chip-hat')).toBeTruthy();
  });

  it('expands the panel on chip tap', () => {
    render(<FilterChips featureFilters={{}} onFilterChange={vi.fn()} onClearAll={vi.fn()} />);
    fireEvent.click(screen.getByTestId('filter-chip-beard'));
    // Panel renders beard swatches
    expect(screen.getByTestId('chip-panel-beard-beard.goatee')).toBeTruthy();
  });

  it('tapping a swatch fires onFilterChange', () => {
    const onFilterChange = vi.fn();
    render(<FilterChips featureFilters={{}} onFilterChange={onFilterChange} onClearAll={vi.fn()} />);
    fireEvent.click(screen.getByTestId('filter-chip-beard'));
    fireEvent.click(screen.getByTestId('chip-panel-beard-beard.goatee'));
    expect(onFilterChange).toHaveBeenCalledWith('beard', 'beard.goatee');
  });

  it('tapping the currently-selected swatch clears the filter', () => {
    const onFilterChange = vi.fn();
    render(
      <FilterChips
        featureFilters={{ beard: 'beard.goatee' }}
        onFilterChange={onFilterChange}
        onClearAll={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('filter-chip-beard'));
    fireEvent.click(screen.getByTestId('chip-panel-beard-beard.goatee'));
    expect(onFilterChange).toHaveBeenCalledWith('beard', '');
  });

  it('skin panel renders color swatches (not shape previews)', () => {
    render(<FilterChips featureFilters={{}} onFilterChange={vi.fn()} onClearAll={vi.fn()} />);
    fireEvent.click(screen.getByTestId('filter-chip-skin'));
    expect(screen.getByTestId('chip-panel-skin-skin.medium')).toBeTruthy();
  });

  it('active chip shows aria-pressed=true', () => {
    render(
      <FilterChips
        featureFilters={{ hat: 'hat.cap' }}
        onFilterChange={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(screen.getByTestId('filter-chip-hat').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('filter-chip-beard').getAttribute('aria-pressed')).toBe('false');
  });

  it('renders clear-all button only when filters are active', () => {
    const { rerender } = render(
      <FilterChips featureFilters={{}} onFilterChange={vi.fn()} onClearAll={vi.fn()} />,
    );
    expect(screen.queryByTestId('clear-filters-btn')).toBeNull();
    rerender(
      <FilterChips
        featureFilters={{ beard: 'beard.goatee' }}
        onFilterChange={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(screen.getByTestId('clear-filters-btn')).toBeTruthy();
  });

  it('clear-all fires onClearAll', () => {
    const onClearAll = vi.fn();
    render(
      <FilterChips
        featureFilters={{ beard: 'beard.goatee' }}
        onFilterChange={vi.fn()}
        onClearAll={onClearAll}
      />,
    );
    fireEvent.click(screen.getByTestId('clear-filters-btn'));
    expect(onClearAll).toHaveBeenCalled();
  });

  it('tapping chip again collapses the panel', () => {
    render(<FilterChips featureFilters={{}} onFilterChange={vi.fn()} onClearAll={vi.fn()} />);
    fireEvent.click(screen.getByTestId('filter-chip-beard'));
    expect(screen.getByTestId('chip-panel-beard-beard.goatee')).toBeTruthy();
    fireEvent.click(screen.getByTestId('filter-chip-beard'));
    expect(screen.queryByTestId('chip-panel-beard-beard.goatee')).toBeNull();
  });
});
