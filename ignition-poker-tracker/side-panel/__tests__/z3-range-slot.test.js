/**
 * z3-range-slot.test.js — SR-6.13 enforcement.
 *
 * Z3 range slot is the fixed-height frame owner (R-1.3) for:
 *   3.6 grid (hero preflop OR villain postflop), 3.7 headline, 3.8 legend,
 *   3.11 multiway selector pills, 3.12 no-aggressor placeholder.
 *
 * A) renderVillainRangeSection wraps all output in `<div class="range-slot">`.
 * B) Hero preflop grid renders when postflop advice has no villainRanges
 *    and liveContext is preflop.
 * C) Villain postflop grid renders when villainRanges[focused] has a
 *    169-cell range array.
 * D) 3.11 multiway pill strip renders with .villain-tab[data-range-seat]
 *    when villainRanges has 2+ active entries; HU renders no pills.
 * E) 3.12 no-aggressor placeholder renders when postflop + empty villainRanges
 *    (Rule V Q1-c), always with legend mounted (R-5.1 legend always rendered).
 * F) Rule V cross-zone contract: villain-tab click handler writes
 *    `rangeSelectedSeat`, not `pinnedVillainSeat`. Source-level assertion.
 * G) BET/RAISE clear: a new BET or RAISE action in the incoming action
 *    sequence clears `rangeSelectedSeat`; CHECK/CALL/FOLD does not. Source-
 *    level assertion.
 * H) hand:new clear: coordinator.handNew clears rangeSelectedSeat (SR-6.11
 *    lifecycle, re-pinned here for the Z3 contract).
 * I) CSS pin: `.range-slot` rule declares `min-height: 152px`.
 * J) 3.10 orphan: render-street-card.js contains no "next deal" string.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  _renderPreflopContent as renderPreflopContent,
  _renderFlopContent as renderFlopContent,
} from '../render-street-card.js';
import { RenderCoordinator } from '../render-coordinator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = resolve(__dirname, '..', 'side-panel.html');
const JS_PATH = resolve(__dirname, '..', 'side-panel.js');
const STREET_CARD_PATH = resolve(__dirname, '..', 'render-street-card.js');
const html = readFileSync(HTML_PATH, 'utf8');
const js = readFileSync(JS_PATH, 'utf8');
const streetCardJs = readFileSync(STREET_CARD_PATH, 'utf8');

// ----------------------------------------------------------------------------
// Test fixtures
// ----------------------------------------------------------------------------

const preflopCtx = {
  currentStreet: 'preflop',
  heroSeat: 1,
  dealerSeat: 3,
  holeCards: ['As', 'Kh'],
  actionSequence: [],
  pot: 1.5,
};

const flopCtxNoAggression = {
  currentStreet: 'flop',
  heroSeat: 1,
  dealerSeat: 3,
  holeCards: ['As', 'Kh'],
  communityCards: ['2c', '7d', '9h'],
  actionSequence: [
    { seat: 2, action: 'check', street: 'flop', order: 1 },
    { seat: 3, action: 'check', street: 'flop', order: 2 },
  ],
  pot: 3,
};

const flopAdviceNoRanges = {
  currentStreet: 'flop',
  villainSeat: null,
  villainRanges: [],
};

// 169-cell range (uniformly 0.3 weight)
const make169 = (weight = 0.3) => {
  const arr = new Float64Array(169);
  for (let i = 0; i < 169; i++) arr[i] = weight;
  return arr;
};

const flopCtxMultiway = {
  currentStreet: 'flop',
  heroSeat: 1,
  dealerSeat: 5,
  holeCards: ['As', 'Kh'],
  communityCards: ['2c', '7d', '9h'],
  actionSequence: [
    { seat: 2, action: 'bet', street: 'flop', order: 1, amount: 3 },
    { seat: 3, action: 'call', street: 'flop', order: 2, amount: 3 },
  ],
  pot: 9,
};

const flopAdviceMultiway = {
  currentStreet: 'flop',
  villainSeat: 2,
  villainRanges: [
    { seat: 2, active: true, range: make169(0.4), position: 'CO', equity: 0.48, rangeWidth: 32, actionKey: 'bet' },
    { seat: 3, active: true, range: make169(0.3), position: 'BTN', equity: 0.40, rangeWidth: 28, actionKey: 'call' },
  ],
};

// ----------------------------------------------------------------------------
// A / B / C — Range slot wrapping + Rule V variants
// ----------------------------------------------------------------------------

describe('SR-6.13 §3.6/3.7 — range slot frame owner', () => {
  it('wraps hero preflop grid in .range-slot', () => {
    const out = renderPreflopContent(null, preflopCtx, {}, null);
    expect(out).toContain('class="range-slot"');
    expect(out).toContain('range-grid');
  });

  it('wraps villain postflop grid in .range-slot (multiway)', () => {
    const out = renderFlopContent(flopAdviceMultiway, flopCtxMultiway, 2);
    expect(out).toContain('class="range-slot"');
    expect(out).toContain('range-grid');
    expect(out).toContain('villain-tab');
  });

  it('HU villain postflop renders grid in range-slot without multiway tabs', () => {
    const huAdvice = {
      ...flopAdviceMultiway,
      villainRanges: [flopAdviceMultiway.villainRanges[0]],
    };
    const huCtx = { ...flopCtxMultiway, actionSequence: [
      { seat: 2, action: 'bet', street: 'flop', order: 1, amount: 3 },
    ]};
    const out = renderFlopContent(huAdvice, huCtx, 2);
    expect(out).toContain('class="range-slot"');
    // villain-range-tabs only emitted when villainRanges.length > 1
    expect(out).not.toContain('villain-range-tabs');
  });
});

// ----------------------------------------------------------------------------
// D — 3.11 multiway pills
// ----------------------------------------------------------------------------

describe('SR-6.13 §3.11 — multiway seat selector', () => {
  it('renders one pill per active villain seat', () => {
    const out = renderFlopContent(flopAdviceMultiway, flopCtxMultiway, 2);
    expect(out).toContain('data-range-seat="2"');
    expect(out).toContain('data-range-seat="3"');
  });

  it('highlights the focused seat with `active` class', () => {
    const out = renderFlopContent(flopAdviceMultiway, flopCtxMultiway, 3);
    // Focused seat 3 carries 'active'. (Legacy code also marks the advice
    // villainSeat as active; Rule V-strict highlighting is a follow-up —
    // the key Z3 contract is that the focused seat is reachable.)
    expect(out).toMatch(/villain-tab active[^>]*data-range-seat="3"/);
  });
});

// ----------------------------------------------------------------------------
// E — 3.12 no-aggressor placeholder + legend always rendered
// ----------------------------------------------------------------------------

describe('SR-6.13 §3.12 — no-aggressor placeholder', () => {
  it('renders placeholder text when postflop + empty villainRanges', () => {
    const out = renderFlopContent(flopAdviceNoRanges, flopCtxNoAggression, null);
    expect(out).toContain('range-slot-placeholder');
    expect(out).toContain('No aggression yet');
  });

  it('placeholder omits grid cells (XOR with 3.6)', () => {
    const out = renderFlopContent(flopAdviceNoRanges, flopCtxNoAggression, null);
    expect(out).not.toContain('class="range-grid"');
  });

  it('placeholder still mounts the 3.8 legend (R-5.1 always rendered)', () => {
    const out = renderFlopContent(flopAdviceNoRanges, flopCtxNoAggression, null);
    expect(out).toContain('rg-legend');
    expect(out).toContain('In range');
    expect(out).toContain('Your hand');
  });
});

// ----------------------------------------------------------------------------
// F — Rule V event contract (source-level)
// ----------------------------------------------------------------------------

describe('SR-6.13 §Rule V — pill-click event contract', () => {
  it('villain-tab click handler writes rangeSelectedSeat (not pinnedVillainSeat)', () => {
    // Locate the rangeTab click block and verify the set target.
    const block = js.match(/const rangeTab = e\.target\.closest\('\.villain-tab\[data-range-seat\]'\);[\s\S]{0,400}/);
    expect(block).not.toBeNull();
    expect(block[0]).toContain("coordinator.set('rangeSelectedSeat'");
    expect(block[0]).not.toContain("coordinator.set('pinnedVillainSeat'");
  });
});

// ----------------------------------------------------------------------------
// G — BET/RAISE clear (source-level) + coordinator integration
// ----------------------------------------------------------------------------

describe('SR-6.13 §Rule V — override persistence (BET/RAISE clear)', () => {
  it('handleLiveContextPush clears rangeSelectedSeat on new bet or raise', () => {
    // Source-level pin: the BET/RAISE tail inspection lives in
    // handleLiveContextPush and sets rangeSelectedSeat to null.
    const m = js.match(/a\.action === 'bet' \|\| a\.action === 'raise'[\s\S]{0,200}/);
    expect(m).not.toBeNull();
    expect(m[0]).toContain("coordinator.set('rangeSelectedSeat', null)");
  });

  it('handleLiveContextPush does NOT clear on check/call/fold alone', () => {
    // The clear condition is strictly gated on 'bet' || 'raise'. No
    // 'check'|'call'|'fold' literal appears in the action tail check.
    const block = js.match(/a\.action === 'bet' \|\| a\.action === 'raise'[\s\S]{0,400}coordinator\.set\('rangeSelectedSeat', null\)/);
    expect(block).not.toBeNull();
    expect(block[0]).not.toMatch(/action === 'check'/);
    expect(block[0]).not.toMatch(/action === 'call'/);
    expect(block[0]).not.toMatch(/action === 'fold'/);
  });
});

// ----------------------------------------------------------------------------
// H — hand:new clear (coordinator lifecycle pin)
// ----------------------------------------------------------------------------

describe('SR-6.13 §Rule V — hand:new clear', () => {
  it('PREFLOP/DEALING boundary clears rangeSelectedSeat (hand-scoped override)', () => {
    const coord = new RenderCoordinator({ renderFn: () => {} });
    // Seed as if mid-hand with user override.
    coord.handleLiveContext({ state: 'FLOP', currentStreet: 'flop', actionSequence: [] });
    coord.set('rangeSelectedSeat', 4);
    expect(coord.get('rangeSelectedSeat')).toBe(4);
    // New hand — PREFLOP/DEALING boundary in handleLiveContext clears it.
    coord.handleLiveContext({ state: 'PREFLOP', currentStreet: 'preflop', actionSequence: [] });
    expect(coord.get('rangeSelectedSeat')).toBeNull();
  });

  it('coordinator.clearForTableSwitch clears rangeSelectedSeat', () => {
    const coord = new RenderCoordinator({ renderFn: () => {} });
    coord.set('rangeSelectedSeat', 2);
    coord.clearForTableSwitch();
    expect(coord.get('rangeSelectedSeat')).toBeNull();
  });
});

// ----------------------------------------------------------------------------
// I — CSS pin: .range-slot { min-height: 152px }
// ----------------------------------------------------------------------------

describe('SR-6.13 §R-1.3 — 152px slot invariant (CSS pin)', () => {
  it('.range-slot declares min-height: 152px', () => {
    // Find the .range-slot rule (not placeholder), validate min-height.
    const block = html.match(/\.range-slot \{[^}]+\}/);
    expect(block).not.toBeNull();
    expect(block[0]).toMatch(/min-height:\s*152px/);
  });

  it('.range-slot-placeholder has its own min-height floor', () => {
    const block = html.match(/\.range-slot-placeholder \{[^}]+\}/);
    expect(block).not.toBeNull();
    expect(block[0]).toMatch(/min-height:\s*152px/);
  });
});

// ----------------------------------------------------------------------------
// J — 3.10 orphan absence
// ----------------------------------------------------------------------------

describe('SR-6.13 §3.10 — orphan removed from Z3', () => {
  it('render-street-card.js contains no "next deal" string (Z3 uses "next hand")', () => {
    expect(streetCardJs).not.toMatch(/next deal/i);
  });

  it('render-street-card.js still emits the 3.9 "Waiting for next hand…" between-hands placeholder', () => {
    expect(streetCardJs).toContain('Waiting for next hand');
  });
});
