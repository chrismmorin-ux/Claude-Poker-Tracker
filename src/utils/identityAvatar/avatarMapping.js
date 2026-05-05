/**
 * @file avatarMapping.js — Pure function: identification fields → avatarFeatures
 *
 * Single source of truth for how identification fields drive the avatar.
 * Per docs/design/audits/2026-05-04-gate4v2-design-player-identification-v2.md §9.
 *
 * The avatar IS the visualization of identification data — there is no manual
 * override layer (AvatarFeatureBuilder is killed in Phase 3 of v2). Every
 * field a user enters in the editor flows through this function and into
 * the rendered SVG.
 *
 * Shape returned matches what AvatarRenderer consumes (avatarFeatures object
 * with skin/hair/hairColor/beard/beardColor/eyes/eyeColor/glasses/hat keys),
 * so we reuse all existing SVG primitives without rewrite.
 *
 * Pure function — no side effects, no IDB access, no React. Safe to call in
 * render or in tests.
 *
 * Phase 1 (this file) implements every mapping the existing SVG asset set
 * supports. Gaps marked with FUTURE-V2 comments will land in later phases:
 *   - sex → silhouette base (needs new SVG masculine/feminine/androgynous shapes)
 *   - build → silhouette weight (needs new SVG variants)
 *   - distinguishingMarks → overlay badges (needs new SVG icons)
 */

import {
  DEFAULT_AVATAR_FEATURES,
} from '../../constants/avatarFeatureConstants';

// =============================================================================
// SEX + BUILD → SILHOUETTE
// =============================================================================

/**
 * Map sex to its silhouette base. Unknown/null defaults to 'other' (androgynous).
 */
const SEX_NORMALIZED = {
  male: 'male',
  m: 'male',
  female: 'female',
  f: 'female',
  other: 'other',
  'non-binary': 'other',
  nonbinary: 'other',
};

/**
 * Map build to its shoulder shape. Unknown defaults to 'average'.
 */
const BUILD_NORMALIZED = {
  slim: 'slim',
  thin: 'slim',
  average: 'average',
  medium: 'average',
  heavy: 'heavy',
  large: 'heavy',
  muscular: 'muscular',
  athletic: 'muscular',
};

/**
 * Derive the silhouette feature id from sex + build.
 *
 * @param {string} sex - 'male' | 'female' | 'other' | null
 * @param {string} build - 'slim' | 'average' | 'heavy' | 'muscular' | null
 * @returns {string} silhouette feature id (e.g., 'silhouette.male-average')
 */
export const silhouetteFromIdentity = (sex, build) => {
  const sexKey = SEX_NORMALIZED[(sex || '').toLowerCase()] || 'other';
  const buildKey = BUILD_NORMALIZED[(build || '').toLowerCase()] || 'average';
  return `silhouette.${sexKey}-${buildKey}`;
};

// =============================================================================
// ETHNICITY → SKIN TONE
// =============================================================================

/**
 * Per-ethnicity preferred skin tone. Multi-tag ethnicity records pick the
 * first matching tag. "Mixed" records would average if we had a blender; for
 * now we pick the first listed tag, which matches user-stated primary identity.
 *
 * Tones defined in src/constants/avatarFeatureConstants.js SKIN_TONES.
 */
const ETHNICITY_TO_SKIN = {
  caucasian: 'skin.very-light',
  white: 'skin.very-light',
  'white/caucasian': 'skin.very-light',
  hispanic: 'skin.tan',
  'hispanic/latino': 'skin.tan',
  'east-asian': 'skin.light',
  asian: 'skin.light',
  'south-asian': 'skin.medium',
  'south asian': 'skin.medium',
  black: 'skin.brown',
  'black/african american': 'skin.brown',
  'african-american': 'skin.brown',
  'middle-eastern': 'skin.medium',
  'middle eastern': 'skin.medium',
  'native-american': 'skin.tan',
  'pacific-islander': 'skin.tan',
  mixed: 'skin.medium',
  'mixed/other': 'skin.medium',
};

const normalizeEthnicityTag = (tag) =>
  (tag || '').toString().trim().toLowerCase();

/**
 * Map ethnicityTags (array) or legacy ethnicity (string) to a skin tone id.
 * Returns DEFAULT_AVATAR_FEATURES.skin if no match.
 */
export const skinFromEthnicity = (ethnicityTags, legacyEthnicity) => {
  const tags = Array.isArray(ethnicityTags) && ethnicityTags.length > 0
    ? ethnicityTags
    : (legacyEthnicity ? [legacyEthnicity] : []);
  for (const raw of tags) {
    const tone = ETHNICITY_TO_SKIN[normalizeEthnicityTag(raw)];
    if (tone) return tone;
  }
  return DEFAULT_AVATAR_FEATURES.skin;
};

// =============================================================================
// HAIR LENGTH + TEXTURE → HAIR SHAPE
// =============================================================================

/**
 * Texture is a SHAPE override — when present, it wins over length because
 * curly/braided/receding are visually dominant features. "straight" defers
 * to length (default texture).
 *
 * Existing primitives wired:
 *   - hair.curly (existing asset)
 *   - hair.braided (new — added to assets/avatarFeatures/hair.js)
 *   - hair.receding (existing asset)
 */
const HAIR_TEXTURE_TO_SHAPE = {
  curly: 'hair.curly',
  braided: 'hair.braided',
  receding: 'hair.receding',
};

/**
 * Map hairLength to existing hair shape feature ids. Defaults to short-wavy
 * when unspecified — produces a recognizable head of hair without committing
 * to a particular style.
 */
const HAIR_LENGTH_TO_SHAPE = {
  bald: 'hair.none',
  shaved: 'hair.buzz',
  short: 'hair.short-wavy',
  medium: 'hair.medium',
  long: 'hair.long',
};

/**
 * Resolve hair shape from texture (priority) and length (fallback).
 *
 * Bald/shaved are length-driven and win over texture (no point texturing
 * absent hair). Otherwise texture overrides length when present.
 */
export const hairShapeFromLength = (hairLength, hairTexture) => {
  const lengthKey = (hairLength || '').toLowerCase();
  // Length-priority cases: bald or shaved scalp leaves no surface for texture
  if (lengthKey === 'bald') return 'hair.none';
  if (lengthKey === 'shaved') return 'hair.buzz';

  const textureKey = (hairTexture || '').toLowerCase();
  if (textureKey && HAIR_TEXTURE_TO_SHAPE[textureKey]) {
    return HAIR_TEXTURE_TO_SHAPE[textureKey];
  }

  return HAIR_LENGTH_TO_SHAPE[lengthKey] || 'hair.short-wavy';
};

// =============================================================================
// HAIR COLOR (with age modulation toward gray)
// =============================================================================

/**
 * Map a hairColor input to the existing color.* id. Applies age-modulated
 * gray-bias for older players. The bias matches typical observable graying:
 *   - 20s-30s: no shift
 *   - 40s: 15% chance of gray-shift (we don't randomize; instead nudge dark-brown
 *     → brown, brown → light-brown for visibility)
 *   - 50s: meaningful gray bias — dark colors → gray
 *   - 60s+: heavy gray-to-white — most colors → gray, gray → white
 *
 * Deterministic mapping (no randomness) so the avatar is stable across renders.
 */
const HAIR_COLOR_NORMALIZED = {
  black: 'color.black',
  'dark-brown': 'color.dark-brown',
  brown: 'color.brown',
  'light-brown': 'color.light-brown',
  blonde: 'color.blonde',
  red: 'color.red',
  'salt-pepper': 'color.salt-pepper',
  'salt and pepper': 'color.salt-pepper',
  saltpepper: 'color.salt-pepper',
  'salt-and-pepper': 'color.salt-pepper',
  gray: 'color.gray',
  white: 'color.white',
  bald: 'color.black', // hair-color irrelevant when bald
};

const AGE_DECADE_GRAY_SHIFT = {
  '<20': 0,
  '20s': 0,
  '30s': 0,
  '40s': 1,  // 1-step nudge → typically into salt-pepper for dark colors
  '50s': 2,  // 2-step nudge → toward gray
  '60s+': 3, // dominant gray-to-white
};

/**
 * Per-base-color age progression table.
 * Index 0 = no shift (20s/30s)
 * Index 1 = 40s — adds salt-pepper for darker colors (more realistic than
 *           jumping straight to gray)
 * Index 2 = 50s — toward gray
 * Index 3 = 60s+ — toward white
 *
 * salt-pepper is a destination color but never a base — once a player has
 * salt-pepper hair, age doesn't darken it (graying is monotonic).
 */
const GRAY_SHIFT_TABLE = {
  'color.black':        ['color.black',       'color.salt-pepper', 'color.gray',  'color.gray'],
  'color.dark-brown':   ['color.dark-brown',  'color.salt-pepper', 'color.gray',  'color.gray'],
  'color.brown':        ['color.brown',       'color.salt-pepper', 'color.gray',  'color.gray'],
  'color.light-brown':  ['color.light-brown', 'color.salt-pepper', 'color.gray',  'color.gray'],
  'color.blonde':       ['color.blonde',      'color.blonde',      'color.white', 'color.white'],
  'color.red':          ['color.red',         'color.red',         'color.salt-pepper', 'color.gray'],
  'color.salt-pepper':  ['color.salt-pepper', 'color.salt-pepper', 'color.gray',  'color.white'],
  'color.gray':         ['color.gray',        'color.gray',        'color.gray',  'color.white'],
  'color.white':        ['color.white',       'color.white',       'color.white', 'color.white'],
};

export const hairColorFromIdentity = (hairColor, ageDecade) => {
  const baseId = HAIR_COLOR_NORMALIZED[(hairColor || '').toLowerCase()]
    || DEFAULT_AVATAR_FEATURES.hairColor;
  const shift = AGE_DECADE_GRAY_SHIFT[ageDecade] ?? 0;
  const ladder = GRAY_SHIFT_TABLE[baseId] || [baseId, baseId, baseId, baseId];
  return ladder[Math.min(shift, ladder.length - 1)];
};

// =============================================================================
// FACIAL HAIR
// =============================================================================

const FACIAL_HAIR_NORMALIZED = {
  none: 'beard.none',
  'clean-shaven': 'beard.none',
  clean: 'beard.none',
  stubble: 'beard.stubble',
  goatee: 'beard.goatee',
  mustache: 'beard.mustache',
  full: 'beard.full',
  'full beard': 'beard.full',
  'full-beard': 'beard.full',
  'soul-patch': 'beard.soul-patch',
  'soul patch': 'beard.soul-patch',
  'van-dyke': 'beard.goatee', // closest existing primitive
  'van dyke': 'beard.goatee',
};

/**
 * Map facialHair to existing beard.* id. For sex='female' or 'other',
 * suppress beard rendering unless explicitly tagged (don't auto-render
 * facial hair on feminine silhouettes).
 */
export const beardFromIdentity = (facialHair, sex) => {
  if (sex === 'female') return 'beard.none';
  return FACIAL_HAIR_NORMALIZED[(facialHair || '').toLowerCase()] || 'beard.none';
};

// =============================================================================
// EYEWEAR
// =============================================================================

const EYEWEAR_NORMALIZED = {
  none: 'glasses.none',
  clear: 'glasses.round',           // default to round for "clear glasses"
  'clear-glasses': 'glasses.round',
  glasses: 'glasses.round',
  sunglasses: 'glasses.shades',
  shades: 'glasses.shades',
  readers: 'glasses.horn-rim',      // readers map to horn-rim aesthetically
  aviators: 'glasses.aviator',
  square: 'glasses.square',
};

export const glassesFromEyewear = (eyewear) =>
  EYEWEAR_NORMALIZED[(eyewear || '').toLowerCase()] || 'glasses.none';

// Legacy: map old { hat: bool, sunglasses: bool } from PhysicalSection.
// Once Phase 3 ships, the editor only writes the new fields and this becomes
// dead. Until then, callers may pass legacy bools as fallback.
export const glassesFromLegacyBools = (sunglasses) =>
  sunglasses ? 'glasses.shades' : 'glasses.none';

// =============================================================================
// HEADWEAR
// =============================================================================

const HEADWEAR_NORMALIZED = {
  none: 'hat.none',
  cap: 'hat.cap',
  'baseball-cap': 'hat.cap',
  'snapback': 'hat.cap',
  'dad-cap': 'hat.cap',
  beanie: 'hat.beanie',
  visor: 'hat.visor',
  'sun-visor': 'hat.visor',
  cowboy: 'hat.cowboy',
  'cowboy-hat': 'hat.cowboy',
  fedora: 'hat.fedora',
  hat: 'hat.fedora', // generic "hat" → fedora
};

export const hatFromHeadwear = (headwear) =>
  HEADWEAR_NORMALIZED[(headwear || '').toLowerCase()] || 'hat.none';

// =============================================================================
// EYES (deterministic — derived from ethnicity for shape; default brown)
// =============================================================================

/**
 * Eye SHAPE follows a coarse ethnicity prior. Eye color defaults to brown
 * unless caller overrides (we don't currently capture eye color in the
 * identification model — could add later if discrimination value justifies).
 */
const ETHNICITY_TO_EYE_SHAPE = {
  'east-asian': 'eyes.almond',
  asian: 'eyes.almond',
  caucasian: 'eyes.round',
  white: 'eyes.round',
  'white/caucasian': 'eyes.round',
  hispanic: 'eyes.round',
  'hispanic/latino': 'eyes.round',
  black: 'eyes.round',
  'black/african american': 'eyes.round',
  'middle-eastern': 'eyes.round',
  'middle eastern': 'eyes.round',
  'south-asian': 'eyes.round',
};

export const eyeShapeFromEthnicity = (ethnicityTags, legacyEthnicity) => {
  const tags = Array.isArray(ethnicityTags) && ethnicityTags.length > 0
    ? ethnicityTags
    : (legacyEthnicity ? [legacyEthnicity] : []);
  for (const raw of tags) {
    const shape = ETHNICITY_TO_EYE_SHAPE[normalizeEthnicityTag(raw)];
    if (shape) return shape;
  }
  return 'eyes.round';
};

// =============================================================================
// PRIMARY MAPPING
// =============================================================================

/**
 * Map a Player record (identification fields) to an avatarFeatures object
 * suitable for AvatarRenderer.
 *
 * @param {Object} player - Player record. May contain any subset of:
 *   sex, ethnicityTags, ethnicity (legacy), ageDecade,
 *   hairColor, hairLength, hairTexture, facialHair, build, eyewear,
 *   hat (legacy bool), sunglasses (legacy bool),
 *   distinguishingMarks (array), photoBlobId
 * @param {Object} [opts]
 * @param {string|null} [opts.headwearOverride] - Per-sighting headwear override
 *   (e.g., the player wore a beanie today). Defaults to no overlay.
 * @returns {Object} avatarFeatures shape consumed by AvatarRenderer
 */
export const mapIdentityToAvatarFeatures = (player, opts = {}) => {
  if (!player || typeof player !== 'object') {
    return { ...DEFAULT_AVATAR_FEATURES };
  }
  const {
    sex,
    ethnicityTags,
    ethnicity, // legacy
    ageDecade,
    hairColor,
    hairLength,
    hairTexture,
    facialHair,
    build,
    eyewear,
    sunglasses, // legacy bool — used only if eyewear is absent
  } = player;

  const headwearInput = opts.headwearOverride ?? player.headwear ?? null;

  return {
    silhouette: silhouetteFromIdentity(sex, build),
    skin: skinFromEthnicity(ethnicityTags, ethnicity),
    hair: hairShapeFromLength(hairLength, hairTexture),
    hairColor: hairColorFromIdentity(hairColor, ageDecade),
    beard: beardFromIdentity(facialHair, sex),
    beardColor: hairColorFromIdentity(hairColor, ageDecade), // beard matches hair
    eyes: eyeShapeFromEthnicity(ethnicityTags, ethnicity),
    eyeColor: 'eye-color.brown',
    glasses: eyewear !== undefined && eyewear !== null
      ? glassesFromEyewear(eyewear)
      : glassesFromLegacyBools(sunglasses),
    hat: hatFromHeadwear(headwearInput),
  };
};
