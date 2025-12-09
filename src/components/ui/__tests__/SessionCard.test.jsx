/**
 * SessionCard.test.jsx - Tests for SessionCard component
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionCard } from '../SessionCard';
import { createMockSession } from '../../../test/utils';

describe('SessionCard', () => {
  const mockSession = createMockSession({
    sessionId: 123,
    startTime: new Date('2024-12-07T14:30:00').getTime(),
    endTime: new Date('2024-12-07T18:45:00').getTime(),
    venue: 'Horseshoe Casino',
    gameType: '1/2',
    buyIn: 200,
    rebuyTransactions: [],
    cashOut: 350,
    handCount: 75,
    goal: 'Practice 3-betting',
  });

  const defaultProps = {
    session: mockSession,
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders venue', () => {
      render(<SessionCard {...defaultProps} />);
      expect(screen.getByText(/Horseshoe Casino/)).toBeInTheDocument();
    });

    it('renders game type', () => {
      render(<SessionCard {...defaultProps} />);
      expect(screen.getByText(/1\/2/)).toBeInTheDocument();
    });

    it('renders hand count', () => {
      render(<SessionCard {...defaultProps} />);
      expect(screen.getByText('75 hands')).toBeInTheDocument();
    });

    it('renders buy-in', () => {
      render(<SessionCard {...defaultProps} />);
      expect(screen.getByText('Buy-in: $200')).toBeInTheDocument();
    });

    it('renders cash out', () => {
      render(<SessionCard {...defaultProps} />);
      expect(screen.getByText('Cash out: $350')).toBeInTheDocument();
    });

    it('renders goal', () => {
      render(<SessionCard {...defaultProps} />);
      expect(screen.getByText('Practice 3-betting')).toBeInTheDocument();
    });
  });

  describe('date and time formatting', () => {
    it('formats date correctly', () => {
      render(<SessionCard {...defaultProps} />);
      // Should show "Dec 7" format
      expect(screen.getByText(/Dec 7/)).toBeInTheDocument();
    });

    it('formats time in 12-hour format', () => {
      render(<SessionCard {...defaultProps} />);
      // Should show time like "2:30 PM"
      expect(screen.getByText(/2:30 PM/)).toBeInTheDocument();
    });
  });

  describe('duration calculation', () => {
    it('shows duration in hours and minutes', () => {
      render(<SessionCard {...defaultProps} />);
      // 14:30 to 18:45 = 4h 15m
      expect(screen.getByText('4h 15m')).toBeInTheDocument();
    });

    it('shows only minutes for short sessions', () => {
      const shortSession = createMockSession({
        ...mockSession,
        startTime: new Date('2024-12-07T14:30:00').getTime(),
        endTime: new Date('2024-12-07T15:00:00').getTime(),
      });

      render(<SessionCard {...defaultProps} session={shortSession} />);
      expect(screen.getByText('30m')).toBeInTheDocument();
    });
  });

  describe('profit/loss calculation', () => {
    it('shows positive profit in green', () => {
      render(<SessionCard {...defaultProps} />);
      // Buy-in: 200, Cash out: 350 = +150
      const profit = screen.getByText('+$150.00');
      expect(profit).toBeInTheDocument();
      expect(profit.className).toContain('text-green-600');
    });

    it('shows negative profit in red', () => {
      const losingSession = createMockSession({
        ...mockSession,
        cashOut: 100,
      });

      render(<SessionCard {...defaultProps} session={losingSession} />);
      // Buy-in: 200, Cash out: 100 = -100
      // Format is $-100.00 (dollar sign before negative)
      const loss = screen.getByText('$-100.00');
      expect(loss).toBeInTheDocument();
      expect(loss.className).toContain('text-red-600');
    });

    it('does not show profit when no cash out', () => {
      const ongoingSession = createMockSession({
        ...mockSession,
        cashOut: null,
      });

      render(<SessionCard {...defaultProps} session={ongoingSession} />);
      expect(screen.queryByText(/\$\d+\.\d+$/)).not.toBeInTheDocument();
    });

    it('includes rebuys in profit calculation', () => {
      const rebuySession = createMockSession({
        ...mockSession,
        buyIn: 200,
        rebuyTransactions: [{ amount: 100 }, { amount: 50 }],
        cashOut: 500,
      });

      render(<SessionCard {...defaultProps} session={rebuySession} />);
      // Buy-in: 200 + Rebuys: 150 = 350 total, Cash out: 500 = +150
      expect(screen.getByText('+$150.00')).toBeInTheDocument();
    });
  });

  describe('rebuy display', () => {
    it('shows rebuy total when present', () => {
      const rebuySession = createMockSession({
        ...mockSession,
        rebuyTransactions: [{ amount: 100 }, { amount: 50 }],
      });

      render(<SessionCard {...defaultProps} session={rebuySession} />);
      expect(screen.getByText('(+$150 rebuy)')).toBeInTheDocument();
    });

    it('does not show rebuy when empty', () => {
      render(<SessionCard {...defaultProps} />);
      expect(screen.queryByText(/rebuy/)).not.toBeInTheDocument();
    });
  });

  describe('delete button', () => {
    it('renders delete button', () => {
      render(<SessionCard {...defaultProps} />);
      // The delete button contains Trash2 icon
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('calls onDelete with sessionId when clicked', () => {
      render(<SessionCard {...defaultProps} />);

      fireEvent.click(screen.getByRole('button'));

      expect(defaultProps.onDelete).toHaveBeenCalledWith(123);
    });
  });

  describe('optional fields', () => {
    it('handles missing buy-in', () => {
      const noBuyIn = createMockSession({
        ...mockSession,
        buyIn: null,
      });

      render(<SessionCard {...defaultProps} session={noBuyIn} />);
      expect(screen.queryByText(/Buy-in/)).not.toBeInTheDocument();
    });

    it('handles missing goal', () => {
      const noGoal = createMockSession({
        ...mockSession,
        goal: null,
      });

      render(<SessionCard {...defaultProps} session={noGoal} />);
      expect(screen.queryByText('Practice 3-betting')).not.toBeInTheDocument();
    });

    it('handles zero hand count', () => {
      const zeroHands = createMockSession({
        ...mockSession,
        handCount: 0,
      });

      render(<SessionCard {...defaultProps} session={zeroHands} />);
      expect(screen.getByText('0 hands')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('has hover effect', () => {
      const { container } = render(<SessionCard {...defaultProps} />);
      expect(container.firstChild.className).toContain('hover:bg-gray-50');
    });

    it('has transition for hover', () => {
      const { container } = render(<SessionCard {...defaultProps} />);
      expect(container.firstChild.className).toContain('transition-colors');
    });

    it('delete button has red styling', () => {
      render(<SessionCard {...defaultProps} />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('text-red-600');
    });

    it('delete button has hover effect', () => {
      render(<SessionCard {...defaultProps} />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('hover:bg-red-50');
    });
  });

  describe('icons', () => {
    it('renders clock icon next to duration', () => {
      const { container } = render(<SessionCard {...defaultProps} />);
      // Clock icon from lucide-react will be an svg
      const clockSvg = container.querySelector('svg');
      expect(clockSvg).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('handles session with endTime equal to startTime', () => {
      const zeroLength = createMockSession({
        ...mockSession,
        startTime: new Date('2024-12-07T14:30:00').getTime(),
        endTime: new Date('2024-12-07T14:30:00').getTime(),
      });

      render(<SessionCard {...defaultProps} session={zeroLength} />);
      expect(screen.getByText('0m')).toBeInTheDocument();
    });

    it('handles session without endTime (uses current time)', () => {
      const noEnd = createMockSession({
        ...mockSession,
        endTime: null,
      });

      render(<SessionCard {...defaultProps} session={noEnd} />);
      // Should still render without error
      expect(screen.getByText(/Horseshoe Casino/)).toBeInTheDocument();
    });

    it('handles break-even session', () => {
      const breakEven = createMockSession({
        ...mockSession,
        buyIn: 200,
        cashOut: 200,
      });

      render(<SessionCard {...defaultProps} session={breakEven} />);
      expect(screen.getByText('+$0.00')).toBeInTheDocument();
    });

    it('handles undefined rebuyTransactions', () => {
      const noRebuys = createMockSession({
        ...mockSession,
        rebuyTransactions: undefined,
      });

      render(<SessionCard {...defaultProps} session={noRebuys} />);
      expect(screen.queryByText(/rebuy/)).not.toBeInTheDocument();
    });
  });
});
