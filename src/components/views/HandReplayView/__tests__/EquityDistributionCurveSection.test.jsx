/**
 * EquityDistributionCurveSection.test.jsx — DOM-assertion tests for the
 * Equity-Distribution Curve embed inside HandReplayView/ReviewPanel.
 *
 * SLS Stream B2 — WS-042 / SPR-084.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EquityDistributionCurveSection } from '../EquityDistributionCurveSection';

const mk = (weight, heroEquity) => ({ weight, heroEquity });

// A "hockey stick"–ish synthetic perCombo: most mass low-medium villain
// equity (high hero equity), small spire of high villain equity.
const HOCKEY_STICK_PER_COMBO = [
  // 6 combos at heroEq 0.7 (villainEq 0.3) — bulk of medium-weak
  mk(1, 0.7), mk(1, 0.7), mk(1, 0.7), mk(1, 0.7), mk(1, 0.7), mk(1, 0.7),
  // 4 combos at heroEq 0.6 (villainEq 0.4) — adjacent
  mk(1, 0.6), mk(1, 0.6), mk(1, 0.6), mk(1, 0.6),
  // 2 combos at heroEq 0.05 (villainEq 0.95) — the spire
  mk(1, 0.05), mk(1, 0.05),
];

describe('EquityDistributionCurveSection — null / empty handling', () => {
  it('renders nothing when perCombo is null', () => {
    const { container } = render(<EquityDistributionCurveSection perCombo={null} />);
    expect(container.firstChild).toBe(null);
    cleanup();
  });

  it('renders nothing when perCombo is undefined', () => {
    const { container } = render(<EquityDistributionCurveSection />);
    expect(container.firstChild).toBe(null);
    cleanup();
  });

  it('renders nothing when perCombo is empty array', () => {
    const { container } = render(<EquityDistributionCurveSection perCombo={[]} />);
    expect(container.firstChild).toBe(null);
    cleanup();
  });

  it('renders nothing when curve compute returns status: empty (filtered weight too low)', () => {
    const sparse = [mk(0.0001, 0.5), mk(0.0005, 0.7)];
    const { container } = render(<EquityDistributionCurveSection perCombo={sparse} />);
    expect(container.firstChild).toBe(null);
    cleanup();
  });
});

describe('EquityDistributionCurveSection — rendered output', () => {
  it('renders the section wrapper when perCombo is valid', () => {
    render(<EquityDistributionCurveSection perCombo={HOCKEY_STICK_PER_COMBO} />);
    expect(screen.getByTestId('equity-distribution-curve-section')).toBeTruthy();
    cleanup();
  });

  it('renders the mean-equity readout as a percentage', () => {
    render(<EquityDistributionCurveSection perCombo={HOCKEY_STICK_PER_COMBO} />);
    const mean = screen.getByTestId('equity-distribution-curve-mean');
    expect(mean.textContent).toMatch(/mean equity \d+%/);
    cleanup();
  });

  it('renders the combo count', () => {
    render(<EquityDistributionCurveSection perCombo={HOCKEY_STICK_PER_COMBO} />);
    const stats = screen.getByTestId('equity-distribution-curve-stats');
    expect(stats.textContent).toContain('12 combos');
    cleanup();
  });

  it('renders the SVG curve path', () => {
    render(<EquityDistributionCurveSection perCombo={HOCKEY_STICK_PER_COMBO} />);
    const path = screen.getByTestId('equity-distribution-curve-path');
    expect(path).toBeTruthy();
    expect(path.tagName.toLowerCase()).toBe('svg');
    const innerPath = path.querySelector('path');
    expect(innerPath).toBeTruthy();
    // Path should have a moveto + multiple lineto's
    expect(innerPath.getAttribute('d')).toMatch(/^M /);
    cleanup();
  });

  it('renders weighted-total in the stats line', () => {
    render(<EquityDistributionCurveSection perCombo={HOCKEY_STICK_PER_COMBO} />);
    const wt = screen.getByTestId('equity-distribution-curve-weight');
    expect(wt.textContent).toMatch(/weight \d+\.\d/);
    cleanup();
  });
});

describe('EquityDistributionCurveSection — collapse toggle', () => {
  it('toggles body visibility on header click', () => {
    render(<EquityDistributionCurveSection perCombo={HOCKEY_STICK_PER_COMBO} />);
    const section = screen.getByTestId('equity-distribution-curve-section');
    const header = section.querySelector('button');
    expect(section.querySelector('#equity-distribution-curve-section-body')).toBeTruthy();
    fireEvent.click(header);
    expect(section.querySelector('#equity-distribution-curve-section-body')).toBe(null);
    fireEvent.click(header);
    expect(section.querySelector('#equity-distribution-curve-section-body')).toBeTruthy();
    cleanup();
  });

  it('has aria-expanded reflecting collapse state', () => {
    render(<EquityDistributionCurveSection perCombo={HOCKEY_STICK_PER_COMBO} />);
    const header = screen.getByTestId('equity-distribution-curve-section').querySelector('button');
    expect(header.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('false');
    cleanup();
  });
});

describe('EquityDistributionCurveSection — autonomy red lines', () => {
  it('contains no engagement-pressure or shame copy', () => {
    render(<EquityDistributionCurveSection perCombo={HOCKEY_STICK_PER_COMBO} />);
    const text = screen.getByTestId('equity-distribution-curve-section').textContent.toLowerCase();
    const forbidden = [
      'great job',
      'keep it up',
      'level up',
      'streak',
      'percentile rank',
      'masteryscore',
      'fusedmastery',
      'your skill',
    ];
    for (const f of forbidden) {
      expect(text.includes(f), `Forbidden phrase: "${f}"`).toBe(false);
    }
    cleanup();
  });

  it('renders no write-affordance buttons (no enroll / mute / seed)', () => {
    render(<EquityDistributionCurveSection perCombo={HOCKEY_STICK_PER_COMBO} />);
    const section = screen.getByTestId('equity-distribution-curve-section');
    const buttons = section.querySelectorAll('button');
    for (const btn of buttons) {
      const t = btn.textContent.toLowerCase();
      expect(t.includes('enroll'), `Found enroll affordance`).toBe(false);
      expect(t.includes('mute'), `Found mute affordance`).toBe(false);
      expect(t.includes('mark as known'), `Found known affordance`).toBe(false);
      expect(t.includes('start drill'), `Found drill start`).toBe(false);
    }
    cleanup();
  });

  it('does not render mastery as a single fused score', () => {
    render(<EquityDistributionCurveSection perCombo={HOCKEY_STICK_PER_COMBO} />);
    const text = screen.getByTestId('equity-distribution-curve-section').textContent;
    expect(text).not.toMatch(/mastery[:\s]+0\./i);
    expect(text).not.toMatch(/your level/i);
  });
});
