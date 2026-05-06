/**
 * @file migratePlayerLegacyFields.test.js — covers Phase 5 read-side migration.
 */

import { describe, it, expect } from 'vitest';
import { migratePlayerLegacyFields } from '../migratePlayerLegacyFields';

describe('migratePlayerLegacyFields — pure derivation', () => {
  it('returns input unchanged when null/undefined', () => {
    expect(migratePlayerLegacyFields(null)).toBeNull();
    expect(migratePlayerLegacyFields(undefined)).toBeUndefined();
  });

  it('does not mutate the input object', () => {
    const player = { gender: 'Male', ethnicity: 'Asian' };
    const out = migratePlayerLegacyFields(player);
    expect(out).not.toBe(player);
    expect(player).toEqual({ gender: 'Male', ethnicity: 'Asian' });
  });

  it('preserves all unchanged fields', () => {
    const player = { name: 'Carlos', handCount: 42, customField: 'kept' };
    const out = migratePlayerLegacyFields(player);
    expect(out.name).toBe('Carlos');
    expect(out.handCount).toBe(42);
    expect(out.customField).toBe('kept');
  });
});

describe('sex derivation from legacy gender', () => {
  it('maps Male → male, Female → female, Non-binary → other', () => {
    expect(migratePlayerLegacyFields({ gender: 'Male' }).sex).toBe('male');
    expect(migratePlayerLegacyFields({ gender: 'Female' }).sex).toBe('female');
    expect(migratePlayerLegacyFields({ gender: 'Non-binary' }).sex).toBe('other');
  });

  it('case-insensitive', () => {
    expect(migratePlayerLegacyFields({ gender: 'male' }).sex).toBe('male');
    expect(migratePlayerLegacyFields({ gender: 'FEMALE' }).sex).toBe('female');
  });

  it('does not overwrite existing sex', () => {
    const out = migratePlayerLegacyFields({ sex: 'female', gender: 'Male' });
    expect(out.sex).toBe('female');
  });

  it('leaves sex unset when gender is unknown', () => {
    expect(migratePlayerLegacyFields({ gender: 'Robot' }).sex).toBeUndefined();
  });
});

describe('ethnicityTags derivation', () => {
  it('derives from legacy ethnicity string', () => {
    expect(migratePlayerLegacyFields({ ethnicity: 'White/Caucasian' }).ethnicityTags).toEqual(['caucasian']);
    expect(migratePlayerLegacyFields({ ethnicity: 'Asian' }).ethnicityTags).toEqual(['east-asian']);
    expect(migratePlayerLegacyFields({ ethnicity: 'Hispanic/Latino' }).ethnicityTags).toEqual(['hispanic']);
    expect(migratePlayerLegacyFields({ ethnicity: 'Black/African American' }).ethnicityTags).toEqual(['black']);
    expect(migratePlayerLegacyFields({ ethnicity: 'Middle Eastern' }).ethnicityTags).toEqual(['middle-eastern']);
  });

  it('back-derives from avatarFeatures.skin when no ethnicity string', () => {
    const out = migratePlayerLegacyFields({ avatarFeatures: { skin: 'skin.dark' } });
    expect(out.ethnicityTags).toEqual(['black']);
  });

  it('prefers ethnicity string over avatarFeatures.skin', () => {
    const out = migratePlayerLegacyFields({
      ethnicity: 'Asian',
      avatarFeatures: { skin: 'skin.dark' },
    });
    expect(out.ethnicityTags).toEqual(['east-asian']);
  });

  it('does not overwrite existing ethnicityTags', () => {
    const out = migratePlayerLegacyFields({
      ethnicityTags: ['caucasian'],
      ethnicity: 'Asian',
    });
    expect(out.ethnicityTags).toEqual(['caucasian']);
  });

  it('leaves ethnicityTags empty when no derivation source', () => {
    const out = migratePlayerLegacyFields({ name: 'Jane' });
    expect(out.ethnicityTags).toBeUndefined();
  });
});

describe('hair derivation from avatarFeatures', () => {
  it('derives hairLength from avatarFeatures.hair shape', () => {
    // 2026-05-06: hair.buzz now migrates to 'buzz' (not 'shaved') — shaved
    // means "head shaved clean" (no visible hair) while buzz has visible
    // stubble. The old conflation was an upstream bug.
    expect(migratePlayerLegacyFields({ avatarFeatures: { hair: 'hair.long' } }).hairLength).toBe('long');
    expect(migratePlayerLegacyFields({ avatarFeatures: { hair: 'hair.buzz' } }).hairLength).toBe('buzz');
    expect(migratePlayerLegacyFields({ avatarFeatures: { hair: 'hair.medium' } }).hairLength).toBe('medium');
    expect(migratePlayerLegacyFields({ avatarFeatures: { hair: 'hair.none' } }).hairLength).toBe('bald');
  });

  it('derives hairTexture from avatarFeatures.hair shape', () => {
    expect(migratePlayerLegacyFields({ avatarFeatures: { hair: 'hair.curly' } }).hairTexture).toBe('curly');
    expect(migratePlayerLegacyFields({ avatarFeatures: { hair: 'hair.braided' } }).hairTexture).toBe('braided');
    expect(migratePlayerLegacyFields({ avatarFeatures: { hair: 'hair.receding' } }).hairTexture).toBe('receding');
  });

  it('does not set texture for straight hair shapes', () => {
    expect(migratePlayerLegacyFields({ avatarFeatures: { hair: 'hair.short-wavy' } }).hairTexture).toBeUndefined();
  });

  it('derives hairColor from avatarFeatures.hairColor', () => {
    expect(migratePlayerLegacyFields({ avatarFeatures: { hairColor: 'color.black' } }).hairColor).toBe('black');
    expect(migratePlayerLegacyFields({ avatarFeatures: { hairColor: 'color.salt-pepper' } }).hairColor).toBe('salt-pepper');
  });

  it('does not overwrite existing hair fields', () => {
    const out = migratePlayerLegacyFields({
      hairLength: 'short',
      hairColor: 'red',
      avatarFeatures: { hair: 'hair.long', hairColor: 'color.black' },
    });
    expect(out.hairLength).toBe('short');
    expect(out.hairColor).toBe('red');
  });
});

describe('facialHair derivation from avatarFeatures.beard', () => {
  it('maps each beard variant', () => {
    expect(migratePlayerLegacyFields({ avatarFeatures: { beard: 'beard.full' } }).facialHair).toBe('full');
    expect(migratePlayerLegacyFields({ avatarFeatures: { beard: 'beard.goatee' } }).facialHair).toBe('goatee');
    expect(migratePlayerLegacyFields({ avatarFeatures: { beard: 'beard.stubble' } }).facialHair).toBe('stubble');
    expect(migratePlayerLegacyFields({ avatarFeatures: { beard: 'beard.none' } }).facialHair).toBe('clean');
  });

  it('chin-strap maps to closest existing option (goatee)', () => {
    expect(migratePlayerLegacyFields({ avatarFeatures: { beard: 'beard.chin-strap' } }).facialHair).toBe('goatee');
  });
});

describe('eyewear derivation', () => {
  it('derives from avatarFeatures.glasses', () => {
    expect(migratePlayerLegacyFields({ avatarFeatures: { glasses: 'glasses.shades' } }).eyewear).toBe('sunglasses');
    expect(migratePlayerLegacyFields({ avatarFeatures: { glasses: 'glasses.round' } }).eyewear).toBe('clear');
    expect(migratePlayerLegacyFields({ avatarFeatures: { glasses: 'glasses.horn-rim' } }).eyewear).toBe('readers');
    expect(migratePlayerLegacyFields({ avatarFeatures: { glasses: 'glasses.aviator' } }).eyewear).toBe('aviators');
  });

  it('falls back to legacy sunglasses bool when no avatarFeatures.glasses', () => {
    expect(migratePlayerLegacyFields({ sunglasses: true }).eyewear).toBe('sunglasses');
    expect(migratePlayerLegacyFields({ sunglasses: false }).eyewear).toBeUndefined();
  });

  it('prefers avatarFeatures.glasses over legacy bool', () => {
    const out = migratePlayerLegacyFields({
      sunglasses: true,
      avatarFeatures: { glasses: 'glasses.round' },
    });
    expect(out.eyewear).toBe('clear');
  });
});

describe('headwear derivation', () => {
  it('derives from avatarFeatures.hat', () => {
    expect(migratePlayerLegacyFields({ avatarFeatures: { hat: 'hat.cap' } }).headwear).toBe('cap');
    expect(migratePlayerLegacyFields({ avatarFeatures: { hat: 'hat.beanie' } }).headwear).toBe('beanie');
    expect(migratePlayerLegacyFields({ avatarFeatures: { hat: 'hat.cowboy' } }).headwear).toBe('cowboy');
  });

  it('hat.none does not set headwear', () => {
    expect(migratePlayerLegacyFields({ avatarFeatures: { hat: 'hat.none' } }).headwear).toBeUndefined();
  });

  it('falls back to legacy hat bool → "cap" generic', () => {
    expect(migratePlayerLegacyFields({ hat: true }).headwear).toBe('cap');
    expect(migratePlayerLegacyFields({ hat: false }).headwear).toBeUndefined();
  });
});

describe('full-record migration scenarios', () => {
  it('PEO-era record: gender + ethnicity + avatarFeatures all legacy', () => {
    const out = migratePlayerLegacyFields({
      name: 'Mike',
      gender: 'Male',
      ethnicity: 'Hispanic/Latino',
      hat: true,
      sunglasses: false,
      avatarFeatures: {
        skin: 'skin.tan',
        hair: 'hair.short-wavy',
        hairColor: 'color.black',
        beard: 'beard.full',
        glasses: 'glasses.none',
        hat: 'hat.cap',
      },
    });
    expect(out.sex).toBe('male');
    expect(out.ethnicityTags).toEqual(['hispanic']);
    expect(out.hairLength).toBe('short');
    expect(out.hairColor).toBe('black');
    expect(out.facialHair).toBe('full');
    expect(out.eyewear).toBe('none');
    expect(out.headwear).toBe('cap');
  });

  it('partially-migrated record: keeps Phase-3 fields, fills only gaps', () => {
    const out = migratePlayerLegacyFields({
      name: 'Mike',
      sex: 'female',                     // Phase 3 set
      ethnicityTags: ['black'],          // Phase 3 set
      gender: 'Male',                    // legacy — ignored
      ethnicity: 'White/Caucasian',      // legacy — ignored
      hat: true,                         // legacy — fills headwear
    });
    expect(out.sex).toBe('female');
    expect(out.ethnicityTags).toEqual(['black']);
    expect(out.headwear).toBe('cap');
  });

  it('empty record (no legacy data): no derivations, no fields added', () => {
    const out = migratePlayerLegacyFields({ name: 'Sarah' });
    expect(out.sex).toBeUndefined();
    expect(out.ethnicityTags).toBeUndefined();
    expect(out.hairLength).toBeUndefined();
    expect(out.facialHair).toBeUndefined();
    expect(out.eyewear).toBeUndefined();
    expect(out.headwear).toBeUndefined();
  });
});
