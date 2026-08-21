/**
 * priceHeroDecisions.test.js — the money column, verified as NUMBERS.
 *
 * The doctrine that bit hardest on the session that built this pipeline: VERIFY NUMBERS, NOT
 * SHAPES. A money column read 0.0 for every hand and fifteen tests passed over it, because
 * every one of them asserted that a field existed and none asserted what it contained.
 *
 * So each arithmetic case below computes the expected bb figure by hand, from the pot
 * convention stated in `actionValues`, and asserts the value — never merely that a number
 * came back.
 */

import { describe, it, expect } from 'vitest';
import { priceDecisionAt, attributeGap, summarize, PRICE_SKIPS } from '../villainArchetype/priceHeroDecisions.mjs';
import { buildPolicyTable } from '../backtest/behaviorPolicy.mjs';

// ─────────────────────────────────────────────────────────────────────────────────────────
// Fixtures — mirrors of the poolBestResponse.test.js fixtures, deliberately, so the two
// suites are describing the same field rather than two different ones.
// ─────────────────────────────────────────────────────────────────────────────────────────

const mkHand = ({ seats = ['1', '2'], button = 1 } = {}) => ({
  handId: 'h1',
  seatPlayers: Object.fromEntries(seats.map((s) => [s, `p${s}`])),
  gameState: { actionSequence: [], dealerButtonSeat: button, communityCards: [] },
});

const mkCtx = (over = {}) => ({
  facingAction: 'bet',
  isAgg: 'agg',
  isIP: 'ip',
  texture: 'dry',
  street: 'flop',
  posCategory: 'LATE',
  order: 5,
  playerSeat: '1',
  opponentSeat: '2',
  ...over,
});

const mkGeo = ({ potBB = 10, facingBetBB = 4 } = {}) => ({
  bb: 2, potChips: potBB * 2, betChips: facingBetBB * 2, potBB, facingBetBB,
  enginePotChips: (potBB - facingBetBB) * 2, stackChips: 200,
});

const mkPolicy = ({ poolPct = 50, foldToBet = 0.5, foldToRaise = 0.25 } = {}) => {
  const obs = [];
  const N = 2000;
  const push = (facing, rate, other) => {
    for (let i = 0; i < Math.round(N * rate); i++) obs.push({ facingAction: facing, action: 'fold' });
    for (let i = 0; i < Math.round(N * (1 - rate)); i++) obs.push({ facingAction: facing, action: other });
  };
  push('bet', foldToBet, 'call');
  push('raise', foldToRaise, 'call');
  for (let i = 0; i < N; i++) obs.push({ facingAction: 'none', action: 'check' });
  return buildPolicyTable(obs, { poolPct });
};

const price = (over = {}) => priceDecisionAt({
  ctx: mkCtx(over.ctx),
  hand: mkHand(),
  geo: mkGeo(over.geo),
  // `in`, not `??` — a deliberate null must reach the module. Written with `??` first, and
  // the non-finite-equity test then silently exercised 0.8 and passed for the wrong reason.
  heroEquity: 'heroEquity' in over ? over.heroEquity : 0.8,
  observedAction: over.observedAction ?? 'call',
  policy: over.policy ?? mkPolicy(),
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 1. The arithmetic, computed by hand
// ─────────────────────────────────────────────────────────────────────────────────────────

describe('priceDecisionAt — the numbers', () => {
  it('prices a call at eq*(P + 2B) - B', () => {
    // potBB 10 includes the live bet of 4, so P = 6, B = 4.
    // call = 0.8 * (6 + 8) - 4 = 11.2 - 4 = 7.2
    const r = price({ heroEquity: 0.8, observedAction: 'call' });
    expect(r.ok).toBe(true);
    expect(r.potExBetBB).toBe(6);
    expect(r.facingBetBB).toBe(4);
    expect(r.observedValueBB).toBeCloseTo(7.2, 10);
  });

  it('prices a fold at exactly zero — every other action is priced relative to it', () => {
    const r = price({ heroEquity: 0.8, observedAction: 'fold' });
    expect(r.ok).toBe(true);
    expect(r.observedValueBB).toBe(0);
  });

  it('charges a strong hand the FULL value of the call it folded', () => {
    // The whole point of the cards-known arm: this is a fold, priced, with hero's real hand.
    // best is at least the call (7.2) so folding leaves at least 7.2bb.
    const r = price({ heroEquity: 0.8, observedAction: 'fold' });
    expect(r.evLeftBB).toBeGreaterThanOrEqual(7.2 - 1e-9);
    expect(r.evLeftBB).toBeCloseTo(r.bestValueBB, 10);
  });

  it('leaves nothing on the table when hero took the ceiling action', () => {
    const r = price({ heroEquity: 0.8, observedAction: 'call' });
    const best = price({ heroEquity: 0.8, observedAction: r.bestAction });
    expect(best.agreed).toBe(true);
    expect(best.evLeftBB).toBe(0);
  });

  it('prices a check as eq*P — no further investment, no realization discount', () => {
    // facing none: P = potBB (no live bet), so check = 0.6 * 10 = 6.
    const r = price({
      ctx: { facingAction: 'none' },
      geo: { potBB: 10, facingBetBB: 0 },
      heroEquity: 0.6,
      observedAction: 'check',
    });
    expect(r.ok).toBe(true);
    expect(r.observedValueBB).toBeCloseTo(6, 10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 2. The construction property. This is the one that catches a broken axis.
// ─────────────────────────────────────────────────────────────────────────────────────────

describe('evLeftBB is non-negative by construction', () => {
  it('never goes negative across the equity range and both facing states', () => {
    // `bestValue` is a max over a set CONTAINING `observedValue`. A negative here means the
    // ceiling and hero were priced off two different axes — the exact failure the shared
    // `actionValues` / `makeFoldRateFor` imports exist to prevent. Nothing is clamped, so a
    // regression surfaces here rather than as a silent zero.
    const policy = mkPolicy();
    for (const facingAction of ['bet', 'none']) {
      const actions = facingAction === 'bet' ? ['fold', 'call', 'raise'] : ['check', 'bet'];
      for (let eq = 0; eq <= 1.0001; eq += 0.05) {
        for (const observedAction of actions) {
          const r = priceDecisionAt({
            ctx: mkCtx({ facingAction }),
            hand: mkHand(),
            geo: mkGeo(facingAction === 'bet' ? {} : { potBB: 10, facingBetBB: 0 }),
            heroEquity: Math.min(1, eq),
            observedAction,
            policy,
          });
          expect(r.ok).toBe(true);
          expect(r.evLeftBB).toBeGreaterThanOrEqual(-1e-9);
        }
      }
    }
  });

  it('a very weak hand facing a bet loses nothing by folding', () => {
    // 2% equity: calling is badly -EV, so fold IS the ceiling and the gap is zero. A fold is
    // not a mistake by default, and an instrument that charged for every fold would be
    // measuring hero's fold frequency rather than his money.
    const r = price({ heroEquity: 0.02, observedAction: 'fold' });
    expect(r.bestAction).toBe('fold');
    expect(r.evLeftBB).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 3. Refusals — each reason distinct
// ─────────────────────────────────────────────────────────────────────────────────────────

describe('priceDecisionAt — refusals', () => {
  it('refuses without geometry rather than assuming a pot', () => {
    const r = priceDecisionAt({ ctx: mkCtx(), hand: mkHand(), geo: null, heroEquity: 0.5, observedAction: 'call', policy: mkPolicy() });
    expect(r).toEqual({ ok: false, reason: PRICE_SKIPS.BAD_GEOMETRY });
  });

  it('refuses a non-finite equity rather than defaulting to a coin flip', () => {
    const r = price({ heroEquity: null });
    expect(r.reason).toBe(PRICE_SKIPS.NO_EQUITY);
  });

  it('refuses an action outside the node response set, and names both sides', () => {
    // e.g. a 'check' recorded at a node where hero was facing a bet. Pricing it as something
    // else would put a fabricated action in the money column.
    const r = price({ observedAction: 'check' });
    expect(r.reason).toBe(PRICE_SKIPS.ACTION_NOT_IN_RESPONSE_SET);
    expect(r.observedAction).toBe('check');
    expect(r.responses).toEqual(['fold', 'call', 'raise']);
  });

  it('refuses an unknown facing action', () => {
    const r = price({ ctx: { facingAction: 'shove' } });
    expect(r.reason).toBe(PRICE_SKIPS.UNKNOWN_FACING);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 4. Attribution
// ─────────────────────────────────────────────────────────────────────────────────────────

describe('attributeGap', () => {
  it('reports agreement as its own cause, not as a zero-size mistake', () => {
    const r = price({ heroEquity: 0.02, observedAction: 'fold' });
    expect(attributeGap(r)).toEqual({ cause: 'agreed', detail: null });
  });

  it('names the action class and both actions when they differ', () => {
    const r = price({ heroEquity: 0.8, observedAction: 'fold' });
    const a = attributeGap(r);
    expect(a.cause).toBe('action-class');
    expect(a.detail).toContain('fold');
    expect(a.detail).toContain(r.bestAction);
  });

  it('returns null for an unpriced decision instead of inventing a cause', () => {
    expect(attributeGap({ ok: false, reason: 'x' })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 5. Aggregation — the ratio-of-sums property
// ─────────────────────────────────────────────────────────────────────────────────────────

describe('summarize', () => {
  const fake = (observedValueBB, bestValueBB, over = {}) => ({
    ok: true,
    observedValueBB,
    bestValueBB,
    evLeftBB: bestValueBB - observedValueBB,
    agreed: bestValueBB === observedValueBB,
    observedAction: over.observedAction ?? 'call',
    street: over.street ?? 'flop',
  });

  it('sums EV left and counts only priced decisions', () => {
    const s = summarize([fake(1, 3), fake(5, 5), { ok: false, reason: 'x' }]);
    expect(s.decisionsPriced).toBe(2);
    expect(s.evLeftBB).toBeCloseTo(2, 10);
    expect(s.agreedCount).toBe(1);
  });

  it('computes exploitation efficiency as a ratio of SUMS, not a mean of ratios', () => {
    // Two decisions: a big pot where hero took 90 of 100, and a tiny one where he took 0 of 1.
    // Ratio of sums  = 90 / 101 = 0.891...
    // Mean of ratios = (0.9 + 0.0) / 2 = 0.45
    // The mean lets a 1bb pot carry the same weight as a 100bb one, which is how a session
    // full of small folds would swamp the figure.
    const s = summarize([fake(90, 100), fake(0, 1)]);
    expect(s.exploitationEfficiency).toBeCloseTo(90 / 101, 10);
    expect(s.exploitationEfficiency).not.toBeCloseTo(0.45, 2);
  });

  it('returns null efficiency rather than 0% or 100% when there was nothing to win', () => {
    const s = summarize([fake(0, 0), fake(0, 0)]);
    expect(s.exploitationEfficiency).toBeNull();
  });

  it('splits EV left by street and by the action hero actually took', () => {
    const s = summarize([
      fake(1, 3, { street: 'flop', observedAction: 'fold' }),
      fake(0, 1, { street: 'river', observedAction: 'call' }),
      fake(2, 2, { street: 'flop', observedAction: 'fold' }),
    ]);
    expect(s.byStreet.flop).toEqual({ decisions: 2, evLeftBB: 2 });
    expect(s.byStreet.river).toEqual({ decisions: 1, evLeftBB: 1 });
    expect(s.byAction.fold).toEqual({ decisions: 2, evLeftBB: 2 });
    expect(s.byAction.call).toEqual({ decisions: 1, evLeftBB: 1 });
  });
});
