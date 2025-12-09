/**
 * ActionSequence.test.jsx - Tests for ActionSequence component
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionSequence } from '../ActionSequence';
import { ACTIONS, ACTION_ABBREV } from '../../../test/utils';

// Mock ActionBadge to simplify testing
vi.mock('../ActionBadge', () => ({
  ActionBadge: ({ action, ACTION_ABBREV }) => (
    <div data-testid="action-badge">{ACTION_ABBREV?.[action] || action}</div>
  ),
}));

describe('ActionSequence', () => {
  const defaultProps = {
    actions: [ACTIONS.OPEN, ACTIONS.CALL],
    ACTIONS,
    ACTION_ABBREV,
  };

  describe('rendering', () => {
    it('returns null when actions is empty array', () => {
      const { container } = render(<ActionSequence {...defaultProps} actions={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null when actions is null', () => {
      const { container } = render(<ActionSequence {...defaultProps} actions={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null when actions is undefined', () => {
      const { container } = render(<ActionSequence {...defaultProps} actions={undefined} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders single action', () => {
      render(<ActionSequence {...defaultProps} actions={[ACTIONS.OPEN]} />);
      expect(screen.getAllByTestId('action-badge')).toHaveLength(1);
    });

    it('renders multiple actions', () => {
      render(<ActionSequence {...defaultProps} actions={[ACTIONS.OPEN, ACTIONS.CALL, ACTIONS.FOLD]} />);
      expect(screen.getAllByTestId('action-badge')).toHaveLength(3);
    });
  });

  describe('overflow handling', () => {
    it('shows all actions when under maxVisible limit', () => {
      render(<ActionSequence {...defaultProps} actions={[ACTIONS.OPEN, ACTIONS.CALL]} maxVisible={3} />);
      expect(screen.getAllByTestId('action-badge')).toHaveLength(2);
      expect(screen.queryByText(/\+\d/)).not.toBeInTheDocument();
    });

    it('shows overflow indicator when actions exceed maxVisible', () => {
      render(
        <ActionSequence
          {...defaultProps}
          actions={[ACTIONS.OPEN, ACTIONS.CALL, ACTIONS.THREE_BET, ACTIONS.FOLD]}
          maxVisible={3}
        />
      );
      // With 4 actions and maxVisible=3, should show 2 badges + "+2"
      expect(screen.getAllByTestId('action-badge')).toHaveLength(2);
      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('shows correct overflow count', () => {
      render(
        <ActionSequence
          {...defaultProps}
          actions={[ACTIONS.OPEN, ACTIONS.CALL, ACTIONS.THREE_BET, ACTIONS.FOLD, ACTIONS.CHECK]}
          maxVisible={3}
        />
      );
      // 5 actions, maxVisible=3 -> show 2 badges + "+3"
      expect(screen.getByText('+3')).toBeInTheDocument();
    });

    it('uses default maxVisible of 3', () => {
      render(
        <ActionSequence
          {...defaultProps}
          actions={[ACTIONS.OPEN, ACTIONS.CALL, ACTIONS.THREE_BET, ACTIONS.FOLD]}
        />
      );
      expect(screen.getAllByTestId('action-badge')).toHaveLength(2);
      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('handles custom maxVisible value', () => {
      render(
        <ActionSequence
          {...defaultProps}
          actions={[ACTIONS.OPEN, ACTIONS.CALL, ACTIONS.THREE_BET]}
          maxVisible={2}
        />
      );
      // 3 actions, maxVisible=2 -> show 1 badge + "+2"
      expect(screen.getAllByTestId('action-badge')).toHaveLength(1);
      expect(screen.getByText('+2')).toBeInTheDocument();
    });
  });

  describe('arrow separators', () => {
    it('renders arrow between actions', () => {
      render(<ActionSequence {...defaultProps} actions={[ACTIONS.OPEN, ACTIONS.CALL]} />);
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('renders arrow before overflow indicator', () => {
      render(
        <ActionSequence
          {...defaultProps}
          actions={[ACTIONS.OPEN, ACTIONS.CALL, ACTIONS.THREE_BET, ACTIONS.FOLD]}
          maxVisible={3}
        />
      );
      // Should have arrow after each visible badge (before overflow)
      const arrows = screen.getAllByText('→');
      expect(arrows.length).toBeGreaterThanOrEqual(2);
    });

    it('does not render arrow for single action', () => {
      render(<ActionSequence {...defaultProps} actions={[ACTIONS.OPEN]} />);
      expect(screen.queryByText('→')).not.toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('applies small gap for small size', () => {
      const { container } = render(<ActionSequence {...defaultProps} size="small" />);
      expect(container.firstChild.className).toContain('gap-0.5');
    });

    it('applies medium gap for medium size', () => {
      const { container } = render(<ActionSequence {...defaultProps} size="medium" />);
      expect(container.firstChild.className).toContain('gap-1');
    });

    it('applies large gap for large size', () => {
      const { container } = render(<ActionSequence {...defaultProps} size="large" />);
      expect(container.firstChild.className).toContain('gap-1.5');
    });

    it('uses medium size by default', () => {
      const { container } = render(<ActionSequence {...defaultProps} />);
      expect(container.firstChild.className).toContain('gap-1');
    });
  });

  describe('tooltip', () => {
    it('sets tooltip with full action sequence', () => {
      const { container } = render(
        <ActionSequence {...defaultProps} actions={[ACTIONS.OPEN, ACTIONS.CALL]} />
      );
      expect(container.firstChild).toHaveAttribute('title');
    });

    it('includes all actions in tooltip even when overflowed', () => {
      const { container } = render(
        <ActionSequence
          {...defaultProps}
          actions={[ACTIONS.OPEN, ACTIONS.CALL, ACTIONS.THREE_BET, ACTIONS.FOLD]}
          maxVisible={2}
        />
      );
      const title = container.firstChild.getAttribute('title');
      expect(title).toContain('→');
    });
  });

  describe('styling', () => {
    it('uses flex layout', () => {
      const { container } = render(<ActionSequence {...defaultProps} />);
      expect(container.firstChild.className).toContain('flex');
    });

    it('vertically centers items', () => {
      const { container } = render(<ActionSequence {...defaultProps} />);
      expect(container.firstChild.className).toContain('items-center');
    });

    it('overflow badge has gray background', () => {
      render(
        <ActionSequence
          {...defaultProps}
          actions={[ACTIONS.OPEN, ACTIONS.CALL, ACTIONS.THREE_BET, ACTIONS.FOLD]}
          maxVisible={3}
        />
      );
      const overflowBadge = screen.getByText('+2');
      expect(overflowBadge.className).toContain('bg-gray-200');
    });

    it('arrow has gray text', () => {
      render(<ActionSequence {...defaultProps} actions={[ACTIONS.OPEN, ACTIONS.CALL]} />);
      const arrow = screen.getByText('→');
      expect(arrow.className).toContain('text-gray-500');
    });
  });

  describe('edge cases', () => {
    it('handles maxVisible of 1', () => {
      render(
        <ActionSequence
          {...defaultProps}
          actions={[ACTIONS.OPEN, ACTIONS.CALL]}
          maxVisible={1}
        />
      );
      // Should show 0 badges (maxVisible-1) + overflow
      // Actually with 1, it shows 0 + overflow for 2
      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('handles large number of actions', () => {
      const manyActions = new Array(10).fill(ACTIONS.OPEN);
      render(<ActionSequence {...defaultProps} actions={manyActions} maxVisible={3} />);
      expect(screen.getByText('+8')).toBeInTheDocument();
    });
  });
});
