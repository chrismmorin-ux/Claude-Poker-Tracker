// @vitest-environment jsdom
/**
 * LessonCalculators — tests for PotOddsCalculator seeding (LSW-H1).
 *
 * The prior behavior was hardcoded defaults pot=100 / bet=50, which drift
 * from any line node's context. LSW-H1 adds optional `initialPot` /
 * `initialBet` props so calling sites (the postflop `ComputeSection`) can
 * seed the calculator from `section.seed` or from `node.pot` + implied
 * bet-size. Preflop lesson callers that don't seed continue to use the
 * generic defaults unchanged.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CALCULATORS } from '../LessonCalculators';

const PotOddsCalculator = CALCULATORS.potOdds;

const getInputs = () => {
  // The calculator renders two `<input type="number">` in a fixed order:
  // pot first, bet second (per the component). Querying by role=spinbutton
  // preserves that order.
  const inputs = screen.getAllByRole('spinbutton');
  return { potInput: inputs[0], betInput: inputs[1] };
};

describe('PotOddsCalculator — initial input values', () => {
  it('falls back to generic defaults (pot=100, bet=50) when no props are provided', () => {
    render(<PotOddsCalculator />);
    const { potInput, betInput } = getInputs();
    expect(potInput.value).toBe('100');
    expect(betInput.value).toBe('50');
  });

  it('respects initialPot + initialBet when provided', () => {
    render(<PotOddsCalculator initialPot={27.3} initialBet={6.8} />);
    const { potInput, betInput } = getInputs();
    expect(potInput.value).toBe('27.3');
    expect(betInput.value).toBe('6.8');
  });

  it('respects zero pot (pre-flop edge case where initial pot can be 0)', () => {
    render(<PotOddsCalculator initialPot={0} initialBet={2} />);
    const { potInput, betInput } = getInputs();
    expect(potInput.value).toBe('0');
    expect(betInput.value).toBe('2');
  });

  it('falls back to default bet when initialBet is zero or negative (bet must be positive)', () => {
    render(<PotOddsCalculator initialPot={50} initialBet={0} />);
    const { potInput, betInput } = getInputs();
    expect(potInput.value).toBe('50');
    expect(betInput.value).toBe('50');
  });

  it('falls back to default pot when initialPot is negative', () => {
    render(<PotOddsCalculator initialPot={-10} initialBet={5} />);
    const { potInput } = getInputs();
    expect(potInput.value).toBe('100');
  });

  it('falls back to defaults when props are NaN', () => {
    render(<PotOddsCalculator initialPot={NaN} initialBet={NaN} />);
    const { potInput, betInput } = getInputs();
    expect(potInput.value).toBe('100');
    expect(betInput.value).toBe('50');
  });

  it('falls back to defaults when props are non-finite', () => {
    render(<PotOddsCalculator initialPot={Infinity} initialBet={-Infinity} />);
    const { potInput, betInput } = getInputs();
    expect(potInput.value).toBe('100');
    expect(betInput.value).toBe('50');
  });

  it('partial seeding — initialPot only, bet keeps default', () => {
    render(<PotOddsCalculator initialPot={34} />);
    const { potInput, betInput } = getInputs();
    expect(potInput.value).toBe('34');
    expect(betInput.value).toBe('50');
  });
});

describe('PotOddsCalculator — initial computed output reflects seeded inputs', () => {
  it('displays the node-context break-even when seeded with the JT6 flop_root spot', () => {
    // Formula (per combinatorics.breakEvenEquity): BE = bet / (pot + 2*bet).
    // Seeded 27.3 / 6.8 → 6.8 / 40.9 → 0.1662 → "16.6%" in the widget.
    // Default 100 / 50 → 50 / 200 → 0.25 → "25.0%".
    // Verify the rendered output reflects the seeded pair, not defaults.
    const { container } = render(<PotOddsCalculator initialPot={27.3} initialBet={6.8} />);
    expect(container.textContent).toContain('16.6%');
    expect(container.textContent).not.toContain('25.0%');
  });

  it('displays the default 25.0% break-even when not seeded', () => {
    const { container } = render(<PotOddsCalculator />);
    expect(container.textContent).toContain('25.0%');
  });
});
