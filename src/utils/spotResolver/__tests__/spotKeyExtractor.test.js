/**
 * spotKeyExtractor.test.js — Verify the 8-dim descriptor extracts
 * correctly from synthetic played-hand records.
 *
 * SLS Stream E — SPR-087 / WS-193.
 */

import { describe, it, expect } from 'vitest';
import { extractDescriptor, SPR_ZONES } from '../spotKeyExtractor';
import { inferPotType } from '../potTypeInference';
import { toBoardShorthand, toBoardShorthandRainbowExplicit } from '../boardShorthand';

// ─── Synthetic hand factory ────────────────────────────────────────────

const mkHand = ({
  heroSeat = 1,
  buttonSeat = 1,
  communityCards = ['Q♠', '7♥', '2♣'],
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

// Standard BTN-vs-BB SRP timeline: preflop open, call → flop check-bet.
const SRP_BTN_VS_BB = [
  { order: 1, seat: '4', action: 'raise', street: 'preflop', amount: 3 }, // BB seat irrelevant for preflop count
  { order: 2, seat: '3', action: 'call', street: 'preflop', amount: 3 },
  { order: 3, seat: '3', action: 'check', street: 'flop' },
  { order: 4, seat: '1', action: 'bet', street: 'flop', amount: 5 },
];

describe('inferPotType', () => {
  it('returns null for empty timeline', () => {
    expect(inferPotType([])).toBeNull();
    expect(inferPotType(null)).toBeNull();
  });

  it('detects srp (one preflop raise)', () => {
    const t = [
      { order: 1, seat: '1', action: 'raise', street: 'preflop' },
      { order: 2, seat: '2', action: 'call', street: 'preflop' },
    ];
    expect(inferPotType(t)).toBe('srp');
  });

  it('detects 3bp (two preflop raises)', () => {
    const t = [
      { order: 1, seat: '1', action: 'raise', street: 'preflop' },
      { order: 2, seat: '2', action: 'raise', street: 'preflop' },
      { order: 3, seat: '1', action: 'call', street: 'preflop' },
    ];
    expect(inferPotType(t)).toBe('3bp');
  });

  it('detects 4bp (three preflop raises)', () => {
    const t = [
      { order: 1, seat: '1', action: 'raise', street: 'preflop' },
      { order: 2, seat: '2', action: 'raise', street: 'preflop' },
      { order: 3, seat: '1', action: 'raise', street: 'preflop' },
      { order: 4, seat: '2', action: 'call', street: 'preflop' },
    ];
    expect(inferPotType(t)).toBe('4bp');
  });

  it('detects srp-3way (1 raise, 3 to flop)', () => {
    const t = [
      { order: 1, seat: '1', action: 'raise', street: 'preflop' },
      { order: 2, seat: '2', action: 'call', street: 'preflop' },
      { order: 3, seat: '3', action: 'call', street: 'preflop' },
    ];
    expect(inferPotType(t)).toBe('srp-3way');
  });

  it('detects limped (no preflop raise)', () => {
    const t = [
      { order: 1, seat: '1', action: 'call', street: 'preflop' },
      { order: 2, seat: '2', action: 'check', street: 'preflop' },
    ];
    expect(inferPotType(t)).toBe('limped');
  });
});

describe('toBoardShorthand', () => {
  it('returns null for fewer than 3 cards', () => {
    expect(toBoardShorthand([])).toBeNull();
    expect(toBoardShorthand(['Q♠', '7♥'])).toBeNull();
  });

  it('sorts ranks descending', () => {
    expect(toBoardShorthand(['7♥', 'Q♠', '2♣'])).toBe('Q72');
  });

  it('handles two-tone with ss suffix', () => {
    expect(toBoardShorthand(['T♥', '9♥', '6♣'])).toBe('T96ss');
  });

  it('handles monotone with mono suffix', () => {
    expect(toBoardShorthand(['A♥', 'K♥', '7♥'])).toBe('AK7mono');
  });

  it('rainbow board has no suit suffix in plain form', () => {
    expect(toBoardShorthand(['Q♠', '7♥', '2♣'])).toBe('Q72');
  });

  it('rainbow board gets explicit r suffix via toBoardShorthandRainbowExplicit', () => {
    expect(toBoardShorthandRainbowExplicit(['Q♠', '7♥', '2♣'])).toBe('Q72r');
  });

  it('paired boards encode the pair via the rank string', () => {
    expect(toBoardShorthand(['K♠', '7♥', '7♣'])).toBe('K77');
  });

  it('handles 10 → T normalization', () => {
    expect(toBoardShorthand(['10♥', '9♥', '6♣'])).toBe('T96ss');
  });

  it('returns null on un-parseable card', () => {
    expect(toBoardShorthand(['Q♠', '7♥', 'X#'])).toBeNull();
  });
});

describe('extractDescriptor — happy paths', () => {
  it('extracts a complete descriptor for BTN flop decision in SRP', () => {
    const hand = mkHand({ actionSequence: SRP_BTN_VS_BB });
    // Decision index points to the flop bet (index 3 in 0-indexed timeline)
    const d = extractDescriptor(hand, 3);
    expect(d).not.toBeNull();
    expect(d.heroPos).toBe('BTN');
    expect(d.potType).toBe('srp');
    expect(d.texture).toMatch(/wet|medium|dry/);
    expect(d.boardShorthand).toBe('Q72');
    expect(d.street).toBe('flop');
    expect(d.nodeId).toBe('flop_root');
    expect(d.ipOop).toMatch(/^(ip|oop)$/);
    expect(typeof d.spotKey).toBe('string');
    expect(d.spotKey.length).toBeGreaterThan(10);
  });

  it('returns null for preflop decisions (v1 corpus is postflop-only)', () => {
    const hand = mkHand({ actionSequence: SRP_BTN_VS_BB });
    expect(extractDescriptor(hand, 0)).toBeNull();
    expect(extractDescriptor(hand, 1)).toBeNull();
  });
});

describe('extractDescriptor — null handling', () => {
  it('returns null for missing hand', () => {
    expect(extractDescriptor(null, 0)).toBeNull();
    expect(extractDescriptor(undefined, 0)).toBeNull();
  });

  it('returns null for non-number decisionIndex', () => {
    const hand = mkHand({ actionSequence: SRP_BTN_VS_BB });
    expect(extractDescriptor(hand, null)).toBeNull();
    expect(extractDescriptor(hand, 'abc')).toBeNull();
  });

  it('returns null when decisionIndex is out of bounds', () => {
    const hand = mkHand({ actionSequence: SRP_BTN_VS_BB });
    expect(extractDescriptor(hand, 99)).toBeNull();
  });

  it('returns null when no villain acted on the decision street', () => {
    // Hero is first to act on flop (no prior villain entry on that street)
    const sequence = [
      { order: 1, seat: '1', action: 'raise', street: 'preflop', amount: 3 },
      { order: 2, seat: '3', action: 'call', street: 'preflop', amount: 3 },
      { order: 3, seat: '1', action: 'bet', street: 'flop', amount: 5 }, // hero first on flop
    ];
    const hand = mkHand({ actionSequence: sequence });
    expect(extractDescriptor(hand, 2)).toBeNull();
  });
});

describe('SPR_ZONES export', () => {
  it('exports the 5-zone vocabulary', () => {
    expect(SPR_ZONES.MICRO).toBe('MICRO');
    expect(SPR_ZONES.LOW).toBe('LOW');
    expect(SPR_ZONES.MEDIUM).toBe('MEDIUM');
    expect(SPR_ZONES.HIGH).toBe('HIGH');
    expect(SPR_ZONES.DEEP).toBe('DEEP');
  });

  it('SPR_ZONES is frozen', () => {
    expect(Object.isFrozen(SPR_ZONES)).toBe(true);
  });
});
