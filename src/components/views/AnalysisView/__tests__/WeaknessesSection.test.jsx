/**
 * WeaknessesSection.test.jsx — regression coverage for WS-173.
 *
 * The bug: WeaknessesSection's early-return guard referenced an undeclared
 * `playerId`, throwing ReferenceError on every render. Introduced commit
 * 4093b4b (2026-03-09) and went undetected for ~2 months because no tests
 * existed for src/components/views/AnalysisView/.
 *
 * This file pins the render-path so a future regression of the same shape
 * is caught at CI time. First test file in the AnalysisView/__tests__/
 * directory — also closes the test-coverage gap noted by the SPR-063
 * substrate-map fork.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeaknessesSection } from '../PlayerAnalysisPanel';

describe('WeaknessesSection (WS-173 regression)', () => {
  describe('does not throw ReferenceError', () => {
    it('renders without throwing when tendency has no weaknesses field', () => {
      // Exact bug-trigger conditions: tendency provided, weaknesses missing.
      // Previously the `!playerId` evaluation threw before the
      // weaknesses-empty check could short-circuit.
      expect(() => render(<WeaknessesSection tendency={{}} />)).not.toThrow();
    });

    it('renders without throwing when tendency has empty weaknesses array', () => {
      expect(() => render(<WeaknessesSection tendency={{ weaknesses: [] }} />)).not.toThrow();
    });

    it('renders without throwing when tendency has non-empty weaknesses array', () => {
      const tendency = {
        weaknesses: [
          {
            id: 'w1',
            label: 'Over-folds vs 3-bet',
            description: 'BB defense vs 3-bet OOP is too tight.',
            severity: 0.7,
            category: 'preflop',
          },
        ],
      };
      expect(() => render(<WeaknessesSection tendency={tendency} />)).not.toThrow();
    });

    it('renders without throwing when tendency is null', () => {
      expect(() => render(<WeaknessesSection tendency={null} />)).not.toThrow();
    });

    it('renders without throwing when tendency is undefined', () => {
      expect(() => render(<WeaknessesSection />)).not.toThrow();
    });
  });

  describe('null/empty rendering', () => {
    it('returns null (renders nothing) when tendency is null', () => {
      const { container } = render(<WeaknessesSection tendency={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null when weaknesses array is empty', () => {
      const { container } = render(<WeaknessesSection tendency={{ weaknesses: [] }} />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null when tendency has no weaknesses field at all', () => {
      const { container } = render(<WeaknessesSection tendency={{}} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('populated rendering', () => {
    it('renders header with weakness count', () => {
      const tendency = {
        weaknesses: [
          { id: 'w1', label: 'A', severity: 0.5, category: 'preflop' },
          { id: 'w2', label: 'B', severity: 0.6, category: 'sizing' },
        ],
      };
      render(<WeaknessesSection tendency={tendency} />);
      expect(screen.getByText('Weaknesses (2)')).toBeTruthy();
    });

    it('renders each weakness label', () => {
      const tendency = {
        weaknesses: [
          { id: 'w1', label: 'Over-folds vs 3-bet', severity: 0.7, category: 'preflop' },
          { id: 'w2', label: 'Under-bluffs OTR', severity: 0.5, category: 'sizing' },
        ],
      };
      render(<WeaknessesSection tendency={tendency} />);
      expect(screen.getByText('Over-folds vs 3-bet')).toBeTruthy();
      expect(screen.getByText('Under-bluffs OTR')).toBeTruthy();
    });

    it('groups weaknesses by category', () => {
      const tendency = {
        weaknesses: [
          { id: 'w1', label: 'A', severity: 0.5, category: 'preflop' },
          { id: 'w2', label: 'B', severity: 0.6, category: 'preflop' },
          { id: 'w3', label: 'C', severity: 0.7, category: 'sizing' },
        ],
      };
      render(<WeaknessesSection tendency={tendency} />);
      // Category labels render uppercased per CATEGORY_LABELS const
      expect(screen.getByText('Preflop')).toBeTruthy();
      expect(screen.getByText('Sizing')).toBeTruthy();
    });
  });
});
