// @vitest-environment jsdom
/**
 * AnchorFilters.test.jsx — filter-chip + sort-dropdown coverage.
 *
 * EAL Phase 6 — Session 19 (S19).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnchorFilters } from '../AnchorFilters';
import { EMPTY_FILTERS } from '../../../../utils/anchorLibrary/librarySelectors';
import {
  DEFAULT_SORT_STRATEGY,
  VALID_SORT_STRATEGIES,
  SORT_STRATEGY_LABELS,
} from '../../../../utils/anchorLibrary/anchorSortStrategies';

const renderFilters = (overrides = {}) => {
  const props = {
    filters: { ...EMPTY_FILTERS },
    sort: DEFAULT_SORT_STRATEGY,
    onToggleFilter: vi.fn(),
    onSortChange: vi.fn(),
    onClearFilters: vi.fn(),
    ...overrides,
  };
  const utils = render(<AnchorFilters {...props} />);
  return { ...utils, props };
};

// ───────────────────────────────────────────────────────────────────────────
describe('AnchorFilters — render', () => {
  it('renders the 5 filter groups', () => {
    renderFilters();
    expect(screen.getByTestId('anchor-filter-group-styles')).toBeInTheDocument();
    expect(screen.getByTestId('anchor-filter-group-streets')).toBeInTheDocument();
    expect(screen.getByTestId('anchor-filter-group-polarities')).toBeInTheDocument();
    expect(screen.getByTestId('anchor-filter-group-tiers')).toBeInTheDocument();
    expect(screen.getByTestId('anchor-filter-group-statuses')).toBeInTheDocument();
  });

  it('renders the 4 style chips (Fish/Nit/LAG/TAG)', () => {
    renderFilters();
    const group = screen.getByTestId('anchor-filter-group-styles');
    const chips = group.querySelectorAll('button');
    expect(chips.length).toBe(4);
    const labels = Array.from(chips).map((c) => c.textContent);
    expect(labels).toEqual(['Fish', 'Nit', 'LAG', 'TAG']);
  });

  it('renders the 3 street chips (Flop/Turn/River)', () => {
    renderFilters();
    const group = screen.getByTestId('anchor-filter-group-streets');
    const chips = group.querySelectorAll('button');
    expect(Array.from(chips).map((c) => c.textContent)).toEqual(['Flop', 'Turn', 'River']);
  });

  it('renders the 5 polarity chips', () => {
    renderFilters();
    const group = screen.getByTestId('anchor-filter-group-polarities');
    const chips = group.querySelectorAll('button');
    expect(Array.from(chips).map((c) => c.textContent)).toEqual([
      'Overfold',
      'Overbluff',
      'Overcall',
      'Over-raise',
      'Under-defend',
    ]);
  });

  it('renders the 5 status chips', () => {
    renderFilters();
    const group = screen.getByTestId('anchor-filter-group-statuses');
    const chips = group.querySelectorAll('button');
    expect(Array.from(chips).map((c) => c.textContent)).toEqual([
      'Active',
      'Expiring',
      'Retired',
      'Suppressed',
      'Candidate',
    ]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('AnchorFilters — chip interaction', () => {
  it('aria-pressed reflects selection', () => {
    renderFilters({ filters: { ...EMPTY_FILTERS, statuses: ['active'] } });
    const activeChip = screen.getByRole('button', { name: 'Active' });
    expect(activeChip).toHaveAttribute('aria-pressed', 'true');
    const retiredChip = screen.getByRole('button', { name: 'Retired' });
    expect(retiredChip).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking a chip dispatches onToggleFilter(group, value)', () => {
    const { props } = renderFilters();
    fireEvent.click(screen.getByRole('button', { name: 'Active' }));
    expect(props.onToggleFilter).toHaveBeenCalledWith('statuses', 'active');
  });

  it('toggle uses tier numeric value for tier chips', () => {
    const { props } = renderFilters();
    fireEvent.click(screen.getByRole('button', { name: 'Tier 2' }));
    expect(props.onToggleFilter).toHaveBeenCalledWith('tiers', '2');
  });

  it('toggle uses lowercase polarity value for polarity chips', () => {
    const { props } = renderFilters();
    fireEvent.click(screen.getByRole('button', { name: 'Over-raise' }));
    expect(props.onToggleFilter).toHaveBeenCalledWith('polarities', 'over-raise');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('AnchorFilters — sort dropdown', () => {
  it('renders all 3 sort strategies', () => {
    renderFilters();
    const select = screen.getByLabelText(/Sort order/i);
    const options = select.querySelectorAll('option');
    expect(options.length).toBe(3);
  });

  it('options labels match SORT_STRATEGY_LABELS', () => {
    renderFilters();
    const select = screen.getByLabelText(/Sort order/i);
    const options = Array.from(select.querySelectorAll('option'));
    for (const opt of options) {
      const expected = SORT_STRATEGY_LABELS[opt.value];
      expect(opt.textContent).toBe(expected);
    }
  });

  it('does NOT render a "biggest edge" sort option (AP-01)', () => {
    renderFilters();
    const select = screen.getByLabelText(/Sort order/i);
    const optionTexts = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    for (const txt of optionTexts) {
      expect(txt).not.toMatch(/edge/i);
      expect(txt).not.toMatch(/biggest/i);
      expect(txt).not.toMatch(/highest confidence/i);
    }
  });

  it('changing the dropdown dispatches onSortChange with the new value', () => {
    const { props } = renderFilters();
    const select = screen.getByLabelText(/Sort order/i);
    fireEvent.change(select, { target: { value: 'sample-size' } });
    expect(props.onSortChange).toHaveBeenCalledWith('sample-size');
  });

  it('falls back to the first valid strategy when given an invalid sort prop', () => {
    renderFilters({ sort: 'biggest-edge' });
    const select = screen.getByLabelText(/Sort order/i);
    expect(select.value).toBe(VALID_SORT_STRATEGIES[0]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('AnchorFilters — clear filters button', () => {
  it('does NOT render the Clear filters button when no filters active', () => {
    renderFilters();
    expect(screen.queryByTestId('anchor-filters-clear')).toBeNull();
  });

  it('renders the Clear filters button when at least one filter active', () => {
    renderFilters({ filters: { ...EMPTY_FILTERS, statuses: ['active'] } });
    expect(screen.getByTestId('anchor-filters-clear')).toBeInTheDocument();
  });

  it('clicking Clear filters dispatches onClearFilters', () => {
    const { props } = renderFilters({ filters: { ...EMPTY_FILTERS, polarities: ['overfold'] } });
    fireEvent.click(screen.getByTestId('anchor-filters-clear'));
    expect(props.onClearFilters).toHaveBeenCalled();
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('AnchorFilters — defensive', () => {
  it('does not crash when filters is undefined', () => {
    expect(() => render(<AnchorFilters sort={DEFAULT_SORT_STRATEGY} />)).not.toThrow();
  });

  it('does not crash when callbacks are missing', () => {
    render(<AnchorFilters filters={EMPTY_FILTERS} sort={DEFAULT_SORT_STRATEGY} />);
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Active' }))).not.toThrow();
  });
});
