import { describe, it, expect } from 'vitest';
import { escapeHtml, renderCard, renderStatRow, buildSeatArcPositions, renderMiniCard } from '../render-utils.js';

describe('escapeHtml', () => {
  it('escapes HTML entities including quotes', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('A&B')).toBe('A&amp;B');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#x27;s');
  });

  it('escapes double quotes in attribute context', () => {
    expect(escapeHtml('" onmouseover="alert(1)')).toBe('&quot; onmouseover=&quot;alert(1)');
  });

  it('returns empty string for null/undefined/empty', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml('')).toBe('');
  });

  it('passes through safe strings unchanged', () => {
    expect(escapeHtml('Hello world 123')).toBe('Hello world 123');
  });
});

describe('renderCard', () => {
  it('renders a heart card with red class', () => {
    const html = renderCard('A♥');
    expect(html).toContain('heart');
    expect(html).toContain('A♥');
  });

  it('renders a spade card with spade class', () => {
    const html = renderCard('K♠');
    expect(html).toContain('spade');
    expect(html).toContain('K♠');
  });

  it('renders empty card for null', () => {
    const html = renderCard(null);
    expect(html).toContain('empty-card');
    expect(html).toContain('?');
  });

  it('handles lowercase suit notation', () => {
    const html = renderCard('Ah');
    expect(html).toContain('heart');
    expect(html).toContain('A♥');
  });
});

describe('renderStatRow', () => {
  it('renders label and value', () => {
    const html = renderStatRow('VPIP', 42, '%', 'high');
    expect(html).toContain('VPIP');
    expect(html).toContain('42%');
    expect(html).toContain('high');
  });

  it('renders dash for null value', () => {
    const html = renderStatRow('PFR', null, '%', 'neutral');
    expect(html).toContain('—');
  });
});

// ==========================================================================
// buildSeatArcPositions
// ==========================================================================

describe('buildSeatArcPositions', () => {
  it('places hero at bottom center', () => {
    const seats = [1, 2, 3, 4, 5];
    const pos = buildSeatArcPositions(seats, 3, 380, 85);
    const hero = pos.get(3);
    expect(hero).toBeDefined();
    expect(hero.x).toBe(190); // center of 380
    expect(hero.y).toBe(69);  // 85 - 16
  });

  it('places opponents on arc above hero', () => {
    const seats = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const pos = buildSeatArcPositions(seats, 5, 380, 85);
    // Hero at bottom
    expect(pos.get(5).y).toBeGreaterThan(60);
    // All opponents should be above hero
    for (const [seat, p] of pos) {
      if (seat !== 5) {
        expect(p.y).toBeLessThan(pos.get(5).y);
      }
    }
  });

  it('handles 2-seat table (heads up)', () => {
    const pos = buildSeatArcPositions([1, 5], 5, 380, 85);
    expect(pos.size).toBe(2);
    expect(pos.has(5)).toBe(true); // hero
    expect(pos.has(1)).toBe(true); // opponent
    // Single opponent should be at top center
    const opp = pos.get(1);
    expect(opp.x).toBeGreaterThan(150);
    expect(opp.x).toBeLessThan(230);
  });

  it('handles hero not in seat list', () => {
    const pos = buildSeatArcPositions([1, 2, 3], 9, 380, 85);
    // Hero not in list, so only 3 opponents
    expect(pos.has(9)).toBe(false);
    expect(pos.size).toBe(3);
  });

  it('distributes opponents left to right', () => {
    const seats = [1, 2, 3, 4, 5];
    const pos = buildSeatArcPositions(seats, 3, 380, 85);
    // Relative order from hero: 4, 5, 1, 2 (clockwise)
    // These should go left to right
    const xs = [4, 5, 1, 2].map(s => pos.get(s).x);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });

  it('returns empty map for empty seats', () => {
    const pos = buildSeatArcPositions([], 1, 380, 85);
    expect(pos.size).toBe(0);
  });

  it('positions stay within container bounds', () => {
    const W = 380, H = 85;
    const seats = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const pos = buildSeatArcPositions(seats, 5, W, H);
    for (const [, p] of pos) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(W);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(H);
    }
  });
});

// ==========================================================================
// renderMiniCard
// ==========================================================================

describe('renderMiniCard', () => {
  it('renders a red card with red class', () => {
    const html = renderMiniCard('A\u2665');
    expect(html).toContain('red');
    expect(html).toContain('A\u2665');
    expect(html).not.toContain('hero-card');
  });

  it('renders a black card with black class', () => {
    const html = renderMiniCard('K\u2660');
    expect(html).toContain('black');
    expect(html).toContain('K\u2660');
  });

  it('adds hero-card class when isHero is true', () => {
    const html = renderMiniCard('Q\u2666', true);
    expect(html).toContain('hero-card');
    expect(html).toContain('red');
  });

  it('renders empty card for empty string', () => {
    const html = renderMiniCard('');
    expect(html).toContain('empty-card');
    expect(html).toContain('?');
  });

  it('renders empty card for null', () => {
    const html = renderMiniCard(null);
    expect(html).toContain('empty-card');
  });
});
