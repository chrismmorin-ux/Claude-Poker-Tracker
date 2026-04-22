import React from 'react';
import { THEMES, CARD_SIZES, SETTINGS_FIELDS } from '../../../constants/settingsConstants';
import { GOLD } from '../../../constants/designTokens';

export const DisplaySettings = ({ settings, updateSetting }) => (
  <div className="bg-gray-800 rounded-lg p-5">
    <h3 className="text-lg font-bold mb-4" style={{ color: GOLD }}>Display</h3>

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
            className={`px-4 min-h-[44px] rounded-lg font-medium text-sm opacity-50 ${
              settings.theme === theme
                ? 'bg-blue-600 text-white cursor-not-allowed'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
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
            className={`px-4 min-h-[44px] rounded-lg font-medium text-sm transition-colors ${
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
);
