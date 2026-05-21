/**
 * TendencyStats.test.jsx — backfill test coverage for the SPR-017 ±X.X%
 * credible-interval rendering convention.
 *
 * Per WS-135 / SPR-063 substrate-map fork: TendencyStats had no dedicated
 * test file despite SPR-017 modifying it. This file pins the rendering
 * contract so the WS-135 expansion (TendencyStatsCard) cannot drift.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TendencyStats } from '../TendencyStats';

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

describe('TendencyStats', () => {
  describe('null gating', () => {
    it('returns null when stats is missing', () => {
      const { container } = render(<TendencyStats stats={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null when stats is undefined', () => {
      const { container } = render(<TendencyStats />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null below MIN_DISPLAY_SAMPLE (10)', () => {
      const { container } = render(<TendencyStats stats={baseStats({ sampleSize: 9 })} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders at MIN_DISPLAY_SAMPLE boundary (sampleSize=10)', () => {
      const { container } = render(<TendencyStats stats={baseStats({ sampleSize: 10 })} />);
      expect(container.firstChild).not.toBeNull();
    });
  });

  describe('stat rendering', () => {
    it('renders VPIP / PFR / AF labels and values', () => {
      render(<TendencyStats stats={baseStats()} />);
      expect(screen.getByText('VPIP')).toBeTruthy();
      expect(screen.getByText('PFR')).toBeTruthy();
      expect(screen.getByText('AF')).toBeTruthy();
      // Values render with % suffix (except AF)
      expect(screen.getByText(/24%/)).toBeTruthy();
      expect(screen.getByText(/18%/)).toBeTruthy();
      expect(screen.getByText('2.1')).toBeTruthy(); // AF: no % suffix
    });

    it('renders 3B and CB when present', () => {
      render(<TendencyStats stats={baseStats()} />);
      expect(screen.getByText('3B')).toBeTruthy();
      expect(screen.getByText('CB')).toBeTruthy();
    });

    it('omits 3B when threeBet is null', () => {
      render(<TendencyStats stats={baseStats({ threeBet: null })} />);
      expect(screen.queryByText('3B')).toBeNull();
    });

    it('omits CB when cbet is null', () => {
      render(<TendencyStats stats={baseStats({ cbet: null })} />);
      expect(screen.queryByText('CB')).toBeNull();
    });

    it('renders style badge at sampleSize >= MIN_STYLE_SAMPLE (20)', () => {
      render(<TendencyStats stats={baseStats({ sampleSize: 20 })} />);
      expect(screen.getByText('TAG')).toBeTruthy();
    });

    it('hides style badge below MIN_STYLE_SAMPLE', () => {
      render(<TendencyStats stats={baseStats({ sampleSize: 19 })} />);
      expect(screen.queryByText('TAG')).toBeNull();
    });
  });

  describe('credible-interval ±X.X% suffix (SPR-017 convention)', () => {
    it('renders ±X.X% suffix at sampleSize <= 200', () => {
      const { container } = render(<TendencyStats stats={baseStats({ sampleSize: 100 })} />);
      const text = container.textContent || '';
      // VPIP interval [0.20, 0.28] → halfWidth = (0.28-0.20)/2 * 100 = 4.0%
      expect(text).toMatch(/±4\.0%/);
    });

    it('renders bands at sampleSize=200 boundary (inclusive)', () => {
      const { container } = render(<TendencyStats stats={baseStats({ sampleSize: 200 })} />);
      const text = container.textContent || '';
      expect(text).toMatch(/±/);
    });

    it('hides ±X.X% suffix at sampleSize > 200 (noise threshold)', () => {
      const { container } = render(<TendencyStats stats={baseStats({ sampleSize: 201 })} />);
      const text = container.textContent || '';
      expect(text).not.toMatch(/±/);
    });

    it('hides ±X.X% when intervals are missing entirely', () => {
      const { container } = render(<TendencyStats stats={baseStats({ intervals: undefined })} />);
      const text = container.textContent || '';
      expect(text).not.toMatch(/±/);
    });

    it('AF row never has a ±X.X% suffix (no interval per SPR-017)', () => {
      const { container } = render(<TendencyStats stats={baseStats({ sampleSize: 100 })} />);
      // Locate the AF span text
      const text = container.textContent || '';
      // AF should appear as "AF 2.1" with no ± after it (within the same span)
      expect(text).toMatch(/AF\s*2\.1/);
      // Confirm there's no AF-band syntax — match "AF 2.1±" to be sure no band immediately follows
      expect(text).not.toMatch(/AF\s*2\.1\s*±/);
    });
  });

  describe('AP-04 absence (no scalar score / grade / rank)', () => {
    it('rendered DOM contains no score/grade/rank/overall tokens', () => {
      const { container } = render(<TendencyStats stats={baseStats()} />);
      const text = container.textContent || '';
      expect(text).not.toMatch(/\bscore\b/i);
      expect(text).not.toMatch(/\bgrade\b/i);
      expect(text).not.toMatch(/\brank\b/i);
      expect(text).not.toMatch(/\boverall\b/i);
    });
  });
});
