// @vitest-environment jsdom
/**
 * AnchorEmptyState.test.jsx — render coverage for all variants.
 *
 * EAL Phase 6 — Session 18 (S18) + Session 19 (S19, zero-filter-matches).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnchorEmptyState } from '../AnchorEmptyState';
import { ANCHOR_LIBRARY_UNLOCK_THRESHOLD } from '../../../../constants/anchorLibraryConstants';

describe('AnchorEmptyState — newcomer variant', () => {
  it('renders progress text with default threshold', () => {
    render(<AnchorEmptyState variant="newcomer" handsSeen={5} />);
    expect(
      screen.getByText(`Anchors unlock after ${ANCHOR_LIBRARY_UNLOCK_THRESHOLD} hands — your progress: 5 / ${ANCHOR_LIBRARY_UNLOCK_THRESHOLD}`),
    ).toBeInTheDocument();
  });

  it('uses editor-tone explainer (not gamified)', () => {
    render(<AnchorEmptyState variant="newcomer" handsSeen={0} />);
    expect(
      screen.getByText(/library activates once enough hands have been reviewed/i),
    ).toBeInTheDocument();
  });

  it('handles zero hands seen', () => {
    render(<AnchorEmptyState variant="newcomer" handsSeen={0} />);
    expect(
      screen.getByText(new RegExp(`progress: 0 / ${ANCHOR_LIBRARY_UNLOCK_THRESHOLD}`)),
    ).toBeInTheDocument();
  });

  it('clamps progress at threshold (no over-progress)', () => {
    render(<AnchorEmptyState variant="newcomer" handsSeen={9999} />);
    expect(
      screen.getByText(new RegExp(`progress: ${ANCHOR_LIBRARY_UNLOCK_THRESHOLD} / ${ANCHOR_LIBRARY_UNLOCK_THRESHOLD}`)),
    ).toBeInTheDocument();
  });

  it('respects threshold prop override', () => {
    render(<AnchorEmptyState variant="newcomer" handsSeen={2} threshold={10} />);
    expect(screen.getByText(/Anchors unlock after 10 hands — your progress: 2 \/ 10/)).toBeInTheDocument();
  });

  it('clamps negative handsSeen to 0 (defensive)', () => {
    render(<AnchorEmptyState variant="newcomer" handsSeen={-3} threshold={10} />);
    expect(screen.getByText(/progress: 0 \/ 10/)).toBeInTheDocument();
  });

  it('exposes data-variant="newcomer" for visual regression', () => {
    render(<AnchorEmptyState variant="newcomer" handsSeen={0} />);
    expect(screen.getByTestId('anchor-library-empty-state')).toHaveAttribute('data-variant', 'newcomer');
  });

  it('uses role="status" for assistive tech announcement', () => {
    render(<AnchorEmptyState variant="newcomer" handsSeen={0} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does NOT render any progress bar element (red line #5 — no gamification)', () => {
    const { container } = render(<AnchorEmptyState variant="newcomer" handsSeen={5} />);
    expect(container.querySelector('progress')).toBeNull();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });
});

describe('AnchorEmptyState — zero-filter-matches variant (S19)', () => {
  it('renders the "No anchors match your filters" headline', () => {
    render(<AnchorEmptyState variant="zero-filter-matches" onClearFilters={() => {}} />);
    expect(screen.getByText(/No anchors match your filters/i)).toBeInTheDocument();
  });

  it('renders an active "Clear filters" button', () => {
    render(<AnchorEmptyState variant="zero-filter-matches" onClearFilters={() => {}} />);
    expect(screen.getByRole('button', { name: /Clear all filters/i })).toBeInTheDocument();
  });

  it('Clear filters button dispatches onClearFilters', () => {
    const onClearFilters = vi.fn();
    render(<AnchorEmptyState variant="zero-filter-matches" onClearFilters={onClearFilters} />);
    fireEvent.click(screen.getByRole('button', { name: /Clear all filters/i }));
    expect(onClearFilters).toHaveBeenCalled();
  });

  it('does NOT crash when onClearFilters is missing', () => {
    render(<AnchorEmptyState variant="zero-filter-matches" />);
    expect(() => fireEvent.click(screen.getByRole('button', { name: /Clear all filters/i }))).not.toThrow();
  });

  it('exposes data-variant="zero-filter-matches"', () => {
    render(<AnchorEmptyState variant="zero-filter-matches" onClearFilters={() => {}} />);
    expect(screen.getByTestId('anchor-library-empty-state')).toHaveAttribute('data-variant', 'zero-filter-matches');
  });
});

describe('AnchorEmptyState — zero-anchors variant', () => {
  it('renders the matter-of-fact "no anchors yet" headline', () => {
    render(<AnchorEmptyState variant="zero-anchors" />);
    expect(screen.getByText(/No anchors in your library yet/i)).toBeInTheDocument();
  });

  it('explains that the matcher will populate it', () => {
    render(<AnchorEmptyState variant="zero-anchors" />);
    expect(screen.getByText(/matcher detects patterns/i)).toBeInTheDocument();
  });

  it('does NOT render gamified or engagement copy (AP-04 / red line #5)', () => {
    render(<AnchorEmptyState variant="zero-anchors" />);
    // Forbidden phrases per persona red line #7 + anti-pattern AP-06.
    expect(screen.queryByText(/keep going/i)).toBeNull();
    expect(screen.queryByText(/streak/i)).toBeNull();
    expect(screen.queryByText(/score/i)).toBeNull();
    expect(screen.queryByText(/grade/i)).toBeNull();
  });

  it('exposes data-variant="zero-anchors"', () => {
    render(<AnchorEmptyState variant="zero-anchors" />);
    expect(screen.getByTestId('anchor-library-empty-state')).toHaveAttribute('data-variant', 'zero-anchors');
  });
});
