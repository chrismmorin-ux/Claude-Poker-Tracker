/**
 * render-range-grid.js — Pure render function for the 13x13 range grid.
 *
 * Supports two modes:
 * 1. **Dynamic Bayesian range** (villain) — heat-map grid from Float64Array weights
 * 2. **Static GTO fallback** (hero) — binary in/out from PREFLOP_CHARTS when no range data
 *
 * All functions are pure — state passed as parameters, no DOM access.
 */

import { escapeHtml } from './render-utils.js';
import {
  PREFLOP_CHARTS, getPositionName, heroHandIndex, rangeWidth as computeRangeWidth,
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
    const high = Math.max(rankRow, rankCol);
    const low = Math.min(rankRow, rankCol);
    return high * 13 + low;
  }
  // Lower-left in display = offsuit: low*13+high
  const high = Math.max(rankRow, rankCol);
  const low = Math.min(rankRow, rankCol);
  return low * 13 + high;
};

// =========================================================================
// HEAT-MAP MODE (dynamic Bayesian range)
// =========================================================================

/**
 * CSS inline style for a heat-map cell based on weight (0.0-1.0).
 * Returns a background color with opacity proportional to weight.
 */
const heatMapStyle = (weight, isHero) => {
  if (isHero) return 'background:var(--gold);color:#000';
  if (weight <= 0) return '';
  // Green gradient: stronger weight = more opaque
  const alpha = Math.min(0.8, weight * 0.7 + 0.1);
  return `background:rgba(20,83,45,${alpha.toFixed(2)})`;
};

/**
 * Render a dynamic Bayesian range grid with heat-map coloring.
 *
 * @param {Array|Float64Array} range - 169-cell range weights (0.0-1.0)
 * @param {string|null} label - Grid header label (e.g., "S3 · CO · Open")
 * @param {string[]|null} holeCards - Hero's hole cards for highlight
 * @param {number|null} equity - Hero equity vs this range (0.0-1.0)
 * @param {number|null} width - % of hands (pre-computed), or computed from range
 * @returns {string} HTML string
 */
const renderHeatMapGrid = (range, label, holeCards, equity, width) => {
  const heroIdx = heroHandIndex(holeCards);
  const displayWidth = width ?? computeRangeWidth(range);

  let html = `<div class="street-card-section range-grid-wrap">`;

  // Header: label + width + equity badge
  html += `<div class="rg-header">`;
  html += `<span class="rg-position">${escapeHtml(label || 'Villain Range')}</span>`;
  html += `<span class="rg-width">${displayWidth}% of hands`;
  if (equity != null) {
    const eqPct = Math.round(equity * 100);
    const eqColor = eqPct >= 55 ? 'var(--green)' : eqPct >= 45 ? 'var(--gold)' : 'var(--red)';
    html += ` <span style="color:${eqColor};font-weight:600;margin-left:6px">${eqPct}% eq</span>`;
  }
  html += `</span></div>`;

  // Grid
  html += `<div class="range-grid">`;
  html += `<div class="rg-corner"></div>`;
  for (let col = 0; col < 13; col++) {
    html += `<div class="rg-col-label">${RANK_LABELS[col]}</div>`;
  }

  for (let row = 0; row < 13; row++) {
    html += `<div class="rg-row-label">${RANK_LABELS[row]}</div>`;
    for (let col = 0; col < 13; col++) {
      const rIdx = displayToRangeIndex(row, col);
      const lbl = cellLabel(row, col);
      const w = range[rIdx] || 0;
      const isHero = rIdx === heroIdx;
      const style = heatMapStyle(w, isHero);
      const cls = isHero ? 'rg-cell rg-hero' : w > 0 ? 'rg-cell rg-heat' : 'rg-cell';
      html += `<div class="${cls}"${style ? ` style="${style}"` : ''}>${lbl}</div>`;
    }
  }
  html += `</div>`; // .range-grid

  // Legend
  html += `<div class="rg-legend">`;
  html += `<span><span class="rg-legend-swatch" style="background:rgba(20,83,45,0.6)"></span>In range</span>`;
  if (heroIdx >= 0) {
    html += `<span><span class="rg-legend-swatch" style="background:var(--gold)"></span>Your hand</span>`;
  }
  html += `</div>`;

  html += `</div>`; // .range-grid-wrap
  return html;
};

// =========================================================================
// STATIC GTO MODE (fallback when no dynamic range data)
// =========================================================================

/**
 * Determine CSS class(es) for a static GTO cell.
 */
const cellClass = (rIdx, heroIdx, baseRange, defendRange) => {
  const inBase = baseRange && baseRange[rIdx] > 0;
  const inDefend = defendRange ? defendRange[rIdx] > 0 : null;
  const isHero = rIdx === heroIdx;

  const classes = ['rg-cell'];
  if (isHero) {
    classes.push(inBase ? 'rg-hero' : 'rg-hero-oor');
  } else if (defendRange) {
    if (inBase && !inDefend) classes.push('rg-tighten');
    else if (!inBase && inDefend) classes.push('rg-widen');
    else if (inDefend) classes.push('rg-in');
  } else if (inBase) {
    classes.push('rg-in');
  }
  return classes.join(' ');
};

/**
 * Render a static GTO opening range grid (fallback mode).
 */
const renderStaticGrid = (position, holeCards, situation) => {
  if (!position || !PREFLOP_CHARTS[position]) return '';

  const baseRange = PREFLOP_CHARTS[position];
  const heroIdx = heroHandIndex(holeCards);
  const width = computeRangeWidth(baseRange);

  const needsDefend = situation && (
    situation.includes('facing_raise') ||
    situation.includes('facing_3bet') ||
    situation.includes('facing_open')
  );
  const defendRange = needsDefend ? getDefendingRange(position) : null;
  const defendWidth = defendRange ? computeRangeWidth(defendRange) : null;

  let html = `<div class="street-card-section range-grid-wrap">`;
  html += `<div class="rg-header">`;
  html += `<span class="rg-position">${escapeHtml(position)} GTO</span>`;
  if (defendRange) {
    html += `<span class="rg-width">${defendWidth}% <span style="color:var(--text-faint);font-size:7px">(was ${width}%)</span></span>`;
  } else {
    html += `<span class="rg-width">${width}% of hands</span>`;
  }
  html += `</div>`;

  html += `<div class="range-grid">`;
  html += `<div class="rg-corner"></div>`;
  for (let col = 0; col < 13; col++) {
    html += `<div class="rg-col-label">${RANK_LABELS[col]}</div>`;
  }
  for (let row = 0; row < 13; row++) {
    html += `<div class="rg-row-label">${RANK_LABELS[row]}</div>`;
    for (let col = 0; col < 13; col++) {
      const rIdx = displayToRangeIndex(row, col);
      const label = cellLabel(row, col);
      const cls = cellClass(rIdx, heroIdx, baseRange, defendRange);
      html += `<div class="${cls}">${label}</div>`;
    }
  }
  html += `</div>`;

  html += `<div class="rg-legend">`;
  html += `<span><span class="rg-legend-swatch" style="background:rgba(20,83,45,0.5)"></span>In range</span>`;
  if (heroIdx >= 0) {
    html += `<span><span class="rg-legend-swatch" style="background:var(--gold)"></span>Your hand</span>`;
  }
  if (defendRange) {
    html += `<span><span class="rg-legend-swatch" style="background:rgba(127,29,29,0.4)"></span>Fold</span>`;
  }
  html += `</div>`;
  html += `</div>`;
  return html;
};

// =========================================================================
// PUBLIC API
// =========================================================================

/**
 * Render the 13x13 range grid.
 *
 * Supports two modes:
 * - Dynamic: pass `range` (169-cell Array/Float64Array) for Bayesian heat-map
 * - Static: pass `position` (e.g., 'CO') for GTO fallback when no range data
 *
 * @param {Object} opts
 * @param {Array|Float64Array|null} opts.range - Dynamic range weights (0.0-1.0), 169 cells
 * @param {string|null} opts.label - Header label for dynamic mode
 * @param {number|null} opts.equity - Hero equity vs this range (0.0-1.0)
 * @param {number|null} opts.rangeWidth - Pre-computed % of hands
 * @param {string|null} opts.position - PREFLOP_CHARTS key for static fallback
 * @param {string[]|null} opts.holeCards - Hero's hole cards for highlight
 * @param {string|null} opts.situation - Advice situation for static defending range
 * @returns {string} HTML string
 */
export const renderRangeGrid = ({ range, label, equity, rangeWidth, position, holeCards, situation }) => {
  // Dynamic mode: use Bayesian range data
  if (range && range.length === GRID_SIZE) {
    return renderHeatMapGrid(range, label, holeCards, equity, rangeWidth);
  }

  // Static fallback: use GTO opening charts
  return renderStaticGrid(position, holeCards, situation);
};
