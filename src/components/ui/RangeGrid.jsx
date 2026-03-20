/**
 * RangeGrid.jsx - 13x13 visual grid for 169-cell preflop hand ranges
 *
 * Renders a Float64Array(169) as a color-coded grid.
 * Diagonal = pairs, upper-right = suited, lower-left = offsuit.
 *
 * Supports two modes:
 * 1. Single range: `weights` prop → one-color heatmap
 * 2. Multi-action: `actionRanges` prop → raise/call/fold distribution per cell
 */

import React from 'react';
import { rangeIndex } from '../../utils/pokerCore/rangeMatrix';

const RANK_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

const CONFIDENCE_THRESHOLDS = [
  { min: 50, label: 'High', color: 'text-green-600' },
  { min: 25, label: 'Med', color: 'text-yellow-600' },
  { min: 10, label: 'Low', color: 'text-orange-600' },
  { min: 0, label: 'Very Low', color: 'text-red-600' },
];

const getConfidence = (sampleSize) => {
  for (const t of CONFIDENCE_THRESHOLDS) {
    if (sampleSize >= t.min) return t;
  }
  return CONFIDENCE_THRESHOLDS[CONFIDENCE_THRESHOLDS.length - 1];
};

/**
 * Get hand label for a grid cell (row, col).
 * Row/col use internal rank indices (0=2, 12=A).
 * Display grid is inverted: row 0 = A (rank 12), row 12 = 2 (rank 0).
 */
const getHandLabel = (displayRow, displayCol) => {
  // Convert display coordinates to rank indices (invert so A is top-left)
  const rankRow = 12 - displayRow;
  const rankCol = 12 - displayCol;

  if (rankRow === rankCol) {
    return RANK_LABELS[rankRow] + RANK_LABELS[rankCol];
  }
  if (rankRow > rankCol) {
    // Upper triangle in display = suited (high rank row > low rank col)
    return RANK_LABELS[rankRow] + RANK_LABELS[rankCol] + 's';
  }
  // Lower triangle = offsuit
  return RANK_LABELS[rankCol] + RANK_LABELS[rankRow] + 'o';
};

/**
 * Get the range index for a display cell.
 * Upper triangle (rankRow > rankCol) = suited, lower = offsuit.
 */
const getGridIndex = (displayRow, displayCol) => {
  const rankRow = 12 - displayRow;
  const rankCol = 12 - displayCol;
  const suited = rankRow > rankCol;
  return rangeIndex(rankRow, rankCol, suited);
};

const SIZE_CONFIG = {
  full: { cellW: 28, cellH: 18, fontSize: '8px', labelSize: '7px' },
  compact: { cellW: 20, cellH: 14, fontSize: '7px', labelSize: '6px' },
};

// Colors for multi-action mode (raise/call/fold)
const ACTION_COLORS = {
  raise: { r: 234, g: 88, b: 12 },   // orange (matches PRIMITIVE_BUTTON_CONFIG raise)
  call:  { r: 37, g: 99, b: 235 },    // blue (matches call)
  fold:  { r: 55, g: 55, b: 65 },     // dark gray
};

/**
 * Build CSS background for a cell showing raise/call/fold distribution.
 * Uses horizontal gradient segments proportional to each action weight.
 */
const buildActionCellStyle = (raiseW, callW, foldW) => {
  const total = raiseW + callW + foldW;
  if (total < 0.001) return { background: 'transparent', color: '#666' };

  const rPct = (raiseW / total) * 100;
  const cPct = (callW / total) * 100;
  const rEnd = rPct;
  const cEnd = rPct + cPct;

  // Build gradient segments
  const { raise: rc, call: cc, fold: fc } = ACTION_COLORS;
  const segments = [];

  if (rPct > 0.5) {
    segments.push(`rgba(${rc.r},${rc.g},${rc.b},0.85) 0%`);
    segments.push(`rgba(${rc.r},${rc.g},${rc.b},0.85) ${rEnd}%`);
  }
  if (cPct > 0.5) {
    segments.push(`rgba(${cc.r},${cc.g},${cc.b},0.85) ${rEnd}%`);
    segments.push(`rgba(${cc.r},${cc.g},${cc.b},0.85) ${cEnd}%`);
  }
  if (cEnd < 99.5) {
    segments.push(`rgba(${fc.r},${fc.g},${fc.b},0.5) ${cEnd}%`);
    segments.push(`rgba(${fc.r},${fc.g},${fc.b},0.5) 100%`);
  }

  const background = segments.length >= 2
    ? `linear-gradient(to right, ${segments.join(', ')})`
    : `rgba(${fc.r},${fc.g},${fc.b},0.5)`;

  // Text color: white on raise/call, gray on fold
  const actionPct = rPct + cPct;
  const color = actionPct > 40 ? 'white' : actionPct > 15 ? '#bbb' : '#888';

  return { background, color };
};

/**
 * @param {Object} props
 * @param {Float64Array} [props.weights] - 169-cell range weights (single range mode)
 * @param {Object} [props.actionRanges] - Multi-action mode: { raise, call, fold } Float64Array(169) each
 * @param {Set} [props.showdownIndices] - Indices confirmed at showdown
 * @param {'full'|'compact'} [props.size='full'] - Size variant
 * @param {number} [props.sampleSize=0] - Total hands for confidence badge
 * @param {string} [props.colorHue='142'] - HSL hue for cell color (single range mode)
 * @param {boolean} [props.hideConfidence=false]
 */
export const RangeGrid = ({
  weights,
  actionRanges,
  showdownIndices,
  size = 'full',
  sampleSize = 0,
  colorHue = '142',
  hideConfidence = false,
}) => {
  const config = SIZE_CONFIG[size] || SIZE_CONFIG.full;
  const showdownSet = showdownIndices || new Set();
  const isMultiAction = !!actionRanges;

  if (!weights && !actionRanges) {
    return <div className="text-gray-400 text-xs text-center py-2">No range data</div>;
  }

  const displayLabels = [...RANK_LABELS].reverse(); // A, K, Q, ..., 2

  return (
    <div>
      {/* Column labels */}
      <div className="flex" style={{ marginLeft: `${config.cellW}px` }}>
        {displayLabels.map((label, col) => (
          <div
            key={`col-${col}`}
            className="text-center text-gray-500 font-mono"
            style={{ width: `${config.cellW}px`, fontSize: config.labelSize }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Grid rows */}
      {displayLabels.map((rowLabel, row) => (
        <div key={`row-${row}`} className="flex">
          {/* Row label */}
          <div
            className="flex items-center justify-center text-gray-500 font-mono"
            style={{ width: `${config.cellW}px`, height: `${config.cellH}px`, fontSize: config.labelSize }}
          >
            {rowLabel}
          </div>

          {/* Cells */}
          {displayLabels.map((_, col) => {
            const idx = getGridIndex(row, col);
            const isShowdown = showdownSet.has(idx);
            const label = getHandLabel(row, col);

            if (isMultiAction) {
              // Multi-action mode: show raise/call/fold distribution
              const raiseW = actionRanges.raise?.[idx] || 0;
              const callW = actionRanges.call?.[idx] || 0;
              const foldW = actionRanges.fold?.[idx] || 0;
              const total = raiseW + callW + foldW;
              const { background, color } = buildActionCellStyle(raiseW, callW, foldW);
              const rPct = total > 0 ? Math.round((raiseW / total) * 100) : 0;
              const cPct = total > 0 ? Math.round((callW / total) * 100) : 0;
              const fPct = total > 0 ? Math.round((foldW / total) * 100) : 0;

              return (
                <div
                  key={`${row}-${col}`}
                  className="border border-gray-700/50 flex items-center justify-center font-mono select-none"
                  style={{
                    width: `${config.cellW}px`,
                    height: `${config.cellH}px`,
                    fontSize: config.fontSize,
                    background,
                    color,
                    boxShadow: isShowdown ? 'inset 0 0 0 2px #f59e0b' : 'none',
                  }}
                  title={`${label}: Raise ${rPct}% | Call ${cPct}% | Fold ${fPct}%`}
                >
                  {label}
                </div>
              );
            }

            // Single range mode (original)
            const weight = weights[idx] || 0;
            return (
              <div
                key={`${row}-${col}`}
                className="border border-gray-200 flex items-center justify-center font-mono select-none"
                style={{
                  width: `${config.cellW}px`,
                  height: `${config.cellH}px`,
                  fontSize: config.fontSize,
                  backgroundColor: weight > 0
                    ? `hsla(${colorHue}, 76%, 36%, ${Math.max(0.08, weight)})`
                    : 'transparent',
                  color: weight > 0.5 ? 'white' : weight > 0 ? '#1a1a1a' : '#ccc',
                  boxShadow: isShowdown ? 'inset 0 0 0 2px #f59e0b' : 'none',
                }}
                title={`${label}: ${(weight * 100).toFixed(0)}%${isShowdown ? ' (confirmed)' : ''}`}
              >
                {label}
              </div>
            );
          })}
        </div>
      ))}

      {/* Multi-action legend */}
      {isMultiAction && (
        <div className="flex items-center justify-center gap-3 mt-1.5">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: `rgb(${ACTION_COLORS.raise.r},${ACTION_COLORS.raise.g},${ACTION_COLORS.raise.b})` }} />
            <span className="text-gray-400" style={{ fontSize: config.labelSize }}>Raise</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: `rgb(${ACTION_COLORS.call.r},${ACTION_COLORS.call.g},${ACTION_COLORS.call.b})` }} />
            <span className="text-gray-400" style={{ fontSize: config.labelSize }}>Call</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: `rgb(${ACTION_COLORS.fold.r},${ACTION_COLORS.fold.g},${ACTION_COLORS.fold.b})` }} />
            <span className="text-gray-400" style={{ fontSize: config.labelSize }}>Fold</span>
          </span>
        </div>
      )}

      {/* Confidence badge */}
      {sampleSize > 0 && !hideConfidence && (
        <div className="mt-1 text-center">
          <span className={`text-xs font-medium ${getConfidence(sampleSize).color}`}>
            {getConfidence(sampleSize).label} confidence ({sampleSize} hands)
          </span>
        </div>
      )}
    </div>
  );
};

export default RangeGrid;
