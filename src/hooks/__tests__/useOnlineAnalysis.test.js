// @vitest-environment jsdom
/**
 * useOnlineAnalysis.test.js — Online per-table analysis hook.
 *
 * Focus: the WS-263 online wiring — the hook must fetch the session record and
 * pass it to runAnalysisPipeline so the pool baseline (imported HandHQ reference
 * tier + observed table pool) can segment by online/<stake>. Before this wiring
 * the online path never passed sessions, so priors silently stayed on the static
 * founder estimate (the imported reference tier was inert online).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../utils/persistence/index', () => ({
  getHandsBySessionId: vi.fn(() => Promise.resolve([])),
  getSessionById: vi.fn(() => Promise.resolve(null)),
  GUEST_USER_ID: 'guest',
}));

vi.mock('../../utils/analysisPipeline', () => ({
  runAnalysisPipeline: vi.fn(() => ({
    pct: { vpip: 25, pfr: 18, af: 2.0, threeBet: 5, cbet: 65, sampleSize: 10 },
    rawStats: {},
    positionStats: {},
    limpData: {},
    style: 'TAG',
    exploits: [],
    briefings: [],
    rangeProfile: null,
    rangeSummary: null,
    subActionSummary: null,
    decisionSummary: null,
    villainModel: null,
    villainProfile: null,
    weaknesses: [],
    observations: [],
    thoughtAnalysis: null,
  })),
}));

import { useOnlineAnalysis } from '../useOnlineAnalysis';
import { getHandsBySessionId, getSessionById } from '../../utils/persistence/index';
import { runAnalysisPipeline } from '../../utils/analysisPipeline';

const SESSION = { sessionId: 7, source: 'ignition', gameType: '0.02/0.05' };
const HANDS = [
  { handId: 1, sessionId: 7, seatPlayers: { 3: 'seat_3', 5: 'hero' } },
  { handId: 2, sessionId: 7, seatPlayers: { 3: 'seat_3' } },
];

describe('useOnlineAnalysis — session wiring for pool baseline (WS-263)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the session record and passes it to the pipeline as the sessions array', async () => {
    getHandsBySessionId.mockResolvedValue(HANDS);
    getSessionById.mockResolvedValue(SESSION);

    const { result } = renderHook(() => useOnlineAnalysis(7, 'guest'));

    await waitFor(() => expect(result.current.handCount).toBe(2));

    expect(getSessionById).toHaveBeenCalledWith(7);
    expect(runAnalysisPipeline).toHaveBeenCalledWith(
      'seat_3', HANDS, 'guest', null, [SESSION],
    );
  });

  it('degrades to null sessions (static founder estimate) when the session record is missing', async () => {
    getHandsBySessionId.mockResolvedValue(HANDS);
    getSessionById.mockResolvedValue(null);

    const { result } = renderHook(() => useOnlineAnalysis(7, 'guest'));

    await waitFor(() => expect(result.current.handCount).toBe(2));

    expect(runAnalysisPipeline).toHaveBeenCalledWith(
      'seat_3', HANDS, 'guest', null, null,
    );
  });

  it('fetches the session record once per sessionId, not once per refresh', async () => {
    getHandsBySessionId.mockResolvedValue(HANDS.slice(0, 1));
    getSessionById.mockResolvedValue(SESSION);

    const { result } = renderHook(() => useOnlineAnalysis(7, 'guest'));
    await waitFor(() => expect(result.current.handCount).toBe(1));

    // New hand arrives → refresh recomputes, but the session record is cached.
    getHandsBySessionId.mockResolvedValue(HANDS);
    await result.current.refresh();
    await waitFor(() => expect(result.current.handCount).toBe(2));

    expect(getSessionById).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a null sessionId', async () => {
    const { result } = renderHook(() => useOnlineAnalysis(null, 'guest'));

    await waitFor(() => expect(result.current.handCount).toBe(0));
    expect(getSessionById).not.toHaveBeenCalled();
    expect(runAnalysisPipeline).not.toHaveBeenCalled();
  });
});
