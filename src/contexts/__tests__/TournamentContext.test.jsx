import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { TournamentProvider, useTournament } from '../TournamentContext';
import { SessionProvider } from '../SessionContext';
import { initialTournamentState } from '../../reducers/tournamentReducer';
import { initialSessionState } from '../../reducers/sessionReducer';

// Wrapper that provides required context
const createWrapper = (tournamentState = initialTournamentState) => {
  const dispatchTournament = vi.fn();
  const dispatchSession = vi.fn();

  const Wrapper = ({ children }) => (
    <SessionProvider sessionState={initialSessionState} dispatchSession={dispatchSession}>
      <TournamentProvider tournamentState={tournamentState} dispatchTournament={dispatchTournament}>
        {children}
      </TournamentProvider>
    </SessionProvider>
  );

  return { Wrapper, dispatchTournament };
};

describe('TournamentContext', () => {
  it('provides tournament state via useTournament', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTournament(), { wrapper: Wrapper });

    expect(result.current.tournamentState).toEqual(initialTournamentState);
    expect(result.current.isTournament).toBe(false);
  });

  it('isTournament is false when no tournament active', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTournament(), { wrapper: Wrapper });
    expect(result.current.isTournament).toBe(false);
  });

  it('provides handler functions', () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useTournament(), { wrapper: Wrapper });

    expect(typeof result.current.initTournament).toBe('function');
    expect(typeof result.current.advanceLevel).toBe('function');
    expect(typeof result.current.pauseTimer).toBe('function');
    expect(typeof result.current.resumeTimer).toBe('function');
    expect(typeof result.current.updateStack).toBe('function');
    expect(typeof result.current.recordElimination).toBe('function');
    expect(typeof result.current.setPlayersRemaining).toBe('function');
    expect(typeof result.current.resetTournament).toBe('function');
  });

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useTournament());
    }).toThrow('useTournament must be used within a TournamentProvider');
  });
});
