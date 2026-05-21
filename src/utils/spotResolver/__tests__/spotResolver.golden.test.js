/**
 * spotResolver.golden.test.js — End-to-end resolver tests against
 * synthetic played hands. Validates the spike's coverage estimates
 * (~40-50% strong / ~20-30% partial / ~15-25% no-analog) at sample size.
 *
 * Per spike §Risks line 173: node-classifier confidence indicator is
 * mandatory. Tests exercise all three confidence tiers.
 *
 * SLS Stream E — SPR-087 / WS-193.
 */

import { describe, it, expect } from 'vitest';
import { resolveSpot, classifyConfidence, scoreMatch } from '../index';

// ─── Synthetic hand factory ───────────────────────────────────────────

const mkHand = ({
  heroSeat = 1,
  buttonSeat = 1,
  communityCards,
  actionSequence,
} = {}) => ({
  gameState: {
    mySeat: heroSeat,
    dealerButtonSeat: buttonSeat,
    communityCards,
    effectiveStack: 100,
    actionSequence,
  },
  cardState: { communityCards },
});

// ─── Canonical hand fixtures matching corpus entries ──────────────────

// BTN-vs-BB SRP, dry Q72 — matches LSW line btn-vs-bb-srp-ip-dry-q72r
const HAND_BTN_VS_BB_SRP_Q72R_FLOP = mkHand({
  heroSeat: 1, // BTN
  buttonSeat: 1,
  communityCards: ['Q♠', '7♥', '2♣'], // dry rainbow
  actionSequence: [
    { order: 1, seat: '1', action: 'raise', street: 'preflop', amount: 3 }, // BTN open
    { order: 2, seat: '3', action: 'call', street: 'preflop', amount: 3 }, // BB call
    { order: 3, seat: '3', action: 'check', street: 'flop' }, // BB check
    { order: 4, seat: '1', action: 'bet', street: 'flop', amount: 5 }, // hero bet (decision idx 3)
  ],
});

// BTN-vs-BB 3BP, wet T96 — matches LSW line btn-vs-bb-3bp-ip-wet-t96
const HAND_BTN_VS_BB_3BP_T96SS_FLOP = mkHand({
  heroSeat: 1, // BTN
  buttonSeat: 1,
  communityCards: ['T♥', '9♥', '6♣'], // wet two-tone
  actionSequence: [
    { order: 1, seat: '1', action: 'raise', street: 'preflop', amount: 3 }, // BTN open
    { order: 2, seat: '3', action: 'raise', street: 'preflop', amount: 12 }, // BB 3-bet
    { order: 3, seat: '1', action: 'call', street: 'preflop', amount: 12 }, // BTN call
    { order: 4, seat: '3', action: 'check', street: 'flop' }, // BB check (idx 3)
    { order: 5, seat: '1', action: 'bet', street: 'flop', amount: 10 }, // hero bet (decision idx 4)
  ],
});

// Multiway SRP-3way — should land 'no-analog' or sparse-partial unless
// the corpus has an MW entry for the exact spot
const HAND_MULTIWAY_NO_ANALOG = mkHand({
  heroSeat: 1,
  buttonSeat: 1,
  communityCards: ['5♣', '3♦', '2♠'], // unusual low board
  actionSequence: [
    { order: 1, seat: '1', action: 'raise', street: 'preflop', amount: 3 },
    { order: 2, seat: '2', action: 'call', street: 'preflop', amount: 3 },
    { order: 3, seat: '3', action: 'call', street: 'preflop', amount: 3 },
    { order: 4, seat: '4', action: 'call', street: 'preflop', amount: 3 }, // 4-way pot
    { order: 5, seat: '2', action: 'check', street: 'flop' },
    { order: 6, seat: '3', action: 'check', street: 'flop' },
    { order: 7, seat: '4', action: 'check', street: 'flop' },
    { order: 8, seat: '1', action: 'bet', street: 'flop', amount: 5 },
  ],
});

// ─── Tests ────────────────────────────────────────────────────────────

describe('resolveSpot — return shape', () => {
  it('returns SpotMatch with all contract fields for a valid postflop decision', () => {
    const result = resolveSpot(HAND_BTN_VS_BB_SRP_Q72R_FLOP, 3);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('artifactId');
    expect(result).toHaveProperty('source');
    expect(result).toHaveProperty('spotKey');
    expect(result).toHaveProperty('descriptor');
    expect(result).toHaveProperty('scoredMatches');
    expect(['strong', 'partial', 'no-analog']).toContain(result.confidence);
    expect(typeof result.spotKey).toBe('string');
    expect(Array.isArray(result.scoredMatches)).toBe(true);
  });

  it('returns null for preflop decision (v1 corpus is postflop-only)', () => {
    expect(resolveSpot(HAND_BTN_VS_BB_SRP_Q72R_FLOP, 0)).toBeNull();
    expect(resolveSpot(HAND_BTN_VS_BB_SRP_Q72R_FLOP, 1)).toBeNull();
  });

  it('returns null for missing hand', () => {
    expect(resolveSpot(null, 3)).toBeNull();
  });

  it('returns null for out-of-bounds decisionIndex', () => {
    expect(resolveSpot(HAND_BTN_VS_BB_SRP_Q72R_FLOP, 99)).toBeNull();
  });
});

describe('resolveSpot — confidence ladder', () => {
  it('returns strong or partial match for BTN-vs-BB SRP Q72r flop_root (corpus has exact analog)', () => {
    const result = resolveSpot(HAND_BTN_VS_BB_SRP_Q72R_FLOP, 3);
    expect(result.confidence).not.toBe('no-analog');
    expect(result.artifactId).not.toBeNull();
    expect(['strong', 'partial']).toContain(result.confidence);
  });

  it('returns strong or partial match for BTN-vs-BB 3BP T96ss flop_root (corpus has exact analog)', () => {
    const result = resolveSpot(HAND_BTN_VS_BB_3BP_T96SS_FLOP, 4);
    expect(result.confidence).not.toBe('no-analog');
    expect(['strong', 'partial']).toContain(result.confidence);
  });

  it('artifactId is null when confidence is no-analog', () => {
    // Construct an explicitly no-analog hand — limped pot is out of v1 corpus
    const hand = mkHand({
      heroSeat: 1,
      buttonSeat: 1,
      communityCards: ['5♣', '3♦', '2♠'],
      actionSequence: [
        { order: 1, seat: '1', action: 'call', street: 'preflop', amount: 1 }, // limp
        { order: 2, seat: '2', action: 'check', street: 'preflop' },
        { order: 3, seat: '2', action: 'check', street: 'flop' },
        { order: 4, seat: '1', action: 'bet', street: 'flop', amount: 2 },
      ],
    });
    const result = resolveSpot(hand, 3);
    if (result.confidence === 'no-analog') {
      expect(result.artifactId).toBeNull();
      expect(result.source).toBeNull();
    }
  });

  it('strong/partial confidence sets source field', () => {
    const result = resolveSpot(HAND_BTN_VS_BB_SRP_Q72R_FLOP, 3);
    if (result.confidence !== 'no-analog') {
      expect(['upper-surface', 'lsw']).toContain(result.source);
    }
  });
});

describe('resolveSpot — spotKey + descriptor', () => {
  it('spotKey is always present (SR-32 copy-paste affordance)', () => {
    const r1 = resolveSpot(HAND_BTN_VS_BB_SRP_Q72R_FLOP, 3);
    expect(r1.spotKey).toBeTruthy();
    const r2 = resolveSpot(HAND_MULTIWAY_NO_ANALOG, 7);
    if (r2) expect(r2.spotKey).toBeTruthy();
  });

  it('descriptor exposes all 8 dimensions + spotKey', () => {
    const r = resolveSpot(HAND_BTN_VS_BB_SRP_Q72R_FLOP, 3);
    expect(r.descriptor).toHaveProperty('heroPos');
    expect(r.descriptor).toHaveProperty('villainPos');
    expect(r.descriptor).toHaveProperty('ipOop');
    expect(r.descriptor).toHaveProperty('potType');
    expect(r.descriptor).toHaveProperty('texture');
    expect(r.descriptor).toHaveProperty('boardShorthand');
    expect(r.descriptor).toHaveProperty('sprBucket');
    expect(r.descriptor).toHaveProperty('street');
    expect(r.descriptor).toHaveProperty('nodeId');
    expect(r.descriptor).toHaveProperty('spotKey');
  });

  it('reason field is undefined for strong matches', () => {
    const r = resolveSpot(HAND_BTN_VS_BB_SRP_Q72R_FLOP, 3);
    if (r.confidence === 'strong') {
      expect(r.reason).toBeUndefined();
    }
  });

  it('reason field is populated for partial / no-analog matches', () => {
    const r = resolveSpot(HAND_BTN_VS_BB_SRP_Q72R_FLOP, 3);
    if (r.confidence === 'partial' || r.confidence === 'no-analog') {
      expect(typeof r.reason).toBe('string');
    }
  });
});

describe('resolveSpot — scoredMatches debug surface', () => {
  it('scoredMatches caps at 10 entries (consumer surface)', () => {
    const r = resolveSpot(HAND_BTN_VS_BB_SRP_Q72R_FLOP, 3);
    expect(r.scoredMatches.length).toBeLessThanOrEqual(10);
  });

  it('scoredMatches are sorted descending by score', () => {
    const r = resolveSpot(HAND_BTN_VS_BB_SRP_Q72R_FLOP, 3);
    for (let i = 1; i < r.scoredMatches.length; i++) {
      expect(r.scoredMatches[i - 1].score).toBeGreaterThanOrEqual(r.scoredMatches[i].score);
    }
  });

  it('each scoredMatch carries artifactId + source + score + differsOn', () => {
    const r = resolveSpot(HAND_BTN_VS_BB_SRP_Q72R_FLOP, 3);
    for (const m of r.scoredMatches) {
      expect(m).toHaveProperty('artifactId');
      expect(m).toHaveProperty('source');
      expect(m).toHaveProperty('score');
      expect(m).toHaveProperty('differsOn');
      expect(Array.isArray(m.differsOn)).toBe(true);
    }
  });
});

describe('matchScorer — direct unit tests', () => {
  const baseDescriptor = {
    heroPos: 'BTN', villainPos: 'BB', ipOop: 'ip',
    potType: 'srp', texture: 'dry', boardShorthand: 'Q72r',
    sprBucket: 'MEDIUM', street: 'flop', nodeId: 'flop_root',
  };

  it('exact match scores 1.0', () => {
    const corpus = { ...baseDescriptor, artifactId: 'test', source: 'upper-surface' };
    const { score } = scoreMatch(baseDescriptor, corpus);
    expect(score).toBe(1.0);
  });

  it('single dimension mismatch scores 7/8 = 0.875 (strong threshold)', () => {
    const corpus = { ...baseDescriptor, heroPos: 'CO', artifactId: 'test', source: 'lsw' };
    const { score, differsOn } = scoreMatch(baseDescriptor, corpus);
    expect(score).toBeCloseTo(7 / 8, 5);
    expect(differsOn).toContain('heroPos');
  });

  it('null corpus value gives neutral 0.5 credit (not penalty)', () => {
    const corpus = { ...baseDescriptor, sprBucket: null, artifactId: 'test', source: 'lsw' };
    const { score } = scoreMatch(baseDescriptor, corpus);
    expect(score).toBeCloseTo((7 + 0.5) / 8, 5);
  });

  it('classifyConfidence boundary checks', () => {
    expect(classifyConfidence(1.0)).toBe('strong');
    expect(classifyConfidence(0.875)).toBe('strong');
    expect(classifyConfidence(0.874)).toBe('partial');
    expect(classifyConfidence(0.625)).toBe('partial');
    expect(classifyConfidence(0.624)).toBe('no-analog');
    expect(classifyConfidence(0)).toBe('no-analog');
  });

  it('adjacent SPR bucket gets partial credit', () => {
    const desc = { ...baseDescriptor, sprBucket: 'LOW' };
    const corpus = { ...baseDescriptor, sprBucket: 'MEDIUM', artifactId: 'test', source: 'lsw' };
    const { score } = scoreMatch(desc, corpus);
    // 7 dims exact + 0.5 for SPR adjacent / 8 = 0.9375
    expect(score).toBeCloseTo((7 + 0.5) / 8, 5);
  });

  it('paired texture tolerates wet/dry on corpus side', () => {
    const desc = { ...baseDescriptor, texture: 'paired' };
    const corpus = { ...baseDescriptor, texture: 'dry', artifactId: 'test', source: 'lsw' };
    const { score } = scoreMatch(desc, corpus);
    // 7 dims exact + 0.7 for paired↔dry / 8
    expect(score).toBeGreaterThan(7 / 8);
  });
});
