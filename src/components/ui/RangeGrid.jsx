/**
 * RangeGrid.jsx - 13x13 visual grid for 169-cell preflop hand ranges
 *
 * Renders a Float64Array(169) as a color-coded grid.
 * Diagonal = pairs, upper-right = suited, lower-left = offsuit.
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

/**
 * @param {Object} props
 * @param {Float64Array} props.weights - 169-cell range weights (0-1)
 * @param {Set} [props.showdownIndices] - Indices confirmed at showdown
 * @param {'full'|'compact'} [props.size='full'] - Size variant
 * @param {number} [props.sampleSize=0] - Total hands for confidence badge
 * @param {string} [props.colorHue='142'] - HSL hue for cell color (default green)
 */
export const RangeGrid = ({
  weights,
  showdownIndices,
  size = 'full',
  sampleSize = 0,
  colorHue = '142',
}) => {
  const config = SIZE_CONFIG[size] || SIZE_CONFIG.full;
  const showdownSet = showdownIndices || new Set();

  if (!weights) {
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
            const weight = weights[idx] || 0;
            const isShowdown = showdownSet.has(idx);
            const label = getHandLabel(row, col);

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

      {/* Confidence badge */}
      {sampleSize > 0 && (
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
