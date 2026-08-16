import React, { useContext } from 'react';
import { UIContext } from '../../contexts/UIContext';
import { VIEW_TO_ORIENTATION } from '../../constants/viewRegistry';
import { useCanvasFit } from '../../hooks/useCanvasFit';

/**
 * RotatedViewport — rotates app CHROME with the canvas (WS-440, founder ruling
 * 2026-08-13: "It needs to function properly ALWAYS" — no sideways chrome).
 *
 * The auto-rotate fallback rotates each 1600×720 canvas, but chrome (NavShell,
 * HealthIndicator, UpdateBanner, toasts, voice overlay, loading screens) is
 * position:fixed OUTSIDE the canvas, so it stayed screen-upright — reading
 * sideways once the phone is physically turned. This wrapper gives chrome the
 * same rotation: when active, it renders a full-screen rotated "virtual
 * landscape viewport" (width 100dvh × height 100dvw, rotate 90°) and puts the
 * chrome inside it. Because a CSS transform makes the wrapper the containing
 * block for fixed descendants, the chrome's own `fixed top-3 left-3` etc.
 * re-anchor to the virtual viewport — i.e. to the user's visual frame — with
 * no changes to the chrome's positioning classes.
 *
 * WHEN it rotates — BOTH must hold:
 *   1. the canvas fallback is active (portrait viewport + coarse pointer), AND
 *   2. the ACTIVE VIEW is landscape-classified (or Showdown is open).
 * Portrait-native views (Sessions, Players, Settings…) render portrait-correct
 * content in a portrait viewport, so chrome must NOT rotate there — rule 2 is
 * what keeps a toast on the Sessions screen upright.
 *
 * UIContext is read tolerantly: chrome rendered outside a UIProvider (unit
 * tests) degrades to unrotated instead of throwing.
 *
 * Pointer events: the wrapper is a full-screen fixed layer, so it MUST be
 * pointer-events-none or it would swallow every tap meant for the canvas
 * below. pointer-events is inherited, so each interactive chrome root carries
 * an explicit `pointer-events-auto` (harmless when unrotated).
 *
 * Stacking: a transformed wrapper is its own stacking context, so each chrome
 * piece is wrapped INDIVIDUALLY and the wrapper carries that piece's z-index
 * (`zClassName`), preserving the existing chrome/modal ordering exactly.
 */

export const useChromeRotated = () => {
  const { rotated } = useCanvasFit();
  const ui = useContext(UIContext);
  if (!rotated || !ui) return false;
  if (ui.isShowdownViewOpen) return true;
  return (VIEW_TO_ORIENTATION[ui.currentView] ?? 'landscape') === 'landscape';
};

export const RotatedViewport = ({ zClassName = '', children }) => {
  const chromeRotated = useChromeRotated();
  if (!chromeRotated) return <>{children}</>;
  return (
    <div
      className={`fixed inset-0 pointer-events-none flex items-center justify-center ${zClassName}`}
      data-testid="rotated-viewport"
    >
      <div
        className="relative pointer-events-none"
        style={{
          width: '100dvh',
          height: '100dvw',
          transform: 'rotate(90deg)',
          transformOrigin: 'center center',
          // flexShrink 0 is load-bearing: as a flex child of the portrait
          // wrapper this box would otherwise shrink from 100dvh to the
          // viewport width, mis-anchoring every fixed chrome element inside
          // (same trap ScaledContainer and HandReplayView document).
          flexShrink: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default RotatedViewport;
