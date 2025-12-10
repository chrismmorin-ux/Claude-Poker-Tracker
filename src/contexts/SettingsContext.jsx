/**
 * SettingsContext.jsx - Settings state context provider
 * Provides: settings, isLoading, isInitialized
 * Plus settings operations: updateSetting, resetSettings, custom venue/game type management
 * Plus derived values: allVenues, allGameTypes (defaults + custom combined)
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import { SETTINGS_ACTIONS, SETTINGS_FIELDS } from '../constants/settingsConstants';
import { VENUES, GAME_TYPES } from '../constants/sessionConstants';

// Create context
const SettingsContext = createContext(null);

/**
 * Settings context provider component
 * Wraps children with settings state and operations
 */
export const SettingsProvider = ({ settingsState, dispatchSettings, children }) => {
  const { settings, isLoading, isInitialized } = settingsState;

  // Derived: Combined venues (defaults + custom)
  const allVenues = useMemo(() => {
    return [...VENUES, ...(settings.customVenues || [])];
  }, [settings.customVenues]);

  // Derived: Combined game types (defaults + custom)
  // Custom game types are added with a CUSTOM_ prefix key
  const allGameTypes = useMemo(() => {
    const customTypes = (settings.customGameTypes || []).reduce((acc, gt) => {
      // Create a unique key for custom types
      const key = `CUSTOM_${gt.label.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
      acc[key] = gt;
      return acc;
    }, {});
    return { ...GAME_TYPES, ...customTypes };
  }, [settings.customGameTypes]);

  // Derived: Array of all game type keys (for iteration)
  const allGameTypeKeys = useMemo(() => {
    return Object.keys(allGameTypes);
  }, [allGameTypes]);

  // Handler: Update a single setting
  const updateSetting = useCallback((key, value) => {
    dispatchSettings({
      type: SETTINGS_ACTIONS.UPDATE_SETTING,
      payload: { key, value },
    });
  }, [dispatchSettings]);

  // Handler: Reset all settings to defaults
  const resetSettings = useCallback(() => {
    dispatchSettings({ type: SETTINGS_ACTIONS.RESET_SETTINGS });
  }, [dispatchSettings]);

  // Handler: Add a custom venue
  const addCustomVenue = useCallback((venue) => {
    if (!venue || !venue.trim()) return false;
    const trimmedVenue = venue.trim();
    // Check if already exists in defaults or custom
    if (VENUES.includes(trimmedVenue) || settings.customVenues.includes(trimmedVenue)) {
      return false;
    }
    dispatchSettings({
      type: SETTINGS_ACTIONS.ADD_CUSTOM_VENUE,
      payload: { venue: trimmedVenue },
    });
    return true;
  }, [dispatchSettings, settings.customVenues]);

  // Handler: Remove a custom venue
  const removeCustomVenue = useCallback((venue) => {
    dispatchSettings({
      type: SETTINGS_ACTIONS.REMOVE_CUSTOM_VENUE,
      payload: { venue },
    });
  }, [dispatchSettings]);

  // Handler: Add a custom game type
  const addCustomGameType = useCallback((gameType) => {
    if (!gameType || !gameType.label || !gameType.label.trim()) return false;
    const normalizedGameType = {
      label: gameType.label.trim(),
      buyInDefault: gameType.buyInDefault || 0,
      rebuyDefault: gameType.rebuyDefault || 0,
    };
    // Check if label already exists in defaults or custom
    const defaultLabels = Object.values(GAME_TYPES).map((gt) => gt.label);
    const customLabels = settings.customGameTypes.map((gt) => gt.label);
    if (
      defaultLabels.includes(normalizedGameType.label) ||
      customLabels.includes(normalizedGameType.label)
    ) {
      return false;
    }
    dispatchSettings({
      type: SETTINGS_ACTIONS.ADD_CUSTOM_GAME_TYPE,
      payload: { gameType: normalizedGameType },
    });
    return true;
  }, [dispatchSettings, settings.customGameTypes]);

  // Handler: Remove a custom game type
  const removeCustomGameType = useCallback((label) => {
    dispatchSettings({
      type: SETTINGS_ACTIONS.REMOVE_CUSTOM_GAME_TYPE,
      payload: { label },
    });
  }, [dispatchSettings]);

  // Handler: Check if a venue is custom (can be removed)
  const isCustomVenue = useCallback((venue) => {
    return settings.customVenues.includes(venue);
  }, [settings.customVenues]);

  // Handler: Check if a game type is custom (can be removed)
  const isCustomGameType = useCallback((label) => {
    return settings.customGameTypes.some((gt) => gt.label === label);
  }, [settings.customGameTypes]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    // State
    settings,
    isLoading,
    isInitialized,
    // Derived
    allVenues,
    allGameTypes,
    allGameTypeKeys,
    // Dispatch
    dispatchSettings,
    // Handlers
    updateSetting,
    resetSettings,
    addCustomVenue,
    removeCustomVenue,
    addCustomGameType,
    removeCustomGameType,
    isCustomVenue,
    isCustomGameType,
  }), [
    settings,
    isLoading,
    isInitialized,
    allVenues,
    allGameTypes,
    allGameTypeKeys,
    dispatchSettings,
    updateSetting,
    resetSettings,
    addCustomVenue,
    removeCustomVenue,
    addCustomGameType,
    removeCustomGameType,
    isCustomVenue,
    isCustomGameType,
  ]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

/**
 * Hook to access settings context
 * Throws if used outside of SettingsProvider
 */
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export default SettingsContext;
