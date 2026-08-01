import { useState, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { useUI } from '../../contexts';
import { VIEW_TO_ORIENTATION } from '../../constants/viewRegistry';
import { useIsPortraitViewport } from '../../hooks/useIsPortraitViewport';

/**
 * RotateDeviceHint — fallback for when the screen-orientation lock can't fire.
 *
 * Landscape (ScaledContainer) views depend on `screen.orientation.lock('landscape')`,
 * which only works in an installed (standalone) PWA — in a plain browser tab it
 * silently no-ops, leaving the 1600×720 canvas scaled small in portrait with no
 * explanation. This overlay shows ONLY when the active view is landscape AND the
 * viewport is portrait. Portrait-native views render nothing (they're correct in
 * portrait).
 *
 * WS-315 — THIS IS A HINT, NOT A GATE. It used to be an undismissable full-screen
 * block, which meant the population that had not installed the PWA (i.e. every
 * first-time entry) could not get into the app at all. Founder, 2026-07-31: "the
 * user needs to enter the system and not worry about this." Two changes follow:
 *
 *   1. There is a way through. A landscape canvas in a portrait viewport is
 *      DEGRADED, not broken — degraded-but-usable beats blocked. Dismissal is
 *      remembered for the browser session so it does not re-nag on every view
 *      change.
 *   2. Orientation is MEASURED and re-measured on `orientationchange`, rather
 *      than inferred from a CSS media variant that may be evaluated against a
 *      stale layout (see `useIsPortraitViewport`).
 *
 * The copy no longer asserts that rotating will work. If the device has
 * auto-rotate switched off, "turn your phone sideways" does nothing — that is one
 * of the live candidates for the founder's report, and instructing a user to
 * perform an action that cannot succeed is worse than saying nothing.
 *
 * NOTE: the underlying question — what the Table View actually DOES in portrait
 * (a real portrait layout, a deliberate degraded view, or a documented
 * unsupported state) — is WS-315 Phase 3 and belongs to the Table View Redesign.
 * This is the unblock, not the answer.
 */

export const DISMISS_STORAGE_KEY = 'pokerTracker.rotateHintDismissed';

const readDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISS_STORAGE_KEY) === '1';
  } catch {
    // Private mode / storage disabled — fall back to in-memory only.
    return false;
  }
};

const persistDismissed = () => {
  try {
    sessionStorage.setItem(DISMISS_STORAGE_KEY, '1');
  } catch {
    // Non-fatal: in-memory state still dismisses for this mount.
  }
};

export const RotateDeviceHint = () => {
  const { currentView } = useUI();
  const isPortraitViewport = useIsPortraitViewport();
  const [dismissed, setDismissed] = useState(readDismissed);

  const handleDismiss = useCallback(() => {
    persistDismissed();
    setDismissed(true);
  }, []);

  const isPortraitView = (VIEW_TO_ORIENTATION[currentView] ?? 'landscape') === 'portrait';
  if (isPortraitView) return null;
  if (!isPortraitViewport) return null;
  if (dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-gray-900 flex flex-col items-center justify-center text-center gap-4 p-8"
      role="dialog"
      aria-labelledby="rotate-hint-title"
    >
      <RotateCcw className="w-14 h-14 text-blue-400" aria-hidden />
      <p id="rotate-hint-title" className="text-white text-lg font-semibold">
        This screen is built for landscape
      </p>
      <p className="text-gray-400 text-sm max-w-xs">
        Turn your phone sideways if auto-rotate is on. If it&apos;s off, or nothing
        happens, you can carry on anyway — the screen will just be smaller.
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        className="mt-2 min-h-[44px] min-w-[44px] px-6 py-3 rounded-lg bg-blue-600 text-white text-base font-semibold active:bg-blue-700"
      >
        Continue anyway
      </button>
      <p className="text-gray-500 text-xs max-w-xs">
        Installing the app keeps it in the right orientation automatically.
      </p>
    </div>
  );
};

export default RotateDeviceHint;
