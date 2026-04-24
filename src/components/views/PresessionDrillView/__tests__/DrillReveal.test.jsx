import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DrillReveal } from '../DrillReveal';

const makeCard = (overrides = {}) => ({
  id: 'v42:foldToRiverBet@river',
  villainId: 'v42',
  claim: { predicate: 'foldToRiverBet' },
  consequence: {
    deviationType: 'bluff-prune',
    expectedDividend: { mean: 0.85, sd: 0.15, sharpe: 5.7 },
  },
  recognizability: { triggerDescription: 'Hero barreled to river', score: 0.95 },
  narrative: {
    humanStatement: 'Villain folds to river bets only 17%',
    citationShort: 'fold-to-river 17% @ n=52',
    citationLong: 'Over 52 river decisions...',
    teachingPattern: "When villain has called every street, they're not folding.",
  },
  evidence: { posteriorConfidence: 0.85, sampleSize: 52 },
  quality: { composite: 0.85 },
  operator: { currentDial: 0.6 },
  ...overrides,
});

const makeCitedDecision = (overrides = {}) => ({
  baselineAction: { action: 'bet', ev: 1.5, sizing: 0.75 },
  recommendedAction: { action: 'check', ev: 2.1, sizing: null },
  dividend: 0.6,
  citations: [],
  dialPositions: { 'v42:foldToRiverBet@river': 0.6 },
  blend: 0.65,
  emotionalState: null,
  contestability: { alternateDials: [] },
  surface: 'drill',
  source: 'synthesized',
  node: {
    display: { street: 'river', texture: 'wet', position: 'IP', style: 'Fish' },
  },
  ...overrides,
});

describe('DrillReveal — loading state', () => {
  it('renders loading skeleton when citedDecision is missing', () => {
    render(<DrillReveal card={makeCard()} citedDecision={null} onSetDial={vi.fn()} />);
    expect(screen.getByTestId('drill-reveal-loading')).toBeInTheDocument();
    expect(screen.getByText(/Computing tonight's spot/)).toBeInTheDocument();
  });

  it('renders loading skeleton when citedDecision.loading=true', () => {
    render(
      <DrillReveal card={makeCard()} citedDecision={{ loading: true }} onSetDial={vi.fn()} />,
    );
    expect(screen.getByTestId('drill-reveal-loading')).toBeInTheDocument();
  });

  it('renders compact citation + dial even while loading', () => {
    render(<DrillReveal card={makeCard()} citedDecision={null} onSetDial={vi.fn()} />);
    expect(screen.getByTestId('drill-reveal-citation-compact')).toBeInTheDocument();
    expect(screen.getByTestId('drill-reveal-dial')).toBeInTheDocument();
  });
});

describe('DrillReveal — error state (per surface spec line 338)', () => {
  it('renders user-friendly message when citedDecision.error=gameTree-error', () => {
    render(
      <DrillReveal
        card={makeCard()}
        citedDecision={{ error: 'gameTree-error', source: 'synthesized', node: makeCitedDecision().node }}
        onSetDial={vi.fn()}
      />,
    );
    expect(screen.getByTestId('drill-reveal-error')).toBeInTheDocument();
    expect(screen.getByText(/trouble computing/i)).toBeInTheDocument();
    expect(screen.getByText(/try again or skip/i)).toBeInTheDocument();
  });

  it('renders error message for gameTree-empty reason', () => {
    render(
      <DrillReveal
        card={makeCard()}
        citedDecision={{ error: 'gameTree-empty', source: 'synthesized' }}
        onSetDial={vi.fn()}
      />,
    );
    expect(screen.getByText(/No actions evaluated/i)).toBeInTheDocument();
  });
});

describe('DrillReveal — ready state (real labels)', () => {
  it('renders baseline + recommended action labels from citedDecision', () => {
    render(
      <DrillReveal card={makeCard()} citedDecision={makeCitedDecision()} onSetDial={vi.fn()} />,
    );
    expect(screen.getByTestId('drill-reveal-baseline-action')).toHaveTextContent(/Bet 75%/i);
    expect(screen.getByTestId('drill-reveal-recommended-action')).toHaveTextContent(/Check/i);
  });

  it('renders real dividend from citedDecision', () => {
    render(
      <DrillReveal card={makeCard()} citedDecision={makeCitedDecision({ dividend: 0.42 })} onSetDial={vi.fn()} />,
    );
    expect(screen.getByTestId('drill-reveal-dividend')).toHaveTextContent(/\+0\.42/);
  });

  it('handles negative dividend correctly', () => {
    render(
      <DrillReveal card={makeCard()} citedDecision={makeCitedDecision({ dividend: -0.15 })} onSetDial={vi.fn()} />,
    );
    expect(screen.getByTestId('drill-reveal-dividend')).toHaveTextContent(/-0\.15/);
  });

  it('does NOT render heuristic action labels (regression: was inferring from deviationType)', () => {
    // Heuristic v0 output for bluff-prune was "bet (balanced)" / "check (prune bluffs)"
    render(
      <DrillReveal card={makeCard()} citedDecision={makeCitedDecision()} onSetDial={vi.fn()} />,
    );
    expect(screen.queryByText(/balanced\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/prune bluffs/i)).not.toBeInTheDocument();
  });
});

describe('DrillReveal — synthesis disclosure (transparency-by-default)', () => {
  it('renders synthesis badge when source=synthesized', () => {
    render(
      <DrillReveal card={makeCard()} citedDecision={makeCitedDecision()} onSetDial={vi.fn()} />,
    );
    const badge = screen.getByTestId('drill-reveal-synthesis-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent(/Representative spot/);
    expect(badge).toHaveTextContent(/river/);
    expect(badge).toHaveTextContent(/wet/);
    expect(badge).toHaveTextContent(/IP/);
  });

  it('does NOT render synthesis badge when source=real (real hand state)', () => {
    render(
      <DrillReveal
        card={makeCard()}
        citedDecision={makeCitedDecision({ source: 'real', node: { display: undefined } })}
        onSetDial={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('drill-reveal-synthesis-badge')).not.toBeInTheDocument();
  });
});

describe('DrillReveal — honesty check (I-AE-3)', () => {
  it('when dial=0 (baseline-only citedDecision), recommendedAction === baselineAction and dividend=0', () => {
    const card = makeCard({ operator: { currentDial: 0 } });
    // Real producer at dial=0 returns recommendedAction === baselineAction with dividend=0.
    const baselineOnly = {
      baselineAction: { action: 'bet', ev: 1.5, sizing: 0.75 },
      recommendedAction: { action: 'bet', ev: 1.5, sizing: 0.75 },
      dividend: 0,
      source: 'synthesized',
      node: makeCitedDecision().node,
    };
    render(<DrillReveal card={card} citedDecision={baselineOnly} onSetDial={vi.fn()} />);
    expect(screen.getByTestId('drill-reveal-baseline-action')).toHaveTextContent(/Bet 75%/);
    expect(screen.getByTestId('drill-reveal-recommended-action')).toHaveTextContent(/Bet 75%/);
    expect(screen.getByTestId('drill-reveal-dividend')).toHaveTextContent(/\+0\.00/);
  });
});

describe('DrillReveal — dial interaction', () => {
  it('renders all 5 discrete dial buttons', () => {
    render(<DrillReveal card={makeCard()} citedDecision={makeCitedDecision()} onSetDial={vi.fn()} />);
    expect(screen.getByTestId('drill-reveal-dial-0')).toBeInTheDocument();
    expect(screen.getByTestId('drill-reveal-dial-0.3')).toBeInTheDocument();
    expect(screen.getByTestId('drill-reveal-dial-0.6')).toBeInTheDocument();
    expect(screen.getByTestId('drill-reveal-dial-0.9')).toBeInTheDocument();
    expect(screen.getByTestId('drill-reveal-dial-1')).toBeInTheDocument();
  });

  it('marks the current dial button as selected', () => {
    const card = makeCard({ operator: { currentDial: 0.6 } });
    render(<DrillReveal card={card} citedDecision={makeCitedDecision()} onSetDial={vi.fn()} />);
    expect(screen.getByTestId('drill-reveal-dial-0.6')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('drill-reveal-dial-0.3')).toHaveAttribute('aria-checked', 'false');
  });

  it('onSetDial fires with new value when dial button clicked', () => {
    const spy = vi.fn();
    render(<DrillReveal card={makeCard()} citedDecision={makeCitedDecision()} onSetDial={spy} />);
    fireEvent.click(screen.getByTestId('drill-reveal-dial-0'));
    expect(spy).toHaveBeenCalledWith(0);
  });
});

describe('DrillReveal — citation expand/collapse', () => {
  it('compact citation always renders', () => {
    render(<DrillReveal card={makeCard()} citedDecision={makeCitedDecision()} onSetDial={vi.fn()} />);
    expect(screen.getByTestId('drill-reveal-citation-compact')).toBeInTheDocument();
    expect(screen.getByText(/fold-to-river 17%/)).toBeInTheDocument();
  });

  it('expands to detailed citation on "why →" click', () => {
    render(<DrillReveal card={makeCard()} citedDecision={makeCitedDecision()} onSetDial={vi.fn()} />);
    expect(screen.queryByTestId('drill-reveal-citation-expanded')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('drill-reveal-expand'));
    expect(screen.getByTestId('drill-reveal-citation-expanded')).toBeInTheDocument();
    expect(screen.getByText(/Recognition pattern/)).toBeInTheDocument();
  });
});
