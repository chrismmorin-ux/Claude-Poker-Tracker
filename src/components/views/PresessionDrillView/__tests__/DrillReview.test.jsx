import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DrillReview } from '../DrillReview';

const makeAssumption = (id, overrides = {}) => ({
  id,
  villainId: 'v42',
  claim: { predicate: 'foldToRiverBet' },
  narrative: { citationShort: `${id}-short`, humanStatement: `${id}-human` },
  ...overrides,
});

const makeCard = (overrides = {}) => ({
  cardIndex: 0,
  assumptionId: 'a1',
  revealedAt: '2026-04-23T00:00:00Z',
  heroAnswered: 'correct',
  dialOverride: null,
  retryQueued: false,
  ...overrides,
});

const baseSession = (cards = []) => ({
  sessionId: 'drill-1',
  startedAt: '2026-04-23T00:00:00Z',
  cardsShown: cards,
});

const baseSummary = (correct = 0, retry = 0, skip = 0, total = 0) => ({
  correct,
  retryLater: retry,
  skipped: skip,
  totalAnswered: correct + retry + skip,
  totalCards: total || (correct + retry + skip),
  hitRate: total > 0 ? correct / total : 0,
  mood: total > 0
    ? (correct / total >= 0.80 ? 'upbeat' : correct / total >= 0.50 ? 'neutral' : 'encouraging')
    : 'neutral',
});

describe('DrillReview — empty state', () => {
  it('renders empty-state when no drillSession', () => {
    render(<DrillReview drillSession={null} sessionSummary={null} />);
    expect(screen.getByText(/No drill to review/i)).toBeInTheDocument();
  });

  it('renders empty-state when cardsShown is empty', () => {
    render(<DrillReview drillSession={baseSession([])} sessionSummary={null} />);
    expect(screen.getByText(/No drill to review/i)).toBeInTheDocument();
  });

  it('empty-state shows back button when onClose provided', () => {
    const spy = vi.fn();
    render(<DrillReview drillSession={null} sessionSummary={null} onClose={spy} />);
    fireEvent.click(screen.getByTestId('drill-review-back-empty'));
    expect(spy).toHaveBeenCalled();
  });
});

describe('DrillReview — populated session', () => {
  const cards = [
    makeCard({ cardIndex: 0, assumptionId: 'a1', heroAnswered: 'correct' }),
    makeCard({ cardIndex: 1, assumptionId: 'a2', heroAnswered: 'correct' }),
    makeCard({ cardIndex: 2, assumptionId: 'a3', heroAnswered: 'retry-later' }),
    makeCard({ cardIndex: 3, assumptionId: 'a4', heroAnswered: 'skip' }),
    makeCard({ cardIndex: 4, assumptionId: 'a5', heroAnswered: null }),
  ];
  const assumptions = {
    a1: makeAssumption('a1'),
    a2: makeAssumption('a2'),
    a3: makeAssumption('a3'),
    a4: makeAssumption('a4'),
    a5: makeAssumption('a5'),
  };

  it('renders header + stats + rows', () => {
    const summary = baseSummary(2, 1, 1, 5);
    render(<DrillReview
      drillSession={baseSession(cards)}
      sessionSummary={summary}
      assumptions={assumptions}
    />);
    expect(screen.getByText(/Drill review/i)).toBeInTheDocument();
    expect(screen.getByTestId('drill-review-stats')).toBeInTheDocument();
    expect(screen.getByTestId('drill-review-rows')).toBeInTheDocument();
  });

  it('stat cards show correct counts', () => {
    const summary = baseSummary(2, 1, 1, 5);
    render(<DrillReview
      drillSession={baseSession(cards)}
      sessionSummary={summary}
      assumptions={assumptions}
    />);
    expect(screen.getByTestId('drill-review-stat-correct').textContent).toMatch(/2/);
    expect(screen.getByTestId('drill-review-stat-retry').textContent).toMatch(/1/);
    expect(screen.getByTestId('drill-review-stat-skipped').textContent).toMatch(/1/);
    expect(screen.getByTestId('drill-review-stat-unanswered').textContent).toMatch(/1/);
  });

  it('renders one row per card', () => {
    const summary = baseSummary(2, 1, 1, 5);
    render(<DrillReview
      drillSession={baseSession(cards)}
      sessionSummary={summary}
      assumptions={assumptions}
    />);
    const rows = screen.getAllByTestId('drill-review-row');
    expect(rows).toHaveLength(5);
  });

  it('row shows assumption human statement when assumption provided', () => {
    const summary = baseSummary(1, 0, 0, 1);
    render(<DrillReview
      drillSession={baseSession([cards[0]])}
      sessionSummary={summary}
      assumptions={{ a1: makeAssumption('a1', { narrative: { citationShort: 'fold 17%', humanStatement: 'Folds rivers 17%' } }) }}
    />);
    expect(screen.getByText(/fold 17%/i)).toBeInTheDocument();
  });

  it('row falls back to assumptionId when assumption missing', () => {
    const summary = baseSummary(1, 0, 0, 1);
    render(<DrillReview
      drillSession={baseSession([cards[0]])}
      sessionSummary={summary}
      assumptions={{}}
    />);
    expect(screen.getByText(/a1/i)).toBeInTheDocument();
  });

  it('status label reflects heroAnswered value', () => {
    const summary = baseSummary(1, 1, 1, 3);
    render(<DrillReview
      drillSession={baseSession([cards[0], cards[2], cards[3]])}
      sessionSummary={summary}
      assumptions={assumptions}
    />);
    // Each row has a status label column; scope to the rows region to avoid
    // matching the stat-card labels (which use similar wording).
    const rowsRegion = screen.getByTestId('drill-review-rows');
    expect(rowsRegion.textContent).toMatch(/Got it/i);
    expect(rowsRegion.textContent).toMatch(/Retry later/i);
    expect(rowsRegion.textContent).toMatch(/Skipped/i);
  });

  it('shows dialOverride when present', () => {
    const card = makeCard({ dialOverride: 0.3 });
    render(<DrillReview
      drillSession={baseSession([card])}
      sessionSummary={baseSummary(1, 0, 0, 1)}
      assumptions={assumptions}
    />);
    expect(screen.getByText(/Dial override: 0.30/i)).toBeInTheDocument();
  });

  it('replay button shows for non-correct rows when onReplayCard provided', () => {
    const spy = vi.fn();
    render(<DrillReview
      drillSession={baseSession([cards[0], cards[2]])}
      sessionSummary={baseSummary(1, 1, 0, 2)}
      assumptions={assumptions}
      onReplayCard={spy}
    />);
    // "correct" row has no replay; "retry-later" row has replay
    const replayButtons = screen.getAllByTestId('drill-review-replay');
    expect(replayButtons).toHaveLength(1);
  });

  it('replay button does not show for correct rows', () => {
    const spy = vi.fn();
    render(<DrillReview
      drillSession={baseSession([cards[0]])}
      sessionSummary={baseSummary(1, 0, 0, 1)}
      assumptions={assumptions}
      onReplayCard={spy}
    />);
    expect(screen.queryByTestId('drill-review-replay')).not.toBeInTheDocument();
  });

  it('calibration note renders as placeholder', () => {
    render(<DrillReview
      drillSession={baseSession([cards[0]])}
      sessionSummary={baseSummary(1, 0, 0, 1)}
      assumptions={assumptions}
    />);
    expect(screen.getByTestId('drill-review-calibration-note')).toBeInTheDocument();
    expect(screen.getByText(/after your next live session/i)).toBeInTheDocument();
  });

  it('close button fires onClose', () => {
    const spy = vi.fn();
    render(<DrillReview
      drillSession={baseSession([cards[0]])}
      sessionSummary={baseSummary(1, 0, 0, 1)}
      assumptions={assumptions}
      onClose={spy}
    />);
    fireEvent.click(screen.getByTestId('drill-review-close'));
    expect(spy).toHaveBeenCalled();
  });
});

describe('DrillReview — mood-aware framing', () => {
  const cards = [makeCard(), makeCard({ cardIndex: 1, assumptionId: 'a2' })];
  const assumptions = { a1: makeAssumption('a1'), a2: makeAssumption('a2') };

  it('upbeat subhead for high hit rate', () => {
    const summary = baseSummary(5, 0, 0, 5); // 100%
    render(<DrillReview
      drillSession={baseSession(cards)}
      sessionSummary={summary}
      assumptions={assumptions}
    />);
    expect(screen.getByTestId('drill-review-subhead').textContent).toMatch(/Strong session/i);
  });

  it('neutral subhead for mid hit rate', () => {
    const summary = baseSummary(3, 1, 1, 5); // 60%
    render(<DrillReview
      drillSession={baseSession(cards)}
      sessionSummary={summary}
      assumptions={assumptions}
    />);
    expect(screen.getByTestId('drill-review-subhead').textContent).toMatch(/Reviewed 2 patterns/i);
  });

  it('encouraging subhead for low hit rate avoids punishing language', () => {
    const summary = baseSummary(1, 2, 2, 5); // 20%
    render(<DrillReview
      drillSession={baseSession(cards)}
      sessionSummary={summary}
      assumptions={assumptions}
    />);
    const text = screen.getByTestId('drill-review-subhead').textContent;
    expect(text).toMatch(/Recognition builds with reps/i);
    expect(text).not.toMatch(/wrong|failed|poor|bad/i);
  });
});
