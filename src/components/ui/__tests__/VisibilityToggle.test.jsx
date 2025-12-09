/**
 * VisibilityToggle.test.jsx - Tests for VisibilityToggle component
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisibilityToggle } from '../VisibilityToggle';

describe('VisibilityToggle', () => {
  const defaultProps = {
    visible: true,
    onToggle: vi.fn(),
  };

  beforeEach(() => {
    defaultProps.onToggle.mockClear();
  });

  describe('rendering', () => {
    it('renders as a button', () => {
      render(<VisibilityToggle {...defaultProps} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('shows eye emoji when visible is true', () => {
      render(<VisibilityToggle {...defaultProps} visible={true} />);
      expect(screen.getByText('👁')).toBeInTheDocument();
    });

    it('shows crossed-eye emoji when visible is false', () => {
      render(<VisibilityToggle {...defaultProps} visible={false} />);
      expect(screen.getByText('👁‍🗨')).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('renders small size by default', () => {
      const { container } = render(<VisibilityToggle {...defaultProps} />);
      const button = container.querySelector('button');
      expect(button.style.width).toBe('24px');
      expect(button.style.height).toBe('24px');
    });

    it('renders small size when specified', () => {
      const { container } = render(<VisibilityToggle {...defaultProps} size="small" />);
      const button = container.querySelector('button');
      expect(button.style.width).toBe('24px');
      expect(button.style.height).toBe('24px');
    });

    it('renders large size when specified', () => {
      const { container } = render(<VisibilityToggle {...defaultProps} size="large" />);
      const button = container.querySelector('button');
      expect(button.style.width).toBe('40px');
      expect(button.style.height).toBe('40px');
    });

    it('uses small text for small size', () => {
      render(<VisibilityToggle {...defaultProps} size="small" />);
      const emojiContainer = screen.getByText('👁').closest('div');
      expect(emojiContainer.className).toContain('text-xs');
    });

    it('uses large text for large size', () => {
      render(<VisibilityToggle {...defaultProps} size="large" />);
      const emojiContainer = screen.getByText('👁').closest('div');
      expect(emojiContainer.className).toContain('text-xl');
    });
  });

  describe('click behavior', () => {
    it('calls onToggle when clicked', () => {
      render(<VisibilityToggle {...defaultProps} />);

      fireEvent.click(screen.getByRole('button'));

      expect(defaultProps.onToggle).toHaveBeenCalledTimes(1);
    });

    it('stops event propagation on click', () => {
      const parentHandler = vi.fn();

      render(
        <div onClick={parentHandler}>
          <VisibilityToggle {...defaultProps} />
        </div>
      );

      fireEvent.click(screen.getByRole('button'));

      expect(defaultProps.onToggle).toHaveBeenCalled();
      expect(parentHandler).not.toHaveBeenCalled();
    });

    it('toggles from visible to hidden', () => {
      const { rerender } = render(<VisibilityToggle {...defaultProps} visible={true} />);
      expect(screen.getByText('👁')).toBeInTheDocument();

      rerender(<VisibilityToggle {...defaultProps} visible={false} />);
      expect(screen.getByText('👁‍🗨')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('has gray background', () => {
      render(<VisibilityToggle {...defaultProps} />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-gray-600');
    });

    it('has hover background change', () => {
      render(<VisibilityToggle {...defaultProps} />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('hover:bg-gray-700');
    });

    it('has rounded corners', () => {
      render(<VisibilityToggle {...defaultProps} />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('rounded');
    });

    it('has shadow', () => {
      render(<VisibilityToggle {...defaultProps} />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('shadow');
    });

    it('has cursor pointer', () => {
      render(<VisibilityToggle {...defaultProps} />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('cursor-pointer');
    });

    it('centers content with flex', () => {
      render(<VisibilityToggle {...defaultProps} />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('flex');
      expect(button.className).toContain('items-center');
      expect(button.className).toContain('justify-center');
    });

    it('has white text color for emoji', () => {
      render(<VisibilityToggle {...defaultProps} />);
      const emojiContainer = screen.getByText('👁').closest('div');
      expect(emojiContainer.className).toContain('text-white');
    });
  });

  describe('edge cases', () => {
    it('works with false visible prop', () => {
      render(<VisibilityToggle visible={false} onToggle={defaultProps.onToggle} />);
      expect(screen.getByText('👁‍🗨')).toBeInTheDocument();
    });
  });
});
