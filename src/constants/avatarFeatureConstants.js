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

// Skin tones — Fitzpatrick-inspired range, perceptually spaced
export const SKIN_TONES = [
  { id: 'skin.very-light', label: 'Very Light', hex: '#f3d5b5' },
  { id: 'skin.light',      label: 'Light',      hex: '#e6b89c' },
  { id: 'skin.medium',     label: 'Medium',     hex: '#c68863' },
  { id: 'skin.tan',        label: 'Tan',        hex: '#a16e4a' },
  { id: 'skin.brown',      label: 'Brown',      hex: '#7a4e2c' },
  { id: 'skin.dark',       label: 'Dark',       hex: '#4c2c18' },
];

// Hair colors — shared by scalp hair and beard
// `salt-pepper` is a perceptual mix between dark and gray, common at 40s-60s.
// Hex chosen as midpoint between dark-brown (#3b2416) and gray (#8a8a8a) with a
// slight desaturation toward neutral; reads as "graying brown" at small sizes.
export const HAIR_COLORS = [
  { id: 'color.black',        label: 'Black',         hex: '#1b1714' },
  { id: 'color.dark-brown',   label: 'Dark Brown',    hex: '#3b2416' },
  { id: 'color.brown',        label: 'Brown',         hex: '#5b3a1f' },
  { id: 'color.light-brown',  label: 'Light Brown',   hex: '#8a5a34' },
  { id: 'color.blonde',       label: 'Blonde',        hex: '#c9a060' },
  { id: 'color.red',          label: 'Red',           hex: '#a24219' },
  { id: 'color.salt-pepper',  label: 'Salt & Pepper', hex: '#605449' },
  { id: 'color.gray',         label: 'Gray',          hex: '#8a8a8a' },
  { id: 'color.white',        label: 'White',         hex: '#e8e4de' },
];

// Eye colors — use-if-rendered
export const EYE_COLORS = [
  { id: 'eye-color.brown',  label: 'Brown',  hex: '#5b3a1f' },
  { id: 'eye-color.hazel',  label: 'Hazel',  hex: '#8b6a3a' },
  { id: 'eye-color.green',  label: 'Green',  hex: '#3d6b3a' },
  { id: 'eye-color.blue',   label: 'Blue',   hex: '#2c5e82' },
  { id: 'eye-color.gray',   label: 'Gray',   hex: '#6b7076' },
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
  skin: 'skin.medium',
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

// =============================================================================
// VIEWBOX — shared by all feature SVG paths
// =============================================================================

// All feature paths are authored against this 100×100 viewBox.
// AvatarRenderer scales via width/height props; internal coordinates don't change.
export const AVATAR_VIEWBOX = '0 0 100 100';
export const AVATAR_VIEWBOX_SIZE = 100;
