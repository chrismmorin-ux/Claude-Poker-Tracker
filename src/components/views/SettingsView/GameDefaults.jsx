import React from 'react';
import { SETTINGS_FIELDS } from '../../../constants/settingsConstants';
import { GOLD } from '../../../constants/designTokens';

export const GameDefaults = ({ settings, updateSetting, allVenues, allGameTypes, allGameTypeKeys }) => (
  <div className="bg-gray-800 rounded-lg p-5">
    <h3 className="text-lg font-bold mb-4" style={{ color: GOLD }}>Game Defaults</h3>

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
);
