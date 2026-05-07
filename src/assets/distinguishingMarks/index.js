/**
 * @file distinguishingMarks/index.js — Badge primitives for the
 *   `player.distinguishingMarks` array (PIO Gate 4 v2 audit §A7).
 *
 * SPR-041 Phase 4: small overlay glyphs that render on top of the
 * AvatarRenderer composition. Each mark in `player.distinguishingMarks`
 * picks one of 5 types and a location anchor.
 *
 * Schema (validated in src/utils/persistence/validation.js):
 *   {
 *     type: 'tattoo' | 'hearing-aid' | 'bindi' | 'scar' | 'prosthetic',
 *     location: 'face' | 'arm' | 'ear' | 'neck' | 'hand' | 'other',
 *     description: string,            // free-text, e.g., "left forearm sleeve"
 *     firstSeenAt: number (ms),
 *     lastSeenAt: number (ms),
 *   }
 *
 * Authored against the avatar's 100×100 viewBox (AVATAR_VIEWBOX_SIZE).
 * Each glyph's paths are centered at (0, 0) — the renderer translates them
 * to the location anchor via a `<g transform="translate(cx, cy)">` wrapper.
 *
 * The `backgroundCircle` flag adds a small white disc behind the glyph so
 * marks stay legible against any underlying skin / clothing color. The
 * disc is part of the badge primitive (not the renderer) so per-type
 * tuning stays here.
 */

// =============================================================================
// LOCATION ANCHORS — where each location renders on the 100×100 viewBox
// =============================================================================

export const LOCATION_ANCHORS = {
  face:  { cx: 66, cy: 52 },  // right cheek
  ear:   { cx: 86, cy: 50 },  // right ear (slightly above face anchor)
  neck:  { cx: 50, cy: 80 },  // base of neck, centered
  arm:   { cx: 82, cy: 92 },  // right shoulder / upper arm
  hand:  { cx: 18, cy: 92 },  // left lower-corner (hand area)
  other: { cx: 86, cy: 22 },  // top-right corner
};

export const VALID_LOCATIONS = Object.keys(LOCATION_ANCHORS);

// Fallback for unknown locations — top-right corner stays clear of face
// + clothing layers in most renders.
export const DEFAULT_LOCATION = 'other';

// =============================================================================
// MARK TYPE REGISTRY
// =============================================================================

// Each entry:
//   - type: persisted enum value
//   - label: human-readable for editor UI
//   - defaultLocation: pre-fill for new entries in the editor
//   - backgroundCircle: { r, fill } | null — white disc behind glyph
//   - paths: array of SVG path specs; centered at (0,0); rendered as <path>

export const DISTINGUISHING_MARKS = [
  {
    type: 'tattoo',
    label: 'Tattoo',
    defaultLocation: 'arm',
    backgroundCircle: { r: 6, fill: '#fff' },
    // 5-point star, ~9px wide
    paths: [
      {
        d: 'M 0 -4 L 1.18 -1.27 L 4 -1.27 L 1.78 0.49 L 2.7 3.24 L 0 1.6 L -2.7 3.24 L -1.78 0.49 L -4 -1.27 L -1.18 -1.27 Z',
        fill: '#1a1a1a',
      },
    ],
  },
  {
    type: 'hearing-aid',
    label: 'Hearing Aid',
    defaultLocation: 'ear',
    backgroundCircle: { r: 5.5, fill: '#fff' },
    // Behind-the-ear hearing aid: small body + curved tube
    paths: [
      // Body (small ear-hugging shape)
      { d: 'M -1.5 -2.5 a 1.8 1.8 0 1 0 0 3.6 a 1.8 1.8 0 1 0 0 -3.6 Z', fill: '#5a6470' },
      // Tube curving down into the ear canal
      { d: 'M 0.3 -0.8 q 2.3 0 2.3 2.5 q 0 2.5 -2.3 2.5', stroke: '#5a6470', strokeWidth: 0.9, fill: 'none', strokeLinecap: 'round' },
    ],
  },
  {
    type: 'bindi',
    label: 'Bindi',
    defaultLocation: 'face',
    // No background disc — bindi is itself a colored dot, white halo would
    // dilute the visual.
    backgroundCircle: null,
    paths: [
      // Solid red dot, ~5px diameter
      { d: 'M 0 0 m -2.4 0 a 2.4 2.4 0 1 0 4.8 0 a 2.4 2.4 0 1 0 -4.8 0 Z', fill: '#c81e3a' },
    ],
  },
  {
    type: 'scar',
    label: 'Scar',
    defaultLocation: 'face',
    backgroundCircle: { r: 5.5, fill: '#fff' },
    // Short jagged line — irregular curve mimicking a healed scar
    paths: [
      { d: 'M -3.5 -1 L -1 0.3 L 1 -0.7 L 3.5 1', stroke: '#9b6b5a', strokeWidth: 1.2, strokeLinecap: 'round', fill: 'none' },
    ],
  },
  {
    type: 'prosthetic',
    label: 'Prosthetic',
    defaultLocation: 'hand',
    backgroundCircle: { r: 6, fill: '#fff' },
    // Mechanical grip silhouette — three vertical fingers + base bar
    paths: [
      { d: 'M -2.5 -3 L -2.5 2', stroke: '#4a5560', strokeWidth: 1.2, strokeLinecap: 'round', fill: 'none' },
      { d: 'M 0 -3 L 0 2',       stroke: '#4a5560', strokeWidth: 1.2, strokeLinecap: 'round', fill: 'none' },
      { d: 'M 2.5 -3 L 2.5 2',   stroke: '#4a5560', strokeWidth: 1.2, strokeLinecap: 'round', fill: 'none' },
      { d: 'M -3.5 3 L 3.5 3',   stroke: '#4a5560', strokeWidth: 1.4, strokeLinecap: 'round', fill: 'none' },
    ],
  },
];

const MARK_BY_TYPE = Object.fromEntries(
  DISTINGUISHING_MARKS.map((m) => [m.type, m]),
);

export const VALID_MARK_TYPES = Object.keys(MARK_BY_TYPE);

/**
 * Look up a mark spec by type id. Returns null when the type is unknown
 * (caller should skip rendering the mark and surface a console.warn so
 * we notice schema drift).
 */
export const getDistinguishingMarkSpec = (type) =>
  MARK_BY_TYPE[type] || null;

/**
 * Resolve a mark's render anchor. Falls back to the type's defaultLocation
 * when the mark's location is missing/unknown, then to DEFAULT_LOCATION.
 */
export const resolveMarkAnchor = (mark) => {
  if (!mark) return LOCATION_ANCHORS[DEFAULT_LOCATION];
  const loc = (mark.location && LOCATION_ANCHORS[mark.location])
    ? mark.location
    : (() => {
        const spec = getDistinguishingMarkSpec(mark.type);
        return (spec && spec.defaultLocation) || DEFAULT_LOCATION;
      })();
  return LOCATION_ANCHORS[loc] || LOCATION_ANCHORS[DEFAULT_LOCATION];
};
