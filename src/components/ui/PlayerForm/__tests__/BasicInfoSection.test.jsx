/**
 * BasicInfoSection.test.jsx - Tests for name and nickname inputs
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BasicInfoSection } from '../BasicInfoSection';

describe('BasicInfoSection', () => {
  const defaultProps = {
    name: '',
    setName: vi.fn(),
    nickname: '',
    setNickname: vi.fn(),
    errors: {},
  };

  const renderComponent = (props = {}) => {
    return render(<BasicInfoSection {...defaultProps} {...props} />);
  };

  describe('rendering', () => {
    it('renders name label', () => {
      renderComponent();
      expect(screen.getByText(/^name/i)).toBeInTheDocument();
    });

    it('renders nickname label', () => {
      renderComponent();
      expect(screen.getByText(/nickname/i)).toBeInTheDocument();
    });

    it('shows name is required with asterisk', () => {
      renderComponent();
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('shows nickname is optional', () => {
      renderComponent();
      expect(screen.getByText(/optional/i)).toBeInTheDocument();
    });

    it('renders name placeholder', () => {
      renderComponent();
      expect(screen.getByPlaceholderText(/player's name or nickname/i)).toBeInTheDocument();
    });

    it('renders nickname placeholder', () => {
      renderComponent();
      expect(screen.getByPlaceholderText(/alternative name or alias/i)).toBeInTheDocument();
    });

    it('renders two text inputs', () => {
      renderComponent();
      const inputs = screen.getAllByRole('textbox');
      expect(inputs).toHaveLength(2);
    });
  });

  describe('value display', () => {
    it('displays provided name value', () => {
      renderComponent({ name: 'John Doe' });
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    });

    it('displays provided nickname value', () => {
      renderComponent({ nickname: 'JD' });
      expect(screen.getByDisplayValue('JD')).toBeInTheDocument();
    });

    it('displays empty inputs when no values provided', () => {
      renderComponent();
      const inputs = screen.getAllByRole('textbox');
      expect(inputs[0].value).toBe('');
      expect(inputs[1].value).toBe('');
    });
  });

  describe('user interactions', () => {
    it('calls setName when name input changes', () => {
      const setName = vi.fn();
      renderComponent({ setName });

      const nameInput = screen.getByPlaceholderText(/player's name or nickname/i);
      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      expect(setName).toHaveBeenCalledWith('New Name');
    });

    it('calls setNickname when nickname input changes', () => {
      const setNickname = vi.fn();
      renderComponent({ setNickname });

      const nicknameInput = screen.getByPlaceholderText(/alternative name or alias/i);
      fireEvent.change(nicknameInput, { target: { value: 'Nick' } });

      expect(setNickname).toHaveBeenCalledWith('Nick');
    });
  });

  describe('error handling', () => {
    it('shows error message when name error exists', () => {
      renderComponent({ errors: { name: 'Name is required' } });
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    it('applies error styling to name input when error exists', () => {
      renderComponent({ errors: { name: 'Name is required' } });
      const nameInput = screen.getByPlaceholderText(/player's name or nickname/i);
      expect(nameInput).toHaveClass('border-red-500');
    });

    it('does not show error styling when no errors', () => {
      renderComponent({ errors: {} });
      const nameInput = screen.getByPlaceholderText(/player's name or nickname/i);
      expect(nameInput).toHaveClass('border-gray-300');
      expect(nameInput).not.toHaveClass('border-red-500');
    });

    it('does not show error message when no name error', () => {
      renderComponent({ errors: {} });
      expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('name input has correct type', () => {
      renderComponent();
      const nameInput = screen.getByPlaceholderText(/player's name or nickname/i);
      expect(nameInput).toHaveAttribute('type', 'text');
    });

    it('nickname input has correct type', () => {
      renderComponent();
      const nicknameInput = screen.getByPlaceholderText(/alternative name or alias/i);
      expect(nicknameInput).toHaveAttribute('type', 'text');
    });
  });
});
