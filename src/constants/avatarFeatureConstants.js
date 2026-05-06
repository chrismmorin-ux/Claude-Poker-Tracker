/**
 * avatarFeatureConstants.js — Avatar feature palettes + layer metadata (PEO-1)
 *
 * Namespaced feature IDs (e.g. "hair.short-wavy") are the canonical identifiers.
 * Colors are CSS custom properties applied at the root <svg> element so paths
 * reference var(--skin) / var(--hair) / var(--beard) / var(--eye) once.
 *
 * Adding a new feature:
 *   1. Add its path definition to src/assets/avatarFeatures/<category>.js
 *   2. Ensure the id is namespaced: "<category>.<kebab-name>"
 *   3. If a new color surface is needed, extend PALETTES and LAYER_TO_COLOR_VAR
 */

// =============================================================================
// COLOR PALETTES
// =============================================================================

// Skin tones — Fitzpatrick-inspired range, perceptually spaced.
// `ruddy` is a flushed/pink-cast variant — owner-confirmed 2026-05-06:
// "the reddish hue is often from very pale people who get flushed easily,
// so it should be next to light skin." Order: very-light → ruddy → light
// → tan → brown → dark.
//
// `medium` was removed 2026-05-06 (owner: "lets get rid of medium and let
// it jump straight from light to tan"). Legacy records / ethnicity-derived
// values that pointed at `skin.medium` migrate to `skin.tan` on read via
// SKIN_TONE_NORMALIZED in avatarMapping.js.
export const SKIN_TONES = [
  { id: 'skin.very-light', label: 'Very Light', hex: '#f3d5b5' },
  { id: 'skin.ruddy',      label: 'Ruddy',      hex: '#e8a890' },
  { id: 'skin.light',      label: 'Light',      hex: '#e6b89c' },
  { id: 'skin.tan',        label: 'Tan',        hex: '#a16e4a' },
  { id: 'skin.brown',      label: 'Brown',      hex: '#7a4e2c' },
  { id: 'skin.dark',       label: 'Dark',       hex: '#4c2c18' },
];

// Hair colors — shared by scalp hair and beard.
// `salt-pepper` is a perceptual mix between dark and gray, common at 40s-60s.
//
// Order revised 2026-05-06 per owner: white → gray → salt-pepper → red →
// blonde → light-brown → brown → dark-brown → black. Salt-pepper sits next
// to gray (its luminance neighbor); red sits as a warm-medium outlier
// before the brown-family ladder. The COLOR-GRADIENT light→dark spirit
// still holds within the brown family; red and salt-pepper are the
// non-ladder outliers placed by perceptual category, not strict luminance.
export const HAIR_COLORS = [
  { id: 'color.white',        label: 'White',         hex: '#e8e4de' },
  { id: 'color.gray',         label: 'Gray',          hex: '#8a8a8a' },
  { id: 'color.salt-pepper',  label: 'Salt & Pepper', hex: '#605449' },
  { id: 'color.red',          label: 'Red',           hex: '#a24219' },
  { id: 'color.blonde',       label: 'Blonde',        hex: '#c9a060' },
  { id: 'color.light-brown',  label: 'Light Brown',   hex: '#8a5a34' },
  { id: 'color.brown',        label: 'Brown',         hex: '#5b3a1f' },
  { id: 'color.dark-brown',   label: 'Dark Brown',    hex: '#3b2416' },
  { id: 'color.black',        label: 'Black',         hex: '#1b1714' },
];

// Eye colors — use-if-rendered
export const EYE_COLORS = [
  { id: 'eye-color.brown',  label: 'Brown',  hex: '#5b3a1f' },
  { id: 'eye-color.hazel',  label: 'Hazel',  hex: '#8b6a3a' },
  { id: 'eye-color.green',  label: 'Green',  hex: '#3d6b3a' },
  { id: 'eye-color.blue',   label: 'Blue',   hex: '#2c5e82' },
  { id: 'eye-color.gray',   label: 'Gray',   hex: '#6b7076' },
];

// Clothing colors — used by per-sighting outfit capture (hat/top/bottom/
// jewelry/other/glasses). Distinct namespace from skin/hair so they don't
// collide in lookup tables. Ordered: neutrals (light → dark) → warm hues
// → cool hues → metallics. Owner-confirmed 2026-05-06: gold + silver as
// metallic options for jewelry / framework / hardware capture.
export const CLOTHING_COLORS = [
  // Neutrals (light → dark)
  { id: 'cloth.white',    label: 'White',  hex: '#f5f5f5' },
  { id: 'cloth.gray',     label: 'Gray',   hex: '#7c8189' },
  { id: 'cloth.black',    label: 'Black',  hex: '#1f1f1f' },
  // Warm hues
  { id: 'cloth.yellow',   label: 'Yellow', hex: '#f1c233' },
  { id: 'cloth.orange',   label: 'Orange', hex: '#e87a1f' },
  { id: 'cloth.red',      label: 'Red',    hex: '#c8302c' },
  { id: 'cloth.pink',     label: 'Pink',   hex: '#e07ca0' },
  { id: 'cloth.brown',    label: 'Brown',  hex: '#6a4426' },
  // Cool hues
  { id: 'cloth.green',    label: 'Green',  hex: '#2f7a3a' },
  { id: 'cloth.blue',     label: 'Blue',   hex: '#2a78c2' },
  { id: 'cloth.navy',     label: 'Navy',   hex: '#1c2c52' },
  { id: 'cloth.purple',   label: 'Purple', hex: '#6a3aa1' },
  // Metallics — common on jewelry, frames, watches, belt buckles
  { id: 'cloth.gold',     label: 'Gold',   hex: '#d4a847' },
  { id: 'cloth.silver',   label: 'Silver', hex: '#a8acb0' },
];

// Eyewear (glasses) frame colors — selectable like other accessories
export const EYEWEAR_COLORS = [
  { id: 'frame.black',          label: 'Black',          hex: '#1b1714' },
  { id: 'frame.brown',          label: 'Brown',          hex: '#3b2416' },
  { id: 'frame.tortoiseshell',  label: 'Tortoiseshell',  hex: '#7a4a1f' },
  { id: 'frame.gold',           label: 'Gold',           hex: '#b8893a' },
  { id: 'frame.silver',         label: 'Silver',         hex: '#a8acb0' },
  { id: 'frame.red',            label: 'Red',            hex: '#9c2828' },
  { id: 'frame.blue',           label: 'Blue',           hex: '#2a4a7a' },
];

// =============================================================================
// LAYER ORDER
// =============================================================================

// Rendering order for AvatarRenderer. Declarative so layer composition does
// not depend on object-key iteration (which is not order-guaranteed).
export const LAYER_ORDER = [
  'skin',       // face shape, neck
  'beard',      // beard style (below hair so hair can overlap sideburns)
  'hair',       // scalp hair style
  'eyes',       // eye shape + iris color
  'glasses',    // glasses frames (above eyes)
  'hat',        // hat (top layer)
];

// CSS custom property each category's paths should reference for color.
// "shape" layers (hair, beard, glasses) read from their own color var.
// "style" layers with fixed palettes (hat) use their own per-style constants.
export const LAYER_TO_COLOR_VAR = {
  skin: '--skin',
  beard: '--beard',
  hair: '--hair',
  eyes: '--eye',
  glasses: '--frame',
  hat: null, // hats use per-style fixed colors
};

// =============================================================================
// FEATURE ID NAMESPACE HELPERS
// =============================================================================

/**
 * Parse a namespaced feature ID into its category + name.
 * @param {string} featureId e.g. "hair.short-wavy"
 * @returns {{ category: string, name: string } | null}
 */
export const parseFeatureId = (featureId) => {
  if (typeof featureId !== 'string' || !featureId.includes('.')) return null;
  const [category, ...rest] = featureId.split('.');
  if (!category || rest.length === 0) return null;
  return { category, name: rest.join('.') };
};

/**
 * Build the canonical "none" ID for a category.
 * @param {string} category e.g. "beard"
 * @returns {string} e.g. "beard.none"
 */
export const noneIdFor = (category) => `${category}.none`;

// =============================================================================
// CATEGORIES + DEFAULTS
// =============================================================================

// Categories rendered in the AvatarRenderer. Must match file names under
// src/assets/avatarFeatures/.
export const AVATAR_CATEGORIES = [
  'skin', 'hair', 'beard', 'eyes', 'glasses', 'hat',
];

// Default feature IDs when a category is missing from avatarFeatures.
// Chosen so that a legacy (all-missing) record still renders a recognizable
// neutral face via AvatarMonogram — not through the renderer.
export const DEFAULT_AVATAR_FEATURES = {
  // skin default moved from skin.medium → skin.tan when medium was removed.
  skin: 'skin.tan',
  hair: 'hair.none',
  hairColor: 'color.black',
  beard: 'beard.none',
  beardColor: 'color.black',
  eyes: 'eyes.round',
  eyeColor: 'eye-color.brown',
  glasses: 'glasses.none',
  eyewearColor: 'frame.black',
  hat: 'hat.none',
};

// =============================================================================
// COLOR LOOKUP HELPERS
// =============================================================================

const SKIN_BY_ID = Object.fromEntries(SKIN_TONES.map(t => [t.id, t]));
const HAIR_COLOR_BY_ID = Object.fromEntries(HAIR_COLORS.map(c => [c.id, c]));
const EYE_COLOR_BY_ID = Object.fromEntries(EYE_COLORS.map(c => [c.id, c]));
const EYEWEAR_COLOR_BY_ID = Object.fromEntries(EYEWEAR_COLORS.map(c => [c.id, c]));

export const getSkinTone = (id) => SKIN_BY_ID[id] || SKIN_BY_ID[DEFAULT_AVATAR_FEATURES.skin];
export const getHairColor = (id) => HAIR_COLOR_BY_ID[id] || HAIR_COLOR_BY_ID[DEFAULT_AVATAR_FEATURES.hairColor];
export const getEyeColor = (id) => EYE_COLOR_BY_ID[id] || EYE_COLOR_BY_ID[DEFAULT_AVATAR_FEATURES.eyeColor];
export const getEyewearColor = (id) => EYEWEAR_COLOR_BY_ID[id] || EYEWEAR_COLOR_BY_ID[DEFAULT_AVATAR_FEATURES.eyewearColor];

// Clothing color lookup — accepts either a bare key ('blue') or a full id
// ('cloth.blue'). Returns the matching CLOTHING_COLORS entry or null when
// the input doesn't match. Used by avatarMapping to resolve hat color
// (the avatar's hat layer recolors via --hat / --hat-trim CSS vars).
const CLOTHING_BY_KEY = Object.fromEntries(
  CLOTHING_COLORS.map((c) => [c.id.replace(/^cloth\./, ''), c]),
);
const CLOTHING_BY_ID = Object.fromEntries(CLOTHING_COLORS.map((c) => [c.id, c]));
export const getClothingColor = (input) => {
  if (!input) return null;
  const k = input.toString().toLowerCase();
  return CLOTHING_BY_KEY[k] || CLOTHING_BY_ID[k] || null;
};

// =============================================================================
// VIEWBOX — shared by all feature SVG paths
// =============================================================================

// All feature paths are authored against this 100×100 viewBox.
// AvatarRenderer scales via width/height props; internal coordinates don't change.
export const AVATAR_VIEWBOX = '0 0 100 100';
export const AVATAR_VIEWBOX_SIZE = 100;
