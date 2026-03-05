/**
 * useScale.js - Viewport scale calculation hook
 *
 * Calculates scale factor to fit the design dimensions (1600x720)
 * within the current viewport with 95% padding.
 */

import { useState, useEffect } from 'react';
import { LAYOUT } from '../constants/gameConstants';

export const useScale = () => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const calculateScale = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const designWidth = LAYOUT.TABLE_WIDTH;
      const designHeight = LAYOUT.TABLE_HEIGHT;

      const scaleX = (viewportWidth * 0.95) / designWidth;
      const scaleY = (viewportHeight * 0.95) / designHeight;
      const newScale = Math.min(scaleX, scaleY, 1);

      setScale(newScale);
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, []);

  return scale;
};
