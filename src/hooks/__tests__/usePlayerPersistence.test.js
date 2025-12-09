/**
 * usePlayerPersistence.test.js - Tests for player persistence hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlayerPersistence } from '../usePlayerPersistence';
import { PLAYER_ACTIONS } from '../../constants/playerConstants';
import { createMockPlayer, createMockPlayerState } from '../../test/utils';

// Mock the persistence module
vi.mock('../../utils/persistence', () => ({
  createPlayer: vi.fn(() => Promise.resolve(1)),
  getAllPlayers: vi.fn(() => Promise.resolve([])),
  getPlayerById: vi.fn(() => Promise.resolve(null)),
  updatePlayer: vi.fn(() => Promise.resolve()),
  deletePlayer: vi.fn(() => Promise.resolve()),
  getPlayerByName: vi.fn(() => Promise.resolve(null)),
}));

// Mock the errorHandler module
vi.mock('../../utils/errorHandler', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  AppError: class AppError extends Error {},
  ERROR_CODES: {},
}));

import {
  createPlayer,
  getAllPlayers,
  getPlayerById,
  updatePlayer,
  deletePlayer,
  getPlayerByName,
} from '../../utils/persistence';

describe('usePlayerPersistence', () => {
  let dispatchPlayer;
  let playerState;

  beforeEach(() => {
    vi.clearAllMocks();
    dispatchPlayer = vi.fn();
    playerState = createMockPlayerState();
    vi.mocked(getAllPlayers).mockResolvedValue([]);
    vi.mocked(getPlayerByName).mockResolvedValue(null);
  });

  const createHook = (overrides = {}) => {
    const params = {
      playerState,
      dispatchPlayer,
      ...overrides,
    };
    return renderHook(() =>
      usePlayerPersistence(params.playerState, params.dispatchPlayer)
    );
  };

  describe('initialization', () => {
    it('sets isReady to true after initialization', async () => {
      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isReady).toBe(true);
    });

    it('loads all players on mount', async () => {
      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(getAllPlayers).toHaveBeenCalled();
    });

    it('dispatches LOAD_PLAYERS action with loaded players', async () => {
      const mockPlayers = [
        createMockPlayer({ playerId: 1, name: 'Alice' }),
        createMockPlayer({ playerId: 2, name: 'Bob' }),
      ];
      vi.mocked(getAllPlayers).mockResolvedValue(mockPlayers);

      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(dispatchPlayer).toHaveBeenCalledWith({
        type: PLAYER_ACTIONS.LOAD_PLAYERS,
        payload: { players: mockPlayers },
      });
    });

    it('sets isReady to true even when initialization fails', async () => {
      vi.mocked(getAllPlayers).mockRejectedValue(new Error('DB error'));

      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isReady).toBe(true);
    });
  });

  describe('createNewPlayer', () => {
    it('creates player in database', async () => {
      vi.mocked(createPlayer).mockResolvedValue(10);

      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.createNewPlayer({ name: 'Charlie' });
      });

      expect(createPlayer).toHaveBeenCalledWith({ name: 'Charlie' });
    });

    it('validates name uniqueness', async () => {
      vi.mocked(getPlayerByName).mockResolvedValue(createMockPlayer({ playerId: 1, name: 'Duplicate' }));

      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await expect(
        act(async () => {
          await result.current.createNewPlayer({ name: 'Duplicate' });
        })
      ).rejects.toThrow('already exists');
    });

    it('returns the new player ID', async () => {
      vi.mocked(createPlayer).mockResolvedValue(99);

      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let playerId;
      await act(async () => {
        playerId = await result.current.createNewPlayer({ name: 'David' });
      });

      expect(playerId).toBe(99);
    });

    it('reloads all players after creation', async () => {
      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      vi.mocked(getAllPlayers).mockClear();

      await act(async () => {
        await result.current.createNewPlayer({ name: 'Eve' });
      });

      expect(getAllPlayers).toHaveBeenCalled();
    });
  });

  describe('updatePlayerById', () => {
    it('updates player in database', async () => {
      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.updatePlayerById(5, { nickname: 'Ace' });
      });

      expect(updatePlayer).toHaveBeenCalledWith(5, { nickname: 'Ace' });
    });

    it('validates name uniqueness when updating name', async () => {
      vi.mocked(getPlayerByName).mockResolvedValue(createMockPlayer({ playerId: 2, name: 'Existing' }));

      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await expect(
        act(async () => {
          await result.current.updatePlayerById(5, { name: 'Existing' });
        })
      ).rejects.toThrow('already exists');
    });

    it('allows updating name if same player', async () => {
      vi.mocked(getPlayerByName).mockResolvedValue(createMockPlayer({ playerId: 5, name: 'Same' }));

      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should not throw because it's the same player
      await act(async () => {
        await result.current.updatePlayerById(5, { name: 'Same' });
      });

      expect(updatePlayer).toHaveBeenCalled();
    });

    it('reloads all players after update', async () => {
      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      vi.mocked(getAllPlayers).mockClear();

      await act(async () => {
        await result.current.updatePlayerById(5, { notes: 'Tight player' });
      });

      expect(getAllPlayers).toHaveBeenCalled();
    });
  });

  describe('deletePlayerById', () => {
    it('deletes player from database', async () => {
      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.deletePlayerById(7);
      });

      expect(deletePlayer).toHaveBeenCalledWith(7);
    });

    it('reloads all players after deletion', async () => {
      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      vi.mocked(getAllPlayers).mockClear();

      await act(async () => {
        await result.current.deletePlayerById(7);
      });

      expect(getAllPlayers).toHaveBeenCalled();
    });

    it('throws error when deletion fails', async () => {
      vi.mocked(deletePlayer).mockRejectedValue(new Error('Delete failed'));

      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await expect(
        act(async () => {
          await result.current.deletePlayerById(7);
        })
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('loadAllPlayers', () => {
    it('loads players from database', async () => {
      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      vi.mocked(getAllPlayers).mockClear();

      await act(async () => {
        await result.current.loadAllPlayers();
      });

      expect(getAllPlayers).toHaveBeenCalled();
    });

    it('returns the players array', async () => {
      const mockPlayers = [
        createMockPlayer({ playerId: 1 }),
        createMockPlayer({ playerId: 2 }),
      ];
      vi.mocked(getAllPlayers).mockResolvedValue(mockPlayers);

      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      let players;
      await act(async () => {
        players = await result.current.loadAllPlayers();
      });

      expect(players).toHaveLength(2);
    });

    it('returns empty array on error', async () => {
      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      vi.mocked(getAllPlayers).mockRejectedValue(new Error('Load failed'));

      let players;
      await act(async () => {
        players = await result.current.loadAllPlayers();
      });

      expect(players).toEqual([]);
    });
  });

  describe('assignPlayerToSeat', () => {
    it('dispatches SET_SEAT_PLAYER action', async () => {
      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.assignPlayerToSeat(3, 101);
      });

      expect(dispatchPlayer).toHaveBeenCalledWith({
        type: PLAYER_ACTIONS.SET_SEAT_PLAYER,
        payload: { seat: 3, playerId: 101 },
      });
    });
  });

  describe('clearSeatAssignment', () => {
    it('dispatches CLEAR_SEAT_PLAYER action', async () => {
      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.clearSeatAssignment(5);
      });

      expect(dispatchPlayer).toHaveBeenCalledWith({
        type: PLAYER_ACTIONS.CLEAR_SEAT_PLAYER,
        payload: { seat: 5 },
      });
    });
  });

  describe('getSeatPlayerName', () => {
    it('returns player name when assigned', () => {
      playerState = createMockPlayerState({
        allPlayers: [createMockPlayer({ playerId: 101, name: 'Frank' })],
        seatPlayers: { 3: 101 },
      });

      const { result } = createHook();

      expect(result.current.getSeatPlayerName(3)).toBe('Frank');
    });

    it('returns null when seat is empty', () => {
      playerState = createMockPlayerState({
        allPlayers: [createMockPlayer({ playerId: 101, name: 'Frank' })],
        seatPlayers: {},
      });

      const { result } = createHook();

      expect(result.current.getSeatPlayerName(3)).toBeNull();
    });

    it('returns null when player not found', () => {
      playerState = createMockPlayerState({
        allPlayers: [],
        seatPlayers: { 3: 999 },
      });

      const { result } = createHook();

      expect(result.current.getSeatPlayerName(3)).toBeNull();
    });
  });

  describe('getRecentPlayers', () => {
    it('returns players sorted by lastSeenAt', () => {
      const now = Date.now();
      playerState = createMockPlayerState({
        allPlayers: [
          createMockPlayer({ playerId: 1, name: 'Old', lastSeenAt: now - 1000 }),
          createMockPlayer({ playerId: 2, name: 'New', lastSeenAt: now }),
          createMockPlayer({ playerId: 3, name: 'Middle', lastSeenAt: now - 500 }),
        ],
      });

      const { result } = createHook();

      const recent = result.current.getRecentPlayers();
      expect(recent[0].name).toBe('New');
      expect(recent[1].name).toBe('Middle');
      expect(recent[2].name).toBe('Old');
    });

    it('respects limit parameter', () => {
      playerState = createMockPlayerState({
        allPlayers: [
          createMockPlayer({ playerId: 1 }),
          createMockPlayer({ playerId: 2 }),
          createMockPlayer({ playerId: 3 }),
        ],
      });

      const { result } = createHook();

      const recent = result.current.getRecentPlayers(2);
      expect(recent).toHaveLength(2);
    });

    it('excludes assigned players when excludeAssigned is true', () => {
      playerState = createMockPlayerState({
        allPlayers: [
          createMockPlayer({ playerId: 1, name: 'Assigned' }),
          createMockPlayer({ playerId: 2, name: 'Unassigned' }),
        ],
        seatPlayers: { 3: 1 },
      });

      const { result } = createHook();

      const recent = result.current.getRecentPlayers(null, true);
      expect(recent).toHaveLength(1);
      expect(recent[0].name).toBe('Unassigned');
    });
  });

  describe('getAssignedPlayerIds', () => {
    it('returns set of assigned player IDs', () => {
      playerState = createMockPlayerState({
        seatPlayers: { 1: 101, 3: 102, 5: null },
      });

      const { result } = createHook();

      const assigned = result.current.getAssignedPlayerIds();
      expect(assigned.has(101)).toBe(true);
      expect(assigned.has(102)).toBe(true);
      expect(assigned.has(null)).toBe(false);
    });
  });

  describe('isPlayerAssigned', () => {
    it('returns true when player is assigned', () => {
      playerState = createMockPlayerState({
        seatPlayers: { 3: 101 },
      });

      const { result } = createHook();

      expect(result.current.isPlayerAssigned(101)).toBe(true);
    });

    it('returns false when player is not assigned', () => {
      playerState = createMockPlayerState({
        seatPlayers: { 3: 101 },
      });

      const { result } = createHook();

      expect(result.current.isPlayerAssigned(999)).toBe(false);
    });
  });

  describe('getPlayerSeat', () => {
    it('returns seat number when player is assigned', () => {
      playerState = createMockPlayerState({
        seatPlayers: { 7: 101 },
      });

      const { result } = createHook();

      expect(result.current.getPlayerSeat(101)).toBe(7);
    });

    it('returns null when player is not assigned', () => {
      playerState = createMockPlayerState({
        seatPlayers: {},
      });

      const { result } = createHook();

      expect(result.current.getPlayerSeat(101)).toBeNull();
    });
  });

  describe('clearAllSeatAssignments', () => {
    it('dispatches CLEAR_ALL_SEAT_PLAYERS action', async () => {
      const { result } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.clearAllSeatAssignments();
      });

      expect(dispatchPlayer).toHaveBeenCalledWith({
        type: PLAYER_ACTIONS.CLEAR_ALL_SEAT_PLAYERS,
      });
    });
  });

  describe('return values', () => {
    it('returns all expected functions', async () => {
      const { result } = createHook();

      expect(typeof result.current.isReady).toBe('boolean');
      expect(typeof result.current.createNewPlayer).toBe('function');
      expect(typeof result.current.updatePlayerById).toBe('function');
      expect(typeof result.current.deletePlayerById).toBe('function');
      expect(typeof result.current.loadAllPlayers).toBe('function');
      expect(typeof result.current.assignPlayerToSeat).toBe('function');
      expect(typeof result.current.clearSeatAssignment).toBe('function');
      expect(typeof result.current.getSeatPlayerName).toBe('function');
      expect(typeof result.current.getRecentPlayers).toBe('function');
      expect(typeof result.current.getAssignedPlayerIds).toBe('function');
      expect(typeof result.current.isPlayerAssigned).toBe('function');
      expect(typeof result.current.getPlayerSeat).toBe('function');
      expect(typeof result.current.clearAllSeatAssignments).toBe('function');
    });
  });

  describe('function stability', () => {
    it('returns stable loadAllPlayers reference', async () => {
      const { result, rerender } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const first = result.current.loadAllPlayers;
      rerender();
      expect(result.current.loadAllPlayers).toBe(first);
    });

    it('returns stable assignPlayerToSeat reference', async () => {
      const { result, rerender } = createHook();

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const first = result.current.assignPlayerToSeat;
      rerender();
      expect(result.current.assignPlayerToSeat).toBe(first);
    });
  });
});
