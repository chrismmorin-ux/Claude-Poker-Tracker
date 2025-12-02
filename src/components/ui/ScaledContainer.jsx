import React from 'react';

/**
 * ScaledContainer - Responsive wrapper that scales content to fit viewport
 * Used by all view components to maintain consistent sizing across devices
 */
export const ScaledContainer = ({ scale, children }) => (
  <div className="flex items-center justify-center min-h-screen bg-gray-800 overflow-hidden">
    <div
      style={{
        width: '1600px',
        height: '720px',
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
      }}
    >
      {children}
    </div>
  </div>
);
