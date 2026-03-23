import React, { useState, useCallback, useEffect } from 'react';
import { BACKUP_FREQUENCIES, SETTINGS_FIELDS } from '../../../constants/settingsConstants';
import { GOLD } from '../../../constants/designTokens';

const SIM_STORAGE_KEY = '__simState';
const getSimState = () => {
  try {
    const raw = localStorage.getItem(SIM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const DataAndAbout = ({ settings, updateSetting, resetSettings, showWarning, showSuccess, showError }) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [seedLoading, setSeedLoading] = useState(null); // tracks which button is loading
  const [simCount, setSimCount] = useState(10);
  const [simTotal, setSimTotal] = useState(() => getSimState()?.handCount || 0);

  // Refresh sim total when localStorage changes (e.g. console usage)
  useEffect(() => {
    const onStorage = () => setSimTotal(getSimState()?.handCount || 0);
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleSeed = useCallback(async (type) => {
    setSeedLoading(type);
    try {
      if (type === 'basic') {
        const { seedTestData } = await import('../../../utils/seedTestData');
        const result = await seedTestData();
        showSuccess?.(`Seeded ${result.handCount} hands with ${Object.keys(result.playerIds).length} players`);
      } else if (type === 'range') {
        const { seedRangeTestData } = await import('../../../utils/seedRangeTestData');
        const result = await seedRangeTestData();
        showSuccess?.(`Seeded ${result.handCount} range hands with session #${result.sessionId}`);
      } else if (type === 'clearBasic') {
        const { clearTestData } = await import('../../../utils/seedTestData');
        await clearTestData();
        showSuccess?.('Cleared basic test data');
      } else if (type === 'clearRange') {
        const { clearRangeTestData } = await import('../../../utils/seedRangeTestData');
        await clearRangeTestData();
        showSuccess?.('Cleared range test data');
      } else if (type === 'sim') {
        const { sim } = await import('../../../utils/handSimulator');
        const result = await sim(simCount);
        setSimTotal(result.handCount);
        showSuccess?.(`Simulated ${simCount} hands (total: ${result.handCount})`);
      } else if (type === 'clearSim') {
        const { simClear } = await import('../../../utils/handSimulator');
        await simClear();
        setSimTotal(0);
        showSuccess?.('Cleared simulator data');
      }
    } catch (err) {
      console.error('[DataAndAbout] Seed error:', err);
      showError?.(`Seed failed: ${err.message}`);
    } finally {
      setSeedLoading(null);
    }
  }, [showSuccess, showError, simCount]);

  const handleResetSettings = () => {
    if (showResetConfirm) {
      resetSettings();
      setShowResetConfirm(false);
      if (showWarning) {
        showWarning('Settings reset to defaults');
      }
    } else {
      setShowResetConfirm(true);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <h3 className="text-lg font-bold mb-4" style={{ color: '#d4a847' }}>Data & About</h3>

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
          Version: <span className="text-white font-medium">v117</span>
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

      {/* Hand Simulator */}
      <div className="pt-3 border-t border-gray-700">
        <h4 className="text-sm font-bold mb-2" style={{ color: '#d4a847' }}>Hand Simulator</h4>
        <p className="text-gray-400 text-xs mb-2">
          Simulate realistic hands with 6 archetype players. Range-based preflop, equity-driven postflop.
        </p>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-gray-300 text-xs">Hands:</label>
          <input
            type="number"
            min={1}
            max={500}
            value={simCount}
            onChange={(e) => setSimCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
            className="w-16 px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => handleSeed('sim')}
            disabled={seedLoading !== null}
            className="px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium"
          >
            {seedLoading === 'sim' ? 'Simulating...' : 'Simulate'}
          </button>
          <button
            onClick={() => handleSeed('clearSim')}
            disabled={seedLoading !== null}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded-lg text-xs font-medium"
          >
            {seedLoading === 'clearSim' ? 'Clearing...' : 'Clear'}
          </button>
        </div>
        {simTotal > 0 && (
          <p className="text-gray-400 text-xs">
            Total simulated: <span className="text-white font-medium">{simTotal}</span> hands
          </p>
        )}
      </div>

      {/* Dev Tools - Temporary (dev only) */}
      {import.meta.env.DEV && (
      <div className="pt-3 border-t border-gray-700">
        <h4 className="text-sm font-bold text-yellow-400 mb-2">Dev Tools (Temporary)</h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleSeed('basic')}
            disabled={seedLoading !== null}
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium"
          >
            {seedLoading === 'basic' ? 'Seeding...' : 'Seed Basic Data'}
          </button>
          <button
            onClick={() => handleSeed('clearBasic')}
            disabled={seedLoading !== null}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded-lg text-xs font-medium"
          >
            {seedLoading === 'clearBasic' ? 'Clearing...' : 'Clear Basic Data'}
          </button>
          <button
            onClick={() => handleSeed('range')}
            disabled={seedLoading !== null}
            className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium"
          >
            {seedLoading === 'range' ? 'Seeding...' : 'Seed Range Data'}
          </button>
          <button
            onClick={() => handleSeed('clearRange')}
            disabled={seedLoading !== null}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded-lg text-xs font-medium"
          >
            {seedLoading === 'clearRange' ? 'Clearing...' : 'Clear Range Data'}
          </button>
        </div>
        <p className="text-gray-500 text-xs mt-1">Each click adds a new batch. Check console for details.</p>
      </div>
      )}
    </div>
  );
};
