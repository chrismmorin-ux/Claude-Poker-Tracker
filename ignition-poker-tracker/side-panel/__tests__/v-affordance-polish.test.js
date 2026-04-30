/**
 * v-affordance-polish.test.js — V-affordance §IV.10 co-shipping items #6 + #7 + #8
 * regression pins (Gate 5 PR-12 / 2026-04-30).
 *
 * Covers the three smaller fixes bundled into PR-12:
 *   - #6 .show-toggle-btn element-type fix (button → role=link per §IV.6 ARIA
 *     contract / §IV.12 forbidden #8)
 *   - #7 render-orchestrator.js pinned-villain sample-size `||` → `??` fix
 *     (§III.7 forbidden #6 / §IV.10 #7)
 *   - #8 hero seat-arc ring migration to non-color encoding (§IV.5 +
 *     V-1 (c) full color discipline)
 *
 * Spec: docs/design/surfaces/sidebar-shell-spec.md §IV.5 + §IV.10.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  buildUnifiedHeaderHTML,
} from '../render-orchestrator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PANEL_DIR = resolve(__dirname, '..');
const SHARED_DIR = resolve(__dirname, '..', '..', 'shared');

describe('V-affordance §IV.10 #6 — show-toggle-btn element-type fix (PR-12)', () => {
  const html = readFileSync(resolve(PANEL_DIR, 'side-panel.html'), 'utf8');

  it('tourney-log-show button declares role="link"', () => {
    // Button element retained for keyboard reachability + click-handler
    // compatibility, but role="link" declares the navigate-to-footer-panel
    // semantic per §IV.6 ARIA contract.
    expect(html).toMatch(
      /<button[^>]*id="tourney-log-show"[^>]*role="link"[^>]*>/,
    );
  });

  it('diag-show button declares role="link"', () => {
    expect(html).toMatch(/<button[^>]*id="diag-show"[^>]*role="link"[^>]*>/);
  });
});

describe('V-affordance §IV.10 #7 — pinned-villain sample-size ?? fix (PR-12)', () => {
  // Behavioral test: when pinnedData.sampleSize === 0, `??` preserves the
  // 0 (pinned villain with no hands seen yet) instead of falling through to
  // advice.villainSampleSize. Pre-PR-12, `||` collapsed 0 → fallback,
  // hiding a legitimate "this villain has 0 hands at this table" state.
  const advice = {
    villainSeat: 3,
    villainSampleSize: 99, // global advice sample
    villainStyle: 'reg',
    villainProfile: { headline: 'Global advice headline' },
    recommendations: [{ action: 'bet', ev: 1.0 }],
    handPlan: null,
    modelQuality: { overallSource: 'mid' },
  };

  const liveContext = {
    state: 'FLOP',
    currentStreet: 'flop',
    heroSeat: 1,
    pot: 20,
    foldedSeats: [],
    actionSequence: [],
    activeSeatNumbers: [1, 3],
  };

  const opts = (pinnedData) => ({
    focusedVillainSeat: 3,
    pinnedVillainSeat: 3,
    appSeatData: { 3: pinnedData },
    currentTableState: { heroSeat: 1, dealerSeat: 5 },
    currentLiveContext: liveContext,
  });

  it('renders the pinned villain sample-size of 0 (not the global advice fallback)', () => {
    const result = buildUnifiedHeaderHTML(advice, liveContext, opts({
      sampleSize: 0,
      style: 'unknown',
      villainProfile: null,
      villainHeadline: null,
    }));
    // The renderer emits sample as `n={N}`. Pre-PR-12: `||` collapsed 0 →
    // advice.villainSampleSize (99) → output `n=99`. Post-PR-12: `??` keeps
    // the legitimate 0 → output `n=0` (or no badge at all). Either way,
    // `n=99` must NOT appear since the pinned villain authoritatively has 0.
    expect(result.html).not.toMatch(/n=99/);
  });

  it('still falls through when pinnedData.sampleSize is null/undefined', () => {
    // `??` triggers the fallback only on null/undefined — a pinned villain
    // entry that simply omits sampleSize (e.g., the appSeatData record
    // doesn't track it yet) still resolves to the global advice value.
    const result = buildUnifiedHeaderHTML(advice, liveContext, opts({
      // no sampleSize key
      style: 'unknown',
      villainProfile: null,
      villainHeadline: null,
    }));
    // Expect the global advice fallback (99) to render for sampleSize === undefined.
    expect(result.html).toMatch(/n=99/);
  });
});

describe('V-affordance §IV.10 #8 — hero seat-arc ring non-color encoding (PR-12)', () => {
  const html = readFileSync(resolve(PANEL_DIR, 'side-panel.html'), 'utf8');

  // Find the .seat-circle.hero CSS rule.
  const heroRuleMatch = html.match(
    /\.seat-circle\.hero\s*\{[\s\S]*?\}/,
  );

  it('the .seat-circle.hero CSS rule exists', () => {
    expect(heroRuleMatch).toBeTruthy();
  });

  it('the .seat-circle.hero rule does NOT reference --gold (V-1 (c) compliance)', () => {
    // Color is reserved for ordinal quality-tier per V-1 (c). Hero-vs-villain
    // is categorical, not ordinal — the prior `border-color: var(--gold)`
    // + gold gradient + gold text were V-1 (c) violations.
    expect(heroRuleMatch[0]).not.toMatch(/--gold/);
    expect(heroRuleMatch[0]).not.toMatch(/border-color\s*:/);
    expect(heroRuleMatch[0]).not.toMatch(/color\s*:/);
  });

  it('the .seat-circle.hero rule encodes via border-width (distinct ring weight)', () => {
    // Per shell-spec §IV.5 cross-cutting amendment: "(distinct ring weight)"
    // is the prescribed non-color encoding mechanism.
    expect(heroRuleMatch[0]).toMatch(/border-width\s*:\s*[3-9]px/);
  });

  it('render-orchestrator emits the ★ glyph as the canonical hero indicator', () => {
    // §IV.5 closed decorative-glyph registry: ★ U+2605 = hero-seat marker.
    const orchestratorSrc = readFileSync(resolve(PANEL_DIR, 'render-orchestrator.js'), 'utf8');
    // Match either the literal ★ or the ★ escape form.
    expect(orchestratorSrc).toMatch(/isHero\s*\?\s*['"`](?:★|\\u2605)/);
  });

  it('the canonical glyph entry HERO_STAR remains in the shared affordance registry', () => {
    // Belt-and-braces: even though render-orchestrator.js currently inlines
    // the glyph, the registry is the single source of truth for the closed
    // 4-glyph set. A future PR can route render-orchestrator through the
    // helper without breaking the regression pin.
    const affordanceSrc = readFileSync(resolve(SHARED_DIR, 'render-affordance.js'), 'utf8');
    expect(affordanceSrc).toMatch(/HERO_STAR[\s\S]*?glyph:\s*['"]★['"]/);
  });
});
