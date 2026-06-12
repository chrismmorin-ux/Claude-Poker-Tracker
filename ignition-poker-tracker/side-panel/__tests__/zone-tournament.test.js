/**
 * zone-tournament.test.js — Tests for the tournament zone pure builders
 * (slim bar + detail panel), extracted from side-panel.js per WS-227.
 *
 * Tournament payloads arrive straight off untrusted WebSocket parse, so the
 * no-undefined/null/NaN-text guarantee gets dedicated coverage here.
 */

import { describe, it, expect } from 'vitest';
import {
  buildTournamentBarHTML,
  buildTournamentDetailHTML,
} from '../render-orchestrator.js';
import { betweenHandsTournament } from './fixtures.js';

const t = () => betweenHandsTournament.lastGoodTournament;

const FORBIDDEN_TEXT = /undefined|NaN|\bnull\b/;

// =========================================================================
// buildTournamentBarHTML — slim bar
// =========================================================================

describe('buildTournamentBarHTML', () => {
  it('renders M-ratio with the zone color', () => {
    const { html } = buildTournamentBarHTML(t());
    expect(html).toContain('tourney-m-label');
    expect(html).toContain('8.5');
    // fixture zone is 'caution' → #eab308
    expect(html).toContain('#eab308');
  });

  it('renders the ICM badge for non-standard zones', () => {
    const { html } = buildTournamentBarHTML(t());
    expect(html).toContain('NEAR BUBBLE');
    expect(html).toContain('icm-approaching');
  });

  it('omits the ICM badge for standard zone', () => {
    const { html } = buildTournamentBarHTML({ ...t(), icmPressure: { zone: 'standard' } });
    expect(html).not.toContain('tourney-icm-badge');
  });

  it('renders level and players remaining', () => {
    const { html } = buildTournamentBarHTML(t());
    expect(html).toContain('Lvl 9'); // currentLevelIndex 8 → display 9
    expect(html).toContain('22/120');
  });

  it('renders "N left" when totalEntrants is missing', () => {
    const { html } = buildTournamentBarHTML({ ...t(), totalEntrants: null });
    expect(html).toContain('22 left');
  });

  it('includes the empty timer placeholder span for the side-panel interval', () => {
    const { html } = buildTournamentBarHTML(t());
    expect(html).toContain('id="tourney-bar-timer"');
  });

  it('chevron open state reflects collapsed option', () => {
    const open = buildTournamentBarHTML(t(), { collapsed: false }).html;
    const closed = buildTournamentBarHTML(t(), { collapsed: true }).html;
    expect(open).toMatch(/affordance-chevron open/);
    expect(closed).not.toMatch(/affordance-chevron open/);
    expect(closed).toContain('affordance-chevron');
  });

  it('returns empty html for null tournament', () => {
    expect(buildTournamentBarHTML(null).html).toBe('');
    expect(buildTournamentBarHTML(undefined).html).toBe('');
  });
});

// =========================================================================
// buildTournamentDetailHTML — detail panel
// =========================================================================

describe('buildTournamentDetailHTML', () => {
  it('renders all 7 sections for the full fixture', () => {
    const { html } = buildTournamentDetailHTML(t());
    expect(html).toContain('M-Ratio');
    expect(html).toContain('8.5');
    expect(html).toContain('Caution zone');           // mRatioGuidance.label
    expect(html).toContain('200/400 ante 50');        // blinds
    expect(html).toContain('Next: 300/600 ante 75');  // next blinds
    expect(html).toContain('6,800 (17 BB)');          // stack: 6800/400
    expect(html).toContain('Avg: 10,909 (62%)');      // avg stack pct
    expect(html).toContain('3 levels / ~24 min');     // blind-out
    expect(html).toContain('Approaching bubble (4 away)'); // ICM
    expect(html).toContain('Bubble');                 // milestone
    expect(html).toContain('~12m');
    expect(html).toContain('Final Table');
    expect(html).toContain('~45m');
    expect(html).toContain('82% eliminated');         // progress
  });

  it('omits sections whose data is absent', () => {
    const { html } = buildTournamentDetailHTML({ heroMRatio: 12 });
    expect(html).toContain('M-Ratio');
    expect(html).not.toContain('Blinds');
    expect(html).not.toContain('Stack');
    expect(html).not.toContain('Blind-Out');
    expect(html).not.toContain('ICM');
    expect(html).not.toContain('Milestones');
    expect(html).not.toContain('Progress');
  });

  it('formats milestone times over an hour as hours', () => {
    const { html } = buildTournamentDetailHTML({
      predictions: { milestones: [{ milestone: 'finalTable', estimatedMinutes: 90 }] },
    });
    expect(html).toContain('~1.5h');
  });

  it('returns empty html for null tournament', () => {
    expect(buildTournamentDetailHTML(null).html).toBe('');
    expect(buildTournamentDetailHTML(undefined).html).toBe('');
  });
});

// =========================================================================
// No-undefined/null/NaN-text guarantee on malformed payloads
// =========================================================================

describe('tournament builders — malformed payload guarantee', () => {
  const MALFORMED = [
    ['empty object', {}],
    ['string-typed numerics', {
      heroMRatio: 'abc', playersRemaining: 'x', totalEntrants: 'y',
      currentLevelIndex: 'z', heroStack: 'q', avgStack: 'w', progress: 'p',
    }],
    ['numeric strings pass through coercion', {
      heroMRatio: '8.5', playersRemaining: '22', totalEntrants: '120',
      currentLevelIndex: '8', heroStack: '6800', progress: '82',
    }],
    ['missing nested objects', {
      heroMRatio: 9, currentBlinds: {}, nextBlinds: {},
      blindOutInfo: {}, icmPressure: {}, predictions: {},
    }],
    ['garbage nested values', {
      heroMRatio: 9,
      mRatioGuidance: { zone: 'not-a-zone', label: null },
      currentBlinds: { sb: 'a', bb: 'b', ante: 'c' },
      icmPressure: { zone: 'weird', playersFromBubble: 'many' },
      predictions: { milestones: [{ milestone: undefined, estimatedMinutes: 'soon' }, null] },
      blindOutInfo: { wallClockMinutes: 'lots', levelsRemaining: null },
      progress: Infinity,
    }],
  ];

  for (const [name, payload] of MALFORMED) {
    it(`bar never renders undefined/null/NaN text — ${name}`, () => {
      const { html } = buildTournamentBarHTML(payload);
      expect(html).not.toMatch(FORBIDDEN_TEXT);
    });

    it(`detail never renders undefined/null/NaN text — ${name}`, () => {
      const { html } = buildTournamentDetailHTML(payload);
      expect(html).not.toMatch(FORBIDDEN_TEXT);
    });
  }

  it('numeric strings coerce instead of vanishing', () => {
    const { html } = buildTournamentBarHTML({
      heroMRatio: '8.5', playersRemaining: '22', totalEntrants: '120',
    });
    expect(html).toContain('8.5');
    expect(html).toContain('22/120');
  });

  it('escapes string fields from untrusted parse', () => {
    const { html } = buildTournamentDetailHTML({
      heroMRatio: 9,
      mRatioGuidance: { zone: 'caution', label: '<img src=x onerror=alert(1)>' },
    });
    expect(html).not.toContain('<img');
  });
});

// =========================================================================
// Bar and detail read the same single-source ICM map
// =========================================================================

describe('tournament builders — ICM map single-sourcing', () => {
  const CASES = [
    ['bubble', 'BUBBLE', 'On the bubble'],
    ['approaching', 'NEAR BUBBLE', 'Approaching bubble'],
    ['itm', 'ITM', 'In the money'],
  ];

  for (const [zone, badge, detailLabel] of CASES) {
    it(`zone "${zone}" renders consistently in bar and detail`, () => {
      const payload = { heroMRatio: 9, icmPressure: { zone } };
      expect(buildTournamentBarHTML(payload).html).toContain(badge);
      expect(buildTournamentDetailHTML(payload).html).toContain(detailLabel);
    });
  }
});
