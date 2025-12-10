/**
 * settingsReducer.test.js - Tests for settings state reducer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  settingsReducer,
  SETTINGS_ACTIONS,
  initialSettingsState,
  SETTINGS_STATE_SCHEMA,
} from '../settingsReducer';
import { DEFAULT_SETTINGS } from '../../constants/settingsConstants';

describe('settingsReducer', () => {
  let state;

  beforeEach(() => {
    // Deep clone initial state to avoid mutation between tests
    state = JSON.parse(JSON.stringify(initialSettingsState));
  });

  describe('initialSettingsState', () => {
    it('has correct default values', () => {
      expect(initialSettingsState.settings).toEqual(DEFAULT_SETTINGS);
      expect(initialSettingsState.isLoading).toBe(false);
      expect(initialSettingsState.isInitialized).toBe(false);
    });

    it('has all expected settings fields', () => {
      const settings = initialSettingsState.settings;
      expect(settings.theme).toBe('dark');
      expect(settings.cardSize).toBe('medium');
      expect(settings.defaultVenue).toBe(null);
      expect(settings.defaultGameType).toBe(null);
      expect(settings.autoBackupEnabled).toBe(false);
      expect(settings.backupFrequency).toBe('manual');
      expect(settings.customVenues).toEqual([]);
      expect(settings.customGameTypes).toEqual([]);
      expect(settings.errorReportingEnabled).toBe(true);
    });
  });

  describe('LOAD_SETTINGS', () => {
    it('loads settings and marks as initialized', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.LOAD_SETTINGS,
        payload: {
          settings: {
            theme: 'light',
            cardSize: 'large',
          },
        },
      });
      expect(newState.settings.theme).toBe('light');
      expect(newState.settings.cardSize).toBe('large');
      expect(newState.isInitialized).toBe(true);
    });

    it('merges with defaults for missing fields', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.LOAD_SETTINGS,
        payload: {
          settings: {
            theme: 'light',
          },
        },
      });
      expect(newState.settings.theme).toBe('light');
      expect(newState.settings.cardSize).toBe('medium'); // Default
      expect(newState.settings.customVenues).toEqual([]); // Default
    });
  });

  describe('UPDATE_SETTING', () => {
    it('updates a single setting', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.UPDATE_SETTING,
        payload: {
          key: 'theme',
          value: 'light',
        },
      });
      expect(newState.settings.theme).toBe('light');
      expect(newState.settings.cardSize).toBe('medium'); // Unchanged
    });

    it('updates array settings', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.UPDATE_SETTING,
        payload: {
          key: 'customVenues',
          value: ['Casino A', 'Casino B'],
        },
      });
      expect(newState.settings.customVenues).toEqual(['Casino A', 'Casino B']);
    });
  });

  describe('RESET_SETTINGS', () => {
    it('resets all settings to defaults', () => {
      state.settings.theme = 'light';
      state.settings.cardSize = 'large';
      state.settings.customVenues = ['Casino A'];

      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.RESET_SETTINGS,
      });

      expect(newState.settings).toEqual(DEFAULT_SETTINGS);
      expect(newState.settings.theme).toBe('dark');
      expect(newState.settings.cardSize).toBe('medium');
      expect(newState.settings.customVenues).toEqual([]);
    });
  });

  describe('HYDRATE_SETTINGS', () => {
    it('hydrates with provided settings', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.HYDRATE_SETTINGS,
        payload: {
          settings: {
            theme: 'light',
            cardSize: 'small',
          },
        },
      });
      expect(newState.settings.theme).toBe('light');
      expect(newState.settings.cardSize).toBe('small');
      expect(newState.isInitialized).toBe(true);
    });

    it('uses defaults when settings is null', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.HYDRATE_SETTINGS,
        payload: {
          settings: null,
        },
      });
      expect(newState.settings).toEqual(DEFAULT_SETTINGS);
      expect(newState.isInitialized).toBe(true);
    });

    it('merges with defaults for partial settings', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.HYDRATE_SETTINGS,
        payload: {
          settings: {
            theme: 'light',
          },
        },
      });
      expect(newState.settings.theme).toBe('light');
      expect(newState.settings.cardSize).toBe('medium'); // Default
      expect(newState.settings.defaultVenue).toBe(null); // Default
    });
  });

  describe('SET_LOADING', () => {
    it('sets loading to true', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_LOADING,
        payload: { isLoading: true },
      });
      expect(newState.isLoading).toBe(true);
    });

    it('sets loading to false', () => {
      state.isLoading = true;
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_LOADING,
        payload: { isLoading: false },
      });
      expect(newState.isLoading).toBe(false);
    });
  });

  describe('ADD_CUSTOM_VENUE', () => {
    it('adds a new custom venue', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.ADD_CUSTOM_VENUE,
        payload: { venue: 'New Casino' },
      });
      expect(newState.settings.customVenues).toContain('New Casino');
    });

    it('prevents duplicate venues', () => {
      state.settings.customVenues = ['Existing Casino'];
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.ADD_CUSTOM_VENUE,
        payload: { venue: 'Existing Casino' },
      });
      expect(newState.settings.customVenues).toEqual(['Existing Casino']);
    });

    it('ignores empty venue', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.ADD_CUSTOM_VENUE,
        payload: { venue: '' },
      });
      expect(newState.settings.customVenues).toEqual([]);
    });
  });

  describe('REMOVE_CUSTOM_VENUE', () => {
    it('removes a custom venue', () => {
      state.settings.customVenues = ['Casino A', 'Casino B'];
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.REMOVE_CUSTOM_VENUE,
        payload: { venue: 'Casino A' },
      });
      expect(newState.settings.customVenues).toEqual(['Casino B']);
    });

    it('handles removing non-existent venue', () => {
      state.settings.customVenues = ['Casino A'];
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.REMOVE_CUSTOM_VENUE,
        payload: { venue: 'Non-existent' },
      });
      expect(newState.settings.customVenues).toEqual(['Casino A']);
    });
  });

  describe('ADD_CUSTOM_GAME_TYPE', () => {
    it('adds a new custom game type', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.ADD_CUSTOM_GAME_TYPE,
        payload: {
          gameType: {
            label: '5/10',
            buyInDefault: 1000,
            rebuyDefault: 1000,
          },
        },
      });
      expect(newState.settings.customGameTypes).toHaveLength(1);
      expect(newState.settings.customGameTypes[0].label).toBe('5/10');
      expect(newState.settings.customGameTypes[0].buyInDefault).toBe(1000);
    });

    it('prevents duplicate game types by label', () => {
      state.settings.customGameTypes = [
        { label: '5/10', buyInDefault: 1000, rebuyDefault: 1000 },
      ];
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.ADD_CUSTOM_GAME_TYPE,
        payload: {
          gameType: { label: '5/10', buyInDefault: 2000, rebuyDefault: 2000 },
        },
      });
      expect(newState.settings.customGameTypes).toHaveLength(1);
      expect(newState.settings.customGameTypes[0].buyInDefault).toBe(1000); // Original value
    });

    it('ignores empty game type', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.ADD_CUSTOM_GAME_TYPE,
        payload: { gameType: null },
      });
      expect(newState.settings.customGameTypes).toEqual([]);
    });
  });

  describe('REMOVE_CUSTOM_GAME_TYPE', () => {
    it('removes a custom game type by label', () => {
      state.settings.customGameTypes = [
        { label: '5/10', buyInDefault: 1000, rebuyDefault: 1000 },
        { label: '10/20', buyInDefault: 2000, rebuyDefault: 2000 },
      ];
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.REMOVE_CUSTOM_GAME_TYPE,
        payload: { label: '5/10' },
      });
      expect(newState.settings.customGameTypes).toHaveLength(1);
      expect(newState.settings.customGameTypes[0].label).toBe('10/20');
    });
  });

  describe('unknown action', () => {
    it('returns current state for unknown action', () => {
      const newState = settingsReducer(state, {
        type: 'UNKNOWN_ACTION',
      });
      expect(newState).toEqual(state);
    });
  });

  describe('SETTINGS_STATE_SCHEMA', () => {
    it('has expected shape', () => {
      expect(SETTINGS_STATE_SCHEMA.settings.type).toBe('object');
      expect(SETTINGS_STATE_SCHEMA.isLoading.type).toBe('boolean');
      expect(SETTINGS_STATE_SCHEMA.isInitialized.type).toBe('boolean');
    });
  });
});
