/**
 * render-range-grid.js — Pure render function for the 13x13 preflop range grid.
 *
 * Renders a compact range grid showing:
 * - GTO opening range for hero's position (green cells)
 * - Hero's hole cards highlighted (gold cell)
 * - Situational adjustments overlaid (facing raise → tighten overlay)
 *
 * All functions are pure — state passed as parameters, no DOM access.
 */

import { escapeHtml } from './render-utils.js';
import {
  PREFLOP_CHARTS, getPositionName, heroHandIndex, rangeWidth,
  decodeIndex, getDefendingRange,
} from './range-grid-data.js';

const RANK_LABELS = 'AKQJT98765432';
const GRID_SIZE = 169;

/**
 * Build the hand label for a grid cell (row, col in display coordinates).
 * Display: row 0 = A (rank 12), row 12 = 2 (rank 0).
 * Upper-right triangle = suited, lower-left = offsuit, diagonal = pairs.
 */
const cellLabel = (displayRow, displayCol) => {
  const r = RANK_LABELS[displayRow];
  const c = RANK_LABELS[displayCol];
  if (displayRow === displayCol) return r + c;       // pair
  if (displayCol > displayRow) return r + c + 's';   // suited (upper-right)
  return c + r + 'o';                                 // offsuit (lower-left)
};

/**
 * Convert display coordinates to rangeIndex.
 * Display row/col 0=A(12), 1=K(11), ..., 12=2(0).
 */
const displayToRangeIndex = (displayRow, displayCol) => {
  const rankRow = 12 - displayRow;
  const rankCol = 12 - displayCol;
  if (rankRow === rankCol) return rankRow * 13 + rankCol; // pair
  // Upper-right in display = suited: displayCol > displayRow
  if (displayCol > displayRow) {
    // suited: high*13+low
    const high = Math.max(rankRow, rankCol);
    const low = Math.min(rankRow, rankCol);
    return high * 13 + low;
  }
  // Lower-left in display = offsuit: low*13+high
  const high = Math.max(rankRow, rankCol);
  const low = Math.min(rankRow, rankCol);
  return low * 13 + high;
};

/**
 * Determine CSS class(es) for a cell.
 */
const cellClass = (rIdx, heroIdx, baseRange, defendRange) => {
  const inBase = baseRange && baseRange[rIdx] > 0;
  const inDefend = defendRange ? defendRange[rIdx] > 0 : null;
  const isHero = rIdx === heroIdx;

  const classes = ['rg-cell'];

  if (isHero) {
    classes.push(inBase ? 'rg-hero' : 'rg-hero-oor');
  } else if (defendRange) {
    // Adjustment overlay active
    if (inBase && !inDefend) {
      classes.push('rg-tighten'); // was in range, now should fold
    } else if (!inBase && inDefend) {
      classes.push('rg-widen');   // wasn't in range, now should play
    } else if (inDefend) {
      classes.push('rg-in');      // still in defending range
    }
  } else if (inBase) {
    classes.push('rg-in');
  }

  return classes.join(' ');
};

/**
 * Render the 13x13 preflop range grid.
 *
 * @param {Object} opts
 * @param {string|null} opts.position - PREFLOP_CHARTS key ('CO', 'BTN', etc.)
 * @param {string[]|null} opts.holeCards - ['A♠', 'K♥'] or null
 * @param {string|null} opts.situation - advice.situation string or null
 * @returns {string} HTML string
 */
export const renderRangeGrid = ({ position, holeCards, situation }) => {
  if (!position || !PREFLOP_CHARTS[position]) return '';

  const baseRange = PREFLOP_CHARTS[position];
  const heroIdx = heroHandIndex(holeCards);
  const width = rangeWidth(baseRange);

  // Compute defending range for facing-raise situations
  const needsDefend = situation && (
    situation.includes('facing_raise') ||
    situation.includes('facing_3bet') ||
    situation.includes('facing_open')
  );
  const defendRange = needsDefend ? getDefendingRange(position) : null;
  const defendWidth = defendRange ? rangeWidth(defendRange) : null;

  let html = `<div class="street-card-section range-grid-wrap">`;

  // Header: position + width
  html += `<div class="rg-header">`;
  html += `<span class="rg-position">${escapeHtml(position)}</span>`;
  if (defendRange) {
    html += `<span class="rg-width">${defendWidth}% <span style="color:var(--text-faint);font-size:7px">(was ${width}%)</span></span>`;
  } else {
    html += `<span class="rg-width">${width}% of hands</span>`;
  }
  html += `</div>`;

  // Grid
  html += `<div class="range-grid">`;

  // Corner cell
  html += `<div class="rg-corner"></div>`;

  // Column labels (A K Q J T 9 8 7 6 5 4 3 2)
  for (let col = 0; col < 13; col++) {
    html += `<div class="rg-col-label">${RANK_LABELS[col]}</div>`;
  }

  // Rows
  for (let row = 0; row < 13; row++) {
    // Row label
    html += `<div class="rg-row-label">${RANK_LABELS[row]}</div>`;

    for (let col = 0; col < 13; col++) {
      const rIdx = displayToRangeIndex(row, col);
      const label = cellLabel(row, col);
      const cls = cellClass(rIdx, heroIdx, baseRange, defendRange);

      html += `<div class="${cls}">${label}</div>`;
    }
  }

  html += `</div>`; // .range-grid

  // Legend
  html += `<div class="rg-legend">`;
  html += `<span><span class="rg-legend-swatch" style="background:rgba(20,83,45,0.5)"></span>In range</span>`;
  if (heroIdx >= 0) {
    html += `<span><span class="rg-legend-swatch" style="background:var(--gold)"></span>Your hand</span>`;
  }
  if (defendRange) {
    html += `<span><span class="rg-legend-swatch" style="background:rgba(127,29,29,0.4)"></span>Fold</span>`;
  }
  html += `</div>`;

  html += `</div>`; // .range-grid-wrap

  return html;
};
