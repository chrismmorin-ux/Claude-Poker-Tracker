/**
 * ActionPanel.test.jsx - Tests for action panel component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionPanel } from '../ActionPanel';
import { ACTIONS } from '../../../../constants/gameConstants';
import { GameProvider } from '../../../../contexts/GameContext';
import { initialGameState } from '../../../../reducers/gameReducer';

// Helper to wrap component with GameProvider
const renderWithGameContext = (ui, { gameState = initialGameState, dispatchGame = vi.fn() } = {}) => {
  return render(
    <GameProvider gameState={gameState} dispatchGame={dispatchGame}>
      {ui}
    </GameProvider>
  );
};

describe('ActionPanel', () => {
  const defaultProps = {
    selectedPlayers: [5],
    currentStreet: 'preflop',
    seatActions: {},
    onRecordAction: vi.fn(),
    onClearSelection: vi.fn(),
    onToggleAbsent: vi.fn(),
    onClearSeatActions: vi.fn(),
    onUndoLastAction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering conditions', () => {
    it('returns null when no players selected', () => {
      const { container } = renderWithGameContext(
        <ActionPanel {...defaultProps} selectedPlayers={[]} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('returns null when currentStreet is showdown', () => {
      const { container } = renderWithGameContext(
        <ActionPanel {...defaultProps} currentStreet="showdown" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders when players selected and not showdown', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} />);
      expect(screen.getByText('Seat 5')).toBeInTheDocument();
    });
  });

  describe('single seat display', () => {
    it('displays single seat number in header', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} selectedPlayers={[3]} />);
      expect(screen.getByText('Seat 3')).toBeInTheDocument();
    });

    it('displays current street with uppercase styling', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      const streetElement = screen.getByText('flop');
      expect(streetElement).toBeInTheDocument();
      expect(streetElement).toHaveClass('uppercase');
    });
  });

  describe('multiple seats display', () => {
    it('displays seat count and sorted list', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} selectedPlayers={[5, 2, 8]} />);
      expect(screen.getByText('3 Seats: 2, 5, 8')).toBeInTheDocument();
    });

    it('displays two seats correctly', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} selectedPlayers={[7, 1]} />);
      expect(screen.getByText('2 Seats: 1, 7')).toBeInTheDocument();
    });
  });

  describe('preflop action buttons', () => {
    it('renders Fold button on preflop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="preflop" />);
      expect(screen.getByText('Fold')).toBeInTheDocument();
    });

    it('renders Limp button on preflop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="preflop" />);
      expect(screen.getByText('Limp')).toBeInTheDocument();
    });

    it('renders Call button on preflop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="preflop" />);
      expect(screen.getByText('Call')).toBeInTheDocument();
    });

    it('renders Open button on preflop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="preflop" />);
      expect(screen.getByText('Open')).toBeInTheDocument();
    });

    it('renders 3bet button on preflop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="preflop" />);
      expect(screen.getByText('3bet')).toBeInTheDocument();
    });

    it('renders 4bet button on preflop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="preflop" />);
      expect(screen.getByText('4bet')).toBeInTheDocument();
    });
  });

  describe('postflop action buttons', () => {
    it('renders PFR section header on flop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      expect(screen.getByText('IF PFR:')).toBeInTheDocument();
    });

    it('renders PFC section header on flop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      expect(screen.getByText('IF PFC:')).toBeInTheDocument();
    });

    it('renders Cbet IP (S) button on flop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      expect(screen.getByText('Cbet IP (S)')).toBeInTheDocument();
    });

    it('renders Cbet IP (L) button on flop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      expect(screen.getByText('Cbet IP (L)')).toBeInTheDocument();
    });

    it('renders Check button on flop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      // Check appears twice - once for PFR, once for PFC
      const checkButtons = screen.getAllByText('Check');
      expect(checkButtons.length).toBe(2);
    });

    it('renders Donk button on flop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      expect(screen.getByText('Donk')).toBeInTheDocument();
    });

    it('renders Stab button on flop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      expect(screen.getByText('Stab')).toBeInTheDocument();
    });

    it('renders Check-Raise button on flop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      expect(screen.getByText('Check-Raise')).toBeInTheDocument();
    });

    it('renders Fold to Cbet button on flop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      expect(screen.getByText('Fold to Cbet')).toBeInTheDocument();
    });

    it('renders Fold to CR button on flop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      expect(screen.getByText('Fold to CR')).toBeInTheDocument();
    });
  });

  describe('preflop action interactions', () => {
    it('calls onRecordAction with FOLD when Fold clicked', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="preflop" />);
      fireEvent.click(screen.getByText('Fold'));
      expect(defaultProps.onRecordAction).toHaveBeenCalledWith(ACTIONS.FOLD);
    });

    it('calls onRecordAction with LIMP when Limp clicked', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="preflop" />);
      fireEvent.click(screen.getByText('Limp'));
      expect(defaultProps.onRecordAction).toHaveBeenCalledWith(ACTIONS.LIMP);
    });

    it('calls onRecordAction with CALL when Call clicked', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="preflop" />);
      fireEvent.click(screen.getByText('Call'));
      expect(defaultProps.onRecordAction).toHaveBeenCalledWith(ACTIONS.CALL);
    });

    it('calls onRecordAction with OPEN when Open clicked', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="preflop" />);
      fireEvent.click(screen.getByText('Open'));
      expect(defaultProps.onRecordAction).toHaveBeenCalledWith(ACTIONS.OPEN);
    });

    it('calls onRecordAction with THREE_BET when 3bet clicked', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="preflop" />);
      fireEvent.click(screen.getByText('3bet'));
      expect(defaultProps.onRecordAction).toHaveBeenCalledWith(ACTIONS.THREE_BET);
    });

    it('calls onRecordAction with FOUR_BET when 4bet clicked', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="preflop" />);
      fireEvent.click(screen.getByText('4bet'));
      expect(defaultProps.onRecordAction).toHaveBeenCalledWith(ACTIONS.FOUR_BET);
    });
  });

  describe('postflop action interactions', () => {
    it('calls onRecordAction with CBET_IP_SMALL', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      fireEvent.click(screen.getByText('Cbet IP (S)'));
      expect(defaultProps.onRecordAction).toHaveBeenCalledWith(ACTIONS.CBET_IP_SMALL);
    });

    it('calls onRecordAction with CBET_IP_LARGE', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      fireEvent.click(screen.getByText('Cbet IP (L)'));
      expect(defaultProps.onRecordAction).toHaveBeenCalledWith(ACTIONS.CBET_IP_LARGE);
    });

    it('calls onRecordAction with DONK', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      fireEvent.click(screen.getByText('Donk'));
      expect(defaultProps.onRecordAction).toHaveBeenCalledWith(ACTIONS.DONK);
    });

    it('calls onRecordAction with STAB', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      fireEvent.click(screen.getByText('Stab'));
      expect(defaultProps.onRecordAction).toHaveBeenCalledWith(ACTIONS.STAB);
    });

    it('calls onRecordAction with CHECK_RAISE', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      fireEvent.click(screen.getByText('Check-Raise'));
      expect(defaultProps.onRecordAction).toHaveBeenCalledWith(ACTIONS.CHECK_RAISE);
    });

    it('calls onRecordAction with FOLD_TO_CBET', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      fireEvent.click(screen.getByText('Fold to Cbet'));
      expect(defaultProps.onRecordAction).toHaveBeenCalledWith(ACTIONS.FOLD_TO_CBET);
    });

    it('calls onRecordAction with FOLD_TO_CR', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      fireEvent.click(screen.getByText('Fold to CR'));
      expect(defaultProps.onRecordAction).toHaveBeenCalledWith(ACTIONS.FOLD_TO_CR);
    });
  });

  describe('control buttons', () => {
    it('renders Clear Selection button', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} />);
      expect(screen.getByText('Clear Selection')).toBeInTheDocument();
    });

    it('renders Mark as Absent button', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} />);
      expect(screen.getByText('Mark as Absent')).toBeInTheDocument();
    });

    it('calls onClearSelection when clicked', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} />);
      fireEvent.click(screen.getByText('Clear Selection'));
      expect(defaultProps.onClearSelection).toHaveBeenCalledTimes(1);
    });

    it('calls onToggleAbsent when clicked', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} />);
      fireEvent.click(screen.getByText('Mark as Absent'));
      expect(defaultProps.onToggleAbsent).toHaveBeenCalledTimes(1);
    });
  });

  describe('action sequence display', () => {
    it('does not show current actions when no actions recorded', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} />);
      expect(screen.queryByText('Current Actions:')).not.toBeInTheDocument();
    });

    it('shows current actions section when seat has actions', () => {
      const props = {
        ...defaultProps,
        selectedPlayers: [5],
        seatActions: {
          preflop: {
            5: [ACTIONS.OPEN],
          },
        },
      };
      renderWithGameContext(<ActionPanel {...props} />);
      expect(screen.getByText('Current Actions:')).toBeInTheDocument();
    });

    it('does not show current actions for multiple seats', () => {
      const props = {
        ...defaultProps,
        selectedPlayers: [5, 6],
        seatActions: {
          preflop: {
            5: [ACTIONS.OPEN],
            6: [ACTIONS.FOLD],
          },
        },
      };
      renderWithGameContext(<ActionPanel {...props} />);
      expect(screen.queryByText('Current Actions:')).not.toBeInTheDocument();
    });
  });

  describe('clear and undo buttons', () => {
    it('does not show Clear Seat Actions when no actions', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} />);
      expect(screen.queryByText('Clear Seat Actions')).not.toBeInTheDocument();
    });

    it('does not show Undo Last Action when no actions', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} />);
      expect(screen.queryByText(/Undo Last Action/)).not.toBeInTheDocument();
    });

    it('shows Clear Seat Actions when seat has actions', () => {
      const props = {
        ...defaultProps,
        selectedPlayers: [5],
        seatActions: {
          preflop: {
            5: [ACTIONS.OPEN],
          },
        },
      };
      renderWithGameContext(<ActionPanel {...props} />);
      expect(screen.getByText('Clear Seat Actions')).toBeInTheDocument();
    });

    it('shows Undo Last Action when seat has actions', () => {
      const props = {
        ...defaultProps,
        selectedPlayers: [5],
        seatActions: {
          preflop: {
            5: [ACTIONS.OPEN],
          },
        },
      };
      renderWithGameContext(<ActionPanel {...props} />);
      expect(screen.getByText(/Undo Last Action/)).toBeInTheDocument();
    });

    it('calls onClearSeatActions with seat array when clicked', () => {
      const props = {
        ...defaultProps,
        selectedPlayers: [5],
        seatActions: {
          preflop: {
            5: [ACTIONS.OPEN],
          },
        },
      };
      renderWithGameContext(<ActionPanel {...props} />);
      fireEvent.click(screen.getByText('Clear Seat Actions'));
      expect(props.onClearSeatActions).toHaveBeenCalledWith([5]);
    });

    it('calls onUndoLastAction with seat number when clicked', () => {
      const props = {
        ...defaultProps,
        selectedPlayers: [5],
        seatActions: {
          preflop: {
            5: [ACTIONS.OPEN],
          },
        },
      };
      renderWithGameContext(<ActionPanel {...props} />);
      fireEvent.click(screen.getByText(/Undo Last Action/));
      expect(props.onUndoLastAction).toHaveBeenCalledWith(5);
    });

    it('does not show clear/undo for multiple seats even with actions', () => {
      const props = {
        ...defaultProps,
        selectedPlayers: [5, 6],
        seatActions: {
          preflop: {
            5: [ACTIONS.OPEN],
            6: [ACTIONS.FOLD],
          },
        },
      };
      renderWithGameContext(<ActionPanel {...props} />);
      expect(screen.queryByText('Clear Seat Actions')).not.toBeInTheDocument();
      expect(screen.queryByText(/Undo Last Action/)).not.toBeInTheDocument();
    });
  });

  describe('street-specific behavior', () => {
    it('shows preflop buttons on turn street (uses postflop layout)', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="turn" />);
      expect(screen.getByText('IF PFR:')).toBeInTheDocument();
    });

    it('shows preflop buttons on river street (uses postflop layout)', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="river" />);
      expect(screen.getByText('IF PFC:')).toBeInTheDocument();
    });
  });
});
