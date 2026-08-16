/**
 * useCanvasFit — how the fixed 1600×720 canvas fits the CURRENT viewport,
 * including the auto-rotate fallback for portrait viewports.
 *
 * WHY THIS EXISTS (WS-440, founder ruling 2026-08-13).
 * The app's landscape views live on a fixed 1600×720 canvas scaled to fit the
 * viewport. In a portrait viewport that used to mean one of two failures:
 *   - the canvas shrank to ~22% (unreadable), or
 *   - RotateDeviceHint covered the entire app with a "please rotate" wall —
 *     which also fired in tall desktop/browser windows (the Ignition
 *     side-by-side workflow), making the app unusable there.
 * The founder ruling: NOTHING may block the interface because of orientation.
 * The canvas fixes itself into landscape instead.
 *
 * THE FALLBACK: when the viewport is portrait on a touch device (primary
 * pointer is coarse), the canvas renders rotated 90° and is fitted against the
 * SWAPPED viewport dimensions — full-size landscape content on a portrait
 * viewport; the user simply holds the phone sideways. This covers the two
 * real portrait-viewport-on-phone cases: a plain browser tab (where
 * screen.orientation.lock() silently no-ops — it needs an installed PWA) and
 * an OS-level rotation lock. In the installed PWA the per-view orientation
 * lock still wins and this fallback never engages.
 *
 * Desktop / fine-pointer viewports never rotate: a tall narrow window (e.g.
 * next to the Ignition client) gets the plain scale-to-fit canvas, which is
 * usable with a mouse and respects the user's chosen window shape.
 *
 * Measurement notes (ported from the recovered WS-315 fix, commit 954972df):
 *   - visualViewport preferred over innerWidth/innerHeight (stable under
 *     mobile browser chrome).
 *   - `orientationchange` fires BEFORE dimensions settle on Android Chrome
 *     and does not always produce a matching `resize`; a synchronous read
 *     there sees the PRE-rotation size. Re-measure on rAF + 50ms + 300ms.
 */

import { useState, useEffect } from 'react';
import { LAYOUT } from '../constants/gameConstants';

// Settling delays for the post-`orientationchange` re-measure, in ms.
const SETTLE_DELAYS_MS = [50, 300];

const isCoarsePointer = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches;

/** Pure measurement — exported for tests and for one-shot (non-hook) reads. */
export const measureCanvasFit = () => {
  if (typeof window === 'undefined') return { scale: 1, rotated: false };
  const vv = window.visualViewport;
  const viewportWidth = vv ? vv.width : window.innerWidth;
  const viewportHeight = vv ? vv.height : window.innerHeight;
  if (!viewportWidth || !viewportHeight) return { scale: 1, rotated: false };

  const rotated = viewportHeight > viewportWidth && isCoarsePointer();
  // When rotated, the canvas's 1600px axis lies along the viewport's HEIGHT.
  const fitWidth = rotated ? viewportHeight : viewportWidth;
  const fitHeight = rotated ? viewportWidth : viewportHeight;

  // 0.95 leaves a 5% margin so scaled views don't touch the viewport edges
  // / collapsing browser chrome (matches the documented formula in CLAUDE.md).
  const scaleX = (fitWidth * 0.95) / LAYOUT.TABLE_WIDTH;
  const scaleY = (fitHeight * 0.95) / LAYOUT.TABLE_HEIGHT;
  return { scale: Math.min(scaleX, scaleY, 1), rotated };
};

/**
 * The transform every canvas site applies. Rotation and scale are one
 * transform so the canvas needs no layout changes — hit testing, centering,
 * and internal scroll regions all map through it.
 */
export const canvasTransform = (scale, rotated) =>
  rotated ? `rotate(90deg) scale(${scale})` : `scale(${scale})`;

export const useCanvasFit = () => {
  const [fit, setFit] = useState(measureCanvasFit);

  useEffect(() => {
    const remeasure = () => {
      const next = measureCanvasFit();
      // Functional update so unchanged measurements don't re-render.
      setFit((prev) =>
        prev.scale === next.scale && prev.rotated === next.rotated ? prev : next
      );
    };

    remeasure();

    const timers = [];
    const handleOrientationChange = () => {
      // Do not trust the synchronous read — see the header note.
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(remeasure);
      }
      for (const delay of SETTLE_DELAYS_MS) {
        timers.push(setTimeout(remeasure, delay));
      }
    };

    window.addEventListener('resize', remeasure);
    window.addEventListener('orientationchange', handleOrientationChange);
    const vv = window.visualViewport;
    if (vv) vv.addEventListener('resize', remeasure);

    return () => {
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (vv) vv.removeEventListener('resize', remeasure);
      for (const t of timers) clearTimeout(t);
    };
  }, []);

  return fit;
};

export default useCanvasFit;
