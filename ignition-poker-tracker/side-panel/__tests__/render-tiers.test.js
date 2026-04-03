import { describe, it, expect } from 'vitest';
import {
  renderRangeBreakdownSection,
  renderAllRecsSection,
  renderStreetTendenciesSection,
  renderFoldCurveSection,
  renderFoldBreakdownSection,
  renderComboStatsSection,
  renderModelAuditSection,
  renderVulnerabilitiesSection,
} from '../render-tiers.js';

// ==========================================================================
// renderRangeBreakdownSection
// ==========================================================================

describe('renderRangeBreakdownSection', () => {
  const sampleSeg = {
    handTypes: {
      overpair: { count: 6, weightSum: 6, pct: 8.2, avgDrawOuts: 0 },
      topPairGood: { count: 12, weightSum: 12, pct: 16.4, avgDrawOuts: 0 },
      topPairWeak: { count: 8, weightSum: 8, pct: 10.9, avgDrawOuts: 0 },
      middlePair: { count: 10, weightSum: 10, pct: 13.7, avgDrawOuts: 0 },
      nutFlushDraw: { count: 4, weightSum: 4, pct: 5.5, avgDrawOuts: 9 },
      oesd: { count: 6, weightSum: 6, pct: 8.2, avgDrawOuts: 8 },
      air: { count: 27, weightSum: 27, pct: 37.0, avgDrawOuts: 0 },
    },
    totalCombos: 73,
    totalWeight: 73,
    isCapped: true,
  };

  it('renders stacked bar with group segments', () => {
    const html = renderRangeBreakdownSection(sampleSeg);
    expect(html).toContain('rb-stacked-bar');
    expect(html).toContain('rb-bar-seg');
    expect(html).toContain('Villain Range');
    expect(html).toContain('73 combos');
  });

  it('renders group rows with labels', () => {
    const html = renderRangeBreakdownSection(sampleSeg);
    expect(html).toContain('Top Pair');
    expect(html).toContain('Mid/Low Pair');
    expect(html).toContain('Draws');
    expect(html).toContain('Air');
  });

  it('shows sub-type detail for multi-member groups', () => {
    const html = renderRangeBreakdownSection(sampleSeg);
    expect(html).toContain('TPTK+');
    expect(html).toContain('TP Weak');
    expect(html).toContain('Overpair');
  });

  it('shows draw outs info for draw types', () => {
    const html = renderRangeBreakdownSection(sampleSeg);
    expect(html).toContain('9 outs');
    expect(html).toContain('8 outs');
  });

  it('returns empty for empty handTypes', () => {
    expect(renderRangeBreakdownSection({ handTypes: {}, totalCombos: 0 })).toBe('');
  });

  it('returns empty for null handTypes', () => {
    expect(renderRangeBreakdownSection({ handTypes: null, totalCombos: 0 })).toBe('');
  });

  it('skips groups below 0.5%', () => {
    const html = renderRangeBreakdownSection({
      handTypes: {
        quads: { count: 1, weightSum: 0.1, pct: 0.2, avgDrawOuts: 0 },
        air: { count: 50, weightSum: 50, pct: 99.8, avgDrawOuts: 0 },
      },
      totalCombos: 51,
    });
    expect(html).not.toContain('Premium');
    expect(html).toContain('Air');
  });

  it('closed by default, opens with autoOpen', () => {
    const html = renderRangeBreakdownSection(sampleSeg);
    expect(html).not.toContain('deep-section open');
    expect(html).toContain('deep-section"');
    const htmlOpen = renderRangeBreakdownSection(sampleSeg, { autoOpen: true });
    expect(htmlOpen).toContain('deep-section open');
  });

  it('shows % label on wide bar segments (>=8%)', () => {
    const html = renderRangeBreakdownSection(sampleSeg);
    expect(html).toContain('rb-bar-label');
  });
});

// ==========================================================================
// renderAllRecsSection
// ==========================================================================

describe('renderAllRecsSection', () => {
  it('renders ranked recommendations', () => {
    const recs = [
      { action: 'bet', ev: 5.2, sizing: { betSize: 18, betFraction: 0.75, foldPct: 0.48 }, reasoning: 'Value bet' },
      { action: 'check', ev: 1.4, reasoning: 'Pot control' },
    ];
    const html = renderAllRecsSection(recs);
    expect(html).toContain('BET');
    expect(html).toContain('CHECK');
    expect(html).toContain('+5.2');
    expect(html).toContain('+1.4');
    expect(html).toContain('rec-item best');
    expect(html).toContain('75%');
  });

  it('formats negative EV', () => {
    const html = renderAllRecsSection([{ action: 'fold', ev: -2.5, reasoning: 'Behind' }]);
    expect(html).toContain('-2.5');
    expect(html).toContain('rec-ev neg');
  });

  it('handles missing sizing gracefully', () => {
    const html = renderAllRecsSection([{ action: 'check', ev: 0 }]);
    expect(html).toContain('CHECK');
    expect(html).not.toContain('undefined');
  });
});

// ==========================================================================
// renderStreetTendenciesSection
// ==========================================================================

describe('renderStreetTendenciesSection', () => {
  it('renders per-street tendencies with confidence', () => {
    const html = renderStreetTendenciesSection({
      preflop: { tendency: 'Tight — selective', confidence: 0.85 },
      flop: { tendency: 'Passive — checks often', confidence: 0.60 },
    });
    expect(html).toContain('Pre');
    expect(html).toContain('Tight');
    expect(html).toContain('Flop');
    expect(html).toContain('Passive');
    expect(html).toContain('width:85%');
    expect(html).toContain('width:60%');
  });

  it('skips streets without tendency', () => {
    const html = renderStreetTendenciesSection({
      preflop: { tendency: 'Tight', confidence: 0.5 },
      turn: { confidence: 0.3 },
    });
    expect(html).toContain('Pre');
    expect(html).not.toContain('Turn');
  });

  it('returns empty when no streets have tendencies', () => {
    expect(renderStreetTendenciesSection({})).toBe('');
  });
});

// ==========================================================================
// renderFoldCurveSection
// ==========================================================================

describe('renderFoldCurveSection', () => {
  const curve6pt = {
    curve: [
      { sizing: 0.33, foldPct: 0.30 },
      { sizing: 0.50, foldPct: 0.38 },
      { sizing: 0.75, foldPct: 0.48 },
      { sizing: 1.00, foldPct: 0.52 },
      { sizing: 1.50, foldPct: 0.58 },
      { sizing: 2.00, foldPct: 0.62 },
    ],
    curveSource: 'personalized',
  };

  it('renders SVG with path for 6-point curve', () => {
    const html = renderFoldCurveSection(curve6pt, 0.75);
    expect(html).toContain('<svg');
    expect(html).toContain('<path');
    expect(html).toContain('Personalized');
    expect(html).toContain('33% pot');
    expect(html).toContain('200% pot');
  });

  it('renders bet size marker when currentBetFraction provided', () => {
    const html = renderFoldCurveSection(curve6pt, 0.75);
    expect(html).toContain('<circle');
    expect(html).toContain('fold-curve-marker');
    expect(html).toContain('48%');
  });

  it('omits marker when no currentBetFraction', () => {
    const html = renderFoldCurveSection(curve6pt, null);
    expect(html).not.toContain('<circle');
  });

  it('returns empty for single-point curve', () => {
    expect(renderFoldCurveSection({ curve: [{ sizing: 0.5, foldPct: 0.4 }] })).toBe('');
  });

  it('returns empty for degenerate same min/max', () => {
    expect(renderFoldCurveSection({
      curve: [{ sizing: 0.5, foldPct: 0.4 }, { sizing: 0.5, foldPct: 0.4 }],
    })).toBe('');
  });

  it('returns empty for null/missing curve', () => {
    expect(renderFoldCurveSection({}, null)).toBe('');
    expect(renderFoldCurveSection({ curve: null }, null)).toBe('');
  });

  it('labels style default source', () => {
    const html = renderFoldCurveSection({
      curve: [{ sizing: 0.33, foldPct: 0.3 }, { sizing: 2.0, foldPct: 0.6 }],
      curveSource: 'style',
    });
    expect(html).toContain('Style default');
  });
});

// ==========================================================================
// renderFoldBreakdownSection
// ==========================================================================

describe('renderFoldBreakdownSection', () => {
  it('renders base estimate and adjustments', () => {
    const html = renderFoldBreakdownSection({
      bet: {
        baseEstimate: 0.42,
        source: 'model+observed',
        adjustments: [
          { factor: 'af', multiplier: 1.02 },
          { factor: 'vpip', multiplier: 0.95 },
        ],
      },
    }, { bet: 0.48 });
    expect(html).toContain('42%');
    expect(html).toContain('48%');
    expect(html).toContain('af');
    expect(html).toContain('+2%');
    expect(html).toContain('-5%');
    expect(html).toContain('model+observed');
  });

  it('returns empty when bet meta missing', () => {
    expect(renderFoldBreakdownSection({ raise: {} }, {})).toBe('');
  });

  it('handles empty adjustments', () => {
    const html = renderFoldBreakdownSection({
      bet: { baseEstimate: 0.40, source: 'population', adjustments: [] },
    }, { bet: 0.40 });
    expect(html).toContain('40%');
    expect(html).not.toContain('fold-adj-label');
  });
});

// ==========================================================================
// renderComboStatsSection
// ==========================================================================

describe('renderComboStatsSection', () => {
  it('renders stacked bar with counts', () => {
    const html = renderComboStatsSection({ total: 131, ahead: 67, behind: 52, tied: 12 });
    expect(html).toContain('67');
    expect(html).toContain('52');
    expect(html).toContain('12');
    expect(html).toContain('combo-seg ahead');
    expect(html).toContain('combo-seg behind');
  });

  it('returns empty for zero total', () => {
    expect(renderComboStatsSection({ total: 0, ahead: 0, behind: 0, tied: 0 })).toBe('');
  });

  it('handles missing tied field (defaults to 0)', () => {
    const html = renderComboStatsSection({ total: 100, ahead: 60, behind: 40 });
    expect(html).toContain('60');
    expect(html).toContain('40');
    expect(html).toContain('Tied');
  });

  it('handles all-ahead scenario', () => {
    const html = renderComboStatsSection({ total: 50, ahead: 50, behind: 0, tied: 0 });
    expect(html).toContain('width:100.0%');
    expect(html).toContain('50');
  });
});

// ==========================================================================
// renderModelAuditSection
// ==========================================================================

describe('renderModelAuditSection', () => {
  it('renders all available fields', () => {
    const html = renderModelAuditSection(
      { overallSource: 'player_model' },
      { branches: 4, depthReached: 2, computeMs: 245, comboCounted: true, dynamicAnchors: true, numOpponents: 1 },
      22
    );
    expect(html).toContain('Player model');
    expect(html).toContain('22 observations');
    expect(html).toContain('4 actions');
    expect(html).toContain('245ms');
    expect(html).toContain('Yes (exact)');
    expect(html).toContain('Yes (MC sampled)');
  });

  it('shows opponents only when > 1', () => {
    const html = renderModelAuditSection(null, { numOpponents: 3 }, null);
    expect(html).toContain('3');
    const html2 = renderModelAuditSection(null, { numOpponents: 1 }, null);
    expect(html2).not.toContain('Opponents');
  });

  it('returns empty when all inputs null', () => {
    expect(renderModelAuditSection(null, null, null)).toBe('');
  });

  it('shows population source label', () => {
    const html = renderModelAuditSection({ overallSource: 'population' }, null, null);
    expect(html).toContain('Population');
  });
});

// ==========================================================================
// renderVulnerabilitiesSection
// ==========================================================================

describe('renderVulnerabilitiesSection', () => {
  it('renders vulnerabilities with severity classes', () => {
    const html = renderVulnerabilitiesSection([
      { label: 'Overfolds flop', severity: 0.82, exploitHint: 'c-bet wider' },
      { label: 'Shutdown turn', severity: 0.45 },
      { label: 'Minor leak', severity: 0.2 },
    ]);
    expect(html).toContain('vuln-dot high');
    expect(html).toContain('vuln-dot medium');
    expect(html).toContain('vuln-dot low');
    expect(html).toContain('Overfolds flop');
    expect(html).toContain('c-bet wider');
  });

  it('caps at 5 vulnerabilities', () => {
    const vulns = Array.from({ length: 8 }, (_, i) => ({ label: `V${i}`, severity: 0.5 }));
    const html = renderVulnerabilitiesSection(vulns);
    const matches = html.match(/vuln-callout/g);
    expect(matches).toHaveLength(5);
  });

  it('handles empty exploit hint', () => {
    const html = renderVulnerabilitiesSection([{ label: 'Test', severity: 0.8 }]);
    expect(html).toContain('Test');
    expect(html).not.toContain('undefined');
  });
});
