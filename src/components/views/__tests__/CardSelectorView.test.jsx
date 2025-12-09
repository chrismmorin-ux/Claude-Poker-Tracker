/**
 * CardSelectorView.test.jsx - Tests for card selection view component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardSelectorView } from '../CardSelectorView';

// Mock the contexts
const mockDispatchCard = vi.fn();
const mockSetCardSelectorType = vi.fn();
const mockSetHighlightedCardIndex = vi.fn();

vi.mock('../../../contexts', () => ({
  useCard: () => ({
    communityCards: ['A♠', 'K♥', '', '', ''],
    holeCards: ['Q♦', 'J♣'],
    holeCardsVisible: true,
    dispatchCard: mockDispatchCard,
  }),
  useUI: () => ({
    cardSelectorType: 'community',
    highlightedBoardIndex: 0,
    setCardSelectorType: mockSetCardSelectorType,
    setHighlightedCardIndex: mockSetHighlightedCardIndex,
  }),
  useGame: () => ({
    currentStreet: 'flop',
  }),
}));

describe('CardSelectorView', { timeout: 15000 }, () => {
  const defaultProps = {
    scale: 1,
    getCardStreet: vi.fn().mockReturnValue(null),
    selectCard: vi.fn(),
    clearCards: vi.fn(),
    handleCloseCardSelector: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with current street in title', () => {
    render(<CardSelectorView {...defaultProps} />);

    expect(screen.getByText(/Select Cards:/)).toBeInTheDocument();
    expect(screen.getByText(/flop/i)).toBeInTheDocument();
  });

  it('renders BOARD label', () => {
    render(<CardSelectorView {...defaultProps} />);

    expect(screen.getByText('BOARD')).toBeInTheDocument();
  });

  it('renders HOLE CARDS label', () => {
    render(<CardSelectorView {...defaultProps} />);

    expect(screen.getByText('HOLE CARDS')).toBeInTheDocument();
  });

  it('renders Clear Board button', () => {
    render(<CardSelectorView {...defaultProps} />);

    expect(screen.getByRole('button', { name: /Clear Board/i })).toBeInTheDocument();
  });

  it('renders Clear Hole button', () => {
    render(<CardSelectorView {...defaultProps} />);

    expect(screen.getByRole('button', { name: /Clear Hole/i })).toBeInTheDocument();
  });

  it('renders Table View button', () => {
    render(<CardSelectorView {...defaultProps} />);

    expect(screen.getByRole('button', { name: /Table View/i })).toBeInTheDocument();
  });

  it('calls clearCards with "community" when Clear Board clicked', () => {
    render(<CardSelectorView {...defaultProps} />);

    const clearBoardBtn = screen.getByRole('button', { name: /Clear Board/i });
    fireEvent.click(clearBoardBtn);

    expect(defaultProps.clearCards).toHaveBeenCalledWith('community');
  });

  it('calls clearCards with "hole" when Clear Hole clicked', () => {
    render(<CardSelectorView {...defaultProps} />);

    const clearHoleBtn = screen.getByRole('button', { name: /Clear Hole/i });
    fireEvent.click(clearHoleBtn);

    expect(defaultProps.clearCards).toHaveBeenCalledWith('hole');
  });

  it('calls handleCloseCardSelector when Table View clicked', () => {
    render(<CardSelectorView {...defaultProps} />);

    const tableViewBtn = screen.getByRole('button', { name: /Table View/i });
    fireEvent.click(tableViewBtn);

    expect(defaultProps.handleCloseCardSelector).toHaveBeenCalled();
  });

  it('renders all 13 ranks in header', () => {
    render(<CardSelectorView {...defaultProps} />);

    const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
    ranks.forEach(rank => {
      // Multiple elements with rank (header + card buttons per suit)
      expect(screen.getAllByText(rank).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders all 4 suits', () => {
    render(<CardSelectorView {...defaultProps} />);

    // Suits appear in row headers and card buttons
    expect(screen.getAllByText('♠').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('♥').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('♦').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('♣').length).toBeGreaterThanOrEqual(1);
  });

  it('renders 52 card buttons (13 ranks x 4 suits)', () => {
    render(<CardSelectorView {...defaultProps} />);

    // Card buttons are within the table
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    // Each card cell has a button
    const buttons = table.querySelectorAll('td button');
    expect(buttons.length).toBe(52);
  });

  it('calls selectCard when a card button is clicked', () => {
    render(<CardSelectorView {...defaultProps} />);

    // Find a card button (9♠ for example)
    const cardButtons = screen.getByRole('table').querySelectorAll('td button');
    // First row (♠), 6th column (9)
    fireEvent.click(cardButtons[5]); // Index 5 = 9♠ (0-indexed: A=0, K=1, Q=2, J=3, T=4, 9=5)

    expect(defaultProps.selectCard).toHaveBeenCalledWith('9♠');
  });

  it('accepts scale prop', () => {
    const { container } = render(<CardSelectorView {...defaultProps} scale={0.8} />);

    // Check the scaled container is rendered
    expect(container.firstChild).toBeInTheDocument();
  });
});
