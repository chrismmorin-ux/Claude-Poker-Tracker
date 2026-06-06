// @vitest-environment jsdom
/**
 * BankrollChart.test.jsx — Phase 2 Sessions View Improvement (2026-06-06).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BankrollChart } from '../BankrollChart';

const series = [
  { t: 2000, pnl: 150, cumulative: 150, sessionId: 'a' },
  { t: 5000, pnl: -100, cumulative: 50, sessionId: 'b' },
];

describe('BankrollChart', () => {
  it('renders an empty state for no series', () => {
    render(<BankrollChart series={[]} />);
    expect(screen.getByTestId('bankroll-chart-empty')).toBeInTheDocument();
  });

  it('renders an svg chart for a non-empty series', () => {
    render(<BankrollChart series={series} />);
    expect(screen.getByTestId('bankroll-chart')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /cumulative bankroll/i })).toBeInTheDocument();
  });

  it('shows a tooltip when a point is clicked', () => {
    const { container } = render(<BankrollChart series={series} />);
    const points = container.querySelectorAll('circle');
    expect(points.length).toBe(2);
    fireEvent.click(points[0]);
    expect(screen.getByTestId('bankroll-chart-tooltip')).toBeInTheDocument();
    expect(screen.getByText(/\+\$150\.00/)).toBeInTheDocument();
  });

  it('handles a single-point series without error', () => {
    render(<BankrollChart series={[series[0]]} />);
    expect(screen.getByTestId('bankroll-chart')).toBeInTheDocument();
  });
});
