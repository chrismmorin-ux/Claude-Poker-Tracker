import React, { useEffect, useState } from 'react';
import { AlertTriangle, WifiOff, Database } from 'lucide-react';
import { useSyncBridge, useUI } from '../../contexts';
import { SCREEN } from '../../constants/uiConstants';
import { getErrorCountForBuild } from '../../utils/errorLog';
import { getPersistenceFailureCount } from '../../utils/persistenceHealth';

/**
 * HealthIndicator — operator health signal, mounted at app-root so it is visible
 * on EVERY view (design-audit Operator surface was L1: founder was blind to
 * extension/sync/error problems until digging two levels deep — an Ignition HUD
 * outage once went undetected for months). Plan shimmying-moseying-lantern, Phase C.
 *
 * Silent-until-broken: renders NOTHING when healthy (no clutter on the dense
 * table surface), and only appears as a tappable pill on a genuinely actionable
 * fault. "Extension offline" is only a fault if the extension has synced before
 * (`lastSyncTime` set) — so a live-only player who never uses the extension sees
 * nothing, avoiding the false-alarm noise the cross-critic flagged.
 */

const POLL_MS = 60000;
// Persistence init resolves within a second or two of boot; check once shortly
// after mount rather than making the founder wait a whole poll cycle.
const FIRST_CHECK_MS = 3000;

export const HealthIndicator = () => {
  const { setCurrentScreen, openSettings } = useUI();
  const { isExtensionConnected, syncError, versionMismatch, lastSyncTime } = useSyncBridge();
  // Errors from THIS build only. Counting the whole log meant one crash pinned
  // a red alert on screen forever — a day-old failure from a build that is no
  // longer running is history, not a fault. Full history still lives in
  // Settings → Error Log.
  const [errorCount, setErrorCount] = useState(() => getErrorCountForBuild());
  const [saveFailures, setSaveFailures] = useState(() => getPersistenceFailureCount());

  // Neither source is reactive (localStorage / module state) — poll modestly.
  useEffect(() => {
    const id = setInterval(() => {
      setErrorCount(getErrorCountForBuild());
      setSaveFailures(getPersistenceFailureCount());
    }, POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Persistence init runs during the first render pass, so a failure can land
  // after this component mounted. One short re-read catches it without waiting
  // out a full poll interval — the whole point is that the founder finds out
  // BEFORE recording a session, not a minute into one.
  useEffect(() => {
    const id = setTimeout(() => setSaveFailures(getPersistenceFailureCount()), FIRST_CHECK_MS);
    return () => clearTimeout(id);
  }, []);

  const syncFault = Boolean(syncError) || versionMismatch;
  const extOffline = !isExtensionConnected && lastSyncTime != null; // synced before, now offline
  const hasErrors = errorCount > 0;

  // Primary fault drives the label, color, and tap target.
  //
  // Save failure outranks everything else. A sync problem costs you imported
  // hands you can re-import; not saving costs you the session you are playing
  // right now, and you would not find out until it was gone.
  let fault = null;
  if (saveFailures > 0) {
    fault = {
      label: 'Not saving — data at risk',
      tone: 'red',
      target: SCREEN.SETTINGS,
      settingsFocus: 'errorLog',
      icon: <Database size={16} />,
    };
  } else if (syncFault) {
    fault = {
      label: versionMismatch ? 'Extension version mismatch' : 'Sync problem',
      tone: 'red',
      target: SCREEN.ONLINE,
      icon: <AlertTriangle size={16} />,
    };
  } else if (extOffline) {
    fault = { label: 'Extension offline', tone: 'amber', target: SCREEN.ONLINE, icon: <WifiOff size={16} /> };
  } else if (hasErrors) {
    fault = {
      label: `${errorCount} error${errorCount > 1 ? 's' : ''} logged`,
      tone: 'red',
      target: SCREEN.SETTINGS,
      // Settings alone isn't the destination — the Error Log is the 11th panel
      // down a single long scroll, and collapsed. Landing at the top of Settings
      // is indistinguishable from not having navigated anywhere useful.
      settingsFocus: 'errorLog',
      icon: <AlertTriangle size={16} />,
    };
  }

  if (!fault) return null; // healthy → silent

  const bg = fault.tone === 'red' ? '#b91c1c' : '#b45309'; // red-700 / amber-700

  return (
    <button
      type="button"
      onClick={() => {
        if (fault.settingsFocus) openSettings(fault.settingsFocus);
        else setCurrentScreen(fault.target);
      }}
      className="fixed bottom-3 right-3 z-[60] flex items-center gap-2 px-3 py-2 rounded-full text-white text-sm font-semibold shadow-lg focus:outline-none focus:ring-2 focus:ring-white/60"
      style={{ backgroundColor: bg }}
      title={`${fault.label} — tap to view`}
      data-testid="health-indicator"
    >
      {fault.icon}
      <span>{fault.label}</span>
    </button>
  );
};

export default HealthIndicator;
