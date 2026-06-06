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
      const venues = [
        { name: 'Casino A', notes: '' },
        { name: 'Casino B', notes: '' },
      ];
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.UPDATE_SETTING,
        payload: {
          key: 'customVenues',
          value: venues,
        },
      });
      expect(newState.settings.customVenues).toEqual(venues);
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
    it('adds a new custom venue (string payload normalizes to object)', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.ADD_CUSTOM_VENUE,
        payload: { venue: 'New Casino' },
      });
      expect(newState.settings.customVenues).toContainEqual({ name: 'New Casino', notes: '' });
    });

    it('adds a custom venue with a note (object payload)', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.ADD_CUSTOM_VENUE,
        payload: { venue: { name: 'Noted Casino', notes: 'great rake, soft 1/3' } },
      });
      expect(newState.settings.customVenues).toContainEqual({
        name: 'Noted Casino',
        notes: 'great rake, soft 1/3',
      });
    });

    it('prevents duplicate venues by name', () => {
      state.settings.customVenues = [{ name: 'Existing Casino', notes: '' }];
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.ADD_CUSTOM_VENUE,
        payload: { venue: 'Existing Casino' },
      });
      expect(newState.settings.customVenues).toEqual([{ name: 'Existing Casino', notes: '' }]);
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
    it('removes a custom venue by name', () => {
      state.settings.customVenues = [
        { name: 'Casino A', notes: '' },
        { name: 'Casino B', notes: 'has notes' },
      ];
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.REMOVE_CUSTOM_VENUE,
        payload: { venue: 'Casino A' },
      });
      expect(newState.settings.customVenues).toEqual([{ name: 'Casino B', notes: 'has notes' }]);
    });

    it('handles removing non-existent venue', () => {
      state.settings.customVenues = [{ name: 'Casino A', notes: '' }];
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.REMOVE_CUSTOM_VENUE,
        payload: { venue: 'Non-existent' },
      });
      expect(newState.settings.customVenues).toEqual([{ name: 'Casino A', notes: '' }]);
    });
  });

  describe('SET_VENUE_NOTE', () => {
    it('sets the note on an existing custom venue', () => {
      state.settings.customVenues = [
        { name: 'Casino A', notes: '' },
        { name: 'Casino B', notes: 'old' },
      ];
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_VENUE_NOTE,
        payload: { name: 'Casino A', notes: 'tight 2/5, $2 max rake' },
      });
      expect(newState.settings.customVenues).toEqual([
        { name: 'Casino A', notes: 'tight 2/5, $2 max rake' },
        { name: 'Casino B', notes: 'old' },
      ]);
    });

    it('clears the note when passed empty string', () => {
      state.settings.customVenues = [{ name: 'Casino A', notes: 'old' }];
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_VENUE_NOTE,
        payload: { name: 'Casino A', notes: '' },
      });
      expect(newState.settings.customVenues).toEqual([{ name: 'Casino A', notes: '' }]);
    });

    it('is a no-op for an unknown venue name', () => {
      state.settings.customVenues = [{ name: 'Casino A', notes: '' }];
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_VENUE_NOTE,
        payload: { name: 'Built-In Venue', notes: 'ignored' },
      });
      expect(newState.settings.customVenues).toEqual([{ name: 'Casino A', notes: '' }]);
    });
  });

  describe('customVenues normalize-on-read (legacy migration)', () => {
    it('LOAD_SETTINGS migrates legacy string venues to objects', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.LOAD_SETTINGS,
        payload: { settings: { customVenues: ['Old Casino', 'Another'] } },
      });
      expect(newState.settings.customVenues).toEqual([
        { name: 'Old Casino', notes: '' },
        { name: 'Another', notes: '' },
      ]);
    });

    it('HYDRATE_SETTINGS preserves object venues and drops malformed entries', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.HYDRATE_SETTINGS,
        payload: {
          settings: {
            customVenues: [
              { name: 'Kept', notes: 'note' },
              'Legacy',
              null,
              { notes: 'no name' },
              { name: '   ' },
            ],
          },
        },
      });
      expect(newState.settings.customVenues).toEqual([
        { name: 'Kept', notes: 'note' },
        { name: 'Legacy', notes: '' },
      ]);
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

  describe('SCF self-coach (WS-148 / SPR-033)', () => {
    it('default selfCoach state matches SCF G4 v1 spec', () => {
      expect(DEFAULT_SETTINGS.selfCoach).toBeDefined();
      expect(DEFAULT_SETTINGS.selfCoach.signalToggles).toEqual({
        enableLeak: true,
        enableDrill: true,
        enableTest: true,
        enableRecent: true,
      });
      expect(DEFAULT_SETTINGS.selfCoach.signalWeights).toEqual({
        W_leak: 0.5,
        W_drill: 0.3,
        W_test: 0.15,
        W_recent: 0.05,
      });
      expect(DEFAULT_SETTINGS.selfCoach.ownerTier).toBeNull();
    });

    it('SET_SELF_COACH_SIGNAL_TOGGLE flips a single toggle', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_SELF_COACH_SIGNAL_TOGGLE,
        payload: { name: 'enableLeak', enabled: false },
      });
      expect(newState.settings.selfCoach.signalToggles.enableLeak).toBe(false);
      // Other toggles unchanged
      expect(newState.settings.selfCoach.signalToggles.enableDrill).toBe(true);
    });

    it('SET_SELF_COACH_SIGNAL_TOGGLE coerces enabled to boolean', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_SELF_COACH_SIGNAL_TOGGLE,
        payload: { name: 'enableTest', enabled: 0 },
      });
      expect(newState.settings.selfCoach.signalToggles.enableTest).toBe(false);
    });

    it('SET_SELF_COACH_SIGNAL_WEIGHT updates a single weight', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_SELF_COACH_SIGNAL_WEIGHT,
        payload: { name: 'W_leak', weight: 0.8 },
      });
      expect(newState.settings.selfCoach.signalWeights.W_leak).toBe(0.8);
      // Other weights unchanged
      expect(newState.settings.selfCoach.signalWeights.W_drill).toBe(0.3);
    });

    it('SET_SELF_COACH_SIGNAL_WEIGHT rejects non-finite values', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_SELF_COACH_SIGNAL_WEIGHT,
        payload: { name: 'W_leak', weight: 'garbage' },
      });
      expect(newState).toEqual(state);
    });

    it('SET_SELF_COACH_OWNER_TIER updates the owner-set tier', () => {
      const newState = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_SELF_COACH_OWNER_TIER,
        payload: { tier: 'studied-amateur' },
      });
      expect(newState.settings.selfCoach.ownerTier).toBe('studied-amateur');
    });

    it('SET_SELF_COACH_OWNER_TIER accepts null to clear', () => {
      // Pre-set tier first
      let s = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_SELF_COACH_OWNER_TIER,
        payload: { tier: 'pro' },
      });
      expect(s.settings.selfCoach.ownerTier).toBe('pro');
      s = settingsReducer(s, {
        type: SETTINGS_ACTIONS.SET_SELF_COACH_OWNER_TIER,
        payload: { tier: null },
      });
      expect(s.settings.selfCoach.ownerTier).toBeNull();
    });
  });

  describe('PIO privacy (WS-165 / SPR-036)', () => {
    it('default photoCaptureEnabled is false (AP-PIO-03 privacy-first)', () => {
      expect(DEFAULT_SETTINGS.privacy).toBeDefined();
      expect(DEFAULT_SETTINGS.privacy.photoCaptureEnabled).toBe(false);
    });

    it('SET_PRIVACY_PHOTO_CAPTURE_ENABLED toggles the flag', () => {
      const s1 = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_PRIVACY_PHOTO_CAPTURE_ENABLED,
        payload: { enabled: true },
      });
      expect(s1.settings.privacy.photoCaptureEnabled).toBe(true);
      const s2 = settingsReducer(s1, {
        type: SETTINGS_ACTIONS.SET_PRIVACY_PHOTO_CAPTURE_ENABLED,
        payload: { enabled: false },
      });
      expect(s2.settings.privacy.photoCaptureEnabled).toBe(false);
    });

    it('coerces enabled to boolean', () => {
      const s = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_PRIVACY_PHOTO_CAPTURE_ENABLED,
        payload: { enabled: 1 },
      });
      expect(s.settings.privacy.photoCaptureEnabled).toBe(true);
    });
  });

  describe('VCE (WS-181)', () => {
    it('default voiceCardEntry is enabled=false, threshold=0.65 (R3 spike + D-3)', () => {
      expect(DEFAULT_SETTINGS.voiceCardEntry).toBeDefined();
      expect(DEFAULT_SETTINGS.voiceCardEntry.enabled).toBe(false);
      expect(DEFAULT_SETTINGS.voiceCardEntry.confidenceThreshold).toBe(0.65);
    });

    it('SET_VOICE_CARD_ENTRY_ENABLED toggles the flag', () => {
      const s1 = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_VOICE_CARD_ENTRY_ENABLED,
        payload: { enabled: true },
      });
      expect(s1.settings.voiceCardEntry.enabled).toBe(true);
      // threshold preserved
      expect(s1.settings.voiceCardEntry.confidenceThreshold).toBe(0.65);

      const s2 = settingsReducer(s1, {
        type: SETTINGS_ACTIONS.SET_VOICE_CARD_ENTRY_ENABLED,
        payload: { enabled: false },
      });
      expect(s2.settings.voiceCardEntry.enabled).toBe(false);
    });

    it('SET_VOICE_CARD_ENTRY_ENABLED coerces to boolean', () => {
      const s = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_VOICE_CARD_ENTRY_ENABLED,
        payload: { enabled: 1 },
      });
      expect(s.settings.voiceCardEntry.enabled).toBe(true);
    });

    it('SET_VOICE_CARD_ENTRY_CONFIDENCE_THRESHOLD updates threshold', () => {
      const s = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_VOICE_CARD_ENTRY_CONFIDENCE_THRESHOLD,
        payload: { threshold: 0.8 },
      });
      expect(s.settings.voiceCardEntry.confidenceThreshold).toBe(0.8);
      // enabled preserved
      expect(s.settings.voiceCardEntry.enabled).toBe(false);
    });

    it('SET_VOICE_CARD_ENTRY_CONFIDENCE_THRESHOLD clamps below 0.5', () => {
      const s = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_VOICE_CARD_ENTRY_CONFIDENCE_THRESHOLD,
        payload: { threshold: 0.1 },
      });
      expect(s.settings.voiceCardEntry.confidenceThreshold).toBe(0.5);
    });

    it('SET_VOICE_CARD_ENTRY_CONFIDENCE_THRESHOLD clamps above 0.9', () => {
      const s = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_VOICE_CARD_ENTRY_CONFIDENCE_THRESHOLD,
        payload: { threshold: 0.99 },
      });
      expect(s.settings.voiceCardEntry.confidenceThreshold).toBe(0.9);
    });

    it('SET_VOICE_CARD_ENTRY_CONFIDENCE_THRESHOLD rejects non-finite', () => {
      const s = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_VOICE_CARD_ENTRY_CONFIDENCE_THRESHOLD,
        payload: { threshold: 'garbage' },
      });
      expect(s).toEqual(state);
    });

    // 2026-05-12 — first-live-use iteration additions
    it('default activationMode is "hold"', () => {
      expect(DEFAULT_SETTINGS.voiceCardEntry.activationMode).toBe('hold');
    });

    it('default position is "bottom-left"', () => {
      expect(DEFAULT_SETTINGS.voiceCardEntry.position).toBe('bottom-left');
    });

    it('SET_VOICE_CARD_ENTRY_ACTIVATION_MODE accepts hold and tap', () => {
      const s1 = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_VOICE_CARD_ENTRY_ACTIVATION_MODE,
        payload: { mode: 'tap' },
      });
      expect(s1.settings.voiceCardEntry.activationMode).toBe('tap');
      const s2 = settingsReducer(s1, {
        type: SETTINGS_ACTIONS.SET_VOICE_CARD_ENTRY_ACTIVATION_MODE,
        payload: { mode: 'hold' },
      });
      expect(s2.settings.voiceCardEntry.activationMode).toBe('hold');
    });

    it('SET_VOICE_CARD_ENTRY_ACTIVATION_MODE rejects invalid mode', () => {
      const s = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_VOICE_CARD_ENTRY_ACTIVATION_MODE,
        payload: { mode: 'wiggle' },
      });
      expect(s).toEqual(state);
    });

    it('SET_VOICE_CARD_ENTRY_POSITION accepts bottom-left and top-right', () => {
      const s1 = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_VOICE_CARD_ENTRY_POSITION,
        payload: { position: 'top-right' },
      });
      expect(s1.settings.voiceCardEntry.position).toBe('top-right');
      const s2 = settingsReducer(s1, {
        type: SETTINGS_ACTIONS.SET_VOICE_CARD_ENTRY_POSITION,
        payload: { position: 'bottom-left' },
      });
      expect(s2.settings.voiceCardEntry.position).toBe('bottom-left');
    });

    it('SET_VOICE_CARD_ENTRY_POSITION rejects invalid position', () => {
      const s = settingsReducer(state, {
        type: SETTINGS_ACTIONS.SET_VOICE_CARD_ENTRY_POSITION,
        payload: { position: 'mid-center' },
      });
      expect(s).toEqual(state);
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
