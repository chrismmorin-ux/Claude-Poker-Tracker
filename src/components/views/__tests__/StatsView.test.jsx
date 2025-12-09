/**
 * StatsView.test.jsx - Tests for statistics view component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatsView } from '../StatsView';

// Mock the contexts
const mockSetCurrentScreen = vi.fn();
vi.mock('../../../contexts', () => ({
  useGame: () => ({
    seatActions: {},
    mySeat: 5,
  }),
  useUI: () => ({
    setCurrentScreen: mockSetCurrentScreen,
    SCREEN: { TABLE: 'table', STATS: 'stats' },
  }),
}));

describe('StatsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with title', () => {
    render(<StatsView scale={1} />);

    expect(screen.getByText('Player Statistics')).toBeInTheDocument();
  });

  it('renders all 9 seat buttons', () => {
    render(<StatsView scale={1} />);

    for (let i = 1; i <= 9; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument();
    }
  });

  it('renders back button', () => {
    render(<StatsView scale={1} />);

    const backButton = screen.getByRole('button', { name: /back to table/i });
    expect(backButton).toBeInTheDocument();
  });

  it('calls setCurrentScreen when back button clicked', () => {
    render(<StatsView scale={1} />);

    const backButton = screen.getByRole('button', { name: /back to table/i });
    fireEvent.click(backButton);

    expect(mockSetCurrentScreen).toHaveBeenCalledWith('table');
  });

  it('renders stats sections', () => {
    render(<StatsView scale={1} />);

    expect(screen.getByText('Preflop')).toBeInTheDocument();
    expect(screen.getByText('As PFR')).toBeInTheDocument();
    expect(screen.getByText('As PFC')).toBeInTheDocument();
  });

  it('renders stat labels', () => {
    render(<StatsView scale={1} />);

    expect(screen.getByText('VPIP')).toBeInTheDocument();
    expect(screen.getByText('PFR')).toBeInTheDocument();
    expect(screen.getByText('3bet')).toBeInTheDocument();
    expect(screen.getByText('Cbet IP')).toBeInTheDocument();
    expect(screen.getByText('Donk')).toBeInTheDocument();
  });

  it('highlights mySeat (seat 5)', () => {
    render(<StatsView scale={1} />);

    // mySeat is 5, should show in the header
    expect(screen.getByText(/Seat 5 Statistics/)).toBeInTheDocument();
  });

  it('accepts scale prop', () => {
    const { container } = render(<StatsView scale={0.8} />);

    // The ScaledContainer wraps content
    expect(container.firstChild).toBeInTheDocument();
  });
});
