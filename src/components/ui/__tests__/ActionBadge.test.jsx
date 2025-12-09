/**
 * ActionBadge.test.jsx - Tests for ActionBadge component
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionBadge } from '../ActionBadge';
import { ACTIONS, ACTION_ABBREV } from '../../../test/utils';

// Mock the utility functions
vi.mock('../../../utils/actionUtils', () => ({
  getActionColor: vi.fn((action, isFoldAction, ACTIONS) => {
    if (action === ACTIONS?.FOLD) return 'bg-red-200 text-red-800';
    if (action === ACTIONS?.CALL) return 'bg-green-200 text-green-800';
    if (action === ACTIONS?.OPEN) return 'bg-blue-200 text-blue-800';
    return 'bg-gray-200 text-gray-800';
  }),
  getActionAbbreviation: vi.fn((action, ACTION_ABBREV) => {
    return ACTION_ABBREV?.[action] || action || '';
  }),
}));

describe('ActionBadge', () => {
  const defaultProps = {
    action: ACTIONS.CALL,
    ACTIONS,
    ACTION_ABBREV,
  };

  describe('rendering', () => {
    it('renders action abbreviation', () => {
      render(<ActionBadge {...defaultProps} />);
      expect(screen.getByText(ACTION_ABBREV[ACTIONS.CALL])).toBeInTheDocument();
    });

    it('renders with default medium size', () => {
      const { container } = render(<ActionBadge {...defaultProps} />);
      expect(container.firstChild.className).toContain('h-7');
      expect(container.firstChild.className).toContain('text-sm');
    });
  });

  describe('sizes', () => {
    it('renders small size correctly', () => {
      const { container } = render(<ActionBadge {...defaultProps} size="small" />);
      expect(container.firstChild.className).toContain('h-5');
      expect(container.firstChild.className).toContain('text-xs');
      expect(container.firstChild.className).toContain('px-1');
    });

    it('renders medium size correctly', () => {
      const { container } = render(<ActionBadge {...defaultProps} size="medium" />);
      expect(container.firstChild.className).toContain('h-7');
      expect(container.firstChild.className).toContain('text-sm');
      expect(container.firstChild.className).toContain('px-1.5');
    });

    it('renders large size correctly', () => {
      const { container } = render(<ActionBadge {...defaultProps} size="large" />);
      expect(container.firstChild.className).toContain('h-9');
      expect(container.firstChild.className).toContain('text-base');
      expect(container.firstChild.className).toContain('px-2');
    });
  });

  describe('arrow display', () => {
    it('does not show arrow by default', () => {
      render(<ActionBadge {...defaultProps} />);
      expect(screen.queryByText('→')).not.toBeInTheDocument();
    });

    it('shows arrow when showArrow is true', () => {
      render(<ActionBadge {...defaultProps} showArrow={true} />);
      expect(screen.getByText('→')).toBeInTheDocument();
    });

    it('does not show arrow when showArrow is false', () => {
      render(<ActionBadge {...defaultProps} showArrow={false} />);
      expect(screen.queryByText('→')).not.toBeInTheDocument();
    });
  });

  describe('different actions', () => {
    it('renders FOLD action', () => {
      render(<ActionBadge {...defaultProps} action={ACTIONS.FOLD} />);
      expect(screen.getByText(ACTION_ABBREV[ACTIONS.FOLD])).toBeInTheDocument();
    });

    it('renders CALL action', () => {
      render(<ActionBadge {...defaultProps} action={ACTIONS.CALL} />);
      expect(screen.getByText(ACTION_ABBREV[ACTIONS.CALL])).toBeInTheDocument();
    });

    it('renders OPEN action', () => {
      render(<ActionBadge {...defaultProps} action={ACTIONS.OPEN} />);
      expect(screen.getByText(ACTION_ABBREV[ACTIONS.OPEN])).toBeInTheDocument();
    });

    it('renders CHECK action', () => {
      render(<ActionBadge {...defaultProps} action={ACTIONS.CHECK} />);
      expect(screen.getByText(ACTION_ABBREV[ACTIONS.CHECK])).toBeInTheDocument();
    });

    it('renders THREE_BET action', () => {
      render(<ActionBadge {...defaultProps} action={ACTIONS.THREE_BET} />);
      expect(screen.getByText(ACTION_ABBREV[ACTIONS.THREE_BET])).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('has inline-flex layout', () => {
      const { container } = render(<ActionBadge {...defaultProps} />);
      expect(container.firstChild.className).toContain('inline-flex');
    });

    it('centers content', () => {
      const { container } = render(<ActionBadge {...defaultProps} />);
      expect(container.firstChild.className).toContain('items-center');
      expect(container.firstChild.className).toContain('justify-center');
    });

    it('has rounded corners', () => {
      const { container } = render(<ActionBadge {...defaultProps} />);
      expect(container.firstChild.className).toContain('rounded');
    });

    it('has bold font', () => {
      const { container } = render(<ActionBadge {...defaultProps} />);
      expect(container.firstChild.className).toContain('font-bold');
    });

    it('has minimum width', () => {
      const { container } = render(<ActionBadge {...defaultProps} size="medium" />);
      expect(container.firstChild.className).toContain('min-w-[20px]');
    });
  });

  describe('edge cases', () => {
    it('handles undefined action', () => {
      const { container } = render(<ActionBadge ACTIONS={ACTIONS} ACTION_ABBREV={ACTION_ABBREV} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('handles null action', () => {
      const { container } = render(<ActionBadge action={null} ACTIONS={ACTIONS} ACTION_ABBREV={ACTION_ABBREV} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });
});
