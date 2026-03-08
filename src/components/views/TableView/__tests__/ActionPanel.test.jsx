// @vitest-environment jsdom
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

const defaultBlinds = { sb: 1, bb: 2 };

const renderWithGameContext = (ui, { gameState = initialGameState, dispatchGame = vi.fn(), blinds = defaultBlinds } = {}) => {
  return render(
    <GameProvider gameState={gameState} dispatchGame={dispatchGame} blinds={blinds}>
      {ui}
    </GameProvider>
  );
};

// Helper to create an action entry
const entry = (seat, action, street = 'preflop', order = 1) => ({
  seat, action, street, order, timestamp: Date.now(),
});

describe('ActionPanel', () => {
  const defaultProps = {
    selectedPlayers: [5],
    currentStreet: 'preflop',
    onClearSelection: vi.fn(),
    onToggleAbsent: vi.fn(),
    onClearSeatActions: vi.fn(),
    onUndoLastAction: vi.fn(),
    onAdvanceSeat: vi.fn(),
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
    it('renders Call with amount and Fold on preflop (Raise shown via sizing)', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="preflop" />);
      expect(screen.getByText('Call $2')).toBeInTheDocument();
      expect(screen.getByText('Fold')).toBeInTheDocument();
    });

    it('shows raise sizing options inline on preflop', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="preflop" />);
      expect(screen.getByText('Raise Size:')).toBeInTheDocument();
    });
  });

  describe('postflop primitive action buttons (no bet)', () => {
    it('renders Check, Fold on flop with no bet (Bet shown via sizing)', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      expect(screen.getByText('Check')).toBeInTheDocument();
      expect(screen.getByText('Fold')).toBeInTheDocument();
    });

    it('shows bet sizing options inline when no bet on street', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />);
      expect(screen.getByText('Bet Size:')).toBeInTheDocument();
    });
  });

  describe('postflop primitive action buttons (with bet)', () => {
    it('renders Call, Fold when bet exists (Raise shown via sizing)', () => {
      const gameState = {
        ...initialGameState,
        actionSequence: [entry(3, 'bet', 'flop')],
      };
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />, { gameState });
      expect(screen.getByText('Call')).toBeInTheDocument();
      expect(screen.getByText('Fold')).toBeInTheDocument();
    });

    it('shows raise sizing options inline when bet exists', () => {
      const gameState = {
        ...initialGameState,
        actionSequence: [entry(3, 'bet', 'flop')],
      };
      renderWithGameContext(<ActionPanel {...defaultProps} currentStreet="flop" />, { gameState });
      expect(screen.getByText('Raise Size:')).toBeInTheDocument();
    });
  });

  describe('multi-seat mode', () => {
    it('renders non-sizing actions for multi-seat selection', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} selectedPlayers={[1, 2, 3]} currentStreet="flop" />);
      expect(screen.getByText('Check')).toBeInTheDocument();
      expect(screen.getByText('Call')).toBeInTheDocument();
      expect(screen.getByText('Fold')).toBeInTheDocument();
      expect(screen.queryByText('Bet')).not.toBeInTheDocument();
      expect(screen.queryByText('Raise')).not.toBeInTheDocument();
    });
  });

  describe('control buttons', () => {
    it('renders Clear button', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} />);
      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('renders Absent button', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} />);
      expect(screen.getByText('Absent')).toBeInTheDocument();
    });

    it('calls onClearSelection when clicked', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} />);
      fireEvent.click(screen.getByText('Clear'));
      expect(defaultProps.onClearSelection).toHaveBeenCalledTimes(1);
    });

    it('calls onToggleAbsent when clicked', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} />);
      fireEvent.click(screen.getByText('Absent'));
      expect(defaultProps.onToggleAbsent).toHaveBeenCalledTimes(1);
    });
  });

  describe('action sequence display', () => {
    it('does not show action sequence when no actions recorded', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} />);
      const panel = screen.getByText('Seat 5').closest('div');
      expect(panel.querySelector('.bg-blue-50')).not.toBeInTheDocument();
    });

    it('shows action sequence when seat has actions', () => {
      const gameState = {
        ...initialGameState,
        actionSequence: [entry(5, 'raise', 'preflop')],
      };
      renderWithGameContext(<ActionPanel {...defaultProps} selectedPlayers={[5]} />, { gameState });
      const container = document.querySelector('.bg-blue-50');
      expect(container).toBeInTheDocument();
    });

    it('does not show action sequence for multiple seats', () => {
      const gameState = {
        ...initialGameState,
        actionSequence: [
          entry(5, 'raise', 'preflop'),
          entry(6, 'fold', 'preflop', 2),
        ],
      };
      renderWithGameContext(<ActionPanel {...defaultProps} selectedPlayers={[5, 6]} />, { gameState });
      const container = document.querySelector('.bg-blue-50');
      expect(container).not.toBeInTheDocument();
    });
  });

  describe('clear and undo buttons', () => {
    it('does not show Clear Actions when no actions', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} />);
      expect(screen.queryByText('Clear Actions')).not.toBeInTheDocument();
    });

    it('does not show Undo when no actions', () => {
      renderWithGameContext(<ActionPanel {...defaultProps} />);
      expect(screen.queryByText(/Undo/)).not.toBeInTheDocument();
    });

    it('shows Clear Actions when seat has actions', () => {
      const gameState = {
        ...initialGameState,
        actionSequence: [entry(5, 'raise', 'preflop')],
      };
      renderWithGameContext(<ActionPanel {...defaultProps} selectedPlayers={[5]} />, { gameState });
      expect(screen.getByText('Clear Actions')).toBeInTheDocument();
    });

    it('shows Undo when seat has actions', () => {
      const gameState = {
        ...initialGameState,
        actionSequence: [entry(5, 'raise', 'preflop')],
      };
      renderWithGameContext(<ActionPanel {...defaultProps} selectedPlayers={[5]} />, { gameState });
      expect(screen.getByText(/Undo/)).toBeInTheDocument();
    });

    it('calls onClearSeatActions with seat array when clicked', () => {
      const gameState = {
        ...initialGameState,
        actionSequence: [entry(5, 'raise', 'preflop')],
      };
      renderWithGameContext(<ActionPanel {...defaultProps} selectedPlayers={[5]} />, { gameState });
      fireEvent.click(screen.getByText('Clear Actions'));
      expect(defaultProps.onClearSeatActions).toHaveBeenCalledWith([5]);
    });

    it('calls onUndoLastAction with seat number when clicked', () => {
      const gameState = {
        ...initialGameState,
        actionSequence: [entry(5, 'raise', 'preflop')],
      };
      renderWithGameContext(<ActionPanel {...defaultProps} selectedPlayers={[5]} />, { gameState });
      fireEvent.click(screen.getByText(/Undo/));
      expect(defaultProps.onUndoLastAction).toHaveBeenCalledWith(5);
    });

    it('does not show clear/undo for multiple seats even with actions', () => {
      const gameState = {
        ...initialGameState,
        actionSequence: [
          entry(5, 'raise', 'preflop'),
          entry(6, 'fold', 'preflop', 2),
        ],
      };
      renderWithGameContext(<ActionPanel {...defaultProps} selectedPlayers={[5, 6]} />, { gameState });
      expect(screen.queryByText('Clear Actions')).not.toBeInTheDocument();
    });
  });
});
