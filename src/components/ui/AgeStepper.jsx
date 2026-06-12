/**
 * @file AgeStepper — discrete-snap slider for age decade with drag-or-tap.
 *
 * Unified-PlayerFinder Phase A foundation primitive. Replaces
 * the chip row for age. Click any position to snap, OR drag the thumb
 * across the track — both gestures snap to the nearest decade. Owner
 * 2026-05-06: "an intuitive thing someone might do is drag on the age
 * slider."
 *
 * Each label below the track is independently tappable. Pointer-capture
 * lets the drag continue even if the finger leaves the track.
 *
 * Props:
 *   - value     : current age decade label (one of AGE_OPTIONS) or null
 *   - onChange  : (newValue) => void. Called with the new label.
 *   - options   : Array<string>. Defaults to the standard 6-decade ladder.
 */

import React, { useRef } from 'react';

const DEFAULT_OPTIONS = ['<20', '20s', '30s', '40s', '50s', '60s+'];

export const AgeStepper = ({ value, onChange, options = DEFAULT_OPTIONS }) => {
  const trackRef = useRef(null);
  const idx = value ? options.indexOf(value) : -1;
  const active = idx >= 0;

  // Snap clientX to the nearest age bucket and emit it.
  const snapAndEmit = (clientX) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const snapped = Math.round(ratio * (options.length - 1));
    const next = options[snapped];
    if (next !== value) onChange(next);
  };

  // Pointer events — works for mouse + touch on modern browsers.
  // setPointerCapture lets us keep receiving move events even if the
  // pointer leaves the track during a drag.
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    snapAndEmit(e.clientX);
  };
  const onPointerMove = (e) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    snapAndEmit(e.clientX);
  };
  const onPointerUp = (e) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div className="mt-1 mb-2 px-2">
      {/* Track + dots — pointer events on the wrapper enable drag-to-set. */}
      <div
        ref={trackRef}
        className="relative h-9 cursor-pointer touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Background track */}
        <div className="absolute top-1/2 left-3 right-3 h-1.5 -translate-y-1/2 bg-slate-700 rounded-full pointer-events-none" />
        {/* Active fill */}
        {active ? (
          <div
            className="absolute top-1/2 left-3 h-1.5 -translate-y-1/2 bg-amber-500 rounded-full transition-all pointer-events-none"
            style={{ width: `calc((100% - 24px) * ${idx} / ${options.length - 1})` }}
          />
        ) : null}
        {/* Position dots — visual only, the wrapper handles taps */}
        {options.map((opt, i) => {
          const isActive = i === idx;
          const left = `calc(12px + (100% - 24px) * ${i} / ${options.length - 1})`;
          return (
            <span
              key={opt}
              aria-label={`Age ${opt}`}
              aria-pressed={isActive}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
              style={{ left }}
            >
              <span
                className={`block rounded-full transition-all ${
                  isActive
                    ? 'w-6 h-6 bg-amber-500 ring-2 ring-amber-300 shadow-md'
                    : 'w-3 h-3 bg-slate-800 ring-2 ring-slate-600'
                }`}
              />
            </span>
          );
        })}
      </div>
      {/* Labels — also tappable */}
      <div className="flex justify-between mt-1 px-3">
        {options.map((opt, i) => {
          const isActive = i === idx;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt === value ? null : opt)}
              className={`text-[11px] font-semibold transition-colors ${
                isActive ? 'text-amber-300' : 'text-gray-500 hover:text-gray-300'
              }`}
              style={{ minWidth: 32 }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AgeStepper;
