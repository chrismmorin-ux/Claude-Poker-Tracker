// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BatchSeatRibbon from '../BatchSeatRibbon';

describe('<BatchSeatRibbon />', () => {
  it('renders nine seat pips', () => {
    render(<BatchSeatRibbon currentSeat={3} assignedSeats={[]} onExit={vi.fn()} />);
    for (let s = 1; s <= 9; s += 1) {
      expect(screen.getByTestId(`seat-pip-${s}`)).toBeTruthy();
    }
  });

  it('marks current seat with state="current"', () => {
    render(<BatchSeatRibbon currentSeat={3} assignedSeats={[]} onExit={vi.fn()} />);
    expect(screen.getByTestId('seat-pip-3').getAttribute('data-state')).toBe('current');
    expect(screen.getByTestId('seat-pip-1').getAttribute('data-state')).toBe('pending');
  });

  it('marks assigned seats with state="assigned"', () => {
    render(<BatchSeatRibbon currentSeat={4} assignedSeats={[1, 3]} onExit={vi.fn()} />);
    expect(screen.getByTestId('seat-pip-1').getAttribute('data-state')).toBe('assigned');
    expect(screen.getByTestId('seat-pip-3').getAttribute('data-state')).toBe('assigned');
    expect(screen.getByTestId('seat-pip-4').getAttribute('data-state')).toBe('current');
  });

  it('exit button fires onExit', () => {
    const onExit = vi.fn();
    render(<BatchSeatRibbon currentSeat={3} assignedSeats={[]} onExit={onExit} />);
    fireEvent.click(screen.getByTestId('batch-exit-btn'));
    expect(onExit).toHaveBeenCalled();
  });
});
