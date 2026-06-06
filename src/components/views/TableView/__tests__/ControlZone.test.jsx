// @vitest-environment jsdom
/**
 * ControlZone.test.jsx — focuses on the WS-190 Tag-for-Review affordance.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ControlZone } from '../ControlZone';

vi.mock('lucide-react', () => ({
  Undo2: () => <span data-testid="undo-icon">↶</span>,
  SkipForward: () => <span data-testid="skip-icon">⏭</span>,
  RotateCcw: () => <span data-testid="reset-icon">↺</span>,
  Star: () => <span data-testid="star-icon">★</span>,
}));

const baseProps = {
  singleSeat: null,
  actionArray: [],
  hasSeatSelected: false,
  remainingCount: 0,
  currentStreet: 'preflop',
  onClearSeat: vi.fn(),
  onUndo: vi.fn(),
  onDeselect: vi.fn(),
  onToggleAbsent: vi.fn(),
  onClearStreet: vi.fn(),
  onResetHand: vi.fn(),
  onNextHand: vi.fn(),
};

describe('ControlZone — Tag for Review (WS-190)', () => {
  it('renders the untagged label when reviewTagged is false', () => {
    render(<ControlZone {...baseProps} reviewTagged={false} onToggleReviewTag={vi.fn()} />);
    expect(screen.getByText('Tag for Review')).toBeTruthy();
  });

  it('renders the tagged label + aria-pressed when reviewTagged is true', () => {
    render(<ControlZone {...baseProps} reviewTagged onToggleReviewTag={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /remove review tag/i });
    expect(screen.getByText('Tagged for Review')).toBeTruthy();
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onToggleReviewTag on a single tap', () => {
    const onToggle = vi.fn();
    render(<ControlZone {...baseProps} reviewTagged={false} onToggleReviewTag={onToggle} />);
    fireEvent.click(screen.getByText('Tag for Review'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('omits the tag affordance entirely when no handler is provided', () => {
    render(<ControlZone {...baseProps} />);
    expect(screen.queryByText('Tag for Review')).toBeNull();
    expect(screen.queryByText('Tagged for Review')).toBeNull();
  });
});
