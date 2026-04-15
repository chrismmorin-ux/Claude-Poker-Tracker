/**
 * z2-decision.test.js — SR-6.12 enforcement.
 *
 * A) B2 fix (Z2 §2.3 + §2.4): equity + EV edge on headline row (ab-row1);
 *    row 2 becomes SPR-only. Preflop-unknown equity shows R-4.2 placeholder.
 * B) B1 fix (Z2 §2.7 + §2.8): between-hands state (COMPLETE/IDLE) must blank
 *    pot chip + street pill in the unified header.
 * C) Z2 §2.10 consolidated: `computeAdviceStaleness` helper is the single
 *    source of truth (source-level pin — both render path + 1 Hz timer call
 *    the helper; no duplicated `_receivedAt` arithmetic remains elsewhere).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  buildActionBarHTML,
  buildUnifiedHeaderHTML,
} from '../render-orchestrator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JS_PATH = resolve(__dirname, '..', 'side-panel.js');
const js = readFileSync(JS_PATH, 'utf8');

const baseAdvice = (overrides = {}) => ({
  recommendations: [{ action: 'bet', ev: 2.1, sizing: { betFraction: 0.5, betSize: 10 } }],
  heroEquity: 0.72,
  spr: 3.8,
  currentStreet: 'flop',
  _receivedAt: Date.now(),
  ...overrides,
});
const baseLive = (overrides = {}) => ({
  state: 'FLOP',
  currentStreet: 'flop',
  pot: 19,
  heroSeat: 1,
  ...overrides,
});

describe('SR-6.12 B2 — equity + EV edge in headline row', () => {
  it('renders equity in ab-row1 (not ab-row2)', () => {
    const { html } = buildActionBarHTML(baseAdvice(), baseLive());
    const row1 = html.match(/<div class="ab-row1">([\s\S]*?)<\/div>/)?.[1] || '';
    expect(row1).toContain('72% equity');
    expect(row1).toContain('ab-equity');
    // EV edge also moved to row 1
    expect(row1).toMatch(/ab-ev-edge[^>]*>\+2\.1 edge/);
  });

  it('preflop unknown equity renders —% equity placeholder (R-4.2)', () => {
    const { html } = buildActionBarHTML(baseAdvice({ heroEquity: null }), baseLive());
    expect(html).toContain('\u2014% equity');
    expect(html).toContain('ab-equity-unknown');
  });

  it('equity given as fraction 0–1 renders as percent (defends mixed-unit bug)', () => {
    const { html } = buildActionBarHTML(baseAdvice({ heroEquity: 0.42 }), baseLive());
    expect(html).toContain('42% equity');
  });

  it('equity given as integer 0–100 renders without ×100 doubling', () => {
    const { html } = buildActionBarHTML(baseAdvice({ heroEquity: 65 }), baseLive());
    expect(html).toContain('65% equity');
  });
});

describe('SR-6.12 §2.4 — row 2 is SPR-only', () => {
  it('renders SPR: 3.8 in ab-row2', () => {
    const { html } = buildActionBarHTML(baseAdvice(), baseLive());
    const row2 = html.match(/<div class="ab-row2">([\s\S]*?)<\/div>/)?.[1] || '';
    expect(row2).toContain('ab-spr');
    expect(row2).toContain('SPR: 3.8');
  });

  it('SPR unknown renders R-4.2 placeholder preserving row height', () => {
    const { html } = buildActionBarHTML(baseAdvice({ spr: null }), baseLive());
    const row2 = html.match(/<div class="ab-row2">([\s\S]*?)<\/div>/)?.[1] || '';
    expect(row2).toContain('SPR: \u2014');
    expect(row2).toContain('ab-spr-unknown');
  });

  it('row 2 does NOT duplicate equity (sole owner is headline)', () => {
    const { html } = buildActionBarHTML(baseAdvice(), baseLive());
    const row2 = html.match(/<div class="ab-row2">([\s\S]*?)<\/div>/)?.[1] || '';
    expect(row2).not.toContain('equity');
  });
});

describe('SR-6.12 B1 — pot + street blank between hands', () => {
  it('COMPLETE state: pot-inline not rendered', () => {
    const live = baseLive({ state: 'COMPLETE', pot: 42 });
    const { html } = buildUnifiedHeaderHTML(baseAdvice({ potSize: 42 }), live, {
      currentLiveContext: live,
      appSeatData: {},
    });
    expect(html).not.toContain('pot-inline');
  });

  it('COMPLETE state: street pill not rendered', () => {
    const live = baseLive({ state: 'COMPLETE' });
    const { html } = buildUnifiedHeaderHTML(baseAdvice(), live, {
      currentLiveContext: live,
      appSeatData: {},
    });
    expect(html).not.toMatch(/class="pill street"/);
  });

  it('IDLE state: pot + street both blank', () => {
    const live = baseLive({ state: 'IDLE' });
    const { html } = buildUnifiedHeaderHTML(baseAdvice({ potSize: 42 }), live, {
      currentLiveContext: live,
      appSeatData: {},
    });
    expect(html).not.toContain('pot-inline');
    expect(html).not.toMatch(/class="pill street"/);
  });

  it('active hand (FLOP): pot + street both render', () => {
    const { html } = buildUnifiedHeaderHTML(baseAdvice(), baseLive(), {
      currentLiveContext: baseLive(),
      appSeatData: {},
    });
    expect(html).toContain('pot-inline');
    expect(html).toMatch(/class="pill street"/);
  });
});

describe('SR-6.12 §2.10 — stale-advice consolidation (source pin)', () => {
  it('computeAdviceStaleness helper exists (single source of truth)', () => {
    expect(js).toMatch(/const computeAdviceStaleness = \(advice, ctx, now = Date\.now\(\)\)/);
  });

  it('render path calls computeAdviceStaleness (not inline arithmetic)', () => {
    const renderBlock = js.match(/--- RT-48[\s\S]*?updateStaleAdviceBadge\(isAdviceStale, adviceAgeMs, staleReason\);/)?.[0] || '';
    expect(renderBlock).toMatch(/computeAdviceStaleness\(advice, liveCtx\)/);
    // Key regression guard: the old inline `Date.now() - adviceReceivedAt`
    // arithmetic and the old `isStreetMismatch` recomputation in the render
    // path must not coexist with the helper.
    expect(renderBlock).not.toMatch(/Date\.now\(\) - adviceReceivedAt/);
    expect(renderBlock).not.toMatch(/advice\.currentStreet !== liveCtx\.currentStreet/);
  });

  it('1 Hz age badge timer also calls computeAdviceStaleness', () => {
    const timerBlock = js.match(/scheduleTimer\('adviceAgeBadge'[\s\S]*?'interval'\)\);/)?.[0] || '';
    expect(timerBlock).toMatch(/computeAdviceStaleness\(advice, ctx\)/);
  });

  it('helper body returns the four documented reason branches', () => {
    // Source-level pin: every branch identifier must appear exactly once in
    // the helper body so future edits that drop a branch fail the gate.
    const body = js.match(/const computeAdviceStaleness = [\s\S]*?\n  \};/)?.[0] || '';
    expect(body).toMatch(/reason: null/);
    expect(body).toMatch(/reason: 'street-mismatch'/);
    expect(body).toMatch(/reason: aged \? 'aged' : null/);
    expect(body).toMatch(/ageMs > 10_000 \|\| !ctx/);
  });
});
