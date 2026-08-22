/**
 * poolBestResponse.test.js — WS-331: the upper pier post.
 *
 * These cover the properties that decide whether the ceiling is a trusted anchor or an
 * inflated fantasy, and that are silent when broken:
 *
 *   - the pot arithmetic (wrong by a bet is invisible and shifts every figure downstream)
 *   - the held-out refusal (a same-partition PBR looks perfectly healthy and is inadmissible)
 *   - the argmax's tie-breaking (breaking toward aggression inflates the ceiling exactly on
 *     the marginal spots where the measurement is least sure)
 *   - the surface's registration and the disclaimer entries' falsifiers
 */

import { describe, it, expect } from 'vitest';
import {
  actionValues,
  poolBestResponseAt,
  poolBestResponseSweep,
  validatePbrHeldOut,
  responseContext,
  PBR_SIZINGS,
  PBR_SHRINK_SWEEP,
  PBR_DISCLAIMERS,
  PBR_SURFACE,
  PBR_SURFACE_ID,
  PBR_WARNING,
  PBR_SCOPE,
  policyVocabulary,
  assertPolicyTokens,
} from '../backtest/poolBestResponse.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { buildPolicyTable, POLICY_PARTITION_STAMP } from '../backtest/behaviorPolicy.mjs';
import { LeakageError } from '../backtest/leakageGuard.mjs';
import { STACK_LAYERS } from '../../src/utils/standardOfRecord/stack.js';

// ─────────────────────────────────────────────────────────────────────────────────────────
// Fixtures
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

/**
 * A policy table stamped exactly as the miner stamps one.
 *
 * The fold rates are PARAMETERS and the defaults are deliberately ordinary — a field that
 * folds a quarter of the time to a raise. An earlier version of this fixture had the field
 * folding to essentially every raise, and PBR correctly concluded that raising 5-high was
 * the best action: at a ~44% breakeven the raise was genuinely +EV. That was the fixture
 * describing an absurd field, not the argmax misbehaving, and it is worth recording because
 * a ceiling measured against an over-folding field is exactly the inflation this ticket
 * exists to guard against.
 */
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

// ─────────────────────────────────────────────────────────────────────────────────────────
// 1. The arithmetic
// ─────────────────────────────────────────────────────────────────────────────────────────

describe('actionValues — pot arithmetic', () => {
  it('prices a call as eq*(P + 2B) - B, the pot convention villainRequiredEquity uses', () => {
    const v = actionValues({
      facingAction: 'bet', equity: 0.5, potExBetBB: 10, facingBetBB: 4,
      numOpponents: 1, foldRateFor: () => 0.5,
    });
    // 0.5 * (10 + 8) - 4 = 5
    expect(v.call).toBeCloseTo(5, 9);
  });

  it('folding is exactly zero — every other action is priced relative to it', () => {
    const v = actionValues({
      facingAction: 'bet', equity: 0.9, potExBetBB: 10, facingBetBB: 4,
      numOpponents: 1, foldRateFor: () => 0.5,
    });
    expect(v.fold).toBe(0);
  });

  it('checking realizes equity in the standing pot and invests nothing', () => {
    const v = actionValues({
      facingAction: 'none', equity: 0.4, potExBetBB: 12, facingBetBB: 0,
      numOpponents: 1, foldRateFor: () => 0.3,
    });
    expect(v.check).toBeCloseTo(0.4 * 12, 9);
  });

  it('prices a bet with the FULL fold-equity formula, not foldPct * pot', () => {
    // A pure bluff (equity 0) at a half-pot bet with a 50% fold rate:
    //   0.5 * 12 - 6 * 0.5 = 3.  The simplified `foldPct * pot` would say 6.
    const v = actionValues({
      facingAction: 'none', equity: 0, potExBetBB: 12, facingBetBB: 0,
      numOpponents: 1, foldRateFor: (total) => (Math.abs(total - 6) < 1e-9 ? 0.5 : 0),
    });
    expect(v.bet).toBeCloseTo(3, 6);
    expect(v.bet).not.toBeCloseTo(6, 6);
  });

  it('the raise fold-branch collects the villain bet already in the middle', () => {
    // Fold rate 1 => hero always takes down the pot, which is P + B (14), not P (10).
    // Precision is 3 rather than 6 because fold-through is clamped just below 1 to keep
    // `expectedCallers` off a division by zero; the clamp is what the ~2e-5 gap is.
    const v = actionValues({
      facingAction: 'bet', equity: 0, potExBetBB: 10, facingBetBB: 4,
      numOpponents: 1, foldRateFor: () => 1,
    });
    expect(v.raise).toBeCloseTo(14, 3);
    // The distinction the delta exists for: without it this would price at P alone.
    expect(v.raise).toBeGreaterThan(10.5);
  });

  it('picks the best sizing available from the menu', () => {
    // Only the pot-sized bet gets folds; everything smaller is called and loses.
    const potBet = 12;
    const v = actionValues({
      facingAction: 'none', equity: 0, potExBetBB: 12, facingBetBB: 0,
      numOpponents: 1,
      foldRateFor: (total) => (Math.abs(total - potBet) < 1e-9 ? 0.9 : 0),
    });
    // 0.9 * 12 - 12 * 0.1 = 9.6
    expect(v.bet).toBeCloseTo(9.6, 6);
  });

  it('multiway compounds the measured per-opponent fold rate rather than scaling a count', () => {
    const solo = actionValues({
      facingAction: 'none', equity: 0, potExBetBB: 12, facingBetBB: 0,
      numOpponents: 1, foldRateFor: () => 0.6,
    });
    const three = actionValues({
      facingAction: 'none', equity: 0, potExBetBB: 12, facingBetBB: 0,
      numOpponents: 3, foldRateFor: () => 0.6,
    });
    // Fold-THROUGH is 0.6^3, so a bluff is strictly worse three-handed.
    expect(three.bet).toBeLessThan(solo.bet);
  });

  it('emits exactly the node response set — never an action the corpus cannot record', () => {
    const facing = actionValues({
      facingAction: 'bet', equity: 0.5, potExBetBB: 10, facingBetBB: 4,
      numOpponents: 1, foldRateFor: () => 0.4,
    });
    expect(Object.keys(facing).sort()).toEqual(['call', 'fold', 'raise']);

    const open = actionValues({
      facingAction: 'none', equity: 0.5, potExBetBB: 10, facingBetBB: 0,
      numOpponents: 1, foldRateFor: () => 0.4,
    });
    expect(Object.keys(open).sort()).toEqual(['bet', 'check']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 2. The policy
// ─────────────────────────────────────────────────────────────────────────────────────────

describe('poolBestResponseAt', () => {
  const base = () => ({
    ctx: mkCtx(),
    hand: mkHand(),
    geo: mkGeo(),
    policy: mkPolicy(),
  });

  it('emits a distribution summing to 1 over the response set', () => {
    const r = poolBestResponseAt({
      ...base(),
      perCombo: [
        { sampleWeight: 0.25, heroEquity: 0.05 },
        { sampleWeight: 0.25, heroEquity: 0.35 },
        { sampleWeight: 0.25, heroEquity: 0.65 },
        { sampleWeight: 0.25, heroEquity: 0.95 },
      ],
    });
    expect(r.ok).toBe(true);
    const sum = Object.values(r.actions).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1, 9);
    expect(Object.keys(r.actions).sort()).toEqual(['call', 'fold', 'raise']);
  });

  it('is a MIXTURE, not a point mass — different holdings prefer different actions', () => {
    const r = poolBestResponseAt({
      ...base(),
      perCombo: [
        { sampleWeight: 0.5, heroEquity: 0.02 },
        { sampleWeight: 0.5, heroEquity: 0.98 },
      ],
    });
    expect(r.ok).toBe(true);
    const nonZero = Object.values(r.actions).filter((p) => p > 0);
    // If this ever collapses to one action the estimator's ESS collapses with it — the
    // whole reason the argmax runs per combo rather than on the range average.
    expect(nonZero.length).toBeGreaterThan(1);
  });

  it('the nuts never fold and pure air never raises for value', () => {
    const nuts = poolBestResponseAt({
      ...base(),
      perCombo: [{ sampleWeight: 1, heroEquity: 1 }],
    });
    expect(nuts.actions.fold).toBe(0);
  });

  it('refuses a node it cannot price rather than guessing', () => {
    expect(poolBestResponseAt({ ...base(), perCombo: [] }).ok).toBe(false);
    expect(poolBestResponseAt({ ...base(), geo: null, perCombo: [{ sampleWeight: 1, heroEquity: 0.5 }] }).ok)
      .toBe(false);
    expect(poolBestResponseAt({
      ...base(), ctx: mkCtx({ facingAction: 'nonsense' }), perCombo: [{ sampleWeight: 1, heroEquity: 0.5 }],
    }).ok).toBe(false);
  });

  it('drops non-finite equities instead of treating them as zero', () => {
    const r = poolBestResponseAt({
      ...base(),
      perCombo: [
        { sampleWeight: 0.5, heroEquity: NaN },
        { sampleWeight: 0.5, heroEquity: 0.9 },
      ],
    });
    expect(r.ok).toBe(true);
    expect(Object.values(r.actions).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
  });
});

describe('poolBestResponseSweep', () => {
  it('returns one entry per declared shrink value, keyed by that value', () => {
    const out = poolBestResponseSweep({
      ctx: mkCtx(),
      hand: mkHand(),
      geo: mkGeo(),
      policy: mkPolicy(),
      perCombo: [
        { sampleWeight: 0.5, heroEquity: 0.2 },
        { sampleWeight: 0.5, heroEquity: 0.8 },
      ],
    });
    expect(Object.keys(out).map(Number).sort((a, b) => a - b)).toEqual([...PBR_SHRINK_SWEEP]);
    for (const w of PBR_SHRINK_SWEEP) {
      expect(Object.values(out[w]).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
    }
  });

  it('includes the shipped operating point so the curve contains it rather than bracketing it', () => {
    expect(PBR_SHRINK_SWEEP).toContain(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 3. The held-out refusal — enforced, not documented
// ─────────────────────────────────────────────────────────────────────────────────────────

describe('validatePbrHeldOut', () => {
  it('accepts a POOL-stamped table with a disjoint EVAL set', () => {
    expect(() => validatePbrHeldOut(mkPolicy({ poolPct: 50 }), 50)).not.toThrow();
  });

  it('refuses a table that is not POOL-stamped', () => {
    const t = mkPolicy({ poolPct: 50 });
    t.provenance.partition = 'all-players';
    expect(() => validatePbrHeldOut(t, 50)).toThrow(LeakageError);
  });

  it('refuses poolPct=100 even though the DENOMINATOR guard would pass it', () => {
    // This is the case the two guards genuinely differ on: every player is a POOL player,
    // the stamp is honest, pi_pool is a legitimate denominator — and a best response fitted
    // on everyone would be evaluated on its own training set.
    const t = mkPolicy({ poolPct: 100 });
    expect(t.provenance.partition).toBe(POLICY_PARTITION_STAMP);
    expect(() => validatePbrHeldOut(t, 100)).toThrow(LeakageError);
  });

  it('refuses a poolPct that disagrees with the one the policy was mined at', () => {
    expect(() => validatePbrHeldOut(mkPolicy({ poolPct: 50 }), 60)).toThrow(LeakageError);
  });

  it('refuses an absent table rather than falling back to an assumed field', () => {
    expect(() => validatePbrHeldOut(null, 50)).toThrow(LeakageError);
    expect(() => validatePbrHeldOut({}, 50)).toThrow(LeakageError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 4. The response-node flip
// ─────────────────────────────────────────────────────────────────────────────────────────

describe('responseContext', () => {
  it('flips to the villain\'s side of the node', () => {
    const rc = responseContext(mkCtx({ isIP: 'ip', isAgg: 'agg' }), mkHand(), {
      heroBetTotalBB: 6, potBeforeVillainBB: 18, facing: 'bet',
    });
    expect(rc.facingAction).toBe('bet');
    expect(rc.isIP).toBe('oop');
    // WS-634: this asserted 'nonagg' for months. The policy vocabulary is 'agg' | 'def', so
    // 'nonagg' matched no key at any depth, every aggressor-node query resolved at the ROOT,
    // and the bet-size argmax went degenerate. The test did not catch the bug — it PINNED it.
    // A literal that only ever agrees with the code it tests proves the code is self-consistent
    // and nothing else; the round-trip below is what actually binds it to the data.
    expect(rc.isAgg).toBe('def');
    // Street and texture are properties of the board, not of whose turn it is.
    expect(rc.street).toBe('flop');
    expect(rc.texture).toBe('dry');
  });

  // ───────────────────────────────────────────────────────────────────────────────────────
  // THE ROUND TRIP — the assertion that would have caught WS-634 on the day it landed
  // ───────────────────────────────────────────────────────────────────────────────────────
  //
  // Binds the emitted token to the SHIPPED TABLE's own vocabulary rather than to a literal in
  // this file. A literal cannot fail when the code and the test are edited together, which is
  // exactly how 'nonagg' survived.
  it('emits only tokens the real policy table contains', () => {
    const path = 'out/behavior-policy.json';
    if (!existsSync(path)) return; // no table on this machine — nothing to bind against
    const policy = JSON.parse(readFileSync(path, 'utf8'));
    const vocab = policyVocabulary(policy);

    for (const isAgg of ['agg', 'def']) {
      for (const isIP of ['ip', 'oop']) {
        for (const facing of ['bet', 'raise']) {
          const rc = responseContext(mkCtx({ isIP, isAgg }), mkHand(), {
            heroBetTotalBB: 6, potBeforeVillainBB: 18, facing,
          });
          // The guard itself must not throw on any legitimate node…
          expect(() => assertPolicyTokens(policy, rc)).not.toThrow();
          // …and every keyed dimension must be a token the table knows.
          for (const [dim, allowed] of vocab) {
            if (rc[dim] === undefined || allowed.size === 0) continue;
            expect(allowed.has(String(rc[dim]))).toBe(true);
          }
        }
      }
    }
  });

  it('REFUSES a token the policy table does not contain', () => {
    const path = 'out/behavior-policy.json';
    if (!existsSync(path)) return;
    const policy = JSON.parse(readFileSync(path, 'utf8'));
    // The exact bug: a plausible-looking token that exists in no table. It must throw rather
    // than silently resolve at the root with a healthy-looking evidenceN.
    expect(() => assertPolicyTokens(policy, { isAgg: 'nonagg' })).toThrow(/WS-634|does not contain/);
  });

  it('keys the size bucket on hero\'s bet against the pot villain faces', () => {
    // 6 into a pot of 18 (which already contains the 6) is a third-pot bet.
    const rc = responseContext(mkCtx(), mkHand(), {
      heroBetTotalBB: 6, potBeforeVillainBB: 18, facing: 'bet',
    });
    expect(rc.sizeBucket).toBe('33-66');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// 5. Registration, warning, disclaimers
// ─────────────────────────────────────────────────────────────────────────────────────────

describe('PBR surface registration and standing warning', () => {
  it('registers as a DECLARED surface — it is authored, not observed', () => {
    expect(PBR_SURFACE.surfaceId).toBe(PBR_SURFACE_ID);
    expect(PBR_SURFACE.surfaceKind).toBe('Declared');
    expect(PBR_SURFACE.origin).toBe('authored');
  });

  it('declares all five layers in canonical order', () => {
    expect(PBR_SURFACE.stack.map((l) => l.layer)).toEqual([...STACK_LAYERS]);
  });

  it('names the field-measured fold probability as the layer it diverges from the engine at', () => {
    const fold = PBR_SURFACE.stack.find((l) => l.layer === 'foldProbability');
    expect(fold.inputs).toContain('behaviorPolicy.queryPolicy');
  });

  it('carries a standing warning that it is maximally exploitable and never to be played', () => {
    expect(PBR_WARNING).toMatch(/NEVER/i);
    expect(PBR_WARNING).toMatch(/exploitab/i);
    expect(PBR_SCOPE).toMatch(/abstraction/i);
  });

  it('every disclaimer carries its own falsifier — a disclaimer without one is a comment', () => {
    expect(PBR_DISCLAIMERS.length).toBeGreaterThan(0);
    const overfit = PBR_DISCLAIMERS.find((e) => e.id === 'PBR-overfits-the-model');
    expect(overfit).toBeTruthy();
    for (const e of PBR_DISCLAIMERS) {
      expect(e.falsifier).toBeTruthy();
      expect(e.falsifier.length).toBeGreaterThan(40);
      expect(e.claimAtRisk).toBeTruthy();
      expect(e.ticket).toBe('WS-331');
    }
  });

  it('sizings straddle the mined size buckets rather than exceeding their resolution', () => {
    expect(PBR_SIZINGS.length).toBeGreaterThanOrEqual(3);
    for (const s of PBR_SIZINGS) expect(s).toBeGreaterThan(0);
  });
});
