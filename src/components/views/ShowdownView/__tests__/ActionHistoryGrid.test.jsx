// @vitest-environment jsdom
/**
 * ActionHistoryGrid.test.jsx - Tests for action history grid component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionHistoryGrid } from '../ActionHistoryGrid';
import { ACTIONS, SEAT_STATUS } from '../../../../constants/gameConstants';

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

// Helper to create actionSequence entries
const entry = (seat, action, street, order = 1) => ({
  seat, action, street, order,
});

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
    actionSequence: [],
    allPlayerCards: createEmptyPlayerCards(),
    holeCards: ['', ''],
    mySeat: 5,
    isSeatInactive: vi.fn(() => null),
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
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  describe('street headers', () => {
    it('renders street names with correct styling', () => {
      render(<ActionHistoryGrid {...defaultProps} />);
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
        actionSequence: [
          entry(3, 'raise', 'preflop', 1),
          entry(3, 'call', 'preflop', 2),
        ],
      };
      render(<ActionHistoryGrid {...props} />);
      expect(screen.getByTestId('action-sequence')).toBeInTheDocument();
    });

    it('displays single action', () => {
      const props = {
        ...defaultProps,
        actionSequence: [entry(5, 'call', 'preflop')],
      };
      render(<ActionHistoryGrid {...props} />);
      expect(screen.getByTestId('action-sequence')).toBeInTheDocument();
    });

    it('renders action sequence for betting streets', () => {
      const props = {
        ...defaultProps,
        actionSequence: [entry(1, 'raise', 'preflop')],
      };
      render(<ActionHistoryGrid {...props} />);
      expect(screen.getByTestId('action-sequence')).toBeInTheDocument();
    });
  });

  describe('showdown display', () => {
    it('displays won with hand abbreviation', () => {
      const props = {
        ...defaultProps,
        actionSequence: [entry(3, ACTIONS.WON, 'showdown')],
        allPlayerCards: {
          ...createEmptyPlayerCards(),
          3: ['A♠', 'K♥'],
        },
      };
      render(<ActionHistoryGrid {...props} />);
      expect(screen.getByText(/won/)).toBeInTheDocument();
    });

    it('displays muck for mucked hands', () => {
      const props = {
        ...defaultProps,
        actionSequence: [entry(2, ACTIONS.MUCKED, 'showdown')],
      };
      render(<ActionHistoryGrid {...props} />);
      expect(screen.getByText('muck')).toBeInTheDocument();
    });

    it('displays fold with hand when folded in previous street', () => {
      const props = {
        ...defaultProps,
        actionSequence: [entry(4, 'fold', 'preflop')],
        allPlayerCards: {
          ...createEmptyPlayerCards(),
          4: ['Q♦', 'J♦'],
        },
      };
      render(<ActionHistoryGrid {...props} />);
      const foldElements = screen.getAllByText(/fold/);
      expect(foldElements.length).toBeGreaterThan(0);
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
      expect(props.getHandAbbreviation).toHaveBeenCalledWith(['A♥', 'A♦']);
    });
  });

  describe('inactive seat handling', () => {
    it('checks inactive status for each seat', () => {
      render(<ActionHistoryGrid {...defaultProps} />);
      expect(defaultProps.isSeatInactive).toHaveBeenCalled();
    });

    it('handles absent seats', () => {
      const props = {
        ...defaultProps,
        isSeatInactive: vi.fn((seat) => (seat === 7 ? SEAT_STATUS.ABSENT : null)),
      };
      render(<ActionHistoryGrid {...props} />);
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
      expect(grids.length).toBe(STREETS.length + 1);
    });
  });

  describe('action sequence display', () => {
    it('displays multiple actions per street', () => {
      const props = {
        ...defaultProps,
        actionSequence: [
          entry(1, 'raise', 'preflop', 1),
          entry(1, 'raise', 'preflop', 2),
          entry(1, 'call', 'preflop', 3),
        ],
      };
      render(<ActionHistoryGrid {...props} />);
      const sequence = screen.getByTestId('action-sequence');
      expect(sequence).toBeInTheDocument();
    });

    it('passes correct props to ActionSequence', () => {
      const props = {
        ...defaultProps,
        actionSequence: [entry(2, 'call', 'preflop')],
      };
      render(<ActionHistoryGrid {...props} />);
      const sequence = screen.getByTestId('action-sequence');
      expect(sequence.querySelector(`[data-action="${'call'}"]`)).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles empty actionSequence', () => {
      render(<ActionHistoryGrid {...defaultProps} actionSequence={[]} />);
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
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
      expect(props.getHandAbbreviation).toHaveBeenCalled();
    });
  });
});
