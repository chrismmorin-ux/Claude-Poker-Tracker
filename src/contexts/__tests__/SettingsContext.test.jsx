/**
 * SettingsContext.test.jsx - Tests for settings state context provider
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SettingsProvider, useSettings } from '../SettingsContext';
import { SETTINGS_ACTIONS, DEFAULT_SETTINGS } from '../../constants/settingsConstants';
import { VENUES, GAME_TYPES } from '../../constants/sessionConstants';

// Helper to create a wrapper with SettingsProvider
const createWrapper = (settingsState, dispatchSettings = vi.fn()) => {
  const Wrapper = ({ children }) => (
    <SettingsProvider settingsState={settingsState} dispatchSettings={dispatchSettings}>
      {children}
    </SettingsProvider>
  );
  return Wrapper;
};

// Default settings state for testing
const createDefaultSettingsState = (overrides = {}) => ({
  settings: { ...DEFAULT_SETTINGS },
  isLoading: false,
  isInitialized: true,
  ...overrides,
});

describe('SettingsContext', () => {
  describe('useSettings hook', () => {
    it('throws error when used outside of SettingsProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useSettings());
      }).toThrow('useSettings must be used within a SettingsProvider');

      consoleSpy.mockRestore();
    });

    it('provides settings state values', () => {
      const settingsState = createDefaultSettingsState();
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState),
      });

      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isInitialized).toBe(true);
    });

    it('provides dispatchSettings function', () => {
      const mockDispatch = vi.fn();
      const settingsState = createDefaultSettingsState();
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState, mockDispatch),
      });

      expect(typeof result.current.dispatchSettings).toBe('function');

      result.current.dispatchSettings({ type: 'TEST_ACTION' });
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'TEST_ACTION' });
    });
  });

  describe('allVenues derived value', () => {
    it('includes default venues', () => {
      const settingsState = createDefaultSettingsState();
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState),
      });

      expect(result.current.allVenues).toContain('Online');
      expect(result.current.allVenues).toContain('Horseshoe Casino');
      expect(result.current.allVenues).toContain('Wind Creek Casino');
    });

    it('includes custom venues', () => {
      const settingsState = createDefaultSettingsState({
        settings: {
          ...DEFAULT_SETTINGS,
          customVenues: ['My Local Casino', 'Home Game'],
        },
      });
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState),
      });

      expect(result.current.allVenues).toContain('My Local Casino');
      expect(result.current.allVenues).toContain('Home Game');
    });

    it('combines default and custom venues', () => {
      const settingsState = createDefaultSettingsState({
        settings: {
          ...DEFAULT_SETTINGS,
          customVenues: ['Custom Casino'],
        },
      });
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState),
      });

      // Should have 3 defaults + 1 custom = 4 total
      expect(result.current.allVenues.length).toBe(4);
    });
  });

  describe('allGameTypes derived value', () => {
    it('includes default game types', () => {
      const settingsState = createDefaultSettingsState();
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState),
      });

      expect(result.current.allGameTypes.TOURNAMENT).toBeDefined();
      expect(result.current.allGameTypes.ONE_TWO).toBeDefined();
      expect(result.current.allGameTypes.ONE_THREE).toBeDefined();
      expect(result.current.allGameTypes.TWO_FIVE).toBeDefined();
    });

    it('includes custom game types with CUSTOM_ prefix', () => {
      const settingsState = createDefaultSettingsState({
        settings: {
          ...DEFAULT_SETTINGS,
          customGameTypes: [
            { label: '5/10', buyInDefault: 1000, rebuyDefault: 1000 },
          ],
        },
      });
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState),
      });

      expect(result.current.allGameTypes.CUSTOM_5_10).toBeDefined();
      expect(result.current.allGameTypes.CUSTOM_5_10.label).toBe('5/10');
      expect(result.current.allGameTypes.CUSTOM_5_10.buyInDefault).toBe(1000);
    });
  });

  describe('updateSetting handler', () => {
    it('dispatches UPDATE_SETTING action', () => {
      const mockDispatch = vi.fn();
      const settingsState = createDefaultSettingsState();
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState, mockDispatch),
      });

      act(() => {
        result.current.updateSetting('theme', 'light');
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: SETTINGS_ACTIONS.UPDATE_SETTING,
        payload: { key: 'theme', value: 'light' },
      });
    });
  });

  describe('resetSettings handler', () => {
    it('dispatches RESET_SETTINGS action', () => {
      const mockDispatch = vi.fn();
      const settingsState = createDefaultSettingsState();
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState, mockDispatch),
      });

      act(() => {
        result.current.resetSettings();
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: SETTINGS_ACTIONS.RESET_SETTINGS,
      });
    });
  });

  describe('addCustomVenue handler', () => {
    it('dispatches ADD_CUSTOM_VENUE action for new venue', () => {
      const mockDispatch = vi.fn();
      const settingsState = createDefaultSettingsState();
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState, mockDispatch),
      });

      act(() => {
        const added = result.current.addCustomVenue('New Casino');
        expect(added).toBe(true);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: SETTINGS_ACTIONS.ADD_CUSTOM_VENUE,
        payload: { venue: 'New Casino' },
      });
    });

    it('returns false for empty venue', () => {
      const mockDispatch = vi.fn();
      const settingsState = createDefaultSettingsState();
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState, mockDispatch),
      });

      act(() => {
        const added = result.current.addCustomVenue('');
        expect(added).toBe(false);
      });

      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('returns false for duplicate default venue', () => {
      const mockDispatch = vi.fn();
      const settingsState = createDefaultSettingsState();
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState, mockDispatch),
      });

      act(() => {
        const added = result.current.addCustomVenue('Online');
        expect(added).toBe(false);
      });

      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('returns false for duplicate custom venue', () => {
      const mockDispatch = vi.fn();
      const settingsState = createDefaultSettingsState({
        settings: {
          ...DEFAULT_SETTINGS,
          customVenues: ['Existing Casino'],
        },
      });
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState, mockDispatch),
      });

      act(() => {
        const added = result.current.addCustomVenue('Existing Casino');
        expect(added).toBe(false);
      });

      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('trims whitespace from venue name', () => {
      const mockDispatch = vi.fn();
      const settingsState = createDefaultSettingsState();
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState, mockDispatch),
      });

      act(() => {
        result.current.addCustomVenue('  New Casino  ');
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: SETTINGS_ACTIONS.ADD_CUSTOM_VENUE,
        payload: { venue: 'New Casino' },
      });
    });
  });

  describe('removeCustomVenue handler', () => {
    it('dispatches REMOVE_CUSTOM_VENUE action', () => {
      const mockDispatch = vi.fn();
      const settingsState = createDefaultSettingsState({
        settings: {
          ...DEFAULT_SETTINGS,
          customVenues: ['Custom Casino'],
        },
      });
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState, mockDispatch),
      });

      act(() => {
        result.current.removeCustomVenue('Custom Casino');
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: SETTINGS_ACTIONS.REMOVE_CUSTOM_VENUE,
        payload: { venue: 'Custom Casino' },
      });
    });
  });

  describe('addCustomGameType handler', () => {
    it('dispatches ADD_CUSTOM_GAME_TYPE action for new game type', () => {
      const mockDispatch = vi.fn();
      const settingsState = createDefaultSettingsState();
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState, mockDispatch),
      });

      act(() => {
        const added = result.current.addCustomGameType({
          label: '5/10',
          buyInDefault: 1000,
          rebuyDefault: 1000,
        });
        expect(added).toBe(true);
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: SETTINGS_ACTIONS.ADD_CUSTOM_GAME_TYPE,
        payload: {
          gameType: {
            label: '5/10',
            buyInDefault: 1000,
            rebuyDefault: 1000,
          },
        },
      });
    });

    it('returns false for empty label', () => {
      const mockDispatch = vi.fn();
      const settingsState = createDefaultSettingsState();
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState, mockDispatch),
      });

      act(() => {
        const added = result.current.addCustomGameType({ label: '' });
        expect(added).toBe(false);
      });

      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('returns false for duplicate default game type label', () => {
      const mockDispatch = vi.fn();
      const settingsState = createDefaultSettingsState();
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState, mockDispatch),
      });

      act(() => {
        const added = result.current.addCustomGameType({ label: '1/2' });
        expect(added).toBe(false);
      });

      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });

  describe('removeCustomGameType handler', () => {
    it('dispatches REMOVE_CUSTOM_GAME_TYPE action', () => {
      const mockDispatch = vi.fn();
      const settingsState = createDefaultSettingsState({
        settings: {
          ...DEFAULT_SETTINGS,
          customGameTypes: [{ label: '5/10', buyInDefault: 1000, rebuyDefault: 1000 }],
        },
      });
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState, mockDispatch),
      });

      act(() => {
        result.current.removeCustomGameType('5/10');
      });

      expect(mockDispatch).toHaveBeenCalledWith({
        type: SETTINGS_ACTIONS.REMOVE_CUSTOM_GAME_TYPE,
        payload: { label: '5/10' },
      });
    });
  });

  describe('isCustomVenue helper', () => {
    it('returns true for custom venue', () => {
      const settingsState = createDefaultSettingsState({
        settings: {
          ...DEFAULT_SETTINGS,
          customVenues: ['Custom Casino'],
        },
      });
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState),
      });

      expect(result.current.isCustomVenue('Custom Casino')).toBe(true);
    });

    it('returns false for default venue', () => {
      const settingsState = createDefaultSettingsState();
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState),
      });

      expect(result.current.isCustomVenue('Online')).toBe(false);
    });
  });

  describe('isCustomGameType helper', () => {
    it('returns true for custom game type', () => {
      const settingsState = createDefaultSettingsState({
        settings: {
          ...DEFAULT_SETTINGS,
          customGameTypes: [{ label: '5/10', buyInDefault: 1000, rebuyDefault: 1000 }],
        },
      });
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState),
      });

      expect(result.current.isCustomGameType('5/10')).toBe(true);
    });

    it('returns false for default game type', () => {
      const settingsState = createDefaultSettingsState();
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(settingsState),
      });

      expect(result.current.isCustomGameType('1/2')).toBe(false);
    });
  });
});
