/**
 * @file Chip — single chip primitive with size + shape + swatch variants.
 *
 * Extracted from `PrototypeFinderView.jsx` as part of the unified
 * PlayerFinder migration (Phase A foundation). Used by PlayerFinderView,
 * QuickFilterChips analog, and any other surface that needs a chip-style
 * selection control.
 *
 * Active state — single brand action color amber-500 with dark text +
 * semibold + small shadow. Inactive — slate-800 with gray-200 text + slate-600
 * border + hover-only border lift to slate-500. ≥44px tap target on the
 * default size; ≥36px on the compact 'sm' size (used inside dense decision
 * panels where width is the dominant axis).
 *
 * Props:
 *   - active     : Bool. Controls the visual state.
 *   - label      : String. Body text. Always Title Case for human labels.
 *   - swatch     : String|null. Hex color. When present, renders a 20px
 *                  color disc inside the chip with an inset white ring +
 *                  dark outline so dark colors stay visible.
 *   - onClick    : Function. Tap handler.
 *   - size       : 'md' (default, 44px tap) | 'sm' (compact, 36px).
 *   - shape      : 'pill' (default, rounded-full) | 'square' (rounded-md,
 *                  reads as a decision pill rather than a selection chip).
 *   - testId     : Optional data-testid for test selection.
 */

import React from 'react';

export const Chip = ({
  active,
  label,
  swatch = null,
  onClick,
  size = 'md',
  shape = 'pill',
  testId,
}) => {
  const sizing = size === 'sm'
    ? 'min-h-[36px] px-3 py-1.5 text-[11px]'
    : 'min-h-[44px] px-3 py-2 text-xs';
  const radius = shape === 'square' ? 'rounded-md' : 'rounded-full';
  const state = active
    ? 'bg-amber-500 text-gray-900 border-amber-500 font-semibold shadow-sm'
    : 'bg-slate-800 text-gray-200 border-slate-600 hover:bg-slate-700 hover:border-slate-500';
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-pressed={active}
      className={`inline-flex items-center justify-center gap-1.5 ${radius} ${sizing} border transition-colors ${state}`}
    >
      {swatch ? (
        <span
          aria-hidden="true"
          className="rounded-full inline-block shrink-0"
          style={{
            background: swatch,
            width: 20,
            height: 20,
            boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.85), 0 0 0 1px rgba(0,0,0,0.4)',
          }}
        />
      ) : null}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
};

export default Chip;
