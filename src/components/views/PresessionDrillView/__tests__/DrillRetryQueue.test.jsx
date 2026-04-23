import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DrillRetryQueue } from '../DrillRetryQueue';

const makeCard = (overrides = {}) => ({
  id: 'card-1',
  villainId: 'v42',
  claim: { predicate: 'foldToRiverBet' },
  narrative: { citationShort: 'fold-to-river 17% @ n=52', humanStatement: 'fold-to-river 17%' },
  ...overrides,
});

const defaultProps = {
  retryDeck: [],
  sessionSummary: { correct: 3, totalCards: 5 },
  onReplay: vi.fn(),
  onSkip: vi.fn(),
  onAbandon: vi.fn(),
};

describe('DrillRetryQueue — empty queue', () => {
  it('renders empty message when retryDeck empty', () => {
    render(<DrillRetryQueue {...defaultProps} retryDeck={[]} />);
    expect(screen.getByText(/No cards queued for retry/i)).toBeInTheDocument();
  });

  it('Retry button disabled when empty', () => {
    render(<DrillRetryQueue {...defaultProps} retryDeck={[]} />);
    expect(screen.getByTestId('drill-retry-replay')).toBeDisabled();
  });
});

describe('DrillRetryQueue — populated queue', () => {
  const deck = [
    makeCard({ id: 'c1', villainId: 'v42', narrative: { citationShort: 'fold 17%' } }),
    makeCard({ id: 'c2', villainId: 'v99', narrative: { citationShort: 'cbet 78%' } }),
  ];

  it('renders header + summary', () => {
    render(<DrillRetryQueue {...defaultProps} retryDeck={deck} />);
    expect(screen.getByText(/Retry queue/i)).toBeInTheDocument();
    expect(screen.getByText(/3 of 5 cards correctly/i)).toBeInTheDocument();
  });

  it('lists queued cards', () => {
    render(<DrillRetryQueue {...defaultProps} retryDeck={deck} />);
    expect(screen.getByTestId('drill-retry-list')).toBeInTheDocument();
    expect(screen.getByText(/fold 17%/i)).toBeInTheDocument();
    expect(screen.getByText(/cbet 78%/i)).toBeInTheDocument();
  });

  it('shows correct card count', () => {
    render(<DrillRetryQueue {...defaultProps} retryDeck={deck} />);
    expect(screen.getByText(/2 cards to retry/i)).toBeInTheDocument();
  });

  it('shows singular "card" for count=1', () => {
    render(<DrillRetryQueue {...defaultProps} retryDeck={deck.slice(0, 1)} />);
    expect(screen.getByText(/1 card to retry/i)).toBeInTheDocument();
  });

  it('truncates list at 6 with "more" hint', () => {
    const manyCards = Array.from({ length: 10 }, (_, i) =>
      makeCard({ id: `c${i}`, narrative: { citationShort: `card ${i}` } }));
    render(<DrillRetryQueue {...defaultProps} retryDeck={manyCards} />);
    expect(screen.getByText(/\+ 4 more/i)).toBeInTheDocument();
  });

  it('onReplay fires on Retry button click', () => {
    const spy = vi.fn();
    render(<DrillRetryQueue {...defaultProps} retryDeck={deck} onReplay={spy} />);
    fireEvent.click(screen.getByTestId('drill-retry-replay'));
    expect(spy).toHaveBeenCalled();
  });

  it('onSkip fires on "I\'m ready" click', () => {
    const spy = vi.fn();
    render(<DrillRetryQueue {...defaultProps} retryDeck={deck} onSkip={spy} />);
    fireEvent.click(screen.getByTestId('drill-retry-skip'));
    expect(spy).toHaveBeenCalled();
  });

  it('onAbandon fires on Exit click', () => {
    const spy = vi.fn();
    render(<DrillRetryQueue {...defaultProps} retryDeck={deck} onAbandon={spy} />);
    fireEvent.click(screen.getByTestId('drill-retry-exit'));
    expect(spy).toHaveBeenCalled();
  });
});

describe('DrillRetryQueue — touch target compliance', () => {
  it('Retry button has minHeight ≥ 44', () => {
    render(<DrillRetryQueue {...defaultProps} retryDeck={[makeCard()]} />);
    const btn = screen.getByTestId('drill-retry-replay');
    expect(btn.style.minHeight).toBe('48px');
  });

  it('Skip button has minHeight ≥ 44', () => {
    render(<DrillRetryQueue {...defaultProps} />);
    const btn = screen.getByTestId('drill-retry-skip');
    expect(btn.style.minHeight).toBe('48px');
  });

  it('Exit button has minHeight ≥ 44', () => {
    render(<DrillRetryQueue {...defaultProps} />);
    const btn = screen.getByTestId('drill-retry-exit');
    expect(btn.style.minHeight).toBe('44px');
  });
});
