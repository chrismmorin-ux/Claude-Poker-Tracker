/**
 * @file migratePlayerLegacyFields.js — pure derivation of Phase 3 identification
 *   fields from legacy fields (PIO G4 v2 Phase 5 — read-side migration).
 *
 * Per audit §11 Migration. Existing records (created pre-Phase-3) hold:
 *   - `ethnicity` (string)   — legacy single-select (e.g., "White/Caucasian")
 *   - `gender` (string)      — "Male" | "Female" | "Non-binary" (PEO-era)
 *   - `hat` (bool)           — legacy headwear flag
 *   - `sunglasses` (bool)    — legacy eyewear flag
 *   - `avatarFeatures` (obj) — manually-picked SVG layers (skin tone, hair,
 *     beard, glasses, hat IDs); used to back-derive identification fields
 *     when nothing else is set
 *
 * The migration is **non-destructive on the new fields**. If a record
 * already has the new field set, the legacy value is ignored. Only
 * unset/empty new fields are derived from legacy data.
 *
 * Pure function — no IDB writes. Editors apply the migration on hydration
 * (so saving the player back persists the derived values), and the render
 * path applies it transparently so display stays consistent before any
 * write happens.
 */

// =============================================================================
// LEGACY → NEW MAPS
// =============================================================================

const LEGACY_GENDER_TO_SEX = {
  male: 'male',
  m: 'male',
  female: 'female',
  f: 'female',
  'non-binary': 'other',
  nonbinary: 'other',
  other: 'other',
};

// Legacy ethnicity strings (from the old PhysicalSection enum) → new tag.
// Values mirror what was in the old DEFAULT_SETTINGS / dropdown labels.
const LEGACY_ETHNICITY_TO_TAG = {
  'white/caucasian': 'caucasian',
  white: 'caucasian',
  caucasian: 'caucasian',
  'black/african american': 'black',
  black: 'black',
  'african american': 'black',
  'african-american': 'black',
  'hispanic/latino': 'hispanic',
  hispanic: 'hispanic',
  latino: 'hispanic',
  asian: 'east-asian',
  'east asian': 'east-asian',
  'east-asian': 'east-asian',
  'south asian': 'south-asian',
  'south-asian': 'south-asian',
  'middle eastern': 'middle-eastern',
  'middle-eastern': 'middle-eastern',
  'native american': 'native-american',
  'pacific islander': 'pacific-islander',
  'mixed/other': 'mixed',
  mixed: 'mixed',
  other: 'mixed',
};

// avatarFeatures.skin tone id → best-guess ethnicity.
// This is back-derivation: a user who manually picked skin.dark almost
// certainly meant a player of African descent. Skin tone IS a load-bearing
// signal here (per the binding owner stance — identification utility wins).
const LEGACY_SKIN_TO_ETHNICITY = {
  'skin.very-light': 'caucasian',
  'skin.light': 'caucasian',
  'skin.medium': 'middle-eastern',
  'skin.tan': 'hispanic',
  'skin.brown': 'black',
  'skin.dark': 'black',
};

// avatarFeatures.hair shape ID → new hair length / texture.
// Some shapes encode length, some encode texture; map both.
// 2026-05-06: hair.buzz now maps to 'buzz' (the new hairLength option),
// not 'shaved'. Owner clarified that "Shaved" means head shaved clean
// (no visible hair) while "Buzz cut" has visible stubble — these are
// distinct, and the legacy migration was conflating them.
const AVATAR_HAIR_TO_LENGTH = {
  'hair.none': 'bald',
  'hair.buzz': 'buzz',
  'hair.short-wavy': 'short',
  'hair.side-part': 'short',
  'hair.medium': 'medium',
  'hair.long': 'long',
  'hair.receding': 'short',
  'hair.curly': 'short',
  'hair.braided': 'long',
  'hair.slick-back': 'short',
  'hair.combover': 'short',
};
const AVATAR_HAIR_TO_TEXTURE = {
  'hair.curly': 'curly',
  'hair.braided': 'braided',
  'hair.receding': 'receding',
  // Others are 'straight' — implicit default; don't overwrite.
};

// avatarFeatures.hairColor (color.* id) → new hairColor input.
const AVATAR_HAIRCOLOR_TO_INPUT = {
  'color.black': 'black',
  'color.dark-brown': 'dark-brown',
  'color.brown': 'brown',
  'color.light-brown': 'light-brown',
  'color.blonde': 'blonde',
  'color.red': 'red',
  'color.salt-pepper': 'salt-pepper',
  'color.gray': 'gray',
  'color.white': 'white',
};

// avatarFeatures.beard (beard.* id) → new facialHair.
const AVATAR_BEARD_TO_FACIAL = {
  'beard.none': 'clean',
  'beard.stubble': 'stubble',
  'beard.mustache': 'mustache',
  'beard.goatee': 'goatee',
  'beard.full': 'full',
  'beard.soul-patch': 'soul-patch',
  'beard.chin-strap': 'goatee', // closest existing new option
};

// avatarFeatures.glasses (glasses.* id) → new eyewear.
const AVATAR_GLASSES_TO_EYEWEAR = {
  'glasses.none': 'none',
  'glasses.round': 'clear',
  'glasses.square': 'clear',
  'glasses.aviator': 'aviators',
  'glasses.shades': 'sunglasses',
  'glasses.horn-rim': 'readers',
};

// avatarFeatures.hat (hat.* id) → new headwear.
const AVATAR_HAT_TO_HEADWEAR = {
  'hat.none': null,
  'hat.cap': 'cap',
  'hat.beanie': 'beanie',
  'hat.fedora': 'fedora',
  'hat.cowboy': 'cowboy',
  'hat.visor': 'visor',
};

// =============================================================================
// PRIMARY MIGRATION
// =============================================================================

const isUnset = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

const norm = (s) => (s || '').toString().trim().toLowerCase();

/**
 * Derive Phase-3 identification fields from legacy fields.
 *
 * Returns a new object — does not mutate the input.
 * Only fills gaps in new fields; never overwrites set values.
 *
 * @param {Object} player — any player record (legacy, partially migrated, or new)
 * @returns {Object} player with derived fields filled in
 */
export const migratePlayerLegacyFields = (player) => {
  if (!player || typeof player !== 'object') return player;

  const out = { ...player };
  const av = out.avatarFeatures || {};

  // --- sex ---
  if (isUnset(out.sex) && !isUnset(out.gender)) {
    const derived = LEGACY_GENDER_TO_SEX[norm(out.gender)];
    if (derived) out.sex = derived;
  }

  // --- ethnicityTags ---
  if (isUnset(out.ethnicityTags)) {
    const derived = [];
    if (!isUnset(out.ethnicity)) {
      const tag = LEGACY_ETHNICITY_TO_TAG[norm(out.ethnicity)];
      if (tag) derived.push(tag);
    }
    // Back-derive from avatarFeatures.skin if still empty
    if (derived.length === 0 && av.skin) {
      const tag = LEGACY_SKIN_TO_ETHNICITY[av.skin];
      if (tag) derived.push(tag);
    }
    if (derived.length > 0) out.ethnicityTags = derived;
  }

  // --- hair (length + texture + color) ---
  if (isUnset(out.hairLength) && av.hair) {
    const len = AVATAR_HAIR_TO_LENGTH[av.hair];
    if (len) out.hairLength = len;
  }
  if (isUnset(out.hairTexture) && av.hair) {
    const tex = AVATAR_HAIR_TO_TEXTURE[av.hair];
    if (tex) out.hairTexture = tex;
  }
  if (isUnset(out.hairColor) && av.hairColor) {
    const c = AVATAR_HAIRCOLOR_TO_INPUT[av.hairColor];
    if (c) out.hairColor = c;
  }

  // --- facialHair ---
  if (isUnset(out.facialHair)) {
    if (av.beard) {
      const fh = AVATAR_BEARD_TO_FACIAL[av.beard];
      if (fh) out.facialHair = fh;
    }
    // No legacy non-avatarFeatures source for facialHair beyond
    // the existing string field, which already lives at out.facialHair.
  }

  // --- eyewear ---
  if (isUnset(out.eyewear)) {
    if (av.glasses) {
      const e = AVATAR_GLASSES_TO_EYEWEAR[av.glasses];
      if (e) out.eyewear = e;
    } else if (out.sunglasses === true) {
      out.eyewear = 'sunglasses';
    }
  }

  // --- headwear (player-record level; this is the "always wears X" hint;
  //    per-sighting headwear lives separately in Phase 6) ---
  if (isUnset(out.headwear)) {
    if (av.hat) {
      const h = AVATAR_HAT_TO_HEADWEAR[av.hat];
      if (h) out.headwear = h;
    } else if (out.hat === true) {
      out.headwear = 'cap'; // generic-cap fallback for legacy bool
    }
  }

  // --- build (unchanged: legacy field name === new field name) ---
  // Just normalize case if present.
  if (!isUnset(out.build) && typeof out.build === 'string') {
    const b = norm(out.build);
    if (b === 'slim' || b === 'average' || b === 'heavy' || b === 'muscular') {
      out.build = b;
    }
  }

  return out;
};

// Export the maps too, for tests + downstream consumers.
export {
  LEGACY_GENDER_TO_SEX,
  LEGACY_ETHNICITY_TO_TAG,
  LEGACY_SKIN_TO_ETHNICITY,
  AVATAR_HAIR_TO_LENGTH,
  AVATAR_HAIR_TO_TEXTURE,
  AVATAR_HAIRCOLOR_TO_INPUT,
  AVATAR_BEARD_TO_FACIAL,
  AVATAR_GLASSES_TO_EYEWEAR,
  AVATAR_HAT_TO_HEADWEAR,
};
