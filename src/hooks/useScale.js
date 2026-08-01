/**
 * useScale.js - Viewport scale calculation hook
 *
 * Calculates scale factor to fit the design dimensions (1600x720)
 * within the current viewport. Uses visualViewport API on mobile
 * for stable dimensions that account for browser chrome (URL bars).
 */

import { useState, useEffect } from 'react';
import { LAYOUT } from '../constants/gameConstants';

export const useScale = () => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const calculateScale = () => {
      // Prefer visualViewport (stable on mobile, ignores URL bar changes)
      const vv = window.visualViewport;
      const viewportWidth = vv ? vv.width : window.innerWidth;
      const viewportHeight = vv ? vv.height : window.innerHeight;
      const designWidth = LAYOUT.TABLE_WIDTH;
      const designHeight = LAYOUT.TABLE_HEIGHT;

      // 0.95 leaves a 5% margin so scaled views don't touch the viewport edges
      // / collapsing browser chrome (matches the documented formula in CLAUDE.md).
      const scaleX = (viewportWidth * 0.95) / designWidth;
      const scaleY = (viewportHeight * 0.95) / designHeight;
      const newScale = Math.min(scaleX, scaleY, 1);

      setScale(newScale);
    };

    calculateScale();

    // WS-315: `orientationchange` fires BEFORE the viewport dimensions settle on
    // Android Chrome, and does not always produce a matching `resize`. Measuring
    // synchronously there reads the PRE-rotation size and locks in the wrong
    // scale — the gate clears but the canvas stays sized for the old
    // orientation, which looks like "the app didn't recover from rotating".
    // Re-measure on the next frame and again after the rotation animation.
    const timers = [];
    const handleOrientationChange = () => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(calculateScale);
      }
      timers.push(setTimeout(calculateScale, 50));
      timers.push(setTimeout(calculateScale, 300));
    };

    // Listen to window resize, visualViewport resize, and orientation change
    window.addEventListener('resize', calculateScale);
    window.addEventListener('orientationchange', handleOrientationChange);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', calculateScale);
    }

    return () => {
      window.removeEventListener('resize', calculateScale);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (vv) {
        vv.removeEventListener('resize', calculateScale);
      }
      for (const t of timers) clearTimeout(t);
    };
  }, []);

  return scale;
};
