/**
 * SessionForm.test.jsx - Tests for SessionForm component
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionForm } from '../SessionForm';

describe('SessionForm', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    scale: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders form title', () => {
      render(<SessionForm {...defaultProps} />);
      expect(screen.getByText('Start New Session')).toBeInTheDocument();
    });

    it('renders game type buttons', () => {
      render(<SessionForm {...defaultProps} />);
      expect(screen.getByText('Tournament')).toBeInTheDocument();
      expect(screen.getByText('1/2')).toBeInTheDocument();
      expect(screen.getByText('1/3')).toBeInTheDocument();
      expect(screen.getByText('2/5')).toBeInTheDocument();
    });

    it('renders venue dropdown', () => {
      render(<SessionForm {...defaultProps} />);
      expect(screen.getByText('Venue')).toBeInTheDocument();
      expect(screen.getByText('Select venue...')).toBeInTheDocument();
    });

    it('renders buy-in input', () => {
      render(<SessionForm {...defaultProps} />);
      expect(screen.getByText('Buy-in')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('200')).toBeInTheDocument();
    });

    it('renders goal dropdown', () => {
      render(<SessionForm {...defaultProps} />);
      expect(screen.getByText('Goal (optional)')).toBeInTheDocument();
      expect(screen.getByText('Select a goal...')).toBeInTheDocument();
    });

    it('renders notes textarea', () => {
      render(<SessionForm {...defaultProps} />);
      expect(screen.getByText('Notes (optional)')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Any notes for this session...')).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
      render(<SessionForm {...defaultProps} />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders Start Session button', () => {
      render(<SessionForm {...defaultProps} />);
      expect(screen.getByText('Start Session')).toBeInTheDocument();
    });

    it('renders close button', () => {
      render(<SessionForm {...defaultProps} />);
      expect(screen.getByText('×')).toBeInTheDocument();
    });
  });

  describe('game type selection', () => {
    it('defaults to 1/2 game type', () => {
      render(<SessionForm {...defaultProps} />);
      const oneTwo = screen.getByText('1/2');
      expect(oneTwo.className).toContain('bg-blue-600');
    });

    it('selects game type on click', () => {
      render(<SessionForm {...defaultProps} />);

      fireEvent.click(screen.getByText('2/5'));

      const twoFive = screen.getByText('2/5');
      expect(twoFive.className).toContain('bg-blue-600');
    });

    it('auto-fills buy-in when game type is selected', () => {
      render(<SessionForm {...defaultProps} />);
      const buyInInput = screen.getByPlaceholderText('200');

      // Default is 1/2 = $200
      expect(buyInInput).toHaveValue('200');

      // Change to 2/5
      fireEvent.click(screen.getByText('2/5'));
      expect(buyInInput).toHaveValue('500');
    });

    it('uses default game type from props', () => {
      render(<SessionForm {...defaultProps} defaultGameType="TWO_FIVE" />);

      const twoFive = screen.getByText('2/5');
      expect(twoFive.className).toContain('bg-blue-600');
    });
  });

  describe('venue selection', () => {
    it('shows venue options', () => {
      render(<SessionForm {...defaultProps} />);
      const venueSelects = screen.getAllByRole('combobox');
      // First combobox is venue
      expect(venueSelects[0]).toBeInTheDocument();
      expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('uses default venue from props', () => {
      render(<SessionForm {...defaultProps} defaultVenue="Horseshoe Casino" />);
      const venueSelect = screen.getAllByRole('combobox')[0];
      expect(venueSelect).toHaveValue('Horseshoe Casino');
    });
  });

  describe('form submission', () => {
    it('calls onSubmit with form data', () => {
      render(<SessionForm {...defaultProps} />);

      // Fill out form
      const buyInInput = screen.getByPlaceholderText('200');
      fireEvent.change(buyInInput, { target: { value: '300' } });

      // Submit
      fireEvent.click(screen.getByText('Start Session'));

      expect(defaultProps.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          gameType: '1/2',
          buyIn: 300,
        })
      );
    });

    it('includes venue in submission', () => {
      render(<SessionForm {...defaultProps} />);

      const venueSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(venueSelect, { target: { value: 'Horseshoe Casino' } });

      fireEvent.click(screen.getByText('Start Session'));

      expect(defaultProps.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          venue: 'Horseshoe Casino',
        })
      );
    });

    it('includes notes in submission', () => {
      render(<SessionForm {...defaultProps} />);

      const notesInput = screen.getByPlaceholderText('Any notes for this session...');
      fireEvent.change(notesInput, { target: { value: 'Test notes' } });

      fireEvent.click(screen.getByText('Start Session'));

      expect(defaultProps.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'Test notes',
        })
      );
    });

    it('handles empty buy-in', () => {
      render(<SessionForm {...defaultProps} />);

      const buyInInput = screen.getByPlaceholderText('200');
      fireEvent.change(buyInInput, { target: { value: '' } });

      fireEvent.click(screen.getByText('Start Session'));

      expect(defaultProps.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          buyIn: null,
        })
      );
    });
  });

  describe('form validation', () => {
    it('shows error for invalid buy-in', () => {
      render(<SessionForm {...defaultProps} />);

      const buyInInput = screen.getByPlaceholderText('200');
      fireEvent.change(buyInInput, { target: { value: '-50' } });

      fireEvent.click(screen.getByText('Start Session'));

      expect(screen.getByText('Buy-in must be a positive number')).toBeInTheDocument();
      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('shows error for non-numeric buy-in', () => {
      render(<SessionForm {...defaultProps} />);

      const buyInInput = screen.getByPlaceholderText('200');
      fireEvent.change(buyInInput, { target: { value: 'abc' } });

      fireEvent.click(screen.getByText('Start Session'));

      expect(screen.getByText('Buy-in must be a positive number')).toBeInTheDocument();
      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('cancel functionality', () => {
    it('calls onCancel when Cancel button clicked', () => {
      render(<SessionForm {...defaultProps} />);

      fireEvent.click(screen.getByText('Cancel'));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('calls onCancel when close button clicked', () => {
      render(<SessionForm {...defaultProps} />);

      fireEvent.click(screen.getByText('×'));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('calls onCancel when clicking backdrop', () => {
      const { container } = render(<SessionForm {...defaultProps} />);

      // Click on the overlay background
      const overlay = container.querySelector('.fixed.inset-0');
      fireEvent.click(overlay);

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('does not cancel when clicking form content', () => {
      render(<SessionForm {...defaultProps} />);

      fireEvent.click(screen.getByText('Start New Session'));

      expect(defaultProps.onCancel).not.toHaveBeenCalled();
    });
  });

  describe('custom goal', () => {
    it('shows custom goal input when Custom goal selected', () => {
      render(<SessionForm {...defaultProps} />);

      const goalSelect = screen.getAllByRole('combobox')[1];
      fireEvent.change(goalSelect, { target: { value: 'Custom goal...' } });

      expect(screen.getByPlaceholderText('Enter your custom goal')).toBeInTheDocument();
    });

    it('uses custom goal text in submission', () => {
      render(<SessionForm {...defaultProps} />);

      const goalSelect = screen.getAllByRole('combobox')[1];
      fireEvent.change(goalSelect, { target: { value: 'Custom goal...' } });

      const customGoalInput = screen.getByPlaceholderText('Enter your custom goal');
      fireEvent.change(customGoalInput, { target: { value: 'My custom goal' } });

      fireEvent.click(screen.getByText('Start Session'));

      expect(defaultProps.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          goal: 'My custom goal',
        })
      );
    });
  });

  describe('styling', () => {
    it('applies scale from props', () => {
      const { container } = render(<SessionForm {...defaultProps} scale={0.8} />);
      const form = container.querySelector('.bg-white.rounded-lg');
      expect(form.style.transform).toBe('scale(0.8)');
    });

    it('has fixed overlay for modal', () => {
      const { container } = render(<SessionForm {...defaultProps} />);
      expect(container.querySelector('.fixed.inset-0')).toBeInTheDocument();
    });

    it('has z-50 for stacking context', () => {
      const { container } = render(<SessionForm {...defaultProps} />);
      expect(container.querySelector('.z-50')).toBeInTheDocument();
    });
  });

  describe('game type required indicator', () => {
    it('shows required asterisk for game type', () => {
      render(<SessionForm {...defaultProps} />);
      expect(screen.getByText('*')).toBeInTheDocument();
    });
  });

  describe('tournament game type', () => {
    it('clears buy-in for tournament', () => {
      render(<SessionForm {...defaultProps} />);

      fireEvent.click(screen.getByText('Tournament'));

      const buyInInput = screen.getByPlaceholderText('200');
      expect(buyInInput).toHaveValue('');
    });
  });
});
