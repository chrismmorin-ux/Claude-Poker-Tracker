import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DrillFlashcards } from '../DrillFlashcards';

const makeCard = (overrides = {}) => ({
  id: 'v42:foldToRiverBet@river',
  villainId: 'v42',
  claim: { predicate: 'foldToRiverBet' },
  consequence: { deviationType: 'bluff-prune', expectedDividend: { mean: 0.85, sd: 0.15, sharpe: 5.7 } },
  recognizability: { triggerDescription: 'Hero barreled to river, villain has called each street', score: 0.95 },
  narrative: {
    humanStatement: 'Villain folds to river bets only 17% (n=52)',
    citationShort: 'fold-to-river 17% @ n=52',
    citationLong: 'Over 52 river decisions villain folded 9 times.',
    teachingPattern: "When villain has called 2 streets, they're not folding.",
  },
  evidence: { posteriorConfidence: 0.82, sampleSize: 52 },
  quality: { composite: 0.85 },
  operator: { currentDial: 0.75 },
  ...overrides,
});

const defaultProps = {
  cardIndex: 0,
  totalCards: 5,
  currentCard: makeCard(),
  isRevealed: false,
  timeBudgetMinutes: 15,
  onReveal: vi.fn(),
  onAnswer: vi.fn(),
  onSetDial: vi.fn(),
  onAbandon: vi.fn(),
};

describe('DrillFlashcards — unrevealed state', () => {
  it('renders card count and villain', () => {
    render(<DrillFlashcards {...defaultProps} />);
    expect(screen.getByText(/Card 1 of 5/i)).toBeInTheDocument();
    expect(screen.getByText('v42')).toBeInTheDocument();
  });

  it('renders predicate + deviation labels in header', () => {
    render(<DrillFlashcards {...defaultProps} />);
    expect(screen.getByText(/Fold to river/i)).toBeInTheDocument();
    expect(screen.getByText(/Drop bluffs/i)).toBeInTheDocument();
  });

  it('renders spot description', () => {
    render(<DrillFlashcards {...defaultProps} />);
    expect(screen.getByText(/Hero barreled to river/i)).toBeInTheDocument();
  });

  it('shows Reveal button; hides answer buttons', () => {
    render(<DrillFlashcards {...defaultProps} isRevealed={false} />);
    expect(screen.getByTestId('drill-flashcards-reveal')).toBeInTheDocument();
    expect(screen.queryByTestId('drill-flashcards-answer-row')).not.toBeInTheDocument();
  });

  it('onReveal fires when Reveal button is clicked', () => {
    const spy = vi.fn();
    render(<DrillFlashcards {...defaultProps} onReveal={spy} />);
    fireEvent.click(screen.getByTestId('drill-flashcards-reveal'));
    expect(spy).toHaveBeenCalled();
  });
});

describe('DrillFlashcards — revealed state', () => {
  it('hides Reveal button; shows answer buttons', () => {
    render(<DrillFlashcards {...defaultProps} isRevealed={true} />);
    expect(screen.queryByTestId('drill-flashcards-reveal')).not.toBeInTheDocument();
    expect(screen.getByTestId('drill-flashcards-answer-row')).toBeInTheDocument();
  });

  it('shows three answer buttons: Got it, Retry later, Skip', () => {
    render(<DrillFlashcards {...defaultProps} isRevealed={true} />);
    expect(screen.getByTestId('drill-flashcards-got-it')).toBeInTheDocument();
    expect(screen.getByTestId('drill-flashcards-retry-later')).toBeInTheDocument();
    expect(screen.getByTestId('drill-flashcards-skip')).toBeInTheDocument();
  });

  it('onAnswer fires with "correct" when Got it clicked', () => {
    const spy = vi.fn();
    render(<DrillFlashcards {...defaultProps} isRevealed={true} onAnswer={spy} />);
    fireEvent.click(screen.getByTestId('drill-flashcards-got-it'));
    expect(spy).toHaveBeenCalledWith('correct');
  });

  it('onAnswer fires with "retry-later" when Retry clicked', () => {
    const spy = vi.fn();
    render(<DrillFlashcards {...defaultProps} isRevealed={true} onAnswer={spy} />);
    fireEvent.click(screen.getByTestId('drill-flashcards-retry-later'));
    expect(spy).toHaveBeenCalledWith('retry-later');
  });

  it('onAnswer fires with "skip" when Skip clicked', () => {
    const spy = vi.fn();
    render(<DrillFlashcards {...defaultProps} isRevealed={true} onAnswer={spy} />);
    fireEvent.click(screen.getByTestId('drill-flashcards-skip'));
    expect(spy).toHaveBeenCalledWith('skip');
  });

  it('renders the DrillReveal citation compact form', () => {
    render(<DrillFlashcards {...defaultProps} isRevealed={true} />);
    expect(screen.getByTestId('drill-reveal-citation-compact')).toBeInTheDocument();
    expect(screen.getByText(/fold-to-river 17%/i)).toBeInTheDocument();
  });
});

describe('DrillFlashcards — exit affordance', () => {
  it('shows Exit button', () => {
    render(<DrillFlashcards {...defaultProps} />);
    expect(screen.getByTestId('drill-flashcards-exit')).toBeInTheDocument();
  });

  it('onAbandon fires on Exit click', () => {
    const spy = vi.fn();
    render(<DrillFlashcards {...defaultProps} onAbandon={spy} />);
    fireEvent.click(screen.getByTestId('drill-flashcards-exit'));
    expect(spy).toHaveBeenCalled();
  });
});

describe('DrillFlashcards — empty card guard', () => {
  it('renders fallback when currentCard is null', () => {
    render(<DrillFlashcards {...defaultProps} currentCard={null} />);
    expect(screen.getByText(/No card available/i)).toBeInTheDocument();
  });
});

describe('DrillFlashcards — DrillReveal dial + expand', () => {
  it('expands citation when why → is clicked', () => {
    render(<DrillFlashcards {...defaultProps} isRevealed={true} />);
    expect(screen.queryByTestId('drill-reveal-citation-expanded')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('drill-reveal-expand'));
    expect(screen.getByTestId('drill-reveal-citation-expanded')).toBeInTheDocument();
  });

  it('renders discrete dial buttons (0 / 0.3 / 0.6 / 0.9 / 1.0)', () => {
    render(<DrillFlashcards {...defaultProps} isRevealed={true} />);
    expect(screen.getByTestId('drill-reveal-dial-0')).toBeInTheDocument();
    expect(screen.getByTestId('drill-reveal-dial-0.3')).toBeInTheDocument();
    expect(screen.getByTestId('drill-reveal-dial-0.6')).toBeInTheDocument();
    expect(screen.getByTestId('drill-reveal-dial-0.9')).toBeInTheDocument();
    expect(screen.getByTestId('drill-reveal-dial-1')).toBeInTheDocument();
  });

  it('onSetDial fires when a dial button is clicked', () => {
    const spy = vi.fn();
    render(<DrillFlashcards {...defaultProps} isRevealed={true} onSetDial={spy} />);
    fireEvent.click(screen.getByTestId('drill-reveal-dial-0'));
    expect(spy).toHaveBeenCalledWith(0);
  });
});
