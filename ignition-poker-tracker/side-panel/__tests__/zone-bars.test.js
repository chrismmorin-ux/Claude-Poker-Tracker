/**
 * zone-bars.test.js — Tests for Zone 1 (Action Bar) + Zone 2 (Context Strip)
 * + Cards Strip render functions.
 *
 * These are the new sidebar redesign zones (Session 2). Tests are in a
 * separate file to avoid touching the 133 existing render-orchestrator tests.
 */

import { describe, it, expect } from 'vitest';
import {
  buildActionBarHTML,
  buildContextStripHTML,
  buildCardsStripHTML,
  buildPlanPanelHTML,
  classifyDecisionState,
  DECISION_STATES,
  classifyBetweenHandsMode,
  buildBetweenHandsHTML,
  formatBetFraction,
} from '../render-orchestrator.js';
import {
  ALL_FIXTURES,
  flopWithAdvice,
  preflopNoAdvice,
  preflopWithAdvice,
  turnBarrel,
  mixedSpot,
  heroFolded,
  betweenHands,
  aggFacingCheck,
  callerFirstToAct,
  preflopContested,
  heroFoldedProfitable,
} from './fixtures.js';

// =========================================================================
// formatBetFraction
// =========================================================================

describe('formatBetFraction', () => {
  it('maps common fractions to human labels', () => {
    expect(formatBetFraction(0.33)).toBe('1/3 pot');
    expect(formatBetFraction(0.50)).toBe('1/2 pot');
    expect(formatBetFraction(0.67)).toBe('2/3 pot');
    expect(formatBetFraction(0.75)).toBe('3/4 pot');
    expect(formatBetFraction(1.00)).toBe('pot');
  });

  it('falls back to percentage for unusual values', () => {
    expect(formatBetFraction(0.40)).toBe('40%');
    expect(formatBetFraction(1.50)).toBe('150%');
  });

  it('handles null/undefined', () => {
    expect(formatBetFraction(null)).toBe('');
    expect(formatBetFraction(undefined)).toBe('');
  });
});

// =========================================================================
// buildActionBarHTML
// =========================================================================

describe('buildActionBarHTML', () => {
  it('renders standard bet with sizing and EV', () => {
    const { html, className } = buildActionBarHTML(
      turnBarrel.lastGoodAdvice,
      turnBarrel.currentLiveContext
    );
    expect(className).toContain('has-advice');
    expect(className).toContain('bet');
    expect(html).toContain('BET');
    expect(html).toContain('2/3 pot');
    expect(html).toContain('($16)');
    expect(html).toContain('+4.2 edge');
    expect(html).toContain('ab-action-word');
  });

  it('renders call action without sizing', () => {
    const { html, className } = buildActionBarHTML(
      flopWithAdvice.lastGoodAdvice,
      flopWithAdvice.currentLiveContext
    );
    expect(className).toContain('call');
    expect(html).toContain('CALL');
    expect(html).not.toContain('ab-sizing-frac');
    expect(html).toContain('+1.8 edge');
  });

  it('shows villain fold% when villainResponse present', () => {
    const { html } = buildActionBarHTML(
      flopWithAdvice.lastGoodAdvice,
      flopWithAdvice.currentLiveContext
    );
    expect(html).toContain('35% villain folds');
  });

  it('shows equity fallback when no villainResponse', () => {
    const adviceNoVR = {
      ...preflopWithAdvice.lastGoodAdvice,
      heroEquity: 0.42,
      recommendations: [{ ...preflopWithAdvice.lastGoodAdvice.recommendations[0] }],
    };
    // Ensure no villainResponse
    delete adviceNoVR.recommendations[0].villainResponse;
    const { html } = buildActionBarHTML(adviceNoVR, preflopWithAdvice.currentLiveContext);
    expect(html).toContain('42% equity');
  });

  it('renders risk badge L/M/H', () => {
    const { html: htmlM } = buildActionBarHTML(
      flopWithAdvice.lastGoodAdvice,
      flopWithAdvice.currentLiveContext
    );
    expect(htmlM).toContain('ab-risk-badge m');
    expect(htmlM).toContain('>M<');

    const { html: htmlL } = buildActionBarHTML(
      turnBarrel.lastGoodAdvice,
      turnBarrel.currentLiveContext
    );
    expect(htmlL).toContain('ab-risk-badge l');
    expect(htmlL).toContain('>L<');
  });

  it('omits risk badge when rec.risk is null', () => {
    const adviceNoRisk = {
      ...preflopWithAdvice.lastGoodAdvice,
      recommendations: [{ ...preflopWithAdvice.lastGoodAdvice.recommendations[0] }],
    };
    delete adviceNoRisk.recommendations[0].risk;
    const { html } = buildActionBarHTML(adviceNoRisk, preflopWithAdvice.currentLiveContext);
    expect(html).not.toContain('ab-risk-badge');
  });

  it('renders mixed spot with frequencies', () => {
    const { html, className } = buildActionBarHTML(
      mixedSpot.lastGoodAdvice,
      mixedSpot.currentLiveContext
    );
    expect(className).toContain('is-mixed');
    expect(html).toContain('BET');
    expect(html).toContain('CHECK');
    expect(html).toContain('60%');
    expect(html).toContain('40%');
    expect(html).toContain('ab-mix-row');
  });

  it('renders waiting state when no advice and no live context', () => {
    const { html, className } = buildActionBarHTML(null, null);
    expect(className).toContain('is-waiting');
    expect(html).toContain('Waiting for next deal');
  });

  it('renders analyzing state when live but no advice', () => {
    const { html, className } = buildActionBarHTML(
      null,
      preflopNoAdvice.currentLiveContext
    );
    expect(className).toBe('action-bar');
    expect(html).toContain('Analyzing');
  });

  it('handles null ev without crashing', () => {
    const adviceNullEv = {
      recommendations: [{ action: 'check', ev: null }],
    };
    const { html } = buildActionBarHTML(adviceNullEv, { state: 'FLOP' });
    expect(html).toContain('0.0 edge');
  });

  it('handles null sizing without crashing', () => {
    const adviceNoSizing = {
      recommendations: [{ action: 'fold', ev: -0.5, sizing: null }],
    };
    const { html } = buildActionBarHTML(adviceNoSizing, { state: 'FLOP' });
    expect(html).toContain('FOLD');
    expect(html).not.toContain('ab-sizing-frac');
  });

  // Null safety across all fixtures
  it.each(Object.entries(ALL_FIXTURES))('%s — no crash, no "undefined"/"null" text', (name, fixture) => {
    const { html } = buildActionBarHTML(
      fixture.lastGoodAdvice,
      fixture.currentLiveContext,
      { appSeatData: fixture.appSeatData || {} }
    );
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('>null<');
  });
});

// =========================================================================
// buildContextStripHTML
// =========================================================================

describe('buildContextStripHTML', () => {
  it('shows equity as percentage', () => {
    const { html } = buildContextStripHTML(
      flopWithAdvice.lastGoodAdvice,
      flopWithAdvice.currentLiveContext
    );
    expect(html).toContain('Equity:');
    expect(html).toContain('58%');
  });

  it('shows SPR when not facing a bet', () => {
    const { html } = buildContextStripHTML(
      turnBarrel.lastGoodAdvice,
      turnBarrel.currentLiveContext
    );
    expect(html).toContain('SPR:');
    expect(html).toContain('2.8');
  });

  it('shows pot odds when facing a raise', () => {
    const { html } = buildContextStripHTML(
      preflopWithAdvice.lastGoodAdvice,
      preflopWithAdvice.currentLiveContext
    );
    // situation: 'facing_raise', last action amount is 6, pot is 5
    expect(html).toContain('Pot odds:');
  });

  it('shows model sample size', () => {
    const { html } = buildContextStripHTML(
      flopWithAdvice.lastGoodAdvice,
      flopWithAdvice.currentLiveContext
    );
    expect(html).toContain('Model:');
    expect(html).toContain('45h');
  });

  it('renders villain response line when villainResponse present', () => {
    const { html } = buildContextStripHTML(
      flopWithAdvice.lastGoodAdvice,
      flopWithAdvice.currentLiveContext
    );
    expect(html).toContain('cs-row2');
    expect(html).toContain('Folds 35%');
    expect(html).toContain('Calls 55%');
    expect(html).toContain('Raises 10%');
  });

  it('omits response row when villainResponse absent', () => {
    const adviceNoVR = {
      ...preflopWithAdvice.lastGoodAdvice,
      recommendations: [{ ...preflopWithAdvice.lastGoodAdvice.recommendations[0] }],
    };
    delete adviceNoVR.recommendations[0].villainResponse;
    const { html } = buildContextStripHTML(adviceNoVR, preflopWithAdvice.currentLiveContext);
    expect(html).not.toContain('cs-row2');
  });

  it('returns empty html when advice is null', () => {
    const { html, className } = buildContextStripHTML(null, null);
    expect(html).toBe('');
    expect(className).toBe('context-strip');
  });

  // Null safety across all fixtures
  it.each(Object.entries(ALL_FIXTURES))('%s — no crash, no "undefined"/"null" text', (name, fixture) => {
    const { html } = buildContextStripHTML(
      fixture.lastGoodAdvice,
      fixture.currentLiveContext
    );
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('>null<');
  });
});

// =========================================================================
// buildCardsStripHTML
// =========================================================================

describe('buildCardsStripHTML', () => {
  it('renders board cards on flop', () => {
    const { html } = buildCardsStripHTML(
      flopWithAdvice.lastGoodAdvice,
      flopWithAdvice.currentLiveContext
    );
    expect(html).toContain('Board');
    expect(html).toContain('card-group');
    expect(html).toContain('mini-card');
  });

  it('renders hero cards', () => {
    const { html } = buildCardsStripHTML(
      flopWithAdvice.lastGoodAdvice,
      flopWithAdvice.currentLiveContext
    );
    expect(html).toContain('hero-card');
  });

  it('shows Observing label when hero folded', () => {
    const { html } = buildCardsStripHTML(
      heroFolded.lastGoodAdvice,
      heroFolded.currentLiveContext,
      { currentTableState: heroFolded.currentTableState }
    );
    expect(html).toContain('Observing');
  });

  it('returns empty html when no cards', () => {
    const { html } = buildCardsStripHTML(null, null);
    expect(html).toBe('');
  });

  it('shows pot amount', () => {
    const { html } = buildCardsStripHTML(
      flopWithAdvice.lastGoodAdvice,
      flopWithAdvice.currentLiveContext
    );
    expect(html).toContain('pot-inline');
    expect(html).toContain('$19'); // potSize 18.5 rounds to 19
  });

  // Null safety across all fixtures
  it.each(Object.entries(ALL_FIXTURES))('%s — no crash, no "undefined"/"null" text', (name, fixture) => {
    const { html } = buildCardsStripHTML(
      fixture.lastGoodAdvice,
      fixture.currentLiveContext,
      {
        currentTableState: fixture.currentTableState,
        currentLiveContext: fixture.currentLiveContext,
      }
    );
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('>null<');
  });
});

// =========================================================================
// classifyDecisionState
// =========================================================================

describe('classifyDecisionState', () => {
  it('returns AGGRESSOR_FIRST_TO_ACT as default when no liveContext', () => {
    expect(classifyDecisionState(null, null)).toBe(DECISION_STATES.AGGRESSOR_FIRST_TO_ACT);
  });

  it('classifies preflopWithAdvice as PREFLOP_STANDARD (1 raise)', () => {
    expect(classifyDecisionState(
      preflopWithAdvice.lastGoodAdvice,
      preflopWithAdvice.currentLiveContext
    )).toBe(DECISION_STATES.PREFLOP_STANDARD);
  });

  it('classifies preflopContested as PREFLOP_CONTESTED (2 raises)', () => {
    expect(classifyDecisionState(
      preflopContested.lastGoodAdvice,
      preflopContested.currentLiveContext
    )).toBe(DECISION_STATES.PREFLOP_CONTESTED);
  });

  it('classifies turnBarrel as AGGRESSOR_FIRST_TO_ACT (hero is PFA, no villain action on turn)', () => {
    expect(classifyDecisionState(
      turnBarrel.lastGoodAdvice,
      turnBarrel.currentLiveContext
    )).toBe(DECISION_STATES.AGGRESSOR_FIRST_TO_ACT);
  });

  it('classifies aggFacingCheck as AGGRESSOR_FACING_CHECK (villain checked)', () => {
    expect(classifyDecisionState(
      aggFacingCheck.lastGoodAdvice,
      aggFacingCheck.currentLiveContext
    )).toBe(DECISION_STATES.AGGRESSOR_FACING_CHECK);
  });

  it('classifies flopWithAdvice as CALLER_FACING_BET (villain bet on flop)', () => {
    expect(classifyDecisionState(
      flopWithAdvice.lastGoodAdvice,
      flopWithAdvice.currentLiveContext
    )).toBe(DECISION_STATES.CALLER_FACING_BET);
  });

  it('classifies callerFirstToAct as CALLER_FIRST_TO_ACT (villain is PFA, no bet yet)', () => {
    expect(classifyDecisionState(
      callerFirstToAct.lastGoodAdvice,
      callerFirstToAct.currentLiveContext
    )).toBe(DECISION_STATES.CALLER_FIRST_TO_ACT);
  });

  it('handles empty actionSequence on postflop', () => {
    const ctx = { state: 'FLOP', currentStreet: 'flop', heroSeat: 5, pfAggressor: 3, actionSequence: [] };
    expect(classifyDecisionState(null, ctx)).toBe(DECISION_STATES.CALLER_FIRST_TO_ACT);
  });

  it('detects prior-street aggressor (hero raised on flop, now on turn)', () => {
    const ctx = {
      state: 'TURN', currentStreet: 'turn', heroSeat: 5, pfAggressor: 3,
      actionSequence: [
        { seat: 3, action: 'raise', amount: 6, street: 'preflop', order: 1 },
        { seat: 5, action: 'call', amount: 6, street: 'preflop', order: 2 },
        { seat: 5, action: 'bet', amount: 8, street: 'flop', order: 3 },
        { seat: 3, action: 'call', amount: 8, street: 'flop', order: 4 },
      ],
    };
    expect(classifyDecisionState(null, ctx)).toBe(DECISION_STATES.AGGRESSOR_FIRST_TO_ACT);
  });
});

// =========================================================================
// buildPlanPanelHTML
// =========================================================================

describe('buildPlanPanelHTML', () => {
  it('returns empty html when advice is null', () => {
    const { html } = buildPlanPanelHTML(null, null);
    expect(html).toBe('');
  });

  it('returns empty html when no recommendations', () => {
    const { html } = buildPlanPanelHTML({ recommendations: [] }, null);
    expect(html).toBe('');
  });

  it('renders villain headline in line 1', () => {
    const { html } = buildPlanPanelHTML(
      flopWithAdvice.lastGoodAdvice,
      flopWithAdvice.currentLiveContext,
      { appSeatData: flopWithAdvice.appSeatData }
    );
    expect(html).toContain('pp-villain');
    expect(html).toContain('Tight aggressive');
  });

  it('renders sample size in line 1', () => {
    const { html } = buildPlanPanelHTML(
      flopWithAdvice.lastGoodAdvice,
      flopWithAdvice.currentLiveContext,
      { appSeatData: flopWithAdvice.appSeatData }
    );
    expect(html).toContain('45h');
  });

  it('renders plan note in line 2', () => {
    const { html } = buildPlanPanelHTML(
      turnBarrel.lastGoodAdvice,
      turnBarrel.currentLiveContext,
      { decisionState: DECISION_STATES.AGGRESSOR_FIRST_TO_ACT }
    );
    expect(html).toContain('pp-plan');
    expect(html).toContain('Plan:');
  });

  it('renders watch line with specific card ranks when scaryCardRanks present (RT-62)', () => {
    const { html } = buildPlanPanelHTML(
      flopWithAdvice.lastGoodAdvice,
      flopWithAdvice.currentLiveContext,
      { decisionState: DECISION_STATES.CALLER_FACING_BET }
    );
    expect(html).toContain('pp-watch');
    // flopWithAdvice fixture sets scaryCardRanks: ['A', 'K', 'Q']
    expect(html).toContain('A, K, Q');
    expect(html).toContain('on turn');
    expect(html).not.toContain('dangerous runouts');
  });

  it('omits watch line when scaryCards absent', () => {
    const adviceNoScary = {
      ...preflopWithAdvice.lastGoodAdvice,
      recommendations: [{
        ...preflopWithAdvice.lastGoodAdvice.recommendations[0],
        handPlan: { ifCall: { note: 'Test' } },
      }],
    };
    const { html } = buildPlanPanelHTML(adviceNoScary, preflopWithAdvice.currentLiveContext);
    expect(html).not.toContain('pp-watch');
  });

  it('renders showdown anchor when present', () => {
    const { html } = buildPlanPanelHTML(
      aggFacingCheck.lastGoodAdvice,
      aggFacingCheck.currentLiveContext,
      { appSeatData: aggFacingCheck.appSeatData }
    );
    expect(html).toContain('pp-anchor');
    expect(html).toContain('72o');
  });

  it('omits anchor when showdownAnchors absent', () => {
    const { html } = buildPlanPanelHTML(
      turnBarrel.lastGoodAdvice,
      turnBarrel.currentLiveContext,
      { decisionState: DECISION_STATES.AGGRESSOR_FIRST_TO_ACT }
    );
    expect(html).not.toContain('pp-anchor');
  });

  it('prefixes action word for CALLER_FACING_BET', () => {
    const { html } = buildPlanPanelHTML(
      flopWithAdvice.lastGoodAdvice,
      flopWithAdvice.currentLiveContext,
      { decisionState: DECISION_STATES.CALLER_FACING_BET }
    );
    expect(html).toContain('Call.');
  });

  // Null safety across all fixtures
  it.each(Object.entries(ALL_FIXTURES))('%s — no crash, no "undefined"/"null" text', (name, fixture) => {
    const { html } = buildPlanPanelHTML(
      fixture.lastGoodAdvice,
      fixture.currentLiveContext,
      { appSeatData: fixture.appSeatData || {} }
    );
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('>null<');
  });
});

// =========================================================================
// classifyBetweenHandsMode
// =========================================================================

describe('classifyBetweenHandsMode', () => {
  it('returns WAITING when liveContext is null', () => {
    expect(classifyBetweenHandsMode(null, 5, null, false)).toBe('WAITING');
  });

  it('returns WAITING when state is IDLE', () => {
    expect(classifyBetweenHandsMode({ state: 'IDLE' }, 5, null, false)).toBe('WAITING');
  });

  it('returns WAITING when state is COMPLETE', () => {
    expect(classifyBetweenHandsMode({ state: 'COMPLETE' }, 5, null, false)).toBe('WAITING');
  });

  it('returns REFLECTION when hero folded with profitable alternative and timer active', () => {
    expect(classifyBetweenHandsMode(
      heroFoldedProfitable.currentLiveContext,
      5,
      heroFoldedProfitable.lastGoodAdvice,
      false
    )).toBe('REFLECTION');
  });

  it('returns OBSERVING when hero folded and timer expired', () => {
    expect(classifyBetweenHandsMode(
      heroFoldedProfitable.currentLiveContext,
      5,
      heroFoldedProfitable.lastGoodAdvice,
      true
    )).toBe('OBSERVING');
  });

  it('returns OBSERVING when hero folded but engine also said fold', () => {
    expect(classifyBetweenHandsMode(
      heroFolded.currentLiveContext,
      5,
      heroFolded.lastGoodAdvice,
      false
    )).toBe('OBSERVING');
  });

  it('returns null when hero is active in live hand', () => {
    expect(classifyBetweenHandsMode(
      flopWithAdvice.currentLiveContext,
      5,
      flopWithAdvice.lastGoodAdvice,
      false
    )).toBe(null);
  });
});

// =========================================================================
// buildBetweenHandsHTML
// =========================================================================

describe('buildBetweenHandsHTML', () => {
  // Mode A: Reflection
  it('Mode A: renders "You folded"', () => {
    const { html } = buildBetweenHandsHTML('REFLECTION', {
      lastGoodAdvice: heroFoldedProfitable.lastGoodAdvice,
    });
    expect(html).toContain('You folded');
  });

  it('Mode A: renders recommended action', () => {
    const { html } = buildBetweenHandsHTML('REFLECTION', {
      lastGoodAdvice: heroFoldedProfitable.lastGoodAdvice,
    });
    expect(html).toContain('CALL');
    expect(html).toContain('+1.2');
  });

  it('Mode A: labels small EV difference', () => {
    const advice = { recommendations: [{ action: 'call', ev: 0.3 }] };
    const { html } = buildBetweenHandsHTML('REFLECTION', { lastGoodAdvice: advice });
    expect(html).toContain('small');
  });

  it('Mode A: labels medium EV difference', () => {
    const advice = { recommendations: [{ action: 'call', ev: 1.0 }] };
    const { html } = buildBetweenHandsHTML('REFLECTION', { lastGoodAdvice: advice });
    expect(html).toContain('medium');
  });

  it('Mode A: labels large EV difference', () => {
    const advice = { recommendations: [{ action: 'raise', ev: 3.5 }] };
    const { html } = buildBetweenHandsHTML('REFLECTION', { lastGoodAdvice: advice });
    expect(html).toContain('large');
  });

  it('Mode A: className includes mode-reflection', () => {
    const { className } = buildBetweenHandsHTML('REFLECTION', {
      lastGoodAdvice: heroFoldedProfitable.lastGoodAdvice,
    });
    expect(className).toContain('mode-reflection');
  });

  // Mode B: Observing
  it('Mode B: renders SCOUTING header', () => {
    const { html } = buildBetweenHandsHTML('OBSERVING', {
      liveContext: heroFoldedProfitable.currentLiveContext,
      appSeatData: heroFoldedProfitable.appSeatData,
    });
    expect(html).toContain('SCOUTING');
  });

  it('Mode B: shows vulnerability patterns', () => {
    const { html } = buildBetweenHandsHTML('OBSERVING', {
      liveContext: heroFoldedProfitable.currentLiveContext,
      appSeatData: heroFoldedProfitable.appSeatData,
    });
    expect(html).toContain('Calls too wide');
  });

  it('Mode B: shows showdown anchor', () => {
    const { html } = buildBetweenHandsHTML('OBSERVING', {
      liveContext: heroFoldedProfitable.currentLiveContext,
      appSeatData: heroFoldedProfitable.appSeatData,
      focusedVillainSeat: 7,
    });
    expect(html).toContain('Anchor:');
    expect(html).toContain('KQs');
  });

  it('Mode B: no crash with empty appSeatData', () => {
    const { html } = buildBetweenHandsHTML('OBSERVING', {
      liveContext: heroFoldedProfitable.currentLiveContext,
      appSeatData: {},
    });
    expect(html).toContain('SCOUTING');
    expect(html).not.toContain('undefined');
  });

  // Mode C: Waiting
  it('Mode C: renders "Next hand focus" with villains', () => {
    const { html } = buildBetweenHandsHTML('WAITING', {
      appSeatData: betweenHands.appSeatData,
      liveContext: null,
    });
    expect(html).toContain('Next hand focus');
  });

  it('Mode C: shows max 2 focus rows', () => {
    const { html } = buildBetweenHandsHTML('WAITING', {
      appSeatData: betweenHands.appSeatData,
      liveContext: null,
    });
    const matches = html.match(/bh-focus-row/g) || [];
    expect(matches.length).toBeLessThanOrEqual(2);
  });

  it('Mode C: shows fallback with no data', () => {
    const { html } = buildBetweenHandsHTML('WAITING', { appSeatData: {} });
    expect(html).toContain('Waiting for next hand');
  });

  it('Mode C: className includes mode-waiting', () => {
    const { className } = buildBetweenHandsHTML('WAITING', {});
    expect(className).toContain('mode-waiting');
  });

  // Null safety
  it.each(Object.entries(ALL_FIXTURES))('%s — buildBetweenHandsHTML no crash', (name, fixture) => {
    for (const mode of ['REFLECTION', 'OBSERVING', 'WAITING']) {
      const { html } = buildBetweenHandsHTML(mode, {
        liveContext: fixture.currentLiveContext,
        lastGoodAdvice: fixture.lastGoodAdvice,
        appSeatData: fixture.appSeatData || {},
      });
      expect(html).not.toContain('undefined');
      expect(html).not.toContain('>null<');
    }
  });
});
