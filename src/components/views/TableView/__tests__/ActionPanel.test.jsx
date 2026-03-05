/**
 * ActionPanel.test.jsx - Tests for primitive action panel component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionPanel } from '../ActionPanel';
import { PRIMITIVE_ACTIONS } from '../../../../constants/primitiveActions';
import { GameProvider } from '../../../../contexts/GameContext';
import { initialGameState } from '../../../../reducers/gameReducer';

const mockRecordPrimitiveAction = vi.fn();

const renderWithGameContext = (ui, { gameState = initialGameState, dispatchGame = vi.fn() } = {}) => {
  // Provide recordPrimitiveAction via the GameProvider
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

  describe('preflop primitive action buttons', () => {
    it('renders Check, Call, Raise, Fold on preflop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="preflop" />);
      expect(screen.getByText('Check')).toBeInTheDocument();
      expect(screen.getByText('Call')).toBeInTheDocument();
      expect(screen.getByText('Raise')).toBeInTheDocument();
      expect(screen.getByText('Fold')).toBeInTheDocument();
    });

    it('does not render Bet on preflop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="preflop" />);
      expect(screen.queryByText('Bet')).not.toBeInTheDocument();
    });
  });

  describe('postflop primitive action buttons (no bet)', () => {
    it('renders Check, Bet, Fold on flop with no bet', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" seatActions={{}} />);
      expect(screen.getByText('Check')).toBeInTheDocument();
      expect(screen.getByText('Bet')).toBeInTheDocument();
      expect(screen.getByText('Fold')).toBeInTheDocument();
    });

    it('does not render Call or Raise when no bet on street', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" seatActions={{}} />);
      expect(screen.queryByText('Call')).not.toBeInTheDocument();
      expect(screen.queryByText('Raise')).not.toBeInTheDocument();
    });
  });

  describe('postflop primitive action buttons (with bet)', () => {
    it('renders Call, Raise, Fold when bet exists on street', () => {
      const seatActions = {
        flop: { 3: ['bet'] },
      };
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" seatActions={seatActions} />);
      expect(screen.getByText('Call')).toBeInTheDocument();
      expect(screen.getByText('Raise')).toBeInTheDocument();
      expect(screen.getByText('Fold')).toBeInTheDocument();
    });

    it('does not render Check or Bet when bet exists on street', () => {
      const seatActions = {
        flop: { 3: ['bet'] },
      };
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" seatActions={seatActions} />);
      expect(screen.queryByText('Check')).not.toBeInTheDocument();
      expect(screen.queryByText('Bet')).not.toBeInTheDocument();
    });
  });

  describe('multi-seat mode', () => {
    it('renders all 5 primitive actions for multi-seat selection', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} selectedPlayers={[1, 2, 3]} currentStreet="flop" />);
      expect(screen.getByText('Check')).toBeInTheDocument();
      expect(screen.getByText('Bet')).toBeInTheDocument();
      expect(screen.getByText('Call')).toBeInTheDocument();
      expect(screen.getByText('Raise')).toBeInTheDocument();
      expect(screen.getByText('Fold')).toBeInTheDocument();
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
          preflop: { 5: ['raise'] },
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
          preflop: { 5: ['raise'], 6: ['fold'] },
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
        seatActions: { preflop: { 5: ['raise'] } },
      };
      renderWithGameContext(<ActionPanel {...props} />);
      expect(screen.getByText('Clear Seat Actions')).toBeInTheDocument();
    });

    it('shows Undo Last Action when seat has actions', () => {
      const props = {
        ...defaultProps,
        selectedPlayers: [5],
        seatActions: { preflop: { 5: ['raise'] } },
      };
      renderWithGameContext(<ActionPanel {...props} />);
      expect(screen.getByText(/Undo Last Action/)).toBeInTheDocument();
    });

    it('calls onClearSeatActions with seat array when clicked', () => {
      const props = {
        ...defaultProps,
        selectedPlayers: [5],
        seatActions: { preflop: { 5: ['raise'] } },
      };
      renderWithGameContext(<ActionPanel {...props} />);
      fireEvent.click(screen.getByText('Clear Seat Actions'));
      expect(props.onClearSeatActions).toHaveBeenCalledWith([5]);
    });

    it('calls onUndoLastAction with seat number when clicked', () => {
      const props = {
        ...defaultProps,
        selectedPlayers: [5],
        seatActions: { preflop: { 5: ['raise'] } },
      };
      renderWithGameContext(<ActionPanel {...props} />);
      fireEvent.click(screen.getByText(/Undo Last Action/));
      expect(props.onUndoLastAction).toHaveBeenCalledWith(5);
    });

    it('does not show clear/undo for multiple seats even with actions', () => {
      const props = {
        ...defaultProps,
        selectedPlayers: [5, 6],
        seatActions: { preflop: { 5: ['raise'], 6: ['fold'] } },
      };
      renderWithGameContext(<ActionPanel {...props} />);
      expect(screen.queryByText('Clear Seat Actions')).not.toBeInTheDocument();
      expect(screen.queryByText(/Undo Last Action/)).not.toBeInTheDocument();
    });
  });
});
