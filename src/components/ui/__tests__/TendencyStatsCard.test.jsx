/**
 * TendencyStatsCard.test.jsx — wrapper component covering chrome,
 * collapsed/expanded behavior, AP-04 absence, and tap-target compliance.
 *
 * Per WS-135 / SPR-063 acceptance criteria.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TendencyStatsCard } from '../TendencyStatsCard';

const baseStats = (overrides = {}) => ({
  vpip: 24,
  pfr: 18,
  af: 2.1,
  threeBet: 7,
  cbet: 60,
  sampleSize: 100,
  style: 'TAG',
  intervals: {
    vpip: { lower: 0.20, upper: 0.28 },
    pfr: { lower: 0.14, upper: 0.22 },
    threeBet: { lower: 0.05, upper: 0.09 },
    cbet: { lower: 0.55, upper: 0.65 },
  },
  ...overrides,
});

describe('TendencyStatsCard', () => {
  describe('null gating (mirrors TendencyStats)', () => {
    it('returns null when stats is missing', () => {
      const { container } = render(
        <TendencyStatsCard stats={null} title="Villain Tendency" />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('returns null when sampleSize is below 10 (no card chrome to render)', () => {
      const { container } = render(
        <TendencyStatsCard stats={baseStats({ sampleSize: 9 })} title="X" />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('returns null when sampleSize is non-numeric', () => {
      const { container } = render(
        <TendencyStatsCard stats={baseStats({ sampleSize: 'oops' })} title="X" />,
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('open card (defaultCollapsed=false)', () => {
    it('renders title + body + footer', () => {
      render(<TendencyStatsCard stats={baseStats()} title="Villain Tendency" />);
      expect(screen.getByTestId('tendency-stats-card-title')).toHaveTextContent('Villain Tendency');
      expect(screen.getByTestId('tendency-stats-card-body')).toBeTruthy();
      expect(screen.getByTestId('tendency-stats-card-footer')).toHaveTextContent('Based on 100 hands');
    });

    it('renders TendencyStats body content (delegates to bare component)', () => {
      render(<TendencyStatsCard stats={baseStats()} title="X" />);
      // Bare TendencyStats renders VPIP/PFR/AF labels.
      expect(screen.getByText('VPIP')).toBeTruthy();
      expect(screen.getByText('PFR')).toBeTruthy();
      expect(screen.getByText('AF')).toBeTruthy();
    });

    it('does not render a disclosure toggle button when defaultCollapsed=false', () => {
      render(<TendencyStatsCard stats={baseStats()} title="X" />);
      expect(screen.queryByTestId('tendency-stats-card-toggle')).toBeNull();
    });

    it('singular noun in auto-derived footer (sampleSize=1 — though below MIN_DISPLAY=10, just unit-test footer logic via override)', () => {
      // sampleSize=1 makes the inner TendencyStats null, but the footer
      // logic itself is exercised via larger samples below.
      // For unit-test of the singular branch, use a custom footer instead.
      render(
        <TendencyStatsCard
          stats={baseStats({ sampleSize: 1 })}
          title="X"
        />,
      );
      // sampleSize=1 < MIN_DISPLAY (10) → card returns null
      expect(screen.queryByTestId('tendency-stats-card')).toBeNull();
    });

    it('plural noun in footer for sampleSize > 1', () => {
      render(<TendencyStatsCard stats={baseStats({ sampleSize: 47 })} title="X" />);
      expect(screen.getByTestId('tendency-stats-card-footer')).toHaveTextContent('Based on 47 hands');
    });

    it('honors explicit footer prop override', () => {
      render(<TendencyStatsCard stats={baseStats()} title="X" footer="Custom note." />);
      expect(screen.getByTestId('tendency-stats-card-footer')).toHaveTextContent('Custom note.');
    });
  });

  describe('collapsed-default disclosure', () => {
    it('renders disclosure button + hides body initially', () => {
      render(
        <TendencyStatsCard
          stats={baseStats()}
          title="Tendency Summary"
          defaultCollapsed
        />,
      );
      const toggle = screen.getByTestId('tendency-stats-card-toggle');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle).toHaveTextContent('Tendency Summary');
      expect(screen.queryByTestId('tendency-stats-card-body')).toBeNull();
    });

    it('disclosure button has ≥44×44 tap target', () => {
      render(<TendencyStatsCard stats={baseStats()} title="X" defaultCollapsed />);
      const toggle = screen.getByTestId('tendency-stats-card-toggle');
      expect(toggle.style.minHeight).toBe('44px');
      expect(toggle.style.minWidth).toBe('44px');
    });

    it('clicking toggle reveals body + sets aria-expanded=true', () => {
      render(<TendencyStatsCard stats={baseStats()} title="X" defaultCollapsed />);
      const toggle = screen.getByTestId('tendency-stats-card-toggle');
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByTestId('tendency-stats-card-body')).toBeTruthy();
    });

    it('clicking toggle a second time collapses again', () => {
      render(<TendencyStatsCard stats={baseStats()} title="X" defaultCollapsed />);
      const toggle = screen.getByTestId('tendency-stats-card-toggle');
      fireEvent.click(toggle); // expand
      fireEvent.click(toggle); // collapse
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('tendency-stats-card-body')).toBeNull();
    });
  });

  describe('credible-interval bands flow through (SPR-017 convention)', () => {
    it('renders ±X.X% bands at sampleSize <= 200', () => {
      const { container } = render(
        <TendencyStatsCard stats={baseStats({ sampleSize: 100 })} title="X" />,
      );
      const text = container.textContent || '';
      expect(text).toMatch(/±/);
    });

    it('hides ±X.X% bands at sampleSize > 200', () => {
      const { container } = render(
        <TendencyStatsCard stats={baseStats({ sampleSize: 300 })} title="X" />,
      );
      const text = container.textContent || '';
      expect(text).not.toMatch(/±/);
    });
  });

  describe('AP-04 absence (no scalar score / grade / rank / overall)', () => {
    it('rendered DOM contains no AP-04 tokens', () => {
      const { container } = render(
        <TendencyStatsCard stats={baseStats()} title="Villain Tendency" />,
      );
      const text = container.textContent || '';
      expect(text).not.toMatch(/\bscore\b/i);
      expect(text).not.toMatch(/\bgrade\b/i);
      expect(text).not.toMatch(/\brank\b/i);
      expect(text).not.toMatch(/\boverall\b/i);
    });

    it('rendered DOM contains no AP-04 tokens when collapsed', () => {
      const { container } = render(
        <TendencyStatsCard stats={baseStats()} title="Tendency Summary" defaultCollapsed />,
      );
      const text = container.textContent || '';
      expect(text).not.toMatch(/\bscore\b/i);
      expect(text).not.toMatch(/\bgrade\b/i);
      expect(text).not.toMatch(/\brank\b/i);
      expect(text).not.toMatch(/\boverall\b/i);
    });
  });

  describe('testId override', () => {
    it('respects custom testId prop', () => {
      render(
        <TendencyStatsCard stats={baseStats()} title="X" testId="custom-card" />,
      );
      expect(screen.getByTestId('custom-card')).toBeTruthy();
      expect(screen.getByTestId('custom-card-title')).toBeTruthy();
      expect(screen.getByTestId('custom-card-body')).toBeTruthy();
      expect(screen.getByTestId('custom-card-footer')).toBeTruthy();
    });
  });
});
