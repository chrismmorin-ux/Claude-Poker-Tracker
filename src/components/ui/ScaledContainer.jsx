import React from 'react';
import { LAYOUT } from '../../constants/gameConstants';
import { useCanvasFit, canvasTransform } from '../../hooks/useCanvasFit';

/**
 * ScaledContainer - Responsive wrapper that scales content to fit viewport
 * Used by all view components to maintain consistent sizing across devices.
 *
 * In a portrait touch viewport the canvas auto-rotates into landscape
 * (WS-440): rotation and scale are one transform, so the content stays
 * full-size and fully interactive — never blocked, never letterboxed to ~22%.
 */
export const ScaledContainer = ({ scale, children }) => {
  const { rotated } = useCanvasFit();
  return (
    <div className="flex items-center justify-center h-dvh bg-gray-800 overflow-hidden">
      <div
        data-canvas-rotated={rotated ? 'true' : undefined}
        style={{
          width: `${LAYOUT.TABLE_WIDTH}px`,
          height: `${LAYOUT.TABLE_HEIGHT}px`,
          transform: canvasTransform(scale, rotated),
          transformOrigin: 'center center',
          // Prevent the fixed-size canvas from collapsing if a flex parent constrains
          // it (HandReplayView added this locally; fold it into the shared component).
          flexShrink: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
};
