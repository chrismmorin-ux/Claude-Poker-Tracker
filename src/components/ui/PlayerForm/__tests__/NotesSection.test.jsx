/**
 * NotesSection.test.jsx - Tests for notes textarea
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NotesSection } from '../NotesSection';

describe('NotesSection', () => {
  const defaultProps = {
    notes: '',
    setNotes: vi.fn(),
  };

  const renderComponent = (props = {}) => {
    return render(<NotesSection {...defaultProps} {...props} />);
  };

  describe('rendering', () => {
    it('renders notes label', () => {
      renderComponent();
      expect(screen.getByText(/notes/i)).toBeInTheDocument();
    });

    it('shows notes is optional', () => {
      renderComponent();
      expect(screen.getByText(/optional/i)).toBeInTheDocument();
    });

    it('renders placeholder text', () => {
      renderComponent();
      expect(screen.getByPlaceholderText(/any notes about this player/i)).toBeInTheDocument();
    });

    it('renders as a textarea element', () => {
      renderComponent();
      const textarea = screen.getByRole('textbox');
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('has 4 rows by default', () => {
      renderComponent();
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('rows', '4');
    });
  });

  describe('value display', () => {
    it('displays provided notes value', () => {
      renderComponent({ notes: 'This player is aggressive.' });
      expect(screen.getByDisplayValue('This player is aggressive.')).toBeInTheDocument();
    });

    it('displays empty textarea when no value provided', () => {
      renderComponent();
      const textarea = screen.getByRole('textbox');
      expect(textarea.value).toBe('');
    });

    it('displays multiline notes correctly', () => {
      const multilineNotes = 'Line 1\nLine 2\nLine 3';
      renderComponent({ notes: multilineNotes });
      const textarea = screen.getByRole('textbox');
      expect(textarea.value).toBe(multilineNotes);
    });
  });

  describe('user interactions', () => {
    it('calls setNotes when textarea changes', () => {
      const setNotes = vi.fn();
      renderComponent({ setNotes });

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New note' } });

      expect(setNotes).toHaveBeenCalledWith('New note');
    });

    it('calls setNotes with each character typed', () => {
      const setNotes = vi.fn();
      renderComponent({ setNotes });

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'A' } });
      fireEvent.change(textarea, { target: { value: 'AB' } });

      expect(setNotes).toHaveBeenCalledTimes(2);
    });

    it('allows clearing notes', () => {
      const setNotes = vi.fn();
      renderComponent({ notes: 'Some notes', setNotes });

      fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });

      expect(setNotes).toHaveBeenCalledWith('');
    });
  });

  describe('styling', () => {
    it('has resize-none class to prevent manual resizing', () => {
      renderComponent();
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('resize-none');
    });

    it('has focus ring styling', () => {
      renderComponent();
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('focus:ring-2', 'focus:ring-blue-500');
    });
  });
});
