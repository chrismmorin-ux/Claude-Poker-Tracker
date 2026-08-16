/**
 * useRotatedTouchScroll — touch-scroll bridge for the rotated canvas (WS-440).
 *
 * WHY THIS EXISTS (measured 2026-08-13, CDP Input.synthesizeScrollGesture on
 * a rotate(90deg) fixture): Chromium maps touch panning in SCREEN space, not
 * through CSS transforms. Inside the rotated canvas, an `overflow-y-auto`
 * scroller therefore responds to gestures along the viewport's long axis —
 * which, once the user has physically turned the phone, is their visual
 * HORIZONTAL. The natural vertical swipe does nothing. Without this bridge the
 * auto-rotate fallback would trade "blocked" for "unscrollable".
 *
 * WHAT IT DOES: while a rotated canvas is on screen, touches that start inside
 * an element marked `data-canvas-rotated="true"` are taken over: the gesture
 * delta is remapped through the rotation and applied to the nearest scrollable
 * ancestor of the touch target, with momentum on release.
 *
 * AXIS MAP (canvas is rotate(90deg), so the user turns the phone
 * counter-clockwise to read it — content-up lies along screen +X):
 *   - finger along screen X (user-visual vertical)  → scrollTop += ΔX
 *   - finger along screen Y (user-visual horizontal) → scrollLeft -= ΔY
 * These reproduce native "content tracks the finger" in the user's frame.
 *
 * Non-rotated mode attaches nothing. Portrait-native (FluidView) surfaces are
 * never marked, so their native scrolling is untouched.
 */

import { useEffect } from 'react';
import { useCanvasFit } from './useCanvasFit';

const MOVE_THRESHOLD_PX = 6; // don't hijack taps
const FLING_DECAY_PER_FRAME = 0.95;
const FLING_STOP_SPEED = 0.5; // px/frame

const isScrollable = (el, axis) => {
  const style = getComputedStyle(el);
  const overflow = axis === 'y' ? style.overflowY : style.overflowX;
  if (overflow !== 'auto' && overflow !== 'scroll') return false;
  return axis === 'y'
    ? el.scrollHeight > el.clientHeight
    : el.scrollWidth > el.clientWidth;
};

/** Nearest ancestor (inclusive) scrollable on either axis, inside the canvas. */
const findScroller = (start) => {
  for (let el = start; el && el instanceof Element; el = el.parentElement) {
    if (isScrollable(el, 'y') || isScrollable(el, 'x')) return el;
    if (el.dataset && el.dataset.canvasRotated === 'true') return null;
  }
  return null;
};

export const useRotatedTouchScroll = () => {
  const { rotated } = useCanvasFit();

  useEffect(() => {
    if (!rotated) return undefined;

    let scroller = null;
    let tracking = false;
    let engaged = false; // past the tap threshold
    let lastX = 0;
    let lastY = 0;
    let velocityTop = 0; // px/frame along scrollTop
    let velocityLeft = 0;
    let flingFrame = 0;

    const stopFling = () => {
      if (flingFrame) cancelAnimationFrame(flingFrame);
      flingFrame = 0;
    };

    const onTouchStart = (e) => {
      stopFling();
      const target = e.target instanceof Element ? e.target : null;
      if (!target || !target.closest('[data-canvas-rotated="true"]')) {
        tracking = false;
        return;
      }
      scroller = findScroller(target);
      tracking = scroller !== null;
      engaged = false;
      const t = e.touches[0];
      lastX = t.clientX;
      lastY = t.clientY;
      velocityTop = 0;
      velocityLeft = 0;
    };

    const onTouchMove = (e) => {
      if (!tracking || !scroller) return;
      const t = e.touches[0];
      const dx = t.clientX - lastX;
      const dy = t.clientY - lastY;
      if (!engaged && Math.hypot(dx, dy) < MOVE_THRESHOLD_PX) return;
      engaged = true;
      // Native screen-space panning is the wrong axis here — suppress it.
      e.preventDefault();
      lastX = t.clientX;
      lastY = t.clientY;
      const dTop = dx; // finger visually up (screen +X) reveals content below
      const dLeft = -dy; // finger visually left (screen -Y... mapped) reveals content right
      scroller.scrollTop += dTop;
      scroller.scrollLeft += dLeft;
      velocityTop = dTop;
      velocityLeft = dLeft;
    };

    const onTouchEnd = () => {
      if (!tracking || !engaged || !scroller) {
        tracking = false;
        return;
      }
      tracking = false;
      const el = scroller;
      const step = () => {
        velocityTop *= FLING_DECAY_PER_FRAME;
        velocityLeft *= FLING_DECAY_PER_FRAME;
        if (
          Math.abs(velocityTop) < FLING_STOP_SPEED &&
          Math.abs(velocityLeft) < FLING_STOP_SPEED
        ) {
          flingFrame = 0;
          return;
        }
        el.scrollTop += velocityTop;
        el.scrollLeft += velocityLeft;
        flingFrame = requestAnimationFrame(step);
      };
      flingFrame = requestAnimationFrame(step);
    };

    // Capture phase so the bridge sees the gesture before any inner handler;
    // touchmove must be non-passive to be able to preventDefault native panning.
    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    document.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: true });

    return () => {
      stopFling();
      document.removeEventListener('touchstart', onTouchStart, { capture: true });
      document.removeEventListener('touchmove', onTouchMove, { capture: true });
      document.removeEventListener('touchend', onTouchEnd, { capture: true });
      document.removeEventListener('touchcancel', onTouchEnd, { capture: true });
    };
  }, [rotated]);
};

export default useRotatedTouchScroll;
