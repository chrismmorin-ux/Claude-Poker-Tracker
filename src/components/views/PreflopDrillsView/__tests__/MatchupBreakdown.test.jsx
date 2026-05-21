// @vitest-environment jsdom
/**
 * MatchupBreakdown.test.jsx — partition-display invariant.
 *
 * WS-185 / SPR-083 — win/tie/lose displayed percentages must sum to exactly
 * 100 (no float slack), using `formatPercentGroup` for largest-remainder
 * rounding.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchupBreakdown } from '../MatchupBreakdown';

const renderWith = (winRate, tieRate, loseRate) => {
  const result = {
    equity: winRate + 0.5 * tieRate,
    winRate,
    tieRate,
    loseRate,
    boardsEnumerated: 1000,
    elapsedMs: 12,
    cached: false,
  };
  return render(
    <MatchupBreakdown
      handALabel="AKs"
      handBLabel="JTs"
      result={result}
      frameworkMatches={[]}
    />,
  );
};

const readPct = (testId) => parseFloat(screen.getByTestId(testId).textContent);

describe('MatchupBreakdown — partition invariant (WS-185)', () => {
  it('renders the partition label', () => {
    renderWith(0.333, 0.334, 0.333);
    expect(screen.getByText(/sums to 100%/i)).toBeInTheDocument();
  });

  it('three-way 1/3 split sums to exactly 100% (no 100.1 drift)', () => {
    renderWith(1 / 3, 1 / 3, 1 / 3);
    const sum =
      readPct('matchup-pct-win') + readPct('matchup-pct-tie') + readPct('matchup-pct-lose');
    expect(sum).toBeCloseTo(100, 9);
  });

  it('asymmetric partition sums to exactly 100%', () => {
    renderWith(0.6234, 0.0123, 0.3643);
    const sum =
      readPct('matchup-pct-win') + readPct('matchup-pct-tie') + readPct('matchup-pct-lose');
    expect(sum).toBeCloseTo(100, 9);
  });

  it('tie-heavy partition (AKs vs AKo) sums to exactly 100%', () => {
    // Realistic shape: ~80% tie, ~10% win, ~10% lose.
    renderWith(0.1, 0.8, 0.1);
    const sum =
      readPct('matchup-pct-win') + readPct('matchup-pct-tie') + readPct('matchup-pct-lose');
    expect(sum).toBeCloseTo(100, 9);
  });

  it('lopsided partition (AA vs 72o) sums to exactly 100%', () => {
    renderWith(0.871, 0.005, 0.124);
    const sum =
      readPct('matchup-pct-win') + readPct('matchup-pct-tie') + readPct('matchup-pct-lose');
    expect(sum).toBeCloseTo(100, 9);
  });

  it('hides outcome breakdown when hideEquity=true', () => {
    const result = {
      equity: 0.5,
      winRate: 0.45,
      tieRate: 0.1,
      loseRate: 0.45,
      boardsEnumerated: 1000,
    };
    render(
      <MatchupBreakdown
        handALabel="AKs"
        handBLabel="JTs"
        result={result}
        frameworkMatches={[]}
        hideEquity
      />,
    );
    expect(screen.queryByTestId('matchup-pct-win')).toBeNull();
    expect(screen.queryByTestId('matchup-pct-tie')).toBeNull();
    expect(screen.queryByTestId('matchup-pct-lose')).toBeNull();
  });
});
