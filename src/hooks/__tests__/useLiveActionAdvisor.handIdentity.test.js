/**
 * useLiveActionAdvisor.handIdentity.test.js — WS-470 (FIND-131) wiring guard.
 *
 * The advice payload must CARRY the hand it was computed for. This is the
 * shipped-but-inert guard: the LiveAdviceBar gate and the extension's RT-45
 * stamp both prefer `advice.handNumber`, and both silently degrade to the old
 * behavior if the producer stops setting it — so the producer is pinned here.
 */

import { describe, test, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../utils/errorHandler', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logger: {
      ...actual.logger,
      // eslint-disable-next-line no-console
      debug: (...a) => console.log('[advisor-debug]', ...a),
      // eslint-disable-next-line no-console
      warn: (...a) => console.log('[advisor-warn]', ...a),
    },
  };
});

vi.mock('../../utils/liveAdvisor/computeHelpers', () => ({
  computeTrialCount: () => 100,
  computeAllVillainRanges: () => [],
  computeVillainEquities: async () => ({ perVillain: [], multiway: null }),
  narrowWithLog: (range) => ({ narrowed: range, logEntry: {} }),
  buildPreflopAdvice: async () => ({
    heroEquity: 0.55,
    recommendations: [{ action: 'raise', ev: 1.2, reasoning: 'test', sizing: {} }],
    foldPct: null,
    modelVersion: null,
  }),
  buildPostflopAdvice: async () => null,
}));

vi.mock('../../utils/exploitEngine/preflopAdvisor', () => ({
  detectSituation: () => ({
    situation: 'facing_open',
    villainSeat: 3,
    villainAction: 'raise',
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

// Stable identity across renders — an inline literal would recreate the map on the
// setIsComputing re-render, recreating `compute`, whose effect cleanup aborts the
// in-flight evaluation while the computeKey debounce swallows the replacement.
const TENDENCY_MAP = { 3: { vpip: 25, pfr: 20, sampleSize: 30 } };

const liveHandState = (handNumber) => ({
  state: 'HERO_TURN',
  currentStreet: 'preflop',
  communityCards: [],
  holeCards: ['A♠', 'K♠'],
  heroSeat: 1,
  pot: 10,
  actionSequence: [{ seat: 3, action: 'raise', street: 'preflop', amount: 6 }],
  pfAggressor: 3,
  dealerSeat: 9,
  handNumber,
  activeSeatNumbers: [1, 3],
  foldedSeats: [],
});

describe('WS-470: advice payload carries the compute-time hand', () => {
  test('assembledAdvice.handNumber equals the hand the compute was called with', async () => {
    const { result } = renderHook(
      ({ hs }) => useLiveActionAdvisor(hs, TENDENCY_MAP),
      { initialProps: { hs: liveHandState(4242) } },
    );
    await waitFor(() => expect(result.current.advice).not.toBeNull());
    expect(result.current.advice.handNumber).toBe(4242);
  });

  test('a new hand produces advice stamped with the NEW hand, not a stale one', async () => {
    const { result, rerender } = renderHook(
      ({ hs }) => useLiveActionAdvisor(hs, TENDENCY_MAP),
      { initialProps: { hs: liveHandState(4242) } },
    );
    await waitFor(() => expect(result.current.advice?.handNumber).toBe(4242));

    rerender({ hs: liveHandState(4243) });
    await waitFor(() => expect(result.current.advice?.handNumber).toBe(4243));
  });
});
