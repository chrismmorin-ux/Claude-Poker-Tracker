/**
 * RefresherSettings.jsx — Settings section for the Printable Refresher.
 *
 * Currently exposes the AP-PRF-08 opt-in toggle (`notifications.staleness`).
 * When enabled, the StalenessBanner surfaces in the Printable Refresher
 * catalog whenever a printed batch has cards with diverging contentHash
 * from the current registry (per surface spec §Behavior #9).
 *
 * Default OFF per AP-PRF-08 (no engagement-pressure notifications). Owner
 * opt-in is the only path to surface staleness — never push / email / badge.
 *
 * Persists to `userRefresherConfig.notifications.staleness` via the W-URC-1
 * writer (no debounce — settings toggles are owner-deliberate, single-click,
 * not rapid).
 *
 * Future toggles (S25+): `printPreferences.includeLineage` (also editable
 * inline in PrintControls), batch-export defaults, etc.
 *
 * PRF Phase 5 — Session 24 (PRF-G5-UI).
 */

import React, { useCallback, useState } from 'react';
import { useRefresher } from '../../../contexts';
import { GOLD } from '../../../constants/designTokens';

export const RefresherSettings = () => {
  const refresher = useRefresher();
  const [errorMessage, setErrorMessage] = useState(null);
  const [pending, setPending] = useState(false);

  const stalenessOn = refresher.config?.notifications?.staleness === true;

  const handleToggle = useCallback(
    async (next) => {
      if (pending) return;
      setPending(true);
      setErrorMessage(null);
      try {
        await refresher.patchConfig({
          notifications: { staleness: next },
        });
      } catch (err) {
        setErrorMessage(err && err.message ? err.message : 'Failed to update setting.');
      } finally {
        setPending(false);
      }
    },
    [pending, refresher],
  );

  return (
    <div className="bg-gray-800 rounded-lg p-5" data-testid="refresher-settings-section">
      <h3 className="text-lg font-bold mb-4" style={{ color: GOLD }}>
        Printable Refresher
      </h3>

      {/* Staleness banner toggle */}
      <div>
        <label className="block text-gray-300 text-sm font-medium mb-1">
          Show staleness banner
        </label>
        <p className="text-gray-500 text-xs mb-3">
          Surface a banner in the Printable Refresher when printed cards have changed
          since you last printed them. Default is off.
        </p>
        <div className="flex gap-2" role="group" aria-label="Staleness banner toggle">
          <button
            type="button"
            onClick={() => handleToggle(false)}
            disabled={pending}
            aria-pressed={!stalenessOn}
            data-staleness-on="false"
            className={`px-4 min-h-[44px] rounded-lg font-medium text-sm transition-colors ${
              !stalenessOn
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            } ${pending ? 'opacity-60 cursor-wait' : ''}`}
          >
            Off
          </button>
          <button
            type="button"
            onClick={() => handleToggle(true)}
            disabled={pending}
            aria-pressed={stalenessOn}
            data-staleness-on="true"
            className={`px-4 min-h-[44px] rounded-lg font-medium text-sm transition-colors ${
              stalenessOn
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            } ${pending ? 'opacity-60 cursor-wait' : ''}`}
          >
            On
          </button>
        </div>
        {errorMessage && (
          <p
            role="alert"
            className="text-red-300 bg-red-900 border border-red-700 rounded px-3 py-2 text-sm mt-3"
          >
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
};

export default RefresherSettings;
