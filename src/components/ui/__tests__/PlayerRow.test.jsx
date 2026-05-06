// @vitest-environment jsdom
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
      // Phase 2: IdentityAvatar also includes a <title> with the player name
      // for accessibility, so getByText would match multiple elements. Match
      // the visible name via the .font-semibold container instead.
      const nameEls = screen.getAllByText('John Doe');
      const visibleName = nameEls.find((el) => el.classList.contains('font-semibold'));
      expect(visibleName).toBeTruthy();
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
      // Phase C: legacy 'Caucasian' migrates to ethnicityTags=['caucasian']
      // and renders as 'White' via the friendly label map.
      expect(screen.getByText(/White/)).toBeInTheDocument();
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

  describe('avatar display (Phase 2 — IdentityAvatar)', () => {
    it('renders IdentityAvatar SVG for any player record', () => {
      const { container } = render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      // IdentityAvatar always renders an SVG with role=img and an aria-label
      // derived from player.name. Replaces the prior monogram letter and
      // legacy avatar <img>.
      const svg = container.querySelector('svg[role="img"]');
      expect(svg).not.toBeNull();
      expect(svg.getAttribute('aria-label')).toBe('John Doe');
    });

    it('IdentityAvatar reflects identification fields (silhouette layer present)', () => {
      const playerMale = createMockPlayer({
        ...mockPlayer,
        sex: 'male',
        build: 'muscular',
        ethnicityTags: ['caucasian'],
      });
      const { container } = render(
        <table><tbody>
          <PlayerRow {...defaultProps} player={playerMale} />
        </tbody></table>
      );
      const skinLayer = container.querySelector('g[data-layer="skin"]');
      expect(skinLayer.getAttribute('data-feature-id')).toBe('silhouette.male-muscular');
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
      expect(row.className).toContain('bg-blue-900/20');
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

    it('applies cursor-pointer always (row tap routes to Profile per WS-163)', () => {
      // Per WS-163 / SPR-035: row tap always navigates (to Profile when not
      // selecting a seat; to seat-assignment when selecting). cursor-pointer
      // is now unconditional.
      const { container } = render(
        <table><tbody>
          <PlayerRow {...defaultProps} isSelecting={false} />
        </tbody></table>
      );
      const row = container.querySelector('tr');
      expect(row.className).toContain('cursor-pointer');
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
    // W4-A1-F5: action buttons are icon-only with aria-label for accessibility;
    // selectors use getByRole + name (aria-label) instead of getByText.
    it('renders Edit button', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });

    it('renders Delete button', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('calls onEdit when Edit button clicked', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

      expect(defaultProps.onEdit).toHaveBeenCalled();
    });

    it('calls onDelete when Delete button clicked', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(defaultProps.onDelete).toHaveBeenCalled();
    });

    it('stops propagation when Edit is clicked', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

      // onClick should not be called
      expect(defaultProps.onClick).not.toHaveBeenCalled();
    });

    it('stops propagation when Delete is clicked', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      // onClick should not be called
      expect(defaultProps.onClick).not.toHaveBeenCalled();
    });

    // W4-A1-F5: hit-target + tooltip + badge persistence
    it('Edit/Delete buttons meet ≥44×44 hit-target minimum', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      const editBtn = screen.getByRole('button', { name: 'Edit' });
      const deleteBtn = screen.getByRole('button', { name: 'Delete' });
      // Tailwind classes assert sizing — DOM doesn't compute layout in jsdom
      expect(editBtn.className).toMatch(/min-h-\[44px\]/);
      expect(editBtn.className).toMatch(/min-w-\[44px\]/);
      expect(deleteBtn.className).toMatch(/min-h-\[44px\]/);
      expect(deleteBtn.className).toMatch(/min-w-\[44px\]/);
    });

    it('action buttons carry tooltips via title attribute', () => {
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      expect(screen.getByRole('button', { name: 'Edit' })).toHaveAttribute('title', 'Edit');
      expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('title', 'Delete');
    });

    it('Range button renders only when onOpenRangeDetail is provided', () => {
      const { rerender } = render(
        <table><tbody>
          <PlayerRow {...defaultProps} onOpenRangeDetail={undefined} />
        </tbody></table>
      );
      expect(screen.queryByRole('button', { name: 'Range' })).not.toBeInTheDocument();

      rerender(
        <table><tbody>
          <PlayerRow {...defaultProps} onOpenRangeDetail={vi.fn()} />
        </tbody></table>
      );
      expect(screen.getByRole('button', { name: 'Range' })).toBeInTheDocument();
    });

    it('Exploits toggle preserves the pendingBriefingCount badge', () => {
      // pendingBriefingCount is derived internally from briefings; the badge
      // renders count from briefings filtered to reviewStatus pending|stale.
      const player = createMockPlayer({
        exploitBriefings: [
          { reviewStatus: 'pending' },
          { reviewStatus: 'pending' },
          { reviewStatus: 'stale' },
          { reviewStatus: 'reviewed' }, // not counted
        ],
      });
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} player={player} />
        </tbody></table>
      );
      expect(screen.getByText('3')).toBeInTheDocument();
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

    it('includes the migrated headwear value when legacy hat is true', () => {
      // Phase C: legacy hat=true migrates to headwear='cap' (generic-cap fallback).
      // The description renders the actual headwear value rather than the generic
      // word "Hat" — owner sees more specific info.
      render(
        <table><tbody>
          <PlayerRow {...defaultProps} />
        </tbody></table>
      );
      expect(screen.getByText(/Cap/)).toBeInTheDocument();
    });

    it('includes Sunglasses when legacy sunglasses flag is true', () => {
      const playerWithSunglasses = createMockPlayer({
        ...mockPlayer,
        sunglasses: true,
      });

      render(
        <table><tbody>
          <PlayerRow {...defaultProps} player={playerWithSunglasses} />
        </tbody></table>
      );
      // Phase C: legacy sunglasses=true migrates to eyewear='sunglasses' which
      // renders as title-cased 'Sunglasses'.
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
