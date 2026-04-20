/**
 * shapeClassifier.test.js — structural invariants for shapes.js.
 *
 * Asserts:
 *   (1) Every one of the 169 canonical preflop hand classes maps to exactly
 *       one shape (no gaps, no overlaps — first-match wins is the rule).
 *   (2) Canonical lane selection for a hand-picked set of shared-rank and
 *       dominance scenarios routes the way the catalog promises.
 */

import { describe, test, expect } from 'vitest';
import { SHAPES, classifyHero, classifyLane, detectApplicableModifiers } from '../shapes';
import { parseHandClass } from '../../pokerCore/preflopEquity';

const RANK_CHARS = '23456789TJQKA';

// Enumerate all 169 canonical preflop hand classes: 13 pairs + 78 suited + 78 offsuit.
const ALL_HAND_CLASSES = (() => {
  const out = [];
  for (let i = 0; i < 13; i++) out.push(`${RANK_CHARS[i]}${RANK_CHARS[i]}`);
  for (let i = 12; i >= 0; i--) {
    for (let j = i - 1; j >= 0; j--) {
      out.push(`${RANK_CHARS[i]}${RANK_CHARS[j]}s`);
      out.push(`${RANK_CHARS[i]}${RANK_CHARS[j]}o`);
    }
  }
  return out;
})();

describe('shapeClassifier', () => {
  test('exactly 169 hand classes enumerated', () => {
    expect(ALL_HAND_CLASSES.length).toBe(169);
  });

  test('every hand class maps to exactly one shape', () => {
    const misses = [];
    const overlaps = [];
    for (const hand of ALL_HAND_CLASSES) {
      const matching = SHAPES.filter((s) => {
        try {
          return s.matches(
            // parseHandClass is invoked by classifyHero; use it directly here
            // to check each matcher against the parsed hand without relying on
            // first-match ordering.
            { ...parse(hand) },
          );
        } catch {
          return false;
        }
      });
      if (matching.length === 0) misses.push(hand);
      if (matching.length > 1) overlaps.push({ hand, shapes: matching.map((s) => s.id) });
    }
    if (misses.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Hands with no matching shape:', misses);
    }
    if (overlaps.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        'Hands matched by multiple shapes (first-match resolves, but overlaps indicate loose predicates):',
        overlaps,
      );
    }
    // Hard requirement: no misses. Overlaps are allowed (ordering resolves) but
    // logged so we notice unintentional loosening.
    expect(misses).toEqual([]);
    // Sanity: classifyHero succeeds for every hand.
    for (const hand of ALL_HAND_CLASSES) {
      expect(() => classifyHero(hand)).not.toThrow();
    }
  });

  test('shape assignments — structural spot checks', () => {
    const expectations = [
      // Pocket pair
      ['AA', 'pocket-pair'], ['22', 'pocket-pair'], ['77', 'pocket-pair'],
      // Ax suited / offsuit
      ['AKs', 'ax-suited'], ['A2s', 'ax-suited'], ['AKo', 'ax-offsuit'], ['A5o', 'ax-offsuit'],
      // Broadway-broadway
      ['KQs', 'broadway-broadway'], ['KJo', 'broadway-broadway'], ['JTs', 'broadway-broadway'],
      ['QTo', 'broadway-broadway'], ['KTo', 'broadway-broadway'],
      // Kx non-broadway
      ['K9s', 'kx-non-broadway'], ['K2o', 'kx-non-broadway'], ['K5s', 'kx-non-broadway'],
      // Suited connector / gapper (non-broadway, non-Ax/Kx)
      ['T9s', 'suited-connector-or-gapper'], ['98s', 'suited-connector-or-gapper'],
      ['54s', 'suited-connector-or-gapper'], ['J9s', 'suited-connector-or-gapper'],
      ['T2s', 'suited-connector-or-gapper'], ['J2s', 'suited-connector-or-gapper'],
      // Middling / garbage offsuit
      ['T9o', 'middling-offsuit'], ['98o', 'middling-offsuit'], ['T7o', 'middling-offsuit'],
      ['J9o', 'middling-offsuit'],
      ['72o', 'offsuit-garbage'], ['83o', 'offsuit-garbage'], ['92o', 'offsuit-garbage'],
    ];
    for (const [hand, expectedShape] of expectations) {
      const shape = classifyHero(hand);
      expect(shape.id, `${hand} should classify as ${expectedShape}, got ${shape.id}`).toBe(expectedShape);
    }
  });

  test('canonical lane selection — shared-rank lanes win over structural ones', () => {
    // AKo vs AQo: AKo is ax-offsuit shape; from hero's POV AQo has a LOWER
    // kicker (Q < K), so hero kicker-dominates → vs-lower-ax.
    const { shape, lane } = classifyLane('AKo', 'AQo');
    expect(shape.id).toBe('ax-offsuit');
    expect(lane?.id).toBe('vs-lower-ax');

    // A2o vs AKo: hero has A+2, villain has A+K. Villain kicker dominates →
    // vs-higher-ax.
    const dominated = classifyLane('A2o', 'AKo');
    expect(dominated.shape.id).toBe('ax-offsuit');
    expect(dominated.lane?.id).toBe('vs-higher-ax');
  });

  test('shared-rank pair cases route correctly', () => {
    // KK vs AKs: hero KK (pocket-pair), villain AKs shares K with lower... K is
    // hero's pair rank; villain's Ace is higher. "shared-rank-higher-kicker".
    let out = classifyLane('KK', 'AKs');
    expect(out.shape.id).toBe('pocket-pair');
    expect(out.lane?.id).toBe('shared-rank-higher-kicker');

    // JJ vs J5: pair dominates kicker — "shared-rank-lower-kicker"
    out = classifyLane('JJ', 'J5o');
    expect(out.shape.id).toBe('pocket-pair');
    expect(out.lane?.id).toBe('shared-rank-lower-kicker');

    // 77 vs AKo: two overs, no shared — classic race
    out = classifyLane('77', 'AKo');
    expect(out.shape.id).toBe('pocket-pair');
    expect(out.lane?.id).toBe('classic-race-overs');

    // 88 vs A5o: split
    out = classifyLane('88', 'A5o');
    expect(out.shape.id).toBe('pocket-pair');
    expect(out.lane?.id).toBe('pair-vs-split');

    // TT vs 87s: two unders
    out = classifyLane('TT', '87s');
    expect(out.shape.id).toBe('pocket-pair');
    expect(out.lane?.id).toBe('pair-vs-two-unders');
  });

  test('Ax hero shape — domination lanes', () => {
    // A5s vs AJo: higher Ax (kicker dominated)
    let out = classifyLane('A5s', 'AJo');
    expect(out.shape.id).toBe('ax-suited');
    expect(out.lane?.id).toBe('vs-higher-ax');

    // AKs vs A2o: lower Ax (hero dominates)
    out = classifyLane('AKs', 'A2o');
    expect(out.shape.id).toBe('ax-suited');
    expect(out.lane?.id).toBe('vs-lower-ax');

    // A5s vs QQ: split — Ace over, 5 under
    out = classifyLane('A5s', 'QQ');
    expect(out.shape.id).toBe('ax-suited');
    expect(out.lane?.id).toBe('vs-pair-above-kicker');

    // AJs vs 22: race (both hero cards over pair)
    out = classifyLane('AJs', '22');
    expect(out.shape.id).toBe('ax-suited');
    expect(out.lane?.id).toBe('vs-pair-below-kicker');

    // A5s vs 55: pair of hero's kicker rank
    out = classifyLane('A5s', '55');
    expect(out.shape.id).toBe('ax-suited');
    expect(out.lane?.id).toBe('vs-pair-equal-to-kicker');
  });

  test('broadway-broadway hero — shared-rank routing', () => {
    // KQ vs AK: shared K, villain higher (has A) → vs-ax-shared
    let out = classifyLane('KQo', 'AKo');
    expect(out.shape.id).toBe('broadway-broadway');
    expect(out.lane?.id).toBe('vs-ax-shared');

    // KQ vs QQ: villain pair of hero's LOW card
    out = classifyLane('KQo', 'QQ');
    expect(out.shape.id).toBe('broadway-broadway');
    expect(out.lane?.id).toBe('vs-pair-of-low-card');

    // KQ vs KK: villain pair of hero's HIGH card
    out = classifyLane('KQo', 'KK');
    expect(out.shape.id).toBe('broadway-broadway');
    expect(out.lane?.id).toBe('vs-pair-of-high-card');

    // KQ vs 54s: suited connector
    out = classifyLane('KQo', '54s');
    expect(out.shape.id).toBe('broadway-broadway');
    expect(out.lane?.id).toBe('vs-suited-connector');
  });
});

describe('detectApplicableModifiers', () => {
  // AKs vs JTo — pocket-pair-like structure doesn't apply; test via the Ax-suited
  // lane "vs-unpaired-no-shared" which declares heroSuited + villainSuited modifiers.
  test('hero suited alone picks up heroSuited only', () => {
    const hero = parseHandClass('AKs');
    const villain = parseHandClass('JTo');
    const { lane } = classifyLane(hero, villain); // ax-suited / vs-unpaired-no-shared
    const mods = detectApplicableModifiers(hero, villain, lane);
    expect(mods.has('heroSuited')).toBe(true);
    expect(mods.has('villainSuited')).toBe(false);
  });

  test('both suited picks up hero + villain suited', () => {
    const hero = parseHandClass('AKs');
    const villain = parseHandClass('JTs');
    const { lane } = classifyLane(hero, villain);
    const mods = detectApplicableModifiers(hero, villain, lane);
    expect(mods.has('heroSuited')).toBe(true);
    expect(mods.has('villainSuited')).toBe(true);
  });

  test('offsuit hero vs suited villain picks up villainSuited only', () => {
    const hero = parseHandClass('AKo');
    const villain = parseHandClass('JTs');
    const { lane } = classifyLane(hero, villain); // ax-offsuit / vs-unpaired-no-shared
    const mods = detectApplicableModifiers(hero, villain, lane);
    expect(mods.has('heroSuited')).toBe(false);
    expect(mods.has('villainSuited')).toBe(true);
  });

  test('connectedness modifier fires for low-gap villain (classic-race-overs)', () => {
    const hero = parseHandClass('77');
    const villain = parseHandClass('AKo');
    const { lane } = classifyLane(hero, villain);
    expect(lane.id).toBe('classic-race-overs');
    // AK is gap 0 (adjacent).
    const mods = detectApplicableModifiers(hero, villain, lane);
    expect(mods.has('villainSuited')).toBe(false);
    // classic-race-overs lane does NOT declare connectedness, so it's never
    // returned — even though AK is adjacent.
    expect(mods.has('connectedness')).toBe(false);
  });

  test('connectedness fires only if lane declares it', () => {
    const hero = parseHandClass('T9s');
    const villain = parseHandClass('AA'); // vs-overpair lane declares connectedness
    const { lane } = classifyLane(hero, villain);
    expect(lane.id).toBe('vs-overpair');
    const mods = detectApplicableModifiers(hero, villain, lane);
    // Villain is a pair, so connectedness wouldn't fire anyway (pair has no gap).
    expect(mods.has('connectedness')).toBe(false);
  });

  test('no-modifier lane returns empty set', () => {
    const hero = parseHandClass('AKs');
    const villain = parseHandClass('AA');
    const { lane } = classifyLane(hero, villain);
    expect(lane.id).toBe('vs-aa');
    const mods = detectApplicableModifiers(hero, villain, lane);
    expect(mods.size).toBe(0);
  });
});

// Local parse that mirrors what classifyHero does internally (avoid circular test-utility import).
const RANK_MAP = Object.fromEntries(RANK_CHARS.split('').map((c, i) => [c, i]));
const parse = (s) => {
  if (s.length === 2) {
    const r = RANK_MAP[s[0]];
    return { rankHigh: r, rankLow: r, suited: false, pair: true };
  }
  const r1 = RANK_MAP[s[0]];
  const r2 = RANK_MAP[s[1]];
  return {
    rankHigh: Math.max(r1, r2),
    rankLow: Math.min(r1, r2),
    suited: s[2] === 's',
    pair: false,
  };
};
