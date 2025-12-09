/**
 * ShowdownHeader.test.jsx - Tests for showdown header component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShowdownHeader } from '../ShowdownHeader';
import { SEAT_STATUS } from '../../../../constants/gameConstants';

describe('ShowdownHeader', () => {
  const defaultProps = {
    communityCards: ['', '', '', '', ''],
    onNextHand: vi.fn(),
    onClearCards: vi.fn(),
    onDone: vi.fn(),
    SEAT_STATUS,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders title text', () => {
      render(<ShowdownHeader {...defaultProps} />);
      expect(screen.getByText(/Showdown - Click a card slot/)).toBeInTheDocument();
    });

    it('renders BOARD label', () => {
      render(<ShowdownHeader {...defaultProps} />);
      expect(screen.getByText('BOARD')).toBeInTheDocument();
    });

    it('renders Next Hand button', () => {
      render(<ShowdownHeader {...defaultProps} />);
      expect(screen.getByText('Next Hand')).toBeInTheDocument();
    });

    it('renders Clear Cards button', () => {
      render(<ShowdownHeader {...defaultProps} />);
      expect(screen.getByText('Clear Cards')).toBeInTheDocument();
    });

    it('renders Done button', () => {
      render(<ShowdownHeader {...defaultProps} />);
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  describe('community cards display', () => {
    it('renders 5 card slots', () => {
      const { container } = render(<ShowdownHeader {...defaultProps} />);
      // CardSlot components should be rendered
      const cardContainer = container.querySelector('.flex.gap-2');
      expect(cardContainer).toBeInTheDocument();
    });

    it('displays community cards when present', () => {
      const props = {
        ...defaultProps,
        communityCards: ['A♠', 'K♥', 'Q♦', '', ''],
      };
      render(<ShowdownHeader {...props} />);
      expect(screen.getByText('A♠')).toBeInTheDocument();
      expect(screen.getByText('K♥')).toBeInTheDocument();
      expect(screen.getByText('Q♦')).toBeInTheDocument();
    });

    it('handles full board', () => {
      const props = {
        ...defaultProps,
        communityCards: ['A♠', 'K♥', 'Q♦', 'J♣', 'T♠'],
      };
      render(<ShowdownHeader {...props} />);
      expect(screen.getByText('A♠')).toBeInTheDocument();
      expect(screen.getByText('T♠')).toBeInTheDocument();
    });
  });

  describe('button interactions', () => {
    it('calls onNextHand when Next Hand clicked', () => {
      render(<ShowdownHeader {...defaultProps} />);
      fireEvent.click(screen.getByText('Next Hand'));
      expect(defaultProps.onNextHand).toHaveBeenCalledTimes(1);
    });

    it('calls onClearCards when Clear Cards clicked', () => {
      render(<ShowdownHeader {...defaultProps} />);
      fireEvent.click(screen.getByText('Clear Cards'));
      expect(defaultProps.onClearCards).toHaveBeenCalledTimes(1);
    });

    it('calls onDone when Done clicked', () => {
      render(<ShowdownHeader {...defaultProps} />);
      fireEvent.click(screen.getByText('Done'));
      expect(defaultProps.onDone).toHaveBeenCalledTimes(1);
    });
  });

  describe('styling', () => {
    it('Next Hand button has yellow background', () => {
      render(<ShowdownHeader {...defaultProps} />);
      const button = screen.getByText('Next Hand').closest('button');
      expect(button).toHaveClass('bg-yellow-600');
    });

    it('Clear Cards button has blue background', () => {
      render(<ShowdownHeader {...defaultProps} />);
      const button = screen.getByText('Clear Cards');
      expect(button).toHaveClass('bg-blue-600');
    });

    it('Done button has gray background', () => {
      render(<ShowdownHeader {...defaultProps} />);
      const button = screen.getByText('Done');
      expect(button).toHaveClass('bg-gray-600');
    });

    it('header has white background', () => {
      const { container } = render(<ShowdownHeader {...defaultProps} />);
      const header = container.firstChild;
      expect(header).toHaveClass('bg-white');
    });
  });
});
