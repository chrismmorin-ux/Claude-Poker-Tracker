// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EquityHistogram } from '../EquityHistogram';

const combos = [
  { card1: 0, card2: 1, weight: 1 },
  { card1: 2, card2: 3, weight: 1 },
  { card1: 4, card2: 5, weight: 1 },
];

const fakeResult = {
  bins: [
    { lo: 0, hi: 0.2, weight: 0, pct: 0, count: 0 },
    { lo: 0.2, hi: 0.4, weight: 1, pct: 0.34, count: 1 },
    { lo: 0.4, hi: 0.6, weight: 2, pct: 0.66, count: 2 },
    { lo: 0.6, hi: 0.8, weight: 0, pct: 0, count: 0 },
    { lo: 0.8, hi: 1.0, weight: 0, pct: 0, count: 0 },
  ],
  meanEquity: 0.47,
  totalWeight: 3,
  combosEvaluated: 3,
  trials: 600,
};

describe('EquityHistogram', () => {
  it('prompts for Compute before any run', () => {
    render(<EquityHistogram combos={combos} board={[]} inputKey="k1" computeFn={vi.fn()} />);
    expect(screen.getByText(/Press Compute to estimate/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compute' })).toBeEnabled();
  });

  it('disables Compute and shows a message when there are no combos', () => {
    render(<EquityHistogram combos={[]} board={[]} inputKey="k1" computeFn={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Compute' })).toBeDisabled();
    expect(screen.getByText('No combos in the current selection.')).toBeInTheDocument();
  });

  it('Compute runs the injected fn and renders bins + mean equity', async () => {
    const computeFn = vi.fn().mockResolvedValue(fakeResult);
    render(<EquityHistogram combos={combos} board={[]} inputKey="k1" computeFn={computeFn} />);

    fireEvent.click(screen.getByRole('button', { name: 'Compute' }));

    await waitFor(() => expect(screen.getByText(/Mean equity/)).toBeInTheDocument());
    expect(computeFn).toHaveBeenCalledTimes(1);
    expect(screen.getByText('47%')).toBeInTheDocument(); // mean equity
    expect(screen.getByText('20–40%')).toBeInTheDocument(); // a bin label
    expect(screen.getByText('40–60%')).toBeInTheDocument();
    expect(screen.getByText(/Monte-Carlo estimate/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recompute' })).toBeInTheDocument();
  });

  it('clears a prior result when the input key changes (stale-guard)', async () => {
    const computeFn = vi.fn().mockResolvedValue(fakeResult);
    const { rerender } = render(
      <EquityHistogram combos={combos} board={[]} inputKey="k1" computeFn={computeFn} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Compute' }));
    await waitFor(() => expect(screen.getByText(/Mean equity/)).toBeInTheDocument());

    // Painting / filtering changes the input key → result must clear.
    rerender(<EquityHistogram combos={combos} board={[]} inputKey="k2" computeFn={computeFn} />);
    expect(screen.queryByText(/Mean equity/)).not.toBeInTheDocument();
    expect(screen.getByText(/Press Compute to estimate/)).toBeInTheDocument();
  });
});
