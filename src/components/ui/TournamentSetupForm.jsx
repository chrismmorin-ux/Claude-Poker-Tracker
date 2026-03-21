/**
 * TournamentSetupForm.jsx - Tournament configuration fields
 *
 * Rendered inside SessionForm when gameType === 'TOURNAMENT'.
 * Collects format, starting stack, entry fee, entrants, payout slots,
 * and blind schedule selection.
 */

import React, { useState } from 'react';
import {
  TOURNAMENT_FORMATS,
  TOURNAMENT_FORMAT_KEYS,
  BLIND_SCHEDULES,
  BLIND_SCHEDULE_KEYS,
  BLIND_SCHEDULE_LABELS,
} from '../../constants/tournamentConstants';

/**
 * @param {Object} props
 * @param {Object} props.config - Current tournament config state
 * @param {Function} props.onChange - Callback: (updatedConfig) => void
 */
export const TournamentSetupForm = ({ config, onChange }) => {
  const [scheduleKey, setScheduleKey] = useState('STANDARD_20MIN');
  const [showCustomEditor, setShowCustomEditor] = useState(false);

  const updateField = (field, value) => {
    onChange({ ...config, [field]: value });
  };

  const handleScheduleChange = (key) => {
    if (key === 'CUSTOM') {
      setShowCustomEditor(true);
      return;
    }
    setScheduleKey(key);
    setShowCustomEditor(false);
    onChange({ ...config, blindSchedule: BLIND_SCHEDULES[key] });
  };

  const handleCustomLevelChange = (index, field, value) => {
    const updated = [...config.blindSchedule];
    updated[index] = { ...updated[index], [field]: Number(value) || 0 };
    onChange({ ...config, blindSchedule: updated });
  };

  const addCustomLevel = () => {
    const last = config.blindSchedule[config.blindSchedule.length - 1] || {
      sb: 25, bb: 50, ante: 0, durationMinutes: 20,
    };
    onChange({
      ...config,
      blindSchedule: [
        ...config.blindSchedule,
        {
          level: config.blindSchedule.length + 1,
          sb: last.sb * 2,
          bb: last.bb * 2,
          ante: last.ante * 2,
          durationMinutes: last.durationMinutes,
        },
      ],
    });
  };

  const removeCustomLevel = (index) => {
    const updated = config.blindSchedule.filter((_, i) => i !== index);
    onChange({ ...config, blindSchedule: updated });
  };

  return (
    <div className="space-y-3 border-t border-gray-600 pt-3 mt-3">
      {/* Format */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Format</label>
        <div className="grid grid-cols-3 gap-2">
          {TOURNAMENT_FORMAT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => updateField('format', key.toLowerCase())}
              className={`px-3 py-2 rounded font-medium transition-colors text-sm ${
                config.format === key.toLowerCase()
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {TOURNAMENT_FORMATS[key].label}
            </button>
          ))}
        </div>
      </div>

      {/* Starting Stack + Entry Fee (side by side) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Starting Stack</label>
          <input
            type="number"
            value={config.startingStack}
            onChange={(e) => updateField('startingStack', Number(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Entry Fee</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input
              type="number"
              value={config.entryFee || ''}
              onChange={(e) => updateField('entryFee', Number(e.target.value) || 0)}
              placeholder="0"
              className="w-full pl-7 pr-3 py-2 bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Total Entrants + Payout Slots */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Total Entrants</label>
          <input
            type="number"
            value={config.totalEntrants || ''}
            onChange={(e) => updateField('totalEntrants', Number(e.target.value) || null)}
            placeholder="Can update later"
            className="w-full px-3 py-2 bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Payout Slots</label>
          <input
            type="number"
            value={config.payoutSlots || ''}
            onChange={(e) => updateField('payoutSlots', Number(e.target.value) || null)}
            placeholder="e.g. 15"
            className="w-full px-3 py-2 bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Blind Schedule */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Blind Schedule</label>
        <div className="grid grid-cols-4 gap-2">
          {BLIND_SCHEDULE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleScheduleChange(key)}
              className={`px-2 py-2 rounded font-medium transition-colors text-xs ${
                scheduleKey === key && !showCustomEditor
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {BLIND_SCHEDULE_LABELS[key]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleScheduleChange('CUSTOM')}
            className={`px-2 py-2 rounded font-medium transition-colors text-xs ${
              showCustomEditor
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      {/* Custom blind editor */}
      {showCustomEditor && (
        <div className="max-h-40 overflow-y-auto border border-gray-600 rounded p-2 space-y-1">
          <div className="grid grid-cols-5 gap-1 text-xs text-gray-400 font-medium mb-1">
            <span>SB</span><span>BB</span><span>Ante</span><span>Min</span><span></span>
          </div>
          {config.blindSchedule.map((level, idx) => (
            <div key={idx} className="grid grid-cols-5 gap-1">
              <input
                type="number"
                value={level.sb}
                onChange={(e) => handleCustomLevelChange(idx, 'sb', e.target.value)}
                className="px-1 py-1 bg-gray-700 text-gray-200 border border-gray-600 rounded text-xs"
              />
              <input
                type="number"
                value={level.bb}
                onChange={(e) => handleCustomLevelChange(idx, 'bb', e.target.value)}
                className="px-1 py-1 bg-gray-700 text-gray-200 border border-gray-600 rounded text-xs"
              />
              <input
                type="number"
                value={level.ante}
                onChange={(e) => handleCustomLevelChange(idx, 'ante', e.target.value)}
                className="px-1 py-1 bg-gray-700 text-gray-200 border border-gray-600 rounded text-xs"
              />
              <input
                type="number"
                value={level.durationMinutes}
                onChange={(e) => handleCustomLevelChange(idx, 'durationMinutes', e.target.value)}
                className="px-1 py-1 bg-gray-700 text-gray-200 border border-gray-600 rounded text-xs"
              />
              <button
                type="button"
                onClick={() => removeCustomLevel(idx)}
                className="text-red-400 hover:text-red-300 text-xs"
              >
                x
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addCustomLevel}
            className="text-xs text-blue-400 hover:text-blue-300 mt-1"
          >
            + Add Level
          </button>
        </div>
      )}
    </div>
  );
};
