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

  it('shows hero GTO grid from liveContext when null advice AND no villain data', () => {
    // Fix 4: liveContext.currentStreet='preflop' triggers GTO grid even without advice
    // Needs dealerSeat for position resolution (GTO grid requires valid position)
    const preflopCtx = { ...sampleLiveContext, currentStreet: 'preflop', state: 'PREFLOP', dealerSeat: 3 };
    const html = renderPreflopContent(null, preflopCtx, {}, null);
    expect(html).toContain('range-grid');
  });

  it('shows waiting when null advice AND no position data for GTO grid', () => {
    // Without dealerSeat, GTO grid can't resolve position — falls through to waiting
    const preflopCtx = { ...sampleLiveContext, currentStreet: 'preflop', state: 'PREFLOP' };
    const html = renderPreflopContent(null, preflopCtx, {}, null);
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
    // SR-6.13: 3.12 no-aggressor placeholder replaces the "Waiting for flop"
    // fallback when postflop + no villainRanges. Empty range slot would
    // otherwise violate R-1.3 (fixed slot height).
    const html = renderFlopContent(null, sampleLiveContext, 3);
    expect(html).toContain('No aggression yet');
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

  it('shows equity badge when villain has equity but range is not 169 cells (Fix 5)', () => {
    const partialRange = {
      ...sampleAdvice,
      villainRanges: [{
        seat: 3, active: true, equity: 0.42, rangeWidth: 35,
        range: new Array(100).fill(0.5), // not 169
      }],
    };
    const html = renderFlopContent(partialRange, sampleLiveContext, 3);
    expect(html).toContain('42%');
    expect(html).toContain('S3 equity');
  });

  it('shows full range grid when range has exactly 169 cells', () => {
    const fullRange = {
      ...sampleAdvice,
      villainRanges: [{
        seat: 3, active: true, equity: 0.58, rangeWidth: 40, position: 'CO',
        range: new Array(169).fill(0.5),
      }],
    };
    const html = renderFlopContent(fullRange, sampleLiveContext, 3);
    expect(html).toContain('range-grid');
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
    // SR-6.13: 3.12 placeholder (see renderFlopContent null-advice test).
    const html = renderTurnContent(null, sampleLiveContext, 3);
    expect(html).toContain('No aggression yet');
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
    // SR-6.13: 3.12 placeholder (see renderFlopContent null-advice test).
    const html = renderRiverContent(null, sampleLiveContext, 3);
    expect(html).toContain('No aggression yet');
  });
});

// ==========================================================================
// renderVillainRangeSection (tested indirectly via unified street content)
// The legacy wrappers all call renderUnifiedStreetContent, which calls
// renderVillainRangeSection as Section 1 on every street.
// ==========================================================================

describe('renderVillainRangeSection — dynamic Bayesian ranges', () => {
  const makeRange169 = (fill = 0.5) => new Array(169).fill(fill);

  const adviceWithRanges = (overrides = {}) => ({
    ...sampleAdvice,
    villainRanges: [
      {
        seat: 3,
        position: 'CO',
        actionKey: 'open',
        range: makeRange169(0.4),
        equity: 0.58,
        rangeWidth: 22,
        active: true,
      },
    ],
    ...overrides,
  });

  it('renders heat-map grid when villainRanges with 169-element range provided', () => {
    const html = renderFlopContent(adviceWithRanges(), sampleLiveContext, 3);
    expect(html).toContain('range-grid-wrap');
    expect(html).toContain('rg-heat');
  });

  it('renders label from seat/position/actionKey in grid header', () => {
    const html = renderFlopContent(adviceWithRanges(), sampleLiveContext, 3);
    expect(html).toContain('S3');
    expect(html).toContain('CO');
    expect(html).toContain('Open');
  });

  it('renders equity badge from focused villain equity', () => {
    const html = renderFlopContent(adviceWithRanges(), sampleLiveContext, 3);
    expect(html).toContain('58% eq');
  });

  it('uses rangeWidth from villainRange entry in header', () => {
    const html = renderFlopContent(adviceWithRanges(), sampleLiveContext, 3);
    expect(html).toContain('22%');
  });

  it('focuses the villain matching focusedVillain seat', () => {
    const ranges = [
      { seat: 2, position: 'UTG', actionKey: 'open', range: makeRange169(0.3), equity: 0.40, rangeWidth: 15, active: true },
      { seat: 3, position: 'CO',  actionKey: 'open', range: makeRange169(0.6), equity: 0.65, rangeWidth: 30, active: true },
    ];
    const advice = { ...sampleAdvice, villainRanges: ranges };
    // focusedVillain = seat 2
    const html = renderFlopContent(advice, sampleLiveContext, 2);
    expect(html).toContain('40% eq'); // seat 2 equity
    expect(html).not.toContain('65% eq');
  });

  it('falls back to advice.villainSeat when focusedVillain is null', () => {
    const ranges = [
      { seat: 3, position: 'CO', actionKey: 'open', range: makeRange169(0.5), equity: 0.55, rangeWidth: 22, active: true },
      { seat: 5, position: 'BTN', actionKey: 'open', range: makeRange169(0.7), equity: 0.72, rangeWidth: 45, active: true },
    ];
    const advice = { ...sampleAdvice, villainSeat: 3, villainRanges: ranges };
    const html = renderFlopContent(advice, sampleLiveContext, null);
    expect(html).toContain('55% eq'); // villainSeat=3
  });

  it('renders villain tab pills for multiway (>1 range)', () => {
    const ranges = [
      { seat: 2, position: 'UTG', actionKey: 'open', range: makeRange169(0.3), equity: 0.40, rangeWidth: 15, active: true },
      { seat: 3, position: 'CO',  actionKey: 'open', range: makeRange169(0.5), equity: 0.60, rangeWidth: 22, active: true },
    ];
    const advice = { ...sampleAdvice, villainRanges: ranges };
    const html = renderFlopContent(advice, sampleLiveContext, 3);
    expect(html).toContain('villain-range-tabs');
    expect(html).toContain('villain-tab');
    expect(html).toContain('data-range-seat="2"');
    expect(html).toContain('data-range-seat="3"');
  });

  it('active tab pill has "active" class for focused villain', () => {
    const ranges = [
      { seat: 2, position: 'UTG', actionKey: 'open', range: makeRange169(0.3), equity: 0.40, rangeWidth: 15, active: true },
      { seat: 3, position: 'CO',  actionKey: 'open', range: makeRange169(0.5), equity: 0.60, rangeWidth: 22, active: true },
    ];
    const advice = { ...sampleAdvice, villainRanges: ranges };
    const html = renderFlopContent(advice, sampleLiveContext, 3);
    expect(html).toContain('villain-tab active');
  });

  // SR-6.16: strict Rule V — `.active` follows the displayed range seat
  // (focusedVillain). Advice villain that isn't focused gets `.advice-match`
  // instead of `.active` — the highlight no longer lies about which seat's
  // range is on screen when the user pinned a different seat.
  it('only the focused seat gets "active"; advice villain gets "advice-match" when different', () => {
    const ranges = [
      { seat: 2, position: 'UTG', actionKey: 'open', range: makeRange169(0.3), equity: 0.40, rangeWidth: 15, active: true },
      { seat: 3, position: 'CO',  actionKey: 'open', range: makeRange169(0.5), equity: 0.60, rangeWidth: 22, active: true },
    ];
    // advice.villainSeat=3 but user-focused seat=2 (e.g. pill click)
    const advice = { ...sampleAdvice, villainSeat: 3, villainRanges: ranges };
    const html = renderFlopContent(advice, sampleLiveContext, 2);
    // seat 2 is the sole `.active`
    expect(html).toMatch(/villain-tab active[^>]*data-range-seat="2"/);
    // seat 3 is NOT `.active` — that would lie about which range is displayed
    expect(html).not.toMatch(/villain-tab active[^>]*data-range-seat="3"/);
    // seat 3 gets `.advice-match` as a subtle second-tier signal
    expect(html).toMatch(/villain-tab advice-match[^>]*data-range-seat="3"/);
  });

  it('does not emit "advice-match" when focused seat equals advice villain seat', () => {
    const ranges = [
      { seat: 2, position: 'UTG', actionKey: 'open', range: makeRange169(0.3), equity: 0.40, rangeWidth: 15, active: true },
      { seat: 3, position: 'CO',  actionKey: 'open', range: makeRange169(0.5), equity: 0.60, rangeWidth: 22, active: true },
    ];
    const advice = { ...sampleAdvice, villainSeat: 3, villainRanges: ranges };
    const html = renderFlopContent(advice, sampleLiveContext, 3);
    // seat 3 is active, not both
    expect(html).toMatch(/villain-tab active[^>]*data-range-seat="3"/);
    expect(html).not.toContain('advice-match');
  });

  it('does not render tab pills for single villain (heads-up)', () => {
    const html = renderFlopContent(adviceWithRanges(), sampleLiveContext, 3);
    expect(html).not.toContain('villain-range-tabs');
  });

  it('shows multiway equity badge when multiwayEquity present', () => {
    const ranges = [
      { seat: 2, position: 'UTG', actionKey: 'open', range: makeRange169(0.3), equity: 0.40, rangeWidth: 15, active: true },
      { seat: 3, position: 'CO',  actionKey: 'open', range: makeRange169(0.5), equity: 0.60, rangeWidth: 22, active: true },
    ];
    const advice = {
      ...sampleAdvice,
      villainRanges: ranges,
      multiwayEquity: { equity: 0.44 },
    };
    const html = renderFlopContent(advice, sampleLiveContext, 3);
    expect(html).toContain('vs All');
    expect(html).toContain('44%');
  });

  it('omits inactive villain seats from tab pills', () => {
    const ranges = [
      { seat: 2, position: 'UTG', actionKey: 'open', range: makeRange169(0.3), equity: 0.40, rangeWidth: 15, active: false },
      { seat: 3, position: 'CO',  actionKey: 'open', range: makeRange169(0.5), equity: 0.60, rangeWidth: 22, active: true },
    ];
    const advice = { ...sampleAdvice, villainRanges: ranges };
    const html = renderFlopContent(advice, sampleLiveContext, 3);
    // Seat 2 was folded/inactive — no pill for it
    expect(html).not.toContain('data-range-seat="2"');
    expect(html).toContain('data-range-seat="3"');
  });

  it('shows equity in tab pill label', () => {
    const ranges = [
      { seat: 3, position: 'CO', actionKey: 'open', range: makeRange169(0.5), equity: 0.58, rangeWidth: 22, active: true },
      { seat: 4, position: 'BTN', actionKey: 'call', range: makeRange169(0.4), equity: 0.42, rangeWidth: 18, active: true },
    ];
    const advice = { ...sampleAdvice, villainRanges: ranges };
    const html = renderFlopContent(advice, sampleLiveContext, 3);
    expect(html).toContain('S3 58%');
    expect(html).toContain('S4 42%');
  });
});

describe('renderVillainRangeSection — static GTO fallback', () => {
  it('falls back to static GTO grid on preflop when no villainRanges', () => {
    const adviceNoRanges = { ...sampleAdvice, currentStreet: 'preflop', villainRanges: undefined };
    // SR-6.13: liveContext is authoritative for effective street (was using
    // flop-default sampleLiveContext which now correctly renders 3.12).
    const liveCtx = { ...sampleLiveContext, currentStreet: 'preflop', state: 'PREFLOP', heroSeat: 5, dealerSeat: 3 };
    const html = renderPreflopContent(adviceNoRanges, liveCtx, sampleAppSeatData, 3);
    expect(html).toContain('GTO');
  });

  it('returns no range section on postflop when no villainRanges', () => {
    // SR-6.13: postflop + empty villainRanges now renders the 3.12
    // no-aggressor placeholder (R-1.3 fixed-height slot) — not the empty
    // string it used to return. The 13×13 range-grid canvas is still absent.
    const adviceNoRanges = { ...sampleAdvice, currentStreet: 'flop', villainRanges: undefined };
    const html = renderFlopContent(adviceNoRanges, sampleLiveContext, 3);
    expect(html).toContain('range-slot-placeholder');
    expect(html).not.toContain('class="range-grid"');
  });

  it('falls back to static GTO grid when villainRanges is empty array', () => {
    const adviceEmptyRanges = { ...sampleAdvice, currentStreet: 'preflop', villainRanges: [] };
    const liveCtx = { ...sampleLiveContext, currentStreet: 'preflop', state: 'PREFLOP', heroSeat: 5, dealerSeat: 3 };
    const html = renderPreflopContent(adviceEmptyRanges, liveCtx, sampleAppSeatData, 3);
    expect(html).toContain('GTO');
  });

  it('passes situation to static grid for facing_raise adjustment', () => {
    const adviceNoRanges = {
      ...sampleAdvice,
      currentStreet: 'preflop',
      villainRanges: undefined,
      situation: 'facing_raise',
    };
    const liveCtx = { ...sampleLiveContext, currentStreet: 'preflop', state: 'PREFLOP', heroSeat: 5, dealerSeat: 3 };
    const html = renderPreflopContent(adviceNoRanges, liveCtx, sampleAppSeatData, 3);
    expect(html).toContain('was');
  });
});
