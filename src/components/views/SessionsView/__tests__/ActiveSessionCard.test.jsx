/**
 * ActiveSessionCard.test.jsx - Tests for active session card component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActiveSessionCard } from '../ActiveSessionCard';

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Square: () => <span data-testid="square-icon">■</span>,
}));

describe('ActiveSessionCard', () => {
  const baseSession = {
    isActive: true,
    sessionId: 1,
    startTime: Date.now() - 3600000, // 1 hour ago
    venue: 'Horseshoe Casino',
    gameType: '1/2 NL',
    buyIn: 200,
    handCount: 25,
    goal: 'Play tight',
    rebuyTransactions: [],
  };

  const defaultProps = {
    currentSession: baseSession,
    onEndSession: vi.fn(),
    onUpdateField: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders session header with venue, game type, and time', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      expect(screen.getByText(/Horseshoe Casino - 1\/2 NL/)).toBeInTheDocument();
    });

    it('renders relative time since start', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      expect(screen.getByText(/Started/)).toBeInTheDocument();
    });

    it('renders End Session button', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      expect(screen.getByText('End Session')).toBeInTheDocument();
    });

    it('renders hand count', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      expect(screen.getByText('Hands')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    it('renders buy-in amount', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      expect(screen.getByText('Initial Buy-in')).toBeInTheDocument();
      // Buy-in appears in both initial buy-in and session total
      const buyInElements = screen.getAllByText('$200');
      expect(buyInElements.length).toBeGreaterThanOrEqual(1);
    });

    it('renders session total', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      expect(screen.getByText('Session Total')).toBeInTheDocument();
    });

    it('renders Add Rebuy button', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      expect(screen.getByText('+ Add Rebuy')).toBeInTheDocument();
    });

    it('renders goal', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      expect(screen.getByText('Goal')).toBeInTheDocument();
      expect(screen.getByText('Play tight')).toBeInTheDocument();
    });

    it('renders venue label', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      expect(screen.getByText('Venue:')).toBeInTheDocument();
    });

    it('renders game type label', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      expect(screen.getByText('Game Type:')).toBeInTheDocument();
    });
  });

  describe('null/inactive session', () => {
    it('returns null when session is not active', () => {
      const props = {
        ...defaultProps,
        currentSession: { ...baseSession, isActive: false },
      };
      const { container } = render(<ActiveSessionCard {...props} />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null when sessionId is missing', () => {
      const props = {
        ...defaultProps,
        currentSession: { ...baseSession, sessionId: null },
      };
      const { container } = render(<ActiveSessionCard {...props} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('end session', () => {
    it('calls onEndSession when button clicked', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      fireEvent.click(screen.getByText('End Session'));
      expect(defaultProps.onEndSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('buy-in editing', () => {
    it('shows input when buy-in clicked', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      // Buy-in is displayed with a cursor-pointer class
      const buyInElements = screen.getAllByText('$200');
      const clickableBuyIn = buyInElements.find((el) => el.classList.contains('cursor-pointer'));
      fireEvent.click(clickableBuyIn);
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('calls onUpdateField on blur', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      const buyInElements = screen.getAllByText('$200');
      const clickableBuyIn = buyInElements.find((el) => el.classList.contains('cursor-pointer'));
      fireEvent.click(clickableBuyIn);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '300' } });
      fireEvent.blur(input);

      expect(defaultProps.onUpdateField).toHaveBeenCalledWith('buyIn', 300);
    });

    it('shows placeholder when no buy-in', () => {
      const props = {
        ...defaultProps,
        currentSession: { ...baseSession, buyIn: null },
      };
      render(<ActiveSessionCard {...props} />);
      expect(screen.getByText('$---')).toBeInTheDocument();
    });
  });

  describe('rebuy functionality', () => {
    it('shows input when Add Rebuy clicked', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      fireEvent.click(screen.getByText('+ Add Rebuy'));
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('shows Confirm and Cancel buttons when adding rebuy', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      fireEvent.click(screen.getByText('+ Add Rebuy'));
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('calls onUpdateField with rebuy transaction on confirm', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      fireEvent.click(screen.getByText('+ Add Rebuy'));

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '100' } });
      fireEvent.click(screen.getByText('Confirm'));

      expect(defaultProps.onUpdateField).toHaveBeenCalledWith(
        'rebuyTransactions',
        expect.arrayContaining([
          expect.objectContaining({ amount: 100 }),
        ])
      );
    });

    it('cancels rebuy on Cancel click', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      fireEvent.click(screen.getByText('+ Add Rebuy'));
      fireEvent.click(screen.getByText('Cancel'));

      // Should be back to Add Rebuy button
      expect(screen.getByText('+ Add Rebuy')).toBeInTheDocument();
    });

    it('does not add rebuy with invalid amount', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      fireEvent.click(screen.getByText('+ Add Rebuy'));

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '0' } });
      fireEvent.click(screen.getByText('Confirm'));

      expect(defaultProps.onUpdateField).not.toHaveBeenCalled();
    });

    it('displays rebuy transactions list', () => {
      const props = {
        ...defaultProps,
        currentSession: {
          ...baseSession,
          rebuyTransactions: [
            { timestamp: Date.now() - 1800000, amount: 100 },
            { timestamp: Date.now() - 900000, amount: 50 },
          ],
        },
      };
      render(<ActiveSessionCard {...props} />);
      expect(screen.getByText('$100')).toBeInTheDocument();
      expect(screen.getByText('$50')).toBeInTheDocument();
    });
  });

  describe('venue editing', () => {
    it('shows dropdown when venue clicked', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      const venueText = screen.getByText('Horseshoe Casino');
      fireEvent.click(venueText);
      // Should show venue select
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('updates venue on selection', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      fireEvent.click(screen.getByText('Horseshoe Casino'));

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'Online' } });

      expect(defaultProps.onUpdateField).toHaveBeenCalledWith('venue', 'Online');
    });
  });

  describe('game type editing', () => {
    it('shows dropdown when game type clicked', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      fireEvent.click(screen.getByText('1/2 NL'));
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });
  });

  describe('goal editing', () => {
    it('shows dropdown when goal clicked', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      fireEvent.click(screen.getByText('Play tight'));
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('shows placeholder when no goal set', () => {
      const props = {
        ...defaultProps,
        currentSession: { ...baseSession, goal: null },
      };
      render(<ActiveSessionCard {...props} />);
      expect(screen.getByText('Click to set goal')).toBeInTheDocument();
    });

    it('updates goal on blur', () => {
      render(<ActiveSessionCard {...defaultProps} />);
      fireEvent.click(screen.getByText('Play tight'));

      const select = screen.getByRole('combobox');
      // The goalValue state is initialized with currentSession.goal ('Play tight')
      // On blur, it calls onUpdateField with the current goalValue
      fireEvent.blur(select);

      // Goal is passed from local state (initialized from currentSession.goal)
      expect(defaultProps.onUpdateField).toHaveBeenCalledWith('goal', 'Play tight');
    });
  });

  describe('session total calculation', () => {
    it('calculates total as buy-in plus rebuys', () => {
      const props = {
        ...defaultProps,
        currentSession: {
          ...baseSession,
          buyIn: 200,
          rebuyTransactions: [
            { timestamp: Date.now(), amount: 100 },
            { timestamp: Date.now(), amount: 50 },
          ],
        },
      };
      render(<ActiveSessionCard {...props} />);
      // Total should be 200 + 100 + 50 = 350
      expect(screen.getByText('$350')).toBeInTheDocument();
    });

    it('handles no buy-in with rebuys', () => {
      const props = {
        ...defaultProps,
        currentSession: {
          ...baseSession,
          buyIn: 0,
          rebuyTransactions: [{ timestamp: Date.now(), amount: 200 }],
        },
      };
      render(<ActiveSessionCard {...props} />);
      // $200 appears in both session total and rebuy list
      const amounts = screen.getAllByText('$200');
      expect(amounts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('relative time formatting', () => {
    it('formats minutes ago', () => {
      const props = {
        ...defaultProps,
        currentSession: { ...baseSession, startTime: Date.now() - 5 * 60000 },
      };
      render(<ActiveSessionCard {...props} />);
      expect(screen.getByText(/5m ago/)).toBeInTheDocument();
    });

    it('formats hours ago', () => {
      const props = {
        ...defaultProps,
        currentSession: { ...baseSession, startTime: Date.now() - 2 * 3600000 },
      };
      render(<ActiveSessionCard {...props} />);
      expect(screen.getByText(/2h ago/)).toBeInTheDocument();
    });

    it('formats days ago', () => {
      const props = {
        ...defaultProps,
        currentSession: { ...baseSession, startTime: Date.now() - 3 * 86400000 },
      };
      render(<ActiveSessionCard {...props} />);
      expect(screen.getByText(/3d ago/)).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('has green gradient background', () => {
      const { container } = render(<ActiveSessionCard {...defaultProps} />);
      const card = container.firstChild;
      expect(card).toHaveClass('bg-gradient-to-r', 'from-green-500', 'to-green-600');
    });

    it('has white text', () => {
      const { container } = render(<ActiveSessionCard {...defaultProps} />);
      const card = container.firstChild;
      expect(card).toHaveClass('text-white');
    });
  });

  describe('hand count', () => {
    it('displays zero when no hands', () => {
      const props = {
        ...defaultProps,
        currentSession: { ...baseSession, handCount: 0 },
      };
      render(<ActiveSessionCard {...props} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('displays undefined as zero', () => {
      const props = {
        ...defaultProps,
        currentSession: { ...baseSession, handCount: undefined },
      };
      render(<ActiveSessionCard {...props} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });
});
