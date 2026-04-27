// @vitest-environment jsdom
/**
 * AnchorEmptyState.test.jsx — render coverage for newcomer + zero-anchors variants.
 *
 * EAL Phase 6 — Session 18 (S18).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnchorEmptyState } from '../AnchorEmptyState';
import { ANCHOR_LIBRARY_UNLOCK_THRESHOLD } from '../../../../constants/anchorLibraryConstants';

describe('AnchorEmptyState — newcomer variant', () => {
  it('renders progress text with default threshold', () => {
    render(<AnchorEmptyState variant="newcomer" handsSeen={5} />);
    expect(
      screen.getByText(`Anchors unlock after ${ANCHOR_LIBRARY_UNLOCK_THRESHOLD} hands — your progress: 5 / ${ANCHOR_LIBRARY_UNLOCK_THRESHOLD}`),
    ).toBeInTheDocument();
  });

  it('uses editor-tone explainer (not gamified)', () => {
    render(<AnchorEmptyState variant="newcomer" handsSeen={0} />);
    expect(
      screen.getByText(/library activates once enough hands have been reviewed/i),
    ).toBeInTheDocument();
  });

  it('handles zero hands seen', () => {
    render(<AnchorEmptyState variant="newcomer" handsSeen={0} />);
    expect(
      screen.getByText(new RegExp(`progress: 0 / ${ANCHOR_LIBRARY_UNLOCK_THRESHOLD}`)),
    ).toBeInTheDocument();
  });

  it('clamps progress at threshold (no over-progress)', () => {
    render(<AnchorEmptyState variant="newcomer" handsSeen={9999} />);
    expect(
      screen.getByText(new RegExp(`progress: ${ANCHOR_LIBRARY_UNLOCK_THRESHOLD} / ${ANCHOR_LIBRARY_UNLOCK_THRESHOLD}`)),
    ).toBeInTheDocument();
  });

  it('respects threshold prop override', () => {
    render(<AnchorEmptyState variant="newcomer" handsSeen={2} threshold={10} />);
    expect(screen.getByText(/Anchors unlock after 10 hands — your progress: 2 \/ 10/)).toBeInTheDocument();
  });

  it('clamps negative handsSeen to 0 (defensive)', () => {
    render(<AnchorEmptyState variant="newcomer" handsSeen={-3} threshold={10} />);
    expect(screen.getByText(/progress: 0 \/ 10/)).toBeInTheDocument();
  });

  it('exposes data-variant="newcomer" for visual regression', () => {
    render(<AnchorEmptyState variant="newcomer" handsSeen={0} />);
    expect(screen.getByTestId('anchor-library-empty-state')).toHaveAttribute('data-variant', 'newcomer');
  });

  it('uses role="status" for assistive tech announcement', () => {
    render(<AnchorEmptyState variant="newcomer" handsSeen={0} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does NOT render any progress bar element (red line #5 — no gamification)', () => {
    const { container } = render(<AnchorEmptyState variant="newcomer" handsSeen={5} />);
    expect(container.querySelector('progress')).toBeNull();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });
});

describe('AnchorEmptyState — zero-anchors variant', () => {
  it('renders the matter-of-fact "no anchors yet" headline', () => {
    render(<AnchorEmptyState variant="zero-anchors" />);
    expect(screen.getByText(/No anchors in your library yet/i)).toBeInTheDocument();
  });

  it('explains that the matcher will populate it', () => {
    render(<AnchorEmptyState variant="zero-anchors" />);
    expect(screen.getByText(/matcher detects patterns/i)).toBeInTheDocument();
  });

  it('does NOT render gamified or engagement copy (AP-04 / red line #5)', () => {
    render(<AnchorEmptyState variant="zero-anchors" />);
    // Forbidden phrases per persona red line #7 + anti-pattern AP-06.
    expect(screen.queryByText(/keep going/i)).toBeNull();
    expect(screen.queryByText(/streak/i)).toBeNull();
    expect(screen.queryByText(/score/i)).toBeNull();
    expect(screen.queryByText(/grade/i)).toBeNull();
  });

  it('exposes data-variant="zero-anchors"', () => {
    render(<AnchorEmptyState variant="zero-anchors" />);
    expect(screen.getByTestId('anchor-library-empty-state')).toHaveAttribute('data-variant', 'zero-anchors');
  });
});
