/**
 * heroEvPolicy.test.js — WS-287 Phase 2: geometry, combo sampling, leakage refusal.
 *
 * These cover the parts that are easy to get subtly wrong and impossible to notice
 * afterwards: the pot convention the engine expects, the duplicated size-bucket
 * boundaries, and the guard that keeps the scored players out of their own propensities.
 */

import { describe, it, expect } from 'vitest';
import { PRIMITIVE_ACTIONS } from '../../src/constants/primitiveActions.js';
import { createRange, rangeIndex } from '../../src/utils/pokerCore/rangeMatrix.js';
import { parseBoard } from '../../src/utils/pokerCore/cardParser.js';
import {
  decisionGeometry, facedBetChips, liveOpponentCount, sizeBucketFor as geoSizeBucket,
} from '../backtest/decisionGeometry.mjs';
import { sizeBucketFor as runnerSizeBucket } from '../backtest/runner.mjs';
import { sampleCombos } from '../backtest/heroPolicy.mjs';
import { validateBehaviorPolicy, buildPolicyTable } from '../backtest/behaviorPolicy.mjs';
import { LeakageError } from '../backtest/leakageGuard.mjs';
import { buildHeroEvReport, renderHeroEvReport } from '../backtest/heroEvReport.mjs';

const A = PRIMITIVE_ACTIONS;

const mkHand = ({ actions, potByOrder, bb = 2, seats = ['1', '2', '3'] }) => ({
  handId: 1,
  seatPlayers: Object.fromEntries(seats.map((s) => [s, `p${s}`])),
  gameState: {
    actionSequence: actions,
    dealerButtonSeat: 9,
    communityCards: [],
    showdownCards: {},
    currentStreet: 'flop',
    blinds: { sb: 1, bb },
  },
  _backtest: { bb, potBeforeByOrder: potByOrder, stackBeforeByOrder: {}, committedBySeat: {} },
});

describe('decisionGeometry — the pot convention', () => {
  const hand = mkHand({
    actions: [
      { order: 0, seat: '1', action: A.BET, street: 'flop', amount: 10 },
      { order: 1, seat: '2', action: A.FOLD, street: 'flop' },
      { order: 2, seat: '3', action: A.CALL, street: 'flop', amount: 10 },
    ],
    // Pot as seat 3 decides: 20 dead + seat 1's live 10.
    potByOrder: { 0: 20, 2: 30 },
  });

  it('reports the raw pot INCLUDING the live bet', () => {
    const g = decisionGeometry(hand, 2, 'flop');
    expect(g.potChips).toBe(30);
    expect(g.betChips).toBe(10);
  });

  it('reports the engine pot EXCLUDING it — the engine re-adds it internally', () => {
    // gameTreeEvaluator computes `effectivePot = potSize + villainBet`. Handing it the
    // raw pot would count the live bet twice and shift every pot-odds and breakeven
    // number downstream.
    const g = decisionGeometry(hand, 2, 'flop');
    expect(g.enginePotChips).toBe(20);
    expect(g.enginePotChips + g.betChips).toBe(g.potChips);
  });

  it('never returns a negative engine pot', () => {
    const odd = mkHand({
      actions: [{ order: 0, seat: '1', action: A.BET, street: 'flop', amount: 99 }],
      potByOrder: { 1: 5 },
    });
    odd.gameState.actionSequence.push({ order: 1, seat: '2', action: A.CALL, street: 'flop', amount: 99 });
    expect(decisionGeometry(odd, 1, 'flop').enginePotChips).toBe(0);
  });

  it('reads the faced bet from the same street only', () => {
    const h = mkHand({
      actions: [
        { order: 0, seat: '1', action: A.BET, street: 'flop', amount: 8 },
        { order: 1, seat: '2', action: A.CALL, street: 'flop', amount: 8 },
        { order: 2, seat: '1', action: A.CHECK, street: 'turn' },
      ],
      potByOrder: { 2: 40 },
    });
    // On the turn, facing nothing — the flop bet must not leak forward.
    expect(facedBetChips(h, 2, 'turn')).toBe(0);
  });

  it('returns null rather than guessing when pot geometry is missing', () => {
    expect(decisionGeometry(hand, 99, 'flop')).toBeNull();
  });
});

describe('decisionGeometry — size buckets stay in step with the runner', () => {
  it('agrees with runner.sizeBucketFor across the boundaries', () => {
    // decisionGeometry duplicates the boundaries so the miner need not import the
    // engine. Duplication is only safe while asserted.
    for (const potBB of [1, 7, 33.5, 100]) {
      for (const frac of [0, 0.1, 0.32, 0.33, 0.5, 0.65, 0.66, 0.99, 1, 1.49, 1.5, 3]) {
        const betBB = frac * potBB;
        expect(geoSizeBucket(betBB, potBB)).toBe(runnerSizeBucket(betBB, potBB));
      }
    }
    expect(geoSizeBucket(null, 10)).toBe(runnerSizeBucket(null, 10));
    expect(geoSizeBucket(5, 0)).toBe(runnerSizeBucket(5, 0));
  });
});

describe('liveOpponentCount — multiway is not an afterthought', () => {
  it('counts seats that have not folded before this decision', () => {
    const h = mkHand({
      actions: [
        { order: 0, seat: '2', action: A.FOLD, street: 'flop' },
        { order: 1, seat: '3', action: A.CHECK, street: 'flop' },
      ],
      potByOrder: { 1: 10 },
      seats: ['1', '2', '3', '4'],
    });
    // Hero is seat 1; seat 2 folded; seats 3 and 4 remain.
    expect(liveOpponentCount(h, 1, '1')).toBe(2);
  });

  it('ignores folds that happen after the decision being scored', () => {
    const h = mkHand({
      actions: [
        { order: 0, seat: '1', action: A.BET, street: 'flop', amount: 5 },
        { order: 1, seat: '2', action: A.FOLD, street: 'flop' },
        { order: 2, seat: '3', action: A.FOLD, street: 'flop' },
      ],
      potByOrder: { 0: 10 },
      seats: ['1', '2', '3'],
    });
    // At order 0 nobody has folded yet, so hero faces two live opponents.
    expect(liveOpponentCount(h, 0, '1')).toBe(2);
  });
});

describe('sampleCombos — stratified, deterministic, board-aware', () => {
  const board = parseBoard(['A♠', 'K♦', '7♣']);
  const mkRange = () => {
    const r = createRange();
    r[rangeIndex(12, 12, false)] = 1;   // AA
    r[rangeIndex(12, 11, true)] = 1;    // AKs
    r[rangeIndex(5, 3, false)] = 1;     // 75o-ish junk
    r[rangeIndex(3, 1, true)] = 1;      // low suited junk
    return r;
  };

  it('returns the requested number of samples', () => {
    expect(sampleCombos(mkRange(), board, 8)).toHaveLength(8);
  });

  it('is deterministic — a backtest must reproduce exactly', () => {
    const a = sampleCombos(mkRange(), board, 8).map((c) => `${c.card1}-${c.card2}`);
    const b = sampleCombos(mkRange(), board, 8).map((c) => `${c.card1}-${c.card2}`);
    expect(a).toEqual(b);
  });

  it('spans the strength spectrum rather than clustering', () => {
    // Systematic sampling over a strength-ordered list is what buys stratification at
    // the small K the engine's cost forces.
    const s = sampleCombos(mkRange(), board, 8).map((c) => c.strength);
    expect(Math.max(...s) - Math.min(...s)).toBeGreaterThan(0.3);
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThanOrEqual(s[i - 1]);
  });

  it('excludes combos blocked by the board', () => {
    // A♠ and K♦ are on the board, so no sampled combo may use them.
    const dead = new Set(board);
    for (const c of sampleCombos(mkRange(), board, 12)) {
      expect(dead.has(c.card1)).toBe(false);
      expect(dead.has(c.card2)).toBe(false);
    }
  });

  it('weights sum to one so the marginalization is a proper average', () => {
    const total = sampleCombos(mkRange(), board, 8).reduce((s, c) => s + c.sampleWeight, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('returns nothing for an empty range instead of inventing holdings', () => {
    expect(sampleCombos(createRange(), board, 8)).toEqual([]);
  });
});

describe('validateBehaviorPolicy — the propensity denominator cannot be improvised', () => {
  const good = () => buildPolicyTable(
    [{ facingAction: 'bet', action: 'fold', isAgg: 'def', isIP: 'ip', texture: 'dry', street: 'flop', posCategory: 'LATE', sizeBucket: '33-66' }],
    { poolPct: 50 },
  );

  it('accepts a properly stamped POOL-mined table', () => {
    expect(() => validateBehaviorPolicy(good(), 50)).not.toThrow();
  });

  it('refuses an absent table', () => {
    expect(() => validateBehaviorPolicy(null, 50)).toThrow(LeakageError);
  });

  it('refuses a table that is not stamped pool-train', () => {
    const t = good();
    t.provenance.partition = 'all-players';
    expect(() => validateBehaviorPolicy(t, 50)).toThrow(/not stamped/);
  });

  it('refuses a table mined at a different partition percentage', () => {
    // The EVAL half would no longer be disjoint from the players defining the
    // propensities — the leak this whole split exists to prevent.
    expect(() => validateBehaviorPolicy(good(), 70)).toThrow(/poolPct/);
  });

  it('refuses an empty table', () => {
    const t = buildPolicyTable([], { poolPct: 50 });
    expect(() => validateBehaviorPolicy(t, 50)).toThrow(/no observations/);
  });
});

// =============================================================================
// heroEvReport — the rules it enforces structurally
// =============================================================================

const mkRun = (n = 60) => ({
  decisions: Array.from({ length: n }, (_, i) => ({
    playerId: `p${i % 12}`,
    handId: i,
    observedAction: ['fold', 'call', 'raise'][i % 3],
    netBB: ((i * 31) % 17) - 8,
    netBBUnraked: ((i * 31) % 17) - 8 + 0.4,
    piOurs: { fold: 0.6, call: 0.25, raise: 0.15 },
    piPool: { fold: 0.5, call: 0.3, raise: 0.2 },
    slices: {},
  })),
  config: { rakeConfig: { pct: 0.05, cap: 3, noFlopNoDrop: true } },
  counters: { evalPlayers: 12, handsRead: 100, checkpoints: 5, outcomeUnresolved: {}, policySkips: {} },
  integrity: {
    poolPct: 50,
    decisionsChecked: 60,
    behaviorPolicy: { partition: 'pool-train', poolPct: 50, observations: 12191, players: 400, hierarchy: [] },
  },
  runtimeMs: 1000,
});

describe('heroEvReport — the control that keeps the instrument honest', () => {
  it('scores population-typical against itself at exactly zero', () => {
    // If this ever drifts, the estimator is producing signal from nothing and every
    // other figure on the page is worthless. It is printed on every run for that reason.
    const r = buildHeroEvReport(mkRun());
    expect(r.arms.populationControl.edgeBB).toBeCloseTo(0, 10);
  });

  it('reports the rake-inclusive and rake-free arms side by side', () => {
    // An edge that survives unraked and vanishes under rake is a vanished edge.
    const r = buildHeroEvReport(mkRun());
    expect(r.arms.engineRaked.n).toBeGreaterThan(0);
    expect(r.arms.engineUnraked.n).toBeGreaterThan(0);
  });

  it('requires BOTH the corpus and live-shifted arms to pass C3', () => {
    const r = buildHeroEvReport(mkRun());
    expect(r.gate.c3Passes).toBe(r.gate.corpusArmPasses && r.gate.liveShiftedArmPasses);
  });

  it('refuses to render a figure whose treatment is missing', () => {
    // "Never report a number without the treatment named" — enforced, not trusted.
    const r = buildHeroEvReport(mkRun());
    delete r.arms.engineRaked.treatment;
    expect(() => renderHeroEvReport(r)).toThrow(/no treatment/);
  });

  it('renders an empty run without inventing diagnostics', () => {
    const empty = { ...mkRun(0), decisions: [] };
    const out = renderHeroEvReport(buildHeroEvReport(empty));
    expect(out).toContain('No decisions were scored');
    expect(out).toContain('CONTROL NOT RUN');
    expect(out).not.toContain('undefined');
  });
});
