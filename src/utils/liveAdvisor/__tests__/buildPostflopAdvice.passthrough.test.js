/**
 * buildPostflopAdvice.passthrough.test.js — WS-574.
 *
 * WHY THIS FILE EXISTS, precisely.
 *
 * The consumer-side tests in `useLiveActionAdvisor.twoPhase.test.js` mock `computeHelpers`
 * wholesale, so they prove the HOOK passes `onFastResult` down — and nothing more. When the
 * pass-through inside `buildPostflopAdvice` was deliberately deleted as a falsification
 * check, all five of those tests still passed. The capability would have been wired at one
 * layer, dead at the next, and green.
 *
 * That is the same shape as the defect this whole item is about: `evaluateGameTree` has
 * accepted `onFastResult` since WS-334 and no production caller passed it, because nothing
 * anywhere asserted that a caller did. A pass-through with no test is a pass-through that
 * will eventually be dropped by a refactor and never noticed.
 *
 * `buildPostflopAdvice` is the ONLY `evaluateGameTree` call site in the live path, and
 * before this file the only tested symbol in `computeHelpers.js` was `computeTrialCount`.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

const evaluateGameTree = vi.fn();
vi.mock('../../exploitEngine/gameTreeEvaluator', () => ({
  evaluateGameTree: (...args) => evaluateGameTree(...args),
}));

import { buildPostflopAdvice } from '../computeHelpers';

const baseArgs = () => ({
  liveHandState: {
    communityCards: ['7♣', '2♦', 'T♦'],
    heroSeat: 1,
    activeSeatNumbers: [1, 3],
    foldedSeats: [],
    actionSequence: [],
    seatStacks: {},
  },
  heroSeat: 1,
  targetSeat: 3,
  dealerSeat: 9,
  currentStreet: 'flop',
  villainRange: new Float64Array(169).fill(1 / 169),
  encodedHero: [51, 47],
  adjustedPot: 20,
  detectedSituation: { villainAction: 'bet', villainBet: 12 },
  playerStats: { vpip: 25, pfr: 20 },
  villainData: { style: null, sampleSize: 30 },
  villainModel: null,
  tendencyMap: { 3: { vpip: 25, pfr: 20, sampleSize: 30 } },
  dataQuality: {},
  sampleSize: 30,
  rakeConfig: null,
  equityFn: undefined,
});

describe('WS-574: buildPostflopAdvice forwards the two-phase callback', () => {
  beforeEach(() => {
    evaluateGameTree.mockReset();
    evaluateGameTree.mockResolvedValue({ heroEquity: 0.5, recommendations: [] });
  });

  test('onFastResult reaches evaluateGameTree', async () => {
    const onFastResult = vi.fn();
    await buildPostflopAdvice({ ...baseArgs(), onFastResult });

    expect(evaluateGameTree).toHaveBeenCalledTimes(1);
    expect(evaluateGameTree).toHaveBeenCalledWith(
      expect.objectContaining({ onFastResult })
    );
  });

  test('the key is present-and-null when no callback was given, never absent', async () => {
    // Explicit rather than incidental: a caller that omits the callback must still produce a
    // call the engine reads the same way every time. `evaluateGameTree` defaults it to null
    // itself, but pinning it here means a future refactor cannot quietly change WHICH default
    // applies without this failing.
    await buildPostflopAdvice(baseArgs());
    const passed = evaluateGameTree.mock.calls[0][0];
    expect('onFastResult' in passed).toBe(true);
    expect(passed.onFastResult).toBeNull();
  });
});
