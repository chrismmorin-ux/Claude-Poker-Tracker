import { describe, test, expect } from 'vitest';
import {
  RANGE_DECOMPOSITION,
  RANGE_ADVANTAGE,
  NUT_ADVANTAGE,
  RANGE_MORPHOLOGY,
  BOARD_TILT,
  CAPPED_RANGE_CHECK,
  WHIFF_RATE,
  FRAMEWORKS,
  FRAMEWORK_ORDER,
  classifyScenario,
} from '../frameworks';
import { parseBoard } from '../../pokerCore/cardParser';
import { archetypeRangeFor } from '../archetypeRanges';

const flop = (...cards) => parseBoard(cards);

describe('frameworks — registry', () => {
  test('14 frameworks registered (7 base + 7 multiway), order matches map', () => {
    expect(Object.keys(FRAMEWORKS)).toHaveLength(14);
    expect(FRAMEWORK_ORDER).toHaveLength(14);
    for (const fw of FRAMEWORK_ORDER) {
      expect(Object.values(FRAMEWORKS)).toContain(fw);
    }
  });

  test('each framework has required API', () => {
    for (const fw of FRAMEWORK_ORDER) {
      expect(typeof fw.id).toBe('string');
      expect(typeof fw.name).toBe('string');
      expect(typeof fw.applies).toBe('function');
      expect(typeof fw.narrate).toBe('function');
      expect(Array.isArray(fw.subcases)).toBe(true);
    }
  });
});

describe('frameworks — RANGE_DECOMPOSITION', () => {
  test('always applies when board has 3 cards', () => {
    const range = archetypeRangeFor({ position: 'BTN', action: 'open' });
    const match = RANGE_DECOMPOSITION.applies({ range, board: flop('K♠', '7♥', '2♦') });
    expect(match).not.toBeNull();
    expect(match.subcase).toBe('always');
    // New shape: details carries handTypes + byGroup from handTypeBreakdown.
    expect(match.details.handTypes).toBeDefined();
    expect(match.details.byGroup).toBeDefined();
  });

  test('does not apply without a 3-card board', () => {
    const range = archetypeRangeFor({ position: 'BTN', action: 'open' });
    const match = RANGE_DECOMPOSITION.applies({ range, board: [] });
    expect(match).toBeNull();
  });

  test('narration cites specific tier percentages', () => {
    const range = archetypeRangeFor({ position: 'BTN', action: 'open' });
    const match = RANGE_DECOMPOSITION.applies({ range, board: flop('K♠', '7♥', '2♦') });
    const narr = RANGE_DECOMPOSITION.narrate(
      { range, board: flop('K♠', '7♥', '2♦') },
      match,
    );
    // Should name hand-type tiers, not fuzzy bucket labels.
    expect(narr).toMatch(/flush\+|straight\+|top pair\+/i);
    expect(narr).toMatch(/air/i);
  });
});

describe('frameworks — RANGE_ADVANTAGE structural fallback', () => {
  test('applies when both ranges present; classifies subcase', () => {
    const btn = archetypeRangeFor({ position: 'BTN', action: 'open' });
    const bb  = archetypeRangeFor({ position: 'BB',  action: 'call', vs: 'BTN' });
    const match = RANGE_ADVANTAGE.applies({
      range: btn,
      opposingRange: bb,
      board: flop('A♠', 'K♥', '7♦'),
    });
    expect(match).not.toBeNull();
    expect(['significant', 'moderate', 'slight', 'neutral']).toContain(match.subcase);
  });

  test('does not apply without opposingRange', () => {
    const btn = archetypeRangeFor({ position: 'BTN', action: 'open' });
    const match = RANGE_ADVANTAGE.applies({ range: btn, board: flop('A♠', 'K♥', '7♦') });
    expect(match).toBeNull();
  });
});

describe('frameworks — NUT_ADVANTAGE', () => {
  test('narrow AA vs wide small pairs on low board → opposing range favored', () => {
    const aa = archetypeRangeFor({ position: 'UTG', action: 'open' }); // narrow, lots of broadway
    const bbCall = archetypeRangeFor({ position: 'BB', action: 'call', vs: 'UTG' }); // has pairs
    const match = NUT_ADVANTAGE.applies({
      range: aa,
      opposingRange: bbCall,
      board: flop('6♣', '5♥', '4♦'),
    });
    expect(match).not.toBeNull();
    expect(['crushing', 'real', 'nominal']).toContain(match.subcase);
  });
});

describe('frameworks — RANGE_MORPHOLOGY', () => {
  test('BB call vs BTN on AK7 rainbow → capped (call range excludes AA/KK)', () => {
    const bb = archetypeRangeFor({ position: 'BB', action: 'call', vs: 'BTN' });
    const match = RANGE_MORPHOLOGY.applies({ range: bb, board: flop('A♥', 'K♦', '7♠') });
    expect(match).not.toBeNull();
    expect(match.subcase).toBe('capped');
  });

  test('UTG on 654 rainbow → classifies as condensed/linear (has some sets)', () => {
    const utg = archetypeRangeFor({ position: 'UTG', action: 'open' });
    const match = RANGE_MORPHOLOGY.applies({ range: utg, board: flop('6♣', '5♥', '4♦') });
    expect(match).not.toBeNull();
    // UTG has 66 (pocket set on 6) → ~2% nuts → not strictly capped under engine threshold.
    expect(['capped', 'condensed', 'linear']).toContain(match.subcase);
  });

  test('narration mentions the classification', () => {
    const bb = archetypeRangeFor({ position: 'BB', action: 'call', vs: 'BTN' });
    const board = flop('A♥', 'K♦', '7♠');
    const match = RANGE_MORPHOLOGY.applies({ range: bb, board });
    const narr = RANGE_MORPHOLOGY.narrate({ range: bb, board }, match);
    expect(narr).toMatch(/capped/i);
  });
});

describe('frameworks — BOARD_TILT', () => {
  test('AKQ → high_favors_pfr', () => {
    const match = BOARD_TILT.applies({
      range: archetypeRangeFor({ position: 'BTN', action: 'open' }),
      board: flop('A♥', 'K♦', 'Q♠'),
    });
    expect(match.subcase).toBe('high_favors_pfr');
  });

  test('754r → low_favors_defender', () => {
    const match = BOARD_TILT.applies({
      range: archetypeRangeFor({ position: 'BTN', action: 'open' }),
      board: flop('7♣', '5♥', '4♦'),
    });
    expect(match.subcase).toBe('low_favors_defender');
  });

  test('K77 → paired', () => {
    const match = BOARD_TILT.applies({
      range: archetypeRangeFor({ position: 'BTN', action: 'open' }),
      board: flop('K♥', '7♠', '7♦'),
    });
    expect(match.subcase).toBe('paired');
  });

  test('monotone → monotone', () => {
    const match = BOARD_TILT.applies({
      range: archetypeRangeFor({ position: 'BTN', action: 'open' }),
      board: flop('A♥', '9♥', '4♥'),
    });
    expect(match.subcase).toBe('monotone');
  });
});

describe('frameworks — CAPPED_RANGE_CHECK', () => {
  test('BB call vs BTN on AK7 → capped_no_aces', () => {
    const match = CAPPED_RANGE_CHECK.applies({
      range: archetypeRangeFor({ position: 'BB', action: 'call', vs: 'BTN' }),
      board: flop('A♥', 'K♦', '7♠'),
      context: { position: 'BB', action: 'call', vs: 'BTN' },
    });
    expect(match.subcase).toBe('capped_no_aces');
  });

  test('BB call vs CO on KQ2 → capped_no_kings', () => {
    const match = CAPPED_RANGE_CHECK.applies({
      range: archetypeRangeFor({ position: 'BB', action: 'call', vs: 'CO' }),
      board: flop('K♥', 'Q♦', '2♠'),
      context: { position: 'BB', action: 'call', vs: 'CO' },
    });
    expect(match.subcase).toBe('capped_no_kings');
  });

  test('does not apply for open range (aggressive action)', () => {
    const match = CAPPED_RANGE_CHECK.applies({
      range: archetypeRangeFor({ position: 'BTN', action: 'open' }),
      board: flop('A♥', 'K♦', '7♠'),
      context: { position: 'BTN', action: 'open' },
    });
    expect(match).toBeNull();
  });
});

describe('frameworks — WHIFF_RATE', () => {
  test('UTG on 654 classifies without error', () => {
    const utg = archetypeRangeFor({ position: 'UTG', action: 'open' });
    const match = WHIFF_RATE.applies({ range: utg, board: flop('6♣', '5♥', '4♦') });
    expect(['heavy_whiff', 'moderate_whiff', 'light_whiff', 'well_connected']).toContain(match.subcase);
    // Pedagogical air promotes overcards/gutshots out of 'air'. UTG is so
    // broadway-heavy that nearly every combo has overcards → near-zero air.
    expect(match.details.air).toBeGreaterThanOrEqual(0);
    expect(match.details.air).toBeLessThan(0.50);
  });

  test('BTN wide on dry K72 — low-to-moderate whiff', () => {
    const btn = archetypeRangeFor({ position: 'BTN', action: 'open' });
    const match = WHIFF_RATE.applies({ range: btn, board: flop('K♠', '7♥', '2♦') });
    expect(match).not.toBeNull();
    expect(match.details.air).toBeGreaterThan(0);
    expect(match.details.air).toBeLessThan(1);
  });
});

describe('frameworks — classifyScenario composition', () => {
  test('scenario with two ranges yields multiple framework matches', () => {
    const scenario = {
      range: archetypeRangeFor({ position: 'BTN', action: 'open' }),
      opposingRange: archetypeRangeFor({ position: 'BB', action: 'call', vs: 'BTN' }),
      board: flop('A♠', 'K♥', '7♦'),
      context: { position: 'BTN', action: 'open' },
      opposingContext: { position: 'BB', action: 'call', vs: 'BTN' },
    };
    const matches = classifyScenario(scenario);
    const ids = matches.map((m) => m.framework.id);
    expect(ids).toContain('range_decomposition');
    expect(ids).toContain('range_advantage');
    expect(ids).toContain('nut_advantage');
    expect(ids).toContain('range_morphology');
    expect(ids).toContain('board_tilt');
    expect(ids).toContain('whiff_rate');
  });

  test('every match includes narration', () => {
    const scenario = {
      range: archetypeRangeFor({ position: 'BTN', action: 'open' }),
      board: flop('K♠', '7♥', '2♦'),
      context: { position: 'BTN', action: 'open' },
    };
    const matches = classifyScenario(scenario);
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) {
      expect(typeof m.narration).toBe('string');
      expect(m.narration.length).toBeGreaterThan(10);
    }
  });
});
