/**
 * RangePaintGrid — interactive 13×13 range matrix for Range Lab Custom mode (WS-056).
 *
 * This is the CANONICAL range grid poker players know (GTO-Wizard / Flopzilla
 * aesthetic): square cells, the hand label inside each cell (AA, AKs, AKo…),
 * solid fill = included @100%, partial fill = weight, empty = neutral. It reads
 * as a *range grid* and is deliberately distinct from the dropdown picker chrome
 * (ContextPicker / BoardPicker) — NOT a "picker view". (Founder, SPR-099.)
 *
 * Layout reuses RangeGrid's index mapping (getGridIndex / getHandLabel) so the
 * suited(upper) / offsuit(lower) / pair(diagonal) convention is identical to the
 * read-only grid; only the cell sizing/styling is upgraded to the square matrix.
 *
 * Interaction (ADR-007):
 *   - Tap a cell → toggle empty↔100% (onTapCell)
 *   - Long-press ≥400ms → in-place weight slider → Apply/Cancel (onApplyWeight)
 *   - Scale-aware: when a rendered cell is < 44 DOM-px wide, tap is disabled and
 *     ALL actions require long-press (tap misfires at small sizes; WCAG floor).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getGridIndex, getHandLabel } from '../../ui/RangeGrid';

const RANK_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const DISPLAY_LABELS = [...RANK_LABELS].reverse(); // A, K, Q, ..., 2
const LONG_PRESS_MS = 400;
const TAP_TARGET_FLOOR = 44; // WCAG min tap target (px)
const HINT_KEY = 'rangelab:hintseen:v1';

const hintSeen = () => {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
};
const markHintSeen = () => {
  try {
    window.sessionStorage.setItem(HINT_KEY, '1');
  } catch {
    /* no-op */
  }
};

/**
 * @param {object} props
 * @param {Float64Array} props.range - 169-cell weights
 * @param {(idx:number)=>void} props.onTapCell
 * @param {(idx:number, weight:number)=>void} props.onApplyWeight
 * @param {string} [props.colorHue='168'] - HSL hue for included-cell fill (teal)
 */
export const RangePaintGrid = ({ range, onTapCell, onApplyWeight, colorHue = '168' }) => {
  const gridRef = useRef(null);
  const pressRef = useRef({ idx: null, timer: null, longFired: false });
  const [longPressRequired, setLongPressRequired] = useState(false);
  const [slider, setSlider] = useState(null); // { idx, row, col, value }
  const [showHint, setShowHint] = useState(!hintSeen());

  // Scale-aware: measure a rendered cell; below the 44px floor, require long-press.
  useEffect(() => {
    const el = gridRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const cell = el.querySelector('[data-cell]');
      if (cell) setLongPressRequired(cell.getBoundingClientRect().width < TAP_TARGET_FLOOR);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clearPress = useCallback(() => {
    if (pressRef.current.timer) clearTimeout(pressRef.current.timer);
    pressRef.current = { idx: null, timer: null, longFired: false };
  }, []);

  const dismissHint = useCallback(() => {
    if (showHint) {
      setShowHint(false);
      markHintSeen();
    }
  }, [showHint]);

  const openSlider = useCallback((idx, row, col) => {
    const current = range[idx] || 0;
    setSlider({ idx, row, col, value: Math.round((current || 1) * 100) });
  }, [range]);

  const onPointerDown = useCallback((idx, row, col) => {
    pressRef.current.idx = idx;
    pressRef.current.longFired = false;
    pressRef.current.timer = setTimeout(() => {
      pressRef.current.longFired = true;
      openSlider(idx, row, col);
      dismissHint();
    }, LONG_PRESS_MS);
  }, [openSlider, dismissHint]);

  const onPointerUp = useCallback((idx) => {
    const { longFired, idx: pressedIdx } = pressRef.current;
    clearPress();
    if (longFired || pressedIdx !== idx) return; // long-press already handled, or moved off
    if (longPressRequired) return; // tap disabled at small scale
    onTapCell(idx);
    dismissHint();
  }, [clearPress, longPressRequired, onTapCell, dismissHint]);

  const commitSlider = useCallback(() => {
    if (slider) onApplyWeight(slider.idx, slider.value / 100);
    setSlider(null);
  }, [slider, onApplyWeight]);

  // Cell fill: included = solid; partial = fill from the bottom to weight%.
  const cellStyle = (weight) => {
    if (weight <= 0) {
      return { background: 'rgb(31,41,55)', color: '#6b7280' }; // gray-800 / muted label
    }
    const fillColor = `hsl(${colorHue}, 70%, 42%)`;
    if (weight >= 0.999) {
      return { background: fillColor, color: 'white' };
    }
    const pct = Math.round(weight * 100);
    // Partial-fill HEIGHT (founder-ratified, SPR-098): colored band rises from bottom.
    return {
      background: `linear-gradient(to top, ${fillColor} ${pct}%, rgb(31,41,55) ${pct}%)`,
      color: 'white',
    };
  };

  return (
    <div className="select-none">
      {showHint && (
        <div className="mb-2 text-xs text-teal-300/90 bg-teal-900/20 border border-teal-800/40 rounded-md px-3 py-2">
          Tap a hand to include it; long-press to set a partial weight.
        </div>
      )}

      <div ref={gridRef} className="relative inline-block">
        <div
          className="grid gap-px bg-gray-900 p-px rounded-md"
          style={{ gridTemplateColumns: 'repeat(13, 46px)' }}
        >
          {DISPLAY_LABELS.map((_, row) =>
            DISPLAY_LABELS.map((__, col) => {
              const idx = getGridIndex(row, col);
              const label = getHandLabel(row, col);
              const weight = range[idx] || 0;
              const { background, color } = cellStyle(weight);
              return (
                <button
                  key={`${row}-${col}`}
                  type="button"
                  data-cell
                  data-idx={idx}
                  aria-label={`${label} ${Math.round(weight * 100)}%`}
                  onPointerDown={() => onPointerDown(idx, row, col)}
                  onPointerUp={() => onPointerUp(idx)}
                  onPointerLeave={clearPress}
                  onPointerCancel={clearPress}
                  onContextMenu={(e) => e.preventDefault()}
                  className="flex items-center justify-center font-mono font-semibold rounded-[2px] touch-none"
                  style={{
                    width: 46,
                    height: 46,
                    fontSize: '11px',
                    background,
                    color,
                  }}
                  title={`${label}: ${Math.round(weight * 100)}%`}
                >
                  {label}
                </button>
              );
            })
          )}
        </div>

        {/* In-place weight slider (long-press → Apply/Cancel) */}
        {slider && (
          <div
            className="absolute z-20 bg-gray-900 border border-teal-600 rounded-lg shadow-xl p-3 w-44"
            style={{
              left: `calc(${(slider.col / 13) * 100}% )`,
              top: `calc(${(slider.row / 13) * 100}% + 1.5rem)`,
            }}
            role="dialog"
            aria-label={`Set weight for ${getHandLabel(slider.row, slider.col)}`}
          >
            <div className="text-xs text-gray-300 mb-1 font-semibold">
              {getHandLabel(slider.row, slider.col)} — {slider.value}%
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={slider.value}
              onChange={(e) => setSlider((s) => ({ ...s, value: Number(e.target.value) }))}
              className="w-full accent-teal-500"
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={commitSlider}
                className="flex-1 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded px-2 py-1"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => setSlider(null)}
                className="flex-1 text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-200 rounded px-2 py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RangePaintGrid;
