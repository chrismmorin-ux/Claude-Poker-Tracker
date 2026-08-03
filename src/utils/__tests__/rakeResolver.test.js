/**
 * rakeResolver.test.js — rake reaches the live path, and an unknown rake is not a zero.
 *
 * The last test in this file is the one that matters. `useLiveActionAdvisor` has read a rake
 * config since it was written; nothing ever wrote one, so the capability shipped and sat
 * inert for the life of the project. Wiring a producer without asserting the paths DIVERGE
 * would leave exactly the same failure mode in place — a config that is threaded, plausible,
 * and changes nothing.
 */

import { describe, it, expect } from 'vitest';

import {
  resolveRakeConfig,
  venueClassOf,
  parseStakeLabel,
  ONLINE_RAKE_SCHEDULE,
} from '../rakeResolver.js';
import { GAME_TYPES } from '../../constants/sessionConstants.js';
import { estimateRake } from '../potCalculator.js';

describe('parseStakeLabel — every shape the app actually stores', () => {
  it.each([
    ['1/2', { sb: 1, bb: 2 }],
    ['$1/$2', { sb: 1, bb: 2 }],
    ['1/2 NL', { sb: 1, bb: 2 }],
    ['0.5/1', { sb: 0.5, bb: 1 }],
    ['2 / 5', { sb: 2, bb: 5 }],
  ])('parses %s', (label, expected) => {
    expect(parseStakeLabel(label)).toEqual(expected);
  });

  it('returns null for the legacy placeholder, which carries no stakes', () => {
    expect(parseStakeLabel('NL Holdem')).toBeNull();
  });

  it('returns null rather than guessing on junk', () => {
    expect(parseStakeLabel(undefined)).toBeNull();
    expect(parseStakeLabel('')).toBeNull();
  });
});

describe('venueClassOf — keyed off SOURCE, never off the stake label', () => {
  it('treats ignition as online', () => {
    expect(venueClassOf({ source: 'ignition' })).toBe('online');
  });

  it('treats a named venue as live', () => {
    expect(venueClassOf({ venue: 'Wind Creek' })).toBe('live');
  });

  it('reports unknown rather than defaulting', () => {
    expect(venueClassOf({})).toBe('unknown');
  });
});

describe('live rake resolves from GAME_TYPES', () => {
  it('finds 1/2 by LABEL, which is what sessions actually store', () => {
    // The bug this fixes: GAME_TYPES is keyed ONE_TWO, sessions store '1/2', so
    // GAME_TYPES[session.gameType] was always undefined and read as "no rake".
    const r = resolveRakeConfig({ gameType: '1/2', venue: 'Wind Creek' });
    expect(r.tier).toBe('configured');
    expect(r.rakeConfig).toEqual(GAME_TYPES.ONE_TWO.rake);
    expect(r.rakeConfig.pct).toBe(0.10);
    expect(r.rakeConfig.cap).toBe(8);
  });

  it.each([['1/3', 'ONE_THREE'], ['2/5', 'TWO_FIVE']])('resolves %s', (label, key) => {
    expect(resolveRakeConfig({ gameType: label, venue: 'x' }).rakeConfig).toEqual(GAME_TYPES[key].rake);
  });

  it('honours no-flop-no-drop, which is what creates the steal/defend asymmetry', () => {
    const { rakeConfig } = resolveRakeConfig({ gameType: '1/2', venue: 'x' });
    expect(rakeConfig.noFlopNoDrop).toBe(true);
    expect(estimateRake(60, rakeConfig, 'preflop')).toBe(0);
    expect(estimateRake(60, rakeConfig, 'flop')).toBeGreaterThan(0);
  });

  it('caps the drop', () => {
    const { rakeConfig } = resolveRakeConfig({ gameType: '1/2', venue: 'x' });
    expect(estimateRake(1000, rakeConfig, 'flop')).toBe(8);
  });
});

describe('online rake is a DIFFERENT regime', () => {
  it('does not use the live schedule for an online table at the same stakes', () => {
    const live = resolveRakeConfig({ gameType: '1/2', venue: 'Wind Creek' });
    const online = resolveRakeConfig({ gameType: '1/2', source: 'ignition' });
    // Applying one to the other would be WS-333's transfer error committed inside the app.
    expect(online.rakeConfig).not.toEqual(live.rakeConfig);
    expect(online.rakeConfig.cap).toBeLessThan(live.rakeConfig.cap);
  });

  it('prefers captured wire blinds over the label', () => {
    const r = resolveRakeConfig({ gameType: 'NL Holdem', blinds: { sb: 0.5, bb: 1 }, source: 'ignition' });
    expect(r.tier).toBe('online-default');
    expect(r.rakeConfig).toBeTruthy();
  });

  it('is stamped as an ESTIMATE, because the wire does not carry the schedule', () => {
    const r = resolveRakeConfig({ gameType: '0.5/1', source: 'ignition' });
    expect(r.tier).toBe('online-default');
    expect(r.reason).toMatch(/ESTIMATE/);
  });

  it('scales the cap with stakes', () => {
    const micro = resolveRakeConfig({ blinds: { sb: 0.05, bb: 0.10 }, source: 'ignition' });
    const big = resolveRakeConfig({ blinds: { sb: 5, bb: 10 }, source: 'ignition' });
    expect(big.rakeConfig.cap).toBeGreaterThan(micro.rakeConfig.cap);
  });

  it('every band honours no-flop-no-drop', () => {
    for (const band of ONLINE_RAKE_SCHEDULE) expect(band.rake.noFlopNoDrop).toBe(true);
  });
});

describe('a known ROOM beats a stake-level default', () => {
  it('resolves Wind Creek 1/3 to its published schedule, drop included', async () => {
    const { CHICAGO_AREA_RAKE } = await import('../../constants/rakeStructures.js');
    const wc = CHICAGO_AREA_RAKE.find((r) => r.room === 'Wind Creek Chicago Southland');
    const r = resolveRakeConfig({ gameType: '1/3', venue: 'Wind Creek Chicago Southland' });
    expect(r.tier).toMatch(/^room:/);
    expect(r.rakeConfig).toEqual(wc.games['1/3']);
    expect(r.rakeConfig.jackpotDrop).toBe(2);
    expect(r.source).toContain('pokeratlas');
  });

  it('normalizes the stake label so $1/$3 and "1/3 NL" reach the same entry', () => {
    const a = resolveRakeConfig({ gameType: '$1/$3', venue: 'Wind Creek Chicago Southland' });
    const b = resolveRakeConfig({ gameType: '1/3 NL', venue: 'Wind Creek Chicago Southland' });
    expect(a.rakeConfig).toEqual(b.rakeConfig);
  });

  it('falls back to the stake default for an unregistered room, and SAYS it is a default', () => {
    const r = resolveRakeConfig({ gameType: '1/2', venue: 'Some Home Game' });
    expect(r.tier).toBe('configured');
    expect(r.reason).toMatch(/stake-level default/);
  });

  it('carries the verification date, because rake schedules go stale', () => {
    const r = resolveRakeConfig({ gameType: '1/3', venue: 'Rivers Casino Des Plaines' });
    expect(r.reason).toMatch(/read 2026-08-02/);
    expect(r.reason).toMatch(/re-verify/);
  });
});

describe('the flat jackpot drop, which the old model could not express', () => {
  it('adds on top of the capped house rake', () => {
    const { rakeConfig } = resolveRakeConfig({ gameType: '1/3', venue: 'Wind Creek Chicago Southland' });
    // $30 pot: $3 house + $2 drop = $5, NOT $3.
    expect(estimateRake(30, rakeConfig, 'flop')).toBeCloseTo(5, 6);
    // $200 pot: house capped at $6, drop still $2.
    expect(estimateRake(200, rakeConfig, 'flop')).toBeCloseTo(8, 6);
  });

  it('is not taken below the drop threshold', () => {
    const { rakeConfig } = resolveRakeConfig({ gameType: '1/3', venue: 'Wind Creek Chicago Southland' });
    expect(estimateRake(10, rakeConfig, 'flop')).toBeCloseTo(1, 6); // 10% only
  });

  it('is still zero preflop under no-flop-no-drop', () => {
    const { rakeConfig } = resolveRakeConfig({ gameType: '1/3', venue: 'Wind Creek Chicago Southland' });
    expect(estimateRake(200, rakeConfig, 'preflop')).toBe(0);
  });

  it('makes the EFFECTIVE rate far worse than the headline at small pots', async () => {
    const { effectiveRakePct } = await import('../../constants/rakeStructures.js');
    const { rakeConfig } = resolveRakeConfig({ gameType: '1/3', venue: 'Wind Creek Chicago Southland' });
    // The headline is "10%". The truth at a $30 pot is 16.7%.
    expect(effectiveRakePct(rakeConfig, 30)).toBeGreaterThan(0.16);
    expect(effectiveRakePct(rakeConfig, 200)).toBeLessThan(0.05);
  });

  it('leaves configs without a drop byte-identical — the change is additive', () => {
    expect(estimateRake(100, { pct: 0.05, cap: 3, noFlopNoDrop: true }, 'flop')).toBe(3);
  });
});

describe('an UNKNOWN rake is not a ZERO rake', () => {
  it('distinguishes tournament (genuinely none) from unidentifiable (a gap)', () => {
    const tourney = resolveRakeConfig({ gameType: 'Tournament', venue: 'x' });
    const mystery = resolveRakeConfig({ gameType: '7/13', venue: 'x' });
    expect(tourney.rakeConfig).toBeNull();
    expect(mystery.rakeConfig).toBeNull();
    // Same config, DIFFERENT tier — which is the whole point.
    expect(tourney.tier).toBe('none');
    expect(mystery.tier).toBe('unknown');
  });

  it('says why it could not resolve, so the gap is reportable', () => {
    const r = resolveRakeConfig({ gameType: 'NL Holdem', source: 'ignition' });
    expect(r.tier).toBe('unknown');
    expect(r.reason).toMatch(/gap, not a zero/);
  });

  it('lets an explicit override win', () => {
    const override = { pct: 0.03, cap: 2, noFlopNoDrop: true };
    const r = resolveRakeConfig({ gameType: '1/2', venue: 'x', override });
    expect(r.rakeConfig).toBe(override);
    expect(r.tier).toBe('override');
  });
});

/**
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE DIVERGENCE ASSERTION.
 * ─────────────────────────────────────────────────────────────────────────────────────
 */
describe('the wired rake actually CHANGES the money', () => {
  it('a live 1/2 pot pays a drop the null config did not', () => {
    const { rakeConfig } = resolveRakeConfig({ gameType: '1/2', venue: 'Wind Creek' });
    const pot = 40;
    const before = estimateRake(pot, null, 'flop');       // what the app did until now
    const after = estimateRake(pot, rakeConfig, 'flop');  // what it does with rake wired
    expect(before).toBe(0);
    expect(after).toBeCloseTo(4, 6);
    expect(after).toBeGreaterThan(before);
  });

  it('live and online drops differ on the SAME pot — the regimes are not interchangeable', () => {
    const live = resolveRakeConfig({ gameType: '1/2', venue: 'Wind Creek' }).rakeConfig;
    const online = resolveRakeConfig({ gameType: '1/2', source: 'ignition' }).rakeConfig;
    const pot = 120;
    expect(estimateRake(pot, live, 'flop')).not.toBeCloseTo(estimateRake(pot, online, 'flop'), 6);
  });

  it('raises a blind defender\'s required equity, in the direction WS-333 measured', async () => {
    const { deriveFloor } = await import('../exploitEngine/unexploitableFloor.js');
    const spot = { toCallBB: 1.5, potBeforeCallBB: 4, betBB: 2.5, closesAction: true };
    const unraked = deriveFloor({ ...spot, rakeConfig: null });
    const raked = deriveFloor({
      ...spot, rakeConfig: resolveRakeConfig({ gameType: '1/2', venue: 'x' }).rakeConfig,
    });
    expect(raked.requiredEquity).toBeGreaterThan(unraked.requiredEquity);
  });
});
