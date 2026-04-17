// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ResultCard from '../ResultCard';

const mike = {
  playerId: 1,
  name: 'Mike',
  nickname: 'Big Mike',
  lastSeenAt: Date.now() - 1000 * 60 * 60 * 24 * 2,  // 2 days ago
  handCount: 47,
  avatarFeatures: {
    skin: 'skin.dark',
    hair: 'hair.buzz',
    beard: 'beard.goatee',
    glasses: 'glasses.none',
    hat: 'hat.cap',
  },
};

describe('<ResultCard />', () => {
  it('renders player name and meta', () => {
    const { container } = render(
      <ResultCard
        player={mike}
        score={{ nameMatchStart: null, nameMatchEnd: null, matchedFeatures: new Set() }}
        onSelect={vi.fn()}
        hasActiveFilters={false}
      />,
    );
    // Name rendered inside a <span> (avatar title may also say "Mike" — use container text)
    expect(container.textContent).toMatch(/Mike/);
    expect(screen.getByText(/47 hands/)).toBeTruthy();
  });

  it('bolds the matched name prefix', () => {
    const { container } = render(
      <ResultCard
        player={mike}
        score={{ nameMatchStart: 0, nameMatchEnd: 2, matchedFeatures: new Set() }}
        onSelect={vi.fn()}
        hasActiveFilters={true}
      />,
    );
    const bold = container.querySelector('.font-bold');
    expect(bold?.textContent).toBe('Mi');
  });

  it('fires onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(
      <ResultCard
        player={mike}
        score={{ nameMatchStart: null, nameMatchEnd: null, matchedFeatures: new Set() }}
        onSelect={onSelect}
        hasActiveFilters={false}
      />,
    );
    fireEvent.click(screen.getByTestId('result-card-1'));
    expect(onSelect).toHaveBeenCalledWith(mike);
  });

  it('shows left-border accent when every filter matches', () => {
    const { rerender } = render(
      <ResultCard
        player={mike}
        score={{
          nameMatchStart: null, nameMatchEnd: null,
          matchedFeatures: new Set(), allFiltersMatch: false,
        }}
        onSelect={vi.fn()}
        hasActiveFilters={true}
      />,
    );
    const withoutAccent = screen.getByTestId('result-card-1').className;
    expect(withoutAccent).not.toMatch(/border-l-amber/);

    rerender(
      <ResultCard
        player={mike}
        score={{
          nameMatchStart: null, nameMatchEnd: null,
          matchedFeatures: new Set(['beard']), allFiltersMatch: true,
        }}
        onSelect={vi.fn()}
        hasActiveFilters={true}
      />,
    );
    const withAccent = screen.getByTestId('result-card-1').className;
    expect(withAccent).toMatch(/border-l-amber/);
  });

  it('renders feature chips for visible features (skips .none)', () => {
    const { container } = render(
      <ResultCard
        player={mike}
        score={{ nameMatchStart: null, nameMatchEnd: null, matchedFeatures: new Set() }}
        onSelect={vi.fn()}
        hasActiveFilters={false}
      />,
    );
    // beard + hat are visible; glasses is .none and should not appear.
    expect(container.textContent).toMatch(/Goatee/);
    expect(container.textContent).toMatch(/Baseball Cap/);
    expect(container.textContent).not.toMatch(/Glasses/);
  });

  it('handles legacy player with null avatarFeatures (monogram + no chips)', () => {
    const legacy = { playerId: 99, name: 'Old', avatarFeatures: null, handCount: 5 };
    const { container } = render(
      <ResultCard
        player={legacy}
        score={{ nameMatchStart: null, nameMatchEnd: null, matchedFeatures: new Set() }}
        onSelect={vi.fn()}
        hasActiveFilters={false}
      />,
    );
    expect(container.textContent).toMatch(/Old/);
  });

  it('shows "never seen" when lastSeenAt is missing', () => {
    const noSeen = { playerId: 5, name: 'Never', avatarFeatures: null };
    render(
      <ResultCard
        player={noSeen}
        score={{ nameMatchStart: null, nameMatchEnd: null, matchedFeatures: new Set() }}
        onSelect={vi.fn()}
        hasActiveFilters={false}
      />,
    );
    expect(screen.getByText('never seen')).toBeTruthy();
  });
});
