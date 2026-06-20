import { RotateCcw } from 'lucide-react';
import { useUI } from '../../contexts';
import { VIEW_TO_ORIENTATION } from '../../constants/viewRegistry';

/**
 * RotateDeviceHint — fallback for when the screen-orientation lock can't fire.
 *
 * Landscape (ScaledContainer) views depend on `screen.orientation.lock('landscape')`,
 * which only works in an installed (standalone) PWA — in a plain browser tab it
 * silently no-ops, leaving the 1600×720 canvas scaled to ~22% in portrait with no
 * explanation. This overlay shows ONLY when (a) the active view is landscape AND
 * (b) the device is physically portrait (Tailwind `portrait:` media variant), telling
 * the user to rotate. Portrait-native views render nothing (they're correct in portrait).
 *
 * Installed-PWA users never see it (the lock keeps them landscape). See
 * docs/design/audits/2026-06-19-responsive-layout-audit.md (Cross-Cutting #1).
 */
export const RotateDeviceHint = () => {
  const { currentView } = useUI();
  const isPortraitView = (VIEW_TO_ORIENTATION[currentView] ?? 'landscape') === 'portrait';
  if (isPortraitView) return null;

  return (
    <div className="hidden portrait:flex fixed inset-0 z-[200] bg-gray-900 flex-col items-center justify-center text-center gap-4 p-8">
      <RotateCcw className="w-14 h-14 text-blue-400" aria-hidden />
      <p className="text-white text-lg font-semibold">Please rotate to landscape</p>
      <p className="text-gray-400 text-sm max-w-xs">
        This screen is built for landscape — turn your phone sideways. (Installing the app
        keeps it in the right orientation automatically.)
      </p>
    </div>
  );
};

export default RotateDeviceHint;
