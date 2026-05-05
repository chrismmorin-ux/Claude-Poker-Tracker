/**
 * @file playerFilterRange.js — fuzzy/range matching for the picker.
 *
 * Owner contract (2026-05-05): "lets make the fields that make sense to be
 * a range (where it's easy to accidentally pick one rather than the other
 * and accidentally exclude a potential match)."
 *
 * Range axes (this file):
 *   - skinTone     — 7 swatches, easy to confuse adjacent tones at glance
 *   - ageDecade    — 6 buckets, late-30s vs early-40s blurs
 *   - hairColor    — natural-darkness ladder; reds/grays/whites are distinct
 *   - beardColor   — same palette + ladder as hairColor
 *   - hairLength   — 5-step bald → long; adjacent confusable
 *   - build        — slim/average/heavy/muscular — size + fitness graph
 *
 * Strict axes (NOT in this file — picker uses exact string match):
 *   sex, ethnicityTags (already OR-multi), hairTexture, facialHair,
 *   eyewear, eyewearColor, headwear.
 *
 * Implementation: each range axis is a NEIGHBORS map from value → set of
 * acceptable matching values (always inclusive of self). `matchesInRange`
 * returns true when the player's value is in the filter's neighbor set.
 */

// Skin tone — light/medium/dark ladder, with `ruddy` treated as a
// pink-cast variant of light (NOT on the darkness ladder past medium).
export const SKIN_TONE_NEIGHBORS = {
  'very-light': ['very-light', 'light', 'ruddy'],
  'light':      ['very-light', 'light', 'ruddy', 'medium'],
  'ruddy':      ['very-light', 'light', 'ruddy'],
  'medium':     ['light', 'medium', 'tan'],
  'tan':        ['medium', 'tan', 'brown'],
  'brown':      ['tan', 'brown', 'dark'],
  'dark':       ['brown', 'dark'],
};

// Age decade — ±1 bucket on the ladder.
export const AGE_DECADE_NEIGHBORS = {
  '<20':  ['<20', '20s'],
  '20s':  ['<20', '20s', '30s'],
  '30s':  ['20s', '30s', '40s'],
  '40s':  ['30s', '40s', '50s'],
  '50s':  ['40s', '50s', '60s+'],
  '60s+': ['50s', '60s+'],
};

// Hair color — natural-darkness ladder for the brown family; red / gray /
// white / salt-pepper are distinct (gray ↔ white as aging-neighbors).
export const HAIR_COLOR_NEIGHBORS = {
  'black':         ['black', 'dark-brown'],
  'dark-brown':    ['black', 'dark-brown', 'brown'],
  'brown':         ['dark-brown', 'brown', 'light-brown'],
  'light-brown':   ['brown', 'light-brown', 'blonde'],
  'blonde':        ['light-brown', 'blonde'],
  'red':           ['red'],
  'salt-pepper':   ['salt-pepper', 'gray'],
  'gray':          ['salt-pepper', 'gray', 'white'],
  'white':         ['gray', 'white'],
};

// Beard color uses the same palette as hair color.
export const BEARD_COLOR_NEIGHBORS = HAIR_COLOR_NEIGHBORS;

// Hair length — 5-step ladder, ±1.
export const HAIR_LENGTH_NEIGHBORS = {
  'bald':   ['bald', 'shaved'],
  'shaved': ['bald', 'shaved', 'short'],
  'short':  ['shaved', 'short', 'medium'],
  'medium': ['short', 'medium', 'long'],
  'long':   ['medium', 'long'],
};

// Build — slim/average/heavy is a size ladder; muscular is "athletic"
// which often visually overlaps with average + heavy frames.
export const BUILD_NEIGHBORS = {
  'slim':      ['slim', 'average'],
  'average':   ['slim', 'average', 'heavy', 'muscular'],
  'heavy':     ['average', 'heavy', 'muscular'],
  'muscular':  ['average', 'heavy', 'muscular'],
};

// Lookup of filterKey → neighbors map. The picker walks this to decide
// whether an axis uses range matching.
export const RANGE_NEIGHBORS_BY_AXIS = {
  skinTone:    SKIN_TONE_NEIGHBORS,
  ageDecade:   AGE_DECADE_NEIGHBORS,
  hairColor:   HAIR_COLOR_NEIGHBORS,
  beardColor:  BEARD_COLOR_NEIGHBORS,
  hairLength:  HAIR_LENGTH_NEIGHBORS,
  build:       BUILD_NEIGHBORS,
};

/**
 * Does the player's value belong to the filter's neighbor set on this axis?
 * Returns false if axis isn't a range axis (caller should fall through to
 * exact-match logic).
 */
export const matchesInRange = (axis, filterValue, playerValue) => {
  const map = RANGE_NEIGHBORS_BY_AXIS[axis];
  if (!map) return null; // axis is not range-based; caller should exact-match
  if (!filterValue) return true;       // no filter → matches
  if (!playerValue) return true;        // permissive on null player
  const neighbors = map[filterValue.toLowerCase()];
  if (!neighbors) {
    // Unknown filter value (palette drift) — fall back to exact match
    return playerValue.toLowerCase() === filterValue.toLowerCase();
  }
  return neighbors.includes(playerValue.toLowerCase());
};
