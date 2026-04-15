/**
 * zx-observer-mode.test.js — SR-6.16 Step 5.
 *
 * Verifies the X.6 "Observer scouting panel" and X.7 "Observing badge"
 * tier behavior when hero has folded. Per SR-4 Zx batch: observer mode
 * is released to take over the Z2/between-hands slot while hero has no
 * action to plan. This test pins that behavior end-to-end using the
 * `heroFolded` fixture — failure here indicates a real gap, not a spec
 * question.
 *
 * References:
 * - docs/SIDEBAR_PANEL_INVENTORY.md §Zx rows X.6, X.7
 * - docs/sidebar-specs/zx-overrides.md
 * - SR-6.15 handoff (deferral of explicit Zx harness assertions)
 */

import { describe, it, expect } from 'vitest';
import {
  classifyBetweenHandsMode,
  buildBetweenHandsHTML,
  buildUnifiedHeaderHTML,
} from '../render-orchestrator.js';
import { heroFolded } from './fixtures.js';

describe('X.6 / X.7 — Observer mode tier release', () => {
  it('classifyBetweenHandsMode returns OBSERVING when hero has folded in a live hand (past mode-A window)', () => {
    const live = heroFolded.currentLiveContext;
    const mode = classifyBetweenHandsMode(
      live,
      live.heroSeat,
      heroFolded.lastGoodAdvice || null,
      /* modeAExpired */ true,
    );
    expect(mode).toBe('OBSERVING');
  });

  it('buildBetweenHandsHTML(OBSERVING) renders the X.6 scouting panel with a seat and style', () => {
    const { html, className } = buildBetweenHandsHTML('OBSERVING', {
      liveContext: heroFolded.currentLiveContext,
      lastGoodAdvice: heroFolded.lastGoodAdvice || null,
      appSeatData: heroFolded.appSeatData || {},
      focusedVillainSeat: null,
    });
    expect(className).toContain('mode-observing');
    // X.6 scouting header contract: "SCOUTING — Seat N (style, Nh)"
    expect(html).toMatch(/SCOUTING\s+\u2014\s+Seat\s+\d+/);
    expect(html).toContain('bh-scout');
  });

  it('buildUnifiedHeaderHTML renders the X.7 Observing badge when hero folded', () => {
    const f = heroFolded;
    const { html } = buildUnifiedHeaderHTML(f.lastGoodAdvice, f.currentLiveContext, {
      focusedVillainSeat: null,
      pinnedVillainSeat: null,
      appSeatData: f.appSeatData || {},
      currentTableState: f.currentTableState || null,
      currentLiveContext: f.currentLiveContext,
    });
    expect(html).toContain('uh-observing');
    expect(html).toContain('Observing');
  });

  it('does not classify as OBSERVING when hero is still active in the hand', () => {
    const live = {
      ...heroFolded.currentLiveContext,
      foldedSeats: [], // hero not folded
    };
    const mode = classifyBetweenHandsMode(
      live,
      live.heroSeat,
      null,
      true,
    );
    expect(mode).not.toBe('OBSERVING');
  });
});
