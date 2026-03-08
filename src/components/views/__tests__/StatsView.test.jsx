// @vitest-environment jsdom
/**
 * StatsView.test.jsx - Tests for statistics view component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  useSession: () => ({
    currentSession: { sessionId: 'test-session-1' },
  }),
  usePlayer: () => ({
    seatPlayers: { 5: 'player-5' },
    getSeatPlayerName: (seat) => seat === 5 ? 'Hero' : null,
  }),
}));

// Mock useSessionStats
vi.mock('../../../hooks/useSessionStats', () => ({
  useSessionStats: () => ({
    seatStats: {
      5: { vpip: 25, pfr: 18, af: 2.0, threeBet: 8, cbet: 65, limpPct: 5, sampleSize: 30, style: 'TAG', handCount: 30 },
    },
    isLoading: false,
  }),
}));

describe('StatsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with title', () => {
    render(<StatsView scale={1} />);
    expect(screen.getByText('Session Stats')).toBeInTheDocument();
  });

  it('renders all 9 seat buttons', () => {
    render(<StatsView scale={1} />);
    for (let i = 1; i <= 9; i++) {
      expect(screen.getByText(`Seat ${i}`)).toBeInTheDocument();
    }
  });

  it('renders back button and navigates on click', () => {
    render(<StatsView scale={1} />);
    const backButton = screen.getByRole('button', { name: /back to table/i });
    fireEvent.click(backButton);
    expect(mockSetCurrentScreen).toHaveBeenCalledWith('table');
  });

  it('renders stat sections for selected seat with data', () => {
    render(<StatsView scale={1} />);
    expect(screen.getByText('Preflop')).toBeInTheDocument();
    expect(screen.getByText('Postflop')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('renders stat labels', () => {
    render(<StatsView scale={1} />);
    expect(screen.getByText('VPIP')).toBeInTheDocument();
    expect(screen.getByText('PFR')).toBeInTheDocument();
    expect(screen.getByText('3-Bet')).toBeInTheDocument();
    expect(screen.getByText('C-Bet')).toBeInTheDocument();
  });

  it('shows selected seat name with (You) for mySeat', () => {
    render(<StatsView scale={1} />);
    expect(screen.getByText(/Hero.*\(You\)/)).toBeInTheDocument();
  });

  it('shows style badge for seat with data', () => {
    render(<StatsView scale={1} />);
    expect(screen.getByText('TAG')).toBeInTheDocument();
  });

  it('accepts scale prop', () => {
    const { container } = render(<StatsView scale={0.8} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
