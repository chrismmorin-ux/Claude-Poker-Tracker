/**
 * useLiveActionAdvisor.twoPhase.test.js — WS-574.
 *
 * `evaluateGameTree` has been two-phase since WS-334: it hands back the depth-1 answer via
 * `onFastResult` the moment it exists, then keeps refining. NO production caller ever passed
 * that callback — not the manual advisor, and not this hook, which is the one the founder
 * actually plays behind. So the entire refinement clock had to fit inside table latency, and
 * at the resulting `refinementBudgetMs: 2000` depth-2 never once finished: mean runout
 * coverage 0.380, with `depth3Barrel` (barrel planning) and `checkRaiseDepth2` budget-gated
 * on every board measured.
 *
 * The defect survived because nothing on the consumer side could see it. The existing live
 * suite mocks the whole `computeHelpers` layer, so a hook that silently dropped the fast
 * phase looked identical to one that used it. This file is that missing detector.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../utils/errorHandler', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, logger: { ...actual.logger, debug: () => {}, warn: () => {} } };
});

const FAST = {
  heroEquity: 0.51,
  recommendations: [{ action: 'bet', ev: 1.1, reasoning: 'fast', sizing: {} }],
  foldPct: { bet: 0.4, raise: 0.2 },
  modelVersion: null,
};
const REFINED = {
  heroEquity: 0.58,
  recommendations: [{ action: 'check', ev: 2.7, reasoning: 'refined', sizing: {} }],
  foldPct: { bet: 0.4, raise: 0.2 },
  modelVersion: null,
};

// Captures what the hook actually passed down, so "did it wire the callback" is checkable
// rather than inferred from behaviour.
const seenArgs = { last: null };

vi.mock('../../utils/liveAdvisor/computeHelpers', () => ({
  computeTrialCount: () => 100,
  computeAllVillainRanges: () => [],
  computeVillainEquities: async () => ({ perVillain: [], multiway: null }),
  narrowWithLog: (range) => ({ narrowed: range, logEntry: {} }),
  buildPreflopAdvice: async () => null,
  buildPostflopAdvice: async (args) => {
    seenArgs.last = args;
    // Mirrors the real evaluator: fire the fast phase, yield a REAL macrotask so the host
    // can paint, then return the refined answer. The yield is the whole mechanism — a
    // resolved promise is a microtask and would not let React render.
    args.onFastResult?.(FAST);
    await new Promise((r) => setTimeout(r, 0));
    return REFINED;
  },
}));

vi.mock('../../utils/exploitEngine/preflopAdvisor', () => ({
  detectSituation: () => ({
    situation: 'facing_bet',
    villainSeat: 3,
    villainAction: 'bet',
    villainBet: 6,
    heroAlreadyActed: false,
  }),
  SITUATION_LABELS: {},
  buildBaselineRange: () => new Float64Array(169).fill(1 / 169),
}));

vi.mock('../../utils/rangeEngine/rangeAccessors', () => ({
  getVillainActionKey: () => 'rfi',
  getVillainRange: () => null,
}));

import { useLiveActionAdvisor } from '../useLiveActionAdvisor';

// Stable identity across renders — see the note in useLiveActionAdvisor.handIdentity.test.js:
// an inline literal recreates `compute`, whose effect cleanup aborts the in-flight
// evaluation while the computeKey debounce swallows the replacement.
const TENDENCY_MAP = { 3: { vpip: 25, pfr: 20, sampleSize: 30 } };

// Also hoisted, for the same reason: a fresh object each render recreates `compute`, whose
// effect cleanup aborts the in-flight evaluation while the computeKey debounce swallows the
// replacement — so the refined phase never lands and the advice stays provisional forever.
const makeFlopState = (handNumber = 7001) => ({
  state: 'HERO_TURN',
  currentStreet: 'flop',
  communityCards: ['7♣', '2♦', 'T♦'],
  holeCards: ['A♠', 'K♠'],
  heroSeat: 1,
  pot: 20,
  actionSequence: [
    { seat: 3, action: 'raise', street: 'preflop', amount: 6 },
    { seat: 3, action: 'bet', street: 'flop', amount: 12 },
  ],
  pfAggressor: 3,
  dealerSeat: 9,
  handNumber,
  activeSeatNumbers: [1, 3],
  foldedSeats: [],
});

const FLOP_STATE = makeFlopState();
const FLOP_STATE_9099 = makeFlopState(9099);

describe('WS-574: the live table takes the fast answer', () => {
  beforeEach(() => { seenArgs.last = null; });

  test('the hook passes onFastResult down to the game tree at all', async () => {
    const { result } = renderHook(() => useLiveActionAdvisor(FLOP_STATE, TENDENCY_MAP));
    await waitFor(() => expect(result.current.advice).not.toBeNull());
    expect(typeof seenArgs.last?.onFastResult).toBe('function');
  });

  test('a provisional answer is delivered before the refined one, and is marked as such', async () => {
    const seen = [];
    const { result } = renderHook(() => {
      const hook = useLiveActionAdvisor(FLOP_STATE, TENDENCY_MAP);
      if (hook.advice) seen.push(hook.advice);
      return hook;
    });

    await waitFor(() => expect(result.current.advice?.isProvisional).toBe(false));

    // FAILS on the single-`setAdvice` shape: only the refined state ever renders.
    const provisional = seen.find((a) => a.isProvisional === true);
    expect(provisional).toBeDefined();
    expect(provisional.recommendations[0].action).toBe('bet');
    expect(result.current.advice.recommendations[0].action).toBe('check');
  });

  test('the provisional payload OMITS the later-stage fields rather than nulling them', async () => {
    // This is not stylistic. `validateActionAdvice` in the extension's wire schema checks
    // these with `!== undefined`, so an explicit `null` FAILS validation while an absent key
    // passes — and a hard-rejecting Ignition validator silently dropping HUD updates is a
    // failure this repo has already lived through once.
    //
    // They are absent because they genuinely do not exist yet: villainRanges / multiwayEquity
    // / narrowingLog are all computed AFTER the game tree returns.
    const seen = [];
    const { result } = renderHook(() => {
      const hook = useLiveActionAdvisor(FLOP_STATE, TENDENCY_MAP);
      if (hook.advice) seen.push(hook.advice);
      return hook;
    });
    await waitFor(() => expect(result.current.advice?.isProvisional).toBe(false));

    const provisional = seen.find((a) => a.isProvisional === true);
    expect(provisional).toBeDefined();
    for (const key of ['villainRanges', 'multiwayEquity', 'narrowingLog']) {
      expect(Object.prototype.hasOwnProperty.call(provisional, key)).toBe(false);
    }

    // The refined delivery carries them, so the omission is phase-scoped and not a leak.
    expect(Object.prototype.hasOwnProperty.call(result.current.advice, 'villainRanges')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(result.current.advice, 'narrowingLog')).toBe(true);
  });

  test('the refined answer names the action it moved OFF', async () => {
    // WS-496 measured depth-2 flipping the top action on 35.3% of flops. A silent swap is
    // the common case, not an edge case, which is why the flip is reported rather than
    // simply applied.
    const { result } = renderHook(() => useLiveActionAdvisor(FLOP_STATE, TENDENCY_MAP));
    await waitFor(() => expect(result.current.advice?.isProvisional).toBe(false));
    expect(result.current.advice.changedOnRefine).toBe('bet');
  });

  test('the provisional payload still carries its compute-time hand (WS-470 holds in phase one)', async () => {
    const seen = [];
    const { result } = renderHook(() => {
      const hook = useLiveActionAdvisor(FLOP_STATE_9099, TENDENCY_MAP);
      if (hook.advice) seen.push(hook.advice);
      return hook;
    });
    await waitFor(() => expect(result.current.advice?.isProvisional).toBe(false));
    const provisional = seen.find((a) => a.isProvisional === true);
    expect(provisional.handNumber).toBe(9099);
  });
});
