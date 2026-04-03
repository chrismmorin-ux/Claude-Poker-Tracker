import { describe, it, expect } from 'vitest';
import { renderRangeGrid } from '../render-range-grid.js';

describe('renderRangeGrid', () => {
  describe('basic rendering', () => {
    it('renders grid wrapper for a valid position', () => {
      const html = renderRangeGrid({ position: 'CO', holeCards: null, situation: null });
      expect(html).toContain('range-grid-wrap');
      expect(html).toContain('range-grid');
    });

    it('renders 169 rg-cell elements', () => {
      const html = renderRangeGrid({ position: 'UTG', holeCards: null, situation: null });
      const cellCount = (html.match(/class="rg-cell/g) || []).length;
      expect(cellCount).toBe(169);
    });

    it('renders 13 column labels', () => {
      const html = renderRangeGrid({ position: 'UTG', holeCards: null, situation: null });
      const colLabels = (html.match(/rg-col-label/g) || []).length;
      expect(colLabels).toBe(13);
    });

    it('renders 13 row labels', () => {
      const html = renderRangeGrid({ position: 'UTG', holeCards: null, situation: null });
      const rowLabels = (html.match(/rg-row-label/g) || []).length;
      expect(rowLabels).toBe(13);
    });

    it('renders position label in header', () => {
      const html = renderRangeGrid({ position: 'BTN', holeCards: null, situation: null });
      expect(html).toContain('rg-position');
      expect(html).toContain('BTN');
    });

    it('renders range width in header', () => {
      const html = renderRangeGrid({ position: 'UTG', holeCards: null, situation: null });
      expect(html).toContain('% of hands');
    });
  });

  describe('cell labels', () => {
    it('contains AA label', () => {
      const html = renderRangeGrid({ position: 'UTG', holeCards: null, situation: null });
      expect(html).toContain('>AA<');
    });

    it('contains AKs label', () => {
      const html = renderRangeGrid({ position: 'UTG', holeCards: null, situation: null });
      expect(html).toContain('>AKs<');
    });

    it('contains AKo label', () => {
      const html = renderRangeGrid({ position: 'UTG', holeCards: null, situation: null });
      expect(html).toContain('>AKo<');
    });

    it('contains 22 label', () => {
      const html = renderRangeGrid({ position: 'UTG', holeCards: null, situation: null });
      expect(html).toContain('>22<');
    });

    it('contains suited connectors', () => {
      const html = renderRangeGrid({ position: 'BTN', holeCards: null, situation: null });
      expect(html).toContain('>JTs<');
      expect(html).toContain('>98s<');
    });
  });

  describe('range coloring', () => {
    it('AA has rg-in class', () => {
      const html = renderRangeGrid({ position: 'UTG', holeCards: null, situation: null });
      // AA cell should have rg-in class
      expect(html).toMatch(/rg-cell rg-in">AA/);
    });

    it('UTG has fewer rg-in cells than BTN', () => {
      const utgHtml = renderRangeGrid({ position: 'UTG', holeCards: null, situation: null });
      const btnHtml = renderRangeGrid({ position: 'BTN', holeCards: null, situation: null });
      const utgIn = (utgHtml.match(/rg-in/g) || []).length;
      const btnIn = (btnHtml.match(/rg-in/g) || []).length;
      expect(utgIn).toBeLessThan(btnIn);
    });

    it('72o is not in UTG range', () => {
      const html = renderRangeGrid({ position: 'UTG', holeCards: null, situation: null });
      // 72o should just be rg-cell (no rg-in)
      expect(html).toMatch(/rg-cell">72o/);
    });
  });

  describe('hero hand highlighting', () => {
    it('highlights hero hand in range with rg-hero', () => {
      // AKo is in UTG range (AQo+)
      const html = renderRangeGrid({
        position: 'UTG',
        holeCards: ['A\u2660', 'K\u2665'],
        situation: null,
      });
      expect(html).toMatch(/rg-hero">AKo/);
    });

    it('highlights hero hand out of range with rg-hero-oor', () => {
      // 72o is NOT in UTG range
      const html = renderRangeGrid({
        position: 'UTG',
        holeCards: ['7\u2660', '2\u2665'],
        situation: null,
      });
      expect(html).toMatch(/rg-hero-oor">72o/);
    });

    it('suited hero hand highlighted correctly', () => {
      const html = renderRangeGrid({
        position: 'CO',
        holeCards: ['K\u2660', 'Q\u2660'],
        situation: null,
      });
      expect(html).toMatch(/rg-hero">KQs/);
    });

    it('pocket pair hero hand highlighted', () => {
      const html = renderRangeGrid({
        position: 'UTG',
        holeCards: ['A\u2660', 'A\u2665'],
        situation: null,
      });
      expect(html).toMatch(/rg-hero">AA/);
    });

    it('no hero highlight when cards are null', () => {
      const html = renderRangeGrid({ position: 'UTG', holeCards: null, situation: null });
      expect(html).not.toContain('rg-hero');
    });
  });

  describe('facing raise adjustment', () => {
    it('adds rg-tighten class when facing raise', () => {
      const html = renderRangeGrid({
        position: 'CO',
        holeCards: null,
        situation: 'facing_raise',
      });
      expect(html).toContain('rg-tighten');
    });

    it('still has rg-in cells for defended hands', () => {
      const html = renderRangeGrid({
        position: 'CO',
        holeCards: null,
        situation: 'facing_raise',
      });
      expect(html).toContain('rg-in');
    });

    it('shows adjusted width in header', () => {
      const html = renderRangeGrid({
        position: 'CO',
        holeCards: null,
        situation: 'facing_raise',
      });
      expect(html).toContain('was');
    });

    it('tighten legend appears when adjusting', () => {
      const html = renderRangeGrid({
        position: 'CO',
        holeCards: null,
        situation: 'facing_raise',
      });
      expect(html).toContain('Fold');
    });

    it('hero hand still highlighted during adjustment', () => {
      const html = renderRangeGrid({
        position: 'CO',
        holeCards: ['A\u2660', 'K\u2665'],
        situation: 'facing_raise',
      });
      // AKo should be rg-hero (it's in defending range for CO)
      expect(html).toContain('rg-hero');
    });
  });

  describe('null safety', () => {
    it('returns empty string for null position', () => {
      expect(renderRangeGrid({ position: null, holeCards: null, situation: null })).toBe('');
    });

    it('returns empty string for invalid position', () => {
      expect(renderRangeGrid({ position: 'INVALID', holeCards: null, situation: null })).toBe('');
    });
  });

  describe('legend', () => {
    it('shows "In range" swatch', () => {
      const html = renderRangeGrid({ position: 'UTG', holeCards: null, situation: null });
      expect(html).toContain('In range');
    });

    it('shows "Your hand" swatch when hero cards present', () => {
      const html = renderRangeGrid({
        position: 'UTG',
        holeCards: ['A\u2660', 'K\u2665'],
        situation: null,
      });
      expect(html).toContain('Your hand');
    });

    it('does not show "Your hand" when no hero cards', () => {
      const html = renderRangeGrid({ position: 'UTG', holeCards: null, situation: null });
      expect(html).not.toContain('Your hand');
    });
  });
});
