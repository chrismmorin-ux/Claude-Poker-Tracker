import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { logger } from '../../../utils/errorHandler';
import { SETTINGS_FIELDS } from '../../../constants/settingsConstants';
import { GOLD } from '../../../constants/designTokens';
import { useBuildVersion } from '../../../hooks/useBuildVersion';

const formatBuildTime = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
};

const SIM_STORAGE_KEY = '__simState';
const getSimState = () => {
  try {
    const raw = localStorage.getItem(SIM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const UNDO_TOAST_DURATION_MS = 12000;

export const DataAndAbout = ({ settings, updateSetting, resetSettings, restoreSettings, showWarning, showSuccess, showError, addToast }) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [seedLoading, setSeedLoading] = useState(null); // tracks which button is loading
  const [simCount, setSimCount] = useState(10);
  const [simTotal, setSimTotal] = useState(() => getSimState()?.handCount || 0);
  // W4-A4-F12: collapse state for the dev-tools sub-panel. Session-scoped.
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  // W4-A4-F2: Pending sim-clear timer ID for deferred-commit + undo.
  const pendingSimClearRef = useRef(null);
  const { currentVersion, currentBuiltAt, updateAvailable, error: versionError } = useBuildVersion();

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
        const { seedTestData } = await import('../../../__dev__/seedTestData');
        const result = await seedTestData();
        showSuccess?.(`Seeded ${result.handCount} hands with ${Object.keys(result.playerIds).length} players`);
      } else if (type === 'range') {
        const { seedRangeTestData } = await import('../../../__dev__/seedRangeTestData');
        const result = await seedRangeTestData();
        showSuccess?.(`Seeded ${result.handCount} range hands with session #${result.sessionId}`);
      } else if (type === 'clearBasic') {
        const { clearTestData } = await import('../../../__dev__/seedTestData');
        await clearTestData();
        showSuccess?.('Cleared basic test data');
      } else if (type === 'clearRange') {
        const { clearRangeTestData } = await import('../../../__dev__/seedRangeTestData');
        await clearRangeTestData();
        showSuccess?.('Cleared range test data');
      } else if (type === 'sim') {
        const { sim } = await import('../../../__dev__/handSimulator');
        const result = await sim(simCount);
        setSimTotal(result.handCount);
        showSuccess?.(`Simulated ${simCount} hands (total: ${result.handCount})`);
      } else if (type === 'clearSim') {
        // W4-A4-F2: Deferred-clear with 12s toast+undo. Optimistic UI clear;
        // IDB + player deletion deferred via setTimeout so Undo can cancel.
        const prevSimTotal = simTotal;
        setSimTotal(0);
        if (pendingSimClearRef.current) {
          clearTimeout(pendingSimClearRef.current);
        }
        pendingSimClearRef.current = setTimeout(async () => {
          pendingSimClearRef.current = null;
          try {
            const { simClear } = await import('../../../__dev__/handSimulator');
            await simClear();
          } catch (err) {
            logger.error('DataAndAbout', err);
            // If commit fails, restore UI so state isn't lost silently.
            setSimTotal(prevSimTotal);
            showError?.(`Clear failed: ${err.message}`);
          }
        }, 12000);
        if (addToast) {
          addToast(`Simulator data clear — ${prevSimTotal} hands removed`, {
            variant: 'warning',
            duration: 12000,
            action: {
              label: 'Undo',
              onClick: () => {
                if (pendingSimClearRef.current) {
                  clearTimeout(pendingSimClearRef.current);
                  pendingSimClearRef.current = null;
                }
                setSimTotal(prevSimTotal);
                showSuccess?.('Simulator data restored');
              },
            },
          });
        }
      }
    } catch (err) {
      logger.error('DataAndAbout', err);
      showError?.(`Seed failed: ${err.message}`);
    } finally {
      setSeedLoading(null);
    }
  }, [showSuccess, showError, simCount, simTotal, addToast]);

  // W4-A4-F1: Reset to Defaults with toast+undo. The two-click pre-confirm
  // remains (warning is useful); on confirm we snapshot current settings,
  // reset, and open a 12s toast with Undo that restores the snapshot.
  const handleResetSettings = () => {
    if (showResetConfirm) {
      const snapshot = { ...settings };
      resetSettings();
      setShowResetConfirm(false);
      if (addToast && restoreSettings) {
        addToast('Settings reset to defaults', {
          variant: 'warning',
          duration: UNDO_TOAST_DURATION_MS,
          action: {
            label: 'Undo',
            onClick: () => {
              restoreSettings(snapshot);
              if (showSuccess) showSuccess('Settings restored');
            },
          },
        });
      } else if (showWarning) {
        // Fallback when undo plumbing isn't available (defensive — should not hit in practice).
        showWarning('Settings reset to defaults');
      }
    } else {
      setShowResetConfirm(true);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <h3 className="text-lg font-bold mb-4" style={{ color: GOLD.base }}>Data & About</h3>

      {/* Backup Settings — W4-A4-F5: compressed from 3 disabled buttons to a
          single info line. Backup infra is tracked under F-P18; until it lands,
          the panel doesn't need to reserve full-row chrome for a feature that
          can't be selected. */}
      <div className="mb-4">
        <p className="text-sm text-gray-400">
          Automatic backups <span className="text-gray-500">— coming soon</span>
        </p>
      </div>

      {/* W4-A4-F8: removed vaporware "Enable error reporting" checkbox. The
          flag never wired to any external transmission; nothing in errorHandler
          or errorLog consumed it. Keeping a UI toggle that does nothing was
          actively misleading ("helps improve the app" — but no data leaves
          the device). Re-introduce only when an actual error-reporting service
          is integrated. */}

      {/* Version Info */}
      <div className="mb-4 pt-3 border-t border-gray-700 space-y-1">
        <p className="text-gray-400 text-sm">
          Build:{' '}
          {currentVersion ? (
            <>
              <span className="text-white font-mono">{currentVersion.slice(0, 7)}</span>
              {currentBuiltAt && (
                <span className="text-gray-500"> · {formatBuildTime(currentBuiltAt)}</span>
              )}
            </>
          ) : (
            <span className="text-gray-500">{versionError ? 'unavailable (offline?)' : 'checking…'}</span>
          )}
        </p>
        {currentVersion && (
          updateAvailable ? (
            <p className="text-blue-300 text-xs flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              Update available — tap the banner at the top of the app to apply
            </p>
          ) : (
            <p className="text-green-400 text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Up to date
            </p>
          )
        )}
      </div>

      {/* Reset to Defaults */}
      <div className="pt-3 border-t border-gray-700">
        {showResetConfirm ? (
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-sm">Reset all settings?</span>
            <button
              onClick={handleResetSettings}
              className="px-4 min-h-[44px] bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
            >
              Confirm
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="px-4 min-h-[44px] bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={handleResetSettings}
            className="px-4 min-h-[44px] bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium"
          >
            Reset to Defaults
          </button>
        )}
      </div>

      {/* W4-A4-F12: Dev Tools collapsible sub-panel. Combines Hand Simulator
          (was unconditionally rendered until F12; now correctly dev-gated)
          and the Seed/Clear data buttons. Default collapsed; session-scoped
          state — collapse resets on reload. Production builds drop this
          entire block via tree-shaking under the import.meta.env.DEV gate. */}
      {import.meta.env.DEV && (
        <div className="pt-3 border-t border-gray-700">
          <button
            onClick={() => setDevToolsOpen((open) => !open)}
            className="w-full flex items-center justify-between text-sm font-bold text-yellow-400 mb-2 hover:text-yellow-300"
            aria-expanded={devToolsOpen}
          >
            <span>Dev Tools (Temporary)</span>
            {devToolsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {devToolsOpen && (
            <div className="space-y-3">
              {/* Hand Simulator */}
              <div>
                <h4 className="text-sm font-bold mb-2" style={{ color: GOLD.base }}>Hand Simulator</h4>
                <p className="text-gray-400 text-xs mb-2">
                  Simulate realistic hands with 6 archetype players. Range-based preflop, equity-driven postflop.
                </p>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-gray-300 text-xs">Hands:</label>
                  <input
                    type="number"
                    inputMode="numeric"
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

              {/* Seed / Clear data */}
              <div className="pt-3 border-t border-gray-700">
                <h4 className="text-xs font-bold text-gray-400 mb-2">Seed / Clear Data</h4>
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
            </div>
          )}
        </div>
      )}
    </div>
  );
};
