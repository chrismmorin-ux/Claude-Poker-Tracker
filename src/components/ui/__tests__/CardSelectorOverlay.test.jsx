// @vitest-environment jsdom
/**
 * CardSelectorOverlay.test.jsx - Tests for inline card selector overlay
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardSelectorOverlay } from '../CardSelectorOverlay';

describe('CardSelectorOverlay', () => {
  const defaultProps = {
    isOpen: true,
    communityCards: ['', '', '', '', ''],
    holeCards: ['', ''],
    holeCardsVisible: true,
    cardSelectorType: 'community',
    highlightedBoardIndex: 0,
    onSelectCard: vi.fn(),
    onClose: vi.fn(),
    getCardStreet: vi.fn(() => null),
    setCardSelectorType: vi.fn(),
    setHighlightedCardIndex: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = render(<CardSelectorOverlay {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders card grid when isOpen is true', () => {
      render(<CardSelectorOverlay {...defaultProps} />);
      // Should render suit symbols in the grid
      expect(screen.getAllByText('♠').length).toBeGreaterThan(0);
      expect(screen.getAllByText('♥').length).toBeGreaterThan(0);
    });

    it('renders close button', () => {
      render(<CardSelectorOverlay {...defaultProps} />);
      expect(screen.getByLabelText('Close card selector')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('fires onClose when close button clicked', () => {
      render(<CardSelectorOverlay {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Close card selector'));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('fires onClose when backdrop clicked', () => {
      render(<CardSelectorOverlay {...defaultProps} />);
      // Click the backdrop (the outermost fixed div)
      const backdrop = document.querySelector('.fixed.inset-0');
      fireEvent.click(backdrop);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('does not fire onClose when modal content clicked', () => {
      render(<CardSelectorOverlay {...defaultProps} />);
      // Click on the close button's parent container (the modal content area)
      const closeBtn = screen.getByLabelText('Close card selector');
      const modalContent = closeBtn.closest('.bg-white');
      fireEvent.click(modalContent);
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });
});
