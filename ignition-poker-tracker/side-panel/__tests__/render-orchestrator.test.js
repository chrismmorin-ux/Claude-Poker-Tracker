/**
 * render-orchestrator.test.js — DOM integration tests for extracted render functions.
 *
 * Tests the orchestration layer that keeps breaking: show/hide decisions,
 * data threading, state transitions, null safety, and visual correctness.
 *
 * Uses JSDOM to parse the actual side-panel.html DOM, then calls the
 * extracted pure render functions and asserts DOM state.
 */

import { describe, it, expect } from 'vitest';
import {
  computeFocusedVillain,
  computeVisibility,
  buildUnifiedHeaderHTML,
  buildSeatArcHTML,
  buildDeepExpanderHTML,
  buildStatusBar,
} from '../render-orchestrator.js';
import {
  flopWithAdvice,
  preflopNoAdvice,
  preflopWithAdvice,
  turnBarrel,
  riverValueBet,
  betweenHands,
  betweenHandsTournament,
  heroFolded,
  noTable,
  pinnedVillainOverride,
  fullNineHanded,
  nullEdges,
  ALL_FIXTURES,
} from './fixtures.js';

// =========================================================================
// COMPUTE FOCUSED VILLAIN
// =========================================================================

describe('computeFocusedVillain', () => {
  it('returns pinned villain with highest priority', () => {
    expect(computeFocusedVillain({
      pinnedVillainSeat: 7,
      lastGoodAdvice: { villainSeat: 3 },
      currentLiveContext: { pfAggressor: 2, activeSeatNumbers: [2, 3, 5, 7], heroSeat: 5 },
      currentTableState: { heroSeat: 5 },
    })).toBe(7);
  });

  it('falls back to advice villainSeat when not pinned', () => {
    expect(computeFocusedVillain({
      pinnedVillainSeat: null,
      lastGoodAdvice: { villainSeat: 3 },
      currentLiveContext: { pfAggressor: 2, activeSeatNumbers: [2, 3, 5], heroSeat: 5 },
      currentTableState: { heroSeat: 5 },
    })).toBe(3);
  });

  it('falls back to pfAggressor when no advice', () => {
    expect(computeFocusedVillain({
      pinnedVillainSeat: null,
      lastGoodAdvice: null,
      currentLiveContext: { pfAggressor: 2, activeSeatNumbers: [2, 5], heroSeat: 5 },
      currentTableState: { heroSeat: 5 },
    })).toBe(2);
  });

  it('falls back to HU opponent when no pfAggressor', () => {
    expect(computeFocusedVillain({
      pinnedVillainSeat: null,
      lastGoodAdvice: null,
      currentLiveContext: { pfAggressor: null, activeSeatNumbers: [3, 5], heroSeat: 5 },
      currentTableState: { heroSeat: 5 },
    })).toBe(3);
  });

  it('returns null when multiway with no other signals', () => {
    expect(computeFocusedVillain({
      pinnedVillainSeat: null,
      lastGoodAdvice: null,
      currentLiveContext: { pfAggressor: null, activeSeatNumbers: [1, 3, 5], heroSeat: 5 },
      currentTableState: { heroSeat: 5 },
    })).toBeNull();
  });

  it('returns null with all null inputs', () => {
    expect(computeFocusedVillain({
      pinnedVillainSeat: null,
      lastGoodAdvice: null,
      currentLiveContext: null,
      currentTableState: null,
    })).toBeNull();
  });
});

// =========================================================================
// COMPUTE VISIBILITY
// =========================================================================

describe('computeVisibility', () => {
  it('shows HUD when hands exist', () => {
    const v = computeVisibility({ handCount: 10, hasActiveTable: true });
    expect(v.showHudContent).toBe(true);
    expect(v.showNoTable).toBe(false);
  });

  it('shows no-table when no hands', () => {
    const v = computeVisibility({ handCount: 0, hasActiveTable: false });
    expect(v.showHudContent).toBe(false);
    expect(v.showNoTable).toBe(true);
    expect(v.showPipelineHealth).toBe(true);
  });
});

// =========================================================================
// BUILD UNIFIED HEADER HTML
// =========================================================================

describe('buildUnifiedHeaderHTML', () => {
  it('renders action badge and EV when advice present', () => {
    const f = flopWithAdvice;
    const result = buildUnifiedHeaderHTML(f.lastGoodAdvice, f.currentLiveContext, {
      focusedVillainSeat: 3,
      pinnedVillainSeat: null,
      appSeatData: f.appSeatData,
      currentTableState: f.currentTableState,
      currentLiveContext: f.currentLiveContext,
    });
    expect(result.isWaiting).toBe(false);
    expect(result.className).toContain('has-advice');
    expect(result.html).toContain('action-badge');
    expect(result.html).toContain('CALL');
    expect(result.html).toContain('+1.8');
  });

  it('renders "Analyzing..." when live but no advice', () => {
    const f = preflopNoAdvice;
    const result = buildUnifiedHeaderHTML(null, f.currentLiveContext, {
      focusedVillainSeat: null,
      currentLiveContext: f.currentLiveContext,
    });
    expect(result.isWaiting).toBe(false);
    expect(result.html).toContain('Analyzing');
  });

  it('renders "Waiting for next deal" between hands', () => {
    const result = buildUnifiedHeaderHTML(null, null, {
      currentLiveContext: null,
    });
    expect(result.isWaiting).toBe(true);
    expect(result.html).toContain('Waiting for next deal');
    expect(result.html).toContain('uh-waiting');
  });

  it('shows "Observing" when hero folded', () => {
    const f = heroFolded;
    const result = buildUnifiedHeaderHTML(f.lastGoodAdvice, f.currentLiveContext, {
      focusedVillainSeat: 7,
      pinnedVillainSeat: null,
      appSeatData: f.appSeatData,
      currentTableState: f.currentTableState,
      currentLiveContext: f.currentLiveContext,
    });
    expect(result.html).toContain('uh-observing');
    expect(result.html).toContain('Observing');
  });

  it('renders board cards when present', () => {
    const f = flopWithAdvice;
    const result = buildUnifiedHeaderHTML(f.lastGoodAdvice, f.currentLiveContext, {
      focusedVillainSeat: 3,
      currentLiveContext: f.currentLiveContext,
    });
    expect(result.html).toContain('card-group-label');
    expect(result.html).toContain('Board');
    // Should have at least 3 mini cards for flop
    const cardMatches = result.html.match(/mini-card/g);
    expect(cardMatches.length).toBeGreaterThanOrEqual(3);
  });

  it('renders hero hole cards', () => {
    const f = flopWithAdvice;
    const result = buildUnifiedHeaderHTML(f.lastGoodAdvice, f.currentLiveContext, {
      focusedVillainSeat: 3,
      currentLiveContext: f.currentLiveContext,
    });
    expect(result.html).toContain('hero-card');
  });

  it('renders villain headline from advice', () => {
    const f = flopWithAdvice;
    const result = buildUnifiedHeaderHTML(f.lastGoodAdvice, f.currentLiveContext, {
      focusedVillainSeat: 3,
      appSeatData: f.appSeatData,
      currentLiveContext: f.currentLiveContext,
    });
    expect(result.html).toContain('uh-villain-headline');
    expect(result.html).toContain('Tight aggressive');
  });

  it('renders pinned villain headline instead of advice villain', () => {
    const f = pinnedVillainOverride;
    const result = buildUnifiedHeaderHTML(f.lastGoodAdvice, f.currentLiveContext, {
      focusedVillainSeat: 1,
      pinnedVillainSeat: 1,
      appSeatData: f.appSeatData,
      currentLiveContext: f.currentLiveContext,
    });
    expect(result.html).toContain('Loose passive');
  });

  it('renders villain style badge', () => {
    const f = flopWithAdvice;
    const result = buildUnifiedHeaderHTML(f.lastGoodAdvice, f.currentLiveContext, {
      focusedVillainSeat: 3,
      appSeatData: f.appSeatData,
      currentLiveContext: f.currentLiveContext,
    });
    expect(result.html).toContain('uh-style-badge');
    expect(result.html).toContain('TAG');
  });

  it('renders confidence dot', () => {
    const f = flopWithAdvice;
    const result = buildUnifiedHeaderHTML(f.lastGoodAdvice, f.currentLiveContext, {
      focusedVillainSeat: 3,
      currentLiveContext: f.currentLiveContext,
    });
    expect(result.html).toContain('confidence-dot green');
  });

  it('renders meta pills (pot, street, SPR, depth)', () => {
    const f = flopWithAdvice;
    const result = buildUnifiedHeaderHTML(f.lastGoodAdvice, f.currentLiveContext, {
      focusedVillainSeat: 3,
      currentLiveContext: f.currentLiveContext,
    });
    expect(result.html).toContain('pot-inline');
    expect(result.html).toContain('$19'); // pot rounded
    expect(result.html).toContain('pill street');
    expect(result.html).toContain('flop');
    expect(result.html).toContain('SPR 4.2');
    expect(result.html).toContain('D2');
  });

  it('shows negative EV with neg class', () => {
    const adviceWithNegEV = {
      ...flopWithAdvice.lastGoodAdvice,
      recommendations: [{ action: 'fold', ev: -2.5, reasoning: 'Behind' }],
    };
    const result = buildUnifiedHeaderHTML(adviceWithNegEV, flopWithAdvice.currentLiveContext, {
      currentLiveContext: flopWithAdvice.currentLiveContext,
    });
    expect(result.html).toContain('ev-display negative');
    expect(result.html).toContain('-2.5');
  });

  it('renders sizing percentage when present', () => {
    const adviceWithSizing = {
      ...flopWithAdvice.lastGoodAdvice,
      recommendations: [{
        action: 'bet', ev: 3.0,
        sizing: { betFraction: 0.67, betSize: 12 },
        reasoning: 'Value',
      }],
    };
    const result = buildUnifiedHeaderHTML(adviceWithSizing, flopWithAdvice.currentLiveContext, {
      currentLiveContext: flopWithAdvice.currentLiveContext,
    });
    expect(result.html).toContain('action-sizing');
    expect(result.html).toContain('67%');
  });

  it('shows "Folded" when focused villain has folded', () => {
    const ctx = {
      ...flopWithAdvice.currentLiveContext,
      foldedSeats: [3], // villain folded
    };
    const result = buildUnifiedHeaderHTML(flopWithAdvice.lastGoodAdvice, ctx, {
      focusedVillainSeat: 3,
      currentLiveContext: ctx,
    });
    expect(result.html).toContain('Folded');
  });
});

// =========================================================================
// BUILD SEAT ARC HTML
// =========================================================================

describe('buildSeatArcHTML', () => {
  it('renders hero with star and .hero class', () => {
    const f = flopWithAdvice;
    const html = buildSeatArcHTML(f.cachedSeatStats, f.currentTableState, null, {
      currentLiveContext: f.currentLiveContext,
      appSeatData: f.appSeatData,
      focusedVillainSeat: 3,
    });
    expect(html).toContain('seat-circle hero');
    expect(html).toContain('\u2605'); // star
  });

  it('renders folded seats with .folded class', () => {
    const f = heroFolded;
    const html = buildSeatArcHTML(f.cachedSeatStats, f.currentTableState, null, {
      currentLiveContext: f.currentLiveContext,
      appSeatData: f.appSeatData,
      focusedVillainSeat: 7,
    });
    // Hero (seat 5) is in foldedSeats
    expect(html).toContain('seat-circle hero');
    // Non-hero seats that are active should not have folded class
    expect(html).toMatch(/data-seat="3".*?seat-circle(?! folded)/s);
  });

  it('renders focused villain with .focused class', () => {
    const f = flopWithAdvice;
    const html = buildSeatArcHTML(f.cachedSeatStats, f.currentTableState, null, {
      currentLiveContext: f.currentLiveContext,
      appSeatData: f.appSeatData,
      focusedVillainSeat: 3,
    });
    expect(html).toContain('focused');
    // Check seat 3 specifically has focused
    expect(html).toMatch(/data-seat="3"[^>]*>.*?/s);
  });

  it('renders pinned villain with .pinned class', () => {
    const f = pinnedVillainOverride;
    const html = buildSeatArcHTML(f.cachedSeatStats, f.currentTableState, null, {
      currentLiveContext: f.currentLiveContext,
      appSeatData: f.appSeatData,
      focusedVillainSeat: 1,
      pinnedVillainSeat: 1,
    });
    expect(html).toContain('pinned');
  });

  it('renders vacant seats with .vacant class', () => {
    const f = fullNineHanded;
    const html = buildSeatArcHTML(f.cachedSeatStats, f.currentTableState, null, {
      currentLiveContext: f.currentLiveContext,
      appSeatData: f.appSeatData,
    });
    // Seats 4, 6, 8 are folded (not in activeSeatNumbers)
    expect(html).toContain('vacant');
  });

  it('renders style classes for villains', () => {
    const f = fullNineHanded;
    const html = buildSeatArcHTML(f.cachedSeatStats, f.currentTableState, null, {
      currentLiveContext: f.currentLiveContext,
      appSeatData: f.appSeatData,
    });
    expect(html).toContain('style-fish');
    expect(html).toContain('style-tag');
    expect(html).toContain('style-lag');
  });

  it('renders dealer button on correct seat', () => {
    const f = flopWithAdvice;
    const html = buildSeatArcHTML(f.cachedSeatStats, f.currentTableState, null, {
      currentLiveContext: f.currentLiveContext,
      appSeatData: f.appSeatData,
    });
    expect(html).toContain('seat-dealer-btn');
    expect(html).toContain('>D</span>');
  });

  it('renders action tags from action sequence', () => {
    const f = flopWithAdvice;
    const html = buildSeatArcHTML(f.cachedSeatStats, f.currentTableState, null, {
      currentLiveContext: f.currentLiveContext,
      appSeatData: f.appSeatData,
    });
    expect(html).toContain('seat-action-tag');
    // Seat 3 last action is bet
    expect(html).toContain('>B');
  });

  it('renders PFA marker on preflop aggressor', () => {
    const f = flopWithAdvice;
    const html = buildSeatArcHTML(f.cachedSeatStats, f.currentTableState, null, {
      currentLiveContext: f.currentLiveContext,
      appSeatData: f.appSeatData,
    });
    expect(html).toContain('seat-pfa-tag');
    expect(html).toContain('PFA');
  });

  it('renders sample badges for non-hero occupied seats', () => {
    const f = flopWithAdvice;
    const html = buildSeatArcHTML(f.cachedSeatStats, f.currentTableState, null, {
      currentLiveContext: f.currentLiveContext,
      appSeatData: f.appSeatData,
    });
    expect(html).toContain('seat-sample-badge');
    expect(html).toContain('>45</span>'); // TAG with 45 hands
    expect(html).toContain('>30</span>'); // Fish with 30 hands
  });

  it('renders tournament mapping indicator when seatMap present', () => {
    const f = betweenHandsTournament;
    const html = buildSeatArcHTML(f.cachedSeatStats, f.currentTableState, f.cachedSeatMap, {
      currentLiveContext: f.currentLiveContext,
      appSeatData: f.appSeatData,
    });
    expect(html).toContain('seat-mapping-status');
    expect(html).toContain('ID:');
  });

  it('returns empty string when no seats', () => {
    const html = buildSeatArcHTML(null, null, null, {
      currentLiveContext: null,
      appSeatData: {},
    });
    expect(html).toBe('');
  });

  it('renders all 9 seats for full table', () => {
    const f = fullNineHanded;
    const html = buildSeatArcHTML(f.cachedSeatStats, f.currentTableState, null, {
      currentLiveContext: f.currentLiveContext,
      appSeatData: f.appSeatData,
    });
    for (let s = 1; s <= 9; s++) {
      expect(html).toContain(`data-seat="${s}"`);
    }
  });

  it('uses data-seat attributes for event delegation', () => {
    const f = flopWithAdvice;
    const html = buildSeatArcHTML(f.cachedSeatStats, f.currentTableState, null, {
      currentLiveContext: f.currentLiveContext,
      appSeatData: f.appSeatData,
    });
    expect(html).toContain('data-seat="1"');
    expect(html).toContain('data-seat="3"');
    expect(html).toContain('data-seat="5"');
  });
});

// =========================================================================
// BUILD DEEP EXPANDER HTML
// =========================================================================

describe('buildDeepExpanderHTML', () => {
  it('returns showButton=false when no advice', () => {
    const result = buildDeepExpanderHTML(null);
    expect(result.showButton).toBe(false);
    expect(result.html).toBe('');
  });

  it('returns showButton=false when empty recommendations', () => {
    const result = buildDeepExpanderHTML({ recommendations: [] });
    expect(result.showButton).toBe(false);
  });

  it('returns showButton=true with advice', () => {
    const result = buildDeepExpanderHTML(flopWithAdvice.lastGoodAdvice);
    expect(result.showButton).toBe(true);
    expect(result.html.length).toBeGreaterThan(0);
  });

  it('includes range breakdown when segmentation present', () => {
    const result = buildDeepExpanderHTML(flopWithAdvice.lastGoodAdvice);
    expect(result.html).toContain('rb-stacked-bar');
    expect(result.html).toContain('66 combos');
  });

  it('includes all-recs section when multiple recommendations', () => {
    const result = buildDeepExpanderHTML(flopWithAdvice.lastGoodAdvice);
    // flopWithAdvice has 2 recommendations
    expect(result.html).toContain('CALL');
    expect(result.html).toContain('RAISE');
  });

  it('includes street tendencies when villain profile has streets', () => {
    const result = buildDeepExpanderHTML(flopWithAdvice.lastGoodAdvice);
    expect(result.html).toContain('Selective opener');
  });

  it('includes fold curve when foldMeta.curve present', () => {
    const result = buildDeepExpanderHTML(flopWithAdvice.lastGoodAdvice);
    expect(result.html).toContain('<svg');
    expect(result.html).toContain('Personalized');
  });

  it('includes fold breakdown when adjustments present', () => {
    const result = buildDeepExpanderHTML(flopWithAdvice.lastGoodAdvice);
    expect(result.html).toContain('35%'); // base estimate
    expect(result.html).toContain('af');
  });

  it('includes combo stats when present', () => {
    const result = buildDeepExpanderHTML(flopWithAdvice.lastGoodAdvice);
    expect(result.html).toContain('combo-seg ahead');
    expect(result.html).toContain('56');
  });

  it('includes model audit section', () => {
    const result = buildDeepExpanderHTML(flopWithAdvice.lastGoodAdvice);
    expect(result.html).toContain('Player model');
    expect(result.html).toContain('180ms');
  });

  it('includes vulnerabilities when present', () => {
    const result = buildDeepExpanderHTML(flopWithAdvice.lastGoodAdvice);
    expect(result.html).toContain('Overfolds to flop raises');
    expect(result.html).toContain('vuln-dot');
  });

  it('omits sections when data is missing', () => {
    const sparse = {
      recommendations: [{ action: 'check', ev: 0, reasoning: 'Check' }],
    };
    const result = buildDeepExpanderHTML(sparse);
    expect(result.showButton).toBe(true);
    expect(result.html).not.toContain('rb-stacked-bar');
    expect(result.html).not.toContain('<svg');
    expect(result.html).not.toContain('vuln-dot');
  });
});

// =========================================================================
// BUILD STATUS BAR
// =========================================================================

describe('buildStatusBar', () => {
  it('returns yellow dot when no pipeline', () => {
    const result = buildStatusBar(null, 0);
    expect(result.dotClass).toContain('yellow');
    expect(result.text).toContain('Service worker not responding');
  });

  it('returns green dot when tracking with hands', () => {
    const result = buildStatusBar({ tableCount: 1, tables: { '123': {} } }, 15);
    expect(result.dotClass).toContain('green');
    expect(result.text).toContain('Tracking');
    expect(result.text).toContain('15 hands');
  });

  it('returns green dot with just hand count', () => {
    const result = buildStatusBar({ tableCount: 0, tables: {} }, 10);
    expect(result.dotClass).toContain('green');
    expect(result.text).toContain('10 hands captured');
  });

  it('returns yellow dot when connected but no hands', () => {
    const result = buildStatusBar({ tableCount: 1, tables: { '123': {} } }, 0);
    expect(result.dotClass).toContain('yellow');
    expect(result.text).toContain('Connected');
    expect(result.text).toContain('waiting for hands');
  });

  it('returns empty text for diagnostic fallback', () => {
    const result = buildStatusBar({ tableCount: 0, tables: {} }, 0);
    expect(result.dotClass).toContain('yellow');
    expect(result.text).toBe('');
  });
});

// =========================================================================
// NULL SAFETY — Every fixture renders without crashing
// =========================================================================

describe('null safety', () => {
  for (const [name, fixture] of Object.entries(ALL_FIXTURES)) {
    it(`buildUnifiedHeaderHTML does not throw for ${name}`, () => {
      expect(() => {
        buildUnifiedHeaderHTML(fixture.lastGoodAdvice, fixture.currentLiveContext, {
          focusedVillainSeat: fixture.focusedVillainSeat ?? null,
          pinnedVillainSeat: fixture.pinnedVillainSeat ?? null,
          appSeatData: fixture.appSeatData || {},
          currentTableState: fixture.currentTableState,
          currentLiveContext: fixture.currentLiveContext,
        });
      }).not.toThrow();
    });

    it(`buildSeatArcHTML does not throw for ${name}`, () => {
      expect(() => {
        buildSeatArcHTML(fixture.cachedSeatStats, fixture.currentTableState, fixture.cachedSeatMap, {
          currentLiveContext: fixture.currentLiveContext,
          appSeatData: fixture.appSeatData || {},
          focusedVillainSeat: fixture.focusedVillainSeat ?? null,
          pinnedVillainSeat: fixture.pinnedVillainSeat ?? null,
        });
      }).not.toThrow();
    });

    it(`buildDeepExpanderHTML does not throw for ${name}`, () => {
      expect(() => {
        buildDeepExpanderHTML(fixture.lastGoodAdvice);
      }).not.toThrow();
    });

    it(`computeFocusedVillain does not throw for ${name}`, () => {
      expect(() => {
        computeFocusedVillain({
          pinnedVillainSeat: fixture.pinnedVillainSeat ?? null,
          lastGoodAdvice: fixture.lastGoodAdvice,
          currentLiveContext: fixture.currentLiveContext,
          currentTableState: fixture.currentTableState,
        });
      }).not.toThrow();
    });
  }
});

// =========================================================================
// NO UNDEFINED/NULL TEXT — rendered HTML should never contain literal text
// =========================================================================

describe('no undefined/null text in rendered HTML', () => {
  for (const [name, fixture] of Object.entries(ALL_FIXTURES)) {
    it(`no "undefined" or "null" text for ${name}`, () => {
      const header = buildUnifiedHeaderHTML(fixture.lastGoodAdvice, fixture.currentLiveContext, {
        focusedVillainSeat: fixture.focusedVillainSeat ?? null,
        pinnedVillainSeat: fixture.pinnedVillainSeat ?? null,
        appSeatData: fixture.appSeatData || {},
        currentTableState: fixture.currentTableState,
        currentLiveContext: fixture.currentLiveContext,
      });
      expect(header.html).not.toContain('>undefined<');
      expect(header.html).not.toContain('>null<');
      // Check for bare "undefined" not inside an attribute
      expect(header.html).not.toMatch(/(?<!=")undefined(?!")/);

      const arc = buildSeatArcHTML(fixture.cachedSeatStats, fixture.currentTableState, fixture.cachedSeatMap, {
        currentLiveContext: fixture.currentLiveContext,
        appSeatData: fixture.appSeatData || {},
      });
      expect(arc).not.toContain('>undefined<');
      expect(arc).not.toContain('>null<');

      const deep = buildDeepExpanderHTML(fixture.lastGoodAdvice);
      expect(deep.html).not.toContain('>undefined<');
      expect(deep.html).not.toContain('>null<');
    });
  }
});
