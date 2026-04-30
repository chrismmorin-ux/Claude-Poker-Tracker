/**
 * freshness-signal-registry.test.js — Doctrine v4 R-1.8 + V-3 §II lint gates
 * for the §II freshness vocabulary resolved at SHC Gate 4 V-3 walkthrough
 * (2026-04-27) and implemented at Gate 5 PR-4 (2026-04-29). Provides
 * INV-FRESH-1..5 partial coverage at the module + signal-declaration layer.
 *
 * Asserts:
 *   - Closed 5-tier register (V-3 §II.1) — live / aging / stale / unknown
 *     / rejected
 *   - Closed mechanism registry — timer-driven-aging / state-event-driven
 *     / sw-replay-rejection / unknown
 *   - Canonical signal registry: each entry declares { scope, mechanism,
 *     clearingPath, singleWriter, visibleRejection } per §II.3
 *   - mapAgeToTier() classifier (default thresholds + rejected /
 *     street-mismatch overrides + unknown for null/non-finite ageMs)
 *   - getStaleBadgeText() label generator (tier + reason interactions)
 *   - renderStaleBadge() output (canonical .stale-badge markup with
 *     data-fresh-* declarations + ARIA polite-status contract)
 *   - tier / mechanism validation throws on values outside closed
 *     enumerations
 *
 * Doctrine source: docs/SIDEBAR_DESIGN_PRINCIPLES.md §1 R-1.8.
 * Shell-spec source: docs/design/surfaces/sidebar-shell-spec.md §II.
 */

import { describe, it, expect } from 'vitest';
import {
  FRESHNESS_TIERS,
  FRESHNESS_MECHANISMS,
  FRESH_SIGNAL_REGISTRY,
  mapAgeToTier,
  getStaleBadgeText,
  renderStaleBadge,
  classifyFreshness,
  renderFreshnessDot,
  renderConfidenceForFreshness,
} from '../../shared/render-staleness.js';
import { CONFIDENCE_TIERS } from '../../shared/render-confidence.js';

describe('§II freshness — closed 5-tier register (V-3 §II.1)', () => {
  it('exposes exactly 5 tiers', () => {
    expect(Object.keys(FRESHNESS_TIERS)).toHaveLength(5);
  });

  it('the 5 tiers are live / aging / stale / unknown / rejected', () => {
    expect(Object.values(FRESHNESS_TIERS).sort()).toEqual(
      ['aging', 'live', 'rejected', 'stale', 'unknown'],
    );
  });

  it('FRESHNESS_TIERS is frozen (closed register)', () => {
    expect(Object.isFrozen(FRESHNESS_TIERS)).toBe(true);
  });
});

describe('§II freshness — closed mechanism registry (V-3 §II.2 + INV-FRESH-2)', () => {
  it('exposes the canonical 4 mechanisms', () => {
    expect(Object.values(FRESHNESS_MECHANISMS).sort()).toEqual(
      ['state-event-driven', 'sw-replay-rejection', 'timer-driven-aging', 'unknown'],
    );
  });

  it('FRESHNESS_MECHANISMS is frozen', () => {
    expect(Object.isFrozen(FRESHNESS_MECHANISMS)).toBe(true);
  });
});

describe('§II.3 canonical signal registry — INV-FRESH-1..5 declarations', () => {
  it('every signal entry declares the 5 required fields', () => {
    const required = ['scope', 'mechanism', 'clearingPath', 'singleWriter', 'visibleRejection'];
    for (const [key, entry] of Object.entries(FRESH_SIGNAL_REGISTRY)) {
      for (const field of required) {
        expect(entry[field], `${key} missing field "${field}"`).toBeDefined();
      }
    }
  });

  it('every signal mechanism is from the closed mechanism registry', () => {
    const valid = new Set(Object.values(FRESHNESS_MECHANISMS));
    for (const [key, entry] of Object.entries(FRESH_SIGNAL_REGISTRY)) {
      expect(valid.has(entry.mechanism), `${key}.mechanism "${entry.mechanism}" not registered`).toBe(true);
    }
  });

  it('every signal entry is frozen', () => {
    for (const [key, entry] of Object.entries(FRESH_SIGNAL_REGISTRY)) {
      expect(Object.isFrozen(entry), `${key} entry not frozen`).toBe(true);
    }
  });

  it('FRESH_SIGNAL_REGISTRY contains the canonical STALE_ADVICE signal', () => {
    expect(FRESH_SIGNAL_REGISTRY.STALE_ADVICE).toBeDefined();
    expect(FRESH_SIGNAL_REGISTRY.STALE_ADVICE.name).toBe('stale-advice');
    expect(FRESH_SIGNAL_REGISTRY.STALE_ADVICE.mechanism).toBe(FRESHNESS_MECHANISMS.TIMER_DRIVEN_AGING);
    expect(FRESH_SIGNAL_REGISTRY.STALE_ADVICE.singleWriter).toMatch(/updateStaleAdviceBadge/);
  });
});

describe('mapAgeToTier — age classifier with reason overrides', () => {
  it('ageMs ≤ 10s default → LIVE', () => {
    expect(mapAgeToTier(0)).toBe(FRESHNESS_TIERS.LIVE);
    expect(mapAgeToTier(5_000)).toBe(FRESHNESS_TIERS.LIVE);
    expect(mapAgeToTier(10_000)).toBe(FRESHNESS_TIERS.LIVE);
  });

  it('10s < ageMs ≤ 60s default → AGING', () => {
    expect(mapAgeToTier(10_001)).toBe(FRESHNESS_TIERS.AGING);
    expect(mapAgeToTier(30_000)).toBe(FRESHNESS_TIERS.AGING);
    expect(mapAgeToTier(60_000)).toBe(FRESHNESS_TIERS.AGING);
  });

  it('ageMs > 60s default → STALE', () => {
    expect(mapAgeToTier(60_001)).toBe(FRESHNESS_TIERS.STALE);
    expect(mapAgeToTier(120_000)).toBe(FRESHNESS_TIERS.STALE);
  });

  it('null / NaN / undefined ageMs → UNKNOWN', () => {
    expect(mapAgeToTier(null)).toBe(FRESHNESS_TIERS.UNKNOWN);
    expect(mapAgeToTier(NaN)).toBe(FRESHNESS_TIERS.UNKNOWN);
    expect(mapAgeToTier(undefined)).toBe(FRESHNESS_TIERS.UNKNOWN);
  });

  it('reason="street-mismatch" forces STALE regardless of age', () => {
    expect(mapAgeToTier(0, { reason: 'street-mismatch' })).toBe(FRESHNESS_TIERS.STALE);
    expect(mapAgeToTier(null, { reason: 'street-mismatch' })).toBe(FRESHNESS_TIERS.STALE);
  });

  it('reason="rejected" forces REJECTED regardless of age', () => {
    expect(mapAgeToTier(0, { reason: 'rejected' })).toBe(FRESHNESS_TIERS.REJECTED);
    expect(mapAgeToTier(120_000, { reason: 'rejected' })).toBe(FRESHNESS_TIERS.REJECTED);
  });

  it('custom thresholds override defaults', () => {
    expect(mapAgeToTier(5_000, { agingMs: 1_000, staleMs: 3_000 })).toBe(FRESHNESS_TIERS.STALE);
    expect(mapAgeToTier(2_000, { agingMs: 1_000, staleMs: 3_000 })).toBe(FRESHNESS_TIERS.AGING);
  });
});

describe('getStaleBadgeText — canonical badge label generator', () => {
  it('reason="street-mismatch" → "Stale — recomputing"', () => {
    expect(getStaleBadgeText({ tier: FRESHNESS_TIERS.STALE, reason: 'street-mismatch' }))
      .toBe('Stale — recomputing');
  });

  it('REJECTED tier → "Rejected"', () => {
    expect(getStaleBadgeText({ tier: FRESHNESS_TIERS.REJECTED })).toBe('Rejected');
  });

  it('AGING tier with ageSec → "Stale Ns"', () => {
    expect(getStaleBadgeText({ tier: FRESHNESS_TIERS.AGING, ageSec: 25 })).toBe('Stale 25s');
  });

  it('STALE tier with ageSec → "Stale Ns"', () => {
    expect(getStaleBadgeText({ tier: FRESHNESS_TIERS.STALE, ageSec: 90 })).toBe('Stale 90s');
  });

  it('rounds ageSec', () => {
    expect(getStaleBadgeText({ tier: FRESHNESS_TIERS.AGING, ageSec: 24.6 })).toBe('Stale 25s');
  });

  it('omitted ageSec → "Stale" (no number)', () => {
    expect(getStaleBadgeText({ tier: FRESHNESS_TIERS.STALE })).toBe('Stale');
  });

  it('UNKNOWN tier → "Stale" (defensive label)', () => {
    expect(getStaleBadgeText({ tier: FRESHNESS_TIERS.UNKNOWN })).toBe('Stale');
  });
});

describe('renderStaleBadge — canonical badge HTML', () => {
  it('emits .stale-badge with .fresh-tier-* concept-class isolation', () => {
    const html = renderStaleBadge({ tier: FRESHNESS_TIERS.AGING, ageSec: 25 });
    expect(html).toContain('class="stale-badge fresh-tier-aging"');
  });

  it('emits data-fresh-tier / data-fresh-mechanism / data-fresh-scope attrs (§II.3)', () => {
    const html = renderStaleBadge({ tier: FRESHNESS_TIERS.STALE, ageSec: 90 });
    expect(html).toContain('data-fresh-tier="stale"');
    expect(html).toContain('data-fresh-mechanism="timer-driven-aging"');
    expect(html).toContain('data-fresh-scope="Z2-action-bar"');
  });

  it('emits ARIA polite-status contract', () => {
    const html = renderStaleBadge({ tier: FRESHNESS_TIERS.STALE });
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it('threads through scope override', () => {
    const html = renderStaleBadge({ tier: FRESHNESS_TIERS.AGING, scope: 'Z0-status-bar' });
    expect(html).toContain('data-fresh-scope="Z0-status-bar"');
  });

  it('threads through mechanism override', () => {
    const html = renderStaleBadge({
      tier: FRESHNESS_TIERS.REJECTED,
      mechanism: FRESHNESS_MECHANISMS.SW_REPLAY_REJECTION,
    });
    expect(html).toContain('data-fresh-mechanism="sw-replay-rejection"');
  });

  it('throws on tier outside closed enumeration', () => {
    expect(() => renderStaleBadge({ tier: 'fresh' })).toThrow(/not in closed 5-tier register/);
  });

  it('throws on mechanism outside closed registry', () => {
    expect(() => renderStaleBadge({
      tier: FRESHNESS_TIERS.AGING,
      mechanism: 'magic-pubsub',
    })).toThrow(/not in closed registry/);
  });

  it('throws when called with no arguments', () => {
    expect(() => renderStaleBadge()).toThrow(/not in closed 5-tier register/);
  });
});

// =========================================================================
// V-3 §II.7 API contract — classifyFreshness composed pure classifier
// =========================================================================
// Shipped at Gate 5 PR-13 (2026-04-30). Integrates the conditions from
// §II.1 (rejection / age / street-mismatch / staleContext / _receivedAt
// presence) into a single tier classification.

describe('classifyFreshness — composed pure classifier (V-3 §II.7)', () => {
  const adviceAt = (offset, extras = {}) => ({
    _receivedAt: 1000 + offset,
    currentStreet: 'flop',
    ...extras,
  });
  const ctx = (street = 'flop') => ({ currentStreet: street });
  const NOW = 1000; // age = NOW - advice._receivedAt; using offset=0 → ageMs=0

  it('returns UNKNOWN when advice is null', () => {
    expect(classifyFreshness(null, ctx(), {}, NOW)).toBe(FRESHNESS_TIERS.UNKNOWN);
  });

  it('returns UNKNOWN when advice._receivedAt is null/undefined', () => {
    expect(classifyFreshness({ currentStreet: 'flop' }, ctx(), {}, NOW))
      .toBe(FRESHNESS_TIERS.UNKNOWN);
    expect(classifyFreshness({ _receivedAt: null, currentStreet: 'flop' }, ctx(), {}, NOW))
      .toBe(FRESHNESS_TIERS.UNKNOWN);
  });

  it('returns LIVE when ageMs ≤ 10s default and no other conditions', () => {
    const advice = { _receivedAt: NOW - 5_000, currentStreet: 'flop' };
    expect(classifyFreshness(advice, ctx(), {}, NOW)).toBe(FRESHNESS_TIERS.LIVE);
  });

  it('returns AGING when 10s < ageMs ≤ 60s and no other conditions', () => {
    const advice = { _receivedAt: NOW - 30_000, currentStreet: 'flop' };
    expect(classifyFreshness(advice, ctx(), {}, NOW)).toBe(FRESHNESS_TIERS.AGING);
  });

  it('returns STALE when ageMs > 60s', () => {
    const advice = { _receivedAt: NOW - 90_000, currentStreet: 'flop' };
    expect(classifyFreshness(advice, ctx(), {}, NOW)).toBe(FRESHNESS_TIERS.STALE);
  });

  it('street-mismatch forces STALE regardless of age', () => {
    // Fresh advice (5s) but advice's street differs from live ctx → STALE.
    const advice = { _receivedAt: NOW - 5_000, currentStreet: 'flop' };
    expect(classifyFreshness(advice, ctx('turn'), {}, NOW)).toBe(FRESHNESS_TIERS.STALE);
  });

  it('staleContext flag forces STALE for fresh advice', () => {
    const advice = { _receivedAt: NOW - 5_000, currentStreet: 'flop' };
    expect(classifyFreshness(advice, ctx(), { staleContext: true }, NOW))
      .toBe(FRESHNESS_TIERS.STALE);
  });

  it('rejected flag on advice forces REJECTED tier', () => {
    // Per spec §II.1 "RT-68/69 SW-replay rejection observable to the
    // coordinator" — the rejection is short-circuit; even fresh advice
    // surfaces as REJECTED.
    const advice = { _receivedAt: NOW - 5_000, currentStreet: 'flop', rejected: true };
    expect(classifyFreshness(advice, ctx(), {}, NOW)).toBe(FRESHNESS_TIERS.REJECTED);
  });

  it('rejected flag on coordState forces REJECTED tier', () => {
    const advice = { _receivedAt: NOW - 5_000, currentStreet: 'flop' };
    expect(classifyFreshness(advice, ctx(), { rejected: true }, NOW))
      .toBe(FRESHNESS_TIERS.REJECTED);
  });

  it('liveCtx with no currentStreet does not trigger street-mismatch', () => {
    // Defensive — the comparison short-circuits when liveCtx.currentStreet
    // is missing (boot-race / hand-end). Falls through to age-based.
    const advice = { _receivedAt: NOW - 5_000, currentStreet: 'flop' };
    expect(classifyFreshness(advice, { currentStreet: null }, {}, NOW))
      .toBe(FRESHNESS_TIERS.LIVE);
  });

  it('advice with no currentStreet does not trigger street-mismatch', () => {
    const advice = { _receivedAt: NOW - 5_000 }; // no currentStreet
    expect(classifyFreshness(advice, ctx('turn'), {}, NOW))
      .toBe(FRESHNESS_TIERS.LIVE);
  });

  it('caller-defined thresholds override defaults', () => {
    // 5s age with custom 1s/3s thresholds → STALE.
    const advice = { _receivedAt: NOW - 5_000, currentStreet: 'flop' };
    expect(classifyFreshness(advice, ctx(), {}, NOW, { agingMs: 1_000, staleMs: 3_000 }))
      .toBe(FRESHNESS_TIERS.STALE);
  });
});

// =========================================================================
// V-3 §II.1 — renderFreshnessDot AGING/UNKNOWN/REJECTED tier dot
// =========================================================================

describe('renderFreshnessDot — AGING/UNKNOWN/REJECTED tier dot emission (PR-13)', () => {
  it('emits .freshness-dot with .fresh-tier-* concept-class isolation', () => {
    const html = renderFreshnessDot({ tier: FRESHNESS_TIERS.AGING });
    expect(html).toContain('class="freshness-dot fresh-tier-aging"');
  });

  it('returns empty string for LIVE tier (absence is the signal)', () => {
    expect(renderFreshnessDot({ tier: FRESHNESS_TIERS.LIVE })).toBe('');
  });

  it('emits data-fresh-* declarations per §II.3 registry contract', () => {
    const html = renderFreshnessDot({ tier: FRESHNESS_TIERS.AGING });
    expect(html).toContain('data-fresh-tier="aging"');
    expect(html).toContain('data-fresh-mechanism="timer-driven-aging"');
    expect(html).toContain('data-fresh-scope="Z2-action-bar"');
  });

  it('emits ARIA polite-status contract per §II.10', () => {
    const html = renderFreshnessDot({ tier: FRESHNESS_TIERS.UNKNOWN });
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it('threads through ariaLabel when provided', () => {
    const html = renderFreshnessDot({
      tier: FRESHNESS_TIERS.AGING,
      ariaLabel: 'Advice 25s old',
    });
    expect(html).toContain('aria-label="Advice 25s old"');
  });

  it('escapes quotes in ariaLabel', () => {
    const html = renderFreshnessDot({
      tier: FRESHNESS_TIERS.AGING,
      ariaLabel: 'Quote " test',
    });
    expect(html).toContain('Quote &quot; test');
  });

  it('threads through scope override (cross-zone reuse)', () => {
    const html = renderFreshnessDot({
      tier: FRESHNESS_TIERS.AGING,
      scope: 'Z3-card-strip',
    });
    expect(html).toContain('data-fresh-scope="Z3-card-strip"');
  });

  it('throws on tier outside closed enumeration', () => {
    expect(() => renderFreshnessDot({ tier: 'fresh' }))
      .toThrow(/not in closed 5-tier register/);
  });

  it('throws on mechanism outside closed registry', () => {
    expect(() => renderFreshnessDot({
      tier: FRESHNESS_TIERS.AGING,
      mechanism: 'magic-pubsub',
    })).toThrow(/not in closed registry/);
  });
});

// =========================================================================
// V-3 §II.6 — renderConfidenceForFreshness V-2.4 carry-forward gate
// =========================================================================
// Spec: when freshness ∈ {stale, rejected, unknown}, force confidence-unknown
// regardless of mq.overallSource. AGING/LIVE pass through to actual tier.

describe('renderConfidenceForFreshness — V-2.4 carry-forward gate (PR-13)', () => {
  const adviceWithMq = (source) => ({
    modelQuality: { overallSource: source },
    villainSampleSize: 50,
  });

  it('STALE freshness forces conf-tier-unknown regardless of mq', () => {
    const html = renderConfidenceForFreshness(
      adviceWithMq('player_model'), // would otherwise be HIGH confidence
      FRESHNESS_TIERS.STALE,
    );
    expect(html).toContain(`conf-tier-${CONFIDENCE_TIERS.UNKNOWN}`);
    expect(html).not.toContain('conf-tier-high');
  });

  it('REJECTED freshness forces conf-tier-unknown', () => {
    const html = renderConfidenceForFreshness(
      adviceWithMq('mixed'),
      FRESHNESS_TIERS.REJECTED,
    );
    expect(html).toContain(`conf-tier-${CONFIDENCE_TIERS.UNKNOWN}`);
  });

  it('UNKNOWN freshness forces conf-tier-unknown', () => {
    const html = renderConfidenceForFreshness(
      adviceWithMq('player_model'),
      FRESHNESS_TIERS.UNKNOWN,
    );
    expect(html).toContain(`conf-tier-${CONFIDENCE_TIERS.UNKNOWN}`);
  });

  it('LIVE freshness preserves actual confidence tier (HIGH from player_model)', () => {
    const html = renderConfidenceForFreshness(
      adviceWithMq('player_model'),
      FRESHNESS_TIERS.LIVE,
    );
    expect(html).toContain('conf-tier-high');
  });

  it('AGING freshness preserves actual confidence tier (MEDIUM from mixed)', () => {
    const html = renderConfidenceForFreshness(
      adviceWithMq('mixed'),
      FRESHNESS_TIERS.AGING,
    );
    expect(html).toContain('conf-tier-mid');
  });

  it('AGING freshness preserves LOW confidence from population source', () => {
    const html = renderConfidenceForFreshness(
      adviceWithMq('population'),
      FRESHNESS_TIERS.AGING,
    );
    expect(html).toContain('conf-tier-low');
  });

  it('LIVE with absent modelQuality renders conf-tier-unknown (mq is itself unknown)', () => {
    const html = renderConfidenceForFreshness({}, FRESHNESS_TIERS.LIVE);
    expect(html).toContain('conf-tier-unknown');
  });

  it('LIVE includes sample-size label when present', () => {
    const html = renderConfidenceForFreshness(adviceWithMq('player_model'), FRESHNESS_TIERS.LIVE);
    expect(html).toContain('n=50');
  });

  it('STALE does not include sample-size label (modelQuality is forcibly unknown)', () => {
    // Even though advice has sampleSize=50, stale freshness pre-clears the
    // chain — there's no `n=` label since mq is treated as null.
    const html = renderConfidenceForFreshness(adviceWithMq('player_model'), FRESHNESS_TIERS.STALE);
    expect(html).not.toContain('n=50');
  });

  it('throws on freshness tier outside closed enumeration', () => {
    expect(() => renderConfidenceForFreshness({}, 'maybe-stale'))
      .toThrow(/not in closed 5-tier register/);
  });
});

// =========================================================================
// V-3 §II RT-68/69 rejection wiring — PR-17 (2026-04-30)
// =========================================================================
// PR-17 wires the REJECTED freshness tier to RenderCoordinator's
// handleAdvice rejection paths + RT-69 _pendingAdvice force-clear at
// hand-new boundary. The state slot `lastRejectionAt` is set on rejection
// and cleared on accept / hand-new / table-switch. INV-FRESH-5
// (rejection-is-visible) requires STALE_ADVICE.visibleRejection: true.

describe('V-3 §II RT-68/69 — RenderCoordinator rejection state machine (PR-17)', () => {
  // Direct import to avoid the side-panel.js IIFE — the coordinator's
  // rejection-event surface is what we exercise here.
  const buildCoord = async () => {
    const { RenderCoordinator } = await import('../render-coordinator.js');
    let now = 1000;
    return new RenderCoordinator({
      renderFn: () => {},
      getTimestamp: () => now,
      requestFrame: (cb) => setTimeout(cb, 0),
      setTimeout: (cb, ms) => setTimeout(cb, ms),
      clearTimeout: (id) => clearTimeout(id),
      _setNow: (t) => { now = t; },
    });
  };

  const liveCtx = (street = 'flop', handNumber = 100, state = 'FLOP') => ({
    state,
    currentStreet: street,
    heroSeat: 1,
    pot: 20,
    foldedSeats: [],
    actionSequence: [],
    activeSeatNumbers: [1, 3, 5],
    communityCards: ['Ah', 'Kh', '7c'],
    handNumber,
  });

  const advice = (street = 'flop', handNumber = 100) => ({
    currentStreet: street,
    handNumber,
    villainSeat: 3,
    recommendations: [{ action: 'bet', ev: 5.2 }],
  });

  it('lastRejectionAt is null on a fresh coordinator', async () => {
    const coord = await buildCoord();
    expect(coord.get('lastRejectionAt')).toBe(null);
  });

  it('cross-hand contamination stamps lastRejectionAt (RT-68 path 1)', async () => {
    const coord = await buildCoord();
    coord.handleLiveContext(liveCtx('flop', 100));
    expect(coord.get('lastRejectionAt')).toBe(null);
    // Advice for a different hand (101) than the locked hand (100)
    coord.handleAdvice(advice('flop', 101));
    expect(coord.get('lastRejectionAt')).toBeTruthy();
  });

  it('stale-earlier-street advice stamps lastRejectionAt (RT-68 path 2)', async () => {
    const coord = await buildCoord();
    coord.handleLiveContext(liveCtx('turn', 100));
    coord.handleAdvice(advice('flop', 100)); // earlier street
    expect(coord.get('lastRejectionAt')).toBeTruthy();
  });

  it('successful accept clears lastRejectionAt', async () => {
    const coord = await buildCoord();
    coord.handleLiveContext(liveCtx('flop', 100));
    coord.handleAdvice(advice('flop', 999)); // cross-hand → rejected
    expect(coord.get('lastRejectionAt')).toBeTruthy();
    coord.handleAdvice(advice('flop', 100)); // matching → accepted
    expect(coord.get('lastRejectionAt')).toBe(null);
  });

  it('clearForTableSwitch nulls lastRejectionAt', async () => {
    const coord = await buildCoord();
    coord.handleLiveContext(liveCtx('flop', 100));
    coord.handleAdvice(advice('flop', 999)); // cross-hand → rejected
    expect(coord.get('lastRejectionAt')).toBeTruthy();
    coord.clearForTableSwitch();
    expect(coord.get('lastRejectionAt')).toBe(null);
  });

  it('hand-new boundary clears lastRejectionAt when no pending advice', async () => {
    const coord = await buildCoord();
    coord.handleLiveContext(liveCtx('flop', 100));
    coord.handleAdvice(advice('flop', 999));
    expect(coord.get('lastRejectionAt')).toBeTruthy();
    // New hand boundary (PREFLOP) — no pending advice held → rejection clears
    coord.handleLiveContext(liveCtx('preflop', 101, 'PREFLOP'));
    expect(coord.get('lastRejectionAt')).toBe(null);
  });

  it('RT-69 force-clear of pending advice stamps lastRejectionAt at hand boundary', async () => {
    const coord = await buildCoord();
    // Send advice with no live context — held in _pendingAdvice
    coord.handleAdvice(advice('flop', 100));
    expect(coord.get('lastRejectionAt')).toBe(null); // no rejection yet (just held)
    // New hand boundary arrives — pending advice is force-cleared (it was
    // for a different hand than the one that just started)
    coord.handleLiveContext(liveCtx('preflop', 200, 'PREFLOP'));
    // RT-69 force-clear stamped a rejection (the held advice was discarded)
    expect(coord.get('lastRejectionAt')).toBeTruthy();
  });

  it('lastRejectionAt is surfaced in buildSnapshot', async () => {
    const coord = await buildCoord();
    expect(coord.buildSnapshot().lastRejectionAt).toBe(null);
    coord.handleLiveContext(liveCtx('flop', 100));
    coord.handleAdvice(advice('flop', 999));
    expect(coord.buildSnapshot().lastRejectionAt).toBeTruthy();
  });
});

describe('V-3 §II — STALE_ADVICE.visibleRejection alignment with INV-FRESH-5 (PR-17)', () => {
  it('FRESH_SIGNAL_REGISTRY.STALE_ADVICE.visibleRejection is true', () => {
    // INV-FRESH-5: "rejection is visible" — RT-68/69 SW-replay rejection
    // surfaces as `rejected` tier, distinct from `unknown`. The stale-
    // badge is the canonical Z2-action-bar consumer; its registry entry
    // must declare visibleRejection: true to align.
    expect(FRESH_SIGNAL_REGISTRY.STALE_ADVICE.visibleRejection).toBe(true);
  });
});
