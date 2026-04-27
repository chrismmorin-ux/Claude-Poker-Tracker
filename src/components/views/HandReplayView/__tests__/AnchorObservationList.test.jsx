// @vitest-environment jsdom
/**
 * AnchorObservationList.test.jsx
 *
 * EAL Phase 6 Stream D B3 — Session 16.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AnchorObservationList, formatRelativeTime } from '../AnchorObservationList';

const FIXED_NOW = new Date('2026-04-27T12:00:00.000Z').getTime();

const obs = (overrides = {}) => ({
  id: 'obs:hand-int:0',
  handId: 'hand-int',
  ownerTags: ['villain-overfold'],
  createdAt: '2026-04-27T11:55:00.000Z', // 5 min ago
  origin: 'owner-captured',
  contributesToCalibration: true,
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────
// formatRelativeTime — pure util
// ───────────────────────────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  it('returns "just now" for sub-45-second deltas', () => {
    expect(formatRelativeTime('2026-04-27T11:59:30.000Z', FIXED_NOW)).toBe('just now');
  });

  it('returns minute granularity', () => {
    expect(formatRelativeTime('2026-04-27T11:55:00.000Z', FIXED_NOW)).toBe('5m ago');
  });

  it('returns hour granularity', () => {
    expect(formatRelativeTime('2026-04-27T09:00:00.000Z', FIXED_NOW)).toBe('3h ago');
  });

  it('returns day granularity', () => {
    expect(formatRelativeTime('2026-04-25T12:00:00.000Z', FIXED_NOW)).toBe('2d ago');
  });

  it('returns week granularity for 7..29 days', () => {
    expect(formatRelativeTime('2026-04-13T12:00:00.000Z', FIXED_NOW)).toBe('2w ago');
  });

  it('falls back to ISO date beyond ~30 days', () => {
    expect(formatRelativeTime('2026-01-15T08:00:00.000Z', FIXED_NOW)).toBe('2026-01-15');
  });

  it('returns empty string for invalid input', () => {
    expect(formatRelativeTime(undefined, FIXED_NOW)).toBe('');
    expect(formatRelativeTime('not a date', FIXED_NOW)).toBe('');
    expect(formatRelativeTime('', FIXED_NOW)).toBe('');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Empty state
// ───────────────────────────────────────────────────────────────────────────

describe('empty state', () => {
  it('renders nothing when observations is empty array', () => {
    const { container } = render(<AnchorObservationList observations={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when observations is null/undefined', () => {
    const { container: a } = render(<AnchorObservationList observations={null} />);
    expect(a.firstChild).toBeNull();
    const { container: b } = render(<AnchorObservationList observations={undefined} />);
    expect(b.firstChild).toBeNull();
  });

  it('renders nothing when all observations are matcher-system origin', () => {
    const items = [
      obs({ id: 'obs:1', origin: 'matcher-system' }),
      obs({ id: 'obs:2', origin: 'matcher-system' }),
    ];
    const { container } = render(<AnchorObservationList observations={items} />);
    expect(container.firstChild).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Render
// ───────────────────────────────────────────────────────────────────────────

describe('render', () => {
  it('renders one row per observation', () => {
    const items = [
      obs({ id: 'obs:1', ownerTags: ['villain-overfold'] }),
      obs({ id: 'obs:2', ownerTags: ['unusual-sizing'] }),
    ];
    render(<AnchorObservationList observations={items} nowFn={() => FIXED_NOW} />);
    expect(screen.getByTestId('anchor-observation-row-obs:1')).toBeInTheDocument();
    expect(screen.getByTestId('anchor-observation-row-obs:2')).toBeInTheDocument();
  });

  it('shows the first tag in the row header', () => {
    const items = [obs({ id: 'obs:1', ownerTags: ['villain-overfold', 'unusual-sizing'] })];
    render(<AnchorObservationList observations={items} nowFn={() => FIXED_NOW} />);
    // Header is the expand button (aria-expanded=false when collapsed)
    const header = screen.getByRole('button', { expanded: false });
    expect(header).toHaveTextContent(/villain-overfold/);
  });

  it('renders relative time ("5m ago")', () => {
    const items = [obs({ id: 'obs:1', createdAt: '2026-04-27T11:55:00.000Z' })];
    render(<AnchorObservationList observations={items} nowFn={() => FIXED_NOW} />);
    // Use getAllByText since multiple texts may match; assert at least one match
    expect(screen.getByText(/5m ago/)).toBeInTheDocument();
  });

  it('renders all tags as pills', () => {
    const items = [obs({ id: 'obs:1', ownerTags: ['villain-overfold', 'unusual-sizing'] })];
    render(<AnchorObservationList observations={items} nowFn={() => FIXED_NOW} />);
    // Tag pills are buttons with aria-label "Filter by tag X"
    expect(screen.getByLabelText('Filter by tag villain-overfold')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by tag unusual-sizing')).toBeInTheDocument();
  });

  it('marks incognito observations visibly + via data-incognito', () => {
    const items = [
      obs({ id: 'obs:1', contributesToCalibration: false }),
      obs({ id: 'obs:2', contributesToCalibration: true }),
    ];
    render(<AnchorObservationList observations={items} nowFn={() => FIXED_NOW} />);

    expect(screen.getByTestId('anchor-observation-row-obs:1'))
      .toHaveAttribute('data-incognito', 'true');
    expect(screen.getByTestId('anchor-observation-row-obs:2'))
      .toHaveAttribute('data-incognito', 'false');
    // Visible 'incognito' marker on row 1's time text
    const row1 = screen.getByTestId('anchor-observation-row-obs:1');
    expect(within(row1).getByText(/incognito/)).toBeInTheDocument();
  });

  it('filters out matcher-system observations defensively (AP-08)', () => {
    const items = [
      obs({ id: 'obs:1', origin: 'owner-captured' }),
      obs({ id: 'obs:2', origin: 'matcher-system' }),
    ];
    render(<AnchorObservationList observations={items} nowFn={() => FIXED_NOW} />);
    expect(screen.getByTestId('anchor-observation-row-obs:1')).toBeInTheDocument();
    expect(screen.queryByTestId('anchor-observation-row-obs:2')).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Interactions
// ───────────────────────────────────────────────────────────────────────────

describe('row expand / note display', () => {
  it('hides the note by default', () => {
    const items = [obs({ id: 'obs:1', note: 'Hidden by default' })];
    render(<AnchorObservationList observations={items} nowFn={() => FIXED_NOW} />);
    expect(screen.queryByText('Hidden by default')).toBeNull();
  });

  it('shows the note after row tap', () => {
    const items = [obs({ id: 'obs:1', note: 'Reveal me' })];
    render(<AnchorObservationList observations={items} nowFn={() => FIXED_NOW} />);
    const expandButton = screen.getByRole('button', { expanded: false });
    fireEvent.click(expandButton);
    expect(screen.getByText('Reveal me')).toBeInTheDocument();
  });

  it('aria-expanded reflects expand state', () => {
    const items = [obs({ id: 'obs:1', note: 'note text' })];
    render(<AnchorObservationList observations={items} nowFn={() => FIXED_NOW} />);
    const expandButton = screen.getByRole('button', { expanded: false });
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(expandButton);
    expect(expandButton).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('tag pill click', () => {
  it('fires onTagClick with the tag string', () => {
    const onTagClick = vi.fn();
    const items = [obs({ id: 'obs:1', ownerTags: ['villain-overfold'] })];
    render(
      <AnchorObservationList
        observations={items}
        onTagClick={onTagClick}
        nowFn={() => FIXED_NOW}
      />,
    );
    fireEvent.click(screen.getByLabelText('Filter by tag villain-overfold'));
    expect(onTagClick).toHaveBeenCalledWith('villain-overfold');
  });

  it('does not throw when onTagClick is missing', () => {
    const items = [obs({ id: 'obs:1', ownerTags: ['villain-overfold'] })];
    render(<AnchorObservationList observations={items} nowFn={() => FIXED_NOW} />);
    expect(() =>
      fireEvent.click(screen.getByLabelText('Filter by tag villain-overfold')),
    ).not.toThrow();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Soft cap
// ───────────────────────────────────────────────────────────────────────────

describe('soft cap (>10 observations)', () => {
  it('renders only the first 10 + "See all (N)" link', () => {
    const items = Array.from({ length: 13 }, (_, i) => obs({ id: `obs:${i}` }));
    render(<AnchorObservationList observations={items} nowFn={() => FIXED_NOW} />);
    expect(screen.getByTestId('anchor-observation-row-obs:0')).toBeInTheDocument();
    expect(screen.getByTestId('anchor-observation-row-obs:9')).toBeInTheDocument();
    expect(screen.queryByTestId('anchor-observation-row-obs:10')).toBeNull();
    expect(screen.getByRole('button', { name: /See all 13 observations/ })).toBeInTheDocument();
  });

  it('See all link fires onSeeAll with the total count', () => {
    const onSeeAll = vi.fn();
    const items = Array.from({ length: 13 }, (_, i) => obs({ id: `obs:${i}` }));
    render(
      <AnchorObservationList
        observations={items}
        onSeeAll={onSeeAll}
        nowFn={() => FIXED_NOW}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /See all 13 observations/ }));
    expect(onSeeAll).toHaveBeenCalledWith(13);
  });

  it('does not render See all link at exactly 10 observations', () => {
    const items = Array.from({ length: 10 }, (_, i) => obs({ id: `obs:${i}` }));
    render(<AnchorObservationList observations={items} nowFn={() => FIXED_NOW} />);
    expect(screen.queryByRole('button', { name: /See all/ })).toBeNull();
  });
});
