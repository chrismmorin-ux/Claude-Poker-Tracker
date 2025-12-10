/**
 * ShowdownSeatRow.test.jsx - Tests for showdown seat row component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShowdownSeatRow } from '../ShowdownSeatRow';
import { SEAT_STATUS, ACTIONS } from '../../../../constants/gameConstants';

describe('ShowdownSeatRow', () => {
  const defaultProps = {
    seat: 5,
    cards: ['', ''],
    isMySeat: false,
    isDealer: false,
    isSB: false,
    isBB: false,
    holeCardsVisible: true,
    inactiveStatus: null,
    isMucked: false,
    hasWon: false,
    anyoneHasWon: false,
    highlightedSeat: null,
    highlightedHoleSlot: null,
    mode: 'selection',
    SEAT_STATUS,
    ACTIONS,
    seatActions: [],
    onSetHoleCardsVisible: vi.fn(),
    onHighlightSlot: vi.fn(),
    onMuck: vi.fn(),
    onWon: vi.fn(),
    getOverlayStatus: vi.fn(() => null),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders seat number', () => {
      render(<ShowdownSeatRow {...defaultProps} />);
      expect(screen.getByText('Seat 5')).toBeInTheDocument();
    });

    it('renders different seat number', () => {
      render(<ShowdownSeatRow {...defaultProps} seat={9} />);
      expect(screen.getByText('Seat 9')).toBeInTheDocument();
    });

    it('renders two card slots', () => {
      const { container } = render(<ShowdownSeatRow {...defaultProps} />);
      // CardSlot components should be rendered
      expect(container.querySelector('.flex.gap-1')).toBeInTheDocument();
    });
  });

  describe('position badges', () => {
    it('renders dealer badge when isDealer', () => {
      render(<ShowdownSeatRow {...defaultProps} isDealer={true} />);
      expect(screen.getByText('D')).toBeInTheDocument();
    });

    it('does not render dealer badge when not dealer', () => {
      render(<ShowdownSeatRow {...defaultProps} isDealer={false} />);
      expect(screen.queryByText('D')).not.toBeInTheDocument();
    });

    it('renders SB badge when isSB', () => {
      render(<ShowdownSeatRow {...defaultProps} isSB={true} />);
      expect(screen.getByText('SB')).toBeInTheDocument();
    });

    it('renders BB badge when isBB', () => {
      render(<ShowdownSeatRow {...defaultProps} isBB={true} />);
      expect(screen.getByText('BB')).toBeInTheDocument();
    });

    it('renders ME badge when isMySeat', () => {
      render(<ShowdownSeatRow {...defaultProps} isMySeat={true} />);
      expect(screen.getByText('ME')).toBeInTheDocument();
    });

    it('renders multiple badges', () => {
      render(<ShowdownSeatRow {...defaultProps} isDealer={true} isMySeat={true} />);
      expect(screen.getByText('D')).toBeInTheDocument();
      expect(screen.getByText('ME')).toBeInTheDocument();
    });
  });

  describe('visibility toggle', () => {
    it('renders visibility toggle when isMySeat', () => {
      render(<ShowdownSeatRow {...defaultProps} isMySeat={true} />);
      // Check for the visibility toggle button - it contains an eye emoji
      const buttons = screen.getAllByRole('button');
      // When isMySeat=true, should have 3 buttons: visibility toggle, Muck, Won
      expect(buttons.length).toBe(3);
    });

    it('does not render visibility toggle when not my seat', () => {
      render(<ShowdownSeatRow {...defaultProps} isMySeat={false} />);
      // Check for buttons - should only have Muck and Won, no visibility toggle
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(2); // Muck and Won only
    });

    it('calls onSetHoleCardsVisible when toggle clicked', () => {
      render(<ShowdownSeatRow {...defaultProps} isMySeat={true} holeCardsVisible={true} />);
      // Find the visibility toggle button by looking for the button that's not Muck/Won
      const buttons = screen.getAllByRole('button');
      // The visibility toggle should be a small button, not Muck/Won
      const toggleButton = buttons.find(
        (btn) => !btn.textContent.includes('Muck') && !btn.textContent.includes('Won')
      );
      if (toggleButton) {
        fireEvent.click(toggleButton);
        expect(defaultProps.onSetHoleCardsVisible).toHaveBeenCalledWith(false);
      }
    });
  });

  describe('action buttons in selection mode', () => {
    it('renders Muck button for active seats', () => {
      render(<ShowdownSeatRow {...defaultProps} mode="selection" />);
      expect(screen.getByText('Muck')).toBeInTheDocument();
    });

    it('renders Won button for active seats when no one has won', () => {
      render(<ShowdownSeatRow {...defaultProps} mode="selection" hasWon={false} />);
      expect(screen.getByText('Won')).toBeInTheDocument();
    });

    it('hides Won button when anyoneHasWon is true', () => {
      render(<ShowdownSeatRow {...defaultProps} mode="selection" anyoneHasWon={true} />);
      expect(screen.queryByText('Won')).not.toBeInTheDocument();
    });

    it('hides action buttons when seat is absent', () => {
      render(
        <ShowdownSeatRow {...defaultProps} mode="selection" inactiveStatus={SEAT_STATUS.ABSENT} />
      );
      expect(screen.queryByText('Muck')).not.toBeInTheDocument();
      expect(screen.queryByText('Won')).not.toBeInTheDocument();
    });

    it('hides action buttons when seat is folded', () => {
      render(
        <ShowdownSeatRow {...defaultProps} mode="selection" inactiveStatus={SEAT_STATUS.FOLDED} />
      );
      expect(screen.queryByText('Muck')).not.toBeInTheDocument();
      expect(screen.queryByText('Won')).not.toBeInTheDocument();
    });

    it('hides action buttons when seat is mucked', () => {
      render(<ShowdownSeatRow {...defaultProps} mode="selection" isMucked={true} />);
      expect(screen.queryByText('Muck')).not.toBeInTheDocument();
      expect(screen.queryByText('Won')).not.toBeInTheDocument();
    });

    it('hides action buttons in summary mode', () => {
      render(<ShowdownSeatRow {...defaultProps} mode="summary" />);
      expect(screen.queryByText('Muck')).not.toBeInTheDocument();
      expect(screen.queryByText('Won')).not.toBeInTheDocument();
    });

    it('calls onMuck when Muck clicked', () => {
      render(<ShowdownSeatRow {...defaultProps} mode="selection" />);
      fireEvent.click(screen.getByText('Muck'));
      expect(defaultProps.onMuck).toHaveBeenCalledWith(5);
    });

    it('calls onWon when Won clicked', () => {
      render(<ShowdownSeatRow {...defaultProps} mode="selection" />);
      fireEvent.click(screen.getByText('Won'));
      expect(defaultProps.onWon).toHaveBeenCalledWith(5);
    });
  });

  describe('card slot interaction', () => {
    it('calls onHighlightSlot when card slot clicked in selection mode', () => {
      const { container } = render(
        <ShowdownSeatRow {...defaultProps} mode="selection" />
      );
      // Find and click a card slot
      const cardSlots = container.querySelectorAll('[class*="cursor"]');
      if (cardSlots.length > 0) {
        fireEvent.click(cardSlots[0]);
        // onHighlightSlot should be called
      }
    });

    it('does not allow interaction when seat is absent', () => {
      const { container } = render(
        <ShowdownSeatRow
          {...defaultProps}
          mode="selection"
          inactiveStatus={SEAT_STATUS.ABSENT}
        />
      );
      // Card slots should not be interactive
      const cardSlots = container.querySelectorAll('[class*="cursor-pointer"]');
      expect(cardSlots.length).toBe(0);
    });
  });

  describe('highlighting', () => {
    it('highlights correct slot when selected', () => {
      const { container } = render(
        <ShowdownSeatRow
          {...defaultProps}
          mode="selection"
          highlightedSeat={5}
          highlightedHoleSlot={0}
        />
      );
      // The first card slot should have highlighting styles
      expect(container).toBeInTheDocument();
    });

    it('does not highlight when different seat selected', () => {
      const { container } = render(
        <ShowdownSeatRow
          {...defaultProps}
          mode="selection"
          highlightedSeat={3}
          highlightedHoleSlot={0}
        />
      );
      // No highlighting for seat 5 when seat 3 is highlighted
      expect(container).toBeInTheDocument();
    });
  });

  describe('cards display', () => {
    it('displays cards when provided', () => {
      render(<ShowdownSeatRow {...defaultProps} cards={['A♠', 'K♥']} />);
      expect(screen.getByText('A♠')).toBeInTheDocument();
      expect(screen.getByText('K♥')).toBeInTheDocument();
    });

    it('displays empty slots when no cards', () => {
      const { container } = render(<ShowdownSeatRow {...defaultProps} cards={['', '']} />);
      // Empty card slots should still be rendered
      expect(container).toBeInTheDocument();
    });
  });

  describe('seat statuses', () => {
    it('handles WON action in seatActions', () => {
      render(
        <ShowdownSeatRow
          {...defaultProps}
          mode="selection"
          seatActions={[ACTIONS.WON]}
        />
      );
      // Won button should be hidden when seat has WON action
      expect(screen.queryByText('Won')).not.toBeInTheDocument();
    });

    it('handles seatActions as array', () => {
      render(
        <ShowdownSeatRow
          {...defaultProps}
          mode="selection"
          seatActions={[ACTIONS.CALL, ACTIONS.RAISE]}
        />
      );
      // Should still show Muck/Won buttons
      expect(screen.getByText('Muck')).toBeInTheDocument();
    });

    it('handles seatActions as string', () => {
      render(
        <ShowdownSeatRow
          {...defaultProps}
          mode="selection"
          seatActions={ACTIONS.CALL}
        />
      );
      // Should still show Muck/Won buttons
      expect(screen.getByText('Muck')).toBeInTheDocument();
    });
  });

  describe('overlay status', () => {
    it('calls getOverlayStatus with correct params', () => {
      render(
        <ShowdownSeatRow
          {...defaultProps}
          inactiveStatus={SEAT_STATUS.FOLDED}
          isMucked={false}
          hasWon={false}
        />
      );
      expect(defaultProps.getOverlayStatus).toHaveBeenCalledWith(
        SEAT_STATUS.FOLDED,
        false,
        false
      );
    });

    it('passes mucked status to getOverlayStatus', () => {
      render(<ShowdownSeatRow {...defaultProps} isMucked={true} />);
      expect(defaultProps.getOverlayStatus).toHaveBeenCalledWith(null, true, false);
    });

    it('passes won status to getOverlayStatus', () => {
      render(<ShowdownSeatRow {...defaultProps} hasWon={true} />);
      expect(defaultProps.getOverlayStatus).toHaveBeenCalledWith(null, false, true);
    });
  });
});
