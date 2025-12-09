/**
 * AvatarSection.test.jsx - Tests for avatar upload and preview
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AvatarSection } from '../AvatarSection';

describe('AvatarSection', () => {
  const defaultProps = {
    avatar: null,
    onAvatarChange: vi.fn(),
    error: undefined,
  };

  const renderComponent = (props = {}) => {
    return render(<AvatarSection {...defaultProps} {...props} />);
  };

  describe('rendering', () => {
    it('renders avatar label', () => {
      renderComponent();
      expect(screen.getByText(/avatar/i)).toBeInTheDocument();
    });

    it('shows avatar is optional', () => {
      renderComponent();
      expect(screen.getByText(/optional/i)).toBeInTheDocument();
    });

    it('renders file input', () => {
      renderComponent();
      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
    });

    it('accepts image files only', () => {
      renderComponent();
      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toHaveAttribute('accept', 'image/*');
    });

    it('has border-t class for top border', () => {
      const { container } = renderComponent();
      expect(container.firstChild).toHaveClass('border-t');
    });
  });

  describe('avatar preview', () => {
    it('does not show preview when no avatar', () => {
      renderComponent({ avatar: null });
      expect(screen.queryByAltText(/avatar preview/i)).not.toBeInTheDocument();
    });

    it('shows preview when avatar is provided', () => {
      const avatarDataUrl = 'data:image/png;base64,abc123';
      renderComponent({ avatar: avatarDataUrl });
      expect(screen.getByAltText(/avatar preview/i)).toBeInTheDocument();
    });

    it('displays avatar image with correct src', () => {
      const avatarDataUrl = 'data:image/png;base64,abc123';
      renderComponent({ avatar: avatarDataUrl });
      const img = screen.getByAltText(/avatar preview/i);
      expect(img).toHaveAttribute('src', avatarDataUrl);
    });

    it('preview has proper styling', () => {
      const avatarDataUrl = 'data:image/png;base64,abc123';
      renderComponent({ avatar: avatarDataUrl });
      const img = screen.getByAltText(/avatar preview/i);
      expect(img).toHaveClass('w-20', 'h-20', 'object-cover', 'rounded-full');
    });
  });

  describe('error handling', () => {
    it('does not show error when no error', () => {
      renderComponent({ error: undefined });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows error message when error is provided', () => {
      renderComponent({ error: 'File too large' });
      expect(screen.getByText('File too large')).toBeInTheDocument();
    });

    it('error message has red styling', () => {
      renderComponent({ error: 'File too large' });
      const error = screen.getByText('File too large');
      expect(error).toHaveClass('text-red-500');
    });
  });

  describe('user interactions', () => {
    it('calls onAvatarChange when file is selected', () => {
      const onAvatarChange = vi.fn();
      renderComponent({ onAvatarChange });

      const fileInput = document.querySelector('input[type="file"]');
      const file = new File(['(test)'], 'test.png', { type: 'image/png' });

      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(onAvatarChange).toHaveBeenCalled();
    });

    it('passes event object to onAvatarChange', () => {
      const onAvatarChange = vi.fn();
      renderComponent({ onAvatarChange });

      const fileInput = document.querySelector('input[type="file"]');
      const file = new File(['(test)'], 'test.png', { type: 'image/png' });

      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(onAvatarChange.mock.calls[0][0]).toBeDefined();
      expect(onAvatarChange.mock.calls[0][0].target.files[0]).toBe(file);
    });
  });

  describe('combined states', () => {
    it('shows both preview and error if both exist', () => {
      const avatarDataUrl = 'data:image/png;base64,abc123';
      renderComponent({ avatar: avatarDataUrl, error: 'Previous file was too large' });

      expect(screen.getByAltText(/avatar preview/i)).toBeInTheDocument();
      expect(screen.getByText('Previous file was too large')).toBeInTheDocument();
    });
  });
});
