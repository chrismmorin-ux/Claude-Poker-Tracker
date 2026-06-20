import React, { useEffect, useState } from 'react';
import { AlertTriangle, WifiOff } from 'lucide-react';
import { useSyncBridge, useUI } from '../../contexts';
import { SCREEN } from '../../constants/uiConstants';
import { getErrorCount } from '../../utils/errorLog';

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

export const HealthIndicator = () => {
  const { setCurrentScreen } = useUI();
  const { isExtensionConnected, syncError, versionMismatch, lastSyncTime } = useSyncBridge();
  const [errorCount, setErrorCount] = useState(() => getErrorCount());

  // errorLog is localStorage-backed (not reactive) — poll it modestly.
  useEffect(() => {
    const id = setInterval(() => setErrorCount(getErrorCount()), POLL_MS);
    return () => clearInterval(id);
  }, []);

  const syncFault = Boolean(syncError) || versionMismatch;
  const extOffline = !isExtensionConnected && lastSyncTime != null; // synced before, now offline
  const hasErrors = errorCount > 0;

  // Primary fault drives the label, color, and tap target.
  let fault = null;
  if (syncFault) {
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
      icon: <AlertTriangle size={16} />,
    };
  }

  if (!fault) return null; // healthy → silent

  const bg = fault.tone === 'red' ? '#b91c1c' : '#b45309'; // red-700 / amber-700

  return (
    <button
      type="button"
      onClick={() => setCurrentScreen(fault.target)}
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
