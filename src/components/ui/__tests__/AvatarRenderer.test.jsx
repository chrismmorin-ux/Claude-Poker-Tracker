// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AvatarRenderer, { resolveCategoryFeature, buildColorVars, CATEGORY_FALLBACK_ID } from '../AvatarRenderer';
import { AVATAR_FEATURES, getFeatureById } from '../../../assets/avatarFeatures';
import { LAYER_ORDER, SKIN_TONES, HAIR_COLORS, EYE_COLORS } from '../../../constants/avatarFeatureConstants';

describe('AvatarRenderer', () => {
  describe('layer composition', () => {
    it('emits one <g> per LAYER_ORDER entry in order', () => {
      const { container } = render(
        <AvatarRenderer avatarFeatures={{ skin: 'skin.medium' }} size={48} />,
      );
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      const groups = svg.querySelectorAll('g[data-layer]');
      expect(groups.length).toBe(LAYER_ORDER.length);
      LAYER_ORDER.forEach((category, i) => {
        expect(groups[i].getAttribute('data-layer')).toBe(category);
      });
    });

    it('renders null avatarFeatures without throwing (all "none" fallbacks)', () => {
      const { container } = render(<AvatarRenderer avatarFeatures={null} size={48} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      // Every layer still rendered
      expect(svg.querySelectorAll('g[data-layer]').length).toBe(LAYER_ORDER.length);
    });

    it('falls through unknown feature IDs to per-category fallback', () => {
      const { container } = render(
        <AvatarRenderer avatarFeatures={{ hair: 'hair.totally-bogus', eyes: 'eyes.also-bogus' }} size={48} />,
      );
      expect(container.querySelector('g[data-layer="hair"]').getAttribute('data-feature-id'))
        .toBe(CATEGORY_FALLBACK_ID.hair);
      expect(container.querySelector('g[data-layer="eyes"]').getAttribute('data-feature-id'))
        .toBe(CATEGORY_FALLBACK_ID.eyes);
    });

    it('skin layer always renders skin.shape regardless of avatarFeatures.skin value', () => {
      // avatarFeatures.skin is a tone ID (color), not a feature ID.
      const { container: c1 } = render(
        <AvatarRenderer avatarFeatures={{ skin: 'skin.medium' }} />,
      );
      expect(c1.querySelector('g[data-layer="skin"]').getAttribute('data-feature-id'))
        .toBe('skin.shape');

      const { container: c2 } = render(<AvatarRenderer avatarFeatures={null} />);
      expect(c2.querySelector('g[data-layer="skin"]').getAttribute('data-feature-id'))
        .toBe('skin.shape');
    });
  });

  describe('every authored feature id renders without throwing', () => {
    for (const [category, features] of Object.entries(AVATAR_FEATURES)) {
      for (const feature of features) {
        it(`${category}: "${feature.id}" renders`, () => {
          const { container } = render(
            <AvatarRenderer avatarFeatures={{ [category]: feature.id }} size={48} />,
          );
          const g = container.querySelector(`g[data-layer="${category}"]`);
          expect(g).toBeTruthy();
          expect(g.getAttribute('data-feature-id')).toBe(feature.id);
        });
      }
    }
  });

  describe('"<category>.none" renders as empty layer', () => {
    it('hair.none produces zero <path> children', () => {
      const { container } = render(
        <AvatarRenderer avatarFeatures={{ hair: 'hair.none' }} size={48} />,
      );
      const hairGroup = container.querySelector('g[data-layer="hair"]');
      expect(hairGroup.querySelectorAll('path').length).toBe(0);
    });

    it('beard.none produces zero <path> children', () => {
      const { container } = render(
        <AvatarRenderer avatarFeatures={{ beard: 'beard.none' }} size={48} />,
      );
      expect(container.querySelector('g[data-layer="beard"]').querySelectorAll('path').length).toBe(0);
    });
  });

  describe('category fallback coverage', () => {
    it('hair, beard, glasses, hat have a "<category>.none" entry', () => {
      for (const category of ['hair', 'beard', 'glasses', 'hat']) {
        expect(getFeatureById(`${category}.none`)).not.toBeNull();
      }
    });

    it('skin has skin.shape singleton (face always renders)', () => {
      expect(getFeatureById('skin.shape')).not.toBeNull();
    });

    it('eyes has a registered default shape (eyes always render)', () => {
      expect(getFeatureById(CATEGORY_FALLBACK_ID.eyes)).not.toBeNull();
    });

    it('every category fallback id resolves to a real feature', () => {
      for (const category of Object.keys(AVATAR_FEATURES)) {
        expect(getFeatureById(CATEGORY_FALLBACK_ID[category])).not.toBeNull();
      }
    });
  });

  describe('color vars', () => {
    it('applies --skin from SKIN_TONES palette', () => {
      const tone = SKIN_TONES.find(t => t.id === 'skin.dark');
      const { container } = render(
        <AvatarRenderer avatarFeatures={{ skin: tone.id }} size={48} />,
      );
      const svg = container.querySelector('svg');
      expect(svg.style.getPropertyValue('--skin')).toBe(tone.hex);
    });

    it('applies --hair from HAIR_COLORS palette', () => {
      const color = HAIR_COLORS.find(c => c.id === 'color.red');
      const { container } = render(
        <AvatarRenderer avatarFeatures={{ hair: 'hair.short-wavy', hairColor: color.id }} size={48} />,
      );
      expect(container.querySelector('svg').style.getPropertyValue('--hair')).toBe(color.hex);
    });

    it('applies --eye from EYE_COLORS palette', () => {
      const color = EYE_COLORS.find(c => c.id === 'eye-color.green');
      const { container } = render(
        <AvatarRenderer avatarFeatures={{ eyeColor: color.id }} size={48} />,
      );
      expect(container.querySelector('svg').style.getPropertyValue('--eye')).toBe(color.hex);
    });

    it('falls through unknown color ids to defaults without throw', () => {
      const { container } = render(
        <AvatarRenderer avatarFeatures={{ skin: 'skin.does-not-exist', hairColor: 'color.also-bogus' }} size={48} />,
      );
      const svg = container.querySelector('svg');
      // Falls through to skin.medium default
      expect(svg.style.getPropertyValue('--skin')).toBeTruthy();
      expect(svg.style.getPropertyValue('--hair')).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('renders role=img with aria-label', () => {
      const { container } = render(<AvatarRenderer avatarFeatures={{}} title="Mike" />);
      const svg = container.querySelector('svg');
      expect(svg.getAttribute('role')).toBe('img');
      expect(svg.getAttribute('aria-label')).toBe('Mike');
    });

    it('renders <title> element when title prop provided', () => {
      const { container } = render(<AvatarRenderer avatarFeatures={{}} title="Mike" />);
      expect(container.querySelector('title')?.textContent).toBe('Mike');
    });
  });
});

describe('resolveCategoryFeature', () => {
  it('returns the matching feature when id is valid', () => {
    const feature = resolveCategoryFeature('hair', { hair: 'hair.buzz' });
    expect(feature.id).toBe('hair.buzz');
  });

  it('returns per-category fallback when id is missing from avatarFeatures', () => {
    expect(resolveCategoryFeature('hair', { skin: 'skin.medium' }).id).toBe('hair.none');
    expect(resolveCategoryFeature('beard', {}).id).toBe('beard.none');
    expect(resolveCategoryFeature('eyes', {}).id).toBe('eyes.round');
  });

  it('returns per-category fallback when avatarFeatures is null', () => {
    expect(resolveCategoryFeature('beard', null).id).toBe('beard.none');
    expect(resolveCategoryFeature('eyes', null).id).toBe('eyes.round');
  });

  it('returns per-category fallback when id does not exist in registry', () => {
    expect(resolveCategoryFeature('hair', { hair: 'hair.made-up' }).id).toBe('hair.none');
    expect(resolveCategoryFeature('eyes', { eyes: 'eyes.imaginary' }).id).toBe('eyes.round');
  });

  it('skin layer always returns skin.shape regardless of input', () => {
    expect(resolveCategoryFeature('skin', { skin: 'skin.medium' }).id).toBe('skin.shape');
    expect(resolveCategoryFeature('skin', null).id).toBe('skin.shape');
    expect(resolveCategoryFeature('skin', { skin: 'skin.dark' }).id).toBe('skin.shape');
  });
});

describe('buildColorVars', () => {
  it('produces all four CSS custom properties', () => {
    const vars = buildColorVars({
      skin: 'skin.dark',
      hairColor: 'color.red',
      beardColor: 'color.black',
      eyeColor: 'eye-color.blue',
    });
    expect(vars['--skin']).toBeTruthy();
    expect(vars['--hair']).toBeTruthy();
    expect(vars['--beard']).toBeTruthy();
    expect(vars['--eye']).toBeTruthy();
  });

  it('falls back to defaults for missing ids', () => {
    const vars = buildColorVars({});
    expect(vars['--skin']).toBeTruthy();
    expect(vars['--hair']).toBeTruthy();
    expect(vars['--beard']).toBeTruthy();
    expect(vars['--eye']).toBeTruthy();
  });

  it('handles null input', () => {
    const vars = buildColorVars(null);
    expect(Object.keys(vars)).toEqual(['--skin', '--hair', '--beard', '--eye']);
  });
});
