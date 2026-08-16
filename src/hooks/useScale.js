/**
 * useScale.js - Viewport scale calculation hook
 *
 * Calculates scale factor to fit the design dimensions (1600x720) within the
 * current viewport. Since WS-440 this is a thin wrapper over useCanvasFit,
 * which owns the measurement (visualViewport, orientationchange settling) and
 * the portrait auto-rotate fallback: in a portrait touch viewport the scale
 * returned here is the ROTATED fit (canvas 1600px axis along the viewport
 * height), matching the rotate(90deg) transform the canvas sites apply.
 */

import { useCanvasFit } from './useCanvasFit';

export const useScale = () => useCanvasFit().scale;
