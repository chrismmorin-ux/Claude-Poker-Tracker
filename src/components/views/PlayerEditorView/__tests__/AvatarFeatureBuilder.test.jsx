// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AvatarFeatureBuilder from '../AvatarFeatureBuilder';

describe('<AvatarFeatureBuilder />', () => {
  it('renders the preview avatar', () => {
    const { container } = render(
      <AvatarFeatureBuilder avatarFeatures={null} onFeatureChange={vi.fn()} />,
    );
    // The preview is a PlayerAvatar → SVG
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders skin tone swatches and fires onFeatureChange on click', () => {
    const onChange = vi.fn();
    render(<AvatarFeatureBuilder avatarFeatures={{}} onFeatureChange={onChange} />);
    const swatch = screen.getByTestId('swatch-skin-skin.dark');
    fireEvent.click(swatch);
    expect(onChange).toHaveBeenCalledWith('skin', 'skin.dark');
  });

  it('marks selected swatch with aria-pressed=true', () => {
    render(
      <AvatarFeatureBuilder
        avatarFeatures={{ skin: 'skin.medium' }}
        onFeatureChange={vi.fn()}
      />,
    );
    const selected = screen.getByTestId('swatch-skin-skin.medium');
    expect(selected.getAttribute('aria-pressed')).toBe('true');
    const unselected = screen.getByTestId('swatch-skin-skin.dark');
    expect(unselected.getAttribute('aria-pressed')).toBe('false');
  });

  it('hides hair-color row when hair style is "hair.none"', () => {
    const { rerender, queryByTestId } = render(
      <AvatarFeatureBuilder
        avatarFeatures={{ hair: 'hair.none' }}
        onFeatureChange={vi.fn()}
      />,
    );
    expect(queryByTestId('swatch-hairColor-color.black')).toBeNull();

    // Picking a real hair style reveals the hair-color row
    rerender(
      <AvatarFeatureBuilder
        avatarFeatures={{ hair: 'hair.buzz' }}
        onFeatureChange={vi.fn()}
      />,
    );
    expect(queryByTestId('swatch-hairColor-color.black')).not.toBeNull();
  });

  it('hides beard-color row when beard style is "beard.none"', () => {
    const { rerender, queryByTestId } = render(
      <AvatarFeatureBuilder
        avatarFeatures={{ beard: 'beard.none' }}
        onFeatureChange={vi.fn()}
      />,
    );
    expect(queryByTestId('swatch-beardColor-color.black')).toBeNull();

    rerender(
      <AvatarFeatureBuilder
        avatarFeatures={{ beard: 'beard.goatee' }}
        onFeatureChange={vi.fn()}
      />,
    );
    expect(queryByTestId('swatch-beardColor-color.black')).not.toBeNull();
  });

  it('fires onFeatureChange for every category', () => {
    const onChange = vi.fn();
    render(
      <AvatarFeatureBuilder
        avatarFeatures={{ hair: 'hair.buzz', beard: 'beard.goatee' }}
        onFeatureChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId('swatch-hair-hair.long'));
    expect(onChange).toHaveBeenCalledWith('hair', 'hair.long');

    fireEvent.click(screen.getByTestId('swatch-eyes-eyes.narrow'));
    expect(onChange).toHaveBeenCalledWith('eyes', 'eyes.narrow');

    fireEvent.click(screen.getByTestId('swatch-glasses-glasses.shades'));
    expect(onChange).toHaveBeenCalledWith('glasses', 'glasses.shades');

    fireEvent.click(screen.getByTestId('swatch-hat-hat.cap'));
    expect(onChange).toHaveBeenCalledWith('hat', 'hat.cap');
  });

  it('renders "none" swatches for categories that allow it', () => {
    render(<AvatarFeatureBuilder avatarFeatures={{}} onFeatureChange={vi.fn()} />);
    expect(screen.getByTestId('swatch-hair-hair.none')).toBeTruthy();
    expect(screen.getByTestId('swatch-beard-beard.none')).toBeTruthy();
    expect(screen.getByTestId('swatch-glasses-glasses.none')).toBeTruthy();
    expect(screen.getByTestId('swatch-hat-hat.none')).toBeTruthy();
  });
});
