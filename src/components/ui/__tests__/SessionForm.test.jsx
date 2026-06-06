// @vitest-environment jsdom
/**
 * SessionForm.test.jsx - Tests for SessionForm component
 *
 * This component uses useSettings() context hook, so all renders must be wrapped
 * with SettingsProvider. Uses createMockSettingsState from shared test utils.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionForm } from '../SessionForm';
import { SettingsProvider } from '../../../contexts/SettingsContext';
import { createMockSettingsState } from '../../../test/utils';
import { DEFAULT_SETTINGS } from '../../../constants/settingsConstants';

// Wrapper that provides SettingsContext
// Pattern documented in engineering_practices.md "Testing Components with Context Dependencies"
const renderWithSettings = (ui, settingsState = createMockSettingsState()) => {
  return render(
    <SettingsProvider settingsState={settingsState} dispatchSettings={vi.fn()}>
      {ui}
    </SettingsProvider>
  );
};

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
      renderWithSettings(<SessionForm {...defaultProps} />);
      expect(screen.getByText('Start New Session')).toBeInTheDocument();
    });

    it('renders game type buttons', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);
      expect(screen.getByText('Tournament')).toBeInTheDocument();
      expect(screen.getByText('1/2')).toBeInTheDocument();
      expect(screen.getByText('1/3')).toBeInTheDocument();
      expect(screen.getByText('2/5')).toBeInTheDocument();
    });

    it('renders venue dropdown', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);
      expect(screen.getByText('Venue')).toBeInTheDocument();
      expect(screen.getByText('Select venue...')).toBeInTheDocument();
    });

    it('renders buy-in input', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);
      expect(screen.getByText('Buy-in')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('200')).toBeInTheDocument();
    });

    it('renders goal dropdown', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);
      expect(screen.getByText('Goal (optional)')).toBeInTheDocument();
      expect(screen.getByText('Select a goal...')).toBeInTheDocument();
    });

    it('renders notes textarea', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);
      expect(screen.getByText('Notes (optional)')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Any notes for this session...')).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders Start Session button', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);
      expect(screen.getByText('Start Session')).toBeInTheDocument();
    });

    it('renders close button', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);
      expect(screen.getByText('×')).toBeInTheDocument();
    });
  });

  describe('game type selection', () => {
    it('defaults to 1/2 game type', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);
      const oneTwo = screen.getByText('1/2');
      expect(oneTwo.className).toContain('bg-blue-600');
    });

    it('selects game type on click', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);

      fireEvent.click(screen.getByText('2/5'));

      const twoFive = screen.getByText('2/5');
      expect(twoFive.className).toContain('bg-blue-600');
    });

    it('auto-fills buy-in when game type is selected', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);
      const buyInInput = screen.getByPlaceholderText('200');

      // Default is 1/2 = $200
      expect(buyInInput).toHaveValue('200');

      // Change to 2/5
      fireEvent.click(screen.getByText('2/5'));
      expect(buyInInput).toHaveValue('500');
    });

    it('uses default game type from props', () => {
      renderWithSettings(<SessionForm {...defaultProps} defaultGameType="TWO_FIVE" />);

      const twoFive = screen.getByText('2/5');
      expect(twoFive.className).toContain('bg-blue-600');
    });
  });

  describe('venue selection', () => {
    it('shows venue options', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);
      const venueSelects = screen.getAllByRole('combobox');
      // First combobox is venue
      expect(venueSelects[0]).toBeInTheDocument();
      expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('uses default venue from props', () => {
      renderWithSettings(<SessionForm {...defaultProps} defaultVenue="Horseshoe Casino" />);
      const venueSelect = screen.getAllByRole('combobox')[0];
      expect(venueSelect).toHaveValue('Horseshoe Casino');
    });
  });

  describe('venue note hint', () => {
    const stateWithNotedVenue = createMockSettingsState({
      settings: {
        ...DEFAULT_SETTINGS,
        customVenues: [{ name: 'My Card Room', notes: 'soft 1/3, $5 max rake' }],
      },
    });

    it('shows the note when a custom venue with a note is selected', () => {
      renderWithSettings(
        <SessionForm {...defaultProps} defaultVenue="My Card Room" />,
        stateWithNotedVenue
      );
      expect(screen.getByText('soft 1/3, $5 max rake')).toBeInTheDocument();
    });

    it('does not show a note for a built-in venue', () => {
      renderWithSettings(
        <SessionForm {...defaultProps} defaultVenue="Online" />,
        stateWithNotedVenue
      );
      expect(screen.queryByText('soft 1/3, $5 max rake')).not.toBeInTheDocument();
    });

    it('shows no note hint when no venue is selected', () => {
      renderWithSettings(<SessionForm {...defaultProps} />, stateWithNotedVenue);
      expect(screen.queryByText('soft 1/3, $5 max rake')).not.toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('calls onSubmit with form data', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);

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
      renderWithSettings(<SessionForm {...defaultProps} />);

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
      renderWithSettings(<SessionForm {...defaultProps} />);

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
      renderWithSettings(<SessionForm {...defaultProps} />);

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
      renderWithSettings(<SessionForm {...defaultProps} />);

      const buyInInput = screen.getByPlaceholderText('200');
      fireEvent.change(buyInInput, { target: { value: '-50' } });

      fireEvent.click(screen.getByText('Start Session'));

      expect(screen.getByText('Buy-in must be a positive number')).toBeInTheDocument();
      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('shows error for non-numeric buy-in', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);

      const buyInInput = screen.getByPlaceholderText('200');
      fireEvent.change(buyInInput, { target: { value: 'abc' } });

      fireEvent.click(screen.getByText('Start Session'));

      expect(screen.getByText('Buy-in must be a positive number')).toBeInTheDocument();
      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('cancel functionality', () => {
    it('calls onCancel when Cancel button clicked', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);

      fireEvent.click(screen.getByText('Cancel'));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('calls onCancel when close button clicked', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);

      fireEvent.click(screen.getByText('×'));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('calls onCancel when clicking backdrop', () => {
      const { container } = renderWithSettings(<SessionForm {...defaultProps} />);

      // Click on the overlay background
      const overlay = container.querySelector('.fixed.inset-0');
      fireEvent.click(overlay);

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('does not cancel when clicking form content', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);

      fireEvent.click(screen.getByText('Start New Session'));

      expect(defaultProps.onCancel).not.toHaveBeenCalled();
    });
  });

  describe('custom goal', () => {
    it('shows custom goal input when Custom goal selected', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);

      const goalSelect = screen.getAllByRole('combobox')[1];
      fireEvent.change(goalSelect, { target: { value: 'Custom goal...' } });

      expect(screen.getByPlaceholderText('Enter your custom goal')).toBeInTheDocument();
    });

    it('uses custom goal text in submission', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);

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
    it('renders a responsive modal (no scale transform)', () => {
      // Portrait-native (2026-06-06): the modal sizes fluidly (max-w-md, full
      // width) instead of being scaled, so fields stay legible on a phone.
      const { container } = renderWithSettings(<SessionForm {...defaultProps} />);
      const form = container.querySelector('.bg-gray-800.rounded-lg');
      expect(form.style.transform).toBe('');
      expect(form.className).toContain('max-w-md');
      expect(form.className).toContain('w-full');
    });

    it('has fixed overlay for modal', () => {
      const { container } = renderWithSettings(<SessionForm {...defaultProps} />);
      expect(container.querySelector('.fixed.inset-0')).toBeInTheDocument();
    });

    it('has z-50 for stacking context', () => {
      const { container } = renderWithSettings(<SessionForm {...defaultProps} />);
      expect(container.querySelector('.z-50')).toBeInTheDocument();
    });
  });

  describe('game type required indicator', () => {
    it('shows required asterisk for game type', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);
      expect(screen.getByText('*')).toBeInTheDocument();
    });
  });

  describe('tournament game type', () => {
    it('hides buy-in field for tournament and shows tournament setup', () => {
      renderWithSettings(<SessionForm {...defaultProps} />);

      fireEvent.click(screen.getByText('Tournament'));

      // Buy-in field should be hidden
      expect(screen.queryByPlaceholderText('200')).not.toBeInTheDocument();

      // Tournament setup fields should be visible
      expect(screen.getByText('Format')).toBeInTheDocument();
      expect(screen.getByText('Starting Stack')).toBeInTheDocument();
    });
  });
});
