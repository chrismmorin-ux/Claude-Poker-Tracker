import React from 'react';

/**
 * ColorChip — chip with a prominent color swatch + readable color name.
 *
 * Per feedback_color_independent_of_ethnicity.md: every distinguishing-feature
 * color picker (skin / hair / beard / future eye) must show (a) a swatch
 * ≥16px diameter and (b) a text label naming the color, on a light surface.
 *
 * Intentionally LARGER than the generic editor chip — color is hard to read
 * on a phone if the swatch is tiny, and that was the regression the owner
 * flagged ("trapped in a small space within a black box").
 */
export const ColorChip = ({
  active,
  label,
  hex,
  onClick,
  testId,
  disabled = false,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full text-xs transition-colors border ${
      active
        ? 'bg-cyan-700 text-white border-cyan-400 shadow-sm'
        : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    data-testid={testId}
    aria-pressed={active}
  >
    <span
      className="rounded-full inline-block shrink-0"
      style={{
        background: hex,
        width: 22,
        height: 22,
        boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.85), 0 0 0 1px rgba(0,0,0,0.25)',
      }}
      aria-hidden="true"
    />
    <span className="whitespace-nowrap">{label}</span>
  </button>
);

export default ColorChip;
