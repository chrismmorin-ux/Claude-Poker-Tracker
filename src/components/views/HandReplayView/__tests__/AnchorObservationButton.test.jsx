// @vitest-environment jsdom
/**
 * AnchorObservationButton.test.jsx
 *
 * EAL Phase 6 Stream D B3 — Session 16.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnchorObservationButton } from '../AnchorObservationButton';

describe('AnchorObservationButton', () => {
  it('renders default copy "🏷 Tag pattern"', () => {
    render(<AnchorObservationButton onClick={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveTextContent(/Tag pattern/);
  });

  it('honors a custom label', () => {
    render(<AnchorObservationButton onClick={vi.fn()} label="Note this hand" />);
    expect(screen.getByRole('button')).toHaveTextContent('Note this hand');
  });

  it('exposes ≥44×44 tap target via inline style (H-ML06)', () => {
    render(<AnchorObservationButton onClick={vi.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn.style.minHeight).toBe('44px');
    expect(btn.style.minWidth).toBe('44px');
  });

  it('forbids engagement / imperative copy via the default label', () => {
    render(<AnchorObservationButton onClick={vi.fn()} />);
    const text = screen.getByRole('button').textContent || '';
    // AP-09 + red line #7 forbidden copy ladder
    expect(text).not.toMatch(/rate|how did|review this|score|grade|streak|master|level up/i);
  });

  it('fires onClick when tapped', () => {
    const onClick = vi.fn();
    render(<AnchorObservationButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onClick when isOpen=true (double-invocation guard)', () => {
    const onClick = vi.fn();
    render(<AnchorObservationButton onClick={onClick} isOpen={true} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('sets disabled + aria-disabled when isOpen=true', () => {
    render(<AnchorObservationButton onClick={vi.fn()} isOpen={true} />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not throw when onClick prop is missing', () => {
    render(<AnchorObservationButton />);
    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow();
  });

  it('exposes accessible name "Tag pattern"', () => {
    render(<AnchorObservationButton onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Tag pattern/ })).toBeInTheDocument();
  });
});
