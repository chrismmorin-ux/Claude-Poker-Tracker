// @vitest-environment jsdom
/**
 * InsightsBand.test.jsx — Phase 2 Sessions View Improvement (2026-06-06).
 * Pure-prop component (no context).
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InsightsBand } from '../InsightsBand';

const HOUR = 3600000;
const completed = (overrides = {}) => ({
  sessionId: 's1',
  startTime: 1000,
  endTime: 1000 + 2 * HOUR,
  venue: 'Casino A',
  gameType: '1/2',
  buyIn: 200,
  rebuyTransactions: [],
  cashOut: 350,
  tipAmount: 0,
  handCount: 50,
  isActive: false,
  ...overrides,
});

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {}
});

describe('InsightsBand', () => {
  it('renders nothing when there are no completed sessions', () => {
    const { container } = render(
      <InsightsBand sessions={[completed({ cashOut: null })]} />
    );
    expect(container.querySelector('[data-testid="insights-band"]')).toBeNull();
  });

  it('renders the heading and net P&L for completed sessions', () => {
    render(
      <InsightsBand
        sessions={[
          completed({ sessionId: 'a', cashOut: 350 }), // +150
          completed({ sessionId: 'b', cashOut: 100 }), // -100
        ]}
      />
    );
    expect(screen.getByText('Insights')).toBeInTheDocument();
    // Net P&L = +50.00 appears (in header and tile).
    expect(screen.getAllByText('+$50.00').length).toBeGreaterThan(0);
  });

  it('shows stake and venue breakdowns', () => {
    render(
      <InsightsBand
        sessions={[
          completed({ sessionId: 'a', gameType: '1/2', venue: 'Casino A', cashOut: 350 }),
          completed({ sessionId: 'b', gameType: '2/5', venue: 'Casino B', cashOut: 700, buyIn: 500 }),
        ]}
      />
    );
    expect(screen.getByText('By stake')).toBeInTheDocument();
    expect(screen.getByText('By venue')).toBeInTheDocument();
    expect(screen.getByText('2/5')).toBeInTheDocument();
    // Casino B also appears in the Best-session tile, so use getAllByText.
    expect(screen.getAllByText('Casino B').length).toBeGreaterThan(0);
  });

  it('shows the scope label when provided', () => {
    render(<InsightsBand sessions={[completed()]} scopeLabel="Live" />);
    expect(screen.getByText('· Live')).toBeInTheDocument();
  });

  it('collapses and expands, persisting to localStorage', () => {
    render(<InsightsBand sessions={[completed()]} />);
    // Expanded by default → breakdowns visible.
    expect(screen.getByText('By stake')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { expanded: true }));

    expect(screen.queryByText('By stake')).not.toBeInTheDocument();
    expect(localStorage.getItem('sessionsView.insightsCollapsed')).toBe('1');
  });

  it('starts collapsed when localStorage says so', () => {
    localStorage.setItem('sessionsView.insightsCollapsed', '1');
    render(<InsightsBand sessions={[completed()]} />);
    expect(screen.queryByText('By stake')).not.toBeInTheDocument();
    // Header net P&L still shows.
    expect(screen.getByText('Insights')).toBeInTheDocument();
  });
});
