// @vitest-environment jsdom
/**
 * StalenessBanner.test.jsx — passive amber banner per surface spec §StalenessBanner.
 *
 * PRF Phase 5 — Session 22 (PRF-G5-UI).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StalenessBanner } from '../StalenessBanner';

describe('StalenessBanner — render', () => {
  it('renders when staleCount > 0', () => {
    render(
      <StalenessBanner
        staleCount={3}
        batchCardCount={15}
        batchPrintedAt="2026-04-24T00:00:00Z"
        onReviewStale={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('returns null when staleCount is 0', () => {
    const { container } = render(
      <StalenessBanner
        staleCount={0}
        batchCardCount={15}
        onReviewStale={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when staleCount is negative', () => {
    const { container } = render(
      <StalenessBanner staleCount={-1} onReviewStale={vi.fn()} onDismiss={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when staleCount is non-number', () => {
    const { container } = render(
      <StalenessBanner staleCount={null} onReviewStale={vi.fn()} onDismiss={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the spec-format copy "Your YYYY-MM-DD batch: M of N current, K stale"', () => {
    render(
      <StalenessBanner
        staleCount={3}
        batchCardCount={15}
        batchPrintedAt="2026-04-24T00:00:00Z"
        onReviewStale={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    const banner = screen.getByRole('status');
    expect(banner.textContent).toMatch(/Your 2026-04-24 batch:/);
    expect(banner.textContent).toMatch(/12 of 15/);
    expect(banner.textContent).toMatch(/3 stale/);
  });

  it('renders batch label when provided', () => {
    render(
      <StalenessBanner
        staleCount={2}
        batchCardCount={10}
        batchPrintedAt="2026-04-24T00:00:00Z"
        batchLabel="home-game-prep"
        onReviewStale={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByRole('status').textContent).toMatch(/"home-game-prep"/);
  });

  it('falls back to "Your latest batch" when printedAt is missing or invalid', () => {
    render(
      <StalenessBanner
        staleCount={3}
        batchCardCount={15}
        onReviewStale={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByRole('status').textContent).toMatch(/Your latest batch/);
  });

  it('uses singular form when batchCardCount === 1', () => {
    render(
      <StalenessBanner
        staleCount={1}
        batchCardCount={1}
        batchPrintedAt="2026-04-24T00:00:00Z"
        onReviewStale={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    // "0 of 1 card current" — note "card" not "cards"
    expect(screen.getByRole('status').textContent).toMatch(/0 of 1 card current/);
  });

  it('exposes data-stale-count attribute for CI introspection', () => {
    const { container } = render(
      <StalenessBanner
        staleCount={5}
        batchCardCount={20}
        onReviewStale={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(container.querySelector('.refresher-staleness-banner')).toHaveAttribute(
      'data-stale-count',
      '5'
    );
  });
});

describe('StalenessBanner — accessibility', () => {
  it('has role="status" and aria-live="polite"', () => {
    render(
      <StalenessBanner
        staleCount={3}
        batchCardCount={15}
        onReviewStale={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    const banner = screen.getByRole('status');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });

  it('Review + Dismiss buttons have minHeight ≥ 44px (H-ML06)', () => {
    render(
      <StalenessBanner
        staleCount={3}
        batchCardCount={15}
        onReviewStale={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/Review stale cards/)).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByLabelText(/Dismiss staleness banner/)).toHaveStyle({ minHeight: '44px' });
  });
});

describe('StalenessBanner — handlers', () => {
  it('Review stale cards button fires onReviewStale', () => {
    const onReviewStale = vi.fn();
    render(
      <StalenessBanner
        staleCount={3}
        batchCardCount={15}
        onReviewStale={onReviewStale}
        onDismiss={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText(/Review stale cards/));
    expect(onReviewStale).toHaveBeenCalledTimes(1);
  });

  it('Dismiss button fires onDismiss', () => {
    const onDismiss = vi.fn();
    render(
      <StalenessBanner
        staleCount={3}
        batchCardCount={15}
        onReviewStale={vi.fn()}
        onDismiss={onDismiss}
      />
    );
    fireEvent.click(screen.getByLabelText(/Dismiss staleness banner/));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('handlers are tolerant of missing callbacks (defensive)', () => {
    render(<StalenessBanner staleCount={3} batchCardCount={15} />);
    // Clicking should not throw even though onReviewStale + onDismiss are undefined
    expect(() => fireEvent.click(screen.getByLabelText(/Review stale cards/))).not.toThrow();
    expect(() => fireEvent.click(screen.getByLabelText(/Dismiss staleness banner/))).not.toThrow();
  });
});

describe('StalenessBanner — copy discipline (CD-1 factual; AP-PRF-03 no streaks)', () => {
  it('does not contain streak / "you\'ve printed N times" / "consecutive" prose', () => {
    render(
      <StalenessBanner
        staleCount={3}
        batchCardCount={15}
        batchPrintedAt="2026-04-24T00:00:00Z"
        onReviewStale={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    const text = screen.getByRole('status').textContent || '';
    expect(text).not.toMatch(/streak/i);
    expect(text).not.toMatch(/consecutive/i);
    expect(text).not.toMatch(/you'?ve printed/i);
    expect(text).not.toMatch(/days since/i);
  });
});
