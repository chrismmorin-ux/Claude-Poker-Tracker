/**
 * @file SwatchPalette — color-only chip selector with prominent active highlight.
 *
 * Extracted from `PrototypeFinderView.jsx` (Phase A foundation). Each
 * option renders as a 32px circle of pure color. The selected swatch gets
 * THREE coordinated visual cues so the active state reads from any angle:
 *   1. White checkmark icon centered inside the swatch (works on light
 *      and dark colors via dark drop-shadow + white-on-dark stroke)
 *   2. 4px amber ring around the swatch with a 2px slate-offset gap
 *   3. ~13% scale-up
 *
 * Per `feedback_color_independent_of_ethnicity.md` + the v10 owner-feedback
 * batch: "When selecting a color, it should highlight which color is
 * selected. Some sort of clearly visible highlighting method to the color
 * of the circle will do."
 *
 * Props:
 *   - value       : selected option's `value` (or null)
 *   - onChange    : function; called with the new value (or null when
 *                   the user taps the active swatch to clear)
 *   - options     : Array<{ value: string, label: string, hex: string }>.
 *                   Caller normalizes from SKIN_TONES, HAIR_COLORS,
 *                   CLOTHING_COLORS, etc.
 *   - hideLabel   : Bool (default false). When false, renders
 *                   "Selected: <Color Name>" below the row when active,
 *                   or "Tap a color" muted hint when nothing's selected.
 */

import React from 'react';
import { Check } from 'lucide-react';

export const SwatchPalette = ({ value, onChange, options, hideLabel = false }) => {
  const selected = options.find((o) => o.value === value);
  return (
    <div className="mb-2">
      <div className="flex flex-wrap gap-2.5 mb-1.5 pt-1">
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value === value ? null : opt.value)}
              title={opt.label}
              aria-label={opt.label}
              aria-pressed={isActive}
              className={`relative shrink-0 rounded-full transition-all ${
                isActive
                  ? 'ring-4 ring-amber-500 ring-offset-2 ring-offset-slate-800/60 scale-[1.13]'
                  : 'ring-1 ring-slate-600 hover:ring-slate-500'
              }`}
              style={{
                width: 32,
                height: 32,
                background: opt.hex,
                boxShadow: isActive
                  ? 'inset 0 0 0 2px rgba(255,255,255,0.4), 0 2px 8px rgba(245, 158, 11, 0.5)'
                  : 'inset 0 0 0 2px rgba(255,255,255,0.25), inset 0 0 0 3px rgba(0,0,0,0.4)',
              }}
            >
              {isActive ? (
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Check
                    size={18}
                    strokeWidth={3.5}
                    className="text-white"
                    style={{ filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,0.85))' }}
                  />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {!hideLabel ? (
        <div className="text-[11px] text-amber-300 font-semibold ml-1 min-h-[14px]">
          {selected ? `Selected: ${selected.label}` : <span className="text-gray-500 font-normal italic">Tap a color</span>}
        </div>
      ) : null}
    </div>
  );
};

export default SwatchPalette;
