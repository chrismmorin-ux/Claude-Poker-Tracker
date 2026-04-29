/**
 * confidence-registry.test.js — Doctrine v3 R-1.6 + V-2 §III lint gates
 * for the §III confidence vocabulary resolved at SHC Gate 4 V-2 walkthrough
 * (2026-04-27) and implemented at Gate 5 PR-3 (2026-04-29). Closes the
 * D-1 forensic — confidence rendered three incompatible ways across
 * render-orchestrator.js + render-tiers.js + cs-value opacity classes.
 *
 * Asserts:
 *   - Closed 4-tier register (V-2 §III) — high / mid / low / unknown
 *   - mapModelSourceToTier() bridges legacy `mq.overallSource` axis
 *     (player_model / mixed / population / null) onto the new tiers
 *   - renderConfidenceBadge() output (canonical .confidence-dot +
 *     .conf-tier-* ordinal class; optional `n=N` label per §III.4 +
 *     INV-DENSITY-3; aria-label / title threaded through)
 *   - tier validation (rejects values outside the closed enumeration)
 *
 * Doctrine source: docs/SIDEBAR_DESIGN_PRINCIPLES.md §1 R-1.6.
 * Shell-spec source: docs/design/surfaces/sidebar-shell-spec.md §III.
 */

import { describe, it, expect } from 'vitest';
import {
  CONFIDENCE_TIERS,
  TIER_LABELS,
  mapModelSourceToTier,
  renderConfidenceBadge,
} from '../../shared/render-confidence.js';

describe('§III confidence — closed 4-tier register (V-2 §III)', () => {
  it('exposes exactly 4 tiers', () => {
    expect(Object.keys(CONFIDENCE_TIERS)).toHaveLength(4);
  });

  it('the 4 tiers are high / mid / low / unknown', () => {
    const values = Object.values(CONFIDENCE_TIERS).sort();
    expect(values).toEqual(['high', 'low', 'mid', 'unknown']);
  });

  it('CONFIDENCE_TIERS is frozen (closed register)', () => {
    expect(Object.isFrozen(CONFIDENCE_TIERS)).toBe(true);
  });

  it('TIER_LABELS has a label for every tier', () => {
    for (const tier of Object.values(CONFIDENCE_TIERS)) {
      expect(TIER_LABELS[tier], `missing label for "${tier}"`).toBeTruthy();
    }
  });

  it('TIER_LABELS is frozen', () => {
    expect(Object.isFrozen(TIER_LABELS)).toBe(true);
  });
});

describe('mapModelSourceToTier — legacy axis bridge', () => {
  it('player_model → high', () => {
    expect(mapModelSourceToTier('player_model')).toBe(CONFIDENCE_TIERS.HIGH);
  });

  it('mixed → mid', () => {
    expect(mapModelSourceToTier('mixed')).toBe(CONFIDENCE_TIERS.MEDIUM);
  });

  it('population → low', () => {
    expect(mapModelSourceToTier('population')).toBe(CONFIDENCE_TIERS.LOW);
  });

  it('null → unknown', () => {
    expect(mapModelSourceToTier(null)).toBe(CONFIDENCE_TIERS.UNKNOWN);
  });

  it('undefined → unknown', () => {
    expect(mapModelSourceToTier(undefined)).toBe(CONFIDENCE_TIERS.UNKNOWN);
  });

  it('unrecognized string → unknown (defensive default)', () => {
    expect(mapModelSourceToTier('foobar')).toBe(CONFIDENCE_TIERS.UNKNOWN);
  });
});

describe('renderConfidenceBadge — canonical confidence-dot markup', () => {
  it('emits .confidence-dot with .conf-tier-{tier} ordinal class', () => {
    const html = renderConfidenceBadge({ tier: 'high' });
    expect(html).toContain('class="confidence-dot conf-tier-high"');
  });

  it('emits each of the 4 tier classes', () => {
    expect(renderConfidenceBadge({ tier: 'high' })).toContain('conf-tier-high');
    expect(renderConfidenceBadge({ tier: 'mid' })).toContain('conf-tier-mid');
    expect(renderConfidenceBadge({ tier: 'low' })).toContain('conf-tier-low');
    expect(renderConfidenceBadge({ tier: 'unknown' })).toContain('conf-tier-unknown');
  });

  it('emits dot-only HTML when sampleSize is omitted', () => {
    const html = renderConfidenceBadge({ tier: 'mid' });
    expect(html).not.toContain('confidence-label');
    expect(html).not.toContain('n=');
  });

  it('appends `n=N` label when sampleSize is provided (§III.4 + INV-DENSITY-3)', () => {
    const html = renderConfidenceBadge({ tier: 'high', sampleSize: 45 });
    expect(html).toContain('<span class="confidence-label">n=45</span>');
  });

  it('does NOT append a label when sampleSize is null', () => {
    expect(renderConfidenceBadge({ tier: 'high', sampleSize: null }))
      .not.toContain('confidence-label');
  });

  it('does NOT append a label when sampleSize is non-finite', () => {
    expect(renderConfidenceBadge({ tier: 'high', sampleSize: NaN }))
      .not.toContain('confidence-label');
  });

  it('threads through a custom title attribute', () => {
    const html = renderConfidenceBadge({ tier: 'mid', title: 'Mixed model + population' });
    expect(html).toContain('title="Mixed model + population"');
  });

  it('emits an aria-label using the tier default when no title is given', () => {
    const html = renderConfidenceBadge({ tier: 'high' });
    expect(html).toContain('aria-label="Player model"');
  });

  it('escapes double quotes in title to prevent attribute injection', () => {
    const html = renderConfidenceBadge({ tier: 'low', title: 'pop "estimate"' });
    expect(html).toContain('title="pop &quot;estimate&quot;"');
  });

  it('throws when tier is outside the closed 4-tier register', () => {
    expect(() => renderConfidenceBadge({ tier: 'green' })).toThrow(
      /not in closed 4-tier register/,
    );
  });

  it('throws when called with no arguments', () => {
    expect(() => renderConfidenceBadge()).toThrow(/not in closed 4-tier register/);
  });
});
