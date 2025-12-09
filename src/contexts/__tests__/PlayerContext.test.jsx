/**
 * PlayerContext.test.jsx - Tests for player state context provider
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PlayerProvider, usePlayer } from '../PlayerContext';
import { PLAYER_ACTIONS } from '../../constants/playerConstants';

// Helper to create a wrapper with PlayerProvider
const createWrapper = (playerState, dispatchPlayer = vi.fn()) => {
  const Wrapper = ({ children }) => (
    <PlayerProvider playerState={playerState} dispatchPlayer={dispatchPlayer}>
      {children}
    </PlayerProvider>
  );
  return Wrapper;
};

// Default player state for testing
const createDefaultPlayerState = (overrides = {}) => ({
  allPlayers: [],
  seatPlayers: {},
  isLoading: false,
  ...overrides,
});

// Create test players
const createTestPlayers = () => [
  { playerId: 'player-1', name: 'Alice', createdAt: Date.now() },
  { playerId: 'player-2', name: 'Bob', createdAt: Date.now() },
  { playerId: 'player-3', name: 'Charlie', createdAt: Date.now() },
];

describe('PlayerContext', () => {
  describe('usePlayer hook', () => {
    it('throws error when used outside of PlayerProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => usePlayer());
      }).toThrow('usePlayer must be used within a PlayerProvider');

      consoleSpy.mockRestore();
    });

    it('provides player state values', () => {
      const playerState = createDefaultPlayerState();
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState),
      });

      expect(result.current.allPlayers).toEqual([]);
      expect(result.current.seatPlayers).toEqual({});
      expect(result.current.isLoading).toBe(false);
    });

    it('provides dispatchPlayer function', () => {
      const mockDispatch = vi.fn();
      const playerState = createDefaultPlayerState();
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState, mockDispatch),
      });

      expect(typeof result.current.dispatchPlayer).toBe('function');

      result.current.dispatchPlayer({ type: 'TEST_ACTION' });
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'TEST_ACTION' });
    });
  });

  describe('getPlayerById', () => {
    it('returns null when player not found', () => {
      const playerState = createDefaultPlayerState();
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState),
      });

      expect(result.current.getPlayerById('non-existent')).toBeNull();
    });

    it('returns player when found', () => {
      const players = createTestPlayers();
      const playerState = createDefaultPlayerState({ allPlayers: players });
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState),
      });

      const player = result.current.getPlayerById('player-2');
      expect(player).toEqual(players[1]);
      expect(player.name).toBe('Bob');
    });

    it('returns null for empty playerId', () => {
      const players = createTestPlayers();
      const playerState = createDefaultPlayerState({ allPlayers: players });
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState),
      });

      expect(result.current.getPlayerById('')).toBeNull();
      expect(result.current.getPlayerById(null)).toBeNull();
      expect(result.current.getPlayerById(undefined)).toBeNull();
    });
  });

  describe('getSeatPlayerName', () => {
    it('returns null for empty seat', () => {
      const playerState = createDefaultPlayerState();
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState),
      });

      expect(result.current.getSeatPlayerName(1)).toBeNull();
    });

    it('returns null when playerId assigned but player not found', () => {
      const playerState = createDefaultPlayerState({
        seatPlayers: { 3: 'non-existent-player' },
      });
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState),
      });

      expect(result.current.getSeatPlayerName(3)).toBeNull();
    });

    it('returns player name when seat is assigned', () => {
      const players = createTestPlayers();
      const playerState = createDefaultPlayerState({
        allPlayers: players,
        seatPlayers: { 5: 'player-1' },
      });
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState),
      });

      expect(result.current.getSeatPlayerName(5)).toBe('Alice');
    });
  });

  describe('getSeatPlayer', () => {
    it('returns null for empty seat', () => {
      const playerState = createDefaultPlayerState();
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState),
      });

      expect(result.current.getSeatPlayer(1)).toBeNull();
    });

    it('returns null when playerId assigned but player not found', () => {
      const playerState = createDefaultPlayerState({
        seatPlayers: { 2: 'non-existent' },
      });
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState),
      });

      expect(result.current.getSeatPlayer(2)).toBeNull();
    });

    it('returns full player object when seat is assigned', () => {
      const players = createTestPlayers();
      const playerState = createDefaultPlayerState({
        allPlayers: players,
        seatPlayers: { 7: 'player-3' },
      });
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState),
      });

      const player = result.current.getSeatPlayer(7);
      expect(player).toEqual(players[2]);
      expect(player.name).toBe('Charlie');
    });
  });

  describe('assignPlayerToSeat', () => {
    it('dispatches SET_SEAT_PLAYER action', () => {
      const mockDispatch = vi.fn();
      const playerState = createDefaultPlayerState();
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState, mockDispatch),
      });

      act(() => {
        result.current.assignPlayerToSeat(3, 'player-1');
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: PLAYER_ACTIONS.SET_SEAT_PLAYER,
        payload: { seat: 3, playerId: 'player-1' },
      });
    });
  });

  describe('clearSeatPlayer', () => {
    it('dispatches CLEAR_SEAT_PLAYER action', () => {
      const mockDispatch = vi.fn();
      const playerState = createDefaultPlayerState({
        seatPlayers: { 4: 'player-2' },
      });
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState, mockDispatch),
      });

      act(() => {
        result.current.clearSeatPlayer(4);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: PLAYER_ACTIONS.CLEAR_SEAT_PLAYER,
        payload: { seat: 4 },
      });
    });
  });

  describe('clearAllSeatPlayers', () => {
    it('dispatches CLEAR_ALL_SEAT_PLAYERS action', () => {
      const mockDispatch = vi.fn();
      const playerState = createDefaultPlayerState({
        seatPlayers: { 1: 'player-1', 2: 'player-2', 3: 'player-3' },
      });
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState, mockDispatch),
      });

      act(() => {
        result.current.clearAllSeatPlayers();
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: PLAYER_ACTIONS.CLEAR_ALL_SEAT_PLAYERS,
      });
    });
  });

  describe('hydrateSeatPlayers', () => {
    it('dispatches HYDRATE_SEAT_PLAYERS action', () => {
      const mockDispatch = vi.fn();
      const playerState = createDefaultPlayerState();
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState, mockDispatch),
      });

      const seatPlayersData = { 1: 'player-1', 5: 'player-2', 9: 'player-3' };
      act(() => {
        result.current.hydrateSeatPlayers(seatPlayersData);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: PLAYER_ACTIONS.HYDRATE_SEAT_PLAYERS,
        payload: { seatPlayers: seatPlayersData },
      });
    });
  });

  describe('assignedSeatCount', () => {
    it('returns 0 when no seats assigned', () => {
      const playerState = createDefaultPlayerState();
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState),
      });

      expect(result.current.assignedSeatCount).toBe(0);
    });

    it('returns count of assigned seats', () => {
      const playerState = createDefaultPlayerState({
        seatPlayers: { 1: 'player-1', 3: 'player-2', 7: 'player-3' },
      });
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState),
      });

      expect(result.current.assignedSeatCount).toBe(3);
    });

    it('counts all 9 seats when fully assigned', () => {
      const playerState = createDefaultPlayerState({
        seatPlayers: {
          1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5',
          6: 'p6', 7: 'p7', 8: 'p8', 9: 'p9',
        },
      });
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState),
      });

      expect(result.current.assignedSeatCount).toBe(9);
    });
  });

  describe('context memoization', () => {
    it('provides all expected context values', () => {
      const players = createTestPlayers();
      const playerState = createDefaultPlayerState({
        allPlayers: players,
        seatPlayers: { 1: 'player-1' },
      });
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState),
      });

      // State values
      expect(result.current).toHaveProperty('allPlayers');
      expect(result.current).toHaveProperty('seatPlayers');
      expect(result.current).toHaveProperty('isLoading');

      // Derived values
      expect(result.current).toHaveProperty('assignedSeatCount');

      // Dispatch
      expect(result.current).toHaveProperty('dispatchPlayer');

      // Utilities
      expect(result.current).toHaveProperty('getPlayerById');
      expect(result.current).toHaveProperty('getSeatPlayerName');
      expect(result.current).toHaveProperty('getSeatPlayer');

      // Handlers
      expect(result.current).toHaveProperty('assignPlayerToSeat');
      expect(result.current).toHaveProperty('clearSeatPlayer');
      expect(result.current).toHaveProperty('clearAllSeatPlayers');
      expect(result.current).toHaveProperty('hydrateSeatPlayers');
    });
  });

  describe('edge cases', () => {
    it('handles player with empty name', () => {
      const players = [{ playerId: 'player-1', name: '', createdAt: Date.now() }];
      const playerState = createDefaultPlayerState({
        allPlayers: players,
        seatPlayers: { 1: 'player-1' },
      });
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState),
      });

      // Empty string is falsy, so || null returns null
      expect(result.current.getSeatPlayerName(1)).toBeNull();
    });

    it('handles multiple seats with same player', () => {
      const players = createTestPlayers();
      const playerState = createDefaultPlayerState({
        allPlayers: players,
        seatPlayers: { 1: 'player-1', 5: 'player-1' },
      });
      const { result } = renderHook(() => usePlayer(), {
        wrapper: createWrapper(playerState),
      });

      expect(result.current.getSeatPlayerName(1)).toBe('Alice');
      expect(result.current.getSeatPlayerName(5)).toBe('Alice');
      expect(result.current.assignedSeatCount).toBe(2);
    });
  });
});
