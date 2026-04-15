/**
 * z1-table-read.test.js — SR-6.11 enforcement.
 *
 * A) `quantizeSampleBand` bands: {0→empty, <20→tiny, 20–99→small,
 *    100–499→medium, 500+→large} (Z1 §1.1 logarithmic spec).
 * B) `buildSeatArcHTML` emits band class per seat, `—` placeholder for
 *    occupied-zero, `rule-v-selected` class for Rule V override seat.
 * C) `computeFocusedVillain` treats `rangeSelectedSeat` as highest-priority
 *    override (Rule V item 6).
 * D) Coordinator default `rangeSelectedSeat = null`; clearForTableSwitch and
 *    hand-boundary both clear it (R-2.4 partial reset per batch invariant 4).
 * E) Source-level assertion: villain-tab click writes `rangeSelectedSeat`,
 *    not `pinnedVillainSeat` (Rule V event contract — batch invariant 6).
 * F) CSS pins: ring-band and rule-v-selected rules exist.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  quantizeSampleBand,
  buildSeatArcHTML,
  computeFocusedVillain,
} from '../render-orchestrator.js';
import { RenderCoordinator } from '../render-coordinator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = resolve(__dirname, '..', 'side-panel.html');
const JS_PATH = resolve(__dirname, '..', 'side-panel.js');
const html = readFileSync(HTML_PATH, 'utf8');
const js = readFileSync(JS_PATH, 'utf8');

describe('SR-6.11 Z1 §1.1 — quantizeSampleBand (logarithmic bands)', () => {
  it('0 / null / undefined → empty', () => {
    expect(quantizeSampleBand(0)).toBe('empty');
    expect(quantizeSampleBand(null)).toBe('empty');
    expect(quantizeSampleBand(undefined)).toBe('empty');
  });
  it('1–19 → tiny', () => {
    expect(quantizeSampleBand(1)).toBe('tiny');
    expect(quantizeSampleBand(19)).toBe('tiny');
  });
  it('20–99 → small', () => {
    expect(quantizeSampleBand(20)).toBe('small');
    expect(quantizeSampleBand(99)).toBe('small');
  });
  it('100–499 → medium', () => {
    expect(quantizeSampleBand(100)).toBe('medium');
    expect(quantizeSampleBand(499)).toBe('medium');
  });
  it('500+ → large', () => {
    expect(quantizeSampleBand(500)).toBe('large');
    expect(quantizeSampleBand(5000)).toBe('large');
  });
});

describe('SR-6.11 Z1 §1.1 — seat arc band class + placeholder', () => {
  const tableState = { heroSeat: 1 };
  const liveCtx = { heroSeat: 1, activeSeatNumbers: [1, 2, 3] };

  it('emits ring-band-large on high-sample seat', () => {
    const html = buildSeatArcHTML(null, tableState, null, {
      currentLiveContext: liveCtx,
      appSeatData: { 2: { sampleSize: 800, style: 'fish' } },
    });
    expect(html).toMatch(/class="[^"]*ring-band-large[^"]*"[^>]*data-seat="2"/);
  });

  it('emits ring-band-tiny on <20h seat', () => {
    const html = buildSeatArcHTML(null, tableState, null, {
      currentLiveContext: liveCtx,
      appSeatData: { 2: { sampleSize: 5, style: 'nit' } },
    });
    expect(html).toMatch(/class="[^"]*ring-band-tiny[^"]*"[^>]*data-seat="2"/);
  });

  it('renders `—` unknown placeholder for occupied-zero seat', () => {
    const arc = buildSeatArcHTML(null, tableState, null, {
      currentLiveContext: liveCtx,
      appSeatData: { 2: { sampleSize: 0 } },
    });
    expect(arc).toMatch(/seat-sample-unknown[^"]*">\u2014/);
  });

  it('does NOT render `—` on a seat with hands', () => {
    const arc = buildSeatArcHTML(null, tableState, null, {
      currentLiveContext: liveCtx,
      appSeatData: { 2: { sampleSize: 42, style: 'tag' } },
    });
    // The `—` placeholder only appears for sampleSize === 0 seats.
    const seat2Html = arc.match(/data-seat="2"[\s\S]*?<\/div>/)?.[0] || '';
    expect(seat2Html).not.toContain('seat-sample-unknown');
  });

  it('emits rule-v-selected class on the Rule V override seat', () => {
    const arc = buildSeatArcHTML(null, tableState, null, {
      currentLiveContext: liveCtx,
      appSeatData: { 2: { sampleSize: 30 }, 3: { sampleSize: 30 } },
      rangeSelectedSeat: 3,
    });
    expect(arc).toMatch(/class="[^"]*rule-v-selected[^"]*"[^>]*data-seat="3"/);
    expect(arc).not.toMatch(/class="[^"]*rule-v-selected[^"]*"[^>]*data-seat="2"/);
  });

  it('does not emit rule-v-selected on hero even if range-selected pointed at hero', () => {
    const arc = buildSeatArcHTML(null, tableState, null, {
      currentLiveContext: liveCtx,
      appSeatData: {},
      rangeSelectedSeat: 1,
    });
    expect(arc).not.toContain('rule-v-selected');
  });
});

describe('SR-6.11 Z1 §1.11 — Rule V priority in computeFocusedVillain', () => {
  it('rangeSelectedSeat overrides pinnedVillainSeat', () => {
    const out = computeFocusedVillain({
      pinnedVillainSeat: 2,
      rangeSelectedSeat: 4,
      lastGoodAdvice: null,
      currentLiveContext: { heroSeat: 1 },
      currentTableState: null,
    });
    expect(out).toBe(4);
  });

  it('rangeSelectedSeat override does not target hero', () => {
    const out = computeFocusedVillain({
      pinnedVillainSeat: 3,
      rangeSelectedSeat: 1,
      lastGoodAdvice: null,
      currentLiveContext: { heroSeat: 1 },
      currentTableState: null,
    });
    expect(out).toBe(3); // falls through to pinned
  });

  it('pinnedVillainSeat still wins when rangeSelectedSeat is null', () => {
    const out = computeFocusedVillain({
      pinnedVillainSeat: 2,
      rangeSelectedSeat: null,
      lastGoodAdvice: { villainSeat: 5 },
      currentLiveContext: { heroSeat: 1 },
      currentTableState: null,
    });
    expect(out).toBe(2);
  });
});

describe('SR-6.11 Z1 — coordinator lifecycle for rangeSelectedSeat', () => {
  const make = () => new RenderCoordinator({ renderFn: () => {} });

  it('default rangeSelectedSeat is null', () => {
    expect(make().get('rangeSelectedSeat')).toBeNull();
  });

  it('snapshot surfaces rangeSelectedSeat', () => {
    const coord = make();
    coord.set('rangeSelectedSeat', 4);
    expect(coord.buildSnapshot().rangeSelectedSeat).toBe(4);
  });

  it('renderKey includes rangeSelectedSeat (flip forces re-render)', () => {
    const coord = make();
    const k1 = coord.buildRenderKey(coord.buildSnapshot());
    coord.set('rangeSelectedSeat', 7);
    const k2 = coord.buildRenderKey(coord.buildSnapshot());
    expect(k1).not.toBe(k2);
  });

  it('clearForTableSwitch clears rangeSelectedSeat', () => {
    const coord = make();
    coord.set('rangeSelectedSeat', 5);
    coord.clearForTableSwitch();
    expect(coord.get('rangeSelectedSeat')).toBeNull();
  });

  it('hand-boundary transition clears rangeSelectedSeat (Rule V hand-scoped)', () => {
    const coord = make();
    coord.handleLiveContext({ state: 'FLOP', currentStreet: 'flop', handNumber: 1 });
    coord.set('rangeSelectedSeat', 3);
    coord.handleLiveContext({ state: 'PREFLOP', currentStreet: 'preflop', handNumber: 2 });
    expect(coord.get('rangeSelectedSeat')).toBeNull();
  });
});

describe('SR-6.11 Z1 — source + CSS pins', () => {
  it('villain-tab click writes rangeSelectedSeat (not pinnedVillainSeat)', () => {
    // The old behavior wrote pinnedVillainSeat via the range-tab handler; the
    // Rule V contract decouples these — only the seat-circle handler still
    // writes pinnedVillainSeat, and only the range-tab handler writes
    // rangeSelectedSeat. Pin the new shape.
    expect(js).toMatch(/data-range-seat.*[\s\S]*?coordinator\.set\('rangeSelectedSeat'/);
    const rangeTabBlock = js.match(/Villain range tab clicks[\s\S]*?return;\s*\}/)?.[0] || '';
    expect(rangeTabBlock).toMatch(/rangeSelectedSeat/);
    expect(rangeTabBlock).not.toMatch(/pinnedVillainSeat/);
  });

  it('CSS defines ring-band-{tiny,small,medium,large} rules', () => {
    for (const band of ['tiny', 'small', 'medium', 'large']) {
      expect(html).toMatch(new RegExp(`\\.seat-circle\\.ring-band-${band}`));
    }
  });

  it('CSS defines rule-v-selected (dashed outline, distinct from pinned/focused)', () => {
    expect(html).toMatch(/\.seat-circle\.rule-v-selected/);
    expect(html).toMatch(/outline:\s*2px\s+dashed/);
  });

  it('CSS defines the `—` placeholder glyph', () => {
    expect(html).toMatch(/\.seat-sample-unknown/);
  });
});
