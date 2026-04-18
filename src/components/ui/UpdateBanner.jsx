import React, { useState, useCallback, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useBuildVersion } from '../../hooks/useBuildVersion';

const DISMISS_KEY = 'updateBannerDismissedUntil';
const DISMISS_DURATION_MS = 30 * 60 * 1000;

const readDismissedUntil = () => {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

export const UpdateBanner = () => {
  const { updateAvailable, latestVersion } = useBuildVersion();
  const [dismissedUntil, setDismissedUntil] = useState(() => readDismissedUntil());
  const [now, setNow] = useState(() => Date.now());

  // Re-evaluate visibility every 30s so the banner reappears after the cooldown
  // without needing a user interaction.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const handleUpdate = useCallback(() => {
    window.location.reload();
  }, []);

  const handleDismiss = useCallback(() => {
    const until = Date.now() + DISMISS_DURATION_MS;
    try {
      sessionStorage.setItem(DISMISS_KEY, String(until));
    } catch {
      /* sessionStorage unavailable — dismissal stays in-memory this render */
    }
    setDismissedUntil(until);
  }, []);

  if (!updateAvailable) return null;
  if (now < dismissedUntil) return null;

  const shortSha = latestVersion ? latestVersion.slice(0, 7) : '';

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 bg-blue-900/90 backdrop-blur-sm border-b border-blue-700 shadow-lg"
    >
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <RefreshCw className="w-5 h-5 text-blue-200 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-blue-50">
            <span className="font-semibold">A new version is ready.</span>
            {shortSha && (
              <span className="ml-2 text-xs text-blue-300 font-mono">
                {shortSha}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleUpdate}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors whitespace-nowrap"
        >
          Update now
        </button>
        <button
          onClick={handleDismiss}
          className="text-blue-300 hover:text-blue-100 transition-colors flex-shrink-0"
          aria-label="Dismiss update banner"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
