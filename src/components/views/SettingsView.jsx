import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { ScaledContainer } from '../ui/ScaledContainer';
import { LAYOUT } from '../../constants/gameConstants';
import { useSettings } from '../../contexts';
import { useUI } from '../../contexts';
import {
  THEMES,
  CARD_SIZES,
  BACKUP_FREQUENCIES,
  SETTINGS_FIELDS,
} from '../../constants/settingsConstants';
import { GAME_TYPES } from '../../constants/sessionConstants';

/**
 * SettingsView - App settings configuration interface
 * Sections:
 * - Display: Theme (placeholder), Card size selector
 * - Game Defaults: Default venue, Default game type
 * - Data: Export all, Import, Clear all (with confirmation)
 * - About: Version info, Error reporting toggle, Reset to defaults
 */
export const SettingsView = ({ scale }) => {
  const { setCurrentScreen, SCREEN } = useUI();
  const {
    settings,
    isLoading,
    updateSetting,
    resetSettings,
    allVenues,
    allGameTypes,
    allGameTypeKeys,
    addCustomVenue,
    removeCustomVenue,
    isCustomVenue,
    addCustomGameType,
    removeCustomGameType,
    isCustomGameType,
  } = useSettings();

  // Local state for new custom venue input
  const [newVenueName, setNewVenueName] = useState('');
  const [venueError, setVenueError] = useState('');

  // Local state for new custom game type input
  const [newGameTypeLabel, setNewGameTypeLabel] = useState('');
  const [newGameTypeBuyIn, setNewGameTypeBuyIn] = useState('');
  const [gameTypeError, setGameTypeError] = useState('');

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Handle adding a custom venue
  const handleAddVenue = () => {
    if (!newVenueName.trim()) {
      setVenueError('Venue name is required');
      return;
    }
    const success = addCustomVenue(newVenueName);
    if (success) {
      setNewVenueName('');
      setVenueError('');
    } else {
      setVenueError('Venue already exists');
    }
  };

  // Handle adding a custom game type
  const handleAddGameType = () => {
    if (!newGameTypeLabel.trim()) {
      setGameTypeError('Game type name is required');
      return;
    }
    const buyIn = newGameTypeBuyIn ? parseFloat(newGameTypeBuyIn) : 0;
    if (newGameTypeBuyIn && (isNaN(buyIn) || buyIn < 0)) {
      setGameTypeError('Buy-in must be a positive number');
      return;
    }
    const success = addCustomGameType({
      label: newGameTypeLabel.trim(),
      buyInDefault: buyIn,
      rebuyDefault: buyIn, // Default rebuy to same as buy-in
    });
    if (success) {
      setNewGameTypeLabel('');
      setNewGameTypeBuyIn('');
      setGameTypeError('');
    } else {
      setGameTypeError('Game type already exists');
    }
  };

  // Handle reset settings with confirmation
  const handleResetSettings = () => {
    if (showResetConfirm) {
      resetSettings();
      setShowResetConfirm(false);
    } else {
      setShowResetConfirm(true);
    }
  };

  if (isLoading) {
    return (
      <ScaledContainer scale={scale}>
        <div
          className="bg-gray-900 flex items-center justify-center"
          style={{ width: `${LAYOUT.TABLE_WIDTH}px`, height: `${LAYOUT.TABLE_HEIGHT}px` }}
        >
          <div className="text-white text-xl">Loading settings...</div>
        </div>
      </ScaledContainer>
    );
  }

  return (
    <ScaledContainer scale={scale}>
      <div
        className="bg-gray-900 overflow-y-auto p-6"
        style={{ width: `${LAYOUT.TABLE_WIDTH}px`, height: `${LAYOUT.TABLE_HEIGHT}px` }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <button
            onClick={() => setCurrentScreen(SCREEN.TABLE)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold"
          >
            Back to Table
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Display Section */}
          <div className="bg-gray-800 rounded-lg p-5">
            <h3 className="text-lg font-bold text-blue-400 mb-4">Display</h3>

            {/* Theme (placeholder - not functional yet) */}
            <div className="mb-4">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Theme <span className="text-gray-500">(coming soon)</span>
              </label>
              <div className="flex gap-2">
                {THEMES.map((theme) => (
                  <button
                    key={theme}
                    disabled
                    className={`px-4 py-2 rounded-lg font-medium text-sm ${
                      settings.theme === theme
                        ? 'bg-blue-600 text-white cursor-not-allowed'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
                    }`}
                  >
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Card Size */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Card Size
              </label>
              <div className="flex gap-2">
                {CARD_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => updateSetting(SETTINGS_FIELDS.CARD_SIZE, size)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      settings.cardSize === size
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Game Defaults Section */}
          <div className="bg-gray-800 rounded-lg p-5">
            <h3 className="text-lg font-bold text-green-400 mb-4">Game Defaults</h3>

            {/* Default Venue */}
            <div className="mb-4">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Default Venue
              </label>
              <select
                value={settings.defaultVenue || ''}
                onChange={(e) => updateSetting(SETTINGS_FIELDS.DEFAULT_VENUE, e.target.value || null)}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="">None (choose each session)</option>
                {allVenues.map((venue) => (
                  <option key={venue} value={venue}>{venue}</option>
                ))}
              </select>
            </div>

            {/* Default Game Type */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Default Game Type
              </label>
              <select
                value={settings.defaultGameType || ''}
                onChange={(e) => updateSetting(SETTINGS_FIELDS.DEFAULT_GAME_TYPE, e.target.value || null)}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="">None (choose each session)</option>
                {allGameTypeKeys.map((key) => (
                  <option key={key} value={allGameTypes[key].label}>
                    {allGameTypes[key].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Venues Section */}
          <div className="bg-gray-800 rounded-lg p-5">
            <h3 className="text-lg font-bold text-purple-400 mb-4">Custom Venues</h3>

            {/* Add new venue */}
            <div className="mb-4">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Add Custom Venue
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newVenueName}
                  onChange={(e) => {
                    setNewVenueName(e.target.value);
                    setVenueError('');
                  }}
                  placeholder="Enter venue name"
                  className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleAddVenue}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
                >
                  Add
                </button>
              </div>
              {venueError && (
                <p className="mt-1 text-red-400 text-sm">{venueError}</p>
              )}
            </div>

            {/* Custom venues list */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Your Custom Venues
              </label>
              {settings.customVenues.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No custom venues added yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {settings.customVenues.map((venue) => (
                    <span
                      key={venue}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-gray-700 text-gray-200 rounded-full text-sm"
                    >
                      {venue}
                      <button
                        onClick={() => removeCustomVenue(venue)}
                        className="ml-1 text-red-400 hover:text-red-300 font-bold"
                        title="Remove venue"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Custom Game Types Section */}
          <div className="bg-gray-800 rounded-lg p-5">
            <h3 className="text-lg font-bold text-cyan-400 mb-4">Custom Game Types</h3>

            {/* Add new game type */}
            <div className="mb-4">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Add Custom Game Type
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newGameTypeLabel}
                  onChange={(e) => {
                    setNewGameTypeLabel(e.target.value);
                    setGameTypeError('');
                  }}
                  placeholder="e.g., 5/10 PLO"
                  className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <div className="relative w-24">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="text"
                    value={newGameTypeBuyIn}
                    onChange={(e) => {
                      setNewGameTypeBuyIn(e.target.value);
                      setGameTypeError('');
                    }}
                    placeholder="Buy-in"
                    className="w-full pl-7 pr-2 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleAddGameType}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium"
                >
                  Add
                </button>
              </div>
              {gameTypeError && (
                <p className="mt-1 text-red-400 text-sm">{gameTypeError}</p>
              )}
            </div>

            {/* Custom game types list */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Your Custom Game Types
              </label>
              {settings.customGameTypes.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No custom game types added yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {settings.customGameTypes.map((gameType) => (
                    <span
                      key={gameType.label}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-gray-700 text-gray-200 rounded-full text-sm"
                    >
                      {gameType.label}
                      {gameType.buyInDefault > 0 && (
                        <span className="text-gray-400">(${gameType.buyInDefault})</span>
                      )}
                      <button
                        onClick={() => removeCustomGameType(gameType.label)}
                        className="ml-1 text-red-400 hover:text-red-300 font-bold"
                        title="Remove game type"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Data & About Section */}
          <div className="bg-gray-800 rounded-lg p-5">
            <h3 className="text-lg font-bold text-orange-400 mb-4">Data & About</h3>

            {/* Backup Settings */}
            <div className="mb-4">
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Backup Frequency <span className="text-gray-500">(coming soon)</span>
              </label>
              <div className="flex gap-2">
                {BACKUP_FREQUENCIES.map((freq) => (
                  <button
                    key={freq}
                    disabled
                    className={`px-3 py-1.5 rounded-lg font-medium text-sm ${
                      settings.backupFrequency === freq
                        ? 'bg-orange-600 text-white cursor-not-allowed'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
                    }`}
                  >
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Reporting */}
            <div className="mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.errorReportingEnabled}
                  onChange={(e) => updateSetting(SETTINGS_FIELDS.ERROR_REPORTING_ENABLED, e.target.checked)}
                  className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-300 text-sm">
                  Enable error reporting <span className="text-gray-500">(helps improve the app)</span>
                </span>
              </label>
            </div>

            {/* Version Info */}
            <div className="mb-4 pt-3 border-t border-gray-700">
              <p className="text-gray-400 text-sm">
                Version: <span className="text-white font-medium">v115</span>
              </p>
            </div>

            {/* Reset to Defaults */}
            <div className="pt-3 border-t border-gray-700">
              {showResetConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400 text-sm">Reset all settings?</span>
                  <button
                    onClick={handleResetSettings}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleResetSettings}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium"
                >
                  Reset to Defaults
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </ScaledContainer>
  );
};

SettingsView.propTypes = {
  scale: PropTypes.number.isRequired,
};
