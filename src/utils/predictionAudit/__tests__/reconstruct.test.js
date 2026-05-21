/**
 * reconstruct.test.js — PMC Phase 5a primitive (WS-177 / SPR-068) +
 *                       Phase 5a-2 engine queries (WS-178 / SPR-070).
 *
 * Pins the reconstructor's contract:
 *   - observedAction[] is fully populated from actionSequence (Phase 5a).
 *   - predictedDistribution[] is populated 1:1 with modeled decision-nodes
 *     (Phase 5a-2 — D2=C configurable predicate, default = first-action-
 *     per-street-per-actor).
 *   - Hero decision-nodes: soft policy from evaluateGameTree EVs (softmax).
 *   - Villain preflop decision-nodes: action distribution from rangeProfile
 *     per-action grid sums.
 *   - Villain postflop decision-nodes: empty [] (out of scope this ship).
 *   - Empty distribution policy: D3=A — record `distribution: []` and
 *     continue. Entries are NEVER skipped.
 *   - Backward compatibility: calling without deps preserves Phase 5a
 *     behavior (predictedDistribution: []).
 */

import { describe, it, expect, vi } from 'vitest';
import { reconstructPredictionAudit } from '../reconstruct';
import { composeModelVersion, sanitizePredictionAudit } from '../../persistence/predictionAuditWriter';

const baseHandData = (overrides = {}) => {
  const { gameState: gameStateOverride, ...rest } = overrides;
  return {
    gameState: {
      currentStreet: 'flop',
      dealerButtonSeat: 1,
      mySeat: 2,
      absentSeats: [],
      actionSequence: [],
      ...gameStateOverride,
    },
    cardState: {
      communityCards: ['', '', '', '', ''],
      holeCards: ['', ''],
      holeCardsVisible: false,
      allPlayerCards: {},
    },
    seatPlayers: { 3: 42, 4: 99 },
    ...rest,
  };
};

// Build a Float64Array of 169 cells with a uniform value (used for grid-sum tests).
const uniformGrid = (perCell) => {
  const grid = new Float64Array(169);
  for (let i = 0; i < 169; i++) grid[i] = perCell;
  return grid;
};

// Build a rangeProfile with controlled per-action grid totals at a position.
// `totals` is { open?, coldCall?, threeBet? } where each value is the desired
// SUM of that action's 169-cell grid.
const buildRangeProfile = (position, totals) => {
  const ranges = { [position]: {} };
  for (const action of Object.keys(totals)) {
    const total = totals[action];
    if (total == null) continue;
    ranges[position][action] = uniformGrid(total / 169);
  }
  return { ranges };
};

describe('reconstructPredictionAudit — observedAction extraction', () => {
  it('produces an observedAction entry for each actionSequence entry', async () => {
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 3, action: 'open', street: 'preflop', order: 1, amount: 30 },
          { seat: 4, action: 'fold', street: 'preflop', order: 2 },
          { seat: 2, action: 'call', street: 'preflop', order: 3, amount: 30 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData);
    expect(audit.observedAction).toHaveLength(3);
  });

  it('marks hero entries (seat === mySeat) with actor=hero and actorId=hero', async () => {
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 2, action: 'check', street: 'flop', order: 1 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData);
    expect(audit.observedAction[0].actor).toBe('hero');
    expect(audit.observedAction[0].actorId).toBe('hero');
    expect(audit.observedAction[0].seat).toBe(2);
  });

  it('marks villain entries (seat !== mySeat) with actor=villain and actorId from seatPlayers', async () => {
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 3, action: 'bet', street: 'flop', order: 1, amount: 50 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData);
    expect(audit.observedAction[0].actor).toBe('villain');
    expect(audit.observedAction[0].actorId).toBe(42);
    expect(audit.observedAction[0].seat).toBe(3);
  });

  it('actorId is null for a villain seat with no player mapping', async () => {
    const handData = baseHandData({
      seatPlayers: {},
      gameState: {
        actionSequence: [
          { seat: 5, action: 'fold', street: 'preflop', order: 1 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData);
    expect(audit.observedAction[0].actor).toBe('villain');
    expect(audit.observedAction[0].actorId).toBeNull();
  });

  it('sizing is set when entry.amount is a number', async () => {
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 3, action: 'raise', street: 'preflop', order: 1, amount: 75 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData);
    expect(audit.observedAction[0].sizing).toBe(75);
  });

  it('sizing is omitted when entry has no amount (e.g., fold/check)', async () => {
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 4, action: 'fold', street: 'preflop', order: 1 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData);
    expect(audit.observedAction[0]).not.toHaveProperty('sizing');
  });

  it('extracts actionTaken from entry.action', async () => {
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 3, action: 'three-bet', street: 'preflop', order: 1, amount: 200 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData);
    expect(audit.observedAction[0].actionTaken).toBe('three-bet');
  });

  it('handles showdown actions in actionSequence (street: showdown)', async () => {
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 2, action: 'won', street: 'showdown', order: 1 },
          { seat: 3, action: 'mucked', street: 'showdown', order: 2 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData);
    expect(audit.observedAction).toHaveLength(2);
    expect(audit.observedAction[0].actor).toBe('hero');
    expect(audit.observedAction[0].actionTaken).toBe('won');
    expect(audit.observedAction[1].actor).toBe('villain');
    expect(audit.observedAction[1].actionTaken).toBe('mucked');
  });
});

describe('reconstructPredictionAudit — predictedDistribution backward compatibility', () => {
  it('returns an empty predictedDistribution when called without deps (Phase 5a behavior)', async () => {
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 3, action: 'open', street: 'preflop', order: 1, amount: 30 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData);
    expect(audit.predictedDistribution).toEqual([]);
  });

  it('treats deps={} the same as no deps — empty predictedDistribution (Phase 5a-compat)', async () => {
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 3, action: 'open', street: 'preflop', order: 1, amount: 30 },
        ],
      },
    });
    // Phase 5a backward compat: with no opt-in deps, predictedDistribution
    // is empty. The predicate-driven population only activates when at
    // least one of isModeledNode / getRangeProfile / evaluateGameTree is
    // explicitly provided (Phase 5a-2 opt-in semantics).
    const audit = await reconstructPredictionAudit(handData, {});
    expect(audit.predictedDistribution).toEqual([]);
  });

  it('activates predictedDistribution loop when only isModeledNode is provided (no engine queries)', async () => {
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 3, action: 'open', street: 'preflop', order: 1, amount: 30 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData, { isModeledNode: () => true });
    expect(audit.predictedDistribution).toHaveLength(1);
    expect(audit.predictedDistribution[0].distribution).toEqual([]);
  });
});

describe('reconstructPredictionAudit — hero soft policy via evaluateGameTree', () => {
  it('builds a softmax distribution from ranked hero actions', async () => {
    const evaluateGameTree = vi.fn(async () => ({
      actions: [
        { action: 'check', ev: 0 },
        { action: 'bet', ev: 1 },
      ],
    }));
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 2, action: 'check', street: 'flop', order: 1 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData, { evaluateGameTree });
    expect(audit.predictedDistribution).toHaveLength(1);
    const heroEntry = audit.predictedDistribution[0];
    expect(heroEntry.actor).toBe('hero');
    expect(heroEntry.distribution).toHaveLength(2);
    const total = heroEntry.distribution.reduce((s, d) => s + d.weight, 0);
    expect(total).toBeCloseTo(1.0, 6);
    const bet = heroEntry.distribution.find(d => d.action === 'bet');
    const check = heroEntry.distribution.find(d => d.action === 'check');
    expect(bet.weight).toBeGreaterThan(check.weight);
  });

  it('returns distribution: [] when evaluateGameTree throws', async () => {
    const evaluateGameTree = vi.fn(async () => { throw new Error('boom'); });
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 2, action: 'bet', street: 'flop', order: 1, amount: 50 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData, { evaluateGameTree });
    expect(audit.predictedDistribution).toHaveLength(1);
    expect(audit.predictedDistribution[0].distribution).toEqual([]);
  });

  it('returns distribution: [] when evaluateGameTree returns no actions', async () => {
    const evaluateGameTree = vi.fn(async () => ({ actions: [] }));
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 2, action: 'check', street: 'flop', order: 1 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData, { evaluateGameTree });
    expect(audit.predictedDistribution[0].distribution).toEqual([]);
  });

  it('preserves sizing on softmax entries when present in evaluateGameTree output', async () => {
    const evaluateGameTree = vi.fn(async () => ({
      actions: [
        { action: 'bet', ev: 1, sizing: 0.5 },
        { action: 'check', ev: 0 },
      ],
    }));
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 2, action: 'check', street: 'flop', order: 1 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData, { evaluateGameTree });
    const bet = audit.predictedDistribution[0].distribution.find(d => d.action === 'bet');
    expect(bet.sizing).toBe(0.5);
    const check = audit.predictedDistribution[0].distribution.find(d => d.action === 'check');
    expect(check).not.toHaveProperty('sizing');
  });
});

describe('reconstructPredictionAudit — villain preflop grid distribution', () => {
  it('derives action distribution from rangeProfile per-action grid sums', async () => {
    // dealerButtonSeat=1, seat=3 → offset 2 → 'BB' per POSITION_NAMES.
    // Use a rangeProfile keyed by 'BB' so getVillainRange resolves.
    const rangeProfile = buildRangeProfile('BB', { open: 30, coldCall: 20, threeBet: 10 });
    const getRangeProfile = vi.fn((playerId) => playerId === 42 ? rangeProfile : null);
    const handData = baseHandData({
      gameState: {
        dealerButtonSeat: 1,
        actionSequence: [
          { seat: 3, action: 'open', street: 'preflop', order: 1, amount: 30 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData, { getRangeProfile });
    expect(audit.predictedDistribution).toHaveLength(1);
    const dist = audit.predictedDistribution[0].distribution;
    const total = dist.reduce((s, d) => s + d.weight, 0);
    expect(total).toBeCloseTo(1.0, 6);
    const open = dist.find(d => d.action === 'open');
    const coldCall = dist.find(d => d.action === 'coldCall');
    const threeBet = dist.find(d => d.action === 'threeBet');
    expect(open.weight).toBeCloseTo(30 / 60, 6);
    expect(coldCall.weight).toBeCloseTo(20 / 60, 6);
    expect(threeBet.weight).toBeCloseTo(10 / 60, 6);
  });

  it('records distribution: [] when villain has no rangeProfile (entry NOT skipped)', async () => {
    const getRangeProfile = vi.fn(() => null);
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 3, action: 'open', street: 'preflop', order: 1, amount: 30 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData, { getRangeProfile });
    expect(audit.predictedDistribution).toHaveLength(1);
    expect(audit.predictedDistribution[0]).toMatchObject({
      actor: 'villain', actorId: 42, seat: 3, distribution: [],
    });
  });

  it('records distribution: [] for villain preflop when only evaluateGameTree is provided (no getRangeProfile)', async () => {
    // Loop activates because evaluateGameTree is present, but villain
    // preflop nodes still need getRangeProfile — without it, distribution
    // stays empty per D3=A.
    const evaluateGameTree = vi.fn(async () => ({ actions: [{ action: 'check', ev: 0 }] }));
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 3, action: 'open', street: 'preflop', order: 1, amount: 30 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData, { evaluateGameTree });
    expect(audit.predictedDistribution).toHaveLength(1);
    expect(audit.predictedDistribution[0].distribution).toEqual([]);
  });
});

describe('reconstructPredictionAudit — villain postflop is out of scope', () => {
  it('records distribution: [] for villain postflop decision-nodes regardless of rangeProfile', async () => {
    // Even with a rich rangeProfile, postflop villain returns empty (D3=A).
    const rangeProfile = buildRangeProfile('BB', { open: 100, coldCall: 50, threeBet: 25 });
    const getRangeProfile = vi.fn(() => rangeProfile);
    const handData = baseHandData({
      gameState: {
        dealerButtonSeat: 1,
        actionSequence: [
          { seat: 3, action: 'bet', street: 'flop', order: 1, amount: 50 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData, { getRangeProfile });
    expect(audit.predictedDistribution).toHaveLength(1);
    expect(audit.predictedDistribution[0].distribution).toEqual([]);
  });
});

describe('reconstructPredictionAudit — configurable isModeledNode predicate (D2=C)', () => {
  it('honors a permissive predicate (() => true): every entry produces a distribution entry', async () => {
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 3, action: 'open', street: 'preflop', order: 1, amount: 30 },
          { seat: 4, action: 'fold', street: 'preflop', order: 2 },
          { seat: 2, action: 'call', street: 'preflop', order: 3, amount: 30 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData, { isModeledNode: () => true });
    expect(audit.predictedDistribution).toHaveLength(3);
  });

  it('honors a restrictive predicate (() => false): no distribution entries', async () => {
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 3, action: 'open', street: 'preflop', order: 1, amount: 30 },
          { seat: 2, action: 'call', street: 'preflop', order: 2, amount: 30 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData, { isModeledNode: () => false });
    expect(audit.predictedDistribution).toEqual([]);
  });

  it('default predicate selects first betting action by a seat on each street', async () => {
    // Seat 3 raises preflop, seat 2 calls preflop, seat 3 cbets flop, seat 3
    // bets again on flop (NOT modeled — already acted on flop), seat 3 bets
    // turn (modeled — first turn action).
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 3, action: 'raise', street: 'preflop', order: 1, amount: 30 },
          { seat: 2, action: 'call', street: 'preflop', order: 2, amount: 30 },
          { seat: 3, action: 'bet', street: 'flop', order: 3, amount: 60 },
          { seat: 3, action: 'raise', street: 'flop', order: 4, amount: 180 },
          { seat: 3, action: 'bet', street: 'turn', order: 5, amount: 200 },
        ],
      },
    });
    // Pass a getRangeProfile (returning null) to activate the loop without
    // mocking actual range queries — we only care about WHICH entries the
    // default predicate identifies as modeled, not their distributions.
    const audit = await reconstructPredictionAudit(handData, {
      getRangeProfile: () => null,
    });
    // Modeled: preflop seat 3 raise (1), preflop seat 2 call (2), flop seat 3
    // bet (3), turn seat 3 bet (5). NOT modeled: flop seat 3 raise (4).
    expect(audit.predictedDistribution).toHaveLength(4);
    const seats = audit.predictedDistribution.map(e => e.seat);
    expect(seats).toEqual([3, 2, 3, 3]);
    const streets = audit.predictedDistribution.map((_, i) => {
      // we infer street from order: 1,2 preflop; 3 flop; 5 turn
      return ['preflop', 'preflop', 'flop', 'turn'][i];
    });
    expect(streets).toEqual(['preflop', 'preflop', 'flop', 'turn']);
  });

  it('passes a context object with street, seat, actor, prevActionsThisStreet to the predicate', async () => {
    const isModeledNode = vi.fn(() => false);
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 3, action: 'open', street: 'preflop', order: 1, amount: 30 },
        ],
      },
    });
    await reconstructPredictionAudit(handData, { isModeledNode });
    expect(isModeledNode).toHaveBeenCalledTimes(1);
    const [entry, ctx] = isModeledNode.mock.calls[0];
    expect(entry.action).toBe('open');
    expect(ctx).toMatchObject({
      street: 'preflop',
      seat: 3,
      actor: 'villain',
      actorId: 42,
      index: 0,
    });
    expect(Array.isArray(ctx.prevActionsThisStreet)).toBe(true);
    expect(ctx.prevActionsThisStreet).toHaveLength(0);
    expect(Array.isArray(ctx.fullActionSequence)).toBe(true);
  });
});

describe('reconstructPredictionAudit — AP-PMC-04 binding (predictedDistribution unaffected)', () => {
  it('predictedDistribution entries pass through sanitizePredictionAudit unchanged', async () => {
    const evaluateGameTree = vi.fn(async () => ({
      actions: [
        { action: 'check', ev: 0 },
        { action: 'bet', ev: 1 },
      ],
    }));
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 2, action: 'check', street: 'flop', order: 1 },
        ],
      },
    });
    const audit = await reconstructPredictionAudit(handData, { evaluateGameTree });
    const sanitized = sanitizePredictionAudit(audit);
    // predictedDistribution entries are MODEL OUTPUT; AP-PMC-04 only strips
    // evRealized from observedAction hero entries. predictedDistribution
    // must pass through reference-equal (same array reference).
    expect(sanitized.predictedDistribution).toBe(audit.predictedDistribution);
  });
});

describe('reconstructPredictionAudit — modelVersion', () => {
  it('uses composeModelVersion()', async () => {
    const handData = baseHandData();
    const audit = await reconstructPredictionAudit(handData);
    expect(audit.modelVersion).toBe(composeModelVersion());
  });
});

describe('reconstructPredictionAudit — defensive shape handling', () => {
  it('returns empty observedAction when actionSequence is missing', async () => {
    const handData = { gameState: { mySeat: 2 }, seatPlayers: {} };
    const audit = await reconstructPredictionAudit(handData);
    expect(audit.observedAction).toEqual([]);
  });

  it('returns empty observedAction when actionSequence is null', async () => {
    const handData = { gameState: { mySeat: 2, actionSequence: null }, seatPlayers: {} };
    const audit = await reconstructPredictionAudit(handData);
    expect(audit.observedAction).toEqual([]);
  });

  it('returns empty observedAction when actionSequence is not an array', async () => {
    const handData = { gameState: { mySeat: 2, actionSequence: 'oops' }, seatPlayers: {} };
    const audit = await reconstructPredictionAudit(handData);
    expect(audit.observedAction).toEqual([]);
  });

  it('handles missing handData gracefully (returns valid empty payload)', async () => {
    const audit = await reconstructPredictionAudit({});
    expect(audit.observedAction).toEqual([]);
    expect(audit.predictedDistribution).toEqual([]);
    expect(audit.modelVersion).toBe(composeModelVersion());
  });

  it('handles missing seatPlayers (actorId becomes null for villains)', async () => {
    const handData = {
      gameState: {
        mySeat: 2,
        actionSequence: [
          { seat: 3, action: 'bet', street: 'flop', order: 1, amount: 50 },
        ],
      },
    };
    const audit = await reconstructPredictionAudit(handData);
    expect(audit.observedAction[0].actor).toBe('villain');
    expect(audit.observedAction[0].actorId).toBeNull();
  });
});

describe('reconstructPredictionAudit — purity', () => {
  it('does not mutate the input handData', async () => {
    const handData = baseHandData({
      gameState: {
        actionSequence: [
          { seat: 3, action: 'open', street: 'preflop', order: 1, amount: 30 },
        ],
      },
    });
    const original = JSON.parse(JSON.stringify(handData));
    await reconstructPredictionAudit(handData);
    expect(handData).toEqual(original);
  });
});
