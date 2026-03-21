import { describe, it, expect } from 'vitest';
import { tournamentReducer, initialTournamentState } from '../tournamentReducer';
import { TOURNAMENT_ACTIONS } from '../../constants/tournamentConstants';

describe('tournamentReducer', () => {
  it('returns initial state for unknown action', () => {
    const result = tournamentReducer(initialTournamentState, { type: 'UNKNOWN' });
    expect(result).toEqual(initialTournamentState);
  });

  it('INIT_TOURNAMENT sets up tournament state', () => {
    const config = {
      format: 'freezeout',
      startingStack: 10000,
      totalEntrants: 120,
      blindSchedule: [{ sb: 25, bb: 50, ante: 0, durationMinutes: 20 }],
    };
    const result = tournamentReducer(initialTournamentState, {
      type: TOURNAMENT_ACTIONS.INIT_TOURNAMENT,
      payload: { config },
    });

    expect(result.isActive).toBe(true);
    expect(result.config.format).toBe('freezeout');
    expect(result.config.startingStack).toBe(10000);
    expect(result.playersRemaining).toBe(120);
    expect(result.currentLevelIndex).toBe(0);
    expect(result.levelStartTime).toBeGreaterThan(0);
  });

  it('ADVANCE_BLIND_LEVEL increments level', () => {
    const state = { ...initialTournamentState, isActive: true, currentLevelIndex: 2 };
    const result = tournamentReducer(state, { type: TOURNAMENT_ACTIONS.ADVANCE_BLIND_LEVEL });
    expect(result.currentLevelIndex).toBe(3);
  });

  it('PAUSE_TIMER sets isPaused', () => {
    const state = { ...initialTournamentState, isActive: true, isPaused: false };
    const result = tournamentReducer(state, { type: TOURNAMENT_ACTIONS.PAUSE_TIMER });
    expect(result.isPaused).toBe(true);
    expect(result.pauseStartTime).toBeGreaterThan(0);
  });

  it('RESUME_TIMER clears isPaused and accumulates pause time', () => {
    const now = Date.now();
    const state = {
      ...initialTournamentState,
      isActive: true,
      isPaused: true,
      pauseStartTime: now - 5000,
      totalPausedMs: 1000,
    };
    const result = tournamentReducer(state, { type: TOURNAMENT_ACTIONS.RESUME_TIMER });
    expect(result.isPaused).toBe(false);
    expect(result.pauseStartTime).toBeNull();
    expect(result.totalPausedMs).toBeGreaterThanOrEqual(5000);
  });

  it('UPDATE_CHIP_STACK sets stack for a seat', () => {
    const result = tournamentReducer(initialTournamentState, {
      type: TOURNAMENT_ACTIONS.UPDATE_CHIP_STACK,
      payload: { seat: 3, stack: 15000 },
    });
    expect(result.chipStacks[3]).toBe(15000);
  });

  it('RECORD_ELIMINATION adds elimination and decrements players', () => {
    const state = { ...initialTournamentState, playersRemaining: 50, chipStacks: { 5: 8000 } };
    const result = tournamentReducer(state, {
      type: TOURNAMENT_ACTIONS.RECORD_ELIMINATION,
      payload: { seat: 5, playerName: 'Bob' },
    });
    expect(result.playersRemaining).toBe(49);
    expect(result.eliminations).toHaveLength(1);
    expect(result.eliminations[0].seat).toBe(5);
    expect(result.chipStacks[5]).toBeUndefined();
  });

  it('SET_PLAYERS_REMAINING updates count', () => {
    const result = tournamentReducer(initialTournamentState, {
      type: TOURNAMENT_ACTIONS.SET_PLAYERS_REMAINING,
      payload: { count: 42 },
    });
    expect(result.playersRemaining).toBe(42);
  });

  it('RESET_TOURNAMENT returns to initial state', () => {
    const state = { ...initialTournamentState, isActive: true, currentLevelIndex: 5 };
    const result = tournamentReducer(state, { type: TOURNAMENT_ACTIONS.RESET_TOURNAMENT });
    expect(result).toEqual(initialTournamentState);
  });

  it('HYDRATE_TOURNAMENT merges payload into state', () => {
    const payload = {
      config: { format: 'rebuy', startingStack: 20000 },
      currentLevelIndex: 3,
      isActive: true,
    };
    const result = tournamentReducer(initialTournamentState, {
      type: TOURNAMENT_ACTIONS.HYDRATE_TOURNAMENT,
      payload,
    });
    expect(result.currentLevelIndex).toBe(3);
    expect(result.isActive).toBe(true);
  });
});
