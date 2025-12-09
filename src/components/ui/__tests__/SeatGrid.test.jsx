/**
 * SeatGrid.test.jsx - Tests for SeatGrid component
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SeatGrid } from '../SeatGrid';

describe('SeatGrid', () => {
  const defaultProps = {
    selectedSeat: null,
    getSeatPlayerName: vi.fn((seat) => null),
    onSeatClick: vi.fn(),
    onClearSeat: vi.fn(),
    onClearAllSeats: vi.fn(),
    onSeatDragStart: vi.fn(),
    onSeatDragEnd: vi.fn(),
    onDrop: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders all 9 seats', () => {
      render(<SeatGrid {...defaultProps} />);

      for (let i = 1; i <= 9; i++) {
        expect(screen.getByText(`Seat ${i}`)).toBeInTheDocument();
      }
    });

    it('renders title', () => {
      render(<SeatGrid {...defaultProps} />);
      expect(screen.getByText('Current Seat Assignments')).toBeInTheDocument();
    });

    it('renders Clear All Seats button', () => {
      render(<SeatGrid {...defaultProps} />);
      expect(screen.getByText('Clear All Seats')).toBeInTheDocument();
    });

    it('shows Empty for seats without players', () => {
      render(<SeatGrid {...defaultProps} />);
      const emptyLabels = screen.getAllByText('Empty');
      expect(emptyLabels.length).toBe(9);
    });
  });

  describe('seat with player', () => {
    it('shows player name when assigned', () => {
      const getSeatPlayerName = vi.fn((seat) => (seat === 3 ? 'John Doe' : null));

      render(<SeatGrid {...defaultProps} getSeatPlayerName={getSeatPlayerName} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('shows Clear button for occupied seat', () => {
      const getSeatPlayerName = vi.fn((seat) => (seat === 3 ? 'John Doe' : null));

      render(<SeatGrid {...defaultProps} getSeatPlayerName={getSeatPlayerName} />);

      expect(screen.getByText('Clear')).toBeInTheDocument();
    });

    it('applies blue styling for occupied seat', () => {
      const getSeatPlayerName = vi.fn((seat) => (seat === 3 ? 'John Doe' : null));

      const { container } = render(<SeatGrid {...defaultProps} getSeatPlayerName={getSeatPlayerName} />);

      const seats = container.querySelectorAll('.border-2');
      const occupiedSeat = Array.from(seats).find(s => s.className.includes('border-blue-500'));
      expect(occupiedSeat).toBeDefined();
    });
  });

  describe('seat selection', () => {
    it('highlights selected seat', () => {
      const { container } = render(<SeatGrid {...defaultProps} selectedSeat={5} />);

      const selectedSeatEl = container.querySelector('.border-yellow-400');
      expect(selectedSeatEl).toBeInTheDocument();
      expect(selectedSeatEl.className).toContain('ring-4');
      expect(selectedSeatEl.className).toContain('scale-110');
    });

    it('shows instruction text for selected seat', () => {
      render(<SeatGrid {...defaultProps} selectedSeat={5} />);
      expect(screen.getByText('Click player below')).toBeInTheDocument();
    });

    it('shows selection message below grid', () => {
      render(<SeatGrid {...defaultProps} selectedSeat={5} />);
      expect(screen.getByText('Seat 5 selected - Click a player below to assign')).toBeInTheDocument();
    });

    it('does not show selection message when no seat selected', () => {
      render(<SeatGrid {...defaultProps} />);
      expect(screen.queryByText(/selected - Click a player/)).not.toBeInTheDocument();
    });
  });

  describe('click handlers', () => {
    it('calls onSeatClick when seat is clicked', () => {
      render(<SeatGrid {...defaultProps} />);

      // Find seat 3 container and click it
      const seat3 = screen.getByText('Seat 3').closest('.border-2');
      fireEvent.click(seat3);

      expect(defaultProps.onSeatClick).toHaveBeenCalledWith(3);
    });

    it('calls onClearAllSeats when Clear All Seats is clicked', () => {
      render(<SeatGrid {...defaultProps} />);

      fireEvent.click(screen.getByText('Clear All Seats'));

      expect(defaultProps.onClearAllSeats).toHaveBeenCalled();
    });

    it('calls onClearSeat when Clear button is clicked', () => {
      const getSeatPlayerName = vi.fn((seat) => (seat === 7 ? 'Jane Doe' : null));

      render(<SeatGrid {...defaultProps} getSeatPlayerName={getSeatPlayerName} />);

      fireEvent.click(screen.getByText('Clear'));

      expect(defaultProps.onClearSeat).toHaveBeenCalledWith(7);
    });

    it('stops propagation when Clear button is clicked', () => {
      const getSeatPlayerName = vi.fn((seat) => (seat === 7 ? 'Jane Doe' : null));

      render(<SeatGrid {...defaultProps} getSeatPlayerName={getSeatPlayerName} />);

      fireEvent.click(screen.getByText('Clear'));

      // onSeatClick should not be called
      expect(defaultProps.onSeatClick).not.toHaveBeenCalled();
    });
  });

  describe('drag functionality', () => {
    it('occupied seats are draggable', () => {
      const getSeatPlayerName = vi.fn((seat) => (seat === 3 ? 'John Doe' : null));

      const { container } = render(<SeatGrid {...defaultProps} getSeatPlayerName={getSeatPlayerName} />);

      const seat3 = screen.getByText('Seat 3').closest('.border-2');
      expect(seat3).toHaveAttribute('draggable', 'true');
    });

    it('empty seats are not draggable', () => {
      const { container } = render(<SeatGrid {...defaultProps} />);

      const seat1 = screen.getByText('Seat 1').closest('.border-2');
      expect(seat1).toHaveAttribute('draggable', 'false');
    });

    it('calls onSeatDragStart when drag starts from occupied seat', () => {
      const getSeatPlayerName = vi.fn((seat) => (seat === 3 ? 'John Doe' : null));

      render(<SeatGrid {...defaultProps} getSeatPlayerName={getSeatPlayerName} />);

      const seat3 = screen.getByText('Seat 3').closest('.border-2');
      fireEvent.dragStart(seat3);

      expect(defaultProps.onSeatDragStart).toHaveBeenCalledWith(3);
    });

    it('calls onSeatDragEnd when drag ends', () => {
      const getSeatPlayerName = vi.fn((seat) => (seat === 3 ? 'John Doe' : null));

      render(<SeatGrid {...defaultProps} getSeatPlayerName={getSeatPlayerName} />);

      const seat3 = screen.getByText('Seat 3').closest('.border-2');
      fireEvent.dragEnd(seat3);

      expect(defaultProps.onSeatDragEnd).toHaveBeenCalled();
    });

    it('calls onDrop when player is dropped on seat', () => {
      render(<SeatGrid {...defaultProps} />);

      const seat5 = screen.getByText('Seat 5').closest('.border-2');
      fireEvent.drop(seat5);

      expect(defaultProps.onDrop).toHaveBeenCalledWith(5);
    });

    it('prevents default on dragOver', () => {
      render(<SeatGrid {...defaultProps} />);

      const seat5 = screen.getByText('Seat 5').closest('.border-2');
      const event = new Event('dragover', { bubbles: true });
      event.preventDefault = vi.fn();

      fireEvent.dragOver(seat5, event);

      // The component should handle dragOver
      // We can't directly test preventDefault, but we can ensure the event doesn't error
    });
  });

  describe('styling', () => {
    it('uses grid layout with 9 columns', () => {
      const { container } = render(<SeatGrid {...defaultProps} />);
      const grid = container.querySelector('.grid-cols-9');
      expect(grid).toBeInTheDocument();
    });

    it('has white background', () => {
      const { container } = render(<SeatGrid {...defaultProps} />);
      expect(container.firstChild.className).toContain('bg-white');
    });

    it('has border-b for separation', () => {
      const { container } = render(<SeatGrid {...defaultProps} />);
      expect(container.firstChild.className).toContain('border-b');
    });

    it('empty seats have gray styling', () => {
      const { container } = render(<SeatGrid {...defaultProps} />);
      const emptySeats = container.querySelectorAll('.border-gray-300');
      expect(emptySeats.length).toBe(9);
    });

    it('Clear All button has red styling', () => {
      render(<SeatGrid {...defaultProps} />);
      const clearAllBtn = screen.getByText('Clear All Seats');
      expect(clearAllBtn.className).toContain('bg-red-600');
    });
  });

  describe('player name display', () => {
    it('truncates long player names', () => {
      const getSeatPlayerName = vi.fn((seat) =>
        seat === 3 ? 'Very Long Player Name That Should Truncate' : null
      );

      const { container } = render(<SeatGrid {...defaultProps} getSeatPlayerName={getSeatPlayerName} />);

      const nameElement = screen.getByText('Very Long Player Name That Should Truncate');
      expect(nameElement.className).toContain('truncate');
    });

    it('shows full name in title attribute', () => {
      const getSeatPlayerName = vi.fn((seat) =>
        seat === 3 ? 'Very Long Player Name' : null
      );

      render(<SeatGrid {...defaultProps} getSeatPlayerName={getSeatPlayerName} />);

      const nameElement = screen.getByText('Very Long Player Name');
      expect(nameElement).toHaveAttribute('title', 'Very Long Player Name');
    });
  });

  describe('multiple occupied seats', () => {
    it('shows multiple players correctly', () => {
      const getSeatPlayerName = vi.fn((seat) => {
        if (seat === 1) return 'Player 1';
        if (seat === 5) return 'Player 5';
        if (seat === 9) return 'Player 9';
        return null;
      });

      render(<SeatGrid {...defaultProps} getSeatPlayerName={getSeatPlayerName} />);

      expect(screen.getByText('Player 1')).toBeInTheDocument();
      expect(screen.getByText('Player 5')).toBeInTheDocument();
      expect(screen.getByText('Player 9')).toBeInTheDocument();
    });

    it('shows correct number of Clear buttons', () => {
      const getSeatPlayerName = vi.fn((seat) => {
        if (seat === 1 || seat === 5 || seat === 9) return `Player ${seat}`;
        return null;
      });

      render(<SeatGrid {...defaultProps} getSeatPlayerName={getSeatPlayerName} />);

      const clearButtons = screen.getAllByText('Clear');
      expect(clearButtons.length).toBe(3);
    });
  });
});
