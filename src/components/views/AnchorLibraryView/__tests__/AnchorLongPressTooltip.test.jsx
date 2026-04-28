/**
 * AnchorLongPressTooltip.test.jsx — first-run tooltip render-gate tests.
 *
 * EAL Phase 6 — Session 20 (S20).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnchorLongPressTooltip } from '../AnchorLongPressTooltip';

describe('AnchorLongPressTooltip', () => {
  it('returns null when show=false', () => {
    const { container } = render(<AnchorLongPressTooltip show={false} onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders banner when show=true', () => {
    render(<AnchorLongPressTooltip show={true} onDismiss={() => {}} />);
    expect(screen.getByTestId('anchor-long-press-tooltip')).toBeTruthy();
  });

  it('renders the spec copy verbatim', () => {
    render(<AnchorLongPressTooltip show={true} onDismiss={() => {}} />);
    expect(screen.getByTestId('anchor-long-press-tooltip').textContent).toContain('Long-press (or tap ⓘ) for details.');
  });

  it('has role=status for accessibility', () => {
    render(<AnchorLongPressTooltip show={true} onDismiss={() => {}} />);
    expect(screen.getByTestId('anchor-long-press-tooltip').getAttribute('role')).toBe('status');
  });

  it('renders a "Got it" dismiss button with ≥32px tap target', () => {
    render(<AnchorLongPressTooltip show={true} onDismiss={() => {}} />);
    const btn = screen.getByTestId('anchor-long-press-tooltip-dismiss');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('Got it');
    expect(parseInt(btn.style.minHeight, 10)).toBeGreaterThanOrEqual(32);
  });

  it('invokes onDismiss when "Got it" tapped', () => {
    const onDismiss = vi.fn();
    render(<AnchorLongPressTooltip show={true} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('anchor-long-press-tooltip-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not crash when onDismiss omitted', () => {
    render(<AnchorLongPressTooltip show={true} />);
    expect(() => fireEvent.click(screen.getByTestId('anchor-long-press-tooltip-dismiss'))).not.toThrow();
  });
});
