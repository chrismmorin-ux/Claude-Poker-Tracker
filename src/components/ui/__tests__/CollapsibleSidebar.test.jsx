/**
 * CollapsibleSidebar.test.jsx - Tests for CollapsibleSidebar component
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsibleSidebar } from '../CollapsibleSidebar';

const MOCK_SCREEN = {
  TABLE: 'table',
  STATS: 'stats',
  HISTORY: 'history',
  SESSIONS: 'sessions',
  PLAYERS: 'players',
};

describe('CollapsibleSidebar', () => {
  const defaultProps = {
    isCollapsed: false,
    onToggle: vi.fn(),
    onNavigate: vi.fn(),
    onSeatChange: vi.fn(),
    SCREEN: MOCK_SCREEN,
    selectedPlayers: [],
    dealerButtonSeat: 1,
    absentSeats: new Set(),
    numSeats: 9,
    hasActiveSession: false,
    currentSessionVenue: '',
    currentSessionGameType: '',
    updateSessionField: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders toggle button', () => {
      render(<CollapsibleSidebar {...defaultProps} />);
      expect(screen.getByText('◀')).toBeInTheDocument();
    });

    it('renders navigation buttons', () => {
      render(<CollapsibleSidebar {...defaultProps} />);
      expect(screen.getByText('Stats')).toBeInTheDocument();
      expect(screen.getByText('Hand History')).toBeInTheDocument();
      expect(screen.getByText('Sessions')).toBeInTheDocument();
      expect(screen.getByText('Players')).toBeInTheDocument();
    });

    it('shows "No seat selected" when no seat is selected', () => {
      render(<CollapsibleSidebar {...defaultProps} />);
      expect(screen.getByText('No seat selected')).toBeInTheDocument();
    });
  });

  describe('collapsed state', () => {
    it('shows expand icon when collapsed', () => {
      render(<CollapsibleSidebar {...defaultProps} isCollapsed={true} />);
      expect(screen.getByText('▶')).toBeInTheDocument();
    });

    it('shows collapse icon when expanded', () => {
      render(<CollapsibleSidebar {...defaultProps} isCollapsed={false} />);
      expect(screen.getByText('◀')).toBeInTheDocument();
    });

    it('hides nav labels when collapsed', () => {
      render(<CollapsibleSidebar {...defaultProps} isCollapsed={true} />);
      expect(screen.queryByText('Stats')).not.toBeInTheDocument();
      expect(screen.queryByText('Hand History')).not.toBeInTheDocument();
    });

    it('has narrower width when collapsed', () => {
      const { container } = render(<CollapsibleSidebar {...defaultProps} isCollapsed={true} />);
      expect(container.firstChild.className).toContain('w-14');
    });

    it('has wider width when expanded', () => {
      const { container } = render(<CollapsibleSidebar {...defaultProps} isCollapsed={false} />);
      expect(container.firstChild.className).toContain('w-36');
    });

    it('shows abbreviated position when collapsed', () => {
      render(
        <CollapsibleSidebar
          {...defaultProps}
          isCollapsed={true}
          selectedPlayers={[1]}
          dealerButtonSeat={1}
        />
      );
      expect(screen.getByText('BTN')).toBeInTheDocument();
    });
  });

  describe('toggle functionality', () => {
    it('calls onToggle when toggle button clicked', () => {
      render(<CollapsibleSidebar {...defaultProps} />);

      fireEvent.click(screen.getByText('◀'));

      expect(defaultProps.onToggle).toHaveBeenCalled();
    });

    it('has correct title for toggle button when expanded', () => {
      render(<CollapsibleSidebar {...defaultProps} isCollapsed={false} />);
      expect(screen.getByTitle('Collapse sidebar')).toBeInTheDocument();
    });

    it('has correct title for toggle button when collapsed', () => {
      render(<CollapsibleSidebar {...defaultProps} isCollapsed={true} />);
      expect(screen.getByTitle('Expand sidebar')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('calls onNavigate with STATS when Stats clicked', () => {
      render(<CollapsibleSidebar {...defaultProps} />);

      fireEvent.click(screen.getByText('Stats'));

      expect(defaultProps.onNavigate).toHaveBeenCalledWith(MOCK_SCREEN.STATS);
    });

    it('calls onNavigate with HISTORY when Hand History clicked', () => {
      render(<CollapsibleSidebar {...defaultProps} />);

      fireEvent.click(screen.getByText('Hand History'));

      expect(defaultProps.onNavigate).toHaveBeenCalledWith(MOCK_SCREEN.HISTORY);
    });

    it('calls onNavigate with SESSIONS when Sessions clicked', () => {
      render(<CollapsibleSidebar {...defaultProps} />);

      fireEvent.click(screen.getByText('Sessions'));

      expect(defaultProps.onNavigate).toHaveBeenCalledWith(MOCK_SCREEN.SESSIONS);
    });

    it('calls onNavigate with PLAYERS when Players clicked', () => {
      render(<CollapsibleSidebar {...defaultProps} />);

      fireEvent.click(screen.getByText('Players'));

      expect(defaultProps.onNavigate).toHaveBeenCalledWith(MOCK_SCREEN.PLAYERS);
    });
  });

  describe('seat display', () => {
    it('shows seat number when seat is selected', () => {
      render(<CollapsibleSidebar {...defaultProps} selectedPlayers={[5]} />);
      expect(screen.getByText('Seat 5')).toBeInTheDocument();
    });

    it('shows position name for selected seat', () => {
      render(
        <CollapsibleSidebar
          {...defaultProps}
          selectedPlayers={[1]}
          dealerButtonSeat={1}
        />
      );
      expect(screen.getByText('Button')).toBeInTheDocument();
    });

    it('shows Small Blind position correctly', () => {
      render(
        <CollapsibleSidebar
          {...defaultProps}
          selectedPlayers={[2]}
          dealerButtonSeat={1}
        />
      );
      expect(screen.getByText('Small Blind')).toBeInTheDocument();
    });

    it('shows Big Blind position correctly', () => {
      render(
        <CollapsibleSidebar
          {...defaultProps}
          selectedPlayers={[3]}
          dealerButtonSeat={1}
        />
      );
      expect(screen.getByText('Big Blind')).toBeInTheDocument();
    });

    it('shows Absent for absent seats', () => {
      render(
        <CollapsibleSidebar
          {...defaultProps}
          selectedPlayers={[5]}
          absentSeats={new Set([5])}
        />
      );
      expect(screen.getByText('Absent')).toBeInTheDocument();
    });
  });

  describe('seat navigation buttons', () => {
    it('shows prev/next buttons when seat is selected and expanded', () => {
      render(
        <CollapsibleSidebar
          {...defaultProps}
          isCollapsed={false}
          selectedPlayers={[5]}
        />
      );
      // Previous and next seat buttons
      const prevButton = screen.getAllByText('◀')[0];
      const nextButton = screen.getByText('▶');
      expect(prevButton).toBeInTheDocument();
      expect(nextButton).toBeInTheDocument();
    });

    it('calls onSeatChange with previous seat', () => {
      render(
        <CollapsibleSidebar
          {...defaultProps}
          isCollapsed={false}
          selectedPlayers={[5]}
        />
      );

      // The first ◀ in the seat nav area (not the collapse button)
      const buttons = screen.getAllByTitle('Previous seat');
      fireEvent.click(buttons[0]);

      expect(defaultProps.onSeatChange).toHaveBeenCalledWith(4);
    });

    it('calls onSeatChange with next seat', () => {
      render(
        <CollapsibleSidebar
          {...defaultProps}
          isCollapsed={false}
          selectedPlayers={[5]}
        />
      );

      fireEvent.click(screen.getByTitle('Next seat'));

      expect(defaultProps.onSeatChange).toHaveBeenCalledWith(6);
    });

    it('wraps to seat 9 when going previous from seat 1', () => {
      render(
        <CollapsibleSidebar
          {...defaultProps}
          isCollapsed={false}
          selectedPlayers={[1]}
        />
      );

      fireEvent.click(screen.getByTitle('Previous seat'));

      expect(defaultProps.onSeatChange).toHaveBeenCalledWith(9);
    });

    it('wraps to seat 1 when going next from seat 9', () => {
      render(
        <CollapsibleSidebar
          {...defaultProps}
          isCollapsed={false}
          selectedPlayers={[9]}
        />
      );

      fireEvent.click(screen.getByTitle('Next seat'));

      expect(defaultProps.onSeatChange).toHaveBeenCalledWith(1);
    });

    it('hides seat nav buttons when collapsed', () => {
      render(
        <CollapsibleSidebar
          {...defaultProps}
          isCollapsed={true}
          selectedPlayers={[5]}
        />
      );

      expect(screen.queryByTitle('Previous seat')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Next seat')).not.toBeInTheDocument();
    });
  });

  describe('session info display', () => {
    it('shows session info when active session exists', () => {
      render(
        <CollapsibleSidebar
          {...defaultProps}
          hasActiveSession={true}
          currentSessionVenue="Horseshoe Casino"
          currentSessionGameType="1/2"
        />
      );
      expect(screen.getByText('Venue')).toBeInTheDocument();
      expect(screen.getByText('Game')).toBeInTheDocument();
    });

    it('does not show session info when no active session', () => {
      render(<CollapsibleSidebar {...defaultProps} hasActiveSession={false} />);
      expect(screen.queryByText('Venue')).not.toBeInTheDocument();
      expect(screen.queryByText('Game')).not.toBeInTheDocument();
    });

    it('shows venue value', () => {
      render(
        <CollapsibleSidebar
          {...defaultProps}
          hasActiveSession={true}
          currentSessionVenue="Horseshoe Casino"
        />
      );
      expect(screen.getByText('Horseshoe Casino')).toBeInTheDocument();
    });

    it('shows game type value', () => {
      render(
        <CollapsibleSidebar
          {...defaultProps}
          hasActiveSession={true}
          currentSessionGameType="1/2"
        />
      );
      expect(screen.getByText('1/2')).toBeInTheDocument();
    });

    it('shows icons when collapsed and session active', () => {
      render(
        <CollapsibleSidebar
          {...defaultProps}
          isCollapsed={true}
          hasActiveSession={true}
          currentSessionVenue="Horseshoe Casino"
          currentSessionGameType="1/2"
        />
      );
      expect(screen.getByText('📍')).toBeInTheDocument();
      expect(screen.getByText('🎰')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('has absolute positioning', () => {
      const { container } = render(<CollapsibleSidebar {...defaultProps} />);
      expect(container.firstChild.className).toContain('absolute');
      expect(container.firstChild.className).toContain('left-0');
      expect(container.firstChild.className).toContain('top-0');
    });

    it('has full height', () => {
      const { container } = render(<CollapsibleSidebar {...defaultProps} />);
      expect(container.firstChild.className).toContain('h-full');
    });

    it('has semi-transparent background', () => {
      const { container } = render(<CollapsibleSidebar {...defaultProps} />);
      expect(container.firstChild.className).toContain('bg-black');
      expect(container.firstChild.className).toContain('bg-opacity-60');
    });

    it('has z-40 for proper stacking', () => {
      const { container } = render(<CollapsibleSidebar {...defaultProps} />);
      expect(container.firstChild.className).toContain('z-40');
    });

    it('has transition for smooth animation', () => {
      const { container } = render(<CollapsibleSidebar {...defaultProps} />);
      expect(container.firstChild.className).toContain('transition-all');
    });
  });

  describe('position calculation', () => {
    it('handles absent seats in position calculation', () => {
      render(
        <CollapsibleSidebar
          {...defaultProps}
          selectedPlayers={[3]}
          dealerButtonSeat={1}
          absentSeats={new Set([2])} // SB is absent
        />
      );
      // With seat 2 absent, seat 3 becomes SB
      expect(screen.getByText('Small Blind')).toBeInTheDocument();
    });

    it('shows Cutoff position', () => {
      render(
        <CollapsibleSidebar
          {...defaultProps}
          selectedPlayers={[9]}
          dealerButtonSeat={1}
        />
      );
      expect(screen.getByText('Cutoff')).toBeInTheDocument();
    });
  });
});
