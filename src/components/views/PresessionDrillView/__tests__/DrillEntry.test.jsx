import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DrillEntry } from '../DrillEntry';

const defaultProps = {
  timeBudget: 15,
  onTimeBudgetChange: vi.fn(),
  availableVillains: [],
  selectedVillainIds: [],
  onToggleVillain: vi.fn(),
  onStartDrill: vi.fn(),
  onBack: vi.fn(),
};

describe('DrillEntry — layout', () => {
  it('renders header', () => {
    render(<DrillEntry {...defaultProps} />);
    expect(screen.getByText(/Prepare for tonight/i)).toBeInTheDocument();
  });

  it('shows three time-budget buttons (5 / 15 / 30 min)', () => {
    render(<DrillEntry {...defaultProps} />);
    expect(screen.getByTestId('drill-entry-time-5')).toBeInTheDocument();
    expect(screen.getByTestId('drill-entry-time-15')).toBeInTheDocument();
    expect(screen.getByTestId('drill-entry-time-30')).toBeInTheDocument();
  });

  it('selected time-budget button has aria-checked=true', () => {
    render(<DrillEntry {...defaultProps} timeBudget={15} />);
    expect(screen.getByTestId('drill-entry-time-15')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('drill-entry-time-5')).toHaveAttribute('aria-checked', 'false');
  });

  it('fires onTimeBudgetChange when a button is clicked', () => {
    const spy = vi.fn();
    render(<DrillEntry {...defaultProps} onTimeBudgetChange={spy} />);
    fireEvent.click(screen.getByTestId('drill-entry-time-30'));
    expect(spy).toHaveBeenCalledWith(30);
  });
});

describe('DrillEntry — villain list', () => {
  it('shows empty-state when no villains available', () => {
    render(<DrillEntry {...defaultProps} availableVillains={[]} />);
    expect(screen.getByText(/No actionable patterns yet/i)).toBeInTheDocument();
  });

  it('lists available villains with pattern counts', () => {
    const villains = [
      { villainId: 'v42', actionableCount: 3 },
      { villainId: 'v99', actionableCount: 1 },
    ];
    render(<DrillEntry {...defaultProps} availableVillains={villains} />);
    expect(screen.getByTestId('drill-entry-villain-v42')).toBeInTheDocument();
    expect(screen.getByTestId('drill-entry-villain-v99')).toBeInTheDocument();
    expect(screen.getByText(/3 patterns ready/i)).toBeInTheDocument();
    expect(screen.getByText(/1 pattern ready/i)).toBeInTheDocument();
  });

  it('villain with 0 actionable patterns is disabled', () => {
    const villains = [{ villainId: 'empty', actionableCount: 0 }];
    render(<DrillEntry {...defaultProps} availableVillains={villains} />);
    const label = screen.getByTestId('drill-entry-villain-empty');
    const checkbox = label.querySelector('input');
    expect(checkbox).toBeDisabled();
  });

  it('onToggleVillain fires when clicking a villain row with patterns', () => {
    const spy = vi.fn();
    const villains = [{ villainId: 'v42', actionableCount: 3 }];
    render(<DrillEntry {...defaultProps} availableVillains={villains} onToggleVillain={spy} />);
    const label = screen.getByTestId('drill-entry-villain-v42');
    const checkbox = label.querySelector('input');
    fireEvent.click(checkbox);
    expect(spy).toHaveBeenCalledWith('v42');
  });
});

describe('DrillEntry — Start CTA', () => {
  it('Start button disabled when no villains selected', () => {
    render(<DrillEntry {...defaultProps} />);
    expect(screen.getByTestId('drill-entry-start')).toBeDisabled();
  });

  it('Start button enabled when at least one villain with patterns selected', () => {
    const villains = [{ villainId: 'v42', actionableCount: 3 }];
    render(<DrillEntry {...defaultProps} availableVillains={villains} selectedVillainIds={['v42']} />);
    expect(screen.getByTestId('drill-entry-start')).not.toBeDisabled();
  });

  it('Start button disabled when selected villain has 0 patterns', () => {
    const villains = [{ villainId: 'empty', actionableCount: 0 }];
    render(<DrillEntry {...defaultProps} availableVillains={villains} selectedVillainIds={['empty']} />);
    expect(screen.getByTestId('drill-entry-start')).toBeDisabled();
  });

  it('onStartDrill fires when Start is clicked', () => {
    const spy = vi.fn();
    const villains = [{ villainId: 'v42', actionableCount: 3 }];
    render(<DrillEntry {...defaultProps} availableVillains={villains} selectedVillainIds={['v42']} onStartDrill={spy} />);
    fireEvent.click(screen.getByTestId('drill-entry-start'));
    expect(spy).toHaveBeenCalled();
  });
});

describe('DrillEntry — back affordance', () => {
  it('shows back button when onBack prop provided', () => {
    render(<DrillEntry {...defaultProps} />);
    expect(screen.getByTestId('drill-entry-back')).toBeInTheDocument();
  });

  it('hides back button when onBack is undefined', () => {
    render(<DrillEntry {...defaultProps} onBack={undefined} />);
    expect(screen.queryByTestId('drill-entry-back')).not.toBeInTheDocument();
  });
});

describe('DrillEntry — touch target compliance (Gate 2 Stage E)', () => {
  it('time-budget buttons have minHeight ≥ 44 px via inline style', () => {
    render(<DrillEntry {...defaultProps} />);
    const btn = screen.getByTestId('drill-entry-time-5');
    // JSX inline style prop sets this; can't read computed style in jsdom reliably,
    // but the style attribute includes it.
    expect(btn.style.minHeight).toBe('72px');
  });

  it('Start button has minHeight ≥ 44 px', () => {
    render(<DrillEntry {...defaultProps} />);
    const btn = screen.getByTestId('drill-entry-start');
    expect(btn.style.minHeight).toBe('48px');
  });
});
