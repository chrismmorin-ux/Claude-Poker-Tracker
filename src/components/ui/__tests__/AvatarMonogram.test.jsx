// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AvatarMonogram, { getInitials, getBgColor, MONOGRAM_PALETTE } from '../AvatarMonogram';

describe('getInitials', () => {
  it('returns "?" for null/undefined/empty', () => {
    expect(getInitials(null)).toBe('?');
    expect(getInitials(undefined)).toBe('?');
    expect(getInitials('')).toBe('?');
    expect(getInitials('   ')).toBe('?');
  });

  it('uses first letter of single-word name', () => {
    expect(getInitials('Mike')).toBe('M');
    expect(getInitials('alice')).toBe('A');
  });

  it('uses first+last initial for multi-word', () => {
    expect(getInitials('Mike Jones')).toBe('MJ');
    expect(getInitials('Sarah Beth Smith')).toBe('SS');
  });

  it('handles multiple spaces', () => {
    expect(getInitials('  Mike   Jones  ')).toBe('MJ');
  });

  it('is case-insensitive in output (always uppercase)', () => {
    expect(getInitials('mike jones')).toBe('MJ');
    expect(getInitials('MIKE JONES')).toBe('MJ');
  });
});

describe('getBgColor', () => {
  it('returns a gray fallback for missing name', () => {
    expect(getBgColor(null)).toBe('#6b6b6b');
    expect(getBgColor('')).toBe('#6b6b6b');
  });

  it('returns a palette color for any real name', () => {
    const color = getBgColor('Mike');
    expect(MONOGRAM_PALETTE).toContain(color);
  });

  it('is deterministic (same name → same color)', () => {
    expect(getBgColor('Mike')).toBe(getBgColor('Mike'));
    expect(getBgColor('Sarah Jones')).toBe(getBgColor('Sarah Jones'));
  });

  it('different names usually map to different colors', () => {
    // Sample a handful of names; at least 3 distinct colors should appear.
    const colors = new Set(
      ['Mike', 'Sarah', 'John', 'Emily', 'Omar', 'Priya', 'Yuki', 'Diego'].map(getBgColor),
    );
    expect(colors.size).toBeGreaterThanOrEqual(3);
  });
});

describe('<AvatarMonogram />', () => {
  it('renders initials as <text> content', () => {
    const { container } = render(<AvatarMonogram name="Mike Jones" size={48} />);
    const text = container.querySelector('text');
    expect(text?.textContent).toBe('MJ');
  });

  it('renders "?" for missing name', () => {
    const { container } = render(<AvatarMonogram name={null} size={48} />);
    expect(container.querySelector('text')?.textContent).toBe('?');
  });

  it('applies deterministic palette color to <circle>', () => {
    const { container } = render(<AvatarMonogram name="Mike" size={48} />);
    const fill = container.querySelector('circle').getAttribute('fill');
    expect(MONOGRAM_PALETTE).toContain(fill);
  });

  it('accepts size prop and sets width+height', () => {
    const { container } = render(<AvatarMonogram name="Mike" size={64} />);
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('width')).toBe('64');
    expect(svg.getAttribute('height')).toBe('64');
  });

  it('exposes role=img and aria-label', () => {
    const { container } = render(<AvatarMonogram name="Mike" size={48} />);
    const svg = container.querySelector('svg');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toContain('Mike');
  });
});
