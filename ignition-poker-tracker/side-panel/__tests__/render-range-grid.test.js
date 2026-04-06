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

  // =========================================================================
  // Dynamic Bayesian heat-map mode
  // =========================================================================

  describe('dynamic heat-map mode', () => {
    const makeRange = (fillValue = 0) => new Array(169).fill(fillValue);

    it('renders heat-map grid when 169-element range provided', () => {
      const range = makeRange(0.5);
      const html = renderRangeGrid({ range, label: 'S3 · CO · Open' });
      expect(html).toContain('range-grid-wrap');
      expect(html).toContain('range-grid');
      // 169 cells + 13 col labels + 13 row labels + 1 corner = 196 elements
      const cellCount = (html.match(/class="rg-cell/g) || []).length;
      expect(cellCount).toBe(169);
    });

    it('renders label in header', () => {
      const range = makeRange(0.4);
      const html = renderRangeGrid({ range, label: 'S3 · CO · Open' });
      expect(html).toContain('S3 · CO · Open');
      expect(html).toContain('rg-position');
    });

    it('shows "Villain Range" default label when no label provided', () => {
      const range = makeRange(0.4);
      const html = renderRangeGrid({ range });
      expect(html).toContain('Villain Range');
    });

    it('renders range width in header', () => {
      const range = makeRange(0);
      // Set a few cells with weight to produce non-zero width
      range[0] = 1.0;
      range[1] = 0.8;
      const html = renderRangeGrid({ range, label: 'Test', rangeWidth: 22 });
      expect(html).toContain('22%');
      expect(html).toContain('of hands');
    });

    it('uses pre-computed rangeWidth when provided', () => {
      const range = makeRange(0);
      const html = renderRangeGrid({ range, label: 'Test', rangeWidth: 35 });
      expect(html).toContain('35%');
    });

    it('renders equity badge when equity provided', () => {
      const range = makeRange(0.5);
      const html = renderRangeGrid({ range, label: 'Test', equity: 0.62 });
      expect(html).toContain('62% eq');
    });

    it('colors equity badge green when equity >= 0.55', () => {
      const range = makeRange(0.5);
      const html = renderRangeGrid({ range, label: 'Test', equity: 0.60 });
      expect(html).toContain('var(--green)');
    });

    it('colors equity badge gold when equity 0.45-0.55', () => {
      const range = makeRange(0.5);
      const html = renderRangeGrid({ range, label: 'Test', equity: 0.50 });
      expect(html).toContain('var(--gold)');
    });

    it('colors equity badge red when equity < 0.45', () => {
      const range = makeRange(0.5);
      const html = renderRangeGrid({ range, label: 'Test', equity: 0.35 });
      // Equity color red
      expect(html).toContain('var(--red)');
    });

    it('omits equity badge when equity not provided', () => {
      const range = makeRange(0.5);
      const html = renderRangeGrid({ range, label: 'Test' });
      expect(html).not.toContain('eq</span>');
    });

    it('highlights hero card with rg-hero class', () => {
      const range = makeRange(0.5);
      // AKo — hero has A♠ K♥
      const html = renderRangeGrid({
        range,
        label: 'Test',
        holeCards: ['A\u2660', 'K\u2665'],
      });
      expect(html).toContain('rg-hero');
    });

    it('hero cell gets gold background style', () => {
      const range = makeRange(0.5);
      const html = renderRangeGrid({
        range,
        label: 'Test',
        holeCards: ['A\u2660', 'K\u2665'],
      });
      expect(html).toContain('background:var(--gold)');
    });

    it('in-range cells get rg-heat class when weight > 0', () => {
      const range = makeRange(0);
      range[0] = 0.9; // AA cell (index 0 is rank 12 * 13 + 12)
      const html = renderRangeGrid({ range, label: 'Test', holeCards: null });
      expect(html).toContain('rg-heat');
    });

    it('zero-weight cells get plain rg-cell class (no rg-heat)', () => {
      const range = makeRange(0);
      const html = renderRangeGrid({ range, label: 'Test' });
      // All cells are zero — none should be rg-heat
      expect(html).not.toContain('rg-heat');
    });

    it('shows "Your hand" legend entry when hero cards provided', () => {
      const range = makeRange(0.3);
      const html = renderRangeGrid({
        range,
        label: 'Test',
        holeCards: ['Q\u2660', 'Q\u2665'],
      });
      expect(html).toContain('Your hand');
    });

    it('omits "Your hand" legend entry when no hero cards', () => {
      const range = makeRange(0.3);
      const html = renderRangeGrid({ range, label: 'Test', holeCards: null });
      expect(html).not.toContain('Your hand');
    });

    it('shows "In range" legend entry', () => {
      const range = makeRange(0.4);
      const html = renderRangeGrid({ range, label: 'Test' });
      expect(html).toContain('In range');
    });

    it('does not show "GTO" in header in dynamic mode', () => {
      const range = makeRange(0.5);
      const html = renderRangeGrid({ range, label: 'S4 · BTN · Open' });
      expect(html).not.toContain('GTO');
    });

    it('accepts Float64Array as range input', () => {
      const range = new Float64Array(169).fill(0.5);
      const html = renderRangeGrid({ range, label: 'Test' });
      expect(html).toContain('range-grid-wrap');
    });
  });

  describe('dynamic mode — static fallback conditions', () => {
    it('returns empty string when neither range nor position provided', () => {
      expect(renderRangeGrid({})).toBe('');
    });

    it('null range falls back to static mode when position is valid', () => {
      const html = renderRangeGrid({ range: null, position: 'CO' });
      expect(html).toContain('GTO');
      expect(html).toContain('CO');
    });

    it('empty array range falls back to static mode when position is valid', () => {
      const html = renderRangeGrid({ range: [], position: 'BTN' });
      expect(html).toContain('GTO');
    });

    it('range with wrong length (not 169) falls back to static mode', () => {
      const shortRange = new Array(100).fill(0.5);
      const html = renderRangeGrid({ range: shortRange, position: 'UTG' });
      expect(html).toContain('GTO');
    });

    it('returns empty string when range is wrong length and no valid position', () => {
      const shortRange = new Array(50).fill(0.5);
      expect(renderRangeGrid({ range: shortRange })).toBe('');
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
