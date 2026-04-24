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

describe('DrillExit — inline DrillReview (Session 16 Q2 option D)', () => {
  const drillSession = {
    sessionId: 'drill-1',
    startedAt: '2026-04-23T00:00:00Z',
    cardsShown: [
      { cardIndex: 0, assumptionId: 'a1', heroAnswered: 'correct', dialOverride: null, retryQueued: false },
      { cardIndex: 1, assumptionId: 'a2', heroAnswered: 'retry-later', dialOverride: null, retryQueued: true },
    ],
  };
  const assumptions = {
    a1: { id: 'a1', villainId: 'v42', narrative: { citationShort: 'a1-short', humanStatement: 'a1-human' } },
    a2: { id: 'a2', villainId: 'v42', narrative: { citationShort: 'a2-short', humanStatement: 'a2-human' } },
  };

  it('does NOT show toggle when drillSession is missing', () => {
    render(<DrillExit {...baseProps} />);
    expect(screen.queryByTestId('drill-exit-toggle-review')).not.toBeInTheDocument();
  });

  it('does NOT show toggle when cardsShown is empty', () => {
    render(<DrillExit
      {...baseProps}
      drillSession={{ sessionId: 'x', startedAt: '', cardsShown: [] }}
      assumptions={{}}
    />);
    expect(screen.queryByTestId('drill-exit-toggle-review')).not.toBeInTheDocument();
  });

  it('shows toggle button when drillSession has cards', () => {
    render(<DrillExit {...baseProps} drillSession={drillSession} assumptions={assumptions} />);
    expect(screen.getByTestId('drill-exit-toggle-review')).toBeInTheDocument();
  });

  it('toggle button starts collapsed, inline review hidden', () => {
    render(<DrillExit {...baseProps} drillSession={drillSession} assumptions={assumptions} />);
    expect(screen.getByTestId('drill-exit-toggle-review').textContent).toMatch(/See full review/i);
    expect(screen.queryByTestId('drill-exit-inline-review')).not.toBeInTheDocument();
  });

  it('clicking toggle expands inline DrillReview', () => {
    render(<DrillExit {...baseProps} drillSession={drillSession} assumptions={assumptions} />);
    fireEvent.click(screen.getByTestId('drill-exit-toggle-review'));
    expect(screen.getByTestId('drill-exit-inline-review')).toBeInTheDocument();
    expect(screen.getByTestId('drill-exit-toggle-review').textContent).toMatch(/Hide review/i);
  });

  it('clicking toggle again collapses inline DrillReview', () => {
    render(<DrillExit {...baseProps} drillSession={drillSession} assumptions={assumptions} />);
    const toggle = screen.getByTestId('drill-exit-toggle-review');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.queryByTestId('drill-exit-inline-review')).not.toBeInTheDocument();
  });

  it('inline review renders DrillReview stats when expanded', () => {
    render(<DrillExit
      {...baseProps}
      sessionSummary={{ correct: 1, retryLater: 1, totalCards: 2, mood: 'neutral', hitRate: 0.5 }}
      drillSession={drillSession}
      assumptions={assumptions}
    />);
    fireEvent.click(screen.getByTestId('drill-exit-toggle-review'));
    expect(screen.getByTestId('drill-review-stats')).toBeInTheDocument();
    expect(screen.getByTestId('drill-review-rows')).toBeInTheDocument();
  });

  it('toggle button touch-target ≥ 44', () => {
    render(<DrillExit {...baseProps} drillSession={drillSession} assumptions={assumptions} />);
    expect(screen.getByTestId('drill-exit-toggle-review').style.minHeight).toBe('48px');
  });
});
