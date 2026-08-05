/**
 * atomize.test.js — WS-328.
 *
 * predictionAudit is the repo's canonical shipped-but-inert capability: capture wired, nothing
 * reading it. The remedy family needs BOTH halves, so both are tested here — a production
 * reader (atomization onto Decision Atoms), and an assertion that the wired path genuinely
 * DIVERGES from the unwired one, so inertness is a run failure rather than a later discovery.
 *
 * The divergence tests are the load-bearing ones. Every other test here would pass against an
 * implementation nobody calls.
 */

import { describe, it, expect } from 'vitest';

import { reconstructPredictionAudit } from '../reconstruct';
import {
  atomizePredictionAudit,
  predictionAuditCoverage,
  assertPredictionAuditLive,
  modeledNodes,
  ATOM_SKIP_REASONS,
} from '../atomize';

const uniformGrid = (perCell) => {
  const g = new Float64Array(169);
  for (let i = 0; i < 169; i += 1) g[i] = perCell;
  return g;
};

/**
 * rangeProfile whose per-action grids sum to the given totals, at EVERY position.
 *
 * Every position on purpose: the reconstructor resolves the position from
 * `getPositionName(seat, dealerButtonSeat)`, and pinning the fixture to one label would make
 * the test assert the seat-to-position mapping rather than the atomization it is about.
 */
const POSITIONS = ['UTG', 'UTG1', 'UTG2', 'MP', 'MP1', 'MP2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const rangeProfileFor = (totals) => {
  const ranges = {};
  for (const position of POSITIONS) {
    ranges[position] = {};
    for (const [action, total] of Object.entries(totals)) {
      ranges[position][action] = uniformGrid(total / 169);
    }
  }
  return { ranges };
};

const handData = () => ({
  handId: 'H1',
  seatPlayers: { 3: 'p3', 4: 'p4' },
  gameState: {
    mySeat: null,               // corpus-shaped: no hero, so every decision is a VILLAIN row
    dealerButtonSeat: 1,
    currentStreet: 'flop',
    communityCards: ['Ah', 'Kd', '7c'],
    showdownCards: { 3: ['As', 'Kh'] },
    actionSequence: [
      { order: 0, seat: 3, action: 'raise', street: 'preflop', amount: 6 },
      { order: 1, seat: 4, action: 'call', street: 'preflop', amount: 6 },
      { order: 2, seat: 3, action: 'bet', street: 'flop', amount: 8 },
      { order: 3, seat: 4, action: 'fold', street: 'flop' },
    ],
  },
});

const situationKeyFor = ({ ctx }) => `${ctx.street}:dry:MP:false:true:none:none`;

describe('atomizePredictionAudit — the reader predictionAudit never had', () => {
  it('projects a reconstructed audit onto Decision Atoms, villain rows included', async () => {
    const hd = handData();
    const audit = await reconstructPredictionAudit(hd, {
      getRangeProfile: () => rangeProfileFor({ open: 30, coldCall: 10 }),
    });

    const atoms = atomizePredictionAudit({
      handData: hd, audit, surfaceId: 'read:reconstructed', situationKeyFor, seeds: { deal: 1234 },
    });

    // 4 modeled nodes: first action per seat per street.
    expect(atoms).toHaveLength(modeledNodes(hd.gameState.actionSequence, { mySeat: null }).length);
    expect(atoms.every((a) => a.actorRole === 'villain')).toBe(true);
    expect(atoms.map((a) => a.actorSeat)).toEqual([3, 4, 3, 4]);

    // Preflop nodes carry a real distribution derived from the range grids. `threeBet` is
    // present because `getVillainRange` falls back to the open/coldCall mean when a per-action
    // grid is absent — a property of the accessor, pinned here rather than papered over, since
    // an atom that recorded a fallback as a first-class score would over-state what was modeled.
    const pre = atoms[0];
    expect(Object.keys(pre.action).sort()).toEqual(['coldCall', 'open', 'threeBet']);
    expect(pre.action.open).toBeCloseTo(30 / 60, 5);
    expect(pre.alternativeScores.margin).toBeCloseTo(30 / 60 - 20 / 60, 5);
    expect(pre.alternativeScores.best).toBe('open');
    expect(pre.alternativeScores.alternativeCount).toBe(3);
    expect(pre.seeds).toEqual({ deal: 1234 });

    // Postflop nodes had no villain model supplied — recorded as an atom-level skip REASON,
    // not as a missing row and not as a run-level counter.
    expect(atoms[2].skipReason).toBe(ATOM_SKIP_REASONS.MODEL_EMPTY_DISTRIBUTION);
    expect(atoms[2].action).toEqual({});

    // Ground truth rides with its basis or it does not ride at all.
    expect(pre.truth).toEqual({ revealed: ['As', 'Kh'], basis: 'observed', revealedAt: 'showdown' });
    expect(atoms[1].truth).toBeNull();
  });

  it('refuses a situationKeyFor-less call rather than inventing a positional key', () => {
    expect(() => atomizePredictionAudit({
      handData: handData(), audit: { predictedDistribution: [] }, surfaceId: 's',
    })).toThrow(/situationKeyFor is required/);
  });

  it('refuses a prediction/node count mismatch instead of silently misaligning', () => {
    expect(() => atomizePredictionAudit({
      handData: handData(),
      audit: { predictedDistribution: [{ actor: 'villain', seat: 3, distribution: [] }] },
      surfaceId: 's',
      situationKeyFor,
    })).toThrow(/1:1 alignment/);
  });

  it('reports coverage k/n WITH its conditioning set', async () => {
    const hd = handData();
    const audit = await reconstructPredictionAudit(hd, {
      getRangeProfile: () => rangeProfileFor({ open: 30, coldCall: 10 }),
    });
    const cov = predictionAuditCoverage(
      atomizePredictionAudit({ handData: hd, audit, surfaceId: 's', situationKeyFor }),
    );
    expect(cov.scoredGivenModeled.conditional).toMatch(/P\(the model produced a distribution/);
    expect(cov.withGroundTruth.conditional).toMatch(/showdown-selected/);
    expect(cov.byActorRole).toEqual({ villain: 4 });
  });
});

describe('assertPredictionAuditLive — inertness becomes a run failure', () => {
  const wire = async (deps) => {
    const hd = handData();
    const audit = await reconstructPredictionAudit(hd, deps);
    return atomizePredictionAudit({ handData: hd, audit, surfaceId: 's', situationKeyFor });
  };

  it('THROWS when the wired arm scores no more nodes than the unwired one', async () => {
    // The inert state, reproduced exactly: deps supplied, but none of them can produce a
    // distribution. This is what predictionAudit has looked like in production since WS-177,
    // and every unit test that called the reconstructor directly still passed.
    const wired = await wire({ getRangeProfile: () => null });
    const unwired = await wire({});
    expect(() => assertPredictionAuditLive({ wired, unwired }))
      .toThrow(/made no difference, so predictionAudit is inert on this path/);
  });

  it('passes, and reports the divergence, when the engine deps actually move the output', async () => {
    const wired = await wire({
      getRangeProfile: () => rangeProfileFor({ open: 30, coldCall: 10 }),
    });
    const unwired = await wire({});

    const out = assertPredictionAuditLive({ wired, unwired });
    expect(out.wiredScored).toBe(2);      // both preflop nodes scored
    expect(out.unwiredScored).toBe(0);    // Phase 5a behaviour: predictedDistribution is []
    expect(out.divergedNodes).toBe(2);
    expect(out.conditional).toMatch(/over the same hands/);
  });

  it('refuses an empty wired arm — a reader that reads nothing is inertness with a green tick', () => {
    expect(() => assertPredictionAuditLive({ wired: [], unwired: [] }))
      .toThrow(/produced no atoms at all/);
  });
});
