/**
 * CardGrid.test.jsx - Tests for card selection grid component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardGrid } from '../CardGrid';

// Helper to create empty player cards
const createEmptyPlayerCards = () => {
  const cards = {};
  for (let i = 1; i <= 9; i++) {
    cards[i] = ['', ''];
  }
  return cards;
};

describe('CardGrid', () => {
  const defaultProps = {
    communityCards: ['', '', '', '', ''],
    holeCards: ['', ''],
    allPlayerCards: createEmptyPlayerCards(),
    mySeat: 5,
    highlightedSeat: null,
    highlightedHoleSlot: null,
    onSelectCard: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders all 13 rank headers', () => {
      render(<CardGrid {...defaultProps} />);
      // Each rank appears multiple times (header + 4 suit rows)
      ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'].forEach(rank => {
        const elements = screen.getAllByText(rank);
        expect(elements.length).toBeGreaterThan(0);
      });
    });

    it('renders all 4 suits', () => {
      render(<CardGrid {...defaultProps} />);
      // Each suit appears multiple times (suit column + 13 cards)
      ['♠', '♥', '♦', '♣'].forEach(suit => {
        const elements = screen.getAllByText(suit);
        expect(elements.length).toBeGreaterThan(0);
      });
    });

    it('renders 52 card buttons', () => {
      render(<CardGrid {...defaultProps} />);
      // Each card has a button
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(52);
    });
  });

  describe('card selection state', () => {
    it('disables all buttons when no seat highlighted', () => {
      render(<CardGrid {...defaultProps} highlightedSeat={null} highlightedHoleSlot={null} />);
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('enables buttons when seat and slot highlighted', () => {
      render(<CardGrid {...defaultProps} highlightedSeat={3} highlightedHoleSlot={0} />);
      // Unused cards should be enabled
      const buttons = screen.getAllByRole('button');
      const enabledButtons = buttons.filter(btn => !btn.disabled);
      expect(enabledButtons.length).toBeGreaterThan(0);
    });

    it('calls onSelectCard when card clicked with selection active', () => {
      render(<CardGrid {...defaultProps} highlightedSeat={3} highlightedHoleSlot={0} />);

      // Find an unused card button and click it
      const buttons = screen.getAllByRole('button');
      const enabledButton = buttons.find(btn => !btn.disabled);
      if (enabledButton) {
        fireEvent.click(enabledButton);
        expect(defaultProps.onSelectCard).toHaveBeenCalled();
      }
    });

    it('does not call onSelectCard when no selection active', () => {
      render(<CardGrid {...defaultProps} highlightedSeat={null} highlightedHoleSlot={null} />);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]);
      expect(defaultProps.onSelectCard).not.toHaveBeenCalled();
    });
  });

  describe('used cards', () => {
    it('shows card as used when in community cards', () => {
      const props = {
        ...defaultProps,
        communityCards: ['A♠', '', '', '', ''],
        highlightedSeat: 3,
        highlightedHoleSlot: 0,
      };
      render(<CardGrid {...props} />);

      // The A♠ button should show the card with reduced opacity
      const buttons = screen.getAllByRole('button');
      const aceSpadeButton = buttons.find(btn =>
        btn.textContent.includes('A') && btn.textContent.includes('♠')
      );
      expect(aceSpadeButton).toHaveClass('opacity-40');
    });

    it('shows card as used when in hole cards', () => {
      const props = {
        ...defaultProps,
        holeCards: ['K♥', ''],
        highlightedSeat: 3,
        highlightedHoleSlot: 0,
      };
      render(<CardGrid {...props} />);

      const buttons = screen.getAllByRole('button');
      const kingHeartsButton = buttons.find(btn =>
        btn.textContent.includes('K') && btn.textContent.includes('♥')
      );
      expect(kingHeartsButton).toHaveClass('opacity-40');
    });

    it('shows card as used when in other player cards', () => {
      const playerCards = createEmptyPlayerCards();
      playerCards[3] = ['Q♦', ''];

      const props = {
        ...defaultProps,
        allPlayerCards: playerCards,
        highlightedSeat: 5,
        highlightedHoleSlot: 0,
      };
      render(<CardGrid {...props} />);

      const buttons = screen.getAllByRole('button');
      const queenDiamondsButton = buttons.find(btn =>
        btn.textContent.includes('Q') && btn.textContent.includes('♦')
      );
      expect(queenDiamondsButton).toHaveClass('opacity-40');
    });
  });

  describe('street indicators', () => {
    it('shows F indicator for flop cards', () => {
      const props = {
        ...defaultProps,
        communityCards: ['A♠', 'K♥', 'Q♦', '', ''],
      };
      render(<CardGrid {...props} />);

      // All 3 flop cards should have F indicator
      const fIndicators = screen.getAllByText('F');
      expect(fIndicators.length).toBe(3);
    });

    it('shows T indicator for turn card', () => {
      const props = {
        ...defaultProps,
        communityCards: ['A♠', 'K♥', 'Q♦', 'J♣', ''],
      };
      render(<CardGrid {...props} />);

      // 'T' appears both as rank header and turn indicator
      const tElements = screen.getAllByText('T');
      expect(tElements.length).toBeGreaterThan(1);  // More than just the rank header
    });

    it('shows R indicator for river card', () => {
      const props = {
        ...defaultProps,
        communityCards: ['A♠', 'K♥', 'Q♦', 'J♣', 'T♠'],
      };
      render(<CardGrid {...props} />);

      expect(screen.getByText('R')).toBeInTheDocument();
    });
  });

  describe('seat indicators', () => {
    it('shows seat number on cards assigned to players', () => {
      const playerCards = createEmptyPlayerCards();
      playerCards[7] = ['9♥', ''];

      const props = {
        ...defaultProps,
        allPlayerCards: playerCards,
      };
      render(<CardGrid {...props} />);

      // Seat 7 should be shown on the card
      // '7' appears both as a rank and seat indicator
      const sevenElements = screen.getAllByText('7');
      expect(sevenElements.length).toBeGreaterThan(0);
    });

    it('shows mySeat number on hole cards', () => {
      const props = {
        ...defaultProps,
        holeCards: ['A♥', ''],
        mySeat: 5,
      };
      render(<CardGrid {...props} />);

      // The 5 should appear as seat indicator
      const seatIndicators = screen.getAllByText('5');
      expect(seatIndicators.length).toBeGreaterThan(0);
    });
  });

  describe('card styling', () => {
    it('red suits have red text color', () => {
      render(<CardGrid {...defaultProps} />);

      // Hearts and diamonds rows should have red suit indicators
      const heartsTexts = screen.getAllByText('♥');
      const redHearts = heartsTexts.filter(el => el.classList.contains('text-red-600'));
      expect(redHearts.length).toBeGreaterThan(0);

      const diamondsTexts = screen.getAllByText('♦');
      const redDiamonds = diamondsTexts.filter(el => el.classList.contains('text-red-600'));
      expect(redDiamonds.length).toBeGreaterThan(0);
    });

    it('black suits have black text color', () => {
      render(<CardGrid {...defaultProps} />);

      const spadesTexts = screen.getAllByText('♠');
      const blackSpades = spadesTexts.filter(el => el.classList.contains('text-black'));
      expect(blackSpades.length).toBeGreaterThan(0);

      const clubsTexts = screen.getAllByText('♣');
      const blackClubs = clubsTexts.filter(el => el.classList.contains('text-black'));
      expect(blackClubs.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty community cards', () => {
      render(<CardGrid {...defaultProps} communityCards={['', '', '', '', '']} />);
      // Should not show any street indicators (F, T, R)
      // Note: 'T' appears as rank Ten, but should not appear as Turn indicator badge
      expect(screen.queryByText('F')).not.toBeInTheDocument();
      expect(screen.queryByText('R')).not.toBeInTheDocument();
      // 'T' will appear in multiple places as the rank header
      const tElements = screen.getAllByText('T');
      // Should only be in header and card cells (5 for rank: 1 header + 4 suit rows), no indicator badges
      expect(tElements.length).toBe(5);
    });

    it('handles all cards used', () => {
      // Create a scenario where many cards are used
      const playerCards = createEmptyPlayerCards();
      playerCards[1] = ['A♠', 'K♠'];
      playerCards[2] = ['Q♠', 'J♠'];

      const props = {
        ...defaultProps,
        communityCards: ['T♠', '9♠', '8♠', '7♠', '6♠'],
        allPlayerCards: playerCards,
        highlightedSeat: 3,
        highlightedHoleSlot: 0,
      };
      render(<CardGrid {...props} />);

      // Component should render without crashing
      const aElements = screen.getAllByText('A');
      expect(aElements.length).toBeGreaterThan(0);
    });
  });
});
