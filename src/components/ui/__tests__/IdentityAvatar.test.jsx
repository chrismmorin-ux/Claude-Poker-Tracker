/**
 * @file IdentityAvatar.test.jsx — Component tests for the unified avatar.
 *
 * Verifies:
 *   - Renders an SVG with the right data-feature-id layers for known inputs
 *   - Photo overlay renders the badge when photoUrl provided
 *   - No manual override path — same player ALWAYS produces same render
 *   - Null/undefined player still renders (DEFAULT_AVATAR_FEATURES)
 *   - title prop wins over player.name
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import IdentityAvatar from '../IdentityAvatar';

describe('IdentityAvatar', () => {
  it('renders an SVG even with no player', () => {
    const { container } = render(<IdentityAvatar />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('aria-label')).toBe('Player');
  });

  it('renders the expected layers for a Hispanic male profile', () => {
    const { container } = render(
      <IdentityAvatar
        player={{
          name: 'Carlos',
          sex: 'male',
          ethnicityTags: ['hispanic'],
          ageDecade: '30s',
          hairColor: 'black',
          hairLength: 'short',
          facialHair: 'full',
          eyewear: 'none',
        }}
        size={64}
      />,
    );
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('width')).toBe('64');
    expect(svg.getAttribute('aria-label')).toBe('Carlos');
    // Confirm layers reflect the mapping (skin tan, hair short-wavy, beard full)
    const layers = container.querySelectorAll('g[data-layer]');
    const featuresById = {};
    layers.forEach((l) => {
      featuresById[l.getAttribute('data-layer')] = l.getAttribute('data-feature-id');
    });
    expect(featuresById.hair).toBe('hair.short-wavy');
    expect(featuresById.beard).toBe('beard.full');
    expect(featuresById.glasses).toBe('glasses.none');
    expect(featuresById.hat).toBe('hat.none');
  });

  it('female record suppresses beard', () => {
    const { container } = render(
      <IdentityAvatar
        player={{
          name: 'Maya',
          sex: 'female',
          ethnicityTags: ['east-asian'],
          hairLength: 'long',
          facialHair: 'full', // would normally render — must be suppressed
        }}
      />,
    );
    const beardLayer = container.querySelector('g[data-layer="beard"]');
    expect(beardLayer.getAttribute('data-feature-id')).toBe('beard.none');
  });

  it('60s+ player gets gray-shifted hair color in CSS vars', () => {
    const { container } = render(
      <IdentityAvatar
        player={{
          ethnicityTags: ['caucasian'],
          ageDecade: '60s+',
          hairColor: 'brown',
          hairLength: 'short',
        }}
      />,
    );
    const svg = container.querySelector('svg');
    // brown + 60s+ → color.gray (from GRAY_SHIFT_TABLE) → #8a8a8a per HAIR_COLORS
    expect(svg.style.getPropertyValue('--hair')).toBe('#8a8a8a');
  });

  it('headwearOverride drives the hat layer', () => {
    const { container } = render(
      <IdentityAvatar
        player={{ ethnicityTags: ['caucasian'] }}
        headwearOverride="cowboy"
      />,
    );
    const hatLayer = container.querySelector('g[data-layer="hat"]');
    expect(hatLayer.getAttribute('data-feature-id')).toBe('hat.cowboy');
  });

  it('renders photo overlay badge when photoOverlay + photoUrl provided', () => {
    const { getByTestId } = render(
      <IdentityAvatar
        player={{ name: 'Test' }}
        photoOverlay
        photoUrl="data:image/png;base64,iVBORw0KGgo="
      />,
    );
    const badge = getByTestId('identity-avatar-photo-badge');
    expect(badge).toBeTruthy();
    expect(badge.getAttribute('src')).toContain('data:image/png');
  });

  it('does NOT render photo badge when photoOverlay=false even if photoUrl present', () => {
    const { container, queryByTestId } = render(
      <IdentityAvatar
        player={{ name: 'Test' }}
        photoOverlay={false}
        photoUrl="data:image/png;base64,iVBORw0KGgo="
      />,
    );
    expect(queryByTestId('identity-avatar-photo-badge')).toBeNull();
  });

  it('title prop wins over player.name', () => {
    const { container } = render(
      <IdentityAvatar player={{ name: 'Carlos' }} title="Override Label" />,
    );
    expect(container.querySelector('svg').getAttribute('aria-label')).toBe('Override Label');
  });

  it('two renders of the same player produce identical avatar feature layers', () => {
    const player = {
      sex: 'male',
      ethnicityTags: ['black'],
      ageDecade: '40s',
      hairColor: 'black',
      hairLength: 'shaved',
      facialHair: 'goatee',
      eyewear: 'sunglasses',
    };
    const { container: c1 } = render(<IdentityAvatar player={player} />);
    const { container: c2 } = render(<IdentityAvatar player={player} />);
    const layers1 = Array.from(c1.querySelectorAll('g[data-layer]'))
      .map((l) => `${l.getAttribute('data-layer')}:${l.getAttribute('data-feature-id')}`);
    const layers2 = Array.from(c2.querySelectorAll('g[data-layer]'))
      .map((l) => `${l.getAttribute('data-layer')}:${l.getAttribute('data-feature-id')}`);
    expect(layers1).toEqual(layers2);
  });
});
