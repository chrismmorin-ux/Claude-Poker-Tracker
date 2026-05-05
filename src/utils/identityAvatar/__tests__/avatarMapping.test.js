/**
 * @file avatarMapping.test.js — Pure-function tests for the identification → avatar mapping.
 *
 * Tests the mapping for representative corpus profiles to confirm:
 *   - Deterministic output (same input → same output)
 *   - Sensible mapping (Asian player → Asian skin tone, etc.)
 *   - Age modulation (60s+ player → grayer hair)
 *   - Sex-aware beard suppression (female record → no beard auto-rendered)
 *   - Legacy field fallback (legacy `ethnicity` string still works)
 *   - Empty/null player → DEFAULT_AVATAR_FEATURES
 */

import { describe, it, expect } from 'vitest';
import {
  skinFromEthnicity,
  hairShapeFromLength,
  hairColorFromIdentity,
  beardFromIdentity,
  glassesFromEyewear,
  hatFromHeadwear,
  eyeShapeFromEthnicity,
  silhouetteFromIdentity,
  eyewearColorFromIdentity,
  mapIdentityToAvatarFeatures,
} from '../avatarMapping';
import { DEFAULT_AVATAR_FEATURES } from '../../../constants/avatarFeatureConstants';

describe('silhouetteFromIdentity (sex × build)', () => {
  it('returns silhouette.{sex}-{build} for known inputs', () => {
    expect(silhouetteFromIdentity('male', 'average')).toBe('silhouette.male-average');
    expect(silhouetteFromIdentity('female', 'slim')).toBe('silhouette.female-slim');
    expect(silhouetteFromIdentity('other', 'heavy')).toBe('silhouette.other-heavy');
    expect(silhouetteFromIdentity('male', 'muscular')).toBe('silhouette.male-muscular');
  });

  it('normalizes case and aliases', () => {
    expect(silhouetteFromIdentity('Male', 'Average')).toBe('silhouette.male-average');
    expect(silhouetteFromIdentity('M', 'medium')).toBe('silhouette.male-average');
    expect(silhouetteFromIdentity('Female', 'thin')).toBe('silhouette.female-slim');
    expect(silhouetteFromIdentity('non-binary', 'athletic')).toBe('silhouette.other-muscular');
  });

  it('defaults sex to other when missing/unknown', () => {
    expect(silhouetteFromIdentity(null, 'average')).toBe('silhouette.other-average');
    expect(silhouetteFromIdentity('', 'slim')).toBe('silhouette.other-slim');
    expect(silhouetteFromIdentity('alien', 'heavy')).toBe('silhouette.other-heavy');
  });

  it('defaults build to average when missing/unknown', () => {
    expect(silhouetteFromIdentity('male', null)).toBe('silhouette.male-average');
    expect(silhouetteFromIdentity('male', '')).toBe('silhouette.male-average');
    expect(silhouetteFromIdentity('male', 'jumbo')).toBe('silhouette.male-average');
  });

  it('null+null falls to other-average', () => {
    expect(silhouetteFromIdentity(null, null)).toBe('silhouette.other-average');
  });
});

describe('skinFromEthnicity', () => {
  it('maps Caucasian/white tags to very-light skin', () => {
    expect(skinFromEthnicity(['caucasian'])).toBe('skin.very-light');
    expect(skinFromEthnicity(['white'])).toBe('skin.very-light');
    expect(skinFromEthnicity(['White/Caucasian'])).toBe('skin.very-light');
  });

  it('maps Hispanic to tan', () => {
    expect(skinFromEthnicity(['hispanic'])).toBe('skin.tan');
    expect(skinFromEthnicity(['Hispanic/Latino'])).toBe('skin.tan');
  });

  it('maps East Asian to light', () => {
    expect(skinFromEthnicity(['east-asian'])).toBe('skin.light');
    expect(skinFromEthnicity(['Asian'])).toBe('skin.light');
  });

  it('maps Black to brown', () => {
    expect(skinFromEthnicity(['black'])).toBe('skin.brown');
    expect(skinFromEthnicity(['Black/African American'])).toBe('skin.brown');
  });

  it('maps Middle Eastern to medium', () => {
    expect(skinFromEthnicity(['middle-eastern'])).toBe('skin.medium');
  });

  it('multi-tag picks the first matching tag (primary identity)', () => {
    expect(skinFromEthnicity(['hispanic', 'caucasian'])).toBe('skin.tan');
    expect(skinFromEthnicity(['caucasian', 'hispanic'])).toBe('skin.very-light');
  });

  it('falls back to legacy single ethnicity string when ethnicityTags empty', () => {
    expect(skinFromEthnicity(null, 'Asian')).toBe('skin.light');
    expect(skinFromEthnicity([], 'Hispanic/Latino')).toBe('skin.tan');
  });

  it('falls back to default skin when no ethnicity provided', () => {
    expect(skinFromEthnicity(null, null)).toBe(DEFAULT_AVATAR_FEATURES.skin);
    expect(skinFromEthnicity([], '')).toBe(DEFAULT_AVATAR_FEATURES.skin);
  });

  it('falls back to default for unknown ethnicity tag', () => {
    expect(skinFromEthnicity(['unknown-ethnicity'])).toBe(DEFAULT_AVATAR_FEATURES.skin);
  });
});

describe('hairShapeFromLength (with texture override)', () => {
  it('maps each length to its shape feature when texture is straight', () => {
    expect(hairShapeFromLength('bald')).toBe('hair.none');
    expect(hairShapeFromLength('shaved')).toBe('hair.buzz');
    expect(hairShapeFromLength('short')).toBe('hair.short-wavy');
    expect(hairShapeFromLength('medium')).toBe('hair.medium');
    expect(hairShapeFromLength('long')).toBe('hair.long');
  });

  it('defaults to short-wavy when unspecified', () => {
    expect(hairShapeFromLength(null)).toBe('hair.short-wavy');
    expect(hairShapeFromLength('')).toBe('hair.short-wavy');
    expect(hairShapeFromLength('whatever-unknown')).toBe('hair.short-wavy');
  });

  it('texture=curly overrides any length (visually dominant)', () => {
    expect(hairShapeFromLength('short', 'curly')).toBe('hair.curly');
    expect(hairShapeFromLength('medium', 'curly')).toBe('hair.curly');
    expect(hairShapeFromLength('long', 'curly')).toBe('hair.curly');
  });

  it('texture=braided overrides any length', () => {
    expect(hairShapeFromLength('long', 'braided')).toBe('hair.braided');
    expect(hairShapeFromLength('medium', 'braided')).toBe('hair.braided');
  });

  it('texture=receding overrides length', () => {
    expect(hairShapeFromLength('short', 'receding')).toBe('hair.receding');
  });

  it('bald/shaved win over texture (no scalp surface to texture)', () => {
    expect(hairShapeFromLength('bald', 'curly')).toBe('hair.none');
    expect(hairShapeFromLength('shaved', 'curly')).toBe('hair.buzz');
    expect(hairShapeFromLength('shaved', 'braided')).toBe('hair.buzz');
  });

  it('texture=straight defers to length (no override)', () => {
    expect(hairShapeFromLength('long', 'straight')).toBe('hair.long');
    expect(hairShapeFromLength('medium', 'straight')).toBe('hair.medium');
  });

  it('unknown texture defers to length', () => {
    expect(hairShapeFromLength('long', 'unknown-texture')).toBe('hair.long');
  });
});

describe('hairColorFromIdentity (age-modulated graying)', () => {
  it('preserves color for 20s/30s players', () => {
    expect(hairColorFromIdentity('black', '20s')).toBe('color.black');
    expect(hairColorFromIdentity('brown', '30s')).toBe('color.brown');
    expect(hairColorFromIdentity('blonde', '30s')).toBe('color.blonde');
  });

  it('preserves base color at 40s — graying carried by salt-pepper TREATMENT overlay (Phase 1.8)', () => {
    // Phase 1.8 architecture change: salt-pepper is a treatment overlay (white
    // streaks on top of primary color), not a destination color. So at 40s
    // the base color is preserved; the salt-pepper visual is added via
    // hairTreatmentFromIdentity() returning 'salt-pepper'.
    expect(hairColorFromIdentity('black', '40s')).toBe('color.black');
    expect(hairColorFromIdentity('brown', '40s')).toBe('color.brown');
    expect(hairColorFromIdentity('dark-brown', '40s')).toBe('color.dark-brown');
  });

  it('preserves blonde at 40s (blondes don\'t typically gray that early)', () => {
    expect(hairColorFromIdentity('blonde', '40s')).toBe('color.blonde');
  });

  it('preserves base color at 50s as well — salt-pepper treatment is the visual (Phase 1.8)', () => {
    expect(hairColorFromIdentity('black', '50s')).toBe('color.black');
    expect(hairColorFromIdentity('brown', '50s')).toBe('color.brown');
  });

  it('drives toward gray/white only at 60s+ (post-salt-pepper)', () => {
    expect(hairColorFromIdentity('black', '60s+')).toBe('color.gray');
    expect(hairColorFromIdentity('brown', '60s+')).toBe('color.gray');
    expect(hairColorFromIdentity('blonde', '60s+')).toBe('color.white');
    expect(hairColorFromIdentity('red', '60s+')).toBe('color.white');
  });

  it('handles already-gray hair gracefully', () => {
    expect(hairColorFromIdentity('gray', '60s+')).toBe('color.white');
    expect(hairColorFromIdentity('white', '60s+')).toBe('color.white');
  });

  it('accepts salt-pepper as an explicit input color (legacy / backward compat)', () => {
    // Salt-pepper as a base color still maps; the OVERLAY is now driven by
    // hairTreatment, but the base value passes through.
    expect(hairColorFromIdentity('salt-pepper', '20s')).toBe('color.salt-pepper');
    expect(hairColorFromIdentity('salt and pepper', '50s')).toBe('color.gray');
    expect(hairColorFromIdentity('salt-and-pepper', '60s+')).toBe('color.white');
  });

  it('defaults to default hair color for unknown input', () => {
    expect(hairColorFromIdentity(null, null)).toBe(DEFAULT_AVATAR_FEATURES.hairColor);
    expect(hairColorFromIdentity('rainbow', null)).toBe(DEFAULT_AVATAR_FEATURES.hairColor);
  });

  it('is deterministic — same input → same output', () => {
    const a = hairColorFromIdentity('brown', '50s');
    const b = hairColorFromIdentity('brown', '50s');
    expect(a).toBe(b);
  });
});

describe('beardFromIdentity', () => {
  it('maps facial hair styles to beard features', () => {
    expect(beardFromIdentity('clean')).toBe('beard.none');
    expect(beardFromIdentity('stubble')).toBe('beard.stubble');
    expect(beardFromIdentity('goatee')).toBe('beard.goatee');
    expect(beardFromIdentity('mustache')).toBe('beard.mustache');
    expect(beardFromIdentity('full')).toBe('beard.full');
    expect(beardFromIdentity('Full Beard')).toBe('beard.full');
    expect(beardFromIdentity('soul-patch')).toBe('beard.soul-patch');
  });

  it('suppresses beard for sex=female regardless of facialHair value', () => {
    expect(beardFromIdentity('full', 'female')).toBe('beard.none');
    expect(beardFromIdentity('stubble', 'female')).toBe('beard.none');
  });

  it('defaults to beard.none when unspecified', () => {
    expect(beardFromIdentity(null)).toBe('beard.none');
  });
});

describe('glassesFromEyewear', () => {
  it('maps eyewear strings to glasses features', () => {
    expect(glassesFromEyewear('none')).toBe('glasses.none');
    expect(glassesFromEyewear('clear')).toBe('glasses.round');
    expect(glassesFromEyewear('sunglasses')).toBe('glasses.shades');
    expect(glassesFromEyewear('readers')).toBe('glasses.horn-rim');
    expect(glassesFromEyewear('aviators')).toBe('glasses.aviator');
  });

  it('defaults to glasses.none for unknown', () => {
    expect(glassesFromEyewear(null)).toBe('glasses.none');
    expect(glassesFromEyewear('monocle')).toBe('glasses.none');
  });
});

describe('eyewearColorFromIdentity', () => {
  it('maps known frame colors', () => {
    expect(eyewearColorFromIdentity('black')).toBe('frame.black');
    expect(eyewearColorFromIdentity('brown')).toBe('frame.brown');
    expect(eyewearColorFromIdentity('tortoiseshell')).toBe('frame.tortoiseshell');
    expect(eyewearColorFromIdentity('tortoise')).toBe('frame.tortoiseshell');
    expect(eyewearColorFromIdentity('gold')).toBe('frame.gold');
    expect(eyewearColorFromIdentity('silver')).toBe('frame.silver');
    expect(eyewearColorFromIdentity('red')).toBe('frame.red');
    expect(eyewearColorFromIdentity('blue')).toBe('frame.blue');
  });

  it('case-insensitive', () => {
    expect(eyewearColorFromIdentity('Black')).toBe('frame.black');
    expect(eyewearColorFromIdentity('GOLD')).toBe('frame.gold');
  });

  it('defaults to frame.black for unknown / null', () => {
    expect(eyewearColorFromIdentity(null)).toBe('frame.black');
    expect(eyewearColorFromIdentity('')).toBe('frame.black');
    expect(eyewearColorFromIdentity('chartreuse')).toBe('frame.black');
  });
});

describe('hatFromHeadwear', () => {
  it('maps headwear types to hat features', () => {
    expect(hatFromHeadwear('cap')).toBe('hat.cap');
    expect(hatFromHeadwear('beanie')).toBe('hat.beanie');
    expect(hatFromHeadwear('cowboy')).toBe('hat.cowboy');
    expect(hatFromHeadwear('fedora')).toBe('hat.fedora');
    expect(hatFromHeadwear('visor')).toBe('hat.visor');
  });

  it('defaults to hat.none', () => {
    expect(hatFromHeadwear(null)).toBe('hat.none');
    expect(hatFromHeadwear('')).toBe('hat.none');
  });
});

describe('eyeShapeFromEthnicity', () => {
  it('maps East Asian to almond eyes', () => {
    expect(eyeShapeFromEthnicity(['east-asian'])).toBe('eyes.almond');
    expect(eyeShapeFromEthnicity(['Asian'])).toBe('eyes.almond');
  });

  it('defaults to round for other ethnicities', () => {
    expect(eyeShapeFromEthnicity(['caucasian'])).toBe('eyes.round');
    expect(eyeShapeFromEthnicity(['hispanic'])).toBe('eyes.round');
    expect(eyeShapeFromEthnicity(['black'])).toBe('eyes.round');
  });

  it('defaults to round when no ethnicity', () => {
    expect(eyeShapeFromEthnicity(null)).toBe('eyes.round');
  });
});

describe('mapIdentityToAvatarFeatures (full pipeline)', () => {
  it('returns DEFAULT_AVATAR_FEATURES for null/empty player', () => {
    expect(mapIdentityToAvatarFeatures(null)).toEqual({ ...DEFAULT_AVATAR_FEATURES });
    expect(mapIdentityToAvatarFeatures(undefined)).toEqual({ ...DEFAULT_AVATAR_FEATURES });
  });

  it('produces deterministic output for the same player record', () => {
    const player = {
      sex: 'male',
      ethnicityTags: ['hispanic'],
      ageDecade: '30s',
      hairColor: 'black',
      hairLength: 'short',
      facialHair: 'full',
      eyewear: 'none',
    };
    const a = mapIdentityToAvatarFeatures(player);
    const b = mapIdentityToAvatarFeatures(player);
    expect(a).toEqual(b);
  });

  it('SYNTH-1 (Hispanic 30s male, full beard, hat) maps as expected', () => {
    const result = mapIdentityToAvatarFeatures(
      {
        sex: 'male',
        ethnicityTags: ['hispanic'],
        ageDecade: '30s',
        hairColor: 'black',
        hairLength: 'short',
        facialHair: 'full',
        eyewear: 'none',
      },
      { headwearOverride: 'cap' },
    );
    expect(result.skin).toBe('skin.tan');
    expect(result.hair).toBe('hair.short-wavy');
    expect(result.hairColor).toBe('color.black');
    expect(result.beard).toBe('beard.full');
    expect(result.beardColor).toBe('color.black');
    expect(result.glasses).toBe('glasses.none');
    expect(result.hat).toBe('hat.cap');
  });

  it('SYNTH-2 (Caucasian 60s+ male, bifocals, balding) maps with gray-bias', () => {
    const result = mapIdentityToAvatarFeatures({
      sex: 'male',
      ethnicityTags: ['caucasian'],
      ageDecade: '60s+',
      hairColor: 'white',
      hairLength: 'shaved', // mostly bald → buzz approximation
      facialHair: 'clean',
      eyewear: 'readers',
    });
    expect(result.skin).toBe('skin.very-light');
    expect(result.hair).toBe('hair.buzz');
    expect(result.hairColor).toBe('color.white');
    expect(result.beard).toBe('beard.none');
    expect(result.glasses).toBe('glasses.horn-rim');
  });

  it('SYNTH-3 (East Asian 20s female, ponytail) maps without beard, almond eyes', () => {
    const result = mapIdentityToAvatarFeatures({
      sex: 'female',
      ethnicityTags: ['east-asian'],
      ageDecade: '20s',
      hairColor: 'black',
      hairLength: 'long',
      facialHair: null,
      eyewear: 'none',
    });
    expect(result.skin).toBe('skin.light');
    expect(result.hair).toBe('hair.long');
    expect(result.hairColor).toBe('color.black');
    expect(result.beard).toBe('beard.none');
    expect(result.eyes).toBe('eyes.almond');
  });

  it('female record with stray facialHair value still suppresses beard', () => {
    const result = mapIdentityToAvatarFeatures({
      sex: 'female',
      facialHair: 'full',
    });
    expect(result.beard).toBe('beard.none');
  });

  it('SYNTH-4 (Black 40s male, sunglasses, goatee) maps correctly', () => {
    const result = mapIdentityToAvatarFeatures({
      sex: 'male',
      ethnicityTags: ['black'],
      ageDecade: '40s',
      hairColor: 'black',
      hairLength: 'shaved',
      facialHair: 'goatee',
      eyewear: 'sunglasses',
    });
    expect(result.skin).toBe('skin.brown');
    expect(result.hair).toBe('hair.buzz');
    expect(result.beard).toBe('beard.goatee');
    expect(result.glasses).toBe('glasses.shades');
    // Phase 1.8: base color preserved; salt-pepper carried by treatment
    expect(result.hairColor).toBe('color.black');
    expect(result.hairTreatment).toBe('salt-pepper');
  });

  it('legacy ethnicity string still works (no ethnicityTags array)', () => {
    const result = mapIdentityToAvatarFeatures({
      ethnicity: 'Asian',
      hairColor: 'black',
      hairLength: 'medium',
    });
    expect(result.skin).toBe('skin.light');
    expect(result.hair).toBe('hair.medium');
  });

  it('legacy hat/sunglasses bools still mapped via eyewear when eyewear absent', () => {
    const result = mapIdentityToAvatarFeatures({
      sunglasses: true,
    });
    expect(result.glasses).toBe('glasses.shades');
  });

  it('explicit eyewear takes precedence over legacy sunglasses bool', () => {
    const result = mapIdentityToAvatarFeatures({
      eyewear: 'none',
      sunglasses: true, // ignored — eyewear wins
    });
    expect(result.glasses).toBe('glasses.none');
  });

  it('hairTexture=curly maps to hair.curly regardless of length', () => {
    const result = mapIdentityToAvatarFeatures({
      ethnicityTags: ['middle-eastern'],
      hairColor: 'black',
      hairLength: 'medium',
      hairTexture: 'curly',
    });
    expect(result.hair).toBe('hair.curly');
  });

  it('hairTexture=braided maps to hair.braided', () => {
    const result = mapIdentityToAvatarFeatures({
      sex: 'female',
      ethnicityTags: ['black'],
      hairColor: 'black',
      hairLength: 'long',
      hairTexture: 'braided',
    });
    expect(result.hair).toBe('hair.braided');
  });

  it('SYNTH-9 (Black female 30s, braided long) renders braided shape', () => {
    const result = mapIdentityToAvatarFeatures({
      sex: 'female',
      ethnicityTags: ['black'],
      ageDecade: '30s',
      hairColor: 'black',
      hairLength: 'long',
      hairTexture: 'braided',
      facialHair: null,
    });
    expect(result.hair).toBe('hair.braided');
    expect(result.beard).toBe('beard.none');
    expect(result.skin).toBe('skin.brown');
  });

  it('SYNTH-14 (Middle Eastern 30s curly, full beard) renders curly hair', () => {
    const result = mapIdentityToAvatarFeatures({
      sex: 'male',
      ethnicityTags: ['middle-eastern'],
      ageDecade: '30s',
      hairColor: 'black',
      hairLength: 'medium',
      hairTexture: 'curly',
      facialHair: 'full',
    });
    expect(result.hair).toBe('hair.curly');
    expect(result.beard).toBe('beard.full');
  });

  it('mapIdentityToAvatarFeatures includes silhouette key derived from sex+build', () => {
    const result = mapIdentityToAvatarFeatures({
      sex: 'male',
      build: 'muscular',
      ethnicityTags: ['caucasian'],
    });
    expect(result.silhouette).toBe('silhouette.male-muscular');
  });

  it('mapIdentityToAvatarFeatures silhouette defaults to other-average', () => {
    const result = mapIdentityToAvatarFeatures({
      ethnicityTags: ['caucasian'],
    });
    expect(result.silhouette).toBe('silhouette.other-average');
  });

  it('mapIdentityToAvatarFeatures includes eyewearColor key (default frame.black)', () => {
    const result = mapIdentityToAvatarFeatures({ eyewear: 'clear' });
    expect(result.eyewearColor).toBe('frame.black');
  });

  it('mapIdentityToAvatarFeatures honors explicit eyewearColor', () => {
    const result = mapIdentityToAvatarFeatures({
      eyewear: 'clear',
      eyewearColor: 'gold',
    });
    expect(result.eyewearColor).toBe('frame.gold');
    expect(result.glasses).toBe('glasses.round');
  });

  it('SYNTH-17 (Black 50s with explicit salt-pepper) routes through treatment overlay', () => {
    const result = mapIdentityToAvatarFeatures({
      sex: 'male',
      ethnicityTags: ['black'],
      ageDecade: '50s',
      hairColor: 'salt-pepper',
      hairLength: 'short',
      facialHair: 'full',
    });
    // Salt-pepper as base shifts to gray at 50s. Treatment is set so the
    // overlay renders the white-streaks pattern on top.
    expect(result.hairColor).toBe('color.gray');
    expect(result.beardColor).toBe('color.gray');
    expect(result.hairTreatment).toBe('salt-pepper');
  });

  it('hairTreatment auto-derives for 40s+ with dark base color', () => {
    expect(mapIdentityToAvatarFeatures({ hairColor: 'black', ageDecade: '30s' }).hairTreatment).toBeNull();
    expect(mapIdentityToAvatarFeatures({ hairColor: 'black', ageDecade: '40s' }).hairTreatment).toBe('salt-pepper');
    expect(mapIdentityToAvatarFeatures({ hairColor: 'brown', ageDecade: '50s' }).hairTreatment).toBe('salt-pepper');
    expect(mapIdentityToAvatarFeatures({ hairColor: 'blonde', ageDecade: '50s' }).hairTreatment).toBeNull();
  });

  it('explicit hairSaltPepper=true forces treatment regardless of age', () => {
    const result = mapIdentityToAvatarFeatures({
      hairColor: 'brown',
      ageDecade: '20s',
      hairSaltPepper: true,
    });
    expect(result.hairTreatment).toBe('salt-pepper');
  });

  it('explicit hairSaltPepper=false suppresses treatment even at 50s with dark hair', () => {
    const result = mapIdentityToAvatarFeatures({
      hairColor: 'black',
      ageDecade: '50s',
      hairSaltPepper: false,
    });
    expect(result.hairTreatment).toBeNull();
  });
});
