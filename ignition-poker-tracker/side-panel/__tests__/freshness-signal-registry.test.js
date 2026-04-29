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
} from '../../shared/render-staleness.js';

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
