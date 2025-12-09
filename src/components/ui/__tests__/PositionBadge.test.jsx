/**
 * PositionBadge.test.jsx - Tests for PositionBadge component
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PositionBadge } from '../PositionBadge';

describe('PositionBadge', () => {
  describe('rendering', () => {
    it('returns null for invalid type', () => {
      const { container } = render(<PositionBadge type="invalid" />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null for undefined type', () => {
      const { container } = render(<PositionBadge type={undefined} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('dealer badge', () => {
    it('renders D label for dealer type', () => {
      render(<PositionBadge type="dealer" />);
      expect(screen.getByText('D')).toBeInTheDocument();
    });

    it('applies white background for dealer', () => {
      const { container } = render(<PositionBadge type="dealer" />);
      expect(container.firstChild.className).toContain('bg-white');
    });

    it('applies black text for dealer', () => {
      render(<PositionBadge type="dealer" />);
      const label = screen.getByText('D');
      expect(label.className).toContain('text-black');
    });
  });

  describe('sb badge', () => {
    it('renders SB label for sb type', () => {
      render(<PositionBadge type="sb" />);
      expect(screen.getByText('SB')).toBeInTheDocument();
    });

    it('applies blue background for sb', () => {
      const { container } = render(<PositionBadge type="sb" />);
      expect(container.firstChild.className).toContain('bg-blue-400');
    });

    it('applies white text for sb', () => {
      render(<PositionBadge type="sb" />);
      const label = screen.getByText('SB');
      expect(label.className).toContain('text-white');
    });
  });

  describe('bb badge', () => {
    it('renders BB label for bb type', () => {
      render(<PositionBadge type="bb" />);
      expect(screen.getByText('BB')).toBeInTheDocument();
    });

    it('applies red background for bb', () => {
      const { container } = render(<PositionBadge type="bb" />);
      expect(container.firstChild.className).toContain('bg-red-400');
    });

    it('applies white text for bb', () => {
      render(<PositionBadge type="bb" />);
      const label = screen.getByText('BB');
      expect(label.className).toContain('text-white');
    });
  });

  describe('me badge', () => {
    it('renders ME label for me type', () => {
      render(<PositionBadge type="me" />);
      expect(screen.getByText('ME')).toBeInTheDocument();
    });

    it('applies purple background for me', () => {
      const { container } = render(<PositionBadge type="me" />);
      expect(container.firstChild.className).toContain('bg-purple-500');
    });

    it('applies white text for me', () => {
      render(<PositionBadge type="me" />);
      const label = screen.getByText('ME');
      expect(label.className).toContain('text-white');
    });
  });

  describe('sizes', () => {
    it('renders small size by default', () => {
      const { container } = render(<PositionBadge type="dealer" />);
      expect(container.firstChild.style.width).toBe('16px');
      expect(container.firstChild.style.height).toBe('16px');
    });

    it('renders small size when specified', () => {
      const { container } = render(<PositionBadge type="dealer" size="small" />);
      expect(container.firstChild.style.width).toBe('16px');
      expect(container.firstChild.style.height).toBe('16px');
    });

    it('renders large size when specified', () => {
      const { container } = render(<PositionBadge type="dealer" size="large" />);
      expect(container.firstChild.style.width).toBe('28px');
      expect(container.firstChild.style.height).toBe('28px');
    });

    it('uses larger text for dealer in large size', () => {
      render(<PositionBadge type="dealer" size="large" />);
      const label = screen.getByText('D');
      expect(label.className).toContain('text-lg');
    });

    it('uses smaller text for non-dealer in large size', () => {
      render(<PositionBadge type="sb" size="large" />);
      const label = screen.getByText('SB');
      expect(label.className).toContain('text-xs');
    });
  });

  describe('draggable behavior', () => {
    it('is not draggable by default', () => {
      const { container } = render(<PositionBadge type="dealer" />);
      expect(container.firstChild.className).not.toContain('cursor-move');
    });

    it('applies cursor-move when draggable', () => {
      const { container } = render(<PositionBadge type="dealer" draggable />);
      expect(container.firstChild.className).toContain('cursor-move');
    });

    it('applies select-none when draggable', () => {
      const { container } = render(<PositionBadge type="dealer" draggable />);
      expect(container.firstChild.className).toContain('select-none');
    });

    it('applies shadow-xl when draggable', () => {
      const { container } = render(<PositionBadge type="dealer" draggable />);
      expect(container.firstChild.className).toContain('shadow-xl');
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

  describe('styling', () => {
    it('has rounded-full for circular shape', () => {
      const { container } = render(<PositionBadge type="dealer" />);
      expect(container.firstChild.className).toContain('rounded-full');
    });

    it('has shadow styling', () => {
      const { container } = render(<PositionBadge type="dealer" />);
      expect(container.firstChild.className).toContain('shadow');
    });

    it('centers content with flex', () => {
      const { container } = render(<PositionBadge type="dealer" />);
      expect(container.firstChild.className).toContain('flex');
      expect(container.firstChild.className).toContain('items-center');
      expect(container.firstChild.className).toContain('justify-center');
    });

    it('has border styling', () => {
      const { container } = render(<PositionBadge type="dealer" />);
      expect(container.firstChild.className).toContain('border-2');
    });
  });
});
