// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import PlayerAvatar from '../PlayerAvatar';

describe('<PlayerAvatar />', () => {
  it('renders feature avatar when player.avatarFeatures is present', () => {
    const player = {
      name: 'Mike',
      avatarFeatures: { skin: 'skin.medium', hair: 'hair.short-wavy', hairColor: 'color.black' },
    };
    const { container } = render(<PlayerAvatar player={player} size={48} />);
    // Feature avatar renders per-layer groups
    expect(container.querySelectorAll('g[data-layer]').length).toBeGreaterThan(0);
    // Monogram does not render <text>
    expect(container.querySelector('text')).toBeNull();
  });

  it('renders monogram when player has no avatarFeatures', () => {
    const player = { name: 'Mike' };
    const { container } = render(<PlayerAvatar player={player} size={48} />);
    expect(container.querySelector('text')?.textContent).toBe('M');
    expect(container.querySelector('g[data-layer]')).toBeNull();
  });

  it('renders monogram fallback when player is null', () => {
    const { container } = render(<PlayerAvatar player={null} size={48} />);
    expect(container.querySelector('text')).toBeTruthy();
    expect(container.querySelector('g[data-layer]')).toBeNull();
  });

  it('renders unnamed silhouette when player has neither name nor features', () => {
    const { container } = render(<PlayerAvatar player={{}} size={48} />);
    expect(container.querySelector('text')?.textContent).toBe('?');
  });

  it('passes size down to the chosen renderer', () => {
    const featured = render(<PlayerAvatar player={{ avatarFeatures: {} }} size={96} />);
    expect(featured.container.querySelector('svg').getAttribute('width')).toBe('96');

    const mono = render(<PlayerAvatar player={{ name: 'Mike' }} size={96} />);
    expect(mono.container.querySelector('svg').getAttribute('width')).toBe('96');
  });

  it('uses player.name as default title', () => {
    const { container } = render(<PlayerAvatar player={{ name: 'Mike', avatarFeatures: {} }} />);
    expect(container.querySelector('svg').getAttribute('aria-label')).toBe('Mike');
  });

  it('treats non-object avatarFeatures as absent (defensive)', () => {
    const player = { name: 'Mike', avatarFeatures: 'not-an-object' };
    const { container } = render(<PlayerAvatar player={player} />);
    // Should fall back to monogram
    expect(container.querySelector('text')?.textContent).toBe('M');
  });
});
