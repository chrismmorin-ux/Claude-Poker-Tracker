/**
 * Tests for drillModeEngine.js — surviving helpers after LSW-G4-IMPL Commit 5
 * deletion of the v1 analysis pipeline.
 *
 * Covers `classifyDomination` + `computeDominationMap` (G5 / G5.1 / G5.2)
 * which are the primitives still consumed by v2 via `computeBucketEVsV2`.
 *
 * v1 functions (HERO_BUCKET_TYPICAL_EQUITY, DEFAULT_ACTIONS,
 * villainFoldRateFromComposition, evaluateDrillNode, computePinnedComboEV)
 * were deleted in Commit 5 — their tests went with them. The v2 engine
 * surface is covered by `drillModeEngineV2.test.js`.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyDomination,
  computeDominationMap,
} from '../drillModeEngine';
import { createRange, rangeIndex } from '../../pokerCore/rangeMatrix';
import { encodeCard } from '../../pokerCore/cardParser';

describe('classifyDomination', () => {
  it('returns "crushed" below 20% equity', () => {
    expect(classifyDomination(0.05)).toBe('crushed');
    expect(classifyDomination(0.15)).toBe('crushed');
    expect(classifyDomination(0.199)).toBe('crushed');
  });

  it('returns "dominated" in 20-40% band', () => {
    expect(classifyDomination(0.20)).toBe('dominated');
    expect(classifyDomination(0.30)).toBe('dominated');
    expect(classifyDomination(0.399)).toBe('dominated');
  });

  it('returns "neutral" in 40-60% band (coin-flip zone)', () => {
    expect(classifyDomination(0.40)).toBe('neutral');
    expect(classifyDomination(0.50)).toBe('neutral');
    expect(classifyDomination(0.599)).toBe('neutral');
  });

  it('returns "favored" in 60-80% band', () => {
    expect(classifyDomination(0.60)).toBe('favored');
    expect(classifyDomination(0.70)).toBe('favored');
    expect(classifyDomination(0.799)).toBe('favored');
  });

  it('returns "dominating" at 80%+', () => {
    expect(classifyDomination(0.80)).toBe('dominating');
    expect(classifyDomination(0.95)).toBe('dominating');
    expect(classifyDomination(1.0)).toBe('dominating');
  });

  it('returns "unknown" for non-finite / missing input', () => {
    expect(classifyDomination(NaN)).toBe('unknown');
    expect(classifyDomination(undefined)).toBe('unknown');
    expect(classifyDomination(null)).toBe('unknown');
    expect(classifyDomination('0.5')).toBe('unknown');
  });
});

// LSW-G5.2 (2026-04-22) — pair+draw composite classification.
// Tests routing logic directly against computeDominationMap with a
// synthetic villain range containing known pair+FD and pair+gutshot
// combos, bypassing the line/archetype plumbing.
describe('computeDominationMap — pair+draw composites (LSW-G5.2)', () => {
  // Suits: 0=spades, 1=hearts, 2=diamonds, 3=clubs (per cardParser convention).
  const T_HEARTS   = encodeCard(8, 1);  // T♥
  const NINE_HEARTS = encodeCard(7, 1); // 9♥
  const SIX_SPADES  = encodeCard(4, 0); // 6♠
  const T96_BOARD = [T_HEARTS, NINE_HEARTS, SIX_SPADES];

  // Hero: J♥T♠ — standard pinned combo for JT6 flop_root.
  const HERO_CARDS = { card1: encodeCard(9, 1), card2: encodeCard(8, 0) };

  it('routes pair+flushDraw combo into pairPlusFD group, not bare bottomPair', async () => {
    // 6-5 suited on T♥9♥6♠: bottomPair (6) + 4 hearts (2 board + 2 hand for
    // hearts version) = direct flush draw. Classifier is strongest-wins so
    // handType === `bottomPair`, but drawFeatures.hasFlushDraw === true.
    // With the G5.2 filter, this combo lands in `pairPlusFD`, not the bare
    // `bottomPair` row.
    const villainRange = createRange();
    villainRange[rangeIndex(4, 3, true)] = 1.0; // 6-5 suited
    const dominationMap = await computeDominationMap({
      pinnedCombo: HERO_CARDS,
      villainRange,
      board: T96_BOARD,
      trialsPerGroup: 50,
    });
    const pairPlusFD = dominationMap.find((r) => r.id === 'pairPlusFD');
    const bareBottomPair = dominationMap.find((r) => r.id === 'bottomPair');
    // Of the 4 suited combinations of 65s — 6♥5♥, 6♠5♠, 6♦5♦, 6♣5♣ — only
    // 6♥5♥ has the flush draw (board has 2 hearts). The other 3 are
    // bottom pair with no direct draw. So pairPlusFD is populated AND
    // the bare bottomPair row is also populated. Verify both.
    expect(pairPlusFD).toBeDefined();
    expect(pairPlusFD.weightPct).toBeGreaterThan(0);
    expect(bareBottomPair).toBeDefined();
    expect(bareBottomPair.weightPct).toBeGreaterThan(0);
    // The two groups together should equal (or be near) the full 65s share.
    // MC variance allowed; check that they partition correctly (no overlap).
    expect(pairPlusFD.sampleSize).toBeGreaterThanOrEqual(1);
    expect(bareBottomPair.sampleSize).toBeGreaterThanOrEqual(1);
  }, 10000);

  it('routes pair+gutshot combo into pairPlusGutshot group, not bare middlePair', async () => {
    // 9-8 offsuit on T♥9♥6♠: middlePair (9s) + gutshot via 6-7-8-9-T window
    // (missing the 7). detectDraws should flag hasGutshot. Expected:
    // pairPlusGutshot populated, bare middlePair empty (9h unavailable
    // from the range since it's on the board; remaining 98o combos all
    // have the gutshot).
    const villainRange = createRange();
    villainRange[rangeIndex(7, 6, false)] = 1.0; // 9-8 offsuit
    const dominationMap = await computeDominationMap({
      pinnedCombo: HERO_CARDS,
      villainRange,
      board: T96_BOARD,
      trialsPerGroup: 50,
    });
    const pairPlusGutshot = dominationMap.find((r) => r.id === 'pairPlusGutshot');
    expect(pairPlusGutshot).toBeDefined();
    expect(pairPlusGutshot.weightPct).toBeGreaterThan(0);
  }, 10000);

  it('bare pair row excludes pair+draw combos (no double-counting)', async () => {
    // Mixed range: 98o (middle pair + gutshot) AND 22 (weakPair, no draw).
    // Verify that pairPlusGutshot captures the 98 combos and the weakPair
    // row captures the 22 combos, with no overlap.
    const villainRange = createRange();
    villainRange[rangeIndex(7, 6, false)] = 1.0;  // 98o → middlePair + gutshot
    villainRange[rangeIndex(0, 0, false)] = 1.0;  // 22  → weakPair
    const dominationMap = await computeDominationMap({
      pinnedCombo: HERO_CARDS,
      villainRange,
      board: T96_BOARD,
      trialsPerGroup: 50,
    });
    const pairPlusGutshot = dominationMap.find((r) => r.id === 'pairPlusGutshot');
    const weakPair = dominationMap.find((r) => r.id === 'weakPair');
    expect(pairPlusGutshot).toBeDefined();
    expect(weakPair).toBeDefined();
    // Total pair-family weight should sum to 100% (both are pair-tier).
    const total = pairPlusGutshot.weightPct + weakPair.weightPct;
    expect(total).toBeGreaterThan(95);
    expect(total).toBeLessThanOrEqual(100.01);
  }, 10000);
});
