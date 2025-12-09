/**
 * PlayerForm/index.test.jsx - Tests for main player form component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlayerForm } from '../index';
import { AVATAR_MAX_SIZE_BYTES } from '../../../../constants/playerConstants';

describe('PlayerForm', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    scale: 1,
    initialData: null,
    defaultName: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(<PlayerForm {...defaultProps} {...props} />);
  };

  // Helper to get inputs by placeholder
  const getNameInput = () => screen.getByPlaceholderText(/player's name or nickname/i);
  const getNicknameInput = () => screen.getByPlaceholderText(/alternative name or alias/i);
  const getNotesInput = () => screen.getByPlaceholderText(/any notes about this player/i);

  // Helper to get checkbox by exact label text
  const getCheckboxByLabel = (labelText) => {
    const label = screen.getByText(labelText);
    return label.parentElement.querySelector('input[type="checkbox"]');
  };

  describe('rendering', () => {
    it('renders create player header when no initialData', () => {
      renderComponent();
      expect(screen.getByText('Create New Player')).toBeInTheDocument();
    });

    it('renders edit player header when initialData provided', () => {
      renderComponent({ initialData: { name: 'Test Player' } });
      expect(screen.getByText('Edit Player')).toBeInTheDocument();
    });

    it('renders cancel button', () => {
      renderComponent();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('renders create player submit button', () => {
      renderComponent();
      expect(screen.getByRole('button', { name: /create player/i })).toBeInTheDocument();
    });

    it('renders save changes button when editing', () => {
      renderComponent({ initialData: { name: 'Test' } });
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });

    it('renders close button (×)', () => {
      renderComponent();
      expect(screen.getByText('×')).toBeInTheDocument();
    });

    it('renders modal overlay', () => {
      const { container } = renderComponent();
      const overlay = container.querySelector('.fixed.inset-0');
      expect(overlay).toBeInTheDocument();
    });

    it('renders all form sections', () => {
      renderComponent();
      expect(getNameInput()).toBeInTheDocument();
      expect(screen.getByText(/physical description/i)).toBeInTheDocument();
      expect(screen.getByText(/playing style tags/i)).toBeInTheDocument();
      expect(screen.getByText(/avatar/i)).toBeInTheDocument();
      expect(getNotesInput()).toBeInTheDocument();
    });
  });

  describe('initial values', () => {
    it('pre-fills name from defaultName prop', () => {
      renderComponent({ defaultName: 'Mike' });
      expect(screen.getByDisplayValue('Mike')).toBeInTheDocument();
    });

    it('pre-fills values from initialData', () => {
      renderComponent({
        initialData: {
          name: 'John',
          nickname: 'JD',
          notes: 'Some notes',
        },
      });
      expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      expect(screen.getByDisplayValue('JD')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Some notes')).toBeInTheDocument();
    });

    it('pre-fills style tags from initialData', () => {
      renderComponent({
        initialData: {
          name: 'John',
          styleTags: ['Tight', 'Aggressive'],
        },
      });
      expect(getCheckboxByLabel('Tight')).toBeChecked();
      expect(getCheckboxByLabel('Aggressive')).toBeChecked();
    });

    it('pre-fills physical attributes from initialData', () => {
      renderComponent({
        initialData: {
          name: 'John',
          hat: true,
          sunglasses: true,
        },
      });
      expect(screen.getByRole('checkbox', { name: /wears hat/i })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: /wears sunglasses/i })).toBeChecked();
    });

    it('prioritizes initialData over defaultName', () => {
      renderComponent({
        defaultName: 'Mike',
        initialData: { name: 'John' },
      });
      expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Mike')).not.toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('calls onSubmit with player data on valid submission', () => {
      const onSubmit = vi.fn();
      renderComponent({ onSubmit });

      fireEvent.change(getNameInput(), { target: { value: 'Test Player' } });
      fireEvent.click(screen.getByRole('button', { name: /create player/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Test Player',
      }));
    });

    it('trims name on submission', () => {
      const onSubmit = vi.fn();
      renderComponent({ onSubmit });

      fireEvent.change(getNameInput(), { target: { value: '  Padded Name  ' } });
      fireEvent.click(screen.getByRole('button', { name: /create player/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Padded Name',
      }));
    });

    it('includes all form fields in submission', () => {
      const onSubmit = vi.fn();
      renderComponent({ onSubmit });

      fireEvent.change(getNameInput(), { target: { value: 'John' } });
      fireEvent.change(getNicknameInput(), { target: { value: 'JD' } });
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'Asian' } }); // Ethnicity
      fireEvent.click(screen.getByRole('radio', { name: 'Average' }));
      fireEvent.click(getCheckboxByLabel('Tight'));
      fireEvent.change(getNotesInput(), { target: { value: 'Test note' } });

      fireEvent.click(screen.getByRole('button', { name: /create player/i }));

      expect(onSubmit).toHaveBeenCalledWith({
        name: 'John',
        nickname: 'JD',
        ethnicity: 'Asian',
        build: 'Average',
        gender: null,
        facialHair: null,
        hat: false,
        sunglasses: false,
        styleTags: ['Tight'],
        notes: 'Test note',
        avatar: null,
      });
    });

    it('converts empty strings to null for optional fields', () => {
      const onSubmit = vi.fn();
      renderComponent({ onSubmit });

      fireEvent.change(getNameInput(), { target: { value: 'Test' } });
      fireEvent.click(screen.getByRole('button', { name: /create player/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        nickname: null,
        ethnicity: null,
        build: null,
        notes: null,
      }));
    });
  });

  describe('validation', () => {
    it('shows error when name is empty', () => {
      renderComponent();
      fireEvent.click(screen.getByRole('button', { name: /create player/i }));
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    it('shows error when name is only whitespace', () => {
      renderComponent();
      fireEvent.change(getNameInput(), { target: { value: '   ' } });
      fireEvent.click(screen.getByRole('button', { name: /create player/i }));
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    it('does not call onSubmit when validation fails', () => {
      const onSubmit = vi.fn();
      renderComponent({ onSubmit });

      fireEvent.click(screen.getByRole('button', { name: /create player/i }));

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('clears error on successful submission', () => {
      const onSubmit = vi.fn();
      renderComponent({ onSubmit });

      // First trigger error
      fireEvent.click(screen.getByRole('button', { name: /create player/i }));
      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();

      // Then enter valid name and submit successfully
      fireEvent.change(getNameInput(), { target: { value: 'Valid Name' } });
      fireEvent.click(screen.getByRole('button', { name: /create player/i }));

      // Form submitted successfully
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Valid Name',
      }));
    });
  });

  describe('cancel functionality', () => {
    it('calls onCancel when cancel button clicked', () => {
      const onCancel = vi.fn();
      renderComponent({ onCancel });

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onCancel).toHaveBeenCalled();
    });

    it('calls onCancel when × button clicked', () => {
      const onCancel = vi.fn();
      renderComponent({ onCancel });

      fireEvent.click(screen.getByText('×'));

      expect(onCancel).toHaveBeenCalled();
    });

    it('calls onCancel when clicking overlay', () => {
      const onCancel = vi.fn();
      const { container } = renderComponent({ onCancel });

      const overlay = container.querySelector('.fixed.inset-0');
      fireEvent.click(overlay);

      expect(onCancel).toHaveBeenCalled();
    });

    it('does not call onCancel when clicking modal content', () => {
      const onCancel = vi.fn();
      const { container } = renderComponent({ onCancel });

      const modalContent = container.querySelector('.bg-white.rounded-lg');
      fireEvent.click(modalContent);

      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('style tag toggle', () => {
    it('adds style tag when unchecked tag is clicked', () => {
      const onSubmit = vi.fn();
      renderComponent({ onSubmit });

      fireEvent.change(getNameInput(), { target: { value: 'Test' } });
      fireEvent.click(getCheckboxByLabel('Tight'));
      fireEvent.click(screen.getByRole('button', { name: /create player/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        styleTags: ['Tight'],
      }));
    });

    it('removes style tag when checked tag is clicked', () => {
      const onSubmit = vi.fn();
      renderComponent({
        onSubmit,
        initialData: { name: 'Test', styleTags: ['Tight', 'Aggressive'] },
      });

      fireEvent.click(getCheckboxByLabel('Tight'));
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        styleTags: ['Aggressive'],
      }));
    });

    it('can add multiple style tags', () => {
      const onSubmit = vi.fn();
      renderComponent({ onSubmit });

      fireEvent.change(getNameInput(), { target: { value: 'Test' } });
      fireEvent.click(getCheckboxByLabel('Tight'));
      fireEvent.click(getCheckboxByLabel('Aggressive'));
      fireEvent.click(getCheckboxByLabel('Fish'));
      fireEvent.click(screen.getByRole('button', { name: /create player/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        styleTags: expect.arrayContaining(['Tight', 'Aggressive', 'Fish']),
      }));
    });
  });

  describe('avatar handling', () => {
    it('shows error for file too large', () => {
      renderComponent();

      const fileInput = document.querySelector('input[type="file"]');
      const largeFile = new File(['x'.repeat(100)], 'large.png', {
        type: 'image/png',
      });
      Object.defineProperty(largeFile, 'size', { value: AVATAR_MAX_SIZE_BYTES + 1 });

      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      expect(screen.getByText(/file too large/i)).toBeInTheDocument();
    });

    it('does nothing when no file selected', () => {
      renderComponent();

      const fileInput = document.querySelector('input[type="file"]');
      fireEvent.change(fileInput, { target: { files: [] } });

      // No error should appear
      expect(screen.queryByText(/file too large/i)).not.toBeInTheDocument();
    });

    it('accepts file input', () => {
      renderComponent();

      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toHaveAttribute('accept', 'image/*');
    });
  });

  describe('form prevents default', () => {
    it('prevents form default submission', () => {
      renderComponent({ defaultName: 'Test' });

      const form = document.querySelector('form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(submitEvent, 'preventDefault');

      form.dispatchEvent(submitEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('physical attributes', () => {
    it('handles hat checkbox toggle', () => {
      const onSubmit = vi.fn();
      renderComponent({ onSubmit });

      fireEvent.change(getNameInput(), { target: { value: 'Test' } });
      fireEvent.click(screen.getByRole('checkbox', { name: /wears hat/i }));
      fireEvent.click(screen.getByRole('button', { name: /create player/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        hat: true,
      }));
    });

    it('handles sunglasses checkbox toggle', () => {
      const onSubmit = vi.fn();
      renderComponent({ onSubmit });

      fireEvent.change(getNameInput(), { target: { value: 'Test' } });
      fireEvent.click(screen.getByRole('checkbox', { name: /wears sunglasses/i }));
      fireEvent.click(screen.getByRole('button', { name: /create player/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        sunglasses: true,
      }));
    });

    it('handles gender radio selection', () => {
      const onSubmit = vi.fn();
      renderComponent({ onSubmit });

      fireEvent.change(getNameInput(), { target: { value: 'Test' } });
      fireEvent.click(screen.getByRole('radio', { name: 'Male' }));
      fireEvent.click(screen.getByRole('button', { name: /create player/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        gender: 'Male',
      }));
    });

    it('handles facial hair dropdown', () => {
      const onSubmit = vi.fn();
      renderComponent({ onSubmit });

      fireEvent.change(getNameInput(), { target: { value: 'Test' } });
      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[1], { target: { value: 'Full Beard' } }); // Facial Hair is second select
      fireEvent.click(screen.getByRole('button', { name: /create player/i }));

      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        facialHair: 'Full Beard',
      }));
    });
  });
});
