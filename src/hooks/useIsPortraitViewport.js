/**
 * useIsPortraitViewport — is the viewport currently taller than it is wide?
 *
 * Why this exists instead of Tailwind's `portrait:` variant (WS-315).
 *
 * The rotate gate used to be pure CSS (`hidden portrait:flex`). That media
 * variant is evaluated against the DEVICE orientation, and it was verified to
 * work correctly under a plain viewport change — so the media query was never
 * the bug. What it cannot do is re-evaluate on `orientationchange` when the
 * browser reports a rotation WITHOUT a matching resize, which is the remaining
 * device-specific candidate for the founder's "I have to reload in landscape"
 * report.
 *
 * So this measures the viewport directly and subscribes to all three signals:
 * `resize`, `visualViewport.resize`, and `orientationchange`.
 *
 * The `orientationchange` case needs care: on Android Chrome the event fires
 * BEFORE `innerWidth`/`innerHeight` have settled to their post-rotation values.
 * Measuring synchronously in that handler reads the OLD dimensions and would
 * conclude the device is still portrait. We therefore re-measure on the next
 * frame and again shortly after, rather than trusting the first read.
 */

import { useState, useEffect, useCallback } from 'react';

export const measureIsPortrait = () => {
  if (typeof window === 'undefined') return false;
  const vv = window.visualViewport;
  const width = vv ? vv.width : window.innerWidth;
  const height = vv ? vv.height : window.innerHeight;
  if (!width || !height) return false;
  return height > width;
};

// Settling delays for the post-`orientationchange` re-measure, in ms. The frame
// callback covers the common case; the later read covers engines that resize
// after an animation. Cheap — this is two boolean comparisons.
const SETTLE_DELAYS_MS = [50, 300];

export const useIsPortraitViewport = () => {
  const [isPortrait, setIsPortrait] = useState(measureIsPortrait);

  const remeasure = useCallback(() => {
    setIsPortrait(measureIsPortrait());
  }, []);

  useEffect(() => {
    remeasure();

    const timers = [];
    const handleOrientationChange = () => {
      // Do not trust the synchronous read — see the note above.
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
  }, [remeasure]);

  return isPortrait;
};

export default useIsPortraitViewport;
