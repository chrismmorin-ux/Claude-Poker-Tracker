import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DrillExit } from '../DrillExit';

const makeCard = (overrides = {}) => ({
  id: 'card-1',
  villainId: 'v42',
  claim: { predicate: 'foldToRiverBet' },
  narrative: { teachingPattern: 'Station won\'t fold, don\'t bluff.', humanStatement: 'fold-to-river 17%' },
  ...overrides,
});

const baseProps = {
  deck: [],
  retryDeck: [],
  sessionSummary: { correct: 0, retryLater: 0, totalCards: 0, mood: 'neutral' },
  onStartSession: vi.fn(),
  onBackToEntry: vi.fn(),
};

describe('DrillExit — mood-aware framing (Gate 2 Stage C)', () => {
  it('upbeat mood headline', () => {
    render(<DrillExit {...baseProps} sessionSummary={{ correct: 8, retryLater: 1, totalCards: 10, mood: 'upbeat' }} />);
    expect(screen.getByTestId('drill-exit-headline').textContent).toMatch(/dialed in/i);
  });

  it('neutral mood headline', () => {
    render(<DrillExit {...baseProps} sessionSummary={{ correct: 3, retryLater: 2, totalCards: 5, mood: 'neutral' }} />);
    expect(screen.getByTestId('drill-exit-headline').textContent).toMatch(/ready/i);
  });

  it('encouraging mood headline (NOT punishing — Gate 2 Stage C)', () => {
    render(<DrillExit {...baseProps} sessionSummary={{ correct: 1, retryLater: 3, totalCards: 5, mood: 'encouraging' }} />);
    const headline = screen.getByTestId('drill-exit-headline').textContent;
    expect(headline).toMatch(/take your time/i);
    // Verify absence of punishing language
    expect(headline).not.toMatch(/wrong|failed|poor|bad/i);
  });

  it('subhead in upbeat mood cites hit count', () => {
    render(<DrillExit {...baseProps} sessionSummary={{ correct: 5, retryLater: 0, totalCards: 5, mood: 'upbeat' }} />);
    expect(screen.getByTestId('drill-exit-subhead').textContent).toMatch(/5 of 5 cards correct/i);
  });

  it('subhead in encouraging mood emphasizes reps, not failure', () => {
    render(<DrillExit {...baseProps} sessionSummary={{ correct: 1, retryLater: 2, totalCards: 5, mood: 'encouraging' }} />);
    const subhead = screen.getByTestId('drill-exit-subhead').textContent;
    expect(subhead).toMatch(/Recognition takes reps/i);
  });
});

describe('DrillExit — watchlist', () => {
  it('renders empty-state when both decks empty', () => {
    render(<DrillExit {...baseProps} deck={[]} retryDeck={[]} />);
    expect(screen.getByText(/No patterns to flag/i)).toBeInTheDocument();
  });

  it('combines primary deck + retry deck into watchlist', () => {
    const primary = [makeCard({ id: 'p1', narrative: { teachingPattern: 'Pattern P1' } })];
    const retry = [makeCard({ id: 'r1', narrative: { teachingPattern: 'Pattern R1' } })];
    render(<DrillExit {...baseProps} deck={primary} retryDeck={retry} />);
    const list = screen.getByTestId('drill-exit-watchlist');
    expect(list.textContent).toMatch(/Pattern P1/);
    expect(list.textContent).toMatch(/Pattern R1/);
  });

  it('truncates watchlist at 5 entries', () => {
    const cards = Array.from({ length: 8 }, (_, i) =>
      makeCard({ id: `c${i}`, narrative: { teachingPattern: `P${i}` } }));
    render(<DrillExit {...baseProps} deck={cards} />);
    const list = screen.getByTestId('drill-exit-watchlist');
    const items = list.querySelectorAll('li');
    expect(items.length).toBe(5);
  });
});

describe('DrillExit — CTAs', () => {
  it('Start session button fires onStartSession', () => {
    const spy = vi.fn();
    render(<DrillExit {...baseProps} onStartSession={spy} />);
    fireEvent.click(screen.getByTestId('drill-exit-start-session'));
    expect(spy).toHaveBeenCalled();
  });

  it('Back-to-entry button fires onBackToEntry', () => {
    const spy = vi.fn();
    render(<DrillExit {...baseProps} onBackToEntry={spy} />);
    fireEvent.click(screen.getByTestId('drill-exit-back-to-entry'));
    expect(spy).toHaveBeenCalled();
  });

  it('CTAs have touch-target ≥ 44', () => {
    render(<DrillExit {...baseProps} />);
    expect(screen.getByTestId('drill-exit-start-session').style.minHeight).toBe('48px');
    expect(screen.getByTestId('drill-exit-back-to-entry').style.minHeight).toBe('48px');
  });
});
