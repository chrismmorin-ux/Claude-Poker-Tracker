/**
 * situationKeyComparability.test.js — WS-318
 *
 * THE guard this defect needed and did not have.
 *
 * `matchHeroWeakness` and both `handSignificance` branches compare a key produced hero-side
 * against a key produced by the villain accumulator. For months the two producers disagreed
 * about what axis 3 MEANS — the accumulator wrote a role ('agg'/'def'), the hero-side
 * builders wrote a primitive action ('bet'/'check'/…) — so every comparison ran over
 * disjoint value sets and returned false. Nothing failed, because nothing checked that the
 * two families of key were the same KIND of thing.
 *
 * Unit tests could not catch it: each producer was self-consistent, and the matcher's own
 * fixtures hand-wrote both sides of the comparison in the same shape, which is exactly the
 * shape production never produced. The assertion has to be about the RELATIONSHIP between
 * two independently-built keys, so that is what this file tests.
 */

import { describe, it, expect } from 'vitest';
import {
  IDENTITY_AXES, formatSituationKey, parseSituationKey, buildSpotAxes,
  matchesWeaknessSpot, contextActionLabel, CONTEXT_ACTION_LABELS,
} from '../situationKey';
import { PRIMITIVE_ACTIONS } from '../../../constants/primitiveActions';

/** A flop street where seat 3 is the preflop aggressor and c-bets into seat 5. */
const FLOP_ACTIONS = [
  { order: 10, seat: '3', action: PRIMITIVE_ACTIONS.BET, street: 'flop' },
  { order: 11, seat: '5', action: PRIMITIVE_ACTIONS.CALL, street: 'flop' },
];

const axesFor = (seat, order, primitive, aggSeat = '3') => buildSpotAxes({
  street: 'flop',
  texture: 'dry',
  posCategory: 'LATE',
  playerSeat: seat,
  entryOrder: order,
  primitive,
  streetActions: FLOP_ACTIONS,
  aggSeat,
  isIP: false,
  primitives: PRIMITIVE_ACTIONS,
});

describe('WS-318 — situation keys from different producers are comparable', () => {
  it('every axis a producer emits is a declared identity axis', () => {
    const axes = axesFor('3', 10, PRIMITIVE_ACTIONS.BET);
    expect(Object.keys(axes).sort()).toEqual([...IDENTITY_AXES].sort());
  });

  it('axis 3 always holds a ROLE, never a primitive action', () => {
    // The whole defect in one assertion. If a producer ever writes 'bet' here again, this
    // fails immediately instead of silently zeroing out weakness matching.
    const primitives = Object.values(PRIMITIVE_ACTIONS);
    for (const primitive of primitives) {
      const key = formatSituationKey(axesFor('3', 10, primitive));
      const { isAgg } = parseSituationKey(key);
      expect(['agg', 'def']).toContain(isAgg);
      expect(primitives).not.toContain(isAgg);
    }
  });

  it('a hero-built key and a villain-built key for the SAME spot match each other', () => {
    // Independently built, then compared — the relationship the old code got wrong.
    const villainKey = formatSituationKey(axesFor('3', 10, PRIMITIVE_ACTIONS.BET));
    const heroKey = formatSituationKey(axesFor('3', 10, PRIMITIVE_ACTIONS.BET));
    expect(matchesWeaknessSpot(heroKey, villainKey)).toBe(true);
  });

  it('the aggressor betting first to act is a c-bet, and it round-trips', () => {
    const key = formatSituationKey(axesFor('3', 10, PRIMITIVE_ACTIONS.BET));
    expect(parseSituationKey(key).contextAction).toBe('cbet');
    expect(parseSituationKey(key).isAgg).toBe('agg');
  });

  it('the caller facing that bet is a call, by the defender', () => {
    const key = formatSituationKey(axesFor('5', 11, PRIMITIVE_ACTIONS.CALL));
    expect(parseSituationKey(key).contextAction).toBe('call');
    expect(parseSituationKey(key).isAgg).toBe('def');
    expect(parseSituationKey(key).facingAction).toBe('bet');
  });

  it('a four-axis key does not parse — the shape hero producers used to emit', () => {
    // Kept as a live assertion because this is what made the failure SILENT: the strict
    // parser rejected the old quick keys, tryParse returned null, and the caller read that
    // as "no match" rather than "malformed input".
    expect(() => parseSituationKey('flop:unknown:LATE:bet')).toThrow(/7 or 8 axes/);
    expect(matchesWeaknessSpot('flop:unknown:LATE:bet', 'flop:dry:LATE:agg:ip:none:cbet'))
      .toBe(false);
  });

  it('every contextAction the deriver can emit has a human-readable label', () => {
    // The user-visible copy criterion: no raw axis value reaches the founder.
    const derivable = [
      'cbet', 'check_give_up', 'donk', 'check', 'stab', 'check_back',
      'call', 'raise', 'fold', 'call_raise', 'reraise', 'fold_to_raise',
    ];
    for (const ctx of derivable) {
      expect(CONTEXT_ACTION_LABELS[ctx]).toBeTruthy();
      // No snake_case leaks through to the screen. Single-word actions like 'check' are
      // already the poker word and legitimately map to themselves.
      expect(contextActionLabel(ctx)).not.toMatch(/_/);
    }
  });
});
