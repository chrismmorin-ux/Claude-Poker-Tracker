// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PositionBadge } from '../PositionBadge';

describe('PositionBadge', () => {
  it('returns null for invalid type', () => {
    const { container } = render(<PositionBadge type="invalid" />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null for undefined type', () => {
    const { container } = render(<PositionBadge type={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it.each([
    ['dealer', 'D'],
    ['sb', 'SB'],
    ['bb', 'BB'],
    ['me', 'ME'],
  ])('renders %s badge with label %s', (type, label) => {
    render(<PositionBadge type={type} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('renders small size by default (16px)', () => {
    const { container } = render(<PositionBadge type="dealer" />);
    expect(container.firstChild.style.width).toBe('16px');
    expect(container.firstChild.style.height).toBe('16px');
  });

  it('renders large size (28px)', () => {
    const { container } = render(<PositionBadge type="dealer" size="large" />);
    expect(container.firstChild.style.width).toBe('28px');
    expect(container.firstChild.style.height).toBe('28px');
  });

  it('calls onDragStart on mouseDown when draggable', () => {
    const onDragStart = vi.fn();
    const { container } = render(
      <PositionBadge type="dealer" draggable onDragStart={onDragStart} />
    );
    fireEvent.mouseDown(container.firstChild);
    expect(onDragStart).toHaveBeenCalled();
  });

  it('does not call onDragStart when not draggable', () => {
    const onDragStart = vi.fn();
    const { container } = render(
      <PositionBadge type="dealer" onDragStart={onDragStart} />
    );
    fireEvent.mouseDown(container.firstChild);
    expect(onDragStart).not.toHaveBeenCalled();
  });
});
