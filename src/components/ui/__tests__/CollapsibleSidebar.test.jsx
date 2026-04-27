// @vitest-environment jsdom
import React from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollapsibleSidebar } from '../CollapsibleSidebar';
import { NAV_COLORS } from '../../../constants/designTokens';

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
    it('renders toggle button and nav buttons', () => {
      render(<CollapsibleSidebar {...defaultProps} />);
      expect(screen.getByText('◀')).toBeInTheDocument();
      expect(screen.getByText('Stats')).toBeInTheDocument();
      expect(screen.getByText('Hand Review')).toBeInTheDocument();
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

    it('hides nav labels when collapsed', () => {
      render(<CollapsibleSidebar {...defaultProps} isCollapsed={true} />);
      expect(screen.queryByText('Stats')).not.toBeInTheDocument();
      expect(screen.queryByText('Hand Review')).not.toBeInTheDocument();
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
  });

  describe('navigation', () => {
    it.each([
      ['Stats', 'stats'],
      ['Hand Review', 'history'],
      ['Sessions', 'sessions'],
      ['Players', 'players'],
    ])('calls onNavigate with %s screen', (label, screen_key) => {
      render(<CollapsibleSidebar {...defaultProps} />);
      fireEvent.click(screen.getByText(label));
      expect(defaultProps.onNavigate).toHaveBeenCalledWith(screen_key);
    });
  });

  describe('seat display', () => {
    it('shows seat number when seat is selected', () => {
      render(<CollapsibleSidebar {...defaultProps} selectedPlayers={[5]} />);
      expect(screen.getByText('Seat 5')).toBeInTheDocument();
    });

    it('shows position name for selected seat', () => {
      render(
        <CollapsibleSidebar {...defaultProps} selectedPlayers={[1]} dealerButtonSeat={1} />
      );
      expect(screen.getByText('Button')).toBeInTheDocument();
    });

    it('shows Absent for absent seats', () => {
      render(
        <CollapsibleSidebar {...defaultProps} selectedPlayers={[5]} absentSeats={new Set([5])} />
      );
      expect(screen.getByText('Absent')).toBeInTheDocument();
    });
  });

  describe('seat navigation buttons', () => {
    it('calls onSeatChange with previous seat', () => {
      render(
        <CollapsibleSidebar {...defaultProps} isCollapsed={false} selectedPlayers={[5]} />
      );
      fireEvent.click(screen.getByTitle('Previous seat'));
      expect(defaultProps.onSeatChange).toHaveBeenCalledWith(4);
    });

    it('calls onSeatChange with next seat', () => {
      render(
        <CollapsibleSidebar {...defaultProps} isCollapsed={false} selectedPlayers={[5]} />
      );
      fireEvent.click(screen.getByTitle('Next seat'));
      expect(defaultProps.onSeatChange).toHaveBeenCalledWith(6);
    });

    it('wraps to seat 9 when going previous from seat 1', () => {
      render(
        <CollapsibleSidebar {...defaultProps} isCollapsed={false} selectedPlayers={[1]} />
      );
      fireEvent.click(screen.getByTitle('Previous seat'));
      expect(defaultProps.onSeatChange).toHaveBeenCalledWith(9);
    });

    it('wraps to seat 1 when going next from seat 9', () => {
      render(
        <CollapsibleSidebar {...defaultProps} isCollapsed={false} selectedPlayers={[9]} />
      );
      fireEvent.click(screen.getByTitle('Next seat'));
      expect(defaultProps.onSeatChange).toHaveBeenCalledWith(1);
    });

    it('hides seat nav buttons when collapsed', () => {
      render(
        <CollapsibleSidebar {...defaultProps} isCollapsed={true} selectedPlayers={[5]} />
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
      expect(screen.getByText('Horseshoe Casino')).toBeInTheDocument();
      expect(screen.getByText('1/2')).toBeInTheDocument();
    });

    it('does not show session info when no active session', () => {
      render(<CollapsibleSidebar {...defaultProps} hasActiveSession={false} />);
      expect(screen.queryByText('Venue')).not.toBeInTheDocument();
    });
  });

  describe('position calculation', () => {
    it('handles absent seats in position calculation', () => {
      render(
        <CollapsibleSidebar
          {...defaultProps}
          selectedPlayers={[3]}
          dealerButtonSeat={1}
          absentSeats={new Set([2])}
        />
      );
      expect(screen.getByText('Small Blind')).toBeInTheDocument();
    });

    it('shows Cutoff position', () => {
      render(
        <CollapsibleSidebar {...defaultProps} selectedPlayers={[9]} dealerButtonSeat={1} />
      );
      expect(screen.getByText('Cutoff')).toBeInTheDocument();
    });
  });

  // Static source-scan guard: every navItem's `navKey` must exist in NAV_COLORS.
  // A missing key throws at render time when the sidebar maps over navItems and
  // accesses `colors.base` on undefined. The render-time tests above mock
  // useUI / SCREEN and don't always exercise every nav entry, so a textual
  // check on the source is the cheapest catch-all.
  describe('NAV_COLORS coverage', () => {
    const sidebarSource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'CollapsibleSidebar.jsx'),
      'utf8'
    );

    const navKeys = Array.from(sidebarSource.matchAll(/navKey:\s*['"]([^'"]+)['"]/g)).map(
      (m) => m[1]
    );

    it('extracts at least one navKey from CollapsibleSidebar source', () => {
      expect(navKeys.length).toBeGreaterThan(0);
    });

    it.each(navKeys)('NAV_COLORS has an entry for navKey %s', (navKey) => {
      expect(NAV_COLORS[navKey]).toBeDefined();
      expect(NAV_COLORS[navKey].base).toMatch(/^#[0-9a-f]{6}$/i);
      expect(NAV_COLORS[navKey].hover).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});
