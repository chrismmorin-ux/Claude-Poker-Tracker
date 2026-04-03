import { describe, it, expect } from 'vitest';
import {
  _renderPreflopContent as renderPreflopContent,
  _renderFlopContent as renderFlopContent,
  _renderTurnContent as renderTurnContent,
  _renderRiverContent as renderRiverContent,
  _renderBetweenHandsContent as renderBetweenHandsContent,
} from '../render-street-card.js';

// ==========================================================================
// Sample test data
// ==========================================================================

const sampleAdvice = {
  currentStreet: 'flop',
  villainSeat: 3,
  villainStyle: 'Fish',
  villainSampleSize: 25,
  potSize: 12.5,
  heroEquity: 0.65,
  foldPct: { bet: 0.42 },
  foldMeta: {
    curve: [
      { sizing: 0.33, foldPct: 0.25 },
      { sizing: 0.5, foldPct: 0.35 },
      { sizing: 0.75, foldPct: 0.45 },
      { sizing: 1.0, foldPct: 0.55 },
      { sizing: 1.5, foldPct: 0.65 },
      { sizing: 2.0, foldPct: 0.72 },
    ],
  },
  recommendations: [{
    action: 'bet',
    ev: 2.3,
    sizing: { betFraction: 0.75, betSize: 9.4, foldPct: 0.45 },
    reasoning: 'Value bet — top pair good kicker vs wide calling range',
    handPlan: {
      ifCall: { note: 'Barrel turn on safe cards', favorableRunouts: 30, totalRunouts: 47 },
      ifRaise: { note: 'Fold — likely strong hand' },
    },
  }],
  treeMetadata: {
    depthReached: 2,
    spr: 4.2,
    blockerEffects: { nutFlush: -0.12, air: -0.05 },
    advantage: { rangeAdvantage: 0.15 },
  },
  villainProfile: {
    headline: 'Loose passive — calls too wide, folds to aggression',
    vulnerabilities: [
      { label: 'Folds too often on turn', severity: 0.8, exploitHint: 'Barrel turn after flop call' },
    ],
  },
  segmentation: {
    handTypes: {
      topPairGood: { count: 10, pct: 15 },
      middlePair: { count: 8, pct: 12 },
      nutFlushDraw: { count: 5, pct: 7 },
      air: { count: 30, pct: 45 },
    },
    totalCombos: 66,
  },
};

const sampleLiveContext = {
  currentStreet: 'flop',
  state: 'FLOP',
  heroSeat: 5,
  communityCards: ['A\u2660', 'K\u2665', '7\u2663', '', ''],
  holeCards: ['Q\u2660', 'J\u2660'],
  pot: 12.5,
  foldedSeats: [1, 8],
  activeSeatNumbers: [2, 3, 5],
};

const sampleAppSeatData = {
  2: { style: 'TAG', sampleSize: 40, villainHeadline: 'Tight aggressive regular', villainProfile: { streets: { preflop: { tendency: 'Selective opener' } } } },
  3: { style: 'Fish', sampleSize: 25, villainHeadline: 'Loose passive calls too wide', villainProfile: { streets: { preflop: { tendency: 'Limps frequently' } } }, stats: { cbet: 65, foldToCbet: 35 } },
  7: { style: 'Nit', sampleSize: 15, villainHeadline: 'Very tight only plays premiums' },
};

// ==========================================================================
// Between Hands
// ==========================================================================

describe('renderBetweenHandsContent', () => {
  it('renders villain scouting rows', () => {
    const html = renderBetweenHandsContent(sampleAppSeatData, null, null, { heroSeat: 5 });
    expect(html).toContain('Table Reads');
    expect(html).toContain('S2');
    expect(html).toContain('TAG');
    expect(html).toContain('Tight aggressive regular');
    expect(html).toContain('S3');
    expect(html).toContain('Fish');
  });

  it('renders waiting message when no data', () => {
    const html = renderBetweenHandsContent({}, null, null, null);
    expect(html).toContain('Waiting for next hand');
  });

  it('does not render tournament inline (slim bar handles it)', () => {
    const tournament = {
      heroMRatio: 15.2,
      playersRemaining: 45,
      totalEntrants: 120,
      currentBlinds: { sb: 100, bb: 200, ante: 25 },
    };
    const html = renderBetweenHandsContent({}, null, tournament, null);
    // Tournament info is shown in the slim tournament bar, not in the street card
    expect(html).not.toContain('Tournament');
  });

  it('highlights focused villain', () => {
    const html = renderBetweenHandsContent(sampleAppSeatData, 3, null, { heroSeat: 5 });
    // Focused villain row gets gold-tinted background
    expect(html).toContain('data-scout-seat="3"');
    expect(html).toContain('rgba(212,168,71');
  });

  it('escapes HTML in villain headlines', () => {
    const xssData = { 3: { style: 'Fish', sampleSize: 10, villainHeadline: '<script>alert("xss")</script>' } };
    const html = renderBetweenHandsContent(xssData, null, null, { heroSeat: 5 });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('skips hero seat in scouting', () => {
    const data = { 5: { style: 'Hero', sampleSize: 100, villainHeadline: 'Me' } };
    const html = renderBetweenHandsContent(data, null, null, { heroSeat: 5 });
    expect(html).not.toContain('S5');
  });
});

// ==========================================================================
// Preflop
// ==========================================================================

describe('renderPreflopContent', () => {
  it('renders hand plan tree', () => {
    const html = renderPreflopContent(sampleAdvice, sampleLiveContext, sampleAppSeatData, 3);
    expect(html).toContain('Hand Plan');
    expect(html).toContain('CALL');
    expect(html).toContain('Barrel turn on safe cards');
    expect(html).toContain('RAISE');
    expect(html).toContain('Fold');
  });

  it('renders reasoning note', () => {
    const html = renderPreflopContent(sampleAdvice, sampleLiveContext, sampleAppSeatData, 3);
    expect(html).toContain('Value bet');
  });

  it('renders blocker insight when significant', () => {
    const html = renderPreflopContent(sampleAdvice, sampleLiveContext, sampleAppSeatData, 3);
    expect(html).toContain('blocks S3');
    expect(html).toContain('nutFlush');
    expect(html).toContain('12%');
  });

  it('renders flop archetype breakdown', () => {
    const adviceWithFlop = {
      ...sampleAdvice,
      flopBreakdown: [
        { archetype: 'top_pair', probability: 0.18 },
        { archetype: 'miss', probability: 0.55 },
        { archetype: 'set', probability: 0.02 },
      ],
    };
    const html = renderPreflopContent(adviceWithFlop, sampleLiveContext, sampleAppSeatData, 3);
    expect(html).toContain('Flop Outcome');
    expect(html).toContain('top pair');
    expect(html).toContain('18%');
    expect(html).toContain('55%');
    // 2% should be filtered out (< 1% after rounding)
    expect(html).toContain('set');
  });

  it('renders villain preflop tendencies for focused villain', () => {
    const html = renderPreflopContent(sampleAdvice, sampleLiveContext, sampleAppSeatData, 3);
    expect(html).toContain('Villain Preflop');
    expect(html).toContain('Limps frequently');
    expect(html).toContain('C-Bet');
    expect(html).toContain('65%');
  });

  it('renders top vulnerability', () => {
    const html = renderPreflopContent(sampleAdvice, sampleLiveContext, sampleAppSeatData, 3);
    expect(html).toContain('Folds too often on turn');
    expect(html).toContain('Barrel turn after flop call');
  });

  it('handles null advice — still shows villain stats from appSeatData', () => {
    const html = renderPreflopContent(null, sampleLiveContext, sampleAppSeatData, 3);
    // With focused villain data available, shows preflop tendencies even without advice
    expect(html).toContain('Villain Preflop');
    expect(html).toContain('Limps frequently');
  });

  it('shows waiting when null advice AND no villain data', () => {
    const html = renderPreflopContent(null, sampleLiveContext, {}, null);
    expect(html).toContain('Waiting for action data');
  });

  it('renders runout bar with favorable/total', () => {
    const html = renderPreflopContent(sampleAdvice, sampleLiveContext, sampleAppSeatData, 3);
    expect(html).toContain('30/47');
    expect(html).toContain('runout-fill');
  });
});

// ==========================================================================
// Flop
// ==========================================================================

describe('renderFlopContent', () => {
  it('renders fold % with mini curve', () => {
    const html = renderFlopContent(sampleAdvice, sampleLiveContext, 3);
    expect(html).toContain('S3 Fold %');
    expect(html).toContain('42%');
    expect(html).toContain('fold-curve-mini');
    expect(html).toContain('<svg');
  });

  it('renders range advantage bar', () => {
    const html = renderFlopContent(sampleAdvice, sampleLiveContext, 3);
    expect(html).toContain('Range vs S3');
    expect(html).toContain('Hero');
    // 0.15 range advantage -> hero ~57%
    expect(html).toContain('57%');
  });

  it('does not render inline range breakdown (deep expander handles it)', () => {
    const html = renderFlopContent(sampleAdvice, sampleLiveContext, 3);
    // Range breakdown lives in deep expander only — not duplicated in street card
    expect(html).not.toContain('rb-stacked-bar');
  });

  it('renders top vulnerability', () => {
    const html = renderFlopContent(sampleAdvice, sampleLiveContext, 3);
    expect(html).toContain('Folds too often on turn');
  });

  it('renders hand plan', () => {
    const html = renderFlopContent(sampleAdvice, sampleLiveContext, 3);
    expect(html).toContain('Hand Plan');
    expect(html).toContain('CALL');
  });

  it('handles null advice', () => {
    const html = renderFlopContent(null, sampleLiveContext, 3);
    expect(html).toContain('Waiting for flop');
  });

  it('handles missing fold data', () => {
    const noFold = { ...sampleAdvice, foldPct: null, foldMeta: null };
    const html = renderFlopContent(noFold, sampleLiveContext, 3);
    expect(html).not.toContain('fold-curve-mini');
  });

  it('handles missing segmentation', () => {
    const noSeg = { ...sampleAdvice, segmentation: null };
    const html = renderFlopContent(noSeg, sampleLiveContext, 3);
    expect(html).not.toContain('S3 Range');
  });
});

// ==========================================================================
// Turn
// ==========================================================================

describe('renderTurnContent', () => {
  it('renders fold % (range in deep expander)', () => {
    const html = renderTurnContent(sampleAdvice, sampleLiveContext, 3);
    expect(html).toContain('S3 Fold %');
    // Range breakdown lives in deep expander only
    expect(html).not.toContain('rb-stacked-bar');
  });

  it('renders hand plan for barrel decision', () => {
    const html = renderTurnContent(sampleAdvice, sampleLiveContext, 3);
    expect(html).toContain('Hand Plan');
  });

  it('handles null advice', () => {
    const html = renderTurnContent(null, sampleLiveContext, 3);
    expect(html).toContain('Waiting for turn');
  });
});

// ==========================================================================
// River
// ==========================================================================

describe('renderRiverContent', () => {
  it('renders multi-sizing fold table from curve', () => {
    const html = renderRiverContent(sampleAdvice, sampleLiveContext, 3);
    expect(html).toContain('Fold % by Sizing');
    expect(html).toContain('33% pot');
    expect(html).toContain('50% pot');
    expect(html).toContain('75% pot');
    expect(html).toContain('100% pot');
    expect(html).toContain('150% pot');
    expect(html).toContain('200% pot');
  });

  it('falls back to single fold % without curve', () => {
    const noCurve = { ...sampleAdvice, foldMeta: { curve: null } };
    const html = renderRiverContent(noCurve, sampleLiveContext, 3);
    expect(html).not.toContain('Fold % by Sizing');
    expect(html).toContain('S3 Fold %');
  });

  it('does not render inline range breakdown', () => {
    const html = renderRiverContent(sampleAdvice, sampleLiveContext, 3);
    // Range breakdown lives in deep expander only
    expect(html).not.toContain('rb-stacked-bar');
  });

  it('handles null advice', () => {
    const html = renderRiverContent(null, sampleLiveContext, 3);
    expect(html).toContain('Waiting for river');
  });
});
