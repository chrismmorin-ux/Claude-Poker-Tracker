// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../utils/errorHandler', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    action: vi.fn(),
  },
  DEBUG: false,
  AppError: class AppError extends Error {},
  ERROR_CODES: { INVALID_INPUT: 'E201' },
}));

import { resetDBPool, initDB } from '../../utils/persistence/database';
import { saveHand, loadHandById } from '../../utils/persistence/handsStorage';
import { createPlayer, getPlayerById, updatePlayer } from '../../utils/persistence/playersStorage';
import { createSessionAtomic, setActiveSession } from '../../utils/persistence/sessionsStorage';
import { useRetroactiveLinking, HANDS_UPDATED_EVENT } from '../useRetroactiveLinking';
import { PLAYER_ACTIONS } from '../../constants/playerConstants';

beforeEach(async () => {
  resetDBPool();
  globalThis.indexedDB = new IDBFactory();
  globalThis.window = globalThis.window || {};
  globalThis.window.indexedDB = globalThis.indexedDB;
  await initDB();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const seedScenario = async () => {
  // Create a session and mark active so saveHand auto-links to it.
  const sessionId = await createSessionAtomic(
    { venue: 'Test Casino', gameType: '1/2', buyIn: 200, startTime: Date.now() },
    'guest',
  );
  await setActiveSession(sessionId, 'guest');
  const playerId = await createPlayer({ name: 'Mike' }, 'guest');
  // Three hands with no seatPlayers yet.
  const h1 = await saveHand(validHand(), 'guest');
  const h2 = await saveHand(validHand(), 'guest');
  const h3 = await saveHand(validHand(), 'guest');
  return { sessionId, playerId, handIds: [h1, h2, h3] };
};

const validHand = () => ({
  gameState: { currentStreet: 'preflop', dealerButtonSeat: 1, mySeat: 5 },
  cardState: { communityCards: ['', '', '', '', ''], holeCards: ['', ''] },
});

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('useRetroactiveLinking — linkPlayerToPriorHandsInSession', () => {
  it('links all in-session hands where seat was empty, updates handCount + dispatches', async () => {
    const { sessionId, playerId, handIds } = await seedScenario();

    const dispatchPlayer = vi.fn();
    const allPlayers = [{ playerId, name: 'Mike', handCount: 0 }];

    const { result } = renderHook(() =>
      useRetroactiveLinking(dispatchPlayer, allPlayers, 'guest'),
    );

    let linkResult;
    await act(async () => {
      linkResult = await result.current.linkPlayerToPriorHandsInSession(3, playerId, sessionId);
    });

    expect(linkResult.handIds.sort()).toEqual(handIds.sort());
    expect(linkResult.newHandCount).toBe(3);
    expect(linkResult.previousHandCount).toBe(0);

    // Every hand now has seatPlayers[3] = playerId
    for (const handId of handIds) {
      const hand = await loadHandById(handId);
      expect(hand.seatPlayers[3]).toBe(playerId);
    }

    // Player record's handCount synced
    const fresh = await getPlayerById(playerId);
    expect(fresh.handCount).toBe(3);

    // Reducer action dispatched
    expect(dispatchPlayer).toHaveBeenCalledWith({
      type: PLAYER_ACTIONS.RETROACTIVELY_LINK_PLAYER,
      payload: { playerId, newHandCount: 3 },
    });
  });

  it('no-ops when sessionId is null (no linkable window)', async () => {
    const dispatchPlayer = vi.fn();
    const { result } = renderHook(() =>
      useRetroactiveLinking(dispatchPlayer, [], 'guest'),
    );
    const r = await result.current.linkPlayerToPriorHandsInSession(3, 99, null);
    expect(r.handIds).toEqual([]);
    expect(dispatchPlayer).not.toHaveBeenCalled();
  });

  it('rejects non-numeric seat or playerId', async () => {
    const dispatchPlayer = vi.fn();
    const { result } = renderHook(() =>
      useRetroactiveLinking(dispatchPlayer, [], 'guest'),
    );
    await expect(
      result.current.linkPlayerToPriorHandsInSession('three', 7, 1),
    ).rejects.toThrow();
    await expect(
      result.current.linkPlayerToPriorHandsInSession(3, 'seven', 1),
    ).rejects.toThrow();
  });

  it('skips in-session hands already mapped to the same player (idempotent)', async () => {
    const { sessionId, playerId, handIds } = await seedScenario();
    const dispatchPlayer = vi.fn();
    const allPlayers = [{ playerId, handCount: 0 }];
    const { result } = renderHook(() =>
      useRetroactiveLinking(dispatchPlayer, allPlayers, 'guest'),
    );
    // First link
    await act(async () => {
      await result.current.linkPlayerToPriorHandsInSession(3, playerId, sessionId);
    });
    // Second link — everything already mapped, should be empty plan
    let r;
    await act(async () => {
      r = await result.current.linkPlayerToPriorHandsInSession(3, playerId, sessionId);
    });
    expect(r.handIds).toEqual([]);
    expect(r.skipped).toBe(3);
  });

  it('fires a hands-updated event with detail', async () => {
    const { sessionId, playerId } = await seedScenario();
    const listener = vi.fn();
    globalThis.window.addEventListener?.(HANDS_UPDATED_EVENT, listener);
    const { result } = renderHook(() =>
      useRetroactiveLinking(vi.fn(), [{ playerId, handCount: 0 }], 'guest'),
    );
    await act(async () => {
      await result.current.linkPlayerToPriorHandsInSession(3, playerId, sessionId);
    });
    expect(listener).toHaveBeenCalled();
    globalThis.window.removeEventListener?.(HANDS_UPDATED_EVENT, listener);
  });
});

describe('useRetroactiveLinking — undoRetroactiveLink', () => {
  it('reverts seatPlayers and handCount on previously-linked hands', async () => {
    const { sessionId, playerId, handIds } = await seedScenario();
    const dispatchPlayer = vi.fn();
    const { result } = renderHook(() =>
      useRetroactiveLinking(dispatchPlayer, [{ playerId, handCount: 0 }], 'guest'),
    );

    let linkResult;
    await act(async () => {
      linkResult = await result.current.linkPlayerToPriorHandsInSession(3, playerId, sessionId);
    });
    // Sanity
    expect((await loadHandById(handIds[0])).seatPlayers[3]).toBe(playerId);
    expect((await getPlayerById(playerId)).handCount).toBe(3);

    // Undo
    await act(async () => { await result.current.undoRetroactiveLink(linkResult); });

    for (const handId of handIds) {
      const hand = await loadHandById(handId);
      expect(hand.seatPlayers[3]).toBeUndefined();
    }
    expect((await getPlayerById(playerId)).handCount).toBe(0);

    // Undo action dispatched
    expect(dispatchPlayer).toHaveBeenLastCalledWith({
      type: PLAYER_ACTIONS.UNDO_RETROACTIVE_LINK,
      payload: { playerId, newHandCount: 0 },
    });
  });

  it('is a no-op for empty handIds (e.g. link never did anything)', async () => {
    const dispatchPlayer = vi.fn();
    const { result } = renderHook(() =>
      useRetroactiveLinking(dispatchPlayer, [], 'guest'),
    );
    await act(async () => {
      await result.current.undoRetroactiveLink({ handIds: [], undoToken: 'noop' });
    });
    expect(dispatchPlayer).not.toHaveBeenCalled();
  });

  it('undo respects seats that were since-reassigned to a different player', async () => {
    const { sessionId, playerId, handIds } = await seedScenario();
    const otherPlayerId = await createPlayer({ name: 'Other' }, 'guest');

    const { result } = renderHook(() =>
      useRetroactiveLinking(vi.fn(), [{ playerId, handCount: 0 }], 'guest'),
    );
    let linkResult;
    await act(async () => {
      linkResult = await result.current.linkPlayerToPriorHandsInSession(3, playerId, sessionId);
    });

    // Simulate: user reassigned seat 3 on hand[1] to someone else.
    const { batchUpdateSeatPlayers } = await import('../../utils/persistence/handsStorage');
    await batchUpdateSeatPlayers([{ handId: handIds[1], seat: 3, playerId: otherPlayerId }]);

    // Now undo — should leave the reassigned hand alone.
    await act(async () => { await result.current.undoRetroactiveLink(linkResult); });

    const h0 = await loadHandById(handIds[0]);
    const h1 = await loadHandById(handIds[1]);
    const h2 = await loadHandById(handIds[2]);
    expect(h0.seatPlayers[3]).toBeUndefined();
    expect(h1.seatPlayers[3]).toBe(otherPlayerId);  // preserved
    expect(h2.seatPlayers[3]).toBeUndefined();
  });
});
