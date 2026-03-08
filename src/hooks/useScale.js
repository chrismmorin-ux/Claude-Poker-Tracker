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

      const scaleX = viewportWidth / designWidth;
      const scaleY = viewportHeight / designHeight;
      const newScale = Math.min(scaleX, scaleY, 1);

      setScale(newScale);
    };

    calculateScale();

    // Listen to both window resize and visualViewport resize
    window.addEventListener('resize', calculateScale);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', calculateScale);
    }

    return () => {
      window.removeEventListener('resize', calculateScale);
      if (vv) {
        vv.removeEventListener('resize', calculateScale);
      }
    };
  }, []);

  return scale;
};
