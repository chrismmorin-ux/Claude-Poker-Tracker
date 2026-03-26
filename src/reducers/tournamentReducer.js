/**
 * tournamentReducer.js - Tournament state management
 *
 * Manages tournament-specific state: blind levels, timer, chip stacks,
 * eliminations, and configuration.
 */

import { TOURNAMENT_ACTIONS } from '../constants/tournamentConstants';
import { createValidatedReducer, SCHEMA_RULES } from '../utils/reducerUtils';

// =============================================================================
// INITIAL STATE
// =============================================================================

export const initialTournamentState = {
  config: {
    format: 'freezeout',
    startingStack: 10000,
    entryFee: 0,
    totalEntrants: null,
    payoutSlots: null,
    blindSchedule: [],
    handPaceSeconds: 30,
    lockoutLevel: null,
  },
  currentLevelIndex: 0,
  levelStartTime: null,
  isPaused: false,
  pauseStartTime: null,
  totalPausedMs: 0,
  chipStacks: {},
  playersRemaining: null,
  eliminations: [],
  isActive: false,
};

// =============================================================================
// SCHEMA
// =============================================================================

export const TOURNAMENT_STATE_SCHEMA = {
  currentLevelIndex: SCHEMA_RULES.optionalNumber,
  totalPausedMs: { type: 'number', min: 0 },
  isPaused: SCHEMA_RULES.boolean,
  isActive: SCHEMA_RULES.boolean,
  eliminations: SCHEMA_RULES.array,
  config: SCHEMA_RULES.object,
  chipStacks: SCHEMA_RULES.object,
};

// =============================================================================
// RAW REDUCER
// =============================================================================

const rawTournamentReducer = (state, action) => {
  switch (action.type) {
    case TOURNAMENT_ACTIONS.INIT_TOURNAMENT: {
      const { config } = action.payload;
      return {
        ...initialTournamentState,
        config: {
          ...initialTournamentState.config,
          ...config,
        },
        currentLevelIndex: 0,
        levelStartTime: Date.now(),
        isPaused: false,
        totalPausedMs: 0,
        playersRemaining: config.totalEntrants || null,
        isActive: true,
      };
    }

    case TOURNAMENT_ACTIONS.SET_BLIND_LEVEL:
      return {
        ...state,
        currentLevelIndex: action.payload.levelIndex,
        levelStartTime: Date.now(),
        totalPausedMs: 0,
        pauseStartTime: null,
        isPaused: false,
      };

    case TOURNAMENT_ACTIONS.ADVANCE_BLIND_LEVEL:
      return {
        ...state,
        currentLevelIndex: state.currentLevelIndex + 1,
        levelStartTime: Date.now(),
        totalPausedMs: 0,
        pauseStartTime: null,
        isPaused: false,
      };

    case TOURNAMENT_ACTIONS.PAUSE_TIMER:
      if (state.isPaused) return state;
      return {
        ...state,
        isPaused: true,
        pauseStartTime: Date.now(),
      };

    case TOURNAMENT_ACTIONS.RESUME_TIMER: {
      if (!state.isPaused) return state;
      const pausedDuration = Date.now() - (state.pauseStartTime || Date.now());
      return {
        ...state,
        isPaused: false,
        pauseStartTime: null,
        totalPausedMs: state.totalPausedMs + pausedDuration,
      };
    }

    case TOURNAMENT_ACTIONS.UPDATE_CHIP_STACK:
      return {
        ...state,
        chipStacks: {
          ...state.chipStacks,
          [action.payload.seat]: action.payload.stack,
        },
      };

    case TOURNAMENT_ACTIONS.RECORD_ELIMINATION: {
      const elimination = {
        timestamp: Date.now(),
        playersRemaining: (state.playersRemaining || 2) - 1,
        seat: action.payload.seat || null,
        playerName: action.payload.playerName || null,
      };
      const newStacks = { ...state.chipStacks };
      if (action.payload.seat) {
        delete newStacks[action.payload.seat];
      }
      return {
        ...state,
        eliminations: [...state.eliminations, elimination],
        playersRemaining: elimination.playersRemaining,
        chipStacks: newStacks,
      };
    }

    case TOURNAMENT_ACTIONS.SET_PLAYERS_REMAINING:
      return {
        ...state,
        playersRemaining: action.payload.count,
      };

    case TOURNAMENT_ACTIONS.UPDATE_CONFIG:
      return {
        ...state,
        config: {
          ...state.config,
          ...action.payload,
        },
      };

    case TOURNAMENT_ACTIONS.RESET_TOURNAMENT:
      return { ...initialTournamentState };

    case TOURNAMENT_ACTIONS.HYDRATE_TOURNAMENT:
      return {
        ...state,
        ...action.payload,
        config: { ...state.config, ...(action.payload.config || {}) },
      };

    default:
      return state;
  }
};

// =============================================================================
// VALIDATED EXPORT
// =============================================================================

export const tournamentReducer = createValidatedReducer(
  rawTournamentReducer,
  TOURNAMENT_STATE_SCHEMA,
  'tournamentReducer'
);
