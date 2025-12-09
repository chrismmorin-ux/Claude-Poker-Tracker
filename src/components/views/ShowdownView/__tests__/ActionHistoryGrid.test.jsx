/**
 * ActionHistoryGrid.test.jsx - Tests for action history grid component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionHistoryGrid } from '../ActionHistoryGrid';
import { ACTIONS, SEAT_STATUS, ACTION_ABBREV } from '../../../../constants/gameConstants';

// Mock ActionSequence component
vi.mock('../../../ui/ActionSequence', () => ({
  ActionSequence: ({ actions, size, maxVisible }) => (
    <div data-testid="action-sequence">
      {actions.map((a, i) => (
        <span key={i} data-action={a}>
          {a}
        </span>
      ))}
    </div>
  ),
}));

describe('ActionHistoryGrid', () => {
  const SEAT_ARRAY = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  const BETTING_STREETS = ['preflop', 'flop', 'turn', 'river'];

  const createEmptyPlayerCards = () => {
    const cards = {};
    SEAT_ARRAY.forEach((seat) => {
      cards[seat] = ['', ''];
    });
    return cards;
  };

  const defaultProps = {
    SEAT_ARRAY,
    STREETS,
    BETTING_STREETS,
    ACTIONS,
    ACTION_ABBREV,
    SEAT_STATUS,
    seatActions: {
      preflop: {},
      flop: {},
      turn: {},
      river: {},
      showdown: {},
    },
    allPlayerCards: createEmptyPlayerCards(),
    holeCards: ['', ''],
    mySeat: 5,
    isSeatInactive: vi.fn(() => null),
    getActionColor: vi.fn(() => 'bg-gray-100 text-gray-900'),
    getActionDisplayName: vi.fn((action) => action || ''),
    isFoldAction: vi.fn((action) => action === ACTIONS.FOLD),
    getHandAbbreviation: vi.fn((cards) =>
      cards && cards[0] && cards[1] ? `${cards[0]}${cards[1]}` : ''
    ),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders container', () => {
      const { container } = render(<ActionHistoryGrid {...defaultProps} />);
      expect(container.firstChild).toHaveClass('bg-white', 'rounded', 'shadow');
    });

    it('renders Labels buttons for all 9 seats', () => {
      render(<ActionHistoryGrid {...defaultProps} />);
      const labelsButtons = screen.getAllByText('Labels');
      expect(labelsButtons.length).toBe(9);
    });

    it('renders all street sections', () => {
      render(<ActionHistoryGrid {...defaultProps} />);
      STREETS.forEach((street) => {
        expect(screen.getByText(street)).toBeInTheDocument();
      });
    });

    it('renders dashes for empty actions', () => {
      render(<ActionHistoryGrid {...defaultProps} />);
      const dashes = screen.getAllByText('—');
      // Each street has 9 seats, and with no actions, most will show dashes
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  describe('street headers', () => {
    it('renders street names with correct styling', () => {
      const { container } = render(<ActionHistoryGrid {...defaultProps} />);
      STREETS.forEach((street) => {
        const header = screen.getByText(street);
        expect(header).toHaveClass('uppercase', 'font-bold');
      });
    });
  });

  describe('action display', () => {
    it('renders ActionSequence for betting street actions', () => {
      const props = {
        ...defaultProps,
        seatActions: {
          preflop: { 3: [ACTIONS.OPEN, ACTIONS.CALL] },
          flop: {},
          turn: {},
          river: {},
          showdown: {},
        },
      };
      render(<ActionHistoryGrid {...props} />);
      expect(screen.getByTestId('action-sequence')).toBeInTheDocument();
    });

    it('displays single action', () => {
      const props = {
        ...defaultProps,
        seatActions: {
          preflop: { 5: [ACTIONS.CALL] },
          flop: {},
          turn: {},
          river: {},
          showdown: {},
        },
      };
      render(<ActionHistoryGrid {...props} />);
      expect(screen.getByTestId('action-sequence')).toBeInTheDocument();
    });

    it('calls getActionColor for actions', () => {
      const props = {
        ...defaultProps,
        seatActions: {
          preflop: { 1: [ACTIONS.OPEN] },
          flop: {},
          turn: {},
          river: {},
          showdown: {},
        },
      };
      render(<ActionHistoryGrid {...props} />);
      expect(props.getActionColor).toHaveBeenCalled();
    });
  });

  describe('showdown display', () => {
    it('displays won with hand abbreviation', () => {
      const props = {
        ...defaultProps,
        seatActions: {
          preflop: {},
          flop: {},
          turn: {},
          river: {},
          showdown: { 3: [ACTIONS.WON] },
        },
        allPlayerCards: {
          ...createEmptyPlayerCards(),
          3: ['A♠', 'K♥'],
        },
      };
      render(<ActionHistoryGrid {...props} />);
      expect(props.getActionDisplayName).toHaveBeenCalledWith(ACTIONS.WON);
    });

    it('displays muck for mucked hands', () => {
      const props = {
        ...defaultProps,
        seatActions: {
          preflop: {},
          flop: {},
          turn: {},
          river: {},
          showdown: { 2: [ACTIONS.MUCKED] },
        },
      };
      render(<ActionHistoryGrid {...props} />);
      // Should show 'muck' for mucked hands
      expect(screen.getByText('muck')).toBeInTheDocument();
    });

    it('displays fold with hand when folded in previous street', () => {
      const props = {
        ...defaultProps,
        seatActions: {
          preflop: { 4: [ACTIONS.FOLD] },
          flop: {},
          turn: {},
          river: {},
          showdown: {},
        },
        allPlayerCards: {
          ...createEmptyPlayerCards(),
          4: ['Q♦', 'J♦'],
        },
        isFoldAction: vi.fn((action) => action === ACTIONS.FOLD),
      };
      render(<ActionHistoryGrid {...props} />);
      // Should check if player folded
      expect(props.isFoldAction).toHaveBeenCalled();
    });

    it('displays show with hand for active players', () => {
      const props = {
        ...defaultProps,
        allPlayerCards: {
          ...createEmptyPlayerCards(),
          6: ['T♠', '9♠'],
        },
      };
      render(<ActionHistoryGrid {...props} />);
      // getHandAbbreviation should be called for showdown display
      expect(props.getHandAbbreviation).toHaveBeenCalled();
    });

    it('handles my seat cards separately', () => {
      const props = {
        ...defaultProps,
        mySeat: 5,
        holeCards: ['A♥', 'A♦'],
        allPlayerCards: createEmptyPlayerCards(),
      };
      render(<ActionHistoryGrid {...props} />);
      // My seat should use holeCards instead of allPlayerCards
      expect(props.getHandAbbreviation).toHaveBeenCalledWith(['A♥', 'A♦']);
    });
  });

  describe('inactive seat handling', () => {
    it('checks inactive status for each seat', () => {
      render(<ActionHistoryGrid {...defaultProps} />);
      // isSeatInactive should be called for each seat in each street
      expect(defaultProps.isSeatInactive).toHaveBeenCalled();
    });

    it('handles absent seats', () => {
      const props = {
        ...defaultProps,
        isSeatInactive: vi.fn((seat) => (seat === 7 ? SEAT_STATUS.ABSENT : null)),
      };
      render(<ActionHistoryGrid {...props} />);
      // Absent seats should show empty in showdown
      expect(props.isSeatInactive).toHaveBeenCalledWith(7);
    });

    it('handles folded seats', () => {
      const props = {
        ...defaultProps,
        isSeatInactive: vi.fn((seat) => (seat === 3 ? SEAT_STATUS.FOLDED : null)),
      };
      render(<ActionHistoryGrid {...props} />);
      expect(props.isSeatInactive).toHaveBeenCalledWith(3);
    });
  });

  describe('grid layout', () => {
    it('renders 9 columns for seats', () => {
      const { container } = render(<ActionHistoryGrid {...defaultProps} />);
      const grids = container.querySelectorAll('.grid-cols-9');
      // One for labels, one for each street
      expect(grids.length).toBe(STREETS.length + 1);
    });
  });

  describe('action sequence display', () => {
    it('displays multiple actions per street', () => {
      const props = {
        ...defaultProps,
        seatActions: {
          preflop: { 1: [ACTIONS.OPEN, ACTIONS.RAISE, ACTIONS.CALL] },
          flop: {},
          turn: {},
          river: {},
          showdown: {},
        },
      };
      render(<ActionHistoryGrid {...props} />);
      const sequence = screen.getByTestId('action-sequence');
      expect(sequence).toBeInTheDocument();
    });

    it('passes correct props to ActionSequence', () => {
      const props = {
        ...defaultProps,
        seatActions: {
          preflop: { 2: [ACTIONS.CALL] },
          flop: {},
          turn: {},
          river: {},
          showdown: {},
        },
      };
      render(<ActionHistoryGrid {...props} />);
      const sequence = screen.getByTestId('action-sequence');
      expect(sequence.querySelector(`[data-action="${ACTIONS.CALL}"]`)).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles empty seatActions object', () => {
      const props = {
        ...defaultProps,
        seatActions: {},
      };
      render(<ActionHistoryGrid {...props} />);
      // Should render without errors
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    });

    it('handles missing street in seatActions', () => {
      const props = {
        ...defaultProps,
        seatActions: {
          preflop: { 1: [ACTIONS.OPEN] },
          // Other streets missing
        },
      };
      render(<ActionHistoryGrid {...props} />);
      // Should render without errors
      expect(screen.getByTestId('action-sequence')).toBeInTheDocument();
    });

    it('handles null cards', () => {
      const props = {
        ...defaultProps,
        allPlayerCards: {
          ...createEmptyPlayerCards(),
          3: [null, null],
        },
      };
      render(<ActionHistoryGrid {...props} />);
      // Should render without errors
      expect(props.getHandAbbreviation).toHaveBeenCalled();
    });
  });
});
