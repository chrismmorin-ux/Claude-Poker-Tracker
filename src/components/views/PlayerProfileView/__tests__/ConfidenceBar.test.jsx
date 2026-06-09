// @vitest-environment jsdom
/**
 * @file Tests for ConfidenceBar.jsx — §PIO-G4-DISAMB confidence visual +
 * AP-PIO-04 neutral-copy enforcement. WS-164 / SPR-110.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfidenceBar } from '../ConfidenceBar';

describe('ConfidenceBar — rendering per band (§PIO-G4-DISAMB)', () => {
  it('renders "strong match" for score ≥ 0.7', () => {
    render(<ConfidenceBar score={0.85} />);
    expect(screen.getByTestId('confidence-bar').getAttribute('data-band')).toBe('strong');
    expect(screen.getByTestId('confidence-label').textContent).toMatch(/strong match/i);
  });

  it('renders "partial match" for 0.4 ≤ score < 0.7', () => {
    render(<ConfidenceBar score={0.55} />);
    expect(screen.getByTestId('confidence-bar').getAttribute('data-band')).toBe('partial');
    expect(screen.getByTestId('confidence-label').textContent).toMatch(/partial match/i);
  });

  it('renders "weak match" for score < 0.4', () => {
    render(<ConfidenceBar score={0.2} />);
    expect(screen.getByTestId('confidence-bar').getAttribute('data-band')).toBe('weak');
    expect(screen.getByTestId('confidence-label').textContent).toMatch(/weak match/i);
  });

  it('renders 10 segments', () => {
    const { container } = render(<ConfidenceBar score={0.5} />);
    const segments = container.querySelectorAll('[role="img"] > span');
    expect(segments.length).toBe(10);
  });

  it('renders nothing for a non-numeric score', () => {
    const { container } = render(<ConfidenceBar score={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('can show a numeric percent when asked', () => {
    render(<ConfidenceBar score={0.8} showPercent />);
    expect(screen.getByTestId('confidence-label').textContent).toMatch(/80%/);
  });
});

// ─── AP-PIO-04 — neutral copy (binding) ──────────────────────────────────

describe('ConfidenceBar — AP-PIO-04 forbidden-copy lint', () => {
  const FORBIDDEN = [
    /are you sure/i,
    /double-?check/i,
    /don'?t get this wrong/i,
    /verify carefully/i,
    /did you mean/i,
    /might be wrong/i,
    /caution/i,
    /low confidence/i,
  ];

  it('renders no shame / verification-pressure framing at any band', () => {
    for (const score of [0.95, 0.6, 0.35, 0.1]) {
      const { container, unmount } = render(<ConfidenceBar score={score} showPercent />);
      const text = container.textContent || '';
      for (const pattern of FORBIDDEN) {
        expect(pattern.test(text), `band score=${score} matched forbidden copy ${pattern}`).toBe(false);
      }
      unmount();
    }
  });

  it('weak match reads as a factual label, not a verdict', () => {
    render(<ConfidenceBar score={0.1} />);
    const label = screen.getByTestId('confidence-label').textContent || '';
    expect(label.trim().toLowerCase()).toBe('weak match');
  });
});
