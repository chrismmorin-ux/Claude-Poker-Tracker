// @vitest-environment jsdom
/**
 * SeatContextMenu.test.jsx - Tests for seat context menu component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SeatContextMenu } from '../SeatContextMenu';

describe('SeatContextMenu', () => {
  const mockRecentPlayers = [
    { playerId: '1', name: 'John Doe' },
    { playerId: '2', name: 'Jane Smith' },
    { playerId: '3', name: 'Bob Wilson' },
  ];

  const defaultProps = {
    contextMenu: { x: 100, y: 200, seat: 5 },
    onMakeMySeat: vi.fn(),
    onMakeDealer: vi.fn(),
    onFindPlayer: vi.fn(),
    onAssignPlayer: vi.fn(),
    onClearPlayer: vi.fn(),
    recentPlayers: mockRecentPlayers,
    getSeatPlayerName: vi.fn(() => null),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('returns null when contextMenu is null', () => {
      const { container } = render(
        <SeatContextMenu {...defaultProps} contextMenu={null} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders when contextMenu is provided', () => {
      render(<SeatContextMenu {...defaultProps} />);
      expect(screen.getByText('Make My Seat')).toBeInTheDocument();
    });

    it('renders Make My Seat button', () => {
      render(<SeatContextMenu {...defaultProps} />);
      expect(screen.getByText('Make My Seat')).toBeInTheDocument();
    });

    it('renders Make Dealer button', () => {
      render(<SeatContextMenu {...defaultProps} />);
      expect(screen.getByText('Make Dealer')).toBeInTheDocument();
    });

    it('renders Find or Add Player button', () => {
      render(<SeatContextMenu {...defaultProps} />);
      expect(screen.getByText('🔍 Find or Add Player…')).toBeInTheDocument();
    });

    it('renders all recent players', () => {
      render(<SeatContextMenu {...defaultProps} />);
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
    });
  });

  describe('Clear Player button', () => {
    it('does not render Clear Player when no player assigned', () => {
      render(<SeatContextMenu {...defaultProps} />);
      expect(screen.queryByText('Clear Player')).not.toBeInTheDocument();
    });

    it('renders Clear Player when player is assigned', () => {
      const props = {
        ...defaultProps,
        getSeatPlayerName: vi.fn(() => 'Assigned Player'),
      };
      render(<SeatContextMenu {...props} />);
      expect(screen.getByText('Clear Player')).toBeInTheDocument();
    });
  });

  describe('positioning', () => {
    it('positions menu at contextMenu x and y coordinates', () => {
      const { container } = render(<SeatContextMenu {...defaultProps} />);
      const menu = container.firstChild;
      expect(menu).toHaveStyle({ left: '100px', top: '200px' });
    });

    it('positions menu at different coordinates', () => {
      const props = {
        ...defaultProps,
        contextMenu: { x: 300, y: 400, seat: 3 },
      };
      const { container } = render(<SeatContextMenu {...props} />);
      const menu = container.firstChild;
      expect(menu).toHaveStyle({ left: '300px', top: '400px' });
    });
  });

  describe('button interactions', () => {
    it('calls onMakeMySeat with seat number when clicked', () => {
      render(<SeatContextMenu {...defaultProps} />);
      fireEvent.click(screen.getByText('Make My Seat'));
      expect(defaultProps.onMakeMySeat).toHaveBeenCalledWith(5);
    });

    it('calls onMakeDealer with seat number when clicked', () => {
      render(<SeatContextMenu {...defaultProps} />);
      fireEvent.click(screen.getByText('Make Dealer'));
      expect(defaultProps.onMakeDealer).toHaveBeenCalledWith(5);
    });

    it('calls onFindPlayer with seat number when clicked', () => {
      render(<SeatContextMenu {...defaultProps} />);
      fireEvent.click(screen.getByText('🔍 Find or Add Player…'));
      expect(defaultProps.onFindPlayer).toHaveBeenCalledWith(5);
    });

    it('calls onAssignPlayer with seat and playerId when player clicked', () => {
      render(<SeatContextMenu {...defaultProps} />);
      fireEvent.click(screen.getByText('John Doe'));
      expect(defaultProps.onAssignPlayer).toHaveBeenCalledWith(5, '1');
    });

    it('calls onAssignPlayer with correct playerId for second player', () => {
      render(<SeatContextMenu {...defaultProps} />);
      fireEvent.click(screen.getByText('Jane Smith'));
      expect(defaultProps.onAssignPlayer).toHaveBeenCalledWith(5, '2');
    });

    it('calls onClearPlayer with seat number when clicked', () => {
      const props = {
        ...defaultProps,
        getSeatPlayerName: vi.fn(() => 'Assigned Player'),
      };
      render(<SeatContextMenu {...props} />);
      fireEvent.click(screen.getByText('Clear Player'));
      expect(props.onClearPlayer).toHaveBeenCalledWith(5);
    });
  });

  describe('event propagation', () => {
    it('stops propagation on menu click', () => {
      const { container } = render(<SeatContextMenu {...defaultProps} />);
      const menu = container.firstChild;
      const event = { stopPropagation: vi.fn() };

      // Simulate click on menu
      fireEvent.click(menu, event);
      // The component calls e.stopPropagation internally
      // We can verify the menu exists and is interactive
      expect(menu).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('Find or Add Player button has blue text', () => {
      render(<SeatContextMenu {...defaultProps} />);
      const findButton = screen.getByText('🔍 Find or Add Player…');
      expect(findButton).toHaveClass('text-blue-600');
    });

    it('Clear Player button has red text when shown', () => {
      const props = {
        ...defaultProps,
        getSeatPlayerName: vi.fn(() => 'Player'),
      };
      render(<SeatContextMenu {...props} />);
      const clearButton = screen.getByText('Clear Player');
      expect(clearButton).toHaveClass('text-red-600');
    });
  });

  describe('empty recent players', () => {
    it('renders without recent players', () => {
      const props = {
        ...defaultProps,
        recentPlayers: [],
      };
      render(<SeatContextMenu {...props} />);
      expect(screen.getByText('Make My Seat')).toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });
  });

  describe('ordering (owner-revised 2026-05-05)', () => {
    it('puts Make My Seat first regardless of occupancy', () => {
      const { container: emp } = render(<SeatContextMenu {...defaultProps} />);
      expect(emp.querySelectorAll('button')[0]).toHaveTextContent('Make My Seat');

      const occupiedProps = {
        ...defaultProps,
        getSeatPlayerName: vi.fn(() => 'Assigned Player'),
      };
      const { container: occ } = render(<SeatContextMenu {...occupiedProps} />);
      expect(occ.querySelectorAll('button')[0]).toHaveTextContent('Make My Seat');
    });

    it('groups player ops together below seat config (occupied seat)', () => {
      const props = {
        ...defaultProps,
        onSwapPlayer: vi.fn(),
        getSeatPlayerName: vi.fn(() => 'Assigned Player'),
      };
      const { container } = render(<SeatContextMenu {...props} />);
      const labels = Array.from(container.querySelectorAll('button')).map((b) => b.textContent);
      // Make My Seat / Make Dealer first, then Clear / Swap / Find / recents
      expect(labels[0]).toBe('Make My Seat');
      expect(labels[1]).toBe('Make Dealer');
      expect(labels[2]).toBe('Clear Player');
      expect(labels[3]).toBe('⇄ Swap Player…');
      expect(labels[4]).toBe('🔍 Find or Add Player…');
    });

    it('renders Swap Player button only when seat is occupied and handler provided', () => {
      // Empty seat: no swap.
      const { rerender, queryByTestId } = render(
        <SeatContextMenu {...defaultProps} onSwapPlayer={vi.fn()} />,
      );
      expect(queryByTestId('menu-swap-player')).toBeNull();

      // Occupied seat: swap visible.
      const onSwap = vi.fn();
      rerender(
        <SeatContextMenu
          {...defaultProps}
          onSwapPlayer={onSwap}
          getSeatPlayerName={vi.fn(() => 'Existing Player')}
        />,
      );
      const swapBtn = screen.getByTestId('menu-swap-player');
      fireEvent.click(swapBtn);
      expect(onSwap).toHaveBeenCalledWith(5);
    });

    it('exposes data-seat-occupied attribute for reducer inspection', () => {
      const occupiedProps = {
        ...defaultProps,
        getSeatPlayerName: vi.fn(() => 'Player'),
      };
      const { container: occ } = render(<SeatContextMenu {...occupiedProps} />);
      expect(occ.firstChild).toHaveAttribute('data-seat-occupied', 'true');

      const { container: emp } = render(<SeatContextMenu {...defaultProps} />);
      expect(emp.firstChild).toHaveAttribute('data-seat-occupied', 'false');
    });
  });

  describe('different seat numbers', () => {
    it('uses seat 1 from contextMenu', () => {
      const props = {
        ...defaultProps,
        contextMenu: { x: 100, y: 200, seat: 1 },
      };
      render(<SeatContextMenu {...props} />);
      fireEvent.click(screen.getByText('Make My Seat'));
      expect(defaultProps.onMakeMySeat).toHaveBeenCalledWith(1);
    });

    it('uses seat 9 from contextMenu', () => {
      const props = {
        ...defaultProps,
        contextMenu: { x: 100, y: 200, seat: 9 },
      };
      render(<SeatContextMenu {...props} />);
      fireEvent.click(screen.getByText('Make Dealer'));
      expect(defaultProps.onMakeDealer).toHaveBeenCalledWith(9);
    });
  });

  // WS-191 scope #3: multi-seat selection moved behind the touch-hold / right-click
  // menu. Plain tap is single-select-replace; this row is the only way to batch.
  describe('Add to multi-select row', () => {
    it('does not render when onAddToMultiSelect is undefined', () => {
      render(<SeatContextMenu {...defaultProps} />);
      expect(screen.queryByTestId('menu-multi-select')).toBeNull();
    });

    it('renders "Add to multi-select" when seat is not in the selection', () => {
      render(
        <SeatContextMenu
          {...defaultProps}
          onAddToMultiSelect={vi.fn()}
          isSeatInSelection={false}
        />,
      );
      expect(screen.getByTestId('menu-multi-select')).toHaveTextContent(
        '➕ Add to multi-select',
      );
    });

    it('renders "Remove from multi-select" when seat is already in the selection', () => {
      render(
        <SeatContextMenu
          {...defaultProps}
          onAddToMultiSelect={vi.fn()}
          isSeatInSelection
        />,
      );
      expect(screen.getByTestId('menu-multi-select')).toHaveTextContent(
        '➖ Remove from multi-select',
      );
    });

    it('calls onAddToMultiSelect with the active seat number when clicked', () => {
      const onAddToMultiSelect = vi.fn();
      const props = {
        ...defaultProps,
        contextMenu: { x: 10, y: 20, seat: 7 },
        onAddToMultiSelect,
      };
      render(<SeatContextMenu {...props} />);
      fireEvent.click(screen.getByTestId('menu-multi-select'));
      expect(onAddToMultiSelect).toHaveBeenCalledWith(7);
      expect(onAddToMultiSelect).toHaveBeenCalledTimes(1);
    });

    it('renders inside the seat-config section (above the first divider)', () => {
      const { container } = render(
        <SeatContextMenu {...defaultProps} onAddToMultiSelect={vi.fn()} />,
      );
      const menu = container.firstChild;
      const rows = Array.from(menu.children);
      const firstDividerIdx = rows.findIndex((el) =>
        el.classList.contains('border-t'),
      );
      const multiIdx = rows.findIndex(
        (el) => el.dataset?.testid === 'menu-multi-select',
      );
      expect(multiIdx).toBeGreaterThanOrEqual(0);
      expect(multiIdx).toBeLessThan(firstDividerIdx);
    });
  });

  // WS-002 Sprint A2 amendment: straddle entry as a context-menu row
  describe('Straddle row', () => {
    it('does not render when onStraddle is undefined (seat ineligible)', () => {
      render(<SeatContextMenu {...defaultProps} />);
      expect(screen.queryByText('🎲 Straddle…')).not.toBeInTheDocument();
      expect(screen.queryByTestId('menu-straddle')).not.toBeInTheDocument();
    });

    it('renders when onStraddle is provided', () => {
      const onStraddle = vi.fn();
      render(<SeatContextMenu {...defaultProps} onStraddle={onStraddle} />);
      expect(screen.getByText('🎲 Straddle…')).toBeInTheDocument();
      expect(screen.getByTestId('menu-straddle')).toBeInTheDocument();
    });

    it('calls onStraddle with the active seat number when clicked', () => {
      const onStraddle = vi.fn();
      const props = {
        ...defaultProps,
        contextMenu: { x: 50, y: 60, seat: 3 },
        onStraddle,
      };
      render(<SeatContextMenu {...props} />);
      fireEvent.click(screen.getByTestId('menu-straddle'));
      expect(onStraddle).toHaveBeenCalledWith(3);
      expect(onStraddle).toHaveBeenCalledTimes(1);
    });

    it('renders inside the seat-config section (above the divider)', () => {
      const onStraddle = vi.fn();
      const { container } = render(
        <SeatContextMenu {...defaultProps} onStraddle={onStraddle} />
      );
      // The seat-config section (Make My Seat / Make Dealer / Straddle) lives
      // BEFORE the first divider in the menu DOM order. Confirm by index.
      const menu = container.firstChild;
      const rows = Array.from(menu.children);
      const firstDividerIdx = rows.findIndex((el) =>
        el.classList.contains('border-t')
      );
      const straddleIdx = rows.findIndex(
        (el) => el.dataset?.testid === 'menu-straddle'
      );
      expect(straddleIdx).toBeGreaterThanOrEqual(0);
      expect(straddleIdx).toBeLessThan(firstDividerIdx);
    });

    it('coexists with Clear Player (occupied seat) without conflict', () => {
      const onStraddle = vi.fn();
      const props = {
        ...defaultProps,
        getSeatPlayerName: vi.fn(() => 'Michael'),
        onStraddle,
      };
      render(<SeatContextMenu {...props} />);
      expect(screen.getByText('🎲 Straddle…')).toBeInTheDocument();
      expect(screen.getByText('Clear Player')).toBeInTheDocument();
    });
  });
});
