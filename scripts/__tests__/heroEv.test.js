/**
 * heroEv.test.js — WS-287 Phase 1: realized outcomes, behaviour policy, IPS estimator.
 *
 * The tests that matter most here are the IDENTITIES, not the happy paths:
 *   - every chip is accounted for, and the only leak is the rake (zero-sum);
 *   - scoring the behaviour policy against itself must reproduce the plain sample mean
 *     exactly, which is what proves the importance weighting is not quietly inventing
 *     an edge.
 * An instrument that can only pass its own happy path is the failure mode this whole
 * ticket exists to prevent.
 */

import { describe, it, expect } from 'vitest';
import { PRIMITIVE_ACTIONS } from '../../src/constants/primitiveActions.js';
import { resolveHandOutcome, OUTCOME_SKIP_REASONS } from '../backtest/handOutcome.mjs';
import {
  buildPolicyTable, queryPolicy, applyFoldShift,
  POLICY_PARTITION_STAMP, POLICY_HIERARCHY, RESPONSES_BY_FACING,
} from '../backtest/behaviorPolicy.mjs';
import {
  estimateEdge, weightFor, poolValue, wisValue, TREATMENT, SCORE_SKIP_REASONS,
} from '../backtest/ipsEstimator.mjs';

// =============================================================================
// helpers — build app-shaped hands matching phhAdapter output
// =============================================================================

const A = PRIMITIVE_ACTIONS;

const mkHand = ({
  actions = [], committed = {}, board = [], showdown = {},
  street = 'preflop', bb = 2, handId = 1,
}) => ({
  handId,
  seatPlayers: Object.fromEntries(Object.keys(committed).map((s) => [s, `p${s}`])),
  gameState: {
    actionSequence: actions.map((a, i) => ({ order: i, ...a })),
    dealerButtonSeat: 9,
    mySeat: null,
    communityCards: board,
    showdownCards: showdown,
    currentStreet: street,
    potSize: Object.values(committed).reduce((s, v) => s + v, 0),
    blinds: { sb: bb / 2, bb },
  },
  _backtest: { bb, committedBySeat: committed, site: 'T', stakeLabel: '50NLH' },
});

const sumNet = (r) => Object.values(r.netBySeat).reduce((s, v) => s + v, 0);

// =============================================================================
// handOutcome
// =============================================================================

describe('resolveHandOutcome — uncontested pots', () => {
  it('awards the whole pot to the last live seat when everyone folds', () => {
    const hand = mkHand({
      actions: [
        { seat: '3', action: A.RAISE, street: 'preflop', amount: 6 },
        { seat: '1', action: A.FOLD, street: 'preflop' },
        { seat: '2', action: A.FOLD, street: 'preflop' },
      ],
      committed: { 1: 1, 2: 2, 3: 6 },
      bb: 2,
    });
    const r = resolveHandOutcome(hand);
    expect(r.resolved).toBe(true);
    expect(r.wentToShowdown).toBe(false);
    expect(r.winners).toEqual(['3']);
    // Seat 3 committed 6, collects 1+2 of dead money => +3 chips => +1.5bb.
    expect(r.netBySeat['3']).toBeCloseTo(1.5, 6);
    expect(r.netBySeat['1']).toBeCloseTo(-0.5, 6);
    expect(r.netBySeat['2']).toBeCloseTo(-1, 6);
    expect(sumNet(r)).toBeCloseTo(0, 6);
  });

  it('returns an uncalled bet to the bettor via the top layer', () => {
    // Seat 2 shoves 50 over a 10 bet; seat 1 folds. The 40 excess has only one
    // eligible seat in its layer and must come straight back.
    const hand = mkHand({
      actions: [
        { seat: '1', action: A.BET, street: 'flop', amount: 10 },
        { seat: '2', action: A.RAISE, street: 'flop', amount: 50 },
        { seat: '1', action: A.FOLD, street: 'flop' },
      ],
      committed: { 1: 10, 2: 50 },
      bb: 2,
      street: 'flop',
    });
    const r = resolveHandOutcome(hand);
    expect(r.resolved).toBe(true);
    expect(r.netBySeat['2']).toBeCloseTo(5, 6);   // wins seat 1's 10 chips = 5bb
    expect(r.netBySeat['1']).toBeCloseTo(-5, 6);
    expect(sumNet(r)).toBeCloseTo(0, 6);
  });
});

describe('resolveHandOutcome — showdowns', () => {
  const board = ['A♠', 'K♦', '7♣', '2♥', '9♠'];

  it('awards to the best hand when both seats show', () => {
    const hand = mkHand({
      actions: [
        { seat: '1', action: A.CHECK, street: 'river' },
        { seat: '2', action: A.CHECK, street: 'river' },
      ],
      committed: { 1: 20, 2: 20 },
      board,
      // Seat 1 has two pair aces-kings; seat 2 has a pair of nines.
      showdown: { 1: ['A♥', 'K♠'], 2: ['9♦', '5♣'] },
      street: 'river',
      bb: 2,
    });
    const r = resolveHandOutcome(hand);
    expect(r.resolved).toBe(true);
    expect(r.wentToShowdown).toBe(true);
    expect(r.winners).toEqual(['1']);
    expect(r.netBySeat['1']).toBeCloseTo(10, 6);
    expect(sumNet(r)).toBeCloseTo(0, 6);
  });

  it('splits an exactly tied pot', () => {
    const hand = mkHand({
      actions: [{ seat: '1', action: A.CHECK, street: 'river' }],
      committed: { 1: 20, 2: 20 },
      board,
      // Both play the board's two pair + ace kicker via identical holdings.
      showdown: { 1: ['Q♥', 'J♠'], 2: ['Q♦', 'J♣'] },
      street: 'river',
      bb: 2,
    });
    const r = resolveHandOutcome(hand);
    expect(r.resolved).toBe(true);
    expect(r.winners.sort()).toEqual(['1', '2']);
    expect(r.netBySeat['1']).toBeCloseTo(0, 6);
    expect(r.netBySeat['2']).toBeCloseTo(0, 6);
  });

  it('treats a seat that did not show as mucked, and still resolves', () => {
    // This is the case that recovers ~40% of showdowns: only the winner's cards
    // were recorded. A mucked hand cannot be awarded a pot — a rule, not a guess.
    const hand = mkHand({
      actions: [{ seat: '1', action: A.CHECK, street: 'river' }],
      committed: { 1: 20, 2: 20 },
      board,
      showdown: { 2: ['9♦', '5♣'] },
      street: 'river',
      bb: 2,
    });
    const r = resolveHandOutcome(hand);
    expect(r.resolved).toBe(true);
    expect(r.winners).toEqual(['2']);
    expect(r.netBySeat['2']).toBeCloseTo(10, 6);
    expect(sumNet(r)).toBeCloseTo(0, 6);
  });

  it('refuses a contested pot where nobody showed', () => {
    const hand = mkHand({
      actions: [{ seat: '1', action: A.CHECK, street: 'river' }],
      committed: { 1: 20, 2: 20 },
      board,
      showdown: {},
      street: 'river',
      bb: 2,
    });
    const r = resolveHandOutcome(hand);
    expect(r.resolved).toBe(false);
    expect(r.reason).toBe(OUTCOME_SKIP_REASONS.SHOWDOWN_CARDS_MISSING);
  });

  it('refuses a contested pot with an incomplete board rather than guessing', () => {
    const hand = mkHand({
      actions: [{ seat: '1', action: A.CHECK, street: 'flop' }],
      committed: { 1: 20, 2: 20 },
      board: ['A♠', 'K♦', '7♣'],
      showdown: { 1: ['A♥', 'K♠'], 2: ['9♦', '5♣'] },
      street: 'flop',
      bb: 2,
    });
    const r = resolveHandOutcome(hand);
    expect(r.resolved).toBe(false);
    expect(r.reason).toBe(OUTCOME_SKIP_REASONS.INCOMPLETE_BOARD);
  });
});

describe('resolveHandOutcome — side pots', () => {
  const board = ['A♠', 'K♦', '7♣', '2♥', '9♠'];

  it('gives the short all-in only the main pot when a deeper seat wins the side', () => {
    // Seat 3 is all-in for 10. Seats 1 and 2 continue to 40 each.
    // Main pot   = 30 (10 x 3), eligible: all three.
    // Side pot   = 60 (30 x 2), eligible: seats 1 and 2 only.
    // Seat 3 has the best hand (two pair AK) and takes the main;
    // seat 1 beats seat 2 for the side pot with a pair of nines vs queen high.
    const hand = mkHand({
      actions: [{ seat: '1', action: A.CHECK, street: 'river' }],
      committed: { 1: 40, 2: 40, 3: 10 },
      board,
      showdown: { 1: ['9♦', '5♣'], 2: ['Q♥', 'J♠'], 3: ['A♥', 'K♠'] },
      street: 'river',
      bb: 2,
    });
    const r = resolveHandOutcome(hand);
    expect(r.resolved).toBe(true);
    // Seat 3: wins 30, committed 10 => +20 chips => +10bb.
    expect(r.netBySeat['3']).toBeCloseTo(10, 6);
    // Seat 1: wins the 60 side pot, committed 40 => +20 chips => +10bb.
    expect(r.netBySeat['1']).toBeCloseTo(10, 6);
    // Seat 2: loses everything.
    expect(r.netBySeat['2']).toBeCloseTo(-20, 6);
    expect(sumNet(r)).toBeCloseTo(0, 6);
  });
});

describe('resolveHandOutcome — rake', () => {
  it('leaks exactly the rake and nothing else', () => {
    const hand = mkHand({
      actions: [
        { seat: '1', action: A.BET, street: 'flop', amount: 10 },
        { seat: '2', action: A.FOLD, street: 'flop' },
      ],
      committed: { 1: 10, 2: 4 },
      street: 'flop',
      bb: 2,
    });
    const rakeConfig = { pct: 0.05, cap: 3, noFlopNoDrop: true };
    const r = resolveHandOutcome(hand, { rakeConfig });
    expect(r.resolved).toBe(true);
    // Pot 14 -> rake min(0.7, 3) = 0.7 chips = 0.35bb.
    expect(r.rakeBB).toBeCloseTo(0.35, 6);
    expect(sumNet(r)).toBeCloseTo(-r.rakeBB, 2);
  });

  it('drops no rake preflop under no-flop-no-drop', () => {
    const hand = mkHand({
      actions: [{ seat: '2', action: A.FOLD, street: 'preflop' }],
      committed: { 1: 6, 2: 2 },
      street: 'preflop',
      bb: 2,
    });
    const r = resolveHandOutcome(hand, {
      rakeConfig: { pct: 0.05, cap: 3, noFlopNoDrop: true },
    });
    expect(r.rakeBB).toBe(0);
    expect(sumNet(r)).toBeCloseTo(0, 6);
  });
});

// =============================================================================
// behaviorPolicy
// =============================================================================

const obs = (over = {}) => ({
  facingAction: 'bet', action: 'fold',
  isAgg: 'def', isIP: 'ip', texture: 'dry', street: 'flop',
  posCategory: 'LATE', sizeBucket: '33-66',
  ...over,
});

describe('behaviorPolicy — provenance and shape', () => {
  it('stamps the pool-train partition the leakage guard requires', () => {
    const t = buildPolicyTable([obs()]);
    expect(t.provenance.partition).toBe(POLICY_PARTITION_STAMP);
    expect(t.provenance.hierarchy).toEqual(POLICY_HIERARCHY);
  });

  it('conditions on bet sizing, not merely slices by it', () => {
    // pi_ours reacts to bet-to-pot ratio (it sets pot odds), so a propensity blind to
    // sizing would be an unobserved confounder in every weight.
    expect(POLICY_HIERARCHY).toContain('sizeBucket');
  });

  it('rejects observations whose action is not in the facing-action response set', () => {
    const t = buildPolicyTable([obs({ facingAction: 'none', action: 'fold' })]);
    expect(t.provenance.observations).toBe(0);
    expect(t.provenance.skipped.actionNotInResponseSet).toBe(1);
  });

  it('returns a normalized distribution over the correct response set', () => {
    const t = buildPolicyTable([obs()]);
    const { actions } = queryPolicy(t, obs());
    expect(Object.keys(actions).sort()).toEqual([...RESPONSES_BY_FACING.bet].sort());
    const sum = Object.values(actions).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe('behaviorPolicy — shrinkage, not thresholds', () => {
  it('moves smoothly toward observed behaviour as evidence accumulates', () => {
    const thin = buildPolicyTable(Array.from({ length: 3 }, () => obs({ action: 'fold' })));
    const thick = buildPolicyTable(Array.from({ length: 3000 }, () => obs({ action: 'fold' })));
    const pThin = queryPolicy(thin, obs()).actions.fold;
    const pThick = queryPolicy(thick, obs()).actions.fold;
    expect(pThin).toBeGreaterThan(0.3);
    expect(pThick).toBeGreaterThan(pThin);
    expect(pThick).toBeGreaterThan(0.95);
  });

  it('inherits the parent estimate for a context it has never seen', () => {
    // Everything observed on dry flops; query a wet one. No cutoff, no undefined —
    // the unseen cell simply falls back through the hierarchy.
    const t = buildPolicyTable(Array.from({ length: 200 }, () => obs({ action: 'fold' })));
    const unseen = queryPolicy(t, obs({ texture: 'wet' }));
    expect(unseen.actions.fold).toBeGreaterThan(0.5);
    expect(Number.isFinite(unseen.actions.fold)).toBe(true);
  });

  it('never returns a zero probability for an action in the response set', () => {
    // A zero propensity would make an observed action undividable; the seed prior
    // guarantees strictly positive mass everywhere.
    const t = buildPolicyTable(Array.from({ length: 5000 }, () => obs({ action: 'fold' })));
    const { actions } = queryPolicy(t, obs());
    for (const a of RESPONSES_BY_FACING.bet) expect(actions[a]).toBeGreaterThan(0);
  });
});

describe('behaviorPolicy — live-shift sensitivity arm', () => {
  it('adds the requested fold mass and renormalizes the rest proportionally', () => {
    const shifted = applyFoldShift({ fold: 0.50, call: 0.30, raise: 0.20 }, 13);
    expect(shifted.fold).toBeCloseTo(0.63, 10);
    expect(shifted.call + shifted.raise).toBeCloseTo(0.37, 10);
    // Call:raise ratio preserved at 3:2.
    expect(shifted.call / shifted.raise).toBeCloseTo(1.5, 10);
  });

  it('is a no-op at zero shift and on distributions with no fold branch', () => {
    expect(applyFoldShift({ fold: 0.5, call: 0.5 }, 0)).toEqual({ fold: 0.5, call: 0.5 });
    expect(applyFoldShift({ check: 0.7, bet: 0.3 }, 13)).toEqual({ check: 0.7, bet: 0.3 });
  });
});

// =============================================================================
// ipsEstimator — the identities
// =============================================================================

const mkDecision = (over = {}) => ({
  piOurs: { fold: 0.5, call: 0.3, raise: 0.2 },
  piPool: { fold: 0.5, call: 0.3, raise: 0.2 },
  observedAction: 'fold',
  netBB: 1,
  playerId: 'p1',
  ...over,
});

describe('ipsEstimator — weights', () => {
  it('is the ratio of the two propensities for the observed action', () => {
    const r = weightFor(mkDecision({
      piOurs: { fold: 0.8, call: 0.1, raise: 0.1 },
      piPool: { fold: 0.4, call: 0.3, raise: 0.3 },
    }));
    expect(r.ok).toBe(true);
    expect(r.raw).toBeCloseTo(2, 10);
  });

  it('drops a zero-propensity decision instead of dividing by it', () => {
    const r = weightFor(mkDecision({ piPool: { fold: 0, call: 0.5, raise: 0.5 } }));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(SCORE_SKIP_REASONS.ZERO_PROPENSITY);
  });

  it('keeps a zero-weight decision — our policy simply would not act that way', () => {
    const r = weightFor(mkDecision({ piOurs: { fold: 0, call: 0.5, raise: 0.5 } }));
    expect(r.ok).toBe(true);
    expect(r.w).toBe(0);
  });

  it('clips at the cap and flags that it did', () => {
    const r = weightFor(
      mkDecision({ piPool: { fold: 0.001, call: 0.5, raise: 0.499 } }),
      { weightCap: 20 },
    );
    expect(r.w).toBe(20);
    expect(r.clipped).toBe(true);
  });
});

describe('ipsEstimator — THE identity that proves it is not inventing an edge', () => {
  it('reports exactly zero edge when our policy IS the behaviour policy', () => {
    // pi_ours = pi_pool => every weight is 1 => WIS collapses to the plain mean =>
    // the edge must be identically zero. If this ever fails, the estimator is
    // manufacturing signal and no number it produces can be trusted.
    const pi = { fold: 0.55, call: 0.30, raise: 0.15 };
    const acts = ['fold', 'call', 'raise'];
    const decisions = Array.from({ length: 400 }, (_, i) => mkDecision({
      piOurs: pi,
      piPool: pi,
      observedAction: acts[i % 3],
      netBB: ((i * 37) % 23) - 11,
      playerId: `p${i % 25}`,
    }));

    const r = estimateEdge(decisions);
    expect(r.n).toBe(400);
    expect(r.edgeBB).toBeCloseTo(0, 10);
    expect(r.valueOursBB).toBeCloseTo(r.valuePoolBB, 10);
    // And the pool value is just the sample mean of realized outcomes.
    const mean = decisions.reduce((s, d) => s + d.netBB, 0) / decisions.length;
    expect(r.valuePoolBB).toBeCloseTo(mean, 4);
  });

  it('recovers a real edge when our policy favours the profitable action', () => {
    // 'raise' pays +10, everything else pays -1. A policy that raises more than the
    // field must score above it.
    const acts = ['fold', 'call', 'raise'];
    const decisions = Array.from({ length: 600 }, (_, i) => {
      const a = acts[i % 3];
      return mkDecision({
        piPool: { fold: 0.34, call: 0.33, raise: 0.33 },
        piOurs: { fold: 0.10, call: 0.10, raise: 0.80 },
        observedAction: a,
        netBB: a === 'raise' ? 10 : -1,
        playerId: `p${i % 30}`,
      });
    });
    const r = estimateEdge(decisions);
    expect(r.edgeBB).toBeGreaterThan(0);
    expect(r.edgeCiLowBB).toBeGreaterThan(0);
  });

  it('reports a CI that straddles zero when outcomes are unrelated to the action', () => {
    const acts = ['fold', 'call', 'raise'];
    const decisions = Array.from({ length: 600 }, (_, i) => mkDecision({
      piPool: { fold: 0.34, call: 0.33, raise: 0.33 },
      piOurs: { fold: 0.10, call: 0.10, raise: 0.80 },
      observedAction: acts[i % 3],
      netBB: ((i * 53) % 21) - 10,   // no relationship to the action taken
      playerId: `p${i % 30}`,
    }));
    const r = estimateEdge(decisions);
    expect(r.edgeCiLowBB).toBeLessThanOrEqual(0);
    expect(r.edgeCiHighBB).toBeGreaterThanOrEqual(0);
  });
});

describe('ipsEstimator — honesty of the reported precision', () => {
  it('reports an effective sample size far below n when weights are concentrated', () => {
    const decisions = Array.from({ length: 200 }, (_, i) => mkDecision({
      // One decision in 50 carries nearly all the weight.
      piOurs: i % 50 === 0 ? { fold: 1, call: 0, raise: 0 } : { fold: 0.001, call: 0.5, raise: 0.499 },
      piPool: { fold: 0.5, call: 0.3, raise: 0.2 },
      observedAction: 'fold',
      netBB: 1,
      playerId: `p${i % 10}`,
    }));
    const r = estimateEdge(decisions);
    expect(r.ess).toBeLessThan(r.n / 4);
    expect(r.essShare).toBeLessThan(0.25);
  });

  it('resamples players, not decisions, so within-player correlation is respected', () => {
    // 200 decisions from only 4 players carry far less information than 200 from
    // 100 players. The cluster bootstrap must widen accordingly.
    //
    // The outcome is a function of the PLAYER, which is what makes the decisions
    // within a player correlated — resampling decisions independently would treat
    // that shared component as fresh evidence.
    // Players differ in HOW they act and in what they earn, so both the weights and
    // the outcomes carry a cluster-level component. That is precisely the structure a
    // decision-level bootstrap would mistake for independent evidence.
    const acts = ['raise', 'fold', 'call'];
    const earns = [9, -3, 1];
    const mk = (players) => Array.from({ length: 200 }, (_, i) => {
      const p = i % players;
      const kind = p % 3;
      return mkDecision({
        piOurs: { fold: 0.7, call: 0.2, raise: 0.1 },
        piPool: { fold: 0.5, call: 0.3, raise: 0.2 },
        observedAction: acts[kind],
        netBB: earns[kind] + (i % 3) * 0.1,
        playerId: `p${p}`,
      });
    });
    const few = estimateEdge(mk(4));
    const many = estimateEdge(mk(100));
    expect(few.players).toBe(4);
    expect(many.players).toBe(100);
    expect(few.edgeCiHighBB - few.edgeCiLowBB)
      .toBeGreaterThan(many.edgeCiHighBB - many.edgeCiLowBB);
  });

  it('produces a real interval at power-of-two cluster counts (LCG low-bit trap)', () => {
    // Regression: the bootstrap drew indices with `state % mod`. An LCG with a
    // power-of-two modulus has period 2^(k+1) in bit k, so `% 4` cycled 0,1,2,3
    // forever — every resample drew one of each cluster, the statistic never moved,
    // and the CI collapsed to zero width. A zero-width interval is the most dangerous
    // possible failure here: it reads as perfect precision.
    const acts = ['raise', 'fold', 'call'];
    const earns = [9, -3, 1];
    for (const players of [2, 4, 8, 16, 32]) {
      const decisions = Array.from({ length: 160 }, (_, i) => {
        const p = i % players;
        const kind = p % 3;
        return mkDecision({
          piOurs: { fold: 0.7, call: 0.2, raise: 0.1 },
          piPool: { fold: 0.5, call: 0.3, raise: 0.2 },
          observedAction: acts[kind],
          netBB: earns[kind],
          playerId: `p${p}`,
        });
      });
      const r = estimateEdge(decisions);
      expect(r.edgeCiHighBB - r.edgeCiLowBB).toBeGreaterThan(0);
    }
  });

  it('is deterministic — identical input reproduces an identical interval', () => {
    const decisions = Array.from({ length: 300 }, (_, i) => mkDecision({
      observedAction: ['fold', 'call', 'raise'][i % 3],
      netBB: ((i * 17) % 19) - 9,
      playerId: `p${i % 20}`,
    }));
    expect(estimateEdge(decisions)).toEqual(estimateEdge(decisions));
  });

  it('attaches the treatment to every report — a number without one is not a result', () => {
    expect(estimateEdge([mkDecision()]).treatment).toBe(TREATMENT);
    expect(estimateEdge([]).treatment).toBe(TREATMENT);
  });

  it('counts unscorable decisions rather than silently shrinking the sample', () => {
    const decisions = [
      mkDecision(),
      mkDecision({ piPool: { fold: 0, call: 0.5, raise: 0.5 } }),
      mkDecision({ netBB: NaN }),
    ];
    const r = estimateEdge(decisions);
    expect(r.n).toBe(1);
    expect(r.skipped[SCORE_SKIP_REASONS.ZERO_PROPENSITY]).toBe(1);
    expect(r.skipped[SCORE_SKIP_REASONS.MISSING_OUTCOME]).toBe(1);
  });
});

describe('ipsEstimator — value helpers', () => {
  it('poolValue is the unweighted mean and wisValue the weighted one', () => {
    const scored = [{ w: 1, net: 2 }, { w: 3, net: 6 }];
    expect(poolValue(scored)).toBeCloseTo(4, 10);
    expect(wisValue(scored)).toBeCloseTo((1 * 2 + 3 * 6) / 4, 10);
  });
});
