/**
 * PlayerRow.test.jsx - Tests for PlayerRow component
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerRow } from '../PlayerRow';
import { createMockPlayer } from '../../../test/utils';

describe('PlayerRow', () => {
  const mockPlayer = createMockPlayer({
    playerId: 1,
    name: 'John Doe',
    nickname: 'JD',
    ethnicity: 'Caucasian',
    gender: 'Male',
    build: 'Average',
    facialHair: 'Clean-shaven',
    hat: true,
    sunglasses: false,
    styleTags: ['Tight', 'Aggressive'],
    handCount: 42,
    lastSeenAt: Date.now() - 3600000, // 1 hour ago
  });

  const defaultProps = {
    player: mockPlayer,
    assignedSeat: null,
    isSelecting: false,
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    onClick: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders player name', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('renders player nickname in quotes', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      expect(screen.getByText('"JD"')).toBeInTheDocument();
    });

    it('renders player description summary', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      // Should show ethnicity, gender, build, hat
      expect(screen.getByText(/Caucasian/)).toBeInTheDocument();
    });

    it('renders hand count', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('renders relative time for last seen', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      expect(screen.getByText('1 hour ago')).toBeInTheDocument();
    });

    it('renders style tags', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      expect(screen.getByText('Tight')).toBeInTheDocument();
      expect(screen.getByText('Aggressive')).toBeInTheDocument();
    });
  });

  describe('avatar display', () => {
    it('shows avatar image when player has avatar', () => {
      const playerWithAvatar = createMockPlayer({
        ...mockPlayer,
        avatar: 'data:image/png;base64,abc123',
      });

      render(
        <table><tbody>
          <PlayerRow {...defaultProps} player={playerWithAvatar} />
        </tbody></table>
      );

      const img = screen.getByAltText('John Doe');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'data:image/png;base64,abc123');
    });

    it('shows initial letter when no avatar', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      expect(screen.getByText('J')).toBeInTheDocument();
    });
  });

  describe('seat assignment', () => {
    it('shows seat number badge when assigned', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} assignedSeat={5} />
        </tbody></table>
      );
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('does not show seat badge when not assigned', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} assignedSeat={null} />
        </tbody></table>
      );
      // Should only show the initial letter J, not a number
      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });

    it('applies blue background when assigned', () => {
      const { container } = render(
        <table><tbody>
          <PlayerRow {...defaultProps} assignedSeat={5} />
        </tbody></table>
      );
      const row = container.querySelector('tr');
      expect(row.className).toContain('bg-blue-50');
    });
  });

  describe('selection state', () => {
    it('applies cursor-pointer when selecting', () => {
      const { container } = render(
        <table><tbody>
          <PlayerRow {...defaultProps} isSelecting={true} />
        </tbody></table>
      );
      const row = container.querySelector('tr');
      expect(row.className).toContain('cursor-pointer');
    });

    it('does not apply cursor-pointer when not selecting', () => {
      const { container } = render(
        <table><tbody>
          <PlayerRow {...defaultProps} isSelecting={false} />
        </tbody></table>
      );
      const row = container.querySelector('tr');
      expect(row.className).not.toContain('cursor-pointer');
    });
  });

  describe('drag functionality', () => {
    it('row is draggable', () => {
      const { container } = render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      const row = container.querySelector('tr');
      expect(row).toHaveAttribute('draggable', 'true');
    });

    it('calls onDragStart when drag starts', () => {
      const { container } = render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      const row = container.querySelector('tr');

      fireEvent.dragStart(row);

      expect(defaultProps.onDragStart).toHaveBeenCalled();
    });

    it('calls onDragEnd when drag ends', () => {
      const { container } = render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      const row = container.querySelector('tr');

      fireEvent.dragEnd(row);

      expect(defaultProps.onDragEnd).toHaveBeenCalled();
    });
  });

  describe('click handling', () => {
    it('calls onClick when row is clicked', () => {
      const { container } = render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      const row = container.querySelector('tr');

      fireEvent.click(row);

      expect(defaultProps.onClick).toHaveBeenCalled();
    });
  });

  describe('action buttons', () => {
    it('renders Edit button', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('renders Delete button', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('calls onEdit when Edit button clicked', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );

      fireEvent.click(screen.getByText('Edit'));

      expect(defaultProps.onEdit).toHaveBeenCalled();
    });

    it('calls onDelete when Delete button clicked', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );

      fireEvent.click(screen.getByText('Delete'));

      expect(defaultProps.onDelete).toHaveBeenCalled();
    });

    it('stops propagation when Edit is clicked', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );

      fireEvent.click(screen.getByText('Edit'));

      // onClick should not be called
      expect(defaultProps.onClick).not.toHaveBeenCalled();
    });

    it('stops propagation when Delete is clicked', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );

      fireEvent.click(screen.getByText('Delete'));

      // onClick should not be called
      expect(defaultProps.onClick).not.toHaveBeenCalled();
    });
  });

  describe('description summary', () => {
    it('shows "No description" when player has no attributes', () => {
      const emptyPlayer = createMockPlayer({
        name: 'Empty',
        ethnicity: '',
        gender: '',
        build: '',
        facialHair: '',
        hat: false,
        sunglasses: false,
      });

      render(
        <table><tbody>
          <PlayerRow {...defaultProps} player={emptyPlayer} />
        </tbody></table>
      );
      expect(screen.getByText('No description')).toBeInTheDocument();
    });

    it('includes Hat in description when hat is true', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      expect(screen.getByText(/Hat/)).toBeInTheDocument();
    });

    it('includes Sunglasses when sunglasses is true', () => {
      const playerWithSunglasses = createMockPlayer({
        ...mockPlayer,
        sunglasses: true,
      });

      render(
        <table><tbody>
          <PlayerRow {...defaultProps} player={playerWithSunglasses} />
        </tbody></table>
      );
      expect(screen.getByText(/Sunglasses/)).toBeInTheDocument();
    });

    it('excludes Clean-shaven from description', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      expect(screen.queryByText(/Clean-shaven/)).not.toBeInTheDocument();
    });
  });

  describe('style tags overflow', () => {
    it('shows +N indicator when more than 2 tags', () => {
      const playerManyTags = createMockPlayer({
        ...mockPlayer,
        styleTags: ['Tight', 'Aggressive', 'Bluffer', 'Station'],
      });

      render(
        <table><tbody>
          <PlayerRow {...defaultProps} player={playerManyTags} />
        </tbody></table>
      );
      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('shows dash when no style tags', () => {
      const playerNoTags = createMockPlayer({
        ...mockPlayer,
        styleTags: [],
      });

      render(
        <table><tbody>
          <PlayerRow {...defaultProps} player={playerNoTags} />
        </tbody></table>
      );
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('relative time formatting', () => {
    it('shows "Just now" for very recent', () => {
      const recentPlayer = createMockPlayer({
        ...mockPlayer,
        lastSeenAt: Date.now() - 30000, // 30 seconds ago
      });

      render(
        <table><tbody>
          <PlayerRow {...defaultProps} player={recentPlayer} />
        </tbody></table>
      );
      expect(screen.getByText('Just now')).toBeInTheDocument();
    });

    it('shows minutes ago', () => {
      const minutesAgo = createMockPlayer({
        ...mockPlayer,
        lastSeenAt: Date.now() - 300000, // 5 minutes ago
      });

      render(
        <table><tbody>
          <PlayerRow {...defaultProps} player={minutesAgo} />
        </tbody></table>
      );
      expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
    });

    it('shows hours ago', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      expect(screen.getByText('1 hour ago')).toBeInTheDocument();
    });

    it('shows days ago', () => {
      const daysAgo = createMockPlayer({
        ...mockPlayer,
        lastSeenAt: Date.now() - 86400000 * 3, // 3 days ago
      });

      render(
        <table><tbody>
          <PlayerRow {...defaultProps} player={daysAgo} />
        </tbody></table>
      );
      expect(screen.getByText('3 days ago')).toBeInTheDocument();
    });

    it('shows date for older than a week', () => {
      const oldPlayer = createMockPlayer({
        ...mockPlayer,
        lastSeenAt: Date.now() - 86400000 * 10, // 10 days ago
      });

      render(
        <table><tbody>
          <PlayerRow {...defaultProps} player={oldPlayer} />
        </tbody></table>
      );
      // Should show a date format
      expect(screen.queryByText(/ago/)).not.toBeInTheDocument();
    });

    it('shows "Never" when no lastSeenAt', () => {
      const neverSeen = createMockPlayer({
        ...mockPlayer,
        lastSeenAt: null,
      });

      render(
        <table><tbody>
          <PlayerRow {...defaultProps} player={neverSeen} />
        </tbody></table>
      );
      expect(screen.getByText('Never')).toBeInTheDocument();
    });
  });
});
