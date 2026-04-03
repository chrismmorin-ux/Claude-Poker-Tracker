/**
 * render-utils.js — Pure DOM/string utilities for side panel rendering.
 * Zero state dependencies — safe to import from any module.
 */

export const $ = (id) => document.getElementById(id);

export const showEl = (el) => { if (el) el.classList.remove('hidden'); };
export const hideEl = (el) => { if (el) el.classList.add('hidden'); };
export const isHidden = (el) => el?.classList.contains('hidden');

export const escapeHtml = (str) => {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const SUIT_DISPLAY = { '♥': '♥', '♦': '♦', '♣': '♣', '♠': '♠', h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_CLASS = { '♥': 'heart', '♦': 'diamond', '♣': 'club', '♠': 'spade', h: 'heart', d: 'diamond', c: 'club', s: 'spade' };

export const renderCard = (card) => {
  if (!card) return '<div class="card empty-card">?</div>';
  const rank = card[0] || '';
  const suitChar = card.length > 1 ? card.slice(1) : '';
  const suitSymbol = SUIT_DISPLAY[suitChar] || '';
  const suitClass = SUIT_CLASS[suitChar] || '';
  return `<div class="card ${suitClass}">${rank}${suitSymbol}</div>`;
};

export const renderStatRow = (label, value, suffix, colorClass) => {
  const display = value === null || value === undefined ? '—' : `${value}${suffix}`;
  return `<div class="stat-row">
    <span class="stat-label">${label}</span>
    <span class="stat-value ${colorClass}">${display}</span>
  </div>`;
};

/**
 * Compute absolute x/y positions for seats arranged in a semicircle arc.
 * Hero sits at bottom center; opponents distribute evenly along a 180° arc above.
 *
 * @param {number[]} seats - Array of seat numbers present at the table
 * @param {number} heroSeat - Hero's seat number
 * @param {number} [containerWidth=380] - Available width in px
 * @param {number} [containerHeight=85] - Available height in px
 * @returns {Map<number, {x: number, y: number}>} Seat → {x, y} center positions
 */
export const buildSeatArcPositions = (seats, heroSeat, containerWidth = 380, containerHeight = 85) => {
  const positions = new Map();
  const cx = containerWidth / 2;   // center x
  const heroY = containerHeight - 16; // hero at bottom, with 16px margin for circle radius
  const heroX = cx;

  // Separate hero from opponents
  const opponents = seats.filter(s => s !== heroSeat).sort((a, b) => {
    // Sort by relative position from hero (clockwise from hero's left)
    const relA = ((a - heroSeat + 9) % 9) || 9;
    const relB = ((b - heroSeat + 9) % 9) || 9;
    return relA - relB;
  });

  // Place hero at bottom center
  if (seats.includes(heroSeat)) {
    positions.set(heroSeat, { x: heroX, y: heroY });
  }

  // Place opponents along semicircle arc (left to right)
  const count = opponents.length;
  if (count === 0) return positions;

  // Arc parameters: semicircle from ~170° to ~10° (left to right, top half)
  const arcRadiusX = (containerWidth / 2) - 22; // horizontal radius, with margin for circles
  const arcRadiusY = containerHeight - 36;       // vertical radius (flattened ellipse)
  const arcCenterY = containerHeight - 8;        // arc center near bottom (hero level)

  const startAngle = Math.PI * 0.92;  // ~166° (far left)
  const endAngle = Math.PI * 0.08;    // ~14° (far right)

  for (let i = 0; i < count; i++) {
    // Distribute evenly along the arc
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angle = startAngle + (endAngle - startAngle) * t;
    const x = cx + arcRadiusX * Math.cos(angle);
    const y = arcCenterY - arcRadiusY * Math.sin(angle);
    positions.set(opponents[i], { x: Math.round(x), y: Math.round(y) });
  }

  return positions;
};

/**
 * Render a single mini card as HTML.
 * @param {string} card - Card string like "A♠" or "" for empty
 * @param {boolean} [isHero=false] - Whether this is a hero card (gold tint)
 * @returns {string} HTML string
 */
export const renderMiniCard = (card, isHero = false, isFolded = false) => {
  if (!card || card === '') {
    return `<span class="mini-card empty-card">?</span>`;
  }
  const isRed = card.includes('\u2665') || card.includes('\u2666');
  const heroClass = isHero ? ' hero-card' : '';
  const foldedClass = isFolded ? ' folded' : '';
  return `<span class="mini-card ${isRed ? 'red' : 'black'}${heroClass}${foldedClass}">${escapeHtml(card)}</span>`;
};
