// @vitest-environment jsdom
/**
 * TournamentBridgeContext.test.jsx - Tests for tournament bridge provider
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { TournamentBridge } from '../TournamentBridge';

vi.mock('../SyncBridgeContext', () => ({
  useSyncBridge: () => ({
    liveHandState: null,
    pushTournament: vi.fn(),
    isExtensionConnected: false,
  }),
}));

vi.mock('../TournamentContext', () => ({
  useTournament: () => ({
    isTournament: false,
    currentBlinds: { sb: 0, bb: 0, ante: 0 },
    nextBlinds: null,
    levelTimeRemaining: null,
    heroMRatio: null,
    mRatioGuidance: null,
    blindOutInfo: null,
    icmPressure: { zone: 'standard', playersFromBubble: null },
    lockoutInfo: null,
    predictions: null,
    tournamentState: {
      chipStacks: {},
      playersRemaining: null,
      currentLevelIndex: 0,
      config: { totalEntrants: null, format: 'freezeout', blindSchedule: [] },
    },
    initTournament: vi.fn(),
    updateStack: vi.fn(),
    advanceLevel: vi.fn(),
    setPlayersRemaining: vi.fn(),
    dispatchTournament: vi.fn(),
  }),
}));

vi.mock('../GameContext', () => ({
  useGame: () => ({ mySeat: 1 }),
}));

vi.mock('../OnlineSessionContext', () => ({
  useOnlineSession: () => ({ selectedSessionId: null }),
}));

vi.mock('../../utils/persistence/sessionsStorage', () => ({
  updateSession: vi.fn().mockResolvedValue(),
}));

vi.mock('../../utils/errorHandler', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../constants/tournamentConstants', () => ({
  TOURNAMENT_ACTIONS: { UPDATE_CONFIG: 'UPDATE_CONFIG' },
}));

describe('TournamentBridgeContext', () => {
  it('renders children without crashing', () => {
    const { container } = render(
      <TournamentBridge>
        <div data-testid="child">OK</div>
      </TournamentBridge>
    );
    expect(container.textContent).toBe('OK');
  });
});
